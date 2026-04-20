// LiveKit Sesli/Görüntülü Sohbet Servisi
// Lazy-load (getLK) mekanizması ile WebRTC uyumsuz cihazlarda çökme önlenir

import { supabase, SUPABASE_ANON_KEY } from '../constants/supabase';
import { LIVEKIT_URL, LIVEKIT_TOKEN_ENDPOINT } from '../constants/livekit';
import { logger } from '../utils/logger';

let _lk: any = null;
let _globalsRegistered = false;
let _audioSessionModule: any = null;

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
  const response = await fetch(LIVEKIT_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ roomId, displayName, userId }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Token request failed' }));
    throw new Error(err.error || 'Token alinamadi');
  }

  const data = await response.json();
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
  private onMicStateChange?: (micEnabled: boolean, camEnabled: boolean) => void;
  private onParticipantDisconnected?: (identity: string) => void; // ★ Karşı taraf ayrıldığında
  // ★ K7: Mic/cam permission denied callback — UI "Open Settings" alert'ı gösterebilsin.
  private onPermissionDenied?: (device: 'microphone' | 'camera') => void;
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

  /** Tier bazlı mikrofon ses ayarlarını döndür */
  private getAudioConstraints() {
    return {
      sampleRate: this.audioPreset.sampleRate,
      channelCount: this.audioPreset.channelCount,
      sampleSize: 16,
      noiseSuppression: true,
      echoCancellation: true,
      autoGainControl: true,
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
      onMicStateChange?: (micEnabled: boolean, camEnabled: boolean) => void;
      onParticipantDisconnected?: (identity: string) => void; // ★ Karşı taraf ayrıldığında
      onPermissionDenied?: (device: 'microphone' | 'camera') => void;
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
    if (this.room && this.currentRoomId === roomId && this.room.state === 'connected') {
      this.onParticipantUpdate = callbacks.onParticipantUpdate;
      this.onConnectionStateChange = callbacks.onConnectionStateChange;
      this.onSpeakingChange = callbacks.onSpeakingChange;
      this.onMicStateChange = callbacks.onMicStateChange;
      this.onParticipantDisconnected = callbacks.onParticipantDisconnected;
      this.onPermissionDenied = callbacks.onPermissionDenied;
      try {
        callbacks.onConnectionStateChange?.('connected');
        callbacks.onMicStateChange?.(this.isMicrophoneEnabled, this.isCameraEnabled);
        this._doEmitParticipantUpdate(lk);
      } catch (e) { if (__DEV__) logger.warn('[LiveKit] reattach state emit error', e); }
      if (__DEV__) logger.log(`[LiveKit] Reattach — ${roomId} için mevcut bağlantı kullanıldı`);
      return true;
    }

    if (this.room) {
      await this.disconnect();
    }

    this.onParticipantUpdate = callbacks.onParticipantUpdate;
    this.onConnectionStateChange = callbacks.onConnectionStateChange;
    this.onSpeakingChange = callbacks.onSpeakingChange;
    this.onMicStateChange = callbacks.onMicStateChange;
    this.onParticipantDisconnected = callbacks.onParticipantDisconnected;
    this.onPermissionDenied = callbacks.onPermissionDenied;

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

        // Token alma: 10sn timeout
        const token = await Promise.race([
          fetchToken(roomId, userId, displayName),
          new Promise<string>((_, reject) => setTimeout(() => reject(new Error('Token timeout (10s)')), 10000)),
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
        this.emitParticipantUpdate(lk);
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
  muteRoomAudio(mute: boolean) {
    if (!this.room) return;
    this.room.remoteParticipants.forEach((p: any) => {
      p.audioTrackPublications.forEach((pub: any) => {
        if (pub.track && pub.track.mediaStreamTrack) {
          pub.track.mediaStreamTrack.enabled = !mute;
        }
      });
    });
  }

  // ─── Bağlantıyı Kes ──────────────────────────────────────
  async disconnect(): Promise<void> {
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
    this.onConnectionStateChange?.('disconnected');
    this.onMicStateChange?.(false, false);
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
    this.onMicStateChange?.(newMicState, this.isCameraEnabled);
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
    this.onMicStateChange?.(true, this.isCameraEnabled);
    this.emitParticipantUpdate(getLK());
    return true;
  }

  // ─── Mikrofon Zorla Kapat (moderasyon: mute/demote için) ──
  async disableMicrophone(): Promise<void> {
    if (!this.room?.localParticipant) return;
    if (!this.room.localParticipant.isMicrophoneEnabled) {
      // Zaten kapalı — sadece state güncelle
      this.onMicStateChange?.(false, this.isCameraEnabled);
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
    this.onMicStateChange?.(false, this.isCameraEnabled);
    this.emitParticipantUpdate(getLK());
  }

  // ─── Kamera Zorla Kapat (moderasyon: mute/demote için) ──
  async disableCamera(): Promise<void> {
    if (!this.room?.localParticipant) return;
    if (!this.room.localParticipant.isCameraEnabled) {
      this.onMicStateChange?.(this.isMicrophoneEnabled, false);
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
    this.onMicStateChange?.(this.isMicrophoneEnabled, false);
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
    this.onMicStateChange?.(this.isMicrophoneEnabled, true);
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
          noiseSuppression: false,
          echoCancellation: false,
          autoGainControl: false,
          channelCount: 2,
          sampleRate: 48000,
          sampleSize: 16,
        }
      : {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
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
    this.onMicStateChange?.(this.isMicrophoneEnabled, newCamState);
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
      this.onMicStateChange?.(this.isMicrophoneEnabled, true);
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
  // başlamaması için useLiveKit bunu kullanır.
  isConnectedTo(roomId: string): boolean {
    return this.currentRoomId === roomId && this.room?.state === 'connected';
  }

  // --- Ekran Paylasimi -----------------------------------------------
  async toggleScreenShare(): Promise<boolean> {
    if (!this.room?.localParticipant) {
      if (__DEV__) logger.warn('[LiveKit] Ekran paylasimi: room veya localParticipant yok');
      throw new Error('Ses sunucusuna bağlı değilsiniz');
    }
    if (this.room.state !== 'connected') {
      if (__DEV__) logger.warn('[LiveKit] Ekran paylasimi: room bagli degil, state:', this.room.state);
      throw new Error('Ses sunucusuna bağlı değilsiniz');
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
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Ekran paylaşımı zaman aşımı (15s)')), 15000)),
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
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Ekran paylaşımı zaman aşımı (30s)')), 30000)),
          ]) as any;
          const videoTracks = stream.getVideoTracks();
          if (!videoTracks || videoTracks.length === 0) {
            throw new Error('Ekran video track bulunamadı');
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
          throw new Error('Bu cihazda ekran paylaşımı desteklenmiyor');
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
      lk.RoomEvent.LocalTrackPublished,
      lk.RoomEvent.LocalTrackUnpublished,
      lk.RoomEvent.ConnectionStateChanged,
    ];

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

        // ★ TrackSubscribed — video track geldiğinde hemen log ve update
        if (evt === lk.RoomEvent.TrackSubscribed) {
          const track = args[0];
          const publication = args[1];
          const participant = args[2];
          if (track?.kind === 'video' || publication?.kind === 'video') {
            if (__DEV__) logger.log(`[LiveKit] ★ TrackSubscribed: VIDEO track from ${participant?.identity || 'unknown'}, source: ${publication?.source || 'n/a'}`);
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
          this.onMicStateChange?.(this.isMicrophoneEnabled, this.isCameraEnabled);
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
        const pub = participant.getTrackPublication?.(lk.Track.Source.Camera);
        if (pub && pub.track) return pub.track;
        if (pub && pub.videoTrack) return pub.videoTrack;
        
        if (participant.videoTrackPublications) {
           const publications = Array.from(participant.videoTrackPublications.values()) as any[];
           for (const p of publications) {
             if (p.track) return p.track;
             if (p.videoTrack) return p.videoTrack;
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

    // Local
    if (this.room.localParticipant) {
      const screenTrack = extractScreenShareTrack(this.room.localParticipant) || this.screenShareTrack;
      participants.push({
        identity: this.room.localParticipant.identity,
        isSpeaking: this.room.localParticipant.isSpeaking,
        isMuted: !this.room.localParticipant.isMicrophoneEnabled,
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
        isMuted: !p.isMicrophoneEnabled,
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
