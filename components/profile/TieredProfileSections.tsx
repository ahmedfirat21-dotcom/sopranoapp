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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={[lk.badge, { borderColor: `${tierDef.color}40`, backgroundColor: `${tierDef.color}10` }]}>
          <Ionicons name="lock-closed" size={8} color={tierDef.color} />
          <Text style={[lk.badgeText, { color: tierDef.color }]}>{requiredTier}+</Text>
        </View>
        <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.15)" />
      </View>
    </Pressable>
  );
};

const lk = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, 
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14, fontWeight: '500', color: '#E2E8F0' },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
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

  // Pro+
  bannerUrl?: string | null;
  onDonate?: () => void;

  // Plus+
  languageTag?: string;
  ageTag?: string;

  // Pro
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

      {/* ═══ Pro+ Banner ═══ */}
      {isTierAtLeast(tier, 'Pro') && bannerUrl ? (
        <View style={s.bannerWrap}>
          <Image source={{ uri: bannerUrl }} style={s.bannerImage} />
          <LinearGradient colors={['transparent', 'rgba(11,21,32,0.9)']} style={s.bannerGradient} />
        </View>
      ) : isTierAtLeast(tier, 'Pro') ? (
        <View style={s.bannerWrap}>
          <LinearGradient colors={tierDef.gradient as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.bannerImage, { opacity: 0.2 }]} />
        </View>
      ) : null}

      {/* ═══ Plus+ Etiketler ═══ */}
      {isTierAtLeast(tier, 'Plus') ? (
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
        <LockedFeatureHint label="Dil & Yaş Etiketleri" requiredTier="Plus" icon="globe-outline" />
      )}

      {/* ═══ Son Aktif Odalar (Aktivite Alanı) ═══ */}
      {recentRooms.length > 0 ? (
        <View style={s.sectionCard}>
          <Text style={s.sectionTitle}>📡 Son Aktif Odalar</Text>
          {recentRooms.slice(0, isTierAtLeast(tier, 'Plus') ? recentRooms.length : 5).map((room) => {
            const cat = CAT_ICONS[room.category] || CAT_ICONS.other;
            return (
              <Pressable key={room.id} style={s.roomRow} onPress={() => router.push(`/room/${room.id}` as any)}>
                <View style={[s.roomIcon, { backgroundColor: `${cat.color}15` }]}>
                  <Ionicons name={cat.icon as any} size={14} color={cat.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.roomName} numberOfLines={1}>{room.name}</Text>
                  <Text style={s.roomMeta}>{formatDate(room.created_at)} · Katılım</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.15)" />
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={s.sectionCard}>
          <Text style={s.sectionTitle}>📡 Son Aktif Odalar</Text>
          <Text style={s.emptyText}>Henüz aktif olunan oda yok</Text>
        </View>
      )}

      {/* ═══ Premium Özellikler Listesi (Settings List Match) ═══ */}
      <View style={s.sectionCard}>
        <Text style={s.sectionTitle}>PREMİUM ÖZELLİKLER (Önizleme)</Text>

        {!isTierAtLeast(tier, 'Plus') && (
          <LockedFeatureHint label="Kapsamlı Moderasyon Geçmişi" requiredTier="Plus" icon="shield-checkmark-outline" />
        )}
        
        {!isTierAtLeast(tier, 'Plus') && (
          <LockedFeatureHint label="Profil Teması" requiredTier="Plus" icon="color-palette-outline" />
        )}

        {!isTierAtLeast(tier, 'Pro') && (
          <LockedFeatureHint label="Kapak Fotoğrafı" requiredTier="Pro" icon="image-outline" />
        )}

        {!isTierAtLeast(tier, 'Pro') && (
          <LockedFeatureHint label="Takipçilere Özel İçerik" requiredTier="Pro" icon="lock-closed-outline" />
        )}

        {isTierAtLeast(tier, 'Pro') ? (
          !isOwnProfile && onDonate ? (
            <View style={[lk.container, { borderBottomWidth: 0, paddingVertical: 8 }]}>
              <Pressable style={[s.donateBtn, { width: '100%' }]} onPress={onDonate}>
                <LinearGradient colors={['#F59E0B', '#D97706']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.donateBtnGradient}>
                  <Ionicons name="heart" size={16} color="#FFF" />
                  <Text style={s.donateBtnText}>Destekle (SP Gönder)</Text>
                </LinearGradient>
              </Pressable>
            </View>
          ) : null
        ) : (
          !isOwnProfile && <LockedFeatureHint label="Destekle / SP Bağış" requiredTier="Pro" icon="heart-outline" />
        )}

        {isTierAtLeast(tier, 'Pro') ? (
          isGhost ? (
            <View style={[lk.container, { borderBottomWidth: 0 }]}>
              <View style={lk.left}>
                <View style={[lk.iconWrap, { backgroundColor: 'rgba(139,92,246,0.15)' }]}>
                  <Text style={{ fontSize: 14 }}>👻</Text>
                </View>
                <Text style={lk.label}>Ghost Mode Aktif</Text>
              </View>
            </View>
          ) : null
        ) : (
          <LockedFeatureHint label="Ghost Mode Göstergesi" requiredTier="Pro" icon="eye-off-outline" />
        )}
      </View>

      {/* ═══ Pro Gelişmiş İstatistik Paneli ═══ */}
      {isTierAtLeast(tier, 'Pro') ? (
        <View style={s.sectionCard}>
          <Text style={s.sectionTitle}>👑 Pro İstatistikler</Text>
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
        <LockedFeatureHint label="Gelişmiş İstatistik Paneli" requiredTier="Pro" icon="stats-chart-outline" />
      )}

      {/* ═══ Pro Gelir Göstergesi ═══ */}
      {isTierAtLeast(tier, 'Pro') ? (
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
              <Text style={[lk.badgeText, { color: '#FF6B35' }]}>Pro</Text>
            </View>
          </View>
        ) : null
      ) : isOwnProfile && !isTierAtLeast(tier, 'Pro') ? (
        <LockedFeatureHint label="Gelir Göstergesi" requiredTier="Pro" icon="cash-outline" />
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


  // Section card (Subtle Glass Area)
  sectionCard: {
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, 
    backgroundColor: 'rgba(255,255,255,0.015)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)',
  },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#CBD5E1', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  emptyText: { fontSize: 12, color: '#475569', textAlign: 'center', paddingVertical: 16 },

  // Room row timeline style
  roomRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.02)',
  },
  roomIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  roomName: { fontSize: 14, fontWeight: '600', color: '#F1F5F9' },
  roomMeta: { fontSize: 11, color: '#64748B', marginTop: 2 },

  // Donate button
  donateBtn: { borderRadius: 16, overflow: 'hidden' },
  donateBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, paddingHorizontal: 20,
  },
  donateBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  // Pro Stats
  vipStatsGrid: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 },
  vipStatBox: { alignItems: 'center', gap: 4 },
  vipStatNum: { fontSize: 18, fontWeight: '800' },
  vipStatLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Income
  incomeGrid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: 10 },
  incomeBox: { alignItems: 'center', gap: 4, flex: 1 },
  incomeNum: { fontSize: 18, fontWeight: '800' },
  incomeLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },
  incomeDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.05)' },
});
