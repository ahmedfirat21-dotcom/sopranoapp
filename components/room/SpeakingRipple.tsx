import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

export default function SpeakingRipple({ diameter, audioLevel = 0.5 }: { diameter: number; audioLevel?: number }) {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const activeLevel = Math.max(0.1, audioLevel || 0);
  const maxScale = 1.15 + activeLevel * 0.45;
  const borderW = 1 + activeLevel * 2;

  useEffect(() => {
    const speed = 1800 - activeLevel * 800;
    const anim = (v: Animated.Value, del: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(del),
        Animated.timing(v, { toValue: 1, duration: speed, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]));
    ring1.setValue(0); ring2.setValue(0);
    const a1 = anim(ring1, 0); a1.start();
    const a2 = anim(ring2, Math.max(200, speed / 3)); a2.start();
    return () => { a1.stop(); a2.stop(); };
  }, []);

  const makeStyle = (v: Animated.Value) => ({
    position: 'absolute' as const,
    width: diameter, height: diameter, borderRadius: diameter / 2,
    borderWidth: borderW,
    borderColor: `rgba(92,225,230,${0.3 + activeLevel * 0.4})`,
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.3 + activeLevel * 0.4, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, maxScale] }) }],
  });

  return (
    <>
      <Animated.View style={makeStyle(ring1)} />
      <Animated.View style={makeStyle(ring2)} />
    </>
  );
}
