/**
 * SopranoChat — Splash spinner (font-bağımsız, sadece _layout splash için)
 * AppLoader Ionicons kullanıyor, font yüklenmeden gösterilemez. Bu component
 * sadece pure RN border ile dönen halka — splash'ta güvenle gösterilir.
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, Platform } from 'react-native';

interface Props {
  size?: number;
  color?: string;
  bg?: string;
}

export default function SplashSpinner({ size = 56, color = '#14B8A6', bg = '#0A0F1A' }: Props) {
  const rotate = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(rotate, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }),
    ).start();
  }, []);
  const rotateDeg = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }}>
      <View style={{
        width: size * 1.4, height: size * 1.4, borderRadius: size * 0.7,
        backgroundColor: `${color}22`,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Animated.View
          style={{
            width: size, height: size, borderRadius: size / 2,
            borderWidth: Math.max(3, size * 0.085),
            borderColor: `${color}22`,
            borderTopColor: color,
            borderRightColor: color,
            transform: [{ rotate: rotateDeg }],
            ...Platform.select({
              ios: { shadowColor: color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: size * 0.25 },
              android: { elevation: Math.max(4, Math.floor(size * 0.15)) },
            }),
          }}
        />
      </View>
    </View>
  );
}
