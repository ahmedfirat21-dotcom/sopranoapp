import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Modal, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, Shadows } from '../../constants/theme';
import { getLevelFromSP, getLevelColors } from '../../constants/avatars';
import { useAuth, useTheme } from '../_layout';
import { supabase } from '../../constants/supabase';
import { ReferralService } from '../../services/referral';
import { ProfileService } from '../../services/database';
import { FriendshipService } from '../../services/friendship';
import { showToast } from '../../components/Toast';
import FollowListModal from '../../components/FollowListModal';
import AppBackground from '../../components/AppBackground';
import StatusAvatar from '../../components/StatusAvatar';
import { useOnlineFriends } from '../../providers/OnlineFriendsProvider';

import { TIER_DEFINITIONS, isTierAtLeast } from '../../constants/tiers';
import { migrateLegacyTier } from '../../types';
import type { SubscriptionTier } from '../../types';
import BoostPickerSheet, { type BoostTier } from '../../components/BoostPickerSheet';
import { UserTitleService, type UserTitle } from '../../services/userTitles';
import PremiumAlert, { type AlertButton } from '../../components/PremiumAlert';
import { auth } from '../../constants/firebase';
import { signOut, deleteUser as firebaseDeleteUser } from 'firebase/auth';


export default function ProfileScreen() {
  const router = useRouter();
  const { profile, user, firebaseUser, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();
  useTheme();

  const displayName = profile?.display_name || user?.name || 'Kullanıcı';
  const avatarUrl = profile?.avatar_url || user?.avatar || '';
  const bio = profile?.bio || 'Henüz bir şey yazmadı ☕';
  
  const subscriptionTier: SubscriptionTier = migrateLegacyTier(profile?.subscription_tier || 'Free');
  const userId = firebaseUser?.uid || profile?.id;

  // ★ Tüm arkadaşlar (following + followers birleşik) — Profil sayfasında tam liste
  const { allFriends } = useOnlineFriends();

  // Dinamik istatistikler
  const [stats, setStats] = useState({ followers: 0, following: 0, rooms: 0 });
  const [profileStats, setProfileStats] = useState({ stageMinutes: 0, roomsCreated: 0, totalListeners: 0, totalReactions: 0 });

  // Referans Modal
  const [showReferral, setShowReferral] = useState(false);
  const [referralCodeText, setReferralCodeText] = useState('');
  const [submittingReferral, setSubmittingReferral] = useState(false);
  const [showBoostPicker, setShowBoostPicker] = useState(false);
  const [userTitle, setUserTitle] = useState<UserTitle | null>(null);

  // ★ SEC-DEL: Hesap silme modalı (Google Play zorunlu)
  const [deleteAlert, setDeleteAlert] = useState<{ visible: boolean; title: string; message: string; type?: 'info' | 'warning' | 'error' | 'success'; buttons?: AlertButton[] }>({ visible: false, title: '', message: '' });

  // Takipçi/Takip listesi modal
  const [followModalVisible, setFollowModalVisible] = useState(false);
  const [followModalTab, setFollowModalTab] = useState<'followers' | 'following'>('followers');

  const loadStats = useCallback(async () => {
    if (!userId) return;
    try {
      // ★ Facebook tarzı: tek arkadaş count (bidirectional accepted union)
      const [friendCount, roomRes] = await Promise.all([
        FriendshipService.getFriendCount(userId),
        supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('host_id', userId),
      ]);

      setStats({
        followers: friendCount,
        following: friendCount,
        rooms: roomRes.count ?? 0,
      });


      // Aktivite istatistikleri
      try {
        const pStats = await ProfileService.getProfileStats(userId);
        setProfileStats(pStats);
      } catch {}

      // Unvan
      try {
        const title = await UserTitleService.getPrimaryTitle(userId);
        setUserTitle(title);
      } catch {}
    } catch (err) {
      if (__DEV__) console.warn('Stats yuklenemedi:', err);
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

  // ★ useFocusEffect: Sayfa her odaklandığında SP bakiyesi + istatistikleri güncelle
  useFocusEffect(
    useCallback(() => {
      refreshProfile(); // SP bakiyesini yenile (profile.system_points)
      loadStats();      // Takipçi, takip, oda sayılarını yenile
    }, [loadStats])
  );

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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 18, paddingBottom: Math.max(insets.bottom, 16) + 70 }}>

        {/* ═══ Premium Profil Kartı ═══ */}
        <View style={p.card}>
          <LinearGradient
            colors={['rgba(20,184,166,0.08)', 'rgba(15,23,42,0.95)', 'rgba(15,23,42,0.98)']}
            style={p.cardGlow}
          />
          {/* Üst: Avatar + Bilgi */}
          <View style={p.identityRow}>
            <View style={p.avatarBox}>
              <StatusAvatar
                uri={avatarUrl}
                size={84}
                tier={subscriptionTier}
                isAdmin={isAdmin}
                showTierBadge
              />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[p.displayName, isAdmin && { color: '#F87171' }]} numberOfLines={1}>{displayName}</Text>
                {isAdmin && (
                  <Ionicons name="shield-checkmark" size={14} color="#DC2626" style={{ marginLeft: 4 }} />
                )}
              </View>
              {profile?.username && <Text style={p.username}>@{profile.username}</Text>}
              {userTitle && (
                <View style={[p.titleBadge, { backgroundColor: userTitle.bgColor }]}>
                  <Text style={{ fontSize: 10 }}>{userTitle.emoji}</Text>
                  <Text style={[p.titleText, { color: userTitle.color }]}>{userTitle.name}</Text>
                </View>
              )}
              <Text style={p.bio} numberOfLines={3}>{bio}</Text>
            </View>
            <Pressable style={p.editBtn} onPress={() => router.push('/edit-profile')}>
              <Ionicons name="create-outline" size={16} color="#14B8A6" />
            </Pressable>
          </View>

          {/* ★ Facebook tarzı: tek Arkadaş sayısı */}
          <View style={p.statsRow}>
            <Pressable style={p.statItem} onPress={() => { setFollowModalTab('followers'); setFollowModalVisible(true); }}>
              <Text style={p.statNum}>{stats.followers}</Text>
              <Text style={p.statLabelClickable}>Arkadaş</Text>
            </Pressable>
            <View style={p.statDiv} />
            <Pressable style={p.statItem} onPress={() => router.push('/(tabs)/myrooms' as any)}>
              <Text style={p.statNum}>{stats.rooms}</Text>
              <Text style={p.statLabelClickable}>Oda</Text>
            </Pressable>
          </View>
        </View>

        {/* ═══ Aktivite İstatistikleri ═══ */}
        {(profileStats.stageMinutes > 0 || profileStats.roomsCreated > 0 || profileStats.totalListeners > 0) && (
          <View style={p.activityCard}>
            <View style={p.activityGrid}>
              <View style={p.activityItem}>
                <Ionicons name="mic" size={20} color={Colors.teal} style={{ textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }} />
                <Text style={p.activityNum}>{profileStats.stageMinutes}</Text>
                <Text style={p.activityLabel}>dk sahne</Text>
              </View>
              <View style={p.activityItem}>
                <Ionicons name="radio" size={20} color="#A855F7" style={{ textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }} />
                <Text style={p.activityNum}>{profileStats.roomsCreated}</Text>
                <Text style={p.activityLabel}>oda</Text>
              </View>
              <View style={p.activityItem}>
                <Ionicons name="people" size={20} color="#F59E0B" style={{ textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }} />
                <Text style={p.activityNum}>{profileStats.totalListeners}</Text>
                <Text style={p.activityLabel}>dinleyici</Text>
              </View>
              <View style={p.activityItem}>
                <Ionicons name="heart" size={20} color="#EF4444" style={{ textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }} />
                <Text style={p.activityNum}>{profileStats.totalReactions}</Text>
                <Text style={p.activityLabel}>reaksiyon</Text>
              </View>
            </View>
          </View>
        )}

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
            <Pressable style={p.storeWrap} onPress={() => router.push('/sp-store' as any)}>
              <LinearGradient
                colors={['#FBBF24', '#D97706', '#92400E']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={p.storeGradient}
              >
                <View style={p.storeIconWrap}>
                  <Ionicons name="cart" size={14} color="#FFF" />
                </View>
                <Text style={p.storeTitle}>Mağaza</Text>
                <Ionicons name="arrow-forward" size={14} color="rgba(255,255,255,0.7)" />
              </LinearGradient>
            </Pressable>
          </View>
        </View>



        {/* ═══ AYARLAR VE YÖNETİM ═══ */}
        <View style={p.sectionHeader}>
          <Text style={p.sectionHeaderText}>AYARLAR VE YÖNETİM</Text>
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

          <Pressable style={styles.listItem} onPress={() => {
            if (isTierAtLeast(subscriptionTier, 'Plus')) {
              setShowBoostPicker(true);
            } else {
              showToast({ title: 'Plus+ Gerekli', message: 'Profil boost özelliği Plus ve üzeri üyeliklerde kullanılabilir.', type: 'warning' });
            }
          }}>
            <Ionicons name="rocket" size={20} color="#F472B6" />
            <Text style={styles.listItemText}>Profilimi Öne Çıkar</Text>
            <Ionicons name="chevron-forward" size={16} color="#64748B" />
          </Pressable>
          {/* ★ SEC-DEL: Hesap silme — Settings'deki kapsamlı silme akışına yönlendir */}
          <Pressable style={[styles.listItem, { borderBottomWidth: 0 }]} onPress={() => {
            router.push('/settings' as any);
            // Küçük gecikme ile toast göster — kullanıcıyı yönlendir
            setTimeout(() => {
              showToast({ title: 'Hesap Silme', message: 'Ayarlar → Oturum → Hesabı Sil seçeneğini kullanın.', type: 'info' });
            }, 500);
          }}>
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
            <Text style={[styles.listItemText, { color: '#EF4444' }]}>Hesabımı Sil</Text>
            <Ionicons name="chevron-forward" size={16} color="#EF4444" />
          </Pressable>
        </View>




        {/* GodMaster Admin Paneli — admin only */}
        {profile?.is_admin && (
          <>
            <View style={p.sectionHeader}>
              <Text style={[p.sectionHeaderText, { color: '#EF4444' }]}>SİSTEM YÖNETİMİ</Text>
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

        {/* ═══ TÜM ARKADAŞLAR ═══ */}
        {allFriends.length > 0 && (
          <>
            <View style={p.sectionHeader}>
              <Text style={p.sectionHeaderText}>TÜM ARKADAŞLAR</Text>
            </View>
            <View style={af.card}>
              <LinearGradient
                colors={['rgba(20,184,166,0.06)', 'transparent']}
                style={af.cardGlow}
              />
              {/* Header */}
              <View style={af.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="people" size={14} color="#14B8A6" />
                  <Text style={af.headerTitle}>Arkadaşlarım</Text>
                </View>
                <View style={af.countBadge}>
                  <Text style={af.countText}>{allFriends.length}</Text>
                </View>
              </View>
              {/* Liste — ilk 8 kişi (nested ScrollView yerine flat liste) */}
              {allFriends.slice(0, 8).map((friend, idx) => (
                <Pressable
                  key={friend.id}
                  style={({ pressed }) => [
                    af.row,
                    idx === Math.min(allFriends.length, 8) - 1 && { borderBottomWidth: 0 },
                    pressed && { backgroundColor: 'rgba(255,255,255,0.04)' },
                  ]}
                  onPress={() => router.push(`/user/${friend.id}` as any)}
                >
                  <StatusAvatar
                    uri={friend.avatar_url}
                    size={36}
                    isOnline={friend.is_online}
                    tier={(friend as any).subscription_tier}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={af.name} numberOfLines={1}>{friend.display_name}</Text>
                    <Text style={[af.status, friend.is_online && { color: '#22C55E' }]}>
                      {friend.is_online ? 'Çevrimiçi' : 'Çevrimdışı'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.1)" />
                </Pressable>
              ))}
              {allFriends.length > 8 && (
                <Pressable
                  style={af.showAllBtn}
                  onPress={() => { setFollowModalTab('followers'); setFollowModalVisible(true); }}
                >
                  <Text style={af.showAllText}>Tümünü Gör ({allFriends.length})</Text>
                  <Ionicons name="chevron-forward" size={14} color="#14B8A6" />
                </Pressable>
              )}
            </View>
          </>
        )}

        {/* Referans Modal */}
        <Modal visible={showReferral} transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setShowReferral(false)}>
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Davet Kodu Gir</Text>
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
            </Pressable>
          </Pressable>
        </Modal>


      </ScrollView>

      {/* Boost Picker — Premium Bottom Sheet */}
      <BoostPickerSheet
        visible={showBoostPicker}
        onClose={() => setShowBoostPicker(false)}
        currentSP={spBalance}
        onBoost={async (tier: BoostTier) => {
          if (!profile?.id) return;
          try {
            await ProfileService.boostProfile(profile.id, tier.cost, tier.duration);
            await refreshProfile();
            showToast({
              title: `${tier.label} Aktif! 🚀`,
              message: `Profilin ve odaların ${tier.duration} saat boyunca Keşfet'te öne çıkacak.`,
              type: 'success',
            });
          } catch (err: any) {
            showToast({ title: 'Boost başarısız', message: err.message || 'Hata oluştu', type: 'error' });
            throw err; // BoostPickerSheet loading state'i kapatsın
          }
        }}
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

      {/* ★ SEC-DEL: Hesap silme onay modalı */}
      <PremiumAlert {...deleteAlert} onDismiss={() => setDeleteAlert(prev => ({ ...prev, visible: false }))} />
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
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    ..._cardShadow,
  },
  cardGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 80,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
  },
  identityRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingHorizontal: 16, paddingTop: 18, paddingBottom: 14,
  },
  avatarBox: { position: 'relative' as const },

  displayName: { fontSize: 18, fontWeight: '800', color: '#F1F5F9', letterSpacing: 0.2, ..._textGlow },
  username: { fontSize: 11, color: '#94A3B8', marginTop: 1, ..._textGlow },
  titleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    alignSelf: 'flex-start',
    paddingHorizontal: 7, paddingVertical: 2.5,
    borderRadius: 8, marginTop: 3,
  },
  titleText: { fontSize: 10, fontWeight: '700' },
  bio: { fontSize: 12, color: '#94A3B8', marginTop: 4, lineHeight: 17, ..._textGlow },
  // ★ Section header — ortak stil
  sectionHeader: { marginHorizontal: 16, marginTop: 10, marginBottom: 6 },
  sectionHeaderText: { fontSize: 11, fontWeight: '800' as const, color: '#94A3B8', letterSpacing: 1, ..._textGlow },
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
  statNum: { fontSize: 16, fontWeight: '800', color: '#F1F5F9', marginBottom: 1, ..._textGlow },

  statLabelClickable: { fontSize: 9, fontWeight: '600', color: '#5CBFB5', textTransform: 'uppercase', letterSpacing: 0.5 },
  statDiv: { width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.08)' },
  // ★ Aktivite istatistikleri
  activityCard: {
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 16, overflow: 'hidden',
    backgroundColor: '#414e5f',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 14, paddingHorizontal: 10,
    ..._cardShadow,
  },
  activityGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  activityItem: { alignItems: 'center', gap: 4 },
  activityNum: { fontSize: 15, fontWeight: '800', color: '#F1F5F9', ..._textGlow },
  activityLabel: { fontSize: 8, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.3 },
  walletCard: {
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 16, overflow: 'hidden',
    backgroundColor: '#414e5f',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.15)',
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
  storeWrap: {
    borderRadius: 12, overflow: 'hidden',
    shadowColor: '#FBBF24', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  storeGradient: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 10, gap: 6,
  },
  storeIconWrap: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  storeTitle: {
    fontSize: 12, fontWeight: '800', color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },

});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  listContainer: {
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: '#414e5f',
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    ..._cardShadow,
  },
  listItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  listItemText: { flex: 1, fontSize: 13, fontWeight: '500', color: '#E2E8F0', ..._textGlow },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#414e5f', width: '100%', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#F1F5F9', ..._textGlow },
  modalDesc: { fontSize: 13, color: '#CBD5E1', lineHeight: 20, marginBottom: 20, ..._textGlow },
  modalInput: { backgroundColor: 'rgba(0,0,0,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 14, color: '#F1F5F9', fontSize: 16, textAlign: 'center', marginBottom: 20, letterSpacing: 2 },
  modalBtn: { backgroundColor: Colors.teal, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

// ═══ Tüm Arkadaşlar Bölümü Stilleri ═══
const af = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 16, overflow: 'hidden',
    backgroundColor: '#414e5f',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.2)',
    ..._cardShadow,
  },
  cardGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 50,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerTitle: {
    fontSize: 13, fontWeight: '700', color: '#F1F5F9', letterSpacing: 0.3, ..._textGlow,
  },
  countBadge: {
    backgroundColor: 'rgba(20,184,166,0.12)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.25)',
  },
  countText: { fontSize: 10, fontWeight: '800', color: '#14B8A6' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 9, paddingHorizontal: 14,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  name: {
    fontSize: 13, fontWeight: '600', color: '#F1F5F9', ..._textGlow,
  },
  status: {
    fontSize: 10, color: '#64748B', marginTop: 1,
  },
  showAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  showAllText: {
    fontSize: 12, fontWeight: '600', color: '#14B8A6', ..._textGlow,
  },
});
