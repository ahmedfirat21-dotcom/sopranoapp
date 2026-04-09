import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Image, Pressable, ScrollView, Modal, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Gradients, Radius } from '../../constants/theme';
import { getAvatarSource, getLevelFromSP, getLevelColors, getTierBadgeInfo } from '../../constants/avatars';
import { useAuth, useTheme } from '../_layout';
import { supabase } from '../../constants/supabase';
import { ReferralService } from '../../services/referral';
import { ProfileService } from '../../services/database';
import { showToast } from '../../components/Toast';

import AppBackground from '../../components/AppBackground';
import PremiumAlert from '../../components/PremiumAlert';
import { BadgeCheckerService, type UserBadge } from '../../services/engagement/badges';
import AnimatedAvatar from '../../components/AnimatedAvatar';
import { TierBadge, BadgeGrid } from '../../components/progression';
import { TIER_DEFINITIONS } from '../../constants/tiers';
import { migrateLegacyTier } from '../../types';
import type { SubscriptionTier } from '../../types';

/** Son görülme zamanını insanca formatlayan yardımcı */
function _formatLastSeen(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'az önce';
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} saat önce`;
  const days = Math.floor(hours / 24);
  return `${days} gün önce`;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, user, firebaseUser, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();
  useTheme();

  const displayName = profile?.display_name || user?.name || 'Kullanıcı';
  const avatarUrl = profile?.avatar_url || user?.avatar || 'https://i.pravatar.cc/120?img=3';
  const bio = profile?.bio || 'Henüz bir şey yazmadı ☕';
  const tier = profile?.subscription_tier || 'Free';
  const subscriptionTier: SubscriptionTier = migrateLegacyTier(profile?.subscription_tier || 'Free');
  const isPaid = subscriptionTier !== 'Free';
  const userId = firebaseUser?.uid || profile?.id;


  // Dinamik istatistikler
  const [stats, setStats] = useState({ followers: 0, following: 0, rooms: 0 });

  // Referans Modal
  const [showReferral, setShowReferral] = useState(false);
  const [referralCodeText, setReferralCodeText] = useState('');
  const [submittingReferral, setSubmittingReferral] = useState(false);
  const [showBoostAlert, setShowBoostAlert] = useState(false);
  const [badges, setBadges] = useState<UserBadge[]>([]);

  const loadStats = useCallback(async () => {
    if (!userId) return;
    try {
      // Takipçi sayısı (arkadaşlık tablosundan)
      const { count: followerCount } = await supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('friend_id', userId)
        .eq('status', 'accepted');

      // Takip sayısı
      const { count: followingCount } = await supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'accepted');

      // Oluşturulan oda sayısı
      const { count: roomCount } = await supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true })
        .eq('host_id', userId);

      setStats({
        followers: followerCount ?? 0,
        following: followingCount ?? 0,
        rooms: roomCount ?? 0,
      });

      // Rozetleri yükle + otomatik kontrol
      await BadgeCheckerService.checkAll(userId);
      const userBadges = await BadgeCheckerService.getUserBadges(userId);
      setBadges(userBadges);
    } catch (err) {
      console.warn('Stats yuklenemedi:', err);
    }
  }, [userId]);

  const handleClaimReferral = async () => {
    if (!userId || !referralCodeText.trim()) return;
    setSubmittingReferral(true);
    try {
      const res = await ReferralService.applyCode(referralCodeText, userId);
      if (res.success) {
        showToast({ title: 'Tebrikler! 50 SP kazandınız.', type: 'success' });
        setShowReferral(false);
        setReferralCodeText('');
      } else {
        showToast({ title: 'Geçersiz veya kullanılmış davet kodu', message: res.message, type: 'error' });
      }
    } catch (err: any) {
      showToast({ title: 'Hata oluştu', message: err.message, type: 'error' });
    } finally {
      setSubmittingReferral(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Admin (GodMaster) özel tier
  const isAdmin = profile?.is_admin || false;
  const displayTier = isAdmin ? 'GodMaster' : subscriptionTier;
  const tierDef = TIER_DEFINITIONS[subscriptionTier as keyof typeof TIER_DEFINITIONS];
  const tierGradient = isAdmin ? ['#DC2626', '#7F1D1D'] : tierDef ? tierDef.gradient : ['#94A3B8', '#64748B'];
  const tierIcon = isAdmin ? 'shield-checkmark' : tierDef?.icon || 'person-outline';
  const tierBorderColor = isAdmin ? '#DC2626' : tierDef?.color || '#94A3B8';

  const STATS_DATA = [
    { label: 'Takipçi', value: String(stats.followers) },
    { label: 'Takip', value: String(stats.following) },
    { label: 'Oda', value: String(stats.rooms) },
  ];

  return (
    <AppBackground variant="profile">
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 70 }}>
        {/* Header — sadece settings butonu */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profilim</Text>
          <Pressable style={styles.settingsBtn} onPress={() => router.push('/settings' as any)}>
            <Ionicons name="settings-outline" size={20} color={Colors.text2} />
          </Pressable>
        </View>

        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={[styles.avatarContainer, profile?.active_frame && { padding: 4 }]}>
            {/* GodMaster kırmızı parlayan aura */}
            {isAdmin && (
              <View style={[StyleSheet.absoluteFill, { borderRadius: 60, borderWidth: 3, borderColor: '#DC2626', opacity: 1, shadowColor: '#DC2626', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 12, elevation: 8 }]} />
            )}
            {/* If there is an active frame, we render an outer animated dashed line/border to fake an aura */}
            {!isAdmin && profile?.active_frame === 'frame_neon_cyber' && (
              <View style={[StyleSheet.absoluteFill, { borderRadius: 60, borderWidth: 4, borderColor: '#3B82F6', opacity: 0.8, borderStyle: 'dashed' }]} />
            )}
            {!isAdmin && profile?.active_frame === 'frame_gold_crown' && (
              <View style={[StyleSheet.absoluteFill, { borderRadius: 60, borderWidth: 4, borderColor: '#FDE047', opacity: 1 }]} />
            )}
            {!isAdmin && profile?.active_frame === 'frame_fire_aura' && (
              <View style={[StyleSheet.absoluteFill, { borderRadius: 60, borderWidth: 4, borderColor: '#EF4444', opacity: 0.9, borderStyle: 'dotted' }]} />
            )}
            <Image source={getAvatarSource(avatarUrl)} style={[styles.avatar, { borderColor: tierBorderColor }]} />
            <LinearGradient colors={tierGradient as [string, string]} style={styles.tierBadge}>
              <Ionicons name={tierIcon as any} size={10} color="#fff" />
              <Text style={styles.tierText}>{displayTier}</Text>
            </LinearGradient>
          </View>
          <View style={styles.nameRow}>
            <Text style={[styles.profileName, isAdmin && { color: '#F87171' }]}>{displayName}</Text>
            {isAdmin ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 4, gap: 2 }}>
                <Ionicons name="shield-checkmark" size={16} color="#DC2626" />
              </View>
            ) : (
              <Ionicons name="checkmark-circle" size={18} color={Colors.emerald} style={{ marginLeft: 4 }} />
            )}
          </View>
          {profile?.username && <Text style={[styles.profileUsername, isAdmin && { color: '#F87171' }]}>@{profile.username}</Text>}
          <Text style={styles.profileBio}>{bio}</Text>

          {/* Şu An Durum Satırı */}
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: profile?.is_online ? Colors.emerald : Colors.text3 }]} />
            <Text style={styles.statusText}>
              {profile?.is_online ? 'Çevrimiçi ☕' : `Son görülme: ${profile?.last_seen ? _formatLastSeen(profile.last_seen) : 'bilinmiyor'}`}
            </Text>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            {STATS_DATA.map((stat, i) => (
              <View key={i} style={styles.statItem}>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* ★ Başarı Rozetleri — Premium Grid */}
          <View style={styles.badgesSection}>
            <BadgeGrid unlockedBadges={badges} compact />
          </View>

          {/* Edit Profile button */}
          <Pressable style={styles.editBtn} onPress={() => router.push('/edit-profile')}>
            <Ionicons name="create-outline" size={16} color={Colors.teal} />
            <Text style={styles.editBtnText}>Profili Düzenle</Text>
          </Pressable>
        </View>




        {/* ★ Hesabım — Üyelik Kartı */}
        <Pressable style={styles.walletCard} onPress={() => router.push('/plus')}>
          <View style={styles.walletHeader}>
            <Text style={styles.walletTitle}>Hesabım</Text>
            <Ionicons name="chevron-forward" size={16} color="#64748B" />
          </View>
          <View style={styles.walletRow}>
            {/* SP */}
            <View style={styles.walletItem}>
              <View style={[styles.walletIconWrap, { backgroundColor: `${Colors.gold}15` }]}>
                <Ionicons name="star" size={18} color={Colors.gold} />
              </View>
              <Text style={styles.walletAmount}>{(profile?.system_points || 0).toLocaleString()}</Text>
              <Text style={styles.walletLabel}>SP</Text>
            </View>
            {/* Divider */}
            <View style={styles.walletDivider} />
            {/* Membership */}
            <Pressable style={styles.walletItem} onPress={() => router.push('/plus')}>
              <View style={[styles.walletIconWrap, { backgroundColor: `${tierDef?.color || Colors.teal}15` }]}>
                <Ionicons name={isPaid ? 'star' : 'star-outline'} size={18} color={isPaid ? (tierDef?.color || Colors.gold) : Colors.accentTeal} />
              </View>
              <Text style={[styles.walletAmount, { color: isPaid ? (tierDef?.color || Colors.gold) : '#94A3B8', fontSize: 13 }]}>
                {isPaid ? 'Aktif ✓' : 'Yükselt'}
              </Text>
              <Text style={styles.walletLabel}>{isPaid ? subscriptionTier : 'Üyelik'}</Text>
            </Pressable>
          </View>
        </Pressable>

        {/* ★ Quick Actions — 4-column grid */}
        <View style={styles.quickActions}>
          {[
            { icon: 'mic-outline' as const, label: 'Oda Kur', color: Colors.accentTeal, route: '/create-room' },
            { icon: 'cart-outline' as const, label: 'Üyelik', color: Colors.gold, route: '/plus' },
            { icon: 'trophy-outline' as const, label: 'Sıralama', color: '#F59E0B', route: '/leaderboard' },
            { icon: 'gift-outline' as const, label: 'Davet', color: '#A78BFA', route: null },
          ].map((action, i) => (
            <Pressable
              key={i}
              style={styles.actionCard}
              onPress={() => action.route ? router.push(action.route as any) : setShowReferral(true)}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: action.color + '12' }]}>
                <Ionicons name={action.icon} size={20} color={action.color} />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* GodMaster Admin Paneli — sadece admin */}
        {profile?.is_admin && (
          <Pressable
            style={[styles.walletCard, { marginTop: 16, borderColor: 'rgba(239,68,68,0.25)', backgroundColor: 'rgba(239,68,68,0.04)' }]}
            onPress={() => router.push('/admin' as any)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={[styles.walletIconWrap, { backgroundColor: '#EF444418' }]}>
                  <Ionicons name="shield-checkmark" size={20} color="#EF4444" />
                </View>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#F1F5F9' }}>GodMaster Panel</Text>
                  <Text style={{ fontSize: 11, color: '#EF4444', marginTop: 2 }}>Platform Yönetimi</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#EF4444" />
            </View>
          </Pressable>
        )}

        {/* Referans Modal */}
        <Modal visible={showReferral} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Davet Kodu Gir</Text>
                <Pressable onPress={() => setShowReferral(false)}>
                  <Ionicons name="close" size={24} color={Colors.text2} />
                </Pressable>
              </View>
              <Text style={styles.modalDesc}>Eger bir arkadasin seni davet ettiyse, onun kodunu girip 50 SP kazanabilirsin.</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Örn: XHFDK9"
                placeholderTextColor={Colors.text3}
                value={referralCodeText}
                onChangeText={setReferralCodeText}
                autoCapitalize="characters"
              />
              <Pressable 
                style={[styles.modalBtn, (!referralCodeText || submittingReferral) && { opacity: 0.5 }]} 
                onPress={handleClaimReferral}
                disabled={!referralCodeText || submittingReferral}
              >
                {submittingReferral ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalBtnText}>Kodu Kullan</Text>}
              </Pressable>
            </View>
          </View>
        </Modal>


      </ScrollView>

      {/* Profil Boost Premium Alert */}
      <PremiumAlert
        visible={showBoostAlert}
        title="Profil Boost"
        message={"Profilini 1 saat boyunca Keşfet sayfasında öne çıkar.\n\nBedel: 10 SP"}
        type="info"
        icon="rocket"
        onDismiss={() => setShowBoostAlert(false)}
        buttons={[
          { text: 'Vazgeç', style: 'cancel' },
          {
            text: 'Boost Et (10 SP)',
            onPress: async () => {
              if (!profile?.id) return;
              try {
                await ProfileService.boostProfile(profile.id, 10);
                await refreshProfile();
                showToast({ title: 'Profil Boost aktif!', message: 'Keşfet\'te 1 saat boyunca öne çıkacaksın.', type: 'success' });
              } catch (err: any) {
                showToast({ title: 'Boost başarısız', message: err.message || 'Hata oluştu', type: 'error' });
              }
            },
          },
        ]}
      />
    </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  
  // Header  
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 20, 
    paddingTop: 60,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.text },
  settingsBtn: { 
    width: 40, height: 40, borderRadius: Radius.sm, 
    backgroundColor: Colors.glass2, borderWidth: 1, 
    borderColor: Colors.glassBorder, justifyContent: 'center', alignItems: 'center',
  },

  // Profile Card
  profileCard: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 12 },
  avatarContainer: { position: 'relative', marginBottom: 12 },
  avatar: { width: 110, height: 110, borderRadius: 55, borderWidth: 1.5, borderColor: '#A0AEC0' },
  tierBadge: { 
    position: 'absolute', bottom: -2, right: -2, 
    flexDirection: 'row', alignItems: 'center', gap: 3, 
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, 
    borderWidth: 2, borderColor: Colors.bg,
  },
  tierText: { fontSize: 9, fontWeight: '700', color: '#fff' },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  profileName: { fontSize: 24, fontWeight: '700', color: '#F1F5F9', letterSpacing: 0.3 },

  profileUsername: { fontSize: 13, color: '#94A3B8', letterSpacing: 2, marginBottom: 4 },
  profileBio: { fontSize: 13, color: '#A0AEC0', textAlign: 'center', marginBottom: 8, paddingHorizontal: 20 },

  // Status Row
  statusRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 16, paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: Radius.full, backgroundColor: Colors.glass2,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '600', color: Colors.text2 },
  
  // Stats
  statsRow: { flexDirection: 'row', gap: 32, marginBottom: 16 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '600', color: '#E2E8F0', letterSpacing: 0.5 },
  statLabel: { fontSize: 11, color: '#64748B', marginTop: 2, letterSpacing: 1 },
  authCardTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  authCardDesc: { fontSize: 13, color: Colors.text3, textAlign: 'center', marginBottom: 16, lineHeight: 18 },
  authBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.teal, paddingHorizontal: 24, paddingVertical: 12, borderRadius: Radius.full },
  authBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: Colors.bg2, width: '100%', borderRadius: Radius.default, padding: 20, borderWidth: 1, borderColor: Colors.glassBorder },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  modalDesc: { fontSize: 13, color: Colors.text2, lineHeight: 20, marginBottom: 20 },
  modalInput: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: Radius.default, padding: 14, color: Colors.text, fontSize: 16, textAlign: 'center', marginBottom: 20, letterSpacing: 2 },
  modalBtn: { backgroundColor: Colors.teal, paddingVertical: 14, borderRadius: Radius.default, alignItems: 'center' },
  modalBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  
  // Edit button
  editBtn: { 
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 28, paddingVertical: 10, borderRadius: Radius.full, 
    backgroundColor: Colors.glass3, borderWidth: 1, borderColor: Colors.teal + '30',
    marginBottom: 24,
  },
  editBtnText: { fontSize: 13, fontWeight: '600', color: Colors.teal },

  // ★ Birleşik Cüzdan Kartı
  walletCard: {
    marginHorizontal: 20, marginBottom: 14, padding: 16,
    borderRadius: 16, backgroundColor: Colors.cardBg,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  walletHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 14,
  },
  walletTitle: { fontSize: 14, fontWeight: '700', color: '#E2E8F0', letterSpacing: 0.3 },
  walletRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
  },
  walletItem: { alignItems: 'center', gap: 4, flex: 1 },
  walletIconWrap: {
    width: 38, height: 38, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  walletAmount: { fontSize: 16, fontWeight: '700', color: Colors.gold },
  walletLabel: { fontSize: 10, fontWeight: '600', color: '#64748B', letterSpacing: 0.5, textTransform: 'uppercase' },
  walletDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.06)' },

  // Quick actions grid
  quickActions: { 
    flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 4,
  },
  actionCard: {
    flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14,
    borderRadius: 16, backgroundColor: Colors.cardBg,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  actionIconWrap: {
    width: 36, height: 36, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  actionLabel: { fontSize: 10, fontWeight: '600', color: '#94A3B8', letterSpacing: 0.5 },
  
  // Upgrade Banner
  upgradeCard: { marginHorizontal: 20, marginBottom: 16, borderRadius: Radius.default, overflow: 'hidden', borderWidth: 1, borderColor: Colors.teal + '30' },
  upgradeInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  upgradeLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  upgradeIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.teal + '20', justifyContent: 'center', alignItems: 'center' },
  upgradeTextWrap: { gap: 2 },
  upgradeTitle: { fontSize: 13, fontWeight: '700', color: Colors.text },
  upgradeDesc: { fontSize: 11, color: Colors.text2 },

  // Badges
  badgesSection: { marginHorizontal: 20, marginTop: 12, marginBottom: 4 },
});
