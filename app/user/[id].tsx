import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Image, Pressable, ScrollView, ActivityIndicator, Alert, DeviceEventEmitter } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Radius } from '../../constants/theme';
import { TIER_DEFINITIONS } from '../../constants/tiers';
import { TierBadge } from '../../components/progression';
import type { TierName } from '../../types';
import { getAvatarSource } from '../../constants/avatars';
import { ProfileService, type Profile } from '../../services/database';
import { FriendshipService, type FriendshipStatus } from '../../services/friendship';
import { ModerationService } from '../../services/moderation';

import { ReportModal } from '../../components/ReportModal';
import { showToast } from '../../components/Toast';
import { useAuth } from '../_layout';
import { supabase } from '../../constants/supabase';
import { BadgeCheckerService, type UserBadge } from '../../services/engagement/badges';
import { BadgeGrid } from '../../components/progression';
import TieredProfileSections from '../../components/profile/TieredProfileSections';
import { isTierAtLeast } from '../../constants/tiers';
import PremiumAlert from '../../components/PremiumAlert';

/** Zamanı insanca formatlayan yardımcı */
function _formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'az önce';
  if (mins < 60) return `${mins} dk`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} sa`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} gün`;
  return `${Math.floor(days / 7)} hf`;
}

export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { firebaseUser, profile: currentUserProfile, refreshProfile } = useAuth();
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [followStatus, setFollowStatus] = useState<FriendshipStatus | null>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [stats, setStats] = useState({ followers: 0, following: 0, rooms: 0 });

  const [showReportModal, setShowReportModal] = useState(false);
  const [isUserBlocked, setIsUserBlocked] = useState(false);
  const [recentPosts, setRecentPosts] = useState<any[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);

  // ★ Katmanlı profil verileri
  const [profileStats, setProfileStats] = useState({ stageMinutes: 0, roomsCreated: 0, totalListeners: 0, totalReactions: 0 });
  const [recentRooms, setRecentRooms] = useState<any[]>([]);
  const [showDonateModal, setShowDonateModal] = useState(false);

  const isOwnProfile = firebaseUser?.uid === id;

  const loadProfile = useCallback(async () => {
    if (!id) return;
    try {
      const profile = await ProfileService.get(id);
      setUserProfile(profile);

      // Takip durumu
      if (firebaseUser && !isOwnProfile) {
        const status = await FriendshipService.getStatus(firebaseUser.uid, id);
        setFollowStatus(status);
      }

      // Istatistikler
      const [followerCount, followingCount] = await Promise.all([
        FriendshipService.getFollowerCount(id),
        FriendshipService.getFollowingCount(id),
      ]);

      const { count: roomCount } = await supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true })
        .eq('host_id', id);

      setStats({
        followers: followerCount,
        following: followingCount,
        rooms: roomCount ?? 0,
      });

      // Son 3 post
      const { data: postsData } = await supabase
        .from('posts')
        .select('id, content, image_url, created_at, likes_count, comments_count')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(3);
      setRecentPosts(postsData || []);

      // Rozetleri yükle
      try {
        const badges = await BadgeCheckerService.getUserBadges(id);
        setUserBadges(badges);
      } catch {}

      // ★ Katmanlı profil verileri
      try {
        const [pStats, rooms] = await Promise.all([
          ProfileService.getProfileStats(id),
          ProfileService.getRecentRooms(id),
        ]);
        setProfileStats(pStats);
        setRecentRooms(rooms);
      } catch {}
    } catch (err) {
      console.warn('Profil yuklenemedi:', err);
    } finally {
      setLoading(false);
    }
  }, [id, firebaseUser]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleFollow = async () => {
    if (!firebaseUser || !id || isOwnProfile) return;
    setFollowLoading(true);
    try {
      if (followStatus === 'accepted') {
        // Takipten çık
        const result = await FriendshipService.unfollow(firebaseUser.uid, id);
        if (result.success) {
          setFollowStatus(null);
          setStats(prev => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
          showToast({ title: 'Takipten çıkıldı', type: 'info' });
        }
      } else if (followStatus === 'pending') {
        // İsteği iptal et
        const result = await FriendshipService.unfollow(firebaseUser.uid, id);
        if (result.success) {
          setFollowStatus(null);
          showToast({ title: 'İstek iptal edildi', type: 'info' });
        }
      } else {
        // Yeni takip isteği gönder
        const result = await FriendshipService.follow(firebaseUser.uid, id);
        if (result.success) {
          setFollowStatus('pending');
          showToast({ title: 'Takip isteği gönderildi!', type: 'success' });
        }
      }
    } catch (err) {
      showToast({ title: 'Hata oluştu', type: 'error' });
    } finally {
      setFollowLoading(false);
    }
  };

  const handleBlock = async () => {
    if (!firebaseUser || !id) return;
    if (isUserBlocked) {
      // Engeli kaldır
      try {
        await ModerationService.unblockUser(firebaseUser.uid, id);
        setIsUserBlocked(false);
        showToast({ title: 'Engel kaldırıldı', type: 'success' });
      } catch (e) { showToast({ title: 'Hata', type: 'error' }); }
    } else {
      Alert.alert(
        'Kullanıcıyı Engelle',
        `${userProfile?.display_name || 'Bu kullanıcı'} engellenecek. Engellenmiş kullanıcıların postlarını ve mesajlarını göremezsiniz.`,
        [
          { text: 'Vazgeç', style: 'cancel' },
          {
            text: 'Engelle', style: 'destructive',
            onPress: async () => {
              try {
                await ModerationService.blockUser(firebaseUser.uid, id);
                setIsUserBlocked(true);
                showToast({ title: 'Kullanıcı engellendi', type: 'info' });
              } catch (e) { showToast({ title: 'Engelleme başarısız', type: 'error' }); }
            },
          },
        ]
      );
    }
  };

  const handleMoreMenu = () => {
    if (!firebaseUser || !id || isOwnProfile) return;
    Alert.alert(
      'Seçenekler',
      undefined,
      [
        { text: '🚩 Rapor Et', onPress: () => setShowReportModal(true) },
        { text: isUserBlocked ? '✅ Engeli Kaldır' : '🚫 Engelle', onPress: handleBlock, style: isUserBlocked ? 'default' : 'destructive' },
        { text: 'Vazgeç', style: 'cancel' },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.teal} />
      </View>
    );
  }

  if (!userProfile) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="person-outline" size={48} color={Colors.text3} />
        <Text style={{ color: Colors.text2, marginTop: 12 }}>Kullanici bulunamadi</Text>
      </View>
    );
  }

  const tier = (userProfile.subscription_tier || 'Free') as TierName;
  const tierDef = TIER_DEFINITIONS[tier] || TIER_DEFINITIONS.Free;
  const tierBorderColor = tierDef.color;

  const isFollowing = followStatus === 'accepted';
  const isPending = followStatus === 'pending';
  const isBlocked = followStatus === 'blocked';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Profil</Text>
        {!isOwnProfile && (
          <Pressable style={styles.moreBtn} onPress={handleMoreMenu}>
            <Ionicons name="ellipsis-horizontal" size={20} color={Colors.text2} />
          </Pressable>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Image
              source={getAvatarSource(userProfile.avatar_url)}
              style={[styles.avatar, { borderColor: tierBorderColor }]}
            />
            <TierBadge tier={tier} size="sm" />
          </View>

          <View style={styles.nameRow}>
            <Text style={styles.profileName}>{userProfile.display_name}</Text>
            {userProfile.is_online && (
              <View style={styles.onlineBadge}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>Online</Text>
              </View>
            )}
          </View>

          {userProfile.username && (
            <Text style={styles.profileUsername}>@{userProfile.username}</Text>
          )}

          <Text style={styles.profileBio}>{userProfile.bio || 'SopranoChat kullanıcısı'}</Text>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.followers}</Text>
              <Text style={styles.statLabel}>Takipci</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.following}</Text>
              <Text style={styles.statLabel}>Takip</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.rooms}</Text>
              <Text style={styles.statLabel}>Oda</Text>
            </View>
          </View>

          {/* Action Buttons */}
          {!isOwnProfile && (
            <View style={styles.actionsRow}>
              <Pressable
                style={[styles.followBtn, (isFollowing || isPending) && styles.followBtnActive]}
                onPress={handleFollow}
                disabled={followLoading || isBlocked}
              >
                {followLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : isBlocked ? (
                  <>
                    <Ionicons name="ban" size={16} color={Colors.red} />
                    <Text style={[styles.followBtnText, { color: Colors.red }]}>Engellendi</Text>
                  </>
                ) : isFollowing ? (
                  <>
                    <Ionicons name="checkmark" size={16} color={Colors.teal} />
                    <Text style={[styles.followBtnText, { color: Colors.teal }]}>Takip Ediliyor</Text>
                  </>
                ) : isPending ? (
                  <>
                    <Ionicons name="time-outline" size={16} color={Colors.amber} />
                    <Text style={[styles.followBtnText, { color: Colors.amber }]}>İstek Gönderildi</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="person-add" size={16} color="#fff" />
                    <Text style={styles.followBtnText}>Takip Et</Text>
                  </>
                )}
              </Pressable>

              <Pressable
                style={styles.messageBtn}
                onPress={() => router.push(`/chat/${id}`)}
              >
                <Ionicons name="chatbubble" size={16} color={Colors.teal} />
              </Pressable>

              {/* ★ Sesli Arama Butonu */}
              <Pressable
                style={styles.callBtn}
                onPress={() => {
                  if (!firebaseUser || !id) return;
                  router.push(`/call/${id}?type=audio` as any);
                }}
              >
                <Ionicons name="call" size={16} color="#4ADE80" />
              </Pressable>

              {/* ★ Görüntülü Arama Butonu */}
              <Pressable
                style={styles.videoCallBtn}
                onPress={() => {
                  if (!firebaseUser || !id) return;
                  router.push(`/call/${id}?type=video` as any);
                }}
              >
                <Ionicons name="videocam" size={16} color="#38BDF8" />
              </Pressable>

            </View>
          )}
        </View>

        {/* Tier Badge Card */}
        {tier !== 'Free' && (
          <View style={styles.plusBadgeCard}>
            <View style={styles.plusLeft}>
              <View style={[styles.plusIconWrap, { backgroundColor: `${tierDef.color}18` }]}>
                <Ionicons name={tierDef.icon as any} size={18} color={tierDef.color} />
              </View>
              <Text style={styles.plusLabel}>{tierDef.emoji} {tierDef.label} Üyesi</Text>
            </View>
            <Ionicons name="checkmark-circle" size={20} color={tierDef.color} />
          </View>
        )}

        {/* Rozetler */}
        {userBadges.length > 0 && (
          <View style={{ marginHorizontal: 20, marginTop: 16 }}>
            <BadgeGrid unlockedBadges={userBadges} compact />
          </View>
        )}

        <View style={{ height: 8 }} />

        {/* ★ Katmanlı Profil Bölümleri */}
        <TieredProfileSections
          tier={tier}
          viewerTier={(currentUserProfile?.subscription_tier || 'Free') as any}
          isOwnProfile={false}
          userId={id}
          stats={profileStats}
          recentRooms={recentRooms}
          bannerUrl={(userProfile as any)?.banner_url || null}
          languageTag={(userProfile as any)?.language || undefined}
          ageTag={(userProfile as any)?.age_range || undefined}
          onDonate={isTierAtLeast(tier, 'Gold') ? () => setShowDonateModal(true) : undefined}
        />

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* ★ Bağış Modalı */}
      <PremiumAlert
        visible={showDonateModal}
        title="💛 Destekle"
        message={`${userProfile?.display_name || 'Bu kullanıcı'} adlı kullanıcıya SP göndermek istiyorsun. Miktarı seç:`}
        type="info"
        icon="heart"
        onDismiss={() => setShowDonateModal(false)}
        buttons={[
          { text: 'İptal', style: 'cancel' },
          { text: '5 SP', onPress: () => { setShowDonateModal(false); showToast({ title: '💛 5 SP gönderildi!', type: 'success' }); } },
          { text: '10 SP', onPress: () => { setShowDonateModal(false); showToast({ title: '💛 10 SP gönderildi!', type: 'success' }); } },
          { text: '25 SP', onPress: () => { setShowDonateModal(false); showToast({ title: '💛 25 SP gönderildi!', type: 'success' }); } },
          { text: '50 SP', onPress: () => { setShowDonateModal(false); showToast({ title: '💛 50 SP gönderildi!', type: 'success' }); } },
          { text: '100 SP', onPress: () => { setShowDonateModal(false); showToast({ title: '💛 100 SP gönderildi!', type: 'success' }); } },
        ]}
      />



      {/* Report Modal */}
      {firebaseUser && id && (
        <ReportModal
          visible={showReportModal}
          onClose={() => setShowReportModal(false)}
          reporterId={firebaseUser.uid}
          target={{ type: 'user', id }}
        />
      )}
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
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  moreBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },

  // Profile Card
  profileCard: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 12 },
  avatarContainer: { position: 'relative', marginBottom: 12 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3 },
  tierBadge: {
    position: 'absolute', bottom: -2, right: -2,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full,
    borderWidth: 2, borderColor: Colors.bg,
  },
  tierText: { fontSize: 9, fontWeight: '700', color: '#fff' },

  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  profileName: { fontSize: 22, fontWeight: '800', color: Colors.text },
  onlineBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(16,185,129,0.12)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full,
  },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.emerald },
  onlineText: { fontSize: 10, fontWeight: '600', color: Colors.emerald },

  profileUsername: { fontSize: 13, color: Colors.teal, marginBottom: 4 },
  profileBio: { fontSize: 13, color: Colors.text2, textAlign: 'center', marginBottom: 16, paddingHorizontal: 20 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 32, marginBottom: 16 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: Colors.text },
  statLabel: { fontSize: 11, color: Colors.text3, marginTop: 2 },

  // Actions
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  followBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 28, paddingVertical: 12, borderRadius: Radius.full,
    backgroundColor: Colors.teal,
  },
  followBtnActive: {
    backgroundColor: Colors.glass3,
    borderWidth: 1, borderColor: Colors.teal + '40',
  },
  followBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  messageBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(20,184,166,0.1)', borderWidth: 1, borderColor: 'rgba(20,184,166,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  callBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(74,222,128,0.1)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  videoCallBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(56,189,248,0.1)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  giftBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(251,191,36,0.1)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Plus badge card
  plusBadgeCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 20, marginTop: 12, padding: 16,
    borderRadius: Radius.default, backgroundColor: Colors.bg3,
    borderWidth: 1, borderColor: Colors.glassBorder,
  },
  plusLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  plusIconWrap: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  plusLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },

  // Recent Posts
  recentPostsSection: {
    marginHorizontal: 20, marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 12,
  },
  postCard: {
    flexDirection: 'row', gap: 12, marginBottom: 12, padding: 12,
    borderRadius: Radius.default, backgroundColor: Colors.bg3,
    borderWidth: 1, borderColor: Colors.glassBorder,
  },
  postImage: {
    width: 56, height: 56, borderRadius: Radius.sm,
  },
  postContent: {
    flex: 1, justifyContent: 'center',
  },
  postText: {
    fontSize: 13, color: Colors.text, lineHeight: 18, marginBottom: 6,
  },
  postMeta: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  postMetaItem: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
  },
  postMetaText: {
    fontSize: 11, color: Colors.text3,
  },
  postDate: {
    fontSize: 11, color: Colors.text3, marginLeft: 'auto',
  },
});
