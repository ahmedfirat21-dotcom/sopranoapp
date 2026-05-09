/**
 * SopranoChat — Hesap Silme Sonrası Lottie Animasyonu
 * ════════════════════════════════════════════════════════════════════
 * v1.3.16 (9 May 2026) — Hesap silindiğinde login ekranına yönlenince
 * üst kısımda (logo'nun üstünde) tek seferlik Lottie. Bittikten sonra
 * yumuşak fade-out, tekrar etmez.
 *
 * AsyncStorage flag'i `@soprano_account_just_deleted` set olduğunda
 * login ekranı bu component'i mount eder.
 *
 * ★ v201 robust: Lottie modülü/asset hata verse bile login crash etmesin.
 *   ErrorBoundary + 3sn fallback timer ile garanti unmount.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';

let LottieView: any = null;
let DELETED_LOTTIE: any = null;
try {
  LottieView = require('lottie-react-native').default;
} catch { /* fallback */ }
try {
  // ★ v201 fix: Deleted.json (4 harici PNG referanslı) yerine Delete.json (vector-only).
  DELETED_LOTTIE = require('../assets/Delete.json');
} catch { DELETED_LOTTIE = null; }

interface Props {
  /** Animasyon + fade tamamlanınca çağrılır — parent overlay'i unmount edebilir. */
  onDone: () => void;
  /** Animasyon boyutu (px). Default 180 — login logosu üstünde kompakt durur. */
  size?: number;
}

// ★ ErrorBoundary — Lottie render exception'ı login'i crash etmesin.
class LottieGuard extends React.Component<{ children: React.ReactNode; onError: () => void }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.hasError ? null : this.props.children; }
}

export default function AccountDeletedOverlay({ onDone, size = 180 }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const completedRef = useRef(false);
  const [shouldRender, setShouldRender] = useState(true);
  const [lottieErrored, setLottieErrored] = useState(false);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // ★ v203 fix: Tek sefer oynar (kullanıcı isteği). Lottie load edilemezse 3.5sn fallback.
    const safety = setTimeout(() => handleAnimationFinish(), 3500);
    return () => clearTimeout(safety);
  }, []);

  const handleAnimationFinish = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 400,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setShouldRender(false);
        onDone();
      });
    }, 250);
  };

  if (!shouldRender) return null;

  const canRenderLottie = LottieView && DELETED_LOTTIE && !lottieErrored;

  return (
    <Animated.View style={[styles.wrap, { opacity }]} pointerEvents="none">
      {canRenderLottie ? (
        <LottieGuard onError={() => setLottieErrored(true)}>
          <LottieView
            source={DELETED_LOTTIE}
            autoPlay
            loop={false}
            style={{ width: size, height: size }}
            onAnimationFinish={handleAnimationFinish}
          />
        </LottieGuard>
      ) : (
        // ★ Fallback: Lottie yoksa veya bozuksa görünmez kal — safety timer onDone'ı tetikler.
        <View style={{ width: size, height: size }} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // ★ v206: Daha büyük + logoya daha yakın. top: 60 (status bar + ofset),
  //   size prop'u 130 ile gönderiliyor — animasyon belirgin, logo bölgesinde durur.
  wrap: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    zIndex: 100,
  },
});
