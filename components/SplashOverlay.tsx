import React, { useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Animated, Image } from 'react-native';

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

  const iconOpacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    // Fade in
    Animated.parallel([
      Animated.timing(iconOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(iconScale, { toValue: 1, friction: 8, tension: 50, useNativeDriver: true }),
    ]).start();

    // Fade out sonra bitir
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(iconOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(iconScale, { toValue: 0.95, duration: 250, useNativeDriver: true }),
      ]).start(() => safeFinish());
    }, 1000);

    const safetyTimer = setTimeout(() => safeFinish(), 1800);

    return () => {
      clearTimeout(timer);
      clearTimeout(safetyTimer);
    };
  }, []);

  return (
    <View style={s.container}>
      <Animated.View style={{ opacity: iconOpacity, transform: [{ scale: iconScale }] }}>
        <Image
          source={require('../assets/app_icon.png')}
          style={s.icon}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1926',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 100,
    height: 100,
    borderRadius: 24,
  },
});
