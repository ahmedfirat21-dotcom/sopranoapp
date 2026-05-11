/**
 * SopranoChat — Tier Etiketi (v1.3.54 — sade, eski model)
 * ════════════════════════════════════════════════════════════════════
 * Plus / Pro / GodMaster üyeler için kompakt pill rozet.
 * Web admin sadece aç/kapat + 8 nokta konum kontrolü yapar; rozetin
 * görünüm tasarımı (gradient + glow + shimmer) sabittir.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

type Tier = 'Free' | 'Plus' | 'Pro' | 'GodMaster' | string | null | undefined;

interface Props {
  tier: Tier;
  /** Boyut: xs (icon-only mini), sm (kompakt liste), md (default), lg (profil hero) */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Yatay margin için style override */
  style?: any;
  /** Geriye dönük uyum için tutuldu — görünürlük kararı parent (StatusAvatar)
   *  tarafında size-aware şekilde verilir, TierBadge ek kontrol yapmaz. */
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
}> = {
  xs: { height: 14, paddingH: 4, fontSize: 0, iconSize: 9, gap: 0, radius: 7, letterSpacing: 0 },
  sm: { height: 14, paddingH: 5, fontSize: 8.5, iconSize: 8, gap: 2, radius: 7, letterSpacing: 0.6 },
  md: { height: 17, paddingH: 6, fontSize: 9.5, iconSize: 9, gap: 3, radius: 8.5, letterSpacing: 0.7 },
  lg: { height: 22, paddingH: 8, fontSize: 11, iconSize: 11, gap: 4, radius: 11, letterSpacing: 0.8 },
};

export default function TierBadge({ tier, size = 'md', style, frameId: _frameId }: Props) {
  const cfg = tier ? CONFIG[tier] : null;
  const sz = SIZE[size];
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!cfg || (tier !== 'Pro' && tier !== 'GodMaster')) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [cfg, tier]);

  if (!cfg) return null;

  const shimmerOpacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const shimmerScale = shimmer.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });

  return (
    <Animated.View
      style={[
        s.wrap,
        {
          height: sz.height,
          paddingHorizontal: sz.paddingH,
          borderRadius: sz.radius,
          opacity: shimmerOpacity,
          transform: [{ scale: shimmerScale }],
          ...Platform.select({
            ios: {
              shadowColor: cfg.glow,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.7,
              shadowRadius: size === 'lg' ? 8 : 5,
            },
            android: { elevation: size === 'lg' ? 4 : 2 },
          }),
        },
        style,
      ]}
    >
      <LinearGradient
        colors={cfg.colors as any}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
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
    overflow: 'hidden',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  inner: {
    flexDirection: 'row', alignItems: 'center',
  },
  text: {
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
});
