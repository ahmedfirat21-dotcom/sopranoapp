/**
 * SopranoChat — Mini Oda Kartı (Floating PiP)
 * Oda küçültüldüğünde tüm ekranlarda altta görünen kompakt canlı kart.
 * ★ Yayılma (ripple) animasyonu ile "aktif oda" hissi.
 */
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: W } = Dimensions.get('window');

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

export default function MiniRoomCard({ room, onExpand, onClose }: MiniRoomCardProps) {
  const insets = useSafeAreaInsets();
  const slideIn = useRef(new Animated.Value(80)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ripple1 = useRef(new Animated.Value(0)).current;
  const ripple2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Giriş animasyonu
    Animated.spring(slideIn, { toValue: 0, friction: 10, tension: 80, useNativeDriver: true }).start();

    // Canlı gösterge nabız
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();

    // Yayılma (ripple) animasyonları — canlı olduğunu gösterir
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

  // Ripple interpolations
  const rippleScale = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
  const rippleOpacity = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 0.15, 0] });

  return (
    <Animated.View style={[
      s.container,
      {
        bottom: Math.max(insets.bottom, 8) + 72, // Tab bar üstünde
        transform: [{ translateY: slideIn }],
      },
    ]}>
      {/* Yayılma (ripple) halkaları — canlı oda efekti */}
      <Animated.View style={[
        s.ripple,
        {
          transform: [{ scale: rippleScale(ripple1) }],
          opacity: rippleOpacity(ripple1),
        },
      ]} />
      <Animated.View style={[
        s.ripple,
        {
          transform: [{ scale: rippleScale(ripple2) }],
          opacity: rippleOpacity(ripple2),
        },
      ]} />

      {/* Ana kart */}
      <TouchableOpacity activeOpacity={0.85} onPress={onExpand} style={s.card}>
        {/* Canlı gösterge */}
        <View style={s.liveIndicator}>
          <Animated.View style={[s.liveDot, { transform: [{ scale: pulseAnim }] }]} />
          <Text style={s.liveText}>CANLI</Text>
        </View>

        {/* Oda bilgisi — tek satır */}
        <View style={s.info}>
          <Text style={s.roomName} numberOfLines={1}>{room.name}</Text>
          <View style={s.metaRow}>
            <Ionicons name="person" size={9} color="#94A3B8" />
            <Text style={s.metaText}>{room.hostName}</Text>
            <Text style={s.metaDot}>·</Text>
            <Ionicons name="people" size={9} color="#94A3B8" />
            <Text style={s.metaText}>{room.viewerCount}</Text>
          </View>
        </View>

        {/* Mic + Kapat */}
        <View style={s.actions}>
          <View style={[s.micBadge, room.isMicOn && s.micOn]}>
            <Ionicons
              name={room.isMicOn ? 'mic' : 'mic-off'}
              size={12}
              color={room.isMicOn ? '#14B8A6' : '#64748B'}
            />
          </View>
          <TouchableOpacity onPress={handleClose} style={s.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={14} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const CARD_BG = '#1a2636'; // Tema uyumlu koyu ton (lacivert değil)

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20, right: 20,
    zIndex: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Ripple halkaları
  ripple: {
    position: 'absolute',
    left: 0, right: 0,
    top: 0, bottom: 0,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(20,184,166,0.4)',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.15)',
    gap: 8,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(239,68,68,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
  },
  liveDot: {
    width: 5, height: 5, borderRadius: 2.5,
    backgroundColor: '#EF4444',
  },
  liveText: {
    fontSize: 8, fontWeight: '800', color: '#EF4444',
    letterSpacing: 0.5,
  },
  info: {
    flex: 1,
  },
  roomName: {
    fontSize: 12, fontWeight: '700', color: '#F1F5F9',
    letterSpacing: 0.2,
  },
  metaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 1,
  },
  metaText: {
    fontSize: 9, color: '#94A3B8',
  },
  metaDot: {
    fontSize: 9, color: '#64748B', marginHorizontal: 1,
  },
  actions: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  micBadge: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  micOn: {
    backgroundColor: 'rgba(20,184,166,0.1)',
    borderColor: 'rgba(20,184,166,0.25)',
  },
  closeBtn: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
});
