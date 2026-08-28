/**
 * SopranoChat — Room Disconnect Overlay
 * ★ 2026-04-26: Kullanıcı odadan düştüğünde / LiveKit bağlantısı koptuğunda full-screen feedback.
 *   Eski: avatar kayboluyordu ama UI hâlâ "bağlıyım" hissi veriyordu — kullanıcı kafası karışıyordu.
 *   Şimdi: net mesaj + "Tekrar Dene" / "Odadan Çık" CTA.
 */
import { useEffect, useRef } from 'react';
import { i18n } from '../../services/i18n';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../constants/theme';

const iconShadow = {
  textShadowColor: 'rgba(0,0,0,0.5)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 4,
} as const;

type Props = {
  /** LiveKit connection state */
  state: 'connected' | 'connecting' | 'reconnecting' | 'disconnected' | 'failed';
  /** "Tekrar Dene" — yeniden bağlan */
  onRetry: () => void;
  /** "Odadan Çık" */
  onLeave: () => void;
};

export default function RoomDisconnectOverlay({ state, onRetry, onLeave }: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  // ★ v1.7.13.90 (20 May 2026): FLASH FIX — sayfa ilk açıldığında state 'disconnected'
  //   veya undefined olabilir (LiveKit henüz başlatılmadı). Eski koşul
  //   (state !== 'connected' && state !== 'connecting') initial state'i de yakalıyordu
  //   → 1sn "Bağlantı kurulamadı" flash. Şimdi: SADECE gerçek disconnect olaylarında
  //   göster (reconnecting / failed). 'disconnected' / undefined ignore — bu initial
  //   state veya temiz çıkış durumudur; room screen'in kendi roomBlock akışı zaten
  //   gerçek fail durumunu yakalar (3sn grace ile).
  const visible = state === 'reconnecting' || state === 'failed';

  useEffect(() => {
    Animated.timing(fade, {
      toValue: visible ? 1 : 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [visible, fade]);

  if (!visible) return null;

  const isReconnecting = state === 'reconnecting';
  const title = isReconnecting ? i18n.t('auto.room.RoomDisconnectOverlay.004') : i18n.t('auto.room.RoomDisconnectOverlay.003');
  const message = isReconnecting
    ? i18n.t('auto.room.RoomDisconnectOverlay.002')
    : i18n.t('auto.room.RoomDisconnectOverlay.001');

  return (
    <Animated.View style={[s.root, { opacity: fade }]} pointerEvents="auto">
      {/* ★ 2026-04-26: Arka plan tam opak — odanın içi görünmesin (kullanıcı kafası karışmasın) */}
      <LinearGradient
        colors={['#0B1520', '#0a0f16', '#000']}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={s.card}>
        <View style={[s.iconWrap, isReconnecting ? s.iconReconnect : s.iconError]}>
          <Ionicons
            name={isReconnecting ? 'sync' : 'cloud-offline'}
            size={40}
            color={isReconnecting ? '#FBBF24' : '#EF4444'}
            style={iconShadow}
          />
        </View>

        <Text style={s.title}>{title}</Text>
        <Text style={s.message}>{message}</Text>

        {!isReconnecting && (
          <View style={s.buttons}>
            <Pressable style={s.btnSecondary} onPress={onLeave}>
              <Ionicons name="exit-outline" size={16} color="#94A3B8" />
              <Text style={s.btnSecondaryText}>{i18n.t('room.roomdisconnectoverlay.001')}</Text>
            </Pressable>
            <Pressable style={s.btnPrimary} onPress={onRetry}>
              <LinearGradient
                colors={['#14B8A6', '#0D9488']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Ionicons name="refresh" size={16} color="#FFF" style={iconShadow} />
              <Text style={s.btnPrimaryText}>Tekrar Dene</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 500,
  },
  card: {
    width: '85%', maxWidth: 380,
    paddingVertical: 32, paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: 'rgba(20,30,45,0.95)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    ...Shadows.card,
  },
  iconWrap: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
  },
  iconReconnect: {
    backgroundColor: 'rgba(251,191,36,0.1)',
    borderColor: 'rgba(251,191,36,0.4)',
  },
  iconError: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderColor: 'rgba(239,68,68,0.4)',
  },
  title: {
    fontSize: 18, fontWeight: '900', color: '#F1F5F9',
    marginBottom: 8, textAlign: 'center',
    ...Shadows.text,
  },
  message: {
    fontSize: 13, fontWeight: '500', color: '#94A3B8',
    textAlign: 'center', lineHeight: 19,
    marginBottom: 20,
  },
  buttons: { flexDirection: 'row', gap: 10, width: '100%' },
  btnSecondary: {
    flex: 1, height: 44,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  btnSecondaryText: {
    fontSize: 13, fontWeight: '700', color: '#CBD5E1',
    ...Shadows.text,
  },
  btnPrimary: {
    flex: 1, height: 44, borderRadius: 12, overflow: 'hidden',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    ...Shadows.card,
  },
  btnPrimaryText: {
    fontSize: 13, fontWeight: '800', color: '#FFF',
    ...Shadows.text,
  },
});
