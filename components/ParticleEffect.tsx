import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

interface ParticleEffectProps {
  type: 'confetti' | 'sparkle' | 'hearts' | 'stars' | 'fire_sparks';
  color: string;
  duration?: number;
  count?: number;
}

export default function ParticleEffect({ type, color, duration = 3000, count = 30 }: ParticleEffectProps) {
  const particles = useRef(Array.from({ length: count }).map(() => ({
    posX: Math.random() * width,
    posY: Math.random() * height,
    scale: new Animated.Value(0),
    opacity: new Animated.Value(0),
    translateY: new Animated.Value(0),
    translateX: new Animated.Value(0),
    rotation: new Animated.Value(0),
  }))).current;

  useEffect(() => {
    const animations = particles.map((p) => {
      const isConfetti = type === 'confetti';
      const isHeartOrFire = type === 'hearts' || type === 'fire_sparks';
      const isSparkleOrStar = type === 'sparkle' || type === 'stars';

      const sequence = [];

      // Giris
      sequence.push(
        Animated.parallel([
          Animated.timing(p.opacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(p.scale, {
            toValue: Math.random() * 1.5 + 0.5,
            duration: 400 + Math.random() * 200,
            useNativeDriver: true,
          })
        ])
      );

      // Hareket
      if (isConfetti) {
        sequence.push(
          Animated.parallel([
            Animated.timing(p.translateY, {
              toValue: height * 0.8,
              duration: duration - 600,
              useNativeDriver: true,
            }),
            Animated.timing(p.rotation, {
              toValue: 1,
              duration: duration - 600,
              useNativeDriver: true,
            })
          ])
        );
      } else if (isHeartOrFire) {
        sequence.push(
          Animated.timing(p.translateY, {
            toValue: -height * 0.6,
            duration: duration - 600,
            useNativeDriver: true,
          })
        );
      } else if (isSparkleOrStar) {
        sequence.push(
          Animated.parallel([
            Animated.timing(p.translateX, {
              toValue: (Math.random() - 0.5) * width,
              duration: duration - 600,
              useNativeDriver: true,
            }),
            Animated.timing(p.translateY, {
              toValue: (Math.random() - 0.5) * height,
              duration: duration - 600,
              useNativeDriver: true,
            }),
            Animated.timing(p.rotation, {
              toValue: 1,
              duration: duration - 600,
              useNativeDriver: true,
            })
          ])
        );
      }

      // Cikis
      sequence.push(
        Animated.parallel([
          Animated.timing(p.opacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(p.scale, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          })
        ])
      );

      return Animated.sequence(sequence);
    });

    Animated.parallel(animations).start();
  }, [particles, type, duration]);

  const renderParticle = (p: any, index: number) => {
    let content = null;

    if (type === 'hearts') content = '❤️';
    else if (type === 'stars') content = '⭐';
    else if (type === 'fire_sparks') content = '🔥';

    const spin = p.rotation.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', `${Math.floor(Math.random() * 360 + 180)}deg`]
    });

    const style = {
      position: 'absolute' as const,
      left: type === 'sparkle' || type === 'stars' ? width / 2 : p.posX,
      top: type === 'hearts' || type === 'fire_sparks' ? height : (type === 'sparkle' || type === 'stars' ? height / 2 : p.posY / 2),
      opacity: p.opacity,
      transform: [
        { scale: p.scale },
        { translateY: p.translateY },
        { translateX: p.translateX },
        { rotate: spin }
      ]
    };

    if (content) {
      return (
        <Animated.Text key={index} style={[style, { fontSize: type === 'fire_sparks' ? 12 : 24 }]}>
          {content}
        </Animated.Text>
      );
    }

    // Confetti veya Sparkle (sekiller)
    return (
      <Animated.View
        key={index}
        style={[
          style,
          {
            width: type === 'sparkle' ? 8 : 12,
            height: type === 'sparkle' ? 8 : 12,
            backgroundColor: color,
            borderRadius: type === 'sparkle' ? 4 : 2,
          }
        ]}
      />
    );
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => renderParticle(p, i))}
    </View>
  );
}
