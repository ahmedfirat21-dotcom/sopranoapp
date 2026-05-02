/**
 * SopranoChat — Premium yükleniyor simgesi (v92.27, 2 May 2026)
 * ════════════════════════════════════════════════════════════════════
 * Tasarım: Ionicons "sync" ikonu (2 ok birbirini kovalar) + 3 katmanlı halo glow + breath.
 * macOS / Stripe / iOS sync icon estetiği.
 *
 * NOT: Font yüklendikten sonra çağrılmalı. _layout.tsx splash fallback için
 * ayrı SplashSpinner component'i var (Ionicons-bağımsız).
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Size = 'sm' | 'md' | 'lg' | 'small' | 'large';
type LoaderState = 'default' | 'connecting' | 'reconnect' | 'error';

interface Props {
  size?: Size | number;
  color?: string;
  state?: LoaderState;
  fullscreen?: boolean;
  bg?: string;
  speed?: 'fast' | 'normal' | 'slow';
  style?: any;
}

const SIZE_MAP: Record<Size, number> = {
  sm: 32, md: 56, lg: 80,
  small: 32, large: 56,
};
const STATE_COLOR: Record<LoaderState, string> = {
  default:    '#14B8A6',
  connecting: '#22C55E',
  reconnect:  '#3B82F6',
  error:      '#F59E0B',
};
const SPEED_MAP = { fast: 700, normal: 1100, slow: 1600 };

export default function AppLoader({
  size = 'md',
  color,
  state = 'default',
  fullscreen = false,
  bg,
  speed = 'normal',
  style,
}: Props) {
  const dim = typeof size === 'number' ? size : SIZE_MAP[size];
  const finalColor = color ?? STATE_COLOR[state];
  const duration = SPEED_MAP[speed];

  const rotate = useRef(new Animated.Value(0)).current;
  const halo = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    rotate.setValue(0);
    halo.setValue(0);
    // ★ v92.28 (2 May 2026) PERF FIX: Önceki sürümde loop'lar cleanup edilmiyordu.
    //   85+ AppLoader instance'ı unmount sonrası bile native driver'da dönmeye devam ediyordu
    //   → 5 kişilik odada FPS drop. Şimdi loop ref'leri tutuluyor, unmount'ta stop().
    const rotateLoop = Animated.loop(
      Animated.timing(rotate, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }),
    );
    const haloLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(halo, { toValue: 1, duration: duration * 1.2, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(halo, { toValue: 0, duration: duration * 1.2, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ]),
    );
    rotateLoop.start();
    haloLoop.start();
    return () => {
      rotateLoop.stop();
      haloLoop.stop();
    };
  }, [duration]);

  const rotateDeg = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const haloScale = halo.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] });
  const haloOpacity = halo.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });

  const inner = (
    <View style={[{ width: dim * 1.5, height: dim * 1.5, alignItems: 'center', justifyContent: 'center' }, style]}>
      {/* Halo katmanları — 3 daire opacity pulse + scale */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: dim * 1.5,
          height: dim * 1.5,
          borderRadius: dim * 0.75,
          backgroundColor: `${finalColor}1A`,
          opacity: haloOpacity,
          transform: [{ scale: haloScale }],
        }}
      />
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: dim * 1.2,
          height: dim * 1.2,
          borderRadius: dim * 0.6,
          backgroundColor: `${finalColor}26`,
          opacity: haloOpacity,
          transform: [{ scale: haloScale }],
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: dim * 0.95,
          height: dim * 0.95,
          borderRadius: dim * 0.475,
          backgroundColor: `${finalColor}33`,
        }}
      />
      {/* Sync ikonu — kendi etrafında döner, glow shadow ile */}
      <Animated.View
        pointerEvents="none"
        style={{
          transform: [{ rotate: rotateDeg }],
          ...Platform.select({
            ios: {
              shadowColor: finalColor,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.85,
              shadowRadius: dim * 0.3,
            },
            android: {
              shadowColor: finalColor,
              elevation: Math.max(6, Math.floor(dim * 0.18)),
            },
          }),
        }}
      >
        <Ionicons name="sync" size={dim * 0.85} color={finalColor} />
      </Animated.View>
    </View>
  );

  if (fullscreen) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: bg ?? '#0A0F1A' }}>
        {inner}
      </View>
    );
  }
  return inner;
}
