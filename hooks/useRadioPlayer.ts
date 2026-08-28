/**
 * SopranoChat — useRadioPlayer Hook
 * ═══════════════════════════════════════════════════
 * Soprano Lobi radyo akışı. expo-av Audio.Sound üzerinden TR radyo HLS/icecast
 * stream'leri oynatır. Persistent state (AsyncStorage), ducking desteği.
 *
 * NOT: Lobi DIŞINDAKİ odalarda KULLANILMAZ. Sadece SopranoRadioPlayer component
 * tarafından mount edilir (isLobiRoom gate var).
 *
 * v1.7.13.161 (23 May 2026) — Sonsuz restart döngüsü düzeltildi.
 *   Önceki bug: positionMillis canlı yayında her zaman 0 → "stuck" algılanıyor →
 *   loadAndPlay tekrar çağrılıyor → sonsuz loop. Şimdi isBuffering + timeout tabanlı.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Audio, AVPlaybackSource } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SOPRANO_RADIO_CHANNELS,
  DEFAULT_RADIO_CHANNEL_ID,
  RADIO_STORAGE,
  type RadioChannel,
} from '../constants/sopranoRadioChannels';

type RadioStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

interface UseRadioPlayerOpts {
  /** false ise hook hiç başlamaz (Lobi dışı odalar için) */
  enabled: boolean;
}

// ★ Module-level sound referansı — mini-player'dan veya başka bir component'tan
//   hook unmount olduktan sonra (preserve=true ile) orphan sound'u durdurabilmek için.
let orphanSoundRef: Audio.Sound | null = null;

/** Component dışından çağrılır — preserved orphan radyo sound'u zorla durdur+unload. */
export async function stopOrphanRadio() {
  const s = orphanSoundRef;
  orphanSoundRef = null;
  if (s) {
    try { s.setOnPlaybackStatusUpdate(null); } catch {}
    try { await s.stopAsync(); } catch {}
    try { await s.unloadAsync(); } catch {}
  }
}

export function useRadioPlayer({ enabled }: UseRadioPlayerOpts) {
  const [currentChannelId, setCurrentChannelId] = useState<string>(DEFAULT_RADIO_CHANNEL_ID);
  const [status, setStatus] = useState<RadioStatus>('idle');
  const [hidden, setHidden] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const soundRef = useRef<Audio.Sound | null>(null);
  const targetVolumeRef = useRef(1.0);
  const mountedRef = useRef(true);
  // ★ Yeniden yükleme kilidı — aynı anda birden fazla loadAndPlay çağrısını önler
  const loadingLockRef = useRef(false);
  const pendingChannelRef = useRef<RadioChannel | null>(null);
  // ★ Buffer timeout — canlı yayın uzun süre buffer'da kalırsa yeniden dene
  const bufferTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ★ Ardışık hata sayacı — sonsuz restart önleme
  const consecutiveErrorsRef = useRef(0);
  // ★ Minimize koruması — true ise unmount'ta sound durdurulmaz
  const preserveOnUnmountRef = useRef(false);

  const currentChannel = SOPRANO_RADIO_CHANNELS.find(c => c.id === currentChannelId) || SOPRANO_RADIO_CHANNELS[0];

  // ── Initial: AsyncStorage'tan kayıtlı kanal + hidden state oku ──
  useEffect(() => {
    if (!enabled) return;
    (async () => {
      try {
        const [savedCh, savedHidden] = await Promise.all([
          AsyncStorage.getItem(RADIO_STORAGE.channelId),
          AsyncStorage.getItem(RADIO_STORAGE.hidden),
        ]);
        if (savedCh && SOPRANO_RADIO_CHANNELS.some(c => c.id === savedCh)) {
          setCurrentChannelId(savedCh);
        }
        if (savedHidden === '1') setHidden(true);
      } catch { /* sessiz */ }
      finally { if (mountedRef.current) setHydrated(true); }
    })();
  }, [enabled]);

  // ── Buffer timeout temizleyici ──
  const clearBufferTimeout = useCallback(() => {
    if (bufferTimeoutRef.current) {
      clearTimeout(bufferTimeoutRef.current);
      bufferTimeoutRef.current = null;
    }
  }, []);

  // ── Eski Sound'u güvenli temizle ──
  const cleanupSound = useCallback(async (sound: Audio.Sound | null) => {
    if (!sound) return;
    try { await sound.setOnPlaybackStatusUpdate(null); } catch {}
    try { await sound.stopAsync(); } catch {}
    // unload'ı biraz geciktir — ExoPlayer thread safety
    setTimeout(() => { sound.unloadAsync().catch(() => {}); }, 100);
  }, []);

  // ── Stream load + play ──
  const loadAndPlay = useCallback(async (channel: RadioChannel) => {
    if (!enabled || !mountedRef.current) return;

    if (loadingLockRef.current) {
      pendingChannelRef.current = channel;
      return;
    }
    loadingLockRef.current = true;
    let requestedChannel: RadioChannel | null = channel;

    try {
      while (requestedChannel && mountedRef.current && enabled) {
        const channelToLoad: RadioChannel = requestedChannel;
        requestedChannel = null;
        pendingChannelRef.current = null;
        clearBufferTimeout();
        setStatus('loading');

        try {
          // Minimize dönüşünde eski hook'un açık bıraktığı stream'i önce kapat.
          await stopOrphanRadio();
          const oldSound = soundRef.current;
          soundRef.current = null;
          await cleanupSound(oldSound);

          try {
            await Audio.setAudioModeAsync({
              staysActiveInBackground: true,
              playsInSilentModeIOS: true,
              shouldDuckAndroid: true,
              playThroughEarpieceAndroid: false,
            });
          } catch { /* opsiyonel */ }

          const { sound, status: initialStatus } = await Audio.Sound.createAsync(
            {
              uri: channelToLoad.streamUrl,
              headers: {
                'User-Agent': 'SopranoChat-Android/1.7',
                'Icy-MetaData': '1',
              },
            } as AVPlaybackSource,
            {
              shouldPlay: true,
              isLooping: false,
              progressUpdateIntervalMillis: 5000,
            },
          );

          if (!mountedRef.current) {
            await cleanupSound(sound);
            break;
          }

          const handlePlaybackStatus = (st: any) => {
            if (!mountedRef.current || soundRef.current !== sound) return;
            if (!st.isLoaded || st.error) {
              if (st.error) {
                setStatus('error');
                clearBufferTimeout();
              }
              return;
            }
            if (st.isPlaying) {
              setStatus('playing');
              consecutiveErrorsRef.current = 0;
              clearBufferTimeout();
            } else if (st.isBuffering && !bufferTimeoutRef.current) {
              bufferTimeoutRef.current = setTimeout(() => {
                if (mountedRef.current && soundRef.current === sound) setStatus('error');
                bufferTimeoutRef.current = null;
              }, 15000);
            }
          };

          soundRef.current = sound;
          sound.setOnPlaybackStatusUpdate(handlePlaybackStatus);
          // Stream gerçekten başlamadan "playing" gösterme.
          handlePlaybackStatus(initialStatus);
        } catch {
          consecutiveErrorsRef.current++;
          if (mountedRef.current) setStatus('error');
        }

        requestedChannel = pendingChannelRef.current;
      }
    } finally {
      loadingLockRef.current = false;
    }
  }, [enabled, clearBufferTimeout, cleanupSound]);

  // ── Channel change ──
  const changeChannel = useCallback(async (channelId: string) => {
    const ch = SOPRANO_RADIO_CHANNELS.find(c => c.id === channelId);
    if (!ch) return;
    consecutiveErrorsRef.current = 0;
    setCurrentChannelId(channelId);
    AsyncStorage.setItem(RADIO_STORAGE.channelId, channelId).catch(() => {});
    await loadAndPlay(ch);
  }, [loadAndPlay]);

  // ── Auto-play on enable ──
  useEffect(() => {
    // Kayıtlı kanal/gizlilik okunmadan varsayılan kanalı başlatma.
    if (!enabled || !hydrated || hidden || soundRef.current) return;
    if (__DEV__) return; // Dev: autoplay devre dışı, manual play
    loadAndPlay(currentChannel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, hydrated, hidden]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearBufferTimeout();
      // ★ Minimize koruması — oda küçültülürken radyo çalmaya devam etsin
      if (preserveOnUnmountRef.current) {
        preserveOnUnmountRef.current = false;
        // ★ Orphan referansını sakla — mini-player X bastığında stopOrphanRadio() ile durdurulabilsin.
        orphanSoundRef = soundRef.current;
        soundRef.current = null;
        return; // Sound'u durdurmadan çık
      }
      // Preserve yok → çıkış: hem mevcut sound'u hem (varsa) orphan'ı durdur.
      stopOrphanRadio().catch(() => {});
      const sound = soundRef.current;
      soundRef.current = null;
      if (sound) {
        try { sound.setOnPlaybackStatusUpdate(null); } catch {}
        sound.stopAsync().catch(() => {});
        setTimeout(() => { sound.unloadAsync().catch(() => {}); }, 100);
      }
    };
  }, []);

  // ── Play / pause toggle ──
  const togglePlay = useCallback(async () => {
    if (!soundRef.current) {
      // Sound yok — load et
      consecutiveErrorsRef.current = 0;
      await loadAndPlay(currentChannel);
      return;
    }
    try {
      if (status === 'playing') {
        await soundRef.current.pauseAsync();
        setStatus('paused');
        clearBufferTimeout();
      } else if (status === 'error') {
        // Hata durumunda tekrar dene
        consecutiveErrorsRef.current = 0;
        await loadAndPlay(currentChannel);
      } else {
        const nextStatus: any = await soundRef.current.playAsync();
        setStatus(nextStatus?.isLoaded && nextStatus?.isPlaying ? 'playing' : 'loading');
      }
    } catch { /* sessiz */ }
  }, [status, currentChannel, loadAndPlay, clearBufferTimeout]);

  // ★ v1.7.13.161: Duck/unduck — mikrofon açılınca radyo sesini kıs.
  //   Sistem volume’u yerine programatik ducking (geçici).
  const duck = useCallback(async () => {
    if (soundRef.current) await soundRef.current.setVolumeAsync(0.15).catch(() => {});
  }, []);
  const unduck = useCallback(async () => {
    if (soundRef.current) await soundRef.current.setVolumeAsync(1.0).catch(() => {});
  }, []);
  // ★ Mute / unmute — oda ses kapatma düğmesi radyoyu da kapatsın.
  const setMuted = useCallback(async (muted: boolean) => {
    if (soundRef.current) {
      await soundRef.current.setVolumeAsync(muted ? 0 : 1.0).catch(() => {});
    }
  }, []);

  // ── Explicit cleanup ──
  const cleanup = useCallback(async () => {
    clearBufferTimeout();
    const sound = soundRef.current;
    soundRef.current = null;
    if (sound) {
      try { sound.setOnPlaybackStatusUpdate(null); } catch {}
      try { await sound.stopAsync(); } catch {}
      try { await sound.unloadAsync(); } catch {}
    }
  }, [clearBufferTimeout]);

  // ── Hide / show ──
  const toggleHidden = useCallback(() => {
    setHidden(h => {
      const newVal = !h;
      AsyncStorage.setItem(RADIO_STORAGE.hidden, newVal ? '1' : '0').catch(() => {});
      return newVal;
    });
  }, []);

  return {
    currentChannel,
    status,
    hidden,
    changeChannel,
    togglePlay,
    toggleHidden,
    duck,
    unduck,
    setMuted,
    cleanup,
    channels: SOPRANO_RADIO_CHANNELS,
    /** Minimize öncesi çağır — unmount'ta radyo durdurulmaz */
    setPreserve: (v: boolean) => { preserveOnUnmountRef.current = v; },
  };
}
