import { useEffect, useState, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { liveKitService, type ParticipantUpdate, type RoomConnectionState } from '../services/livekit';

interface UseLiveKitOptions {
  roomId: string | undefined;
  enabled?: boolean;
  userId?: string;
  displayName?: string;
  qualityPreset?: { audioSampleRate?: number; audioChannels?: number; videoMaxRes?: number };
  shouldDisconnectOnUnmount?: () => boolean;
  /** K7: Mikrofon/kamera permission reddedildiğinde UI feedback için çağrılır. */
  onPermissionDenied?: (device: 'microphone' | 'camera') => void;
}

export default function useLiveKit({ roomId, enabled = true, userId, displayName, qualityPreset, shouldDisconnectOnUnmount, onPermissionDenied }: UseLiveKitOptions) {
  // ★ 2026-04-20 Minimize-restore: Eğer servis zaten aynı odaya bağlıysa
  // initial state 'connected' — "bağlanıyor" flash'ı önlenir.
  const isAlreadyConnected = !!roomId && liveKitService.isConnectedTo(roomId);
  const [connectionState, setConnectionState] = useState<RoomConnectionState>(
    isAlreadyConnected ? 'connected' : 'disconnected',
  );
  const [participants, setParticipants] = useState<ParticipantUpdate[]>([]);
  // ★ BUG-2 FIX: Mic/Cam durumunu React state olarak takip et
  const [isMicEnabled, setIsMicEnabled] = useState(isAlreadyConnected ? liveKitService.isMicrophoneEnabled : false);
  const [isCamEnabled, setIsCamEnabled] = useState(isAlreadyConnected ? liveKitService.isCameraEnabled : false);
  const [connectFailed, setConnectFailed] = useState(false);
  const connectingRef = useRef(false); // Aktif bağlantı denemesi var mı
  const mountedRef = useRef(true);
  const appStateRef = useRef(AppState.currentState);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectCountRef = useRef(0);
  // ★ FIX: Reconnect sonrası mic/cam restore
  const prevMicRef = useRef(false);
  const prevCamRef = useRef(false);

  // ★ Bağlantı kurma fonksiyonu — retry ile
  const intentionalLeaveRef = useRef(false); // Normal çıkışta Disconnected eventi yoksay

  const doConnect = useCallback(async () => {
    if (!roomId || !userId || !displayName) return;
    if (connectingRef.current) return; // Zaten bağlanıyor

    connectingRef.current = true;
    setConnectFailed(false);
    intentionalLeaveRef.current = false;

    const success = await liveKitService.connect(roomId, userId, displayName, {
      onConnectionStateChange: (state) => {
        if (!mountedRef.current) return;
        setConnectionState(state);
        
        // ★ Normal (intentional) çıkışta reconnect döngüsünü başlatma
        if (state === 'disconnected' && intentionalLeaveRef.current) return;

        // ★ Bağlantı koptuğunda otomatik yeniden bağlanma (max 3)
        if (state === 'disconnected' && mountedRef.current && reconnectCountRef.current < 3) {
          reconnectCountRef.current++;
          const delay = Math.min(3000 * Math.pow(2, reconnectCountRef.current - 1), 30000);
          if (__DEV__) console.log(`[useLiveKit] Otomatik reconnect planlandı (${reconnectCountRef.current}/3), ${delay}ms sonra`);
          
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = setTimeout(() => {
            if (mountedRef.current) {
              connectingRef.current = false; // Kilidi aç
              doConnect();
            }
          }, delay);
        } else if (state === 'disconnected' && reconnectCountRef.current >= 3) {
          if (__DEV__) console.warn('[useLiveKit] Max reconnect aşıldı, bağlantı bırakıldı.');
        }
        
        // ★ Başarılı bağlantıda sayacı sıfırla + önceki durumu restore et
        if (state === 'connected') {
          // Reconnect sonrası mic/cam restore — 1sn sonra dene
          if (reconnectCountRef.current > 0) {
            setTimeout(async () => {
              if (!mountedRef.current) return;
              try {
                if (prevMicRef.current) await liveKitService.enableMicrophone();
                if (prevCamRef.current) await liveKitService.enableCamera();
              } catch (e) { console.warn('[useLiveKit] Restore hatası:', e); }
            }, 1000);
          }
          setTimeout(() => {
            if (mountedRef.current) {
              reconnectCountRef.current = 0;
            }
          }, 10000);
        }

        // ★ Bağlantı kopmadan önce durumu sakla
        if (state === 'disconnected' || state === 'reconnecting') {
          prevMicRef.current = liveKitService.isMicrophoneEnabled;
          prevCamRef.current = liveKitService.isCameraEnabled;
        }
      },
      onParticipantUpdate: (parts) => {
        if (!mountedRef.current) return;
        setParticipants(prev => {
          // Shallow compare — aynı veri ise state güncelleme (re-render engelle)
          if (prev.length === parts.length && prev.every((p, i) => 
            p.identity === parts[i].identity && 
            p.isMuted === parts[i].isMuted && 
            p.isSpeaking === parts[i].isSpeaking &&
            p.isCameraEnabled === parts[i].isCameraEnabled &&
            p.isScreenShareEnabled === parts[i].isScreenShareEnabled &&
            Math.abs(p.audioLevel - parts[i].audioLevel) < 0.05
          )) return prev;
          return parts;
        });
      },
      // ★ BUG-2 FIX: State callback ile mic/cam durumu her zaman güncel
      onMicStateChange: (mic, cam) => {
        if (!mountedRef.current) return;
        setIsMicEnabled(mic);
        setIsCamEnabled(cam);
      },
      onPermissionDenied: (device) => {
        if (!mountedRef.current) return;
        onPermissionDenied?.(device);
      },
    }, qualityPreset);

    connectingRef.current = false;

    if (!success && mountedRef.current) {
      setConnectFailed(true);
      if (__DEV__) console.warn('[useLiveKit] Bağlantı başarısız.');
    }
  }, [roomId, userId, displayName, qualityPreset, onPermissionDenied]);

  useEffect(() => {
    mountedRef.current = true;
    reconnectCountRef.current = 0;
    
    if (!roomId || !enabled || !userId || !displayName) return;

    doConnect();

    return () => {
      mountedRef.current = false;
      connectingRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      const shouldDisconnect = shouldDisconnectOnUnmount ? shouldDisconnectOnUnmount() : true;
      if (shouldDisconnect) {
        intentionalLeaveRef.current = true;
        liveKitService.disconnect();
        setConnectionState('disconnected');
        setParticipants([]);
        setIsMicEnabled(false);
        setIsCamEnabled(false);
      }
    };
  }, [roomId, enabled, userId, displayName, shouldDisconnectOnUnmount]);
  
  // App Background/Foreground state handling
  useEffect(() => {
    const handleAppState = async (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/active/) && nextState.match(/inactive|background/)) {
        // Arka plana geçerken mikrofonu KAPATMA — oda arka planda devam etmeli (FEAT-3)
        // Sadece 60sn sonra otomatik çıkış tetiklenecek (room/[id].tsx'deki zombie mekanizması)
      }
      appStateRef.current = nextState;
    };

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, []);

  const toggleCamera = useCallback(async () => {
    // ★ BUG-T5 FIX: maxCameras enforcement — kamera açarken limit kontrolü
    if (!isCamEnabled) {
      // Kamera açılıyor — mevcut kamera sayısını kontrol et
      const cameraCount = participants.filter(p => p.isCameraEnabled).length;
      // qualityPreset üzerinden max bilgisi olmadığı için basit limit: 10 (Pro max)
      // Gerçek limit room/[id].tsx'de tier'dan çekilmeli
      if (cameraCount >= 10) {
        throw new Error('Kamera limiti doldu');
      }
    }
    return await liveKitService.toggleCamera();
  }, [isCamEnabled, participants]);

  const toggleMic = useCallback(async () => {
    return await liveKitService.toggleMicrophone();
  }, []);

  const enableMic = useCallback(async () => {
    return await liveKitService.enableMicrophone();
  }, []);

  const setMicMode = useCallback(async (mode: 'normal' | 'music') => {
    await liveKitService.setMicMode(mode);
  }, []);

  const muteRoomAudio = useCallback((mute: boolean) => {
    liveKitService.muteRoomAudio(mute);
  }, []);

  const flipCamera = useCallback(async () => {
    await liveKitService.flipCamera();
  }, []);

  const disableMic = useCallback(async () => {
    await liveKitService.disableMicrophone();
  }, []);

  const disableCamera = useCallback(async () => {
    await liveKitService.disableCamera();
  }, []);

  const enableCamera = useCallback(async () => {
    await liveKitService.enableCamera();
  }, []);

  const toggleScreenShare = useCallback(async () => {
    return await liveKitService.toggleScreenShare();
  }, []);

  // ★ BUG FIX: isScreenSharing → LOCAL kullanıcının paylaşım durumu (toggle butonu için)
  // Eski kod tüm katılımcıları kontrol ediyordu → başkası paylaşıyorsa buton yanlış görünüyordu
  const isScreenSharing = liveKitService.isScreenSharing;
  // Odada herhangi biri paylaşıyor mu? (video görüntüleme için)
  const anyoneScreenSharing = participants.some(p => p.isScreenShareEnabled);

  return {
    muteRoomAudio,
    connectionState,
    connectFailed,
    participants,
    toggleMic,
    toggleCamera,
    flipCamera,
    enableMic,
    disableMic,
    disableCamera,
    enableCamera,
    toggleScreenShare,
    setMicMode,
    isCameraEnabled: isCamEnabled,
    isMicrophoneEnabled: isMicEnabled,
    isScreenSharing,
    anyoneScreenSharing,
  };
}
