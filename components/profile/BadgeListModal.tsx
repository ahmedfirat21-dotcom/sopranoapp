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
import PremiumAlert, { type AlertButton } from '../PremiumAlert';

const iconShadow = {
  textShadowColor: 'rgba(0,0,0,0.5)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 4,
} as const;

const RARITY_LABEL: Record<BadgeRarity, string> = {
  common: i18n.t('auto.profile.BadgeListModal.002'), rare: 'Nadir', epic: 'Epik', legendary: 'Efsanevi',
};

// ★ Rarity'e özel gradient palette — metallic feel
const RARITY_GRADIENT: Record<BadgeRarity, [string, string, string]> = {
  common:    ['#475569', '#334155', '#1E293B'],          // slate
  rare:      ['#CA8A04', '#854D0E', '#451A03'],          // bronze
  epic:      ['#9CA3AF', '#7C3AED', '#312E81'],          // silver-purple holographic
  legendary: ['#FCD34D', '#F59E0B', '#92400E'],          // gold metallic
};

const RARITY_INNER: Record<BadgeRarity, string> = {
  common:    '#94A3B8',
  rare:      '#FBBF24',
  epic:      '#C084FC',
  legendary: '#FDE68A',
};

const RARITY_BORDER: Record<BadgeRarity, string> = {
  common:    'rgba(148,163,184,0.35)',
  rare:      'rgba(202,138,4,0.65)',
  epic:      'rgba(192,132,252,0.6)',
  legendary: 'rgba(252,211,77,0.85)',
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
  const [alert, setAlert] = useState<{ visible: boolean; title: string; message: string; type?: 'info' | 'warning' | 'error' | 'success'; buttons?: AlertButton[] }>({ visible: false, title: '', message: '' });

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
    setAlert({
      visible: true,
      title: b.label,
      message: `${b.description}\n\n${b.criteriaText ? `📌 ${b.criteriaText}` : ''}${b.spReward > 0 ? i18n.t('auto.profile.BadgeListModal.001', { 0: b.spReward }) : ''}`,
      type: 'info',
    });
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
            contentContainerStyle={st.scrollContent}
            showsVerticalScrollIndicator={false}
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
      <PremiumAlert {...alert} onDismiss={() => setAlert(prev => ({ ...prev, visible: false }))} />
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

function BadgeMedal({ badge }: { badge: BadgeDef }) {
  const rarity = badge.rarity;

  // Legendary için sürekli rotasyonlu sparkle ringi
  const sparkleRotation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (rarity !== 'legendary') return;
    const loop = Animated.loop(
      Animated.timing(sparkleRotation, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [rarity]);

  const rotation = sparkleRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const grad = RARITY_GRADIENT[rarity];
  const innerColor = RARITY_INNER[rarity];
  const borderColor = RARITY_BORDER[rarity];
  const iconColor = badge.color; // badge'in kendi rengi (icon vurgu)

  return (
    <View style={mst.wrap}>
      {/* ═══ LEGENDARY: dış rotasyonlu sparkle halo ═══ */}
      {rarity === 'legendary' && (
        <Animated.View style={[mst.sparkleRing, { transform: [{ rotate: rotation }] }]} pointerEvents="none">
          <Text style={[mst.sparkle, mst.sparkleTop]}>✦</Text>
          <Text style={[mst.sparkle, mst.sparkleRight]}>✦</Text>
          <Text style={[mst.sparkle, mst.sparkleBottom]}>✦</Text>
          <Text style={[mst.sparkle, mst.sparkleLeft]}>✦</Text>
        </Animated.View>
      )}

      {/* ═══ EPIC: çift halka (outer + inner ring) ═══ */}
      {rarity === 'epic' && (
        <View style={[mst.epicOuterRing, { borderColor: 'rgba(192,132,252,0.4)' }]} pointerEvents="none" />
      )}

      {/* ═══ Glow halo (her tier'da, intensity farklı) ═══ */}
      <View style={[
        mst.glowHalo,
        {
          backgroundColor: badge.color,
          opacity: rarity === 'legendary' ? 0.22 : rarity === 'epic' ? 0.16 : rarity === 'rare' ? 0.12 : 0.08,
        },
      ]} pointerEvents="none" />

      {/* ═══ Asıl medal — tier-specific gradient ═══ */}
      <LinearGradient
        colors={grad}
        start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
        style={[mst.medal, {
          borderColor,
          shadowColor: rarity === 'legendary' ? '#FCD34D' : badge.color,
          shadowOpacity: rarity === 'legendary' ? 0.6 : 0.35,
          shadowRadius: rarity === 'legendary' ? 14 : 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: rarity === 'legendary' ? 10 : 5,
        }]}
      >
        {/* Üst gloss highlight (cam yüzey hissi) */}
        <LinearGradient
          colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.55 }}
          style={mst.gloss}
          pointerEvents="none"
        />

        {/* İç vurgu halkası — premium frame hissi */}
        <View style={[mst.innerRing, { borderColor: innerColor }]} pointerEvents="none" />

        {/* Icon — badge'in kendi rengiyle, glow */}
        <Ionicons
          name={badge.icon}
          size={rarity === 'legendary' ? 28 : 24}
          color={iconColor}
          style={{
            textShadowColor: `${iconColor}AA`,
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: rarity === 'legendary' ? 10 : 6,
          }}
        />
      </LinearGradient>

      {/* ═══ RARE: tepede küçük bronz nokta ═══ */}
      {rarity === 'rare' && (
        <View style={mst.rareDot} pointerEvents="none" />
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
    width: 80, height: 80,
    alignItems: 'center', justifyContent: 'center',
  },
  glowHalo: {
    position: 'absolute',
    width: 76, height: 76, borderRadius: 38,
  },
  // Asıl medal disc
  medal: {
    width: 60, height: 60, borderRadius: 30,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.2,
    overflow: 'hidden',
  },
  gloss: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 30,
    borderTopLeftRadius: 30, borderTopRightRadius: 30,
  },
  innerRing: {
    position: 'absolute',
    width: 50, height: 50, borderRadius: 25,
    borderWidth: 0.8,
    opacity: 0.45,
  },
  // Epic outer ring (çift halka)
  epicOuterRing: {
    position: 'absolute',
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 1, borderStyle: 'dashed',
  },
  // Rare bronze dot
  rareDot: {
    position: 'absolute',
    top: 8, right: 14,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#FBBF24',
    borderWidth: 0.8, borderColor: '#854D0E',
    shadowColor: '#FBBF24', shadowOpacity: 0.8, shadowRadius: 4,
    elevation: 4,
  },
  // Legendary sparkle ring (animated rotation)
  sparkleRing: {
    position: 'absolute',
    width: 80, height: 80,
    alignItems: 'center', justifyContent: 'center',
  },
  sparkle: {
    position: 'absolute',
    fontSize: 11,
    color: '#FCD34D',
    textShadowColor: '#F59E0B',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  sparkleTop: { top: 0 },
  sparkleRight: { right: 0 },
  sparkleBottom: { bottom: 0 },
  sparkleLeft: { left: 0 },
});
