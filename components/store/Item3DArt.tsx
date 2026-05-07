/**
 * SopranoChat — Item3DArt (canlı render)
 * ═══════════════════════════════════════════════════════════════════
 * v107 (4 May 2026) — Mağaza ürün görseli + native animasyon paketi.
 * Discord/TikTok/Spaces seviyesinde "yaşayan" sembol hissi.
 *
 * 4 katman:
 *  1. Halo (tema rengi breath pulse)
 *  2. PNG sembol (idle float + breath scale)
 *  3. Tematik parçacık (ürün ailesine göre)
 *  4. Pressable (parent yönetir)
 *
 * Tüm animasyonlar native driver — GPU-optimize, JS thread'i takılmaz.
 */

import React, { useEffect, useRef } from 'react';
import { Image, View, StyleSheet, Animated, Easing, Platform, type ImageStyle } from 'react-native';
import LottieView from 'lottie-react-native';
import { getIllustrationPng } from '../../constants/storeIllustrationsPng';
import { getEntryEffectLottie } from '../../constants/entryEffectLottieRegistry';

interface Props {
  itemId: string;
  /** Tüm kartı kapla (cover) — mağaza kartlarında genelde false (frame native) */
  fullSize?: boolean;
  /** Boyut (px) — fullSize=false için */
  size?: number;
  /** Tema rengi (halo + bazı parçacıklar) — DB'den art_color */
  color?: string;
  /** Animasyonları kapat — küçük thumbnail / liste içinde */
  staticMode?: boolean;
}

export default function Item3DArt({
  itemId, fullSize = false, size = 110, color = '#FBBF24', staticMode = false,
}: Props) {
  const source = getIllustrationPng(itemId);
  // ★ PNG yoksa Lottie fallback (AI Spark gibi PNG'si olmayan entry_effect ürünleri için)
  const lottieSource = source ? null : getEntryEffectLottie(itemId);

  // Animation values
  const float = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (staticMode) return;
    const floatLoop = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 2400, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(float, { toValue: 0, duration: 2400, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
    ]));
    const breathLoop = Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue: 1, duration: 2200, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(breath, { toValue: 0, duration: 2200, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
    ]));
    floatLoop.start();
    breathLoop.start();
    return () => { floatLoop.stop(); breathLoop.stop(); };
  }, [staticMode, float, breath]);

  if (!source && !lottieSource) return null;

  const wrapStyle: any = fullSize
    ? { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' }
    : { width: size, height: size, alignItems: 'center', justifyContent: 'center' };

  // ★ v110.8 (7 May 2026): PNG sembol büyütüldü — 70%/0.85 → 80%/0.95.
  //   Mağazada Lottie ürünleri (Soprano Aura) ile PNG ürünleri (Phoenix Halkası, Galaktik)
  //   arasındaki boyut farkı belirgindi; PNG hafif büyüyüp Lottie hafif küçüldü.
  const symbolSize = fullSize ? '80%' : size * 0.95;
  const haloSize = fullSize ? '90%' : size * 1.0; // tematik parçacık container'ı için

  const symbolScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const symbolY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });

  return (
    <View pointerEvents="none" style={wrapStyle}>
      {/* ★ v107 hotfix: Tema renkli halo daire kaldırıldı (kullanıcı talebi). Microsoft Fluent
         Emoji 3D zaten kendi içinde 3D gölgeye sahip; ek halo gereksiz daire yapıyordu.
         Sadece PNG sembol + breath float + tematik parçacık kalır. */}
      {/* PNG sembol — float + scale (Lottie fallback yoksa) */}
      {source ? (
        <Animated.Image
          source={source}
          style={{
            width: symbolSize as any,
            height: symbolSize as any,
            transform: staticMode ? [] : [{ translateY: symbolY }, { scale: symbolScale }],
          }}
          resizeMode="contain"
          fadeDuration={0}
        />
      ) : lottieSource ? (
        <Animated.View
          style={{
            width: symbolSize as any,
            height: symbolSize as any,
            transform: staticMode ? [] : [{ translateY: symbolY }, { scale: symbolScale }],
          }}
        >
          <LottieView
            source={lottieSource}
            autoPlay={!staticMode}
            loop={!staticMode}
            style={{ width: '100%', height: '100%' }}
            resizeMode="contain"
          />
        </Animated.View>
      ) : null}
      {/* 3. Tematik parçacık */}
      {!staticMode && <ThematicParticles itemId={itemId} containerSize={typeof haloSize === 'number' ? haloSize : 100} />}
    </View>
  );
}

// ─── Tematik parçacık ailesi ───
const FAMILY_MAP: Record<string, FamilyKind> = {
  // ateş: alttan ember
  'inferno': 'ember', 'vesuvius': 'ember', 'gift-fire': 'ember', 'gift-volcano': 'ember',
  // şimşek/elektrik: sparks (üst+alt)
  'aurum-strike': 'spark', 'voltaire': 'spark', 'gift-bolt': 'spark', 'gift-lightning': 'spark',
  // buz/yıldız/parıltı: 4 köşe twinkle
  'glacier-aura': 'twinkle', 'gift-snow': 'twinkle',
  'or-ancien': 'twinkle', 'gift-star': 'twinkle',
  'constellation': 'twinkle', 'gift-sparkle': 'twinkle', 'gift-sparkles': 'twinkle',
  'emeraude': 'twinkle', 'gift-gem': 'twinkle', 'gift-diamond': 'twinkle',
  'gift-shooting': 'twinkle', 'gift-sunglasses': 'twinkle',
  // taç/fleur-de-lis: dönen yıldız (royal orbit)
  'phoenix-diadem': 'orbit', 'versailles': 'orbit',
  'gift-crown': 'orbit', 'gift-trophy': 'orbit', 'gift-lion': 'orbit',
  // gezegen: tek dot orbit
  'galactique': 'orbit',
  // kalp: yükselen kalp
  'belle-epoque': 'heart-rise', 'gift-heart': 'heart-rise',
  'gift-love': 'heart-rise', 'gift-kiss': 'heart-rise', 'gift-teddy': 'heart-rise',
  // gül: yaprak düşüşü
  'la-rose-noir': 'petal-fall', 'gift-rose': 'petal-fall',
  'gift-butterfly': 'petal-fall', 'gift-unicorn': 'petal-fall', 'gift-perfume': 'petal-fall',
  // çapa: kabarcık
  'marina-royale': 'bubble', 'gift-anchor': 'bubble',
  'gift-balloon': 'bubble',
  // ateş tabanlı premium hediyeler
  'gift-dragon': 'ember', 'gift-rocket': 'ember', 'gift-airplane': 'ember',
  // parti/kutlama → spark
  'gift-confetti': 'spark', 'gift-celebrate': 'spark', 'gift-cake': 'spark',
  // müzik/araç → orbit
  'gift-guitar': 'orbit', 'gift-car': 'orbit', 'gift-castle': 'orbit',
  // para → twinkle
  'gift-money': 'twinkle',
};

type FamilyKind = 'ember' | 'spark' | 'twinkle' | 'orbit' | 'heart-rise' | 'petal-fall' | 'bubble';

function ThematicParticles({ itemId, containerSize }: { itemId: string; containerSize: number }) {
  const family = FAMILY_MAP[itemId];
  if (!family) return null;
  switch (family) {
    case 'ember':       return <Embers />;
    case 'spark':       return <Sparks />;
    case 'twinkle':     return <Twinkles />;
    case 'orbit':       return <OrbitDot />;
    case 'heart-rise':  return <HeartRise />;
    case 'petal-fall':  return <PetalFall />;
    case 'bubble':      return <Bubbles />;
    default:            return null;
  }
}

// ─── Particle implementations ───
function FloatingParticle({ leftPercent, delay, duration, emoji, fontSize = 11 }: {
  leftPercent: number; delay: number; duration: number; emoji: string; fontSize?: number;
}) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(t, { toValue: 1, duration, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
      Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: true }),
      Animated.delay(200),
    ]));
    loop.start();
    return () => loop.stop();
  }, [t, delay, duration]);
  return (
    <Animated.Text pointerEvents="none" style={{
      position: 'absolute', bottom: 0, left: `${leftPercent}%`,
      fontSize,
      transform: [
        { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -42] }) },
        { scale: t.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.4, 1, 0.6] }) },
      ],
      opacity: t.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 1, 0] }),
    }}>{emoji}</Animated.Text>
  );
}

function FallingParticle({ leftPercent, delay, duration, emoji, fontSize = 10 }: {
  leftPercent: number; delay: number; duration: number; emoji: string; fontSize?: number;
}) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(t, { toValue: 1, duration, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
      Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [t, delay, duration]);
  return (
    <Animated.Text pointerEvents="none" style={{
      position: 'absolute', top: 0, left: `${leftPercent}%`,
      fontSize,
      transform: [
        { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-10, 50] }) },
        { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) },
      ],
      opacity: t.interpolate({ inputRange: [0, 0.2, 0.85, 1], outputRange: [0, 1, 1, 0] }),
    }}>{emoji}</Animated.Text>
  );
}

function TwinkleStar({ topPercent, leftPercent, delay, emoji = '✦', fontSize = 9 }: {
  topPercent: number; leftPercent: number; delay: number; emoji?: string; fontSize?: number;
}) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(t, { toValue: 1, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(t, { toValue: 0, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [t, delay]);
  return (
    <Animated.Text pointerEvents="none" style={{
      position: 'absolute', top: `${topPercent}%`, left: `${leftPercent}%`,
      fontSize, color: '#FFF',
      textShadowColor: '#FFF', textShadowRadius: 4,
      transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.2] }) }],
      opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }),
    }}>{emoji}</Animated.Text>
  );
}

function Embers() {
  return (
    <>
      <FloatingParticle leftPercent={30} delay={0}    duration={1800} emoji="🔥" fontSize={9} />
      <FloatingParticle leftPercent={48} delay={650}  duration={2100} emoji="✨" fontSize={8} />
      <FloatingParticle leftPercent={66} delay={1300} duration={2000} emoji="🔥" fontSize={9} />
    </>
  );
}

function Sparks() {
  return (
    <>
      <TwinkleStar topPercent={15} leftPercent={20} delay={0}    emoji="✦" fontSize={10} />
      <TwinkleStar topPercent={75} leftPercent={75} delay={400}  emoji="✦" fontSize={10} />
      <TwinkleStar topPercent={45} leftPercent={88} delay={800}  emoji="·" fontSize={14} />
    </>
  );
}

function Twinkles() {
  return (
    <>
      <TwinkleStar topPercent={12} leftPercent={15} delay={0}    emoji="✦" />
      <TwinkleStar topPercent={20} leftPercent={80} delay={300}  emoji="✦" />
      <TwinkleStar topPercent={75} leftPercent={20} delay={600}  emoji="·" fontSize={12} />
      <TwinkleStar topPercent={80} leftPercent={82} delay={900}  emoji="·" fontSize={12} />
    </>
  );
}

function OrbitDot() {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(t, {
      toValue: 1, duration: 7000, useNativeDriver: true, easing: Easing.linear,
    }));
    loop.start();
    return () => loop.stop();
  }, [t]);
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      transform: [{ rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
    }}>
      <View style={{
        position: 'absolute', top: '8%', left: '50%', marginLeft: -3,
        width: 6, height: 6, borderRadius: 3, backgroundColor: '#FBBF24',
        ...Platform.select({
          ios: { shadowColor: '#FBBF24', shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
          android: {},
        }),
      }} />
    </Animated.View>
  );
}

function HeartRise() {
  return (
    <>
      <FloatingParticle leftPercent={25} delay={0}   duration={2200} emoji="💗" fontSize={9} />
      <FloatingParticle leftPercent={50} delay={750} duration={2500} emoji="💕" fontSize={10} />
      <FloatingParticle leftPercent={72} delay={1500} duration={2300} emoji="💗" fontSize={9} />
    </>
  );
}

function PetalFall() {
  return (
    <>
      <FallingParticle leftPercent={20} delay={0}    duration={3000} emoji="🌸" fontSize={9} />
      <FallingParticle leftPercent={55} delay={900}  duration={3300} emoji="🌸" fontSize={9} />
      <FallingParticle leftPercent={78} delay={1800} duration={3100} emoji="🌸" fontSize={9} />
    </>
  );
}

function Bubbles() {
  return (
    <>
      <FloatingParticle leftPercent={22} delay={0}    duration={2400} emoji="○" fontSize={11} />
      <FloatingParticle leftPercent={55} delay={800}  duration={2700} emoji="○" fontSize={9} />
      <FloatingParticle leftPercent={75} delay={1600} duration={2500} emoji="○" fontSize={10} />
    </>
  );
}
