/**
 * SopranoChat — Oda Kartı Skeleton Loader
 * ═══════════════════════════════════════════════════════════════════
 * Ana sayfada odalar yüklenirken BigLiveRoomCard boyutlarında
 * shimmer placeholder gösterir.
 *
 * ★ v1.7.13.143 (22 May 2026): Yeniden yazıldı —
 *   Sorunlar: (1) çok soluk/hayalet gibi, (2) ShimmerOverlay her
 *   placeholder'a ayrı uygulanıyordu → clip bozuk + perf yükü.
 *   Çözüm: Tek kart-seviye shimmer + daha yoğun arka plan + pulse
 *   opacity animasyonu (shimmer yerine) = temiz, hızlı, net.
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_W } = Dimensions.get('window');

interface Props {
  count?: number;
  style?: any;
}

export default function RoomCardSkeleton({ count = 3, style }: Props) {
  const rows = useMemo(() => Array.from({ length: count }), [count]);

  return (
    <View style={[styles.wrap, style]}>
      {rows.map((_, i) => (
        <SkeletonCard key={i} delay={i * 100} />
      ))}
    </View>
  );
}

function SkeletonCard({ delay }: { delay: number }) {
  // ★ 1) Fade-in: kart sahneye yumuşak girer
  const fadeIn = useRef(new Animated.Value(0)).current;
  // ★ 2) Pulse: tüm placeholder'lar senkron nefes alır (0.35 ↔ 0.75)
  const pulse = useRef(new Animated.Value(0.35)).current;
  // ★ 3) Shimmer: tek kart-seviye yatay ışık geçişi
  const shimmerX = useRef(new Animated.Value(-SCREEN_W)).current;

  useEffect(() => {
    // Fade-in
    const fadeAnim = Animated.sequence([
      Animated.delay(delay),
      Animated.timing(fadeIn, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]);
    fadeAnim.start();

    // Pulse (sürekli)
    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.75, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 900, useNativeDriver: true }),
      ])
    );
    pulseAnim.start();

    // Shimmer sweep (sürekli, 2.4s döngü, 800ms bekleme)
    const shimmerAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerX, {
          toValue: SCREEN_W,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.delay(800),
        Animated.timing(shimmerX, {
          toValue: -SCREEN_W,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    shimmerAnim.start();

    return () => {
      fadeAnim.stop();
      pulseAnim.stop();
      shimmerAnim.stop();
    };
  }, []);

  return (
    <Animated.View style={[styles.card, { opacity: fadeIn }]}>
      {/* Kart arka plan gradient */}
      <LinearGradient
        colors={['rgba(51,65,85,0.55)', 'rgba(30,41,59,0.65)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Tek shimmer sweep — kart seviyesinde */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { transform: [{ translateX: shimmerX }] }]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.07)', 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0.07)', 'transparent']}
          locations={[0, 0.3, 0.5, 0.7, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[StyleSheet.absoluteFillObject, { width: SCREEN_W * 0.7 }]}
        />
      </Animated.View>

      {/* Üst satır: Canlı badge + kategori pill */}
      <Animated.View style={[styles.topRow, { opacity: pulse }]}>
        <View style={styles.livePill} />
        <View style={[styles.categoryPill, { width: 52 }]} />
      </Animated.View>

      {/* Başlık satırı */}
      <Animated.View style={{ opacity: pulse }}>
        <View style={[styles.bar, { width: '72%', height: 15, marginTop: 20 }]} />
        <View style={[styles.bar, { width: '45%', height: 11, marginTop: 8 }]} />
      </Animated.View>

      {/* Alt satır: avatar + isim + katıl butonu */}
      <Animated.View style={[styles.bottomRow, { opacity: pulse }]}>
        <View style={styles.avatar} />
        <View style={{ flex: 1, gap: 6 }}>
          <View style={[styles.bar, { width: '40%', height: 10 }]} />
          <View style={[styles.bar, { width: '25%', height: 8 }]} />
        </View>
        <View style={styles.joinBtn} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 14,
    gap: 14,
  },
  card: {
    height: 170,
    borderRadius: 18,
    backgroundColor: 'rgba(30,41,59,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    overflow: 'hidden',
    padding: 16,
    justifyContent: 'space-between',
    // Hafif gölge — kartı arka plandan ayırır
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  topRow: {
    flexDirection: 'row',
    gap: 8,
  },
  livePill: {
    width: 48,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.20)',
  },
  categoryPill: {
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(148,163,184,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.08)',
  },
  bar: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(148,163,184,0.15)',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(148,163,184,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.10)',
  },
  joinBtn: {
    width: 82,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(20,184,166,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.20)',
  },
});
