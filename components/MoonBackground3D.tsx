/**
 * SopranoChat — MoonBackground (Performans Optimizeli)
 * Sadece ay görseli, mask/çerçeve/glow yok.
 */
import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';

const { width: W } = Dimensions.get('window');
const MOON_SIZE = W * 0.35;

export default function MoonBackground3D({ showMoon = true }: { showMoon?: boolean }) {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(showMoon ? 1 : 0)).current;
  const fadeBase = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 120000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  useEffect(() => {
    Animated.timing(scaleAnim, {
      toValue: showMoon ? 1 : 0,
      duration: 800,
      easing: showMoon ? Easing.out(Easing.back(1.2)) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [showMoon]);

  const rotate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.Image
        source={require('../assets/images/moon.png')}
        style={{
          position: 'absolute',
          top: 20,
          right: -MOON_SIZE * 0.18,
          width: MOON_SIZE,
          height: MOON_SIZE,
          opacity: Animated.multiply(scaleAnim, fadeBase),
          transform: [{ scale: scaleAnim }, { rotate }],
        }}
        resizeMode="contain"
      />
    </View>
  );
}
