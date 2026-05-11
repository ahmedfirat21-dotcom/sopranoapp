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
import { ensureFrameConfig, getCachedFrameConfig } from '../../services/cosmeticConfigCache';

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

  const symbol = type === 'sparkle' ? '✦' : type === 'stars' ? '★' : type === 'hearts' ? '♥' : '○';
  const rotateInterp = orbitAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const radius = size * 0.65;
  const fontSize = Math.max(10, Math.round(size * 0.14));

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -(size * 0.4), left: -(size * 0.4),
        width: size * 1.8, height: size * 1.8,
        alignItems: 'center', justifyContent: 'center',
        zIndex: 4,
        elevation: 4,
        transform: [{ rotate: rotateInterp }],
      }}
    >
      {Array.from({ length: count }).map((_, i) => {
        const angle = (360 / count) * i;
        const rad = (angle * Math.PI) / 180;
        const x = Math.cos(rad) * radius;
        const y = Math.sin(rad) * radius;
        return (
          <Text
            key={i}
            style={{
              position: 'absolute',
              left: '50%' as any, top: '50%' as any,
              marginLeft: x - fontSize / 2,
              marginTop: y - fontSize / 2,
              color: particleColor,
              fontSize,
              textShadowColor: particleColor,
              textShadowRadius: 6,
              textShadowOffset: { width: 0, height: 0 },
            }}
          >
            {symbol}
          </Text>
        );
      })}
    </Animated.View>
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

function AvatarFrameImpl({ frameId, size, forceRing }: Props) {
  // ★ v213f: Web admin'den ayarlanan dynamic frame config — Hook her zaman çağrılmalı,
  //   conditional return ÖNCESİNDE; aksi halde "rendered fewer hooks" crash riski.
  const [dynCfg, setDynCfg] = useState<any>(getCachedFrameConfig(frameId));
  useEffect(() => {
    if (!frameId) { setDynCfg(null); return; }
    ensureFrameConfig(frameId).then(setDynCfg);
  }, [frameId]);

  if (!frameId) return null;

  // ★ v108.13: Boyuta göre render — büyük avatarlarda Lottie, küçüklerde sade halka.
  // ★ v110.14: forceRing=true ise Lottie atlanır (sahnede host hariç herkes için
  //   sade halka — boyut dengesi için kullanıcı talebi).
  const meta = getFrameMeta(frameId);
  const hasParticles = dynCfg?.particle_type && dynCfg.particle_type !== 'none';
  // ★ v215: PNG frame — Image component ile render
  if (meta && meta.type === 'png' && size >= LOTTIE_MIN_AVATAR_SIZE && !forceRing) {
    return (
      <>
        <PngFrame meta={meta} size={size} dynCfg={dynCfg} />
        {hasParticles && <ParticleOverlay size={size} dynCfg={dynCfg} />}
      </>
    );
  }
  // Lottie frame
  if (meta && LottieView && size >= LOTTIE_MIN_AVATAR_SIZE && !forceRing) {
    return (
      <>
        <LottieFrame meta={meta} size={size} dynCfg={dynCfg} />
        {hasParticles && <ParticleOverlay size={size} dynCfg={dynCfg} />}
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
          {hasParticles && <ParticleOverlay size={size} dynCfg={dynCfg} />}
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
  );
}

// ★ v108.16: React.memo — frameId/size değişmedikçe re-render etme (ağır Lottie load yok).
const AvatarFrame = React.memo(AvatarFrameImpl, (a, b) => a.frameId === b.frameId && a.size === b.size && a.forceRing === b.forceRing);
export default AvatarFrame;
