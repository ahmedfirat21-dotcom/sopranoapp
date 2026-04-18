import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Image, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '../../constants/navigation';
import { Colors, Shadows } from '../../constants/theme';
import { TIER_DEFINITIONS } from '../../constants/tiers';
import { TierBadge } from '../../components/progression';
import type { TierName } from '../../types';
import { getAvatarSource } from '../../constants/avatars';
import { ProfileService, type Profile } from '../../services/database';
import { FriendshipService, type FriendshipStatus } from '../../services/friendship';
import { ModerationService } from '../../services/moderation';
import { UserTitleService, type UserTitle } from '../../services/userTitles';

import { ReportModal } from '../../components/ReportModal';
import { showToast } from '../../components/Toast';
import { useAuth } from '../_layout';
import { supabase } from '../../constants/supabase';

import { isTierAtLeast } from '../../constants/tiers';
import PremiumAlert, { type AlertButton } from '../../components/PremiumAlert';
import AppBackground from '../../components/AppBackground';
import FollowListModal from '../../components/FollowListModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';



export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { firebaseUser, profile: currentUserProfile, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [followStatus, setFollowStatus] = useState<FriendshipStatus | null>(null);
  // ★ X.com tarzı: karşı tarafın bana gönderdiği istek durumu
  const [incomingStatus, setIncomingStatus] = useState<FriendshipStatus | null>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [incomingLoading, setIncomingLoading] = useState(false);
  const [stats, setStats] = useState({ followers: 0, following: 0, rooms: 0 });

  const [showReportModal, setShowReportModal] = useState(false);
  const [isUserBlocked, setIsUserBlocked] = useState(false);
  const [cAlert, setCAlert] = useState<{ visible: boolean; title: string; message: string; type?: 'info' | 'warning' | 'error' | 'success'; buttons?: AlertButton[] }>({ visible: false, title: '', message: '' });



  // ★ Katmanlı profil verileri
  const [profileStats, setProfileStats] = useState({ stageMinutes: 0, roomsCreated: 0, totalListeners: 0, totalReactions: 0 });
  const [recentRooms, setRecentRooms] = useState<any[]>([]);
  const [userTitle, setUserTitle] = useState<UserTitle | null>(null);

  const [showFollowList, setShowFollowList] = useState(false);
  const [followListTab, setFollowListTab] = useState<'followers' | 'following'>('followers');

  const isOwnProfile = firebaseUser?.uid === id;

  const loadProfile = useCallback(async () => {
    if (!id) return;
    try {
      const profile = await ProfileService.get(id);
      setUserProfile(profile);

      // ★ X.com tarzı: Çift yönlü takip durumu
      if (firebaseUser && !isOwnProfile) {
        const detailed = await FriendshipService.getDetailedStatus(firebaseUser.uid, id);
        setFollowStatus(detailed.outgoing);   // Ben → Hedef
        setIncomingStatus(detailed.incoming);  // Hedef → Ben

        // ★ BUG-10 FIX: Engel durumunu yükle
        try {
          const blocked = await ModerationService.getBlockedUsers(firebaseUser.uid);
          setIsUserBlocked(blocked.includes(id));
        } catch {}
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





      // ★ Katmanlı profil verileri
      try {
        const [pStats, rooms] = await Promise.all([
          ProfileService.getProfileStats(id),
          ProfileService.getRecentRooms(id),
        ]);
        setProfileStats(pStats);
        setRecentRooms(rooms);
        // ★ FIX-P2: Unvan badge — kendi profille tutarlı
        try {
          const title = await UserTitleService.getPrimaryTitle(id);
          setUserTitle(title);
        } catch {}
      } catch {}
    } catch (err) {
      if (__DEV__) console.warn('Profil yuklenemedi:', err);
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
        const result = await FriendshipService.unfollow(firebaseUser.uid, id);
        if (result.success) {
          setFollowStatus(null);
          setStats(prev => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
        }
      } else if (followStatus === 'pending') {
        const result = await FriendshipService.unfollow(firebaseUser.uid, id);
        if (result.success) {
          setFollowStatus(null);
        }
      } else {
        const result = await FriendshipService.follow(firebaseUser.uid, id);
        if (result.success) {
          setFollowStatus('pending');
        } else if (result.error) {
          showToast({ title: result.error, type: 'warning' });
        }
      }
    } catch (err) {
      showToast({ title: 'Hata oluştu', type: 'error' });
    } finally {
      setFollowLoading(false);
    }
  };

  // ★ X.com tarzı: Gelen takip isteğini onayla
  const handleApproveIncoming = async () => {
    if (!firebaseUser || !id) return;
    setIncomingLoading(true);
    try {
      const result = await FriendshipService.approveRequest(firebaseUser.uid, id);
      if (result.success) {
        setIncomingStatus('accepted');
        setStats(prev => ({ ...prev, followers: prev.followers + 1 }));
      }
    } catch {
      // silent
    } finally {
      setIncomingLoading(false);
    }
  };

  // ★ X.com tarzı: Gelen takip isteğini reddet
  const handleRejectIncoming = async () => {
    if (!firebaseUser || !id) return;
    setIncomingLoading(true);
    try {
      const result = await FriendshipService.rejectRequest(firebaseUser.uid, id);
      if (result.success) {
        setIncomingStatus(null);
      }
    } catch {
      // silent
    } finally {
      setIncomingLoading(false);
    }
  };

  const handleBlock = async () => {
    if (!firebaseUser || !id) return;
    if (isUserBlocked) {
      // Engeli kaldır
      try {
        await ModerationService.unblockUser(firebaseUser.uid, id);
        setIsUserBlocked(false);
      } catch (e) { /* silent */ }
    } else {
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
                await ModerationService.blockUser(firebaseUser.uid, id);
                setIsUserBlocked(true);
                // ★ EX-4 FIX: Engelleme sonrası takipten de çıkar
                if (followStatus === 'accepted' || followStatus === 'pending') {
                  await FriendshipService.unfollow(firebaseUser.uid, id).catch(() => {});
                  setFollowStatus(null);
                }
                showToast({ title: 'Kullanıcı engellendi', type: 'info' });
              } catch (e) { /* silent */ }
            },
          },
        ],
      });
    }
  };

  // handleMoreMenu kaldırıldı — inline butonlar kullanılıyor

  const handleDonate = async (amount: number) => {
    if (!firebaseUser || !id) return;
    try {
      const result = await ProfileService.donateToUser(firebaseUser.uid, id, amount);
      if (result.success) {
        showToast({ title: `${amount} SP gönderildi! 💎`, type: 'success' });
        refreshProfile(); // SP bakiyesini güncelle
      } else {
        showToast({ title: result.error || 'Transfer başarısız', type: 'error' });
      }
    } catch {
      showToast({ title: 'Bir hata oluştu', type: 'error' });
    }
  };

  if (loading) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.teal} />
      </View>
    );
  }

  if (!userProfile) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
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
  // ★ BUG-11 FIX: isBlocked artık block_list'ten gelen isUserBlocked state'ini kullanıyor
  const isBlocked = isUserBlocked;
  // ★ X.com tarzı: Karşılıklı takip kontrolü
  const isMutual = isFollowing && incomingStatus === 'accepted';
  const hasIncomingPending = incomingStatus === 'pending';

  // ★ ECO-7 FIX: Gizli profil kontrolü — takipçi değilse detaylar gizlenir
  const isPrivateProfile = !isOwnProfile && (
    userProfile?.privacy_mode === 'private' ||
    userProfile?.privacy_mode === 'followers_only' ||
    userProfile?.is_private === true
  );
  const canSeeFullProfile = isOwnProfile || isFollowing || !isPrivateProfile;

  return (
    <AppBackground variant="profile">
    <View style={s.container}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => safeGoBack(router)} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#F1F5F9" />
        </Pressable>
        <Text style={s.headerTitle}>Profil</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ═══ Profil Kartı ═══ */}
        <View style={s.card}>
          <LinearGradient
            colors={[tierDef.color + '15', 'transparent']}
            style={s.cardGlow}
          />
          <View style={s.identityRow}>
            <View style={{ position: 'relative' as const }}>
              <View style={[s.avatarRing, { borderColor: tierBorderColor, shadowColor: tierBorderColor }]}>
                <Image source={getAvatarSource(userProfile.avatar_url)} style={s.avatarImg} />
              </View>
              <LinearGradient colors={tierDef.gradient as [string, string]} style={s.tierPill}>
                <Ionicons name={tierDef.icon as any} size={8} color="#fff" />
                <Text style={s.tierPillText}>{tierDef.label}</Text>
              </LinearGradient>
              {/* Online durumu — avatar köşesinde */}
              {userProfile.is_online && (
                <View style={s.onlineDot} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[s.displayName, userProfile.is_admin && { color: '#F87171' }]} numberOfLines={1}>{userProfile.display_name}</Text>
                {userProfile.is_admin && (
                  <Ionicons name="shield-checkmark" size={14} color="#DC2626" style={{ marginLeft: 4 }} />
                )}
              </View>
              {userProfile.username && <Text style={s.username}>@{userProfile.username}</Text>}
              {userTitle && (
                <View style={[s.titleBadge, { backgroundColor: userTitle.bgColor }]}>
                  <Text style={{ fontSize: 10 }}>{userTitle.emoji}</Text>
                  <Text style={[s.titleText, { color: userTitle.color }]}>{userTitle.name}</Text>
                </View>
              )}
              <Text style={s.bio} numberOfLines={3}>{userProfile.bio || 'Henüz bir şey yazmadı ☕'}</Text>
            </View>
          </View>

          {/* Stat Satırı — Pressable: tıklayınca FollowListModal */}
          <View style={s.statsRow}>
            <Pressable style={s.statItem} onPress={() => { setFollowListTab('followers'); setShowFollowList(true); }}>
              <Text style={s.statNum}>{stats.followers}</Text>
              <Text style={s.statLabelClickable}>Takipçi</Text>
            </Pressable>
            <View style={s.statDiv} />
            <Pressable style={s.statItem} onPress={() => { setFollowListTab('following'); setShowFollowList(true); }}>
              <Text style={s.statNum}>{stats.following}</Text>
              <Text style={s.statLabelClickable}>Takip</Text>
            </Pressable>
            <View style={s.statDiv} />
            <View style={s.statItem}>
              <Text style={s.statNum}>{stats.rooms}</Text>
              <Text style={s.statLabel}>Oda</Text>
            </View>
          </View>
        </View>

        {/* ═══ Etkileşim Butonları ═══ */}
        {!isOwnProfile && (
          <>
            {/* ★ X.com tarzı: Gelen takip isteği banner'ı */}
            {hasIncomingPending && (
              <View style={s.incomingBanner}>
                <View style={s.incomingBannerLeft}>
                  <Ionicons name="person-add" size={16} color="#F59E0B" />
                  <Text style={s.incomingBannerText}>
                    <Text style={{ fontWeight: '800', color: '#F1F5F9' }}>{userProfile.display_name}</Text>
                    {' '}seni takip etmek istiyor
                  </Text>
                </View>
                <View style={s.incomingBannerActions}>
                  {incomingLoading ? (
                    <ActivityIndicator size="small" color="#14B8A6" />
                  ) : (
                    <>
                      <Pressable style={s.incomingApproveBtn} onPress={handleApproveIncoming}>
                        <Ionicons name="checkmark" size={16} color="#FFF" />
                        <Text style={s.incomingApproveBtnText}>Onayla</Text>
                      </Pressable>
                      <Pressable style={s.incomingRejectBtn} onPress={handleRejectIncoming}>
                        <Ionicons name="close" size={16} color="#94A3B8" />
                        <Text style={s.incomingRejectBtnText}>Sil</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              </View>
            )}

            <View style={s.interactionRow}>
              <Pressable
                style={[s.followBtn, (isFollowing || isPending || isMutual) && s.followBtnActive]}
                onPress={handleFollow}
                disabled={followLoading || isBlocked}
                android_ripple={{ color: 'rgba(255,255,255,0.1)', borderless: false }}
              >
                {followLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : isBlocked ? (
                  <Text style={[s.followBtnText, { color: '#EF4444' }]}>Engellendi</Text>
                ) : isMutual ? (
                  <><Ionicons name="swap-horizontal" size={16} color="#F1F5F9" /><Text style={[s.followBtnText, { color: '#F1F5F9' }]}>Karşılıklı Takip</Text></>
                ) : isFollowing ? (
                  <Text style={[s.followBtnText, { color: 'rgba(255,255,255,0.8)' }]}>Takip Ediliyor</Text>
                ) : isPending ? (
                  <Text style={[s.followBtnText, { color: '#FBBF24' }]}>Bekliyor</Text>
                ) : (
                  <Text style={s.followBtnText}>Takip Et</Text>
                )}
              </Pressable>
              {/* ★ S1 FIX: Mesaj → herkese açık (DM-8 isteği yönetir), Arama → sadece karşılıklı takip */}
              {!isBlocked && (
                <View style={s.secondaryRow}>
                  <Pressable style={s.secondaryBtn} onPress={() => router.push(`/chat/${id}`)}>
                    <Ionicons name="chatbubble-outline" size={18} color="#E2E8F0" />
                  </Pressable>
                  {isMutual && (
                    <Pressable style={s.secondaryBtn} onPress={() => router.push(`/call/${id}?callType=audio` as any)}>
                      <Ionicons name="call-outline" size={18} color="#E2E8F0" />
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          </>
        )}

        {/* ★ ECO-7: Gizli profil bildirimi */}
        {!canSeeFullProfile && (
          <View style={{ marginHorizontal: 16, marginBottom: 10, padding: 20, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center' }}>
            <Ionicons name="lock-closed" size={28} color="#94A3B8" />
            <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '600', marginTop: 8, textAlign: 'center' }}>Bu hesap gizli</Text>
            <Text style={{ color: '#64748B', fontSize: 11, marginTop: 4, textAlign: 'center' }}>İçerikleri görmek için takip et</Text>
          </View>
        )}

        {canSeeFullProfile && (
        <>

        {/* ═══ Aktivite İstatistikleri ═══ */}
        {(profileStats.stageMinutes > 0 || profileStats.roomsCreated > 0 || profileStats.totalListeners > 0) && (
          <View style={s.activityCard}>
            <View style={s.activityGrid}>
              <View style={s.activityItem}>
                <Ionicons name="mic" size={20} color={Colors.teal} style={{ textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }} />
                <Text style={s.activityNum}>{profileStats.stageMinutes}</Text>
                <Text style={s.activityLabel}>dk sahne</Text>
              </View>
              <View style={s.activityItem}>
                <Ionicons name="radio" size={20} color="#A855F7" style={{ textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }} />
                <Text style={s.activityNum}>{profileStats.roomsCreated}</Text>
                <Text style={s.activityLabel}>oda</Text>
              </View>
              <View style={s.activityItem}>
                <Ionicons name="people" size={20} color="#F59E0B" style={{ textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }} />
                <Text style={s.activityNum}>{profileStats.totalListeners}</Text>
                <Text style={s.activityLabel}>dinleyici</Text>
              </View>
              <View style={s.activityItem}>
                <Ionicons name="heart" size={20} color="#EF4444" style={{ textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }} />
                <Text style={s.activityNum}>{profileStats.totalReactions}</Text>
                <Text style={s.activityLabel}>reaksiyon</Text>
              </View>
            </View>
          </View>
        )}

        {/* ═══ Tier Bilgi Kartı ═══ */}
        <View style={s.tierCard}>
          <LinearGradient
            colors={[tierDef.color + '18', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <LinearGradient colors={tierDef.gradient as [string, string]} style={s.tierCardIcon}>
              <Ionicons name={tierDef.icon as any} size={16} color="#fff" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[s.tierCardTitle, { color: tierDef.color }]}>{tierDef.label} Üye</Text>
              <Text style={s.tierCardDesc}>{tier === 'Pro' ? 'Sınırsız oda · 1080p · Stereo ses' : tier === 'Plus' ? 'HD ses · 720p video · Tüm oda türleri' : 'Ücretsiz plan · Temel özellikler'}</Text>
            </View>
          </View>
        </View>

        {/* ═══ Banner (Pro+) — Tier kartının hemen altında ═══ */}
        {isTierAtLeast(tier, 'Pro') && userProfile?.banner_url && (
          <View style={s.bannerWrap}>
            <Image source={{ uri: userProfile.banner_url }} style={s.bannerImg} />
          </View>
        )}

        {/* ═══ Odaları ═══ */}
        {recentRooms.length > 0 && (
          <View style={s.listContainer}>
            <Text style={s.sectionInnerTitle}>🎩️ Odaları ({recentRooms.length})</Text>
            {recentRooms.map((room: any, idx: number) => {
              const isLive = (room.listener_count || 0) > 0 || room.is_live;
              return (
                <Pressable
                  key={room.id}
                  style={[s.roomItem, idx === recentRooms.length - 1 && { borderBottomWidth: 0 }]}
                  onPress={() => router.push(`/room/${room.id}` as any)}
                >
                  <View style={[s.roomIconWrap, isLive && { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
                    <Ionicons name={isLive ? 'radio' : 'mic'} size={14} color={isLive ? '#22C55E' : Colors.accentTeal} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.roomItemName} numberOfLines={1}>{room.name}</Text>
                    <Text style={s.roomItemMeta}>
                      {isLive ? `🔴 Canlı · ${room.listener_count || 0} dinleyici` : room.category || 'Oda'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.15)" />
                </Pressable>
              );
            })}
          </View>
        )}

        {/* ═══ SP Gönder Butonu ═══ */}
        {!isOwnProfile && !isBlocked && firebaseUser && (
          <Pressable
            style={s.donateCard}
            onPress={() => {
              setCAlert({
                visible: true,
                title: '💎 SP Gönder',
                message: `${userProfile.display_name || 'Bu kullanıcı'} adlı kişiye kaç SP göndermek istiyorsun?\n\nBakiyen: ${currentUserProfile?.system_points || 0} SP`,
                type: 'info',
                buttons: [
                  { text: '10 SP', onPress: () => handleDonate(10) },
                  { text: '50 SP', onPress: () => handleDonate(50) },
                  { text: '100 SP', onPress: () => handleDonate(100) },
                  { text: 'Vazgeç', style: 'cancel' },
                ],
              });
            }}
          >
            <LinearGradient colors={['#F59E0B', '#EF4444']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.donateGradient}>
              <Ionicons name="gift-outline" size={18} color="#FFF" />
              <Text style={s.donateText}>SP Gönder</Text>
            </LinearGradient>
          </Pressable>
        )}

        {/* ═══ Rapor / Engelle — inline butonlar ═══ */}
        {!isOwnProfile && firebaseUser && (
          <View style={s.actionRow}>
            <Pressable style={s.actionBtn} onPress={() => setShowReportModal(true)}>
              <Ionicons name="flag-outline" size={16} color="#94A3B8" />
              <Text style={s.actionBtnText}>Rapor Et</Text>
            </Pressable>
            <View style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.06)' }} />
            <Pressable style={s.actionBtn} onPress={handleBlock}>
              <Ionicons name={isUserBlocked ? 'checkmark-circle' : 'ban'} size={16} color={isUserBlocked ? '#22C55E' : '#EF4444'} />
              <Text style={[s.actionBtnText, { color: isUserBlocked ? '#22C55E' : '#EF4444' }]}>{isUserBlocked ? 'Engeli Kaldır' : 'Engelle'}</Text>
            </Pressable>
          </View>
        )}


        </>
        )}
      </ScrollView>

      {/* Report Modal */}
      {firebaseUser && id && (
        <ReportModal
          visible={showReportModal}
          onClose={() => setShowReportModal(false)}
          reporterId={firebaseUser.uid}
          target={{ type: 'user', id }}
        />
      )}

      {/* FollowList Modal */}
      {firebaseUser && id && (
        <FollowListModal
          visible={showFollowList}
          onClose={() => setShowFollowList(false)}
          userId={id}
          currentUserId={firebaseUser.uid}
          initialTab={followListTab}
          isOwnProfile={isOwnProfile}
        />
      )}
      <PremiumAlert {...cAlert} onDismiss={() => setCAlert(prev => ({ ...prev, visible: false }))} />
    </View>
    </AppBackground>
  );
}

// ★ DUP-1 FIX: Shadows.card ve Shadows.text theme.ts'den geliyor — yerel kopya kaldırıldı
const _cardShadow = Shadows.card;
const _textGlow = Shadows.text;

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#F1F5F9', ..._textGlow },
  moreBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },

  // Profil Kartı
  card: {
    marginHorizontal: 16, marginBottom: 10,
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
  avatarRing: {
    width: 84, height: 84, borderRadius: 42,
    borderWidth: 2.5, padding: 2,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 6,
  },
  avatarImg: { width: '100%', height: '100%', borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.05)' },
  tierPill: {
    position: 'absolute' as const, bottom: -2, right: -4,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 10,
    borderWidth: 2, borderColor: '#414e5f',
  },
  tierPillText: { fontSize: 8, fontWeight: '800', color: '#fff', letterSpacing: 0.3, ..._textGlow },
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
  onlineDot: {
    position: 'absolute' as const, top: 2, right: 6,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#22C55E',
    borderWidth: 2.5, borderColor: '#414e5f',
    shadowColor: '#22C55E', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 3,
  },

  // Stats
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 12, marginBottom: 14, paddingVertical: 10,
    borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  statItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statNum: { fontSize: 16, fontWeight: '800', color: '#F1F5F9', marginBottom: 1, ..._textGlow },
  statLabel: { fontSize: 9, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },
  statLabelClickable: { fontSize: 9, fontWeight: '600', color: '#5CBFB5', textTransform: 'uppercase', letterSpacing: 0.5 },
  statDiv: { width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.08)' },

  // Interaction
  interactionRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 12 },
  followBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.teal,
    ..._cardShadow,
  },
  followBtnActive: { backgroundColor: '#1e2d35', borderWidth: 1.5, borderColor: 'rgba(20,184,166,0.5)', elevation: 0 },
  followBtnText: { fontSize: 14, fontWeight: '700', color: '#fff', ..._textGlow },
  secondaryRow: { flexDirection: 'row', gap: 8 },
  secondaryBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: '#414e5f', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
    ..._cardShadow,
  },

  // ★ X.com tarzı: Gelen takip isteği banner
  incomingBanner: {
    marginHorizontal: 16, marginBottom: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)',
    ..._cardShadow,
  },
  incomingBannerLeft: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 10,
  },
  incomingBannerText: {
    fontSize: 13, color: '#CBD5E1', flex: 1, lineHeight: 18,
  },
  incomingBannerActions: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  incomingApproveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: '#14B8A6',
    paddingVertical: 10, borderRadius: 10,
  },
  incomingApproveBtnText: {
    fontSize: 13, fontWeight: '700', color: '#FFF',
  },
  incomingRejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  incomingRejectBtnText: {
    fontSize: 13, fontWeight: '600', color: '#94A3B8',
  },

  // Section
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#64748B', letterSpacing: 1, ..._textGlow },
  sectionInnerTitle: { fontSize: 12, fontWeight: '700', color: '#CBD5E1', marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  listContainer: {
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: '#414e5f',
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    ..._cardShadow,
  },

  // Room items (3rd party compact)
  roomItem: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  roomIconWrap: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(20,184,166,0.1)',
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  roomItemName: { fontSize: 13, fontWeight: '700', color: '#F1F5F9', ..._textGlow },
  roomItemMeta: { fontSize: 10, color: '#64748B', marginTop: 1 },

  // Activity card
  activityCard: {
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 16, overflow: 'hidden' as const,
    backgroundColor: '#414e5f',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 14, paddingHorizontal: 10,
    ..._cardShadow,
  },
  activityGrid: {
    flexDirection: 'row' as const, justifyContent: 'space-around' as const,
  },
  activityItem: {
    alignItems: 'center' as const, gap: 4,
  },
  activityNum: {
    fontSize: 15, fontWeight: '800' as const, color: '#F1F5F9', ..._textGlow,
  },
  activityLabel: {
    fontSize: 8, fontWeight: '600' as const, color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: 0.3,
  },

  // Tier card
  tierCard: {
    marginHorizontal: 16, marginBottom: 10,
    padding: 14, borderRadius: 16,
    backgroundColor: '#414e5f',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden' as const,
    ..._cardShadow,
  },
  tierCardIcon: {
    width: 34, height: 34, borderRadius: 12,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  tierCardTitle: {
    fontSize: 14, fontWeight: '800' as const, ..._textGlow,
  },
  tierCardDesc: {
    fontSize: 10, color: '#94A3B8', marginTop: 1,
  },

  // Donate card
  donateCard: {
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 14, overflow: 'hidden' as const,
    ..._cardShadow,
  },
  donateGradient: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    gap: 8, paddingVertical: 14,
  },
  donateText: { fontSize: 15, fontWeight: '700' as const, color: '#FFF', ..._textGlow },

  // Action row (report / block)
  actionRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    marginHorizontal: 16, marginBottom: 10,
    paddingVertical: 10, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  actionBtn: {
    flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    gap: 6, paddingVertical: 4,
  },
  actionBtnText: {
    fontSize: 12, fontWeight: '600' as const, color: '#94A3B8',
  },

  // Banner
  bannerWrap: {
    marginHorizontal: 16, marginBottom: 10,
    height: 80, borderRadius: 14, overflow: 'hidden' as const,
    ..._cardShadow,
  },
  bannerImg: { width: '100%' as any, height: '100%' as any, borderRadius: 14 },
});

