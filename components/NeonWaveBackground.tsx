/**
 * SopranoChat — NeonWaveBackground
 * Koyu zemin üzerinde neon dalga efekti.
 * Animated gradient overlay ile hafif hareket verir.
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: W, height: H } = Dimensions.get('window');

export type BgVariant = 'default' | 'dark' | 'subtle' | 'warm' | 'cool' | 'explore' | 'messages' | 'myrooms' | 'profile';

const VARIANT_COLORS: Record<BgVariant, [string, string, string]> = {
  default: ['rgba(20,184,166,0.06)', 'rgba(139,92,246,0.04)', 'rgba(14,20,32,0.0)'],
  dark:    ['rgba(10,15,25,0.1)', 'rgba(20,30,50,0.05)', 'rgba(0,0,0,0.0)'],
  subtle:  ['rgba(20,184,166,0.03)', 'rgba(59,130,246,0.02)', 'rgba(14,20,32,0.0)'],
  warm:    ['rgba(245,158,11,0.05)', 'rgba(239,68,68,0.03)', 'rgba(14,20,32,0.0)'],
  cool:    ['rgba(59,130,246,0.06)', 'rgba(139,92,246,0.04)', 'rgba(14,20,32,0.0)'],
  explore: ['rgba(20,184,166,0.06)', 'rgba(59,130,246,0.04)', 'rgba(14,20,32,0.0)'],
  messages:['rgba(139,92,246,0.05)', 'rgba(59,130,246,0.03)', 'rgba(14,20,32,0.0)'],
  myrooms: ['rgba(20,184,166,0.05)', 'rgba(245,158,11,0.03)', 'rgba(14,20,32,0.0)'],
  profile: ['rgba(139,92,246,0.06)', 'rgba(20,184,166,0.03)', 'rgba(14,20,32,0.0)'],
};

interface Props {
  variant?: BgVariant;
  intensity?: number;
  children?: React.ReactNode;
}

export default function NeonWaveBackground({ variant = 'default', intensity = 1, children }: Props) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 8000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 8000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 30],
  });

  const colors = VARIANT_COLORS[variant] || VARIANT_COLORS.default;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Top glow */}
      <Animated.View
        style={[
          styles.glow,
          {
            top: -H * 0.15,
            opacity: 0.6 * intensity,
            transform: [{ translateY }],
          },
        ]}
      >
        <LinearGradient
          colors={colors}
          style={styles.gradient}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
        />
      </Animated.View>

      {/* Bottom glow */}
      <Animated.View
        style={[
          styles.glow,
          {
            bottom: -H * 0.2,
            opacity: 0.4 * intensity,
            transform: [{ translateY: Animated.multiply(translateY, -1) }],
          },
        ]}
      >
        <LinearGradient
          colors={[colors[1], colors[0], colors[2]]}
          style={styles.gradient}
          start={{ x: 0.8, y: 0 }}
          end={{ x: 0.2, y: 1 }}
        />
      </Animated.View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    left: -W * 0.2,
    right: -W * 0.2,
    height: H * 0.5,
  },
  gradient: {
    flex: 1,
    borderRadius: W * 0.5,
  },
});
