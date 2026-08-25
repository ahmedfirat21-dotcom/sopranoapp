/**
 * SopranoChat â Oda GiriÅ Ãcreti KartÄ± (Bilet)
 * âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
 * v107.7 (2 May 2026) â SPDonateSheet'in oda giriÅ Ã¼creti ayrÄ±mÄ±.
 * Bu sheet "para gÃ¶nderme" deÄil, "bilet Ã¶deme" akÄ±ÅÄ± iÃ§in. DiÄer 3
 * sheet (Hediye/Sahne/Hazine) ile FARK:
 *   - Tier paleti YOK â sabit slate gri-mavi (transactional, Apple/Pay benzeri)
 *   - Slider/chip YOK â host belirlemiÅ sabit Ã¼cret
 *   - 2 buton: "VazgeÃ§" / "X SP Ãde + Gir"
 *   - Bilet kutusu (delikli kenarlar) â fiziksel bilet hissi
 *   - Watermark: ğ« saÄ Ã¼st eÄik (Hediye ğ / Hazine ğ° ile tutarlÄ± pattern)
 *
 * Backend dokunulmadÄ±:
 *   - processEntryFee imzasÄ± aynÄ± (Promise<boolean>)
 *   - Frontend sadece bakiye kontrolÃ¼ + onay kartÄ±
 *   - SP dÃ¼Åme RoomService.join'de (backend, atomic)
 */

import React, { useRef, useEffect, useState } from 'react';
import { i18n } from '../../services/i18n';
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

// â Sabit slate gri-mavi palet â tier sistemi YOK (transactional)
const PALETTE = {
  primary: '#3B82F6',       // mavi â buton, accent
  primarySoft: 'rgba(59,130,246,0.12)',
  primaryTint: 'rgba(59,130,246,0.08)',
  accent: '#0EA5E9',        // cyan â vurgu
  accentSoft: 'rgba(14,165,233,0.18)',
  textPrimary: '#F1F5F9',
  textSecondary: 'rgba(241,245,249,0.65)',
  border: 'rgba(59,130,246,0.40)',
  topEdge: 'rgba(59,130,246,0.75)',
  buttonGrad: ['#60A5FA', '#3B82F6', '#1D4ED8'] as [string, string, string],
};

// â 2026-05-05: NotificationDrawer slate kabuk ile uyumlu â "bilet" karakteri korunsun
//   diye halo + watermark mavi kalÄ±r, sadece BG aÃ§Ä±k slate dile Ã§ekildi.
const PANEL_BG: [string, string, string] = ['#3a4658', '#2a3344', '#1a2030'];

const PANEL_CONTENT_HEIGHT = 540;

interface Props {
  visible: boolean;
  /** Bilet Ã¼creti (SP) â host belirler */
  fee: number;
  /** Mevcut SP bakiyesi â bilet kart aÃ§Ä±lmadan Ã¶nce zaten kontrol edildi (yeter) */
  balance: number;
  /** Oda adÄ± */
  roomName: string;
  /** Oda host adÄ± */
  hostName?: string;
  /** Host avatarÄ± */
  hostAvatar?: string | null;
  /** Onaylar â true dÃ¶ner, processEntryFee Ã§Ã¶zÃ¼lÃ¼r */
  onConfirm: () => void;
  /** VazgeÃ§er â false dÃ¶ner, processEntryFee Ã§Ã¶zÃ¼lÃ¼r + safeGoBack */
  onCancel: () => void;
}

export default function EntryFeeCard({
  visible, fee, balance, roomName, hostName, hostAvatar, onConfirm, onCancel,
}: Props) {
  const insets = useSafeAreaInsets();
  const PANEL_HEIGHT = PANEL_CONTENT_HEIGHT + Math.max(insets.bottom, 0);

  const translateY = useRef(new Animated.Value(PANEL_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  // Watermark (ğ«) sÃ¼zÃ¼lme
  const ticketFloat = useRef(new Animated.Value(0)).current;
  // â v284 (16 May 2026): Loop instance ref â orphan loop Ã¶nleme
  const ticketFloatLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  // Bilet kutusu zoom entrance (scale 0.85â1 spring)
  const ticketBoxAnim = useRef(new Animated.Value(0)).current;

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setSubmitting(false);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        // Bilet kutusu â kÃ¼Ã§Ã¼k gecikme + spring entrance
        Animated.sequence([
          Animated.delay(150),
          Animated.spring(ticketBoxAnim, { toValue: 1, useNativeDriver: true, damping: 11, stiffness: 110 }),
        ]),
      ]).start();
      // Watermark sÃ¼zÃ¼lme â â v284 (16 May 2026): ref'e atandÄ± + cleanup iÃ§in stop()
      ticketFloatLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(ticketFloat, { toValue: 1, duration: 4000, useNativeDriver: true }),
          Animated.timing(ticketFloat, { toValue: 0, duration: 4000, useNativeDriver: true }),
        ]),
      );
      ticketFloatLoopRef.current.start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: PANEL_HEIGHT, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(ticketBoxAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
      ticketFloatLoopRef.current?.stop();
      ticketFloatLoopRef.current = null;
    }
  }, [visible]);
  // â v284 (16 May 2026): Unmount sÄ±rasÄ±nda da loop orphan kalmasÄ±n
  useEffect(() => () => { ticketFloatLoopRef.current?.stop(); }, []);

  // Pan responder â drag-to-dismiss = VazgeÃ§
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
        {/* Backdrop â backdrop tap'i kazara onaylamasÄ±n diye Cancel'a baÄlÄ±.
            â 2026-05-05: NotificationDrawer dim tonu (rgba(8,12,22,0.45)). */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]}>
          <BlurView intensity={32} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,12,22,0.45)' }]} />
          <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        </Animated.View>

        {/* Watermark â ğ« saÄ Ã¼stte eÄik (Hediye ğ ile tutarlÄ± pattern) */}
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
          <Text style={styles.watermarkEmoji} allowFontScaling={false}>ğ«</Text>
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
          {/* â 2026-05-05: NotificationDrawer dili â slate diagonal + Ã¼st halo (mavi).
              Tek `pointerEvents="none"` ekran etkileÅimini bloke etmesin. */}
          <LinearGradient
            colors={PANEL_BG}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          {/* Ãst kenar mavi accent halo â Bilet semantik */}
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
            <Text style={styles.headerTitle}>{i18n.t('room.entryfeecard.001')}</Text>
            <View style={styles.balancePill}>
              <Ionicons name="wallet" size={10} color={PALETTE.primary} />
              <Text style={styles.balanceText}>{balance.toLocaleString(i18n.locale)}</Text>
            </View>
          </View>

          {/* Oda kartÄ± â host avatar + oda adÄ± + host adÄ± */}
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

          {/* â BÄ°LET kutusu â delikli kenarlar (sol/saÄda yarÄ±m daire Ã§entik), spring entrance */}
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
              {/* Sol/saÄ delik Ã§entikler â bilet kesim hissi */}
              <View style={[styles.ticketNotch, styles.ticketNotchLeft]} />
              <View style={[styles.ticketNotch, styles.ticketNotchRight]} />
              {/* Ä°Ã§erik: hexagon + Ã¼cret */}
              <View style={styles.ticketContent}>
                <SPHexagonIcon size={56} tier="basic" />
                <View style={styles.ticketAmountCol}>
                  <Text style={styles.ticketAmount}>{fee.toLocaleString(i18n.locale)}</Text>
                  <Text style={styles.ticketUnit}>SP</Text>
                </View>
              </View>
              {/* Alt etiket */}
              <View style={styles.ticketLabelRow}>
                <View style={styles.ticketDivider} />
                <Text style={styles.ticketLabel}>{i18n.t('room.entryfeecard.002')}</Text>
                <View style={styles.ticketDivider} />
              </View>
            </View>
          </Animated.View>

          {/* Bilgi notu */}
          <Text style={styles.note}>
            Onaylarsan{' '}
            <Text style={styles.noteStrong}>{fee.toLocaleString(i18n.locale)} SP</Text>
            {i18n.t('auto.room.EntryFeeCard.001')}
          </Text>

          {/* 2 buton: VazgeÃ§ + Ãde */}
          <View style={styles.btnRow}>
            <Pressable
              style={[styles.btnSecondary, submitting && { opacity: 0.5 }]}
              onPress={onCancel}
              disabled={submitting}
            >
              <Text style={styles.btnSecondaryText}>{i18n.t('room.entryfeecard.003')}</Text>
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
                      {fee.toLocaleString(i18n.locale)} SP Öde + Gir
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

  // Oda kartÄ± (Ã¼stte)
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

  // â BÄ°LET kutusu â delikli kenarlar
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
  // Bilet Ã§entikleri â sol/saÄ kenarda yarÄ±m daire (delik hissi)
  ticketNotch: {
    position: 'absolute',
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#0e131c', // panel BG ile aynÄ± koyuluk
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

  // 2 buton: VazgeÃ§ (secondary) + Ãde (primary slate-mavi)
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
