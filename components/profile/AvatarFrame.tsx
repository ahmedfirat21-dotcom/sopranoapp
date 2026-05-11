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
import { getFrameMeta, hasFrameLottie } from '../../constants/frameLottieRegistry';
import { getCosmeticAsset, getCachedCosmeticAsset, type AssetMeta } from '../../services/cosmeticAssetCache';
import { ensureFrameConfig, getCachedFrameConfig, subscribeConfigChange } from '../../services/cosmeticConfigCache';

let LottieView: any = null;
try {
  LottieView = require('lottie-react-native').default;
} catch { /* fallback to gradient ring */ }

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

  return (
    <Animated.Text
      style={{
        position: 'absolute',
        left: '50%' as any, top: '50%' as any,
        marginLeft: x - fontSize / 2,
        marginTop: y - fontSize / 2,
        width: fontSize, height: fontSize,
        fontSize,
        lineHeight: fontSize,
        textAlign: 'center',
        color, // emoji default rengini override etmez ama tintColor alternatif yok Text'te
        textShadowColor: color,
        textShadowRadius: 8,
        textShadowOffset: { width: 0, height: 0 },
        opacity: opacityInterp,
        transform: [{ scale: scaleInterp }],
      }}
    >
      {emoji}
    </Animated.Text>
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
    const loop = Animated.loop(
      Animated.timing(orbitAnim, { toValue: 1, duration: 12000, easing: Easing.linear, useNativeDriver: true })
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
  const emoji = type === 'sparkle' ? '✨' : type === 'stars' ? '⭐' : type === 'hearts' ? '❤️' : '🫧';
  const fontSize = Math.max(14, Math.round(size * 0.18));
  // Yörünge: avatar yarıçapı + min 18px boşluk
  const orbitRadius = size / 2 + Math.max(18, fontSize * 0.4);
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
        return (
          <ParticleDot
            key={i}
            emoji={emoji}
            color={particleColor}
            x={x}
            y={y}
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
function BgHaloOverlay({ size, color, sizeMul, intensity }: {
  size: number; color: string; sizeMul: number; intensity: number;
}) {
  const haloSize = size * sizeMul;
  const offset = (haloSize - size) / 2;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -offset, left: -offset,
        width: haloSize, height: haloSize,
        borderRadius: haloSize / 2,
        backgroundColor: color,
        opacity: intensity * 0.35,
        zIndex: 0,
        elevation: 0,
        ...Platform.select({
          ios: {
            shadowColor: color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: intensity,
            shadowRadius: haloSize / 4,
          },
          android: {},
        }),
      }}
    />
  );
}

// ★ 2026-05-11: Avatar Border — premium ring (avatar etrafında static halka)
function AvatarBorderRing({ size, color, width, style: borderStyle }: {
  size: number; color: string; width: number; style: 'solid' | 'dashed' | 'dotted' | 'double';
}) {
  // RN borderStyle 'double' desteklemez — fallback solid + ekstra inner ring
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

// ★ 2026-05-11: Pulse Ring (radar dalgası) — frame_pulse_ring true ise 3 katman
//   dışa yayılan halka. Web admin'deki @keyframes pulse-ring karşılığı.
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
              borderRadius: size / 2,
              borderWidth: 2,
              borderColor: color,
              zIndex: 1,
              elevation: 1,
              opacity,
              transform: [{ scale }],
            }}
          />
        );
      })}
    </>
  );
}

// ★ 2026-05-11: Frame Shimmer — frame üzerinden ışık süpürmesi.
//   Web'de mixBlendMode:overlay + bg-gradient sweep. Mobile'da basit overlay
//   View opacity pulse ile yaklaşık. expo-linear-gradient ile gradient sweep.
function FrameShimmerOverlay({ size }: { size: number }) {
  const shimmer = useRef(new Animated.Value(-1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, { toValue: 1, duration: 2500, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);
  const translateX = shimmer.interpolate({ inputRange: [-1, 1], outputRange: [-size, size] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0, left: 0,
        width: size, height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        zIndex: 4,
        elevation: 4,
        transform: [{ translateX }],
      }}
    >
      <LinearGradient
        colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ width: '100%', height: '100%' }}
      />
    </Animated.View>
  );
}

// ★ 2026-05-11: Tier Badge — 8 nokta + 4 stil overlay
//   Web'deki BADGE_POSITIONS karşılığı. PRO örnek metin (mobilde gerçek
//   user.tier ile değiştirilecek).
const BADGE_POS_MOBILE: Record<string, { x: number; y: number }> = {
  tl: { x: -0.5, y: -0.5 }, tc: { x: 0, y: -0.55 }, tr: { x: 0.5, y: -0.5 },
  ml: { x: -0.55, y: 0 },                            mr: { x: 0.55, y: 0 },
  bl: { x: -0.5, y: 0.5 },  bc: { x: 0, y: 0.55 },   br: { x: 0.5, y: 0.5 },
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
//   react-native-svg yok, bu yüzden curve_style 'flat' her zaman; yay/dairesel
//   web'de gözükür ama mobilde düz çıkar (post-launch SVG eklenince curve).
//   Yüzdelik bazlı: name_offset = % avatar yarıçapı, name_size = % avatar boyutu.
function NameOverlay({ size, name, dynCfg }: { size: number; name: string; dynCfg: any }) {
  const offsetPct = dynCfg?.name_offset ?? 25;
  const sizePct = dynCfg?.name_size ?? 14;
  const fontPx = Math.max(8, Math.round((sizePct / 100) * size));
  const offsetPx = (offsetPct / 100) * (size / 2);
  const radius = size / 2 + offsetPx;

  // ★ 2026-05-11: Konum güvenli — kendi size x size wrapper'ında flex hizalama.
  //   Önceki bug: posStyle absolute parent'a göre yerleşiyordu, parent positioned
  //   değilse veya farklı boyutta ise yazı yanlış yere düşüyordu. Şimdi wrapper
  //   garantili size x size, içeride hizalama doğru çalışır.
  const pos = dynCfg?.name_position || 'bottom';
  // İç hizalama — wrapper size x size, name avatar'ın belirli kenarına
  let containerStyle: any = {};
  let textWrapperStyle: any = {};
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
      containerStyle = { justifyContent: 'center', alignItems: 'flex-start' };
      textWrapperStyle = { transform: [{ translateX: -offsetPx - fontPx * 2 }] };
      break;
    case 'right':
      containerStyle = { justifyContent: 'center', alignItems: 'flex-end' };
      textWrapperStyle = { transform: [{ translateX: offsetPx + fontPx * 2 }] };
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
  // Static eğim — sadece dinamik rotate yoksa (çakışma önleme)
  const hasDynamicRotate = !!(dynCfg?.name_rotation_continuous || dynCfg?.name_swing || dynCfg?.name_tilt || dynCfg?.name_wobble);
  if (!hasDynamicRotate && (dynCfg?.name_rotation ?? 0) !== 0) {
    transformStack.push({ rotate: `${dynCfg?.name_rotation}deg` });
  }

  const color = cycleColor || dynCfg?.name_color || '#f8fafc';
  const glowColor = dynCfg?.name_glow_color || color;
  const glowIntensity = dynCfg?.name_glow_intensity ?? 0.6;
  const opacity = dynCfg?.name_opacity ?? 1;

  // Glow text-shadow radius — pulse aktifse Animated, değilse sabit
  const baseGlowRadius = dynCfg?.name_glow ? 4 + glowIntensity * 6 : 2;
  const animatedGlowRadius = dynCfg?.name_glow_pulse
    ? glowPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [baseGlowRadius, baseGlowRadius * 2.5] })
    : baseGlowRadius;

  // Wave — harf-harf yukarı dalga (sadece düz/flat, RN'de tspan yok)
  const showWave = dynCfg?.name_wave && (dynCfg?.name_curve_style || 'flat') === 'flat';

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
      ) : (
        <Animated.Text
          numberOfLines={1}
          style={{
            color,
            fontSize: fontPx,
            fontWeight: dynCfg?.name_bold ? '700' : '400',
            textAlign: 'center',
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

  // ★ color_cycle — PNG'ye tintColor cycle (HSL hue değiştirme)
  const [cycleColor, setCycleColor] = useState<string | null>(null);
  useEffect(() => {
    if (!dynColorCycle) { setCycleColor(null); return; }
    const speedSec = dynCfg?.color_cycle_speed ?? 12;
    const startMs = Date.now();
    const intervalId = setInterval(() => {
      const elapsed = (Date.now() - startMs) / 1000;
      const hue = ((elapsed / speedSec) * 360) % 360;
      setCycleColor(`hsl(${Math.round(hue)}, 80%, 60%)`);
    }, 100);
    return () => clearInterval(intervalId);
  }, [dynColorCycle, dynCfg?.color_cycle_speed]);

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
        transform: dynBreathe ? [{ scale: breatheAnim }] : undefined,
      }}
    >
      <Image
        source={meta.source}
        resizeMode="contain"
        style={{
          width: frameSize, height: frameSize,
          tintColor: cycleColor || undefined,
        }}
      />
    </Animated.View>
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

  // ★ color_cycle — image asset için tintColor cycle
  const dynColorCycle = !!dynCfg?.color_cycle;
  const [cycleColor, setCycleColor] = useState<string | null>(null);
  useEffect(() => {
    if (!dynColorCycle) { setCycleColor(null); return; }
    const speedSec = dynCfg?.color_cycle_speed ?? 12;
    const startMs = Date.now();
    const intervalId = setInterval(() => {
      const elapsed = (Date.now() - startMs) / 1000;
      const hue = ((elapsed / speedSec) * 360) % 360;
      setCycleColor(`hsl(${Math.round(hue)}, 80%, 60%)`);
    }, 100);
    return () => clearInterval(intervalId);
  }, [dynColorCycle, dynCfg?.color_cycle_speed]);

  if (!asset || !asset.url) return null;

  const transformStack = dynBreathe ? [{ scale: breatheAnim }] : undefined;

  if (asset.type === 'lottie' && LottieView) {
    return (
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -(size * 0.4), left: -(size * 0.4),
          width: size * 1.8, height: size * 1.8,
          alignItems: 'center', justifyContent: 'center',
          zIndex: 3,
          elevation: 3,
          transform: transformStack,
        }}
      >
        <LottieView
          source={{ uri: asset.url }}
          autoPlay
          loop
          speed={0.85}
          resizeMode="contain"
          style={{ width: '100%', height: '100%' }}
        />
      </Animated.View>
    );
  }

  // Image (PNG/SVG/WebP) — tintColor cycle ve breathe destekli
  if (asset.type === 'image') {
    return (
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -(size * 0.2), left: -(size * 0.2),
          width: size * 1.4, height: size * 1.4,
          zIndex: 3,
          elevation: 3,
          transform: transformStack,
        }}
      >
        <Image
          source={{ uri: asset.url }}
          resizeMode="contain"
          style={{
            width: '100%', height: '100%',
            tintColor: cycleColor || undefined,
          }}
        />
      </Animated.View>
    );
  }

  return null;
}

function AvatarFrameImpl({ frameId, size, forceRing, userName, userTier }: Props) {
  // ★ v213f: Web admin'den ayarlanan dynamic frame config — Hook her zaman çağrılmalı,
  //   conditional return ÖNCESİNDE; aksi halde "rendered fewer hooks" crash riski.
  const [dynCfg, setDynCfg] = useState<any>(getCachedFrameConfig(frameId));
  useEffect(() => {
    if (!frameId) { setDynCfg(null); return; }
    ensureFrameConfig(frameId).then(setDynCfg);
  }, [frameId]);

  // ★ 2026-05-11: REALTIME PUSH — admin değişiklik yapınca cache invalidate olur,
  //   listener tetiklenir, hemen fresh config çekilip state'e yazılır.
  //   Önceden 5dk bekleyip yeni render'da fetch oluyordu; artık ~1sn.
  useEffect(() => {
    if (!frameId) return;
    const unsub = subscribeConfigChange((changedId) => {
      if (changedId !== frameId) return;
      ensureFrameConfig(frameId).then(setDynCfg);
    });
    return unsub;
  }, [frameId]);

  if (!frameId) return null;

  // ★ v108.13: Boyuta göre render — büyük avatarlarda Lottie, küçüklerde sade halka.
  // ★ v110.14: forceRing=true ise Lottie atlanır (sahnede host hariç herkes için
  //   sade halka — boyut dengesi için kullanıcı talebi).
  const meta = getFrameMeta(frameId);
  const hasParticles = dynCfg?.particle_type && dynCfg.particle_type !== 'none';

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
      {/* zIndex 4: frame_shimmer (ışık süpürmesi) */}
      {dynCfg?.frame_shimmer && (
        <FrameShimmerOverlay size={size} />
      )}
      {/* zIndex 4: particle */}
      {hasParticles && <ParticleOverlay size={size} dynCfg={dynCfg} />}
      {/* zIndex 5: tier_badge */}
      {dynCfg?.tier_badge_enabled && userTier && (
        <TierBadgeOverlay
          size={size}
          position={dynCfg?.tier_badge_position || 'tr'}
          style={dynCfg?.tier_badge_style || 'chip'}
          label={userTier}
        />
      )}
      {/* zIndex 6: name overlay (en üstte) */}
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
  a.userTier === b.userTier
);
export default AvatarFrame;
