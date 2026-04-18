/**
 * SopranoChat — Push Bildirim Gönderim Servisi (Client-Side Helper)
 * Supabase Edge Function üzerinden push notification gönderir
 */
import { logger } from '../utils/logger';
import { supabase } from '../constants/supabase';

export type PushType = 'dm' | 'follow' | 'follow_request' | 'follow_accepted' | 'gift' | 'room_invite' | 'room_live' | 'room_follow' | 'event_reminder' | 'missed_call' | 'incoming_call';

// ★ SEC-PUSH: Per-user debounce — bildirim spam engeli
const _lastPushTime = new Map<string, number>();
setInterval(() => {
  const stale = Date.now() - 60_000;
  for (const [k, v] of _lastPushTime) {
    if (v < stale) _lastPushTime.delete(k);
  }
}, 10 * 60_000);

export const PushService = {
  /**
   * Tek bir kullanıcıya push bildirim gönder
   */
  async sendToUser(
    targetUserId: string,
    title: string,
    body: string,
    data?: { type: PushType; route: string; [key: string]: any }
  ): Promise<void> {
    try {
      // ★ SEC-PUSH: Per-user debounce (5sn) — incoming_call hariç (zaman kritik)
      const pushType = data?.type;
      if (pushType !== 'incoming_call') {
        const lastSent = _lastPushTime.get(targetUserId) || 0;
        if (Date.now() - lastSent < 5000) return; // 5sn debounce
      }
      _lastPushTime.set(targetUserId, Date.now());

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('push_token')
        .eq('id', targetUserId)
        .single();

      if (profileErr || !profile?.push_token) return;

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
          // ★ Arama bildirimi için yüksek öncelik — uygulama kapalıyken heads-up gösterir
          ...(data?.type === 'incoming_call' ? {
            priority: 'high',
            channelId: 'calls',
            _contentAvailable: true,
          } : {}),
        }),
      });

      if (!response.ok) {
        if (__DEV__) logger.warn('[Push] Gönderim hatası:', response.status);
      }
    } catch (err: any) {
      logger.error('[Push] Gönderilemedi:', err.message);
    }
  },

  /**
   * Bir odadaki tüm katılımcılara push gönder
   */
  async sendToRoom(
    roomId: string,
    title: string,
    body: string,
    data?: { type: PushType; route: string; [key: string]: any },
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

      await Promise.allSettled(
        targets.map(userId => this.sendToUser(userId, title, body, data))
      );
    } catch (err: any) {
      logger.error('[Push] Oda push hatası:', err.message);
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

  /** Cevapsız arama bildirimi gönder */
  async sendMissedCallNotification(
    targetUserId: string,
    callerName: string,
    callerId: string,
    callType?: string // backward compat
  ): Promise<void> {
    await this.sendToUser(
      targetUserId,
      '📞 Cevapsız Arama',
      `${callerName} seni aradı`,
      { type: 'missed_call', route: `/chat/${callerId}` }
    );
  },

  /** Oda takip bildirimi gönder — birisi odayı takip ettiğinde oda sahibine */
  async sendRoomFollowNotification(
    roomOwnerId: string,
    followerName: string,
    followerId: string,
    roomId: string,
    roomName: string
  ): Promise<void> {
    await this.sendToUser(
      roomOwnerId,
      '🏠 Yeni Oda Takipçisi',
      `${followerName} "${roomName}" odanızı takip etmeye başladı`,
      { type: 'room_follow', route: `/room/${roomId}` }
    );
  },
};
