/**
 * PremiumIntro — Minimal splash on app launch.
 *
 * Shows app icon on login background (app_bg.jpg), then fades out.
 * No video — sadece ikon + arka plan.
 * Safety timeout: 4s.
 */
import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Image,
  Dimensions,
  Easing,
  ImageBackground,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface PremiumIntroProps {
  onFinish: () => void;
}

export default function PremiumIntro({ onFinish }: PremiumIntroProps) {
  const hasFinished = useRef(false);

  const safeFinish = useCallback(() => {
    if (hasFinished.current) return;
    hasFinished.current = true;
    if (__DEV__) console.log('[PremiumIntro] ✅ Intro tamamlandı');
    onFinish();
  }, [onFinish]);

  const containerOpacity = useRef(new Animated.Value(1)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0.8)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ── Fade out → finish ──
  const fadeOutAndFinish = useCallback(() => {
    if (hasFinished.current) return;
    Animated.timing(containerOpacity, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => safeFinish());
  }, [containerOpacity, safeFinish]);

  useEffect(() => {
    // 1. Ambient glow fade-in
    Animated.timing(glowOpacity, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // 2. Icon entrance — fade in + spring scale
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(iconOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(iconScale, {
          toValue: 1,
          friction: 8,
          tension: 50,
          useNativeDriver: true,
        }),
      ]).start();
    }, 200);

    // 3. Subtle pulse animation on icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.04,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 4. Auto-finish after 2.5s with fade-out
    const finishTimer = setTimeout(fadeOutAndFinish, 2500);

    // 5. SAFETY: Hard timeout — 4s sonra her halükarda bitir
    const safetyTimer = setTimeout(() => {
      if (__DEV__) console.warn('[PremiumIntro] ⚠ Safety timeout — zorla finish');
      safeFinish();
    }, 4000);

    return () => {
      clearTimeout(finishTimer);
      clearTimeout(safetyTimer);
    };
  }, []);

  return (
    <Animated.View style={[s.container, { opacity: containerOpacity }]}>
      <ImageBackground
        source={require('../assets/images/app_bg.jpg')}
        style={s.background}
        resizeMode="cover"
      >
        {/* Vignette overlay — login ile aynı derinlik efekti */}
        <LinearGradient
          colors={['rgba(15,25,38,0.6)', 'transparent', 'transparent', 'rgba(15,25,38,0.7)']}
          locations={[0, 0.25, 0.7, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Ambient teal glow — üst */}
        <Animated.View style={[s.ambientTop, { opacity: glowOpacity }]}>
          <LinearGradient
            colors={['rgba(20,184,166,0.08)', 'rgba(20,184,166,0.03)', 'transparent']}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Ambient teal glow — alt */}
        <Animated.View style={[s.ambientBottom, { opacity: glowOpacity }]}>
          <LinearGradient
            colors={['transparent', 'rgba(20,184,166,0.03)', 'rgba(20,184,166,0.06)']}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* App Icon */}
        <Animated.View style={[
          s.iconWrap,
          {
            opacity: iconOpacity,
            transform: [
              { scale: Animated.multiply(iconScale, pulseAnim) },
            ],
          },
        ]}>
          {/* Glow ring behind icon */}
          <View style={s.glowRing} />
          <Image
            source={require('../assets/app_icon.png')}
            style={s.appIcon}
            resizeMode="contain"
          />
        </Animated.View>
      </ImageBackground>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 999,
  },
  background: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F1926',
  },
  ambientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.4,
  },
  ambientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.3,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 35,
    backgroundColor: 'rgba(20,184,166,0.08)',
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 10,
  },
  appIcon: {
    width: 110,
    height: 110,
    borderRadius: 28,
    // Premium shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
});
