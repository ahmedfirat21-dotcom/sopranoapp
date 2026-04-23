/**
 * SopranoChat — Mini Oda Kartı (Floating PiP)
 * ★ 2026-04-23 REDESIGN: Glassmorphic premium tasarım.
 *   - Tab bar ile aynı genişlik & margin (BAR_MARGIN=6, insets-aware)
 *   - Control bar ile birebir border radius (22) ve gradient dili
 *   - Canlı gösterge + ripple animasyonu
 *   - Tab bar'ın hemen üstünde konumlanır
 */
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface MinimizedRoom {
  id: string;
  name: string;
  hostName: string;
  viewerCount: number;
  isMicOn: boolean;
}

interface MiniRoomCardProps {
  room: MinimizedRoom;
  onExpand: () => void;
  onClose: () => void;
}

// ★ Tab bar ile aynı ölçüler
const BAR_MARGIN = 6;
const BAR_H = 60;  // CurvedTabBar height

export default function MiniRoomCard({ room, onExpand, onClose }: MiniRoomCardProps) {
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const slideIn = useRef(new Animated.Value(80)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ripple1 = useRef(new Animated.Value(0)).current;
  const ripple2 = useRef(new Animated.Value(0)).current;

  // Tab bar ile aynı genişlik hesabı
  const cardWidth = Math.max(0, winW - BAR_MARGIN * 2 - (insets.left + insets.right));
  // Tab bar'ın hemen üstüne konumlan
  const bottomPos = Math.max(insets.bottom, 8) + BAR_H + 8;

  useEffect(() => {
    Animated.spring(slideIn, { toValue: 0, friction: 10, tension: 80, useNativeDriver: true }).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();

    const makeRipple = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 2000, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );

    const r1 = makeRipple(ripple1, 0);
    const r2 = makeRipple(ripple2, 1000);
    r1.start();
    r2.start();

    return () => { pulse.stop(); r1.stop(); r2.stop(); };
  }, []);

  const handleClose = () => {
    Animated.timing(slideIn, { toValue: 120, duration: 200, useNativeDriver: true }).start(() => {
      onClose();
    });
  };

  const rippleScale = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const rippleOpacity = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.3, 0.12, 0] });

  return (
    <Animated.View style={[
      s.container,
      {
        bottom: bottomPos,
        width: cardWidth,
        transform: [{ translateY: slideIn }],
      },
    ]}>
      {/* Ripple halkaları */}
      <Animated.View style={[
        s.ripple,
        { transform: [{ scale: rippleScale(ripple1) }], opacity: rippleOpacity(ripple1) },
      ]} />
      <Animated.View style={[
        s.ripple,
        { transform: [{ scale: rippleScale(ripple2) }], opacity: rippleOpacity(ripple2) },
      ]} />

      {/* Ana kart */}
      <Pressable onPress={onExpand} style={s.card}>
        {/* Gradient zemin — control bar ile aynı palet */}
        <LinearGradient
          colors={['#2A3A58', '#243250', '#1A2540']}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Teal spotlight aksan */}
        <LinearGradient
          colors={['rgba(20,184,166,0.10)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.6, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Canlı gösterge */}
        <View style={s.liveIndicator}>
          <Animated.View style={[s.liveDot, { transform: [{ scale: pulseAnim }] }]} />
          <Text style={s.liveText}>CANLI</Text>
        </View>

        {/* Oda bilgisi */}
        <View style={s.info}>
          <Text style={s.roomName} numberOfLines={1}>{room.name}</Text>
          <View style={s.metaRow}>
            <Ionicons name="person" size={9} color="#94A3B8" style={s.iconShadow} />
            <Text style={s.metaText}>{room.hostName}</Text>
            <Text style={s.metaDot}>·</Text>
            <Ionicons name="people" size={9} color="#94A3B8" style={s.iconShadow} />
            <Text style={s.metaText}>{room.viewerCount}</Text>
          </View>
        </View>

        {/* Mic + Kapat */}
        <View style={s.actions}>
          <View style={[s.micBadge, room.isMicOn && s.micOn]}>
            <Ionicons
              name={room.isMicOn ? 'mic' : 'mic-off'}
              size={13}
              color={room.isMicOn ? '#14B8A6' : '#64748B'}
              style={s.iconShadow}
            />
          </View>
          <Pressable onPress={handleClose} style={s.closeBtn} hitSlop={12}>
            <Ionicons name="close" size={14} color="#EF4444" />
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 999,
    elevation: 999,
    alignItems: 'center',
  },
  ripple: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(20,184,166,0.3)',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 22,
    overflow: 'hidden',
    // ★ Control bar ile aynı border
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    gap: 8,
    // ★ Shadow — premium floating his
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 14,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239,68,68,0.12)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
  },
  liveDot: {
    width: 5, height: 5, borderRadius: 2.5,
    backgroundColor: '#EF4444',
  },
  liveText: {
    fontSize: 8, fontWeight: '800', color: '#EF4444',
    letterSpacing: 0.6,
  },
  info: {
    flex: 1,
  },
  roomName: {
    fontSize: 12, fontWeight: '700', color: '#F1F5F9',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  metaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2,
  },
  metaText: {
    fontSize: 9, color: '#94A3B8', fontWeight: '600',
  },
  metaDot: {
    fontSize: 9, color: '#64748B', marginHorizontal: 1,
  },
  iconShadow: {
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  actions: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  micBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },
  micOn: {
    backgroundColor: 'rgba(20,184,166,0.12)',
    borderColor: 'rgba(20,184,166,0.3)',
  },
  closeBtn: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
});
