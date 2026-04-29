import React, { useCallback, useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet, ImageStyle, ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { bannerIntroPlayed, markBannerIntroPlayed } from '../utils/bannerIntro';

// ★ 2026-04-28: Header logo — Cooper Black PNG'ler (soprano_part + chat_part).
//   İlk açılışta yandan "coming together" animasyonu.
//   Tab focus'unda 45px yan slide + scale puls (0.85→1.08→1).
const SOP_W = 110;
const CHAT_W = 75;
const H = 30;

export default function AnimatedLogo({ style }: { style?: ViewStyle }) {
  const played = bannerIntroPlayed();

  const sopX = useRef(new Animated.Value(played ? 0 : -160)).current;
  const sopOpacity = useRef(new Animated.Value(played ? 1 : 0)).current;
  const chatX = useRef(new Animated.Value(played ? 0 : 120)).current;
  const chatOpacity = useRef(new Animated.Value(played ? 1 : 0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (played) return;
    const sopTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(sopOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.spring(sopX, { toValue: 0, friction: 7, tension: 40, useNativeDriver: true }),
      ]).start();
    }, 200);
    const chatTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(chatOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(chatX, { toValue: 0, friction: 6, tension: 50, useNativeDriver: true }),
      ]).start(() => markBannerIntroPlayed());
    }, 650);
    return () => { clearTimeout(sopTimer); clearTimeout(chatTimer); };
  }, []);

  // ★ 2026-04-29: Tab focus'unda re-entrance — Soprano sol-bounce + Chat sağ-bounce + scale puls
  useFocusEffect(
    useCallback(() => {
      if (!bannerIntroPlayed()) return;
      sopX.setValue(-45);
      chatX.setValue(45);
      pulse.setValue(0.85);
      Animated.parallel([
        Animated.spring(sopX, {
          toValue: 0, friction: 6, tension: 60, useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(70),
          Animated.spring(chatX, {
            toValue: 0, friction: 5, tension: 70, useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.08, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.spring(pulse, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
        ]),
      ]).start();
    }, [])
  );

  return (
    <Animated.View style={[s.row, style, { transform: [{ scale: pulse }] }]}>
      <Animated.Image
        source={require('../assets/soprano_part.png')}
        style={[
          s.sop,
          {
            opacity: sopOpacity,
            transform: [{ translateX: sopX }],
          },
        ]}
        resizeMode="contain"
      />
      <Animated.Image
        source={require('../assets/chat_part.png')}
        style={[
          s.chat,
          {
            opacity: chatOpacity,
            transform: [{ translateX: chatX }],
          },
        ]}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginTop: -6 },
  sop: { width: SOP_W, height: H } as ImageStyle,
  chat: { width: CHAT_W, height: H, marginLeft: -4 } as ImageStyle,
});
