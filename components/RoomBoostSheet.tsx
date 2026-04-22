/**
 * SopranoChat — Oda Boost Sheet
 * ═══════════════════════════════════════════════════
 * Premium bottom sheet — BoostPickerSheet (profil) kalitesinde ama oda temalı (amber/orange).
 * 2026-04-21: Basit Alert yerine modern seçim kartları + özet + CTA.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal,
  ActivityIndicator, Animated, PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const SHEET_H = 420;

export type RoomBoostTier = {
  id: string;
  label: string;
  sublabel: string;
  icon: string;
  durationHours: 1 | 6;
  cost: number;
  accent: string;
  popular?: boolean;
};

export const ROOM_BOOST_TIERS: RoomBoostTier[] = [
  { id: 'quick',    label: 'Hızlı Boost',    sublabel: '1 saat üst sıra',  icon: 'flash',       durationHours: 1, cost: 50,  accent: '#FB923C' },
  { id: 'extended', label: 'Uzun Boost',     sublabel: '6 saat üst sıra',  icon: 'trending-up', durationHours: 6, cost: 200, accent: '#F59E0B', popular: true },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onBoost: (tier: RoomBoostTier) => Promise<void>;
  currentSP: number;
  roomName?: string;
};

export default function RoomBoostSheet({ visible, onClose, onBoost, currentSP, roomName }: Props) {
  const [selectedId, setSelectedId] = useState<string>('extended');
  const [loading, setLoading] = useState(false);

  const translateY = useRef(new Animated.Value(SHEET_H)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 260 }),
        Animated.timing(overlayOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: SHEET_H, duration: 250, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      translateY.setValue(SHEET_H);
      onClose();
    });
  };

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => g.dy > 5,
    onPanResponderMove: (_, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 80 || g.vy > 0.5) dismiss();
      else Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20 }).start();
    },
  })).current;

  const selected = ROOM_BOOST_TIERS.find(t => t.id === selectedId)!;
  const canAfford = currentSP >= selected.cost;

  const handleConfirm = async () => {
    if (!canAfford || loading) return;
    setLoading(true);
    try { await onBoost(selected); dismiss(); }
    catch {} finally { setLoading(false); }
  };

  if (!visible) return null;

  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={dismiss}>
      <Animated.View style={[s.overlay, { opacity: overlayOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
      </Animated.View>

      <Animated.View style={[s.sheet, { transform: [{ translateY }] }]} {...panResponder.panHandlers}>
        {/* 3 katmanlı premium zemin — amber warmth */}
        <LinearGradient colors={['#2a1a0a', '#170f05', '#080503']} start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }} style={StyleSheet.absoluteFillObject} />
        <LinearGradient colors={['rgba(251,146,60,0.26)', 'rgba(251,146,60,0.06)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
        <LinearGradient colors={['transparent', 'rgba(251,146,60,0.9)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.topEdge} />

        <View style={s.handle} />

        <View style={s.header}>
          <Ionicons name="rocket" size={18} color="#FB923C" style={s.glowIcon} />
          <Text style={s.title}>Keşfette Öne Çıkar</Text>
        </View>
        <Text style={s.subtitle} numberOfLines={2}>
          {roomName ? `"${roomName}"` : 'Bu oda'} keşfet sayfasında üst sıralara çıkar ve daha çok dinleyici çeker.
        </Text>

        {/* Tier seçici */}
        <View style={s.tierRow}>
          {ROOM_BOOST_TIERS.map((tier) => {
            const active = selectedId === tier.id;
            const affordable = currentSP >= tier.cost;
            return (
              <Pressable
                key={tier.id}
                style={[
                  s.tierCard,
                  active && { borderColor: tier.accent, backgroundColor: tier.accent + '12' },
                  !affordable && { opacity: 0.45 },
                ]}
                onPress={() => affordable && setSelectedId(tier.id)}
              >
                {tier.popular && (
                  <View style={[s.popularPill, { backgroundColor: tier.accent + '20', borderColor: tier.accent + '60' }]}>
                    <Text style={[s.popularText, { color: tier.accent }]}>POPÜLER</Text>
                  </View>
                )}
                <View style={[s.tierIconWrap, { backgroundColor: tier.accent + '18', borderColor: tier.accent + '45' }]}>
                  <Ionicons name={tier.icon as any} size={20} color={tier.accent} />
                </View>
                <Text style={[s.tierLabel, active && { color: '#F1F5F9' }]}>{tier.label}</Text>
                <Text style={s.tierSub}>{tier.sublabel}</Text>
                <View style={s.tierPriceRow}>
                  <Text style={[s.tierCost, active && { color: tier.accent }]}>{tier.cost}</Text>
                  <Text style={s.tierSP}>SP</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Özet + bakiye */}
        <View style={s.summaryRow}>
          <View>
            <Text style={s.summaryLabel}>{selected.label}</Text>
            <Text style={s.summaryDesc}>{selected.sublabel}</Text>
          </View>
          <View style={[s.balancePill, !canAfford && { borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.06)' }]}>
            <Ionicons name="diamond-outline" size={12} color={canAfford ? '#FB923C' : '#EF4444'} />
            <Text style={[s.balanceText, !canAfford && { color: '#EF4444' }]}>{currentSP.toLocaleString()}</Text>
          </View>
        </View>

        {/* CTA */}
        <Pressable style={[s.ctaWrap, !canAfford && { opacity: 0.4 }]} onPress={handleConfirm} disabled={!canAfford || loading}>
          <LinearGradient
            colors={canAfford ? ['#FB923C', '#F59E0B', '#B45309'] : ['#334155', '#1E293B', '#0F172A']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={s.ctaGradient}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <View style={s.ctaIconWrap}>
                  <Ionicons name="rocket" size={18} color="#FFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.ctaTitle}>{canAfford ? 'Boost Başlat' : 'Yetersiz SP'}</Text>
                  <Text style={s.ctaSub}>{selected.label} · {selected.sublabel}</Text>
                </View>
                <Text style={s.ctaCost}>{selected.cost} SP</Text>
                <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.75)" />
              </>
            )}
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingBottom: 36,
    borderWidth: 1.5, borderColor: 'rgba(251,146,60,0.3)', borderBottomWidth: 0,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.6, shadowRadius: 24, elevation: 20,
  },
  topEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5 },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(251,146,60,0.45)',
    alignSelf: 'center', marginTop: 12, marginBottom: 14,
  },
  glowIcon: {
    textShadowColor: 'rgba(251,146,60,0.8)',
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  title: { fontSize: 17, fontWeight: '800', color: '#F1F5F9' },
  subtitle: { fontSize: 11, color: '#94A3B8', marginBottom: 18, lineHeight: 16 },

  tierRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  tierCard: {
    flex: 1, alignItems: 'center',
    paddingVertical: 16, paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.06)',
  },
  popularPill: {
    position: 'absolute', top: -8, paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 6, borderWidth: 1,
  },
  popularText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  tierIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, marginBottom: 8,
  },
  tierLabel: { fontSize: 12, fontWeight: '800', color: '#CBD5E1', marginBottom: 2 },
  tierSub: { fontSize: 9, color: '#64748B', marginBottom: 8, textAlign: 'center' },
  tierPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  tierCost: { fontSize: 18, fontWeight: '900', color: '#CBD5E1' },
  tierSP: { fontSize: 9, fontWeight: '700', color: '#64748B' },

  summaryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 14,
  },
  summaryLabel: { fontSize: 13, fontWeight: '800', color: '#E2E8F0' },
  summaryDesc: { fontSize: 10, color: '#64748B', marginTop: 1 },
  balancePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(251,146,60,0.08)',
    borderWidth: 1, borderColor: 'rgba(251,146,60,0.2)',
  },
  balanceText: { fontSize: 13, fontWeight: '800', color: '#FB923C' },

  ctaWrap: {
    borderRadius: 14, overflow: 'hidden',
    shadowColor: '#FB923C', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  ctaGradient: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: 14, gap: 10,
  },
  ctaIconWrap: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  ctaTitle: {
    fontSize: 14, fontWeight: '900', color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  ctaSub: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 1 },
  ctaCost: { fontSize: 13, fontWeight: '800', color: 'rgba(255,255,255,0.75)', marginRight: 4 },
});
