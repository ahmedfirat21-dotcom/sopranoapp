/**
 * SopranoChat — Modern yükleniyor (v109, 5 May 2026)
 * ════════════════════════════════════════════════════════════════════
 * Lottie tabanlı loading (Loading animation blue.json). Lottie modülü
 * yüklenemezse 3-dot pulse fallback'ine düşer (Hermes uyumlu, native
 * modül zorunluluğu yok).
 *
 * State sistemi korunur (color/state mapping); Lottie tek renk olduğu
 * için color override sadece fallback dot'larda etki eder. State badge
 * için mavi/yeşil/turuncu Lottie versiyonları post-launch eklenebilir.
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing } from 'react-native';

// ★ v109.1: Lottie kaldırıldı — modern 3-dot pulse standart loader.
//   Kullanıcı talebi: Lottie deneyleri sonrası eski tasarıma geri dön.
const LottieView: any = null;
const LOADING_LOTTIE: any = null;

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
  sm: 24, md: 40, lg: 60,
  small: 24, large: 40,
};
const STATE_COLOR: Record<LoaderState, string> = {
  default:    '#14B8A6',
  connecting: '#22C55E',
  reconnect:  '#3B82F6',
  error:      '#F59E0B',
};
// Animation cycle (ms). speed='fast' = hızlı pulse.
const CYCLE_MS = { fast: 900, normal: 1200, slow: 1600 };
// Lottie speed multipler (frame oranı)
const LOTTIE_SPEED = { fast: 1.6, normal: 1, slow: 0.7 };

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

  // ★ Hooks rules: hooks her render'da AYNI sırada çağrılır.
  //   Fallback dot loop'u koşulsuz hook olarak tutuluyor; gerçekten render
  //   edilmezse animasyon görünmez, performans etkisi marjinal.
  const cycle = CYCLE_MS[speed];
  const d1 = useRef(new Animated.Value(0)).current;
  const d2 = useRef(new Animated.Value(0)).current;
  const d3 = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (LottieView && LOADING_LOTTIE) return; // Lottie aktifken dot loop atılır
    const makeLoop = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1, duration: cycle / 2,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0, duration: cycle / 2,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
    const stagger = cycle / 6;
    const l1 = makeLoop(d1, 0);
    const l2 = makeLoop(d2, stagger);
    const l3 = makeLoop(d3, stagger * 2);
    l1.start(); l2.start(); l3.start();
    return () => { l1.stop(); l2.stop(); l3.stop(); };
  }, [cycle]);

  // ★ Lottie öncelikli render — yüklü ve asset varsa
  if (LottieView && LOADING_LOTTIE) {
    // Lottie kareleri zaten kompakt; küçük boyutlarda hafif büyütüyoruz çünkü
    // animasyonun aktif piksel alanı dosyanın merkez %70'inde.
    const lottieScale = dim < 30 ? 1.4 : dim < 60 ? 1.2 : 1.05;
    const renderSize = Math.round(dim * lottieScale);
    const offset = Math.round((renderSize - dim) / -2);

    const inner = (
      <View
        style={[
          {
            width: dim, height: dim,
            alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          },
          style,
        ]}
      >
        <LottieView
          source={LOADING_LOTTIE}
          autoPlay
          loop
          speed={LOTTIE_SPEED[speed]}
          resizeMode="contain"
          style={{
            position: 'absolute',
            width: renderSize, height: renderSize,
            top: offset, left: offset,
          }}
        />
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

  // ─── Fallback: 3-dot pulse ───────────────────────────────────────
  const finalColor = color ?? STATE_COLOR[state];
  const dotSize = Math.max(4, Math.round(dim * 0.22));
  const gap = Math.max(3, Math.round(dim * 0.14));

  const dotAnim = (val: Animated.Value) => ({
    width: dotSize,
    height: dotSize,
    borderRadius: dotSize / 2,
    backgroundColor: finalColor,
    opacity: val.interpolate({ inputRange: [0, 1], outputRange: [0.28, 1] }),
    transform: [{ scale: val.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.15] }) }],
  });

  const inner = (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap },
        style,
      ]}
    >
      <Animated.View style={dotAnim(d1)} />
      <Animated.View style={dotAnim(d2)} />
      <Animated.View style={dotAnim(d3)} />
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
