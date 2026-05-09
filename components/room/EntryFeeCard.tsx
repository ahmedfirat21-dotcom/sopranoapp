/**
 * SopranoChat — Oda Giriş Ücreti Kartı (Bilet)
 * ═══════════════════════════════════════════════════════════════════
 * v107.7 (2 May 2026) — SPDonateSheet'in oda giriş ücreti ayrımı.
 * Bu sheet "para gönderme" değil, "bilet ödeme" akışı için. Diğer 3
 * sheet (Hediye/Sahne/Hazine) ile FARK:
 *   - Tier paleti YOK — sabit slate gri-mavi (transactional, Apple/Pay benzeri)
 *   - Slider/chip YOK — host belirlemiş sabit ücret
 *   - 2 buton: "Vazgeç" / "X SP Öde + Gir"
 *   - Bilet kutusu (delikli kenarlar) — fiziksel bilet hissi
 *   - Watermark: 🎫 sağ üst eğik (Hediye 🎁 / Hazine 💰 ile tutarlı pattern)
 *
 * Backend dokunulmadı:
 *   - processEntryFee imzası aynı (Promise<boolean>)
 *   - Frontend sadece bakiye kontrolü + onay kartı
 *   - SP düşme RoomService.join'de (backend, atomic)
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, PanResponder, Dimensions,
  Pressable, Platform, Image,
} from 'react-native';
import AppLoader from '../AppLoader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import SPHexagonIcon from '../SPHexagonIcon';
import { getAvatarSource } from '../../constants/avatars';

const { width: W } = Dimensions.get('window');

// ★ Sabit slate gri-mavi palet — tier sistemi YOK (transactional)
const PALETTE = {
  primary: '#3B82F6',       // mavi — buton, accent
  primarySoft: 'rgba(59,130,246,0.12)',
  primaryTint: 'rgba(59,130,246,0.08)',
  accent: '#0EA5E9',        // cyan — vurgu
  accentSoft: 'rgba(14,165,233,0.18)',
  textPrimary: '#F1F5F9',
  textSecondary: 'rgba(241,245,249,0.65)',
  border: 'rgba(59,130,246,0.40)',
  topEdge: 'rgba(59,130,246,0.75)',
  buttonGrad: ['#60A5FA', '#3B82F6', '#1D4ED8'] as [string, string, string],
};

// ★ 2026-05-05: NotificationDrawer slate kabuk ile uyumlu — "bilet" karakteri korunsun
//   diye halo + watermark mavi kalır, sadece BG açık slate dile çekildi.
const PANEL_BG: [string, string, string] = ['#3a4658', '#2a3344', '#1a2030'];

const PANEL_CONTENT_HEIGHT = 540;

interface Props {
  visible: boolean;
  /** Bilet ücreti (SP) — host belirler */
  fee: number;
  /** Mevcut SP bakiyesi — bilet kart açılmadan önce zaten kontrol edildi (yeter) */
  balance: number;
  /** Oda adı */
  roomName: string;
  /** Oda host adı */
  hostName?: string;
  /** Host avatarı */
  hostAvatar?: string | null;
  /** Onaylar — true döner, processEntryFee çözülür */
  onConfirm: () => void;
  /** Vazgeçer — false döner, processEntryFee çözülür + safeGoBack */
  onCancel: () => void;
}

export default function EntryFeeCard({
  visible, fee, balance, roomName, hostName, hostAvatar, onConfirm, onCancel,
}: Props) {
  const insets = useSafeAreaInsets();
  const PANEL_HEIGHT = PANEL_CONTENT_HEIGHT + Math.max(insets.bottom, 0);

  const translateY = useRef(new Animated.Value(PANEL_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  // Watermark (🎫) süzülme
  const ticketFloat = useRef(new Animated.Value(0)).current;
  // Bilet kutusu zoom entrance (scale 0.85→1 spring)
  const ticketBoxAnim = useRef(new Animated.Value(0)).current;

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setSubmitting(false);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        // Bilet kutusu — küçük gecikme + spring entrance
        Animated.sequence([
          Animated.delay(150),
          Animated.spring(ticketBoxAnim, { toValue: 1, useNativeDriver: true, damping: 11, stiffness: 110 }),
        ]),
      ]).start();
      // Watermark süzülme
      Animated.loop(
        Animated.sequence([
          Animated.timing(ticketFloat, { toValue: 1, duration: 4000, useNativeDriver: true }),
          Animated.timing(ticketFloat, { toValue: 0, duration: 4000, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: PANEL_HEIGHT, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(ticketBoxAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
      ticketFloat.stopAnimation();
    }
  }, [visible]);

  // Pan responder — drag-to-dismiss = Vazgeç
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.5,
      onMoveShouldSetPanResponderCapture: (_, gs) => gs.dy > 25 && Math.abs(gs.dy) > Math.abs(gs.dx) * 2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) translateY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 60 || gs.vy > 0.5) {
          Animated.timing(translateY, { toValue: PANEL_HEIGHT, duration: 200, useNativeDriver: true })
            .start(() => onCancelRef.current());
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
        }
      },
    })
  ).current;

  if (!visible) return null;

  const handleConfirm = () => {
    if (submitting) return;
    setSubmitting(true);
    onConfirm();
  };

  return (
    <View style={StyleSheet.absoluteFillObject as any} pointerEvents="box-none">
      <View style={{ ...StyleSheet.absoluteFillObject, zIndex: 1200 }} pointerEvents="box-none">
        {/* Backdrop — backdrop tap'i kazara onaylamasın diye Cancel'a bağlı.
            ★ 2026-05-05: NotificationDrawer dim tonu (rgba(8,12,22,0.45)). */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]}>
          <BlurView intensity={32} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,12,22,0.45)' }]} />
          <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        </Animated.View>

        {/* Watermark — 🎫 sağ üstte eğik (Hediye 🎁 ile tutarlı pattern) */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.watermark,
            {
              opacity: Animated.multiply(
                backdropOpacity,
                ticketFloat.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.10, 0.20, 0.10] }),
              ),
              transform: [
                {
                  translateY: Animated.add(
                    translateY.interpolate({ inputRange: [0, PANEL_HEIGHT], outputRange: [0, -30], extrapolate: 'clamp' }),
                    ticketFloat.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -5, 0] }),
                  ),
                },
                { translateX: ticketFloat.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -10, 0] }) },
                { scale: ticketFloat.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1.0, 1.05, 1.0] }) },
                { rotate: '-15deg' },
              ],
            },
          ]}
        >
          <Text style={styles.watermarkEmoji} allowFontScaling={false}>🎫</Text>
        </Animated.View>

        {/* Panel */}
        <Animated.View
          style={[
            styles.panel,
            Platform.OS === 'ios'
              ? {
                  shadowColor: PALETTE.primary,
                  shadowOffset: { width: 0, height: -6 },
                  shadowOpacity: 0.30,
                  shadowRadius: 16,
                }
              : {},
            {
              borderColor: PALETTE.primary + (Platform.OS === 'android' ? 'AA' : '66'),
              paddingBottom: 22 + insets.bottom,
              transform: [{ translateY }],
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* ★ 2026-05-05: NotificationDrawer dili — slate diagonal + üst halo (mavi).
              Tek `pointerEvents="none"` ekran etkileşimini bloke etmesin. */}
          <LinearGradient
            colors={PANEL_BG}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          {/* Üst kenar mavi accent halo — Bilet semantik */}
          <LinearGradient
            colors={['rgba(59,130,246,0.20)', 'rgba(59,130,246,0.05)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(59,130,246,0.08)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.6 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          {/* Top edge highlight */}
          <LinearGradient
            colors={['transparent', PALETTE.topEdge, 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.topEdge}
          />

          {/* Drag handle */}
          <View style={styles.handle}>
            <View style={styles.handleBar} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Ionicons name="ticket" size={20} color={PALETTE.primary} style={iconShadow} />
            <Text style={styles.headerTitle}>ODA BİLETİ</Text>
            <View style={styles.balancePill}>
              <Ionicons name="wallet" size={10} color={PALETTE.primary} />
              <Text style={styles.balanceText}>{balance.toLocaleString('tr-TR')}</Text>
            </View>
          </View>

          {/* Oda kartı — host avatar + oda adı + host adı */}
          <View style={styles.roomCard}>
            <LinearGradient
              colors={[PALETTE.primaryTint, 'rgba(255,255,255,0.02)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.hostAvatarWrap}>
              <Image source={getAvatarSource(hostAvatar)} style={styles.hostAvatar} />
            </View>
            <View style={styles.roomInfo}>
              <Text style={styles.roomName} numberOfLines={1}>{roomName}</Text>
              {hostName && (
                <View style={styles.hostRow}>
                  <Ionicons name="mic" size={10} color={PALETTE.textSecondary} />
                  <Text style={styles.hostText} numberOfLines={1}>{hostName}</Text>
                </View>
              )}
            </View>
          </View>

          {/* ★ BİLET kutusu — delikli kenarlar (sol/sağda yarım daire çentik), spring entrance */}
          <Animated.View
            style={[
              styles.ticketBoxWrap,
              {
                opacity: ticketBoxAnim,
                transform: [{
                  scale: ticketBoxAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }),
                }],
              },
            ]}
          >
            <View style={styles.ticketBox}>
              <LinearGradient
                colors={[PALETTE.primarySoft, 'rgba(14,165,233,0.06)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              {/* Sol/sağ delik çentikler — bilet kesim hissi */}
              <View style={[styles.ticketNotch, styles.ticketNotchLeft]} />
              <View style={[styles.ticketNotch, styles.ticketNotchRight]} />
              {/* İçerik: hexagon + ücret */}
              <View style={styles.ticketContent}>
                <SPHexagonIcon size={56} tier="basic" />
                <View style={styles.ticketAmountCol}>
                  <Text style={styles.ticketAmount}>{fee.toLocaleString('tr-TR')}</Text>
                  <Text style={styles.ticketUnit}>SP</Text>
                </View>
              </View>
              {/* Alt etiket */}
              <View style={styles.ticketLabelRow}>
                <View style={styles.ticketDivider} />
                <Text style={styles.ticketLabel}>GİRİŞ ÜCRETİ</Text>
                <View style={styles.ticketDivider} />
              </View>
            </View>
          </Animated.View>

          {/* Bilgi notu */}
          <Text style={styles.note}>
            Onaylarsan{' '}
            <Text style={styles.noteStrong}>{fee.toLocaleString('tr-TR')} SP</Text>
            {' bakiyenden düşülür ve odaya giriş yaparsın.'}
          </Text>

          {/* 2 buton: Vazgeç + Öde */}
          <View style={styles.btnRow}>
            <Pressable
              style={[styles.btnSecondary, submitting && { opacity: 0.5 }]}
              onPress={onCancel}
              disabled={submitting}
            >
              <Text style={styles.btnSecondaryText}>Vazgeç</Text>
            </Pressable>
            <Pressable
              style={[
                styles.btnPrimary,
                Platform.OS === 'ios'
                  ? { shadowColor: PALETTE.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10 }
                  : {},
                submitting && { opacity: 0.6 },
              ]}
              onPress={handleConfirm}
              disabled={submitting}
            >
              <LinearGradient
                colors={PALETTE.buttonGrad}
                locations={[0, 0.5, 1]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.btnPrimaryGrad}
              >
                {submitting ? (
                  <AppLoader color="#FFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="enter" size={16} color="#FFF" style={iconShadow} />
                    <Text style={styles.btnPrimaryText}>
                      {fee.toLocaleString('tr-TR')} SP Öde + Gir
                    </Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const iconShadow = {
  textShadowColor: 'rgba(0,0,0,0.6)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 4,
} as const;

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderBottomWidth: 0,
    overflow: 'hidden',
    backgroundColor: '#1a2030',
  },
  topEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5 },
  handle: { alignItems: 'center', paddingVertical: 12 },
  handleBar: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(59,130,246,0.55)',
  },

  // Watermark
  watermark: {
    position: 'absolute',
    top: '8%', right: -30,
    alignItems: 'flex-end', justifyContent: 'flex-start',
  },
  watermarkEmoji: { fontSize: 220, lineHeight: 250, textAlign: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 18, paddingBottom: 12,
  },
  headerTitle: {
    flex: 1, fontSize: 13, fontWeight: '900',
    letterSpacing: 1.2,
    color: PALETTE.primary,
    ...iconShadow,
  },
  balancePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
    backgroundColor: PALETTE.primaryTint,
    borderWidth: 1, borderColor: PALETTE.border,
  },
  balanceText: { fontSize: 11, fontWeight: '800', color: PALETTE.primary },

  // Oda kartı (üstte)
  roomCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 18, marginBottom: 14,
    paddingHorizontal: 14, paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1, borderColor: PALETTE.border,
    overflow: 'hidden',
  },
  hostAvatarWrap: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1.5, borderColor: PALETTE.primary + 'AA',
    overflow: 'hidden',
  },
  hostAvatar: { width: '100%', height: '100%' } as any,
  roomInfo: { flex: 1, gap: 3 },
  roomName: {
    fontSize: 15, fontWeight: '800', color: PALETTE.textPrimary,
    letterSpacing: 0.2,
  },
  hostRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  hostText: { fontSize: 11, color: PALETTE.textSecondary, fontWeight: '600' },

  // ★ BİLET kutusu — delikli kenarlar
  ticketBoxWrap: {
    marginHorizontal: 32, marginVertical: 6,
    alignItems: 'center',
  },
  ticketBox: {
    width: '100%',
    paddingVertical: 18, paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: PALETTE.primary + '88',
    borderStyle: 'dashed',
    overflow: 'hidden',
    alignItems: 'center',
  },
  // Bilet çentikleri — sol/sağ kenarda yarım daire (delik hissi)
  ticketNotch: {
    position: 'absolute',
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#0e131c', // panel BG ile aynı koyuluk
    top: '50%',
    marginTop: -8,
  },
  ticketNotchLeft: {
    left: -8,
    borderRightWidth: 1.5,
    borderRightColor: PALETTE.primary + '88',
  },
  ticketNotchRight: {
    right: -8,
    borderLeftWidth: 1.5,
    borderLeftColor: PALETTE.primary + '88',
  },
  ticketContent: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    paddingVertical: 6,
  },
  ticketAmountCol: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  ticketAmount: {
    fontSize: 38, fontWeight: '900', color: PALETTE.textPrimary,
    letterSpacing: -1,
    textShadowColor: PALETTE.primary + '55',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  ticketUnit: {
    fontSize: 16, fontWeight: '900', color: PALETTE.primary,
    letterSpacing: 0.5,
  },
  ticketLabelRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    width: '100%',
  },
  ticketDivider: {
    flex: 1,
    height: 1,
    backgroundColor: PALETTE.primary + '33',
  },
  ticketLabel: {
    fontSize: 9, fontWeight: '900', color: PALETTE.primary,
    letterSpacing: 2,
  },

  // Bilgi notu
  note: {
    marginHorizontal: 24, marginVertical: 14,
    fontSize: 12, color: PALETTE.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 17,
  },
  noteStrong: {
    fontWeight: '900',
    color: PALETTE.primary,
  },

  // 2 buton: Vazgeç (secondary) + Öde (primary slate-mavi)
  btnRow: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 18, marginTop: 4,
  },
  btnSecondary: {
    flex: 1, height: 50, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  btnSecondaryText: {
    fontSize: 14, color: 'rgba(255,255,255,0.70)', fontWeight: '700',
  },
  btnPrimary: {
    flex: 1.6, height: 50, borderRadius: 14,
    overflow: 'hidden',
    borderWidth: Platform.OS === 'android' ? 2 : 1.5,
    borderColor: '#93C5FD' + (Platform.OS === 'android' ? 'CC' : '88'),
  },
  btnPrimaryGrad: {
    flex: 1, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 7,
  },
  btnPrimaryText: {
    fontSize: 14, fontWeight: '900', color: '#FFF',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
