/**
 * SopranoChat — Başarılı Giriş Lottie Animasyonu
 * ════════════════════════════════════════════════════════════════════
 * v1.3.17 (9 May 2026) — Google veya e-posta ile giriş başarılı olunca
 * login ekranında approve.json (2.6sn). AuthGuard yönlendirmeyi yapana
 * kadar olan "flash" süresini görsel olarak maskeler.
 *
 * Toast yerine kullanılır. Tek seferlik, fade-in/fade-out, tekrar etmez.
 * ErrorBoundary + safety timer ile crash güvenliği.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';

let LottieView: any = null;
let APPROVE_LOTTIE: any = null;
try { LottieView = require('lottie-react-native').default; } catch { /* fallback */ }
// ★ v203 fix: approve.json'da krem-beyaz daire (#edf7f2) zemin var, kullanıcı beğenmedi.
//   Applied-clean.json yeşil daire içinde beyaz tik — temiz brand-uyumlu görünüm.
try { APPROVE_LOTTIE = require('../assets/Applied-clean.json'); } catch { APPROVE_LOTTIE = null; }

interface Props {
  onDone: () => void;
  size?: number;
}

class LottieGuard extends React.Component<{ children: React.ReactNode; onError: () => void }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.hasError ? null : this.props.children; }
}

export default function LoginSuccessOverlay({ onDone, size = 180 }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const completedRef = useRef(false);
  const [shouldRender, setShouldRender] = useState(true);
  const [lottieErrored, setLottieErrored] = useState(false);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // 4sn safety — Lottie hiç bitmezse veya yüklenemezse zorla kapan.
    const safety = setTimeout(() => handleAnimationFinish(), 4000);
    return () => clearTimeout(safety);
  }, []);

  const handleAnimationFinish = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 350,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setShouldRender(false);
        onDone();
      });
    }, 200);
  };

  if (!shouldRender) return null;

  const canRenderLottie = LottieView && APPROVE_LOTTIE && !lottieErrored;

  return (
    <Animated.View style={[styles.wrap, { opacity }]} pointerEvents="none">
      {canRenderLottie ? (
        <LottieGuard onError={() => setLottieErrored(true)}>
          <LottieView
            source={APPROVE_LOTTIE}
            autoPlay
            loop={false}
            style={{ width: size, height: size }}
            onAnimationFinish={handleAnimationFinish}
          />
        </LottieGuard>
      ) : (
        <View style={{ width: size, height: size }} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // ★ v203: Absolute overlay — SopranoChat logosunun üstüne (paddingTop: 0 ile
  //   logo merkezine yakın). Layout'a etki etmez, transparent zemin.
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 0,
    backgroundColor: 'transparent',
    zIndex: 100,
  },
});
