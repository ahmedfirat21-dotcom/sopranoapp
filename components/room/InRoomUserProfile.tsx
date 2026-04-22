/**
 * SopranoChat — In-Room User Profile Overlay
 * Clubhouse tarzı: oda içinden profil görüntüleme, odadan çıkmadan.
 * ProfileCard "Profil" butonu → bu overlay açılır → kapatınca odada kalır.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Image, Pressable, ScrollView,
  ActivityIndicator, Dimensions, Animated, Easing, StyleProp, ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { TIER_DEFINITIONS } from '../../constants/tiers';
import type { TierName } from '../../types';
import { ProfileService, type Profile } from '../../services/database';
import { FriendshipService, type FriendshipStatus } from '../../services/friendship';
import { ModerationService } from '../../services/moderation';
import { UserTitleService, type UserTitle } from '../../services/userTitles';
import { showToast } from '../Toast';
import ProfileHero from '../profile/ProfileHero';
import SPDonateSheet from '../profile/SPDonateSheet';
import FollowListModal from '../FollowListModal';
import { ReportModal } from '../ReportModal';
import PremiumAlert, { type AlertButton } from '../PremiumAlert';
import { supabase } from '../../constants/supabase';

const { height: H } = Dimensions.get('window');

const iconShadow = {
  textShadowColor: 'rgba(0,0,0,0.5)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
} as const;

type Props = {
  visible: boolean;
  userId: string | null;
  currentUserId: string | null;
  onClose: () => void;
};

export default function InRoomUserProfile({ visible, userId, currentUserId, onClose }: Props) {
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [followStatus, setFollowStatus] = useState<FriendshipStatus | null>(null);
  const [incomingStatus, setIncomingStatus] = useState<FriendshipStatus | null>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [incomingLoading, setIncomingLoading] = useState(false);
  const [stats, setStats] = useState({ followers: 0, rooms: 0 });
  const [profileStats, setProfileStats] = useState({ stageMinutes: 0, roomsCreated: 0, totalListeners: 0, totalReactions: 0 });
  const [userTitle, setUserTitle] = useState<UserTitle | null>(null);
  const [isUserBlocked, setIsUserBlocked] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showFollowList, setShowFollowList] = useState(false);
  const [followListTab, setFollowListTab] = useState<'followers' | 'following'>('followers');
  const [showSPSheet, setShowSPSheet] = useState(false);
  const [cAlert, setCAlert] = useState<{ visible: boolean; title: string; message: string; type?: 'info' | 'warning' | 'error' | 'success'; buttons?: AlertButton[] }>({ visible: false, title: '', message: '' });

  const slideY = useRef(new Animated.Value(H)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const isOwnProfile = currentUserId === userId;

  const loadProfile = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      let blocked = false;
      if (currentUserId && !isOwnProfile) {
        try {
          const blockedIds = await ModerationService.getBlockedUsers(currentUserId);
          blocked = blockedIds.includes(userId);
          setIsUserBlocked(blocked);
        } catch {}
      }

      if (blocked) {
        const { data } = await supabase.from('profiles').select('id, display_name, avatar_url').eq('id', userId).single();
        setUserProfile(data as any);
        setStats({ followers: 0, rooms: 0 });
        return;
      }

      const profile = await ProfileService.get(userId);
      setUserProfile(profile);

      if (currentUserId && !isOwnProfile) {
        const detailed = await FriendshipService.getDetailedStatus(currentUserId, userId);
        setFollowStatus(detailed.outgoing);
        setIncomingStatus(detailed.incoming);
      }

      const [friendCount, { count: roomCount }] = await Promise.all([
        FriendshipService.getFriendCount(userId),
        supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('host_id', userId),
      ]);
      setStats({ followers: friendCount, rooms: roomCount ?? 0 });

      try {
        const [pStats, title] = await Promise.all([
          ProfileService.getProfileStats(userId),
          UserTitleService.getPrimaryTitle(userId).catch(() => null),
        ]);
        setProfileStats(pStats);
        setUserTitle(title);
      } catch {}
    } catch (err) {
      if (__DEV__) console.warn('[InRoomUserProfile] load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, currentUserId, isOwnProfile]);

  useEffect(() => {
    if (visible && userId) {
      loadProfile();
      Animated.parallel([
        Animated.timing(slideY, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(overlayOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      slideY.setValue(H);
      overlayOpacity.setValue(0);
    }
  }, [visible, userId, loadProfile]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideY, { toValue: H, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  const handleFollow = async () => {
    if (!currentUserId || !userId || isOwnProfile) return;
    const alreadyFriend = followStatus === 'accepted' || incomingStatus === 'accepted';
    setFollowLoading(true);
    try {
      if (alreadyFriend) {
        const r = await FriendshipService.removeFriend(currentUserId, userId);
        if (r.success) {
          setFollowStatus(null);
          setIncomingStatus(null);
          setStats(prev => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
        }
      } else if (followStatus === 'pending') {
        const r = await FriendshipService.unfollow(currentUserId, userId);
        if (r.success) setFollowStatus(null);
      } else {
        const r = await FriendshipService.follow(currentUserId, userId);
        if (r.success) setFollowStatus('pending');
        else if (r.error) showToast({ title: r.error, type: 'warning' });
      }
    } catch {
      showToast({ title: 'Hata oluştu', type: 'error' });
    } finally {
      setFollowLoading(false);
    }
  };

  const handleApproveIncoming = async () => {
    if (!currentUserId || !userId) return;
    setIncomingLoading(true);
    try {
      const r = await FriendshipService.approveRequest(currentUserId, userId);
      if (r.success) {
        setIncomingStatus('accepted');
        setStats(prev => ({ ...prev, followers: prev.followers + 1 }));
      }
    } catch {} finally { setIncomingLoading(false); }
  };

  const handleRejectIncoming = async () => {
    if (!currentUserId || !userId) return;
    setIncomingLoading(true);
    try {
      const r = await FriendshipService.rejectRequest(currentUserId, userId);
      if (r.success) setIncomingStatus(null);
    } catch {} finally { setIncomingLoading(false); }
  };

  const handleBlock = () => {
    if (!currentUserId || !userId) return;
    if (isUserBlocked) {
      ModerationService.unblockUser(currentUserId, userId)
        .then(() => setIsUserBlocked(false))
        .catch(() => {});
      return;
    }
    setCAlert({
      visible: true,
      title: 'Kullanıcıyı Engelle',
      message: `${userProfile?.display_name || 'Bu kullanıcı'} engellenecek. Engellenmiş kullanıcıların postlarını ve mesajlarını göremezsiniz.`,
      type: 'warning',
      buttons: [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Engelle', style: 'destructive',
          onPress: async () => {
            try {
              await ModerationService.blockUser(currentUserId, userId);
              setIsUserBlocked(true);
              if (followStatus === 'accepted' || incomingStatus === 'accepted') {
                await FriendshipService.removeFriend(currentUserId, userId).catch(() => {});
                setFollowStatus(null); setIncomingStatus(null);
              } else if (followStatus === 'pending') {
                await FriendshipService.unfollow(currentUserId, userId).catch(() => {});
                setFollowStatus(null);
              }
              showToast({ title: 'Kullanıcı engellendi', type: 'info' });
            } catch {}
          },
        },
      ],
    });
  };

  if (!visible) return null;

  const isFriend = followStatus === 'accepted' || incomingStatus === 'accepted';
  const isPending = followStatus === 'pending';
  const hasIncomingPending = incomingStatus === 'pending';
  const tier = (userProfile?.subscription_tier || 'Free') as TierName;
  const tierDef = TIER_DEFINITIONS[tier] || TIER_DEFINITIONS.Free;

  const isPrivateProfile = !isOwnProfile && userProfile && (
    userProfile.privacy_mode === 'private' ||
    userProfile.privacy_mode === 'followers_only' ||
    userProfile.is_private === true
  );
  const canSeeFullProfile = isOwnProfile || isFriend || !isPrivateProfile;

  return (
    <View style={sty.root} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[sty.backdrop, { opacity: overlayOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[sty.sheet, { transform: [{ translateY: slideY }] }]}>
        <LinearGradient
          colors={['#1e2832', '#141b24', '#0a0f16']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Header */}
        <View style={sty.header}>
          <Pressable onPress={handleClose} style={sty.backBtn} hitSlop={8}>
            <Ionicons name="chevron-down" size={22} color="#F1F5F9" />
          </Pressable>
          <Text style={sty.headerTitle}>Profil</Text>
          <View style={{ width: 36 }} />
        </View>

        {loading ? (
          <View style={sty.loadingBox}>
            <ActivityIndicator size="large" color={Colors.teal} />
          </View>
        ) : !userProfile ? (
          <View style={sty.loadingBox}>
            <Ionicons name="person-outline" size={48} color={Colors.text3} />
            <Text style={{ color: Colors.text2, marginTop: 12 }}>Kullanıcı bulunamadı</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

            {isUserBlocked && (
              <View style={sty.blockedBanner}>
                <Ionicons name="ban" size={16} color="#EF4444" />
                <Text style={sty.blockedBannerText}>
                  Bu kullanıcıyı engelledin. Profil içeriği gizli.
                </Text>
              </View>
            )}

            <ProfileHero
              displayName={userProfile.display_name}
              username={userProfile.username}
              bio={userProfile.bio || 'Henüz bir şey yazmadı ☕'}
              avatarUrl={userProfile.avatar_url || ''}
              subscriptionTier={tier as any}
              isAdmin={!!userProfile.is_admin}
              userTitle={userTitle}
              stats={{ followers: stats.followers, rooms: stats.rooms }}
              onFollowersPress={() => { setFollowListTab('followers'); setShowFollowList(true); }}
              onRoomsPress={() => {}}
              memberSince={userProfile.created_at}
              boostExpiresAt={(userProfile as any)?.profile_boost_expires_at}
              isOnline={isFriend || isOwnProfile ? userProfile.is_online : undefined}
            />

            {!isOwnProfile && (
              <>
                {hasIncomingPending && (
                  <View style={sty.incomingBanner}>
                    <View style={sty.incomingLeft}>
                      <Ionicons name="person-add" size={16} color="#F59E0B" />
                      <Text style={sty.incomingText}>
                        <Text style={{ fontWeight: '800', color: '#F1F5F9' }}>{userProfile.display_name}</Text>
                        {' '}seninle arkadaş olmak istiyor
                      </Text>
                    </View>
                    <View style={sty.incomingActions}>
                      {incomingLoading ? <ActivityIndicator size="small" color="#14B8A6" /> : (
                        <>
                          <Pressable style={sty.incomingApproveBtn} onPress={handleApproveIncoming}>
                            <Ionicons name="checkmark" size={16} color="#FFF" />
                            <Text style={sty.incomingApproveText}>Onayla</Text>
                          </Pressable>
                          <Pressable style={sty.incomingRejectBtn} onPress={handleRejectIncoming}>
                            <Ionicons name="close" size={16} color="#94A3B8" />
                            <Text style={sty.incomingRejectText}>Sil</Text>
                          </Pressable>
                        </>
                      )}
                    </View>
                  </View>
                )}

                <View style={sty.interactionRow}>
                  <Pressable
                    style={[sty.followBtn, (isFriend || isPending) && sty.followBtnActive]}
                    onPress={handleFollow}
                    disabled={followLoading || isUserBlocked}
                  >
                    {followLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : isUserBlocked ? (
                      <Text style={[sty.followBtnText, { color: '#EF4444' }]}>Engellendi</Text>
                    ) : isFriend ? (
                      <><Ionicons name="people" size={16} color="#F1F5F9" /><Text style={[sty.followBtnText, { color: '#F1F5F9' }]}>Arkadaş</Text></>
                    ) : isPending ? (
                      <Text style={[sty.followBtnText, { color: '#FBBF24' }]}>İstek Gönderildi</Text>
                    ) : (
                      <><Ionicons name="person-add-outline" size={16} color="#fff" /><Text style={sty.followBtnText}>Arkadaş Ekle</Text></>
                    )}
                  </Pressable>
                </View>
              </>
            )}

            {!canSeeFullProfile && (
              <View style={sty.privateBox}>
                <Ionicons name="lock-closed" size={28} color="#94A3B8" />
                <Text style={sty.privateTitle}>Bu hesap gizli</Text>
                <Text style={sty.privateDesc}>İçerikleri görmek için arkadaş ol</Text>
              </View>
            )}

            {canSeeFullProfile && (
              <>
                {(profileStats.stageMinutes > 0 || profileStats.roomsCreated > 0 || profileStats.totalListeners > 0) && (
                  <View style={sty.activityCard}>
                    <View style={sty.activityGrid}>
                      <View style={sty.activityItem}>
                        <Ionicons name="mic" size={20} color={Colors.teal} style={iconShadow} />
                        <Text style={sty.activityNum}>{profileStats.stageMinutes}</Text>
                        <Text style={sty.activityLabel}>dk sahne</Text>
                      </View>
                      <View style={sty.activityItem}>
                        <Ionicons name="radio" size={20} color="#A855F7" style={iconShadow} />
                        <Text style={sty.activityNum}>{profileStats.roomsCreated}</Text>
                        <Text style={sty.activityLabel}>oda</Text>
                      </View>
                      <View style={sty.activityItem}>
                        <Ionicons name="people" size={20} color="#F59E0B" style={iconShadow} />
                        <Text style={sty.activityNum}>{profileStats.totalListeners}</Text>
                        <Text style={sty.activityLabel}>dinleyici</Text>
                      </View>
                      <View style={sty.activityItem}>
                        <Ionicons name="heart" size={20} color="#EF4444" style={iconShadow} />
                        <Text style={sty.activityNum}>{profileStats.totalReactions}</Text>
                        <Text style={sty.activityLabel}>reaksiyon</Text>
                      </View>
                    </View>
                  </View>
                )}

                <View style={sty.tierCard}>
                  <LinearGradient colors={['#4a5668', '#37414f', '#232a35']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
                  <LinearGradient colors={[tierDef.color + '28', tierDef.color + '08', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <LinearGradient colors={tierDef.gradient as [string, string]} style={sty.tierIcon}>
                      <Ionicons name={tierDef.icon as any} size={16} color="#fff" style={iconShadow} />
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                      <Text style={[sty.tierTitle, { color: tierDef.color }]}>{tierDef.label} Üye</Text>
                      <Text style={sty.tierDesc}>
                        {tier === 'Pro' ? 'Sınırsız oda · 1080p · Stereo ses' : tier === 'Plus' ? 'HD ses · 720p video · Tüm oda türleri' : 'Ücretsiz plan · Temel özellikler'}
                      </Text>
                    </View>
                  </View>
                </View>

                {!isOwnProfile && !isUserBlocked && currentUserId && (
                  <Pressable style={sty.donateCard} onPress={() => setShowSPSheet(true)}>
                    <LinearGradient colors={['#FFE082', '#FBBF24', '#D97706']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={sty.donateGradient}>
                      <Ionicons name="diamond" size={16} color="#FFF" style={iconShadow} />
                      <Text style={sty.donateText}>SP Gönder</Text>
                    </LinearGradient>
                  </Pressable>
                )}

                {!isOwnProfile && currentUserId && (
                  <View style={sty.actionRow}>
                    <LinearGradient colors={['#4a5668', '#37414f', '#232a35']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
                    <Pressable style={sty.actionBtn} onPress={() => setShowReportModal(true)}>
                      <Ionicons name="flag-outline" size={16} color="#94A3B8" style={iconShadow} />
                      <Text style={sty.actionBtnText}>Rapor Et</Text>
                    </Pressable>
                    <View style={sty.actionSep} />
                    <Pressable style={sty.actionBtn} onPress={handleBlock}>
                      <Ionicons name={isUserBlocked ? 'checkmark-circle' : 'ban'} size={16} color={isUserBlocked ? '#22C55E' : '#EF4444'} style={iconShadow} />
                      <Text style={[sty.actionBtnText, { color: isUserBlocked ? '#22C55E' : '#EF4444' }]}>
                        {isUserBlocked ? 'Engeli Kaldır' : 'Engelle'}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        )}
      </Animated.View>

      {/* Nested Modals */}
      {currentUserId && userId && (
        <ReportModal
          visible={showReportModal}
          onClose={() => setShowReportModal(false)}
          reporterId={currentUserId}
          target={{ type: 'user', id: userId }}
        />
      )}

      {currentUserId && userId && (
        <FollowListModal
          visible={showFollowList}
          onClose={() => setShowFollowList(false)}
          userId={userId}
          currentUserId={currentUserId}
          initialTab={followListTab}
          isOwnProfile={isOwnProfile}
        />
      )}

      {currentUserId && userId && userProfile && (
        <SPDonateSheet
          visible={showSPSheet}
          onClose={() => setShowSPSheet(false)}
          senderId={currentUserId}
          recipientId={userId}
          recipientName={userProfile.display_name || 'Kullanıcı'}
        />
      )}

      <PremiumAlert {...cAlert} onDismiss={() => setCAlert(prev => ({ ...prev, visible: false }))} />
    </View>
  );
}

const sty = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 300,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 48,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: '#F1F5F9', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  loadingBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 60,
  },
  blockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.15)',
  },
  blockedBannerText: { color: '#FCA5A5', fontSize: 11, flex: 1, lineHeight: 15 },
  incomingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
    gap: 8,
  },
  incomingLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  incomingText: { color: '#CBD5E1', fontSize: 11, flex: 1, lineHeight: 15 },
  incomingActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  incomingApproveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    backgroundColor: '#14B8A6',
  },
  incomingApproveText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  incomingRejectBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  incomingRejectText: { color: '#94A3B8', fontSize: 11, fontWeight: '600' },
  interactionRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
  },
  followBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 999,
    backgroundColor: '#14B8A6',
  },
  followBtnActive: { backgroundColor: 'rgba(20,184,166,0.15)', borderWidth: 1, borderColor: 'rgba(20,184,166,0.3)' },
  followBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  privateBox: {
    marginHorizontal: 16, marginTop: 10, padding: 20, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  privateTitle: { color: '#94A3B8', fontSize: 13, fontWeight: '600', marginTop: 8, textAlign: 'center' },
  privateDesc: { color: '#64748B', fontSize: 11, marginTop: 4, textAlign: 'center' },
  activityCard: {
    marginHorizontal: 16, marginTop: 10, padding: 14, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  activityGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  activityItem: { alignItems: 'center', flex: 1 },
  activityNum: { color: '#F1F5F9', fontSize: 16, fontWeight: '800', marginTop: 4 },
  activityLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '500', marginTop: 2 },
  tierCard: {
    marginHorizontal: 16, marginTop: 10, padding: 14, borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  tierIcon: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  tierTitle: { fontSize: 13, fontWeight: '700' },
  tierDesc: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  donateCard: {
    marginHorizontal: 16, marginTop: 10, borderRadius: 16, overflow: 'hidden',
  },
  donateGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14,
  },
  donateText: { color: '#FFF', fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginHorizontal: 16, marginTop: 10,
    borderRadius: 16, overflow: 'hidden',
    paddingVertical: 12,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10 },
  actionBtnText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  actionSep: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.08)' },
});
