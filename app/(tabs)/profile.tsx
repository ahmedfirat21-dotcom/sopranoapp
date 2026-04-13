import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Image, Pressable, ScrollView, Modal, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Shadows } from '../../constants/theme';
import { getAvatarSource, getLevelFromSP, getLevelColors } from '../../constants/avatars';
import { useAuth, useTheme } from '../_layout';
import { supabase } from '../../constants/supabase';
import { ReferralService } from '../../services/referral';
import { ProfileService } from '../../services/database';
import { showToast } from '../../components/Toast';
import FollowListModal from '../../components/FollowListModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppBackground from '../../components/AppBackground';
import PremiumAlert, { type AlertButton } from '../../components/PremiumAlert';
import { BadgeCheckerService, type UserBadge } from '../../services/engagement/badges';
import { TIER_DEFINITIONS, isTierAtLeast } from '../../constants/tiers';
import { migrateLegacyTier } from '../../types';
import type { SubscriptionTier } from '../../types';


export default function ProfileScreen() {
  const router = useRouter();
  const { profile, user, firebaseUser, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();
  useTheme();

  const displayName = profile?.display_name || user?.name || 'Kullanıcı';
  const avatarUrl = profile?.avatar_url || user?.avatar || 'https://i.pravatar.cc/120?img=3';
  const bio = profile?.bio || 'Henüz bir şey yazmadı ☕';
  
  const subscriptionTier: SubscriptionTier = migrateLegacyTier(profile?.subscription_tier || 'Free');
  const userId = firebaseUser?.uid || profile?.id;

  // Dinamik istatistikler
  const [stats, setStats] = useState({ followers: 0, following: 0, rooms: 0 });
  const [recentRooms, setRecentRooms] = useState<any[]>([]);

  // Referans Modal
  const [showReferral, setShowReferral] = useState(false);
  const [referralCodeText, setReferralCodeText] = useState('');
  const [submittingReferral, setSubmittingReferral] = useState(false);
  const [showBoostAlert, setShowBoostAlert] = useState(false);
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [cAlert, setCAlert] = useState<{ visible: boolean; title: string; message: string; type?: any; buttons?: any[] }>({ visible: false, title: '', message: '' });

  // Takipçi/Takip listesi modal
  const [followModalVisible, setFollowModalVisible] = useState(false);
  const [followModalTab, setFollowModalTab] = useState<'followers' | 'following'>('followers');

  const loadStats = useCallback(async () => {
    if (!userId) return;
    try {
      const [followerRes, followingRes, roomRes] = await Promise.all([
        supabase.from('friendships').select('*', { count: 'exact', head: true })
          .eq('friend_id', userId).eq('status', 'accepted'),
        supabase.from('friendships').select('*', { count: 'exact', head: true })
          .eq('user_id', userId).eq('status', 'accepted'),
        supabase.from('rooms').select('*', { count: 'exact', head: true })
          .eq('host_id', userId),
      ]);

      setStats({
        followers: followerRes.count ?? 0,
        following: followingRes.count ?? 0,
        rooms: roomRes.count ?? 0,
      });

      // Rozetleri yükle + otomatik kontrol (saatte max 1 kez)
      try {
        const lastCheck = await AsyncStorage.getItem('soprano_badge_check_ts');
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        if (!lastCheck || parseInt(lastCheck) < oneHourAgo) {
          await BadgeCheckerService.checkAll(userId);
          await AsyncStorage.setItem('soprano_badge_check_ts', Date.now().toString());
        }
      } catch {}
      const userBadges = await BadgeCheckerService.getUserBadges(userId);
      setBadges(userBadges);

      // Son odalar
      try {
        const rooms = await ProfileService.getRecentRooms(userId);
        setRecentRooms(rooms);
      } catch {}
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

  const spBalance = profile?.system_points ?? (profile as any)?.sp ?? 0;
  const userLevel = getLevelFromSP(spBalance, subscriptionTier);
  const levelColors = getLevelColors(userLevel);

  return (
    <AppBackground variant="profile">
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 70 }}>

        {/* ═══ Premium Profil Kartı ═══ */}
        <View style={p.card}>
          <LinearGradient
            colors={['rgba(20,184,166,0.08)', 'rgba(15,23,42,0.95)', 'rgba(15,23,42,0.98)']}
            style={p.cardGlow}
          />
          {/* Üst: Avatar + Bilgi */}
          <View style={p.identityRow}>
            <View style={p.avatarBox}>
              <View style={[p.avatarRing, { borderColor: tierBorderColor, shadowColor: tierBorderColor }]}>
                <Image source={getAvatarSource(avatarUrl)} style={p.avatarImg} />
              </View>
              <LinearGradient colors={tierGradient as [string, string]} style={p.tierPill}>
                <Ionicons name={tierIcon as any} size={7} color="#fff" />
                <Text style={p.tierPillText}>{displayTier}</Text>
              </LinearGradient>
              {/* ★ U2 FIX: Online durumu avatar yanında */}
              <View style={[p.onlineDot, { backgroundColor: profile?.is_online ? '#22C55E' : '#475569' }]} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[p.displayName, isAdmin && { color: '#F87171' }]} numberOfLines={1}>{displayName}</Text>
                {isAdmin && (
                  <Ionicons name="shield-checkmark" size={13} color="#DC2626" style={{ marginLeft: 4 }} />
                )}
              </View>
              {profile?.username && <Text style={p.username}>@{profile.username}</Text>}
              <Text style={p.bio} numberOfLines={2}>{bio}</Text>
            </View>
            <Pressable style={p.editBtn} onPress={() => router.push('/edit-profile')}>
              <Ionicons name="create-outline" size={16} color="#14B8A6" />
            </Pressable>
          </View>

          {/* ★ U2 FIX: Stat Satırı — Online durumu avatar yanına taşındı */}
          <View style={p.statsRow}>
            <Pressable style={p.statItem} onPress={() => { setFollowModalTab('followers'); setFollowModalVisible(true); }}>
              <Text style={p.statNum}>{stats.followers}</Text>
              <Text style={p.statLabel}>Takipçi</Text>
            </Pressable>
            <View style={p.statDiv} />
            <Pressable style={p.statItem} onPress={() => { setFollowModalTab('following'); setFollowModalVisible(true); }}>
              <Text style={p.statNum}>{stats.following}</Text>
              <Text style={p.statLabel}>Takip</Text>
            </Pressable>
            <View style={p.statDiv} />
            <Pressable style={p.statItem} onPress={() => router.push('/(tabs)/myrooms' as any)}>
              <Text style={p.statNum}>{stats.rooms}</Text>
              <Text style={p.statLabel}>Oda</Text>
            </Pressable>
          </View>
        </View>

        {/* ═══ SP Cüzdan Kartı ═══ */}
        <View style={p.walletCard}>
          <LinearGradient
            colors={['rgba(251,191,36,0.06)', 'rgba(251,191,36,0.02)', 'transparent']}
            style={p.walletGlow}
          />
          <View style={p.walletHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="diamond" size={14} color="#FBBF24" />
              <Text style={p.walletTitle}>SP Cüzdanım</Text>
            </View>
            <LinearGradient colors={[levelColors.text, levelColors.text + 'CC']} style={p.levelBadge}>
              <Text style={p.levelText}>Lv.{userLevel}</Text>
            </LinearGradient>
          </View>
          <View style={p.walletBody}>
            <View>
              <Text style={p.walletAmount}>{spBalance.toLocaleString()}</Text>
              <Text style={p.walletSub}>Soprano Points</Text>
            </View>
            <Pressable style={p.buyBtn} onPress={() => router.push('/sp-store' as any)}>
              <Ionicons name="cart" size={14} color="#0F172A" />
              <Text style={p.buyBtnText}>Mağaza</Text>
            </Pressable>
          </View>
        </View>

        {/* ═══ AYARLAR VE YÖNETİM ═══ */}
        <View style={{ marginHorizontal: 16, marginTop: 10, marginBottom: 6 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', letterSpacing: 1 }}>AYARLAR VE YÖNETİM</Text>
        </View>
        <View style={styles.listContainer}>
          <Pressable style={styles.listItem} onPress={() => router.push('/settings' as any)}>
            <Ionicons name="settings" size={20} color="#94A3B8" />
            <Text style={styles.listItemText}>Ayarlar</Text>
            <Ionicons name="chevron-forward" size={16} color="#64748B" />
          </Pressable>
          <Pressable style={styles.listItem} onPress={() => router.push('/plus' as any)}>
            <Ionicons name="star" size={20} color={Colors.gold} />
            <Text style={[styles.listItemText, { color: '#F8FAFC' }]}>Soprano Premium</Text>
            <Text style={{ fontSize: 10, color: Colors.gold, fontWeight: '700', marginRight: 4 }}>{subscriptionTier}</Text>
            <Ionicons name="chevron-forward" size={16} color="#64748B" />
          </Pressable>
          <Pressable style={styles.listItem} onPress={() => router.push('/leaderboard' as any)}>
            <Ionicons name="podium" size={20} color="#D4AF37" />
            <Text style={styles.listItemText}>Liderlik Tablosu</Text>
            <Ionicons name="chevron-forward" size={16} color="#64748B" />
          </Pressable>
          <Pressable style={styles.listItem} onPress={() => setShowReferral(true)}>
            <Ionicons name="gift" size={20} color="#A78BFA" />
            <Text style={styles.listItemText}>Davet Kodu Kullan</Text>
            <Text style={{ fontSize: 10, color: '#A78BFA', fontWeight: '600', marginRight: 4 }}>+50 SP</Text>
            <Ionicons name="chevron-forward" size={16} color="#64748B" />
          </Pressable>
          {/* ★ U5 FIX: Rozetler her zaman gösterilir */}
          <Pressable style={styles.listItem} onPress={() => {
            if (userId) router.push(`/user/${userId}` as any);
          }}>
            <Ionicons name="trophy" size={20} color="#FBBF24" />
            <Text style={styles.listItemText}>Rozetlerim</Text>
            <View style={{ backgroundColor: badges.length > 0 ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.06)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: badges.length > 0 ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.08)', marginRight: 4 }}>
              <Text style={{ fontSize: 10, color: badges.length > 0 ? '#FBBF24' : '#64748B', fontWeight: '700' }}>{badges.length > 0 ? badges.length : '—'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#64748B" />
          </Pressable>
          <Pressable style={[styles.listItem, { borderBottomWidth: 0 }]} onPress={() => {
            if (isTierAtLeast(subscriptionTier, 'Bronze')) {
              setShowBoostAlert(true);
            } else {
              showToast({ title: 'Bronze+ Gerekli', message: 'Profil boost özelliği Bronze ve üzeri üyeliklerde kullanılabilir.', type: 'warning' });
            }
          }}>
            <Ionicons name="rocket" size={20} color="#F472B6" />
            <Text style={styles.listItemText}>Profilimi Öne Çıkar</Text>
            <Text style={{ fontSize: 10, color: '#F472B6', fontWeight: '600', marginRight: 4 }}>10 SP</Text>
            <Ionicons name="chevron-forward" size={16} color="#64748B" />
          </Pressable>
        </View>

        {/* ═══ YÖNETTİĞİM ODALAR ═══ */}
        <View style={{ marginHorizontal: 16, marginTop: 10, marginBottom: 6 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', letterSpacing: 1 }}>YÖNETTİĞİM ODALAR</Text>
        </View>
        <View style={styles.listContainer}>
          {recentRooms.length > 0 ? (
            recentRooms.map((room, idx) => (
              <Pressable key={room.id} style={[styles.listItem, idx === recentRooms.length - 1 && { borderBottomWidth: 0 }]} onPress={() => router.push(`/room/${room.id}` as any)}>
                <Ionicons name="radio" size={16} color="#14B8A6" />
                <Text style={[styles.listItemText, { marginLeft: 4 }]}>{room.name}</Text>
                <Ionicons name="enter-outline" size={16} color="#94A3B8" />
              </Pressable>
            ))
          ) : (
            <Pressable style={[styles.listItem, { borderBottomWidth: 0 }]} onPress={() => router.push('/create-room' as any)}>
               <Ionicons name="add-circle" size={20} color="#14B8A6" />
               <Text style={styles.listItemText}>Yeni Oda Kur</Text>
               <Ionicons name="chevron-forward" size={16} color="#64748B" />
            </Pressable>
          )}
        </View>

        {/* GodMaster Admin Paneli — admin only */}
        {profile?.is_admin && (
          <>
            <View style={{ marginHorizontal: 16, marginTop: 10, marginBottom: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#EF4444', letterSpacing: 1 }}>SİSTEM YÖNETİMİ</Text>
            </View>
            <View style={[styles.listContainer, { borderColor: '#c94444' }]}>
              <Pressable style={[styles.listItem, { borderBottomWidth: 0 }]} onPress={() => router.push('/admin' as any)}>
                <Ionicons name="shield-checkmark" size={20} color="#EF4444" />
                <Text style={styles.listItemText}>GodMaster Panel</Text>
                <Ionicons name="chevron-forward" size={16} color="#EF4444" />
              </Pressable>
            </View>
          </>
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
              <Text style={styles.modalDesc}>Eğer bir arkadaşın seni davet ettiyse, onun kodunu girip 50 SP kazanabilirsin.</Text>
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
      {/* ★ U6 FIX: Boost alert'te mevcut SP bakiyesi gösterilir */}
      <PremiumAlert
        visible={showBoostAlert}
        title="Profil Boost"
        message={`Profilini 1 saat boyunca Keşfet sayfasında öne çıkar.\n\nBedel: 10 SP\nMevcut bakiye: ${spBalance.toLocaleString()} SP${spBalance < 10 ? '\n⚠️ Yetersiz bakiye!' : ''}`}
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

      {/* Takipçi/Takip Listesi Modal */}
      {userId && (
        <FollowListModal
          visible={followModalVisible}
          onClose={() => setFollowModalVisible(false)}
          userId={userId}
          currentUserId={userId}
          initialTab={followModalTab}
          isOwnProfile={true}
        />
      )}
      <PremiumAlert {...cAlert} onDismiss={() => setCAlert(prev => ({ ...prev, visible: false }))} />
    </View>
    </AppBackground>
  );
}

// Shadows.card ve Shadows.text theme.ts'den geliyor
const _cardShadow = Shadows.card;
const _textGlow = Shadows.text;

// ═══ Premium Profil Stilleri ═══
const p = StyleSheet.create({
  card: {
    // ★ U1 FIX: Safe area AppBackground tarafından yönetiliyor, fazla margin kaldırıldı
    marginHorizontal: 16, marginTop: 16, marginBottom: 10,
    borderRadius: 16, overflow: 'hidden',
    backgroundColor: '#414e5f',
    borderWidth: 1, borderColor: '#5b9a8b',
    ..._cardShadow,
  },
  cardGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 80,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
  },
  identityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12,
  },
  avatarBox: { position: 'relative' as const },
  onlineDot: {
    position: 'absolute' as const, top: 0, right: -2,
    width: 12, height: 12, borderRadius: 6,
    borderWidth: 2, borderColor: '#414e5f',
  },
  avatarRing: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 2.5, padding: 2,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 6,
  },
  avatarImg: { width: '100%', height: '100%', borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.05)' },
  tierPill: {
    position: 'absolute' as const, bottom: -3, right: -6,
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 10,
    borderWidth: 2, borderColor: '#414e5f',
  },
  tierPillText: { fontSize: 7, fontWeight: '800', color: '#fff', letterSpacing: 0.3, ..._textGlow },
  displayName: { fontSize: 16, fontWeight: '800', color: '#F1F5F9', letterSpacing: 0.2, ..._textGlow },
  username: { fontSize: 10, color: '#CBD5E1', marginTop: 1, ..._textGlow },
  bio: { fontSize: 10, color: '#94A3B8', marginTop: 3, lineHeight: 14, ..._textGlow },
  editBtn: {
    width: 34, height: 34, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 12, marginBottom: 14, paddingVertical: 10,
    borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  statItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statNum: { fontSize: 15, fontWeight: '800', color: '#F1F5F9', marginBottom: 1, ..._textGlow },
  statLabel: { fontSize: 9, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },
  statDiv: { width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.08)' },
  walletCard: {
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 16, overflow: 'hidden',
    backgroundColor: '#414e5f',
    borderWidth: 1, borderColor: '#c9a227',
    padding: 16,
    ..._cardShadow,
  },
  walletGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 50,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
  },
  walletHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  walletTitle: { fontSize: 12, fontWeight: '700', color: '#F1F5F9', letterSpacing: 0.3, ..._textGlow },
  levelBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
  },
  levelText: { fontSize: 10, fontWeight: '900', color: '#fff', ..._textGlow },
  walletBody: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  walletAmount: { fontSize: 28, fontWeight: '900', color: '#FBBF24', letterSpacing: -0.5, textShadowColor: 'rgba(251,191,36,0.3)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 },
  walletSub: { fontSize: 9, fontWeight: '600', color: '#94A3B8', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 2 },
  buyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FBBF24', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10,
    shadowColor: '#FBBF24', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  buyBtnText: { fontSize: 12, fontWeight: '800', color: '#0F172A' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  listContainer: {
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: '#414e5f',
    borderRadius: 16, borderWidth: 1, borderColor: '#95a1ae',
    ..._cardShadow,
  },
  listItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  listItemText: { flex: 1, fontSize: 13, fontWeight: '500', color: '#E2E8F0', ..._textGlow },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#414e5f', width: '100%', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#95a1ae' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#F1F5F9', ..._textGlow },
  modalDesc: { fontSize: 13, color: '#CBD5E1', lineHeight: 20, marginBottom: 20, ..._textGlow },
  modalInput: { backgroundColor: 'rgba(0,0,0,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 14, color: '#F1F5F9', fontSize: 16, textAlign: 'center', marginBottom: 20, letterSpacing: 2 },
  modalBtn: { backgroundColor: Colors.teal, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
