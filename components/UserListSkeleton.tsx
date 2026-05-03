/**
 * SopranoChat — Kullanıcı Listesi Skeleton Loader
 * ═══════════════════════════════════════════════════════════════════
 * v107.20 (2 May 2026) — AppLoader (sync icon) yerine kullanıcı listelerinde
 * gösterilen shimmer placeholder. Takip listesi, arkadaş listesi, arama
 * sonucu, davet listesi gibi her yerde kullanılabilir.
 *
 * Görsel:
 *   - 3 satır placeholder (default)
 *   - Avatar circle (40px) + 2 metin çubuğu + buton placeholder (opsiyonel)
 *   - Shimmer LinearGradient soldan sağa kayan ışık şeridi (1500ms loop)
 *   - Android-safe (shadow yok, sadece gradient)
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { View, Animated, StyleSheet, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_W } = Dimensions.get('window');

interface Props {
  /** Kaç satır placeholder gösterilir — default 3 */
  count?: number;
  /** Sağda "Takip et / Arkadaş ekle" buton placeholder gösterilsin mi — default true */
  showAction?: boolean;
  /** Üst/alt boşluk için containerStyle override */
  style?: any;
}

export default function UserListSkeleton({ count = 3, showAction = true, style }: Props) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const rows = useMemo(() => Array.from({ length: count }), [count]);

  return (
    <View style={[styles.wrap, style]}>
      {rows.map((_, i) => (
        <SkeletonRow key={i} shimmer={shimmer} showAction={showAction} delay={i * 100} />
      ))}
    </View>
  );
}

function SkeletonRow({ shimmer, showAction, delay }: {
  shimmer: Animated.Value;
  showAction: boolean;
  delay: number;
}) {
  // Stagger için her satır biraz gecikmeli görünür (subtle fade-in)
  const fadeIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(fadeIn, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.row, { opacity: fadeIn }]}>
      {/* Avatar circle */}
      <View style={styles.avatar}>
        <ShimmerOverlay shimmer={shimmer} />
      </View>
      {/* Metin satırları */}
      <View style={styles.textWrap}>
        <View style={[styles.bar, { width: '65%' }]}>
          <ShimmerOverlay shimmer={shimmer} />
        </View>
        <View style={[styles.bar, { width: '38%', height: 8, marginTop: 8 }]}>
          <ShimmerOverlay shimmer={shimmer} />
        </View>
      </View>
      {/* Action buton placeholder */}
      {showAction && (
        <View style={styles.action}>
          <ShimmerOverlay shimmer={shimmer} />
        </View>
      )}
    </Animated.View>
  );
}

/** Shimmer overlay — soldan sağa kayan ışık şeridi (LinearGradient) */
function ShimmerOverlay({ shimmer }: { shimmer: Animated.Value }) {
  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_W * 0.6, SCREEN_W * 0.6],
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        { transform: [{ translateX }] },
      ]}
    >
      <LinearGradient
        colors={['transparent', 'rgba(255,255,255,0.07)', 'transparent']}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  textWrap: {
    flex: 1,
    gap: 0,
  },
  bar: {
    height: 11,
    borderRadius: 5.5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  action: {
    width: 80,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(20,184,166,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.20)',
    overflow: 'hidden',
  },
});
