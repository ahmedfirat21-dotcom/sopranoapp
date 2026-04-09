/**
 * ParticleEffect — Lightweight stub
 * Hediye animasyonunda kullanılan parçacık efekti
 */
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

interface Props {
  count?: number;
  color?: string;
  duration?: number;
  active?: boolean;
}

export default function ParticleEffect({ count = 20, color = '#FFD700', duration = 2000, active = true }: Props) {
  const particles = useRef(
    Array.from({ length: count }, () => ({
      x: new Animated.Value(Math.random() * width),
      y: new Animated.Value(height),
      opacity: new Animated.Value(1),
    }))
  ).current;

  useEffect(() => {
    if (!active) return;
    particles.forEach((p) => {
      Animated.parallel([
        Animated.timing(p.y, { toValue: -50, duration: duration + Math.random() * 1000, useNativeDriver: true }),
        Animated.timing(p.opacity, { toValue: 0, duration, useNativeDriver: true }),
      ]).start();
    });
  }, [active]);

  if (!active) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            width: 6, height: 6, borderRadius: 3,
            backgroundColor: color,
            opacity: p.opacity,
            transform: [{ translateX: p.x }, { translateY: p.y }],
          }}
        />
      ))}
    </View>
  );
}
