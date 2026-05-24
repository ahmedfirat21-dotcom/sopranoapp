/**
 * SopranoChat — SP Gönderme Başarı (COMPACT — sade kart formu)
 * ═══════════════════════════════════════════════════════════════════
 * v107.16 (2 May 2026) — Profil/DM bağlamında SP gönderiminden sonra çıkan
 * sade kart. Oda içi "sinematik" sürümün aksine bu sade ve hızlı:
 *   - Backdrop blur + dim
 *   - Ortada compact card (CARD_WIDTH 360)
 *   - Hexagon 180px + amount + tier label + recipient
 *   - 2.7s toplam (entrance 700 + hold 1750 + exit 250)
 *
 * Cinematic versiyon: SPSentSuccessModal (variant='cinematic') — oda içi.
 */

import React, { useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, Easing, Modal, Dimensions,
  PanResponder, Image, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import SPHexagonIcon from '../SPHexagonIcon';
import { getSPAmountTier, type SPAmountTier } from '../../constants/spAmountTier';
import { getAvatarSource } from '../../constants/avatars';
import { TIER_PALETTES, PANEL_BG_GRADIENT, tierShadow } from '../../constants/tierColors';
import { i18n } from '../../services/i18n';

const { width: W, height: H } = Dimensions.get('window');

const HEX_SIZE = 220; // ★ v107.19: 180 → 220 (kullanıcı talebi: biraz daha büyüt)
const CARD_WIDTH = Math.min(W - 32, 380);

const AMOUNT_FONT: Record<SPAmountTier, number> = {
  basic: 56,
  premium: 62,
  elite: 68,
  legendary: 74,
};

interface Props {
  visible: boolean;
  amount: number;
  recipientName: string;
  recipientAvatar?: string;
  onClose: () => void;
}

export default function SPSentSuccessCompact({
  visible, amount, recipientName, recipientAvatar, onClose,
}: Props) {
  const tier = useMemo(() => getSPAmountTier(amount), [amount]);
  const palette = TIER_PALETTES[tier];

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const heroAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const bodyAnim = useRef(new Animated.Value(0)).current;
  const exitAnim = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.3,
      onPanResponderMove: (_, g) => { if (g.dy > 0) panY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) {
          Animated.timing(panY, { toValue: H, duration: 180, useNativeDriver: true })
            .start(() => { panY.setValue(0); onClose(); });
        } else {
          Animated.spring(panY, { toValue: 0, useNativeDriver: true, tension: 100, friction: 10 }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (!visible) return;

    backdropOpacity.setValue(0);
    cardAnim.setValue(0);
    heroAnim.setValue(0);
    titleAnim.setValue(0);
    bodyAnim.setValue(0);
    exitAnim.setValue(0);
    panY.setValue(0);

    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 240, useNativeDriver: true }),
      Animated.spring(cardAnim, { toValue: 1, useNativeDriver: true, tension: 90, friction: 11 }),
      // ★ v107.19: Hexagon yukarıdan -360° dönerek düşer + bounce (cubic bounce, 900ms)
      //   Eski sade scale yerine cinematic-tarzı "fırlatma + yerleşme"
      Animated.timing(heroAnim, {
        toValue: 1,
        duration: 900,
        easing: Easing.bezier(0.34, 1.56, 0.64, 1),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(280),
        Animated.timing(titleAnim, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(440),
        Animated.timing(bodyAnim, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();

    const HOLD_MS = 1750;
    const FADE_OUT_MS = 250;
    const exitTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(exitAnim, { toValue: 1, duration: FADE_OUT_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: FADE_OUT_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(() => onClose());
    }, 700 + HOLD_MS);

    return () => { clearTimeout(exitTimer); };
  }, [visible, amount, tier]);

  if (!visible) return null;

  const cardScale = cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  const cardTranslateY = cardAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] });
  const exitOpacity = exitAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const exitScale = exitAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });

  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      {/* Backdrop — yumuşak blur + dim */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: backdropOpacity }]} pointerEvents="none">
        <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
      </Animated.View>

      <Pressable style={s.pressArea} onPress={onClose} {...panResponder.panHandlers}>
        <Animated.View
          style={[
            s.center,
            {
              opacity: exitOpacity,
              transform: [
                { translateY: Animated.add(panY, cardTranslateY) },
                { scale: Animated.multiply(cardScale, exitScale) },
              ],
            },
          ]}
        >
          <Animated.View
            style={[
              s.card,
              tierShadow(palette.accent),
              {
                borderColor: palette.accent + (Platform.OS === 'android' ? 'AA' : '66'),
                opacity: cardAnim,
              },
            ]}
          >
            <LinearGradient
              colors={PANEL_BG_GRADIENT}
              start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <LinearGradient
              colors={[palette.accentTint, 'transparent']}
              start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            {/* Yumuşak tepe ışığı */}
            <View style={s.spotlight} pointerEvents="none">
              <LinearGradient
                colors={[palette.accent + 'AA', palette.accent + '44', palette.accent + '11', 'transparent']}
                locations={[0, 0.35, 0.7, 1]}
                start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
            </View>
            <LinearGradient
              colors={['transparent', palette.topEdge, 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.topEdge}
            />

            {/* Hero hexagon — ★ v107.19: yukarıdan -360° dönerek düşer + bounce (cinematic-tarzı)
                 Eski versiyonda kullanıcı bu animasyonu beğenmişti, compact'a da getirildi */}
            <Animated.View
              style={[
                s.heroWrap,
                {
                  opacity: heroAnim.interpolate({
                    inputRange: [0, 0.3, 1],
                    outputRange: [0, 1, 1],
                  }),
                  transform: [
                    {
                      translateY: heroAnim.interpolate({
                        inputRange: [0, 0.4, 1],
                        outputRange: [-150, 0, 0],
                      }),
                    },
                    {
                      rotate: heroAnim.interpolate({
                        inputRange: [0, 0.4, 0.6, 0.8, 1],
                        outputRange: ['-360deg', '20deg', '-8deg', '3deg', '0deg'],
                      }),
                    },
                    {
                      scale: heroAnim.interpolate({
                        inputRange: [0, 0.4, 0.6, 0.8, 1],
                        outputRange: [0, 1.3, 0.92, 1.05, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <SPHexagonIcon size={HEX_SIZE} tier={tier as any} rich />
            </Animated.View>

            {/* Amount */}
            <Animated.View
              style={{
                opacity: titleAnim,
                transform: [{ translateY: titleAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
              }}
            >
              <Text
                style={[
                  s.amountText,
                  {
                    fontSize: AMOUNT_FONT[tier],
                    color: palette.amountText,
                    textShadowColor: palette.accent + '80',
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 14,
                  },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {amount.toLocaleString(i18n.locale)} <Text style={[s.spUnit, { color: palette.accent }]}>SP</Text>
              </Text>
            </Animated.View>

            {/* Tier label */}
            {palette.label && (
              <Animated.View
                style={[
                  s.labelPill,
                  {
                    opacity: titleAnim,
                    borderColor: palette.accent + '60',
                    backgroundColor: palette.accentSoft,
                  },
                ]}
              >
                <Text style={[s.labelText, { color: palette.accent }]}>{palette.label}</Text>
              </Animated.View>
            )}

            {/* Recipient */}
            <Animated.View
              style={[
                s.recipientRow,
                {
                  opacity: bodyAnim,
                  transform: [{ translateY: bodyAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
                },
              ]}
            >
              {recipientAvatar ? (
                <Image
                  source={getAvatarSource(recipientAvatar)}
                  style={[s.recipientAvatar, { borderColor: palette.accent + 'AA' }]}
                />
              ) : null}
              <Text style={s.recipientText} numberOfLines={1}>
                <Text style={[s.recipientName, { color: palette.accent }]}>{recipientName}</Text>
                <Text>{i18n.t('auto.profile.SPSentSuccessCompact.001')}</Text>
              </Text>
            </Animated.View>

            <Animated.Text style={[s.hint, { opacity: bodyAnim }]}>
              Kapatmak için dokun
            </Animated.Text>
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  pressArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  card: {
    width: CARD_WIDTH,
    paddingTop: 28,
    paddingBottom: 22,
    paddingHorizontal: 24,
    borderRadius: 24,
    borderWidth: Platform.OS === 'android' ? 2 : 1.5,
    overflow: 'hidden',
    alignItems: 'center',
  },
  topEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5 },
  spotlight: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 200,
    opacity: 0.25,
  },
  heroWrap: {
    width: HEX_SIZE, height: HEX_SIZE,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  amountText: {
    fontWeight: '900',
    letterSpacing: -1.5,
    textAlign: 'center',
  },
  spUnit: { fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  labelPill: {
    marginTop: 12,
    paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: 10, borderWidth: 1,
  },
  labelText: {
    fontSize: 10, fontWeight: '900', letterSpacing: 2.4,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  recipientRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    marginTop: 18, paddingHorizontal: 8,
  },
  recipientAvatar: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1.5,
  },
  recipientText: {
    fontSize: 14, color: 'rgba(255,255,255,0.78)', fontWeight: '500',
    textAlign: 'left',
    flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  recipientName: { fontWeight: '800' },
  hint: {
    marginTop: 16,
    fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: '500',
    letterSpacing: 0.5,
  },
});
