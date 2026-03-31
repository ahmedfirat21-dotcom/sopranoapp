// LiveKit Sesli/Görüntülü Sohbet Servisi
// Lazy-load (getLK) mekanizması ile WebRTC uyumsuz cihazlarda çökme önlenir

import { supabase } from '../constants/supabase';
import { LIVEKIT_URL, LIVEKIT_TOKEN_ENDPOINT } from '../constants/livekit';

let _lk: any = null;
let _globalsRegistered = false;

function getLK(): any {
  if (!_lk) {
    try {
      // registerGlobals sadece 1 kez çağrılmalı (BUG-4 fix)
      if (!_globalsRegistered) {
        try {
          const { registerGlobals } = require('@livekit/react-native');
          registerGlobals();
          _globalsRegistered = true;
        } catch (e) {
          console.warn('[LiveKit] registerGlobals başarısız (native modül eksik olabilir):', e);
        }
      }
      _lk = require('livekit-client');
      console.log('[LiveKit] Client lazily loaded');
    } catch (e) {
      console.warn('[LiveKit] livekit-client yüklenemedi — mock modda çalışacak:', e);
      return null;
    }
  }
  return _lk;
}

// ─── Token Servisi ──────────────────────────────────────────
async function fetchToken(roomId: string, userId: string, displayName: string): Promise<string> {
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtwb2ZpdWN6eWplc2pscWp4c3doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MzkxNjMsImV4cCI6MjA4ODAxNTE2M30.w3QMkePoTddmI6jdj_jJsdwV4LoxkOg6Nh4sIXrsAQA';

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
};

export type RoomConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

// ─── Ana Sınıf ──────────────────────────────────────────────
export class LiveKitService {
  private room: any = null; // livekit-client Room instance
  private onParticipantUpdate?: (participants: ParticipantUpdate[]) => void;
  private onConnectionStateChange?: (state: RoomConnectionState) => void;
  private onSpeakingChange?: (identity: string, isSpeaking: boolean) => void;
  private onMicStateChange?: (micEnabled: boolean, camEnabled: boolean) => void;
  // ★ Tier bazlı kalite ayarları
  private audioPreset: { sampleRate: number; channelCount: number } = { sampleRate: 48000, channelCount: 1 };
  private videoMaxRes: number = 720;

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
    },
    qualityPreset?: { audioSampleRate?: number; audioChannels?: number; videoMaxRes?: number }
  ): Promise<boolean> {
    const lk = getLK();
    if (!lk) {
      console.warn('[LiveKit] Modül yok, sahte (mock) moda geçiliyor.');
      callbacks.onConnectionStateChange?.('connected'); // Mock devrede
      return false; // Gerçek bağlantı kurulamadı
    }

    if (this.room) {
      await this.disconnect();
    }

    this.onParticipantUpdate = callbacks.onParticipantUpdate;
    this.onConnectionStateChange = callbacks.onConnectionStateChange;
    this.onSpeakingChange = callbacks.onSpeakingChange;
    this.onMicStateChange = callbacks.onMicStateChange;

    // ★ Tier bazlı kalite ayarları uygula
    if (qualityPreset) {
      this.audioPreset = {
        sampleRate: qualityPreset.audioSampleRate || 48000,
        channelCount: qualityPreset.audioChannels || 1,
      };
      this.videoMaxRes = qualityPreset.videoMaxRes || 720;
    }

    try {
      this.onConnectionStateChange?.('connecting');

      // Token alma: 10sn timeout — sunucu yanıt vermezse donmayı önle
      const token = await Promise.race([
        fetchToken(roomId, userId, displayName),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error('Token timeout (10s)')), 10000)),
      ]);

      this.room = new lk.Room({
        adaptiveStream: true,
        dynacast: true,
      });

      this.setupEventListeners(lk);

      // Bağlantı: 15sn timeout
      await Promise.race([
        this.room.connect(LIVEKIT_URL, token),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connect timeout (15s)')), 15000)),
      ]);

      this.onConnectionStateChange?.('connected');
      this.emitParticipantUpdate(lk);
      return true;
    } catch (err: any) {
      console.warn('[LiveKit] Bağlantı Hatası DETAYI:', err?.message || err);
      // ★ Bağlantı başarısız — room'u null yap ki toggleMicrophone çağrılmasın
      if (this.room) {
        try { this.room.disconnect(); } catch(_) {}
      }
      this.room = null;
      this.onConnectionStateChange?.('disconnected');
      return false;
    }
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
    if (this.room) {
      try {
        // Sadece bağlantı kurulmuşsa sinyal gönder, yoksa sessizce temizle
        if (this.room.state === 'connected' || this.room.state === 'reconnecting') {
          await this.room.disconnect();
        }
      } catch (e) {
        // Bağlantı kurulmamışsa "cannot send signal" hatası gelir, yoksay
        console.log('[LiveKit] Disconnect sırasında beklenen hata (bağlantı yoktu):', (e as any)?.message);
      }
      this.room = null;
    }
    this.onConnectionStateChange?.('disconnected');
    this.onMicStateChange?.(false, false);
    this.emitParticipantUpdate(getLK());
  }

  // ─── Mikrofon Aç/Kapat ──────────────────────────────────
  async toggleMicrophone(): Promise<boolean> {
    if (!this.room?.localParticipant) {
      console.warn('[LiveKit] toggleMic: room veya localParticipant yok');
      return false;
    }
    // ★ Room bağlı değilse mikrofonu açmaya çalışma — donmayı önle
    if (this.room.state !== 'connected') {
      console.warn('[LiveKit] toggleMic: Room bağlı değil, state:', this.room.state);
      return false;
    }
    const enabled = this.room.localParticipant.isMicrophoneEnabled;
    try {
      // 5sn timeout — server yanıt vermezse donmayı önle
      await Promise.race([
        this.room.localParticipant.setMicrophoneEnabled(!enabled, {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
          channelCount: this.audioPreset.channelCount,
          sampleRate: this.audioPreset.sampleRate,
          sampleSize: 16,
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Mic timeout (5s)')), 5000)),
      ]);
    } catch (e) {
      console.warn('[LiveKit] Mikrofon toggle hatası:', (e as any)?.message);
      return enabled; // Değişmedi
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
        this.room.localParticipant.setMicrophoneEnabled(true, {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
          channelCount: this.audioPreset.channelCount,
          sampleRate: this.audioPreset.sampleRate,
          sampleSize: 16,
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Mic enable timeout (5s)')), 5000)),
      ]);
    } catch (e) {
      console.warn('[LiveKit] Mikrofon açma hatası:', (e as any)?.message);
      return false;
    }
    this.onMicStateChange?.(true, this.isCameraEnabled);
    this.emitParticipantUpdate(getLK());
    return true;
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
        console.log(`[LiveKit] Mikrofon modu değişti: ${mode}`, audioOptions);
      } catch (e) {
        console.warn('[LiveKit] Mic mode değiştirme hatası:', e);
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
        this.room.localParticipant.setCameraEnabled(!enabled, {
          resolution: { width: this.videoMaxRes, height: this.videoMaxRes, frameRate: this.videoMaxRes >= 720 ? 30 : 24 },
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Camera timeout (5s)')), 5000)),
      ]);
    } catch (e) {
      console.warn('[LiveKit] Kamera toggle hatası:', (e as any)?.message);
      return enabled;
    }
    const newCamState = !enabled;
    this.onMicStateChange?.(this.isMicrophoneEnabled, newCamState);
    this.emitParticipantUpdate(getLK());
    return newCamState;
  }

  // ─── Kamera Ön/Arka Çevirme (Flip) ──────────────────────
  async flipCamera(): Promise<void> {
    if (!this.room?.localParticipant) return;
    if (!this.room.localParticipant.isCameraEnabled) return;
    try {
      // LiveKit React Native switchCamera API
      const camPub = this.room.localParticipant.getTrackPublication?.('camera');
      if (camPub?.track) {
        const currentFacingMode = camPub.track.mediaStreamTrack?.getSettings?.()?.facingMode || 'user';
        const newFacing = currentFacingMode === 'environment' ? 'user' : 'environment';
        // React Native'de switchCamera methodu var
        if (typeof camPub.track.restartTrack === 'function') {
          await camPub.track.restartTrack({ facingMode: newFacing });
        } else if (typeof (camPub.track as any).switchCamera === 'function') {
          await (camPub.track as any).switchCamera();
        } else {
          // Fallback: Kamerayı kapat, ters modda aç
          await this.room.localParticipant.setCameraEnabled(false);
          await new Promise(r => setTimeout(r, 200));
          await this.room.localParticipant.setCameraEnabled(true, {
            facingMode: newFacing
          });
        }
      }
      this.emitParticipantUpdate(getLK());
    } catch (e) {
      console.warn('[LiveKit] Kamera çevirme hatası:', (e as any)?.message);
    }
  }

  get isCameraEnabled(): boolean {
    return this.room?.localParticipant?.isCameraEnabled ?? false;
  }

  get isMicrophoneEnabled(): boolean {
    return this.room?.localParticipant?.isMicrophoneEnabled ?? false;
  }

  async promoteToSpeaker(roomId: string, userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('room_participants')
        .update({ role: 'speaker', is_muted: true })
        .match({ room_id: roomId, user_id: userId });
      if (error) throw error;
    } catch (e: any) {
      console.warn('Konuşmacı yapma hatası:', e);
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

    // Throttle: İlk çağrıda hemen çalıştır, sonra 150ms bekle
    if (elapsed >= 150) {
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
      }, 150 - elapsed);
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
      } catch(e) { console.warn('extractVideoTrack error', e); }
      return undefined;
    };

    // Local
    if (this.room.localParticipant) {
      participants.push({
        identity: this.room.localParticipant.identity,
        isSpeaking: this.room.localParticipant.isSpeaking,
        isMuted: !this.room.localParticipant.isMicrophoneEnabled,
        audioLevel: this.room.localParticipant.audioLevel,
        isCameraEnabled: this.room.localParticipant.isCameraEnabled,
        videoTrack: extractVideoTrack(this.room.localParticipant)
      });
    }

    // Remote
    this.room.remoteParticipants.forEach((p: any) => {
      participants.push({
        identity: p.identity,
        isSpeaking: p.isSpeaking,
        isMuted: !p.isMicrophoneEnabled,
        audioLevel: p.audioLevel,
        isCameraEnabled: p.isCameraEnabled,
        videoTrack: extractVideoTrack(p)
      });
    });

    this.onParticipantUpdate(participants);
  }
}

export const liveKitService = new LiveKitService();
