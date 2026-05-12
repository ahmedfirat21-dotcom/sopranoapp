import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Modal, TextInput, Image, InteractionManager, Platform, Animated, Easing, Dimensions, type ImageStyle } from 'react-native';
import AppLoader from '../../components/AppLoader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Colors, Shadows } from '../../constants/theme';
import { getLevelFromSP, getAvatarSource } from '../../constants/avatars';
import { useAuth, useTheme, useUserProfileSheet } from '../_layout';
import { supabase } from '../../constants/supabase';
import { ReferralService } from '../../services/referral';
import { ProfileService } from '../../services/database';
import { FriendshipService } from '../../services/friendship';
import { FollowService } from '../../services/follows';
import { showToast } from '../../components/Toast';
import FollowListModal from '../../components/FollowListModal';
import AppBackground from '../../components/AppBackground';
import SPHexagonIcon from '../../components/SPHexagonIcon';
import PlusDiamondIcon from '../../components/PlusDiamondIcon';
import AnimatedHeaderIconBtn from '../../components/AnimatedHeaderIconBtn';
import TabBarFadeOut from '../../components/TabBarFadeOut';
import ProfileHero from '../../components/profile/ProfileHero';
import ProfileIdentityStrip from '../../components/profile/ProfileIdentityStrip';
import {
  VoiceBioPlayer, SocialLinksRow, FeaturedBadgesShowcase, SpeakingRhythmHint,
} from '../../components/profile/ProfileExtras';
import {
  FeaturedBadgesService, SpeakingRhythmService,
} from '../../services/profileExtras';
import FrameSelectSheet from '../../components/profile/FrameSelectSheet';
import BadgeListModal from '../../components/profile/BadgeListModal';
import GiftDetailModal from '../../components/profile/GiftDetailModal';
import { GiftStatsService } from '../../services/giftStats';
import BioEditorSheet from '../../components/profile/BioEditorSheet';
import ProfileFriendsList from '../../components/profile/ProfileFriendsList';
import ProfileSectionHeader from '../../components/profile/ProfileSectionHeader';
import SPHistorySheet from '../../components/profile/SPHistorySheet';
import { useOnlineFriends } from '../../providers/OnlineFriendsProvider';

import { TIER_DEFINITIONS, isTierAtLeast } from '../../constants/tiers';
import { migrateLegacyTier } from '../../types';
import type { SubscriptionTier } from '../../types';
import BoostPickerSheet, { type BoostTier } from '../../components/BoostPickerSheet';
import { UserTitleService, type UserTitle } from '../../services/userTitles';
import PremiumAlert, { type AlertButton } from '../../components/PremiumAlert';
import ConversationActionSheet, { type SheetAction } from '../../components/ConversationActionSheet';
import { auth } from '../../constants/firebase';
import { signOut, deleteUser as firebaseDeleteUser } from 'firebase/auth';

// ★ 2026-04-29: Profil header logosu — diğer tab logoları ile eşitlendi (110×30 / 75×30).
const PROF_SOP_W = 110;
const PROF_PROF_W = 75;
const PROF_H = 30;
// ★ 2026-05-04: stat satırı dar ekranlarda padding kullanır
const _sw = Dimensions.get('window').width;

let _profilIntroPlayed = false;
function profilIntroPlayed() { return _profilIntroPlayed; }
function markProfilIntroPlayed() { _profilIntroPlayed = true; }

function AnimatedProfilLogo() {
  const played = profilIntroPlayed();
  // ★ 2026-04-29: Soprano sabit (kullanıcı isteği) — sadece Profil partner kelime animasyonlu
  const profX = useRef(new Animated.Value(played ? 0 : 120)).current;
  const profOp = useRef(new Animated.Value(played ? 1 : 0)).current;
  const profY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (played) return;
    const t2 = setTimeout(() => {
      Animated.parallel([
        Animated.timing(profOp, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(profX, { toValue: 0, friction: 6, tension: 50, useNativeDriver: true }),
      ]).start(() => markProfilIntroPlayed());
    }, 650);
    return () => { clearTimeout(t2); };
  }, []);

  // ★ 2026-04-29: Tab focus'ta — sadece Profil çizgiden yukarı doğar (Soprano sabit)
  useFocusEffect(
    useCallback(() => {
      if (!profilIntroPlayed()) return;
      profY.setValue(PROF_H);
      profOp.setValue(0);
      Animated.sequence([
        Animated.delay(60),
        Animated.parallel([
          Animated.spring(profY, { toValue: 0, friction: 7, tension: 60, useNativeDriver: true }),
          Animated.timing(profOp, { toValue: 1, duration: 320, useNativeDriver: true }),
        ]),
      ]).start();
    }, [])
  );

  return (
    <View style={profLogoS.row}>
      <Image
        source={require('../../assets/soprano_part.png')}
        style={profLogoS.sop}
        resizeMode="contain"
      />
      <View style={profLogoS.partnerWrap}>
        <Animated.Image
          source={require('../../assets/profil_part.png')}
          style={[profLogoS.prof, { opacity: profOp, transform: [{ translateX: profX }, { translateY: profY }] }]}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

const profLogoS = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginTop: -6 } as any,
  sop: { width: PROF_SOP_W, height: PROF_H } as ImageStyle,
  partnerWrap: { width: PROF_PROF_W, height: PROF_H, marginLeft: -4, overflow: 'hidden' },
  prof: { width: PROF_PROF_W, height: PROF_H } as ImageStyle,
});

// ★ Ortak ikon gölge stili — tüm sayfadaki Ionicons'lara uygulanır
const iconShadow = {
  textShadowColor: 'rgba(0,0,0,0.5)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 4,
} as const;

// ★ PremiumListItem — Odalarım kartı sadeliği: flat zemin, halo glow yok, iconShadow gölge
function PremiumListItem({
  icon, iconColor, label, labelColor, badge, badgeColor, lockedForFree, onPress, isLast,
}: {
  icon: any;
  iconColor: string;
  label: string;
  labelColor?: string;
  badge?: string;
  badgeColor?: string;
  lockedForFree?: boolean;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        pliStyles.row,
        // ★ v213e: Satırlar arası border kaldırıldı (kullanıcı talebi: "fazladan tablo çizgileri")
        pressed && { backgroundColor: 'rgba(255,255,255,0.04)' },
      ]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={22}
        color={iconColor}
        style={[pliStyles.icon, iconShadow]}
      />
      <Text style={[pliStyles.label, labelColor ? { color: labelColor } : null]} numberOfLines={1}>
        {label}
      </Text>
      {badge && (
        <Text style={[pliStyles.badgeText, { color: badgeColor }]}>{badge}</Text>
      )}
      {lockedForFree && (
        <View style={pliStyles.lockBadge}>
          <Ionicons name="lock-closed" size={9} color="#F59E0B" style={iconShadow} />
          <Text style={pliStyles.lockText}>Plus</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={14} color={labelColor ? `${labelColor}80` : 'rgba(255,255,255,0.25)'} />
    </Pressable>
  );
}

const pliStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 14,
  },
  rowBorder: {
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  icon: {
    width: 26, textAlign: 'center',
  },
  label: {
    flex: 1, fontSize: 14, fontWeight: '600', color: '#E2E8F0', letterSpacing: 0.15,
    ...Shadows.text,
  },
  badgeText: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.3,
    ...Shadows.text,
  },
  lockBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 0.5, borderColor: 'rgba(245,158,11,0.25)',
  },
  lockText: {
    fontSize: 9, fontWeight: '800', color: '#F59E0B', letterSpacing: 0.3,
  },
});

// ★ SP transaction reason → Türkçe etiket + premium ikon
function spReasonLabel(reason: string | undefined): string {
  const map: Record<string, string> = {
    daily_login: 'Günlük giriş',
    prime_time_return: 'Prime-time dönüş',
    stage_time: 'Sahne süresi',
    room_create: 'Oda oluşturma',
    referral_reward: 'Davet ödülü',
    gift_received: 'Hediye alındı',
    gift_sent: 'Hediye gönderildi',
    room_boost: 'Oda boost',
    profile_boost: 'Profil boost',
    store_purchase: 'Mağaza alışverişi',
    subscription_bonus: 'Abonelik bonusu',
    achievement: 'Başarım',
    admin_grant: 'Admin ödülü',
    refund: 'İade',
  };
  return map[reason || ''] || reason || 'SP işlemi';
}

// ★ Reason → premium ikon + renk
function spReasonIcon(reason: string | undefined, isPositive: boolean): { name: any; color: string } {
  const map: Record<string, { name: string; color: string }> = {
    daily_login: { name: 'sunny', color: '#FBBF24' },
    prime_time_return: { name: 'time', color: '#F59E0B' },
    stage_time: { name: 'mic', color: '#14B8A6' },
    room_create: { name: 'radio', color: '#A855F7' },
    referral_reward: { name: 'people', color: '#A78BFA' },
    gift_received: { name: 'gift', color: '#22C55E' },
    gift_sent: { name: 'gift-outline', color: '#EF4444' },
    room_boost: { name: 'rocket', color: '#F472B6' },
    profile_boost: { name: 'rocket', color: '#F472B6' },
    store_purchase: { name: 'cart', color: '#F59E0B' },
    subscription_bonus: { name: 'star', color: '#D4AF37' },
    achievement: { name: 'trophy', color: '#FBBF24' },
    admin_grant: { name: 'shield-checkmark', color: '#DC2626' },
    refund: { name: 'arrow-undo', color: '#3B82F6' },
  };
  const entry = map[reason || ''];
  if (entry) return entry;
  return isPositive
    ? { name: 'trending-up', color: '#22C55E' }
    : { name: 'trending-down', color: '#EF4444' };
}


export default function ProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ openSP?: string }>();
  const { profile, user, firebaseUser, refreshProfile, setIsLoggedIn, setUser } = useAuth();
  const insets = useSafeAreaInsets();
  useTheme();

  const displayName = profile?.display_name || user?.name || 'Kullanıcı';
  const avatarUrl = profile?.avatar_url || user?.avatar || '';
  // ★ 2026-04-26: Boş bio için "Henüz bir şey yazmadı" placeholder kaldırıldı — ProfileHero zaten "+ Bio ekle" link'i gösteriyor (onBioPress varsa).
  const bio = profile?.bio || '';

  const subscriptionTier: SubscriptionTier = migrateLegacyTier(profile?.subscription_tier || 'Free');
  const userId = firebaseUser?.uid || profile?.id;

  // ★ Tüm arkadaşlar (following + followers birleşik) — Profil sayfasında tam liste
  const { allFriends } = useOnlineFriends();
  const { openUserProfile } = useUserProfileSheet();

  // Dinamik istatistikler — friends (mutual) + followers/following (one-way) + rooms + gifts
  const [stats, setStats] = useState({ friends: 0, followers: 0, following: 0, rooms: 0, badges: 0, gifts: 0 });
  const [showBadgesModal, setShowBadgesModal] = useState(false);
  const [showGiftDetail, setShowGiftDetail] = useState(false);
  const [profileStats, setProfileStats] = useState({ stageMinutes: 0, roomsCreated: 0, totalListeners: 0, totalReactions: 0 });
  // ★ v110.5: Featured rozetler + konuşma ritmi (kendi profilim)
  const [featuredBadgeIds, setFeaturedBadgeIds] = useState<string[]>([]);
  const [speakingRhythmText, setSpeakingRhythmText] = useState<string | null>(null);

  // Referans Modal
  const [showReferral, setShowReferral] = useState(false);
  const [referralCodeText, setReferralCodeText] = useState('');
  const [submittingReferral, setSubmittingReferral] = useState(false);
  const [myReferralCode, setMyReferralCode] = useState<string | null>(null);
  const [usedReferral, setUsedReferral] = useState<{ used: boolean; code?: string; usedAt?: string }>({ used: false });
  const [showBoostPicker, setShowBoostPicker] = useState(false);
  const [userTitle, setUserTitle] = useState<UserTitle | null>(null);

  // ★ Avatar preview modal + SP transaction modal
  const [showAvatarPreview, setShowAvatarPreview] = useState(false);
  const [showFrameSheet, setShowFrameSheet] = useState(false);
  const [activeFrame, setActiveFrame] = useState<string | null>(null);
  const [activeEntryEffect, setActiveEntryEffect] = useState<string | null>(null);
  // ★ v108.16: Envanterde frame var ama equip edilmemiş mi? — ribbon butonunda
  //   "Çerçeven hazır" hint'i göstermek için. Fetch yalnız uid bazlı; equip durumu render time.
  const [ownsAnyFrame, setOwnsAnyFrame] = useState(false);
  // ★ v108: profil yüklenince active_frame + active_entry_effect'i state'e ata
  useEffect(() => {
    setActiveFrame((profile as any)?.active_frame || null);
    setActiveEntryEffect((profile as any)?.active_entry_effect || null);
  }, [(profile as any)?.active_frame, (profile as any)?.active_entry_effect]);
  // Frame envanteri kontrolü — sadece uid bazlı tek fetch; equip durumu render time
  useEffect(() => {
    if (!firebaseUser?.uid) return;
    let cancelled = false;
    (async () => {
      try {
        const { StoreService } = await import('../../services/store');
        const [{ items }, inv] = await Promise.all([
          StoreService.getCatalog(),
          StoreService.getUserInventory(firebaseUser.uid),
        ]);
        if (cancelled) return;
        const owns = items.some(
          (i) => (i.category === 'frames' || i.category === 'atelier') && inv.has(i.id)
        );
        setOwnsAnyFrame(owns);
      } catch { /* sessiz fail */ }
    })();
    return () => { cancelled = true; };
  }, [firebaseUser?.uid]);
  const hasUnequippedFrame = ownsAnyFrame && !activeFrame;
  // ★ 2026-04-21: Bio inline edit — bio'ya tap ile hafif modal
  const [showBioEditor, setShowBioEditor] = useState(false);
  const [showSPHistory, setShowSPHistory] = useState(false);
  const [spHistory, setSPHistory] = useState<any[]>([]);

  // ★ SEC-DEL: Hesap silme modalı (Google Play zorunlu)
  const [deleteAlert, setDeleteAlert] = useState<{ visible: boolean; title: string; message: string; type?: 'info' | 'warning' | 'error' | 'success'; buttons?: AlertButton[] }>({ visible: false, title: '', message: '' });
  // ★ 2026-04-24: Arkadaş aksiyonları bottom sheet
  const [friendActionSheet, setFriendActionSheet] = useState<null | { id: string; display_name: string; avatar_url?: string; is_online?: boolean }>(null);

  // Arkadaş / Takipçi / Takip listesi modal
  const [followModalVisible, setFollowModalVisible] = useState(false);
  const [followModalTab, setFollowModalTab] = useState<'friends' | 'followers' | 'following'>('friends');

  // ★ Paralel fetch — tüm sorgular tek Promise.allSettled'da
  const loadStats = useCallback(async (signal?: { cancelled: boolean }) => {
    if (!userId) return;
    const [friendRes, roomRes, statsRes, titleRes, followerRes, followingRes, badgeRes, giftRecvRes, giftSentRes, featuredRes, rhythmRes] = await Promise.allSettled([
      FriendshipService.getFriendCount(userId),
      supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('host_id', userId),
      ProfileService.getProfileStats(userId),
      UserTitleService.getPrimaryTitle(userId),
      FollowService.getFollowerCount(userId),
      FollowService.getFollowingCount(userId),
      // ★ Faz 6.3 — Rozet sayısı (head:count, ucuz query)
      supabase.from('user_badges').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      // ★ 2026-05-05: Hediye sayıları (aldığı + verdiği) — stat satırında tek sayı (toplam)
      GiftStatsService.getReceivedTotal(userId),
      GiftStatsService.getSentTotal(userId),
      // ★ v110.5: Featured rozetler + konuşma ritmi
      FeaturedBadgesService.getFeatured(userId),
      SpeakingRhythmService.get(userId).then(SpeakingRhythmService.derivePrimeTimeText),
    ]);

    // Sayfa kapandıysa state'e dokunma (memory leak + stale update önleme)
    if (signal?.cancelled) return;

    const friendCount = friendRes.status === 'fulfilled' ? friendRes.value : 0;
    const roomCount = roomRes.status === 'fulfilled' ? (roomRes.value.count ?? 0) : 0;
    const followerCount = followerRes.status === 'fulfilled' ? followerRes.value : 0;
    const followingCount = followingRes.status === 'fulfilled' ? followingRes.value : 0;
    const badgeCount = badgeRes.status === 'fulfilled' ? (badgeRes.value.count ?? 0) : 0;
    const recvCount = giftRecvRes.status === 'fulfilled' ? giftRecvRes.value.count : 0;
    const sentCount = giftSentRes.status === 'fulfilled' ? giftSentRes.value.count : 0;
    const giftCount = recvCount + sentCount;
    setStats({ friends: friendCount, followers: followerCount, following: followingCount, rooms: roomCount, badges: badgeCount, gifts: giftCount });

    if (statsRes.status === 'fulfilled') {
      setProfileStats(statsRes.value);
    } else if (__DEV__) {
      if (__DEV__) console.warn('[Profile] getProfileStats failed:', statsRes.reason);
      // Kritik değil ama kullanıcı 0 görürse sebebini bilsin
      showToast({ title: 'Aktivite verileri yüklenemedi', type: 'warning' });
    }

    if (titleRes.status === 'fulfilled') setUserTitle(titleRes.value);

    // ★ v110.5: Featured rozetler + konuşma ritmi
    if (featuredRes.status === 'fulfilled') setFeaturedBadgeIds(featuredRes.value);
    if (rhythmRes.status === 'fulfilled') setSpeakingRhythmText(rhythmRes.value);
  }, [userId]);

  // ★ 2026-04-21: Logout flow — settings.tsx pattern'ine eşit.
  //   Önceden: signOut sonrası state clear/navigation yoktu → user UI'da "logged in" kalabiliyordu.
  //   Şimdi: Google revoke + RevenueCat logout + Firebase signOut + state clear + router.replace.
  const handleLogout = useCallback(() => {
    setDeleteAlert({
      visible: true,
      title: 'Oturumu Kapat',
      message: 'Hesabından çıkış yapmak istediğinden emin misin?',
      type: 'warning',
      buttons: [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Çıkış Yap', style: 'destructive', onPress: async () => {
            try {
              // ★ v92.16: Logout'ta push token'ı sil — eski cihaz bildirim almasın
              if (firebaseUser) {
                try {
                  const { PushNotificationService } = require('../../services/pushNotifications');
                  const Notifications = require('expo-notifications');
                  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: 'bbd97aec-9d58-426f-8acc-215b24ff286a' });
                  if (tokenData?.data) {
                    await PushNotificationService.removePushToken(firebaseUser.uid, tokenData.data);
                  }
                } catch { /* token alınamazsa sessiz — signOut yine devam eder */ }
              }
              // 1) Google hesap cache — tekrar girişte hesap seçici açılsın
              try {
                const gsignin = require('@react-native-google-signin/google-signin');
                await gsignin.GoogleSignin.revokeAccess();
                await gsignin.GoogleSignin.signOut();
              } catch { /* Google sign-in yoksa sessiz geç */ }
              // 2) RevenueCat logout — subscription entitlement cache temizlensin
              try {
                const { RevenueCatService } = require('../../services/revenuecat');
                await RevenueCatService.logout?.();
              } catch { /* opsiyonel */ }
              // 3) Firebase signOut
              await signOut(auth);
              // 4) Context state clear — router redirect için kritik
              setIsLoggedIn(false);
              setUser(null);
              // 5) Login ekranına replace — back stack temiz
              router.replace('/(auth)/login' as any);
              showToast({ title: 'Oturum kapatıldı', type: 'success' });
            } catch (err: any) {
              showToast({ title: 'Çıkış yapılamadı', message: err.message || 'Tekrar dene.', type: 'error' });
            }
          },
        },
      ],
    });
  }, [setIsLoggedIn, setUser, router]);

  // ★ 2026-05-09: handleGoToDeleteAccount kaldırıldı — profil ekranındaki "Hesabımı Sil"
  //   butonu Ayarlar menüsündeki ile mükerrerdi, tek kaynak olarak Ayarlar'a taşındı.

  const handleClaimReferral = async () => {
    if (!userId || !referralCodeText.trim()) return;
    setSubmittingReferral(true);
    try {
      const res = await ReferralService.applyCode(referralCodeText, userId);
      if (res.success) {
        showToast({ title: '💎 50 SP Kazandın!', message: 'Davet kodu kabul edildi.', type: 'success' });
        setShowReferral(false);
        setReferralCodeText('');
        setUsedReferral({ used: true, code: referralCodeText.trim().toUpperCase(), usedAt: new Date().toISOString() });
      } else {
        showToast({ title: 'Kod Kabul Edilmedi', message: res.message, type: 'error' });
      }
    } catch (err: any) {
      showToast({ title: 'Kod Uygulanamadı', message: err.message || 'Bir sorun oluştu.', type: 'error' });
    } finally {
      setSubmittingReferral(false);
    }
  };

  // ★ Referral modal açıldığında kendi kodunu + kullanım durumunu yükle
  const openReferralModal = useCallback(async () => {
    setShowReferral(true);
    if (!userId) return;
    try {
      const [code, used] = await Promise.all([
        myReferralCode ? Promise.resolve(myReferralCode) : ReferralService.getMyCode(userId),
        ReferralService.hasUsedReferral(userId),
      ]);
      if (!myReferralCode) setMyReferralCode(code);
      setUsedReferral(used);
    } catch { }
  }, [myReferralCode, userId]);

  // ★ Kendi kodunu paylaş (native Share)
  const handleShareMyCode = useCallback(async () => {
    if (!myReferralCode) return;
    try {
      const { Share } = require('react-native');
      await Share.share({
        message: `SopranoChat'e katıl! Davet kodumu kullan, 50 SP hediye kazan: ${myReferralCode}\nhttps://sopranochat.com`,
      });
    } catch { }
  }, [myReferralCode]);

  // ★ SP transaction history'i yükle + modal aç
  const openSPHistory = useCallback(async () => {
    setShowSPHistory(true);
    if (spHistory.length > 0 || !userId) return;
    try {
      const { GamificationService } = await import('../../services/gamification');
      const txs = await GamificationService.getTransactionHistory(userId, 30);
      setSPHistory(txs || []);
    } catch {
      showToast({ title: 'Geçmiş yüklenemedi', type: 'error' });
    }
  }, [spHistory.length, userId]);

  // ★ Gift bildiriminden gelince SP history sheet'ini otomatik aç (param 'openSP=1')
  //   Param'ı tükettikten sonra URL'den temizle ki tekrar odaklanmada yeniden açılmasın.
  useEffect(() => {
    if (params?.openSP === '1' && userId) {
      openSPHistory();
      router.setParams({ openSP: undefined } as any);
    }
  }, [params?.openSP, userId, openSPHistory, router]);

  // ★ useFocusEffect: Sayfa her odaklandığında SP + istatistikleri yenile.
  //   ★ 2026-04-26 PERF: InteractionManager ile ağır DB sorguları tab geçiş
  //   animasyonu bittikten SONRA çalışır — JS thread animasyon sırasında bloke olmaz.
  useFocusEffect(
    useCallback(() => {
      const signal = { cancelled: false };
      const task = InteractionManager.runAfterInteractions(() => {
        if (signal.cancelled) return;
        refreshProfile();
        loadStats(signal);
      });
      return () => { signal.cancelled = true; task.cancel(); };
    }, [loadStats, refreshProfile])
  );

  // ★ 2026-04-21: Realtime dual subscription kaldırıldı.
  //   Önceden profile_friends kanalı + OnlineFriendsProvider kanalı ikisi de friendships
  //   table'ına subscribe ediyordu (redundant). Şimdi context'in allFriends değişiminde
  //   loadStats çağrılır — tek kaynak, tek subscription (provider).
  useEffect(() => {
    if (!userId) return;
    // allFriends referansı değiştikçe stats'ı yenile (yeni arkadaş eklendiyse vs.)
    const task = InteractionManager.runAfterInteractions(() => {
      loadStats();
    });
    return () => task.cancel();
  }, [userId, allFriends.length, loadStats]);

  // GodMaster özel tier: tier='GodMaster' VEYA is_admin=true
  const isAdmin = profile?.is_admin || false;
  const isGM = isAdmin || subscriptionTier === 'GodMaster';
  const displayTier = isGM ? 'GodMaster' : subscriptionTier;
  const tierDef = TIER_DEFINITIONS[subscriptionTier as keyof typeof TIER_DEFINITIONS];
  const tierGradient = isGM ? ['#DC2626', '#7F1D1D'] : tierDef ? tierDef.gradient : ['#94A3B8', '#64748B'];
  const tierIcon = isGM ? 'flash' : tierDef?.icon || 'person-outline';
  const tierBorderColor = isGM ? '#DC2626' : tierDef?.color || '#94A3B8';

  const spBalance = profile?.system_points ?? 0;
  const userLevel = getLevelFromSP(spBalance, subscriptionTier);

  return (
    <AppBackground variant="profile" radialGlow>
      <View style={styles.container}>
        {/* ═══ SopranoProfil Header ═══ */}
        <View style={[styles.headerBar, { paddingTop: insets.top }]}>
          <LinearGradient
            colors={['rgba(48,65,94,0.92)', 'rgba(26,40,64,0.82)', 'rgba(12,22,40,0.6)']}
            locations={[0, 0.55, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          {/* ★ v108.20: Header sadeleştirildi — 4 ikon dar ekranlarda taşıyordu (Ayar kayboluyordu).
               Premium / Mağaza / Liderlik / Ayarlar artık scroll içinde menü satırları olarak. */}
          <View style={styles.headerContent}>
            <AnimatedProfilLogo />
          </View>
          <LinearGradient
            colors={['transparent', 'rgba(245,158,11,0.55)', 'rgba(245,158,11,0.55)', 'transparent']}
            locations={[0, 0.25, 0.75, 1]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.headerSeparator}
          />
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: Math.max(insets.bottom, 16) + 70 }}
          removeClippedSubviews
        >

          {/* ═══ Profil Hero Kartı (kompakt v2) ═══ */}
          <ProfileHero
            displayName={displayName}
            username={profile?.username}
            bio={bio}
            avatarUrl={avatarUrl}
            subscriptionTier={subscriptionTier}
            isAdmin={isAdmin}
            userTitle={userTitle}
            stats={{ followers: stats.friends, rooms: stats.rooms, badges: stats.badges, gifts: stats.gifts }}
            onEdit={() => router.push('/edit-profile')}
            onBioPress={() => setShowBioEditor(true)}
            onFollowersPress={() => { setFollowModalTab('friends'); setFollowModalVisible(true); }}
            onRoomsPress={() => router.push('/(tabs)/myrooms' as any)}
            onBadgesPress={() => setShowBadgesModal(true)}
            onGiftsPress={() => setShowGiftDetail(true)}
            onAvatarPress={() => setShowAvatarPreview(true)}
            memberSince={profile?.created_at}
            boostExpiresAt={(profile as any)?.profile_boost_expires_at}
            userLevel={userLevel}
            activeFrame={activeFrame}
            onFramePress={() => setShowFrameSheet(true)}
            hasUnequippedFrame={hasUnequippedFrame}
          />

          {/* ★ v110.5: Diller + İlgi alanları (sade chip şeridi) */}
          <ProfileIdentityStrip
            languages={(profile as any)?.languages}
            interests={(profile as any)?.interests}
            isOwn
            onEditPress={() => router.push('/edit-profile' as any)}
          />

          {/* ★ v110.5: Sesli tanıtım çalar (varsa) */}
          {(profile as any)?.voice_bio_url && (
            <VoiceBioPlayer
              url={(profile as any).voice_bio_url}
              durationMs={(profile as any).voice_bio_duration_ms}
            />
          )}

          {/* ★ v110.5: Sosyal linkler (IG/X/web) */}
          <SocialLinksRow links={(profile as any)?.social_links} />

          {/* ★ v110.5: Konuşma ritmi insight */}
          <SpeakingRhythmHint text={speakingRhythmText} />

          {/* ★ v110.5: Öne çıkan rozetler (3 büyük) */}
          {featuredBadgeIds.length > 0 && (
            <FeaturedBadgesShowcase
              featuredIds={featuredBadgeIds}
              onPress={() => setShowBadgesModal(true)}
            />
          )}

          {/* ═══ SP Cüzdan — kompakt tek satır (v108.17) ═══ */}
          <Pressable style={p.walletCompact} onPress={openSPHistory} accessibilityLabel="SP geçmişi">
            <LinearGradient
              colors={['#2A1F12', '#1e160d']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
            <LinearGradient
              colors={['rgba(251,191,36,0.20)', 'rgba(251,191,36,0.04)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
            <SPHexagonIcon size={56} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={p.walletCompactLabel}>SP CÜZDANIM</Text>
              <Text style={p.walletCompactAmount}>{isGM ? '∞' : spBalance.toLocaleString('tr-TR')}</Text>
            </View>
            <View style={p.levelBadge}>
              <Text style={p.levelText}>Lv.{userLevel}</Text>
            </View>
            <Ionicons name="time-outline" size={18} color="#FAC775" style={{ marginLeft: 8 }} />
          </Pressable>

          {/* ★ 2026-05-05: Hediye vitrini ProfileHero stats satırına Hediye butonu olarak taşındı.
              Tıklayınca tab'lı GiftDetailModal açılır (Aldığı / Verdiği sekmeleri). */}

          {/* ═══ Tüm Arkadaşlar — SP cüzdanın hemen altında ═══ */}
          <ProfileFriendsList
            friends={allFriends as any}
            onFriendPress={(friendId) => openUserProfile(friendId)}
            onShowAll={() => { setFollowModalTab('friends'); setFollowModalVisible(true); }}
          />

          {/* ═══ Tek aksiyon kartı — NotificationDrawer aile dili (slate + teal halo + soft glow) ═══ */}
          <View style={p.unifiedCard}>
            <LinearGradient
              colors={['#3a4658', '#2a3344', '#1a2030']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />
            <LinearGradient
              colors={['rgba(20,184,166,0.20)', 'rgba(20,184,166,0.05)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />
            <LinearGradient
              colors={['rgba(20,184,166,0.08)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.6 }}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />
            {/* ★ v108.20: Header'dan taşınan navigation satırları */}
            <PremiumListItem
              icon="crown-outline"
              iconColor="#FBBF24"
              label="Soprano Premium"
              badge="VIP"
              badgeColor="#FBBF24"
              onPress={() => router.push('/plus' as any)}
            />
            <PremiumListItem
              icon="storefront-outline"
              iconColor="#FBBF24"
              label="Maison Soprano Mağaza"
              onPress={() => router.push('/store' as any)}
            />
            <PremiumListItem
              icon="trophy-outline"
              iconColor="#F1F5F9"
              label="Liderlik Tablosu"
              onPress={() => router.push('/leaderboard' as any)}
            />
            <PremiumListItem
              icon="cog-outline"
              iconColor="#F1F5F9"
              label="Ayarlar"
              onPress={() => router.push('/settings' as any)}
            />
            <View style={p.sectionDivider} />
            <PremiumListItem
              icon="gift"
              iconColor="#A78BFA"
              label="Davet Kodu"
              badge="+50 SP"
              badgeColor="#A78BFA"
              onPress={openReferralModal}
            />
            <PremiumListItem
              icon="rocket-launch"
              iconColor="#F472B6"
              label="Profilimi Öne Çıkar"
              lockedForFree={!isTierAtLeast(subscriptionTier, 'Plus')}
              onPress={() => {
                if (isTierAtLeast(subscriptionTier, 'Plus')) {
                  setShowBoostPicker(true);
                } else {
                  showToast({ title: 'Plus Üyelik Gerekli', message: 'Profili öne çıkarma Plus üyelikle açılır.', type: 'info' });
                  setTimeout(() => router.push('/plus' as any), 800);
                }
              }}
            />
            {/* Tehlikeli aksiyonlar — ince ayırıcı sonrası */}
            {/* ★ 2026-05-09: "Hesabımı Sil" kaldırıldı — Ayarlar menüsündeki ile mükerrerdi.
                 Tek kaynak Ayarlar > Hesabı Sil. */}
            <View style={p.sectionDivider} />
            <PremiumListItem
              icon="logout-variant"
              iconColor="#EF4444"
              label="Oturumu Kapat"
              labelColor="#EF4444"
              onPress={handleLogout}
              isLast
            />
          </View>

          {/* GodMaster Admin Paneli — admin only */}
          {/* ★ 2026-05-06: Mobile GodMaster Panel kaldırıldı — şikayet/moderasyon/kullanıcı yönetimi
               artık web admin paneline (sopranochat.com/yonet) taşındı. is_admin için sadece görsel tik kalır. */}


          {/* Referans Modal — iki bölümlü: kendi kodum + arkadaş kodu gir (premium) */}
          <Modal visible={showReferral} transparent animationType="fade">
            <Pressable style={styles.modalOverlay} onPress={() => setShowReferral(false)}>
              <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
                {/* Zemin — odalarım sadeliği, sadece mor aksan */}
                <View style={StyleSheet.absoluteFillObject as any} />
                <LinearGradient
                  colors={['transparent', 'rgba(167,139,250,0.6)', 'transparent']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.modalTopEdge}
                />
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>🎁 Davet Kodu</Text>
                  <Pressable onPress={() => setShowReferral(false)} hitSlop={12} style={styles.modalCloseBtn}>
                    <Ionicons name="close" size={18} color="rgba(167,139,250,0.8)" style={iconShadow} />
                  </Pressable>
                </View>

                {/* Bölüm 1: Kendi kodum */}
                <Text style={[styles.modalSubtitle, { marginTop: 4 }]}>Kendi Kodun</Text>
                <View style={styles.myCodeRow}>
                  <Text style={styles.myCodeText}>{myReferralCode || '—'}</Text>
                  <Pressable
                    style={styles.myCodeBtn}
                    onPress={async () => {
                      if (!myReferralCode) return;
                      try {
                        const Clipboard = await import('expo-clipboard');
                        await Clipboard.setStringAsync(myReferralCode);
                        showToast({ title: 'Kopyalandı 📋', type: 'success' });
                      } catch {
                        showToast({ title: 'Kopyalanamadı', type: 'error' });
                      }
                    }}
                  >
                    <Ionicons name="copy-outline" size={14} color={Colors.teal} style={iconShadow} />
                  </Pressable>
                  <Pressable style={[styles.myCodeBtn, { backgroundColor: Colors.teal }]} onPress={handleShareMyCode}>
                    <Ionicons name="share-social-outline" size={14} color="#FFF" style={iconShadow} />
                  </Pressable>
                </View>
                <Text style={styles.modalDesc}>Bir arkadaşın kodunu kullanırsa, ikiniz de 50 SP kazanırsınız.</Text>

                {/* Bölüm 2: Arkadaş kodu gir — zaten kullanıldıysa kilit göster */}
                <Text style={[styles.modalSubtitle, { marginTop: 16 }]}>Arkadaş Kodu Gir</Text>
                {usedReferral.used ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: 'rgba(20,184,166,0.1)', borderWidth: 1, borderColor: 'rgba(20,184,166,0.3)' }}>
                    <Ionicons name="checkmark-circle" size={20} color={Colors.teal} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: Colors.teal, fontSize: 12, fontWeight: '700' }}>Davet kodu kullanıldı</Text>
                      <Text style={{ color: Colors.text3, fontSize: 11, marginTop: 2 }}>
                        {usedReferral.code ? `Kod: ${usedReferral.code}` : 'Bir kod zaten uygulandı'}
                        {usedReferral.usedAt ? ` · ${new Date(usedReferral.usedAt).toLocaleDateString('tr-TR')}` : ''}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="Örn: XHFDK9"
                      placeholderTextColor={Colors.text3}
                      value={referralCodeText}
                      onChangeText={setReferralCodeText}
                      autoCapitalize="characters"
                      maxLength={10}
                    />
                    <Pressable
                      style={[styles.modalBtn, (!referralCodeText || submittingReferral) && { opacity: 0.5 }]}
                      onPress={handleClaimReferral}
                      disabled={!referralCodeText || submittingReferral}
                    >
                      {submittingReferral ? <AppLoader size="small" color="#fff" /> : <Text style={styles.modalBtnText}>Kodu Kullan (+50 SP)</Text>}
                    </Pressable>
                  </>
                )}
              </Pressable>
            </Pressable>
          </Modal>

          {/* ★ Avatar Preview Modal — Instagram tarzı yuvarlak + tier glow */}
          <Modal visible={showAvatarPreview} transparent animationType="fade" statusBarTranslucent>
            <Pressable style={styles.avatarPreviewOverlay} onPress={() => setShowAvatarPreview(false)}>
              {/* Dış parıltı halkası */}
              <View style={[styles.avatarPreviewGlow, { borderColor: tierBorderColor, shadowColor: tierBorderColor }]}>
                <Image
                  source={getAvatarSource(avatarUrl)}
                  style={styles.avatarPreviewImage}
                  resizeMode="cover"
                />
              </View>
              {/* İsim + tier rozeti */}
              <Text style={styles.avatarPreviewName}>{displayName}</Text>
              <View style={styles.avatarPreviewHint}>
                <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.8)" />
                <Text style={styles.avatarPreviewHintText}>Kapatmak için dokun</Text>
              </View>
            </Pressable>
          </Modal>

        </ScrollView>

        {/* ★ v107 hotfix: Sheet'ler ScrollView DIŞINDA olmalı — içerideyken position:absolute
            scroll content'inde takılır, tıklamaya tepki vermez. */}
        {firebaseUser?.uid && (
          <FrameSelectSheet
            visible={showFrameSheet}
            onClose={() => setShowFrameSheet(false)}
            userId={firebaseUser.uid}
            currentFrameId={activeFrame}
            currentEntryEffectId={activeEntryEffect}
            currentAvatarUrl={profile?.avatar_url}
            onFrameChange={(id) => setActiveFrame(id)}
            onEntryEffectChange={(id) => setActiveEntryEffect(id)}
          />
        )}

        {/* ★ SP Geçmişi — swipe-to-dismiss + realtime altın bottom sheet */}
        <SPHistorySheet
          visible={showSPHistory}
          onClose={() => setShowSPHistory(false)}
          balance={spBalance}
          history={spHistory}
        />

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
              // ★ 2026-05-05: Başarı toast'ı kaldırıldı — checked.json overlay yeterli görsel feedback.
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

        {/* ★ Faz 6.3 — Rozet Listesi Modal */}
        {userId && (
          <BadgeListModal
            visible={showBadgesModal}
            onClose={() => setShowBadgesModal(false)}
            userId={userId}
            displayName={displayName}
          />
        )}

        {/* ★ 2026-05-05: Hediye detay modalı — tab'lı (Aldığı / Verdiği) */}
        {userId && (
          <GiftDetailModal
            visible={showGiftDetail}
            userId={userId}
            displayName={displayName}
            onClose={() => setShowGiftDetail(false)}
          />
        )}

        {/* ★ SEC-DEL: Hesap silme onay modalı */}
        <PremiumAlert {...deleteAlert} onDismiss={() => setDeleteAlert(prev => ({ ...prev, visible: false }))} />

        {/* ★ 2026-04-24: Arkadaş aksiyonları bottom sheet (modern, sürüklenebilir) */}
        <ConversationActionSheet
          visible={!!friendActionSheet}
          partnerName={friendActionSheet?.display_name || ''}
          partnerAvatar={friendActionSheet?.avatar_url}
          partnerOnline={friendActionSheet?.is_online}
          onClose={() => setFriendActionSheet(null)}
          actions={friendActionSheet ? [
            {
              id: 'view',
              label: 'Profili Görüntüle',
              icon: 'person-outline',
              style: 'primary',
              onPress: () => openUserProfile(friendActionSheet.id),
            },
            {
              id: 'message',
              label: 'Mesaj Gönder',
              icon: 'chatbubble-outline',
              onPress: () => router.push(`/chat/${friendActionSheet.id}` as any),
            },
            {
              id: 'remove',
              label: 'Arkadaşlıktan Çıkar',
              icon: 'person-remove-outline',
              style: 'destructive',
              onPress: () => {
                if (!firebaseUser || !friendActionSheet) return;
                const target = friendActionSheet;
                setDeleteAlert({
                  visible: true,
                  title: 'Arkadaşlıktan Çıkar',
                  message: `${target.display_name} artık arkadaş listenden kaldırılacak.`,
                  type: 'warning',
                  buttons: [
                    { text: 'İptal', style: 'cancel' },
                    {
                      text: 'Çıkar',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          const res = await FriendshipService.removeFriend(firebaseUser.uid, target.id);
                          if (res?.success) {
                            showToast({ title: '👋 Arkadaş Kaldırıldı', message: `${target.display_name} listenden çıkarıldı.`, type: 'info' });
                            try { (global as any).__sopranoBadgeRefresh?.(); } catch { }
                          } else {
                            showToast({ title: 'Kaldırılamadı', message: res?.error || 'Arkadaş listesinden çıkarılamadı.', type: 'error' });
                          }
                        } catch (e: any) {
                          showToast({ title: 'Kaldırılamadı', message: e?.message || 'Bir sorun oluştu.', type: 'error' });
                        }
                      },
                    },
                  ],
                });
              },
            },
          ] : []}
        />
        {/* ★ 2026-04-21: Bio inline editor — edit-profile sayfasına gitmeden hızlı düzenleme */}
        <BioEditorSheet
          visible={showBioEditor}
          initialBio={bio || ''}
          onClose={() => setShowBioEditor(false)}
          onSave={async (newBio) => {
            if (!userId) return;
            try {
              await supabase.from('profiles').update({ bio: newBio }).eq('id', userId);
              await refreshProfile();
              showToast({ title: 'Bio güncellendi', type: 'success' });
            } catch (err: any) {
              showToast({ title: 'Güncellenemedi', message: err?.message || 'Tekrar dene.', type: 'error' });
              throw err;
            }
          }}
        />
        {/* ★ 2026-04-21: Tab bar scroll fade — tüm tab sayfalarında tutarlı */}
        <TabBarFadeOut />
      </View>
    </AppBackground>
  );
}

// Shadows.card ve Shadows.text theme.ts'den geliyor
const _cardShadow = Shadows.card;
const _textGlow = Shadows.text;

// ═══ Profil Stilleri (ProfileHero/ProfileFriendsList extracted) ═══
const p = StyleSheet.create({
  // Section header — ortak stil (Ayarlar, Sistem Yönetimi başlıkları)
  sectionHeader: { marginHorizontal: 16, marginTop: 10, marginBottom: 6 },
  sectionHeaderText: { fontSize: 11, fontWeight: '800' as const, color: '#94A3B8', letterSpacing: 1, ..._textGlow },
  // ★ Section header — Odalarım sadeliği
  premiumSectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 14, marginBottom: 8,
  },
  sectionAccent: { width: 3, height: 14, borderRadius: 2, backgroundColor: Colors.teal },
  premiumSectionText: {
    fontSize: 11, fontWeight: '800', color: '#94A3B8',
    letterSpacing: 1, ..._textGlow,
  },
  // ★ List card — diagonal gradient (parlak üst-sol → koyu alt-sağ) — legacy, admin panelinde kullanılıyor
  premiumListCard: {
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    ..._cardShadow,
  },
  cardTopEdge: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 1,
  },
  // ★ 2026-05-05: NotificationDrawer aile standardı — radius 14→26, teal border
  //   kaldırıldı (halo gradient yeterli), shadow tutarlı.
  unifiedCard: {
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 26,
    backgroundColor: '#1a2030',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
  },
  // ★ 2026-04-29: Section divider — tehlikeli aksiyonlar üstünde ince ayırıcı
  sectionDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 14,
    marginVertical: 4,
  },
  // ★ Premium altın gradient + amber hairline + derin shadow
  walletCard: {
    marginHorizontal: 16, marginBottom: 6,
    borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)',
    paddingHorizontal: 12, paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  walletTopEdge: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 1.5,
  },
  // ★ 2026-04-30: SP jetonu watermark — sağ kenarda hafif eğimli, soluk
  walletWatermark: {
    position: 'absolute',
    right: -28, top: '50%', marginTop: -70,
    width: 140, height: 140,
    opacity: 0.10,
    transform: [{ rotate: '10deg' }],
  },
  walletHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 4,
  },
  walletTitle: {
    fontSize: 10, fontWeight: '900', color: '#FBBF24',
    letterSpacing: 1.5, ..._textGlow,
  },
  historyBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(250,199,117,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  levelBadge: {
    paddingHorizontal: 11, paddingVertical: 5, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,224,130,0.3)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 4, elevation: 3,
  },
  // ★ v108.17: SP Cüzdan kompakt — eski büyük blok yerine 56px ince satır
  walletCompact: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.28)',
  },
  walletCompactLabel: {
    fontSize: 9, fontWeight: '700', letterSpacing: 1.2,
    color: 'rgba(251,191,36,0.7)', textTransform: 'uppercase',
    marginBottom: 2,
  },
  walletCompactAmount: {
    fontSize: 18, fontWeight: '800', color: '#FFE082',
    letterSpacing: 0.3,
  },
  walletCompactCurrency: {
    fontSize: 11, fontWeight: '700', color: 'rgba(251,191,36,0.7)',
  },
  levelText: { fontSize: 11, fontWeight: '900', color: '#FFE082', letterSpacing: 0.3, ..._textGlow },
  // ★ 2026-04-30: Sol tarafta SPHexagonIcon (mücevher) + sağ tarafta rakam — kompakt
  walletBody: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 0, marginBottom: 2,
  },
  walletAmount: {
    fontSize: 24, fontWeight: '900', color: '#FFE082',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  walletCurrency: {
    fontSize: 13, fontWeight: '800', color: 'rgba(255,224,130,0.7)',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  walletSub: { fontSize: 9, fontWeight: '700', color: 'rgba(251,191,36,0.6)', letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 },
  storeWrap: {
    borderRadius: 12, overflow: 'hidden',
    shadowColor: '#FBBF24', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 8, elevation: 6,
    borderWidth: 1, borderColor: 'rgba(255,224,130,0.4)',
  },
  storeGradient: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 9, paddingHorizontal: 11, gap: 6,
  },
  storeIconWrap: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  storeTitle: {
    fontSize: 12, fontWeight: '900', color: '#FFF', letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  // ★ Level progress bar — kompakt
  levelProgressWrap: { marginTop: 4 },
  levelProgressTrack: {
    height: 3, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    borderWidth: 0.5, borderColor: 'rgba(251,191,36,0.2)',
  },
  levelProgressFill: {
    height: '100%', borderRadius: 2,
    shadowColor: '#FBBF24', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 4, elevation: 2,
  },
  levelProgressHint: {
    fontSize: 9, fontWeight: '600', color: 'rgba(251,191,36,0.55)',
    marginTop: 3, letterSpacing: 0.3,
    ..._textGlow,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  // ★ 2026-04-29: Header ölçüleri diğer tab sayfalarıyla (home/myrooms/messages) eşitlendi.
  headerBar: {
    position: 'relative',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 10,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIconBtn: {
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'visible',
  },
  headerSeparator: {
    height: 1.5,
    width: '100%',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: {
    width: '100%', borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: Colors.cardBorder,
    backgroundColor: Colors.cardBg,
    overflow: 'hidden',
    ..._cardShadow,
  },
  modalTopEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5 },
  modalCloseBtn: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 17, fontWeight: '900', color: '#E2D5FF', letterSpacing: 0.4, ..._textGlow },
  modalSubtitle: { fontSize: 11, fontWeight: '800', color: '#94A3B8', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
  modalDesc: { fontSize: 13, color: '#CBD5E1', lineHeight: 20, marginBottom: 20, ..._textGlow },
  modalInput: { backgroundColor: 'rgba(0,0,0,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 14, color: '#F1F5F9', fontSize: 16, textAlign: 'center', marginBottom: 20, letterSpacing: 2 },
  // ★ Referral own code row
  myCodeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(167,139,250,0.08)',
    borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.25)',
    marginBottom: 8,
  },
  myCodeText: {
    flex: 1, fontSize: 20, fontWeight: '900', color: '#A78BFA',
    letterSpacing: 4, textAlign: 'center',
    textShadowColor: 'rgba(167,139,250,0.4)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8,
  },
  myCodeBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  modalBtn: { backgroundColor: Colors.teal, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  // ★ Avatar preview modal — Instagram tarzı daire + tier glow
  avatarPreviewOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.94)',
    alignItems: 'center', justifyContent: 'center',
    padding: 24,
  },
  avatarPreviewGlow: {
    width: 280, height: 280, borderRadius: 140,
    overflow: 'hidden',
    borderWidth: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 30,
    elevation: 20,
    backgroundColor: '#0F172A',
  },
  avatarPreviewImage: { width: '100%', height: '100%' },
  avatarPreviewName: {
    fontSize: 22, fontWeight: '800', color: '#F1F5F9',
    marginTop: 20, letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6,
  },
  avatarPreviewHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 14, paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  avatarPreviewHintText: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
});

// (spHistStyles → components/profile/SPHistorySheet.tsx'e taşındı)

