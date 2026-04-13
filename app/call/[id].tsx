/**
 * SopranoChat — DM Arama Ekranı (Gerçek Ses/Video)
 * LiveKit üzerinden 1:1 arama — tier bazlı kalite
 * 
 * WhatsApp-style UI + TÜM bug düzeltmeleri:
 *   BUG-4:  onMicStateChange callback düzeltildi (mic+cam)
 *   BUG-9:  handleToggleMute optimistic update kaldırıldı (LiveKit callback ile senkron)
 *   BUG-10: Global liveKitService singleton kullanımı (çift instance yok)
 *   BUG-13: Hoparlör toggle gerçek AudioSession implementasyonu
 *   + 30sn timeout, Çalıyor/Arıyor durumları, süre sayacı, animasyonlar
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, StatusBar, Animated, Easing, BackHandler } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '../../constants/navigation';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import { Colors } from '../../constants/theme';
import { ProfileService, type Profile } from '../../services/database';
import { CallService, getCallQuality, type CallType, type CallStatus } from '../../services/call';
// ★ BUG-10 FIX: Global singleton kullan — çift instance yok
import { liveKitService, type ParticipantUpdate } from '../../services/livekit';
import { showToast } from '../../components/Toast';
import { useAuth } from '../_layout';
import { getAvatarSource } from '../../constants/avatars';

// ★ VideoView — native modül yoksa fallback (placeholder)
let VideoView: any = null;
try { VideoView = require('@livekit/react-native').VideoView; } catch { /* native modül yok */ }

const { width: W, height: H } = Dimensions.get('window');

// ★ BUG-13: AudioSession modülü — hoparlör/kulaklık değişimi için
let _audioSessionModule: any = null;
try {
  const rnLiveKit = require('@livekit/react-native');
  if (rnLiveKit.AudioSession) _audioSessionModule = rnLiveKit.AudioSession;
} catch { /* silent */ }

export default function CallScreen() {
  const router = useRouter();
  const { id, callId, callType: callTypeParam, isIncoming, receiverOnline: receiverOnlineParam } = useLocalSearchParams<{
    id: string;
    callId: string;
    callType: string;
    isIncoming: string;
    receiverOnline: string;
  }>();
  const { firebaseUser, profile, consumeCallSignal, minimizedRoom, setMinimizedRoom, setActiveCallId } = useAuth();

  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>(isIncoming === 'true' ? 'connected' : 'calling');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(callTypeParam === 'video'); // Video aramada varsayılan hoparlör
  const [isCameraOn, setIsCameraOn] = useState(callTypeParam === 'video');
  const [isCameraFront, setIsCameraFront] = useState(true);
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<any>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<any>(null);
  const [remoteCameraOn, setRemoteCameraOn] = useState(false); // ★ Karşı tarafın kamerası açık mı?
  const [receiverOnline] = useState(receiverOnlineParam === 'true');
  const [isReconnecting, setIsReconnecting] = useState(false); // ★ CALL-10
  const [endReason, setEndReason] = useState<string>(''); // ★ CALL-5: Arama sonu sebebi

  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ringTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ringbackSoundRef = useRef<Audio.Sound | null>(null); // ★ Ringback tone (tuuut tuuut)
  const busySoundRef = useRef<Audio.Sound | null>(null); // ★ Meşgul sesi
  const callStatusRef = useRef<CallStatus>(isIncoming === 'true' ? 'connected' : 'calling');
  const mountedRef = useRef(true);
  const signalCleanedRef = useRef(false); // ★ BUG-5: Sinyal kanalı temizleme takibi
  const callType: CallType = (callTypeParam as CallType) || 'audio';
  const tier = profile?.subscription_tier || 'Free';

  // ★ Pulse animasyonu (arıyor durumu)
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  // ─── Profil yükle ─────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    ProfileService.get(id).then(p => { if (mountedRef.current) setOtherUser(p); }).catch(() => {});
  }, [id]);

  // ★ Ses temizleme yardımcı — ringback/busy
  const stopRingbackTone = async () => {
    if (ringbackSoundRef.current) {
      const s = ringbackSoundRef.current;
      ringbackSoundRef.current = null;
      try { await s.stopAsync(); } catch {}
      try { await s.unloadAsync(); } catch {}
    }
  };

  const playBusyTone = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/busy_tone.wav'),
        { shouldPlay: true, volume: 0.6 }
      );
      busySoundRef.current = sound;
      // 2sn sonra otomatik durdur
      setTimeout(async () => {
        if (busySoundRef.current) {
          try { await busySoundRef.current.stopAsync(); } catch {}
          try { await busySoundRef.current.unloadAsync(); } catch {}
          busySoundRef.current = null;
        }
      }, 2000);
    } catch (e) {
      if (__DEV__) console.warn('[Call] Meşgul sesi çalınamadı:', e);
    }
  };

  // ─── Arıyor animasyonu + Ringback Tone ────────────────────
  useEffect(() => {
    if (callStatus === 'calling') {
      pulseAnimRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, easing: Easing.ease, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.ease, useNativeDriver: true }),
        ])
      );
      pulseAnimRef.current.start();

      // ★ Ringback tone — arayan kişi "tuuut tuuut" duyar (sadece outgoing)
      if (isIncoming !== 'true') {
        (async () => {
          try {
            await Audio.setAudioModeAsync({
              allowsRecordingIOS: false,
              playsInSilentModeIOS: true,
              staysActiveInBackground: true,
              shouldDuckAndroid: false,
              playThroughEarpieceAndroid: !isSpeaker,
            });
            const { sound } = await Audio.Sound.createAsync(
              require('../../assets/ringback.wav'),
              { isLooping: true, volume: 0.5, shouldPlay: true }
            );
            if (callStatusRef.current === 'calling') {
              ringbackSoundRef.current = sound;
            } else {
              // Durum değişti, sesi durdur
              await sound.stopAsync().catch(() => {});
              await sound.unloadAsync().catch(() => {});
            }
          } catch (e) {
            if (__DEV__) console.warn('[Call] Ringback tone yüklenemedi:', e);
          }
        })();
      }
    } else {
      pulseAnimRef.current?.stop();
      pulseAnim.setValue(1);
      // ★ Calling durumu bittiğinde ringback'i durdur
      stopRingbackTone();
    }
    return () => {
      pulseAnimRef.current?.stop();
      stopRingbackTone();
    };
  }, [callStatus]);

  // ★ CALL-8: Android geri tuşu koruması
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (callStatusRef.current === 'connected' || callStatusRef.current === 'calling') {
        handleEndCall();
        return true; // Geri tuşunu engelle, handleEndCall aramayı düzgün kapatacak
      }
      return false; // Ended durumunda normal geri git
    });
    return () => backHandler.remove();
  }, []);

  // ─── Signal dinleyici (kabul/red/bitir) — ★ NEW-4 FIX: DeviceEventEmitter direkt kullan ────
  useEffect(() => {
    if (!firebaseUser || !callId) return;

    // ★ NEW-4 FIX: CallService.onCallSignal() ÇAĞIRMA — globalCallChannel'ı ezer
    // Layout zaten globalCallChannel'ı yönetiyor, biz sadece emit edilen sinyalleri dinliyoruz
    const { DeviceEventEmitter } = require('react-native');
    const subscription = DeviceEventEmitter.addListener('onCallSignal', (signal: any) => {
      if (signal.callId !== callId) return;
      // ★ BUG-5: ended durumunda sinyal işleme
      if (callStatusRef.current === 'ended') return;

      if (signal.action === 'call_accepted') {
        setCallStatus('connected');
        callStatusRef.current = 'connected';
        connectToLiveKit();
      } else if (signal.action === 'call_rejected') {
        setCallStatus('ended');
        callStatusRef.current = 'ended';
        setEndReason('Arama Reddedildi');
        setActiveCallId(null);
        setTimeout(() => { if (mountedRef.current) safeGoBack(router); }, 2500);
      } else if (signal.action === 'call_ended') {
        setCallStatus('ended');
        callStatusRef.current = 'ended';
        setEndReason(duration > 0 ? `Arama Süresi: ${formatDuration(duration)}` : 'Arama Sonlandı'); // ★ CALL-5
        setActiveCallId(null);
        liveKitService.disconnect().catch(() => {});
        setTimeout(() => { if (mountedRef.current) safeGoBack(router); }, 3000); // ★ CALL-5: 3sn özet
      } else if (signal.action === 'call_busy') {
        setCallStatus('ended');
        callStatusRef.current = 'ended';
        setEndReason('Meşgul');
        setActiveCallId(null);
        // ★ Meşgul sesi çal (beep-beep)
        stopRingbackTone();
        playBusyTone();
        setTimeout(() => { if (mountedRef.current) safeGoBack(router); }, 2500);
      }
    });

    // ★ Signal kaçırma fix: Mount olmadan önce gelen sinyalleri kontrol et
    if (isIncoming !== 'true') {
      const cachedAccept = consumeCallSignal(callId, 'call_accepted');
      if (cachedAccept) {
        if (__DEV__) console.log('[Call] Cached call_accepted sinyali bulundu — direkt bağlan');
        setCallStatus('connected');
        callStatusRef.current = 'connected';
        connectToLiveKit();
      }
      const cachedReject = consumeCallSignal(callId, 'call_rejected');
      if (cachedReject) {
        if (__DEV__) console.log('[Call] Cached call_rejected sinyali bulundu');
        setCallStatus('ended');
        callStatusRef.current = 'ended';
        setEndReason('Arama Reddedildi');
        setActiveCallId(null);
        setTimeout(() => { if (mountedRef.current) safeGoBack(router); }, 2500);
      }
      // ★ Cached busy kontrolü
      const cachedBusy = consumeCallSignal(callId, 'call_busy');
      if (cachedBusy) {
        if (__DEV__) console.log('[Call] Cached call_busy sinyali bulundu');
        setCallStatus('ended');
        callStatusRef.current = 'ended';
        setEndReason('Meşgul');
        setActiveCallId(null);
        setTimeout(() => { if (mountedRef.current) safeGoBack(router); }, 2500);
      }
    }

    // İncoming call zaten kabul edilmiş — direkt bağlan
    if (isIncoming === 'true') {
      connectToLiveKit();
    }

    // ★ Aktif arama olarak işaretle (meşgul kontrolü için)
    setActiveCallId(callId);

    // ★ WhatsApp tarzı: 30 saniye timeout (45'ten düşürüldü)
    if (callStatusRef.current === 'calling') {
      ringTimerRef.current = setTimeout(async () => {
        if (callStatusRef.current === 'calling') {
          setCallStatus('ended');
          callStatusRef.current = 'ended';
          setEndReason('Cevap Vermedi');
          setActiveCallId(null);

          // Cevapsız arama kaydı oluştur
          if (firebaseUser && id) {
            await CallService.saveMissedCall(
              firebaseUser.uid,
              profile?.display_name || 'Kullanıcı',
              profile?.avatar_url || undefined,
              id,
              callType
            ).catch(() => {});
          }

          setTimeout(() => { if (mountedRef.current) safeGoBack(router); }, 3000); // ★ CALL-5: 3sn özet
        }
      }, 30000); // ★ 30sn timeout
    }

    return () => {
      if (!signalCleanedRef.current) {
        subscription.remove(); // ★ NEW-4 FIX: DeviceEventEmitter listener temizle
        signalCleanedRef.current = true;
      }
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

  // ─── Unmount cleanup ──────────────────────────────────────
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      setActiveCallId(null);
      // ★ Ses tonlarını durdur
      stopRingbackTone();
      if (busySoundRef.current) {
        busySoundRef.current.stopAsync().catch(() => {});
        busySoundRef.current.unloadAsync().catch(() => {});
        busySoundRef.current = null;
      }
      // ★ BUG-10 FIX: Global singleton — sadece disconnect, instance yok edilmez
      liveKitService.disconnect().catch(() => {});
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
      // ★ NEW-3 FIX: AudioMode sıfırla — arama sonrası kulaklık modunda kalmasını önle
      Audio.setAudioModeAsync({
        playThroughEarpieceAndroid: false,
        allowsRecordingIOS: false,
        playsInSilentModeIOS: false,
        staysActiveInBackground: false,
      }).catch(() => {});
    };
  }, []);

  // ─── LiveKit Bağlantısı — ★ BUG-10: Global singleton kullanım ─
  const connectToLiveKit = useCallback(async () => {
    if (!firebaseUser || !callId) return;

    const quality = getCallQuality(tier as any, callType);
    const roomId = CallService.generateRoomId(callId);

    // ★ BUG-10: Eğer kullanıcı bir odadayken arama gelirse, önce disconnect
    // Global singleton zaten tek bağlantı tutar — connect çağrılınca otomatik olarak
    // önceki bağlantıyı keser (LiveKitService.connect içinde this.disconnect() var)

    try {
      const connected = await liveKitService.connect(
        roomId,
        firebaseUser.uid,
        profile?.display_name || 'Kullanıcı',
        {
          onParticipantUpdate: (participants: ParticipantUpdate[]) => {
            if (!mountedRef.current) return;
            
            const remote = participants.find(p => p.identity !== firebaseUser.uid);
            if (remote) {
              setRemoteVideoTrack(remote.videoTrack || null);
              setRemoteCameraOn(!!remote.isCameraEnabled);
            }
            const local = participants.find(p => p.identity === firebaseUser.uid);
            if (local) {
              setLocalVideoTrack(local.videoTrack || null);
            }
          },
          onConnectionStateChange: (state) => {
            if (!mountedRef.current) return;
            if (__DEV__) console.log('[Call] Connection state:', state);

            // ★ CALL-10: Reconnecting UI göster
            if (state === 'reconnecting') {
              setIsReconnecting(true);
            } else {
              setIsReconnecting(false);
            }
            
            if (state === 'disconnected' && callStatusRef.current === 'connected') {
              // 5 saniye bekle, hala disconnected ise kapat
              setTimeout(() => {
                if (!mountedRef.current) return;
                const room = liveKitService.currentRoom;
                if (!room || room.state === 'disconnected') {
                  setCallStatus('ended');
                  callStatusRef.current = 'ended';
                  setEndReason('Bağlantı Koptu');
                  setTimeout(() => { if (mountedRef.current) safeGoBack(router); }, 3000);
                }
              }, 5000);
            }
          },
          // ★ BUG-4 FIX: Hem mic hem cam state'ini doğru al
          onMicStateChange: (micEnabled, camEnabled) => {
            if (!mountedRef.current) return;
            setIsMuted(!micEnabled);
            setIsCameraOn(camEnabled);
          },
          // ★ KRİTİK: Karşı taraf ayrıldığında aramayı sonlandır
          onParticipantDisconnected: (identity) => {
            if (!mountedRef.current) return;
            if (callStatusRef.current === 'ended') return;
            if (__DEV__) console.log(`[Call] ★ Karşı taraf ayrıldı: ${identity}`);
            
            // 1:1 aramada karşı taraf gidince arama biter
            setCallStatus('ended');
            callStatusRef.current = 'ended';
            setEndReason('Karşı Taraf Bağlantıyı Kesti');
            setActiveCallId(null);
            liveKitService.disconnect().catch(() => {});
            
            // Sinyal gönder (karşı taraf zaten ayrılmış ama güvenlik için)
            if (firebaseUser && id && callId) {
              CallService.endCall(firebaseUser.uid, id, callId).catch(() => {});
            }
            
            setTimeout(() => { if (mountedRef.current) safeGoBack(router); }, 3000);
          },
        },
        {
          audioSampleRate: quality.audioSampleRate,
          audioChannels: quality.audioChannels,
          videoMaxRes: quality.videoMaxRes,
        }
      );

      if (connected && mountedRef.current) {
        // Mikrofonu aç
        await liveKitService.enableMicrophone();

        // ★ BUG-13: Varsayılan ses çıkış ayarı
        await updateAudioOutput(callTypeParam === 'video');

        // Video ise kamerayı aç
        if (callType === 'video' && quality.videoEnabled) {
          await new Promise(r => setTimeout(r, 500));
          if (mountedRef.current) {
            await liveKitService.toggleCamera();
            if (__DEV__) console.log('[Call] Kamera açıldı — video track yayınlanıyor');
          }
        }
      }
    } catch (err: any) {
      console.error('[Call] LiveKit bağlantı hatası:', err);
      if (mountedRef.current) {
        showToast({ title: 'Bağlantı Hatası', message: 'Arama bağlantısı kurulamadı.', type: 'error' });
      }
    }
  }, [firebaseUser, callId, callType, tier]);

  // ─── BUG-13 FIX: Gerçek hoparlör/kulaklık değişimi ─────────
  const updateAudioOutput = async (speakerOn: boolean) => {
    try {
      // Yöntem 1: expo-av AudioMode ile ses çıkışını değiştir
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: !speakerOn, // ★ true = kulaklık, false = hoparlör
      });

      // Yöntem 2: LiveKit AudioSession (varsa)
      if (_audioSessionModule && typeof _audioSessionModule.selectAudioOutput === 'function') {
        try {
          await _audioSessionModule.selectAudioOutput(speakerOn ? 'speaker' : 'earpiece');
        } catch { /* bazı cihazlarda desteklenmez */ }
      }

      if (__DEV__) console.log(`[Call] Ses çıkışı: ${speakerOn ? 'Hoparlör' : 'Kulaklık'}`);
    } catch (e) {
      if (__DEV__) console.warn('[Call] Ses çıkışı değiştirilemedi:', e);
    }
  };

  // ─── Aramayı bitir ────────────────────────────────────────
  const handleEndCall = async () => {
    const wasCalling = callStatusRef.current === 'calling';
    const finalDuration = duration;
    setCallStatus('ended');
    callStatusRef.current = 'ended';
    setEndReason(finalDuration > 0 ? `Arama Süresi: ${formatDuration(finalDuration)}` : 'Arama Sonlandı'); // ★ CALL-5
    setActiveCallId(null);
    liveKitService.disconnect().catch(() => {});
    if (firebaseUser && id && callId) {
      await CallService.endCall(firebaseUser.uid, id, callId).catch(() => {});

      // Eğer "Arıyor/Çalıyor" durumundayken kişi kendisi kapattıysa cevapsız arama kaydet
      if (wasCalling) {
        await CallService.saveMissedCall(
          firebaseUser.uid,
          profile?.display_name || 'Kullanıcı',
          profile?.avatar_url || undefined,
          id,
          callType
        ).catch(() => {});
      }
    }
    // ★ CALL-5: 3sn özet göster, sonra geri dön
    setTimeout(() => { if (mountedRef.current) safeGoBack(router); }, 3000);
  };

  // ─── BUG-9 FIX: Mikrofon toggle — LiveKit callback ile senkronize ────
  const handleToggleMute = async () => {
    // ★ BUG-9 FIX: Optimistic update YAPMA — LiveKit callback ile güncellenir
    try {
      await liveKitService.toggleMicrophone();
      // onMicStateChange callback otomatik olarak setIsMuted'u çağıracak
    } catch (e) {
      if (__DEV__) console.warn('[Call] Mikrofon toggle hatası:', e);
    }
  };

  // ─── Kamera toggle ───────────────────────────────────────
  const handleToggleCamera = async () => {
    try {
      await liveKitService.toggleCamera();
      // onMicStateChange callback otomatik olarak setIsCameraOn'u çağıracak
    } catch (e) {
      if (__DEV__) console.warn('[Call] Kamera toggle hatası:', e);
    }
  };

  // ─── Kamera çevir (ön/arka) ──────────────────────────────
  const handleFlipCamera = () => {
    setIsCameraFront(!isCameraFront);
    liveKitService.flipCamera().catch((e) => {
      if (__DEV__) console.warn('[Call] Kamera çevirme hatası:', e);
    });
  };

  // ─── BUG-13: Hoparlör toggle — gerçek ses çıkışı değişimi ─
  const handleToggleSpeaker = async () => {
    const newState = !isSpeaker;
    setIsSpeaker(newState);
    await updateAudioOutput(newState);
  };

  // ─── Süre formatı ────────────────────────────────────────
  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ─── Render ───────────────────────────────────────────────
  // ★ WhatsApp tarzı dinamik status text
  const statusText = callStatus === 'calling'
    ? (receiverOnline ? 'Çalıyor...' : 'Aranıyor...')
    : callStatus === 'ringing' ? 'Çalıyor...'
    : callStatus === 'connected' ? formatDuration(duration)
    : endReason || 'Arama Sonlandı';

  const isVideoConnected = (isCameraOn || remoteCameraOn) && callStatus === 'connected';

  return (
    <View style={st.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ═══ ARKA PLAN ═══ */}
      <LinearGradient
        colors={isVideoConnected ? ['#000', '#000'] : ['#05080F', '#0A1628', '#0D1B30', '#05080F']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* ═══ VİDEO MODU — Tam ekran video + floating overlay'lar ═══ */}
      {isVideoConnected && (
        <View style={st.videoFullscreen}>
          {/* Remote Video — tam ekran */}
          {remoteVideoTrack && remoteCameraOn && VideoView ? (
            <VideoView videoTrack={remoteVideoTrack} style={st.remoteVideo} objectFit="cover" />
          ) : (
            <View style={st.remoteVideoPlaceholder}>
              <View style={st.waitingAvatarGlow}>
                <Image source={getAvatarSource(otherUser?.avatar_url)} style={st.waitingAvatar} />
              </View>
              <Text style={st.waitingText}>{remoteCameraOn ? 'Kamera bekleniyor...' : 'Kamera kapalı'}</Text>
            </View>
          )}

          {/* ★ Üst Gradient Overlay — isim, süre, kalite */}
          <LinearGradient
            colors={['rgba(0,0,0,0.65)', 'rgba(0,0,0,0.25)', 'transparent']}
            style={st.topOverlay}
          >
            <View style={st.topBar}>
              <View style={st.topInfo}>
                <Image source={getAvatarSource(otherUser?.avatar_url)} style={st.topAvatar} />
                <View>
                  <Text style={st.topName}>{otherUser?.display_name || 'Kullanıcı'}</Text>
                  <View style={st.topDurationRow}>
                    <View style={st.liveDot} />
                    <Text style={st.topDuration}>{formatDuration(duration)}</Text>
                  </View>
                </View>
              </View>
              <View style={st.topBadges}>
                <View style={st.qualityPill}>
                  <Ionicons name="cellular" size={10} color={Colors.emerald} />
                  <Text style={st.qualityPillText}>
                    {tier === 'Pro' ? 'HD Stereo' : tier === 'Pro' ? 'HD' : 'SD'}
                  </Text>
                </View>
                {callType === 'video' && isCameraOn && (
                  <TouchableOpacity style={st.flipCamBtn} onPress={handleFlipCamera}>
                    <Ionicons name="camera-reverse" size={18} color="#FFF" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </LinearGradient>

          {/* ★ PiP — Kendi kameranız (WhatsApp boyutunda) */}
          {isCameraOn && (
            <View style={st.pipContainer}>
              {localVideoTrack && VideoView ? (
                <VideoView videoTrack={localVideoTrack} style={st.pipVideo} objectFit="cover" mirror={isCameraFront} />
              ) : (
                <View style={st.pipPlaceholder}>
                  <Ionicons name="person" size={28} color="rgba(255,255,255,0.4)" />
                </View>
              )}
            </View>
          )}

          {/* ★ Alt Gradient Overlay — kontrol butonları */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
            style={st.bottomOverlay}
          >
            <View style={st.videoControls}>
              {/* Mikrofon */}
              <TouchableOpacity style={st.ctrlCircle} onPress={handleToggleMute}>
                <View style={[st.ctrlIconWrap, isMuted && st.ctrlIconWrapActive]}>
                  <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={20} color="#FFF" />
                </View>
                <Text style={st.ctrlLabel}>{isMuted ? 'Aç' : 'Sustur'}</Text>
              </TouchableOpacity>

              {/* Kamera */}
              <TouchableOpacity style={st.ctrlCircle} onPress={handleToggleCamera}>
                <View style={[st.ctrlIconWrap, !isCameraOn && st.ctrlIconWrapActive]}>
                  <Ionicons name={isCameraOn ? 'videocam' : 'videocam-off'} size={20} color="#FFF" />
                </View>
                <Text style={st.ctrlLabel}>Kamera</Text>
              </TouchableOpacity>

              {/* ★ KAPAT — büyük kırmızı */}
              <TouchableOpacity style={st.endBtn} onPress={handleEndCall}>
                <Ionicons name="call" size={28} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>

              {/* Hoparlör */}
              <TouchableOpacity style={st.ctrlCircle} onPress={handleToggleSpeaker}>
                <View style={[st.ctrlIconWrap, isSpeaker && st.ctrlIconWrapActive]}>
                  <Ionicons name={isSpeaker ? 'volume-high' : 'volume-low'} size={20} color="#FFF" />
                </View>
                <Text style={st.ctrlLabel}>{isSpeaker ? 'Hoparlör' : 'Ahize'}</Text>
              </TouchableOpacity>

              {/* Çevir */}
              <TouchableOpacity style={st.ctrlCircle} onPress={handleFlipCamera} disabled={!isCameraOn}>
                <View style={[st.ctrlIconWrap, !isCameraOn && { opacity: 0.3 }]}>
                  <Ionicons name="camera-reverse" size={20} color="#FFF" />
                </View>
                <Text style={st.ctrlLabel}>Çevir</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      )}

      {/* ═══ SESLİ ARAMA veya BAĞLANMAMIŞ DURUM ═══ */}
      {!isVideoConnected && callStatus !== 'ended' && (
        <View style={st.audioScreen}>
          {/* Dekoratif çemberler */}
          <View style={st.decorCircle1} />
          <View style={st.decorCircle2} />
          <View style={st.decorCircle3} />

          {/* Arama tipi göstergesi */}
          <View style={st.callTypePill}>
            <Ionicons name={callType === 'video' ? 'videocam' : 'call'} size={13} color={Colors.teal} />
            <Text style={st.callTypePillText}>
              {callType === 'video' ? 'Görüntülü Arama' : 'Sesli Arama'}
            </Text>
          </View>

          {/* Avatar + pulse */}
          <Animated.View style={[st.avatarOuter, { transform: [{ scale: pulseAnim }] }]}>
            <View style={st.avatarInner}>
              <Image source={getAvatarSource(otherUser?.avatar_url)} style={st.avatarImg} />
            </View>
          </Animated.View>

          {/* İsim */}
          <Text style={st.calleeName}>{otherUser?.display_name || 'Kullanıcı'}</Text>

          {/* Durum */}
          <Text style={[
            st.callStatusText,
            callStatus === 'connected' && { color: Colors.emerald },
          ]}>
            {statusText}
          </Text>

          {/* Online / Tier badge */}
          {callStatus === 'calling' && (
            <View style={st.statusChip}>
              <View style={[st.statusChipDot, { backgroundColor: receiverOnline ? Colors.emerald : '#475569' }]} />
              <Text style={[st.statusChipText, { color: receiverOnline ? Colors.emerald : '#64748B' }]}>
                {receiverOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
              </Text>
            </View>
          )}




          {/* Kalite badge — bağlantı sırasında */}
          {callStatus === 'connected' && (
            <View style={st.statusChip}>
              <Ionicons name="cellular" size={12} color={Colors.emerald} />
              <Text style={[st.statusChipText, { color: Colors.emerald }]}>
                {tier === 'Pro' ? 'HD Stereo' : tier === 'Pro' ? 'HD' : 'SD'}
              </Text>
            </View>
          )}

          {/* ═══ SESLİ KONTROL BUTONLARI ═══ */}
          <View style={st.audioControls}>
            <View style={st.audioControlsRow}>
              {/* Mikrofon */}
              <TouchableOpacity style={st.ctrlCircle} onPress={handleToggleMute}>
                <View style={[st.ctrlIconWrap, isMuted && st.ctrlIconWrapActive]}>
                  <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={22} color="#FFF" />
                </View>
                <Text style={st.ctrlLabel}>{isMuted ? 'Aç' : 'Sustur'}</Text>
              </TouchableOpacity>

              {/* Hoparlör */}
              <TouchableOpacity style={st.ctrlCircle} onPress={handleToggleSpeaker}>
                <View style={[st.ctrlIconWrap, isSpeaker && st.ctrlIconWrapActive]}>
                  <Ionicons name={isSpeaker ? 'volume-high' : 'volume-low'} size={22} color="#FFF" />
                </View>
                <Text style={st.ctrlLabel}>{isSpeaker ? 'Hoparlör' : 'Ahize'}</Text>
              </TouchableOpacity>

              {/* ★ Kamera — tüm arama tiplerinde göster (sesli→görüntülü geçiş) */}
              <TouchableOpacity style={st.ctrlCircle} onPress={handleToggleCamera}>
                <View style={[st.ctrlIconWrap, isCameraOn && st.ctrlIconWrapActive]}>
                  <Ionicons name={isCameraOn ? 'videocam' : 'videocam-off'} size={22} color="#FFF" />
                </View>
                <Text style={st.ctrlLabel}>Kamera</Text>
              </TouchableOpacity>
            </View>

            {/* KAPAT */}
            <TouchableOpacity style={st.endBtn} onPress={handleEndCall}>
              <Ionicons name="call" size={28} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ═══ CALL-10: Yeniden bağlanma ═══ */}
      {isReconnecting && (
        <View style={st.reconnectOverlay}>
          <View style={st.reconnectPill}>
            <Ionicons name="reload" size={14} color="#FFC107" />
            <Text style={st.reconnectText}>Yeniden bağlanılıyor...</Text>
          </View>
        </View>
      )}

      {/* ═══ CALL-5: Arama Sonu Özet ═══ */}
      {callStatus === 'ended' && (
        <View style={st.endOverlay}>
          <View style={st.endCard}>
            {/* Üst ikon */}
            <View style={[
              st.endIconCircle,
              endReason.includes('Süresi') ? { borderColor: 'rgba(5,150,105,0.3)' } : { borderColor: 'rgba(239,68,68,0.3)' }
            ]}>
              <Ionicons
                name={callType === 'video' ? 'videocam' : 'call'}
                size={28}
                color={endReason.includes('Süresi') ? Colors.emerald : '#EF4444'}
              />
            </View>

            <Text style={st.endTitle}>
              {endReason.includes('Süresi') ? 'Arama Tamamlandı' : 'Arama Sonlandı'}
            </Text>

            <Text style={[
              st.endReasonText,
              endReason.includes('Süresi') && { color: Colors.emerald }
            ]}>
              {endReason}
            </Text>

            {/* Kullanıcı bilgisi */}
            <View style={st.endUserRow}>
              <Image source={getAvatarSource(otherUser?.avatar_url)} style={st.endUserAvatar} />
              <Text style={st.endUserName}>{otherUser?.display_name || 'Kullanıcı'}</Text>
            </View>

            {/* Geri sayım göstergesi */}
            <Text style={st.endAutoClose}>Otomatik kapanıyor...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// STİLLER — WhatsApp kalitesi + SopranoChat DNA (teal, glass, dark)
// ═══════════════════════════════════════════════════════════════
const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05080F' },

  // ═══ VİDEO TAM EKRAN ═══
  videoFullscreen: { flex: 1, position: 'relative', backgroundColor: '#000' },
  remoteVideo: { flex: 1, width: '100%', height: '100%' },
  remoteVideoPlaceholder: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#0A0F1A',
  },
  waitingAvatarGlow: {
    width: 120, height: 120, borderRadius: 60,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'rgba(92,225,230,0.2)',
    shadowColor: Colors.teal, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3, shadowRadius: 20,
  },
  waitingAvatar: { width: 108, height: 108, borderRadius: 54 },
  waitingText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 16 },

  // ★ Üst overlay
  topOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingTop: 54, paddingBottom: 24, paddingHorizontal: 16,
    zIndex: 5,
  },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  topInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  topAvatar: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)',
  },
  topName: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  topDurationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  liveDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: Colors.emerald,
  },
  topDuration: {
    fontSize: 12, fontWeight: '600', color: Colors.emerald,
    fontVariant: ['tabular-nums'],
  },
  topBadges: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qualityPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  qualityPillText: { color: Colors.emerald, fontSize: 10, fontWeight: '600' },
  flipCamBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },

  // ★ PiP penceresi (büyük, WhatsApp boyutunda)
  pipContainer: {
    position: 'absolute', top: 110, right: 16,
    width: 110, height: 160, borderRadius: 14,
    backgroundColor: '#0A0F1A', overflow: 'hidden' as const,
    borderWidth: 2, borderColor: 'rgba(92,225,230,0.25)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 10, elevation: 12,
  },
  pipVideo: { width: '100%', height: '100%' },
  pipPlaceholder: {
    width: '100%', height: '100%',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#0D1525',
  },

  // ★ Alt overlay
  bottomOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingBottom: 50, paddingTop: 40,
    zIndex: 5,
  },
  videoControls: {
    flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'flex-start',
    paddingHorizontal: 12,
  },

  // ═══ SESLİ ARAMA EKRANI ═══
  audioScreen: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingBottom: 40, paddingHorizontal: 32,
  },

  // Dekoratif çemberler (premium hissi)
  decorCircle1: {
    position: 'absolute', top: -60, right: -80,
    width: 300, height: 300, borderRadius: 150,
    borderWidth: 1, borderColor: 'rgba(92,225,230,0.04)',
  },
  decorCircle2: {
    position: 'absolute', bottom: -40, left: -100,
    width: 350, height: 350, borderRadius: 175,
    borderWidth: 1, borderColor: 'rgba(92,225,230,0.03)',
  },
  decorCircle3: {
    position: 'absolute', top: '30%', left: '15%',
    width: 200, height: 200, borderRadius: 100,
    borderWidth: 1, borderColor: 'rgba(92,225,230,0.02)',
  },

  callTypePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(92,225,230,0.08)',
    borderWidth: 1, borderColor: 'rgba(92,225,230,0.12)',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    marginBottom: 40,
  },
  callTypePillText: { fontSize: 12, fontWeight: '600', color: Colors.teal, letterSpacing: 0.3 },

  // Avatar
  avatarOuter: {
    width: 160, height: 160, borderRadius: 80,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: 'rgba(92,225,230,0.15)',
    shadowColor: Colors.teal, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3, shadowRadius: 40,
    marginBottom: 28,
  },
  avatarInner: {
    width: 144, height: 144, borderRadius: 72,
    borderWidth: 2, borderColor: 'rgba(92,225,230,0.1)',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%', borderRadius: 72 },

  calleeName: {
    fontSize: 26, fontWeight: '800', color: '#FFF',
    letterSpacing: -0.3, marginBottom: 8,
  },
  callStatusText: {
    fontSize: 15, color: 'rgba(255,255,255,0.5)', fontWeight: '500',
    marginBottom: 16,
  },

  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    marginBottom: 8,
  },
  statusChipDot: { width: 7, height: 7, borderRadius: 4 },
  statusChipText: { fontSize: 12, fontWeight: '500' },

  tierChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,193,7,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,193,7,0.15)',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    marginBottom: 8,
  },
  tierChipText: { color: '#FFC107', fontSize: 12, fontWeight: '500' },

  // Sesli arama kontrolleri
  audioControls: {
    position: 'absolute', bottom: 60, left: 0, right: 0,
    alignItems: 'center', gap: 28,
  },
  audioControlsRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 24,
  },

  // ═══ ORTAK KONTROL BUTONLARI ═══
  ctrlCircle: { alignItems: 'center', gap: 6 },
  ctrlCircleActive: {},
  ctrlIconWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  ctrlIconWrapActive: {
    backgroundColor: 'rgba(92,225,230,0.2)',
    borderColor: 'rgba(92,225,230,0.3)',
  },
  ctrlLabel: {
    fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.2,
  },

  // Kapat butonu
  endBtn: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: '#EF4444',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 16, elevation: 8,
    borderWidth: 2, borderColor: 'rgba(239,68,68,0.6)',
  },

  // ═══ YENİDEN BAĞLANMA ═══
  reconnectOverlay: {
    position: 'absolute', top: 100, left: 0, right: 0,
    alignItems: 'center', zIndex: 20,
  },
  reconnectPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,193,7,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,193,7,0.25)',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
  },
  reconnectText: { color: '#FFC107', fontSize: 12, fontWeight: '600' },

  // ═══ ARAMA SONU ÖZET ═══
  endOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(5,8,15,0.92)',
    zIndex: 30,
  },
  endCard: {
    width: W * 0.78,
    backgroundColor: 'rgba(15,23,42,0.9)',
    borderRadius: 28,
    paddingVertical: 36, paddingHorizontal: 28,
    alignItems: 'center', gap: 14,
    borderWidth: 1, borderColor: 'rgba(92,225,230,0.08)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 15,
  },
  endIconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 2,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  endTitle: {
    fontSize: 18, fontWeight: '700', color: '#FFF', letterSpacing: -0.3,
  },
  endReasonText: {
    fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.5)',
  },
  endUserRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 8, paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
  },
  endUserAvatar: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  endUserName: {
    fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.7)',
  },
  endAutoClose: {
    fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4,
  },
});

