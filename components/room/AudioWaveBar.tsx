import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';

export default function AudioWaveBar({ diameter, audioLevel = 0 }: { diameter: number; audioLevel?: number }) {
  const bars = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.5)).current, useRef(new Animated.Value(0.2)).current, useRef(new Animated.Value(0.7)).current, useRef(new Animated.Value(0.4)).current];
  const activeLevel = Math.max(0.1, audioLevel || 0);
  const levelRef = useRef(activeLevel);
  levelRef.current = activeLevel;

  useEffect(() => {
    const al = levelRef.current;
    const minH = 0.05 + al * 0.1;
    const maxH = 0.15 + al * 0.85;
    bars.forEach((bar) => {
      const targetHeight = minH + (maxH - minH) * (0.3 + Math.random() * 0.7);
      Animated.timing(bar, { 
        toValue: targetHeight, 
        duration: 90, 
        useNativeDriver: true 
      }).start();
    });
  }, [audioLevel]);

  const barWidth = Math.max(2, diameter * 0.04);
  const maxHeight = diameter * 0.35;

  return (
    <View style={{
      position: 'absolute', top: '75%', marginTop: -maxHeight / 2, alignSelf: 'center',
      flexDirection: 'row', gap: 2, alignItems: 'center', height: maxHeight, zIndex: 120
    }}>
      {bars.map((bar, i) => (
        <Animated.View key={i} style={{
          width: barWidth,
          backgroundColor: '#4ADE80',
          borderRadius: barWidth / 2,
          height: maxHeight,
          transform: [{ scaleY: bar }],
          shadowColor: '#4ADE80',
          shadowOpacity: 0.6,
          shadowRadius: 3,
          elevation: 3,
        }} />
      ))}
    </View>
  );
}
