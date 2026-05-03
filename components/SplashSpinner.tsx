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
  // ★ v107.21: Dış solid halka KALDIRILDI (kullanıcı talebi: "halka çizgisi" gibi görünüyordu).
  //   Sadece dönen ince ring kalır + Android elevation kaldırıldı.
  //   iOS shadow soft, Android'de border opacity ile telafi.
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }}>
      <Animated.View
        style={{
          width: size, height: size, borderRadius: size / 2,
          borderWidth: Math.max(2, size * 0.06),
          borderColor: `${color}22`,
          borderTopColor: color,
          borderRightColor: color,
          transform: [{ rotate: rotateDeg }],
          ...(Platform.OS === 'ios' ? {
            shadowColor: color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5,
            shadowRadius: size * 0.18,
          } : {}),
        }}
      />
    </View>
  );
}
