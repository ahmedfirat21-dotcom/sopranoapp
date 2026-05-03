/**
 * SopranoChat — Mini Oda Kartı (Floating PiP)
 * ★ 2026-04-24 v6: Temiz expand-to-room geçişi.
 *   - Tıklanınca: kart scale-up + fade-out (native driver, 60fps)
 *   - Room slide_from_bottom ile arkasından gelir
 *   - Sürükle + snap, ses glow, mute toggle korunur
 */
import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated,
  useWindowDimensions, PanResponder, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSegments } from 'expo-router';

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
  /** ★ 2026-04-24: Mic aç/kapat — minimize edilmiş kartta bile kullanıcı mic'i toggle edebilsin */
  onMicToggle?: () => void;
}

const BAR_MARGIN = 6;
const BAR_H = 60;
const CARD_H = 52;
const SCREEN_H = Dimensions.get('window').height;

export default function MiniRoomCard({ room, onExpand, onClose, onMuteToggle, onMicToggle }: MiniRoomCardProps) {
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const expandingRef = useRef(false);
  // ★ 2026-04-26 PERF: isTabBarVisible artık kendi içinde hesaplanıyor.
  //   Root layout'tan prop olarak gelmesi, useSegments()'in root layout'u
  //   her navigasyonda re-render etmesine yol açıyordu (1466 satırlık bileşen!).
  //   Şimdi sadece bu küçük bileşen re-render oluyor.
  const segments = useSegments();
  const isTabBarVisible = segments[0] === '(tabs)';

  // ═══ Animasyon değerleri (tümü native driver) ═══
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

  // ★ Expand: scale-up + fade-out (native driver — 60fps garantili)
  const expandScale = useRef(new Animated.Value(1)).current;
  const expandOpacity = useRef(new Animated.Value(1)).current;

  const cardWidth = Math.max(0, winW - BAR_MARGIN * 2 - (insets.left + insets.right));
  // ★ 2026-04-24: Tab bar varsa BAR_H+22 offset, yoksa (chat/user gibi stack'te) sadece safe area + 12px.
  const bottomBase = isTabBarVisible
    ? Math.max(insets.bottom, 14) + BAR_H + 22
    : Math.max(insets.bottom, 14) + 12;

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
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        !expandingRef.current &&
        Math.abs(gs.dy) > 14 &&
        Math.abs(gs.dy) > Math.abs(gs.dx) * 1.3,
      onMoveShouldSetPanResponderCapture: () => false,
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

  const handleClose = useCallback(() => {
    Animated.timing(slideIn, { toValue: 120, duration: 200, useNativeDriver: true }).start(() => onClose());
  }, [onClose]);

  // ★ Expand — kart scale-up + fade-out → navigate (tümü native driver)
  const handleExpand = useCallback(() => {
    if (expandingRef.current) return;
    expandingRef.current = true;

    // Kart büyür ve solarak kaybolur → arkasında room slide_from_bottom ile yükselir
    Animated.parallel([
      Animated.timing(expandScale, { toValue: 1.15, duration: 250, useNativeDriver: true }),
      Animated.timing(expandOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      onExpand();
    });
  }, [onExpand]);

  const rippleScaleFn = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const rippleOpacityFn = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.3, 0.12, 0] });

  const audioGlowOpacity = audioGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.7],
  });

  const isAudioActive = !room.isRoomMuted;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          bottom: bottomBase,
          width: cardWidth,
          opacity: expandOpacity,
          transform: [
            { translateY: slideIn },
            { translateY: dragOffsetY },
            { scale: Animated.multiply(dragScale, expandScale) },
          ],
        },
      ]}
      {...panResponder.panHandlers}
    >
      {/* Ripple halkaları */}
      <Animated.View pointerEvents="none" style={[
        styles.ripple,
        { transform: [{ scale: rippleScaleFn(ripple1) }], opacity: rippleOpacityFn(ripple1) },
      ]} />
      <Animated.View pointerEvents="none" style={[
        styles.ripple,
        { transform: [{ scale: rippleScaleFn(ripple2) }], opacity: rippleOpacityFn(ripple2) },
      ]} />

      {/* ★ 2026-04-24: Eşit dağılmış teal blur-glow — 3 katman decreasing opacity outward.
          Card width/height kadar alan kaplar, kartın arkasına oturur; tüm kenarlara simetrik yayılır. */}
      {isAudioActive && (
        <>
          <Animated.View
            style={[styles.audioHalo1, { opacity: audioGlow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.6] }) }]}
            pointerEvents="none"
          />
          <Animated.View
            style={[styles.audioHalo2, { opacity: audioGlow.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.8] }) }]}
            pointerEvents="none"
          />
          <View style={styles.audioHalo3} pointerEvents="none" />
        </>
      )}

      {/* Ana kart — outer Pressable kaldırıldı; expand sadece sol+orta alana sınırlı.
          Aksi halde inner Pressable (mute/mic/close) outer onPress yutuyordu. */}
      <View style={[
        styles.card,
        isAudioActive && styles.cardAudioActive,
      ]}>
        <LinearGradient
          colors={['#2A3A58', '#243250', '#1A2540']}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(20,184,166,0.10)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        {/* İç glow overlay */}
        {isAudioActive && (
          <Animated.View style={[
            styles.innerGlow,
            { opacity: audioGlowOpacity },
          ]} pointerEvents="none" />
        )}

        {/* ★ Expand zone — CANLI badge + isim alanı; tap → odayı tam ekran aç */}
        <Pressable onPress={handleExpand} style={styles.expandZone} hitSlop={4}>
          <View style={styles.liveIndicator}>
            <Animated.View style={[styles.liveDot, { transform: [{ scale: pulseAnim }] }]} />
            <Text style={styles.liveText}>CANLI</Text>
          </View>

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
        </Pressable>

        {/* Ses kontrol butonları — bağımsız Pressable'lar, outer onPress yok */}
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
            </Pressable>
          )}

          <Pressable
            onPress={onMicToggle}
            disabled={!onMicToggle}
            style={[styles.actionBadge, room.isMicOn && styles.micOn]}
            hitSlop={8}
          >
            <Ionicons
              name={room.isMicOn ? 'mic' : 'mic-off'}
              size={13}
              color={room.isMicOn ? '#14B8A6' : '#EF4444'}
              style={styles.iconShadow}
            />
          </Pressable>

          <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={12}>
            <Ionicons name="close" size={14} color="#EF4444" />
          </Pressable>
        </View>
      </View>
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
    overflow: 'visible', // ★ halo dış kenarlara taşsın
  },
  cardAudioActive: {
    borderColor: 'rgba(20,184,166,0.85)',
    borderWidth: 1.5,
    // iOS için yumuşak symmetric glow — offset 0,0 orta yayılım
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    // ★ Android'de elevation aşağı gölge yaratıyor — aşağıdaki audioHalo layer'ı
    //   tüm kenarlarda eşit blur-glow sağlar, elevation gerekmez.
    elevation: 0,
  },
  // ★ 2026-04-24: Eşit dağılmış blur-glow halka (Android + iOS tüm platformlarda eşit)
  audioHalo1: {
    position: 'absolute',
    top: -14, left: -14, right: -14, bottom: -14,
    borderRadius: 36,
    backgroundColor: 'rgba(20,184,166,0.08)',
  },
  audioHalo2: {
    position: 'absolute',
    top: -8, left: -8, right: -8, bottom: -8,
    borderRadius: 30,
    backgroundColor: 'rgba(20,184,166,0.14)',
  },
  audioHalo3: {
    position: 'absolute',
    top: -3, left: -3, right: -3, bottom: -3,
    borderRadius: 25,
    backgroundColor: 'rgba(20,184,166,0.22)',
  },
  innerGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: 'rgba(20,184,166,0.65)',
    backgroundColor: 'rgba(20,184,166,0.06)',
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
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  // ★ Expand zone — liveIndicator + info wrapper, sadece bu alan handleExpand tetikler
  expandZone: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
