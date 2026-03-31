import { supabase } from '../constants/supabase';
import { PushService } from './push';

export interface Gift {
  id: string;
  name: string;
  price: number;
  animation_url: string;
  is_premium: boolean;
}

export interface LiveGiftEvent {
  id: string;
  room_id: string;
  sender_id: string;
  receiver_id: string;
  gift_id: string;
  amount: number;
  created_at: string;
}

export const GiftService = {
  /**
   * Tüm hediye kataloğunu getirir
   */
  async getCatalog(): Promise<{ gifts: Gift[]; error?: string }> {
    try {
      const { data: gifts, error } = await supabase
        .from('gifts_catalog')
        .select('*')
        .order('price', { ascending: true });

      if (error) throw error;
      return { gifts: gifts as Gift[] };
    } catch (e: any) {
      console.error("Error fetching gift catalog:", e);
      return { gifts: [], error: e.message };
    }
  },

  /**
   * Odadayken birisine canlı hediye at
   */
  async sendGift(roomId: string | null, senderId: string, receiverId: string, giftId: string): Promise<{ success: boolean; remainingCoins?: number; error?: string }> {
    try {
      // Dummy data workaround: room ID must be UUID. If it's a short string like "1", pass null to avoid RPC type error.
      const isUUID = roomId ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomId) : false;
      const safeRoomId = isUUID ? roomId : null;

      const { data, error } = await supabase.rpc('send_live_gift', {
        p_room_id: safeRoomId,
        p_sender_id: senderId,
        p_receiver_id: receiverId,
        p_gift_id: giftId
      });

      if (error) throw error;
      
      if (data.success && safeRoomId) {
        // Hediyeyi atan kişinin sistem mesajını logla
        await supabase.rpc('record_gift_system_message', {
          p_room_id: safeRoomId,
          p_sender_id: senderId,
          p_gift_name: giftId
        });
      }

      return { success: data.success, remainingCoins: data.sender_remaining_coins };
    } catch (e: any) {
      console.error("Error sending gift:", e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Push bildirim gönder (hediye sonrası)
   */
  async notifyGiftReceived(senderId: string, receiverId: string, giftId: string, roomId: string | null) {
    const { data: sender } = await supabase.from('profiles').select('display_name').eq('id', senderId).single();
    const senderName = sender?.display_name || 'Birisi';
    const route = roomId ? `/room/${roomId}` : `/user/${senderId}`;
    PushService.sendToUser(receiverId, 'Hediye Aldın! 🎁', `${senderName} sana ${giftId} gönderdi`, {
      type: 'gift',
      route,
    }).catch(() => {});
  },

  /**
   * Odaya atılan canlı hediyeleri dinler (Ekrana Lottie animasyonu fırlatmak için)
   * UI tarafında bu listener'dan gelen yepyeni `gift_id` ile Lottie oynatılır.
   */
  subscribeToRoomGifts(roomId: string, onGiftReceived: (gift: LiveGiftEvent) => void) {
    const subscription = supabase
      .channel(`room_gifts:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_live_gifts', filter: `room_id=eq.${roomId}` },
        (payload: any) => {
          onGiftReceived(payload.new as LiveGiftEvent);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }
};
