// LiveKit Sesli/Görüntülü Sohbet Servisi
// Lazy-load (getLK) mekanizması ile WebRTC uyumsuz cihazlarda çökme önlenir

import { NativeModules, Platform } from 'react-native';
import { supabase, SUPABASE_ANON_KEY } from '../constants/supabase';
import { LIVEKIT_URL, LIVEKIT_TOKEN_ENDPOINT } from '../constants/livekit';
import { logger } from '../utils/logger';
import { i18n } from './i18n';

let _lk: any = null;
let _globalsRegistered = false;
let _audioSessionModule: any = null;

// ★ 2026-04-27: Android foreground service köprüsü.
// Uygulama arka plana atıldığında WebRTC bağlantısı OS tarafından kesilmesin diye
// odadayken bildirim olarak çalışır. JS'ten start/stop edilir.
// ★ v1.7.13.27 (19 May 2026): Battery optimization muafiyeti API'leri eklendi.
const LiveKitFgService: {
  start: () => Promise<boolean>;
  stop: () => Promise<boolean>;
  isIgnoringBatteryOptimizations?: () => Promise<boolean>;
  requestIgnoreBatteryOptimizations?: () => Promise<boolean>;
} | null =
  Platform.OS === 'android' ? (NativeModules as any).LiveKitForegroundService ?? null : null;

async function startBgService(): Promise<void> {
  if (!LiveKitFgService) return;
  try { await LiveKitFgService.start(); }
  catch (e) { if (__DEV__) logger.warn('[LiveKit] FG service start failed:', (e as any)?.message); }
}

async function stopBgService(): Promise<void> {
  if (!LiveKitFgService) return;
  try { await LiveKitFgService.stop(); }
  catch { /* sessizce geç */ }
}

// ★ v1.7.13.27: Pil iyileştirme muafiyeti kontrolü ve istek.
//   Doze mode WebSocket suspend → oda sessizleşmesi/kopması nedenidir.
//   Foreground service + WAKE_LOCK tek başına yetmiyor; Android 12+ OEM
//   katmanları (Samsung One UI, Xiaomi MIUI vb.) muafiyet olmadan
//   ekran kapali iken network'u suspend ediyor.
export async function isBatteryOptimizationIgnored(): Promise<boolean> {
  if (!LiveKitFgService?.isIgnoringBatteryOptimizations) return true;
  try { return await LiveKitFgService.isIgnoringBatteryOptimizations(); }
  catch { return true; }
}

export async function requestBatteryOptimizationExemption(): Promise<boolean> {
  if (!LiveKitFgService?.requestIgnoreBatteryOptimizations) return true;
  try { return await LiveKitFgService.requestIgnoreBatteryOptimizations(); }
  catch (e) {
    if (__DEV__) logger.warn('[LiveKit] battery opt request failed:', (e as any)?.message);
    return false;
  }
}

function getLK(): any {
  if (!_lk) {
    try {
      // ★ registerGlobals: WebRTC polyfill'lerini React Native ortamına yükler
      // Bu çağrı olmadan livekit-client "WebRTC isn't detected" hatası verir
      if (!_globalsRegistered) {
        try {
          const rnLiveKit = require('@livekit/react-native');
          rnLiveKit.registerGlobals();
          _globalsRegistered = true;
          // ★ AudioSession modülünü sakla — ses için kritik
          if (rnLiveKit.AudioSession) {
            _audioSessionModule = rnLiveKit.AudioSession;
            if (__DEV__) logger.log('[LiveKit] AudioSession modülü hazır');
          }
          if (__DEV__) logger.log('[LiveKit] registerGlobals başarılı');
        } catch (rgErr) {
          if (__DEV__) logger.warn('[LiveKit] registerGlobals yüklenemedi (native modül eksik olabilir):', rgErr);
        }
      }
      _lk = require('livekit-client');
      if (__DEV__) logger.log('[LiveKit] Client lazily loaded');
    } catch (e) {
      if (__DEV__) logger.warn('[LiveKit] livekit-client yüklenemedi — mock modda çalışacak:', e);
      return null;
    }
  }
  return _lk;
}

// ─── Token Servisi ──────────────────────────────────────────
async function fetchToken(roomId: string, userId: string, displayName: string): Promise<string> {
  // ★ Audit fix: 10s timeout — kötü ağda hung request UI'ı dondurmuyor
  const { fetchWithTimeout } = await import('../utils/fetchTimeout');
  
  let response: Response;
  try {
    // ★ 2026-04-30 FIX: Firebase JWT'yi custom header'a taşı — Supabase API Gateway
    //   asymmetric JWT (RS256) kabul ETMİYOR ve 401 UNAUTHORIZED_ASYMMETRIC_JWT dönüyor.
    //   Authorization header'ında HER ZAMAN Supabase Anon Key gönder (Gateway'den geçsin),
    //   Firebase JWT'yi X-Firebase-Auth header'ında gönder (Edge Function RLS context için kullanır).
    let firebaseJwt: string | null = null;
    try {
      const { auth: firebaseAuth } = require('../constants/firebase');
      const fbUser = firebaseAuth.currentUser;
      if (fbUser) firebaseJwt = await fbUser.getIdToken(false);
    } catch { /* Firebase unavailable — anon key ile devam */ }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
    };
    // Firebase JWT varsa custom header'da gönder — Edge Function bunu okuyup RLS context oluşturur
    if (firebaseJwt) {
      headers['X-Firebase-Auth'] = firebaseJwt;
    }

    response = await fetchWithTimeout(LIVEKIT_TOKEN_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({ roomId, displayName, userId }),
    }, 10_000);
  } catch (networkErr: any) {
    // ★ Network hatası (DNS, timeout, offline) — detaylı log
    if (__DEV__) logger.warn('[LiveKit] Token fetch network error:', networkErr?.message);
    throw new Error(`Ağ hatası: ${networkErr?.message || i18n.t('auto.livekit.009')}`);
  }

  if (!response.ok) {
    let errBody: any = {};
    try { errBody = await response.json(); } catch { /* non-JSON response */ }
    const errMsg = errBody?.error || `HTTP ${response.status}`;
    
    if (__DEV__) {
      logger.warn(`[LiveKit] Token fetch FAILED — status=${response.status}, error="${errMsg}", roomId=${roomId}, userId=${userId}`);
    }
    
    // ★ 2026-04-30: Detaylı hata mesajları — UI'da anlamlı feedback
    if (response.status === 403) {
      throw new Error(errMsg); // "Oda aktif değil", "Bu odadan yasaklandınız" vb.
    } else if (response.status === 404) {
      throw new Error(i18n.t('auto.livekit.008'));
    } else if (response.status === 401) {
      throw new Error(i18n.t('auto.livekit.007'));
    } else {
      throw new Error(errMsg);
    }
  }

  const data = await response.json();
  if (__DEV__) logger.log(`[LiveKit] Token alındı — roomId=${roomId}, role=${data.role || 'unknown'}`);
  return data.token;
}

// ─── Types ──────────────────────────────────────────────────
export type ParticipantUpdate = {
  identity: string;
  isSpeaking: boolean;
  isMuted: boolean;
  audioLevel: number;
  isCameraEnabled?: boolean;
  videoTrack?: any;
  isScreenShareEnabled?: boolean;
  screenShareTrack?: any; // Screen share video track for display
};

export type RoomConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

// ─── Ana Sınıf ──────────────────────────────────────────────
export class LiveKitService {
  private room: any = null; // livekit-client Room instance
  private currentRoomId: string | null = null; // Hangi oda bağlı, minimize-restore için
  private onParticipantUpdate?: (participants: ParticipantUpdate[]) => void;
  private onConnectionStateChange?: (state: RoomConnectionState) => void;
  private onSpeakingChange?: (identity: string, isSpeaking: boolean) => void;
  private onTrackStateChange?: (micEnabled: boolean, camEnabled: boolean) => void;
  private onParticipantDisconnected?: (identity: string) => void; // ★ Karşı taraf ayrıldığında
  // ★ K7: Mic/cam permission denied callback — UI "Open Settings" alert'ı gösterebilsin.
  private onPermissionDenied?: (device: 'microphone' | 'camera') => void;
  // ★ 2026-04-25: Bağlantı kalitesi callback — 'excellent' | 'good' | 'poor' | 'unknown'
  private onConnectionQualityChange?: (quality: 'excellent' | 'good' | 'poor' | 'unknown') => void;
  // ★ Tier bazlı kalite ayarları
  private audioPreset: { sampleRate: number; channelCount: number } = { sampleRate: 48000, channelCount: 1 };
  private videoMaxRes: number = 720;
  private screenShareTrack: any = null; // Manual screen share track reference
  private screenShareStream: any = null; // Native MediaStream reference

  /**
   * ★ K7: Hata mesajından mic/cam permission denied olup olmadığını çıkar.
   * Native (iOS AVAudioSession / Android RECORD_AUDIO) ve web (getUserMedia) variants.
   */
  private _isPermissionError(e: any): boolean {
    if (!e) return false;
    const name = String((e as any).name || '').toLowerCase();
    const msg = String((e as any).message || e).toLowerCase();
    return (
      name === 'notallowederror'
      || name === 'permissiondeniederror'
      || msg.includes('permission denied')
      || msg.includes('not allowed')
      || msg.includes('notallowed')
      || msg.includes('record_audio')
      || msg.includes('microphone permission')
      || msg.includes('camera permission')
    );
  }

  // ★ Faz 3.4 — Mic processing toggles (kullanıcı ayarlardan değiştirebilir)
  // Default'lar `true`; SettingsService'ten okunup `setAudioProcessing()` ile güncellenir.
  private audioProcessing: { echoCancellation: boolean; noiseSuppression: boolean; autoGainControl: boolean } = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };

  /** Settings ekranından mic ayarları değişince çağrılır. Sonraki publish için aktif. */
  setAudioProcessing(opts: { echoCancellation?: boolean; noiseSuppression?: boolean; autoGainControl?: boolean }): void {
    if (opts.echoCancellation !== undefined) this.audioProcessing.echoCancellation = opts.echoCancellation;
    if (opts.noiseSuppression !== undefined) this.audioProcessing.noiseSuppression = opts.noiseSuppression;
    if (opts.autoGainControl !== undefined) this.audioProcessing.autoGainControl = opts.autoGainControl;
  }

  /** Tier bazlı mikrofon ses ayarlarını döndür */
  private getAudioConstraints() {
    return {
      sampleRate: this.audioPreset.sampleRate,
      channelCount: this.audioPreset.channelCount,
      sampleSize: 16,
      noiseSuppression: this.audioProcessing.noiseSuppression,
      echoCancellation: this.audioProcessing.echoCancellation,
      autoGainControl: this.audioProcessing.autoGainControl,
    };
  }

  get currentRoom(): any {
    return this.room;
  }

  async connect(
    roomId: string,
    userId: string,
    displayName: string,
    callbacks: {
      onParticipantUpdate?: (participants: ParticipantUpdate[]) => void;
      onConnectionStateChange?: (state: RoomConnectionState) => void;
      onSpeakingChange?: (identity: string, isSpeaking: boolean) => void;
      onTrackStateChange?: (micEnabled: boolean, camEnabled: boolean) => void;
      onParticipantDisconnected?: (identity: string) => void; // ★ Karşı taraf ayrıldığında
      onPermissionDenied?: (device: 'microphone' | 'camera') => void;
      // ★ 2026-04-25: Local participant connection quality
      onConnectionQualityChange?: (quality: 'excellent' | 'good' | 'poor' | 'unknown') => void;
    },
    qualityPreset?: { audioSampleRate?: number; audioChannels?: number; videoMaxRes?: number }
  ): Promise<boolean> {
    const lk = getLK();
    if (!lk) {
      if (__DEV__) logger.warn('[LiveKit] Modül yok, sahte (mock) moda geçiliyor.');
      callbacks.onConnectionStateChange?.('connected'); // Mock devrede
      return false; // Gerçek bağlantı kurulamadı
    }

    // ★ 2026-04-20 Minimize-restore: aynı odaya zaten bağlıysak yeniden bağlanma,
    // callbacks'i overwrite et + mevcut state'i yeni dinleyiciye yay.
    // ★ 2026-04-27: Sadece 'connected' veya 'reconnecting' iken reattach et;
    // 'disconnected' kaldıysa (Doze/arka plan kopması) mevcut room nesnesi kullanılamaz —
    // tam bağlantıya düş ki "Bağlantı kurulamadı" ekranı yerine yeniden bağlanabilelim.
    if (this.room && this.currentRoomId === roomId) {
      const rs = this.room.state;
      if (rs === 'connected' || rs === 'reconnecting') {
        this.onParticipantUpdate = callbacks.onParticipantUpdate;
        this.onConnectionStateChange = callbacks.onConnectionStateChange;
        this.onSpeakingChange = callbacks.onSpeakingChange;
        this.onTrackStateChange = callbacks.onTrackStateChange;
        this.onParticipantDisconnected = callbacks.onParticipantDisconnected;
        this.onPermissionDenied = callbacks.onPermissionDenied;
        this.onConnectionQualityChange = callbacks.onConnectionQualityChange;
        try {
          const mappedState: RoomConnectionState = rs === 'reconnecting' ? 'reconnecting' : 'connected';
          callbacks.onConnectionStateChange?.(mappedState);
          callbacks.onTrackStateChange?.(this.isMicrophoneEnabled, this.isCameraEnabled);
          this._doEmitParticipantUpdate(lk);
        } catch (e) { if (__DEV__) logger.warn('[LiveKit] reattach state emit error', e); }
        if (__DEV__) logger.log(`[LiveKit] Reattach — ${roomId} için mevcut bağlantı kullanıldı (state=${rs})`);
        return true;
      }
      if (__DEV__) logger.log(`[LiveKit] Stale room (state=${rs}) — full reconnect zorlanıyor`);
    }

    if (this.room) {
      await this.disconnect();
    }

    // ★ 2026-04-27: Arka plan ön plan servisi — odaya bağlanmadan ÖNCE başlat
    // (Android 12+ FOREGROUND_SERVICE_MICROPHONE foreground'da iken başlatılmalı).
    await startBgService();

    this.onParticipantUpdate = callbacks.onParticipantUpdate;
    this.onConnectionStateChange = callbacks.onConnectionStateChange;
    this.onSpeakingChange = callbacks.onSpeakingChange;
    this.onTrackStateChange = callbacks.onTrackStateChange;
    this.onParticipantDisconnected = callbacks.onParticipantDisconnected;
    this.onPermissionDenied = callbacks.onPermissionDenied;
    this.onConnectionQualityChange = callbacks.onConnectionQualityChange;

    // ★ Tier bazlı kalite ayarları uygula
    if (qualityPreset) {
      this.audioPreset = {
        sampleRate: qualityPreset.audioSampleRate || 48000,
        channelCount: qualityPreset.audioChannels || 1,
      };
      this.videoMaxRes = qualityPreset.videoMaxRes || 720;
    }

    // ★ Retry mantığı: 3 deneme, 2sn aralık
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        this.onConnectionStateChange?.('connecting');

        // ★ KRITIS: React Native'de ses için AudioSession başlatmak ZORUNLU
        if (_audioSessionModule && attempt === 1) {
          try {
            await _audioSessionModule.startAudioSession();
            if (__DEV__) logger.log('[LiveKit] AudioSession başlatıldı');
          } catch (audioErr) {
            if (__DEV__) logger.warn('[LiveKit] AudioSession başlatılamadı:', audioErr);
          }
        }

        // Token alma: 35sn timeout (Supabase edge cold start için — bazen 9-15sn sürüyor)
        const token = await Promise.race([
          fetchToken(roomId, userId, displayName),
          new Promise<string>((_, reject) => setTimeout(() => reject(new Error('Token timeout (35s)')), 35000)),
        ]);

        // Her bağlantı denemesinde temiz room oluştur
        if (this.room) {
          try { if (this.room.state === 'connected' || this.room.state === 'reconnecting') this.room.disconnect(); } catch(_) {}
          this.room = null;
        }
        this.room = new lk.Room({
          adaptiveStream: true,
          dynacast: true,
          // ★ Ping/pong süreleri artırıldı — emülatör/yavaş ağ toleransı
          pingTimeout: 15000,   // ping gönderme aralığı (ms)
          pongTimeout: 60000,   // pong bekleme süresi (ms)
          websocketTimeout: 30000,
          // ★ Otomatik yeniden bağlanma — bağlantı kesilirse LiveKit kendisi deneyecek
          reconnectPolicy: {
            nextRetryDelayInMs: (context: any) => {
              const delay = Math.min(1000 * Math.pow(2, context?.retryCount || 0), 10000);
              if (__DEV__) logger.log(`[LiveKit] Reconnect attempt ${context?.retryCount || 0}, delay: ${delay}ms`);
              return delay;
            },
          },
        });
        this.setupEventListeners(lk);

        // Bağlantı: 15sn timeout
        await Promise.race([
          this.room.connect(LIVEKIT_URL, token),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Connect timeout (15s)')), 15000)),
        ]);

        this.currentRoomId = roomId;
        this.onConnectionStateChange?.('connected');

        // ★ 2026-04-20 LATE-JOINER FIX: Connect sonrası mevcut remoteParticipant'ların
        //   track'lerini explicit subscribe et. LiveKit default olarak autoSubscribe=true
        //   olsa da bazı sürümlerde connect öncesi publish edilmiş kamera track'leri
        //   late-joiner'a setSubscribed(true) çağrılmadan ulaşmıyor — video "açık" görünür
        //   ama karşı taraf boş avatar görür.
        try {
          const iter = (c: any, cb: (v: any) => void) => {
            if (!c) return;
            if (typeof c.forEach === 'function') c.forEach((v: any) => cb(v));
            else if (Array.isArray(c)) c.forEach(cb);
          };
          iter(this.room?.remoteParticipants, (participant: any) => {
            // ★ 2026-04-20 FIX: Participant disconnect olmuş olabilir (identity yok veya
            //   connectionState 'disconnected'). setSubscribed çağrısı SDK'da "Tried to
            //   add a track for a participant, that's not present" hatası atıyor.
            if (!participant?.identity) return;
            const state = participant?.connectionState || participant?.state;
            if (state === 'disconnected') return;
            iter(participant?.videoTrackPublications, (pub: any) => {
              if (pub && pub.isSubscribed === false && typeof pub.setSubscribed === 'function') {
                try { pub.setSubscribed(true).catch(() => {}); } catch {}
              }
            });
            iter(participant?.audioTrackPublications, (pub: any) => {
              if (pub && pub.isSubscribed === false && typeof pub.setSubscribed === 'function') {
                try { pub.setSubscribed(true).catch(() => {}); } catch {}
              }
              // Zaten subscribed ise de audio playback'i garantile
              if (pub?.track?.mediaStreamTrack) {
                try {
                  pub.track.mediaStreamTrack.enabled = true;
                  pub.track.attach?.();
                  pub.track.start?.();
                } catch {}
              }
            });
          });
        } catch (e) {
          if (__DEV__) logger.warn('[LiveKit] late-joiner subscribe error:', e);
        }

        this.emitParticipantUpdate(lk);
        // ★ 2026-04-24 FIX: Late-joiner video — ilk emit'te track'ler henüz subscribe
        //   olmamış olabilir. 500ms ve 1500ms sonra tekrar emit ederek subscribe tamamlanmış
        //   track'lerin UI'a yansımasını garanti ediyoruz.
        setTimeout(() => this.emitParticipantUpdate(lk), 500);
        setTimeout(() => this.emitParticipantUpdate(lk), 1500);
        if (__DEV__) logger.log(`[LiveKit] Bağlantı başarılı (deneme ${attempt}/${MAX_RETRIES})`);
        return true;
      } catch (err: any) {
        if (__DEV__) logger.warn(`[LiveKit] Bağlantı Hatası (deneme ${attempt}/${MAX_RETRIES}):`, err?.message || err);
        
        if (attempt < MAX_RETRIES) {
          // Tekrar denemeden önce room'u temizle
          if (this.room) {
            try { if (this.room.state === 'connected' || this.room.state === 'reconnecting') this.room.disconnect(); } catch(_) {}
            this.room = null;
          }
          await new Promise(r => setTimeout(r, 2000)); // 2sn bekle
          continue;
        }
        
        // Son deneme de başarısız
        if (this.room) {
          try { if (this.room.state === 'connected' || this.room.state === 'reconnecting') this.room.disconnect(); } catch(_) {}
        }
        this.room = null;
        this.currentRoomId = null;
        this.onConnectionStateChange?.('disconnected');
        return false;
      }
    }
    return false;
  }

  // ─── Oda Sesini Kapat/Aç ──────────────────────────────────
  // ★ v92.17 (1 May 2026): mediaStreamTrack.enabled JS-side flag — RN native
  //   audio player'ı durdurmuyor, ses kullanıcının kulağına geliyordu (sahnedeki
  //   konuşmacı kendi mikrofonunu açık tutarken diğer sesleri kısamadığı şikâyeti).
  //   ÇÖZÜM: setSubscribed(false) → sunucuya "bu track'i bana gönderme" mesajı,
  //   audio akışı network seviyesinde durur. Yeni katılan participant'lar için
  //   _roomAudioMuted flag tutulur, TrackSubscribed event'inde de uygulanır.
  private _roomAudioMuted: boolean = false;

  muteRoomAudio(mute: boolean) {
    this._roomAudioMuted = mute;
    if (!this.room) return;
    const iterate = (collection: any, cb: (v: any) => void) => {
      if (!collection) return;
      if (typeof collection.forEach === 'function') {
        collection.forEach((v: any) => cb(v));
      } else if (Array.isArray(collection)) {
        collection.forEach(cb);
      }
    };
    iterate(this.room.remoteParticipants, (p: any) => {
      iterate(p?.audioTrackPublications, (pub: any) => {
        // 1. setSubscribed — en kesin: sunucu tarafı unsubscribe, network'te ses akmaz
        if (typeof pub?.setSubscribed === 'function') {
          try { pub.setSubscribed(!mute); } catch {}
        }
        // 2. setEnabled fallback (bazı LiveKit RN versiyonları)
        if (typeof pub?.track?.setEnabled === 'function') {
          try { pub.track.setEnabled(!mute); } catch {}
        }
        // 3. Volume 0/1 (bazı SDK'larda var)
        if (pub?.track && typeof (pub.track as any).setVolume === 'function') {
          try { (pub.track as any).setVolume(mute ? 0 : 1); } catch {}
        }
        // 4. Last resort — mediaStreamTrack.enabled (etkisiz olabilir ama zarar vermez)
        if (pub?.track?.mediaStreamTrack) {
          try { pub.track.mediaStreamTrack.enabled = !mute; } catch {}
        }
      });
    });
  }

  /** Mevcut roomAudioMuted state'ini döner — yeni track subscribe olunca kullanılır */
  isRoomAudioMuted(): boolean {
    return this._roomAudioMuted;
  }

  // ─── Bağlantıyı Kes ──────────────────────────────────────
  /**
   * ★ Faz 3.2 — Voice reaction / lightweight data broadcast.
   * Bu metod mevcut audio publish/subscribe akışına TEMAS ETMEZ.
   * LiveKit data channel'ı her room connection'da otomatik açıktır,
   * burada sadece JSON payload göndeririz.
   *
   * NOT: room null/disconnected ise sessiz fail — voice reaction
   * kritik akış değil, ses iletimini engellememeli.
   */
  async publishData(payload: Record<string, any>): Promise<void> {
    if (!this.room || this.room.state !== 'connected') return;
    try {
      const lk = getLK();
      const reliable = lk?.DataPacket_Kind?.RELIABLE ?? 0;
      const json = JSON.stringify(payload);
      const bytes = new TextEncoder().encode(json);
      await this.room.localParticipant.publishData(bytes, reliable);
    } catch (e) {
      if (__DEV__) logger.log('[LiveKit] publishData failed:', (e as any)?.message);
    }
  }

  /**
   * ★ Faz 3.2 — Data event subscriber. Bir kez kayıt edilir, bağlantı
   * yaşam döngüsü boyunca aktif. unsubscribe için connect tarafındaki
   * room.removeAllListeners patterni kullanılır (mevcut akış).
   */
  setOnDataReceived(cb?: (payload: Record<string, any>, fromIdentity: string) => void): void {
    this.onDataReceivedCb = cb;
  }
  private onDataReceivedCb?: (payload: Record<string, any>, fromIdentity: string) => void;

  async disconnect(): Promise<void> {
    if (__DEV__) {
      console.log('[LiveKit] DISCONNECT ÇAĞRILDI');
      console.log('[LiveKit] Stack:', new Error().stack?.split('\n').slice(1, 5).join('\n'));
    }
    // ★ Ekran paylaşımı açıksa önce temizle — referans sızıntısı önleme
    if (this.screenShareTrack || this.screenShareStream) {
      try { await this.stopScreenShare(); } catch { /* silent */ }
    }
    if (this.room) {
      try {
        if (this.room.state === 'connected' || this.room.state === 'reconnecting') {
          await this.room.disconnect();
        }
      } catch (e) {
        if (__DEV__) logger.log('[LiveKit] Disconnect sırasında beklenen hata:', (e as any)?.message);
      }
      this.room = null;
      this.currentRoomId = null;
    }
    // ★ AudioSession ı kapat — kaynakları serbest bırak
    if (_audioSessionModule) {
      try {
        await _audioSessionModule.stopAudioSession();
        if (__DEV__) logger.log('[LiveKit] AudioSession durduruldu');
      } catch (e) { /* sessizce geç */ }
    }
    // ★ 2026-04-27: Arka plan servisi durdur — bildirim kaybolsun, batarya tüketmesin.
    await stopBgService();
    this.onConnectionStateChange?.('disconnected');
    this.onTrackStateChange?.(false, false);
    this.emitParticipantUpdate(getLK());
  }

  // ─── Mikrofon Aç/Kapat ──────────────────────────────────
  async toggleMicrophone(): Promise<boolean> {
    if (!this.room?.localParticipant) {
      if (__DEV__) logger.warn('[LiveKit] toggleMic: room veya localParticipant yok');
      return false;
    }
    if (this.room.state !== 'connected') {
      if (__DEV__) logger.warn('[LiveKit] toggleMic: Room bağlı değil, state:', this.room.state);
      return false;
    }
    const enabled = this.room.localParticipant.isMicrophoneEnabled;
    try {
      const opts = !enabled ? this.getAudioConstraints() : undefined;
      await Promise.race([
        this.room.localParticipant.setMicrophoneEnabled(!enabled, opts),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Mic timeout (5s)')), 5000)),
      ]);
    } catch (e) {
      if (__DEV__) logger.warn('[LiveKit] Mikrofon toggle hatası:', (e as any)?.message);
      // ★ K7: Permission hatası → UI'ya bildir
      if (!enabled && this._isPermissionError(e)) {
        this.onPermissionDenied?.('microphone');
      }
      return enabled;
    }
    const newMicState = !enabled;
    this.onTrackStateChange?.(newMicState, this.isCameraEnabled);
    this.emitParticipantUpdate(getLK());
    return newMicState;
  }

  // ─── Mikrofon Doğrudan Aç (otomatik sahneye çıkma için) ──
  async enableMicrophone(): Promise<boolean> {
    if (!this.room?.localParticipant) return false;
    if (this.room.state !== 'connected') return false;
    if (this.room.localParticipant.isMicrophoneEnabled) return true; // zaten açık
    try {
      await Promise.race([
        this.room.localParticipant.setMicrophoneEnabled(true, this.getAudioConstraints()),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Mic enable timeout (5s)')), 5000)),
      ]);
    } catch (e) {
      if (__DEV__) logger.warn('[LiveKit] Mikrofon açma hatası:', (e as any)?.message);
      if (this._isPermissionError(e)) {
        this.onPermissionDenied?.('microphone');
      }
      return false;
    }
    this.onTrackStateChange?.(true, this.isCameraEnabled);
    this.emitParticipantUpdate(getLK());
    return true;
  }

  // ─── Mikrofon Zorla Kapat (moderasyon: mute/demote için) ──
  async disableMicrophone(): Promise<void> {
    if (!this.room?.localParticipant) return;
    if (!this.room.localParticipant.isMicrophoneEnabled) {
      // Zaten kapalı — sadece state güncelle
      this.onTrackStateChange?.(false, this.isCameraEnabled);
      return;
    }
    try {
      await Promise.race([
        this.room.localParticipant.setMicrophoneEnabled(false),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Mic disable timeout')), 5000)),
      ]);
      if (__DEV__) logger.log('[LiveKit] Mikrofon ZORLA kapatıldı (moderasyon)');
    } catch (e) {
      if (__DEV__) logger.warn('[LiveKit] Mikrofon zorla kapatma hatası:', (e as any)?.message);
    }
    this.onTrackStateChange?.(false, this.isCameraEnabled);
    this.emitParticipantUpdate(getLK());
  }

  // ─── Kamera Zorla Kapat (moderasyon: mute/demote için) ──
  async disableCamera(): Promise<void> {
    if (!this.room?.localParticipant) return;
    if (!this.room.localParticipant.isCameraEnabled) {
      this.onTrackStateChange?.(this.isMicrophoneEnabled, false);
      return;
    }
    try {
      await Promise.race([
        this.room.localParticipant.setCameraEnabled(false),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Cam disable timeout')), 5000)),
      ]);
      if (__DEV__) logger.log('[LiveKit] Kamera ZORLA kapatıldı (moderasyon)');
    } catch (e) {
      if (__DEV__) logger.warn('[LiveKit] Kamera zorla kapatma hatası:', (e as any)?.message);
    }
    this.onTrackStateChange?.(this.isMicrophoneEnabled, false);
    this.emitParticipantUpdate(getLK());
  }

  async enableCamera(): Promise<void> {
    if (!this.room?.localParticipant) return;
    if (this.room.state !== 'connected') return;
    if (this.room.localParticipant.isCameraEnabled) return;
    try {
      await Promise.race([
        this.room.localParticipant.setCameraEnabled(true, { facingMode: this._isFrontCamera ? 'user' : 'environment' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Cam enable timeout')), 5000)),
      ]);
      if (__DEV__) logger.log('[LiveKit] Kamera yeniden açıldı →', this._isFrontCamera ? 'ön' : 'arka');
    } catch (e) {
      if (__DEV__) logger.warn('[LiveKit] Kamera açma hatası:', (e as any)?.message);
      if (this._isPermissionError(e)) {
        this.onPermissionDenied?.('camera');
      }
    }
    this.onTrackStateChange?.(this.isMicrophoneEnabled, true);
    this.emitParticipantUpdate(getLK());
  }

  /**
   * Mikrofon modunu değiştir: 'normal' (konuşma) veya 'music' (müzik yayını)
   */
  async setMicMode(mode: 'normal' | 'music'): Promise<void> {
    if (!this.room?.localParticipant) return;

    const isCurrentlyEnabled = this.room.localParticipant.isMicrophoneEnabled;
    
    if (isCurrentlyEnabled) {
      await this.room.localParticipant.setMicrophoneEnabled(false);
    }

    const audioOptions = mode === 'music'
      ? {
          // Music modunda processing kapalı kalır — müzik kalitesi için zorunlu
          noiseSuppression: false,
          echoCancellation: false,
          autoGainControl: false,
          channelCount: 2,
          sampleRate: 48000,
          sampleSize: 16,
        }
      : {
          // Voice modunda kullanıcının settings'teki tercihi geçerli
          noiseSuppression: this.audioProcessing.noiseSuppression,
          echoCancellation: this.audioProcessing.echoCancellation,
          autoGainControl: this.audioProcessing.autoGainControl,
          channelCount: 1,
          sampleRate: 48000,
          sampleSize: 16,
        };

    if (isCurrentlyEnabled) {
      try {
        await this.room.localParticipant.setMicrophoneEnabled(true, audioOptions);
        if (__DEV__) logger.log(`[LiveKit] Mikrofon modu değişti: ${mode}`, audioOptions);
      } catch (e) {
        if (__DEV__) logger.warn('[LiveKit] Mic mode değiştirme hatası:', e);
        await this.room.localParticipant.setMicrophoneEnabled(true);
      }
    }

    this.emitParticipantUpdate(getLK());
  }

  // ─── Kamera Aç/Kapat ──────────────────────────────────────
  async toggleCamera(): Promise<boolean> {
    if (!this.room?.localParticipant) return false;
    if (this.room.state !== 'connected') return false;
    const enabled = this.room.localParticipant.isCameraEnabled;
    try {
      await Promise.race([
        this.room.localParticipant.setCameraEnabled(!enabled),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Camera timeout (5s)')), 5000)),
      ]);
    } catch (e) {
      if (__DEV__) logger.warn('[LiveKit] Kamera toggle hatası:', (e as any)?.message);
      if (!enabled && this._isPermissionError(e)) {
        this.onPermissionDenied?.('camera');
      }
      return enabled;
    }
    const newCamState = !enabled;
    this.onTrackStateChange?.(this.isMicrophoneEnabled, newCamState);
    this.emitParticipantUpdate(getLK());
    return newCamState;
  }

  // ─── Kamera Ön/Arka Çevirme (Flip) ──────────────────────
  private _isFrontCamera = true;

  async flipCamera(): Promise<void> {
    if (!this.room?.localParticipant) return;
    if (!this.room.localParticipant.isCameraEnabled) return;
    
    const lp = this.room.localParticipant;
    const newFacing = this._isFrontCamera ? 'environment' : 'user';
    
    try {
      // ★ Track'i bul
      let videoTrack: any = null;
      const pub = (lp as any).getTrackPublication?.('camera');
      if (pub?.track) videoTrack = pub.track;
      
      if (!videoTrack) {
        const pubs = (lp as any).videoTrackPublications;
        if (pubs && typeof pubs.forEach === 'function') {
          pubs.forEach((p: any) => {
            if (!videoTrack && p?.track && (p.source === 'camera')) videoTrack = p.track;
          });
        }
      }

      // Yöntem 1: restartTrack — track'i yeni facingMode ile yeniden oluşturur
      if (videoTrack && typeof videoTrack.restartTrack === 'function') {
        if (__DEV__) logger.log('[LiveKit] flipCamera: restartTrack →', newFacing);
        await videoTrack.restartTrack({ facingMode: newFacing });
        this._isFrontCamera = !this._isFrontCamera;
        if (__DEV__) logger.log('[LiveKit] flipCamera başarılı (restartTrack) →', this._isFrontCamera ? 'ön' : 'arka');
        this.emitParticipantUpdate(getLK());
        return;
      }
      
      // Yöntem 2: unpublish + yeni track publish
      if (__DEV__) logger.log('[LiveKit] flipCamera: unpublish + republish →', newFacing);
      if (videoTrack) {
        await lp.unpublishTrack(videoTrack);
      }
      this._isFrontCamera = !this._isFrontCamera;
      await new Promise(r => setTimeout(r, 200));
      await lp.setCameraEnabled(true, { facingMode: newFacing });
      
      if (__DEV__) logger.log('[LiveKit] flipCamera başarılı (republish) →', this._isFrontCamera ? 'ön' : 'arka');
      this.onTrackStateChange?.(this.isMicrophoneEnabled, true);
      this.emitParticipantUpdate(getLK());
    } catch (e) {
      if (__DEV__) logger.warn('[LiveKit] Kamera çevirme hatası:', (e as any)?.message);
    }
  }

  get isCameraEnabled(): boolean {
    return this.room?.localParticipant?.isCameraEnabled ?? false;
  }

  get isMicrophoneEnabled(): boolean {
    return this.room?.localParticipant?.isMicrophoneEnabled ?? false;
  }

  // ★ 2026-04-20: Minimize-restore state seed için — yeni mount'ta "disconnected"
  // başlamaması için useLiveKit bunu kullanır. currentRoomId aynı VE room instance
  // varsa bağlı kabul edilir (LiveKit native state transient olabilir; bizim
  // bilinçli disconnect çağrımız olmadığı sürece bağlıyız).
  isConnectedTo(roomId: string): boolean {
    return this.currentRoomId === roomId && !!this.room;
  }

  // --- Ekran Paylasimi -----------------------------------------------
  async toggleScreenShare(): Promise<boolean> {
    if (!this.room?.localParticipant) {
      if (__DEV__) logger.warn('[LiveKit] Ekran paylasimi: room veya localParticipant yok');
      throw new Error(i18n.t('auto.livekit.006'));
    }
    if (this.room.state !== 'connected') {
      if (__DEV__) logger.warn('[LiveKit] Ekran paylasimi: room bagli degil, state:', this.room.state);
      throw new Error(i18n.t('auto.livekit.005'));
    }
    const isSharing = this.isScreenSharing;
    try {
      if (isSharing) {
        // DURDUR
        if (__DEV__) logger.log('[LiveKit] Ekran paylaşımı DURDURULUYOR');
        await this.stopScreenShare();
        if (__DEV__) logger.log('[LiveKit] Ekran paylaşımı DURDU');
      } else {
        // BAŞLAT — React Native native API kullan
        if (__DEV__) logger.log('[LiveKit] Ekran paylaşımı BAŞLATIYOR (native)');

        // Yöntem 1: LiveKit'in kendi setScreenShareEnabled API'si (önerilen)
        if (typeof this.room.localParticipant.setScreenShareEnabled === 'function') {
          if (__DEV__) logger.log('[LiveKit] setScreenShareEnabled kullanılıyor');
          await Promise.race([
            this.room.localParticipant.setScreenShareEnabled(true),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error(i18n.t('auto.livekit.004'))), 15000)),
          ]);
          // Track referansını bul ve sakla
          const LK = getLK();
          if (LK && this.room.localParticipant.trackPublications) {
            for (const [, pub] of this.room.localParticipant.trackPublications) {
              if (pub?.source === LK.Track.Source.ScreenShare && pub?.track) {
                this.screenShareTrack = pub.track;
                break;
              }
            }
          }
          if (__DEV__) logger.log('[LiveKit] Ekran paylaşımı BAŞLADI (native)');
        }
        // Yöntem 2: Web fallback (getDisplayMedia)
        else if (typeof navigator !== 'undefined' && navigator?.mediaDevices?.getDisplayMedia) {
          if (__DEV__) logger.log('[LiveKit] getDisplayMedia fallback kullanılıyor');
          const stream = await Promise.race([
            navigator.mediaDevices.getDisplayMedia(),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error(i18n.t('auto.livekit.003'))), 30000)),
          ]) as any;
          const videoTracks = stream.getVideoTracks();
          if (!videoTracks || videoTracks.length === 0) {
            throw new Error(i18n.t('auto.livekit.002'));
          }
          this.screenShareStream = stream;
          const LK = getLK();
          const localTrack = new LK.LocalVideoTrack(videoTracks[0], undefined, false);
          (localTrack as any).source = LK.Track.Source.ScreenShare;
          this.screenShareTrack = localTrack;
          await this.room.localParticipant.publishTrack(localTrack, {
            source: LK.Track.Source.ScreenShare,
            videoCodec: 'vp8',
          });
          if (__DEV__) logger.log('[LiveKit] Ekran paylaşımı BAŞLADI (web fallback)');
        } else {
          throw new Error(i18n.t('auto.livekit.001'));
        }
      }
    } catch (e: any) {
      if (__DEV__) logger.warn('[LiveKit] Ekran paylaşımı hatası:', e?.message, e?.stack?.substring(0, 300));
      throw e;
    }
    this.emitParticipantUpdate(getLK());
    return !isSharing;
  }

  private async stopScreenShare(): Promise<void> {
    try {
      // Yöntem 1: Native API ile kapat (önerilen — foreground service'i de kapatır)
      if (this.room?.localParticipant && typeof this.room.localParticipant.setScreenShareEnabled === 'function') {
        try {
          await this.room.localParticipant.setScreenShareEnabled(false);
          if (__DEV__) logger.log('[LiveKit] Ekran paylaşımı native API ile durduruldu');
        } catch (e) {
          if (__DEV__) logger.warn('[LiveKit] Native stop hatası:', (e as any)?.message);
        }
      }
      // Yöntem 2: Manuel unpublish (fallback)
      if (this.screenShareTrack && this.room?.localParticipant) {
        try {
          await this.room.localParticipant.unpublishTrack(this.screenShareTrack);
        } catch (e) {
          if (__DEV__) logger.warn('[LiveKit] unpublishTrack hatası:', (e as any)?.message);
        }
      }
      // Yöntem 3: Tüm screen share publication'larını bul ve kaldır
      if (this.room?.localParticipant) {
        try {
          const LK = getLK();
          const pubs = this.room.localParticipant.trackPublications;
          if (pubs) {
            for (const [, pub] of pubs) {
              if (pub?.source === LK.Track.Source.ScreenShare && pub?.track) {
                await this.room.localParticipant.unpublishTrack(pub.track);
              }
            }
          }
        } catch (e) {
          if (__DEV__) logger.warn('[LiveKit] fallback unpublish hatası:', (e as any)?.message);
        }
      }
      // Yöntem 4: Web stream track'lerini durdur
      if (this.screenShareStream) {
        try {
          const tracks = this.screenShareStream.getTracks?.();
          if (tracks) {
            for (const t of tracks) { t.stop?.(); }
          }
        } catch (e) {
          if (__DEV__) logger.warn('[LiveKit] native track stop hatası:', (e as any)?.message);
        }
      }
    } finally {
      this.screenShareTrack = null;
      this.screenShareStream = null;
    }
  }

  async disableScreenShare(): Promise<void> {
    if (!this.room?.localParticipant) return;
    if (!this.isScreenSharing) return;
    try {
      await this.stopScreenShare();
    } catch (e) {
      if (__DEV__) logger.warn('[LiveKit] Ekran paylasimi durdurma hatasi:', (e as any)?.message);
    }
    this.emitParticipantUpdate(getLK());
  }

  get isScreenSharing(): boolean {
    // 1) Saklanan referans kontrolu
    if (this.screenShareTrack) return true;
    // 2) Fallback: publication kontrolu
    if (!this.room?.localParticipant) return false;
    try {
      const LK = getLK();
      const pub = this.room.localParticipant.getTrackPublication?.(LK.Track.Source.ScreenShare);
      return !!pub?.track;
    } catch {
      return false;
    }
  }

  // ─── Event Listeners ──────────────────────────────────────
  private setupEventListeners(lk: any) {
    if (!this.room || !lk) return;

    const events = [
      lk.RoomEvent.ParticipantConnected,
      lk.RoomEvent.ParticipantDisconnected,
      lk.RoomEvent.ActiveSpeakersChanged,
      lk.RoomEvent.TrackMounted,
      lk.RoomEvent.TrackUnmounted,
      lk.RoomEvent.TrackMuted,
      lk.RoomEvent.TrackUnmuted,
      lk.RoomEvent.TrackSubscribed,
      lk.RoomEvent.TrackUnsubscribed,
      lk.RoomEvent.TrackPublished,       // ★ 2026-04-24 FIX: Remote participant track publish — late-joiner video fix
      lk.RoomEvent.TrackUnpublished,     // ★ Remote participant track unpublish
      lk.RoomEvent.LocalTrackPublished,
      lk.RoomEvent.LocalTrackUnpublished,
      lk.RoomEvent.ConnectionStateChanged,
      lk.RoomEvent.ConnectionQualityChanged, // ★ 2026-04-25: Bağlantı kalitesi göstergesi
      lk.RoomEvent.DataReceived,             // ★ Faz 3.2: Voice reaction data channel
    ];

    // ★ v92.17 (1 May 2026): Oda ses mute aktifken yeni track subscribe olunca
    //   onu da otomatik unsubscribe et (yeni katılan participant'ların sesini de kesmek için).
    this.room.on(lk.RoomEvent.TrackSubscribed, (track: any, publication: any, _participant: any) => {
      if (!this._roomAudioMuted) return;
      // Sadece audio track'lere uygula
      if (track?.kind !== 'audio' && track?.source !== 'microphone') return;
      try {
        if (typeof publication?.setSubscribed === 'function') publication.setSubscribed(false);
        if (typeof track?.setEnabled === 'function') track.setEnabled(false);
        if (typeof track?.setVolume === 'function') track.setVolume(0);
        if (track?.mediaStreamTrack) track.mediaStreamTrack.enabled = false;
      } catch { /* sessizce */ }
    });

    // ★ Faz 3.2 — Voice reaction listener (data channel; audio publish bozulmaz)
    this.room.on(lk.RoomEvent.DataReceived, (payload: Uint8Array, participant: any) => {
      try {
        if (!this.onDataReceivedCb) return;
        const json = new TextDecoder().decode(payload);
        const obj = JSON.parse(json);
        const identity = participant?.identity || '';
        this.onDataReceivedCb(obj, identity);
      } catch { /* malformed payload sessizce atılır */ }
    });

    // ★ 2026-04-25: Connection quality — sadece LOCAL participant için
    this.room.on(lk.RoomEvent.ConnectionQualityChanged, (quality: any, participant: any) => {
      try {
        if (!participant || !this.room?.localParticipant) return;
        if (participant.identity !== this.room.localParticipant.identity) return;
        // LiveKit ConnectionQuality enum: 0=Unknown, 1=Excellent, 2=Good, 3=Poor, 4=Lost
        // Yeni SDK: 'excellent' | 'good' | 'poor' | 'unknown' (string)
        const map: Record<string, 'excellent' | 'good' | 'poor' | 'unknown'> = {
          excellent: 'excellent', good: 'good', poor: 'poor', lost: 'poor', unknown: 'unknown',
          '1': 'excellent', '2': 'good', '3': 'poor', '4': 'poor', '0': 'unknown',
        };
        const key = String(quality).toLowerCase();
        const mapped = map[key] || 'unknown';
        this.onConnectionQualityChange?.(mapped);
      } catch { /* ignore */ }
    });

    events.forEach((evt) => {
      this.room.on(evt, (...args: any[]) => {
        if (evt === lk.RoomEvent.ActiveSpeakersChanged) {
          const speakers = args[0] as any[];
          speakers.forEach((p) => this.onSpeakingChange?.(p.identity, true));
        }

        if (evt === lk.RoomEvent.ConnectionStateChanged) {
          const state = args[0];
          if (state === lk.ConnectionState.Connected) this.onConnectionStateChange?.('connected');
          else if (state === lk.ConnectionState.Disconnected) this.onConnectionStateChange?.('disconnected');
          else if (state === lk.ConnectionState.Reconnecting) this.onConnectionStateChange?.('reconnecting');
        }

        // ★ Katılımcı ayrıldığında callback tetikle
        if (evt === lk.RoomEvent.ParticipantDisconnected) {
          const participant = args[0];
          const identity = participant?.identity || 'unknown';
          if (__DEV__) logger.log(`[LiveKit] ★ ParticipantDisconnected: ${identity}`);
          this.onParticipantDisconnected?.(identity);
        }

        // ★ TrackSubscribed — video/audio track geldiğinde
        if (evt === lk.RoomEvent.TrackSubscribed) {
          const track = args[0];
          const publication = args[1];
          const participant = args[2];
          const kind = track?.kind || publication?.kind;
          if (kind === 'video') {
            if (__DEV__) logger.log(`[LiveKit] ★ TrackSubscribed: VIDEO from ${participant?.identity || 'unknown'}`);
          } else if (kind === 'audio') {
            // ★ 2026-04-20 AUDIO FIX: Uzak audio track'i explicit playback'e al.
            //   React Native LiveKit'te bazı cihazlarda (özellikle Android)
            //   subscribe edilen audio track otomatik play olmuyor; mic UI "açık"
            //   görünüyor ama karşı taraf ses duymuyordu. attach() ve mediaStreamTrack.enabled=true
            //   bunu garanti eder.
            try {
              track?.mediaStreamTrack && (track.mediaStreamTrack.enabled = true);
              if (typeof track?.attach === 'function') track.attach();
              if (typeof track?.start === 'function') track.start();
            } catch (e) {
              if (__DEV__) logger.warn('[LiveKit] audio track attach failed:', e);
            }
            if (__DEV__) logger.log(`[LiveKit] ★ TrackSubscribed: AUDIO attached from ${participant?.identity || 'unknown'}`);
          }
        }

        // ★ LocalTrackPublished — kendi video track'imizi log'la
        if (evt === lk.RoomEvent.LocalTrackPublished) {
          const publication = args[0];
          if (publication?.kind === 'video' || publication?.track?.kind === 'video') {
            if (__DEV__) logger.log(`[LiveKit] ★ LocalTrackPublished: VIDEO track, source: ${publication?.source || 'n/a'}`);
          }
        }

        // Mic/Cam state change callback
        if (evt === lk.RoomEvent.LocalTrackPublished || evt === lk.RoomEvent.LocalTrackUnpublished ||
            evt === lk.RoomEvent.TrackMuted || evt === lk.RoomEvent.TrackUnmuted) {
          this.onTrackStateChange?.(this.isMicrophoneEnabled, this.isCameraEnabled);
        }

        this.emitParticipantUpdate(lk);
      });
    });
  }

  // ─── Participant Update (Throttle — BUG-1 FIX) ────────────
  private _throttleTimer: ReturnType<typeof setTimeout> | null = null;
  private _lastEmitTime = 0;

  private emitParticipantUpdate(lk: any) {
    const now = Date.now();
    const elapsed = now - this._lastEmitTime;

    // Throttle: İlk çağrıda hemen çalıştır, sonra 50ms bekle
    if (elapsed >= 50) {
      // Yeterince zaman geçti — hemen emit et
      this._lastEmitTime = now;
      if (this._throttleTimer) {
        clearTimeout(this._throttleTimer);
        this._throttleTimer = null;
      }
      this._doEmitParticipantUpdate(lk);
    } else if (!this._throttleTimer) {
      // Son emit'ten az zaman geçti — trailing emit planla
      this._throttleTimer = setTimeout(() => {
        this._throttleTimer = null;
        this._lastEmitTime = Date.now();
        this._doEmitParticipantUpdate(lk);
      }, 50 - elapsed);
    }
    // Eğer zaten bir trailing timer varsa — yoksay (throttle)
  }

  private _doEmitParticipantUpdate(lk: any) {
    if (!this.room || !this.onParticipantUpdate) return;
    if (!lk) {
      this.onParticipantUpdate([]);
      return;
    }

    const participants: ParticipantUpdate[] = [];

    const extractVideoTrack = (participant: any) => {
      try {
        if (!participant) return undefined;
        // ★ Yöntem 1: getTrackPublication API'si (lk v2 önerilen)
        const pub = participant.getTrackPublication?.(lk.Track.Source.Camera);
        if (pub && pub.track) return pub.track;
        if (pub && pub.videoTrack) return pub.videoTrack;
        
        // ★ Yöntem 2: videoTrackPublications (camera source filtreli)
        if (participant.videoTrackPublications) {
           const publications = Array.from(participant.videoTrackPublications.values()) as any[];
           for (const p of publications) {
             if (p.track) return p.track;
             if (p.videoTrack) return p.videoTrack;
           }
        }
        // ★ 2026-04-24 FIX: Yöntem 3: Tüm trackPublications'ı tara — bazı LK sürümlerinde
        //   videoTrackPublications getter'ı boş dönebilir ama trackPublications Map'inde
        //   video track bulunur. Source === Camera olmayanları (ScreenShare vb.) atla.
        if (participant.trackPublications) {
          for (const [, p] of participant.trackPublications) {
            if (p?.source === lk.Track.Source.Camera && p?.track) return p.track;
            if (p?.kind === 'video' && p?.source !== lk.Track.Source.ScreenShare && p?.track) return p.track;
          }
        }
      } catch(e) { logger.warn('extractVideoTrack error', e); }
      return undefined;
    };

    const extractScreenShareTrack = (participant: any) => {
      try {
        if (!participant) return undefined;
        const pub = participant.getTrackPublication?.(lk.Track.Source.ScreenShare);
        if (pub && pub.track) return pub.track;
        // Fallback: iterate publications
        if (participant.trackPublications) {
          for (const [, p] of participant.trackPublications) {
            if (p?.source === lk.Track.Source.ScreenShare && p?.track) return p.track;
          }
        }
      } catch(e) { /* silent */ }
      return undefined;
    };

    // ★ 2026-04-30 v85f: Remote mute detection FIX.
    //   LiveKit JS SDK'sında `isMicrophoneEnabled` SADECE localParticipant'ta var;
    //   remote participant'ta `undefined` → `!undefined === true` → tüm remote'lar
    //   her zaman "muted" görünüyordu (mute ikonu var ama ses geliyor — kullanıcı raporu).
    //   Doğrusu: remote'larda audio track publication'ın `isMuted` veya track yokluğuna bak.
    const getMuteState = (participant: any, isLocal: boolean): boolean => {
      if (isLocal) {
        return !participant.isMicrophoneEnabled;
      }
      try {
        // Microphone source publication'ı bul
        const micPub = participant.getTrackPublication?.(lk.Track.Source.Microphone);
        if (micPub) {
          // Publication seviyesinde mute (server-side mute)
          if (micPub.isMuted === true) return true;
          // Track seviyesinde mute (track yayınlanıyor ama susturulmuş)
          if (micPub.track?.isMuted === true) return true;
          // Track abone değilse de muted say (henüz subscribe olmadı veya kapalı)
          if (!micPub.track && !micPub.isSubscribed) return true;
          return false;
        }
        // Fallback: audioTrackPublications map'ini tara
        if (participant.audioTrackPublications) {
          const pubs = Array.from(participant.audioTrackPublications.values()) as any[];
          if (pubs.length === 0) return true; // hiç audio track yok
          for (const pub of pubs) {
            if (pub?.source !== lk.Track.Source.Microphone) continue;
            if (pub.isMuted === true) return true;
            if (pub.track?.isMuted === true) return true;
            return false;
          }
          return true; // microphone source'lu pub bulunamadı
        }
      } catch { /* silent */ }
      // En son fallback — undefined ise muted KABUL ETME (false döndür) ki yanlış kırmızı icon olmasın.
      return false;
    };

    // Local
    if (this.room.localParticipant) {
      const screenTrack = extractScreenShareTrack(this.room.localParticipant) || this.screenShareTrack;
      participants.push({
        identity: this.room.localParticipant.identity,
        isSpeaking: this.room.localParticipant.isSpeaking,
        isMuted: getMuteState(this.room.localParticipant, true),
        audioLevel: this.room.localParticipant.audioLevel,
        isCameraEnabled: this.room.localParticipant.isCameraEnabled,
        videoTrack: extractVideoTrack(this.room.localParticipant),
        isScreenShareEnabled: !!screenTrack,
        screenShareTrack: screenTrack,
      });
    }

    // Remote
    this.room.remoteParticipants.forEach((p: any) => {
      const screenTrack = extractScreenShareTrack(p);
      participants.push({
        identity: p.identity,
        isSpeaking: p.isSpeaking,
        isMuted: getMuteState(p, false),
        audioLevel: p.audioLevel,
        isCameraEnabled: p.isCameraEnabled,
        videoTrack: extractVideoTrack(p),
        isScreenShareEnabled: !!screenTrack,
        screenShareTrack: screenTrack,
      });
    });

    this.onParticipantUpdate(participants);
  }
}

export const liveKitService = new LiveKitService();
