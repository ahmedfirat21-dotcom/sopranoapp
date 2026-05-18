/**
 * SopranoChat — Rozet Listesi Modal (Faz 6.3 — Premium Tier Design)
 * ═══════════════════════════════════════════════════════════════
 * Rarity tier'lara göre 4 farklı görsel dil:
 *   • Common (Yaygın)    → Soft slate disc, minimal
 *   • Rare (Nadir)       → Bronze metallic, etched border, corner accent
 *   • Epic (Epik)        → Silver-purple holographic, outer + inner ring
 *   • Legendary (Efsanevi) → Gold metallic medal + 4 köşe sparkle (animated)
 *
 * Tasarım: profil sayfası DNA'sı + rarity'e özel kompozisyon.
 * Tap → PremiumAlert detay modal.
 * Swipe-down ile kapanır.
 */
import React, { useEffect, useState, useRef } from 'react';
import { i18n } from '../../services/i18n';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Animated, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AppLoader from '../AppLoader';
import BottomSheet from '../BottomSheet';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../constants/theme';
import { BadgeService } from '../../services/badges';
import type { BadgeDef, BadgeRarity } from '../../constants/badges';
import BadgeDetailModal from './BadgeDetailModal';
import { SkiaShadow } from '../skia';

const iconShadow = {
  textShadowColor: 'rgba(0,0,0,0.5)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 4,
} as const;

const RARITY_LABEL: Record<BadgeRarity, string> = {
  common: i18n.t('auto.profile.BadgeListModal.002'), rare: 'Nadir', epic: 'Epik', legendary: 'Efsanevi',
};

interface Props {
  visible: boolean;
  onClose: () => void;
  userId: string;
  /** Görüntülenen kişinin adı — başlık için */
  displayName?: string;
}

export default function BadgeListModal({ visible, onClose, userId, displayName }: Props) {
  const [badges, setBadges] = useState<BadgeDef[]>([]);
  const [loading, setLoading] = useState(true);
  // ★ v295 (17 May 2026): PremiumAlert kaldırıldı — yeni BadgeDetailModal celebration
  //   tarz Skia medal'lı modal (rarity'e duyarlı, animasyonlu).
  const [selectedBadge, setSelectedBadge] = useState<BadgeDef | null>(null);

  // ★ v291 (16 May 2026): Manuel PanResponder + Modal yapısı KALDIRILDI — Davet Kodu
  //   sheet'inde olduğu gibi BottomSheet wrapper kullanıyor. Sebep: önceki manuel
  //   yapıda scrollOffsetRef.current <= 0 koşulu çok katıydı (ScrollView'a hafif
  //   dokunulunca drag iptal oluyordu). BottomSheet pattern garantili çalışır.

  useEffect(() => {
    if (!visible || !userId) return;
    setLoading(true);
    BadgeService.getBadgesForUser(userId)
      .then(setBadges)
      .finally(() => setLoading(false));
  }, [visible, userId]);

  const showBadgeDetail = (b: BadgeDef) => {
    setSelectedBadge(b);
  };

  const title = displayName ? displayName.toLocaleUpperCase('tr-TR') : 'ROZETLER';

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={onClose}
        title={title}
        icon="ribbon"
        accentColor="#FCD34D"
        badge={badges.length}
        maxHeightRatio={0.82}
        minHeightRatio={0.55}
        scrollableContent
      >
        {loading ? (
          <View style={st.loading}>
            <AppLoader size="large" color="#FCD34D" />
          </View>
        ) : badges.length === 0 ? (
          <View style={st.empty}>
            <Ionicons name="ribbon-outline" size={42} color="rgba(252,211,77,0.25)" />
            <Text style={st.emptyText}>{i18n.t('profile.badgelistmodal.001')}</Text>
            <Text style={st.emptyHint}>{i18n.t('profile.badgelistmodal.002')}</Text>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={st.scrollContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            <View style={st.grid}>
              {badges.map(b => (
                <Pressable
                  key={b.id}
                  onPress={() => showBadgeDetail(b)}
                  style={({ pressed }) => [
                    st.gridCard,
                    pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
                  ]}
                >
                  <BadgeMedal badge={b} />
                  <Text style={[st.cardLabel, { color: getLabelColor(b.rarity) }]} numberOfLines={1}>
                    {b.label}
                  </Text>
                  <Text style={[st.rarityTag, { color: getRarityTagColor(b.rarity) }]} numberOfLines={1}>
                    {RARITY_LABEL[b.rarity]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}
      </BottomSheet>
      <BadgeDetailModal
        visible={!!selectedBadge}
        badge={selectedBadge}
        onClose={() => setSelectedBadge(null)}
      />
    </>
  );
}

// ═══ Tier-based label color ═══
function getLabelColor(rarity: BadgeRarity): string {
  switch (rarity) {
    case 'legendary': return '#FCD34D';
    case 'epic':      return '#C084FC';
    case 'rare':      return '#FBBF24';
    default:          return '#CBD5E1';
  }
}
function getRarityTagColor(rarity: BadgeRarity): string {
  switch (rarity) {
    case 'legendary': return '#FCD34D';
    case 'epic':      return '#A78BFA';
    case 'rare':      return '#FCD34D';
    default:          return '#64748B';
  }
}

// ═══════════════════════════════════════════════════════════════
// BADGE MEDAL — Rarity-specific composition
// ═══════════════════════════════════════════════════════════════

// ★ v319.4 (18 May 2026): BadgeMedal sadeleştirildi — eski yoğun multi-layer
//   (halo + gloss + inner ring + epic dashed outer + rare dot + legendary sparkle)
//   "çok kasvetli/gri" görünüyordu. Yeni tasarım profil sayfasındaki
//   FeaturedBadgesShowcase ailesini takip eder: badge.color gradient circle +
//   SkiaShadow glow + soft pulse animasyonu (her tier). Rarity vurgusu için
//   ince renkli halka + legendary'de daha güçlü pulse.
function BadgeMedal({ badge }: { badge: BadgeDef }) {
  const rarity = badge.rarity;
  const iconColor = badge.color;

  // Soft pulse — opacity + scale (1.7sn nefes alma)
  const pulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const intensity = rarity === 'legendary' ? 1.0 : rarity === 'epic' ? 0.75 : rarity === 'rare' ? 0.6 : 0.45;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: intensity, duration: 850, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 850, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [rarity]);
  const glowOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  const ringScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <View style={mst.wrap}>
      {/* ★ Pulse glow halka — rarity'e göre renk + opacity */}
      <Animated.View
        style={[
          mst.pulseRing,
          {
            borderColor: iconColor,
            opacity: glowOpacity,
            transform: [{ scale: ringScale }],
          },
        ]}
        pointerEvents="none"
      />
      <SkiaShadow shadowColor={iconColor} shadowOpacity={rarity === 'legendary' ? 0.85 : 0.7} shadowBlur={rarity === 'legendary' ? 22 : 16} shadowOffsetY={0} borderRadius={28}>
        <LinearGradient
          colors={[iconColor + 'CC', iconColor + '55']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={mst.iconCircle}
        >
          <Ionicons name={badge.icon as any} size={26} color="#FFF" style={iconShadow} />
        </LinearGradient>
      </SkiaShadow>
      {/* Legendary için ek crown ikonu — tepede minik */}
      {rarity === 'legendary' && (
        <View style={mst.crown} pointerEvents="none">
          <Ionicons name="star" size={10} color="#FCD34D" style={iconShadow} />
        </View>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '85%', minHeight: '55%',
    overflow: 'hidden',
    borderWidth: 1, borderBottomWidth: 0,
    borderColor: 'rgba(252,211,77,0.15)',
    ...Shadows.card,
  },
  topEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, zIndex: 1 },
  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handle: { width: 44, height: 4, borderRadius: 2, backgroundColor: 'rgba(252,211,77,0.22)' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingTop: 10, paddingBottom: 4,
  },
  headerAccent: {
    width: 3, height: 18, borderRadius: 2, backgroundColor: '#FCD34D',
  },
  headerTitle: {
    flex: 1, fontSize: 13, fontWeight: '900', color: '#F1F5F9',
    letterSpacing: 1.4, textTransform: 'uppercase',
    ...Shadows.text,
  },
  countBadge: {
    backgroundColor: 'rgba(252,211,77,0.14)', borderRadius: 11,
    paddingHorizontal: 9, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(252,211,77,0.35)',
  },
  countText: { fontSize: 10.5, fontWeight: '900', color: '#FCD34D', letterSpacing: 0.4 },
  headerSubtitle: {
    fontSize: 10.5, color: 'rgba(148,163,184,0.7)',
    paddingHorizontal: 18, paddingBottom: 14,
    fontStyle: 'italic',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  loading: { paddingVertical: 80, alignItems: 'center' },
  empty: { paddingVertical: 50, alignItems: 'center', gap: 10, paddingHorizontal: 32 },
  emptyText: { fontSize: 13, fontWeight: '700', color: '#CBD5E1', ...Shadows.text },
  emptyHint: { fontSize: 11, color: '#94A3B8', textAlign: 'center', lineHeight: 16 },
  scrollContent: { paddingTop: 22, paddingBottom: 32, paddingHorizontal: 4 },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  gridCard: {
    width: '32%', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 4,
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 11, fontWeight: '800', letterSpacing: 0.3,
    textAlign: 'center', maxWidth: '100%',
    marginTop: 10,
    ...Shadows.textLight,
  },
  rarityTag: {
    fontSize: 8, fontWeight: '900', letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 3, opacity: 0.85,
  },
});

const mst = StyleSheet.create({
  wrap: {
    width: 76, height: 76,
    alignItems: 'center', justifyContent: 'center',
  },
  // ★ v319.4: Pulse halka — badge.color border ile dış parlama
  pulseRing: {
    position: 'absolute',
    width: 70, height: 70, borderRadius: 35,
    borderWidth: 1.5,
  },
  // Ana icon circle (FeaturedBadgesShowcase iconCircle ile aynı boyut)
  iconCircle: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)',
  },
  // Legendary için tepede minik yıldız
  crown: {
    position: 'absolute',
    top: -2,
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(252,211,77,0.18)',
    borderWidth: 0.8, borderColor: 'rgba(252,211,77,0.6)',
  },
});
