// SopranoChat — SP Gönderme Başarı Modalı v3 (2026-04-21)
// ═══════════════════════════════════════════════════════════════════
// Ana gelir ekranı — SP miktarına göre tam palet + orchestrated animasyonlar.
// Layout disiplini: tüm iç öğeler RING içinde absolute konumda; taşma/çakışma yok.
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing, Modal, Dimensions, PanResponder, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import SPHexagonIcon from '../SPHexagonIcon';

const { width: W, height: H } = Dimensions.get('window');

// ── Tier palet + davranış ──
type Tier = 'basic' | 'premium' | 'elite' | 'legendary';
const getTier = (amt: number): Tier =>
  amt >= 1000 ? 'legendary' : amt >= 250 ? 'elite' : amt >= 50 ? 'premium' : 'basic';

interface TierPalette {
  ringColor: string;
  ringGlow: string;
  amountColor: string;
  amountShadow: string;
  diamondGrad: [string, string, string];
  sparkleColors: string[];
  sparkleCount: number;
  extraRings: number;
  // ★ Arka plan: açık tondan koyu tona 3 katmanlı radial (üst-merkez → köşeler)
  bgGrad: [string, string, string];
  amountFont: number;
  checkColor: string;
  checkGlow: string;
  label: string | null;
  labelColor: string;
  hasGoldShower: boolean;
  hasShimmerSweep: boolean;
}

const TIER_PALETTES: Record<Tier, TierPalette> = {
  basic: {
    ringColor: 'rgba(20,184,166,0.55)',
    ringGlow: '#14B8A6',
    amountColor: '#5EEAD4',
    amountShadow: 'rgba(0,0,0,0.7)',
    diamondGrad: ['#99F6E4', '#14B8A6', '#0D9488'],
    sparkleColors: ['#14B8A6', '#5EEAD4', '#FBBF24'],
    sparkleCount: 12,
    extraRings: 1,
    bgGrad: ['#1a3a38', '#0f2420', '#040d0c'],  // teal warmth → koyu
    amountFont: 54,
    checkColor: '#22C55E',
    checkGlow: 'rgba(34,197,94,0.85)',
    label: null,
    labelColor: '#14B8A6',
    hasGoldShower: true,
    hasShimmerSweep: true,
  },
  premium: {
    ringColor: 'rgba(251,191,36,0.7)',
    ringGlow: '#FBBF24',
    amountColor: '#FFE082',
    amountShadow: 'rgba(0,0,0,0.8)',
    diamondGrad: ['#FFF4C4', '#FBBF24', '#B45309'],
    sparkleColors: ['#FFD700', '#FBBF24', '#FFF4C4'],
    sparkleCount: 10,
    extraRings: 1,
    bgGrad: ['#5a3a10', '#2a1a08', '#080403'],  // ★ yaldızlı parlak → koyu altın
    amountFont: 58,
    checkColor: '#22C55E',
    checkGlow: 'rgba(34,197,94,0.9)',
    label: 'PREMIUM',
    labelColor: '#FBBF24',
    hasGoldShower: false,
    hasShimmerSweep: true,
  },
  elite: {
    ringColor: 'rgba(244,114,182,0.8)',
    ringGlow: '#F472B6',
    amountColor: '#FFE4E6',
    amountShadow: 'rgba(0,0,0,0.85)',
    diamondGrad: ['#FCE7F3', '#F472B6', '#9F1239'],
    sparkleColors: ['#F472B6', '#FBBF24', '#FFF4C4', '#FBCFE8'],
    sparkleCount: 15,
    extraRings: 2,
    bgGrad: ['#6a1e48', '#2a0a1d', '#080205'],  // rose-gold → koyu bordo
    amountFont: 62,
    checkColor: '#34D399',
    checkGlow: 'rgba(52,211,153,0.95)',
    label: 'ELITE',
    labelColor: '#F472B6',
    hasGoldShower: true,
    hasShimmerSweep: true,
  },
  legendary: {
    ringColor: 'rgba(167,139,250,0.9)',
    ringGlow: '#A78BFA',
    amountColor: '#F5F3FF',
    amountShadow: 'rgba(0,0,0,0.9)',
    diamondGrad: ['#DDD6FE', '#A78BFA', '#5B21B6'],
    sparkleColors: ['#A78BFA', '#F472B6', '#FBBF24', '#60A5FA', '#FFF4C4'],
    sparkleCount: 22,
    extraRings: 3,
    bgGrad: ['#3e2a7c', '#180d38', '#040108'],  // purple shimmer → koyu
    amountFont: 68,
    checkColor: '#34D399',
    checkGlow: 'rgba(52,211,153,1)',
    label: 'LEGENDARY',
    labelColor: '#A78BFA',
    hasGoldShower: true,
    hasShimmerSweep: true,
  },
};

// ── Ölçüler — 2026-04-21 v4: Flex layout, elementler arası net boşluk.
const RING = 300;
const RING_BORDER = 2;
const DIAMOND = 108;            // 84→108 (daha prestijli, ring'in ~%36'sı)
const CHECK = 56;               // 48→56 (daha belirgin)
const RING_PADDING_V = 26;

interface Props {
  visible: boolean;
  amount: number;
  recipientName: string;
  onClose: () => void;
}

export default function SPSentSuccessModal({ visible, amount, recipientName, onClose }: Props) {
  const tier = useMemo(() => getTier(amount), [amount]);
  const p = TIER_PALETTES[tier];

  // ── Animated values ──
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.6)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const ringRotate = useRef(new Animated.Value(0)).current;
  const diamondScale = useRef(new Animated.Value(0)).current;
  const diamondRotate = useRef(new Animated.Value(0)).current;
  const amountOpacity = useRef(new Animated.Value(0)).current;
  const amountTranslateY = useRef(new Animated.Value(14)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkPulse = useRef(new Animated.Value(1)).current;
  const checkGlowOpacity = useRef(new Animated.Value(0)).current;
  const labelOpacity = useRef(new Animated.Value(0)).current;
  const recipientOpacity = useRef(new Animated.Value(0)).current;
  const recipientTranslateY = useRef(new Animated.Value(10)).current;
  const shimmerX = useRef(new Animated.Value(-1.2)).current;

  const countAnim = useRef(new Animated.Value(0)).current;
  const [displayAmount, setDisplayAmount] = React.useState(0);

  // ★ Swipe-to-dismiss — aşağı sürükle kapat
  const panY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.3,
      onPanResponderMove: (_, g) => { if (g.dy > 0) panY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) {
          Animated.timing(panY, { toValue: H, duration: 200, useNativeDriver: true }).start(() => {
            panY.setValue(0);
            onClose();
          });
        } else {
          Animated.spring(panY, { toValue: 0, useNativeDriver: true, tension: 100, friction: 10 }).start();
        }
      },
    })
  ).current;

  // Sparkle & gold drop pool — maksimum boyuta göre hazırla, fazlası gizlenir
  const MAX_SPARKLES = 20;
  const MAX_DROPS = 14;
  const sparkles = useRef(
    Array.from({ length: MAX_SPARKLES }, () => ({
      scale: new Animated.Value(0),
      translateX: new Animated.Value(0),
      translateY: new Animated.Value(0),
      opacity: new Animated.Value(0),
      rotate: new Animated.Value(0),
    }))
  ).current;
  const goldDrops = useRef(
    Array.from({ length: MAX_DROPS }, () => ({
      x: 0, size: 10,
      fall: new Animated.Value(-40),
      opacity: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    if (!visible) return;

    // Reset
    backdropOpacity.setValue(0);
    ringScale.setValue(0.6);
    ringOpacity.setValue(0);
    ringRotate.setValue(0);
    diamondScale.setValue(0);
    diamondRotate.setValue(0);
    amountOpacity.setValue(0);
    amountTranslateY.setValue(14);
    checkScale.setValue(0);
    checkPulse.setValue(1);
    checkGlowOpacity.setValue(0);
    labelOpacity.setValue(0);
    recipientOpacity.setValue(0);
    recipientTranslateY.setValue(10);
    shimmerX.setValue(-1.2);
    countAnim.setValue(0);
    setDisplayAmount(0);
    panY.setValue(0);
    sparkles.forEach(s => {
      s.scale.setValue(0);
      s.translateX.setValue(0);
      s.translateY.setValue(0);
      s.opacity.setValue(0);
      s.rotate.setValue(0);
    });
    goldDrops.forEach(d => {
      d.x = Math.random() * W;
      d.size = 6 + Math.random() * 10;
      d.fall.setValue(-40);
      d.opacity.setValue(0);
    });

    const listener = countAnim.addListener(({ value }) => setDisplayAmount(Math.floor(value)));

    // ═══ ACT 1: Entrance — yaldızlı backdrop + ring swell ═══
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(120),
        Animated.parallel([
          Animated.spring(ringScale, { toValue: 1, tension: 90, friction: 8, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 1, duration: 340, useNativeDriver: true }),
        ]),
      ]),
    ]).start();

    // ═══ ACT 2: Hero pop (400-1100ms) — diamond + amount count ═══
    Animated.sequence([
      Animated.delay(380),
      Animated.parallel([
        Animated.spring(diamondScale, { toValue: 1, tension: 160, friction: 6, useNativeDriver: true }),
        Animated.timing(diamondRotate, { toValue: 1, duration: 720, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(amountOpacity, { toValue: 1, duration: 360, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(amountTranslateY, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(countAnim, { toValue: amount, duration: 1000, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      ]),
    ]).start();

    // ═══ ACT 3: Sparkle burst (600ms+) — tier count'a göre ═══
    const activeSparkles = sparkles.slice(0, p.sparkleCount);
    Animated.sequence([
      Animated.delay(500),
      Animated.stagger(
        40,
        activeSparkles.map((sp, i) => {
          const angle = (i / p.sparkleCount) * Math.PI * 2 + Math.random() * 0.3;
          const dist = RING / 2 + 18 + Math.random() * 32;
          return Animated.parallel([
            Animated.timing(sp.opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
            Animated.spring(sp.scale, { toValue: 1, tension: 130, friction: 5, useNativeDriver: true }),
            Animated.timing(sp.rotate, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(sp.translateX, {
              toValue: Math.cos(angle) * dist,
              duration: 760, easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(sp.translateY, {
              toValue: Math.sin(angle) * dist,
              duration: 760, easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]);
        }),
      ),
    ]).start(() => {
      // Sparkle fade-out
      Animated.stagger(50, activeSparkles.map(sp =>
        Animated.timing(sp.opacity, { toValue: 0, duration: 800, useNativeDriver: true }),
      )).start();
    });

    // ═══ ACT 4: Check mark bounce (1400ms) ═══
    Animated.sequence([
      Animated.delay(1400),
      Animated.parallel([
        Animated.spring(checkScale, { toValue: 1, tension: 200, friction: 5, useNativeDriver: true }),
        Animated.timing(checkGlowOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    ]).start(() => {
      // Sürekli nazik breathe
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(checkPulse, { toValue: 1.09, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(checkGlowOpacity, { toValue: 0.65, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(checkPulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(checkGlowOpacity, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          ]),
        ])
      ).start();
    });

    // ═══ ACT 5: Label + recipient fade-in (1600ms) ═══
    Animated.sequence([
      Animated.delay(1600),
      Animated.parallel([
        Animated.timing(labelOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(recipientOpacity, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.timing(recipientTranslateY, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();

    // ═══ Sürekli: Ring slow rotate (elite+) ═══
    if (p.extraRings > 0) {
      Animated.loop(
        Animated.timing(ringRotate, { toValue: 1, duration: 18000, easing: Easing.linear, useNativeDriver: true }),
      ).start();
    }

    // ═══ Sürekli: Shimmer sweep (premium+) ═══
    if (p.hasShimmerSweep) {
      Animated.loop(
        Animated.sequence([
          Animated.delay(2000),
          Animated.timing(shimmerX, { toValue: 1.2, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(shimmerX, { toValue: -1.2, duration: 0, useNativeDriver: true }),
        ])
      ).start();
    }

    // ═══ Gold shower (elite + legendary) ═══
    if (p.hasGoldShower) {
      const dropCount = tier === 'legendary' ? 14 : 8;
      goldDrops.slice(0, dropCount).forEach((d, i) => {
        Animated.sequence([
          Animated.delay(1000 + i * 140),
          Animated.parallel([
            Animated.timing(d.opacity, { toValue: 1, duration: 260, useNativeDriver: true }),
            Animated.timing(d.fall, { toValue: H + 60, duration: 2400 + Math.random() * 600, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          ]),
          Animated.timing(d.opacity, { toValue: 0, duration: 260, useNativeDriver: true }),
        ]).start();
      });
    }

    // Auto-dismiss — 5200ms (acele değil, izlenebilir)
    const t = setTimeout(onClose, 5200);
    return () => {
      countAnim.removeListener(listener);
      clearTimeout(t);
    };
  }, [visible, amount, tier]);

  if (!visible) return null;

  const diamondRotateInterp = diamondRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const ringRotateInterp = ringRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const shimmerTranslate = shimmerX.interpolate({ inputRange: [-1.2, 1.2], outputRange: [-RING * 0.7, RING * 0.7] });

  const activeSparkleCount = p.sparkleCount;
  const activeDropCount = p.hasGoldShower ? (tier === 'legendary' ? 14 : 8) : 0;

  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      {/* ★ 2026-04-21 v4: Yaldızlı açık → koyu arka plan (tier'a göre değişir).
          3 katmanlı sahte radial: büyük merkez tint + ekran-geneli gradient + kenar karartma. */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: backdropOpacity }]} pointerEvents="none">
        {/* Katman 1: ekran gradient light-top-center → dark-corners */}
        <LinearGradient
          colors={[p.bgGrad[0], p.bgGrad[1], p.bgGrad[2]]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Katman 2: merkez radial-benzeri parıltı */}
        <View style={{ position: 'absolute', top: '50%', left: '50%', marginLeft: -W * 0.7, marginTop: -W * 0.7, width: W * 1.4, height: W * 1.4, borderRadius: W * 0.7, overflow: 'hidden' }} pointerEvents="none">
          <LinearGradient
            colors={[p.ringGlow + '55', p.ringGlow + '18', 'transparent']}
            start={{ x: 0.5, y: 0.5 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        </View>
        {/* Katman 3: vinyet — kenarlar koyu */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.7)']}
          start={{ x: 0.5, y: 0.3 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      {/* ★ 2026-04-29 v2: Gold shower kaldırıldı — DiscoverWelcome temizliği. Tek hexagon hakim. */}

      <Pressable style={s.pressArea} onPress={onClose} {...panResponder.panHandlers}>
        {/* Stage — merkez ankraj noktası + swipe offset */}
        <Animated.View style={[s.stage, { transform: [{ translateY: panY }] }]}>

          {/* ★ 2026-04-29 v2: Extra rings kaldırıldı — DiscoverWelcome stilinde tek halka. */}

          {/* Ana ring + iç içerik */}
          <Animated.View
            style={[
              s.ring,
              {
                borderColor: p.ringColor,
                shadowColor: p.ringGlow,
                opacity: ringOpacity,
                transform: [{ scale: ringScale }],
              },
            ]}
          >
            {/* ★ 2026-04-29 v2: Shimmer sweep kaldırıldı — sade hexagon hakim. */}

            {/* Flex content — 3 satır eşit aralık */}
            <View style={s.ringContent}>
              {/* Üst: Amount */}
              <Animated.View
                style={[
                  s.amountWrap,
                  { opacity: amountOpacity, transform: [{ translateY: amountTranslateY }] },
                ]}
              >
                <Text
                  style={[
                    s.amountText,
                    { fontSize: p.amountFont, color: p.amountColor, textShadowColor: p.amountShadow },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {displayAmount.toLocaleString('tr-TR')}
                </Text>
                <Text style={[s.amountUnit, { color: p.amountColor + 'BF' }]}>SP</Text>
              </Animated.View>

              {/* Orta: Diamond — belirgin, büyük */}
              <Animated.View
                style={[
                  s.diamondWrap,
                  {
                    shadowColor: p.ringGlow,
                    transform: [{ scale: diamondScale }, { rotate: diamondRotateInterp }],
                  },
                ]}
              >
                {/* ★ 2026-04-29 v2: DiscoverWelcome kalitesinde — hexagon 200 px, hakim element. */}
                <SPHexagonIcon size={200} />
              </Animated.View>

              {/* ★ 2026-04-29 v2: Yeşil check kaldırıldı — DiscoverWelcome'da yok, sade. */}
            </View>
          </Animated.View>

          {/* ★ 2026-04-29 v2: Sparkles kaldırıldı — tek hexagon hakim. */}
        </Animated.View>

        {/* Ring altı: tier label (premium+) + alıcı */}
        <View style={s.belowRing}>
          {p.label && (
            <Animated.View
              style={[
                s.labelPill,
                { opacity: labelOpacity, borderColor: p.labelColor + '66', backgroundColor: p.labelColor + '1A' },
              ]}
            >
              <Text style={[s.labelText, { color: p.labelColor }]}>{p.label}</Text>
            </Animated.View>
          )}
          <Animated.Text
            style={[
              s.recipientText,
              { opacity: recipientOpacity, transform: [{ translateY: recipientTranslateY }] },
            ]}
          >
            <Text style={[s.recipientName, { color: p.amountColor }]}>{recipientName}</Text>
            <Text>'a gönderildi</Text>
          </Animated.Text>
        </View>

        <Animated.Text style={[s.hint, { opacity: recipientOpacity }]}>
          Kapatmak için dokun
        </Animated.Text>
      </Pressable>
    </Modal>
  );
}

// ── Styles ──
const s = StyleSheet.create({
  pressArea: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },

  // Sahne — merkez noktası, ring + sparkles ankor
  stage: {
    width: RING, height: RING,
    alignItems: 'center', justifyContent: 'center',
  },

  // ★ 2026-04-29 v3: Ring shadow yumuşatıldı — çirkin gölge yerine subtle halo.
  //   Android elevation tamamen kaldırıldı (gri leke yapıyordu).
  ring: {
    position: 'absolute',
    width: RING, height: RING, borderRadius: RING / 2,
    borderWidth: RING_BORDER,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.35, shadowRadius: 20 },
      android: {},
    }),
  },
  ringContent: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: RING_PADDING_V,
  },

  // Amount
  amountWrap: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center',
    gap: 5, maxWidth: RING - 60,
  },
  amountText: {
    fontWeight: '900', letterSpacing: -1.8,
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 12,
  },
  amountUnit: {
    fontSize: 20, fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Diamond — 108px, güçlü shadow
  diamondWrap: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95, shadowRadius: 28,
    elevation: 20,
  },
  diamondGrad: {
    width: DIAMOND, height: DIAMOND, borderRadius: DIAMOND / 2,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.35)',
  },
  diamondIcon: {
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },

  // Check — 56px
  checkWrap: {
    width: CHECK, height: CHECK,
    alignItems: 'center', justifyContent: 'center',
  },
  checkGlow: {
    position: 'absolute',
    width: CHECK + 8, height: CHECK + 8, borderRadius: (CHECK + 8) / 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 22,
    elevation: 15,
  },
  checkBg: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.42)',
  },
  checkIcon: {
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Ring altı grubu
  belowRing: {
    alignItems: 'center',
    marginTop: 20,
    gap: 10,
  },
  labelPill: {
    paddingHorizontal: 14, paddingVertical: 5.5,
    borderRadius: 10, borderWidth: 1,
  },
  labelText: {
    fontSize: 10, fontWeight: '900', letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  recipientText: {
    fontSize: 15, color: 'rgba(255,255,255,0.82)', fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  recipientName: {
    fontWeight: '800',
  },

  hint: {
    position: 'absolute', bottom: 48, alignSelf: 'center',
    fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '500',
    letterSpacing: 0.5,
  },
});
