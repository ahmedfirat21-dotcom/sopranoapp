import React, { useEffect, useRef } from 'react';
import { Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from './constants';

export default function VIPEntryBanner({ name, onDone }: { name: string; onDone: () => void }) {
  const slideY = useRef(new Animated.Value(-60)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, friction: 12, tension: 70, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      Animated.delay(2200),
      Animated.parallel([
        Animated.timing(slideY, { toValue: -60, duration: 250, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]),
    ]).start(onDone);
  }, []);

  return (
    <Animated.View style={[styles.vipBanner, { transform: [{ translateY: slideY }], opacity }]}>
      <LinearGradient colors={[COLORS.vipGoldGlow, 'transparent']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <Ionicons name="diamond" size={14} color={COLORS.vipGold} />
      <Text style={styles.vipBannerText}> {name} odaya giriş yaptı!</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  vipBanner: {
    position: 'absolute', top: 180, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(212,175,55,0.15)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
    zIndex: 100,
    shadowColor: '#D4AF37', shadowOpacity: 0.3, shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  vipBannerText: { color: COLORS.vipGold, fontSize: 11, fontWeight: '600' },
});
