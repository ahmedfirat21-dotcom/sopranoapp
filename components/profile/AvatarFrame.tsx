/**
 * SopranoChat — Avatar Çerçevesi
 * ═══════════════════════════════════════════════════════════════════
 * v107 (4 May 2026) — Mağazadan satın alınmış atelier ürününü
 * (Phoenix Diadem, Galactique, Aurum Strike, Glacier, Vesuvius) avatar
 * etrafında çerçeve olarak render eder.
 *
 * Kullanım: avatar Image'in çevresine bu component'i sar.
 *   <View style={{ position: 'relative' }}>
 *     <Image style={{ width: 96, height: 96, borderRadius: 48 }} ... />
 *     <AvatarFrame frameId={profile.active_frame} size={96} />
 *   </View>
 *
 * Frame ürün id'sine göre tematik renk + çift halka (dış glow + iç parlak çizgi).
 * Item3DArt yerine native View kullanır (performans için, WebView her avatara çok ağır).
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Platform, Image, Animated, Easing, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Text as SvgText, TextPath, Defs, RadialGradient, Stop, Circle as SvgCircle } from 'react-native-svg';
import { getFrameMeta, hasFrameLottie } from '../../constants/frameLottieRegistry';
import { getCosmeticAsset, getCachedCosmeticAsset, type AssetMeta } from '../../services/cosmeticAssetCache';
import { ensureFrameConfig, getCachedFrameConfig, subscribeConfigChange, pickSizeKey, type SizeKey } from '../../services/cosmeticConfigCache';

let LottieView: any = null;
try {
  LottieView = require('lottie-react-native').default;
} catch { /* fallback to gradient ring */ }

// Skia — color_cycle için gerçek hue-rotate (CSS filter:hue-rotate paritesi)
let SkiaMod: any = null;
try {
  SkiaMod = require('@shopify/react-native-skia');
} catch { /* native module yoksa tintColor fallback'e düş */ }

/**
 * CSS filter: hue-rotate(Ndeg) W3C spec ile birebir 5x4 ColorMatrix.
 * Orijinal PNG renklerinin luminance'ını korur, sadece hue kaydırır.
 * (tintColor + hsl() yaklaşımının aksine renk doygunluğunu sıfırlamaz.)
 */
function hueRotateMatrix(deg: number): number[] {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [
    0.213 + cos * 0.787 - sin * 0.213, 0.715 - cos * 0.715 - sin * 0.715, 0.072 - cos * 0.072 + sin * 0.928, 0, 0,
    0.213 - cos * 0.213 + sin * 0.143, 0.715 + cos * 0.285 + sin * 0.140, 0.072 - cos * 0.072 - sin * 0.283, 0, 0,
    0.213 - cos * 0.213 - sin * 0.787, 0.715 - cos * 0.715 + sin * 0.715, 0.072 + cos * 0.928 + sin * 0.072, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

interface FramePalette {
  outer: string[];   // dış halka gradient (3 stop)
  inner: string;     // iç çizgi rengi
  glowIos: string;   // iOS için shadow rengi
}

const FRAME_PALETTES: Record<string, FramePalette> = {
  // ★ v107 — Eski 5 frame; v108.2'de category='gift'a alındı, görsel destek
  //   sürdürülüyor (mevcut equipped kullanıcılar için). Yeni equip akışı yok.
  'phoenix-diadem': {
    outer: ['#FFE082', '#F472B6', '#831843'],
    inner: '#FCE7F3',
    glowIos: 'rgba(244,114,182,0.7)',
  },
  galactique: {
    outer: ['#A78BFA', '#7C3AED', '#1E1B4B'],
    inner: '#DDD6FE',
    glowIos: 'rgba(167,139,250,0.7)',
  },
  'aurum-strike': {
    outer: ['#FFE082', '#FBBF24', '#854F0B'],
    inner: '#FFF4D6',
    glowIos: 'rgba(255,224,130,0.85)',
  },
  'glacier-aura': {
    outer: ['#A5F3FC', '#22D3EE', '#0E7490'],
    inner: '#F0F9FF',
    glowIos: 'rgba(34,211,238,0.7)',
  },
  vesuvius: {
    outer: ['#FED7AA', '#FB923C', '#7F1D1D'],
    inner: '#FEF3C7',
    glowIos: 'rgba(251,146,60,0.75)',
  },
  // ★ v108.2 — Yeni halka çerçeveler. Eski 5'in tema renklerinin sade halka versiyonları;
  //   uygun fiyatlı, mağazadaki çerçeveler bölümünde görünür.
  'phoenix-ring': {
    outer: ['#FFE082', '#F472B6', '#831843'],
    inner: '#FCE7F3',
    glowIos: 'rgba(244,114,182,0.7)',
  },
  'galactique-ring': {
    outer: ['#A78BFA', '#7C3AED', '#1E1B4B'],
    inner: '#DDD6FE',
    glowIos: 'rgba(167,139,250,0.7)',
  },
  'aurum-ring': {
    outer: ['#FFE082', '#FBBF24', '#854F0B'],
    inner: '#FFF4D6',
    glowIos: 'rgba(255,224,130,0.85)',
  },
  'glacier-ring': {
    outer: ['#A5F3FC', '#22D3EE', '#0E7490'],
    inner: '#F0F9FF',
    glowIos: 'rgba(34,211,238,0.7)',
  },
  'vesuvius-ring': {
    outer: ['#FED7AA', '#FB923C', '#7F1D1D'],
    inner: '#FEF3C7',
    glowIos: 'rgba(251,146,60,0.75)',
  },
  // ★ v108.13 — Yeni Lottie frame'lere de palette eklendi (küçük avatarlarda
  //   Lottie yerine sade halka olarak gösterilir, görsel temizliği için).
  'aurelius': {
    outer: ['#FFE082', '#FBBF24', '#854F0B'],
    inner: '#FFF4D6',
    glowIos: 'rgba(255,224,130,0.85)',
  },
  'lunaris': {
    outer: ['#E2E8F0', '#94A3B8', '#475569'],
    inner: '#F1F5F9',
    glowIos: 'rgba(226,232,240,0.7)',
  },
  'rose-eternel': {
    outer: ['#F9A8D4', '#F472B6', '#831843'],
    inner: '#FCE7F3',
    glowIos: 'rgba(244,114,182,0.7)',
  },
  'cadence-soprano': {
    outer: ['#C4B5FD', '#A78BFA', '#5B21B6'],
    inner: '#DDD6FE',
    glowIos: 'rgba(196,181,253,0.7)',
  },
  // ★ v108.31: SopranoChat teal aurora çerçeve — marka renk paleti
  'soprano-aura': {
    outer: ['#A5F3FC', '#4CE0E2', '#1E848E'],
    inner: '#E0FFFE',
    glowIos: 'rgba(76,224,226,0.75)',
  },
  // ★ v110.15: Egzantrik çerçeveler — palette fallback (küçük avatarlarda halka olarak)
  'celestial-orbit': {
    outer: ['#A5F3FC', '#4CE0E2', '#FBBF24'],
    inner: '#E0FFFE',
    glowIos: 'rgba(76,224,226,0.75)',
  },
  'hex-prism': {
    outer: ['#C4B5FD', '#A78BFA', '#F472B6'],
    inner: '#EDE9FE',
    glowIos: 'rgba(167,139,250,0.75)',
  },
  'pulse-wave': {
    outer: ['#5EEAD4', '#14B8A6', '#0D9488'],
    inner: '#CCFBF1',
    glowIos: 'rgba(20,184,166,0.75)',
  },
  'eclipse-corona': {
    outer: ['#C084FC', '#7C3AED', '#4C1D95'],
    inner: '#DDD6FE',
    glowIos: 'rgba(124,58,237,0.75)',
  },
  'glitch-matrix': {
    outer: ['#34D399', '#10B981', '#059669'],
    inner: '#D1FAE5',
    glowIos: 'rgba(16,185,129,0.75)',
  },
  // ★ v214: TealRibbon — teal-cyan temalı kurdaleli çerçeve
  'teal-ribbon': {
    outer: ['#A5F3FC', '#14B8A6', '#0D5F68'],
    inner: '#E0FFFE',
    glowIos: 'rgba(20,184,166,0.75)',
  },
  // ★ v214: Teal Energy — enerji halkası PNG çerçeve (remote asset)
  'teal-energy': {
    outer: ['#5EEAD4', '#14B8A6', '#0D5F68'],
    inner: '#CCFBF1',
    glowIos: 'rgba(20,184,166,0.8)',
  },
  // ★ v214: Soprano Ribbon — turkuaz kurdaleli çerçeve (remote PNG)
  'soprano-ribbon': {
    outer: ['#5EEAD4', '#14B8A6', '#0D5F68'],
    inner: '#E0FFFE',
    glowIos: 'rgba(20,184,166,0.75)',
  },
  // ★ v215: Premium PNG çerçeveler — küçük avatarlarda halka fallback
  'gold-royal': {
    outer: ['#FFE082', '#FBBF24', '#854F0B'],
    inner: '#FFF4D6',
    glowIos: 'rgba(255,224,130,0.85)',
  },
  'silver-platinum': {
    outer: ['#E2E8F0', '#94A3B8', '#475569'],
    inner: '#F8FAFC',
    glowIos: 'rgba(226,232,240,0.75)',
  },
  'rose-gold': {
    outer: ['#FBCFE8', '#F472B6', '#9D174D'],
    inner: '#FCE7F3',
    glowIos: 'rgba(244,114,182,0.75)',
  },
  'teal-neon': {
    outer: ['#5EEAD4', '#14B8A6', '#0D5F68'],
    inner: '#CCFBF1',
    glowIos: 'rgba(20,184,166,0.8)',
  },
  'purple-violet': {
    outer: ['#C4B5FD', '#8B5CF6', '#5B21B6'],
    inner: '#EDE9FE',
    glowIos: 'rgba(139,92,246,0.75)',
  },
};

// ★ v108.13: Avatar bu boyutun altındaysa Lottie göster yerine sade halka palette
//   render edilir — küçük avatarlarda VIP frame Lottie'leri çok kalın görünüyordu.
// ★ v213f: 64 → 32 — oda içi mini avatarlarda da çerçeve görünsün (kullanıcı talebi).
//   Lottie frame'ler düşük boyutta da render olur, gradient fallback'e düşmez.
const LOTTIE_MIN_AVATAR_SIZE = 32;

// ★ 2026-05-11: Tek parçacık — scale/opacity pulse (twinkle) ile soft görünür.
//   Wrapper orbit yapıyor, ParticleDot sabit konumda + kendine özel pulse.
function ParticleDot({ emoji, color, x, y, fontSize, twinkleDelay }: {
  emoji: string; color: string; x: number; y: number; fontSize: number; twinkleDelay: number;
}) {
  const twinkleAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let cancelled = false;
    let loop: Animated.CompositeAnimation | null = null;
    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(twinkleAnim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(twinkleAnim, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      loop.start();
    }, twinkleDelay);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      loop?.stop();
    };
  }, [twinkleAnim, twinkleDelay]);

  const scaleInterp = twinkleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.2] });
  const opacityInterp = twinkleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  // ★ v1.3.63 PARİTE: Web admin'de particle filter 2 katman drop-shadow
  //   (4px + 8px) ile daha yoğun parlama. RN Text tek textShadowRadius destekler;
  //   iki üst üste Animated.Text ile iç (radius 4) + dış (radius 10) glow simüle.
  //   Birikimli ışıma web ile birebir.
  const baseStyle = {
    position: 'absolute' as const,
    left: '50%' as any, top: '50%' as any,
    marginLeft: x - fontSize / 2,
    marginTop: y - fontSize / 2,
    width: fontSize, height: fontSize,
    fontSize,
    lineHeight: fontSize,
    textAlign: 'center' as const,
    color,
    textShadowColor: color,
    textShadowOffset: { width: 0, height: 0 },
    opacity: opacityInterp,
    transform: [{ scale: scaleInterp }],
  };
  return (
    <>
      {/* Dış katman — geniş yumuşak glow (web drop-shadow 8px karşılığı) */}
      <Animated.Text style={{ ...baseStyle, textShadowRadius: 10 }}>
        {emoji}
      </Animated.Text>
      {/* İç katman — sıkı yakın glow (web drop-shadow 4px karşılığı) */}
      <Animated.Text style={{ ...baseStyle, textShadowRadius: 4 }}>
        {emoji}
      </Animated.Text>
    </>
  );
}

// ★ v1.3.68: Skia tabanlı parçacık — gerçek vektörel shape, seçilen renk birebir.
//   Eski: emoji (⭐❤️✨🫧) — sistem fontuna bağlı, particle_color uygulanmaz.
//   Yeni: Skia Path + BlurMask glow — web admin parite, renk seçimi tam yansır.
const PARTICLE_PATHS: Record<string, string> = {
  // 5-uçlu yıldız (100x100 viewbox)
  stars: 'M 50,2 L 61,38 L 98,38 L 68,60 L 79,96 L 50,75 L 21,96 L 32,60 L 2,38 L 39,38 Z',
  // 4-uçlu kıvılcım (CSS sparkle paritesi)
  sparkle: 'M 50,0 L 58,42 L 100,50 L 58,58 L 50,100 L 42,58 L 0,50 L 42,42 Z',
  // Kalp (Bezier)
  hearts: 'M 50,88 C 10,60 -10,38 12,18 C 28,4 44,12 50,28 C 56,12 72,4 88,18 C 110,38 90,60 50,88 Z',
  // Baloncuk (hollow ring)
  bubbles: 'M 50,5 A 45,45 0 1,0 50,95 A 45,45 0 1,0 50,5 Z M 50,18 A 32,32 0 1,1 50,82 A 32,32 0 1,1 50,18 Z',
};

let SkiaParticleMod: any = SkiaMod;

function ParticleSkia({ x, y, fontSize, path, color, twinkleDelay }: {
  x: number; y: number; fontSize: number; path: string; color: string; twinkleDelay: number;
}) {
  const { Canvas, Path, Group, BlurMask, Skia: SkiaApi, RadialGradient, vec } = SkiaParticleMod;
  const twinkleAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let cancelled = false;
    let loop: Animated.CompositeAnimation | null = null;
    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      loop = Animated.loop(Animated.sequence([
        Animated.timing(twinkleAnim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(twinkleAnim, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]));
      loop.start();
    }, twinkleDelay);
    return () => { cancelled = true; clearTimeout(timeoutId); loop?.stop(); };
  }, [twinkleAnim, twinkleDelay]);

  const scaleInterp = twinkleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.2] });
  const opacityInterp = twinkleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  // ★ v1.3.68 FIX: Canvas padding — BlurMask halo dışa taşar, padding olmayınca
  //   square corners olarak kırpılır ("altıgen gölge artifact" bug'ı).
  //   ★ v1.3.69: Emoji-style yıldız (%85 boyut + gradient + outline = web admin ⭐ parity).
  const blurPad = 12;
  const canvasSize = fontSize + blurPad * 2;
  const starRatio = 0.85; // emoji ⭐ karakterindeki gerçek yıldızın oranı
  const starSize = fontSize * starRatio;
  const starOffset = blurPad + (fontSize - starSize) / 2;
  const scale = starSize / 100;
  const skPath = useMemo(() => SkiaApi.Path.MakeFromSVGString(path) || SkiaApi.Path.Make(), [path, SkiaApi]);

  // Lighter ton — emoji'nin parlak iç kısmı
  const lightenColor = (hex: string) => {
    const m = hex.match(/^#([0-9a-f]{6})$/i);
    if (!m) return '#FFEF8A';
    const r = Math.min(255, parseInt(m[1].slice(0, 2), 16) + 80);
    const g = Math.min(255, parseInt(m[1].slice(2, 4), 16) + 80);
    const b = Math.min(255, parseInt(m[1].slice(4, 6), 16) + 50);
    return `rgb(${r},${g},${b})`;
  };
  const innerColor = lightenColor(color);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: '50%' as any, top: '50%' as any,
        marginLeft: x - canvasSize / 2,
        marginTop: y - canvasSize / 2,
        width: canvasSize, height: canvasSize,
        opacity: opacityInterp,
        transform: [{ scale: scaleInterp }],
      }}
    >
      <Canvas style={{ width: canvasSize, height: canvasSize }}>
        <Group transform={[{ translateX: starOffset, translateY: starOffset }, { scale }]}>
          {/* Dış glow halo (web drop-shadow 8px) — Skia path canvas dışına taşmasın diye blur düşük */}
          <Path path={skPath} color={color} opacity={0.45}>
            <BlurMask blur={6} style="normal" />
          </Path>
          {/* Sıkı glow (web drop-shadow 4px) */}
          <Path path={skPath} color={color} opacity={0.7}>
            <BlurMask blur={3} style="normal" />
          </Path>
          {/* Ana fill — emoji-style radial gradient (parlak iç, derin dış) */}
          <Path path={skPath}>
            <RadialGradient
              c={vec(50, 45)}
              r={55}
              colors={[innerColor, color, color]}
              positions={[0, 0.55, 1]}
            />
          </Path>
          {/* Koyu outline — emoji'nin siyah kenarına yaklaşır */}
          <Path path={skPath} color="rgba(0,0,0,0.35)" style="stroke" strokeWidth={4} />
        </Group>
      </Canvas>
    </Animated.View>
  );
}

// ★ 2026-05-11: Avatar etrafında parçacık efekti — sparkle/stars/hearts/bubbles.
//   Animated.loop ile yörüngede döner, color_cycle aktifse renk de cycle olur.
function ParticleOverlay({ size, dynCfg }: { size: number; dynCfg: any }) {
  const type: string = dynCfg?.particle_type || 'none';
  const count: number = Math.max(4, Math.min(12, dynCfg?.particle_count || 6));
  const baseColor: string = dynCfg?.particle_color || '#fbbf24';
  const colorCycleOn = !!dynCfg?.color_cycle;

  const orbitAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (type === 'none') return;
    // ★ v275 (14 May 2026): Animated.loop default resetBeforeIteration:true → her
    //   iteration başında 1'den 0'a snap yapıyordu (kullanıcı "tam tur atmadan sıfırlanıyor"
    //   feedback'i). resetBeforeIteration:false ile sürekli artar (0→1→0→1 yerine 0→1
    //   anlık snap, hızlandırılmış continuous rotation hissi). Süre 14s → 10s (görünürlük).
    const loop = Animated.loop(
      Animated.timing(orbitAnim, { toValue: 1, duration: 10000, easing: Easing.linear, useNativeDriver: true }),
      { resetBeforeIteration: false },
    );
    loop.start();
    return () => loop.stop();
  }, [type, orbitAnim]);

  // Renk döngüsü — particle_color cycle olur (color_cycle açıksa)
  const [particleColor, setParticleColor] = useState(baseColor);
  useEffect(() => {
    if (!colorCycleOn) { setParticleColor(baseColor); return; }
    const speedSec = dynCfg?.color_cycle_speed ?? 12;
    const startMs = Date.now();
    const intervalId = setInterval(() => {
      const elapsed = (Date.now() - startMs) / 1000;
      const hue = ((elapsed / speedSec) * 360) % 360;
      setParticleColor(`hsl(${Math.round(hue)}, 80%, 65%)`);
    }, 100);
    return () => clearInterval(intervalId);
  }, [colorCycleOn, baseColor, dynCfg?.color_cycle_speed]);

  if (type === 'none') return null;

  // ★ 2026-05-11: Gerçek emoji + yörünge avatar dışında en az 18px boşluk + her
  //   parçacığa scale/opacity twinkle. Önceki düz Unicode (✦♥) kalitesizdi
  //   ve yarıçap çok yakın (avatar üstüne biniyordu) — düzeltildi.
  // ★ v1.3.63 PARİTE: Web admin yörünge yarıçapını `avatarSize` (= mobileSize ×
  //   avatar_ratio) üzerinden hesaplıyor. APK'da `size` slot boyutu, gerçek görsel
  //   avatar `size × avatar_ratio`. Avatar_ratio<1 olunca web'de particle avatara
  //   yapışır, APK'da uzakta kalırdı — fark görsel parite bozuyordu. Düzeltildi.
  const emoji = type === 'sparkle' ? '✨' : type === 'stars' ? '⭐' : type === 'hearts' ? '❤️' : '🫧';
  const avatarRatio: number = typeof dynCfg?.avatar_ratio === 'number' ? dynCfg.avatar_ratio : 0.92;
  const effectiveAvatarSize = size * avatarRatio;
  const fontSize = Math.max(12, Math.round(effectiveAvatarSize * 0.15));
  // ★ v267: Yörünge avatar'a YAKIN — eskiden +18px boşluk vardı, çok dış görünüyordu.
  //   Şimdi +4px ile avatar kenarına yapışık orbit. Web admin önizleme paritesi.
  const orbitRadius = effectiveAvatarSize / 2 + Math.max(4, fontSize * 0.15);
  const wrapperOffset = orbitRadius + fontSize;
  const wrapperSize = wrapperOffset * 2;
  const rotateInterp = orbitAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -(wrapperOffset - size / 2),
        left: -(wrapperOffset - size / 2),
        width: wrapperSize,
        height: wrapperSize,
        alignItems: 'center', justifyContent: 'center',
        zIndex: 4,
        elevation: 4,
        transform: [{ rotate: rotateInterp }],
      }}
    >
      {Array.from({ length: count }).map((_, i) => {
        const angle = (360 / count) * i;
        const rad = (angle * Math.PI) / 180;
        const x = Math.cos(rad) * orbitRadius;
        const y = Math.sin(rad) * orbitRadius;
        const skiaPath = SkiaParticleMod ? (PARTICLE_PATHS[type] || PARTICLE_PATHS.stars) : null;
        if (skiaPath) {
          return (
            <ParticleSkia
              key={i}
              x={x} y={y} fontSize={fontSize}
              path={skiaPath}
              color={particleColor}
              twinkleDelay={(i * 250) % 2000}
            />
          );
        }
        // Skia yoksa eski emoji fallback
        return (
          <ParticleDot
            key={i}
            emoji={emoji}
            color={particleColor}
            x={x} y={y}
            fontSize={fontSize}
            twinkleDelay={(i * 250) % 2000}
          />
        );
      })}
    </Animated.View>
  );
}

// ★ 2026-05-11: Background Halo — avatarın arkasında soft diffuse glow.
//   Native radial-gradient yok; LinearGradient + opacity katmanlarıyla yaklaşık.
//   Tek View + radial benzeri shadow ile basit ve performanslı.
//   ★ pulse opsiyonu: web admin `glow-halo-pulse` keyframe'i ile parite —
//   opacity 0.7↔1.0 dalgalanır (avatar_pulse_speed * 1.5sn süre).
function BgHaloOverlay({ size, color, sizeMul, intensity, pulse, pulseSpeed }: {
  size: number; color: string; sizeMul: number; intensity: number;
  pulse?: boolean; pulseSpeed?: number;
}) {
  // ★ v1.3.58: SVG RadialGradient ile gerçek yumuşak halo — merkez parlak,
  //   kenarlar saydam fade. Eski düz daire (backgroundColor + opacity) Android'de
  //   "sıradan halka" görünümüne neden oluyordu, gradient ile web admin önizleme
  //   ile birebir.
  const haloSize = size * sizeMul;
  const offset = (haloSize - size) / 2;
  const gradId = `halo-${size}-${color.replace('#', '')}-${Math.round(intensity * 100)}`;

  // Halo opacity nabzı — web admin `@keyframes glow-halo-pulse` paritesi.
  // Süre: avatar_pulse_speed × 1.5sn (web admin formülü). 0.7↔1.0 arası.
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!pulse) { pulseAnim.setValue(1); return; }
    const half = ((pulseSpeed ?? 2) * 1500) / 2;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.0, duration: half, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 0.7, duration: half, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse, pulseSpeed, pulseAnim]);

  // ★ v1.3.68: Skia RadialGradient ile gerçek halo — web admin CSS radial-gradient paritesi.
  if (SkiaMod) {
    const { Canvas, Circle, RadialGradient: SkiaRG, vec } = SkiaMod;
    // CSS `farthest-corner` = boyut × √2/2 ≈ 0.7071. 70% stop = transparent fade.
    const rOuter = haloSize * 0.7071;
    // ★ v275 (14 May 2026): BgHalo opacity cap'i 0.6 → intensity=1.0 ile renk
    //   sahnedeki host avatarı yutuyordu. Daha düşük max opacity + büyük radius
    //   = "parlaklık dalga" görsel etkisi, avatar üstüne taşmaz.
    const opacityNum = Math.min(0.6, intensity * 0.7);
    // Hex'i rgba'ya çevir, alpha ile birleştir
    const hexToRgba = (hex: string, a: number) => {
      const m = hex.match(/^#([0-9a-f]{6})$/i);
      if (!m) return hex;
      const r = parseInt(m[1].slice(0, 2), 16);
      const g = parseInt(m[1].slice(2, 4), 16);
      const b = parseInt(m[1].slice(4, 6), 16);
      return `rgba(${r},${g},${b},${a})`;
    };
    const centerColor = hexToRgba(color, opacityNum);
    const edgeColor = hexToRgba(color, 0);
    return (
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -offset, left: -offset,
          width: haloSize, height: haloSize,
          zIndex: 0,
          opacity: pulse ? pulseAnim : 1,
        }}
      >
        <Canvas style={{ width: haloSize, height: haloSize }}>
          <Circle cx={haloSize / 2} cy={haloSize / 2} r={haloSize / 2}>
            <SkiaRG
              c={vec(haloSize / 2, haloSize / 2)}
              r={rOuter}
              colors={[centerColor, edgeColor]}
              positions={[0, 0.7]}
            />
          </Circle>
        </Canvas>
      </Animated.View>
    );
  }

  // Fallback: eski SVG RadialGradient (Skia yokken)
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -offset, left: -offset,
        width: haloSize, height: haloSize,
        zIndex: 0,
        opacity: pulse ? pulseAnim : 1,
      }}
    >
      <Svg width={haloSize} height={haloSize}>
        <Defs>
          <RadialGradient id={gradId} cx="50%" cy="50%" r="70.71%" fx="50%" fy="50%">
            <Stop offset="0" stopColor={color} stopOpacity={String(Math.min(1, intensity))} />
            <Stop offset="0.7" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <SvgCircle cx={haloSize / 2} cy={haloSize / 2} r={haloSize / 2} fill={`url(#${gradId})`} />
      </Svg>
    </Animated.View>
  );
}

// ★ v1.3.68: Avatar Border — Skia Circle stroke (web admin CSS border paritesi).
//   Eski: View borderColor + borderRadius — Android'de dashed/dotted yuvarlama bug'lı,
//   double hiç desteklenmiyordu (manuel iç ring overlay).
//   Yeni: Skia Circle stroke + dashed pattern → tam parite.
function AvatarBorderRing({ size, color, width, style: borderStyle }: {
  size: number; color: string; width: number; style: 'solid' | 'dashed' | 'dotted' | 'double';
}) {
  // Skia ile gerçek vektörel border
  if (SkiaMod) {
    const { Canvas, Circle, DashPathEffect } = SkiaMod;
    const cx = size / 2;
    const cy = size / 2;
    const r = (size - width) / 2;
    return (
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width: size, height: size, zIndex: 2 }}>
        <Canvas style={{ width: size, height: size }}>
          <Circle cx={cx} cy={cy} r={r} color={color} style="stroke" strokeWidth={width}>
            {borderStyle === 'dashed' && <DashPathEffect intervals={[width * 2.5, width * 1.5]} />}
            {borderStyle === 'dotted' && <DashPathEffect intervals={[width * 0.5, width * 1.5]} />}
          </Circle>
          {borderStyle === 'double' && (
            <Circle cx={cx} cy={cy} r={r - width - 1} color={color} style="stroke" strokeWidth={1} />
          )}
        </Canvas>
      </View>
    );
  }

  // Fallback: eski View borderColor (Skia yokken)
  const isDouble = borderStyle === 'double';
  const rnStyle = isDouble ? 'solid' : borderStyle;
  return (
    <>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: size, height: size,
          borderRadius: size / 2,
          borderColor: color,
          borderWidth: width,
          borderStyle: rnStyle,
          zIndex: 2,
          elevation: 2,
        }}
      />
      {isDouble && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: width + 1, left: width + 1,
            width: size - 2 * (width + 1), height: size - 2 * (width + 1),
            borderRadius: (size - 2 * (width + 1)) / 2,
            borderColor: color,
            borderWidth: 1,
            zIndex: 2,
            elevation: 2,
          }}
        />
      )}
    </>
  );
}

// ★ v1.3.68: Pulse Ring (radar dalgası) — Skia Circle stroke ile yumuşak halka.
//   Eski: View borderColor + borderRadius — Android'de border render kaba.
//   Yeni: Animated.View wrapper (scale + opacity) + içeride Skia Circle stroke.
function PulseRingOverlay({ size, color }: { size: number; color: string }) {
  const a1 = useRef(new Animated.Value(0)).current;
  const a2 = useRef(new Animated.Value(0)).current;
  const a3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const mk = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 2400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
    const l1 = mk(a1, 0);
    const l2 = mk(a2, 800);
    const l3 = mk(a3, 1600);
    l1.start(); l2.start(); l3.start();
    return () => { l1.stop(); l2.stop(); l3.stop(); };
  }, [a1, a2, a3]);

  const useSkia = !!SkiaMod;
  const SkiaRingCanvas = useSkia ? (() => {
    const { Canvas, Circle } = SkiaMod;
    const cx = size / 2;
    const r = (size - 2) / 2;
    return (
      <Canvas style={{ width: size, height: size }}>
        <Circle cx={cx} cy={cx} r={r} color={color} style="stroke" strokeWidth={2} />
      </Canvas>
    );
  })() : null;

  return (
    <>
      {[a1, a2, a3].map((anim, i) => {
        const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] });
        const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] });
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0, left: 0,
              width: size, height: size,
              zIndex: 1,
              opacity,
              transform: [{ scale }],
              // Skia yoksa eski View border fallback
              ...(useSkia ? {} : {
                borderRadius: size / 2,
                borderWidth: 2,
                borderColor: color,
                elevation: 1,
              }),
            }}
          >
            {SkiaRingCanvas}
          </Animated.View>
        );
      })}
    </>
  );
}

// ★ v1.3.68 PARİTE: Frame Shimmer — web admin CSS linear-gradient + bg-pos animation.
//   Tüm parametreler web admin slider'larından beslenir:
//     scale: shimmer kutu boyutu (0.3-2.0)
//     speed: bir süpürme süresi saniye (0.5-10)
//     opacity: parlaklık peak (0.05-1)
//     angle: süpürme açısı derece (0-359, default 110)
//     band: bant genişliği (0.05-0.5, peak ± half)
//     reverse: yön ters çevir
function FrameShimmerOverlay({
  size,
  baseSize,
  scale = 1,
  speed = 2.5,
  opacity = 0.4,
  angle = 110,
  band = 0.2,
  reverse = false,
  layer = 'above',
}: {
  size: number; baseSize?: number; scale?: number; speed?: number; opacity?: number;
  angle?: number; band?: number; reverse?: boolean; layer?: 'above' | 'below';
}) {
  // size = frame container boyutu; baseSize = avatar boyutu (parent View bound).
  // Container avatardan büyükse, shimmer'ı avatar merkezine doğru kaydır (web admin parity).
  const parentSize = baseSize ?? size;
  const effSize = size * scale;
  const baseOffset = (parentSize - size) / 2;
  const offsetCenter = baseOffset + (size - effSize) / 2;
  // CSS açı (0° = up) → math (atan tilt). 110° default = ~20° saat yönü
  const cssAngleRad = ((angle - 90) * Math.PI) / 180;
  const tiltX = Math.cos(cssAngleRad);
  const tiltY = Math.sin(cssAngleRad);
  // Bant stop pozisyonları: peak %50, half-width = band/2
  const bandHalf = Math.max(0.02, Math.min(0.48, band / 2));
  const stopStart = 0.5 - bandHalf;
  const stopEnd = 0.5 + bandHalf;
  const peakAlpha = Math.max(0, Math.min(1, opacity));
  const peakColor = `rgba(255,255,255,${peakAlpha})`;

  if (SkiaMod) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Reanimated = require('react-native-reanimated');
    const { useSharedValue, useDerivedValue, withRepeat, withTiming, Easing: RAEasing } = Reanimated;
    const { Canvas, Rect, LinearGradient: SkiaLG, vec, Group } = SkiaMod;

    // CSS bg-pos 200% → -200% = sağdan sola. reverse=true ise -200% → 200% (soldan sağa).
    const startX = reverse ? -effSize * 2 : effSize * 2;
    const endX = reverse ? effSize * 2 : -effSize * 2;
    const tx = useSharedValue(startX);
    useEffect(() => {
      tx.value = startX;
      tx.value = withRepeat(
        withTiming(endX, { duration: Math.max(100, speed * 1000), easing: RAEasing.linear }),
        -1,
        false,
      );
    }, [startX, endX, speed, tx, withRepeat, withTiming, RAEasing]);

    const transform = useDerivedValue(() => [{ translateX: tx.value }]);
    // Gradient yön vektörü: CSS açıya göre start/end noktaları
    const gStart = vec(effSize * (0.5 - tiltX * 0.5), effSize * (0.5 - tiltY * 0.5));
    const gEnd = vec(effSize * (0.5 + tiltX * 0.5), effSize * (0.5 + tiltY * 0.5));

    const zi = layer === 'below' ? 2 : 4;
    return (
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: offsetCenter, left: offsetCenter,
          width: effSize, height: effSize,
          borderRadius: effSize / 2,
          overflow: 'hidden',
          zIndex: zi,
          elevation: zi,
        }}
      >
        <Canvas style={{ width: effSize, height: effSize }}>
          <Group transform={transform}>
            <Rect x={0} y={0} width={effSize} height={effSize}>
              <SkiaLG
                start={gStart}
                end={gEnd}
                colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0)', peakColor, 'rgba(255,255,255,0)', 'rgba(255,255,255,0)']}
                positions={[0, stopStart, 0.5, stopEnd, 1]}
              />
            </Rect>
          </Group>
        </Canvas>
      </View>
    );
  }

  // Fallback: Skia yoksa eski Animated.View + LinearGradient
  const shimmer = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, { toValue: -1, duration: 2500, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);
  const translateX = shimmer.interpolate({ inputRange: [-1, 1], outputRange: [-effSize * 1.2, effSize * 1.2] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: offsetCenter, left: offsetCenter,
        width: effSize, height: effSize,
        borderRadius: effSize / 2,
        overflow: 'hidden',
        zIndex: 4,
        elevation: 4,
        transform: [{ translateX }],
      }}
    >
      <LinearGradient
        colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        locations={[0.3, 0.5, 0.7]}
        style={{ width: '100%', height: '100%' }}
      />
    </Animated.View>
  );
}

// ★ v269 (14 May 2026): BADGE_POS_MOBILE değerleri Web admin paritesi için 0.5/0.55
//   → 0.354 (daire avatar 45°) ile eşitlendi. Audit raporundaki ölü kod tutarsızlığı
//   düzeltildi. StatusAvatar'daki ana BADGE_POS ile birebir aynı.
const BADGE_POS_MOBILE: Record<string, { x: number; y: number }> = {
  tl: { x: -0.354, y: -0.354 }, tc: { x: 0,      y: -0.5   }, tr: { x: 0.354,  y: -0.354 },
  ml: { x: -0.5,   y: 0       },                                mr: { x: 0.5,    y: 0       },
  bl: { x: -0.354, y: 0.354   }, bc: { x: 0,      y: 0.5    }, br: { x: 0.354,  y: 0.354   },
};
function TierBadgeOverlay({ size, position, style: badgeStyle, label }: {
  size: number; position: string; style: string; label: string;
}) {
  // ★ 2026-05-11: Konum hesaplaması düzeltildi — eski transform[-16,-10] hardcoded
  //   badge boyutunu hesaba katmıyordu. Yeni: dış container flex hizalama ile
  //   her boyutta badge tam o noktaya gelir.
  const pos = BADGE_POS_MOBILE[position] || BADGE_POS_MOBILE.tr;
  const badgeFont = Math.max(8, Math.round(size * 0.1));
  const padH = Math.round(badgeFont * 0.7);
  const padV = Math.round(badgeFont * 0.25);
  const isStar = badgeStyle === 'star';
  const isCapsule = badgeStyle === 'capsule';
  const radius = isCapsule ? 999 : isStar ? 0 : 6;

  // Hizalama: pos.x/y -1..1 arası → flex-start / center / flex-end
  const horizAlign = pos.x < -0.2 ? 'flex-start' : pos.x > 0.2 ? 'flex-end' : 'center';
  const vertAlign  = pos.y < -0.2 ? 'flex-start' : pos.y > 0.2 ? 'flex-end' : 'center';
  // Badge avatarın YARIM dışına taşsın istiyoruz (kenarda durur). Margin negatif.
  const overflow = badgeFont * 0.5;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -overflow, left: -overflow,
        right: -overflow, bottom: -overflow,
        alignItems: horizAlign,
        justifyContent: vertAlign,
        zIndex: 5,
        elevation: 5,
      }}
    >
      <View style={{
        backgroundColor: '#fbbf24',
        paddingHorizontal: padH,
        paddingVertical: padV,
        borderRadius: radius,
        borderWidth: 1,
        borderColor: 'rgba(251,191,36,0.6)',
        ...Platform.select({
          ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4 },
          android: { elevation: 5 },
        }),
      }}>
        <Text style={{ color: '#0a0f1a', fontSize: badgeFont, fontWeight: '800', letterSpacing: 0.5 }}>
          {label}
        </Text>
      </View>
    </View>
  );
}

// ★ 2026-05-11: Name Overlay — kullanıcı adı çerçeve etrafında.
//   v1.3.50: react-native-svg eklendi; curve_style 'arc-top' / 'arc-bottom' / 'circle'
//   gerçek yay olarak çıkar. 'flat' her zaman düz RN Text (animasyonlar daha güçlü).
//   Yüzdelik bazlı: name_offset = % avatar yarıçapı, name_size = % avatar boyutu.
function NameOverlay({ size, name, dynCfg }: { size: number; name: string; dynCfg: any }) {
  // ★ v278 (14 May 2026): name_offset cap'lendi — kullanıcı feedback'i: "profil
  //   sayfasında özel tasarım verildiğinde karttaki metinler ile kullanıcının adı ile
  //   diğer metinler karışıyor". 30% güvenli sınır — username/bio/stats alanına taşmaz.
  const offsetPctRaw = dynCfg?.name_offset ?? 25;
  const offsetPct = Math.max(-30, Math.min(30, offsetPctRaw));
  const sizePct = dynCfg?.name_size ?? 14;
  const fontPx = Math.max(8, Math.round((sizePct / 100) * size));
  const offsetPx = (offsetPct / 100) * (size / 2);
  const radius = size / 2 + offsetPx;
  const curveStyle = dynCfg?.name_curve_style || 'flat';

  // ★ 2026-05-11: Konum güvenli — kendi size x size wrapper'ında flex hizalama.
  //   Önceki bug: posStyle absolute parent'a göre yerleşiyordu, parent positioned
  //   değilse veya farklı boyutta ise yazı yanlış yere düşüyordu. Şimdi wrapper
  //   garantili size x size, içeride hizalama doğru çalışır.
  const pos = dynCfg?.name_position || 'bottom';
  // İç hizalama — wrapper size x size, name avatar'ın belirli kenarına
  let containerStyle: any = {};
  let textWrapperStyle: any = {};
  // ★ v1.3.59 REVERT: Önceki frameExtra (frame_scale offset) web admin önizleme
  //   ile UYUMSUZ — text 24 piksel fazla aşağı kayıyordu. Web admin NamePreviewSvg
  //   sadece avatar yarıçapı + offsetPx kullanıyor. Parite için frameExtra kaldırıldı.
  // ★ v1.3.63 PARİTE: left/right — eski formül `translateX(-offsetPx - fontPx*2)`
  //   isim uzunluğunu fontPx*2 ile sabit tahmin ediyordu, uzun isimde text avatar
  //   üstüne biniyor, kısa isimde uzakta kalıyordu. Yeni formül: text wrapper'ı
  //   width:size + flex hizalama ile avatar kenarına kilitle, sonra translateX
  //   `size + offsetPx` kadar tam yana kaydır. Web SVG textPath orta noktasıyla
  //   birebir aynı pozisyon — isim uzunluğundan bağımsız.
  switch (pos) {
    case 'top':
      containerStyle = { justifyContent: 'flex-start', alignItems: 'center' };
      textWrapperStyle = { transform: [{ translateY: -fontPx - offsetPx }] };
      break;
    case 'bottom':
      containerStyle = { justifyContent: 'flex-end', alignItems: 'center' };
      textWrapperStyle = { transform: [{ translateY: fontPx + offsetPx }] };
      break;
    case 'left':
      // Wrapper avatar slot içinde sağa yapışık (text sağ kenarı avatar sol kenarında),
      // sonra dışına size + offsetPx kadar kaydır → text avatar sol kenarından offsetPx
      // uzakta biter (web textAnchor='end' + path orta noktası ile birebir).
      containerStyle = { justifyContent: 'center', alignItems: 'flex-end' };
      textWrapperStyle = {
        width: size,
        transform: [{ translateX: -size - offsetPx }],
      };
      break;
    case 'right':
      // Wrapper avatar slot içinde sola yapışık, dışına size + offsetPx kadar kaydır
      // → text avatar sağ kenarından offsetPx uzakta başlar.
      containerStyle = { justifyContent: 'center', alignItems: 'flex-start' };
      textWrapperStyle = {
        width: size,
        transform: [{ translateX: size + offsetPx }],
      };
      break;
  }

  // ★ 2026-05-11: Tüm animasyonlar paralel çalışsın diye HER birinin ayrı Animated.Value'su.
  //   Web admin'de toggle'lar bağımsız → mobile'da da paralel olmalı (önceden if-else
  //   chain'di, sadece biri çalışıyordu — bug'dı).
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const breatheAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const swingAnim = useRef(new Animated.Value(0)).current;
  const tiltAnim = useRef(new Animated.Value(0)).current;
  const wobbleAnim = useRef(new Animated.Value(0)).current;
  const glowPulseAnim = useRef(new Animated.Value(0)).current;
  // ★ v1.3.56: name_shimmer — text üstünde subtle parıldama (opacity wave).
  //   RN'de gerçek "ışık süpürmesi" MaskedView gerektirir (ek paket); pratik yaklaşım
  //   olarak outer wrapper opacity'sini 0.55 ↔ 1.0 yumuşak dalgalandırıyoruz —
  //   hem flat hem SVG textPath branch'inde tutarlı çalışır.
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  // Hepsi için useEffect — toggle on/off'a göre loop start/stop
  useEffect(() => {
    if (!dynCfg?.name_pulse) return;
    const dur = (dynCfg?.name_pulse_speed ?? 2) * 500;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulseAnim, dynCfg?.name_pulse, dynCfg?.name_pulse_speed]);

  useEffect(() => {
    if (!dynCfg?.name_float) return;
    const dur = (dynCfg?.name_float_speed ?? 4) * 500;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(floatAnim, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(floatAnim, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [floatAnim, dynCfg?.name_float, dynCfg?.name_float_speed]);

  useEffect(() => {
    if (!dynCfg?.name_breathe) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breatheAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(breatheAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [breatheAnim, dynCfg?.name_breathe]);

  useEffect(() => {
    if (!dynCfg?.name_rotation_continuous) return;
    const dur = (dynCfg?.name_rotation_speed ?? 12) * 1000;
    const loop = Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: dur, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [spinAnim, dynCfg?.name_rotation_continuous, dynCfg?.name_rotation_speed]);

  // shake — 0.6sn linear loop (5 keyframe yaklaşık)
  useEffect(() => {
    if (!dynCfg?.name_shake) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 120, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0.5, duration: 120, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -0.5, duration: 120, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [shakeAnim, dynCfg?.name_shake]);

  // swing — sarkaç ±8°
  useEffect(() => {
    if (!dynCfg?.name_swing) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(swingAnim, { toValue: 1, duration: 625, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(swingAnim, { toValue: 0, duration: 625, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(swingAnim, { toValue: -1, duration: 625, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(swingAnim, { toValue: 0, duration: 625, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [swingAnim, dynCfg?.name_swing]);

  // tilt — yan yatma ±3°
  useEffect(() => {
    if (!dynCfg?.name_tilt) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(tiltAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(tiltAnim, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [tiltAnim, dynCfg?.name_tilt]);

  // wobble — titreşim ±2.5°
  useEffect(() => {
    if (!dynCfg?.name_wobble) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(wobbleAnim, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(wobbleAnim, { toValue: -1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(wobbleAnim, { toValue: 0, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [wobbleAnim, dynCfg?.name_wobble]);

  // glow_pulse — text shadow yoğunluğu dalgalanır
  useEffect(() => {
    if (!dynCfg?.name_glow || !dynCfg?.name_glow_pulse) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glowPulseAnim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      Animated.timing(glowPulseAnim, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [glowPulseAnim, dynCfg?.name_glow, dynCfg?.name_glow_pulse]);

  // ★ v1.3.56: name_shimmer — outer wrapper opacity 0.55 ↔ 1.0 yumuşak pulse.
  useEffect(() => {
    if (!dynCfg?.name_shimmer) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(shimmerAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(shimmerAnim, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim, dynCfg?.name_shimmer]);

  // Renk döngüsü (color_cycle veya name_color_cycle)
  const [cycleColor, setCycleColor] = useState<string | null>(null);
  useEffect(() => {
    if (!dynCfg?.name_color_cycle) { setCycleColor(null); return; }
    const speedSec = dynCfg?.color_cycle_speed ?? 12;
    const startMs = Date.now();
    const id = setInterval(() => {
      const elapsed = (Date.now() - startMs) / 1000;
      const hue = ((elapsed / speedSec) * 360) % 360;
      setCycleColor(`hsl(${Math.round(hue)}, 85%, 65%)`);
    }, 100);
    return () => clearInterval(id);
  }, [dynCfg?.name_color_cycle, dynCfg?.color_cycle_speed]);

  // Transform stack — paralel: tüm aktif animasyonlar üst üste eklenir
  const transformStack: any[] = [];
  if (dynCfg?.name_pulse)               transformStack.push({ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) });
  if (dynCfg?.name_breathe)             transformStack.push({ scale: breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) });
  if (dynCfg?.name_float)               transformStack.push({ translateY: floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) });
  if (dynCfg?.name_shake)               transformStack.push({ translateX: shakeAnim.interpolate({ inputRange: [-1, 1], outputRange: [-2, 2] }) });
  if (dynCfg?.name_rotation_continuous) transformStack.push({ rotate: spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) });
  if (dynCfg?.name_swing)               transformStack.push({ rotate: swingAnim.interpolate({ inputRange: [-1, 1], outputRange: ['-8deg', '8deg'] }) });
  if (dynCfg?.name_tilt)                transformStack.push({ rotate: tiltAnim.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] }) });
  if (dynCfg?.name_wobble)              transformStack.push({ rotate: wobbleAnim.interpolate({ inputRange: [-1, 1], outputRange: ['-2.5deg', '2.5deg'] }) });
  // ★ v275 (14 May 2026): Static rotation HER ZAMAN uygulanır, animasyonlar UZERINE ek
  //   olarak compose edilir. Önceden hasDynamicRotate ile bloke ediliyordu → kullanıcı
  //   name_swing aktif ederse name_rotation:45° unutuluyordu. Şimdi 45° base + ±8° swing
  //   = ekran 37°↔53° arasında salınır (compose).
  if ((dynCfg?.name_rotation ?? 0) !== 0) {
    transformStack.push({ rotate: `${dynCfg?.name_rotation}deg` });
  }

  const color = cycleColor || dynCfg?.name_color || '#f8fafc';
  const glowColor = dynCfg?.name_glow_color || color;
  const glowIntensity = dynCfg?.name_glow_intensity ?? 0.6;
  const baseOpacity = dynCfg?.name_opacity ?? 1;
  // ★ v1.3.56: shimmer aktif iken outer wrapper opacity'si dalgalanır
  //   v1.3.59: Daha dramatic shimmer (0.4 ↔ 1.0) — web admin önizleme parite.
  const opacity: number | Animated.AnimatedInterpolation<number> = dynCfg?.name_shimmer
    ? shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [baseOpacity * 0.4, baseOpacity] })
    : baseOpacity;

  // ★ v1.3.59: Glow text-shadow radius — web admin 2 katmanlı box-shadow
  //   (4+intensity*6 + 10+intensity*12 → ~25px) ile parite. RN tek katman shadow
  //   olduğu için radius'u arttırıp tek yumuşak geniş glow simülasyonu.
  const baseGlowRadius = dynCfg?.name_glow ? 14 + glowIntensity * 18 : 2;
  const animatedGlowRadius = dynCfg?.name_glow_pulse
    ? glowPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [baseGlowRadius * 0.7, baseGlowRadius * 1.3] })
    : baseGlowRadius;

  // Wave — harf-harf yukarı dalga (sadece düz/flat, RN'de tspan yok)
  const showWave = dynCfg?.name_wave && curveStyle === 'flat';

  // ★ 2026-05-11: SVG branch — arc-top / arc-bottom / circle gerçek yay olarak render.
  //   Path avatar etrafında yarıçap radius'ta. SVG wrapper avatardan büyük (2.4x) ki
  //   yazı dışa taşabilsin. Animasyonlar Animated.View ile dış kabuğa uygulanır.
  if (curveStyle !== 'flat') {
    const svgSize = Math.max(size * 2.4, (radius + fontPx) * 2.4);
    const cx = svgSize / 2;
    const cy = svgSize / 2;
    let pathD = '';
    if (curveStyle === 'arc-top') {
      pathD = `M ${cx - radius},${cy} A ${radius},${radius} 0 0,1 ${cx + radius},${cy}`;
    } else if (curveStyle === 'arc-bottom') {
      pathD = `M ${cx - radius},${cy} A ${radius},${radius} 0 0,0 ${cx + radius},${cy}`;
    } else {
      // circle — tam daire (saat yönünde, üstten başlar)
      pathD = `M ${cx},${cy - radius} A ${radius},${radius} 0 1,1 ${cx - 0.01},${cy - radius} Z`;
    }
    const svgOffset = -(svgSize - size) / 2;
    return (
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: svgOffset, left: svgOffset,
          width: svgSize, height: svgSize,
          zIndex: 6, elevation: 6,
          opacity,
          transform: transformStack.length > 0 ? transformStack : undefined,
        }}
      >
        <Svg width={svgSize} height={svgSize}>
          <Defs>
            <Path id={`namepath-${size}-${curveStyle}`} d={pathD} fill="transparent" />
          </Defs>
          <SvgText
            fill={color}
            fontSize={fontPx}
            fontWeight={dynCfg?.name_bold ? '700' : '400'}
            textAnchor="middle"
            stroke={dynCfg?.name_glow ? glowColor : undefined}
            strokeWidth={dynCfg?.name_glow ? 0.5 : 0}
          >
            <TextPath href={`#namepath-${size}-${curveStyle}`} startOffset="50%">
              {name}
            </TextPath>
          </SvgText>
        </Svg>
      </Animated.View>
    );
  }

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0, left: 0,
        width: size, height: size,
        zIndex: 6, elevation: 6,
        ...containerStyle,
      }}
    >
    <Animated.View
      pointerEvents="none"
      style={{
        ...textWrapperStyle,
        opacity,
        transform: [
          ...(textWrapperStyle.transform || []),
          ...transformStack,
        ],
        flexDirection: showWave ? 'row' : undefined,
      }}
    >
      {showWave ? (
        // Wave: her harf ayrı Animated.Text, kendi delay'iyle yukarı-aşağı
        name.split('').map((ch, i) => (
          <WaveLetter key={i} char={ch} index={i} fontPx={fontPx}
            color={color} glowColor={glowColor} glowRadius={baseGlowRadius}
            bold={!!dynCfg?.name_bold} />
        ))
      ) : dynCfg?.name_shimmer && SkiaMod ? (
        // ★ v1.3.68: Skia sliding gradient shimmer (web admin CSS background-clip:text parity).
        //   Text Skia ile çizilir, içindeki LinearGradient shader translateX ile kayar.
        //   colorCycle aktifse rainbow gradient (gerçek gradient görüntüsü).
        <SkiaShimmerText
          name={name}
          fontPx={fontPx}
          color={color}
          bold={!!dynCfg?.name_bold}
          glowColor={glowColor}
          glowEnabled={!!dynCfg?.name_glow}
          glowRadius={baseGlowRadius}
          pos={pos}
          size={size}
          rainbow={!!dynCfg?.name_color_cycle}
        />
      ) : (
        <Animated.Text
          numberOfLines={1}
          style={{
            color,
            fontSize: fontPx,
            fontWeight: dynCfg?.name_bold ? '700' : '400',
            textAlign: pos === 'left' ? 'right' : pos === 'right' ? 'left' : 'center',
            width: (pos === 'left' || pos === 'right') ? size : undefined,
            textShadowColor: dynCfg?.name_glow ? glowColor : 'rgba(0,0,0,0.7)',
            textShadowRadius: animatedGlowRadius as any,
            textShadowOffset: { width: 0, height: 1 },
          }}
        >
          {name}
        </Animated.Text>
      )}
    </Animated.View>
    </View>
  );
}

// ★ v1.3.68: Skia text + sliding LinearGradient shader — gerçek shimmer (web admin
//   CSS background-clip:text + bg-position animation paritesi).
//   Sadece name_shimmer=true ve flat (non-wave, non-curve) durumda kullanılır.
function SkiaShimmerText({
  name, fontPx, color, bold, glowColor, glowEnabled, glowRadius, pos, size, rainbow,
}: {
  name: string; fontPx: number; color: string; bold: boolean;
  glowColor: string; glowEnabled: boolean; glowRadius: number;
  pos: string; size: number; rainbow?: boolean;
}) {
  const { Canvas, Text: SkText, matchFont, LinearGradient: SkiaLG, vec, Group } = SkiaMod;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Reanimated = require('react-native-reanimated');
  const { useSharedValue, useDerivedValue, withRepeat, withTiming, Easing: RAEasing } = Reanimated;

  // ★ v1.3.69: Inter fontu — web admin de Inter kullanıyor, parity için APK de aynı.
  //   @expo-google-fonts/inter zaten yüklü (app/_layout.tsx).
  const font = useMemo(() => matchFont({
    fontFamily: bold ? 'Inter_700Bold' : 'Inter_400Regular',
    fontSize: fontPx,
    fontStyle: 'normal',
    fontWeight: bold ? 'bold' : 'normal',
  } as any), [fontPx, bold]);

  const textWidth = useMemo(() => {
    try { return font?.measureText ? font.measureText(name).width : name.length * fontPx * 0.55; }
    catch { return name.length * fontPx * 0.55; }
  }, [font, name, fontPx]);

  const canvasW = textWidth + fontPx * 2 + glowRadius * 2;
  const canvasH = fontPx * 1.6 + glowRadius * 2;
  const textY = fontPx + glowRadius; // baseline pozisyonu
  const textX = fontPx + glowRadius; // sol padding

  // Shimmer: gradient shader translation. Gradient genişliği textWidth × 2.5.
  const tx = useSharedValue(-textWidth);
  useEffect(() => {
    tx.value = -textWidth;
    tx.value = withRepeat(
      withTiming(textWidth * 2, { duration: 2200, easing: RAEasing.linear }),
      -1,
      false,
    );
  }, [textWidth, tx, withRepeat, withTiming, RAEasing]);
  const shaderTransform = useDerivedValue(() => [{ translateX: tx.value }]);

  const wrapperAlignment = pos === 'left' ? 'flex-end' : pos === 'right' ? 'flex-start' : 'center';

  return (
    <View style={{ width: pos === 'left' || pos === 'right' ? size : 'auto', alignItems: wrapperAlignment }}>
      <Canvas style={{ width: canvasW, height: canvasH }}>
        <Group>
          {/* Glow halo (Skia BlurMask) — name_glow açıkken */}
          {glowEnabled && (
            <SkText x={textX} y={textY} text={name} font={font} color={glowColor} opacity={0.7}>
              {/* @ts-ignore Skia BlurMask Path/Text içinde geçerli */}
              <SkiaMod.BlurMask blur={Math.max(2, glowRadius / 3)} style="normal" />
            </SkText>
          )}
          {/* Ana text + sliding gradient fill */}
          <SkText x={textX} y={textY} text={name} font={font}>
            <SkiaLG
              start={vec(0, 0)}
              end={vec(textWidth, 0)}
              colors={rainbow
                ? ['#ff6b9d', '#ffd93d', '#6bcb77', '#4d96ff', '#9b59b6', '#ff6b9d', '#ffd93d']
                : [color, color, glowEnabled ? glowColor : '#fffacd', color, color]}
              positions={rainbow
                ? [0, 0.18, 0.36, 0.54, 0.72, 0.9, 1]
                : [0, 0.35, 0.5, 0.65, 1]}
              transform={shaderTransform}
            />
          </SkText>
        </Group>
      </Canvas>
    </View>
  );
}

// ★ Wave için tek harf — kendi yukarı-aşağı animasyonu, dağıtık delay
function WaveLetter({ char, index, fontPx, color, glowColor, glowRadius, bold }: {
  char: string; index: number; fontPx: number; color: string; glowColor: string; glowRadius: number; bold: boolean;
}) {
  const wave = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let cancelled = false;
    let loop: Animated.CompositeAnimation | null = null;
    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      loop = Animated.loop(Animated.sequence([
        Animated.timing(wave, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(wave, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]));
      loop.start();
    }, index * 80);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      loop?.stop();
    };
  }, [wave, index]);
  const translateY = wave.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });
  return (
    <Animated.Text
      style={{
        color,
        fontSize: fontPx,
        fontWeight: bold ? '700' : '400',
        textShadowColor: glowColor,
        textShadowRadius: glowRadius,
        textShadowOffset: { width: 0, height: 1 },
        transform: [{ translateY }],
      }}
    >
      {char}
    </Animated.Text>
  );
}

// ★ v215: PNG frame — statik Image render. Lottie'siz, hafif, premium PNG çerçeveler.
function PngFrame({ meta, size, dynCfg }: { meta: any; size: number; dynCfg?: any }) {
  const dynScale = dynCfg?.frame_scale ?? 1.0;
  const dynOffsetX = dynCfg?.frame_offset_x ?? 0;
  const dynOffsetY = dynCfg?.frame_offset_y ?? 0;
  const dynOpacity = dynCfg?.frame_opacity ?? 1;
  const dynBreathe = !!dynCfg?.frame_breathe;
  const dynColorCycle = !!dynCfg?.color_cycle;
  // ★ 2026-05-11: frame_rotation (sürekli dönme) + frame_wobble — Lottie'de zaten var,
  //   PNG/Remote'a da pariteli olsun.
  const dynRotation = dynCfg?.frame_rotation ?? 0;
  const dynWobble = !!dynCfg?.frame_wobble;

  const frameSize = Math.round(size * meta.scale * dynScale);
  const baseOffset = (frameSize - size) / -2;
  const offsetX = baseOffset + Math.round(dynOffsetX * size);
  const offsetY = baseOffset + Math.round(dynOffsetY * size);

  // ★ frame_breathe — yumuşak nefes
  const breatheAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!dynBreathe) { breatheAnim.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breatheAnim, { toValue: 1.06, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(breatheAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [dynBreathe, breatheAnim]);

  // ★ frame_rotation — sürekli dönme (sn / 1 tur)
  const rotateAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (dynRotation <= 0) return;
    const loop = Animated.loop(
      Animated.timing(rotateAnim, { toValue: 1, duration: dynRotation * 1000, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [dynRotation, rotateAnim]);

  // ★ frame_wobble — ±2.5° hafif sallanma (rotate yoksa)
  const wobbleAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!dynWobble) { wobbleAnim.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(wobbleAnim, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(wobbleAnim, { toValue: -1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(wobbleAnim, { toValue: 0, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [dynWobble, wobbleAnim]);

  // ★ v1.3.68: color_cycle — Skia ColorMatrix ile gerçek hue-rotate.
  //   Eski: tintColor + hsl(N,80%,60%) → tüm PNG'yi düz renkle değiştiriyor (fosforlu pembe/yeşil bug).
  //   Yeni: Skia <Image> + <ColorMatrix> hue-rotate matris → orijinal renkleri koruyup tonu kaydırır.
  //   Animasyon Skia native clock üzerinden çalışır → React re-render YOK, GPU-side, frame drop yok.
  const useSkiaColorCycle = dynColorCycle && !!SkiaMod;
  const speedSec = dynCfg?.color_cycle_speed ?? 12;

  // Transform stack — rotate + scale + wobble paralel çalışabilir
  const transformStack: any[] = [];
  if (dynRotation > 0) {
    transformStack.push({ rotate: rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) });
  }
  if (dynWobble && dynRotation === 0) {
    transformStack.push({ rotate: wobbleAnim.interpolate({ inputRange: [-1, 1], outputRange: ['-2.5deg', '2.5deg'] }) });
  }
  if (dynBreathe) transformStack.push({ scale: breatheAnim });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: offsetY, left: offsetX,
        width: frameSize, height: frameSize,
        alignItems: 'center', justifyContent: 'center',
        overflow: 'visible',
        zIndex: 3,
        opacity: dynOpacity,
        transform: transformStack.length > 0 ? transformStack : undefined,
      }}
    >
      {useSkiaColorCycle ? (
        <PngFrameSkiaHueRotate source={meta.source} size={frameSize} speedSec={speedSec} />
      ) : (
        <Image
          source={meta.source}
          resizeMode="contain"
          style={{ width: frameSize, height: frameSize }}
        />
      )}
    </Animated.View>
  );
}

/**
 * PngFrame + color_cycle için Skia hue-rotate renderer.
 * Reanimated useSharedValue + withRepeat ile GPU-side hue animasyonu → React re-render YOK.
 * matrix bir Reanimated derived value, Skia ColorMatrix props olarak alır ve UI thread'de günceller.
 */
function PngFrameSkiaHueRotate({ source, size, speedSec }: { source: any; size: number; speedSec: number }) {
  const { Canvas, Image: SkiaImage, ColorMatrix, useImage } = SkiaMod;
  // require import — Reanimated her zaman yüklü olmayabilir, defensive
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Reanimated = require('react-native-reanimated');
  const { useSharedValue, useDerivedValue, withRepeat, withTiming, Easing: RAEasing } = Reanimated;

  // Skia useImage local require'd kaynaklar için bazen güvenilir değil — explicit URI çevirisi yap.
  const resolvedSource = React.useMemo(() => {
    if (!source) return null;
    if (typeof source === 'string') return source;
    if (typeof source === 'number') {
      const resolved = Image.resolveAssetSource(source);
      return resolved?.uri || null;
    }
    if (typeof source === 'object' && source.uri) return source.uri;
    return null;
  }, [source]);

  const image = useImage(resolvedSource);
  const hue = useSharedValue(0);
  React.useEffect(() => {
    hue.value = 0;
    hue.value = withRepeat(
      withTiming(360, { duration: speedSec * 1000, easing: RAEasing.linear }),
      -1, // infinite
      false,
    );
  }, [speedSec, hue, withRepeat, withTiming, RAEasing]);
  // ★ Worklet: matrisi UI thread'de hesapla — dışarıdaki JS fonksiyonu çağrılamıyor.
  //   CSS filter:hue-rotate(Ndeg) W3C spec 5x4 ColorMatrix inline.
  const matrix = useDerivedValue(() => {
    'worklet';
    const deg = hue.value;
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return [
      0.213 + cos * 0.787 - sin * 0.213, 0.715 - cos * 0.715 - sin * 0.715, 0.072 - cos * 0.072 + sin * 0.928, 0, 0,
      0.213 - cos * 0.213 + sin * 0.143, 0.715 + cos * 0.285 + sin * 0.140, 0.072 - cos * 0.072 - sin * 0.283, 0, 0,
      0.213 - cos * 0.213 - sin * 0.787, 0.715 - cos * 0.715 + sin * 0.715, 0.072 + cos * 0.928 + sin * 0.072, 0, 0,
      0, 0, 0, 1, 0,
    ];
  });

  if (!image) {
    return <View style={{ width: size, height: size }} />;
  }
  return (
    <Canvas style={{ width: size, height: size }}>
      <SkiaImage image={image} x={0} y={0} width={size} height={size} fit="contain">
        <ColorMatrix matrix={matrix} />
      </SkiaImage>
    </Canvas>
  );
}

// ★ v108.16: Lottie frame — sadece kanatlı (useMidLoop) frame'ler için intro+mid-loop
//   pattern; diğer frame'ler default full loop. Kanat açılma sallanma efekti elde edilir.
function LottieFrame({ meta, size, dynCfg }: { meta: any; size: number; dynCfg?: any }) {
  const ip = meta.source?.ip ?? 0;
  const op = meta.source?.op ?? 90;
  const totalFrames = op - ip;
  const loopStart = Math.floor(ip + totalFrames * 0.58);
  const useMidLoop = !!meta.useMidLoop;

  const [phase, setPhase] = useState<'intro' | 'loop'>(useMidLoop ? 'intro' : 'loop');
  const loopSource = useMemo(
    () => ({ ...meta.source, ip: loopStart, op: Math.max(loopStart + 2, op - 2) }),
    [meta.source, loopStart, op]
  );

  // ★ v213f: Web admin'den ayarlanan dynamic frame config
  //   frame_scale, offset, rotation, opacity, lottie_speed → buradan uygulanır
  const dynScale = dynCfg?.frame_scale ?? 1.0;
  const dynOffsetX = dynCfg?.frame_offset_x ?? 0;
  const dynOffsetY = dynCfg?.frame_offset_y ?? 0;
  const dynRotation = dynCfg?.frame_rotation ?? 0;  // sn / tam tur (0 = sabit)
  const dynOpacity = dynCfg?.frame_opacity ?? 1;
  const dynLottieSpeed = dynCfg?.lottie_speed ?? 0.85;
  // ★ 2026-05-11: frame_breathe — frame yavaş büyüyüp küçülür (4 sn döngü)
  const dynBreathe = !!dynCfg?.frame_breathe;
  const dynWobble = !!dynCfg?.frame_wobble;
  // ★ v1.3.54: Lottie filter (hue_rotate/brightness/saturation) — Lottie kütüphanesi
  //   native filter desteklemez. Yaklaşık efekt için renkli overlay + blend opacity.
  //   Tam parite değil ama görsel olarak kullanıcı admin'de değişiklik yaptığında
  //   mobile'da fark görür (kahverengi → mavi tonlama, parlaklık az/çok).
  const lottieHue = dynCfg?.lottie_hue_rotate ?? 0;       // 0-360°
  const lottieBrightness = dynCfg?.lottie_brightness ?? 1; // 0.5-1.5
  const lottieSaturation = dynCfg?.lottie_saturation ?? 1; // 0-2
  const hasLottieFilter = lottieHue !== 0 || lottieBrightness !== 1 || lottieSaturation !== 1;

  const lottieSize = Math.round(size * meta.scale * dynScale);
  const baseOffset = (lottieSize - size) / -2;
  const offsetX = baseOffset + Math.round(dynOffsetX * size);
  const offsetY = baseOffset + Math.round(dynOffsetY * size);

  // ★ Sürekli dönme animasyonu (frame_rotation > 0 ise)
  const rotateAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (dynRotation <= 0) return;
    const loop = Animated.loop(
      Animated.timing(rotateAnim, { toValue: 1, duration: dynRotation * 1000, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [dynRotation, rotateAnim]);

  // ★ Frame breathe — scale 1↔1.06 yumuşak nefes
  const breatheAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!dynBreathe) {
      breatheAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, { toValue: 1.06, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breatheAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [dynBreathe, breatheAnim]);

  // ★ Frame wobble — ±2.5° hafif sallanma (2 sn)
  const wobbleAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!dynWobble) { wobbleAnim.setValue(0); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wobbleAnim, { toValue: 1,  duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(wobbleAnim, { toValue: -1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(wobbleAnim, { toValue: 0,  duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [dynWobble, wobbleAnim]);

  const rotateInterp = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const wobbleInterp = wobbleAnim.interpolate({ inputRange: [-1, 1], outputRange: ['-2.5deg', '2.5deg'] });

  // Transform stack — rotate + scale + wobble birlikte çalışabilir
  const transformStack: any[] = [];
  if (dynRotation > 0) transformStack.push({ rotate: rotateInterp });
  if (dynWobble && dynRotation === 0) transformStack.push({ rotate: wobbleInterp });
  if (dynBreathe) transformStack.push({ scale: breatheAnim });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: offsetY, left: offsetX,
        width: lottieSize, height: lottieSize,
        alignItems: 'center', justifyContent: 'center',
        overflow: 'visible',
        zIndex: 3,
        opacity: dynOpacity,
        transform: transformStack.length > 0 ? transformStack : undefined,
      }}
    >
      <LottieView
        source={useMidLoop && phase === 'intro' ? meta.source : (useMidLoop ? loopSource : meta.source)}
        autoPlay
        loop={!useMidLoop || phase === 'loop'}
        speed={dynLottieSpeed}
        resizeMode={meta.resizeMode}
        onAnimationFinish={() => {
          if (useMidLoop && phase === 'intro') setPhase('loop');
        }}
        style={{ width: lottieSize, height: lottieSize }}
      />
      {/* ★ v1.3.54: Lottie filter yaklaşımı — gerçek feColorMatrix yok, renkli overlay ile yaklaşık.
           hue_rotate: HSL renk overlay'i; brightness: beyaz/siyah katman; saturation<1: gri katman. */}
      {hasLottieFilter && (
        <View pointerEvents="none" style={{
          position: 'absolute',
          top: 0, left: 0,
          width: lottieSize, height: lottieSize,
          borderRadius: lottieSize / 2,
        }}>
          {lottieHue !== 0 && (
            <View style={{
              position: 'absolute',
              top: 0, left: 0,
              width: lottieSize, height: lottieSize,
              backgroundColor: `hsl(${lottieHue}, 70%, 50%)`,
              // ★ v275: opacity 0.25 → 0.45 (kullanıcı "lottie renk filtreleri çalışmıyor"
              //   feedback'i: değişim çok zayıftı). Web admin tarafı da paralel artırıldı.
              opacity: 0.45,
              borderRadius: lottieSize / 2,
            }} />
          )}
          {lottieBrightness !== 1 && (
            <View style={{
              position: 'absolute',
              top: 0, left: 0,
              width: lottieSize, height: lottieSize,
              backgroundColor: lottieBrightness > 1 ? 'white' : 'black',
              opacity: Math.min(0.7, Math.abs(lottieBrightness - 1) * 0.6),
              borderRadius: lottieSize / 2,
            }} />
          )}
          {lottieSaturation < 1 && (
            <View style={{
              position: 'absolute',
              top: 0, left: 0,
              width: lottieSize, height: lottieSize,
              backgroundColor: 'rgba(128,128,128,1)',
              opacity: (1 - lottieSaturation) * 0.55,
              borderRadius: lottieSize / 2,
            }} />
          )}
        </View>
      )}
    </Animated.View>
  );
}

interface Props {
  /** profiles.active_frame değeri — null/undefined ise hiçbir şey render etmez */
  frameId?: string | null;
  /** Avatar boyutu (px) — frame buna göre genişler */
  size: number;
  /** ★ v110.14: true ise Lottie dalı atlanır, sadece sade palette halka render edilir.
   *  Sahnedeki host olmayan kullanıcılarda (avatar dengesizliği için) kullanılır;
   *  herkes Plus halka boyutunda görünür, sadece host kanatlı Lottie alır. */
  forceRing?: boolean;
  /** ★ 2026-05-11: Opsiyonel — name overlay aktifse gerçek kullanıcı adı render edilir.
   *  Sağlanmadıysa name_enabled config olsa bile gösterilmez (ham frame). */
  userName?: string;
  /** ★ 2026-05-11: Opsiyonel — tier badge aktifse rozet metni (PRO/PLUS/FREE).
   *  Sağlanmadıysa tier_badge_enabled olsa bile gösterilmez. */
  userTier?: string;
  /** ★ v1.3.55: size_overrides anahtarı override'ı (parent ekran "ben profilim" der). */
  contextKey?: SizeKey;
}

// ★ v110.7 (6 May 2026): Web admin panelinden eklenen Lottie/PNG URL'lerinden runtime
//   render. Registry/palette'de bulunmayan ürünler için cosmetic_items.meta'dan asset_url
//   çekilir, Lottie'ye {uri} ile veya Image'e source ile bağlanır.
function RemoteAssetFrame({ frameId, size, dynCfg }: { frameId: string; size: number; dynCfg?: any }) {
  // Senkron cache hit — flicker önler
  const initial = getCachedCosmeticAsset(frameId);
  const [asset, setAsset] = useState<AssetMeta | null>(initial);

  useEffect(() => {
    let cancelled = false;
    if (initial) return; // zaten cache'de var
    getCosmeticAsset(frameId).then(m => {
      if (!cancelled) setAsset(m);
    });
    return () => { cancelled = true; };
  }, [frameId, initial]);

  // ★ frame_breathe — yumuşak nefes
  const dynBreathe = !!dynCfg?.frame_breathe;
  const breatheAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!dynBreathe) { breatheAnim.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breatheAnim, { toValue: 1.06, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(breatheAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [dynBreathe, breatheAnim]);

  // ★ 2026-05-11: frame_rotation + frame_wobble — Lottie/PNG paritesi.
  const dynRotation = dynCfg?.frame_rotation ?? 0;
  const dynWobble = !!dynCfg?.frame_wobble;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (dynRotation <= 0) return;
    const loop = Animated.loop(
      Animated.timing(rotateAnim, { toValue: 1, duration: dynRotation * 1000, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [dynRotation, rotateAnim]);
  const wobbleAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!dynWobble) { wobbleAnim.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(wobbleAnim, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(wobbleAnim, { toValue: -1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(wobbleAnim, { toValue: 0, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [dynWobble, wobbleAnim]);

  // ★ v1.3.68: color_cycle — Skia ColorMatrix hue-rotate (web admin filter:hue-rotate paritesi).
  //   Eski: tintColor + hsl() → fosforlu solid renk bug. Yeni: orijinal görseli koruyarak hue kaydırma.
  const dynColorCycle = !!dynCfg?.color_cycle;
  const useSkiaColorCycle = dynColorCycle && !!SkiaMod;
  const colorCycleSpeedSec = dynCfg?.color_cycle_speed ?? 12;

  if (!asset || !asset.url) return null;

  // ★ v1.3.63 PARİTE: Web admin slider'larını RemoteAssetFrame'e bağla.
  //   Eski: sabit 1.8x (lottie) / 1.4x (image), offset/opacity/speed yoksayılıyordu.
  //   Yeni: web admin FrameEditor.tsx ile birebir formül kullanılır:
  //     frameContainerSize = size × baseFactor × frame_scale
  //     baseFactor = isLottie ? 1.8 : 1.4   (registry yok = remoteFactor)
  //     offsetX/Y = (frameSize-size)/-2 + frame_offset × size
  //   Böylece web admin'de slider'a basınca APK'da gerçek değişiklik olur.
  const isLottie = asset.type === 'lottie';
  const baseFactor = isLottie ? 1.8 : 1.4;
  const dynScale = dynCfg?.frame_scale ?? 1.0;
  const dynOffsetX = dynCfg?.frame_offset_x ?? 0;
  const dynOffsetY = dynCfg?.frame_offset_y ?? 0;
  const dynOpacity = dynCfg?.frame_opacity ?? 1;
  const dynLottieSpeed = dynCfg?.lottie_speed ?? 0.85;
  // Lottie filter (yaklaşık, renkli overlay) — LottieFrame ile aynı formül
  const lottieHue = dynCfg?.lottie_hue_rotate ?? 0;
  const lottieBrightness = dynCfg?.lottie_brightness ?? 1;
  const lottieSaturation = dynCfg?.lottie_saturation ?? 1;
  const hasLottieFilter = isLottie && (lottieHue !== 0 || lottieBrightness !== 1 || lottieSaturation !== 1);

  const frameSize = Math.round(size * baseFactor * dynScale);
  const baseOffset = (frameSize - size) / -2;
  const offsetX = baseOffset + Math.round(dynOffsetX * size);
  const offsetY = baseOffset + Math.round(dynOffsetY * size);

  // Transform stack — rotate + scale + wobble paralel çalışabilir
  const _transformStack: any[] = [];
  if (dynRotation > 0) {
    _transformStack.push({ rotate: rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) });
  }
  if (dynWobble && dynRotation === 0) {
    _transformStack.push({ rotate: wobbleAnim.interpolate({ inputRange: [-1, 1], outputRange: ['-2.5deg', '2.5deg'] }) });
  }
  if (dynBreathe) _transformStack.push({ scale: breatheAnim });
  const transformStack = _transformStack.length > 0 ? _transformStack : undefined;

  if (isLottie && LottieView) {
    return (
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: offsetY, left: offsetX,
          width: frameSize, height: frameSize,
          alignItems: 'center', justifyContent: 'center',
          zIndex: 3,
          elevation: 3,
          opacity: dynOpacity,
          transform: transformStack,
        }}
      >
        <LottieView
          source={{ uri: asset.url }}
          autoPlay
          loop
          speed={dynLottieSpeed}
          resizeMode="contain"
          style={{ width: '100%', height: '100%' }}
        />
        {/* ★ v1.3.63: Lottie filter yaklaşımı — LottieFrame ile aynı renkli overlay.
              hue_rotate: HSL renk overlay'i; brightness: beyaz/siyah katman; saturation<1: gri. */}
        {hasLottieFilter && (
          <View pointerEvents="none" style={{
            position: 'absolute',
            top: 0, left: 0,
            width: frameSize, height: frameSize,
            borderRadius: frameSize / 2,
          }}>
            {lottieHue !== 0 && (
              <View style={{
                position: 'absolute',
                top: 0, left: 0,
                width: frameSize, height: frameSize,
                backgroundColor: `hsl(${lottieHue}, 70%, 50%)`,
                opacity: 0.25,
                borderRadius: frameSize / 2,
              }} />
            )}
            {lottieBrightness !== 1 && (
              <View style={{
                position: 'absolute',
                top: 0, left: 0,
                width: frameSize, height: frameSize,
                backgroundColor: lottieBrightness > 1 ? 'white' : 'black',
                opacity: Math.min(0.5, Math.abs(lottieBrightness - 1) * 0.4),
                borderRadius: frameSize / 2,
              }} />
            )}
            {lottieSaturation < 1 && (
              <View style={{
                position: 'absolute',
                top: 0, left: 0,
                width: frameSize, height: frameSize,
                backgroundColor: 'rgba(128,128,128,1)',
                opacity: (1 - lottieSaturation) * 0.4,
                borderRadius: frameSize / 2,
              }} />
            )}
          </View>
        )}
      </Animated.View>
    );
  }

  // Image (PNG/SVG/WebP) — frame_scale/offset/opacity/cycle/lottie filter destekli
  if (asset.type === 'image') {
    return (
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: offsetY, left: offsetX,
          width: frameSize, height: frameSize,
          zIndex: 3,
          elevation: 3,
          opacity: dynOpacity,
          transform: transformStack,
        }}
      >
        {useSkiaColorCycle ? (
          <PngFrameSkiaHueRotate source={asset.url} size={frameSize} speedSec={colorCycleSpeedSec} />
        ) : (
          <Image
            source={{ uri: asset.url }}
            resizeMode="contain"
            style={{ width: '100%', height: '100%' }}
          />
        )}
      </Animated.View>
    );
  }

  return null;
}

function AvatarFrameImpl({ frameId, size, forceRing, userName, userTier, contextKey }: Props) {
  // ★ v1.3.55: contextKey set edilirse onu kullan (ProfileHero gibi "ekran bağlamı" bilen yerler),
  //   yoksa pickSizeKey(size) ile pixel boyutuna göre seç.
  const sizeKey: SizeKey = contextKey ?? pickSizeKey(size);
  const [dynCfg, setDynCfg] = useState<any>(getCachedFrameConfig(frameId, sizeKey));
  useEffect(() => {
    if (!frameId) { setDynCfg(null); return; }
    ensureFrameConfig(frameId, sizeKey).then(setDynCfg);
  }, [frameId, sizeKey]);

  useEffect(() => {
    if (!frameId) return;
    const unsub = subscribeConfigChange((changedId) => {
      if (changedId !== frameId) return;
      ensureFrameConfig(frameId, sizeKey).then(setDynCfg);
    });
    return unsub;
  }, [frameId, sizeKey]);

  if (!frameId) return null;

  // ★ v108.13: Boyuta göre render — büyük avatarlarda Lottie, küçüklerde sade halka.
  // ★ v110.14: forceRing=true ise Lottie atlanır (sahnede host hariç herkes için
  //   sade halka — boyut dengesi için kullanıcı talebi).
  const meta = getFrameMeta(frameId);
  const hasParticles = dynCfg?.particle_type && dynCfg.particle_type !== 'none';

  // ★ v1.3.68: Shimmer için frame container size hesabı (web admin parity).
  //   PngFrame/Lottie meta.scale, Remote için baseFactor (image:1.4, lottie:1.8 default image).
  //   Yoksa avatar size = halo'nun avatar etrafına yapışmaması için fallback.
  const dynFrameScale = dynCfg?.frame_scale ?? 1;
  const remoteFactor = meta ? 1.0 : 1.4; // remote default image; lottie ise caller branch ayrıca handle
  const metaScale = meta?.scale ?? 1;
  const computedFrameContainerSize = Math.round(size * metaScale * dynFrameScale * remoteFactor);

  // ★ 2026-05-11: Tüm overlay katmanlar — her render branch için tek yerden oluşturulur
  //   (Lottie / PNG / Remote / palette branch'lerinin hepsinde aynı extras).
  const renderExtras = () => (
    <>
      {/* zIndex 0: bg_halo (en altta, frame ve avatar arkasında) */}
      {dynCfg?.bg_halo_enabled && (
        <BgHaloOverlay
          size={size}
          color={dynCfg?.bg_halo_color || '#fbbf24'}
          sizeMul={dynCfg?.bg_halo_size ?? 1.6}
          intensity={dynCfg?.bg_halo_intensity ?? 0.6}
        />
      )}
      {/* ★ v1.3.61: zIndex 0.5: glow_enabled — Android'de RN shadow yumuşak glow
           vermiyor (platform limit), avatar etrafında glow_color ile sıkı parlak
           SVG halka. Web admin box-shadow ile parite.
           ★ glow_pulse aktifse halo opacity 0.7↔1.0 nefes alır (web `glow-halo-pulse`
              keyframe paritesi). Eski sürüm yalnızca iOS shadow'u pulsing yapıyordu
              → Android'de glow_pulse görünmüyordu. */}
      {dynCfg?.glow_enabled && (
        <BgHaloOverlay
          size={size}
          color={dynCfg?.glow_color || '#fbbf24'}
          sizeMul={1.15 + (dynCfg?.glow_intensity ?? 0.5) * 0.15}
          intensity={Math.min(1, (dynCfg?.glow_intensity ?? 0.5) * 0.8)}
          pulse={!!dynCfg?.glow_pulse}
          pulseSpeed={dynCfg?.avatar_pulse_speed ?? 2}
        />
      )}
      {/* zIndex 1: frame_pulse_ring (radar dalgası) */}
      {dynCfg?.frame_pulse_ring && (
        <PulseRingOverlay size={size} color={dynCfg?.glow_color || '#fbbf24'} />
      )}
      {/* zIndex 2: avatar_border (premium ring) */}
      {dynCfg?.avatar_border_enabled && (
        <AvatarBorderRing
          size={size}
          color={dynCfg?.avatar_border_color || '#fbbf24'}
          width={dynCfg?.avatar_border_width ?? 3}
          style={dynCfg?.avatar_border_style || 'solid'}
        />
      )}
      {/* frame_shimmer — web admin slider'larından besleniyor.
           size = frame container boyutu (web admin frameContainerSize parity).
           layer prop: above (zIndex 4) / below (zIndex 2). */}
      {dynCfg?.frame_shimmer && (
        <FrameShimmerOverlay
          size={computedFrameContainerSize}
          baseSize={size}
          scale={dynCfg?.frame_shimmer_scale ?? 1}
          speed={dynCfg?.frame_shimmer_speed ?? 2.5}
          opacity={dynCfg?.frame_shimmer_opacity ?? 0.4}
          angle={dynCfg?.frame_shimmer_angle ?? 110}
          band={dynCfg?.frame_shimmer_band ?? 0.2}
          reverse={!!dynCfg?.frame_shimmer_reverse}
          layer={(dynCfg?.frame_shimmer_layer as 'above' | 'below') ?? 'above'}
        />
      )}
      {/* zIndex 4: particle */}
      {hasParticles && <ParticleOverlay size={size} dynCfg={dynCfg} />}
      {/* ★ 2026-05-11: Tier badge AvatarFrame içinde render EDİLMEZ — çift badge
           çakışmasını önlemek için StatusAvatar mevcut TierBadge component'ini
           web admin tier_badge_position'a göre konumlar. */}
      {/* ★ v1.3.50: NameOverlay GERİ EKLENDİ — react-native-svg ile yay/daire
           gerçek render. userName prop sağlanmadıysa hiç gösterilmez (parent
           ekrandaki normal isimle çakışmadan, sadece name_enabled=true frame'ler
           için ekstra isim katmanı). */}
      {dynCfg?.name_enabled && userName && (
        <NameOverlay size={size} name={userName} dynCfg={dynCfg} />
      )}
    </>
  );

  // ★ v215: PNG frame — Image component ile render
  if (meta && (meta as any).type === 'png' && size >= LOTTIE_MIN_AVATAR_SIZE && !forceRing) {
    return (
      <>
        <PngFrame meta={meta} size={size} dynCfg={dynCfg} />
        {renderExtras()}
      </>
    );
  }
  // Lottie frame
  if (meta && LottieView && size >= LOTTIE_MIN_AVATAR_SIZE && !forceRing) {
    return (
      <>
        <LottieFrame meta={meta} size={size} dynCfg={dynCfg} />
        {renderExtras()}
      </>
    );
  }

  const palette = FRAME_PALETTES[frameId];
  if (!palette) {
    // ★ v110.7: Registry/palette'de yok — web'den eklenmiş yeni Lottie/PNG ürünü olabilir.
    //   cosmetic_items.meta'dan asset URL çek, runtime render et.
    if (size >= LOTTIE_MIN_AVATAR_SIZE) {
      return (
        <>
          <RemoteAssetFrame frameId={frameId} size={size} dynCfg={dynCfg} />
          {renderExtras()}
        </>
      );
    }
    return null;
  }

  // ★ v109.3: Halka SABİT BOYUT ile konumlandı — absoluteFillObject parent
  //   boyutuna bağlıydı, parent avatardan uzun olunca halka aşağı kayıyordu.
  //   Yeni: top:0/left:0 + size (avatar boyutunda) → halka tam avatar üstüne biner.
  // ★ v110.14: %9 → %7 → %5 → MAX 3px sabit cap. Avatar büyüklüğünden bağımsız
  //   ince halka — premium ve şık duruyor.
  const thickness = Math.min(3, Math.max(2, Math.round(size * 0.04)));

  return (
    <>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: size, height: size,
          // ★ v110.9 (7 May 2026): elevation 0→3 — Android'de palette halka Image
          //   üstünde POP olsun. Tier badge zIndex 5 hâlâ üstte.
          zIndex: 3,
          elevation: 3,
        }}
      >
        {/* Dış halka — avatar boyutunda, border içeride */}
        <View
          style={{
            width: size, height: size, borderRadius: size / 2,
            borderWidth: thickness,
            borderColor: palette.outer[1] || palette.outer[0],
            ...Platform.select({
              ios: {
                shadowColor: palette.glowIos,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.5, shadowRadius: 4,
              },
              android: {},
            }),
          }}
        />
        {/* İç parlaklık çizgisi — avatarın iç kenarında */}
        <View
          style={{
            position: 'absolute',
            top: thickness, left: thickness,
            width: size - thickness * 2, height: size - thickness * 2,
            borderRadius: (size - thickness * 2) / 2,
            borderWidth: 0.8, borderColor: palette.inner,
            backgroundColor: 'transparent',
          }}
        />
      </View>
      {renderExtras()}
    </>
  );
}

// ★ v108.16: React.memo — frameId/size değişmedikçe re-render etme (ağır Lottie load yok).
//   2026-05-11: userName + userTier prop'ları da equality kontrolüne eklendi
//   (name overlay ve tier badge için).
const AvatarFrame = React.memo(AvatarFrameImpl, (a, b) =>
  a.frameId === b.frameId &&
  a.size === b.size &&
  a.forceRing === b.forceRing &&
  a.userName === b.userName &&
  a.userTier === b.userTier &&
  a.contextKey === b.contextKey
);
export default AvatarFrame;
