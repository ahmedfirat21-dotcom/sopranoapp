/**
 * SopranoChat — Push Bildirim Gönderim Servisi (Client-Side Helper)
 * Supabase Edge Function üzerinden push notification gönderir
 */
import { supabase } from '../constants/supabase';

export type PushType = 'dm' | 'follow' | 'follow_request' | 'follow_accepted' | 'gift' | 'room_invite' | 'event_reminder';

export const PushService = {
  /**
   * Tek bir kullanıcıya push bildirim gönder
   */
  async sendToUser(
    targetUserId: string,
    title: string,
    body: string,
    data?: { type: PushType; route: string }
  ): Promise<void> {
    try {
      // 1. Hedef kullanıcının push token'ını al
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('push_token')
        .eq('id', targetUserId)
        .single();

      if (profileErr || !profile?.push_token) {
        // Token yoksa sessizce çık (kullanıcı bildirimlere izin vermemiş olabilir)
        return;
      }

      // 2. Expo Push API'ye doğrudan istek at
      // (Edge Function deploy edildiğinde oraya yönlendirilebilir)
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: profile.push_token,
          title,
          body,
          sound: 'default',
          data: data || {},
        }),
      });

      if (!response.ok) {
        console.warn('[Push] Gönderim hatası:', response.status);
      }
    } catch (err: any) {
      console.error('[Push] Gönderilemedi:', err.message);
    }
  },

  /**
   * Bir odadaki tüm katılımcılara push gönder (bir kişiyi hariç tutarak)
   */
  async sendToRoom(
    roomId: string,
    title: string,
    body: string,
    data?: { type: PushType; route: string },
    excludeUserId?: string
  ): Promise<void> {
    try {
      const { data: participants, error } = await supabase
        .from('room_participants')
        .select('user_id')
        .eq('room_id', roomId);

      if (error || !participants) return;

      const targets = participants
        .map(p => p.user_id)
        .filter(id => id !== excludeUserId);

      // Her katılımcıya ayrı gönder (batch optimize edilebilir)
      await Promise.allSettled(
        targets.map(userId => this.sendToUser(userId, title, body, data))
      );
    } catch (err: any) {
      console.error('[Push] Oda push hatası:', err.message);
    }
  },

  /** Oda daveti gönder */
  async sendRoomInvite(targetUserId: string, hostName: string, roomName: string, roomId: string): Promise<void> {
    await this.sendToUser(
      targetUserId,
      '🎙️ Oda Daveti',
      `${hostName} seni "${roomName}" odasına davet etti!`,
      { type: 'room_invite', route: `/room/${roomId}` }
    );
  },

  /** Takip bildirimi gönder */
  async sendFollowNotification(targetUserId: string, followerName: string, followerId: string): Promise<void> {
    await this.sendToUser(
      targetUserId,
      '👤 Yeni Takipçi',
      `${followerName} seni takip etmeye başladı`,
      { type: 'follow', route: `/user/${followerId}` }
    );
  },

  /** Hediye bildirimi gönder */
  async sendGiftNotification(targetUserId: string, senderName: string, giftName: string): Promise<void> {
    await this.sendToUser(
      targetUserId,
      '🎁 Hediye Aldın!',
      `${senderName} sana ${giftName} gönderdi`,
      { type: 'gift', route: '/wallet' }
    );
  },

  /** Etkinlik hatırlatıcısı — tüm katılımcılara */
  async sendEventReminder(eventId: string, eventTitle: string): Promise<void> {
    try {
      const { data: attendees, error } = await supabase
        .from('event_attendees')
        .select('user_id')
        .eq('event_id', eventId);

      if (error || !attendees) return;

      await Promise.allSettled(
        attendees.map(a => this.sendToUser(
          a.user_id,
          '📅 Etkinlik Hatırlatması',
          `"${eventTitle}" birazdan başlıyor!`,
          { type: 'event_reminder', route: `/event/${eventId}` }
        ))
      );
    } catch (err: any) {
      console.error('[Push] Event reminder hatası:', err.message);
    }
  },

  /** DM bildirimi gönder */
  async sendDMNotification(targetUserId: string, senderName: string, preview: string, senderId: string): Promise<void> {
    const msg = preview.length > 50 ? preview.slice(0, 50) + '...' : preview;
    await this.sendToUser(
      targetUserId,
      `💬 ${senderName}`,
      msg,
      { type: 'dm', route: `/chat/${senderId}` }
    );
  },
};
