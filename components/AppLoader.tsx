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
import { LinearGradient } from 'expo-linear-gradient';

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

// ★ v107.15: Boyutlar küçültüldü (kullanıcı talebi). Eski: sm 32 / md 56 / lg 80
//   Yeni: sm 24 / md 40 / lg 60 — özellikle "Odaya bağlanılıyor" gibi tam-ekran loading'lerde ferah
const SIZE_MAP: Record<Size, number> = {
  sm: 24, md: 40, lg: 60,
  small: 24, large: 40,
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

  // ★ v107.15: Sert 3 katman backgroundColor yerine TEK yumuşak LinearGradient halo.
  //   Eski: solid renkler 1A/26/33 → kenarlar belirgin, "halka" gibi görünüyordu.
  //   Yeni: radial-tarzı gradient (merkez doygun → kenar transparan) + Android shadow kaldırıldı.
  const inner = (
    <View style={[{ width: dim * 1.5, height: dim * 1.5, alignItems: 'center', justifyContent: 'center' }, style]}>
      {/* Yumuşak halo — LinearGradient ile merkezden kenara fade (Android'de de görünür) */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: dim * 1.5,
          height: dim * 1.5,
          borderRadius: dim * 0.75,
          opacity: haloOpacity,
          transform: [{ scale: haloScale }],
          overflow: 'hidden',
        }}
      >
        <LinearGradient
          colors={[`${finalColor}40`, `${finalColor}20`, `${finalColor}08`, 'transparent']}
          locations={[0, 0.4, 0.75, 1]}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
          style={{ width: '100%', height: '100%', borderRadius: dim * 0.75 }}
        />
      </Animated.View>
      {/* Sync ikonu — kendi etrafında döner. Android shadow kaldırıldı (gri görünür, glow vermez) */}
      <Animated.View
        pointerEvents="none"
        style={{
          transform: [{ rotate: rotateDeg }],
          ...(Platform.OS === 'ios' ? {
            shadowColor: finalColor,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.6,
            shadowRadius: dim * 0.25,
          } : {}),
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
