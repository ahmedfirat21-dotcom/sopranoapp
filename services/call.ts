/**
 * SopranoChat — DM Arama Servisi
 * Supabase Broadcast ile sinyalizasyon, LiveKit ile gerçek ses/video iletimi
 * Tier bazlı kalite: Free=16kHz ses, Bronze=32kHz+480p, Silver=32kHz+720p, Gold=48kHz+1080p, VIP=48kHz stereo+1080p
 */
import { DeviceEventEmitter } from 'react-native';
import { supabase } from '../constants/supabase';
import { getRoomLimits, type TierName } from './database';
import { PushService } from './push';
import { FriendshipService } from './friendship';

let globalCallChannel: ReturnType<typeof supabase.channel> | null = null;
let globalCallUserId: string | null = null;

// ★ Sinyal dedup — retry nedeniyle aynı sinyalin iki kez işlenmesini önle
const _processedSignals = new Set<string>();
function isSignalDuplicate(signal: CallSignal): boolean {
  const key = `${signal.callId}_${signal.action}`;
  if (_processedSignals.has(key)) return true;
  _processedSignals.add(key);
  // 60sn sonra temizle (bellek sızıntısı önleme)
  setTimeout(() => _processedSignals.delete(key), 60000);
  return false;
}

// ─── TYPES ──────────────────────────────────────────────────
export type CallType = 'audio' | 'video';
export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';

export type CallSignal = {
  action: 'incoming_call' | 'call_accepted' | 'call_rejected' | 'call_ended' | 'call_busy';
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  callType: CallType;
  tier?: TierName;
};

export type CallQuality = {
  audioSampleRate: number;
  audioChannels: number;
  videoMaxRes: number;
  videoEnabled: boolean;
};

// ─── TIER BAZLI KALİTE ─────────────────────────────────────
export function getCallQuality(tier: TierName, callType: CallType): CallQuality {
  const limits = getRoomLimits(tier);
  return {
    audioSampleRate: limits.audioSampleRate,
    audioChannels: limits.audioChannels,
    videoMaxRes: limits.videoMaxRes,
    videoEnabled: callType === 'video',
  };
}

// ─── YARDIMCI: Belirli bir kullanıcıya sinyal gönder ────────
/**
 * Geçici kanal adı ile gönderim — globalCallChannel ile çakışma yok
 * - Her gönderim kendi geçici kanalını açar ve sonra kapatır
 * - Global dinleme kanalına dokunmaz
 * - 3 kez retry ile güvenilirliği artır
 */
async function sendSignalToUser(targetUserId: string, signal: CallSignal, maxRetries = 3): Promise<void> {
  // Hedefin dinlediği kanal adıyla AYNI olmalı — Supabase Broadcast bunu gerektirir
  const targetChannelName = `call_signal_${targetUserId}`;

  const sendChannel = supabase.channel(targetChannelName, {
    config: { broadcast: { self: false } },
  });

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (__DEV__) console.warn('[CallService] Sinyal gönderme timeout (8s)');
        resolve(); // Timeout durumunda da devam et
      }, 8000);

      sendChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          // ★ 200ms gecikme — karşı tarafın da subscribe olmasını bekle
          setTimeout(async () => {
            for (let i = 0; i < maxRetries; i++) {
              try {
                await sendChannel.send({
                  type: 'broadcast',
                  event: 'call_signal',
                  payload: signal,
                });
                if (__DEV__) console.log(`[CallService] Sinyal gönderildi → ${signal.action} (deneme ${i + 1}) (${signal.callId.slice(-8)})`);
                if (i < maxRetries - 1) {
                  await new Promise(r => setTimeout(r, 1000));
                }
              } catch (e) {
                if (__DEV__) console.warn(`[CallService] Sinyal gönderme hatası (deneme ${i + 1}):`, e);
              }
            }
            resolve();
          }, 200);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timeout);
          if (__DEV__) console.warn(`[CallService] Kanal hatası: ${status}`);
          resolve();
        }
      });
    });
  } finally {
    // Geçici kanalı HER ZAMAN temizle — sızıntı yok
    setTimeout(() => {
      try { supabase.removeChannel(sendChannel); } catch { /* silent */ }
    }, 2000);
  }
}

// ─── ARAMA SERVİSİ ─────────────────────────────────────────
export const CallService = {
  /** Benzersiz call ID oluştur (iki user ID'den) */
  generateCallId(userId1: string, userId2: string): string {
    const sorted = [userId1, userId2].sort();
    return `call_${sorted[0].slice(0, 8)}_${sorted[1].slice(0, 8)}_${Date.now()}`;
  },

  /** Benzersiz LiveKit room ID oluştur */
  generateRoomId(callId: string): string {
    return `dm_${callId}`;
  },

  /** Arama başlat — karşı tarafa sinyal gönder */
  async initiateCall(
    callerId: string,
    callerName: string,
    callerAvatar: string | undefined,
    receiverId: string,
    callType: CallType,
    tier: TierName = 'Free'
  ): Promise<{ callId: string; receiverIsOnline: boolean }> {
    // Tüm tier'lar görüntülü arama yapabilir (kalite tier'a göre değişir)

    // ★ CALL-1 FIX: Sadece karşılıklı takipçiler arayabilir
    const friendshipStatus = await FriendshipService.getStatus(callerId, receiverId);
    if (friendshipStatus !== 'accepted') {
      // Ters yönü de kontrol et (B→A accepted olabilir)
      const reverseStatus = await FriendshipService.getStatus(receiverId, callerId);
      if (reverseStatus !== 'accepted') {
        throw new Error('Sadece arkadaşlarınızı arayabilirsiniz. Önce takip isteği gönderin.');
      }
    }

    const callId = this.generateCallId(callerId, receiverId);

    // ★ Karşı tarafın online durumunu ÖNCE kontrol et
    const receiverIsOnline = await CallService.checkReceiverOnline(receiverId);

    const signal: CallSignal = {
      action: 'incoming_call',
      callId,
      callerId,
      callerName,
      callerAvatar,
      callType,
      tier,
    };

    // ★ WhatsApp tarzı: HER DURUMDA broadcast sinyal gönder
    // Offline kullanıcı push ile uygulamayı açarsa sinyali yakalayabilir
    await sendSignalToUser(receiverId, signal, 2);

    // ★ Her durumda push notification gönder — arka planda/kapalıyken arama almak için KRİTİK
    const callTypeLabel = callType === 'video' ? '📹 Görüntülü Arama' : '📞 Sesli Arama';
    PushService.sendToUser(receiverId, callTypeLabel, `${callerName} seni arıyor`, {
      type: 'incoming_call',
      callId,
      callerId,
      callerName,
      callerAvatar: callerAvatar || '',
      callType,
      tier: tier || 'Free',
      route: `/call/${callerId}?callId=${callId}&callType=${callType}&isIncoming=true&receiverOnline=true`,
    }).catch(() => {});

    return { callId, receiverIsOnline };
  },

  /** Karşı tarafın online durumunu kontrol et */
  async checkReceiverOnline(userId: string): Promise<boolean> {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('is_online, last_seen')
        .eq('id', userId)
        .single();
      if (!data) return false;

      // ★ FIX: is_online=true ise DOĞRUDAN online kabul et
      // last_seen kontrolü sadece is_online=false durumunda (son 2dk aktifse online say)
      if (data.is_online) {
        if (__DEV__) console.log(`[CallService] Receiver online: is_online=true ✓`);
        return true;
      }

      // is_online=false ama son 2dk içinde aktifse yine online say
      const TWO_MIN = 2 * 60 * 1000;
      const lastSeen = data.last_seen ? new Date(data.last_seen).getTime() : 0;
      const recentlyActive = lastSeen > 0 && (Date.now() - lastSeen < TWO_MIN);
      if (__DEV__) console.log(`[CallService] Receiver online check: is_online=false, last_seen_ago=${Math.round((Date.now() - lastSeen)/1000)}s, recentlyActive=${recentlyActive}`);
      return recentlyActive;
    } catch {
      return false;
    }
  },

  /** Cevapsız arama kaydı oluştur (notifications + push) */
  async saveMissedCall(
    callerId: string,
    callerName: string,
    callerAvatar: string | undefined,
    receiverId: string,
    callType: CallType
  ): Promise<void> {
    try {
      // 1. Notifications tablosuna kaydet
      await supabase.from('notifications').insert({
        user_id: receiverId,
        sender_id: callerId,
        type: 'missed_call',
        body: callType === 'video' ? '📹 Cevapsız görüntülü arama' : '📞 Cevapsız sesli arama',
      });

      // 2. Push bildirim gönder
      await PushService.sendMissedCallNotification(
        receiverId,
        callerName,
        callerId,
        callType
      );

      if (__DEV__) console.log(`[CallService] Cevapsız arama kaydı oluşturuldu: ${callerId} → ${receiverId}`);
    } catch (e) {
      if (__DEV__) console.warn('[CallService] Cevapsız arama kaydetme hatası:', e);
    }
  },

  /** Aramayı kabul et */
  async acceptCall(callerId: string, receiverId: string, callId: string) {
    await sendSignalToUser(callerId, {
      action: 'call_accepted',
      callId,
      callerId: receiverId,
      callerName: '',
      callType: 'audio',
    });
  },

  /** Aramayı reddet */
  async rejectCall(callerId: string, receiverId: string, callId: string) {
    await sendSignalToUser(callerId, {
      action: 'call_rejected',
      callId,
      callerId: receiverId,
      callerName: '',
      callType: 'audio',
    });
  },

  /** Aramayı bitir — 1x retry yeterli (hızlı gönder) */
  async endCall(callerId: string, otherUserId: string, callId: string) {
    await sendSignalToUser(otherUserId, {
      action: 'call_ended',
      callId,
      callerId,
      callerName: '',
      callType: 'audio',
    }, 1);
  },

  /** ★ Meşgul sinyali gönder — 1x retry yeterli */
  async sendBusy(callerId: string, receiverId: string, callId: string) {
    await sendSignalToUser(callerId, {
      action: 'call_busy',
      callId,
      callerId: receiverId,
      callerName: '',
      callType: 'audio',
    }, 1);
  },

  /** Gelen arama sinyallerini dinle — stabil kanal + dedup + reconnect */
  onCallSignal(userId: string, callback: (signal: CallSignal) => void) {
    const setupChannel = () => {
      // Eski kanalı temizle — removeChannel ile tamamen yok et
      if (globalCallChannel) {
        try { supabase.removeChannel(globalCallChannel); } catch { /* silent */ }
        globalCallChannel = null;
      }
      globalCallUserId = userId;
      globalCallChannel = supabase.channel(`call_signal_${userId}`);

      globalCallChannel
        .on('broadcast', { event: 'call_signal' }, (payload) => {
          const signal = payload.payload as CallSignal;
          if (__DEV__) console.log(`[CallService] ◀ Sinyal ALINDI: ${signal.action} (${signal.callId.slice(-8)})`);
          // ★ Dedup: Retry nedeniyle gelen tekrarlı sinyali filtrele
          if (!isSignalDuplicate(signal)) {
            DeviceEventEmitter.emit('onCallSignal', signal);
          }
        })
        .subscribe((status) => {
          if (__DEV__) console.log(`[CallService] Call signal kanal durumu: ${status} (user: ${userId.slice(0, 8)})`);
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            if (__DEV__) console.warn(`[CallService] Kanal hatası (${status}) — 3sn sonra yeniden bağlanıyor...`);
            setTimeout(() => {
              if (globalCallUserId === userId) {
                setupChannel();
              }
            }, 3000);
          }
        });
    };

    if (!globalCallChannel || globalCallUserId !== userId) {
      setupChannel();
    }

    const subscription = DeviceEventEmitter.addListener('onCallSignal', (signal: CallSignal) => {
      callback(signal);
    });

    return {
      unsubscribe: () => {
        subscription.remove();
      },
      /** ★ Dışarıdan yeniden bağlanma tetiklemesi (AppState.active) */
      reconnect: () => {
        if (__DEV__) console.log('[CallService] Manuel reconnect tetiklendi');
        setupChannel();
      },
    };
  },
};
