/**
 * SopranoChat — User Profile Overlay (Clubhouse tarzı)
 * Avatar tıklamasında her yerden açılır (oda içi + dışı).
 * Oda içi: tek dokunuş = profil + moderasyon. Odadan çıkmaz, peek chain.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Image, Pressable, ScrollView, Dimensions, Animated,
  PanResponder, Share, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import AppLoader from '../AppLoader';
import { LinearGradient } from 'expo-linear-gradient';
import { GlowView } from '../skia';
import { Ionicons } from '@expo/vector-icons';
import SPIcon from '../SPIcon';
import SPHexagonIcon from '../SPHexagonIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Shadows } from '../../constants/theme';
import { TIER_DEFINITIONS } from '../../constants/tiers';
import type { TierName } from '../../types';
import { ProfileService, type Profile } from '../../services/database';
import { FriendshipService, type FriendshipStatus, type FriendUser } from '../../services/friendship';
import { i18n } from '../../services/i18n';
import { FollowService } from '../../services/follows';
import StatusAvatar from '../StatusAvatar';
import { ModerationService } from '../../services/moderation';
import { UserTitleService, type UserTitle } from '../../services/userTitles';
import { showToast } from '../Toast';
import ProfileHero from '../profile/ProfileHero';
import ProfileSectionHeader from '../profile/ProfileSectionHeader';
import BadgeListModal from '../profile/BadgeListModal';
import GiftDetailModal from '../profile/GiftDetailModal';
import { GiftStatsService } from '../../services/giftStats';
// ★ v107: SPDonateSheet → GiftSheet (kişiye hediye akışı kendi sheet'inde)
import GiftSheet from '../profile/GiftSheet';
// ★ v108.7: SymbolGiftSheet kaldırıldı — hediye akışı sadece oda kontrol barındaki
//   RoomGiftPanel üzerinden (envanter sistemi yok, pay-per-send).
import FollowListModal from '../FollowListModal';
import { ReportModal } from '../ReportModal';
import PremiumAlert, { type AlertButton } from '../PremiumAlert';
import { supabase } from '../../constants/supabase';
import { RoomService } from '../../services/room';
import ProfileIdentityStrip from '../profile/ProfileIdentityStrip';
import FrameSelectSheet from '../profile/FrameSelectSheet';
import {
  VoiceBioPlayer, TopSupportersStrip, MutualRoomsStrip,
  FeaturedBadgesShowcase, SocialLinksRow, InvitedByRow, SpeakingRhythmHint,
} from '../profile/ProfileExtras';
import PersonalNoteCard from '../profile/PersonalNoteCard';
import {
  SupportersService, MutualRoomsService, FeaturedBadgesService,
  UserNotesService, SpeakingRhythmService,
  type Supporter, type MutualRoom,
} from '../../services/profileExtras';

const { height: H } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════════════
// ★ v110.2 (6 May 2026): Module-level profil cache (5dk TTL)
// Aynı kullanıcının profili kısa sürede tekrar açılırsa veriler ANLIK
// gösterilir — her seferinde sıfırdan fetch + 0 stat flash YOK.
// Background'da revalidate olur (stale-while-revalidate pattern).
// TTL 60sn→5dk: Profil verisi sık değişmez, hızlı geri dönüşlerde
// kullanıcı her seferinde "yükleniyor" hissini almasın.
// ═══════════════════════════════════════════════════════════════════
type ProfileCacheEntry = {
  ts: number;
  userProfile: any;
  stats: { friends: number; followers: number; following: number; rooms: number; badges: number; gifts: number };
  friendsPreview: any[];
  profileStats: { stageMinutes: number; roomsCreated: number; totalListeners: number; totalReactions: number };
  userTitle: any;
  followStatus: any;
  incomingStatus: any;
  isUserBlocked: boolean;
  currentRoom: any;
  isFollowingUser: boolean;
  mutualFriendCount: number;
  recentRooms: any[];
  /** ★ v110.3: Mevcut kullanıcının (sheet'i açanın) host'u olduğu CANLI oda — varsa "Davet Et" butonu görünür. */
  myLiveRoom: { id: string; name: string } | null;
  // ★ v110.5 (Faz B + C)
  topSupporters: Supporter[];
  mutualRooms: MutualRoom[];
  featuredBadges: string[];
  personalNote: string | null;
  invitedBy: { id: string; display_name: string; avatar_url: string } | null;
  speakingRhythmText: string | null;
};
const profileCache = new Map<string, ProfileCacheEntry>();
const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;

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
  /** ★ 2026-04-26: Backdrop tıklanınca kapansın mı? Oda DIŞI'nda evet (kullanıcı beklentisi),
   *  oda İÇİ'nde hayır (oda alanı tıklanabilir kalmalı, Clubhouse no-exit). */
  closeOnBackdropTap?: boolean;
};

export default function InRoomUserProfile({ visible, userId, currentUserId, onClose, onSelectUser, modActions, excludeRoomId, closeOnBackdropTap = false }: Props) {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  // ★ v110.14: Kendi profilimde "Envanter / Çerçeve" hızlı butonu — FrameSelectSheet açar.
  const [showOwnFrameSheet, setShowOwnFrameSheet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followStatus, setFollowStatus] = useState<FriendshipStatus | null>(null);
  const [incomingStatus, setIncomingStatus] = useState<FriendshipStatus | null>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [incomingLoading, setIncomingLoading] = useState(false);
  // ★ v107.23: interactionsReady flag KALDIRILDI (kullanıcı talebi).
  //   Eski sürümde 2sn fetch tamamlanana kadar butonlar yerine spinner gösteriliyordu.
  //   Yeni: butonlar default state ile (Takip değil / Arkadaş değil) instant açılır,
  //   fetch arka planda gerçek state'e güncellenir. Yükleniyor sadece kullanıcının
  //   tıkladığı sırada (followToggleLoading / followLoading) görünür — bu mantıklı.
  const interactionsReady = true; // backward compat — diğer kullanım yerleri etkilenmesin
  const [stats, setStats] = useState({ friends: 0, followers: 0, following: 0, rooms: 0, badges: 0, gifts: 0 });
  const [showGiftDetail, setShowGiftDetail] = useState(false);
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
   // ★ v110 (6 May 2026): Kullanıcının odaları — daha önce sadece /user/[id] sayfasında gösteriliyordu.
   //   Artık sheet içinde gerçek profil sayfası deneyimini tamamlıyor (full-page'e gerek kalmadı).
   const [recentRooms, setRecentRooms] = useState<any[]>([]);
   // ★ v110: Tüm "phase 2" verileri (stats, friendship, rooms, mutual) hazır mı?
   //   FALSE iken: stats "—" gösterir, "Bu hesap gizli" banner'ı render edilmez (flash önleme).
   const [dataReady, setDataReady] = useState(false);
   /** ★ 2026-04-26: 3-nokta menü açıkken az kullanılan mod aksiyonları görünür (Clubhouse pattern) */
   const [showMoreActions, setShowMoreActions] = useState(false);
   // ★ v110.3 (6 May 2026): Mevcut kullanıcının canlı oda host'u olup olmadığı —
   //   "Odama Davet Et" butonunun görünürlüğünü belirler.
   const [myLiveRoom, setMyLiveRoom] = useState<{ id: string; name: string } | null>(null);
   const [inviteSending, setInviteSending] = useState(false);
   // ★ v110.5 (Faz B + C)
   const [topSupporters, setTopSupporters] = useState<Supporter[]>([]);
   const [mutualRooms, setMutualRooms] = useState<MutualRoom[]>([]);
   const [featuredBadges, setFeaturedBadges] = useState<string[]>([]);
   const [personalNote, setPersonalNote] = useState<string | null>(null);
   const [invitedBy, setInvitedBy] = useState<{ id: string; display_name: string; avatar_url: string } | null>(null);
   const [speakingRhythmText, setSpeakingRhythmText] = useState<string | null>(null);

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
    // ★ v110 (6 May 2026): Module-level cache HIT → tüm veriler ANLIK gelir,
    //   spinner/0-flash görünmez. Background'da hâlâ revalidate olur.
    const targetUserId = userId; // race condition koruması: userId değişirse eski response ezilmesin
    const cached = profileCache.get(targetUserId);
    const isFresh = cached && (Date.now() - cached.ts < PROFILE_CACHE_TTL_MS);

    if (isFresh && cached) {
      // Cache'ten hidrasyon — kullanıcı sheet'i açar açmaz tüm profil görünür
      setUserProfile(cached.userProfile);
      setStats(cached.stats);
      setFriendsPreview(cached.friendsPreview);
      setProfileStats(cached.profileStats);
      setUserTitle(cached.userTitle);
      setFollowStatus(cached.followStatus);
      setIncomingStatus(cached.incomingStatus);
      setIsUserBlocked(cached.isUserBlocked);
      setCurrentRoom(cached.currentRoom);
      setIsFollowingUser(cached.isFollowingUser);
      setMutualFriendCount(cached.mutualFriendCount);
      setRecentRooms(cached.recentRooms);
      setMyLiveRoom(cached.myLiveRoom);
      setTopSupporters(cached.topSupporters);
      setMutualRooms(cached.mutualRooms);
      setFeaturedBadges(cached.featuredBadges);
      setPersonalNote(cached.personalNote);
      setInvitedBy(cached.invitedBy);
      setSpeakingRhythmText(cached.speakingRhythmText);
      setDataReady(true);
      setLoading(false);
      // Background revalidation altta devam eder (cached değerler güncellensin)
    } else {
      setLoading(true);
      setUserProfile(null);
      setFriendsPreview([]);
      setStats({ friends: 0, followers: 0, following: 0, rooms: 0, badges: 0, gifts: 0 });
      setProfileStats({ stageMinutes: 0, roomsCreated: 0, totalListeners: 0, totalReactions: 0 });
      setUserTitle(null);
      setFollowStatus(null);
      setIncomingStatus(null);
      setIsUserBlocked(false);
      setCurrentRoom(null);
      setIsFollowingUser(false);
      setMutualFriendCount(0);
      setRecentRooms([]);
      setMyLiveRoom(null);
      setTopSupporters([]);
      setMutualRooms([]);
      setFeaturedBadges([]);
      setPersonalNote(null);
      setInvitedBy(null);
      setSpeakingRhythmText(null);
      setDataReady(false);
    }
    setShowMoreActions(false);

    // ★ v110.5 (6 May 2026): "Hepsi birlikte yüklensin" stratejisi.
    //   ESKİ: progressive — her .then ayrı state set ederdi → ortak arkadaş, mutual, stats
    //         farklı zamanlarda flash'lı görünürdü (kullanıcı şikayeti).
    //   YENİ: Cache MISS durumunda hiçbir state aşamalı set edilmez. Skeleton görünür ta ki
    //         TÜM kritik veriler hazır → sonra tek seferde her şey render edilir.
    //         Cache HIT durumunda hidrasyon zaten anlık — revalidation arka planda sessiz.
    const stillCurrent = () => targetUserId === userId;

    // ── Promise'ları başlat (hepsi paralel) ──
    const profilePromise = ProfileService.get(targetUserId).catch((e: any) => {
      if (__DEV__) console.warn('[Profile fetch fail]', e);
      return null;
    });
    const blockedPromise = (currentUserId && !isOwnProfile)
      ? ModerationService.getBlockedUsers(currentUserId).catch(() => [] as string[])
      : Promise.resolve([] as string[]);
    const detailedPromise = (currentUserId && !isOwnProfile)
      ? FriendshipService.getDetailedStatus(currentUserId, targetUserId).catch(() => null)
      : Promise.resolve(null);
    const followPromise = (currentUserId && !isOwnProfile)
      ? FollowService.isFollowing(currentUserId, targetUserId).catch(() => false)
      : Promise.resolve(false);
    const currentRoomPromise = supabase.from('room_participants')
      .select('room_id, rooms!inner(id, name, is_live)')
      .eq('user_id', targetUserId)
      .limit(1)
      .then(r => {
        const row = r.data?.[0] as any;
        return row?.rooms?.is_live ? { id: row.rooms.id, name: row.rooms.name } : null;
      })
      .catch(() => null as null);
    // ★ v110.14 (8 May 2026): Hedef kullanıcı zaten odadaysa "Odama Davet" butonu
    //   gösterilmemeli — odada olan birini odaya davet etmek anlamsız.
    const myLiveRoomPromise = (currentUserId && !isOwnProfile)
      ? supabase.from('rooms').select('id, name').eq('host_id', currentUserId).eq('is_live', true).limit(1)
          .then(async (r) => {
            const row = r.data?.[0] as any;
            if (!row) return null;
            // Hedef kullanıcı bu odanın katılımcısı mı? Varsa davet düğmesi gizle.
            const { data: partRow } = await supabase
              .from('room_participants')
              .select('user_id')
              .eq('room_id', row.id)
              .eq('user_id', targetUserId)
              .maybeSingle();
            if (partRow) return null;
            return { id: row.id, name: row.name };
          })
          .catch(() => null as null)
      : Promise.resolve(null as null);
    const friendListPromise = FriendshipService.getFriends(targetUserId).catch(() => [] as any[]);
    const myFriendsPromise = (currentUserId && !isOwnProfile)
      ? FriendshipService.getFriends(currentUserId).catch(() => [] as any[])
      : Promise.resolve([] as any[]);
    const pStatsPromise = ProfileService.getProfileStats(targetUserId)
      .catch(() => ({ stageMinutes: 0, roomsCreated: 0, totalListeners: 0, totalReactions: 0 }));
    const roomCountPromise = supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('host_id', targetUserId);
    const badgePromise = supabase.from('user_badges').select('*', { count: 'exact', head: true }).eq('user_id', targetUserId);
    const followerNPromise = FollowService.getFollowerCount(targetUserId).catch(() => 0);
    const followingNPromise = FollowService.getFollowingCount(targetUserId).catch(() => 0);
    const giftRecvPromise = GiftStatsService.getReceivedTotal(targetUserId).catch(() => ({ count: 0, total_amount: 0 }));
    const giftSentPromise = GiftStatsService.getSentTotal(targetUserId).catch(() => ({ count: 0, total_amount: 0 }));
    const titlePromise = UserTitleService.getPrimaryTitle(targetUserId).catch(() => null);
    const roomsListPromise = ProfileService.getRecentRooms(targetUserId).catch(() => [] as any[]);

    // ★ v110.5 (Faz B + C): Ekstra paralel fetch'ler — hepsi aynı batch'te yüklenir
    const topSupportersPromise = SupportersService.getTop(targetUserId, 3).catch(() => [] as Supporter[]);
    const mutualRoomsPromise = (currentUserId && !isOwnProfile)
      ? MutualRoomsService.get(currentUserId, targetUserId, 5).catch(() => [] as MutualRoom[])
      : Promise.resolve([] as MutualRoom[]);
    const featuredBadgesPromise = FeaturedBadgesService.getFeatured(targetUserId).catch(() => [] as string[]);
    const personalNotePromise = (currentUserId && !isOwnProfile)
      ? UserNotesService.get(currentUserId, targetUserId).catch(() => null)
      : Promise.resolve(null);
    const speakingRhythmPromise = SpeakingRhythmService.get(targetUserId)
      .then(SpeakingRhythmService.derivePrimeTimeText)
      .catch(() => null);

    // ── Hepsi tamamlanınca: TEK seferde state'leri set et + cache yaz + dataReady aç ──
    //   Skeleton görünüyor olduğundan kullanıcı parça parça flash görmez.
    try {
      const [
        profile, blockedIds, detailed, follow, currentRoomData, myLiveRoomData,
        friends, myFriends, pStats, rc, badge, followerN, followingN, giftR, giftS, title, rooms,
        topSupportersData, mutualRoomsData, featuredBadgesData, personalNoteData, rhythmText,
      ] = await Promise.all([
        profilePromise, blockedPromise, detailedPromise, followPromise, currentRoomPromise, myLiveRoomPromise,
        friendListPromise, myFriendsPromise, pStatsPromise, roomCountPromise, badgePromise,
        followerNPromise, followingNPromise, giftRecvPromise, giftSentPromise, titlePromise, roomsListPromise,
        topSupportersPromise, mutualRoomsPromise, featuredBadgesPromise, personalNotePromise, speakingRhythmPromise,
      ]);

      if (!stillCurrent()) return;
      if (!profile) {
        // Profile dönmediyse (silinmiş/RLS) — skeleton kalksın, "Kullanıcı bulunamadı" göster
        setLoading(false);
        setDataReady(true);
        return;
      }

      // ★ v110.5 — Davet eden profil (referred_by varsa fetch)
      let invitedByData: { id: string; display_name: string; avatar_url: string } | null = null;
      const referrerId = (profile as any).referred_by;
      if (referrerId && referrerId !== targetUserId) {
        try {
          const { data: refProfile } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url')
            .eq('id', referrerId)
            .maybeSingle();
          if (refProfile) {
            invitedByData = {
              id: refProfile.id,
              display_name: refProfile.display_name || 'Kullanıcı',
              avatar_url: refProfile.avatar_url || '',
            };
          }
        } catch { /* sessiz */ }
      }

      // ★ v92.1: Mevcut kullanıcı kendi adını başkasının arkadaş listesinde görmesin
      // ★ v110.5.20 (6 May 2026): Engellediğim kullanıcılar HİÇBİR LİSTEDE görünmez
      //   (Instagram pattern — engelli yokmuş gibi). "Arkadaşımın arkadaş listesinde
      //   görüyorum" şikayeti — bu fix.
      const myBlockedSet = new Set(blockedIds);
      const visibleFriends = currentUserId
        ? friends.filter((f: any) => f.id !== currentUserId && !myBlockedSet.has(f.id))
        : friends;
      const myIds = new Set(myFriends.map((f: any) => f.id));
      const mutualCount = friends.filter((f: any) => myIds.has(f.id) && !myBlockedSet.has(f.id)).length;
      const finalStats = {
        friends: friends.length,
        followers: followerN,
        following: followingN,
        rooms: rc.count ?? 0,
        badges: badge.count ?? 0,
        gifts: ((giftR as any).count || 0) + ((giftS as any).count || 0),
      };
      const isBlocked = blockedIds.includes(targetUserId);

      // ── TEK SEFER batch state update — React 18+ otomatik batch'ler ──
      setUserProfile(profile);
      setIsUserBlocked(isBlocked);
      setFollowStatus(detailed?.outgoing ?? null);
      setIncomingStatus(detailed?.incoming ?? null);
      setIsFollowingUser(follow);
      setCurrentRoom(currentRoomData);
      setMyLiveRoom(myLiveRoomData);
      setFriendsPreview(visibleFriends);
      setMutualFriendCount(mutualCount);
      setStats(finalStats);
      setProfileStats(pStats);
      setUserTitle(title);
      setRecentRooms(rooms || []);
      // ★ v110.5
      setTopSupporters(topSupportersData);
      setMutualRooms(mutualRoomsData);
      setFeaturedBadges(featuredBadgesData);
      setPersonalNote(personalNoteData);
      setInvitedBy(invitedByData);
      setSpeakingRhythmText(rhythmText);

      profileCache.set(targetUserId, {
        ts: Date.now(),
        userProfile: profile,
        stats: finalStats,
        friendsPreview: visibleFriends,
        profileStats: pStats,
        userTitle: title,
        followStatus: detailed?.outgoing ?? null,
        incomingStatus: detailed?.incoming ?? null,
        isUserBlocked: isBlocked,
        currentRoom: currentRoomData,
        isFollowingUser: follow,
        mutualFriendCount: mutualCount,
        recentRooms: rooms || [],
        myLiveRoom: myLiveRoomData,
        // ★ v110.5
        topSupporters: topSupportersData,
        mutualRooms: mutualRoomsData,
        featuredBadges: featuredBadgesData,
        personalNote: personalNoteData,
        invitedBy: invitedByData,
        speakingRhythmText: rhythmText,
      });
      setDataReady(true);
      setLoading(false);
    } catch (err) {
      if (__DEV__) console.warn('[InRoomUserProfile] load failed:', err);
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

  /** ★ v110.3 (6 May 2026): Profili paylaş — sistem share sheet (WhatsApp/SMS/kopyala vs.).
   *  Deep link `https://sopranochat.com/user/<id>` — uygulama yüklüyse direkt sheet açılır,
   *  yüklü değilse Vercel fallback HTML açılır (mevcut Universal Link altyapısı). */
  const handleShareProfile = useCallback(async () => {
    if (!userId || !userProfile) return;
    const url = `https://sopranochat.com/user/${userId}`;
    const message = userProfile.display_name
      ? `${userProfile.display_name} adlı kullanıcının SopranoChat profili: ${url}`
      : `Bu profili SopranoChat'te incele: ${url}`;
    try {
      await Share.share({ message, url, title: userProfile.display_name || 'SopranoChat Profili' });
    } catch {
      // Kullanıcı vazgeçti veya sistem reddetti — sessizce yutsuz, link kopyala fallback
      try {
        await Clipboard.setStringAsync(url);
        showToast({ title: 'Profil linki kopyalandı', type: 'success' });
      } catch {}
    }
  }, [userId, userProfile]);

  /** ★ v110.3 (6 May 2026): Linki direkt kopyala — share sheet açmadan tek tıkla. */
  const handleCopyProfileLink = useCallback(async () => {
    if (!userId) return;
    const url = `https://sopranochat.com/user/${userId}`;
    try {
      await Clipboard.setStringAsync(url);
      showToast({ title: 'Profil linki kopyalandı', type: 'success' });
    } catch {
      showToast({ title: 'Kopyalanamadı', type: 'error' });
    }
  }, [userId]);

  /** ★ v110.3 (6 May 2026): Aktif odama davet et — sadece host iken görünür buton.
   *  RoomService.sendRoomInvite + push notif tetiklenir. Hedef kullanıcı bildirim alır. */
  const handleInviteToMyRoom = useCallback(async () => {
    if (!currentUserId || !userId || !myLiveRoom || inviteSending) return;
    setInviteSending(true);
    try {
      await RoomService.sendRoomInvite(myLiveRoom.id, currentUserId, [userId]);
      showToast({
        title: 'Davet gönderildi',
        message: `"${myLiveRoom.name}" odasına davet edildi`,
        type: 'success',
      });
    } catch (err: any) {
      showToast({
        title: 'Davet gönderilemedi',
        message: err?.message || 'Daha sonra tekrar dene',
        type: 'error',
      });
    } finally {
      setInviteSending(false);
    }
  }, [currentUserId, userId, myLiveRoom, inviteSending]);

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
      title: i18n.t('profile.block_title'),
      message: i18n.t('profile.block_message', { name: userProfile?.display_name || 'Bu kullanıcı' }),
      type: 'warning',
      buttons: [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: i18n.t('profile.block_action'), style: 'destructive',
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
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(8,12,22,0.45)', opacity: backdropOpacity }]} pointerEvents={closeOnBackdropTap ? 'auto' : 'none'}>
        {closeOnBackdropTap && <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />}
      </Animated.View>

      {/* ★ 2026-05-05: NotificationDrawer aile dili — slate diagonal + amber halo + soft glow.
          Karakter: amber (profil). Bildirim/mesaj modallarıyla birebir aynı kabuk. */}
      <Animated.View
        style={[sty.sheet, { transform: [{ translateY }] }]}
        {...panResponder.panHandlers}
      >
          <LinearGradient
            colors={['#3a4658', '#2a3344', '#1a2030']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(245,158,11,0.20)', 'rgba(245,158,11,0.05)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(245,158,11,0.08)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.6 }}
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
              <Text style={sty.wizardTitle}>{i18n.t('profile.upper_label')}</Text>
              <View style={sty.tierChip}>
                <Text style={sty.tierChipText}>{tier}</Text>
              </View>
            </View>
          </View>

        {/* ★ v107.23: AppLoader spinner KALDIRILDI — kullanıcı talebi.
             Yükleniyor sırasında minimal skeleton göster (avatar + isim + buton placeholder).
             Spinner sadece OdaPage gibi gerçek bağlantı bekleme sayfalarında olmalı. */}
        {loading ? (
          <View style={sty.skeletonWrap}>
            {/* Avatar + isim placeholder */}
            <View style={sty.skeletonHeaderRow}>
              <View style={sty.skeletonAvatar} />
              <View style={{ flex: 1, gap: 8 }}>
                <View style={[sty.skeletonBar, { width: '55%', height: 14 }]} />
                <View style={[sty.skeletonBar, { width: '35%', height: 10 }]} />
              </View>
            </View>
            {/* Stat cards placeholder */}
            <View style={sty.skeletonStatsRow}>
              <View style={sty.skeletonStat} />
              <View style={sty.skeletonStat} />
            </View>
            {/* Buton placeholder */}
            <View style={sty.skeletonBtnRow}>
              <View style={[sty.skeletonBtn, { flex: 1 }]} />
              <View style={[sty.skeletonBtn, { flex: 1 }]} />
              <View style={sty.skeletonBtnSmall} />
              <View style={sty.skeletonBtnSmall} />
            </View>
          </View>
        ) : !userProfile ? (
          <View style={sty.loadingBox}>
            <Ionicons name="person-outline" size={48} color={Colors.text3} />
            <Text style={{ color: Colors.text2, marginTop: 12 }}>{i18n.t('profile.not_found')}</Text>
          </View>
        ) : (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
          >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
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
              stats={{ followers: stats.followers, rooms: stats.rooms, gifts: stats.gifts }}
              statsLoading={!dataReady}
              onFollowersPress={() => { setFollowListTab('followers'); setShowFollowList(true); }}
              onRoomsPress={() => {}}
              onGiftsPress={() => setShowGiftDetail(true)}
              memberSince={userProfile.created_at}
              boostExpiresAt={(userProfile as any)?.profile_boost_expires_at}
              isOnline={isFriend && !isOwnProfile ? userProfile.is_online : undefined}
              lastSeen={(isOwnProfile || isFriend) ? userProfile.last_seen : null}
              activeFrame={(userProfile as any)?.active_frame || null}
              // ★ v213: Kendi profilinde sol üst envanter (madalya) ve sağ üst düzenleme
              //   butonları — profil sayfasındakiyle birebir aynı. Modal'dan hızlı erişim.
              onFramePress={isOwnProfile ? () => setShowOwnFrameSheet(true) : undefined}
              onEdit={isOwnProfile ? () => {
                handleClose();
                setTimeout(() => router.push('/edit-profile' as any), 250);
              } : undefined}
            />

            {/* ★ v110.5 (6 May 2026): Diller + İlgi alanları kimlik şeridi
                Modern sesli platform için kritik. Yabancı kullanıcı hangi dilde
                konuşulduğunu, hangi konularda aktif olduğunu görsün. */}
            <ProfileIdentityStrip
              languages={(userProfile as any)?.languages}
              interests={(userProfile as any)?.interests}
              isOwn={isOwnProfile}
              onEditPress={isOwnProfile ? () => {
                handleClose();
                setTimeout(() => router.push('/edit-profile' as any), 250);
              } : undefined}
            />

            {/* ★ v213: Büyük "Envanter" pill butonu kaldırıldı — ProfileHero üstünde
                profil sayfasındakiyle aynı sol-üst madalya ikonu + sağ-üst düzenleme
                kalemi var. (onFramePress + onEdit props ProfileHero'ya geçildi) */}

            {/* ★ v110.5 — Sesli tanıtım (Voice Bio) */}
            {(userProfile as any)?.voice_bio_url && (
              <VoiceBioPlayer
                url={(userProfile as any).voice_bio_url}
                durationMs={(userProfile as any).voice_bio_duration_ms}
              />
            )}

            {/* ★ v110.5 — Sosyal linkler (IG/X/web küçük butonlar) */}
            <SocialLinksRow links={(userProfile as any)?.social_links} />

            {/* ★ v110.5 — Konuşma ritmi text */}
            <SpeakingRhythmHint text={speakingRhythmText} />

            {/* ★ v110.5 — Davet eden satırı (referred_by varsa) */}
            {invitedBy && !isOwnProfile && (
              <InvitedByRow
                inviterName={invitedBy.display_name}
                inviterAvatar={invitedBy.avatar_url}
                inviterId={invitedBy.id}
                onPress={(uid) => onSelectUser?.(uid)}
              />
            )}

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
                      {incomingLoading ? <AppLoader size="small" color="#14B8A6" /> : (
                        <>
                          <Pressable style={sty.incomingApproveBtn} onPress={handleApproveIncoming}>
                            <Ionicons name="checkmark" size={16} color="#FFF" />
                            <Text style={sty.incomingApproveText}>{i18n.t('profile.approve')}</Text>
                          </Pressable>
                          <Pressable style={sty.incomingRejectBtn} onPress={handleRejectIncoming}>
                            <Ionicons name="close" size={16} color="#94A3B8" />
                            <Text style={sty.incomingRejectText}>{i18n.t('profile.delete_short')}</Text>
                          </Pressable>
                        </>
                      )}
                    </View>
                  </View>
                )}


                {/* ★ v107.48 (3 May 2026): Etkileşim satırı YENİDEN YAZILDI.
                    Önceki halinde yükseklikler 56/48/48/56 farklı, renk dili karışık,
                    "çok gıcık" görünüyordu (kullanıcı geri bildirimi).
                    Yeni: tüm elemanlar 52 yükseklik, ortak görsel dil:
                      - Takip + Arkadaş: outline pill (default) → tier renk dolgu (active)
                      - Chat: outline circle (aynı dil)
                      - SP: hexagon biraz büyütüldü (62), zincirden kopmuyor */}
                <View style={sty.interactionRow}>
                  {/* Takip Et / Takipte */}
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
                    style={({ pressed }) => [
                      sty.actionPill,
                      isFollowingUser ? sty.actionPillActive : sty.actionPillIdle,
                      pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] },
                    ]}
                  >
                    {followToggleLoading ? <AppLoader size="small" color="#14B8A6" /> : (
                      <>
                        <Ionicons
                          name={isFollowingUser ? 'checkmark-circle' : 'person-add-outline'}
                          size={17}
                          color={isFollowingUser ? '#14B8A6' : '#F1F5F9'}
                        />
                        <Text style={[sty.actionPillText, { color: isFollowingUser ? '#14B8A6' : '#F1F5F9' }]}>
                          {isFollowingUser ? i18n.t('profile.following') : i18n.t('profile.follow')}
                        </Text>
                      </>
                    )}
                  </Pressable>
                  {/* Arkadaş Ekle / Arkadaş / İstek Gönderildi / Engellendi */}
                  <Pressable
                    onPress={handleFollow}
                    disabled={followLoading || isUserBlocked}
                    style={({ pressed }) => [
                      sty.actionPill,
                      isUserBlocked
                        ? sty.actionPillBlocked
                        : isFriend
                          ? sty.actionPillFriend
                          : isPending
                            ? sty.actionPillPending
                            : sty.actionPillIdle,
                      pressed && !followLoading && { opacity: 0.7, transform: [{ scale: 0.97 }] },
                    ]}
                  >
                    {followLoading ? (
                      <AppLoader size="small" color="#fff" />
                    ) : isUserBlocked ? (
                      <>
                        <Ionicons name="ban" size={16} color="#EF4444" />
                        <Text style={[sty.actionPillText, { color: '#EF4444' }]}>{i18n.t('profile.blocked')}</Text>
                      </>
                    ) : isFriend ? (
                      <>
                        <Ionicons name="people" size={17} color="#A78BFA" />
                        <Text style={[sty.actionPillText, { color: '#A78BFA' }]}>{i18n.t('profile.friend')}</Text>
                      </>
                    ) : isPending ? (
                      <>
                        <Ionicons name="time-outline" size={16} color="#FBBF24" />
                        <Text style={[sty.actionPillText, { color: '#FBBF24', fontSize: 12 }]}>{i18n.t('profile.request_sent')}</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="person-add" size={17} color="#F1F5F9" />
                        <Text style={[sty.actionPillText, { color: '#F1F5F9' }]}>{i18n.t('profile.add_friend_short')}</Text>
                      </>
                    )}
                  </Pressable>
                  {/* DM circle — aynı outline dili */}
                  {!isUserBlocked && !isOwnProfile && userId && (
                    <Pressable
                      style={({ pressed }) => [
                        sty.actionCircle,
                        pressed && { opacity: 0.7, transform: [{ scale: 0.94 }] },
                      ]}
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
                      <Ionicons name="chatbubble-outline" size={20} color="#E2E8F0" />
                    </Pressable>
                  )}
                  {/* SP hexagon — kendi animasyonu, hafif büyütüldü (62) */}
                  {!isOwnProfile && !isUserBlocked && currentUserId && (
                    <Pressable
                      style={sty.actionHex}
                      onPress={() => setShowSPSheet(true)}
                      hitSlop={6}
                    >
                      <SPHexagonIcon size={62} static />
                    </Pressable>
                  )}
                  {/* ★ v108.7: Sembol Hediye butonu kaldırıldı (envanter sistemi kalktı,
                      hediyeler artık sadece RoomGiftPanel — oda kontrol barından — gönderilir). */}
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

                {/* ★ v110.5.4: Yardımcı eylem satırı + 3-nokta TEK SATIR.
                     Paylaş + Linki Kopyala + (host iken) Odama Davet + 3-nokta (Rapor/Engelle).
                     Eski "Daha fazla" yazısı kaldırıldı (redundant), sadece "..." ikon. */}
                {currentUserId && (
                  <View style={sty.utilityRow}>
                    {!isUserBlocked && (
                      <>
                        <Pressable
                          onPress={handleShareProfile}
                          style={({ pressed }) => [sty.utilityChip, pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] }]}
                          hitSlop={6}
                        >
                          <Ionicons name="share-social-outline" size={14} color="#5CBFB5" />
                          <Text style={sty.utilityChipText}>{i18n.t('profile.share')}</Text>
                        </Pressable>
                        <Pressable
                          onPress={handleCopyProfileLink}
                          style={({ pressed }) => [sty.utilityChip, pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] }]}
                          hitSlop={6}
                        >
                          <Ionicons name="link-outline" size={14} color="#5CBFB5" />
                          <Text style={sty.utilityChipText}>{i18n.t('profile.copy_link')}</Text>
                        </Pressable>
                        {myLiveRoom && (
                          <Pressable
                            onPress={handleInviteToMyRoom}
                            disabled={inviteSending}
                            style={({ pressed }) => [
                              sty.utilityChipPrimary,
                              pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                              inviteSending && { opacity: 0.6 },
                            ]}
                            hitSlop={6}
                          >
                            {inviteSending ? (
                              <AppLoader size="small" color="#fff" />
                            ) : (
                              <>
                                <Ionicons name="mic-circle" size={15} color="#FFF" />
                                <Text style={sty.utilityChipPrimaryText}>{i18n.t('profile.invite_to_room')}</Text>
                              </>
                            )}
                          </Pressable>
                        )}
                      </>
                    )}
                    {/* Spacer — 3-noktayı sağa it */}
                    <View style={{ flex: 1 }} />
                    {/* 3-nokta — Engelle/Rapor menüsünü açar (her zaman görünür yabancı profilde) */}
                    {!isOwnProfile && (
                      <Pressable
                        onPress={() => setShowMoreActions(s => !s)}
                        style={({ pressed }) => [
                          sty.utilityDots,
                          showMoreActions && { backgroundColor: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.22)' },
                          pressed && { opacity: 0.7 },
                        ]}
                        hitSlop={8}
                        accessibilityLabel="Daha fazla seçenek"
                      >
                        <Ionicons name="ellipsis-horizontal" size={16} color="#94A3B8" />
                      </Pressable>
                    )}
                  </View>
                )}

                {/* ★ v110.3: Aksiyon menüsü — modActions opsiyonel; Engelle/Rapor HER zaman görünür.
                     Eskiden tüm blok `{modActions && ...}` ile sarılıydı → oda dışında engelle/rapor erişilemiyordu. */}
                {!isOwnProfile && currentUserId && (() => {
                  // ★ 2026-04-26: Renk paleti standardı — mod aksiyonları MOR (#A855F7),
                  //   sosyal/info turkuaz, tehlike (kick/ban) kırmızı. Renk kakofonisi giderildi.
                  const MOD = '#A855F7';
                  const DANGER = '#EF4444';
                  const ma = modActions; // opsiyonel — oda dışında undefined olur

                  // Primer aksiyon: sadece oda içinde (modActions varsa) anlamlı
                  const primary = ma?.onPromoteToStage
                    ? { fn: ma.onPromoteToStage, icon: 'arrow-up-circle' as const, label: 'Sahneye Davet', color: MOD }
                    : ma?.onRemoveFromStage
                    ? { fn: ma.onRemoveFromStage, icon: 'arrow-down-circle' as const, label: 'Sahneden İndir', color: MOD }
                    : ma?.onSelfPromote
                    ? { fn: ma.onSelfPromote, icon: 'arrow-up-circle' as const, label: i18n.t('profile.stage_promote_self'), color: MOD }
                    : ma?.onSelfDemote
                    ? { fn: ma.onSelfDemote, icon: 'arrow-down-circle-outline' as const, label: 'Sahneden İn', color: DANGER }
                    : null;

                  // Mute toggle: sadece oda içinde
                  const muteToggle = ma?.isMuted && ma?.onUnmute
                    ? { fn: ma.onUnmute, icon: 'volume-high' as const, label: 'Sesi Aç', color: MOD }
                    : ma?.onMute
                    ? { fn: ma.onMute, icon: 'volume-mute' as const, label: 'Sustur', color: MOD }
                    : null;

                  // ★ 2026-04-26: 3-nokta menüsü iki gruba ayrıldı — sade mod (mor) ve tehlikeli yaptırım (kırmızı).
                  //   Görsel olarak ayraç çizgi ile ayrılır, kullanıcı yanlışlıkla ban/kick'e basmaz.
                  type MenuItem = { fn: () => void; icon: keyof typeof Ionicons.glyphMap; label: string; color: string; danger?: boolean; keepSheet?: boolean };
                  const moderationItems: MenuItem[] = [];
                  const enforcementItems: MenuItem[] = [];

                  // Mod aksiyonları — sadece oda içinde
                  if (ma?.onChatMute) moderationItems.push({ fn: ma.onChatMute, icon: ma.isChatMuted ? 'chatbox' : 'chatbox-outline', label: ma.isChatMuted ? 'Yazı Aç' : 'Yazı Kapat', color: MOD });
                  if (ma?.onMakeModerator) moderationItems.push({ fn: ma.onMakeModerator, icon: 'shield', label: ma.displayRole === 'moderator' ? 'Moderatörlüğü Kaldır' : 'Moderatör Yap', color: MOD });
                  if (ma?.onPersonalMute) moderationItems.push({ fn: ma.onPersonalMute, icon: ma.isPersonallyMuted ? 'volume-high' : 'volume-mute', label: ma.isPersonallyMuted ? 'Sesi Aç (sadece bana)' : 'Benim İçin Sustur', color: MOD });
                  if (ma?.onGhostMode) moderationItems.push({ fn: ma.onGhostMode, icon: ma.isGhost ? 'eye' : 'eye-off', label: ma.isGhost ? i18n.t('profile.ghost_visible') : i18n.t('profile.ghost_invisible'), color: MOD });
                  if (ma?.onDisguise) moderationItems.push({
                    fn: ma.onDisguise,
                    icon: ma.isDisguised ? 'person' : 'person-circle',
                    label: ma.isDisguised ? i18n.t('profile.disguise_off') : i18n.t('profile.disguise_on'),
                    color: MOD,
                  });

                  // Yaptırım — kick/ban sadece oda içinde, RAPOR/ENGELLE HER ZAMAN
                  //   ★ v110.5.4: keepSheet=true → Rapor/Engelle modallari sheet'in ÜSTÜNE açılır
                  //     (sheet'i kapatınca ReportModal unmount oluyordu, fix bu).
                  if (ma?.onKick) enforcementItems.push({ fn: ma.onKick, icon: 'exit', label: 'Odadan Çıkar', color: DANGER, danger: true });
                  if (ma?.onBanTemp) enforcementItems.push({ fn: ma.onBanTemp, icon: 'timer', label: 'Geçici Ban', color: DANGER, danger: true });
                  if (ma?.onBanPerm) enforcementItems.push({ fn: ma.onBanPerm, icon: 'ban', label: 'Kalıcı Ban', color: DANGER, danger: true });
                  enforcementItems.push({ fn: () => setShowReportModal(true), icon: 'flag-outline', label: i18n.t('profile.report'), color: DANGER, danger: true, keepSheet: true });
                  enforcementItems.push({ fn: handleBlock, icon: isUserBlocked ? 'checkmark-circle' : 'ban', label: isUserBlocked ? i18n.t('profile.unblock_action') : i18n.t('profile.block_action'), color: DANGER, danger: true, keepSheet: true });

                  const hasMore = moderationItems.length > 0 || enforcementItems.length > 0;
                  if (!primary && !muteToggle && !hasMore) return null;

                  // ★ v110.3: Engelle/Rapor "tehlikeli" aksiyon — yanlışlıkla basılmasın diye
                  //   her zaman explicit 3-nokta tıklaması gerekir (auto-expand kaldırıldı).
                  const hasInlineButtons = !!primary || !!muteToggle;
                  const expandMore = showMoreActions;

                  // ★ v110.5.4: keepSheet flag → modal sheet üstünde açılır, parent kapatılmaz
                  const fire = (fn?: () => void, keepSheet?: boolean) => {
                    if (!fn) return;
                    if (keepSheet) {
                      // Sheet açık kalır, modal üstünde açılır. Sadece "Daha fazla" menüsü kapanır.
                      setShowMoreActions(false);
                      fn();
                    } else {
                      handleClose();
                      setTimeout(fn, 250);
                    }
                  };

                  return (
                    <View style={sty.modInlineWrap}>
                      {/* ★ v110.5.4: 3-nokta kaldırıldı (utility row'a taşındı), modInlineRow sadece primary + mute */}
                      {hasInlineButtons && (
                      <View style={sty.modInlineRow}>
                        {primary && (
                          <Pressable
                            style={[sty.modPrimaryBtn, { borderColor: primary.color + '40' }]}
                            onPress={() => fire(primary.fn)}
                          >
                            <LinearGradient
                              colors={[primary.color + 'DD', primary.color + '77']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 0, y: 1 }}
                              style={StyleSheet.absoluteFillObject}
                            />
                            <Ionicons name={primary.icon} size={18} color="#fff" style={iconShadow} />
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
                      </View>
                      )}

                      {expandMore && hasMore && (
                        <View style={sty.moreActionsCard}>
                          <LinearGradient colors={['#3a4658', '#2a3344', '#1a2030']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
                          {moderationItems.map((it, idx) => (
                            <Pressable
                              key={`mod-${idx}`}
                              style={[sty.moreActionRow, idx > 0 && sty.moreActionDivider]}
                              onPress={() => fire(it.fn, it.keepSheet)}
                            >
                              <Ionicons name={it.icon} size={16} color={it.color} style={iconShadow} />
                              <Text style={sty.moreActionLabel}>{it.label}</Text>
                            </Pressable>
                          ))}
                          {/* ★ 2026-04-26: Tehlikeli yaptırım grubu — kırmızı vurgu + ayraç. Kullanıcı yanlışlıkla ban'a basmasın. */}
                          {moderationItems.length > 0 && enforcementItems.length > 0 && (
                            <View style={sty.dangerSeparator}>
                              <View style={sty.dangerLine} />
                              <Text style={sty.dangerHeading}>{i18n.t('profile.sanction_heading')}</Text>
                              <View style={sty.dangerLine} />
                            </View>
                          )}
                          {enforcementItems.map((it, idx) => (
                            <Pressable
                              key={`enf-${idx}`}
                              style={[sty.moreActionRow, idx > 0 && sty.moreActionDivider]}
                              onPress={() => fire(it.fn, it.keepSheet)}
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

            {/* ★ v110: Friendship status netleşene kadar (dataReady=false) bu banner gizli kalır.
                 Önceden Phase 1 (profile yüklendi) ile Phase 2 (friendship yüklendi) arası flash görünüyordu. */}
            {dataReady && !canSeeFullProfile && (
              <View style={sty.privateBox}>
                <Ionicons name="lock-closed" size={28} color="#94A3B8" />
                <Text style={sty.privateTitle}>{i18n.t('profile.private_title')}</Text>
                <Text style={sty.privateDesc}>{i18n.t('profile.private_desc')}</Text>
              </View>
            )}

            {canSeeFullProfile && (
              <>
                {/* ★ 2026-04-26: activityCard kaldırıldı — ProfileHero'nun detay strip'inde
                     aynı bilgiler (sahne dk + dinleyici + reaksiyon) zaten gösteriliyor (activityStats prop). */}

                {/* ★ v110.5 — Kişisel not (sadece başkasının profilinde, sadece sahibi görür) */}
                {!isOwnProfile && currentUserId && userId && (
                  <PersonalNoteCard
                    ownerId={currentUserId}
                    targetId={userId}
                    initialNote={personalNote}
                  />
                )}

                {/* ★ v110.5 — Ortak odalar (mutualRooms varsa) */}
                {!isOwnProfile && mutualRooms.length > 0 && (
                  <MutualRoomsStrip
                    rooms={mutualRooms}
                    onSelectRoom={(roomId) => {
                      handleClose();
                      setTimeout(() => router.push(`/room/${roomId}` as any), 250);
                    }}
                  />
                )}

                {/* ★ v110.5 — Öne çıkan rozetler */}
                {featuredBadges.length > 0 && (
                  <FeaturedBadgesShowcase
                    featuredIds={featuredBadges}
                    onPress={() => setShowBadgesModal(true)}
                  />
                )}

                {/* ★ v110.5 — Top 3 destekçiler */}
                {topSupporters.length > 0 && (
                  <TopSupportersStrip
                    supporters={topSupporters}
                    onSelectUser={(uid) => onSelectUser?.(uid)}
                  />
                )}

                {/* ★ 2026-04-25: ÜYELİK — Plus/Pro için premium section header + diagonal gradient kart */}
                {tier !== 'Free' && (
                  <>
                    <ProfileSectionHeader label={i18n.t('profile.section.membership')} icon={tierDef.icon as any} accentColor={tierDef.color} />
                    <View style={sty.sectionCard}>
                      <LinearGradient colors={['#3a4658', '#2a3344', '#1a2030']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
                      <LinearGradient colors={['transparent', tierDef.color + '99', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={sty.sectionTopEdge} />
                      <View style={sty.tierRow}>
                        <LinearGradient colors={tierDef.gradient as [string, string]} style={sty.tierIcon}>
                          <Ionicons name={tierDef.icon as any} size={18} color="#fff" style={iconShadow} />
                        </LinearGradient>
                        <View style={{ flex: 1 }}>
                          <Text style={[sty.tierTitle, { color: tierDef.color }]}>{i18n.t('profile.tier_member_suffix', { tier: tierDef.label })}</Text>
                          <Text style={sty.tierDesc}>
                            {tier === 'Pro' ? i18n.t('profile.tier_pro_features') : i18n.t('profile.tier_plus_features')}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </>
                )}

                {/* ★ 2026-04-25: CÜZDANIM — section header + altın gradient kart (sadece own profile) */}
                {isOwnProfile && (
                  <>
                    <ProfileSectionHeader label={i18n.t('profile.section.wallet')} icon="diamond" accentColor="#FBBF24" />
                    <GlowView style={sty.walletCard}>
                      <LinearGradient colors={['#2a1e14', '#17100a', '#0a0604']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
                      <LinearGradient colors={['rgba(251,191,36,0.35)', 'rgba(251,191,36,0.1)', 'rgba(251,191,36,0.02)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
                      <LinearGradient colors={['transparent', 'rgba(251,191,36,0.6)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={sty.sectionTopEdge} />
                      <View style={[sty.walletWatermark, { opacity: 0.08 }]} pointerEvents="none">
                        <SPIcon size={100} />
                      </View>
                      <View style={sty.walletRow}>
                        <Text style={sty.walletAmount}>{((userProfile as any)?.system_points ?? 0).toLocaleString('tr-TR')}</Text>
                        <Text style={sty.walletCurrency}>SP</Text>
                      </View>
                      <Text style={sty.walletSub}>{i18n.t('profile.wallet_sub')}</Text>
                    </GlowView>
                  </>
                )}

                {/* ★ v110 (6 May 2026): ODALARI — eskiden /user/[id] sayfasındaydı,
                     full-page kaldırıldı, profilin tamamı sheet içinde.
                     Privacy: own profile'da her zaman görünür; başkasınınkinde
                     hide_owned_rooms=false VE (arkadaş ya da public) olunca.
                   ★ v110.5.4 (6 May 2026): Yabancı profilde KAPALI odalar GİZLENİR.
                     Sadece canlı (is_live) veya uyuyan (is_persistent) odalar gösterilir.
                     Kullanıcı kendi profilinde tüm geçmişi görebilir. */}
                {(() => {
                  const isFriend = followStatus === 'accepted';
                  const isPrivate = !isOwnProfile && (
                    (userProfile as any)?.privacy_mode === 'followers_only' ||
                    (userProfile as any)?.privacy_mode === 'private' ||
                    (userProfile as any)?.is_private === true
                  );
                  const canSeeFullProfile = isOwnProfile || isFriend || !isPrivate;
                  const hideOwned = (userProfile as any)?.hide_owned_rooms;
                  // ★ v110.5.4: Yabancı profilde sadece canlı veya persistent odalar
                  const visibleRooms = isOwnProfile
                    ? recentRooms
                    : recentRooms.filter((r: any) => r.is_live || r.is_persistent);
                  const showRooms = visibleRooms.length > 0 && (isOwnProfile || (canSeeFullProfile && !hideOwned));
                  if (!showRooms) return null;

                  const THEME_GRADS: Record<string, [string, string]> = {
                    ocean: ['#0E4D6F', '#083344'], sunset: ['#7F1D1D', '#4C0519'],
                    forest: ['#14532D', '#052E16'], galaxy: ['#312E81', '#1E1B4B'],
                    aurora: ['#134E4A', '#042F2E'], cherry: ['#831843', '#500724'],
                    cyber: ['#1E3A8A', '#172554'], volcano: ['#7C2D12', '#431407'],
                    midnight: ['#0C0A3E', '#1B1464'], rose: ['#9F1239', '#881337'],
                    arctic: ['#164E63', '#0E7490'], amber: ['#78350F', '#92400E'],
                    slate: ['#1E293B', '#334155'],
                  };

                  return (
                    <>
                      <ProfileSectionHeader
                        label={isOwnProfile ? i18n.t('profile.section.my_rooms') : i18n.t('profile.section.their_rooms')}
                        icon="headset"
                        accentColor={Colors.accentTeal}
                        count={visibleRooms.length}
                      />
                      <View style={{ marginHorizontal: 16, marginBottom: 14, gap: 8 }}>
                        {visibleRooms.map((room: any) => {
                          const listeners = room.listener_count || 0;
                          const isLive = !!room.is_live;
                          const hasListeners = isLive && listeners > 0;
                          const isOpen = isLive && listeners === 0;
                          const isPersistent = !!room.is_persistent;
                          const isSleeping = !isLive && isPersistent;
                          const isClosed = !isLive && !isPersistent;
                          const cardImage = room.room_settings?.card_image_url;
                          const themeId = room.theme_id || room.room_settings?.theme_id;
                          const settings = room.room_settings || {};
                          const fee = settings.entry_fee_sp || 0;
                          const grad = (themeId && THEME_GRADS[themeId]) || null;
                          const accentColor = hasListeners ? '#22C55E' : isOpen ? '#14B8A6' : isSleeping ? '#A78BFA' : '#64748B';

                          return (
                            <Pressable
                              key={room.id}
                              onPress={() => { handleClose(); setTimeout(() => router.push(`/room/${room.id}` as any), 250); }}
                              style={({ pressed }) => ({
                                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                                padding: 12, paddingLeft: 16, borderRadius: 16, overflow: 'hidden',
                                borderWidth: 1,
                                borderColor: hasListeners ? 'rgba(34,197,94,0.35)' : isPersistent ? 'rgba(212,175,55,0.25)' : 'rgba(255,255,255,0.06)',
                                backgroundColor: Colors.cardBg,
                                shadowColor: hasListeners ? '#22C55E' : '#000',
                                shadowOffset: { width: 0, height: 3 },
                                shadowOpacity: hasListeners ? 0.3 : 0.2, shadowRadius: 8, elevation: 4,
                                opacity: pressed ? 0.92 : isClosed ? 0.7 : 1,
                                transform: [{ scale: pressed ? 0.985 : 1 }],
                              })}
                            >
                              <LinearGradient
                                colors={['#3a4658', '#2a3344', '#1a2030']}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                style={StyleSheet.absoluteFillObject}
                                pointerEvents="none"
                              />
                              {grad && (
                                <LinearGradient
                                  colors={[grad[0], grad[1]]}
                                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                  style={[StyleSheet.absoluteFillObject, { opacity: isLive ? 0.18 : 0.09, borderRadius: 16 }]}
                                />
                              )}
                              <View style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2, backgroundColor: accentColor, opacity: isLive ? 1 : 0.5 }} />

                              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10, minWidth: 0 }}>
                                {cardImage ? (
                                  <View style={{ width: 40, height: 40, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                                    <Image source={{ uri: cardImage }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                                    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.2)' }]} />
                                  </View>
                                ) : (
                                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons
                                      name={room.category === 'music' ? 'musical-notes' : room.category === 'game' ? 'game-controller' : room.category === 'tech' ? 'code-slash' : 'chatbubbles'}
                                      size={18} color="rgba(255,255,255,0.4)"
                                    />
                                  </View>
                                )}

                                <View style={{ flex: 1, minWidth: 0 }}>
                                  <Text style={{ fontSize: 14, fontWeight: '700', color: isClosed ? '#94A3B8' : '#F1F5F9' }} numberOfLines={1}>
                                    {room.name}
                                  </Text>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                                    {hasListeners ? (
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(34,197,94,0.15)', paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 7 }}>
                                        <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#22C55E' }} />
                                        <Text style={{ fontSize: 9, fontWeight: '800', color: '#86EFAC', letterSpacing: 0.4 }}>{i18n.t('rooms.live_short')}</Text>
                                        <Text style={{ fontSize: 9, fontWeight: '600', color: '#94A3B8', marginLeft: 1 }}>· {listeners}</Text>
                                      </View>
                                    ) : isOpen ? (
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(20,184,166,0.12)', paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 7 }}>
                                        <Ionicons name="radio-outline" size={9} color="#14B8A6" />
                                        <Text style={{ fontSize: 9, fontWeight: '800', color: '#5EEAD4', letterSpacing: 0.3 }}>{i18n.t('rooms.open_short')}</Text>
                                      </View>
                                    ) : isSleeping ? (
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(167,139,250,0.12)', paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 7, borderWidth: 0.5, borderColor: 'rgba(167,139,250,0.25)' }}>
                                        <Ionicons name="moon" size={8} color="#A78BFA" />
                                        <Text style={{ fontSize: 9, fontWeight: '700', color: '#A78BFA' }}>{i18n.t('rooms.sleeping_short')}</Text>
                                      </View>
                                    ) : (
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(100,116,139,0.12)', paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 7 }}>
                                        <Ionicons name="close-circle" size={8} color="#64748B" />
                                        <Text style={{ fontSize: 9, fontWeight: '700', color: '#64748B' }}>{i18n.t('rooms.closed_short')}</Text>
                                      </View>
                                    )}
                                    {isPersistent && (
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(212,175,55,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 0.5, borderColor: 'rgba(212,175,55,0.3)' }}>
                                        <Ionicons name="trophy" size={8} color="#D4AF37" />
                                        <Text style={{ fontSize: 7, fontWeight: '800', color: '#D4AF37', letterSpacing: 0.3 }}>{i18n.t('rooms.premium_short')}</Text>
                                      </View>
                                    )}
                                    {room.type === 'closed' && (
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(245,158,11,0.12)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 0.5, borderColor: 'rgba(245,158,11,0.25)' }}>
                                        <Ionicons name="lock-closed" size={7} color="#F59E0B" />
                                        <Text style={{ fontSize: 7, fontWeight: '700', color: '#F59E0B' }}>{i18n.t('rooms.locked_short')}</Text>
                                      </View>
                                    )}
                                    {room.type === 'invite' && (
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(139,92,246,0.12)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 0.5, borderColor: 'rgba(139,92,246,0.25)' }}>
                                        <Ionicons name="mail" size={7} color="#8B5CF6" />
                                        <Text style={{ fontSize: 7, fontWeight: '700', color: '#8B5CF6' }}>{i18n.t('rooms.invite_short')}</Text>
                                      </View>
                                    )}
                                    {fee > 0 && (
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(212,175,55,0.12)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 0.5, borderColor: 'rgba(212,175,55,0.25)' }}>
                                        <Ionicons name="cash" size={7} color="#D4AF37" />
                                        <Text style={{ fontSize: 7, fontWeight: '800', color: '#D4AF37' }}>{fee} SP</Text>
                                      </View>
                                    )}
                                  </View>
                                </View>
                              </View>

                              <LinearGradient
                                colors={hasListeners ? ['#14B8A6', '#0D9488'] : isOpen ? ['#14B8A6', '#0D9488'] : ['#475569', '#334155']}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, marginLeft: 10 }}
                              >
                                <Ionicons name={isLive ? 'headset' : 'eye-outline'} size={12} color="#FFF" />
                                <Text style={{ fontSize: 10, fontWeight: '800', color: '#FFF', letterSpacing: 0.3 }}>
                                  {isLive ? i18n.t('profile.join_room') : i18n.t('profile.view_room')}
                                </Text>
                              </LinearGradient>
                            </Pressable>
                          );
                        })}
                      </View>
                    </>
                  );
                })()}

                {/* ★ 2026-04-26: ARKADAŞLAR — sadece 2+ arkadaş varsa kart göster.
                     Tek arkadaş için bütün bir kart açmak yer israfı.
                     "Tümü" linki sadece 4+ varsa anlamlı (3 chip görünüyor zaten). */}
                {friendsPreview.length >= 2 && (
                  <>
                    <ProfileSectionHeader
                      label={isOwnProfile ? i18n.t('profile.friends_label_my') : i18n.t('profile.friends_label_other')}
                      icon="people"
                      accentColor={Colors.teal}
                      count={friendsPreview.length}
                      actionLabel={friendsPreview.length >= 4 ? 'Tümü' : undefined}
                      onActionPress={friendsPreview.length >= 4 ? () => { setFollowListTab('friends'); setShowFollowList(true); } : undefined}
                    />
                    <View style={sty.friendsStripCard}>
                      <LinearGradient colors={['#3a4658', '#2a3344', '#1a2030']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
                      <LinearGradient colors={['transparent', 'rgba(20,184,166,0.6)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={sty.sectionTopEdge} />
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={sty.friendsStripContent}
                      >
                        {friendsPreview.map((f) => {
                          const ls = (f as any)?.last_seen;
                          const isOnline = ls ? new Date(ls).getTime() > Date.now() - 5 * 60 * 1000 : false;
                          return (
                            <Pressable
                              key={f.id}
                              style={({ pressed }) => [sty.friendChip, pressed && { opacity: 0.75 }]}
                              onPress={() => onSelectUser?.(f.id)}
                            >
                              <StatusAvatar
                                uri={f.avatar_url || undefined}
                                size={54}
                                isOnline={isOnline}
                                tier={(f as any).subscription_tier}
                                frameId={(f as any).active_frame}
                                customBadgeId={(f as any).active_badge_id ?? null}
                              />
                              <Text style={sty.friendChipName} numberOfLines={1}>
                                {f.display_name || 'Kullanıcı'}
                              </Text>
                              <Text style={isOnline ? sty.friendStatusOn : sty.friendStatusOff}>
                                {isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  </>
                )}

                {/* ★ 2026-04-26: Eski full-width SP Gönder kartı kaldırıldı — interaction row'a yuvarlak altın chip olarak taşındı. */}

                {/* ★ v110 (6 May 2026): "Tam Profili Aç" linki KALDIRILDI.
                     Profilin tüm verileri artık sheet içinde (rooms list dahil) — full-page'e gerek yok.
                     /user/[id] route bouncer'a dönüştü, deep link gelirse sheet açıp geri navigate eder. */}

                {/* ★ 2026-04-26: Rapor Et / Engelle 3-nokta menüsüne taşındı — alt satırı sil, daha az scroll. */}

                {/* ★ 2026-04-25: Clubhouse modeli — kullanıcı odadan asla çıkmaz.
                     Tam profile escape hatch kaldırıldı; tüm peek overlay içinde tamamlanır. */}
              </>
            )}
          </ScrollView>
          </KeyboardAvoidingView>
        )}
      </Animated.View>

      {/* ★ v110.14: Kendi profilimde envanter sheet — yukarıdaki Envanter butonu açar */}
      {/* ★ v213 BUG FIX: onFrameChange + onEntryEffectChange callback'leri eklendi.
           Önceki sürümde callback'ler yoktu → equip RPC başarılı oluyor ama modal UI
           güncellenmiyordu (kullanıcı: "tıklıyorum hala önceki seçili görünüyor").
           Şimdi userProfile state local olarak güncelleniyor → AKTİF rozeti yer değiştirir. */}
      {isOwnProfile && currentUserId && (
        <FrameSelectSheet
          visible={showOwnFrameSheet}
          onClose={() => setShowOwnFrameSheet(false)}
          userId={currentUserId}
          currentFrameId={(userProfile as any)?.active_frame || null}
          currentEntryEffectId={(userProfile as any)?.active_entry_effect || null}
          currentAvatarUrl={userProfile?.avatar_url}
          onFrameChange={(id) => setUserProfile(p => p ? { ...(p as any), active_frame: id } : p)}
          onEntryEffectChange={(id) => setUserProfile(p => p ? { ...(p as any), active_entry_effect: id } : p)}
        />
      )}

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

      {/* ★ 2026-05-05: Hediye detay modalı — tab'lı (Aldığı / Verdiği) */}
      {userId && userProfile && (
        <GiftDetailModal
          visible={showGiftDetail}
          userId={userId}
          displayName={userProfile.display_name}
          onClose={() => setShowGiftDetail(false)}
        />
      )}

      {currentUserId && userId && userProfile && (
        <GiftSheet
          visible={showSPSheet}
          onClose={() => setShowSPSheet(false)}
          senderId={currentUserId}
          recipientId={userId}
          recipientName={userProfile.display_name || 'Kullanıcı'}
          recipientAvatar={userProfile.avatar_url || undefined}
          recipientUsername={(userProfile as any).username || undefined}
          recipientTier={(userProfile as any).subscription_tier || null}
          inRoom={true}
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
    // ★ 2026-05-05: NotificationDrawer aile dili — borderRadius 22→26, gri border kaldırıldı,
    //   shadowRadius 14, elevation 16→10 (Android FPS).
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#1a2030',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
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
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12,
    // ★ 2026-05-05: Eski teal bg ve borderBottom kaldırıldı — gradient halo zaten görsel
    //   ayrım sağlıyor, NotificationDrawer aile dili (sade header + separator).
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
  // ★ v107.23: Profil yüklenirken spinner yerine minimal skeleton placeholder
  skeletonWrap: {
    paddingHorizontal: 18,
    paddingTop: 14,
    gap: 16,
  },
  skeletonHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
  },
  skeletonAvatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  skeletonBar: {
    height: 12, borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  skeletonStatsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 4,
  },
  skeletonStat: {
    flex: 1,
    height: 64, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  skeletonBtnRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  skeletonBtn: {
    height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  skeletonBtnSmall: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
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
  // ★ v107.48: Yeniden tasarlanan etkileşim satırı.
  //   Tüm elemanlar 52 yükseklik. Ortak görsel dil: outline + active state dolgu.
  interactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
  },
  // ★ Pill base — Takip + Arkadaş için (flex 1, 52 height, rounded full)
  actionPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 52,
    borderRadius: 999,
    paddingHorizontal: 12,
    borderWidth: 1.5,
  },
  // Default (idle) state — outline, neutral
  actionPillIdle: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.14)',
  },
  // Takipte — teal active
  actionPillActive: {
    backgroundColor: 'rgba(20,184,166,0.12)',
    borderColor: 'rgba(20,184,166,0.45)',
  },
  // Arkadaş — purple active
  actionPillFriend: {
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderColor: 'rgba(167,139,250,0.45)',
  },
  // İstek Gönderildi — amber pending
  actionPillPending: {
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderColor: 'rgba(251,191,36,0.40)',
  },
  // Engellendi — red blocked
  actionPillBlocked: {
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderColor: 'rgba(239,68,68,0.35)',
  },
  actionPillText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  // ★ DM circle — aynı outline dili, 52x52
  actionCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  // ★ SP hexagon container — overflow visible, hexagon kendi içinde 62 (büyütüldü)
  actionHex: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
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

  // ★ 2026-05-05: ProfileFriendsList tile dili ile birebir aynı (kod tekrarı yerine
  //   stil senkronu — refactor riski düşük, görsel sonuç tutarlı).
  friendsStripCard: {
    marginHorizontal: 16, borderRadius: 26, overflow: 'hidden',
    backgroundColor: '#1a2030',
    ...Shadows.card,
  },
  friendsStripContent: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 12, gap: 12,
  },
  friendChip: {
    alignItems: 'center', width: 70, gap: 4,
  },
  friendChipName: {
    fontSize: 11, fontWeight: '700', color: '#E2E8F0',
    maxWidth: 70, textAlign: 'center', letterSpacing: 0.15,
    ...Shadows.text,
  },
  friendStatusOn: { fontSize: 9, fontWeight: '600', color: '#22C55E' },
  friendStatusOff: { fontSize: 9, fontWeight: '500', color: '#64748B' },

  // ★ v92.1 (1 May 2026): DM butonu — SP chip ile orantılı (56×56).
  // ★ v107.26: Chat circle followBtn ile uyumlu (48x48)
  dmBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  // ★ v92.1 (1 May 2026): SP Gönder — daire/border/zemin kaldırıldı (kullanıcı talebi).
  //   Hexagon 60, wrapper 56 (overflow visible) → DM butonu ile aynı görsel boyut,
  //   hexagon kendi glow'uyla biraz dışarı taşar (mücevher hissi).
  // ★ v107.26: SP chip 88→56 — diğer butonlarla (48) uyumlu, hexagon biraz dışa taşıp
  //   "mücevher hissi" versin (overflow visible). Yan yana orantı bozulmaz.
  spChipBtn: {
    width: 56, height: 56,
    alignItems: 'center' as const, justifyContent: 'center' as const,
    overflow: 'visible' as const,
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
  // ★ v110.3: Yardımcı eylem satırı — Paylaş / Linki Kopyala / Odama Davet
  utilityRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const, flexWrap: 'wrap' as const,
    gap: 8, marginHorizontal: 16, marginTop: 10,
  },
  utilityChip: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(20,184,166,0.08)',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.25)',
  },
  utilityChipText: {
    fontSize: 11, fontWeight: '700' as const, color: '#5CBFB5', letterSpacing: 0.2,
  },
  utilityChipPrimary: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#A855F7',
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.45)',
    ...Shadows.card,
  },
  utilityChipPrimaryText: {
    fontSize: 11, fontWeight: '800' as const, color: '#FFF', letterSpacing: 0.3,
    ...Shadows.text,
  },
  // ★ v110.5.4: Utility row 3-nokta — sade yuvarlak buton, "Daha fazla" yazısı kaldırıldı
  utilityDots: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center' as const, justifyContent: 'center' as const,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
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
});
