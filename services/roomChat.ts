/**
 * SopranoChat — Oda Ici Canli Mesajlasma Servisi
 * Supabase Realtime ile canli metin sohbeti
 */
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
      if (__DEV__) console.warn('Room messages yuklenemedi:', error);
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
   * Mesaj gonder
   */
  async send(roomId: string, userId: string, content: string): Promise<RoomMessage | null> {
    // Sistem odalarında DB'ye yazma (UUID değil)
    if (isSystemRoom(roomId)) return null;
    // ★ SEC-8c: Input sanitization — max 500 char, HTML strip, boş mesaj engelleme
    const sanitized = (content || '').trim().replace(/<[^>]*>/g, '').slice(0, 500);
    if (sanitized.length < 1) return null;
    const filteredContent = filterBadWords(sanitized);
    const { data, error } = await supabase
      .from('messages')
      .insert({ room_id: roomId, sender_id: userId, content: filteredContent })
      .select('*, profiles!messages_sender_id_fkey(display_name, avatar_url)')
      .single();
    if (error) {
      console.error('Room mesaji gonderilemedi:', error);
      return null;
    }

    return data as RoomMessage;
  },

  /**
   * Realtime yeni mesaj dinleyici — ★ profil cache ile N+1 sorunu çözüldü
   */
  subscribe(roomId: string, onNewMessage: (msg: RoomMessage) => void) {
    // Sistem odalarında DB dinleme yapma
    if (isSystemRoom(roomId)) return () => {};
    const channel = supabase
      .channel(`room_chat:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const newMsg = payload.new as any;
          // ★ Önce cache'e bak — DB sorgusu yapmadan profil al
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
            // Fallback: cache miss — tek sorgu yap
            const { data } = await supabase
              .from('messages')
              .select('*, profiles!messages_sender_id_fkey(display_name, avatar_url, active_chat_color, active_frame)')
              .eq('id', newMsg.id)
              .single();
            if (data) onNewMessage(data as RoomMessage);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
