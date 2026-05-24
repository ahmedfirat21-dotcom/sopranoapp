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
  Modal, PanResponder, useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppLoader from '../AppLoader';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../constants/theme';
import { BadgeService, type BadgeWithStatus } from '../../services/badges';
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

  // ★ v1.7.13.46 (19 May 2026): TÜM rozetleri (earned + locked) çek.
  //   Kullanıcı motivasyon kaynağı: kilitliler görünür, "ne yapmalıyım" hint var.
  const [items, setItems] = useState<BadgeWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<BadgeWithStatus | null>(null);
  const earnedCount = items.filter(i => i.earned).length;
  const totalCount = items.length;

  const translateY = useRef(new Animated.Value(PANEL_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!visible || !userId) return;
    setLoading(true);
    BadgeService.getAllBadgesWithStatus(userId)
      .then(setItems)
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

  // ★ v1.7.13.45 (19 May 2026): Drag handle bölgesinde (üst 80dp) onStart'ta
  //   responder DOĞRUDAN yakala. v43 testte 'header onStart' fire ediyor ama
  //   onMoveShouldSetPanResponder hiç fire etmiyordu (RN Modal'da touchMove
  //   delivery sorunu). Çözüm: onStartShouldSetPanResponder = TRUE eğer
  //   locationY < 80. Sonraki tüm move'lar bize gelir, steal gerekmez.
  const HEADER_HEIGHT = 80;
  const headerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (e) => e.nativeEvent.locationY < HEADER_HEIGHT,
      onStartShouldSetPanResponderCapture: (e) => e.nativeEvent.locationY < HEADER_HEIGHT,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: onPanMove,
      onPanResponderRelease: onPanRelease,
    })
  ).current;

  // Body pan — outer Animated.View. Move-only capture ile ScrollView'dan steal.
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

  const showBadgeDetail = (item: BadgeWithStatus) => {
    setSelectedItem(item);
  };

  const title = displayName ? displayName.toLocaleUpperCase(i18n.locale) : 'ROZETLER';

  if (!visible) return null;

  // ★ v1.7.13.44 (19 May 2026): Modal geri restore, ancak pan responder
  //   onStartShouldSetPanResponder ile touch BAŞINDA responder yakalanır
  //   (drag handle bölgesinde başlarsa). Böylece sonraki touchMove'lar
  //   ScrollView'a değil bize gelir. v43 sorunu Modal'in onMove eat etmesiydi
  //   ama gerçek sebep onMoveShouldSetPanResponder'ın CHILD üzerinde fire
  //   etmemesiydi — ScrollView/inner Pressable'lar move'u kapıyordu.
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
                {totalCount > 0 && (
                  <View style={st.countBadge}>
                    <Text style={st.countText}>{earnedCount}/{totalCount}</Text>
                  </View>
                )}
              </View>
            </View>

            {loading ? (
              <View style={st.loading}>
                <AppLoader size="large" color="#FCD34D" />
              </View>
            ) : items.length === 0 ? (
              <View style={st.empty}>
                <Ionicons name="ribbon-outline" size={42} color="rgba(252,211,77,0.25)" />
                <Text style={st.emptyText}>Henüz rozet tanımlanmamış</Text>
              </View>
            ) : (
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={st.scrollContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                {/* ★ v1.7.13.46: Kazanılanlar section */}
                {earnedCount > 0 && (
                  <>
                    <View style={st.sectionHeader}>
                      <Ionicons name="trophy" size={12} color="#FCD34D" />
                      <Text style={st.sectionTitle}>KAZANILANLAR · {earnedCount}</Text>
                    </View>
                    <View style={st.grid}>
                      {items.filter(i => i.earned).map(item => (
                        <Pressable
                          key={item.badge.id}
                          onPress={() => showBadgeDetail(item)}
                          style={({ pressed }) => [
                            st.gridCard,
                            pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
                          ]}
                        >
                          <BadgeMedal badge={item.badge} locked={false} />
                          <Text style={[st.cardLabel, { color: getLabelColor(item.badge.rarity) }]} numberOfLines={1}>
                            {item.badge.label}
                          </Text>
                          <Text style={[st.rarityTag, { color: getRarityTagColor(item.badge.rarity) }]} numberOfLines={1}>
                            {RARITY_LABEL[item.badge.rarity]}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}

                {/* ★ v1.7.13.46: Kilitliler section — grayscale */}
                {(totalCount - earnedCount) > 0 && (
                  <>
                    <View style={[st.sectionHeader, { marginTop: 18 }]}>
                      <Ionicons name="lock-closed" size={12} color="#64748B" />
                      <Text style={[st.sectionTitle, { color: '#94A3B8' }]}>KİLİTLİ · {totalCount - earnedCount}</Text>
                    </View>
                    <View style={st.grid}>
                      {items.filter(i => !i.earned).map(item => (
                        <Pressable
                          key={item.badge.id}
                          onPress={() => showBadgeDetail(item)}
                          style={({ pressed }) => [
                            st.gridCard,
                            pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
                          ]}
                        >
                          <BadgeMedal badge={item.badge} locked={true} />
                          <Text style={[st.cardLabel, { color: '#64748B' }]} numberOfLines={1}>
                            {item.badge.label}
                          </Text>
                          <Text style={[st.rarityTag, { color: '#475569' }]} numberOfLines={1}>
                            {RARITY_LABEL[item.badge.rarity]}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}
              </ScrollView>
            )}
          </Animated.View>
        </View>
      </Modal>
      <BadgeDetailModal
        visible={!!selectedItem}
        badge={selectedItem?.badge ?? null}
        locked={selectedItem ? !selectedItem.earned : false}
        onClose={() => setSelectedItem(null)}
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

function BadgeMedal({ badge, locked = false }: { badge: BadgeDef; locked?: boolean }) {
  const rarity = badge.rarity;
  // ★ v1.7.13.46: locked ise grayscale ton — desature renk + 🔒 overlay.
  const iconColor = locked ? '#475569' : badge.color;

  const pulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (locked) return; // kilitlide pulse yok — durağan
    const intensity = rarity === 'legendary' ? 1.0 : rarity === 'epic' ? 0.75 : rarity === 'rare' ? 0.6 : 0.45;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: intensity, duration: 850, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 850, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [rarity, locked]);
  const glowOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  const ringScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <View style={[mst.wrap, locked && { opacity: 0.45 }]}>
      {!locked && (
        <Animated.View
          style={[
            mst.pulseRing,
            { borderColor: iconColor, opacity: glowOpacity, transform: [{ scale: ringScale }] },
          ]}
          pointerEvents="none"
        />
      )}
      <SkiaShadow
        shadowColor={iconColor}
        shadowOpacity={locked ? 0.15 : (rarity === 'legendary' ? 0.85 : 0.7)}
        shadowBlur={locked ? 6 : (rarity === 'legendary' ? 22 : 16)}
        shadowOffsetY={0}
        borderRadius={28}
      >
        <LinearGradient
          colors={[iconColor + (locked ? '88' : 'CC'), iconColor + (locked ? '33' : '55')]}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={mst.iconCircle}
        >
          <Ionicons name={badge.icon as any} size={26} color={locked ? '#94A3B8' : '#FFF'} style={iconShadow} />
        </LinearGradient>
      </SkiaShadow>
      {!locked && rarity === 'legendary' && (
        <View style={mst.crown} pointerEvents="none">
          <Ionicons name="star" size={10} color="#FCD34D" style={iconShadow} />
        </View>
      )}
      {/* Locked overlay: kilit ikonu sağ-alt köşe */}
      {locked && (
        <View style={mst.lockBadge} pointerEvents="none">
          <Ionicons name="lock-closed" size={10} color="#CBD5E1" />
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
  // ★ v1.7.13.46: 2-section header
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 18, paddingTop: 14, paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: '900', color: '#FCD34D',
    letterSpacing: 1.4, textTransform: 'uppercase',
  },
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
  // ★ v1.7.13.46: Locked rozet için kilit overlay (sağ-alt köşe)
  lockBadge: {
    position: 'absolute',
    bottom: 4, right: 8,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.92)',
    borderWidth: 1, borderColor: 'rgba(148,163,184,0.45)',
  },
});
