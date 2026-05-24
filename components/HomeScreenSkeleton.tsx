/**
 * SopranoChat — Ana Sayfa Tam Skeleton Loader
 * ═══════════════════════════════════════════════════════════════════
 * Loading sırasında header, welcome banner, filtre bar ve oda kartları
 * için tutarlı skeleton gösterir.
 *
 * ★ v1.7.13.150 (22 May 2026): Eklendi —
 *   Önceki skeleton sadece 3 kart gösteriyordu, header ve bar yoktu.
 *   Şimdi tam sayfa skeleton: header + welcome + filtreler + kartlar.
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RoomCardSkeleton from './RoomCardSkeleton';

const { width: SCREEN_W } = Dimensions.get('window');

/** Pulse hook — 0.3 ↔ 0.7 arası nefes animasyonu */
function usePulse(delay = 0) {
  const pulse = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(pulse, { toValue: 0.7, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);
  return pulse;
}

export default function HomeScreenSkeleton() {
  const insets = useSafeAreaInsets();
  const pulse = usePulse();
  const pulseDelayed = usePulse(150);

  // Shimmer
  const shimmerX = useRef(new Animated.Value(-SCREEN_W)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerX, { toValue: SCREEN_W, duration: 1600, useNativeDriver: true }),
        Animated.delay(600),
        Animated.timing(shimmerX, { toValue: -SCREEN_W, duration: 0, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ═══ Header Skeleton ═══ */}
      <Animated.View style={[styles.header, { opacity: pulse }]}>
        {/* Logo placeholder */}
        <View style={styles.logoPlaceholder} />
        {/* Sağ ikonlar */}
        <View style={styles.headerIcons}>
          <View style={styles.iconCircle} />
          <View style={styles.iconCircle} />
          <View style={styles.iconCircle} />
        </View>
      </Animated.View>

      {/* Teal separator */}
      <View style={styles.separator} />

      {/* ═══ Welcome Banner Skeleton ═══ */}
      <Animated.View style={[styles.welcomeCard, { opacity: pulseDelayed }]}>
        <LinearGradient
          colors={['rgba(51,65,85,0.45)', 'rgba(30,41,59,0.55)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Shimmer */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { transform: [{ translateX: shimmerX }] }]}
        >
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0.06)', 'transparent']}
            locations={[0, 0.3, 0.5, 0.7, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[StyleSheet.absoluteFillObject, { width: SCREEN_W * 0.7 }]}
          />
        </Animated.View>
        <View style={styles.welcomeRow}>
          <View style={styles.avatarCircle} />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={[styles.bar, { width: '65%', height: 14 }]} />
            <View style={[styles.bar, { width: '40%', height: 10 }]} />
          </View>
          <View style={styles.createBtn} />
        </View>
      </Animated.View>

      {/* ═══ Filter Pills Skeleton ═══ */}
      <Animated.View style={[styles.filterRow, { opacity: pulse }]}>
        <View style={[styles.filterPill, { width: 55 }]} />
        <View style={[styles.filterPill, { width: 70 }]} />
        <View style={[styles.filterPill, { width: 60 }]} />
        <View style={[styles.filterPill, { width: 50 }]} />
        <View style={[styles.filterPill, { width: 65 }]} />
      </Animated.View>

      {/* ═══ Room Cards Skeleton ═══ */}
      <RoomCardSkeleton count={3} style={{ marginTop: 6 }} />

      {/* ═══ Tab Bar Skeleton ═══ */}
      <Animated.View style={[styles.tabBarSkeleton, { opacity: pulse }]}>
        <LinearGradient
          colors={['#2A3A58', '#243250', '#1A2540']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Teal üst çizgi */}
        <View style={styles.tabBarTopLine} />
        {/* 4 tab ikonu placeholder */}
        <View style={styles.tabBarIcons}>
          {[0, 1, 2, 3].map(i => (
            <View key={i} style={styles.tabBarIconWrap}>
              <View style={[styles.tabBarIcon, i === 0 && styles.tabBarIconActive]} />
              <View style={[styles.tabBarLabel, { width: i === 0 ? 36 : 28 + i * 4 }]} />
            </View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // ─── Header ───
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 52,
  },
  logoPlaceholder: {
    width: 130,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(148,163,184,0.15)',
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 14,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(148,163,184,0.12)',
  },
  separator: {
    height: 1.5,
    marginHorizontal: 40,
    backgroundColor: 'rgba(20,184,166,0.25)',
    borderRadius: 1,
  },

  // ─── Welcome Banner ───
  welcomeCard: {
    marginHorizontal: 14,
    marginTop: 14,
    height: 72,
    borderRadius: 16,
    backgroundColor: 'rgba(30,41,59,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.10)',
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(148,163,184,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.10)',
  },
  createBtn: {
    width: 90,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(20,184,166,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.20)',
  },

  // ─── Filter Pills ───
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    marginTop: 16,
    marginBottom: 8,
  },
  filterPill: {
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(148,163,184,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.08)',
  },

  // ─── Common ───
  bar: {
    borderRadius: 6,
    backgroundColor: 'rgba(148,163,184,0.15)',
  },

  // ─── Tab Bar Skeleton ───
  tabBarSkeleton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: '#1F2E48',
    overflow: 'hidden',
  },
  tabBarTopLine: {
    position: 'absolute',
    top: 0,
    left: '20%' as any,
    right: '20%' as any,
    height: 1.5,
    backgroundColor: 'rgba(20,184,166,0.35)',
    borderRadius: 1,
  },
  tabBarIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    flex: 1,
    paddingHorizontal: 20,
  },
  tabBarIconWrap: {
    alignItems: 'center',
    gap: 5,
  },
  tabBarIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(148,163,184,0.12)',
  },
  tabBarIconActive: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(20,184,166,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(20,184,166,0.25)',
  },
  tabBarLabel: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(148,163,184,0.10)',
  },
});
