/**
 * SopranoChat — DM Arama Servisi (Yalnız Sesli)
 * Supabase Broadcast ile sinyalizasyon, LiveKit ile gerçek ses iletimi
 * Tier bazlı kalite: Free=16kHz mono, Plus=32kHz mono, Pro=48kHz stereo
 */
import { DeviceEventEmitter } from 'react-native';
import { supabase } from '../constants/supabase';
import { getRoomLimits, type TierName } from './database';
import { PushService } from './push';
import { FriendshipService } from './friendship';

let globalCallChannel: ReturnType<typeof supabase.channel> | null = null;
let globalCallUserId: string | null = null;

// ★ Sinyal dedup — retry nedeniyle aynı sinyalin iki kez işlenmesini önle
// Aynı callId+action kombini 5sn içinde tekrar gelirse duplikat sayılır
const _processedSignals = new Map<string, number>();
const SIGNAL_DEDUP_WINDOW_MS = 5000;
const SIGNAL_CLEANUP_INTERVAL_MS = 30000;
const SIGNAL_MAP_MAX_SIZE = 200;

// ★ ARCH-2 FIX: Lazy singleton — hot reload'da birikmez, gerektiğinde başlar
let _cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

function _ensureCleanupInterval() {
  if (_cleanupIntervalId) return;
  _cleanupIntervalId = setInterval(() => {
    const now = Date.now();
    for (const [key, ts] of _processedSignals) {
      if (now - ts > SIGNAL_DEDUP_WINDOW_MS * 2) {
        _processedSignals.delete(key);
      }
    }
    // ★ Map tamamen boşsa interval'i durdur — gereksiz CPU tüketimi önleme
    if (_processedSignals.size === 0 && _cleanupIntervalId) {
      clearInterval(_cleanupIntervalId);
      _cleanupIntervalId = null;
    }
  }, SIGNAL_CLEANUP_INTERVAL_MS);
}

function isSignalDuplicate(signal: CallSignal): boolean {
  _ensureCleanupInterval(); // ★ ARCH-2: İlk sinyal geldiğinde temizlik başlatılır
  const key = `${signal.callId}_${signal.action}`;
  const now = Date.now();
  const lastSeen = _processedSignals.get(key);
  if (lastSeen && (now - lastSeen) < SIGNAL_DEDUP_WINDOW_MS) return true;
  // ★ Güvenlik: Map çok şişerse en eski girişleri temizle
  if (_processedSignals.size >= SIGNAL_MAP_MAX_SIZE) {
    const entries = [..._processedSignals.entries()].sort((a, b) => a[1] - b[1]);
    const toDelete = entries.slice(0, Math.floor(SIGNAL_MAP_MAX_SIZE / 2));
    toDelete.forEach(([k]) => _processedSignals.delete(k));
  }
  _processedSignals.set(key, now);
  return false;
}

// ─── TYPES ──────────────────────────────────────────────────
export type CallType = 'audio';
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
export function getCallQuality(tier: TierName): CallQuality {
  const limits = getRoomLimits(tier);
  return {
    audioSampleRate: limits.audioSampleRate,
    audioChannels: limits.audioChannels,
    videoMaxRes: 0,
    videoEnabled: false,
  };
}

// ─── YARDIMCI: Belirli bir kullanıcıya sinyal gönder ────────
/**
 * Geçici kanal adı ile gönderim — globalCallChannel ile çakışma yok
 * - Her gönderim kendi geçici kanalını açar ve sonra kapatır
 * - Global dinleme kanalına dokunmaz
 * - ★ SYNC FIX: Tek seferde gönder, push notification zaten yedek kanal
 */
async function sendSignalToUser(targetUserId: string, signal: CallSignal): Promise<void> {
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
          // ★ SYNC FIX: 500ms bekle — karşı tarafın subscribe olması için yeterli süre
          setTimeout(async () => {
            try {
              await sendChannel.send({
                type: 'broadcast',
                event: 'call_signal',
                payload: signal,
              });
              if (__DEV__) console.log(`[CallService] Sinyal gönderildi → ${signal.action} (${signal.callId.slice(-8)})`);
            } catch (e) {
              if (__DEV__) console.warn(`[CallService] Sinyal gönderme hatası:`, e);
            }
            resolve();
          }, 500);
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
    // Tüm tier'lar sesli arama yapabilir (kalite tier'a göre değişir)

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
    await sendSignalToUser(receiverId, signal);

    // ★ Her durumda push notification gönder — arka planda/kapalıyken arama almak için KRİTİK
    const callTypeLabel = '📞 Sesli Arama';
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
        body: '📞 Cevapsız sesli arama',
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

  /** Aramayı bitir */
  async endCall(callerId: string, otherUserId: string, callId: string) {
    await sendSignalToUser(otherUserId, {
      action: 'call_ended',
      callId,
      callerId,
      callerName: '',
      callType: 'audio',
    });
  },

  /** ★ Meşgul sinyali gönder */
  async sendBusy(callerId: string, receiverId: string, callId: string) {
    await sendSignalToUser(callerId, {
      action: 'call_busy',
      callId,
      callerId: receiverId,
      callerName: '',
      callType: 'audio',
    });
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
        .on('broadcast', { event: 'call_signal' }, async (payload) => {
          const signal = payload.payload as CallSignal;
          if (__DEV__) console.log(`[CallService] ◀ Sinyal ALINDI: ${signal.action} (${signal.callId.slice(-8)})`);
          // ★ Dedup: Retry nedeniyle gelen tekrarlı sinyali filtrele
          if (isSignalDuplicate(signal)) return;

          // ★ SEC-CALL-AUTH: incoming_call sinyalinde friendship doğrulaması
          // Arkadaş olmayan birinden gelen sahte arama sinyalini engelle
          if (signal.action === 'incoming_call' && signal.callerId) {
            try {
              const status = await FriendshipService.getStatus(userId, signal.callerId);
              const reverseStatus = status === 'accepted' ? 'accepted' : await FriendshipService.getStatus(signal.callerId, userId);
              if (status !== 'accepted' && reverseStatus !== 'accepted') {
                if (__DEV__) console.warn('[CallService] SEC-CALL-AUTH: Arkadaş olmayan arama sinyali yoksayıldı:', signal.callerId);
                return;
              }
            } catch {
              // Friendship kontrolü başarısız olursa sinyali yine de işle (graceful degradation)
            }
          }

          DeviceEventEmitter.emit('onCallSignal', signal);
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
