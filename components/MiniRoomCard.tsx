/**
 * SopranoChat — Mini Oda Kartı (Floating PiP)
 * ★ 2026-04-24 v3: Drag-to-reposition + snap-to-edge.
 *   - Sürükle → dikey eksende serbest hareket (translateY offset)
 *   - Bırak → en yakın snap pozisyonuna spring animasyonuyla yapış
 *   - Tüm animasyonlar useNativeDriver: true (60fps garantisi)
 *   - Tab bar ile aynı genişlik & margin
 */
import React, { useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated,
  useWindowDimensions, PanResponder, Dimensions,
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

const BAR_MARGIN = 6;
const BAR_H = 60;
const CARD_H = 52;
const SCREEN_H = Dimensions.get('window').height;

export default function MiniRoomCard({ room, onExpand, onClose }: MiniRoomCardProps) {
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();

  // ═══ Animasyon değerleri (hepsi native driver uyumlu) ═══
  const slideIn = useRef(new Animated.Value(80)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ripple1 = useRef(new Animated.Value(0)).current;
  const ripple2 = useRef(new Animated.Value(0)).current;
  const dragScale = useRef(new Animated.Value(1)).current;

  // ★ Drag offset — translateY olarak (yukarı = negatif)
  //   bottom sabit kalır, sadece translateY ile pozisyon değişir
  //   → useNativeDriver: true kullanılabilir (layout prop animasyonu yok)
  const dragOffsetY = useRef(new Animated.Value(0)).current;
  const currentOffsetY = useRef(0);

  const cardWidth = Math.max(0, winW - BAR_MARGIN * 2 - (insets.left + insets.right));
  const bottomBase = Math.max(insets.bottom, 8) + BAR_H + 8; // Tab bar üstü (statik)

  // ★ Snap noktaları — translateY offset olarak (0 = tab bar üstü, negatif = yukarı)
  const snapOffsetBottom = 0;                                            // Default: tab bar üstü
  const snapOffsetMid = -(SCREEN_H * 0.4 - bottomBase);                 // Ekran ortası
  const snapOffsetTop = -(SCREEN_H - insets.top - 60 - CARD_H - bottomBase); // Header altı
  const snapOffsets = [snapOffsetBottom, snapOffsetMid, snapOffsetTop];

  // ★ PanResponder — dikey sürükleme
  const panResponder = useMemo(() => {
    let startOffsetY = 0;

    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 8,
      onPanResponderGrant: () => {
        startOffsetY = currentOffsetY.current;
        Animated.spring(dragScale, {
          toValue: 0.96, friction: 12, useNativeDriver: true,
        }).start();
      },
      onPanResponderMove: (_, gs) => {
        // dy pozitif = parmak aşağı → kart aşağı (translateY artar)
        const raw = startOffsetY + gs.dy;
        // Sınırla: tab bar üstünden aşağı inemesin, header üstüne çıkamasın
        const clamped = Math.max(snapOffsetTop, Math.min(snapOffsetBottom, raw));
        dragOffsetY.setValue(clamped);
      },
      onPanResponderRelease: (_, gs) => {
        Animated.spring(dragScale, {
          toValue: 1, friction: 8, tension: 120, useNativeDriver: true,
        }).start();

        const releaseOffset = Math.max(
          snapOffsetTop,
          Math.min(snapOffsetBottom, startOffsetY + gs.dy)
        );

        // ★ Velocity-based snap — hızlı fırlatma yöne göre atlar
        const vy = gs.vy;
        let target = releaseOffset;

        if (Math.abs(vy) > 0.5) {
          if (vy < 0) {
            // Yukarı fırlatma → bir üst snap (daha negatif offset)
            target = snapOffsets.filter(sp => sp < releaseOffset).sort((a, b) => b - a)[0]
              ?? snapOffsets[snapOffsets.length - 1];
          } else {
            // Aşağı fırlatma → bir alt snap (daha pozitif offset)
            target = snapOffsets.filter(sp => sp > releaseOffset).sort((a, b) => a - b)[0]
              ?? snapOffsets[0];
          }
        } else {
          // Yavaş bırakma → en yakın snap
          let minDist = Infinity;
          for (const sp of snapOffsets) {
            const dist = Math.abs(releaseOffset - sp);
            if (dist < minDist) { minDist = dist; target = sp; }
          }
        }

        currentOffsetY.current = target;
        Animated.spring(dragOffsetY, {
          toValue: target, friction: 10, tension: 100, useNativeDriver: true,
        }).start();
      },
    });
  }, [snapOffsetBottom, snapOffsetMid, snapOffsetTop]);

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
    r1.start(); r2.start();

    return () => { pulse.stop(); r1.stop(); r2.stop(); };
  }, []);

  const handleClose = () => {
    Animated.timing(slideIn, { toValue: 120, duration: 200, useNativeDriver: true }).start(() => {
      onClose();
    });
  };

  const rippleScaleFn = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const rippleOpacityFn = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.3, 0.12, 0] });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          bottom: bottomBase,
          width: cardWidth,
          transform: [
            { translateY: slideIn },
            { translateY: dragOffsetY },
            { scale: dragScale },
          ],
        },
      ]}
      {...panResponder.panHandlers}
    >
      {/* Ripple halkaları */}
      <Animated.View style={[
        styles.ripple,
        { transform: [{ scale: rippleScaleFn(ripple1) }], opacity: rippleOpacityFn(ripple1) },
      ]} />
      <Animated.View style={[
        styles.ripple,
        { transform: [{ scale: rippleScaleFn(ripple2) }], opacity: rippleOpacityFn(ripple2) },
      ]} />

      {/* Ana kart */}
      <Pressable onPress={onExpand} style={styles.card}>
        <LinearGradient
          colors={['#2A3A58', '#243250', '#1A2540']}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <LinearGradient
          colors={['rgba(20,184,166,0.10)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Canlı gösterge */}
        <View style={styles.liveIndicator}>
          <Animated.View style={[styles.liveDot, { transform: [{ scale: pulseAnim }] }]} />
          <Text style={styles.liveText}>CANLI</Text>
        </View>

        {/* Oda bilgisi */}
        <View style={styles.info}>
          <Text style={styles.roomName} numberOfLines={1}>{room.name}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="person" size={9} color="#94A3B8" style={styles.iconShadow} />
            <Text style={styles.metaText}>{room.hostName}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Ionicons name="people" size={9} color="#94A3B8" style={styles.iconShadow} />
            <Text style={styles.metaText}>{room.viewerCount}</Text>
          </View>
        </View>

        {/* Mic + Kapat */}
        <View style={styles.actions}>
          <View style={[styles.micBadge, room.isMicOn && styles.micOn]}>
            <Ionicons
              name={room.isMicOn ? 'mic' : 'mic-off'}
              size={13}
              color={room.isMicOn ? '#14B8A6' : '#64748B'}
              style={styles.iconShadow}
            />
          </View>
          <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={12}>
            <Ionicons name="close" size={14} color="#EF4444" />
          </Pressable>
        </View>
      </Pressable>

      {/* Drag indicator */}
      <View style={styles.dragHandle} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 14,
  },
  dragHandle: {
    width: 32,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginTop: 4,
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
  info: { flex: 1 },
  roomName: {
    fontSize: 12, fontWeight: '700', color: '#F1F5F9',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  metaText: { fontSize: 9, color: '#94A3B8', fontWeight: '600' },
  metaDot: { fontSize: 9, color: '#64748B', marginHorizontal: 1 },
  iconShadow: {
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
