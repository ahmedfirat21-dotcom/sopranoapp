/**
 * SopranoChat — Oda Ici Canli Mesajlasma Servisi
 * Supabase Realtime ile canli metin sohbeti
 */
import { logger } from '../utils/logger';
import { supabase } from '../constants/supabase';
import { filterBadWords } from '../constants/badwords';
import { isSystemRoom } from './showcaseRooms';

export type RoomMessage = {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  type?: 'user' | 'system';
  created_at: string;
  profiles?: {
    display_name: string;
    avatar_url: string;
    active_chat_color?: string | null;
    active_frame?: string | null;
  };
  // Client-side flags
  isSystem?: boolean;
  isJoin?: boolean;
};

// ★ BÖLÜM 6 FIX: Profil cache — N+1 sorunu çözümü
// Her mesajda ayrı profil sorgusu yapmak yerine cache'ten oku
type CachedProfile = {
  display_name: string;
  avatar_url: string;
  active_chat_color?: string | null;
  active_frame?: string | null;
  cachedAt: number;
};
const _profileCache = new Map<string, CachedProfile>();
const CACHE_TTL = 5 * 60 * 1000; // 5 dakika

async function _getCachedProfile(userId: string): Promise<CachedProfile | null> {
  const cached = _profileCache.get(userId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return cached;
  }
  try {
    const { data } = await supabase
      .from('profiles')
      .select('display_name, avatar_url, active_chat_color, active_frame')
      .eq('id', userId)
      .single();
    if (data) {
      const entry = { ...data, cachedAt: Date.now() };
      _profileCache.set(userId, entry);
      return entry;
    }
  } catch {}
  return null;
}

// ★ SEC-FLOOD: Per-user rate limiter — emoji flood & chat spam koruması
// Map<"roomId:userId", { timestamps: number[], lastEmoji: number }>
const _rateLimitMap = new Map<string, { timestamps: number[]; lastEmoji: number }>();
const RATE_LIMIT_WINDOW = 2000; // 2 saniye pencere
const RATE_LIMIT_MAX = 5;       // 2 saniye içinde max 5 mesaj
const EMOJI_COOLDOWN = 500;     // Emoji-only mesajlar arası min 500ms

// Periyodik temizlik — lazy init, modül yüklendiğinde değil ilk kullanımda başlar
let _cleanupIntervalId: ReturnType<typeof setInterval> | null = null;
function _ensureCleanupInterval() {
  if (_cleanupIntervalId !== null) return;
  _cleanupIntervalId = setInterval(() => {
    const stale = Date.now() - 60_000;
    for (const [key, val] of _rateLimitMap) {
      if (val.timestamps.every(t => t < stale)) _rateLimitMap.delete(key);
    }
  }, 5 * 60 * 1000);
}

export const RoomChatService = {
  /**
   * Odadaki mesajlari getir (son 50)
   */
  async getMessages(roomId: string, limit = 50): Promise<RoomMessage[]> {
    // Sistem odalarında DB sorgusu yapma (UUID değil)
    if (isSystemRoom(roomId)) return [];
    const { data, error } = await supabase
      .from('messages')
      .select('*, profiles!messages_sender_id_fkey(display_name, avatar_url)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) {
      if (__DEV__) logger.warn('Room messages yuklenemedi:', error);
      return [];
    }
    // Cache'i doldur
    (data || []).forEach((msg: any) => {
      if (msg.profiles && msg.sender_id) {
        _profileCache.set(msg.sender_id, { ...msg.profiles, cachedAt: Date.now() });
      }
    });
    return (data || []) as RoomMessage[];
  },

  /**
   * Mesaj gonder — ★ SEC-FLOOD: Rate limit uygulanır
   */
  async send(roomId: string, userId: string, content: string): Promise<RoomMessage | null> {
    // Sistem odalarında DB'ye yazma (UUID değil)
    if (isSystemRoom(roomId)) return null;
    // ★ SEC-8c: Input sanitization — max 500 char, HTML strip, boş mesaj engelleme
    const sanitized = (content || '').trim().replace(/<[^>]*>/g, '').slice(0, 500);
    if (sanitized.length < 1) return null;

    _ensureCleanupInterval();
    // ★ SEC-FLOOD: Per-user rate limit — emoji flood & genel spam koruması
    const rateLimitKey = `${roomId}:${userId}`;
    const now = Date.now();
    let entry = _rateLimitMap.get(rateLimitKey);
    if (!entry) {
      entry = { timestamps: [], lastEmoji: 0 };
      _rateLimitMap.set(rateLimitKey, entry);
    }

    // Pencere dışındaki eski timestamp'leri temizle
    entry.timestamps = entry.timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);

    // Genel rate limit kontrolü
    if (entry.timestamps.length >= RATE_LIMIT_MAX) {
      if (__DEV__) logger.warn(`[RoomChat] Rate limit aşıldı: ${userId} (${entry.timestamps.length}/${RATE_LIMIT_MAX})`);
      return null; // Sessizce engelle
    }

    // Emoji-only mesajlar için ek cooldown
    const isEmojiOnly = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\u200d\uFE0F\u20E3]{1,6}$/u.test(sanitized) && sanitized.length <= 14;
    if (isEmojiOnly && now - entry.lastEmoji < EMOJI_COOLDOWN) {
      return null; // Emoji flood koruması — sessizce engelle
    }

    // Timestamp kaydet
    entry.timestamps.push(now);
    if (isEmojiOnly) entry.lastEmoji = now;

    // ★ O4 FIX: chat_muted backend kontrolü — client bypass koruması
    // ★ A5 FIX: Slow mode backend enforcement — frontend bypass koruma
    try {
      const { data: roomData } = await supabase
        .from('rooms')
        .select('room_settings, host_id')
        .eq('id', roomId)
        .single();

      // ★ O4 FIX: chat_muted kontrolü — moderatör tarafından susturulan kullanıcı mesaj gönderemez
      // ★ 2026-04-18: Chat_mute artık FAIL-CLOSED — DB query fail olursa bile engelle.
      // Önceki versiyonda tüm try/catch içindeydi → herhangi bir hata bypass sağlıyordu.
      if (roomData?.host_id !== userId) {
        const { data: partData, error: chatMuteErr } = await supabase
          .from('room_participants')
          .select('is_chat_muted')
          .eq('room_id', roomId)
          .eq('user_id', userId)
          .maybeSingle();
        if (chatMuteErr) {
          // Fail-closed: DB okunamadıysa güvenli taraf — mesajı gönderme
          if (__DEV__) console.warn('[roomChat] chat_mute kontrolü başarısız, mesaj reddedildi:', chatMuteErr.message);
          return null;
        }
        if (partData?.is_chat_muted) {
          return null; // Chat mute — sessizce engelle
        }
      }

      // Slow mode — fail-open (DB hatası mesajı geçirir, spam riskli ama chat kesintisiz)
      try {
        const rs = (roomData?.room_settings || {}) as any;
        const slowModeSec = rs.slow_mode_seconds || 0;
        if (slowModeSec > 0 && roomData?.host_id !== userId) {
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('created_at')
            .eq('room_id', roomId)
            .eq('sender_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (lastMsg) {
            const elapsed = Date.now() - new Date(lastMsg.created_at).getTime();
            if (elapsed < slowModeSec * 1000) {
              return null; // Slow mode — sessizce engelle
            }
          }
        }
      } catch { /* slow mode kontrolü fail-open — mesaj geçer */ }
    } catch { /* roomData fetch hatası — mesaj engellenmez, diğer DB katmanı koruyacak */ }

    const filteredContent = filterBadWords(sanitized);
    const { data, error } = await supabase
      .from('messages')
      .insert({ room_id: roomId, sender_id: userId, content: filteredContent })
      .select('*, profiles!messages_sender_id_fkey(display_name, avatar_url)')
      .single();
    if (error) {
      logger.error('Room mesaji gonderilemedi:', error);
      return null;
    }

    return data as RoomMessage;
  },

  /**
   * Realtime yeni mesaj dinleyici — ★ profil cache ile N+1 sorunu çözüldü.
   * ★ O11: onDelete callback — soft-delete (is_deleted=true UPDATE) olursa tetiklenir.
   */
  subscribe(
    roomId: string,
    onNewMessage: (msg: RoomMessage) => void,
    onDelete?: (messageId: string) => void,
  ) {
    if (isSystemRoom(roomId)) return () => {};
    const channel = supabase
      .channel(`room_chat:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const newMsg = payload.new as any;
          const cachedProfile = await _getCachedProfile(newMsg.sender_id);
          if (cachedProfile) {
            const msg: RoomMessage = {
              id: newMsg.id,
              room_id: newMsg.room_id,
              sender_id: newMsg.sender_id,
              content: newMsg.content,
              type: newMsg.type,
              created_at: newMsg.created_at,
              profiles: {
                display_name: cachedProfile.display_name,
                avatar_url: cachedProfile.avatar_url,
                active_chat_color: cachedProfile.active_chat_color,
                active_frame: cachedProfile.active_frame,
              },
            };
            onNewMessage(msg);
          } else {
            const { data } = await supabase
              .from('messages')
              .select('*, profiles!messages_sender_id_fkey(display_name, avatar_url, active_chat_color, active_frame)')
              .eq('id', newMsg.id)
              .single();
            if (data) onNewMessage(data as RoomMessage);
          }
        }
      )
      // ★ O11: soft-delete takibi (is_deleted UPDATE) ve hard DELETE
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const updated = payload.new as any;
          if (updated?.is_deleted && !(payload.old as any)?.is_deleted) {
            onDelete?.(updated.id);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const old = payload.old as any;
          if (old?.id) onDelete?.(old.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
