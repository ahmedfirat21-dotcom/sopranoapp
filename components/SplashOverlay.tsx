import React, { useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Animated, Dimensions, Image, ImageBackground, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface SplashOverlayProps {
  onFinish: () => void;
}

export default function SplashOverlay({ onFinish }: SplashOverlayProps) {
  const hasFinished = useRef(false);
  const safeFinish = useCallback(() => {
    if (hasFinished.current) return;
    hasFinished.current = true;
    onFinish();
  }, [onFinish]);

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const glowX = useRef(new Animated.Value(-width * 0.6)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const glow2Scale = useRef(new Animated.Value(0.85)).current;
  const glow3Y = useRef(new Animated.Value(0)).current;
  const star1 = useRef(new Animated.Value(0)).current;
  const star2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (__DEV__) console.log('[SplashOverlay] MOUNTED — safety timer set for 2s');

    Animated.timing(glowOpacity, { toValue: 1, duration: 800, useNativeDriver: true }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowX, { toValue: width * 0.6, duration: 8000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glowX, { toValue: -width * 0.6, duration: 8000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glow2Scale, { toValue: 1.1, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glow2Scale, { toValue: 0.85, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glow3Y, { toValue: -30, duration: 5000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glow3Y, { toValue: 30, duration: 5000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(star1, { toValue: 1, duration: 2500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(star1, { toValue: 0.1, duration: 2500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(star2, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(star2, { toValue: 0.2, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, friction: 8, tension: 50, useNativeDriver: true }),
      ]).start();
    }, 200);

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(logoScale, { toValue: 0.92, duration: 300, useNativeDriver: true }),
      ]).start(() => {
        safeFinish();
      });
    }, 1200);

    const safetyTimer = setTimeout(() => {
      if (__DEV__) console.warn('[SplashOverlay] Safety timeout triggered — forcing finish');
      safeFinish();
    }, 2000);

    return () => {
      clearTimeout(timer);
      clearTimeout(safetyTimer);
    };
  }, []);

  return (
    <ImageBackground
      source={require('../assets/images/app_bg.jpg')}
      style={s.container}
      resizeMode="cover"
    >
      {/* Teal ambient glow — üst katman */}
      <Animated.View style={[s.glowOrb, { opacity: glowOpacity, transform: [{ translateX: glowX }] }]}>
        <LinearGradient
          colors={['transparent', 'rgba(92,225,230,0.03)', 'rgba(92,225,230,0.08)', 'rgba(92,225,230,0.12)', 'rgba(92,225,230,0.08)', 'rgba(92,225,230,0.03)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={s.glowGradient}
        />
      </Animated.View>

      <Animated.View style={[s.glowCenter, { opacity: glowOpacity, transform: [{ scale: glow2Scale }] }]}>
        <LinearGradient
          colors={['transparent', 'rgba(92,225,230,0.04)', 'rgba(92,225,230,0.07)', 'rgba(92,225,230,0.04)', 'transparent']}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View style={[s.glowPurple, { opacity: glowOpacity, transform: [{ translateY: glow3Y }] }]}>
        <LinearGradient
          colors={['transparent', 'rgba(120,80,220,0.03)', 'rgba(120,80,220,0.05)', 'rgba(120,80,220,0.03)', 'transparent']}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Yıldızlar */}
      <Animated.View style={[s.star, { top: height * 0.18, left: width * 0.22 }, { opacity: star1 }]} />
      <Animated.View style={[s.star, { top: height * 0.28, right: width * 0.18 }, { opacity: star2 }]} />
      <Animated.View style={[s.star, { top: height * 0.62, left: width * 0.68 }, { opacity: star1 }]} />
      <Animated.View style={[s.star, { bottom: height * 0.22, left: width * 0.32 }, { opacity: star2 }]} />

      {/* ★ logo.png zaten "SopranoChat" + "Senin Sesin" metnini içeriyor */}
      <Animated.View style={[s.logoWrap, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        <Image source={require('../assets/logo.png')} style={s.logoImage} resizeMode="contain" />
      </Animated.View>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1926', alignItems: 'center', justifyContent: 'center' },
  glowOrb: { position: 'absolute', width: width * 1.4, height: height * 0.55, top: height * 0.18 },
  glowGradient: { width: '100%', height: '100%', borderRadius: 999 },
  glowCenter: { position: 'absolute', width: width * 0.9, height: width * 0.9, borderRadius: width * 0.45, top: height * 0.28, alignSelf: 'center', overflow: 'hidden' },
  glowPurple: { position: 'absolute', width: width * 0.8, height: height * 0.3, bottom: height * 0.1, alignSelf: 'center', borderRadius: 999, overflow: 'hidden' },
  star: { position: 'absolute', width: 2, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.7)' },
  logoWrap: { alignItems: 'center', justifyContent: 'center' },
  logoImage: { width: 320, height: 90 },
});
