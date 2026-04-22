import { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Modal, TextInput, ActivityIndicator, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Colors, Shadows } from '../../constants/theme';
import { getLevelFromSP, getLevelColors, getAvatarSource } from '../../constants/avatars';
import { useAuth, useTheme } from '../_layout';
import { supabase } from '../../constants/supabase';
import { ReferralService } from '../../services/referral';
import { ProfileService } from '../../services/database';
import { FriendshipService } from '../../services/friendship';
import { showToast } from '../../components/Toast';
import FollowListModal from '../../components/FollowListModal';
import AppBackground from '../../components/AppBackground';
import TabBarFadeOut from '../../components/TabBarFadeOut';
import ProfileHero from '../../components/profile/ProfileHero';
import BioEditorSheet from '../../components/profile/BioEditorSheet';
import ProfileFriendsList from '../../components/profile/ProfileFriendsList';
import SPHistorySheet from '../../components/profile/SPHistorySheet';
import { useOnlineFriends } from '../../providers/OnlineFriendsProvider';

import { TIER_DEFINITIONS, isTierAtLeast } from '../../constants/tiers';
import { migrateLegacyTier } from '../../types';
import type { SubscriptionTier } from '../../types';
import BoostPickerSheet, { type BoostTier } from '../../components/BoostPickerSheet';
import { UserTitleService, type UserTitle } from '../../services/userTitles';
import PremiumAlert, { type AlertButton } from '../../components/PremiumAlert';
import { auth } from '../../constants/firebase';
import { signOut, deleteUser as firebaseDeleteUser } from 'firebase/auth';

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
        !isLast && pliStyles.rowBorder,
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
          <Text style={pliStyles.lockText}>Plus+</Text>
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
    daily_login:        { name: 'sunny',        color: '#FBBF24' },
    prime_time_return:  { name: 'time',         color: '#F59E0B' },
    stage_time:         { name: 'mic',          color: '#14B8A6' },
    room_create:        { name: 'radio',        color: '#A855F7' },
    referral_reward:    { name: 'people',       color: '#A78BFA' },
    gift_received:      { name: 'gift',         color: '#22C55E' },
    gift_sent:          { name: 'gift-outline', color: '#EF4444' },
    room_boost:         { name: 'rocket',       color: '#F472B6' },
    profile_boost:      { name: 'rocket',       color: '#F472B6' },
    store_purchase:     { name: 'cart',         color: '#F59E0B' },
    subscription_bonus: { name: 'star',         color: '#D4AF37' },
    achievement:        { name: 'trophy',       color: '#FBBF24' },
    admin_grant:        { name: 'shield-checkmark', color: '#DC2626' },
    refund:             { name: 'arrow-undo',   color: '#3B82F6' },
  };
  const entry = map[reason || ''];
  if (entry) return entry;
  return isPositive
    ? { name: 'trending-up',   color: '#22C55E' }
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
  const [myReferralCode, setMyReferralCode] = useState<string | null>(null);
  const [usedReferral, setUsedReferral] = useState<{ used: boolean; code?: string; usedAt?: string }>({ used: false });
  const [showBoostPicker, setShowBoostPicker] = useState(false);
  const [userTitle, setUserTitle] = useState<UserTitle | null>(null);

  // ★ Avatar preview modal + SP transaction modal
  const [showAvatarPreview, setShowAvatarPreview] = useState(false);
  // ★ 2026-04-21: Bio inline edit — bio'ya tap ile hafif modal
  const [showBioEditor, setShowBioEditor] = useState(false);
  const [showSPHistory, setShowSPHistory] = useState(false);
  const [spHistory, setSPHistory] = useState<any[]>([]);

  // ★ SEC-DEL: Hesap silme modalı (Google Play zorunlu)
  const [deleteAlert, setDeleteAlert] = useState<{ visible: boolean; title: string; message: string; type?: 'info' | 'warning' | 'error' | 'success'; buttons?: AlertButton[] }>({ visible: false, title: '', message: '' });

  // Takipçi/Takip listesi modal
  const [followModalVisible, setFollowModalVisible] = useState(false);
  const [followModalTab, setFollowModalTab] = useState<'followers' | 'following'>('followers');

  // ★ Paralel fetch — tüm sorgular tek Promise.allSettled'da
  const loadStats = useCallback(async (signal?: { cancelled: boolean }) => {
    if (!userId) return;
    const [friendRes, roomRes, statsRes, titleRes] = await Promise.allSettled([
      FriendshipService.getFriendCount(userId),
      supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('host_id', userId),
      ProfileService.getProfileStats(userId),
      UserTitleService.getPrimaryTitle(userId),
    ]);

    // Sayfa kapandıysa state'e dokunma (memory leak + stale update önleme)
    if (signal?.cancelled) return;

    const friendCount = friendRes.status === 'fulfilled' ? friendRes.value : 0;
    const roomCount = roomRes.status === 'fulfilled' ? (roomRes.value.count ?? 0) : 0;
    setStats({ followers: friendCount, following: friendCount, rooms: roomCount });

    if (statsRes.status === 'fulfilled') {
      setProfileStats(statsRes.value);
    } else if (__DEV__) {
      console.warn('[Profile] getProfileStats failed:', statsRes.reason);
      // Kritik değil ama kullanıcı 0 görürse sebebini bilsin
      showToast({ title: 'Aktivite verileri yüklenemedi', type: 'warning' });
    }

    if (titleRes.status === 'fulfilled') setUserTitle(titleRes.value);
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

  // ★ 2026-04-21: Hesap silme — doğrudan modal (settings redirect kaldırıldı).
  //   Tek atomik RPC (v49) + storage cleanup + Firebase delete + logout.
  //   Kullanıcı profilden ayrılmak zorunda kalmadan hesabını silebilir.
  const handleGoToDeleteAccount = useCallback(() => {
    setDeleteAlert({
      visible: true,
      title: '⚠️ Hesabını Sil',
      message: 'Bu işlem GERİ ALINAMAZ. Tüm verilerin, mesajların, odaların ve rozetlerin kalıcı olarak silinecek.',
      type: 'error',
      buttons: [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Hesabımı Kalıcı Olarak Sil',
          style: 'destructive',
          onPress: async () => {
            if (!firebaseUser) return;
            try {
              const { performDeleteAccount } = require('../../services/account');
              await performDeleteAccount(firebaseUser);
              setIsLoggedIn(false);
              setUser(null);
              router.replace('/(auth)/login' as any);
              showToast({ title: 'Hesap Silindi', message: 'Tüm verileriniz silindi.', type: 'info' });
            } catch (e: any) {
              showToast({ title: 'Hata', message: e?.message || 'Hesap silinemedi', type: 'error' });
            }
          },
        },
      ],
    });
  }, [firebaseUser, setIsLoggedIn, setUser, router]);

  const handleClaimReferral = async () => {
    if (!userId || !referralCodeText.trim()) return;
    setSubmittingReferral(true);
    try {
      const res = await ReferralService.applyCode(referralCodeText, userId);
      if (res.success) {
        showToast({ title: 'Tebrikler! 50 SP kazandınız.', type: 'success' });
        setShowReferral(false);
        setReferralCodeText('');
        setUsedReferral({ used: true, code: referralCodeText.trim().toUpperCase(), usedAt: new Date().toISOString() });
      } else {
        showToast({ title: 'Geçersiz veya kullanılmış davet kodu', message: res.message, type: 'error' });
      }
    } catch (err: any) {
      showToast({ title: 'Hata oluştu', message: err.message, type: 'error' });
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
    } catch {}
  }, [myReferralCode, userId]);

  // ★ Kendi kodunu paylaş (native Share)
  const handleShareMyCode = useCallback(async () => {
    if (!myReferralCode) return;
    try {
      const { Share } = require('react-native');
      await Share.share({
        message: `SopranoChat'e katıl! Davet kodumu kullan, 50 SP hediye kazan: ${myReferralCode}\nhttps://sopranochat.com`,
      });
    } catch {}
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
  //   Cleanup signal'ı ile sayfa kapanırken async stale setState'ler önlenir.
  useFocusEffect(
    useCallback(() => {
      const signal = { cancelled: false };
      refreshProfile();
      loadStats(signal);
      return () => { signal.cancelled = true; };
    }, [loadStats, refreshProfile])
  );

  // ★ 2026-04-21: Realtime dual subscription kaldırıldı.
  //   Önceden profile_friends kanalı + OnlineFriendsProvider kanalı ikisi de friendships
  //   table'ına subscribe ediyordu (redundant). Şimdi context'in allFriends değişiminde
  //   loadStats çağrılır — tek kaynak, tek subscription (provider).
  useEffect(() => {
    if (!userId) return;
    // allFriends referansı değiştikçe stats'ı yenile (yeni arkadaş eklendiyse vs.)
    loadStats();
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
  const levelColors = getLevelColors(userLevel);

  return (
    <AppBackground variant="profile">
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 18, paddingBottom: Math.max(insets.bottom, 16) + 70 }}>

        {/* ═══ Profil Hero Kartı (extracted) ═══ */}
        <ProfileHero
          displayName={displayName}
          username={profile?.username}
          bio={bio}
          avatarUrl={avatarUrl}
          subscriptionTier={subscriptionTier}
          isAdmin={isAdmin}
          userTitle={userTitle}
          stats={{ followers: stats.followers, rooms: stats.rooms }}
          onEdit={() => router.push('/edit-profile')}
          onBioPress={() => setShowBioEditor(true)}
          onFollowersPress={() => { setFollowModalTab('followers'); setFollowModalVisible(true); }}
          onRoomsPress={() => router.push('/(tabs)/myrooms' as any)}
          onAvatarPress={() => setShowAvatarPreview(true)}
          memberSince={profile?.created_at}
          boostExpiresAt={(profile as any)?.profile_boost_expires_at}
        />

        {/* ═══ Aktivite İstatistikleri ═══ */}
        {(profileStats.stageMinutes > 0 || profileStats.roomsCreated > 0 || profileStats.totalListeners > 0) && (
          <View style={p.activityCard}>
            <View style={p.activityGrid}>
              <View style={p.activityItem}>
                <Ionicons name="mic" size={22} color={Colors.teal} style={iconShadow} />
                <Text style={p.activityNum}>{profileStats.stageMinutes}</Text>
                <Text style={p.activityLabel}>dk sahne</Text>
              </View>
              <View style={p.activityItem}>
                <Ionicons name="radio" size={22} color="#A855F7" style={iconShadow} />
                <Text style={p.activityNum}>{profileStats.roomsCreated}</Text>
                <Text style={p.activityLabel}>oda</Text>
              </View>
              <View style={p.activityItem}>
                <Ionicons name="people" size={22} color="#F59E0B" style={iconShadow} />
                <Text style={p.activityNum}>{profileStats.totalListeners}</Text>
                <Text style={p.activityLabel}>dinleyici</Text>
              </View>
              <View style={p.activityItem}>
                <Ionicons name="heart" size={22} color="#EF4444" style={iconShadow} />
                <Text style={p.activityNum}>{profileStats.totalReactions}</Text>
                <Text style={p.activityLabel}>reaksiyon</Text>
              </View>
            </View>
          </View>
        )}

        {/* ═══ SP Cüzdan Kartı — premium kıymetli kart hissi ═══ */}
        <Pressable
          style={p.walletCard}
          onLongPress={openSPHistory}
          delayLongPress={400}
          accessibilityHint="Uzun bas: SP geçmişini gör"
        >
          {/* Zemin: derin koyu + gold warmth 3 stop */}
          <LinearGradient
            colors={['#2a1e14', '#17100a', '#0a0604']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Altın diagonal accent — parlak taraf artırıldı */}
          <LinearGradient
            colors={['rgba(251,191,36,0.35)', 'rgba(251,191,36,0.12)', 'rgba(251,191,36,0.02)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Üst altın kenar highlight */}
          <LinearGradient
            colors={['transparent', 'rgba(251,191,36,0.6)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={p.walletTopEdge}
          />
          {/* Watermark büyük diamond — sağ köşede soluk */}
          <Ionicons name="diamond" size={140} color="rgba(251,191,36,0.04)" style={p.walletWatermark} />

          <View style={p.walletHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="diamond" size={14} color="#FBBF24" style={iconShadow} />
              <Text style={p.walletTitle}>SP CÜZDANIM</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {/* ★ Görünür geçmiş butonu — uzun-bas yerine net affordance */}
              <Pressable onPress={openSPHistory} style={p.historyBtn} hitSlop={10} accessibilityLabel="SP geçmişi">
                <MaterialCommunityIcons name="history" size={14} color="#FBBF24" style={iconShadow} />
              </Pressable>
              <LinearGradient colors={[levelColors.text, levelColors.text + 'CC']} style={p.levelBadge}>
                <Text style={p.levelText}>Lv.{userLevel}</Text>
              </LinearGradient>
            </View>
          </View>

          <View style={p.walletBody}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <Text style={p.walletAmount}>{isGM ? '∞' : spBalance.toLocaleString('tr-TR')}</Text>
                <Text style={p.walletCurrency}>SP</Text>
              </View>
              <Text style={p.walletSub}>{isGM ? 'Sınırsız · GodMaster' : 'Soprano Points'}</Text>
            </View>
            <Pressable style={p.storeWrap} onPress={() => router.push('/sp-store' as any)}>
              <LinearGradient
                colors={['#FFE082', '#FBBF24', '#D97706']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={p.storeGradient}
              >
                <View style={p.storeIconWrap}>
                  <Ionicons name="cart" size={14} color="#FFF" style={iconShadow} />
                </View>
                <Text style={p.storeTitle}>Mağaza</Text>
                <Ionicons name="arrow-forward" size={13} color="rgba(255,255,255,0.85)" style={iconShadow} />
              </LinearGradient>
            </Pressable>
          </View>

          {/* ★ Level progress bar — sonraki level'e ne kadar kaldı */}
          {userLevel < 99 && !isGM && (
            <View style={p.levelProgressWrap}>
              <View style={p.levelProgressTrack}>
                <LinearGradient
                  colors={['#FFE082', '#FBBF24', '#D97706']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={[p.levelProgressFill, { width: `${((spBalance % 100))}%` }]}
                />
              </View>
              <Text style={p.levelProgressHint}>
                Lv.{userLevel + 1}'e {100 - (spBalance % 100)} SP
              </Text>
            </View>
          )}
        </Pressable>



        {/* ═══ AYARLAR VE YÖNETİM — premium list card ═══ */}
        <View style={p.premiumSectionHeader}>
          <View style={p.sectionAccent} />
          <Ionicons name="options" size={13} color={Colors.teal} style={iconShadow} />
          <Text style={p.premiumSectionText}>AYARLAR VE YÖNETİM</Text>
        </View>
        <View style={p.premiumListCard}>
          {/* ★ Diagonal gradient: parlak sol üst → koyu sağ alt */}
          <LinearGradient
            colors={['#4a5668', '#37414f', '#232a35']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <PremiumListItem
            icon="cog"
            iconColor="#B8C5D4"
            label="Ayarlar"
            onPress={() => router.push('/settings' as any)}
          />
          <PremiumListItem
            icon="crown"
            iconColor="#B8C5D4"
            label="Soprano Premium"
            badge={subscriptionTier}
            badgeColor={Colors.gold}
            onPress={() => router.push('/plus' as any)}
          />
          <PremiumListItem
            icon="trophy"
            iconColor="#B8C5D4"
            label="Liderlik Tablosu"
            onPress={() => router.push('/leaderboard' as any)}
          />
          <PremiumListItem
            icon="gift"
            iconColor="#B8C5D4"
            label="Davet Kodu"
            badge="+50 SP"
            badgeColor="#A78BFA"
            onPress={openReferralModal}
          />
          <PremiumListItem
            icon="rocket-launch"
            iconColor="#B8C5D4"
            label="Profilimi Öne Çıkar"
            lockedForFree={!isTierAtLeast(subscriptionTier, 'Plus')}
            onPress={() => {
              if (isTierAtLeast(subscriptionTier, 'Plus')) {
                setShowBoostPicker(true);
              } else {
                showToast({ title: 'Plus+ Gerekli', message: 'Profil boost özelliği Plus ve üzeri üyeliklerde kullanılabilir.', type: 'warning' });
              }
            }}
          />
          <PremiumListItem
            icon="logout-variant"
            iconColor="#FBBF24"
            label="Oturumu Kapat"
            labelColor="#FBBF24"
            onPress={handleLogout}
          />
          <PremiumListItem
            icon="trash-can"
            iconColor="#EF4444"
            label="Hesabımı Sil"
            labelColor="#EF4444"
            onPress={handleGoToDeleteAccount}
            isLast
          />
        </View>




        {/* GodMaster Admin Paneli — admin only */}
        {profile?.is_admin && (
          <>
            <View style={p.premiumSectionHeader}>
              <View style={[p.sectionAccent, { backgroundColor: '#EF4444' }]} />
              <Ionicons name="shield-checkmark" size={13} color="#EF4444" style={iconShadow} />
              <Text style={[p.premiumSectionText, { color: '#F87171' }]}>SİSTEM YÖNETİMİ</Text>
            </View>
            <View style={[p.premiumListCard, { borderColor: 'rgba(239,68,68,0.25)' }]}>
              <LinearGradient
                colors={['#554048', '#3f2d34', '#2a1c22']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <PremiumListItem
                icon="shield-crown"
                iconColor="#EF4444"
                label="GodMaster Panel"
                labelColor="#F87171"
                onPress={() => router.push('/admin' as any)}
                isLast
              />
            </View>
          </>
        )}

        {/* ═══ Tüm Arkadaşlar (extracted) ═══ */}
        <ProfileFriendsList
          friends={allFriends as any}
          onFriendPress={(friendId) => router.push(`/user/${friendId}` as any)}
          onShowAll={() => { setFollowModalTab('followers'); setFollowModalVisible(true); }}
        />

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
                    {submittingReferral ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalBtnText}>Kodu Kullan (+50 SP)</Text>}
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

        {/* ★ SP Geçmişi — swipe-to-dismiss + realtime altın bottom sheet */}
        <SPHistorySheet
          visible={showSPHistory}
          onClose={() => setShowSPHistory(false)}
          balance={spBalance}
          history={spHistory}
        />

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
  // ★ List card — diagonal gradient (parlak üst-sol → koyu alt-sağ)
  premiumListCard: {
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1, borderColor: Colors.cardBorder,
    overflow: 'hidden',
    ..._cardShadow,
  },
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
    borderWidth: 1.5, borderColor: 'rgba(251,191,36,0.3)',
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  walletTopEdge: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 1.5,
  },
  walletWatermark: {
    position: 'absolute',
    right: -18, top: -14,
    transform: [{ rotate: '15deg' }],
  },
  walletHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10,
  },
  walletTitle: {
    fontSize: 10, fontWeight: '900', color: '#FBBF24',
    letterSpacing: 1.5, ..._textGlow,
  },
  historyBtn: {
    width: 28, height: 28, borderRadius: 9,
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  levelBadge: {
    paddingHorizontal: 11, paddingVertical: 5, borderRadius: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 4, elevation: 3,
  },
  levelText: { fontSize: 11, fontWeight: '900', color: '#fff', letterSpacing: 0.3, ..._textGlow },
  walletBody: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
  },
  walletAmount: {
    fontSize: 28, fontWeight: '900', color: '#FFD700',
    letterSpacing: -0.7,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  walletCurrency: {
    fontSize: 13, fontWeight: '800', color: 'rgba(251,191,36,0.7)',
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
  // ★ Level progress bar
  levelProgressWrap: { marginTop: 10 },
  levelProgressTrack: {
    height: 4, borderRadius: 2,
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
    marginTop: 5, letterSpacing: 0.3,
    ..._textGlow,
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

