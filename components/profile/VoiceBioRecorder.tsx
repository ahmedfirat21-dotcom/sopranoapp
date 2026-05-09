/**
 * SopranoChat — Sesli Tanıtım Kayıt Modal
 * v110.5 (6 May 2026)
 *
 * Edit profile sayfasından açılan modal. Kullanıcı 3-30sn arası ses
 * kaydeder, dinleyip onaylarsa upload edilir.
 *
 * Kayıt durumları:
 *  idle → kayıt başlat
 *  recording → durdur (max 30sn auto-stop)
 *  preview → dinle / yeniden kaydet / kaydet
 *  uploading → spinner
 */
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppLoader from '../AppLoader';
import { Shadows } from '../../constants/theme';
import { showToast } from '../Toast';
import {
  VoiceBioService,
  VOICE_BIO_MIN_MS, VOICE_BIO_MAX_MS,
} from '../../services/profileExtras';

const { height: H } = Dimensions.get('window');

type Props = {
  visible: boolean;
  userId: string;
  currentUrl: string | null;
  currentDurationMs: number | null;
  onClose: () => void;
  onSaved: (url: string, durationMs: number) => void;
  onRemoved: () => void;
};

type Phase = 'idle' | 'recording' | 'preview' | 'uploading';

export default function VoiceBioRecorder({
  visible, userId, currentUrl, currentDurationMs, onClose, onSaved, onRemoved,
}: Props) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('idle');
  const [recordingMs, setRecordingMs] = useState(0);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const previewSoundRef = useRef<Audio.Sound | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(H + 50)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Açılış/kapanış
  useEffect(() => {
    if (visible) {
      setPhase('idle');
      setRecordingMs(0);
      setRecordingUri(null);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 60, useNativeDriver: true, damping: 22, stiffness: 200 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      stopAll().catch(() => {});
      Animated.parallel([
        Animated.timing(translateY, { toValue: H + 50, duration: 200, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  // Kayıt sırasında pulse animasyonu
  useEffect(() => {
    if (phase !== 'recording') { pulseAnim.stopAnimation(); pulseAnim.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [phase]);

  const stopAll = async () => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    if (recordingRef.current) {
      try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
      recordingRef.current = null;
    }
    if (previewSoundRef.current) {
      try { await previewSoundRef.current.unloadAsync(); } catch {}
      previewSoundRef.current = null;
    }
  };

  useEffect(() => () => { stopAll().catch(() => {}); }, []);

  const handleStartRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        showToast({ title: 'Mikrofon izni gerekli', type: 'warning' });
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      setPhase('recording');
      setRecordingMs(0);
      const startTs = Date.now();
      tickRef.current = setInterval(() => {
        const elapsed = Date.now() - startTs;
        setRecordingMs(elapsed);
        if (elapsed >= VOICE_BIO_MAX_MS) {
          handleStopRecording();
        }
      }, 100);
    } catch (e: any) {
      showToast({ title: 'Kayıt başlatılamadı', message: e?.message || '', type: 'error' });
      setPhase('idle');
    }
  };

  const handleStopRecording = async () => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    if (!recordingRef.current) return;
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      if (!uri) throw new Error('Kayıt URI yok');
      const finalMs = recordingMs;
      recordingRef.current = null;
      if (finalMs < VOICE_BIO_MIN_MS) {
        showToast({ title: 'Çok kısa', message: 'En az 3 saniye kaydet', type: 'warning' });
        setPhase('idle');
        setRecordingMs(0);
        return;
      }
      setRecordingUri(uri);
      setPhase('preview');
    } catch (e: any) {
      showToast({ title: 'Kayıt sonlanmadı', message: e?.message || '', type: 'error' });
      setPhase('idle');
    }
  };

  const handlePreviewToggle = async () => {
    if (!recordingUri) return;
    try {
      if (previewPlaying && previewSoundRef.current) {
        await previewSoundRef.current.pauseAsync();
        setPreviewPlaying(false);
        return;
      }
      if (previewSoundRef.current) {
        await previewSoundRef.current.replayAsync();
        setPreviewPlaying(true);
        return;
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri: recordingUri }, { shouldPlay: true },
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            setPreviewPlaying(false);
          }
        },
      );
      previewSoundRef.current = sound;
      setPreviewPlaying(true);
    } catch {
      setPreviewPlaying(false);
    }
  };

  const handleSave = async () => {
    if (!recordingUri) return;
    setPhase('uploading');
    try {
      const url = await VoiceBioService.upload(userId, recordingUri, recordingMs, currentUrl);
      onSaved(url, recordingMs);
      showToast({ title: 'Sesli tanıtım kaydedildi', type: 'success' });
      onCloseRef.current();
    } catch (e: any) {
      showToast({ title: 'Yükleme başarısız', message: e?.message || '', type: 'error' });
      setPhase('preview');
    }
  };

  const handleRetake = async () => {
    await stopAll();
    setRecordingUri(null);
    setRecordingMs(0);
    setPreviewPlaying(false);
    setPhase('idle');
  };

  const handleRemoveExisting = async () => {
    setPhase('uploading');
    try {
      await VoiceBioService.remove(userId, currentUrl);
      onRemoved();
      showToast({ title: 'Sesli tanıtım kaldırıldı', type: 'info' });
      onCloseRef.current();
    } catch (e: any) {
      showToast({ title: 'Silinemedi', message: e?.message || '', type: 'error' });
      setPhase('idle');
    }
  };

  const handleClose = () => {
    if (phase === 'recording' || phase === 'uploading') return;
    onClose();
  };

  if (!visible) return null;

  const formatMs = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const cs = Math.floor((ms % 1000) / 100);
    return `${s.toString().padStart(2, '0')}.${cs}`;
  };

  const progress = Math.min(1, recordingMs / VOICE_BIO_MAX_MS);

  return (
    <View style={s.root} pointerEvents="box-none">
      <Animated.View
        style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(8,12,22,0.55)', opacity: backdropOpacity }]}
        pointerEvents="auto"
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>

      <Animated.View style={[s.sheet, { transform: [{ translateY }] }]}>
        <LinearGradient
          colors={['#3a4658', '#2a3344', '#1a2030']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(245,158,11,0.20)', 'rgba(245,158,11,0.05)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        {/* Header */}
        <View style={s.handleWrap}>
          <View style={s.dragHandle} />
        </View>
        <View style={s.header}>
          <Pressable
            onPress={handleClose}
            disabled={phase === 'recording' || phase === 'uploading'}
            style={s.iconBtn}
            hitSlop={8}
          >
            <Ionicons name="chevron-down" size={22} color="#F1F5F9" />
          </Pressable>
          <Text style={s.title}>SESLİ TANITIM</Text>
          <View style={{ width: 34 }} />
        </View>

        {/* Body */}
        <View style={[s.body, { paddingBottom: 24 + insets.bottom }]}>
          <Text style={s.hint}>
            Kendini 3-30 saniye arası tanıt. Yabancı kullanıcılar profilinde
            bu kaydı dinleyerek seni daha iyi tanır.
          </Text>

          {/* Süre göstergesi */}
          <Text style={s.timer}>{formatMs(recordingMs)}</Text>
          <Text style={s.timerSub}>/ 30 saniye</Text>

          {/* Progress bar */}
          <View style={s.progressBg}>
            <View style={[s.progressFill, { width: `${progress * 100}%` }]} />
          </View>

          {/* Ana aksiyon butonu */}
          <View style={s.mainAction}>
            {phase === 'idle' && (
              <>
                <Pressable
                  onPress={handleStartRecording}
                  style={({ pressed }) => [s.recordBtn, pressed && { opacity: 0.85 }]}
                >
                  <LinearGradient
                    colors={['#EF4444', '#B91C1C']}
                    start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <Ionicons name="mic" size={32} color="#FFF" />
                </Pressable>
                <Text style={s.actionLabel}>Kaydı Başlat</Text>
                {currentUrl && (
                  <Pressable
                    onPress={handleRemoveExisting}
                    style={({ pressed }) => [s.removeBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Ionicons name="trash-outline" size={14} color="#EF4444" />
                    <Text style={s.removeText}>Mevcut tanıtımı kaldır</Text>
                  </Pressable>
                )}
              </>
            )}

            {phase === 'recording' && (
              <>
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <Pressable
                    onPress={handleStopRecording}
                    style={({ pressed }) => [s.recordBtn, pressed && { opacity: 0.85 }]}
                  >
                    <LinearGradient
                      colors={['#EF4444', '#7F1D1D']}
                      start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                      style={StyleSheet.absoluteFillObject}
                    />
                    <View style={s.stopSquare} />
                  </Pressable>
                </Animated.View>
                <Text style={[s.actionLabel, { color: '#FCA5A5' }]}>Kayıt sürüyor — bitirmek için bas</Text>
              </>
            )}

            {phase === 'preview' && (
              <>
                <Pressable
                  onPress={handlePreviewToggle}
                  style={({ pressed }) => [s.recordBtn, pressed && { opacity: 0.85 }]}
                >
                  <LinearGradient
                    colors={['#14B8A6', '#0F766E']}
                    start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <Ionicons name={previewPlaying ? 'pause' : 'play'} size={32} color="#FFF" />
                </Pressable>
                <Text style={s.actionLabel}>{previewPlaying ? 'Durdur' : 'Önizle'}</Text>

                <View style={s.previewActions}>
                  <Pressable
                    onPress={handleRetake}
                    style={({ pressed }) => [s.btnGhost, pressed && { opacity: 0.7 }]}
                  >
                    <Ionicons name="refresh" size={14} color="#94A3B8" />
                    <Text style={s.btnGhostText}>Yeniden Kaydet</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSave}
                    style={({ pressed }) => [s.btnPrimary, pressed && { opacity: 0.85 }]}
                  >
                    <LinearGradient
                      colors={['#F59E0B', '#B45309']}
                      start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                      style={StyleSheet.absoluteFillObject}
                    />
                    <Ionicons name="cloud-upload" size={15} color="#FFF" />
                    <Text style={s.btnPrimaryText}>Kaydet</Text>
                  </Pressable>
                </View>
              </>
            )}

            {phase === 'uploading' && (
              <>
                <View style={[s.recordBtn, { backgroundColor: 'rgba(245,158,11,0.4)' }]}>
                  <AppLoader size="small" color="#FFF" />
                </View>
                <Text style={s.actionLabel}>Yükleniyor...</Text>
              </>
            )}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 1000,
  },
  sheet: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    overflow: 'hidden',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
  },
  handleWrap: { alignItems: 'center', paddingTop: 8 },
  dragHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 12,
  },
  iconBtn: {
    width: 34, height: 34, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 14, fontWeight: '900' as const, color: '#F1F5F9',
    letterSpacing: 1.5, textAlign: 'center' as const,
    ...Shadows.text,
  },
  body: {
    flex: 1, paddingHorizontal: 24,
    alignItems: 'center', justifyContent: 'flex-start',
    paddingTop: 24,
  },
  hint: {
    fontSize: 12, color: '#94A3B8', textAlign: 'center' as const,
    lineHeight: 18, marginBottom: 20, paddingHorizontal: 16,
  },
  timer: {
    fontSize: 48, fontWeight: '900' as const, color: '#F1F5F9',
    letterSpacing: 2, fontVariant: ['tabular-nums' as const],
    ...Shadows.text,
  },
  timerSub: {
    fontSize: 11, fontWeight: '600' as const, color: '#94A3B8',
    letterSpacing: 0.4, marginTop: -4, marginBottom: 16,
  },
  progressBg: {
    height: 6, width: '100%', borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden', marginBottom: 32,
  },
  progressFill: {
    height: '100%', borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  mainAction: {
    alignItems: 'center', gap: 14,
  },
  recordBtn: {
    width: 84, height: 84, borderRadius: 42,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.25)',
    ...Shadows.card,
  },
  stopSquare: {
    width: 24, height: 24, borderRadius: 4,
    backgroundColor: '#FFF',
  },
  actionLabel: {
    fontSize: 13, fontWeight: '700' as const, color: '#CBD5E1',
    letterSpacing: 0.4,
  },
  previewActions: {
    flexDirection: 'row', gap: 12, marginTop: 8,
  },
  btnGhost: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  btnGhostText: {
    fontSize: 12, fontWeight: '700' as const, color: '#CBD5E1',
  },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.5)',
  },
  btnPrimaryText: {
    fontSize: 12, fontWeight: '900' as const, color: '#FFF',
    letterSpacing: 0.4, ...Shadows.text,
  },
  removeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    marginTop: 8,
  },
  removeText: {
    fontSize: 11, color: '#EF4444', fontWeight: '700' as const, letterSpacing: 0.2,
  },
});
