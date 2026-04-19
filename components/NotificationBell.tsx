// SopranoChat — Premium Bildirim Zili
// - Yeni bildirim gelince shake (hafif sağa-sola salınım)
// - Okunmamış varken badge pulse (yumuşak scale)
// - Tıklanınca light haptic feedback
// - Kendi stilini home/messages/myrooms'da tekrarlamayı bırakır

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface Props {
  unreadCount: number;
  onPress: () => void;
  style?: any;
}

export default function NotificationBell({ unreadCount, onPress, style }: Props) {
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const prevCountRef = useRef(unreadCount);

  // ★ Yeni bildirim → shake animasyonu (2 kere küçük salınım)
  useEffect(() => {
    if (unreadCount > prevCountRef.current) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -1, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -1, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();
      // Bildirim geldi — hafif haptic
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    prevCountRef.current = unreadCount;
  }, [unreadCount]);

  // ★ Unread > 0 → badge sürekli yumuşak pulse
  useEffect(() => {
    if (unreadCount > 0) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.18, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [unreadCount]);

  const rotate = shakeAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-8deg', '8deg'],
  });

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  return (
    <Pressable style={[s.btn, style]} onPress={handlePress} hitSlop={8} accessibilityLabel={`${unreadCount} bildirim`}>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Ionicons
          name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
          size={20}
          color={unreadCount > 0 ? '#FBBF24' : '#F1F5F9'}
          style={{
            textShadowColor: unreadCount > 0 ? 'rgba(251,191,36,0.5)' : 'rgba(0,0,0,0.5)',
            textShadowOffset: { width: 0, height: unreadCount > 0 ? 0 : 2 },
            textShadowRadius: unreadCount > 0 ? 8 : 4,
          }}
        />
      </Animated.View>
      {unreadCount > 0 && (
        <Animated.View style={[s.badge, { transform: [{ scale: pulseAnim }] }]}>
          <Text style={s.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </Animated.View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
    position: 'relative',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  badge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#EF4444',
    paddingHorizontal: 5,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#0F172A',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  badgeText: {
    fontSize: 10, fontWeight: '900', color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
});
