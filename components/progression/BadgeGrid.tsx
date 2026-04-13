/**
 * SopranoChat — Premium Rozet Grid Bileşeni
 * Profilde ve diğer kullanıcı profillerinde kullanılır
 * Kategorili grid, rarity glow, kilitli rozetler, detay modal
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, Animated,
  ScrollView, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Radius, Shadows } from '../../constants/theme';
import {
  BADGE_CATALOG, BADGE_CATEGORIES,
  getBadgesByCategory, getRarityColor, getRarityLabel,
  getBadgeProgress, TOTAL_BADGES,
  type BadgeDefinition,
} from '../../constants/badges';
import type { UserBadge } from '../../services/engagement/badges';

const { width: SCREEN_W } = Dimensions.get('window');
const BADGE_SIZE = (SCREEN_W - 40 - 4 * 8) / 5; // 5 sütunlu grid

// ═══════════════════════════════════════════════════
// TIPLER
// ═══════════════════════════════════════════════════

interface BadgeGridProps {
  /** Kullanıcının açtığı rozetler */
  unlockedBadges: UserBadge[];
  /** Toplam açık sayısı göstermek için (compact modda) */
  compact?: boolean;
  /** Tüm rozetleri göster modal'ını dışarıdan aç */
  showAll?: boolean;
}

// ═══════════════════════════════════════════════════
// ROZET HÜCRE BİLEŞENİ
// ═══════════════════════════════════════════════════

function BadgeCell({
  badge,
  isUnlocked,
  unlockedAt,
  onPress,
}: {
  badge: BadgeDefinition;
  isUnlocked: boolean;
  unlockedAt?: string;
  onPress: () => void;
}) {
  const rarityColor = getRarityColor(badge.rarity);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isUnlocked && (badge.rarity === 'legendary' || badge.rarity === 'epic')) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [isUnlocked, badge.rarity]);

  return (
    <Pressable onPress={onPress}>
      <Animated.View
        style={[
          cellStyles.container,
          isUnlocked
            ? { borderColor: badge.color + '40', backgroundColor: badge.color + '12' }
            : { borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.02)' },
          isUnlocked && (badge.rarity === 'legendary' || badge.rarity === 'epic')
            ? { transform: [{ scale: pulseAnim }] }
            : undefined,
        ]}
      >
        {/* Rarity glow — unlocked epic/legendary */}
        {isUnlocked && badge.rarity === 'legendary' && (
          <View style={[cellStyles.rarityGlow, { backgroundColor: badge.color, shadowColor: badge.color }]} />
        )}

        <View style={[cellStyles.iconWrap, { backgroundColor: isUnlocked ? badge.color + '20' : 'rgba(255,255,255,0.04)' }]}>
          <Ionicons
            name={badge.icon as any}
            size={20}
            color={isUnlocked ? badge.color : 'rgba(255,255,255,0.15)'}
          />
        </View>
        <Text
          style={[cellStyles.name, { color: isUnlocked ? Colors.text : 'rgba(255,255,255,0.2)' }]}
          numberOfLines={1}
        >
          {isUnlocked ? badge.name : '???'}
        </Text>
        {/* Rarity dot */}
        {isUnlocked && (
          <View style={[cellStyles.rarityDot, { backgroundColor: rarityColor }]} />
        )}
        {/* Lock icon */}
        {!isUnlocked && (
          <View style={cellStyles.lockOverlay}>
            <Ionicons name="lock-closed" size={10} color="rgba(255,255,255,0.15)" />
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const cellStyles = StyleSheet.create({
  container: {
    width: BADGE_SIZE,
    alignItems: 'center',
    padding: 6,
    borderRadius: 12,
    borderWidth: 1,
    position: 'relative',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  rarityDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  lockOverlay: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  rarityGlow: {
    position: 'absolute',
    top: -2, left: -2, right: -2, bottom: -2,
    borderRadius: 14,
    opacity: 0.15,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
});

// ═══════════════════════════════════════════════════
// ROZET DETAY MODAL
// ═══════════════════════════════════════════════════

function BadgeDetailModal({
  badge,
  isUnlocked,
  unlockedAt,
  visible,
  onClose,
}: {
  badge: BadgeDefinition | null;
  isUnlocked: boolean;
  unlockedAt?: string;
  visible: boolean;
  onClose: () => void;
}) {
  if (!badge) return null;

  const rarityColor = getRarityColor(badge.rarity);
  const rarityLabel = getRarityLabel(badge.rarity);
  const category = BADGE_CATEGORIES.find(c => c.id === badge.category);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={modalStyles.overlay} onPress={onClose}>
        <View style={modalStyles.content}>
          {/* Glow background */}
          <View style={[modalStyles.glowBg, { backgroundColor: isUnlocked ? badge.color + '15' : 'rgba(255,255,255,0.03)' }]} />

          {/* Icon */}
          <View style={[modalStyles.iconCircle, { backgroundColor: isUnlocked ? badge.color + '20' : 'rgba(255,255,255,0.06)', borderColor: isUnlocked ? badge.color + '40' : 'rgba(255,255,255,0.08)' }]}>
            <Ionicons
              name={badge.icon as any}
              size={40}
              color={isUnlocked ? badge.color : 'rgba(255,255,255,0.2)'}
            />
          </View>

          {/* Name */}
          <Text style={[modalStyles.name, { color: isUnlocked ? Colors.text : Colors.text3 }]}>
            {isUnlocked ? badge.name : '🔒 Kilitli Rozet'}
          </Text>

          {/* Rarity */}
          <View style={[modalStyles.rarityPill, { backgroundColor: rarityColor + '18', borderColor: rarityColor + '30' }]}>
            <Text style={[modalStyles.rarityText, { color: rarityColor }]}>{rarityLabel}</Text>
          </View>

          {/* Description */}
          <Text style={modalStyles.description}>
            {badge.description}
          </Text>

          {/* Category */}
          {category && (
            <View style={modalStyles.categoryRow}>
              <Ionicons name={category.icon as any} size={14} color={category.color} />
              <Text style={[modalStyles.categoryText, { color: category.color }]}>{category.label}</Text>
            </View>
          )}

          {/* Unlock status */}
          {isUnlocked ? (
            <View style={modalStyles.unlockedRow}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.emerald} />
              <Text style={modalStyles.unlockedText}>
                {unlockedAt ? `${new Date(unlockedAt).toLocaleDateString('tr-TR')} tarihinde açıldı` : 'Açılmış'}
              </Text>
            </View>
          ) : (
            <View style={modalStyles.lockedRow}>
              <Ionicons name="lock-closed" size={14} color={Colors.text3} />
              <Text style={modalStyles.lockedText}>Koşul: {badge.description}</Text>
            </View>
          )}

          {/* Unlock text for earned badges */}
          {isUnlocked && (
            <Text style={[modalStyles.unlockText, { color: badge.color }]}>
              {(badge as any).unlockText || '🎉'}
            </Text>
          )}

          <Pressable style={modalStyles.closeBtn} onPress={onClose}>
            <Text style={modalStyles.closeBtnText}>Kapat</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center', padding: 30,
  },
  content: {
    width: '100%', maxWidth: 320,
    backgroundColor: Colors.bg2, borderRadius: 24,
    padding: 24, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.glassBorder,
    position: 'relative', overflow: 'hidden',
  },
  glowBg: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 120,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
  },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, marginTop: 8, marginBottom: 12,
  },
  name: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  rarityPill: {
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20,
    borderWidth: 1, marginBottom: 12,
  },
  rarityText: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  description: { fontSize: 13, color: Colors.text2, textAlign: 'center', lineHeight: 20, marginBottom: 12 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  categoryText: { fontSize: 12, fontWeight: '600' },
  unlockedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  unlockedText: { fontSize: 12, color: Colors.emerald, fontWeight: '600' },
  lockedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  lockedText: { fontSize: 12, color: Colors.text3 },
  unlockText: { fontSize: 14, fontWeight: '700', marginTop: 4, marginBottom: 12 },
  closeBtn: {
    paddingHorizontal: 32, paddingVertical: 10,
    borderRadius: 20, backgroundColor: Colors.glass3,
    borderWidth: 1, borderColor: Colors.glassBorder,
    marginTop: 4,
  },
  closeBtnText: { fontSize: 13, fontWeight: '600', color: Colors.text2 },
});

// ═══════════════════════════════════════════════════
// ANA BADGE GRID BİLEŞENİ
// ═══════════════════════════════════════════════════

export default function BadgeGrid({ unlockedBadges, compact = false }: BadgeGridProps) {
  const [showModal, setShowModal] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<BadgeDefinition | null>(null);
  const [selectedUnlocked, setSelectedUnlocked] = useState(false);
  const [selectedUnlockedAt, setSelectedUnlockedAt] = useState<string | undefined>();
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const unlockedIds = new Set(unlockedBadges.map(b => b.id));
  const progress = getBadgeProgress(unlockedBadges.length);

  const handleBadgePress = (badge: BadgeDefinition) => {
    const ub = unlockedBadges.find(b => b.id === badge.id);
    setSelectedBadge(badge);
    setSelectedUnlocked(!!ub);
    setSelectedUnlockedAt(ub?.unlockedAt);
    setShowModal(true);
  };

  // ─── COMPACT MOD: Profil kartında satır içi ───
  if (compact) {
    const displayBadges = unlockedBadges.slice(0, 6);
    const remaining = unlockedBadges.length - 6;

    return (
      <View style={compactStyles.container}>
        <View style={compactStyles.header}>
          <Text style={compactStyles.title}>🏆 Rozetler</Text>
          <View style={compactStyles.counterPill}>
            <Text style={compactStyles.counterText}>{unlockedBadges.length}/{TOTAL_BADGES}</Text>
          </View>
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={compactStyles.row}
        >
          {displayBadges.map(badge => (
            <Pressable key={badge.id} style={compactStyles.item} onPress={() => handleBadgePress(badge)}>
              <View style={[compactStyles.iconWrap, { backgroundColor: badge.color + '18' }]}>
                <Ionicons name={badge.icon as any} size={18} color={badge.color} />
              </View>
              <Text style={compactStyles.name} numberOfLines={1}>{badge.name}</Text>
            </Pressable>
          ))}
          {/* "Tümünü Gör" butonu */}
          {unlockedBadges.length > 0 && (
            <Pressable style={compactStyles.seeAllItem} onPress={() => setActiveCategory('all')}>
              <View style={compactStyles.seeAllIcon}>
                <Ionicons name="grid-outline" size={18} color={Colors.teal} />
              </View>
              <Text style={compactStyles.seeAllText}>
                {remaining > 0 ? `+${remaining}` : 'Tümü'}
              </Text>
            </Pressable>
          )}
        </ScrollView>

        {/* Progress bar */}
        <View style={compactStyles.progressRow}>
          <View style={compactStyles.progressTrack}>
            <View style={[compactStyles.progressFill, { width: `${progress.percent}%` }]} />
          </View>
          <Text style={compactStyles.progressLabel}>{progress.label}</Text>
        </View>

        <BadgeDetailModal
          badge={selectedBadge}
          isUnlocked={selectedUnlocked}
          unlockedAt={selectedUnlockedAt}
          visible={showModal}
          onClose={() => setShowModal(false)}
        />
      </View>
    );
  }

  // ─── FULL GRID MOD: Tüm rozetlerle modal/sayfa ───
  const filteredBadges = activeCategory === 'all'
    ? [...BADGE_CATALOG]
    : getBadgesByCategory(activeCategory);

  return (
    <View style={gridStyles.container}>
      {/* Başlık + İlerleme */}
      <View style={gridStyles.header}>
        <Text style={gridStyles.title}>Rozet Koleksiyonu</Text>
        <View style={gridStyles.progressPill}>
          <Ionicons name="trophy" size={12} color={Colors.gold} />
          <Text style={gridStyles.progressText}>
            {unlockedBadges.length}/{TOTAL_BADGES} ({progress.percent}%)
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={gridStyles.progressTrack}>
        <LinearGradient
          colors={['#14B8A6', '#06B6D4']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={[gridStyles.progressFill, { width: `${Math.max(progress.percent, 2)}%` }]}
        />
      </View>
      <Text style={gridStyles.progressLabel}>{progress.label}</Text>

      {/* Kategori filtresi */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={gridStyles.categoryScroll}
        contentContainerStyle={gridStyles.categoryContent}
      >
        <Pressable
          style={[gridStyles.categoryPill, activeCategory === 'all' && gridStyles.categoryPillActive]}
          onPress={() => setActiveCategory('all')}
        >
          <Ionicons name="apps" size={14} color={activeCategory === 'all' ? '#fff' : Colors.text3} />
          <Text style={[gridStyles.categoryLabel, activeCategory === 'all' && { color: '#fff' }]}>Tümü</Text>
        </Pressable>
        {BADGE_CATEGORIES.map(cat => (
          <Pressable
            key={cat.id}
            style={[gridStyles.categoryPill, activeCategory === cat.id && [gridStyles.categoryPillActive, { backgroundColor: cat.color }]]}
            onPress={() => setActiveCategory(cat.id)}
          >
            <Ionicons name={cat.icon as any} size={14} color={activeCategory === cat.id ? '#fff' : cat.color} />
            <Text style={[gridStyles.categoryLabel, activeCategory === cat.id && { color: '#fff' }]}>{cat.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Badge grid */}
      <View style={gridStyles.grid}>
        {filteredBadges.map(badge => {
          const ub = unlockedBadges.find(b => b.id === badge.id);
          return (
            <BadgeCell
              key={badge.id}
              badge={badge}
              isUnlocked={!!ub}
              unlockedAt={ub?.unlockedAt}
              onPress={() => handleBadgePress(badge)}
            />
          );
        })}
      </View>

      <BadgeDetailModal
        badge={selectedBadge}
        isUnlocked={selectedUnlocked}
        unlockedAt={selectedUnlockedAt}
        visible={showModal}
        onClose={() => setShowModal(false)}
      />
    </View>
  );
}

// ─── COMPACT STİLLER ───
const compactStyles = StyleSheet.create({
  container: {
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  counterPill: {
    backgroundColor: 'rgba(20,184,166,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  counterText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.teal,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  item: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(20,184,166,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.2)',
    minWidth: 56,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.teal,
    maxWidth: 56,
  },
  seeAllItem: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.15)',
    borderStyle: 'dashed',
    minWidth: 56,
  },
  seeAllIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(20,184,166,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  seeAllText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.teal,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: Colors.teal,
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.text3,
  },
});

// ─── FULL GRID STİLLER ───
const gridStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  progressPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,215,0,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.gold,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text3,
    marginBottom: 12,
  },
  categoryScroll: {
    marginBottom: 12,
  },
  categoryContent: {
    gap: 6,
    paddingRight: 20,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  categoryPillActive: {
    backgroundColor: Colors.teal,
    borderColor: Colors.teal,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
