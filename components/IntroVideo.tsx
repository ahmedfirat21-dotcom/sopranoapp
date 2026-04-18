/**
 * SopranoChat — AppSplash Overlay
 * Uygulama açılışında app_icon.png gösterir, 2.5sn sonra fade-out ile kaybolur.
 * _layout.tsx'de splash yerine gösterilir.
 */
import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, Dimensions, Image } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

type Props = {
  onFinish: () => void;
};

export default function IntroVideo({ onFinish }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // ★ Giriş animasyonu: fade-in + scale-up + glow pulse
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
      ])
    ).start();

    // ★ 2.5sn sonra fade-out
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        onFinish();
      });
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Glow ring */}
      <Animated.View style={[styles.glowRing, { opacity: glowAnim }]} />

      {/* App Icon */}
      <Animated.Image
        source={require('../assets/app_icon.png')}
        style={[styles.icon, { transform: [{ scale: scaleAnim }] }]}
        resizeMode="contain"
      />

      {/* App Name */}
      <Animated.Text style={[styles.appName, { opacity: fadeAnim }]}>
        SopranoChat
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    elevation: 99999,
    backgroundColor: '#0A0F1C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'rgba(20,184,166,0.3)',
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 30,
    shadowOpacity: 0.5,
    elevation: 20,
  },
  icon: {
    width: 140,
    height: 140,
    borderRadius: 32,
  },
  appName: {
    marginTop: 24,
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
    textShadowColor: 'rgba(20,184,166,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
});
