/**
 * SopranoChat — Mini Oda Kartı (Floating PiP)
 * ★ 2026-04-24 v5: Expand-from-card animation.
 *   - Tıklanınca kart ekranı kaplayarak genişler → oda açılır
 *   - Sürükle + snap-to-edge (dikey hareket)
 *   - Ses aktifken: iç glow pulse + border teal
 */
import React, { useEffect, useRef, useMemo, useState } from 'react';
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
  isRoomMuted?: boolean;
}

interface MiniRoomCardProps {
  room: MinimizedRoom;
  onExpand: () => void;
  onClose: () => void;
  onMuteToggle?: () => void;
}

const BAR_MARGIN = 6;
const BAR_H = 60;
const CARD_H = 52;
const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;

export default function MiniRoomCard({ room, onExpand, onClose, onMuteToggle }: MiniRoomCardProps) {
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const [isExpanding, setIsExpanding] = useState(false);

  // ═══ Animasyon değerleri ═══
  const slideIn = useRef(new Animated.Value(80)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ripple1 = useRef(new Animated.Value(0)).current;
  const ripple2 = useRef(new Animated.Value(0)).current;
  const dragScale = useRef(new Animated.Value(1)).current;
  const dragOffsetY = useRef(new Animated.Value(0)).current;
  const currentOffsetY = useRef(0);

  // ★ Audio glow
  const audioGlow = useRef(new Animated.Value(0)).current;
  const audioGlowRef = useRef<Animated.CompositeAnimation | null>(null);

  // ★ Expand animation — karttan odaya geçiş
  const expandProgress = useRef(new Animated.Value(0)).current;

  const cardWidth = Math.max(0, winW - BAR_MARGIN * 2 - (insets.left + insets.right));
  const bottomBase = Math.max(insets.bottom, 8) + BAR_H + 8;

  // Snap noktaları
  const snapOffsetBottom = 0;
  const snapOffsetMid = -(SCREEN_H * 0.4 - bottomBase);
  const snapOffsetTop = -(SCREEN_H - insets.top - 60 - CARD_H - bottomBase);
  const snapOffsets = [snapOffsetBottom, snapOffsetMid, snapOffsetTop];

  // Audio glow animasyonu
  useEffect(() => {
    if (!room.isRoomMuted) {
      const glow = Animated.loop(
        Animated.sequence([
          Animated.timing(audioGlow, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(audioGlow, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ])
      );
      audioGlowRef.current = glow;
      glow.start();
      return () => { glow.stop(); };
    } else {
      audioGlowRef.current?.stop();
      audioGlow.setValue(0);
    }
  }, [room.isRoomMuted]);

  // PanResponder
  const panResponder = useMemo(() => {
    let startOffsetY = 0;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => !isExpanding && Math.abs(gs.dy) > 8,
      onPanResponderGrant: () => {
        startOffsetY = currentOffsetY.current;
        Animated.spring(dragScale, { toValue: 0.96, friction: 12, useNativeDriver: true }).start();
      },
      onPanResponderMove: (_, gs) => {
        const clamped = Math.max(snapOffsetTop, Math.min(snapOffsetBottom, startOffsetY + gs.dy));
        dragOffsetY.setValue(clamped);
      },
      onPanResponderRelease: (_, gs) => {
        Animated.spring(dragScale, { toValue: 1, friction: 8, tension: 120, useNativeDriver: true }).start();
        const releaseOffset = Math.max(snapOffsetTop, Math.min(snapOffsetBottom, startOffsetY + gs.dy));
        const vy = gs.vy;
        let target = releaseOffset;

        if (Math.abs(vy) > 0.5) {
          if (vy < 0) {
            target = snapOffsets.filter(sp => sp < releaseOffset).sort((a, b) => b - a)[0] ?? snapOffsets[snapOffsets.length - 1];
          } else {
            target = snapOffsets.filter(sp => sp > releaseOffset).sort((a, b) => a - b)[0] ?? snapOffsets[0];
          }
        } else {
          let minDist = Infinity;
          for (const sp of snapOffsets) {
            const dist = Math.abs(releaseOffset - sp);
            if (dist < minDist) { minDist = dist; target = sp; }
          }
        }

        currentOffsetY.current = target;
        Animated.spring(dragOffsetY, { toValue: target, friction: 10, tension: 100, useNativeDriver: true }).start();
      },
    });
  }, [snapOffsetBottom, snapOffsetMid, snapOffsetTop, isExpanding]);

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
    Animated.timing(slideIn, { toValue: 120, duration: 200, useNativeDriver: true }).start(() => onClose());
  };

  // ★ Expand — karttan oda doğuyor
  const handleExpand = () => {
    if (isExpanding) return;
    setIsExpanding(true);

    Animated.timing(expandProgress, {
      toValue: 1,
      duration: 350,
      useNativeDriver: false, // layout props (width, height, position) animate ediyor
    }).start(() => {
      // Animasyon bitince navigate
      onExpand();
    });
  };

  const rippleScaleFn = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const rippleOpacityFn = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.3, 0.12, 0] });

  const audioGlowOpacity = audioGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.7],
  });

  const isAudioActive = !room.isRoomMuted;

  // ★ Expand interpolations — karttan tam ekrana
  const expandWidth = expandProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [cardWidth, SCREEN_W],
  });
  const expandHeight = expandProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [CARD_H, SCREEN_H],
  });
  const expandBottom = expandProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [bottomBase, 0],
  });
  const expandBorderRadius = expandProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [22, 0],
  });
  const expandContentOpacity = expandProgress.interpolate({
    inputRange: [0, 0.3],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const expandAlignSelf = expandProgress.interpolate({
    inputRange: [0, 0.01],
    outputRange: [0, 0], // dummy — alignSelf handled differently
  });

  // Expanding modunda container farklı style kullanır
  if (isExpanding) {
    return (
      <Animated.View
        style={[
          styles.expandingContainer,
          {
            bottom: expandBottom,
            width: expandWidth,
            height: expandHeight,
            borderRadius: expandBorderRadius,
            left: expandProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [(SCREEN_W - cardWidth) / 2, 0],
            }),
          },
        ]}
      >
        {/* Genişleme sırasında oda arka plan gradienti */}
        <LinearGradient
          colors={['#0F1929', '#162236', '#0F1929']}
          style={StyleSheet.absoluteFillObject}
        />
        {/* İçerik fade-out */}
        <Animated.View style={[styles.expandingContent, { opacity: expandContentOpacity }]}>
          <View style={styles.liveIndicator}>
            <View style={[styles.liveDot, { backgroundColor: '#EF4444' }]} />
            <Text style={styles.liveText}>CANLI</Text>
          </View>
          <View style={styles.info}>
            <Text style={styles.roomName} numberOfLines={1}>{room.name}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>{room.hostName}</Text>
            </View>
          </View>
        </Animated.View>
        {/* Oda adı expand sırasında görünür kalır */}
        <Animated.View style={{
          position: 'absolute',
          top: expandProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [CARD_H / 2 - 8, 40],
          }),
          left: 20,
          opacity: expandProgress.interpolate({
            inputRange: [0, 0.4, 0.8],
            outputRange: [0, 0, 1],
          }),
        }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#F1F5F9' }}>{room.name}</Text>
          <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{room.hostName}</Text>
        </Animated.View>
      </Animated.View>
    );
  }

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
      <Pressable onPress={handleExpand} style={[
        styles.card,
        isAudioActive && styles.cardAudioActive,
      ]}>
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
        {/* İç glow overlay */}
        {isAudioActive && (
          <Animated.View style={[
            styles.innerGlow,
            { opacity: audioGlowOpacity },
          ]} pointerEvents="none" />
        )}

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

        {/* Ses kontrol butonları */}
        <View style={styles.actions}>
          {onMuteToggle && (
            <Pressable
              onPress={onMuteToggle}
              style={[styles.actionBadge, isAudioActive ? styles.speakerOn : styles.speakerOff]}
              hitSlop={8}
            >
              <Ionicons
                name={isAudioActive ? 'volume-high' : 'volume-mute'}
                size={13}
                color={isAudioActive ? '#14B8A6' : '#EF4444'}
                style={styles.iconShadow}
              />
              {isAudioActive && (
                <View style={styles.soundWaves}>
                  <Animated.View style={[styles.wave, styles.wave1, { opacity: audioGlow }]} />
                  <Animated.View style={[styles.wave, styles.wave2, {
                    opacity: audioGlow.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0, 0.8, 0.3],
                    }),
                  }]} />
                </View>
              )}
            </Pressable>
          )}

          <View style={[styles.actionBadge, room.isMicOn && styles.micOn]}>
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
  // ★ Expand modunda — tam ekrana genişleyen container
  expandingContainer: {
    position: 'absolute',
    zIndex: 9999,
    elevation: 9999,
    overflow: 'hidden',
  },
  expandingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  // Ses aktifken card border teal
  cardAudioActive: {
    borderColor: 'rgba(20,184,166,0.6)',
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
  },
  innerGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: 'rgba(20,184,166,0.5)',
    backgroundColor: 'rgba(20,184,166,0.04)',
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
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 14,
  },
  liveIndicator: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(239,68,68,0.12)',
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
  },
  liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#EF4444' },
  liveText: { fontSize: 8, fontWeight: '800', color: '#EF4444', letterSpacing: 0.6 },
  info: { flex: 1 },
  roomName: {
    fontSize: 12, fontWeight: '700', color: '#F1F5F9', letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  metaText: { fontSize: 9, color: '#94A3B8', fontWeight: '600' },
  metaDot: { fontSize: 9, color: '#64748B', marginHorizontal: 1 },
  iconShadow: {
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  micOn: {
    backgroundColor: 'rgba(20,184,166,0.12)',
    borderColor: 'rgba(20,184,166,0.3)',
  },
  speakerOn: {
    backgroundColor: 'rgba(20,184,166,0.12)',
    borderColor: 'rgba(20,184,166,0.3)',
  },
  speakerOff: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderColor: 'rgba(239,68,68,0.25)',
  },
  soundWaves: {
    position: 'absolute',
    right: -3, top: 2, bottom: 2,
    width: 6,
    justifyContent: 'center',
    gap: 2,
  },
  wave: {
    width: 2, borderRadius: 1,
    backgroundColor: '#14B8A6',
  },
  wave1: { height: 6 },
  wave2: { height: 4 },
  closeBtn: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
});
