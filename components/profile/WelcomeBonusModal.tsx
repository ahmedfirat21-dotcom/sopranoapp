// SopranoChat — Welcome Bonus Modal v89 (1 May 2026)
// ═══════════════════════════════════════════════════════════════════
// Yeni kullanıcı kayıt akışı bittiğinde gösterilir. DB trigger'ı (v88)
// arka planda 50 SP yatırmıştır; bu modal görsel feedback'i sağlar.
//
// Tasarım dili: SPSentSuccessModal/SPReceivedModal ile tutarlı premium
// altın tema, ultra-orchestrated animasyon, Android shadow uyumlu.
//
// Animasyon katmanları:
//   1. Backdrop fade + BlurView (450ms)
//   2. Card spring entrance + scale 0.8→1
//   3. SPHexagonIcon (kendi içinde gem-float + halo + ring-expand)
//   4. Counter animation 0→50 (1100ms ease-out)
//   5. 16 sparkle particle stagger (60ms gap, ikincil radial dağılım)
//   6. 3 katman ring-expand loop (sürekli derinlik hissi)
//   7. Glow pulse loop (1.15x scale + opacity)
//   8. Title + subtitle stagger fade-in (180ms gap)
//
// Android shadow stratejisi: Platform.select — iOS gerçek shadow,
// Android elevation + parlak amber border (shadow yetersizliğini telafi).
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, Easing, Modal, Dimensions, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SkiaShadow } from '../skia';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import SPHexagonIcon from '../SPHexagonIcon';

const { width: W, height: H } = Dimensions.get('window');

// Premium altın palet — SP_TIER_VISUAL.premium ile uyumlu, daha zengin
const PALETTE = {
  bgGradient: ['#5a3a10', '#2a1a08', '#080403'] as [string, string, string],
  topEdge: 'rgba(255, 215, 130, 0.95)',
  ringColor: '#FFE082',
  glowColor: '#FBBF24',
  amountColor: '#FFD700',
  amountShadow: 'rgba(251, 191, 36, 0.55)',
  buttonGradient: ['#FFE082', '#FBBF24', '#D97706'] as [string, string, string],
  borderColor: 'rgba(255, 224, 130, 0.6)',
  borderColorAndroid: 'rgba(255, 224, 130, 0.85)',
  sparkleColors: ['#FFD700', '#FBBF24', '#FFF4C4', '#FFE082', '#FFC846'],
};

const SPARKLE_COUNT = 16;

interface Props {
  visible: boolean;
  amount?: number;
  onClose: () => void;
}

export default function WelcomeBonusModal({
  visible, amount = 50, onClose,
}: Props) {
  // ─── Counter ───
  const countAnim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  // ─── Backdrop ───
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // ─── Card entrance ───
  const cardScale = useRef(new Animated.Value(0.82)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardY = useRef(new Animated.Value(40)).current;

  // ─── Hexagon icon ───
  const iconScale = useRef(new Animated.Value(0)).current;
  const iconY = useRef(new Animated.Value(-30)).current;

  // ─── Title + subtitle ───
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(12)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleY = useRef(new Animated.Value(12)).current;

  // ─── Button ───
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonY = useRef(new Animated.Value(16)).current;
  const buttonShine = useRef(new Animated.Value(-W)).current;

  // ─── Glow / pulse loops ───
  const glowPulse = useRef(new Animated.Value(1)).current;
  const ringA = useRef(new Animated.Value(0)).current;
  const ringB = useRef(new Animated.Value(0)).current;
  const ringC = useRef(new Animated.Value(0)).current;

  // ─── Sparkles ───
  const sparkles = useRef(
    Array.from({ length: SPARKLE_COUNT }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      rot: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0.4),
      color: PALETTE.sparkleColors[Math.floor(Math.random() * PALETTE.sparkleColors.length)],
    }))
  ).current;

  useEffect(() => {
    if (!visible) return;

    // ─── Reset ───
    backdropOpacity.setValue(0);
    cardScale.setValue(0.82);
    cardOpacity.setValue(0);
    cardY.setValue(40);
    iconScale.setValue(0);
    iconY.setValue(-30);
    titleOpacity.setValue(0);
    titleY.setValue(12);
    subtitleOpacity.setValue(0);
    subtitleY.setValue(12);
    buttonOpacity.setValue(0);
    buttonY.setValue(16);
    countAnim.setValue(0);
    setDisplay(0);
    sparkles.forEach(sp => {
      sp.x.setValue(0);
      sp.y.setValue(0);
      sp.rot.setValue(0);
      sp.opacity.setValue(0);
      sp.scale.setValue(0.4);
    });

    const countListener = countAnim.addListener(({ value }) => setDisplay(Math.floor(value)));

    // ─── Orchestrated entrance ───
    Animated.sequence([
      // 1. Backdrop + card frame
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(cardScale, { toValue: 1, tension: 100, friction: 9, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.spring(cardY, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
      ]),
      // 2. Hexagon iconu süzülerek gel
      Animated.parallel([
        Animated.spring(iconY, { toValue: 0, tension: 90, friction: 6, useNativeDriver: true }),
        Animated.spring(iconScale, { toValue: 1, tension: 100, friction: 5, useNativeDriver: true }),
      ]),
      // 3. Counter + sparkles + title stagger
      Animated.parallel([
        Animated.timing(countAnim, { toValue: amount, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        // Title fade-in
        Animated.parallel([
          Animated.timing(titleOpacity, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(titleY, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
        // Subtitle fade-in (180ms delay)
        Animated.sequence([
          Animated.delay(220),
          Animated.parallel([
            Animated.timing(subtitleOpacity, { toValue: 1, duration: 360, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(subtitleY, { toValue: 0, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          ]),
        ]),
        // Button pop (450ms delay)
        Animated.sequence([
          Animated.delay(450),
          Animated.parallel([
            Animated.timing(buttonOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
            Animated.spring(buttonY, { toValue: 0, tension: 120, friction: 8, useNativeDriver: true }),
          ]),
        ]),
        // Sparkles — radial scatter
        Animated.stagger(55, sparkles.map((sp, i) => {
          const angle = (i / SPARKLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
          const dist = 90 + Math.random() * 70;
          const dx = Math.cos(angle) * dist;
          const dy = Math.sin(angle) * dist - 20; // hafif yukarı bias
          return Animated.parallel([
            Animated.timing(sp.opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
            Animated.timing(sp.scale, { toValue: 0.8 + Math.random() * 0.6, duration: 600, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
            Animated.timing(sp.x, { toValue: dx, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(sp.y, { toValue: dy, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(sp.rot, { toValue: (Math.random() * 4) - 2, duration: 1100, useNativeDriver: true }),
            Animated.sequence([
              Animated.delay(800),
              Animated.timing(sp.opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
            ]),
          ]);
        })),
      ]),
    ]).start();

    // ─── Loops ───
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 1.15, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    glowLoop.start();

    const ringLoopA = Animated.loop(
      Animated.timing(ringA, { toValue: 1, duration: 2400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
    const ringLoopB = Animated.loop(
      Animated.sequence([
        Animated.delay(800),
        Animated.timing(ringB, { toValue: 1, duration: 2400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
    );
    const ringLoopC = Animated.loop(
      Animated.sequence([
        Animated.delay(1600),
        Animated.timing(ringC, { toValue: 1, duration: 2400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
    );
    ringLoopA.start();
    ringLoopB.start();
    ringLoopC.start();

    // Button shine sweep
    const shineLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(2400),
        Animated.timing(buttonShine, { toValue: W, duration: 1400, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(buttonShine, { toValue: -W, duration: 0, useNativeDriver: true }),
      ]),
    );
    shineLoop.start();

    return () => {
      countAnim.removeListener(countListener);
      glowLoop.stop();
      ringLoopA.stop();
      ringLoopB.stop();
      ringLoopC.stop();
      shineLoop.stop();
    };
  }, [visible, amount]);

  const ringScaleA = ringA.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.6] });
  const ringOpacityA = ringA.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.55, 0.3, 0] });
  const ringScaleB = ringB.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.6] });
  const ringOpacityB = ringB.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.45, 0.22, 0] });
  const ringScaleC = ringC.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.6] });
  const ringOpacityC = ringC.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.35, 0.18, 0] });

  if (!visible) return null;

  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      {/* ─── Backdrop: BlurView + dim layer ─── */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]}>
        <BlurView intensity={45} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Kapat" />
      </Animated.View>

      {/* ─── Center stage ─── */}
      <View style={s.center} pointerEvents="box-none">
        <Animated.View
          style={[
            s.card,
            {
              opacity: cardOpacity,
              transform: [{ scale: cardScale }, { translateY: cardY }],
            },
          ]}
        >
          {/* Card BG: tier gradient */}
          <LinearGradient
            colors={PALETTE.bgGradient}
            locations={[0, 0.55, 1]}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Top edge highlight (3-stop horizontal) */}
          <LinearGradient
            colors={['transparent', PALETTE.topEdge, 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.topEdge}
          />
          {/* Diagonal glow tint */}
          <LinearGradient
            colors={['rgba(251,191,36,0.18)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />

          {/* ─── Hexagon area (icon + concentric rings + sparkles) ─── */}
          <View style={s.hexWrap} pointerEvents="none">
            {/* 3 katman ring-expand glow (panel'in arkasında derinlik hissi) */}
            <Animated.View
              style={[s.ring, { transform: [{ scale: ringScaleA }], opacity: ringOpacityA, borderColor: PALETTE.ringColor }]}
            />
            <Animated.View
              style={[s.ring, { transform: [{ scale: ringScaleB }], opacity: ringOpacityB, borderColor: PALETTE.ringColor }]}
            />
            <Animated.View
              style={[s.ring, { transform: [{ scale: ringScaleC }], opacity: ringOpacityC, borderColor: PALETTE.ringColor }]}
            />

            {/* Glow halo (pulse loop) */}
            <Animated.View
              style={[
                s.glow,
                {
                  transform: [{ scale: glowPulse }],
                  shadowColor: PALETTE.glowColor,
                },
              ]}
            />

            {/* Hexagon icon (kendi içinde gem-float + halo) */}
            <Animated.View
              style={{
                transform: [{ scale: iconScale }, { translateY: iconY }],
              }}
            >
              <SPHexagonIcon size={120} />
            </Animated.View>

            {/* Sparkles — radyal scatter */}
            {sparkles.map((sp, i) => (
              <Animated.View
                key={i}
                style={[
                  s.sparkle,
                  {
                    opacity: sp.opacity,
                    transform: [
                      { translateX: sp.x },
                      { translateY: sp.y },
                      { scale: sp.scale },
                      { rotate: sp.rot.interpolate({ inputRange: [-2, 2], outputRange: ['-200deg', '200deg'] }) },
                    ],
                  },
                ]}
              >
                <Ionicons name="sparkles" size={14} color={sp.color} />
              </Animated.View>
            ))}
          </View>

          {/* ─── Amount: "+50 SP" ─── */}
          <View style={s.amountRow} pointerEvents="none">
            <Text
              style={[
                s.plus,
                {
                  textShadowColor: PALETTE.amountShadow,
                  color: PALETTE.amountColor,
                },
              ]}
            >
              +
            </Text>
            <Text
              style={[
                s.amount,
                {
                  textShadowColor: PALETTE.amountShadow,
                  color: PALETTE.amountColor,
                },
              ]}
            >
              {display}
            </Text>
            <Text style={[s.spLabel, { color: PALETTE.amountColor }]}>SP</Text>
          </View>

          {/* ─── Title ─── */}
          <Animated.Text
            style={[
              s.title,
              {
                opacity: titleOpacity,
                transform: [{ translateY: titleY }],
              },
            ]}
          >
            Hoş Geldin!
          </Animated.Text>

          {/* ─── Subtitle ─── */}
          <Animated.Text
            style={[
              s.subtitle,
              {
                opacity: subtitleOpacity,
                transform: [{ translateY: subtitleY }],
              },
            ]}
          >
            Soprano dünyasına adım attın. Hediye olarak{'\n'}
            <Text style={s.subtitleHighlight}>50 SP</Text> hesabına yüklendi —
            ilk boost'unu yapmaya hazır.
          </Animated.Text>

          {/* ─── CTA button ─── */}
          <Animated.View
            style={{
              opacity: buttonOpacity,
              transform: [{ translateY: buttonY }],
              width: '100%',
            }}
          >
            <SkiaShadow shadowColor="#FBBF24" shadowOpacity={0.6} shadowBlur={16} shadowOffsetY={6} borderRadius={14} style={{ width: '100%' }}>
            <Pressable onPress={onClose} style={s.btn}>
              <LinearGradient
                colors={PALETTE.buttonGradient}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              {/* Shine sweep */}
              <Animated.View
                pointerEvents="none"
                style={[
                  s.btnShine,
                  { transform: [{ translateX: buttonShine }, { skewX: '-15deg' }] },
                ]}
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFillObject}
                />
              </Animated.View>
              <View style={s.btnContent}>
                <Ionicons name="sparkles" size={18} color="#5a3500" style={iconShadow} />
                <Text style={s.btnText}>Keşfetmeye Başla</Text>
                <Ionicons name="arrow-forward" size={18} color="#5a3500" style={iconShadow} />
              </View>
            </Pressable>
            </SkiaShadow>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const iconShadow = {
  textShadowColor: 'rgba(255,255,255,0.5)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 2,
} as const;

const s = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 28,
    overflow: 'hidden',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: 'center',
    // ★ Android shadow yetersiz → kalın amber border + elevation
    borderWidth: Platform.OS === 'android' ? 2 : 1.5,
    borderColor: Platform.OS === 'android' ? PALETTE.borderColorAndroid : PALETTE.borderColor,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.65,
        shadowRadius: 32,
      },
      android: {
        elevation: 24,
      },
    }),
  },
  topEdge: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1.8,
  },
  hexWrap: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  ring: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1.2,
  },
  glow: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(251,191,36,0.12)',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.85,
        shadowRadius: 30,
      },
      android: {
        elevation: 0, // shadow yerine subtle border altta
      },
    }),
  },
  sparkle: {
    position: 'absolute',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 14,
    gap: 2,
  },
  plus: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  amount: {
    fontSize: 64,
    fontWeight: '900',
    letterSpacing: -2,
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 14,
  },
  spLabel: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginLeft: 6,
    marginBottom: 6,
    opacity: 0.85,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFE082',
    letterSpacing: 0.3,
    marginBottom: 10,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    fontSize: 13.5,
    lineHeight: 20,
    color: 'rgba(255, 240, 200, 0.8)',
    textAlign: 'center',
    marginBottom: 22,
    paddingHorizontal: 8,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  subtitleHighlight: {
    color: '#FFE082',
    fontWeight: '900',
  },
  btn: {
    height: 52,
    borderRadius: 14,
    overflow: 'hidden',
    width: '100%',
    // ★ Android shadow yetersiz — parlak altın border + elevation
    borderWidth: Platform.OS === 'android' ? 2 : 1,
    borderColor: Platform.OS === 'android' ? 'rgba(255,224,130,0.95)' : 'rgba(255,224,130,0.6)',
    ...Platform.select({
      ios: {
        shadowColor: '#FBBF24',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.55,
        shadowRadius: 16,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  btnShine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 100,
  },
  btnContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#5a3500',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(255,255,255,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
