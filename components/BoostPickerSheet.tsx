/**
 * SopranoChat — Boost Picker Sheet
 * ═══════════════════════════════════════════════════
 * Premium bottom sheet — swipe-to-dismiss, room modal tarzı.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal,
  ActivityIndicator, Animated, PanResponder, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../constants/theme';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_H = 380;

export type BoostTier = {
  id: string;
  label: string;
  icon: string;       // Ionicons name
  duration: number;   // saat
  cost: number;       // SP
  popular?: boolean;
  accent: string;
};

export const BOOST_TIERS: BoostTier[] = [
  {
    id: 'quick', label: 'Hızlı Boost', icon: 'flash',
    duration: 1, cost: 25, accent: '#60A5FA',
  },
  {
    id: 'standard', label: 'Standart Boost', icon: 'trending-up',
    duration: 6, cost: 120, popular: true, accent: '#14B8A6',
  },
  {
    id: 'elite', label: 'Elit Boost', icon: 'star',
    duration: 24, cost: 400, accent: '#A78BFA',
  },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onBoost: (tier: BoostTier) => Promise<void>;
  currentSP: number;
};

export default function BoostPickerSheet({ visible, onClose, onBoost, currentSP }: Props) {
  const [selectedId, setSelectedId] = useState<string>('standard');
  const [loading, setLoading] = useState(false);

  // Swipe-to-dismiss
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
    onPanResponderMove: (_, g) => {
      if (g.dy > 0) translateY.setValue(g.dy);
    },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 80 || g.vy > 0.5) {
        dismiss();
      } else {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20 }).start();
      }
    },
  })).current;

  const selected = BOOST_TIERS.find(t => t.id === selectedId)!;
  const canAfford = currentSP >= selected.cost;

  const handleBoost = async () => {
    if (!canAfford || loading) return;
    setLoading(true);
    try {
      await onBoost(selected);
      dismiss();
    } catch {
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible transparent statusBarTranslucent animationType="none">
      {/* Overlay */}
      <Animated.View style={[s.overlay, { opacity: overlayOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[s.sheet, { transform: [{ translateY }] }]}
        {...panResponder.panHandlers}
      >
        {/* Handle bar */}
        <View style={s.handle} />

        {/* Header */}
        <View style={s.header}>
          <Ionicons name="rocket-outline" size={18} color="#14B8A6" />
          <Text style={s.title}>Profili Öne Çıkar</Text>
        </View>
        <Text style={s.subtitle}>Profilin ve odaların Keşfet'te öne çıkar. Tıklayan kullanıcılar odalarına ulaşır.</Text>

        {/* Tier Seçici */}
        <View style={s.tierRow}>
          {BOOST_TIERS.map((tier) => {
            const active = selectedId === tier.id;
            const affordable = currentSP >= tier.cost;
            return (
              <Pressable
                key={tier.id}
                style={[
                  s.tierCard,
                  active && { borderColor: tier.accent, backgroundColor: `${tier.accent}08` },
                  !affordable && { opacity: 0.4 },
                ]}
                onPress={() => affordable && setSelectedId(tier.id)}
              >
                {tier.popular && (
                  <View style={[s.popularDot, { backgroundColor: tier.accent }]} />
                )}
                <View style={[s.tierIconWrap, { backgroundColor: `${tier.accent}15`, borderColor: `${tier.accent}30` }]}>
                  <Ionicons name={tier.icon as any} size={16} color={tier.accent} />
                </View>
                <Text style={[s.tierDuration, active && { color: '#F1F5F9' }]}>{tier.duration} saat</Text>
                <View style={s.tierPriceRow}>
                  <Text style={[s.tierCost, active && { color: tier.accent }]}>{tier.cost}</Text>
                  <Text style={s.tierSP}>SP</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Özet + Bakiye */}
        <View style={s.summaryRow}>
          <View style={s.summaryLeft}>
            <Text style={s.summaryLabel}>{selected.label}</Text>
            <Text style={s.summaryDesc}>{selected.duration} saatlik görünürlük</Text>
          </View>
          <View style={s.balancePill}>
            <Ionicons name="diamond-outline" size={12} color={canAfford ? '#14B8A6' : '#EF4444'} />
            <Text style={[s.balanceText, !canAfford && { color: '#EF4444' }]}>{currentSP.toLocaleString()}</Text>
          </View>
        </View>

        {/* CTA — Odalarım tarzı */}
        <Pressable
          style={[s.ctaWrap, !canAfford && { opacity: 0.35 }]}
          onPress={handleBoost}
          disabled={!canAfford || loading}
        >
          <LinearGradient
            colors={canAfford ? ['#14B8A6', '#0D9488', '#065F56'] : ['#334155', '#1E293B', '#0F172A']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={s.ctaGradient}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <View style={s.ctaIconWrap}>
                  <Ionicons name="rocket-outline" size={18} color="#FFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.ctaTitle}>Boost Başlat</Text>
                  <Text style={s.ctaSub}>{selected.label} · {selected.duration} saat</Text>
                </View>
                <Text style={s.ctaCost}>{selected.cost} SP</Text>
                <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.7)" />
              </>
            )}
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#2D3740',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingBottom: 36,
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.15)', borderBottomWidth: 0,
    shadowColor: '#000', shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.5, shadowRadius: 24, elevation: 20,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignSelf: 'center', marginTop: 12, marginBottom: 14,
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: 16, fontWeight: '700', color: '#F1F5F9',
  },
  subtitle: {
    fontSize: 11, color: '#64748B', marginBottom: 18, lineHeight: 15,
  },

  // Tier Cards
  tierRow: {
    flexDirection: 'row', gap: 8, marginBottom: 16,
  },
  tierCard: {
    flex: 1, alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 4,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.06)',
  },
  popularDot: {
    position: 'absolute', top: 6, right: 6,
    width: 6, height: 6, borderRadius: 3,
  },
  tierIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, marginBottom: 8,
  },
  tierDuration: {
    fontSize: 11, fontWeight: '600', color: '#94A3B8', marginBottom: 4,
  },
  tierPriceRow: {
    flexDirection: 'row', alignItems: 'baseline', gap: 2,
  },
  tierCost: {
    fontSize: 18, fontWeight: '800', color: '#CBD5E1',
  },
  tierSP: {
    fontSize: 9, fontWeight: '600', color: '#64748B',
  },

  // Summary
  summaryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
    marginBottom: 14,
  },
  summaryLeft: {},
  summaryLabel: { fontSize: 13, fontWeight: '700', color: '#E2E8F0' },
  summaryDesc: { fontSize: 10, color: '#64748B', marginTop: 1 },
  balancePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(20,184,166,0.06)',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.12)',
  },
  balanceText: { fontSize: 13, fontWeight: '800', color: '#14B8A6' },

  // CTA — Odalarım tarzı
  ctaWrap: {
    borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 5,
  },
  ctaGradient: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 14, gap: 10,
  },
  ctaIconWrap: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  ctaTitle: {
    fontSize: 14, fontWeight: '800', color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  ctaSub: {
    fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1,
  },
  ctaCost: {
    fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.6)',
    marginRight: 4,
  },
});
