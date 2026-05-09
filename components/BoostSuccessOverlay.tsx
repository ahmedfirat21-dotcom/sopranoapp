/**
 * SopranoChat — Boost / Ödeme Başarı Overlay
 * ═══════════════════════════════════════════════════════════════════
 * v109 (5 May 2026) — Profil boost ve ödeme onaylarında inline tam ekran
 * Lottie. Modal değil, doğrudan görünür. Şeffaf arkaplan, hafif blur.
 *
 * Animasyon bittikten sonra 500ms bekler, sonra onComplete() tetiklenir.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

let LottieView: any = null;
try {
  LottieView = require('lottie-react-native').default;
} catch { /* fallback */ }

const { width: W, height: H } = Dimensions.get('window');

interface Props {
  visible: boolean;
  /** Animasyon + 500ms bekleme sonrası tetiklenir */
  onComplete: () => void;
  /** Lottie boyutu (default ekran genişliğinin %85'i, max 420) */
  size?: number;
  /** Animasyon altında gösterilecek estetik metin (opsiyonel) — örn. "Odan Hazır" */
  caption?: string;
}

export default function BoostSuccessOverlay({ visible, onComplete, size = Math.min(W * 0.85, 420), caption }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const completedRef = useRef(false);

  useEffect(() => {
    if (visible) {
      completedRef.current = false;
      // ★ Fade-in
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      opacity.setValue(0);
    }
  }, [visible]);

  const handleAnimationFinish = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    // ★ Animasyon bitti — 500ms bekle, sonra fade-out + onComplete
    setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        onComplete();
      });
    }, 500);
  };

  if (!visible) return null;

  return (
    <Modal visible transparent statusBarTranslucent animationType="none">
      {/* ★ Şeffaf arkaplan + yumuşak yeşil success glow — ekran tamamı, hafif tint */}
      <Animated.View style={[s.wrap, { opacity }]} pointerEvents="none">
        {/* Üst-orta'dan yayılan yeşil success aura */}
        <LinearGradient
          colors={['rgba(34,197,94,0.22)', 'rgba(34,197,94,0.10)', 'rgba(34,197,94,0.04)', 'transparent']}
          start={{ x: 0.5, y: 0.5 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <LinearGradient
          colors={['transparent', 'rgba(34,197,94,0.08)', 'rgba(34,197,94,0.18)', 'rgba(34,197,94,0.08)', 'transparent']}
          locations={[0, 0.3, 0.5, 0.7, 1]}
          start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Lottie ortalı, büyük */}
        {LottieView ? (
          <LottieView
            source={require('../assets/checked.json')}
            autoPlay
            loop={false}
            style={{ width: size, height: size }}
            onAnimationFinish={handleAnimationFinish}
          />
        ) : (
          <FallbackTimer onDone={handleAnimationFinish} />
        )}
        {/* Estetik caption — Lottie altına yapışık, çift katman glow (yeşil halo + beyaz koyu drop shadow) */}
        {caption ? (
          <View style={s.captionWrap}>
            {/* Alt katman — yeşil success halo (blur-glow efekti) */}
            <Text style={[s.caption, s.captionGlow]} numberOfLines={1}>{caption}</Text>
            {/* Üst katman — net beyaz metin */}
            <Text style={[s.caption, s.captionMain]} numberOfLines={1}>{caption}</Text>
          </View>
        ) : null}
      </Animated.View>
    </Modal>
  );
}

// Lottie yüklenememişse zamanlayıcı (development fallback)
function FallbackTimer({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 600);
    return () => clearTimeout(t);
  }, []);
  return <View />;
}

const s = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // ★ Şeffaf — backgroundColor yok, hiçbir zemin yok
  },
  // ★ 2026-05-05: Lottie square'inin altı boş olduğu için negatif marginTop ile
  //   yazıyı tikin hemen altına yapıştırıyoruz. İki katman: glow (alt) + net (üst).
  captionWrap: {
    marginTop: -80,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 1.8,
    textAlign: 'center',
  },
  // Alt katman — soft yeşil halo (blur etkisi yaratır)
  captionGlow: {
    position: 'absolute',
    color: '#22C55E',
    textShadowColor: 'rgba(34,197,94,0.95)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 22,
    opacity: 0.55,
  },
  // Üst katman — net beyaz, ince koyu drop shadow ile derinlik
  captionMain: {
    color: '#F8FAFC',
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
});
