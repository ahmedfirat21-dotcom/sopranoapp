import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { W, H } from './constants';

export default function TwinklingStars() {
  const stars = useRef(
    Array.from({ length: 12 }).map(() => ({
      x: Math.random() * W,
      y: Math.random() * H * 0.55,
      size: Math.random() * 2.2 + 0.4,
      anim: new Animated.Value(Math.random()),
      duration: 1200 + Math.random() * 3500,
    }))
  ).current;

  useEffect(() => {
    stars.forEach(s => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(s.anim, { toValue: 1, duration: s.duration, useNativeDriver: true }),
          Animated.timing(s.anim, { toValue: 0.1, duration: s.duration, useNativeDriver: true }),
        ])
      ).start();
    });
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {stars.map((s, i) => (
        <Animated.View key={i} style={{
          position: 'absolute', left: s.x, top: s.y,
          width: s.size, height: s.size, borderRadius: s.size,
          backgroundColor: '#fff',
          opacity: s.anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.1, 0.7, 0.2] }),
        }} />
      ))}
    </View>
  );
}
