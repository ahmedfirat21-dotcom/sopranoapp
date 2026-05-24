/**
 * SopranoChat — Room Closed / Expired Full-Screen Screen
 * ★ 2026-04-26: Oda kapanmış / süresi dolmuş / davet süresi geçmiş durumlarda
 *   asla oda UI render etme — full-screen kırmızı tonlu animasyonlu uyarı + "Ana Sayfaya Dön".
 *   Pop modal değil, kayan modal değil — sayfa gibi davranır.
 */
import { useEffect, useRef, useState } from 'react';
import { i18n } from '../../services/i18n';
import { View, Text, StyleSheet, Pressable, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Shadows } from '../../constants/theme';

const iconShadow = {
  textShadowColor: 'rgba(0,0,0,0.6)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 4,
} as const;

export type RoomClosedReason = 'closed' | 'expired' | 'invite_expired' | 'banned' | 'not_found' | 'room_locked' | 'age_restricted' | 'followers_only' | 'connection_failed';

const REASON_CONFIG: Record<RoomClosedReason, { title: string; message: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  closed: {
    title: i18n.t('room.roomclosedscreen.001'),
    message: i18n.t('room.roomclosedscreen.002'),
    icon: 'lock-closed',
    color: '#EF4444',
  },
  expired: {
    title: i18n.t('room.roomclosedscreen.003'),
    message: i18n.t('room.roomclosedscreen.004'),
    icon: 'hourglass',
    color: '#F59E0B',
  },
  invite_expired: {
    title: i18n.t('room.roomclosedscreen.005'),
    message: i18n.t('room.roomclosedscreen.006'),
    icon: 'mail-unread',
    color: '#A855F7',
  },
  banned: {
    title: i18n.t('room.roomclosedscreen.007'),
    message: i18n.t('room.roomclosedscreen.008'),
    icon: 'ban',
    color: '#EF4444',
  },
  not_found: {
    // ★ 2026-04-26: gri → kırmızı (uyarı tonu, daha dikkat çekici)
    title: i18n.t('room.roomclosedscreen.009'),
    message: i18n.t('room.roomclosedscreen.010'),
    icon: 'alert-circle',
    color: '#EF4444',
  },
  // ★ 2026-04-26: Erişim engelleri için pop-modal yerine full-screen anlatım
  room_locked: {
    title: i18n.t('room.locked'),
    message: i18n.t('room.roomclosedscreen.011'),
    icon: 'lock-closed',
    color: '#EF4444',
  },
  age_restricted: {
    title: i18n.t('room.roomclosedscreen.012'),
    message: i18n.t('room.roomclosedscreen.013'),
    icon: 'warning',
    color: '#F59E0B',
  },
  followers_only: {
    title: i18n.t('room.roomclosedscreen.014'),
    message: i18n.t('room.roomclosedscreen.015'),
    icon: 'people',
    color: '#A855F7',
  },
  // ★ 2026-04-26: LiveKit/sunucu bağlantısı kurulamadı — "oda yok" yanıltıcıydı, ayrı reason.
  connection_failed: {
    title: i18n.t('room.roomclosedscreen.016'),
    message: i18n.t('room.roomclosedscreen.017'),
    icon: 'cloud-offline',
    color: '#F59E0B',
  },
};

type Props = {
  reason: RoomClosedReason;
  onGoHome: () => void;
  /** ★ Override default message — örn: "En az 18 yaşında olmalısın" gibi dinamik metinler için */
  customMessage?: string;
  /** ★ Optional retry button — sadece connection_failed gibi recoverable durumlarda gösterilir. */
  onRetry?: () => void;
  /** ★ 2026-04-26: Birden fazla hard-block (örn: hem yaş hem arkadaş) varsa bullet liste şeklinde altta gösterilir. */
  additionalReasons?: { reason: RoomClosedReason; message?: string }[];
  /** ★ v1.7.13: Geçici ban için kalan süre — ISO datetime. Geçince null. */
  banExpiresAt?: string | null;
};

// ★ v1.7.13: Geçici ban countdown — saniyede bir tick, dakika:saniye formatı.
function BanCountdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(() => {
    const ms = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.floor(ms / 1000));
  });

  useEffect(() => {
    const tick = setInterval(() => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      setRemaining(Math.max(0, Math.floor(ms / 1000)));
    }, 1000);
    return () => clearInterval(tick);
  }, [expiresAt]);

  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  const fmt = hours > 0
    ? `${hours} sa ${String(minutes).padStart(2, '0')} dk`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  if (remaining <= 0) {
    return (
      <View style={cd.wrap}>
        <Text style={cd.label}>{i18n.t('ban.expired')}</Text>
        <Text style={cd.hint}>{i18n.t('ban.expired_hint')}</Text>
      </View>
    );
  }
  return (
    <View style={cd.wrap}>
      <Text style={cd.label}>{i18n.t('ban.remaining')}</Text>
      <Text style={cd.timer}>{fmt}</Text>
      <Text style={cd.hint}>{i18n.t('ban.remaining_hint')}</Text>
    </View>
  );
}

const cd = StyleSheet.create({
  wrap: {
    marginTop: 16,
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    alignItems: 'center',
  },
  label: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  timer: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginTop: 6,
    fontVariant: ['tabular-nums'],
  },
  hint: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default function RoomClosedScreen({ reason, onGoHome, customMessage, onRetry, additionalReasons, banExpiresAt }: Props) {
  const config = REASON_CONFIG[reason];
  // ★ v1.7.13: Geçici ban — config.message yerine boş bırak, countdown bileşeni gösterilecek
  const isTempBan = reason === 'banned' && !!banExpiresAt;
  const message = customMessage || (isTempBan ? i18n.t('room.banned_message') : config.message);
  const hasMultipleReasons = !!(additionalReasons && additionalReasons.length > 0);
  const pulse = useRef(new Animated.Value(1)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    // Giriş animasyonu
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
    ]).start();

    // İkon yanıp sönme döngüsü
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [fade, scale, pulse]);

  return (
    <View style={s.root}>
      <LinearGradient
        colors={['#0B1520', '#0a0f16', '#000']}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={[`${config.color}15`, 'transparent', 'transparent']}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <Animated.View style={[s.content, { opacity: fade, transform: [{ scale }] }]}>
        <Animated.View
          style={[
            s.iconRing,
            { borderColor: `${config.color}55`, transform: [{ scale: pulse }] },
          ]}
        >
          <View style={[s.iconBg, { backgroundColor: `${config.color}20`, borderColor: `${config.color}66` }]}>
            <Ionicons name={config.icon} size={48} color={config.color} style={iconShadow} />
          </View>
        </Animated.View>

        <Text style={s.title}>{hasMultipleReasons ? i18n.t('room.cannot_enter') : (isTempBan ? i18n.t('room.temp_banned') : config.title)}</Text>
        <Text style={s.message}>{hasMultipleReasons ? i18n.t('auto.room.RoomClosedScreen.001') : message}</Text>

        {/* ★ v1.7.13: Geçici ban countdown — kalan süreyi canlı gösterir */}
        {isTempBan && banExpiresAt && (
          <BanCountdown expiresAt={banExpiresAt} />
        )}

        {hasMultipleReasons && (
          <View style={s.reasonList}>
            {/* Ana sebep + ek sebepler birleştirilir */}
            {[{ reason, message: customMessage }, ...(additionalReasons || [])].map((r, idx) => {
              const cfg = REASON_CONFIG[r.reason];
              return (
                <View key={`${r.reason}-${idx}`} style={s.reasonRow}>
                  <View style={[s.reasonIconWrap, { backgroundColor: `${cfg.color}20`, borderColor: `${cfg.color}55` }]}>
                    <Ionicons name={cfg.icon} size={16} color={cfg.color} style={iconShadow} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.reasonTitle}>{cfg.title}</Text>
                    <Text style={s.reasonDesc} numberOfLines={2}>{r.message || cfg.message}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {onRetry ? (
          <View style={s.buttonRow}>
            <Pressable style={[s.button, s.buttonPrimary]} onPress={onRetry}>
              <LinearGradient
                colors={['#14B8A6', '#0D9488']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Ionicons name="refresh" size={16} color="#FFF" style={iconShadow} />
              <Text style={s.buttonText}>{i18n.t('room.retry')}</Text>
            </Pressable>
            <Pressable style={[s.button, s.buttonSecondary]} onPress={onGoHome}>
              <Ionicons name="home" size={16} color="#94A3B8" style={iconShadow} />
              <Text style={[s.buttonText, { color: '#94A3B8' }]}>{i18n.t('room.home')}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={s.button} onPress={onGoHome}>
            <LinearGradient
              colors={['#14B8A6', '#0D9488']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Ionicons name="home" size={16} color="#FFF" style={iconShadow} />
            {/* ★ v1.7.13 (18 May 2026): Eskiden butonda i18n.t('room.roomclosedscreen.001')
                kullanılıyordu — bu key başlık ("Bu oda kapanmış") metni. Followers-only
                veya kilit reason'ında "Bu oda kapanmış" butonu yanıltıcıydı. Şimdi
                tüm reason'lar için anlamlı "Ana Sayfa" eylem etiketi. */}
            <Text style={s.buttonText}>{i18n.t('room.home')}</Text>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32,
  },
  content: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  iconRing: {
    width: 140, height: 140, borderRadius: 70,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
    marginBottom: 28,
  },
  iconBg: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  title: {
    fontSize: 22, fontWeight: '900', color: '#F1F5F9',
    textAlign: 'center', marginBottom: 12,
    ...Shadows.text,
  },
  message: {
    fontSize: 14, fontWeight: '500', color: '#94A3B8',
    textAlign: 'center', lineHeight: 21,
    marginBottom: 32,
  },
  button: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 14,
    overflow: 'hidden',
    minWidth: 200,
    ...Shadows.card,
  },
  buttonRow: {
    flexDirection: 'row', gap: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  buttonPrimary: {
    minWidth: 0, flex: 1,
  },
  buttonSecondary: {
    minWidth: 0, flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  buttonText: {
    fontSize: 14, fontWeight: '800', color: '#FFF',
    letterSpacing: 0.3,
    ...Shadows.text,
  },
  reasonList: {
    width: '100%', gap: 10, marginBottom: 28,
  },
  reasonRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
  },
  reasonIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  reasonTitle: {
    fontSize: 13, fontWeight: '800', color: '#F1F5F9',
    marginBottom: 2,
  },
  reasonDesc: {
    fontSize: 11, fontWeight: '500', color: '#94A3B8',
    lineHeight: 15,
  },
});
