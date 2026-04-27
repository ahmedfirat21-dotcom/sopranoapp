/**
 * SopranoChat — User Profile Overlay (Clubhouse tarzı)
 * Avatar tıklamasında her yerden açılır (oda içi + dışı).
 * Oda içi: tek dokunuş = profil + moderasyon. Odadan çıkmaz, peek chain.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Image, Pressable, ScrollView,
  ActivityIndicator, Dimensions, Animated,
  PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Shadows } from '../../constants/theme';
import { TIER_DEFINITIONS } from '../../constants/tiers';
import type { TierName } from '../../types';
import { ProfileService, type Profile } from '../../services/database';
import { FriendshipService, type FriendshipStatus, type FriendUser } from '../../services/friendship';
import { FollowService } from '../../services/follows';
import StatusAvatar from '../StatusAvatar';
import { ModerationService } from '../../services/moderation';
import { UserTitleService, type UserTitle } from '../../services/userTitles';
import { showToast } from '../Toast';
import ProfileHero from '../profile/ProfileHero';
import BadgeListModal from '../profile/BadgeListModal';
import SPDonateSheet from '../profile/SPDonateSheet';
import FollowListModal from '../FollowListModal';
import { ReportModal } from '../ReportModal';
import PremiumAlert, { type AlertButton } from '../PremiumAlert';
import { supabase } from '../../constants/supabase';

const { height: H } = Dimensions.get('window');

/** ★ 2026-04-28: Hibrit pattern — Clubhouse 3-snap mekanik + wizard görsel chrome.
 *  - Açılışta SHEET_HALF (yarım gözat). Drag-up → SHEET_FULL. Drag-down → dismiss.
 *  - Sheet stili: top: sheetTop (animated), bottom: 0 — taban ekrana sabit (memory).
 *  - Slate-blue diagonal gradient + chevron-down + tier chip header (wizard ile aynı). */
const SHEET_HALF = H * 0.45;       // yarım açık başlangıç
const SHEET_DISMISS = H + 50;      // ekran dışı (kapalı)

const iconShadow = {
  textShadowColor: 'rgba(0,0,0,0.5)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
} as const;

/** ★ 2026-04-26: Oda içi moderasyon aksiyonları — ProfileCard'dan taşındı.
 *  Artık kişiye tıklayınca direkt InRoomUserProfile açılır (tek dokunuş = tam profil + mod). */
type ModActions = {
  onPromoteToStage?: () => void;
  onRemoveFromStage?: () => void;
  onMute?: () => void;
  onUnmute?: () => void;
  onChatMute?: () => void;
  onKick?: () => void;
  onMakeModerator?: () => void;
  onGhostMode?: () => void;
  isGhost?: boolean;
  onDisguise?: () => void;
  /** ★ 2026-04-28: Host self-disguise toggle state — label "Bürün/Çıkar" değişimi için */
  isDisguised?: boolean;
  onBanTemp?: () => void;
  onBanPerm?: () => void;
  onPersonalMute?: () => void;
  isPersonallyMuted?: boolean;
  onSelfDemote?: () => void;
  onSelfPromote?: () => void;
  onTip?: () => void;
  donationsEnabled?: boolean;
  onDM?: () => void;
  /** Hedef kullanıcının oda içi rolü */
  displayRole?: string;
  isMuted?: boolean;
  isChatMuted?: boolean;
  mutedUntil?: string | null;
};

type Props = {
  visible: boolean;
  userId: string | null;
  currentUserId: string | null;
  onClose: () => void;
  /** Arkadaş chip tıklanınca parent overlay userId'sini yeni kişiye set eder — peek chain. */
  onSelectUser?: (userId: string) => void;
  /** Oda içi mod + sosyal aksiyonlar — Clubhouse pattern: primer inline + 3-nokta menü. */
  modActions?: ModActions;
  /** ★ 2026-04-26: Aynı odadaysak "Şu an dinliyor" banner'ını gizle (gereksiz tekrar bilgi). */
  excludeRoomId?: string;
  /** ★ 2026-04-26: SADECE oda DIŞI sheet için — "Tam Profili Aç" linki render eder.
   *  Oda içi sheet'ten escape yasak (memory: feedback_clubhouse_no_exit), bu yüzden parent vermez. */
  onViewFullProfile?: () => void;
  /** ★ 2026-04-26: Backdrop tıklanınca kapansın mı? Oda DIŞI'nda evet (kullanıcı beklentisi),
   *  oda İÇİ'nde hayır (oda alanı tıklanabilir kalmalı, Clubhouse no-exit). */
  closeOnBackdropTap?: boolean;
};

export default function InRoomUserProfile({ visible, userId, currentUserId, onClose, onSelectUser, modActions, excludeRoomId, onViewFullProfile, closeOnBackdropTap = false }: Props) {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [followStatus, setFollowStatus] = useState<FriendshipStatus | null>(null);
  const [incomingStatus, setIncomingStatus] = useState<FriendshipStatus | null>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [incomingLoading, setIncomingLoading] = useState(false);
  const [stats, setStats] = useState({ friends: 0, followers: 0, following: 0, rooms: 0, badges: 0 });
  const [friendsPreview, setFriendsPreview] = useState<FriendUser[]>([]);
  const [profileStats, setProfileStats] = useState({ stageMinutes: 0, roomsCreated: 0, totalListeners: 0, totalReactions: 0 });
  const [userTitle, setUserTitle] = useState<UserTitle | null>(null);
  const [isUserBlocked, setIsUserBlocked] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showFollowList, setShowFollowList] = useState(false);
  const [followListTab, setFollowListTab] = useState<'friends' | 'followers' | 'following'>('friends');
  const [showSPSheet, setShowSPSheet] = useState(false);
   const [showBadgesModal, setShowBadgesModal] = useState(false);
   const [cAlert, setCAlert] = useState<{ visible: boolean; title: string; message: string; type?: 'info' | 'warning' | 'error' | 'success'; buttons?: AlertButton[] }>({ visible: false, title: '', message: '' });
   // ★ 2026-04-26: Şu an hangi odada + ortak arkadaş + one-way follow
   const [currentRoom, setCurrentRoom] = useState<{ id: string; name: string } | null>(null);
   const [isFollowingUser, setIsFollowingUser] = useState(false);
   const [followToggleLoading, setFollowToggleLoading] = useState(false);
   const [mutualFriendCount, setMutualFriendCount] = useState(0);
   /** ★ 2026-04-26: 3-nokta menü açıkken az kullanılan mod aksiyonları görünür (Clubhouse pattern) */
   const [showMoreActions, setShowMoreActions] = useState(false);

  // ★ 2026-04-28: 3-snap mekanik — translateY-based (useNativeDriver:true).
  //   Önceki top-based JS-driven animation pan gesture ile race ediyordu — sadece handle bar'da çalışıyordu.
  //   Snap değerleri ekran-mutlak koordinatlar; sheet style top:0, bottom:0 sabit, transform translateY ile kayar.
  const insets = useSafeAreaInsets();
  const sheetFullRef = useRef<number>(Math.max(insets.top, 20) + 10);
  sheetFullRef.current = Math.max(insets.top, 20) + 10;
  const translateY = useRef(new Animated.Value(SHEET_DISMISS)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const currentSnapRef = useRef<number>(SHEET_HALF);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const isOwnProfile = currentUserId === userId;

  const loadProfile = useCallback(async () => {
    if (!userId) return;
    // ★ 2026-04-26: 2 aşamalı yükleme — önce kritik (profile + block), spinner kalkar.
    //   Sonra ek detaylar (stats, friends, tier, currentRoom) arka planda yüklenir.
    //   Kullanıcı 11 sorgunun bitmesini beklemez, ilk gördüğünde profile gözükür.
    const targetUserId = userId; // race condition koruması: userId değişirse eski response ezilmesin
    setLoading(true);
    setUserProfile(null);
    setFriendsPreview([]);
    setStats({ friends: 0, followers: 0, following: 0, rooms: 0, badges: 0 });
    setProfileStats({ stageMinutes: 0, roomsCreated: 0, totalListeners: 0, totalReactions: 0 });
    setUserTitle(null);
    setFollowStatus(null);
    setIncomingStatus(null);
    setIsUserBlocked(false);
    setCurrentRoom(null);
    setIsFollowingUser(false);
    setMutualFriendCount(0);
    setShowMoreActions(false);
    try {
      // ── Aşama 1: Kritik veri — profile + block check (avatar/isim/bio görünsün, spinner kalksın) ──
      let blocked = false;
      if (currentUserId && !isOwnProfile) {
        try {
          const blockedIds = await ModerationService.getBlockedUsers(currentUserId);
          blocked = blockedIds.includes(targetUserId);
          if (targetUserId !== userId) return; // userId değişti
          setIsUserBlocked(blocked);
        } catch {}
      }

      if (blocked) {
        const { data } = await supabase.from('profiles').select('id, display_name, avatar_url').eq('id', targetUserId).single();
        if (targetUserId !== userId) return;
        setUserProfile(data as any);
        setStats({ friends: 0, followers: 0, following: 0, rooms: 0, badges: 0 });
        setLoading(false);
        return;
      }

      const profile = await ProfileService.get(targetUserId);
      if (targetUserId !== userId) return; // userId değişti, eski cevabı ez
      setUserProfile(profile);
      setLoading(false); // ★ Spinner KAPANIR — kullanıcı profile'ı görür, ek veriler arka planda gelir.

      // ── Aşama 2: Detaylı veriler (paralel, arka planda) ──
      const detailedPromise = currentUserId && !isOwnProfile
        ? FriendshipService.getDetailedStatus(currentUserId, targetUserId).catch(() => null)
        : Promise.resolve(null);

      const [
        detailed,
        friendList,
        roomCountRes,
        pStats,
        title,
        followerN,
        followingN,
      ] = await Promise.all([
        detailedPromise,
        FriendshipService.getFriends(targetUserId).catch(() => [] as any[]),
        supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('host_id', targetUserId),
        ProfileService.getProfileStats(targetUserId).catch(() => ({ stageMinutes: 0, roomsCreated: 0, totalListeners: 0, totalReactions: 0 })),
        UserTitleService.getPrimaryTitle(targetUserId).catch(() => null),
        FollowService.getFollowerCount(targetUserId).catch(() => 0),
        FollowService.getFollowingCount(targetUserId).catch(() => 0),
      ]);

      if (targetUserId !== userId) return;

      // ★ Faz 6.3 — Rozet sayısı (ayrı catch'lı query, Promise.all type karmaşası önlendi)
      let badgeCount = 0;
      try {
        const r = await supabase.from('user_badges').select('*', { count: 'exact', head: true }).eq('user_id', targetUserId);
        badgeCount = r.count ?? 0;
      } catch { /* yoksa 0 */ }

      if (targetUserId !== userId) return;
      if (detailed) {
        setFollowStatus(detailed.outgoing);
        setIncomingStatus(detailed.incoming);
      }
      setFriendsPreview(friendList);
      setStats({ friends: friendList.length, followers: followerN, following: followingN, rooms: roomCountRes.count ?? 0, badges: badgeCount });
      setProfileStats(pStats);
      setUserTitle(title);

      // ★ 2026-04-26: Currently-in-room + one-way follow + mutual friends (non-blocking)
      try {
        const [roomRes, followRes, mutualRes] = await Promise.all([
          // Şu an hangi odada
          Promise.resolve(
            supabase.from('room_participants')
              .select('room_id, rooms!inner(id, name, is_live)')
              .eq('user_id', userId)
              .limit(1)
          ).then(r => {
              const row = r.data?.[0] as any;
              if (row?.rooms?.is_live) return { id: row.rooms.id, name: row.rooms.name };
              return null;
            }).catch(() => null),
          // One-way follow
          currentUserId && !isOwnProfile
            ? FollowService.isFollowing(currentUserId, userId).catch(() => false)
            : Promise.resolve(false),
          // Mutual friends (ortak arkadaş)
          currentUserId && !isOwnProfile
            ? FriendshipService.getFriends(currentUserId).then(myFriends => {
                const myFriendIds = new Set(myFriends.map((f: any) => f.id));
                return friendList.filter((f: any) => myFriendIds.has(f.id)).length;
              }).catch(() => 0)
            : Promise.resolve(0),
        ]);
        setCurrentRoom(roomRes);
        setIsFollowingUser(followRes);
        setMutualFriendCount(mutualRes);
      } catch { /* non-critical */ }
    } catch (err) {
      if (__DEV__) console.warn('[InRoomUserProfile] load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, currentUserId, isOwnProfile]);

  // ★ 2026-04-28: 3-snap pan — useSwipeToDismiss hook pattern (kanıtlanmış capture mantığı).
  //   onMoveShouldSetPanResponder (dy>8): child responder yokken parent için (handle/empty alanlar)
  //   onMoveShouldSetPanResponderCapture (dy>25 + dy/dx>2): Pressable/ScrollView'dan responder ÇALMAK için
  //   Eski (dy>8) capture eşiği Pressable lock'u kıramıyordu — sadece handle bar'da çalışıyordu.
  const scrollOffsetRef = useRef(0);
  const handleScroll = useCallback((e: any) => {
    scrollOffsetRef.current = e?.nativeEvent?.contentOffset?.y ?? 0;
  }, []);

  const isHalfState = () => currentSnapRef.current !== sheetFullRef.current;

  // ★ 2026-04-28: Header bölgesi için ayrı pan — scroll-aware DEĞİL, her zaman yakala.
  //   Kullanıcı FULL state'te ScrollView'da scroll yapmışsa scroll-top kontrolü false dönüyor,
  //   sheet root pan dismiss yakalamıyor → kullanıcı sheet'i aşağı çekemiyor (sadece minimize).
  //   Header (handle + chevron + başlık + tier chip) her zaman görünür, oradan drag her zaman çalışır.
  const headerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onMoveShouldSetPanResponderCapture: (_, g) =>
        Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        const newY = currentSnapRef.current + g.dy;
        translateY.setValue(Math.max(sheetFullRef.current - 20, newY));
      },
      onPanResponderRelease: (_, g) => {
        const finalPos = currentSnapRef.current + g.dy;
        if (finalPos > H * 0.65 || g.vy > 0.8) {
          currentSnapRef.current = SHEET_DISMISS;
          Animated.parallel([
            Animated.timing(translateY, { toValue: SHEET_DISMISS, duration: 200, useNativeDriver: true }),
            Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
          ]).start(() => onCloseRef.current());
          return;
        }
        if (finalPos < H * 0.35 || g.vy < -0.5) {
          currentSnapRef.current = sheetFullRef.current;
          Animated.spring(translateY, { toValue: sheetFullRef.current, useNativeDriver: true, damping: 22, stiffness: 200 }).start();
          return;
        }
        currentSnapRef.current = SHEET_HALF;
        Animated.spring(translateY, { toValue: SHEET_HALF, useNativeDriver: true, damping: 22, stiffness: 200 }).start();
      },
    })
  ).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,

      // Small threshold — child responder yokken (handle bar, başlık metin alanı)
      onMoveShouldSetPanResponder: (_, g) => {
        if (Math.abs(g.dy) < 8) return false;
        if (Math.abs(g.dy) <= Math.abs(g.dx)) return false;
        if (isHalfState()) return true;
        return g.dy > 0 && scrollOffsetRef.current <= 0;
      },

      // Large threshold — Pressable/ScrollView'dan responder ÇAL
      onMoveShouldSetPanResponderCapture: (_, g) => {
        if (Math.abs(g.dy) < 25) return false;
        if (Math.abs(g.dy) <= Math.abs(g.dx) * 2) return false;
        if (isHalfState()) return true;
        return g.dy > 0 && scrollOffsetRef.current <= 0;
      },

      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        const newY = currentSnapRef.current + g.dy;
        translateY.setValue(Math.max(sheetFullRef.current - 20, newY));
      },
      onPanResponderRelease: (_, g) => {
        const finalPos = currentSnapRef.current + g.dy;

        if (finalPos > H * 0.65 || g.vy > 0.8) {
          currentSnapRef.current = SHEET_DISMISS;
          Animated.parallel([
            Animated.timing(translateY, { toValue: SHEET_DISMISS, duration: 200, useNativeDriver: true }),
            Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
          ]).start(() => onCloseRef.current());
          return;
        }

        if (finalPos < H * 0.35 || g.vy < -0.5) {
          currentSnapRef.current = sheetFullRef.current;
          Animated.spring(translateY, { toValue: sheetFullRef.current, useNativeDriver: true, damping: 22, stiffness: 200 }).start();
          return;
        }

        currentSnapRef.current = SHEET_HALF;
        Animated.spring(translateY, { toValue: SHEET_HALF, useNativeDriver: true, damping: 22, stiffness: 200 }).start();
      },
    })
  ).current;

  const handleClose = useCallback(() => {
    currentSnapRef.current = SHEET_DISMISS;
    Animated.parallel([
      Animated.timing(translateY, { toValue: SHEET_DISMISS, duration: 200, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => onClose());
  }, [onClose, translateY, backdropOpacity]);

  useEffect(() => {
    if (visible && userId) {
      translateY.setValue(SHEET_DISMISS);
      backdropOpacity.setValue(0);
      currentSnapRef.current = SHEET_HALF;
      loadProfile();
      Animated.parallel([
        Animated.spring(translateY, { toValue: SHEET_HALF, useNativeDriver: true, damping: 22, stiffness: 200 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, userId, loadProfile, translateY, backdropOpacity]);

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
          setStats(prev => ({ ...prev, friends: Math.max(0, prev.friends - 1) }));
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
        setStats(prev => ({ ...prev, friends: prev.friends + 1 }));
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

  if (!visible) return null;

  return (
    // ★ 2026-04-28: Modal sarmalayıcı KALDIRILDI — Modal native dialog Pan responder Capture phase'inde
    //   Pressable child'larla çakışıyordu (drag handle dışında her yer ölüydü). Create-room.tsx wizard
    //   da Modal kullanmıyor (route root View) ve sürükleme sorunsuz çalışıyor.
    //   Global mount _layout.tsx'te → absolute overlay yeterli.
    <View style={sty.root} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.55)', opacity: backdropOpacity }]} pointerEvents={closeOnBackdropTap ? 'auto' : 'none'}>
        {closeOnBackdropTap && <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />}
      </Animated.View>

      {/* ★ Wizard pattern: top:0+bottom:0+transform translateY, slate-blue gradient, chevron-down + tier chip header. */}
      <Animated.View
        style={[sty.sheet, { transform: [{ translateY }] }]}
        {...panResponder.panHandlers}
      >
          <LinearGradient
            colors={['#4a5668', '#37414f', '#232a35']}
            locations={[0, 0.35, 1]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />

          {/* ★ 2026-04-28: Header bölgesi (handle + chevron + başlık + tier chip) her zaman drag yakalar.
               FULL state'te scroll-top değilken bile sürükleyerek HALF/dismiss'e inilebilir. */}
          <View {...headerPanResponder.panHandlers}>
            <View style={sty.handleWrap}>
              <View style={sty.dragHandle} />
            </View>

            <View style={sty.wizardHeader}>
              <Pressable onPress={handleClose} style={sty.iconBtn} hitSlop={8}>
                <Ionicons name="chevron-down" size={22} color="#F1F5F9" />
              </Pressable>
              <Text style={sty.wizardTitle}>PROFİL</Text>
              <View style={sty.tierChip}>
                <Text style={sty.tierChipText}>{tier}</Text>
              </View>
            </View>
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
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >

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
              bio={userProfile.bio || ''}
              avatarUrl={userProfile.avatar_url || ''}
              subscriptionTier={tier as any}
              isAdmin={!!userProfile.is_admin}
              userTitle={userTitle}
              stats={{ friends: stats.friends, followers: stats.followers, following: stats.following, rooms: stats.rooms, badges: stats.badges }}
              activityStats={profileStats}
              hideStats={!canSeeFullProfile}
              hideRoomsCount={!isOwnProfile && !!((userProfile as any)?.hide_owned_rooms)}
              onFriendsPress={() => { setFollowListTab('friends'); setShowFollowList(true); }}
              onFollowersPress={() => { setFollowListTab('followers'); setShowFollowList(true); }}
              onFollowingPress={() => { setFollowListTab('following'); setShowFollowList(true); }}
              onRoomsPress={() => {}}
              onBadgesPress={() => setShowBadgesModal(true)}
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


                {/* ★ 2026-04-26: Birleşik etkileşim satırı — Takip + Arkadaş + DM */}
                <View style={sty.interactionRow}>
                  {/* One-way Takip butonu — Arkadaş Ekle ile eşit genişlik (flex 1) */}
                  <Pressable
                    onPress={async () => {
                      if (!currentUserId || !userId || followToggleLoading) return;
                      setFollowToggleLoading(true);
                      const willFollow = !isFollowingUser;
                      setIsFollowingUser(willFollow);
                      try {
                        const r = willFollow
                          ? await FollowService.addFollow(currentUserId, userId)
                          : await FollowService.removeFollow(currentUserId, userId);
                        if (!r.success) setIsFollowingUser(!willFollow);
                      } catch { setIsFollowingUser(!willFollow); }
                      finally { setFollowToggleLoading(false); }
                    }}
                    disabled={followToggleLoading || isUserBlocked}
                    style={({ pressed }) => [{
                      flex: 1,
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                      paddingHorizontal: 14, height: 42, borderRadius: 999,
                      backgroundColor: isFollowingUser ? 'rgba(20,184,166,0.15)' : 'rgba(255,255,255,0.06)',
                      borderWidth: 1,
                      borderColor: isFollowingUser ? 'rgba(20,184,166,0.4)' : 'rgba(255,255,255,0.1)',
                      opacity: pressed ? 0.7 : 1,
                    }]}
                  >
                    {followToggleLoading ? <ActivityIndicator size="small" color="#14B8A6" /> : (
                      <>
                        <Ionicons name={isFollowingUser ? 'checkmark' : 'add'} size={14} color={isFollowingUser ? '#14B8A6' : '#fff'} />
                        <Text style={{ fontSize: 12, fontWeight: '800', color: isFollowingUser ? '#14B8A6' : '#fff' }}>
                          {isFollowingUser ? 'Takipte' : 'Takip Et'}
                        </Text>
                      </>
                    )}
                  </Pressable>
                  {/* Arkadaş Ekle butonu */}
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
                  {/* DM butonu — sadece arkadaşlara açık (strict policy: yalnız arkadaşlar mesajlaşır).
                      modActions.onDM yoksa /chat/[userId]'e direkt navigate ediyor (global mount). */}
                  {isFriend && !isUserBlocked && !isOwnProfile && userId && (
                    <Pressable
                      style={sty.dmBtn}
                      onPress={() => {
                        handleClose();
                        const target = userId;
                        if (modActions?.onDM) {
                          setTimeout(() => modActions.onDM?.(), 250);
                        } else if (target) {
                          setTimeout(() => router.push(`/chat/${target}` as any), 250);
                        }
                      }}
                    >
                      <Ionicons name="chatbubble-outline" size={18} color="#E2E8F0" />
                    </Pressable>
                  )}
                  {/* ★ 2026-04-26: SP Gönder yuvarlak altın chip — eski full-width karta göre çok daha kompakt */}
                  {!isOwnProfile && !isUserBlocked && currentUserId && (
                    <Pressable
                      style={sty.spChipBtn}
                      onPress={() => setShowSPSheet(true)}
                    >
                      <LinearGradient
                        colors={['#FFE082', '#FBBF24', '#D97706']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFillObject}
                      />
                      <Ionicons name="diamond" size={16} color="#FFF" style={iconShadow} />
                    </Pressable>
                  )}
                </View>

                {/* ★ 2026-04-26: Şu an hangi odada — aynı odadaysak gizle (gereksiz tekrar). */}
                {currentRoom && currentRoom.id !== excludeRoomId && (
                  <View style={sty.currentRoomBanner}>
                    <View style={sty.currentRoomDot} />
                    <Text style={sty.currentRoomLabel}>Şu an dinliyor:</Text>
                    <Text style={sty.currentRoomName} numberOfLines={1}>{currentRoom.name}</Text>
                  </View>
                )}

                {/* ★ 2026-04-26: Ortak arkadaş göstergesi — Clubhouse "mutual friends" */}
                {mutualFriendCount > 0 && (
                  <View style={sty.mutualBadge}>
                    <Ionicons name="people" size={13} color="#A78BFA" style={iconShadow} />
                    <Text style={sty.mutualText}>{mutualFriendCount} ortak arkadaş</Text>
                  </View>
                )}

                {/* ★ 2026-04-26: Clubhouse pattern — mod aksiyonları profil sheet İÇİNDE inline.
                     Primer aksiyon (büyük buton) + Mute toggle (varsa) + 3-nokta menü (az kullanılanlar).
                     Mevcut modActions değişkenleri görünürlük belirler. */}
                {modActions && (() => {
                  // ★ 2026-04-26: Renk paleti standardı — mod aksiyonları MOR (#A855F7),
                  //   sosyal/info turkuaz, tehlike (kick/ban) kırmızı. Renk kakofonisi giderildi.
                  const MOD = '#A855F7';
                  const DANGER = '#EF4444';

                  // Primer aksiyon: en kritik tek aksiyon (sahne kontrolü)
                  const primary = modActions.onPromoteToStage
                    ? { fn: modActions.onPromoteToStage, icon: 'arrow-up-circle' as const, label: 'Sahneye Davet', color: MOD }
                    : modActions.onRemoveFromStage
                    ? { fn: modActions.onRemoveFromStage, icon: 'arrow-down-circle' as const, label: 'Sahneden İndir', color: MOD }
                    : modActions.onSelfPromote
                    ? { fn: modActions.onSelfPromote, icon: 'arrow-up-circle' as const, label: 'Sahneye Çık', color: MOD }
                    : modActions.onSelfDemote
                    ? { fn: modActions.onSelfDemote, icon: 'arrow-down-circle-outline' as const, label: 'Sahneden İn', color: DANGER }
                    : null;

                  // Mute toggle: moderatör + hedef speaker
                  const muteToggle = modActions.isMuted && modActions.onUnmute
                    ? { fn: modActions.onUnmute, icon: 'volume-high' as const, label: 'Sesi Aç', color: MOD }
                    : modActions.onMute
                    ? { fn: modActions.onMute, icon: 'volume-mute' as const, label: 'Sustur', color: MOD }
                    : null;

                  // ★ 2026-04-26: 3-nokta menüsü iki gruba ayrıldı — sade mod (mor) ve tehlikeli yaptırım (kırmızı).
                  //   Görsel olarak ayraç çizgi ile ayrılır, kullanıcı yanlışlıkla ban/kick'e basmaz.
                  type MenuItem = { fn: () => void; icon: keyof typeof Ionicons.glyphMap; label: string; color: string; danger?: boolean };
                  const moderationItems: MenuItem[] = [];
                  const enforcementItems: MenuItem[] = [];

                  if (modActions.onChatMute) moderationItems.push({ fn: modActions.onChatMute, icon: modActions.isChatMuted ? 'chatbox' : 'chatbox-outline', label: modActions.isChatMuted ? 'Yazı Aç' : 'Yazı Kapat', color: MOD });
                  if (modActions.onMakeModerator) moderationItems.push({ fn: modActions.onMakeModerator, icon: 'shield', label: modActions.displayRole === 'moderator' ? 'Moderatörlüğü Kaldır' : 'Moderatör Yap', color: MOD });
                  if (modActions.onPersonalMute) moderationItems.push({ fn: modActions.onPersonalMute, icon: modActions.isPersonallyMuted ? 'volume-high' : 'volume-mute', label: modActions.isPersonallyMuted ? 'Sesi Aç (sadece bana)' : 'Benim İçin Sustur', color: MOD });
                  if (modActions.onGhostMode) moderationItems.push({ fn: modActions.onGhostMode, icon: modActions.isGhost ? 'eye' : 'eye-off', label: modActions.isGhost ? 'Görünür Ol' : 'Görünmez Mod', color: MOD });
                  if (modActions.onDisguise) moderationItems.push({
                    fn: modActions.onDisguise,
                    icon: modActions.isDisguised ? 'person' : 'person-circle',
                    label: modActions.isDisguised ? 'Kılığı Çıkar' : 'Kılığa Bürün',
                    color: MOD,
                  });

                  if (modActions.onKick) enforcementItems.push({ fn: modActions.onKick, icon: 'exit', label: 'Odadan Çıkar', color: DANGER, danger: true });
                  if (modActions.onBanTemp) enforcementItems.push({ fn: modActions.onBanTemp, icon: 'timer', label: 'Geçici Ban', color: DANGER, danger: true });
                  if (modActions.onBanPerm) enforcementItems.push({ fn: modActions.onBanPerm, icon: 'ban', label: 'Kalıcı Ban', color: DANGER, danger: true });
                  if (!isOwnProfile && currentUserId) {
                    enforcementItems.push({ fn: () => setShowReportModal(true), icon: 'flag-outline', label: 'Rapor Et', color: DANGER, danger: true });
                    enforcementItems.push({ fn: handleBlock, icon: isUserBlocked ? 'checkmark-circle' : 'ban', label: isUserBlocked ? 'Engeli Kaldır' : 'Engelle', color: DANGER, danger: true });
                  }

                  const hasMore = moderationItems.length > 0 || enforcementItems.length > 0;
                  if (!primary && !muteToggle && !hasMore) return null;

                  // ★ 2026-04-26: Inline butonlar yoksa 3-nokta yalnız kalıyor (sıradan kullanıcı görüntüsü) — menüyü direkt aç.
                  const hasInlineButtons = !!primary || !!muteToggle;
                  const expandMore = !hasInlineButtons || showMoreActions;

                  const fire = (fn?: () => void) => { if (!fn) return; handleClose(); setTimeout(fn, 250); };

                  return (
                    <View style={sty.modInlineWrap}>
                      {hasInlineButtons && (
                      <View style={sty.modInlineRow}>
                        {primary && (
                          <Pressable
                            style={[sty.modPrimaryBtn, { borderColor: primary.color + '40' }]}
                            onPress={() => fire(primary.fn)}
                          >
                            {/* ★ 2026-04-26: Yumuşak gradient — parlaklık düşürüldü, mat premium hissi.
                                 Eski: parlak → siyah agresif gradient. Yeni: koyu mor → daha koyu mor (subtle) */}
                            <LinearGradient
                              colors={[primary.color + 'DD', primary.color + '77']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 0, y: 1 }}
                              style={StyleSheet.absoluteFillObject}
                            />
                            <Ionicons name={primary.icon} size={16} color="#fff" style={iconShadow} />
                            <Text style={[sty.modPrimaryText, { color: '#fff' }]}>{primary.label}</Text>
                          </Pressable>
                        )}
                        {muteToggle && (
                          <Pressable
                            style={[sty.modIconBtn, { borderColor: muteToggle.color + '40' }]}
                            onPress={() => fire(muteToggle.fn)}
                          >
                            <Ionicons name={muteToggle.icon} size={18} color={muteToggle.color} style={iconShadow} />
                          </Pressable>
                        )}
                        {hasMore && (
                          <Pressable
                            // ★ 2026-04-26: 3-nokta gri (nötr) — Sahneye Davet'in mor primary CTA'sıyla rekabet etmesin.
                            style={[sty.modIconBtn, showMoreActions && { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)' }]}
                            onPress={() => setShowMoreActions(s => !s)}
                          >
                            <Ionicons name="ellipsis-horizontal" size={18} color="#CBD5E1" style={iconShadow} />
                          </Pressable>
                        )}
                      </View>
                      )}

                      {expandMore && hasMore && (
                        <View style={sty.moreActionsCard}>
                          <LinearGradient colors={['#4a5668', '#37414f', '#232a35']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
                          {moderationItems.map((it, idx) => (
                            <Pressable
                              key={`mod-${idx}`}
                              style={[sty.moreActionRow, idx > 0 && sty.moreActionDivider]}
                              onPress={() => fire(it.fn)}
                            >
                              <Ionicons name={it.icon} size={16} color={it.color} style={iconShadow} />
                              <Text style={sty.moreActionLabel}>{it.label}</Text>
                            </Pressable>
                          ))}
                          {/* ★ 2026-04-26: Tehlikeli yaptırım grubu — kırmızı vurgu + ayraç. Kullanıcı yanlışlıkla ban'a basmasın. */}
                          {moderationItems.length > 0 && enforcementItems.length > 0 && (
                            <View style={sty.dangerSeparator}>
                              <View style={sty.dangerLine} />
                              <Text style={sty.dangerHeading}>YAPTIRIM</Text>
                              <View style={sty.dangerLine} />
                            </View>
                          )}
                          {enforcementItems.map((it, idx) => (
                            <Pressable
                              key={`enf-${idx}`}
                              style={[sty.moreActionRow, idx > 0 && sty.moreActionDivider]}
                              onPress={() => fire(it.fn)}
                            >
                              <Ionicons name={it.icon} size={16} color={it.color} style={iconShadow} />
                              <Text style={[sty.moreActionLabel, { color: '#FCA5A5' }]}>{it.label}</Text>
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })()}
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
                {/* ★ 2026-04-26: activityCard kaldırıldı — ProfileHero'nun detay strip'inde
                     aynı bilgiler (sahne dk + dinleyici + reaksiyon) zaten gösteriliyor (activityStats prop). */}

                {/* ★ 2026-04-25: ÜYELİK — Plus/Pro için premium section header + diagonal gradient kart */}
                {tier !== 'Free' && (
                  <>
                    <View style={sty.premiumSectionHeader}>
                      <View style={[sty.sectionAccent, { backgroundColor: tierDef.color }]} />
                      <Ionicons name={tierDef.icon as any} size={13} color={tierDef.color} style={iconShadow} />
                      <Text style={sty.premiumSectionText}>ÜYELİK</Text>
                    </View>
                    <View style={sty.sectionCard}>
                      <LinearGradient colors={['#4a5668', '#37414f', '#232a35']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
                      <LinearGradient colors={['transparent', tierDef.color + '99', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={sty.sectionTopEdge} />
                      <View style={sty.tierRow}>
                        <LinearGradient colors={tierDef.gradient as [string, string]} style={sty.tierIcon}>
                          <Ionicons name={tierDef.icon as any} size={16} color="#fff" style={iconShadow} />
                        </LinearGradient>
                        <View style={{ flex: 1 }}>
                          <Text style={[sty.tierTitle, { color: tierDef.color }]}>{tierDef.label} Üye</Text>
                          <Text style={sty.tierDesc}>
                            {tier === 'Pro' ? 'Sınırsız oda · 1080p · Stereo ses' : 'HD ses · 720p video · Tüm oda türleri'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </>
                )}

                {/* ★ 2026-04-25: CÜZDANIM — section header + altın gradient kart (sadece own profile) */}
                {isOwnProfile && (
                  <>
                    <View style={sty.premiumSectionHeader}>
                      <View style={[sty.sectionAccent, { backgroundColor: '#FBBF24' }]} />
                      <Ionicons name="diamond" size={13} color="#FBBF24" style={iconShadow} />
                      <Text style={sty.premiumSectionText}>CÜZDANIM</Text>
                    </View>
                    <View style={sty.walletCard}>
                      <LinearGradient colors={['#2a1e14', '#17100a', '#0a0604']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
                      <LinearGradient colors={['rgba(251,191,36,0.35)', 'rgba(251,191,36,0.1)', 'rgba(251,191,36,0.02)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
                      <LinearGradient colors={['transparent', 'rgba(251,191,36,0.6)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={sty.sectionTopEdge} />
                      <Ionicons name="diamond" size={100} color="rgba(251,191,36,0.05)" style={sty.walletWatermark} />
                      <View style={sty.walletRow}>
                        <Text style={sty.walletAmount}>{((userProfile as any)?.system_points ?? 0).toLocaleString('tr-TR')}</Text>
                        <Text style={sty.walletCurrency}>SP</Text>
                      </View>
                      <Text style={sty.walletSub}>Soprano Points</Text>
                    </View>
                  </>
                )}

                {/* ★ 2026-04-26: ARKADAŞLAR — sadece 2+ arkadaş varsa kart göster.
                     Tek arkadaş için bütün bir kart açmak yer israfı.
                     "Tümü" linki sadece 4+ varsa anlamlı (3 chip görünüyor zaten). */}
                {friendsPreview.length >= 2 && (
                  <>
                    <View style={sty.premiumSectionHeader}>
                      <View style={[sty.sectionAccent, { backgroundColor: Colors.teal }]} />
                      <Ionicons name="people" size={13} color={Colors.teal} style={iconShadow} />
                      <Text style={sty.premiumSectionText}>{isOwnProfile ? 'ARKADAŞLARIM' : 'ARKADAŞLARI'}</Text>
                      <View style={sty.friendsCountBadge}>
                        <Text style={sty.friendsCountText}>{friendsPreview.length}</Text>
                      </View>
                      {friendsPreview.length >= 4 && (
                        <Pressable onPress={() => { setFollowListTab('friends'); setShowFollowList(true); }} hitSlop={8}>
                          <Text style={sty.friendsSeeAll}>Tümü</Text>
                        </Pressable>
                      )}
                    </View>
                    <View style={sty.friendsStripCard}>
                      <LinearGradient colors={['#4a5668', '#37414f', '#232a35']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
                      <LinearGradient colors={['transparent', 'rgba(20,184,166,0.6)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={sty.sectionTopEdge} />
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={sty.friendsStripContent}
                      >
                        {friendsPreview.map((f) => (
                          <Pressable
                            key={f.id}
                            style={({ pressed }) => [sty.friendChip, pressed && { opacity: 0.75 }]}
                            onPress={() => onSelectUser?.(f.id)}
                          >
                            <StatusAvatar
                              uri={f.avatar_url || undefined}
                              size={36}
                              isOnline={(f as any).is_online}
                              tier={(f as any).subscription_tier}
                            />
                            <Text style={sty.friendChipName} numberOfLines={1}>
                              {f.display_name || 'Kullanıcı'}
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  </>
                )}

                {/* ★ 2026-04-26: Eski full-width SP Gönder kartı kaldırıldı — interaction row'a yuvarlak altın chip olarak taşındı. */}

                {/* ★ 2026-04-26: "Tam Profili Aç" linki — sadece oda DIŞI sheet'te (universal mount).
                     Kullanıcı arkadaşının odalarına/detaylarına ulaşmak için tam sayfaya geçebilir. */}
                {onViewFullProfile && (
                  <Pressable
                    style={sty.viewFullBtn}
                    onPress={() => { handleClose(); setTimeout(() => onViewFullProfile(), 250); }}
                  >
                    <Ionicons name="open-outline" size={14} color="#94A3B8" style={iconShadow} />
                    <Text style={sty.viewFullText}>Tam Profili Aç</Text>
                    <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.3)" />
                  </Pressable>
                )}

                {/* ★ 2026-04-26: Rapor Et / Engelle 3-nokta menüsüne taşındı — alt satırı sil, daha az scroll. */}

                {/* ★ 2026-04-25: Clubhouse modeli — kullanıcı odadan asla çıkmaz.
                     Tam profile escape hatch kaldırıldı; tüm peek overlay içinde tamamlanır. */}
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

      {/* ★ Faz 6.3 — Rozet Listesi Modal */}
      {userId && userProfile && (
        <BadgeListModal
          visible={showBadgesModal}
          onClose={() => setShowBadgesModal(false)}
          userId={userId}
          displayName={userProfile.display_name}
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
    backgroundColor: '#000',
  },
  sheet: {
    // ★ 2026-04-28: top:0+bottom:0 sabit, transform translateY ile snap (useNativeDriver:true).
    //   translateY=SHEET_FULL → sheet üstü insets+30'da görünür (FULL state)
    //   translateY=SHEET_HALF → sheet üstü ekran ortasında (HALF state)
    //   translateY=SHEET_DISMISS → sheet ekran dışı (kapalı)
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#95a1ae',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 16,
  },
  handleWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  dragHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  wizardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(20,184,166,0.06)',
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(149,161,174,0.18)',
  },
  wizardTitle: {
    fontSize: 12, fontWeight: '700', color: '#94A3B8', letterSpacing: 1.2,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  tierChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    backgroundColor: 'rgba(20,184,166,0.12)', borderWidth: 1, borderColor: 'rgba(20,184,166,0.25)',
  },
  tierChipText: {
    fontSize: 11, fontWeight: '800', color: Colors.teal,
    textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
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
    marginHorizontal: 16, marginTop: 14, padding: 14, borderRadius: 16,
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
  // ★ tierIcon, tierTitle, tierDesc → aşağıda yeni tanımlar (premium section header rev.)
  donateCard: {
    marginHorizontal: 16, marginTop: 14, borderRadius: 16, overflow: 'hidden',
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
    marginHorizontal: 16, marginTop: 14,
    borderRadius: 16, overflow: 'hidden',
    paddingVertical: 12,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10 },
  actionBtnText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  actionSep: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.08)' },

  // ★ 2026-04-25: Premium Section Header — profil sayfası ile tutarlı
  //   (accent bar + icon + UPPERCASE label + opsiyonel badge/link)
  premiumSectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 14, marginBottom: 8,
  },
  sectionAccent: { width: 3, height: 14, borderRadius: 2 },
  premiumSectionText: {
    flex: 1, fontSize: 11, fontWeight: '900', color: '#CBD5E1',
    letterSpacing: 1.2, textTransform: 'uppercase',
    ...Shadows.text,
  },

  // ★ Kart — diagonal gradient + teal hairline üst + koyu shadow (profile pattern)
  sectionCard: {
    marginHorizontal: 16, padding: 14, borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.cardBorder,
    ...Shadows.card,
  },
  sectionTopEdge: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 1.5,
  },

  // ★ Üyelik iç satır
  tierRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  tierIcon: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    ...Shadows.card,
  },
  tierTitle: {
    fontSize: 14, fontWeight: '900', letterSpacing: 0.3,
    ...Shadows.text,
  },
  tierDesc: {
    fontSize: 11, color: '#94A3B8', marginTop: 2, fontWeight: '500',
    ...Shadows.textLight,
  },

  // ★ CÜZDAN — altın premium kart (profil sayfasındaki walletCard ile aynı dil)
  walletCard: {
    marginHorizontal: 16, padding: 14, borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.35)',
    shadowColor: '#FBBF24', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22, shadowRadius: 14, elevation: 8,
  },
  walletWatermark: {
    position: 'absolute', right: -14, bottom: -20,
  },
  walletRow: {
    flexDirection: 'row', alignItems: 'baseline', gap: 6,
  },
  walletAmount: {
    fontSize: 26, fontWeight: '900', color: '#FFD700', letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6,
  },
  walletCurrency: {
    fontSize: 13, fontWeight: '800', color: 'rgba(251,191,36,0.75)', letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  walletSub: {
    fontSize: 9, fontWeight: '700', color: 'rgba(251,191,36,0.6)',
    letterSpacing: 1, textTransform: 'uppercase', marginTop: 3,
    ...Shadows.textLight,
  },

  // ★ Arkadaşlar — header içi count (profil sayfası ile aynı pill)
  friendsCountBadge: {
    backgroundColor: 'rgba(20,184,166,0.12)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.25)',
  },
  friendsCountText: { fontSize: 10, fontWeight: '800', color: '#14B8A6' },
  friendsSeeAll: {
    fontSize: 11, fontWeight: '800', color: '#5EEAD4', letterSpacing: 0.3,
    ...Shadows.text,
  },

  // ★ Yatay scrollable avatar strip kartı
  friendsStripCard: {
    marginHorizontal: 16, borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.cardBorder,
    ...Shadows.card,
  },
  friendsStripContent: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 12, gap: 10,
  },
  friendChip: {
    alignItems: 'center', width: 48, gap: 4,
  },
  friendChipName: {
    fontSize: 9, fontWeight: '700', color: '#E2E8F0',
    maxWidth: 48, textAlign: 'center',
    ...Shadows.text,
  },

  // ★ 2026-04-26: DM butonu
  dmBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  // ★ 2026-04-26: SP Gönder yuvarlak altın chip — full-width karta göre çok daha kompakt
  spChipBtn: {
    width: 42, height: 42, borderRadius: 21,
    overflow: 'hidden' as const,
    alignItems: 'center' as const, justifyContent: 'center' as const,
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.45)',
    ...Shadows.card,
  },

  // ★ 2026-04-26: Şu an hangi odada
  currentRoomBanner: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8,
    marginHorizontal: 16, marginTop: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)',
  },
  currentRoomDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#22C55E',
    shadowColor: '#22C55E', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 4, elevation: 3,
  },
  currentRoomLabel: {
    fontSize: 11, fontWeight: '600' as const, color: '#86EFAC',
  },
  currentRoomName: {
    flex: 1, fontSize: 12, fontWeight: '800' as const, color: '#F1F5F9',
    ...Shadows.text,
  },

  // ★ 2026-04-26: Ortak arkadaş badge
  mutualBadge: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6,
    marginHorizontal: 16, marginTop: 8,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(167,139,250,0.08)',
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)',
  },
  mutualText: {
    fontSize: 11, fontWeight: '700' as const, color: '#C4B5FD',
    ...Shadows.text,
  },

  // ★ 2026-04-26: Clubhouse pattern — inline mod aksiyonları (primer + mute + 3-nokta)
  modInlineWrap: { marginHorizontal: 16, marginTop: 14, gap: 10 },
  modInlineRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8,
  },
  modPrimaryBtn: {
    flex: 1,
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    gap: 8, height: 44, borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden' as const,
    ...Shadows.card,
  },
  modPrimaryText: {
    fontSize: 13, fontWeight: '800' as const, letterSpacing: 0.3,
    ...Shadows.text,
  },
  modIconBtn: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center' as const, justifyContent: 'center' as const,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  // ★ 2026-04-26: 3-nokta menüsü — border + shadow kaldırıldı, sayfa akışkan tek bütün.
  moreActionsCard: {
    borderRadius: 14, overflow: 'hidden' as const,
  },
  moreActionRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    gap: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  moreActionDivider: {
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
  },
  moreActionLabel: {
    flex: 1, fontSize: 13, fontWeight: '600' as const, color: '#E2E8F0',
    ...Shadows.text,
  },
  // ★ 2026-04-26: 3-nokta menüsünde "Moderasyon" ve "Yaptırım" gruplarını ayıran çizgi + başlık.
  dangerSeparator: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    paddingHorizontal: 14, paddingVertical: 8, gap: 8,
    backgroundColor: 'rgba(239,68,68,0.04)',
  },
  dangerLine: {
    flex: 1, height: 1, backgroundColor: 'rgba(239,68,68,0.2)',
  },
  dangerHeading: {
    fontSize: 9, fontWeight: '900' as const, color: '#FCA5A5',
    letterSpacing: 1.5, textTransform: 'uppercase' as const,
    ...Shadows.text,
  },
  // ★ 2026-04-26: "Tam Profili Aç" linki (sadece oda dışı sheet)
  viewFullBtn: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    gap: 8, marginHorizontal: 16, marginTop: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  viewFullText: {
    flex: 1, fontSize: 12, fontWeight: '700' as const, color: '#CBD5E1',
    letterSpacing: 0.3,
    ...Shadows.text,
  },
});
