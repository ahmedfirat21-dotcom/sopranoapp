/**
 * SopranoChat — Rozet Listesi Modal
 * ═══════════════════════════════════════════════════════════════
 * ★ v1.7.13.41 (19 May 2026): BottomSheet wrapper kaldırıldı.
 *   BottomSheet'in karmaşık 2-pan-responder yapısı drag-to-dismiss'i
 *   güvenilir çalıştırmıyordu. Şimdi InRoomUserProfile/SymbolGiftSheet
 *   ile aynı pattern: direkt Modal + tek panResponder + ScrollView.
 *   Pan'i scrollOffset umursamaz — drag-to-dismiss her zaman çalışır.
 *
 * Rarity tier'lara göre 4 farklı görsel dil:
 *   • Common (Yaygın), Rare (Nadir), Epic (Epik), Legendary (Efsanevi)
 */
import React, { useEffect, useState, useRef } from 'react';
import { i18n } from '../../services/i18n';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Animated, Easing,
  Modal, PanResponder, Dimensions, useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppLoader from '../AppLoader';
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
  displayName?: string;
}

export default function BadgeListModal({ visible, onClose, userId, displayName }: Props) {
  const { height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const PANEL_HEIGHT = H * 0.82;

  const [badges, setBadges] = useState<BadgeDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBadge, setSelectedBadge] = useState<BadgeDef | null>(null);

  const translateY = useRef(new Animated.Value(PANEL_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!visible || !userId) return;
    setLoading(true);
    BadgeService.getBadgesForUser(userId)
      .then(setBadges)
      .finally(() => setLoading(false));
  }, [visible, userId]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: PANEL_HEIGHT, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, PANEL_HEIGHT]);

  // ★ v1.7.13.42 (19 May 2026): InRoomUserProfile birebir pattern — header
  //   panResponder (drag handle ALWAYS) + body panResponder (capture phase ile
  //   ScrollView'dan responder çalar).
  const onPanMove = (_: any, gs: any) => { if (gs.dy > 0) translateY.setValue(gs.dy); };
  const onPanRelease = (_: any, gs: any) => {
    if (gs.dy > 60 || gs.vy > 0.5) {
      Animated.timing(translateY, { toValue: PANEL_HEIGHT, duration: 200, useNativeDriver: true })
        .start(() => onCloseRef.current());
    } else {
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
    }
  };

  // Header pan — drag handle + title. dy > 4, scroll umurusamadan ALWAYS drag.
  const headerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 4 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onMoveShouldSetPanResponderCapture: (_, gs) => Math.abs(gs.dy) > 4 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: onPanMove,
      onPanResponderRelease: onPanRelease,
    })
  ).current;

  // Body pan — outer Animated.View. Capture phase ScrollView'dan responder çalar.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.5,
      onMoveShouldSetPanResponderCapture: (_, gs) => gs.dy > 14 && Math.abs(gs.dy) > Math.abs(gs.dx) * 2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: onPanMove,
      onPanResponderRelease: onPanRelease,
    })
  ).current;

  const showBadgeDetail = (b: BadgeDef) => {
    setSelectedBadge(b);
  };

  const title = displayName ? displayName.toLocaleUpperCase('tr-TR') : 'ROZETLER';

  if (!visible) return null;

  return (
    <>
      <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
        <View style={StyleSheet.absoluteFillObject as any} pointerEvents="box-none">
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]}>
            <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} onPress={onClose} />
          </Animated.View>

          <Animated.View
            style={[st.panel, { paddingBottom: 24 + insets.bottom, transform: [{ translateY }] }]}
            {...panResponder.panHandlers}
          >
            <LinearGradient
              colors={['#1e2230', '#15182a', '#0a0b16']}
              locations={[0, 0.55, 1]}
              start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <LinearGradient
              colors={['transparent', 'rgba(252,211,77,0.85)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={st.topEdge}
            />

            {/* ★ v1.7.13.42: Drag handle + title bölgesi headerPanHandlers ile sarıldı.
                Her zaman drag, scroll umurusamaz. */}
            <View {...headerPanResponder.panHandlers}>
              <View style={st.handleWrap}><View style={st.handle} /></View>
              <View style={st.header}>
                <View style={st.headerAccent} />
                <Ionicons name="ribbon" size={14} color="#FCD34D" style={iconShadow} />
                <Text style={st.headerTitle} numberOfLines={1}>{title}</Text>
                {badges.length > 0 && (
                  <View style={st.countBadge}>
                    <Text style={st.countText}>{badges.length}</Text>
                  </View>
                )}
              </View>
            </View>

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
          </Animated.View>
        </View>
      </Modal>
      <BadgeDetailModal
        visible={!!selectedBadge}
        badge={selectedBadge}
        onClose={() => setSelectedBadge(null)}
      />
    </>
  );
}

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

function BadgeMedal({ badge }: { badge: BadgeDef }) {
  const rarity = badge.rarity;
  const iconColor = badge.color;

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
      {rarity === 'legendary' && (
        <View style={mst.crown} pointerEvents="none">
          <Ionicons name="star" size={10} color="#FCD34D" style={iconShadow} />
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  panel: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    height: '82%',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: 'hidden',
    borderWidth: 1, borderBottomWidth: 0,
    borderColor: 'rgba(252,211,77,0.15)',
    ...Shadows.card,
  },
  topEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, zIndex: 1 },
  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handle: { width: 44, height: 4, borderRadius: 2, backgroundColor: 'rgba(252,211,77,0.32)' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
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
  loading: { paddingVertical: 80, alignItems: 'center' },
  empty: { paddingVertical: 50, alignItems: 'center', gap: 10, paddingHorizontal: 32 },
  emptyText: { fontSize: 13, fontWeight: '700', color: '#CBD5E1', ...Shadows.text },
  emptyHint: { fontSize: 11, color: '#94A3B8', textAlign: 'center', lineHeight: 16 },
  scrollContent: { paddingTop: 16, paddingBottom: 16, paddingHorizontal: 4 },
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
  pulseRing: {
    position: 'absolute',
    width: 70, height: 70, borderRadius: 35,
    borderWidth: 1.5,
  },
  iconCircle: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)',
  },
  crown: {
    position: 'absolute',
    top: -2,
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(252,211,77,0.18)',
    borderWidth: 0.8, borderColor: 'rgba(252,211,77,0.6)',
  },
});
