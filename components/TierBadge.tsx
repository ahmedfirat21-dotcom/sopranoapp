/**
 * SopranoChat — Tier Etiketi (v1.3.66 — Skia render)
 * ════════════════════════════════════════════════════════════════════
 * Plus / Pro / GodMaster üyeler için kompakt pill rozet.
 *
 * RENDER:
 *   - Önceki versiyon: expo-linear-gradient + RN shadow & elevation
 *     (Android'de glow soluk, web admin önizleme ile farklı)
 *   - Bu versiyon: Skia Canvas + LinearGradient shader + BlurMask glow
 *     (web admin'deki CSS çıktısı ile birebir parite)
 *
 *   Shimmer animasyonu (opacity + scale 1→1.04) RN Animated ile sarmalanır
 *   — bu Skia katmanına da uygulanır (transform: scale Canvas'a da geçer).
 *
 *   Skia native modül yoksa fallback: expo-linear-gradient + utils/shadow.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Animated, LayoutChangeEvent, Platform } from 'react-native';
import { LinearGradient as ExpoGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { isSkiaAvailable } from './skia';
import { cssBlurToSkiaSigma } from '../utils/skiaUnits';

let SkiaMod: any = null;
try { SkiaMod = require('@shopify/react-native-skia'); } catch (_e) { /* fallback */ }

type Tier = 'Free' | 'Plus' | 'Pro' | 'GodMaster' | string | null | undefined;

interface Props {
  tier: Tier;
  /** Boyut: xs (icon-only mini), sm (kompakt liste), md (default), lg (profil hero) */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  style?: any;
  /** Geriye dönük uyum için tutuldu — görünürlük kararı parent'ta verilir. */
  frameId?: string | null;
}

// ★ v278 (14 May 2026): Tik renkleri rafine edildi — Twitter/IG pattern (parlak gradient
//   + tier'a göre KOYU kontrast tik). Eski beyaz tik gradient üzerinde sönük duruyordu.
const CONFIG: Record<string, {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  colors: readonly [string, string];
  glow: string;
  textColor: string;
}> = {
  Plus: {
    label: '',
    icon: 'checkmark',
    // Açık teal → mid teal (3D parlaklık)
    colors: ['#7DFCE0', '#0E7490'] as const,
    glow: 'rgba(94,234,212,0.7)',
    // Koyu teal tik — yüksek kontrast
    textColor: '#0F4F4D',
  },
  Pro: {
    label: '',
    icon: 'checkmark',
    // Parlak altın → turuncu (3-tone hissi)
    colors: ['#FFE082', '#F59E0B'] as const,
    glow: 'rgba(251,191,36,0.8)',
    // Koyu kahve tik — premium kontrast
    textColor: '#5C2C0E',
  },
  GodMaster: {
    label: '',
    icon: 'checkmark',
    // Pembe → mor (ilahi tier)
    colors: ['#F9A8D4', '#A855F7'] as const,
    glow: 'rgba(244,114,182,0.85)',
    // Koyu mor tik
    textColor: '#3F1D3E',
  },
};

const SIZE: Record<string, {
  height: number;
  paddingH: number;
  fontSize: number;
  iconSize: number;
  gap: number;
  radius: number;
  letterSpacing: number;
  glowBlur: number;
}> = {
  // ★ v275: Tik sistemine geçiş — tam daire (height=2*radius), padding minimal, label yok.
  //   Twitter/IG verified tik dimensions: ~18-22px height, daire.
  xs: { height: 14, paddingH: 0, fontSize: 0, iconSize: 10, gap: 0, radius: 7,  letterSpacing: 0, glowBlur: 8 },
  sm: { height: 16, paddingH: 0, fontSize: 0, iconSize: 11, gap: 0, radius: 8,  letterSpacing: 0, glowBlur: 10 },
  md: { height: 20, paddingH: 0, fontSize: 0, iconSize: 13, gap: 0, radius: 10, letterSpacing: 0, glowBlur: 12 },
  lg: { height: 26, paddingH: 0, fontSize: 0, iconSize: 16, gap: 0, radius: 13, letterSpacing: 0, glowBlur: 18 },
};

export default function TierBadge({ tier, size = 'md', style, frameId: _frameId }: Props) {
  const cfg = tier ? CONFIG[tier] : null;
  const sz = SIZE[size];
  const [measured, setMeasured] = useState({ width: 0, height: 0 });

  // ★ v1.3.68: Shimmer (yanıp sönme + scale) animasyonu kullanıcı talebi ile kaldırıldı.
  //   Rozet artık sabit görünür. Glow halka durağan kalır.

  if (!cfg) return null;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== measured.width || height !== measured.height) {
      setMeasured({ width, height });
    }
  };

  const useSkia = isSkiaAvailable() && !!SkiaMod;
  const { Canvas, RoundedRect, LinearGradient: SkiaGradient, BlurMask, vec } = useSkia ? SkiaMod : ({} as any);

  return (
    <Animated.View
      style={[
        s.wrap,
        {
          height: sz.height,
          paddingHorizontal: sz.paddingH,
          borderRadius: sz.radius,
        },
        // Skia yoksa RN shadow ile fallback:
        !useSkia && Platform.select({
          ios: { shadowColor: cfg.glow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: size === 'lg' ? 8 : 5 },
          android: { elevation: size === 'lg' ? 4 : 2 },
        }),
        style,
      ]}
      onLayout={onLayout}
    >
      {useSkia && measured.width > 0 ? (
        <Canvas
          style={[
            StyleSheet.absoluteFillObject,
            { left: -sz.glowBlur, top: -sz.glowBlur, width: measured.width + sz.glowBlur * 2, height: measured.height + sz.glowBlur * 2 },
          ]}
          pointerEvents="none"
        >
          {/* Glow halo — gradient renginde, blur ile */}
          <RoundedRect
            x={sz.glowBlur}
            y={sz.glowBlur}
            width={measured.width}
            height={measured.height}
            r={sz.radius}
            color={cfg.glow}
            opacity={0.85}
          >
            <BlurMask blur={cssBlurToSkiaSigma(sz.glowBlur)} style="normal" />
          </RoundedRect>
          {/* Gradient background — pill */}
          <RoundedRect
            x={sz.glowBlur}
            y={sz.glowBlur}
            width={measured.width}
            height={measured.height}
            r={sz.radius}
          >
            <SkiaGradient
              start={vec(sz.glowBlur, sz.glowBlur)}
              end={vec(sz.glowBlur + measured.width, sz.glowBlur + measured.height)}
              colors={cfg.colors as unknown as string[]}
            />
          </RoundedRect>
        </Canvas>
      ) : (
        // Skia yoksa expo-linear-gradient fallback (eski davranış)
        <ExpoGradient
          colors={cfg.colors as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      )}
      <View style={[s.inner, { gap: sz.gap }]}>
        <Ionicons name={cfg.icon} size={sz.iconSize} color={cfg.textColor} />
        {size !== 'xs' && (
          <Text style={[s.text, {
            color: cfg.textColor,
            fontSize: sz.fontSize,
            letterSpacing: sz.letterSpacing,
          }]}>{cfg.label}</Text>
        )}
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    overflow: 'visible',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
});
