/**
 * SopranoChat — Skia tabanlı touchable buton primitive'i.
 *
 * SkiaCard'ı arka plan olarak kullanır + Pressable touch + scale animasyonu.
 * Web admin'deki buton tasarımının APK'da birebir çıkması için.
 *
 * KULLANIM:
 *   <SkiaButton
 *     width={200} height={48}
 *     gradient={{ colors: ['#A78BFA', '#7C3AED'], direction: 'horizontal' }}
 *     borderRadius={24}
 *     shadowColor="#7C3AED" shadowOpacity={0.5} shadowBlur={14} shadowOffsetY={6}
 *     onPress={() => doThing()}
 *   >
 *     <Text style={{ color: '#fff', fontWeight: '600' }}>Tıkla</Text>
 *   </SkiaButton>
 *
 * NOT: scale animasyonu için Animated.View kullanıldı (Reanimated ekstra import gerektirmesin).
 */

import React, { ReactNode, useRef } from 'react';
import { Pressable, Animated, ViewStyle, StyleSheet, GestureResponderEvent } from 'react-native';
import { SkiaCard, SkiaGradient } from './SkiaCard';

export interface SkiaButtonProps {
  width: number;
  height: number;
  backgroundColor?: string;
  gradient?: SkiaGradient;
  borderRadius?: number;
  borderColor?: string;
  borderWidth?: number;
  shadowColor?: string;
  shadowOpacity?: number;
  shadowBlur?: number;
  shadowOffsetY?: number;
  shadowOffsetX?: number;
  /** Basıldığında küçülme oranı. Default 0.96. */
  pressScale?: number;
  disabled?: boolean;
  onPress?: (e: GestureResponderEvent) => void;
  style?: ViewStyle | ViewStyle[];
  children?: ReactNode;
}

export function SkiaButton({
  width,
  height,
  backgroundColor,
  gradient,
  borderRadius = 12,
  borderColor,
  borderWidth = 0,
  shadowColor,
  shadowOpacity,
  shadowBlur,
  shadowOffsetY,
  shadowOffsetX,
  pressScale = 0.96,
  disabled = false,
  onPress,
  style,
  children,
}: SkiaButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, { toValue: pressScale, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }], opacity: disabled ? 0.5 : 1 }, style]}>
      <Pressable
        onPress={disabled ? undefined : onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
        style={{ width, height }}
      >
        <SkiaCard
          width={width}
          height={height}
          backgroundColor={backgroundColor}
          gradient={gradient}
          borderRadius={borderRadius}
          borderColor={borderColor}
          borderWidth={borderWidth}
          shadowColor={shadowColor}
          shadowOpacity={shadowOpacity}
          shadowBlur={shadowBlur}
          shadowOffsetY={shadowOffsetY}
          shadowOffsetX={shadowOffsetX}
        >
          <Animated.View style={[StyleSheet.absoluteFill, centerStyle]}>
            {children}
          </Animated.View>
        </SkiaCard>
      </Pressable>
    </Animated.View>
  );
}

const centerStyle: ViewStyle = {
  alignItems: 'center',
  justifyContent: 'center',
};
