/**
 * SopranoChat — Push SEND (outbound)
 * ═══════════════════════════════════════════════════
 * Bu servis: BAŞKA kullanıcılara push gönderir (Supabase Edge Function
 * `send-push` üzerinden). Diğer kullanıcının device token'ını bulur ve
 * Expo Push API'a forward eder.
 *
 * ★ pushNotifications.ts ile KARIŞTIRMA:
 *   - services/push.ts (bu)          → OUTBOUND: başkalarına push gönder
 *   - services/pushNotifications.ts  → INBOUND: kendi cihazın için token
 *                                       register + local notification handler
 */
import { logger } from '../utils/logger';
import { supabase } from '../constants/supabase';
import { NotifPrefsService, type NotificationCategory } from './notifPrefs';

export type PushType = 'dm' | 'message_request' | 'follow' | 'follow_request' | 'follow_accepted' | 'gift' | 'room_invite' | 'room_live' | 'room_follow' | 'event_reminder' | 'missed_call' | 'incoming_call';

// ★ Faz 5.1 — PushType → NotifPrefs kategori eşlemesi (gate kontrolü için)
function _pushTypeToCategory(t?: PushType): NotificationCategory | null {
  if (!t) return null;
  switch (t) {
    case 'dm':                return 'dm';
    case 'message_request':   return 'message_request';
    case 'follow':            return 'follow';
    case 'follow_request':    return 'follow';
    case 'follow_accepted':   return 'follow_accepted';
    case 'gift':              return 'sp_received';
    case 'room_invite':       return 'room_invite';
    case 'room_live':         return 'friend_online'; // arkadaş canlıya çıktı
    case 'room_follow':       return 'room_invite';
    case 'event_reminder':    return 'room_invite';
    case 'incoming_call':     return 'incoming_call';
    case 'missed_call':       return 'incoming_call';
    default:                  return null;
  }
}

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
      // ★ v92.29 (2 May 2026): Debounce 5sn → 1.5sn. Önceki 5sn'lik pencere
      //   peş peşe DM/davet/friend req durumlarında ikinci push'u sessizce
      //   düşürüyordu — kullanıcı şikâyeti: "push hiç gelmiyor". incoming_call
      //   hala bypass.
      const pushType = data?.type;
      if (pushType !== 'incoming_call') {
        const lastSent = _lastPushTime.get(targetUserId) || 0;
        if (Date.now() - lastSent < 1500) return;
      }
      _lastPushTime.set(targetUserId, Date.now());

      // ★ Faz 5.1 — Kullanıcı tercihleri gate (DND + kategori toggle + friends_only)
      //   Fail-open: prefs okuma başarısızsa push yine gönderilir (NotifPrefsService).
      const cat = _pushTypeToCategory(pushType);
      if (cat) {
        const senderId = (data as any)?.senderId || (data as any)?.fromUserId;
        const allowed = await NotifPrefsService.shouldSendPush(targetUserId, cat, senderId);
        if (!allowed) return; // Sessizce dropla
      }

      // ★ v78: push_tokens tablosu — multi-device push desteği.
      //   send-push edge function service_role ile push_tokens tablosundan
      //   TÜM aktif cihaz token'larını alır + Expo'ya batch forward eder.
      const isCall = data?.type === 'incoming_call';
      // ★ v92.29: invoke response'unu data ile yakala — Expo'dan gelen receipt'leri
      //   logla. Önceden sadece supabase invokeErr bakılıyordu, ama Expo'nun
      //   "DeviceNotRegistered / InvalidCredentials" gibi hataları response.data
      //   içinde gizliydi — debug imkânı yoktu.
      const { data: invokeData, error: invokeErr } = await supabase.functions.invoke('send-push', {
        body: {
          target_user_id: targetUserId,
          title,
          body,
          data: data || {},
          is_call: isCall,
        },
      });

      if (invokeErr) {
        if (__DEV__) logger.warn('[Push] Edge function hata:', invokeErr.message);
        return;
      }
      // Receipt analizi — herhangi bir cihazda fail varsa logla (DEV)
      if (__DEV__ && invokeData?.result?.data && Array.isArray(invokeData.result.data)) {
        const failures = invokeData.result.data.filter((t: any) => t?.status === 'error');
        if (failures.length > 0) {
          logger.warn(`[Push] ${failures.length}/${invokeData.devices} fail`,
            failures.map((f: any) => f.details?.error || f.message).join(', '));
        }
      }
    } catch (err: any) {
      if (__DEV__) logger.error('[Push] Gönderilemedi:', err.message);
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

  /** Arkadaşlık bildirimi gönder — legacy follow fonksiyon ismi korundu. */
  async sendFollowNotification(targetUserId: string, followerName: string, followerId: string): Promise<void> {
    await this.sendToUser(
      targetUserId,
      '👥 Yeni Arkadaş',
      `${followerName} seninle arkadaş oldu`,
      { type: 'follow', route: `/user/${followerId}` }
    );
  },

  /** Hediye bildirimi gönder */
  async sendGiftNotification(targetUserId: string, senderName: string, giftName: string): Promise<void> {
    await this.sendToUser(
      targetUserId,
      '🎁 Hediye Aldın!',
      `${senderName} sana ${giftName} gönderdi`,
      { type: 'gift', route: '/(tabs)/profile?openSP=1' }
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
