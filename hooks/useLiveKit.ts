import { useEffect, useState, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { liveKitService, type ParticipantUpdate, type RoomConnectionState } from '../services/livekit';

interface UseLiveKitOptions {
  roomId: string | undefined;
  enabled?: boolean;
  userId?: string;
  displayName?: string;
  qualityPreset?: { audioSampleRate?: number; audioChannels?: number; videoMaxRes?: number };
}

export default function useLiveKit({ roomId, enabled = true, userId, displayName, qualityPreset }: UseLiveKitOptions) {
  const [connectionState, setConnectionState] = useState<RoomConnectionState>('disconnected');
  const [participants, setParticipants] = useState<ParticipantUpdate[]>([]);
  // ★ BUG-2 FIX: Mic/Cam durumunu React state olarak takip et
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isCamEnabled, setIsCamEnabled] = useState(false);
  const [connectFailed, setConnectFailed] = useState(false);
  const connectAttemptedRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    if (!roomId || !enabled || !userId || !displayName) return;
    if (connectAttemptedRef.current) return;

    connectAttemptedRef.current = true;
    setConnectFailed(false);

    liveKitService.connect(roomId, userId, displayName, {
      onConnectionStateChange: (state) => setConnectionState(state),
      onParticipantUpdate: (parts) => {
        setParticipants(prev => {
          // Shallow compare — aynı veri ise state güncelleme (re-render engelle)
          if (prev.length === parts.length && prev.every((p, i) => 
            p.identity === parts[i].identity && 
            p.isMuted === parts[i].isMuted && 
            p.isSpeaking === parts[i].isSpeaking &&
            p.isCameraEnabled === parts[i].isCameraEnabled &&
            Math.abs(p.audioLevel - parts[i].audioLevel) < 0.05
          )) return prev;
          return parts;
        });
      },
      // ★ BUG-2 FIX: State callback ile mic/cam durumu her zaman güncel
      onMicStateChange: (mic, cam) => {
        setIsMicEnabled(mic);
        setIsCamEnabled(cam);
      },
    }, qualityPreset).then((success) => {
      if (!success) {
        // ★ BUG-3 FIX: Bağlantı hatası state'e yazdır
        setConnectFailed(true);
        console.warn('LiveKit bağlantısı başarısız.');
      }
    });

    return () => {
      connectAttemptedRef.current = false;
      liveKitService.disconnect();
      setConnectionState('disconnected');
      setParticipants([]);
      setIsMicEnabled(false);
      setIsCamEnabled(false);
    };
  }, [roomId, enabled, userId, displayName]);
  
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
    return await liveKitService.toggleCamera();
  }, []);

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

  return {
    muteRoomAudio,
    connectionState,
    connectFailed,
    participants,
    toggleMic,
    toggleCamera,
    flipCamera,
    enableMic,
    setMicMode,
    isCameraEnabled: isCamEnabled,
    isMicrophoneEnabled: isMicEnabled,
  };
}
