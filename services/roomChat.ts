/**
 * SopranoChat — Oda Ici Canli Mesajlasma Servisi
 * Supabase Realtime ile canli metin sohbeti
 */
import { supabase } from '../constants/supabase';
import { filterBadWords } from '../constants/badwords';

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
  };
};

export const RoomChatService = {
  /**
   * Odadaki mesajlari getir (son 50)
   */
  async getMessages(roomId: string, limit = 50): Promise<RoomMessage[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*, profiles!messages_sender_id_fkey(display_name, avatar_url)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) {
      console.warn('Room messages yuklenemedi:', error);
      return [];
    }
    return (data || []) as RoomMessage[];
  },

  /**
   * Mesaj gonder
   */
  async send(roomId: string, userId: string, content: string): Promise<RoomMessage | null> {
    const filteredContent = filterBadWords(content);
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
   * Realtime yeni mesaj dinleyici
   */
  subscribe(roomId: string, onNewMessage: (msg: RoomMessage) => void) {
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
          // Profil bilgisini de cekelim (yabancı anahtar çözümü ile)
          const { data } = await supabase
            .from('messages')
            .select('*, profiles!messages_sender_id_fkey(display_name, avatar_url)')
            .eq('id', payload.new.id)
            .single();
          if (data) onNewMessage(data as RoomMessage);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
