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

const CONFIG: Record<string, {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  colors: readonly [string, string];
  glow: string;
  textColor: string;
}> = {
  Plus: {
    label: 'PLUS',
    icon: 'diamond',
    colors: ['#5EEAD4', '#0E7490'] as const,
    glow: 'rgba(94,234,212,0.55)',
    textColor: '#F0FDFA',
  },
  Pro: {
    label: 'PRO',
    icon: 'star',
    colors: ['#FCD34D', '#B45309'] as const,
    glow: 'rgba(251,191,36,0.65)',
    textColor: '#7C2D12',
  },
  GodMaster: {
    label: 'GM',
    icon: 'sparkles',
    colors: ['#F472B6', '#FBBF24'] as const,
    glow: 'rgba(244,114,182,0.7)',
    textColor: '#fff',
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
  xs: { height: 14, paddingH: 4, fontSize: 0, iconSize: 9, gap: 0, radius: 7, letterSpacing: 0, glowBlur: 8 },
  sm: { height: 14, paddingH: 5, fontSize: 8.5, iconSize: 8, gap: 2, radius: 7, letterSpacing: 0.6, glowBlur: 10 },
  md: { height: 17, paddingH: 6, fontSize: 9.5, iconSize: 9, gap: 3, radius: 8.5, letterSpacing: 0.7, glowBlur: 12 },
  lg: { height: 22, paddingH: 8, fontSize: 11, iconSize: 11, gap: 4, radius: 11, letterSpacing: 0.8, glowBlur: 18 },
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
