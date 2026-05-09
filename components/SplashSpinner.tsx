/**
 * SopranoChat — Splash spinner (font-bağımsız, sadece _layout splash için)
 * ════════════════════════════════════════════════════════════════════
 * ★ 2026-05-09: AppLoader 3-dot pulse pattern'iyle birebir aynı görünüm.
 *   Önceki "dönen halka" tasarımı boyut/şekil olarak AppLoader'la
 *   uyumsuzdu (kullanıcı feedback: ilki ikincisinden büyük). Şimdi
 *   ikisi de aynı 3-dot pulse, tek görsel dil.
 *
 * Bu component fontlar/Ionicons yüklenmeden önce de güvenle render eder
 * (sadece View + Animated, harici bağımlılık yok).
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing } from 'react-native';

interface Props {
  size?: number;
  color?: string;
  bg?: string;
}

export default function SplashSpinner({ size = 56, color = '#14B8A6', bg = '#0A0F1A' }: Props) {
  const cycle = 1200;
  const d1 = useRef(new Animated.Value(0)).current;
  const d2 = useRef(new Animated.Value(0)).current;
  const d3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const makeLoop = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: cycle / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(val, { toValue: 0, duration: cycle / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
    const stagger = cycle / 6;
    const l1 = makeLoop(d1, 0);
    const l2 = makeLoop(d2, stagger);
    const l3 = makeLoop(d3, stagger * 2);
    l1.start(); l2.start(); l3.start();
    return () => { l1.stop(); l2.stop(); l3.stop(); };
  }, []);

  const dotSize = Math.max(4, Math.round(size * 0.22));
  const gap = Math.max(3, Math.round(size * 0.14));

  const dotAnim = (val: Animated.Value) => ({
    width: dotSize,
    height: dotSize,
    borderRadius: dotSize / 2,
    backgroundColor: color,
    opacity: val.interpolate({ inputRange: [0, 1], outputRange: [0.28, 1] }),
    transform: [{ scale: val.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.15] }) }],
  });

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap }}>
        <Animated.View style={dotAnim(d1)} />
        <Animated.View style={dotAnim(d2)} />
        <Animated.View style={dotAnim(d3)} />
      </View>
    </View>
  );
}
