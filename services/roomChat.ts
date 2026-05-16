/**
 * SopranoChat — Oda Ici Canli Mesajlasma Servisi
 * Supabase Realtime ile canli metin sohbeti
 */
import { logger } from '../utils/logger';
import { supabase } from '../constants/supabase';
import { filterBadWords } from '../constants/badwords';
import { isSystemRoom } from './showcaseRooms';
import { i18n } from './i18n';

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
    active_badge_id?: string | null;
    subscription_tier?: string | null;
  };
  // Client-side flags
  isSystem?: boolean;
  isJoin?: boolean;
};

// ★ BÖLÜM 6 FIX: Profil cache — N+1 sorunu çözümü
// Her mesajda ayrı profil sorgusu yapmak yerine cache'ten oku
// ★ v110.14: subscription_tier de cache'lenir (render'da renk hesabı için)
type CachedProfile = {
  display_name: string;
  avatar_url: string;
  active_chat_color?: string | null;
  active_frame?: string | null;
  active_badge_id?: string | null;
  subscription_tier?: string | null;
  cachedAt: number;
};
const _profileCache = new Map<string, CachedProfile>();
const CACHE_TTL = 5 * 60 * 1000; // 5 dakika

/**
 * ★ v110.14: Senkron cache lookup — RoomChatDrawer render'da kullanır.
 * Eski mesajların profile join'i eksik olsa bile güncel renk/çerçeve gösterir.
 */
export function getRoomProfileFromCache(userId: string | null | undefined): CachedProfile | null {
  if (!userId) return null;
  return _profileCache.get(userId) || null;
}

async function _getCachedProfile(userId: string): Promise<CachedProfile | null> {
  const cached = _profileCache.get(userId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return cached;
  }
  try {
    const { data } = await supabase
      .from('profiles')
      .select('display_name, avatar_url, active_chat_color, active_frame, active_badge_id, subscription_tier')
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
   * ★ 2026-04-26: Descending — limit ile son 50 yeni mesaj döner. Component'te [newest, ..., oldest] sıralı.
   * ★ v87 (1 May 2026): sinceIso geçilirse sadece o tarihten sonraki mesajlar döner (Spaces/anlık modeli).
   *   Oda canlı bile olsa, yeni katılan kullanıcı eski backlog'u görmez; sadece kendi katılımından
   *   sonra konuşulanları görür. Eski mesajlar DB'de oda kapanana kadar yaşar (kapanınca trigger siler).
   */
  async getMessages(roomId: string, limit = 50, sinceIso?: string): Promise<RoomMessage[]> {
    // Sistem odalarında DB sorgusu yapma (UUID değil)
    if (isSystemRoom(roomId)) return [];
    let query = supabase
      .from('messages')
      .select('*, profiles!messages_sender_id_fkey(display_name, avatar_url, active_chat_color, active_frame, active_badge_id, subscription_tier)')
      .eq('room_id', roomId);
    if (sinceIso) query = query.gte('created_at', sinceIso);
    const { data, error } = await query
      .order('created_at', { ascending: false })
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
   * ★ 2026-05-10 v111b: Plus/Pro host odanın tüm user mesajlarını siler.
   * Backend (clear_room_messages RPC) tier + host kontrollü; Free reddedilir.
   * System mesajları korunur. DELETE event'i postgres_changes ile odadaki
   * tüm kullanıcılara realtime gider — herkesin chat paneli temizlenir.
   * @returns silinen mesaj sayısı
   */
  async clearAllMessages(roomId: string, userId: string): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
    if (isSystemRoom(roomId)) return { success: false, error: i18n.t('auto.roomChat.007') };
    try {
      const { data, error } = await supabase.rpc('clear_room_messages', {
        p_room_id: roomId,
        p_user_id: userId,
      });
      if (error) {
        if (__DEV__) logger.warn('clearAllMessages RPC error:', error);
        return { success: false, error: error.message || i18n.t('auto.roomChat.006') };
      }
      return { success: true, deletedCount: typeof data === 'number' ? data : 0 };
    } catch (e: any) {
      if (__DEV__) logger.warn('clearAllMessages exception:', e);
      return { success: false, error: e?.message || i18n.t('auto.roomChat.005') };
    }
  },

  /**
   * ★ 2026-05-10 v111: Frozen persistent oda için arşivlenmiş mesaj geçmişi.
   * getMessages'tan tek farkı: sinceIso filtresi YOK → tüm geçmişi getirir.
   * Plus/Pro üyeler kapanan odasına geri döndüğünde wakeUp öncesi chat panelinde
   * önceki konuşma görünsün diye kullanılır. Trigger metadata.archived_at damgası
   * bastığı için DB'de mesajlar duruyor olur (Free için bu fonksiyon boş döner).
   */
  async getMessagesForFrozenRoom(roomId: string, limit = 50): Promise<RoomMessage[]> {
    if (isSystemRoom(roomId)) return [];
    const { data, error } = await supabase
      .from('messages')
      .select('*, profiles!messages_sender_id_fkey(display_name, avatar_url, active_chat_color, active_frame, active_badge_id, subscription_tier)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      if (__DEV__) logger.warn('Frozen room messages yuklenemedi:', error);
      return [];
    }
    // Profile cache'i doldur (mevcut pattern)
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
    let sanitized = (content || '').trim().replace(/<[^>]*>/g, '').slice(0, 500);
    if (sanitized.length < 1) return null;
    // ★ 2026-04-25: Profanity filter — küfür/uygunsuz kelimeleri sansürle (mask).
    //   Hard block yerine soft mask: gönderim çalışır ama kelime "s*****r" olur.
    try {
      const { filterBadWords } = require('../constants/badwords');
      sanitized = filterBadWords(sanitized);
    } catch { /* badwords yoksa sessiz */ }

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

    // ★ v92.11 (1 May 2026): Mesaj Parlat power-up — counter > 0 ise metadata.glow=true
    //   ekle + atomic decrement (consume_message_glow RPC).
    let glowApplied = false;
    try {
      const { data: consumed } = await supabase.rpc('consume_message_glow', { p_user_id: userId });
      if (consumed === true) glowApplied = true;
    } catch { /* sessiz — glow yoksa normal mesaj */ }

    const insertData: any = {
      room_id: roomId,
      sender_id: userId,
      content: filteredContent,
    };
    if (glowApplied) insertData.metadata = { glow: true };

    const { data, error } = await supabase
      .from('messages')
      .insert(insertData)
      .select('*, profiles!messages_sender_id_fkey(display_name, avatar_url, active_chat_color, active_frame, active_badge_id, subscription_tier)')
      .single();
    if (error) {
      logger.error('Room mesaji gonderilemedi:', error);
      return null;
    }

    return data as RoomMessage;
  },

  /**
   * ★ v107 (3 May 2026): Mesaj Parlat — 6 stilden biriyle mesaj gönder.
   * Atomic RPC: SP yeterlilik + düş + insert metadata.glow_style + log → tek transaction.
   * Başarılıysa { success, cost, new_balance, message_id } döner.
   * Hata durumunda { success: false, error } — UI toast gösterir.
   */
  async sendGlow(
    roomId: string,
    userId: string,
    content: string,
    // ★ v298 (17 May 2026) FIX: GlowStyleId tipi 11 stilden oluşuyor (6 sabit + 5 premium).
    //   Eski imza sadece 6 sabit'i kabul ediyordu, premium glow'lar (constellation/
    //   or-ancien/inferno/voltaire/belle-epoque) silent type-mismatch ile gönderiliyordu.
    //   Tip union genişletildi → tüm 11 stil destekleniyor.
    glowStyle: 'gold' | 'heart' | 'fire' | 'neon' | 'celebration' | 'galaxy'
      | 'constellation' | 'or-ancien' | 'inferno' | 'voltaire' | 'belle-epoque',
  ): Promise<{ success: boolean; error?: string; cost?: number; newBalance?: number; messageId?: string }> {
    if (isSystemRoom(roomId)) return { success: false, error: i18n.t('auto.roomChat.004') };
    const cleaned = (content || '').trim().replace(/<[^>]*>/g, '').slice(0, 500);
    if (cleaned.length < 1) return { success: false, error: i18n.t('auto.roomChat.003') };

    // Client-side rate limit + emoji cooldown — server'a gereksiz RPC atılmasın
    _ensureCleanupInterval();
    const rateLimitKey = `${roomId}:${userId}`;
    const now = Date.now();
    let entry = _rateLimitMap.get(rateLimitKey);
    if (!entry) { entry = { timestamps: [], lastEmoji: 0 }; _rateLimitMap.set(rateLimitKey, entry); }
    entry.timestamps = entry.timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
    if (entry.timestamps.length >= RATE_LIMIT_MAX) {
      return { success: false, error: i18n.t('auto.roomChat.002') };
    }
    entry.timestamps.push(now);

    // Profanity filter — server'a temizlenmiş içerik git
    let filtered = cleaned;
    try { filtered = filterBadWords(cleaned); } catch { /* badwords yoksa sessiz */ }

    try {
      const { data, error } = await supabase.rpc('powerup_send_glow_message', {
        p_room_id: roomId,
        p_user_id: userId,
        p_content: filtered,
        p_glow_style: glowStyle,
      });
      if (error) {
        if (__DEV__) logger.warn('[RoomChat] sendGlow RPC hata:', error.message);
        return { success: false, error: error.message };
      }
      const r = data as any;
      if (!r?.success) {
        return { success: false, error: r?.error || 'Bilinmeyen hata' };
      }
      return {
        success: true,
        cost: r.cost,
        newBalance: r.new_balance,
        messageId: r.message_id,
      };
    } catch (e: any) {
      if (__DEV__) logger.warn('[RoomChat] sendGlow exception:', e?.message);
      return { success: false, error: e?.message || i18n.t('auto.roomChat.001') };
    }
  },

  /**
   * ★ v92.10 (1 May 2026): Sistem mesajı — bağış bildirimleri gibi otomatik
   * tetiklenen "X, Y'ye Z SP gönderdi" türü mesajlar için. Sender_id null,
   * type='system'. Chat drawer altın çerçeveyle render eder.
   */
  async sendSystem(roomId: string, content: string, externalRef?: string): Promise<RoomMessage | null> {
    if (isSystemRoom(roomId)) return null;
    const sanitized = (content || '').trim().slice(0, 500);
    if (sanitized.length < 1) return null;
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          room_id: roomId,
          sender_id: null as any,
          content: sanitized,
          type: 'system',
        })
        .select('*')
        .single();
      if (error) {
        if (__DEV__) logger.warn('System message insert failed:', error);
        return null;
      }
      return data as RoomMessage;
    } catch (e) {
      if (__DEV__) logger.warn('sendSystem exception:', e);
      return null;
    }
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
            // ★ v92.13 (1 May 2026): metadata + reactions + tüm yeni kolonlar spread ile
            //   alınıyor. Önceden explicit field listesi vardı → metadata droplanıyordu →
            //   "Mesaj Parlat" power-up render edilmiyordu (DB'de glow:true ama UI'da yok).
            const msg: RoomMessage = {
              ...(newMsg as RoomMessage),
              profiles: {
                display_name: cachedProfile.display_name,
                avatar_url: cachedProfile.avatar_url,
                active_chat_color: cachedProfile.active_chat_color,
                active_frame: cachedProfile.active_frame,
                subscription_tier: (cachedProfile as any).subscription_tier,
              },
            };
            onNewMessage(msg);
          } else {
            const { data } = await supabase
              .from('messages')
              .select('*, profiles!messages_sender_id_fkey(display_name, avatar_url, active_chat_color, active_frame, active_badge_id, subscription_tier)')
              .eq('id', newMsg.id)
              .single();
            if (data) {
              // ★ v110.14 (8 May 2026): RLS profiles join'i NULL döndüyse anlık "Kullanıcı"
              //   flash önle — profil bilgisini cache'e yaz ki UI hep doğru render etsin.
              const dataProfiles = (data as any).profiles;
              if (dataProfiles?.display_name) {
                _profileCache.set(newMsg.sender_id, { ...dataProfiles, cachedAt: Date.now() });
              }
              onNewMessage(data as RoomMessage);
            }
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

  /**
   * ★ v56: Mesaj reaksiyonu toggle (❤️ varsayılan). Return: { liked, count }.
   * RPC: public.toggle_message_reaction — sql/v56_message_reactions.sql
   */
  async toggleReaction(messageId: string, userId: string, emoji = '❤️'): Promise<{ liked: boolean; count: number } | null> {
    try {
      const { data, error } = await supabase.rpc('toggle_message_reaction', {
        p_message_id: messageId,
        p_user_id: userId,
        p_emoji: emoji,
      });
      if (error) {
        if (__DEV__) logger.warn('[roomChat] toggleReaction failed:', error.message);
        return null;
      }
      const d = data as any;
      return { liked: !!d?.liked, count: Number(d?.count || 0) };
    } catch (e: any) {
      if (__DEV__) logger.warn('[roomChat] toggleReaction exception:', e?.message);
      return null;
    }
  },

  /**
   * ★ v56: Oda açılınca son mesajlar için reaksiyon özetini çek.
   * Dönüş: { [messageId]: { count, liked } } — UI tek tur render'da hazır.
   */
  async getReactions(messageIds: string[], userId: string): Promise<Record<string, Record<string, { count: number; liked: boolean }>>> {
    if (!messageIds.length) return {};
    try {
      const { data, error } = await supabase.rpc('get_message_reactions', { p_message_ids: messageIds });
      if (error || !Array.isArray(data)) return {};
      // ★ v110.14: WhatsApp tarzı çoklu emoji — her (message_id, emoji) ayrı chip.
      //   Önceden son emoji satırı overwrite ediyordu; şimdi emoji-bazlı object.
      const out: Record<string, Record<string, { count: number; liked: boolean }>> = {};
      for (const row of data as any[]) {
        const likedBy: string[] = Array.isArray(row.liked_by_users) ? row.liked_by_users : [];
        const mid = row.message_id;
        const emoji = row.emoji || '❤️';
        if (!out[mid]) out[mid] = {};
        out[mid][emoji] = {
          count: Number(row.count || 0),
          liked: likedBy.includes(userId),
        };
      }
      return out;
    } catch {
      return {};
    }
  },

  /**
   * ★ v56: Reaksiyon realtime — başka kullanıcı beğendiğinde UI anında güncellensin.
   * Tek aboneden INSERT/DELETE yayın — callback ile messageId dönüyor.
   */
  subscribeReactions(
    roomId: string,
    onChange: (messageId: string) => void,
  ) {
    if (isSystemRoom(roomId)) return () => {};
    const channel = supabase
      .channel(`room_chat_reactions:${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions' }, (p) => {
        const id = (p.new as any)?.message_id;
        if (id) onChange(id);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions' }, (p) => {
        const id = (p.old as any)?.message_id;
        if (id) onChange(id);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  },
};
