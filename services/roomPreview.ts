/**
 * ★ 2026-04-21: Oda Önizleme Servisi (Clubhouse-stili long-press dinleme)
 * ═══════════════════════════════════════════════════════════════════
 * Ana LiveKit servisinden bağımsız, kullanıcı kart'a uzun basınca geçici
 * bir LiveKit Room açar ve yalnızca AUDIO stream dinler. Bırakınca disconnect.
 *
 * Tasarım kararları:
 *   - DB'ye katılımcı yazmaz — room_participants INSERT yok, listener_count değişmez
 *   - Yalnızca LiveKit-level geçici bağlantı
 *   - Aynı anda maksimum 1 önizleme aktif (yeni önizleme önce eskiyi kapatır)
 *   - Auto-timeout: 5 saniye sonra otomatik disconnect (pil + maliyet koruması)
 *   - Mikrofon asla açılmaz
 *   - Bağlantı başarısız olursa sessizce yoksayılır (UX bozulmasın)
 */
import { supabase, SUPABASE_ANON_KEY } from '../constants/supabase';
import { LIVEKIT_URL, LIVEKIT_TOKEN_ENDPOINT } from '../constants/livekit';

const MAX_PREVIEW_DURATION_MS = 5000;

let _lkModule: any = null;
let _globalsRegistered = false;

function getLKModule(): any {
  if (!_lkModule) {
    try {
      if (!_globalsRegistered) {
        try {
          const rnLiveKit = require('@livekit/react-native');
          rnLiveKit.registerGlobals?.();
          _globalsRegistered = true;
        } catch {}
      }
      _lkModule = require('livekit-client');
    } catch {
      return null;
    }
  }
  return _lkModule;
}

async function fetchPreviewToken(roomId: string, userId: string, displayName: string): Promise<string> {
  const response = await fetch(LIVEKIT_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    // ★ displayName önüne "👁" koyuyoruz — host bu identity'yi özel tanıyabilir.
    //   Ayrıca userId'ye suffix ekliyoruz → LiveKit katılımcı listesinde ana kullanıcıyla çakışmasın.
    body: JSON.stringify({
      roomId,
      userId: `${userId}__preview`,
      displayName: `👁 ${displayName}`,
    }),
  });
  if (!response.ok) throw new Error('preview token failed');
  const data = await response.json();
  return data.token;
}

class RoomPreviewService {
  private room: any = null;
  private currentRoomId: string | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private stateListeners: Array<(state: 'idle' | 'connecting' | 'playing' | 'error') => void> = [];
  private currentState: 'idle' | 'connecting' | 'playing' | 'error' = 'idle';

  private emitState(s: 'idle' | 'connecting' | 'playing' | 'error') {
    this.currentState = s;
    this.stateListeners.forEach(l => { try { l(s); } catch {} });
  }

  onStateChange(listener: (state: 'idle' | 'connecting' | 'playing' | 'error') => void): () => void {
    this.stateListeners.push(listener);
    listener(this.currentState);
    return () => {
      this.stateListeners = this.stateListeners.filter(l => l !== listener);
    };
  }

  getPreviewingRoomId(): string | null {
    return this.currentState === 'connecting' || this.currentState === 'playing' ? this.currentRoomId : null;
  }

  /**
   * Bir odanın audio'sunu geçici olarak dinlemeye başla.
   * Önce varsa mevcut önizlemeyi kapatır.
   */
  async start(roomId: string, userId: string, displayName: string): Promise<void> {
    // Zaten aynı odada önizleme varsa tekrar başlatma
    if (this.currentRoomId === roomId && (this.currentState === 'connecting' || this.currentState === 'playing')) {
      return;
    }
    await this.stop();

    const lk = getLKModule();
    if (!lk) {
      this.emitState('error');
      return;
    }

    this.currentRoomId = roomId;
    this.emitState('connecting');

    // ★ Race guard — start() sırasında başka start() gelirse, eski connection'ı iptal et
    const expectedRoomId = roomId;

    try {
      const token = await Promise.race([
        fetchPreviewToken(roomId, userId, displayName),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error('token timeout')), 4000)),
      ]);

      // Start sırasında kullanıcı bıraktıysa veya başka oda istendiyse, devam etme
      if (this.currentRoomId !== expectedRoomId) return;

      // Yeni room instance
      this.room = new lk.Room({
        adaptiveStream: true,
        dynacast: false,
        pingTimeout: 8000,
        pongTimeout: 20000,
      });

      // Audio track subscribe olunca attach → playback başlar
      this.room.on(lk.RoomEvent.TrackSubscribed, (track: any, _pub: any, _p: any) => {
        if (track?.kind === 'audio') {
          try {
            if (track.mediaStreamTrack) track.mediaStreamTrack.enabled = true;
            track.attach?.();
            track.start?.();
          } catch {}
        }
      });

      this.room.on(lk.RoomEvent.Disconnected, () => {
        if (this.currentState !== 'idle') this.emitState('idle');
      });

      await Promise.race([
        this.room.connect(LIVEKIT_URL, token),
        new Promise((_, reject) => setTimeout(() => reject(new Error('connect timeout')), 6000)),
      ]);

      // ★ Connect bittiğinde user zaten bıraktıysa hemen disconnect et
      if (this.currentRoomId !== expectedRoomId) {
        try { await this.room?.disconnect?.(); } catch {}
        this.room = null;
        return;
      }

      // ★ Connection state'i gerçekten 'connected' mi kontrol et — setSubscribed öncesi
      //   "cannot send signal before connected" hatasını önler
      if (this.room?.state !== 'connected') {
        // Connect açık değilse subscribe'ı atla ama bağlantı devam etsin (track auto-subscribe ile gelebilir)
      } else {
        // Mevcut remote audio track'leri explicit subscribe et (sadece connected iken)
        try {
          this.room.remoteParticipants?.forEach?.((p: any) => {
            p.audioTrackPublications?.forEach?.((pub: any) => {
              if (pub?.setSubscribed && !pub.isSubscribed && this.room?.state === 'connected') {
                try { pub.setSubscribed(true).catch(() => {}); } catch {}
              }
              if (pub?.track?.mediaStreamTrack) {
                try {
                  pub.track.mediaStreamTrack.enabled = true;
                  pub.track.attach?.();
                  pub.track.start?.();
                } catch {}
              }
            });
          });
        } catch {}
      }

      this.emitState('playing');

      // Maliyet/pil koruması: N saniye sonra otomatik kapat
      this.timeoutId = setTimeout(() => { this.stop().catch(() => {}); }, MAX_PREVIEW_DURATION_MS);
    } catch {
      this.emitState('error');
      // Guarded disconnect — state kontrolü ile
      if (this.room) {
        const st = this.room.state;
        if (st === 'connected' || st === 'reconnecting') {
          try { await this.room.disconnect(); } catch {}
        }
        this.room = null;
      }
      this.currentRoomId = null;
      // Kısa süre sonra idle'a dön (UI hata göstergesi geçici)
      setTimeout(() => { if (this.currentState === 'error') this.emitState('idle'); }, 1500);
    }
  }

  async stop(): Promise<void> {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.room) {
      try { await this.room.disconnect(); } catch {}
      this.room = null;
    }
    this.currentRoomId = null;
    if (this.currentState !== 'idle') this.emitState('idle');
  }
}

export const roomPreviewService = new RoomPreviewService();
