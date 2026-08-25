// LiveKit Sesli/GÃ¶rÃ¼ntÃ¼lÃ¼ Sohbet Servisi
// Lazy-load (getLK) mekanizmasÄ± ile WebRTC uyumsuz cihazlarda Ã§Ã¶kme Ã¶nlenir

import { NativeModules, Platform } from 'react-native';
import { supabase, SUPABASE_ANON_KEY } from '../constants/supabase';
import { LIVEKIT_URL, LIVEKIT_TOKEN_ENDPOINT } from '../constants/livekit';
import { logger } from '../utils/logger';
import { i18n } from './i18n';
import { reportNonFatal } from './crashReporting';

let _lk: any = null;
let _globalsRegistered = false;
let _audioSessionModule: any = null;

// â 2026-04-27: Android foreground service kÃ¶prÃ¼sÃ¼.
// Uygulama arka plana atÄ±ldÄ±ÄÄ±nda WebRTC baÄlantÄ±sÄ± OS tarafÄ±ndan kesilmesin diye
// odadayken bildirim olarak Ã§alÄ±ÅÄ±r. JS'ten start/stop edilir.
// â v1.7.13.27 (19 May 2026): Battery optimization muafiyeti API'leri eklendi.
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
  catch { /* sessizce geÃ§ */ }
}

// â v1.7.13.27: Pil iyileÅtirme muafiyeti kontrolÃ¼ ve istek.
//   Doze mode WebSocket suspend â oda sessizleÅmesi/kopmasÄ± nedenidir.
//   Foreground service + WAKE_LOCK tek baÅÄ±na yetmiyor; Android 12+ OEM
//   katmanlarÄ± (Samsung One UI, Xiaomi MIUI vb.) muafiyet olmadan
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
      // â registerGlobals: WebRTC polyfill'lerini React Native ortamÄ±na yÃ¼kler
      // Bu Ã§aÄrÄ± olmadan livekit-client "WebRTC isn't detected" hatasÄ± verir
      if (!_globalsRegistered) {
        try {
          const rnLiveKit = require('@livekit/react-native');
          // â v1.7.13.143: Android native audio dispatcher baÅlatma â
          //   setup() Ã§aÄrÄ±lmadan registerGlobals() "audioRecordSamplesDispatcher
          //   is not initialized" crash'ine neden oluyor. setup() Application.onCreate
          //   yerine burada lazy Ã§aÄrÄ±lÄ±r Ã§Ã¼nkÃ¼ Expo managed workflow'da native koda
          //   dokunmuyoruz.
          if (typeof rnLiveKit.setupCallService === 'function') {
            rnLiveKit.setupCallService();
          } else if (typeof rnLiveKit.setup === 'function') {
            rnLiveKit.setup();
          }
          rnLiveKit.registerGlobals();
          _globalsRegistered = true;
          // â AudioSession modÃ¼lÃ¼nÃ¼ sakla â ses iÃ§in kritik
          if (rnLiveKit.AudioSession) {
            _audioSessionModule = rnLiveKit.AudioSession;
            if (__DEV__) logger.log('[LiveKit] AudioSession modÃ¼lÃ¼ hazÄ±r');
          }
          if (__DEV__) logger.log('[LiveKit] setup + registerGlobals baÅarÄ±lÄ±');
        } catch (rgErr) {
          if (__DEV__) logger.warn('[LiveKit] registerGlobals yÃ¼klenemedi (native modÃ¼l eksik olabilir):', rgErr);
        }
      }
      _lk = require('livekit-client');
      if (__DEV__) logger.log('[LiveKit] Client lazily loaded');
    } catch (e) {
      if (__DEV__) logger.warn('[LiveKit] livekit-client yÃ¼klenemedi â mock modda Ã§alÄ±Åacak:', e);
      return null;
    }
  }
  return _lk;
}

// âââ Token Servisi ââââââââââââââââââââââââââââââââââââââââââ
async function fetchToken(roomId: string, userId: string, displayName: string): Promise<string> {
  // â Audit fix: 10s timeout â kÃ¶tÃ¼ aÄda hung request UI'Ä± dondurmuyor
  const { fetchWithTimeout } = await import('../utils/fetchTimeout');
  
  let response: Response;
  try {
    // â 2026-04-30 FIX: Firebase JWT'yi custom header'a taÅÄ± â Supabase API Gateway
    //   asymmetric JWT (RS256) kabul ETMÄ°YOR ve 401 UNAUTHORIZED_ASYMMETRIC_JWT dÃ¶nÃ¼yor.
    //   Authorization header'Ä±nda HER ZAMAN Supabase Anon Key gÃ¶nder (Gateway'den geÃ§sin),
    //   Firebase JWT'yi X-Firebase-Auth header'Ä±nda gÃ¶nder (Edge Function RLS context iÃ§in kullanÄ±r).
    let firebaseJwt: string | null = null;
    try {
      const { auth: firebaseAuth } = require('../constants/firebase');
      const fbUser = firebaseAuth.currentUser;
      if (fbUser) firebaseJwt = await fbUser.getIdToken(false);
    } catch { /* Firebase unavailable â anon key ile devam */ }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
    };
    // Firebase JWT varsa custom header'da gÃ¶nder â Edge Function bunu okuyup RLS context oluÅturur
    if (firebaseJwt) {
      headers['X-Firebase-Auth'] = firebaseJwt;
    }

    response = await fetchWithTimeout(LIVEKIT_TOKEN_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({ roomId, displayName, userId }),
    }, 10_000);
  } catch (networkErr: any) {
    // â Network hatasÄ± (DNS, timeout, offline) â detaylÄ± log
    if (__DEV__) logger.warn('[LiveKit] Token fetch network error:', networkErr?.message);
    throw new Error(`AÄ hatasÄ±: ${networkErr?.message || i18n.t('auto.livekit.009')}`);
  }

  if (!response.ok) {
    let errBody: any = {};
    try { errBody = await response.json(); } catch { /* non-JSON response */ }
    const errMsg = errBody?.error || `HTTP ${response.status}`;
    
    if (__DEV__) {
      logger.warn(`[LiveKit] Token fetch FAILED â status=${response.status}, error="${errMsg}", roomId=${roomId}, userId=${userId}`);
    }
    
    // â 2026-04-30: DetaylÄ± hata mesajlarÄ± â UI'da anlamlÄ± feedback
    if (response.status === 403) {
      throw new Error(errMsg); // "Oda aktif deÄil", "Bu odadan yasaklandÄ±nÄ±z" vb.
    } else if (response.status === 404) {
      throw new Error(i18n.t('auto.livekit.008'));
    } else if (response.status === 401) {
      throw new Error(i18n.t('auto.livekit.007'));
    } else {
      throw new Error(errMsg);
    }
  }

  const data = await response.json();
  if (__DEV__) logger.log(`[LiveKit] Token alÄ±ndÄ± â roomId=${roomId}, role=${data.role || 'unknown'}`);
  return data.token;
}

// âââ Types ââââââââââââââââââââââââââââââââââââââââââââââââââ
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

// âââ Ana SÄ±nÄ±f ââââââââââââââââââââââââââââââââââââââââââââââ
export class LiveKitService {
  private room: any = null; // livekit-client Room instance
  private currentRoomId: string | null = null; // Hangi oda baÄlÄ±, minimize-restore iÃ§in
  private onParticipantUpdate?: (participants: ParticipantUpdate[]) => void;
  private onConnectionStateChange?: (state: RoomConnectionState) => void;
  private onSpeakingChange?: (identity: string, isSpeaking: boolean) => void;
  private onTrackStateChange?: (micEnabled: boolean, camEnabled: boolean) => void;
  private onParticipantDisconnected?: (identity: string) => void; // â KarÅÄ± taraf ayrÄ±ldÄ±ÄÄ±nda
  // â K7: Mic/cam permission denied callback â UI "Open Settings" alert'Ä± gÃ¶sterebilsin.
  private onPermissionDenied?: (device: 'microphone' | 'camera') => void;
  // â 2026-04-25: BaÄlantÄ± kalitesi callback â 'excellent' | 'good' | 'poor' | 'unknown'
  private onConnectionQualityChange?: (quality: 'excellent' | 'good' | 'poor' | 'unknown') => void;
  // â Tier bazlÄ± kalite ayarlarÄ±
  private audioPreset: { sampleRate: number; channelCount: number } = { sampleRate: 48000, channelCount: 1 };
  private videoMaxRes: number = 720;
  private screenShareTrack: any = null; // Manual screen share track reference
  private screenShareStream: any = null; // Native MediaStream reference

  /**
   * â K7: Hata mesajÄ±ndan mic/cam permission denied olup olmadÄ±ÄÄ±nÄ± Ã§Ä±kar.
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

  // â Faz 3.4 â Mic processing toggles (kullanÄ±cÄ± ayarlardan deÄiÅtirebilir)
  // Default'lar `true`; SettingsService'ten okunup `setAudioProcessing()` ile gÃ¼ncellenir.
  private audioProcessing: { echoCancellation: boolean; noiseSuppression: boolean; autoGainControl: boolean } = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };

  /** Settings ekranÄ±ndan mic ayarlarÄ± deÄiÅince Ã§aÄrÄ±lÄ±r. Sonraki publish iÃ§in aktif. */
  setAudioProcessing(opts: { echoCancellation?: boolean; noiseSuppression?: boolean; autoGainControl?: boolean }): void {
    if (opts.echoCancellation !== undefined) this.audioProcessing.echoCancellation = opts.echoCancellation;
    if (opts.noiseSuppression !== undefined) this.audioProcessing.noiseSuppression = opts.noiseSuppression;
    if (opts.autoGainControl !== undefined) this.audioProcessing.autoGainControl = opts.autoGainControl;
  }

  /** Tier bazlÄ± mikrofon ses ayarlarÄ±nÄ± dÃ¶ndÃ¼r */
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
      onParticipantDisconnected?: (identity: string) => void; // â KarÅÄ± taraf ayrÄ±ldÄ±ÄÄ±nda
      onPermissionDenied?: (device: 'microphone' | 'camera') => void;
      // â 2026-04-25: Local participant connection quality
      onConnectionQualityChange?: (quality: 'excellent' | 'good' | 'poor' | 'unknown') => void;
    },
    qualityPreset?: { audioSampleRate?: number; audioChannels?: number; videoMaxRes?: number }
  ): Promise<boolean> {
    const lk = getLK();
    if (!lk) {
      if (__DEV__) logger.warn('[LiveKit] ModÃ¼l yok, sahte (mock) moda geÃ§iliyor.');
      callbacks.onConnectionStateChange?.('connected'); // Mock devrede
      return false; // GerÃ§ek baÄlantÄ± kurulamadÄ±
    }

    // â 2026-04-20 Minimize-restore: aynÄ± odaya zaten baÄlÄ±ysak yeniden baÄlanma,
    // callbacks'i overwrite et + mevcut state'i yeni dinleyiciye yay.
    // â 2026-04-27: Sadece 'connected' veya 'reconnecting' iken reattach et;
    // 'disconnected' kaldÄ±ysa (Doze/arka plan kopmasÄ±) mevcut room nesnesi kullanÄ±lamaz â
    // tam baÄlantÄ±ya dÃ¼Å ki "BaÄlantÄ± kurulamadÄ±" ekranÄ± yerine yeniden baÄlanabilelim.
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
        if (__DEV__) logger.log(`[LiveKit] Reattach â ${roomId} iÃ§in mevcut baÄlantÄ± kullanÄ±ldÄ± (state=${rs})`);
        return true;
      }
      if (__DEV__) logger.log(`[LiveKit] Stale room (state=${rs}) â full reconnect zorlanÄ±yor`);
    }

    if (this.room) {
      await this.disconnect();
    }

    // â 2026-04-27: Arka plan Ã¶n plan servisi â odaya baÄlanmadan ÃNCE baÅlat
    // (Android 12+ FOREGROUND_SERVICE_MICROPHONE foreground'da iken baÅlatÄ±lmalÄ±).
    await startBgService();

    this.onParticipantUpdate = callbacks.onParticipantUpdate;
    this.onConnectionStateChange = callbacks.onConnectionStateChange;
    this.onSpeakingChange = callbacks.onSpeakingChange;
    this.onTrackStateChange = callbacks.onTrackStateChange;
    this.onParticipantDisconnected = callbacks.onParticipantDisconnected;
    this.onPermissionDenied = callbacks.onPermissionDenied;
    this.onConnectionQualityChange = callbacks.onConnectionQualityChange;

    // â Tier bazlÄ± kalite ayarlarÄ± uygula
    if (qualityPreset) {
      this.audioPreset = {
        sampleRate: qualityPreset.audioSampleRate || 48000,
        channelCount: qualityPreset.audioChannels || 1,
      };
      this.videoMaxRes = qualityPreset.videoMaxRes || 720;
    }

    // â Retry mantÄ±ÄÄ±: 3 deneme, 2sn aralÄ±k
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        this.onConnectionStateChange?.('connecting');

        // â KRITIS: React Native'de ses iÃ§in AudioSession baÅlatmak ZORUNLU
        if (_audioSessionModule && attempt === 1) {
          try {
            await _audioSessionModule.startAudioSession();
            if (__DEV__) logger.log('[LiveKit] AudioSession baÅlatÄ±ldÄ±');
          } catch (audioErr) {
            if (__DEV__) logger.warn('[LiveKit] AudioSession baÅlatÄ±lamadÄ±:', audioErr);
          }
        }

        // Token alma: 35sn timeout (Supabase edge cold start iÃ§in â bazen 9-15sn sÃ¼rÃ¼yor)
        const token = await Promise.race([
          fetchToken(roomId, userId, displayName),
          new Promise<string>((_, reject) => setTimeout(() => reject(new Error('Token timeout (35s)')), 35000)),
        ]);

        // Her baÄlantÄ± denemesinde temiz room oluÅtur
        if (this.room) {
          try { if (this.room.state === 'connected' || this.room.state === 'reconnecting') this.room.disconnect(); } catch(_) {}
          this.room = null;
        }
        this.room = new lk.Room({
          adaptiveStream: true,
          dynacast: true,
          // â Ping/pong sÃ¼releri artÄ±rÄ±ldÄ± â emÃ¼latÃ¶r/yavaÅ aÄ toleransÄ±
          pingTimeout: 15000,   // ping gÃ¶nderme aralÄ±ÄÄ± (ms)
          pongTimeout: 60000,   // pong bekleme sÃ¼resi (ms)
          websocketTimeout: 30000,
          // â Otomatik yeniden baÄlanma â baÄlantÄ± kesilirse LiveKit kendisi deneyecek
          reconnectPolicy: {
            nextRetryDelayInMs: (context: any) => {
              const delay = Math.min(1000 * Math.pow(2, context?.retryCount || 0), 10000);
              if (__DEV__) logger.log(`[LiveKit] Reconnect attempt ${context?.retryCount || 0}, delay: ${delay}ms`);
              return delay;
            },
          },
        });
        this.setupEventListeners(lk);

        // BaÄlantÄ±: 15sn timeout
        await Promise.race([
          this.room.connect(LIVEKIT_URL, token),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Connect timeout (15s)')), 15000)),
        ]);

        this.currentRoomId = roomId;
        this.onConnectionStateChange?.('connected');

        // â 2026-04-20 LATE-JOINER FIX: Connect sonrasÄ± mevcut remoteParticipant'larÄ±n
        //   track'lerini explicit subscribe et. LiveKit default olarak autoSubscribe=true
        //   olsa da bazÄ± sÃ¼rÃ¼mlerde connect Ã¶ncesi publish edilmiÅ kamera track'leri
        //   late-joiner'a setSubscribed(true) Ã§aÄrÄ±lmadan ulaÅmÄ±yor â video "aÃ§Ä±k" gÃ¶rÃ¼nÃ¼r
        //   ama karÅÄ± taraf boÅ avatar gÃ¶rÃ¼r.
        try {
          const iter = (c: any, cb: (v: any) => void) => {
            if (!c) return;
            if (typeof c.forEach === 'function') c.forEach((v: any) => cb(v));
            else if (Array.isArray(c)) c.forEach(cb);
          };
          iter(this.room?.remoteParticipants, (participant: any) => {
            // â 2026-04-20 FIX: Participant disconnect olmuÅ olabilir (identity yok veya
            //   connectionState 'disconnected'). setSubscribed Ã§aÄrÄ±sÄ± SDK'da "Tried to
            //   add a track for a participant, that's not present" hatasÄ± atÄ±yor.
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
        // â 2026-04-24 FIX: Late-joiner video â ilk emit'te track'ler henÃ¼z subscribe
        //   olmamÄ±Å olabilir. 500ms ve 1500ms sonra tekrar emit ederek subscribe tamamlanmÄ±Å
        //   track'lerin UI'a yansÄ±masÄ±nÄ± garanti ediyoruz.
        setTimeout(() => this.emitParticipantUpdate(lk), 500);
        setTimeout(() => this.emitParticipantUpdate(lk), 1500);
        if (__DEV__) logger.log(`[LiveKit] BaÄlantÄ± baÅarÄ±lÄ± (deneme ${attempt}/${MAX_RETRIES})`);
        return true;
      } catch (err: any) {
        if (__DEV__) logger.warn(`[LiveKit] BaÄlantÄ± HatasÄ± (deneme ${attempt}/${MAX_RETRIES}):`, err?.message || err);
        
        if (attempt < MAX_RETRIES) {
          // Tekrar denemeden Ã¶nce room'u temizle
          if (this.room) {
            try { if (this.room.state === 'connected' || this.room.state === 'reconnecting') this.room.disconnect(); } catch(_) {}
            this.room = null;
          }
          await new Promise(r => setTimeout(r, 2000)); // 2sn bekle
          continue;
        }
        
        // Son deneme de başarısız. Kimlik/token göndermeden Crashlytics'e kaydet.
        reportNonFatal(err, 'livekit_connection_failed', {
          attempt,
          room_id_suffix: roomId.slice(-8),
          platform: Platform.OS,
          endpoint: 'livekit_cloud',
        });

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

  // âââ Oda Sesini Kapat/AÃ§ ââââââââââââââââââââââââââââââââââ
  // â v92.17 (1 May 2026): mediaStreamTrack.enabled JS-side flag â RN native
  //   audio player'Ä± durdurmuyor, ses kullanÄ±cÄ±nÄ±n kulaÄÄ±na geliyordu (sahnedeki
  //   konuÅmacÄ± kendi mikrofonunu aÃ§Ä±k tutarken diÄer sesleri kÄ±samadÄ±ÄÄ± ÅikÃ¢yeti).
  //   ÃÃZÃM: setSubscribed(false) â sunucuya "bu track'i bana gÃ¶nderme" mesajÄ±,
  //   audio akÄ±ÅÄ± network seviyesinde durur. Yeni katÄ±lan participant'lar iÃ§in
  //   _roomAudioMuted flag tutulur, TrackSubscribed event'inde de uygulanÄ±r.
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
        // 1. setSubscribed â en kesin: sunucu tarafÄ± unsubscribe, network'te ses akmaz
        if (typeof pub?.setSubscribed === 'function') {
          try { pub.setSubscribed(!mute); } catch {}
        }
        // 2. setEnabled fallback (bazÄ± LiveKit RN versiyonlarÄ±)
        if (typeof pub?.track?.setEnabled === 'function') {
          try { pub.track.setEnabled(!mute); } catch {}
        }
        // 3. Volume 0/1 (bazÄ± SDK'larda var)
        if (pub?.track && typeof (pub.track as any).setVolume === 'function') {
          try { (pub.track as any).setVolume(mute ? 0 : 1); } catch {}
        }
        // 4. Last resort â mediaStreamTrack.enabled (etkisiz olabilir ama zarar vermez)
        if (pub?.track?.mediaStreamTrack) {
          try { pub.track.mediaStreamTrack.enabled = !mute; } catch {}
        }
      });
    });
  }

  /** Mevcut roomAudioMuted state'ini dÃ¶ner â yeni track subscribe olunca kullanÄ±lÄ±r */
  isRoomAudioMuted(): boolean {
    return this._roomAudioMuted;
  }

  // âââ BaÄlantÄ±yÄ± Kes ââââââââââââââââââââââââââââââââââââââ
  /**
   * â Faz 3.2 â Voice reaction / lightweight data broadcast.
   * Bu metod mevcut audio publish/subscribe akÄ±ÅÄ±na TEMAS ETMEZ.
   * LiveKit data channel'Ä± her room connection'da otomatik aÃ§Ä±ktÄ±r,
   * burada sadece JSON payload gÃ¶ndeririz.
   *
   * NOT: room null/disconnected ise sessiz fail â voice reaction
   * kritik akÄ±Å deÄil, ses iletimini engellememeli.
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
   * â Faz 3.2 â Data event subscriber. Bir kez kayÄ±t edilir, baÄlantÄ±
   * yaÅam dÃ¶ngÃ¼sÃ¼ boyunca aktif. unsubscribe iÃ§in connect tarafÄ±ndaki
   * room.removeAllListeners patterni kullanÄ±lÄ±r (mevcut akÄ±Å).
   */
  setOnDataReceived(cb?: (payload: Record<string, any>, fromIdentity: string) => void): void {
    this.onDataReceivedCb = cb;
  }
  private onDataReceivedCb?: (payload: Record<string, any>, fromIdentity: string) => void;

  async disconnect(): Promise<void> {
    if (__DEV__) {
      if (__DEV__) console.log('[LiveKit] DISCONNECT ÃAÄRILDI');
      if (__DEV__) console.log('[LiveKit] Stack:', new Error().stack?.split('\n').slice(1, 5).join('\n'));
    }
    // â Ekran paylaÅÄ±mÄ± aÃ§Ä±ksa Ã¶nce temizle â referans sÄ±zÄ±ntÄ±sÄ± Ã¶nleme
    if (this.screenShareTrack || this.screenShareStream) {
      try { await this.stopScreenShare(); } catch { /* silent */ }
    }
    if (this.room) {
      try {
        if (this.room.state === 'connected' || this.room.state === 'reconnecting') {
          await this.room.disconnect();
        }
      } catch (e) {
        if (__DEV__) logger.log('[LiveKit] Disconnect sÄ±rasÄ±nda beklenen hata:', (e as any)?.message);
      }
      this.room = null;
      this.currentRoomId = null;
    }
    // â AudioSession Ä± kapat â kaynaklarÄ± serbest bÄ±rak
    if (_audioSessionModule) {
      try {
        await _audioSessionModule.stopAudioSession();
        if (__DEV__) logger.log('[LiveKit] AudioSession durduruldu');
      } catch (e) { /* sessizce geÃ§ */ }
    }
    // â 2026-04-27: Arka plan servisi durdur â bildirim kaybolsun, batarya tÃ¼ketmesin.
    await stopBgService();
    this.onConnectionStateChange?.('disconnected');
    this.onTrackStateChange?.(false, false);
    this.emitParticipantUpdate(getLK());
  }

  // âââ Mikrofon AÃ§/Kapat ââââââââââââââââââââââââââââââââââ
  async toggleMicrophone(): Promise<boolean> {
    if (!this.room?.localParticipant) {
      if (__DEV__) logger.warn('[LiveKit] toggleMic: room veya localParticipant yok');
      return false;
    }
    if (this.room.state !== 'connected') {
      if (__DEV__) logger.warn('[LiveKit] toggleMic: Room baÄlÄ± deÄil, state:', this.room.state);
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
      if (__DEV__) logger.warn('[LiveKit] Mikrofon toggle hatasÄ±:', (e as any)?.message);
      // â K7: Permission hatasÄ± â UI'ya bildir
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

  // âââ Mikrofon DoÄrudan AÃ§ (otomatik sahneye Ã§Ä±kma iÃ§in) ââ
  async enableMicrophone(): Promise<boolean> {
    if (!this.room?.localParticipant) return false;
    if (this.room.state !== 'connected') return false;
    if (this.room.localParticipant.isMicrophoneEnabled) return true; // zaten aÃ§Ä±k
    try {
      await Promise.race([
        this.room.localParticipant.setMicrophoneEnabled(true, this.getAudioConstraints()),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Mic enable timeout (5s)')), 5000)),
      ]);
    } catch (e) {
      if (__DEV__) logger.warn('[LiveKit] Mikrofon aÃ§ma hatasÄ±:', (e as any)?.message);
      if (this._isPermissionError(e)) {
        this.onPermissionDenied?.('microphone');
      }
      return false;
    }
    this.onTrackStateChange?.(true, this.isCameraEnabled);
    this.emitParticipantUpdate(getLK());
    return true;
  }

  // âââ Mikrofon Zorla Kapat (moderasyon: mute/demote iÃ§in) ââ
  async disableMicrophone(): Promise<void> {
    if (!this.room?.localParticipant) return;
    if (!this.room.localParticipant.isMicrophoneEnabled) {
      // Zaten kapalÄ± â sadece state gÃ¼ncelle
      this.onTrackStateChange?.(false, this.isCameraEnabled);
      return;
    }
    try {
      await Promise.race([
        this.room.localParticipant.setMicrophoneEnabled(false),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Mic disable timeout')), 5000)),
      ]);
      if (__DEV__) logger.log('[LiveKit] Mikrofon ZORLA kapatÄ±ldÄ± (moderasyon)');
    } catch (e) {
      if (__DEV__) logger.warn('[LiveKit] Mikrofon zorla kapatma hatasÄ±:', (e as any)?.message);
    }
    this.onTrackStateChange?.(false, this.isCameraEnabled);
    this.emitParticipantUpdate(getLK());
  }

  // âââ Kamera Zorla Kapat (moderasyon: mute/demote iÃ§in) ââ
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
      if (__DEV__) logger.log('[LiveKit] Kamera ZORLA kapatÄ±ldÄ± (moderasyon)');
    } catch (e) {
      if (__DEV__) logger.warn('[LiveKit] Kamera zorla kapatma hatasÄ±:', (e as any)?.message);
    }
    this.onTrackStateChange?.(this.isMicrophoneEnabled, false);
    this.emitParticipantUpdate(getLK());
  }

  async enableCamera(): Promise<void> {
    if (!this.room?.localParticipant) return;
    if (this.room.state !== 'connected') return;
    if (this.room.localParticipant.isCameraEnabled) return;
    try {
      // â v1.7.13.142: videoMaxRes enforcement â tier bazlÄ± Ã§Ã¶zÃ¼nÃ¼rlÃ¼k limiti
      const videoConstraints = this.videoMaxRes ? {
        resolution: {
          width: { ideal: this.videoMaxRes === 1080 ? 1920 : 1280 },
          height: { ideal: this.videoMaxRes },
        },
        facingMode: this._isFrontCamera ? 'user' : 'environment',
      } : { facingMode: this._isFrontCamera ? 'user' : 'environment' };
      await Promise.race([
        this.room.localParticipant.setCameraEnabled(true, videoConstraints),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Cam enable timeout')), 5000)),
      ]);
      if (__DEV__) logger.log('[LiveKit] Kamera yeniden aÃ§Ä±ldÄ± â', this._isFrontCamera ? 'Ã¶n' : 'arka');
    } catch (e) {
      if (__DEV__) logger.warn('[LiveKit] Kamera aÃ§ma hatasÄ±:', (e as any)?.message);
      if (this._isPermissionError(e)) {
        this.onPermissionDenied?.('camera');
      }
    }
    this.onTrackStateChange?.(this.isMicrophoneEnabled, true);
    this.emitParticipantUpdate(getLK());
  }

  /**
   * Mikrofon modunu deÄiÅtir: 'normal' (konuÅma) veya 'music' (mÃ¼zik yayÄ±nÄ±)
   */
  async setMicMode(mode: 'normal' | 'music'): Promise<void> {
    if (!this.room?.localParticipant) return;

    const isCurrentlyEnabled = this.room.localParticipant.isMicrophoneEnabled;
    
    if (isCurrentlyEnabled) {
      await this.room.localParticipant.setMicrophoneEnabled(false);
    }

    const audioOptions = mode === 'music'
      ? {
          // Music modunda processing kapalÄ± kalÄ±r â mÃ¼zik kalitesi iÃ§in zorunlu
          noiseSuppression: false,
          echoCancellation: false,
          autoGainControl: false,
          channelCount: 2,
          sampleRate: 48000,
          sampleSize: 16,
        }
      : {
          // Voice modunda kullanÄ±cÄ±nÄ±n settings'teki tercihi geÃ§erli
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
        if (__DEV__) logger.log(`[LiveKit] Mikrofon modu deÄiÅti: ${mode}`, audioOptions);
      } catch (e) {
        if (__DEV__) logger.warn('[LiveKit] Mic mode deÄiÅtirme hatasÄ±:', e);
        await this.room.localParticipant.setMicrophoneEnabled(true);
      }
    }

    this.emitParticipantUpdate(getLK());
  }

  // âââ Kamera AÃ§/Kapat ââââââââââââââââââââââââââââââââââââââ
  async toggleCamera(): Promise<boolean> {
    if (!this.room?.localParticipant) return false;
    if (this.room.state !== 'connected') return false;
    const enabled = this.room.localParticipant.isCameraEnabled;
    try {
      // â v1.7.13.142: videoMaxRes enforcement â tier bazlÄ± Ã§Ã¶zÃ¼nÃ¼rlÃ¼k limiti
      const videoConstraints = !enabled && this.videoMaxRes ? {
        resolution: {
          width: { ideal: this.videoMaxRes === 1080 ? 1920 : 1280 },
          height: { ideal: this.videoMaxRes },
        },
      } : undefined;
      await Promise.race([
        this.room.localParticipant.setCameraEnabled(!enabled, videoConstraints),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Camera timeout (5s)')), 5000)),
      ]);
    } catch (e) {
      if (__DEV__) logger.warn('[LiveKit] Kamera toggle hatasÄ±:', (e as any)?.message);
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

  // âââ Kamera Ãn/Arka Ãevirme (Flip) ââââââââââââââââââââââ
  private _isFrontCamera = true;

  async flipCamera(): Promise<void> {
    if (!this.room?.localParticipant) return;
    if (!this.room.localParticipant.isCameraEnabled) return;
    
    const lp = this.room.localParticipant;
    const newFacing = this._isFrontCamera ? 'environment' : 'user';
    
    try {
      // â Track'i bul
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

      // YÃ¶ntem 1: restartTrack â track'i yeni facingMode ile yeniden oluÅturur
      if (videoTrack && typeof videoTrack.restartTrack === 'function') {
        if (__DEV__) logger.log('[LiveKit] flipCamera: restartTrack â', newFacing);
        await videoTrack.restartTrack({ facingMode: newFacing });
        this._isFrontCamera = !this._isFrontCamera;
        if (__DEV__) logger.log('[LiveKit] flipCamera baÅarÄ±lÄ± (restartTrack) â', this._isFrontCamera ? 'Ã¶n' : 'arka');
        this.emitParticipantUpdate(getLK());
        return;
      }
      
      // YÃ¶ntem 2: unpublish + yeni track publish
      if (__DEV__) logger.log('[LiveKit] flipCamera: unpublish + republish â', newFacing);
      if (videoTrack) {
        await lp.unpublishTrack(videoTrack);
      }
      this._isFrontCamera = !this._isFrontCamera;
      await new Promise(r => setTimeout(r, 200));
      await lp.setCameraEnabled(true, { facingMode: newFacing });
      
      if (__DEV__) logger.log('[LiveKit] flipCamera baÅarÄ±lÄ± (republish) â', this._isFrontCamera ? 'Ã¶n' : 'arka');
      this.onTrackStateChange?.(this.isMicrophoneEnabled, true);
      this.emitParticipantUpdate(getLK());
    } catch (e) {
      if (__DEV__) logger.warn('[LiveKit] Kamera Ã§evirme hatasÄ±:', (e as any)?.message);
    }
  }

  get isCameraEnabled(): boolean {
    return this.room?.localParticipant?.isCameraEnabled ?? false;
  }

  get isMicrophoneEnabled(): boolean {
    return this.room?.localParticipant?.isMicrophoneEnabled ?? false;
  }

  // â 2026-04-20: Minimize-restore state seed iÃ§in â yeni mount'ta "disconnected"
  // baÅlamamasÄ± iÃ§in useLiveKit bunu kullanÄ±r. currentRoomId aynÄ± VE room instance
  // varsa baÄlÄ± kabul edilir (LiveKit native state transient olabilir; bizim
  // bilinÃ§li disconnect Ã§aÄrÄ±mÄ±z olmadÄ±ÄÄ± sÃ¼rece baÄlÄ±yÄ±z).
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
        if (__DEV__) logger.log('[LiveKit] Ekran paylaÅÄ±mÄ± DURDURULUYOR');
        await this.stopScreenShare();
        if (__DEV__) logger.log('[LiveKit] Ekran paylaÅÄ±mÄ± DURDU');
      } else {
        // BAÅLAT â React Native native API kullan
        if (__DEV__) logger.log('[LiveKit] Ekran paylaÅÄ±mÄ± BAÅLATIYOR (native)');

        // YÃ¶ntem 1: LiveKit'in kendi setScreenShareEnabled API'si (Ã¶nerilen)
        if (typeof this.room.localParticipant.setScreenShareEnabled === 'function') {
          if (__DEV__) logger.log('[LiveKit] setScreenShareEnabled kullanÄ±lÄ±yor');
          await Promise.race([
            this.room.localParticipant.setScreenShareEnabled(true),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error(i18n.t('auto.livekit.004'))), 15000)),
          ]);
          // Track referansÄ±nÄ± bul ve sakla
          const LK = getLK();
          if (LK && this.room.localParticipant.trackPublications) {
            for (const [, pub] of this.room.localParticipant.trackPublications) {
              if (pub?.source === LK.Track.Source.ScreenShare && pub?.track) {
                this.screenShareTrack = pub.track;
                break;
              }
            }
          }
          if (__DEV__) logger.log('[LiveKit] Ekran paylaÅÄ±mÄ± BAÅLADI (native)');
        }
        // YÃ¶ntem 2: Web fallback (getDisplayMedia)
        else if (typeof navigator !== 'undefined' && navigator?.mediaDevices?.getDisplayMedia) {
          if (__DEV__) logger.log('[LiveKit] getDisplayMedia fallback kullanÄ±lÄ±yor');
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
          if (__DEV__) logger.log('[LiveKit] Ekran paylaÅÄ±mÄ± BAÅLADI (web fallback)');
        } else {
          throw new Error(i18n.t('auto.livekit.001'));
        }
      }
    } catch (e: any) {
      if (__DEV__) logger.warn('[LiveKit] Ekran paylaÅÄ±mÄ± hatasÄ±:', e?.message, e?.stack?.substring(0, 300));
      throw e;
    }
    this.emitParticipantUpdate(getLK());
    return !isSharing;
  }

  private async stopScreenShare(): Promise<void> {
    try {
      // YÃ¶ntem 1: Native API ile kapat (Ã¶nerilen â foreground service'i de kapatÄ±r)
      if (this.room?.localParticipant && typeof this.room.localParticipant.setScreenShareEnabled === 'function') {
        try {
          await this.room.localParticipant.setScreenShareEnabled(false);
          if (__DEV__) logger.log('[LiveKit] Ekran paylaÅÄ±mÄ± native API ile durduruldu');
        } catch (e) {
          if (__DEV__) logger.warn('[LiveKit] Native stop hatasÄ±:', (e as any)?.message);
        }
      }
      // YÃ¶ntem 2: Manuel unpublish (fallback)
      if (this.screenShareTrack && this.room?.localParticipant) {
        try {
          await this.room.localParticipant.unpublishTrack(this.screenShareTrack);
        } catch (e) {
          if (__DEV__) logger.warn('[LiveKit] unpublishTrack hatasÄ±:', (e as any)?.message);
        }
      }
      // YÃ¶ntem 3: TÃ¼m screen share publication'larÄ±nÄ± bul ve kaldÄ±r
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
          if (__DEV__) logger.warn('[LiveKit] fallback unpublish hatasÄ±:', (e as any)?.message);
        }
      }
      // YÃ¶ntem 4: Web stream track'lerini durdur
      if (this.screenShareStream) {
        try {
          const tracks = this.screenShareStream.getTracks?.();
          if (tracks) {
            for (const t of tracks) { t.stop?.(); }
          }
        } catch (e) {
          if (__DEV__) logger.warn('[LiveKit] native track stop hatasÄ±:', (e as any)?.message);
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

  // âââ Event Listeners ââââââââââââââââââââââââââââââââââââââ
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
      lk.RoomEvent.TrackPublished,       // â 2026-04-24 FIX: Remote participant track publish â late-joiner video fix
      lk.RoomEvent.TrackUnpublished,     // â Remote participant track unpublish
      lk.RoomEvent.LocalTrackPublished,
      lk.RoomEvent.LocalTrackUnpublished,
      lk.RoomEvent.ConnectionStateChanged,
      lk.RoomEvent.ConnectionQualityChanged, // â 2026-04-25: BaÄlantÄ± kalitesi gÃ¶stergesi
      lk.RoomEvent.DataReceived,             // â Faz 3.2: Voice reaction data channel
    ];

    // â v92.17 (1 May 2026): Oda ses mute aktifken yeni track subscribe olunca
    //   onu da otomatik unsubscribe et (yeni katÄ±lan participant'larÄ±n sesini de kesmek iÃ§in).
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

    // â Faz 3.2 â Voice reaction listener (data channel; audio publish bozulmaz)
    this.room.on(lk.RoomEvent.DataReceived, (payload: Uint8Array, participant: any) => {
      try {
        if (!this.onDataReceivedCb) return;
        const json = new TextDecoder().decode(payload);
        const obj = JSON.parse(json);
        const identity = participant?.identity || '';
        this.onDataReceivedCb(obj, identity);
      } catch { /* malformed payload sessizce atÄ±lÄ±r */ }
    });

    // â 2026-04-25: Connection quality â sadece LOCAL participant iÃ§in
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

        // â KatÄ±lÄ±mcÄ± ayrÄ±ldÄ±ÄÄ±nda callback tetikle
        if (evt === lk.RoomEvent.ParticipantDisconnected) {
          const participant = args[0];
          const identity = participant?.identity || 'unknown';
          if (__DEV__) logger.log(`[LiveKit] â ParticipantDisconnected: ${identity}`);
          this.onParticipantDisconnected?.(identity);
        }

        // â TrackSubscribed â video/audio track geldiÄinde
        if (evt === lk.RoomEvent.TrackSubscribed) {
          const track = args[0];
          const publication = args[1];
          const participant = args[2];
          const kind = track?.kind || publication?.kind;
          if (kind === 'video') {
            if (__DEV__) logger.log(`[LiveKit] â TrackSubscribed: VIDEO from ${participant?.identity || 'unknown'}`);
          } else if (kind === 'audio') {
            // â 2026-04-20 AUDIO FIX: Uzak audio track'i explicit playback'e al.
            //   React Native LiveKit'te bazÄ± cihazlarda (Ã¶zellikle Android)
            //   subscribe edilen audio track otomatik play olmuyor; mic UI "aÃ§Ä±k"
            //   gÃ¶rÃ¼nÃ¼yor ama karÅÄ± taraf ses duymuyordu. attach() ve mediaStreamTrack.enabled=true
            //   bunu garanti eder.
            try {
              track?.mediaStreamTrack && (track.mediaStreamTrack.enabled = true);
              if (typeof track?.attach === 'function') track.attach();
              if (typeof track?.start === 'function') track.start();
            } catch (e) {
              if (__DEV__) logger.warn('[LiveKit] audio track attach failed:', e);
            }
            if (__DEV__) logger.log(`[LiveKit] â TrackSubscribed: AUDIO attached from ${participant?.identity || 'unknown'}`);
          }
        }

        // â LocalTrackPublished â kendi video track'imizi log'la
        if (evt === lk.RoomEvent.LocalTrackPublished) {
          const publication = args[0];
          if (publication?.kind === 'video' || publication?.track?.kind === 'video') {
            if (__DEV__) logger.log(`[LiveKit] â LocalTrackPublished: VIDEO track, source: ${publication?.source || 'n/a'}`);
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

  // âââ Participant Update (Throttle â BUG-1 FIX) ââââââââââââ
  private _throttleTimer: ReturnType<typeof setTimeout> | null = null;
  private _lastEmitTime = 0;

  private emitParticipantUpdate(lk: any) {
    const now = Date.now();
    const elapsed = now - this._lastEmitTime;

    // Throttle: Ä°lk Ã§aÄrÄ±da hemen Ã§alÄ±ÅtÄ±r, sonra 50ms bekle
    if (elapsed >= 50) {
      // Yeterince zaman geÃ§ti â hemen emit et
      this._lastEmitTime = now;
      if (this._throttleTimer) {
        clearTimeout(this._throttleTimer);
        this._throttleTimer = null;
      }
      this._doEmitParticipantUpdate(lk);
    } else if (!this._throttleTimer) {
      // Son emit'ten az zaman geÃ§ti â trailing emit planla
      this._throttleTimer = setTimeout(() => {
        this._throttleTimer = null;
        this._lastEmitTime = Date.now();
        this._doEmitParticipantUpdate(lk);
      }, 50 - elapsed);
    }
    // EÄer zaten bir trailing timer varsa â yoksay (throttle)
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
        // â YÃ¶ntem 1: getTrackPublication API'si (lk v2 Ã¶nerilen)
        const pub = participant.getTrackPublication?.(lk.Track.Source.Camera);
        if (pub && pub.track) return pub.track;
        if (pub && pub.videoTrack) return pub.videoTrack;
        
        // â YÃ¶ntem 2: videoTrackPublications (camera source filtreli)
        if (participant.videoTrackPublications) {
           const publications = Array.from(participant.videoTrackPublications.values()) as any[];
           for (const p of publications) {
             if (p.track) return p.track;
             if (p.videoTrack) return p.videoTrack;
           }
        }
        // â 2026-04-24 FIX: YÃ¶ntem 3: TÃ¼m trackPublications'Ä± tara â bazÄ± LK sÃ¼rÃ¼mlerinde
        //   videoTrackPublications getter'Ä± boÅ dÃ¶nebilir ama trackPublications Map'inde
        //   video track bulunur. Source === Camera olmayanlarÄ± (ScreenShare vb.) atla.
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

    // â 2026-04-30 v85f: Remote mute detection FIX.
    //   LiveKit JS SDK'sÄ±nda `isMicrophoneEnabled` SADECE localParticipant'ta var;
    //   remote participant'ta `undefined` â `!undefined === true` â tÃ¼m remote'lar
    //   her zaman "muted" gÃ¶rÃ¼nÃ¼yordu (mute ikonu var ama ses geliyor â kullanÄ±cÄ± raporu).
    //   DoÄrusu: remote'larda audio track publication'Ä±n `isMuted` veya track yokluÄuna bak.
    const getMuteState = (participant: any, isLocal: boolean): boolean => {
      if (isLocal) {
        return !participant.isMicrophoneEnabled;
      }
      try {
        // Microphone source publication'Ä± bul
        const micPub = participant.getTrackPublication?.(lk.Track.Source.Microphone);
        if (micPub) {
          // Publication seviyesinde mute (server-side mute)
          if (micPub.isMuted === true) return true;
          // Track seviyesinde mute (track yayÄ±nlanÄ±yor ama susturulmuÅ)
          if (micPub.track?.isMuted === true) return true;
          // Track abone deÄilse de muted say (henÃ¼z subscribe olmadÄ± veya kapalÄ±)
          if (!micPub.track && !micPub.isSubscribed) return true;
          return false;
        }
        // Fallback: audioTrackPublications map'ini tara
        if (participant.audioTrackPublications) {
          const pubs = Array.from(participant.audioTrackPublications.values()) as any[];
          if (pubs.length === 0) return true; // hiÃ§ audio track yok
          for (const pub of pubs) {
            if (pub?.source !== lk.Track.Source.Microphone) continue;
            if (pub.isMuted === true) return true;
            if (pub.track?.isMuted === true) return true;
            return false;
          }
          return true; // microphone source'lu pub bulunamadÄ±
        }
      } catch { /* silent */ }
      // En son fallback â undefined ise muted KABUL ETME (false dÃ¶ndÃ¼r) ki yanlÄ±Å kÄ±rmÄ±zÄ± icon olmasÄ±n.
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
