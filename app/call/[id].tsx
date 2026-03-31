/**
 * SopranoChat — DM Arama Ekranı (Gerçek Ses/Video)
 * LiveKit üzerinden 1:1 arama — tier bazlı kalite
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/theme';
import { ProfileService, type Profile } from '../../services/database';
import { CallService, getCallQuality, type CallType, type CallStatus } from '../../services/call';
import { LiveKitService, type ParticipantUpdate } from '../../services/livekit';
import { showToast } from '../../components/Toast';
import { useAuth } from '../_layout';

const { width: W, height: H } = Dimensions.get('window');

export default function CallScreen() {
  const router = useRouter();
  const { id, callId, callType: callTypeParam, isIncoming } = useLocalSearchParams<{
    id: string;
    callId: string;
    callType: string;
    isIncoming: string;
  }>();
  const { firebaseUser, profile } = useAuth();

  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>(isIncoming === 'true' ? 'connected' : 'calling');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(callTypeParam === 'video');
  const [isCameraFront, setIsCameraFront] = useState(true);
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<any>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<any>(null);

  const liveKitRef = useRef<LiveKitService>(new LiveKitService());
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ringTimerRef = useRef<NodeJS.Timeout | null>(null);
  const signalChannelRef = useRef<any>(null);
  const callType: CallType = (callTypeParam as CallType) || 'audio';
  const tier = profile?.tier || 'Silver';

  // ─── Profil yükle ─────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    ProfileService.get(id).then(setOtherUser).catch(() => {});
  }, [id]);

  // ─── Signal dinleyici (kabul/red/bitir) ───────────────────
  useEffect(() => {
    if (!firebaseUser || !callId) return;

    const channel = CallService.onCallSignal(firebaseUser.uid, (signal) => {
      if (signal.callId !== callId) return;

      if (signal.action === 'call_accepted') {
        setCallStatus('connected');
        connectToLiveKit();
      } else if (signal.action === 'call_rejected') {
        setCallStatus('ended');
        showToast({ title: 'Arama Reddedildi', message: 'Karşı taraf aramayı reddetti.', type: 'info' });
        setTimeout(() => router.back(), 1500);
      } else if (signal.action === 'call_ended') {
        setCallStatus('ended');
        liveKitRef.current.disconnect().catch(() => {});
        showToast({ title: 'Arama Sonlandı', message: '', type: 'info' });
        setTimeout(() => router.back(), 1000);
      }
    });

    signalChannelRef.current = channel;

    // İncoming call zaten kabul edilmiş — direkt bağlan
    if (isIncoming === 'true') {
      connectToLiveKit();
    }

    // Calling timeout: 45 saniye — karşı taraf cevap vermezse
    if (callStatus === 'calling') {
      ringTimerRef.current = setTimeout(() => {
        if (callStatus === 'calling') {
          setCallStatus('ended');
          showToast({ title: 'Cevap Yok', message: 'Karşı taraf aramaya cevap vermedi.', type: 'warning' });
          setTimeout(() => router.back(), 1500);
        }
      }, 45000);
    }

    return () => {
      channel.unsubscribe();
      if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
    };
  }, [firebaseUser, callId]);

  // ─── Süre sayacı ──────────────────────────────────────────
  useEffect(() => {
    if (callStatus === 'connected') {
      durationTimerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, [callStatus]);

  // ─── LiveKit Bağlantısı ───────────────────────────────────
  const connectToLiveKit = useCallback(async () => {
    if (!firebaseUser || !callId) return;

    const quality = getCallQuality(tier as any, callType);
    const roomId = CallService.generateRoomId(callId);

    try {
      const connected = await liveKitRef.current.connect(
        roomId,
        firebaseUser.uid,
        profile?.display_name || 'Kullanıcı',
        {
          onParticipantUpdate: (participants: ParticipantUpdate[]) => {
            const remote = participants.find(p => p.identity !== firebaseUser.uid);
            if (remote?.videoTrack) {
              setRemoteVideoTrack(remote.videoTrack);
            }
          },
          onConnectionStateChange: (state) => {
            if (state === 'disconnected') {
              setCallStatus('ended');
            }
          },
          onMicStateChange: (micEnabled) => {
            setIsMuted(!micEnabled);
          },
        },
        {
          audioSampleRate: quality.audioSampleRate,
          audioChannels: quality.audioChannels,
          videoMaxRes: quality.videoMaxRes,
        }
      );

      if (connected) {
        // Mikrofonu aç
        await liveKitRef.current.enableMicrophone();
        // Video ise kamerayı aç
        if (callType === 'video' && quality.videoEnabled) {
          await liveKitRef.current.toggleCamera();
        }
      }
    } catch (err: any) {
      console.error('[Call] LiveKit bağlantı hatası:', err);
      showToast({ title: 'Bağlantı Hatası', message: 'Arama bağlantısı kurulamadı.', type: 'error' });
    }
  }, [firebaseUser, callId, callType, tier]);

  // ─── Aramayı bitir ────────────────────────────────────────
  const handleEndCall = async () => {
    setCallStatus('ended');
    liveKitRef.current.disconnect().catch(() => {});
    if (firebaseUser && id && callId) {
      await CallService.endCall(firebaseUser.uid, id, callId).catch(() => {});
    }
    router.back();
  };

  // ─── Mikrofon toggle ─────────────────────────────────────
  const handleToggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    liveKitRef.current.toggleMicrophone().catch(() => {});
  };

  // ─── Kamera toggle ───────────────────────────────────────
  const handleToggleCamera = () => {
    const newState = !isCameraOn;
    setIsCameraOn(newState);
    liveKitRef.current.toggleCamera().catch(() => {});
  };

  // ─── Süre formatı ────────────────────────────────────────
  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ─── Render ───────────────────────────────────────────────
  const statusText = callStatus === 'calling' ? 'Aranıyor...'
    : callStatus === 'ringing' ? 'Çalıyor...'
    : callStatus === 'connected' ? formatDuration(duration)
    : 'Arama Sonlandı';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Arka plan */}
      <LinearGradient
        colors={['#0A0A12', '#121225', '#0A0A12']}
        style={StyleSheet.absoluteFill}
      />

      {/* Video — varsa */}
      {callType === 'video' && callStatus === 'connected' && (
        <View style={styles.videoContainer}>
          {/* Remote video */}
          {remoteVideoTrack ? (
            <View style={styles.remoteVideo}>
              <Text style={styles.videoPlaceholderText}>📹 Karşı taraf video</Text>
            </View>
          ) : (
            <View style={styles.remoteVideo}>
              <Image
                source={{ uri: otherUser?.avatar_url || 'https://i.pravatar.cc/200?img=3' }}
                style={styles.videoAvatar}
              />
            </View>
          )}

          {/* Local video (küçük pencere) */}
          {isCameraOn && (
            <View style={styles.localVideo}>
              <Text style={styles.localVideoText}>Sen</Text>
            </View>
          )}
        </View>
      )}

      {/* Sesli arama UI */}
      {(callType === 'audio' || callStatus !== 'connected') && (
        <View style={styles.audioUI}>
          <View style={styles.avatarGlow}>
            <Image
              source={{ uri: otherUser?.avatar_url || 'https://i.pravatar.cc/200?img=3' }}
              style={styles.avatar}
            />
          </View>
          <Text style={styles.name}>{otherUser?.display_name || 'Kullanıcı'}</Text>
          <Text style={styles.status}>{statusText}</Text>

          {callType === 'video' && tier === 'Silver' && (
            <View style={styles.tierBanner}>
              <Ionicons name="lock-closed" size={14} color="#FFC107" />
              <Text style={styles.tierText}>Görüntülü arama Plus/VIP gerektirir</Text>
            </View>
          )}
        </View>
      )}

      {/* Kontrol butonları */}
      <View style={styles.controls}>
        {callStatus === 'connected' && (
          <View style={styles.controlRow}>
            {/* Sustur */}
            <TouchableOpacity
              style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
              onPress={handleToggleMute}
            >
              <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={24} color="#fff" />
              <Text style={styles.controlLabel}>{isMuted ? 'Aç' : 'Sustur'}</Text>
            </TouchableOpacity>

            {/* Hoparlör */}
            <TouchableOpacity
              style={[styles.controlBtn, isSpeaker && styles.controlBtnActive]}
              onPress={() => setIsSpeaker(!isSpeaker)}
            >
              <Ionicons name={isSpeaker ? 'volume-high' : 'volume-low'} size={24} color="#fff" />
              <Text style={styles.controlLabel}>{isSpeaker ? 'Hoparlör' : 'Kulaklık'}</Text>
            </TouchableOpacity>

            {/* Kamera (video arama) */}
            {callType === 'video' && (
              <TouchableOpacity
                style={[styles.controlBtn, isCameraOn && styles.controlBtnActive]}
                onPress={handleToggleCamera}
              >
                <Ionicons name={isCameraOn ? 'videocam' : 'videocam-off'} size={24} color="#fff" />
                <Text style={styles.controlLabel}>{isCameraOn ? 'Kamera' : 'Kapalı'}</Text>
              </TouchableOpacity>
            )}

            {/* Kamera çevir */}
            {callType === 'video' && isCameraOn && (
              <TouchableOpacity
                style={styles.controlBtn}
                onPress={() => setIsCameraFront(!isCameraFront)}
              >
                <Ionicons name="camera-reverse" size={24} color="#fff" />
                <Text style={styles.controlLabel}>Çevir</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Kapat butonu */}
        <TouchableOpacity style={styles.endCallBtn} onPress={handleEndCall}>
          <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
        </TouchableOpacity>
      </View>

      {/* Kalite bilgisi */}
      {callStatus === 'connected' && (
        <View style={styles.qualityBadge}>
          <Ionicons name="cellular" size={10} color={Colors.emerald} />
          <Text style={styles.qualityText}>
            {tier === 'VIP' ? 'HD Stereo' : tier === 'Plat' ? 'HD' : 'SD'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A12' },

  // Video
  videoContainer: { flex: 1, position: 'relative' },
  remoteVideo: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' },
  videoAvatar: { width: 120, height: 120, borderRadius: 60, opacity: 0.5 },
  videoPlaceholderText: { color: '#fff', fontSize: 16 },
  localVideo: {
    position: 'absolute', bottom: 160, right: 16,
    width: 100, height: 140, borderRadius: 12,
    backgroundColor: 'rgba(30,30,50,0.9)', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: Colors.teal,
  },
  localVideoText: { color: '#fff', fontSize: 11 },

  // Sesli arama
  audioUI: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 80 },
  avatarGlow: {
    width: 140, height: 140, borderRadius: 70,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: 'rgba(92,225,230,0.3)',
    shadowColor: Colors.teal, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 30,
  },
  avatar: { width: 128, height: 128, borderRadius: 64 },
  name: { fontSize: 24, fontWeight: '700', color: '#fff', marginTop: 24 },
  status: { fontSize: 15, color: 'rgba(255,255,255,0.5)', marginTop: 8 },

  tierBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 16, paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: 'rgba(255,193,7,0.1)', borderRadius: 20,
  },
  tierText: { color: '#FFC107', fontSize: 12 },

  // Kontroller
  controls: { paddingBottom: 60, alignItems: 'center' },
  controlRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 24, marginBottom: 32,
  },
  controlBtn: {
    width: 60, height: 72, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center',
  },
  controlBtnActive: { backgroundColor: 'rgba(92,225,230,0.15)' },
  controlLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 4 },
  endCallBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12,
  },

  // Kalite badge
  qualityBadge: {
    position: 'absolute', top: 58, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  qualityText: { color: Colors.emerald, fontSize: 11, fontWeight: '600' },
});
