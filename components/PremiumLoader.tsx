/**
 * SopranoChat — Premium Loader
 * ★ 2026-04-24: ActivityIndicator yerine marka-uyumlu dönen halka +
 *   nefes alan iç nokta. Teal paleti, native driver ile pürüzsüz 60fps.
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';

interface Props {
  /** Dış halka çapı (px). Default: 56 */
  size?: number;
  /** Halka rengi (default teal) */
  color?: string;
}

export default function PremiumLoader({ size = 56, color = '#14B8A6' }: Props) {
  const rotation = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Halka dönüşü — sürekli loop
    const rotLoop = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    // Nefes alan iç nokta
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    rotLoop.start();
    pulseLoop.start();
    return () => { rotLoop.stop(); pulseLoop.stop(); };
  }, []);

  const rotateInterpolate = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.1] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.95] });

  const ring = size;
  const innerDot = Math.round(size * 0.28);

  return (
    <View style={{ width: ring, height: ring, alignItems: 'center', justifyContent: 'center' }}>
      {/* Dönen halka — üst segment belirgin, alt segment soluk */}
      <Animated.View
        style={[
          styles.ring,
          {
            width: ring,
            height: ring,
            borderRadius: ring / 2,
            borderWidth: 3,
            borderColor: `${color}22`,
            borderTopColor: color,
            borderRightColor: `${color}AA`,
            transform: [{ rotate: rotateInterpolate }],
            shadowColor: color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.6,
            shadowRadius: 10,
          },
        ]}
      />
      {/* Nefes alan iç nokta */}
      <Animated.View
        style={[
          styles.innerDot,
          {
            width: innerDot,
            height: innerDot,
            borderRadius: innerDot / 2,
            backgroundColor: color,
            opacity: pulseOpacity,
            transform: [{ scale: pulseScale }],
            shadowColor: color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.8,
            shadowRadius: 12,
            elevation: 8,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
  },
  innerDot: {
    position: 'absolute',
  },
});
