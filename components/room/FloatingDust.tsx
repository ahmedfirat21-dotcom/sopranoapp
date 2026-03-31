import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { W, H } from './constants';

export default function FloatingDust() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: 5 }).map((_, i) => {
        const anim = useRef(new Animated.Value(0)).current;
        const size = Math.random() * 3 + 1.5;
        const startX = Math.random() * W;
        
        useEffect(() => {
          Animated.loop(
            Animated.sequence([
              Animated.timing(anim, { 
                toValue: 1, 
                duration: 15000 + Math.random() * 10000, 
                delay: Math.random() * 8000, 
                useNativeDriver: true 
              }),
              Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true })
            ])
          ).start();
        }, []);

        const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [H, -50] });
        const opacity = anim.interpolate({ inputRange: [0, 0.4, 0.8, 1], outputRange: [0, Math.random() * 0.15 + 0.1, Math.random() * 0.15 + 0.1, 0] });
        const translateX = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [startX, startX + (Math.random() * 40 - 20), startX + (Math.random() * 40 - 20)] });

        return (
          <Animated.View key={i} style={{
            position: 'absolute',
            width: size, height: size, borderRadius: size/2,
            backgroundColor: '#FFF',
            opacity,
            transform: [{ translateY }, { translateX }]
          }} />
        );
      })}
    </View>
  );
}
