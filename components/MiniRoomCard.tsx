/**
 * SopranoChat — Mini Oda Kartı (Floating PiP)
 * Oda küçültüldüğünde tüm ekranlarda altta görünen canlı mini kart.
 */
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions,
  PanResponder
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: W } = Dimensions.get('window');

const COLORS = {
  primary: '#5CE1E6',
  bg: 'rgba(12,16,30,0.95)',
  border: 'rgba(92,225,230,0.2)',
  text: '#F8FAFC',
  text2: '#94A3B8',
};

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
  const slideIn = useRef(new Animated.Value(100)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Giriş animasyonu
    Animated.spring(slideIn, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }).start();

    // Canlı gösterge nabız animasyonu
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handleClose = () => {
    Animated.timing(slideIn, { toValue: 150, duration: 200, useNativeDriver: true }).start(() => {
      onClose();
    });
  };

  return (
    <Animated.View style={[
      s.container,
      { 
        bottom: Math.max(insets.bottom, 8) + 60, // Tab bar üstünde
        transform: [{ translateY: slideIn }] 
      }
    ]}>
      <TouchableOpacity activeOpacity={0.9} onPress={onExpand} style={s.card}>
        <LinearGradient
          colors={['rgba(16,22,40,0.98)', 'rgba(10,14,28,0.98)']}
          style={s.gradient}
        >
          {/* Canlı gösterge */}
          <View style={s.liveIndicator}>
            <Animated.View style={[s.liveDot, { transform: [{ scale: pulseAnim }] }]} />
            <Text style={s.liveText}>CANLI</Text>
          </View>

          {/* Oda bilgisi */}
          <View style={s.info}>
            <Text style={s.roomName} numberOfLines={1}>{room.name}</Text>
            <View style={s.metaRow}>
              <Ionicons name="person" size={10} color={COLORS.text2} />
              <Text style={s.metaText}>{room.hostName}</Text>
              <Text style={s.metaDot}>·</Text>
              <Ionicons name="people" size={10} color={COLORS.text2} />
              <Text style={s.metaText}>{room.viewerCount}</Text>
            </View>
          </View>

          {/* Sağ taraf: Mic durumu + Kapat */}
          <View style={s.actions}>
            <View style={[s.micBadge, room.isMicOn && s.micBadgeOn]}>
              <Ionicons 
                name={room.isMicOn ? 'mic' : 'mic-off'} 
                size={14} 
                color={room.isMicOn ? COLORS.primary : '#64748B'} 
              />
            </View>
            
            <TouchableOpacity onPress={handleClose} style={s.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={16} color="#EF4444" />
            </TouchableOpacity>
          </View>

          {/* Alt kenar ışığı */}
          <LinearGradient
            colors={['transparent', 'rgba(92,225,230,0.15)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.bottomGlow}
          />
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12, right: 12,
    zIndex: 999,
    elevation: 999,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 20,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239,68,68,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  liveDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  liveText: {
    fontSize: 9, fontWeight: '800', color: '#EF4444',
    letterSpacing: 0.5,
  },
  info: {
    flex: 1,
  },
  roomName: {
    fontSize: 13, fontWeight: '700', color: COLORS.text,
    letterSpacing: 0.2,
  },
  metaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2,
  },
  metaText: {
    fontSize: 10, color: COLORS.text2,
  },
  metaDot: {
    fontSize: 10, color: COLORS.text2, marginHorizontal: 1,
  },
  actions: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  micBadge: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  micBadgeOn: {
    backgroundColor: 'rgba(92,225,230,0.12)',
    borderColor: 'rgba(92,225,230,0.3)',
  },
  closeBtn: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  bottomGlow: {
    position: 'absolute',
    bottom: 0, left: 20, right: 20,
    height: 1,
  },
});
