/**
 * AnimatedBrandHeader — "Soprano" + "Suffix" ikili animasyonlu header logo.
 * MaskedView gerektirmez — gradient yerine solid color drop-shadow.
 * Cooper Black görünümü için kalın serif font.
 * 
 * Kullanım:
 *   <AnimatedBrandHeader suffix="Profil" suffixColor="#F59E0B" />
 */
import React, { useRef, useEffect } from 'react';
import { View, Text, Animated, StyleSheet, Platform } from 'react-native';

// ★ Global intro flag — uygulama açıkken ilk kez animasyon oynar, sonra statik.
let _introPlayed = false;
export function markBrandIntroPlayed() { _introPlayed = true; }
export function brandIntroPlayed() { return _introPlayed; }

interface AnimatedBrandHeaderProps {
  suffix: string;
  suffixColor: string;
  /** Font boyutu, varsayılan 28 */
  fontSize?: number;
}

export default function AnimatedBrandHeader({
  suffix,
  suffixColor,
  fontSize = 28,
}: AnimatedBrandHeaderProps) {
  const played = brandIntroPlayed();
  const sopX = useRef(new Animated.Value(played ? 0 : -160)).current;
  const sopOp = useRef(new Animated.Value(played ? 1 : 0)).current;
  const sufX = useRef(new Animated.Value(played ? 0 : 120)).current;
  const sufOp = useRef(new Animated.Value(played ? 1 : 0)).current;

  useEffect(() => {
    if (played) return;
    const t1 = setTimeout(() => {
      Animated.parallel([
        Animated.timing(sopOp, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.spring(sopX, { toValue: 0, friction: 7, tension: 40, useNativeDriver: true }),
      ]).start();
    }, 200);
    const t2 = setTimeout(() => {
      Animated.parallel([
        Animated.timing(sufOp, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(sufX, { toValue: 0, friction: 6, tension: 50, useNativeDriver: true }),
      ]).start(() => markBrandIntroPlayed());
    }, 650);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const textBase = {
    fontFamily: Platform.OS === 'ios' ? 'Baskerville-Bold' : 'serif',
    fontSize,
    fontWeight: '900' as const,
    fontStyle: 'italic' as const,
    letterSpacing: 0.3,
  };

  return (
    <View style={s.row}>
      <Animated.Text
        style={[
          textBase,
          s.soprano,
          { opacity: sopOp, transform: [{ translateX: sopX }] },
        ]}
      >
        Soprano
      </Animated.Text>
      <Animated.Text
        style={[
          textBase,
          s.suffix,
          { color: suffixColor, opacity: sufOp, transform: [{ translateX: sufX }] },
        ]}
      >
        {suffix}
      </Animated.Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  soprano: {
    color: '#CBD5E1',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
  },
  suffix: {
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
  },
});
