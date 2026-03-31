import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Image, Pressable, ScrollView, Modal, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Gradients, Radius } from '../../constants/theme';
import { getAvatarSource } from '../../constants/avatars';
import { useAuth } from '../_layout';
import { supabase } from '../../constants/supabase';
import { ReferralService } from '../../services/referral';
import { ProfileService } from '../../services/database';
import { showToast } from '../../components/Toast';
import SopranoCoin from '../../components/SopranoCoin';
import PremiumAlert from '../../components/PremiumAlert';

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

  const displayName = profile?.display_name || user?.name || 'Kullanıcı';
  const avatarUrl = profile?.avatar_url || user?.avatar || 'https://i.pravatar.cc/120?img=3';
  const bio = profile?.bio || 'Henüz bir şey yazmadı ☕';
  const tier = profile?.tier || 'Silver';
  const coins = profile?.coins ?? 0;
  const isPlus = profile?.is_plus || false;
  const userId = firebaseUser?.uid || profile?.id;


  // Dinamik istatistikler
  const [stats, setStats] = useState({ followers: 0, following: 0, rooms: 0 });

  // Referans Modal
  const [showReferral, setShowReferral] = useState(false);
  const [referralCodeText, setReferralCodeText] = useState('');
  const [submittingReferral, setSubmittingReferral] = useState(false);
  const [showBoostAlert, setShowBoostAlert] = useState(false);

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
        showToast({ title: 'Tebrikler! 50 Coin kazandınız.', type: 'success' });
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
  const displayTier = isAdmin ? 'GodMaster' : tier;
  const tierGradient = isAdmin ? ['#DC2626', '#7F1D1D'] : tier === 'VIP' ? Gradients.vipGold : tier === 'Plat' ? Gradients.plat : Gradients.silverG;
  const tierIcon = isAdmin ? 'shield-checkmark' : tier === 'VIP' ? 'trophy' : tier === 'Plat' ? 'diamond-outline' : 'shield-half-outline';
  const tierBorderColor = isAdmin ? '#DC2626' : tier === 'VIP' ? Colors.amber : tier === 'Plat' ? Colors.cyan : Colors.silver;

  const STATS_DATA = [
    { label: 'Takipçi', value: String(stats.followers) },
    { label: 'Takip', value: String(stats.following) },
    { label: 'Oda', value: String(stats.rooms) },
  ];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 70 }}>
        {/* Header — sadece settings butonu */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profilim</Text>
          <Pressable style={styles.settingsBtn} onPress={() => router.push('/settings')}>
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

          {/* Edit Profile button */}
          <Pressable style={styles.editBtn} onPress={() => router.push('/edit-profile')}>
            <Ionicons name="create-outline" size={16} color={Colors.teal} />
            <Text style={styles.editBtnText}>Profili Düzenle</Text>
          </Pressable>
        </View>



        {/* Coin balance card */}
        <Pressable style={styles.coinCard} onPress={() => router.push('/wallet')}>
          <View style={styles.coinLeft}>
            <View style={[styles.coinIconWrap, { backgroundColor: `${Colors.gold}18` }]}>
              <SopranoCoin size={20} />
            </View>
            <View>
              <Text style={styles.coinLabel}>Soprano Coin</Text>
              <Text style={styles.coinBalance}>{coins} Soprano Coin</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.text3} />
        </Pressable>

        {/* Üyelik Planları */}
        <Pressable style={styles.plusCard} onPress={() => router.push('/plus')}>
          <View style={styles.coinLeft}>
            <View style={[styles.coinIconWrap, { backgroundColor: `${Colors.teal}18` }]}>
              <Ionicons name="star" size={20} color={isPlus ? Colors.gold : Colors.teal} />
            </View>
            <View>
              <Text style={styles.coinLabel}>Üyelik Planları</Text>
              <Text style={[styles.coinBalance, { color: isPlus ? Colors.teal : Colors.text3 }]}>
                {isPlus ? `✓ ${tier === 'VIP' ? 'VIP' : 'Plus'} Aktif` : 'Planları Gör'}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.text3} />
        </Pressable>

        {/* Quick Actions — her biri farklı sayfaya */}
        <View style={styles.quickActions}>
          <Pressable style={styles.actionCard} onPress={() => router.push('/store')}>
            <Ionicons name="cart-outline" size={22} color={Colors.gold} />
            <Text style={styles.actionLabel}>Mağaza</Text>
          </Pressable>
          <Pressable style={styles.actionCard} onPress={() => router.push('/wallet')}>
            <Ionicons name="wallet-outline" size={22} color={Colors.teal} />
            <Text style={styles.actionLabel}>Cüzdan</Text>
          </Pressable>
          <Pressable style={styles.actionCard} onPress={() => setShowBoostAlert(true)}>
            <Ionicons name="rocket-outline" size={22} color={Colors.cyan} />
            <Text style={styles.actionLabel}>Profil Boost</Text>
          </Pressable>
          <Pressable style={styles.actionCard} onPress={() => setShowReferral(true)}>
            <Ionicons name="gift-outline" size={22} color={Colors.amber} />
            <Text style={styles.actionLabel}>Davet Kodu</Text>
          </Pressable>
        </View>

        {/* GodMaster Admin Paneli — sadece admin */}
        {profile?.is_admin && (
          <Pressable
            style={[styles.coinCard, { marginTop: 16, borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.04)' }]}
            onPress={() => router.push('/admin' as any)}
          >
            <View style={styles.coinLeft}>
              <View style={[styles.coinIconWrap, { backgroundColor: '#EF444418' }]}>
                <Ionicons name="shield-checkmark" size={20} color="#EF4444" />
              </View>
              <View>
                <Text style={styles.coinLabel}>GodMaster Panel</Text>
                <Text style={[styles.coinBalance, { color: '#EF4444' }]}>Platform Yönetimi</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#EF4444" />
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
              <Text style={styles.modalDesc}>Eger bir arkadasin seni davet ettiyse, onun kodunu girip 50 Soprano Coin kazanabilirsin.</Text>
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
        message={"Profilini 1 saat boyunca Keşfet sayfasında öne çıkar.\n\nBedel: 10 Soprano Coin"}
        type="info"
        icon="rocket"
        onDismiss={() => setShowBoostAlert(false)}
        buttons={[
          { text: 'Vazgeç', style: 'cancel' },
          {
            text: 'Boost Et (10 Coin)',
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  
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

  // Coin card
  coinCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 20, marginBottom: 10, padding: 16, height: 75,
    borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  plusCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 20, marginBottom: 16, padding: 16,
    borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  coinLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  coinIconWrap: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  coinLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
  coinBalance: { fontSize: 12, color: Colors.gold, marginTop: 2 },

  // Quick actions grid
  quickActions: { 
    flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 4,
  },
  actionCard: {
    flex: 1, alignItems: 'center', gap: 8, paddingVertical: 16,
    borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  actionLabel: { fontSize: 11, fontWeight: '600', color: '#94A3B8', letterSpacing: 0.5 },
  
  // Upgrade Banner
  upgradeCard: { marginHorizontal: 20, marginBottom: 16, borderRadius: Radius.default, overflow: 'hidden', borderWidth: 1, borderColor: Colors.teal + '30' },
  upgradeInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  upgradeLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  upgradeIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.teal + '20', justifyContent: 'center', alignItems: 'center' },
  upgradeTextWrap: { gap: 2 },
  upgradeTitle: { fontSize: 13, fontWeight: '700', color: Colors.text },
  upgradeDesc: { fontSize: 11, color: Colors.text2 },
});
