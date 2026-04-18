/**
 * SopranoChat — Gelen Arama Overlay (WhatsApp Tarzı Tam Ekran — Yalnız Sesli)
 * Full-screen overlay, 35sn auto-dismiss, anında ses kesme
 * ★ Cihazın varsayılan zil sesini kullanır (Android)
 * ★ Fallback: Gömülü ringtone.mp3
 */
import { View, Text, StyleSheet, Image, TouchableOpacity, Animated, Vibration, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/theme';
import { getAvatarSource } from '../constants/avatars';
import { Platform } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

type Props = {
  visible: boolean;
  callerName: string;
  callerAvatar?: string;
  callType?: string; // backward compat — artık her zaman 'audio'
  onAccept: () => void;
  onReject: () => void;
};

export function IncomingCallOverlay({ visible, callerName, callerAvatar, callType, onAccept, onReject }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringPulseAnim = useRef(new Animated.Value(0.4)).current;
  const acceptBtnAnim = useRef(new Animated.Value(0)).current;
  const rejectBtnAnim = useRef(new Animated.Value(0)).current;
  const soundRef = useRef<Audio.Sound | null>(null);
  const cleaningUpRef = useRef(false);
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ★ CALL-3 FIX: Senkron ses durdurma — kabul/red'de ANINDA çağrılır
  const stopSoundImmediately = useCallback(async () => {
    if (cleaningUpRef.current) return;
    cleaningUpRef.current = true;
    try {
      if (soundRef.current) {
        const sound = soundRef.current;
        soundRef.current = null;
        try { await sound.stopAsync(); } catch { /* silent */ }
        try { await sound.unloadAsync(); } catch { /* silent */ }
      }
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: false,
          staysActiveInBackground: false,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
        });
      } catch { /* silent */ }
    } finally {
      cleaningUpRef.current = false;
    }
  }, []);

  // ★ ORTA-J: Zombie state engeli — handleAccept/Reject sadece bir kez çalışsın.
  // Senaryo: 35sn timeout → handleReject + aynı anda user "Kabul Et" basıyor veya
  // karşı taraf "arama sonlandır" sinyali geliyor → double-fire.
  const actedRef = useRef(false);

  const handleAccept = useCallback(() => {
    if (actedRef.current) return;
    actedRef.current = true;
    Vibration.cancel();
    stopSoundImmediately();
    if (autoCloseTimerRef.current) { clearTimeout(autoCloseTimerRef.current); autoCloseTimerRef.current = null; }
    onAccept();
  }, [onAccept, stopSoundImmediately]);

  const handleReject = useCallback(() => {
    if (actedRef.current) return;
    actedRef.current = true;
    Vibration.cancel();
    stopSoundImmediately();
    if (autoCloseTimerRef.current) { clearTimeout(autoCloseTimerRef.current); autoCloseTimerRef.current = null; }
    onReject();
  }, [onReject, stopSoundImmediately]);

  // ★ Zil sesi + titreşim + animasyon
  useEffect(() => {
    let isCancelled = false;

    if (visible) {
      cleaningUpRef.current = false;
      // ★ ORTA-J: Overlay yeniden görünürse acted flag'i sıfırla (yeni çağrı)
      actedRef.current = false;

      // Titreşim pattern
      const vibratePattern = [0, 800, 400, 800, 400, 800];
      Vibration.vibrate(vibratePattern, true);

      // ★ Cihazın varsayılan zil sesini çal (Android)
      // Fallback: Gömülü ringtone.mp3
      (async () => {
        try {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
          });
          if (isCancelled) return;

          let sound: Audio.Sound | null = null;

          // Android: Cihazın varsayılan zil sesini dene
          if (Platform.OS === 'android') {
            try {
              const { sound: sysSound } = await Audio.Sound.createAsync(
                { uri: 'content://settings/system/ringtone' },
                { isLooping: true, volume: 1.0, shouldPlay: true }
              );
              sound = sysSound;
            } catch {
              // Sistem zil sesi alınamazsa fallback
              sound = null;
            }
          }

          // Fallback: Gömülü ringtone
          if (!sound) {
            const { sound: fallbackSound } = await Audio.Sound.createAsync(
              require('../assets/ringtone.mp3'),
              { isLooping: true, volume: 1.0, shouldPlay: true }
            );
            sound = fallbackSound;
          }

          if (isCancelled) {
            await sound.stopAsync().catch(() => {});
            await sound.unloadAsync().catch(() => {});
            return;
          }
          soundRef.current = sound;
        } catch (e) {
          if (__DEV__) console.warn('[IncomingCall] Zil sesi yüklenemedi:', e);
        }
      })();

      // ★ Fade-in animasyonu
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // ★ Avatar pulse animasyonu
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();

      // ★ Halka pulse animasyonu (ring effect)
      Animated.loop(
        Animated.sequence([
          Animated.timing(ringPulseAnim, { toValue: 0.8, duration: 1200, useNativeDriver: true }),
          Animated.timing(ringPulseAnim, { toValue: 0.4, duration: 1200, useNativeDriver: true }),
        ])
      ).start();

      // ★ Buton giriş animasyonu
      Animated.stagger(100, [
        Animated.spring(rejectBtnAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }),
        Animated.spring(acceptBtnAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }),
      ]).start();

      // ★ CALL-2 FIX: 35sn otomatik kapanma — arayan taraftan 5sn sonra
      autoCloseTimerRef.current = setTimeout(() => {
        if (__DEV__) console.log('[IncomingCall] 35sn timeout — overlay otomatik kapanıyor');
        handleReject();
      }, 35000);
    } else {
      // Kapanış
      Vibration.cancel();
      stopSoundImmediately();

      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();

      acceptBtnAnim.setValue(0);
      rejectBtnAnim.setValue(0);
    }

    return () => {
      isCancelled = true;
      Vibration.cancel();
      stopSoundImmediately();
      if (autoCloseTimerRef.current) { clearTimeout(autoCloseTimerRef.current); autoCloseTimerRef.current = null; }
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <LinearGradient
        colors={['#0A0A18', '#0F1126', '#0A0A18']}
        style={styles.gradient}
      >
        {/* Üst kısım — arama türü */}
        <View style={styles.topSection}>
          <Ionicons
            name="call"
            size={18}
            color={Colors.teal}
          />
          <Text style={styles.callTypeLabel}>Sesli Arama</Text>
        </View>

        {/* Orta kısım — avatar + bilgi */}
        <View style={styles.centerSection}>
          {/* Pulse halka efekti */}
          <Animated.View style={[styles.pulseRing, { opacity: ringPulseAnim, transform: [{ scale: pulseAnim }] }]} />
          <Animated.View style={[styles.pulseRing2, { opacity: ringPulseAnim }]} />
          
          <Animated.View style={[styles.avatarWrap, { transform: [{ scale: pulseAnim }] }]}>
            <Image
              source={getAvatarSource(callerAvatar)}
              style={styles.avatar}
            />
          </Animated.View>
          
          <Text style={styles.callerName} numberOfLines={1}>{callerName}</Text>
          <Text style={styles.statusText}>Arıyor...</Text>
        </View>

        {/* Alt kısım — butonlar */}
        <View style={styles.bottomSection}>
          {/* Red butonu */}
          <Animated.View style={{ transform: [{ scale: rejectBtnAnim }] }}>
            <TouchableOpacity style={styles.rejectBtn} onPress={handleReject} activeOpacity={0.7}>
              <View style={styles.rejectBtnInner}>
                <Ionicons name="close" size={32} color="#fff" />
              </View>
              <Text style={styles.btnLabel}>Reddet</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Kabul butonu */}
          <Animated.View style={{ transform: [{ scale: acceptBtnAnim }] }}>
            <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept} activeOpacity={0.7}>
              <View style={styles.acceptBtnInner}>
                <Ionicons name="call" size={28} color="#fff" />
              </View>
              <Text style={styles.btnLabel}>Kabul Et</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 9999,
    elevation: 999,
  },
  gradient: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 80,
  },

  // Üst
  topSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: 'rgba(92,225,230,0.08)',
    borderRadius: 20,
  },
  callTypeLabel: {
    fontSize: 14,
    color: Colors.teal,
    fontWeight: '600',
  },

  // Orta
  centerSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 180, height: 180, borderRadius: 90,
    borderWidth: 2,
    borderColor: 'rgba(92,225,230,0.3)',
  },
  pulseRing2: {
    position: 'absolute',
    width: 220, height: 220, borderRadius: 110,
    borderWidth: 1,
    borderColor: 'rgba(92,225,230,0.15)',
  },
  avatarWrap: {
    width: 130, height: 130, borderRadius: 65,
    borderWidth: 3,
    borderColor: 'rgba(92,225,230,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.teal,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 20,
  },
  avatar: { width: 120, height: 120, borderRadius: 60 },
  callerName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    marginTop: 28,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  statusText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 8,
    fontWeight: '500',
  },

  // Alt — butonlar
  bottomSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 80,
    alignItems: 'center',
  },
  rejectBtn: {
    alignItems: 'center',
    gap: 10,
  },
  rejectBtnInner: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  acceptBtn: {
    alignItems: 'center',
    gap: 10,
  },
  acceptBtnInner: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  btnLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
});
