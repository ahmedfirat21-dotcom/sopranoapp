/**
 * SopranoChat — Katmanlı Profil Bölümleri
 * ═══════════════════════════════════════════════════
 * Tek bileşen, 5 tier katmanı.
 * Her iki profil ekranından (kendi + başkası) ortak kullanılır.
 *
 * Kilitli bölümler gizlenmez — 🔒 ile gösterilip Plus sayfasına yönlendirilir.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { isTierAtLeast, TIER_DEFINITIONS } from '../../constants/tiers';
import { Colors, Radius } from '../../constants/theme';
import type { SubscriptionTier } from '../../types';

// ── LockedFeatureHint ─────────────────────────────
interface LockedHintProps {
  label: string;
  requiredTier: SubscriptionTier;
  icon?: string;
}

const LockedFeatureHint: React.FC<LockedHintProps> = ({ label, requiredTier, icon }) => {
  const router = useRouter();
  const tierDef = TIER_DEFINITIONS[requiredTier];
  return (
    <Pressable style={lk.container} onPress={() => router.push('/plus' as any)}>
      <View style={lk.left}>
        <View style={[lk.iconWrap, { backgroundColor: `${tierDef.color}15` }]}>
          <Ionicons name={(icon || 'lock-closed') as any} size={14} color={tierDef.color} />
        </View>
        <Text style={lk.label}>{label}</Text>
      </View>
      <View style={[lk.badge, { borderColor: `${tierDef.color}40`, backgroundColor: `${tierDef.color}10` }]}>
        <Ionicons name="lock-closed" size={8} color={tierDef.color} />
        <Text style={[lk.badgeText, { color: tierDef.color }]}>{requiredTier}+</Text>
      </View>
    </Pressable>
  );
};

const lk = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 11, paddingHorizontal: 14, borderRadius: 12, marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.35)' },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1,
  },
  badgeText: { fontSize: 9, fontWeight: '700' },
});

// ── Props ─────────────────────────────────────────
export interface TieredProfileSectionsProps {
  tier: SubscriptionTier;
  viewerTier?: SubscriptionTier;
  isOwnProfile: boolean;
  userId?: string;

  // İstatistikler
  stats: {
    stageMinutes: number;
    roomsCreated: number;
    totalListeners: number;
    totalReactions: number;
  };

  // Son odalar
  recentRooms: { id: string; name: string; created_at: string; listener_count: number; category: string }[];

  // Gold+
  bannerUrl?: string | null;
  onDonate?: () => void;

  // Silver+
  languageTag?: string;
  ageTag?: string;

  // VIP
  isGhost?: boolean;
  incomeStats?: { totalEarned: number; roomFeeRooms: number; donationsReceived: number };
}

// ── CATEGORY ICONS ────────────────────────────────
const CAT_ICONS: Record<string, { icon: string; color: string }> = {
  chat: { icon: 'chatbubbles', color: '#14B8A6' },
  music: { icon: 'musical-notes', color: '#8B5CF6' },
  game: { icon: 'game-controller', color: '#EF4444' },
  tech: { icon: 'code-slash', color: '#3B82F6' },
  book: { icon: 'book', color: '#F59E0B' },
  film: { icon: 'film', color: '#EC4899' },
  other: { icon: 'ellipsis-horizontal', color: '#64748B' },
};

// ── Main Component ────────────────────────────────
export default function TieredProfileSections({
  tier, viewerTier, isOwnProfile, userId,
  stats, recentRooms,
  bannerUrl, onDonate,
  languageTag, ageTag,
  isGhost, incomeStats,
}: TieredProfileSectionsProps) {
  const router = useRouter();
  const effectiveTier = viewerTier || tier;
  const tierDef = TIER_DEFINITIONS[tier];

  // Helper: formatla stage süresi
  const formatStageTime = (mins: number) => {
    if (mins < 60) return `${mins} dk`;
    const hrs = Math.floor(mins / 60);
    return `${hrs} sa ${mins % 60} dk`;
  };

  // Helper: tarih formatla
  const formatDate = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const days = Math.floor(diff / 86400000);
    if (days < 1) return 'Bugün';
    if (days < 7) return `${days} gün önce`;
    return `${Math.floor(days / 7)} hf önce`;
  };

  return (
    <View style={s.root}>

      {/* ═══ Gold+ Banner ═══ */}
      {isTierAtLeast(tier, 'Gold') && bannerUrl ? (
        <View style={s.bannerWrap}>
          <Image source={{ uri: bannerUrl }} style={s.bannerImage} />
          <LinearGradient colors={['transparent', 'rgba(11,21,32,0.9)']} style={s.bannerGradient} />
        </View>
      ) : isTierAtLeast(tier, 'Gold') ? (
        <View style={s.bannerWrap}>
          <LinearGradient colors={tierDef.gradient as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.bannerImage, { opacity: 0.2 }]} />
        </View>
      ) : null}

      {/* ═══ Silver+ Etiketler ═══ */}
      {isTierAtLeast(tier, 'Silver') ? (
        (languageTag || ageTag) ? (
          <View style={s.tagsRow}>
            {languageTag ? (
              <View style={s.tag}>
                <Ionicons name="globe-outline" size={11} color="#94A3B8" />
                <Text style={s.tagText}>{languageTag}</Text>
              </View>
            ) : null}
            {ageTag ? (
              <View style={s.tag}>
                <Ionicons name="calendar-outline" size={11} color="#94A3B8" />
                <Text style={s.tagText}>{ageTag}</Text>
              </View>
            ) : null}
          </View>
        ) : null
      ) : (
        <LockedFeatureHint label="Dil & Yaş Etiketleri" requiredTier="Silver" icon="globe-outline" />
      )}

      {/* ═══ Temel İstatistikler — Tüm tier'lar ═══ */}
      <View style={s.statsCard}>
        <Text style={s.sectionTitle}>📊 İstatistikler</Text>
        <View style={s.statsGrid}>
          <View style={s.statBox}>
            <Ionicons name="mic" size={16} color="#14B8A6" />
            <Text style={s.statNumber}>{formatStageTime(stats.stageMinutes)}</Text>
            <Text style={s.statDesc}>Sahne Süresi</Text>
          </View>
          <View style={s.statBox}>
            <Ionicons name="home" size={16} color="#8B5CF6" />
            <Text style={s.statNumber}>{stats.roomsCreated}</Text>
            <Text style={s.statDesc}>Oda Açıldı</Text>
          </View>
          <View style={s.statBox}>
            <Ionicons name="people" size={16} color="#F59E0B" />
            <Text style={s.statNumber}>{stats.totalListeners}</Text>
            <Text style={s.statDesc}>Dinleyici</Text>
          </View>
        </View>
      </View>

      {/* ═══ Bronze+ Oda Kurucu Geçmişi ═══ */}
      {isTierAtLeast(tier, 'Bronze') ? (
        recentRooms.length > 0 ? (
          <View style={s.sectionCard}>
            <Text style={s.sectionTitle}>🏠 Oda Geçmişi</Text>
            {recentRooms.map((room) => {
              const cat = CAT_ICONS[room.category] || CAT_ICONS.other;
              return (
                <Pressable key={room.id} style={s.roomRow} onPress={() => router.push(`/room/${room.id}` as any)}>
                  <View style={[s.roomIcon, { backgroundColor: `${cat.color}15` }]}>
                    <Ionicons name={cat.icon as any} size={14} color={cat.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.roomName} numberOfLines={1}>{room.name}</Text>
                    <Text style={s.roomMeta}>{formatDate(room.created_at)} · {room.listener_count} dinleyici</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.15)" />
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={s.sectionCard}>
            <Text style={s.sectionTitle}>🏠 Oda Geçmişi</Text>
            <Text style={s.emptyText}>Henüz oda oluşturulmamış</Text>
          </View>
        )
      ) : (
        <LockedFeatureHint label="Oda Kurucu Geçmişi" requiredTier="Bronze" icon="home-outline" />
      )}

      {/* ═══ Silver+ Profil Teması ═══ */}
      {!isTierAtLeast(tier, 'Silver') && (
        <LockedFeatureHint label="Profil Teması" requiredTier="Silver" icon="color-palette-outline" />
      )}

      {/* ═══ Gold+ Banner Kartı ═══ */}
      {!isTierAtLeast(tier, 'Gold') && (
        <LockedFeatureHint label="Kapak Fotoğrafı" requiredTier="Gold" icon="image-outline" />
      )}

      {/* ═══ Gold+ Destekle / Bağış Butonu ═══ */}
      {isTierAtLeast(tier, 'Gold') ? (
        !isOwnProfile && onDonate ? (
          <Pressable style={s.donateBtn} onPress={onDonate}>
            <LinearGradient colors={['#F59E0B', '#D97706']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.donateBtnGradient}>
              <Ionicons name="heart" size={16} color="#FFF" />
              <Text style={s.donateBtnText}>Destekle (SP Gönder)</Text>
            </LinearGradient>
          </Pressable>
        ) : null
      ) : (
        !isOwnProfile && <LockedFeatureHint label="Destekle / SP Bağış" requiredTier="Gold" icon="heart-outline" />
      )}

      {/* ═══ Gold+ Takipçilere Özel İçerik ═══ */}
      {!isTierAtLeast(tier, 'Gold') && (
        <LockedFeatureHint label="Takipçilere Özel İçerik" requiredTier="Gold" icon="lock-closed-outline" />
      )}

      {/* ═══ VIP Ghost Mode Göstergesi ═══ */}
      {isTierAtLeast(tier, 'VIP') ? (
        isGhost ? (
          <View style={[s.sectionCard, { borderColor: 'rgba(139,92,246,0.2)' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(139,92,246,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 14 }}>👻</Text>
              </View>
              <Text style={{ color: '#A78BFA', fontSize: 12, fontWeight: '700' }}>Ghost Mode Aktif</Text>
            </View>
          </View>
        ) : null
      ) : (
        <LockedFeatureHint label="Ghost Mode Göstergesi" requiredTier="VIP" icon="eye-off-outline" />
      )}

      {/* ═══ VIP Gelişmiş İstatistik Paneli ═══ */}
      {isTierAtLeast(tier, 'VIP') ? (
        <View style={s.sectionCard}>
          <Text style={s.sectionTitle}>👑 VIP İstatistikler</Text>
          <View style={s.vipStatsGrid}>
            <View style={s.vipStatBox}>
              <Text style={[s.vipStatNum, { color: '#FF6B35' }]}>{stats.totalListeners}</Text>
              <Text style={s.vipStatLabel}>Toplam Dinleyici</Text>
            </View>
            <View style={s.vipStatBox}>
              <Text style={[s.vipStatNum, { color: '#14B8A6' }]}>{formatStageTime(stats.stageMinutes)}</Text>
              <Text style={s.vipStatLabel}>Sahne Süresi</Text>
            </View>
            <View style={s.vipStatBox}>
              <Text style={[s.vipStatNum, { color: '#F59E0B' }]}>{stats.totalReactions}</Text>
              <Text style={s.vipStatLabel}>Etkileşim</Text>
            </View>
          </View>
          {/* Stereo ses rozeti */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)' }}>
            <View style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: 'rgba(255,107,53,0.15)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="headset" size={12} color="#FF6B35" />
            </View>
            <Text style={{ fontSize: 11, color: '#FF6B35', fontWeight: '700' }}>Stereo Ses Aktif</Text>
            <View style={{ flex: 1 }} />
            <View style={[lk.badge, { borderColor: 'rgba(255,107,53,0.3)', backgroundColor: 'rgba(255,107,53,0.08)' }]}>
              <Ionicons name="checkmark" size={8} color="#FF6B35" />
              <Text style={[lk.badgeText, { color: '#FF6B35' }]}>48kHz</Text>
            </View>
          </View>
        </View>
      ) : (
        <LockedFeatureHint label="Gelişmiş İstatistik Paneli" requiredTier="VIP" icon="stats-chart-outline" />
      )}

      {/* ═══ VIP Gelir Göstergesi ═══ */}
      {isTierAtLeast(tier, 'VIP') ? (
        isOwnProfile && incomeStats ? (
          /* Kendi profili — tam gelir detayları */
          <View style={[s.sectionCard, { borderColor: 'rgba(255,107,53,0.15)' }]}>
            <Text style={s.sectionTitle}>💰 Gelir Özeti</Text>
            <View style={s.incomeGrid}>
              <View style={s.incomeBox}>
                <Text style={[s.incomeNum, { color: '#FFD700' }]}>{incomeStats.totalEarned.toLocaleString()}</Text>
                <Text style={s.incomeLabel}>Toplam SP</Text>
              </View>
              <View style={s.incomeDivider} />
              <View style={s.incomeBox}>
                <Text style={[s.incomeNum, { color: '#14B8A6' }]}>{incomeStats.roomFeeRooms}</Text>
                <Text style={s.incomeLabel}>Ücretli Oda</Text>
              </View>
              <View style={s.incomeDivider} />
              <View style={s.incomeBox}>
                <Text style={[s.incomeNum, { color: '#EC4899' }]}>{incomeStats.donationsReceived}</Text>
                <Text style={s.incomeLabel}>Bağış</Text>
              </View>
            </View>
          </View>
        ) : !isOwnProfile ? (
          /* Dışardan bakan — sadece "Monetized Creator" etiketi, kazanç gizli */
          <View style={[s.sectionCard, { borderColor: 'rgba(255,107,53,0.12)', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }]}>
            <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(255,107,53,0.12)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="star" size={14} color="#FF6B35" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#FF6B35' }}>Monetized Creator</Text>
              <Text style={{ fontSize: 10, color: '#64748B', marginTop: 1 }}>Desteklenebilir içerik üreticisi</Text>
            </View>
            <View style={[lk.badge, { borderColor: 'rgba(255,107,53,0.3)', backgroundColor: 'rgba(255,107,53,0.08)' }]}>
              <Ionicons name="checkmark" size={8} color="#FF6B35" />
              <Text style={[lk.badgeText, { color: '#FF6B35' }]}>VIP</Text>
            </View>
          </View>
        ) : null
      ) : isOwnProfile && !isTierAtLeast(tier, 'VIP') ? (
        <LockedFeatureHint label="Gelir Göstergesi" requiredTier="VIP" icon="cash-outline" />
      ) : null}

    </View>
  );
}

// ── Styles ──────────────────────────────────────
const s = StyleSheet.create({
  root: { marginHorizontal: 20, marginTop: 12, gap: 8 },

  // Banner
  bannerWrap: { height: 80, borderRadius: 14, overflow: 'hidden', marginBottom: 4 },
  bannerImage: { width: '100%', height: '100%', borderRadius: 14 },
  bannerGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 40 },

  // Tags
  tagsRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  tagText: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },

  // Stats card
  statsCard: {
    padding: 14, borderRadius: 14, backgroundColor: Colors.cardBg,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
  statBox: { alignItems: 'center', gap: 4 },
  statNumber: { fontSize: 15, fontWeight: '800', color: '#E2E8F0' },
  statDesc: { fontSize: 10, color: '#64748B', fontWeight: '600' },

  // Section card
  sectionCard: {
    padding: 14, borderRadius: 14, backgroundColor: Colors.cardBg,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#E2E8F0', marginBottom: 8 },
  emptyText: { fontSize: 11, color: '#475569', textAlign: 'center', paddingVertical: 12 },

  // Room row
  roomRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  roomIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  roomName: { fontSize: 13, fontWeight: '600', color: '#E2E8F0' },
  roomMeta: { fontSize: 10, color: '#64748B', marginTop: 2 },

  // Donate button
  donateBtn: { borderRadius: 12, overflow: 'hidden' },
  donateBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13, paddingHorizontal: 20,
  },
  donateBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },

  // VIP Stats
  vipStatsGrid: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 },
  vipStatBox: { alignItems: 'center', gap: 3 },
  vipStatNum: { fontSize: 16, fontWeight: '800' },
  vipStatLabel: { fontSize: 9, color: '#64748B', fontWeight: '600', textTransform: 'uppercase' },

  // Income
  incomeGrid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: 8 },
  incomeBox: { alignItems: 'center', gap: 3, flex: 1 },
  incomeNum: { fontSize: 17, fontWeight: '800' },
  incomeLabel: { fontSize: 9, color: '#64748B', fontWeight: '600' },
  incomeDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.06)' },
});
