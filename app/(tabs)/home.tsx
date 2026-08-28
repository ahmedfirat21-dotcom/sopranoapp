import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, Image, Pressable, FlatList,
  ScrollView, RefreshControl, Dimensions, Animated, Easing, PanResponder, InteractionManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, Shadows } from '../../constants/theme';
import { bannerIntroPlayed, markBannerIntroPlayed } from '../../utils/bannerIntro';
import { RoomService, type Room } from '../../services/database';
import { RoomFollowService } from '../../services/roomFollow';
import { ProfileService } from '../../services/profile';
import { supabase } from '../../constants/supabase';
import { useAuth, useTheme, useBadges, useOnlineFriends, useUserProfileSheet } from '../_layout';
import { i18n, useTranslation } from '../../services/i18n';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ★ 2026-04-27: UserSearchModal artık global (app/_layout.tsx) — useUserSearchSheet ile açılır.
import { useUserSearchSheet } from '../_layout';
import FriendsDrawer from '../../components/FriendsDrawer';
import NotificationBell from '../../components/NotificationBell';
import DiscoverWelcomeSheet, { hasSeenDiscoverWelcome, markDiscoverWelcomeSeen } from '../../components/DiscoverWelcomeSheet';
import RoomCreateHintSheet, { hasSeenRoomCreateHint, markRoomCreateHintSeen } from '../../components/RoomCreateHintSheet';
import { markCreateRoomCoachmarkPending } from '../../components/CreateRoomCoachmark';
import QuickCreateSheet from '../../components/QuickCreateSheet';
import BoostPickerSheet, { type BoostTier } from '../../components/BoostPickerSheet';
import { ReportModal } from '../../components/ReportModal';
import TabBarFadeOut from '../../components/TabBarFadeOut';
import { CATEGORY_THEME } from '../../constants/categoryTheme';
import AppBackground from '../../components/AppBackground';
import AnimatedLogo from '../../components/AnimatedLogo';
import AnimatedHeaderIconBtn from '../../components/AnimatedHeaderIconBtn';
import StatusAvatar from '../../components/StatusAvatar';
import VerifiedBadge from '../../components/VerifiedBadge';
import { getAvatarSource } from '../../constants/avatars';
import BoostedProfileCard from '../../components/home/BoostedProfileCard';
import { SkiaShadow, CosmeticBackground } from '../../components/skia';

import { showToast } from '../../components/Toast';
import DiscoverEmptyState from '../../components/DiscoverEmptyState';
import HomeScreenSkeleton from '../../components/HomeScreenSkeleton';
import { isSystemRoom, getLobiRoom, LOBI_FALLBACK_ROOM, LOBI_ROOM_ID } from '../../services/showcaseRooms';
import { FriendshipService } from '../../services/friendship';
import { FollowService } from '../../services/follows';
import { TIER_DEFINITIONS, getEffectiveTier } from '../../constants/tiers';
import { roomPreviewService } from '../../services/roomPreview';
import { Haptics } from '../../utils/haptics';



// ════════════════════════════════════════════════════════════
// BİRLEŞİK AKILLI FİLTRE (Kategori + Etiket → Tek Bar)
// ════════════════════════════════════════════════════════════
// ★ SMART_FILTERS artık CATEGORY_THEME'den accent alır — tek kaynak
const SMART_FILTERS: Array<{ id: string; labelKey: string; icon: string; type: 'category'; accent: string }> = [
  { id: 'chat',  labelKey: 'category.chat',  icon: 'chatbubbles',     type: 'category', accent: CATEGORY_THEME.chat.accent },
  { id: 'music', labelKey: 'category.music', icon: 'musical-notes',   type: 'category', accent: CATEGORY_THEME.music.accent },
  { id: 'game',  labelKey: 'category.game',  icon: 'game-controller', type: 'category', accent: CATEGORY_THEME.game.accent },
  { id: 'tech',  labelKey: 'category.tech',  icon: 'code-slash',      type: 'category', accent: CATEGORY_THEME.tech.accent },
  { id: 'book',  labelKey: 'category.book',  icon: 'book',            type: 'category', accent: CATEGORY_THEME.book.accent },
  { id: 'film',  labelKey: 'category.film',  icon: 'film',            type: 'category', accent: CATEGORY_THEME.film.accent },
  { id: 'all',   labelKey: 'category.all',   icon: 'apps',            type: 'category', accent: '#14B8A6' },
];

// ═══ Gelişmiş Filtre Seçenekleri ═══
const ADVANCED_FILTER_OPTIONS = [
  { id: 'open', labelKey: 'filter.open', icon: 'globe-outline' as const },
  { id: 'closed', labelKey: 'filter.closed', icon: 'lock-closed' as const },
  { id: 'invite', labelKey: 'filter.invite', icon: 'mail' as const },
  { id: 'age', labelKey: 'filter.age', icon: 'warning' as const },
  { id: 'premium', labelKey: 'filter.premium', icon: 'trophy' as const },
  { id: 'myLang', labelKey: 'filter.my_lang', icon: 'language' as const },
] as const;

// ═══ Son Girdiğin Odalar — AsyncStorage Helper ═══
const RECENT_ROOMS_KEY = 'soprano_recent_rooms';
const MAX_RECENT = 8;

async function getRecentRooms(): Promise<{ id: string; name: string; hostAvatar?: string; hostName?: string; category?: string }[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_ROOMS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function addRecentRoom(room: { id: string; name: string; hostAvatar?: string; hostName?: string; category?: string }) {
  try {
    const existing = await getRecentRooms();
    const filtered = existing.filter(r => r.id !== room.id);
    const updated = [room, ...filtered].slice(0, MAX_RECENT);
    await AsyncStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(updated));
  } catch { /* silent */ }
}

// ★ Dead code temizliği (21 May 2026): TIER_RING, FourthSlotCard, BoostedProfileCard
//   kaldırıldı — hiçbir yerde render edilmiyordu (~200 satır kazanç).

// ════════════════════════════════════════════════════════════
// TAKİP EDİLEN ODA KARTI — Premium Horizontal Scroll
// ════════════════════════════════════════════════════════════

// Oda teması → gradient mapping (create-room ile senkron)
const ROOM_THEME_GRADIENTS: Record<string, [string, string]> = {
  ocean: ['#0E4D6F', '#083344'],
  sunset: ['#7F1D1D', '#4C0519'],
  forest: ['#14532D', '#052E16'],
  galaxy: ['#312E81', '#1E1B4B'],
  aurora: ['#134E4A', '#042F2E'],
  cherry: ['#831843', '#500724'],
  cyber: ['#1E3A8A', '#172554'],
  volcano: ['#7C2D12', '#431407'],
};

const { width: SCREEN_W } = Dimensions.get('window');
const FOLLOWED_CARD_W = SCREEN_W * 0.44;

function FollowedRoomCard({ room, index }: { room: Room; index: number }) {
  const router = useRouter();
  const shimmerAnim = React.useRef(new Animated.Value(-1)).current;

  const shimmerAnimRef = React.useRef<Animated.CompositeAnimation | null>(null);

  React.useEffect(() => {
    shimmerAnimRef.current = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 2400 + index * 300,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    shimmerAnimRef.current.start();
    return () => { shimmerAnimRef.current?.stop(); };
  }, []);

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: [-FOLLOWED_CARD_W * 1.5, FOLLOWED_CARD_W * 1.5],
  });

  const themeId = (room.room_settings as any)?.theme_id;
  const themeGrad = themeId && ROOM_THEME_GRADIENTS[themeId]
    ? ROOM_THEME_GRADIENTS[themeId]
    : null;
  const catTheme = CATEGORY_THEME[room.category] || CATEGORY_THEME.other;
  const cardImage = (room.room_settings as any)?.card_image_url;
  const isLive = room.is_live && (room.listener_count || 0) > 0;
  const isEmpty = room.is_live && (room.listener_count || 0) === 0;
  const isSleeping = !room.is_live;

  const isPersistent = (room as any).is_persistent;
  const ownerTier = (room as any).owner_tier || room.host?.subscription_tier || 'Free';
  const isPremiumOwner = ownerTier === 'Plus' || ownerTier === 'Pro';
  // ★ v1.7.13.140 SORUN-3: tier ayrımı — Plus mor (#A78BFA), Pro altın (Colors.premiumGold)
  const tierColor = ownerTier === 'Pro' ? Colors.premiumGold : (ownerTier === 'Plus' ? '#A78BFA' : null);

  return (
    <Pressable
      style={({ pressed }) => [
        s.fCard,
        tierColor && { borderColor: tierColor, borderWidth: 1.5 },
        pressed && { opacity: 0.92, transform: [{ scale: 0.97 }] },
      ]}
      onPress={() => router.push(`/room/${room.id}`)}
    >
      {/* Arka plan: öncelik → kart görseli > tema > kategori */}
      {cardImage ? (
        <>
          <Image source={{ uri: cardImage }} style={[StyleSheet.absoluteFillObject, { borderRadius: 18 }]} resizeMode="cover" />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 18 }]} />
        </>
      ) : themeGrad ? (
        <LinearGradient
          colors={[themeGrad[0], themeGrad[1], 'rgba(0,0,0,0.4)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      ) : (
        <LinearGradient
          colors={catTheme.colors}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      {/* Shimmer / Parlak ışık efekti */}
      <Animated.View style={[
        s.fShimmer,
        { transform: [{ translateX: shimmerTranslate }] },
      ]} />

      {/* Üst: durum badge + premium */}
      <View style={s.fTopRow}>
        {isLive ? (
          <View style={s.fLiveBadge}>
            <View style={s.fLiveDot} />
            {/* ★ v1.7.13.139: BUG-2 fix — sayı zaten altta pill'de gösteriliyor (L447-452), çift gösterim. */}
            <Text style={s.fLiveText}>{i18n.t('rooms.live')}</Text>
          </View>
        ) : isEmpty ? (
          <View style={s.fEmptyBadge}>
            <Ionicons name="radio-outline" size={9} color="#94A3B8" />
            <Text style={s.fEmptyText}>{i18n.t('home.empty_seat')}</Text>
          </View>
        ) : isSleeping ? (
          <View style={s.fSleepBadge}>
            <Ionicons name="moon" size={9} color="#F59E0B" />
            <Text style={s.fSleepText}>{i18n.t('home.sleeping')}</Text>
          </View>
        ) : null}
        {isPremiumOwner && tierColor && (
          <View style={[s.fPremiumBadge, { backgroundColor: `${tierColor}1A`, borderColor: `${tierColor}66` }]}>
            <Ionicons name={ownerTier === 'Pro' ? 'trophy' : 'star'} size={8} color={tierColor} />
            <Text style={[s.fPremiumText, { color: tierColor }]}>{ownerTier === 'Pro' ? 'PRO' : 'PLUS'}</Text>
          </View>
        )}
      </View>

      {/* Asimetrik alt bölge — avatar + isim + dinleyici */}
      <View style={s.fBottom}>
        <View style={s.fBottomLeft}>
          <Text style={s.fRoomName} numberOfLines={2}>{room.name}</Text>
          {!!room.description && (
            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 2 }} numberOfLines={1}>{room.description}</Text>
          )}
          {/* ★ Faz 4.3 — Tag chips (max 3) */}
          {Array.isArray(room.tags) && room.tags.length > 0 && (
            <View style={s.fTagRow}>
              {room.tags.slice(0, 3).map((t: string) => (
                <View key={t} style={s.fTagChip}>
                  <Text style={s.fTagText}>#{t}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={s.fHostRow}>
            <StatusAvatar uri={room.host?.avatar_url} size={28} tier={(room.host as any)?.subscription_tier} frameId={(room.host as any)?.active_frame} customBadgeId={(room.host as any)?.active_badge_id ?? null} />
            <Text style={s.fHostName} numberOfLines={1}>{room.host?.display_name || i18n.t('common.anonymous')}</Text>
            {(room.listener_count || 0) > 0 && (
              <View style={s.fListenerPill}>
                <Ionicons name="people" size={9} color="rgba(255,255,255,0.6)" />
                <Text style={s.fListenerText}>{room.listener_count}</Text>
              </View>
            )}
          </View>
        </View>
        {/* Büyük soluk kategori ikonu — sağ alt */}
        {!cardImage && (
          <View style={s.fCatIconWrap}>
            <Ionicons name={catTheme.icon as any} size={28} color="rgba(255,255,255,0.07)" />
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════
// ŞU AN CANLI — Büyük Dikey Oda Kartı
// ════════════════════════════════════════════════════════════

// ★ CATEGORY_THEME artık constants/categoryTheme.ts'den geliyor (tek kaynak).
// Home + myrooms + create-room + leaderboard aynı paleti paylaşır.


// ════════════════════════════════════════════════════════════
// SwipeToHideRow — sola kaydır → "Bildir" + "Gizle" butonları
// ★ 2026-04-21 (güncel): İkinci aksiyon eklendi — uygunsuz oda raporlama için "Bildir".
// ════════════════════════════════════════════════════════════
const SWIPE_ACTION_W = 72; // tek aksiyon genişliği
const SWIPE_TOTAL_W = SWIPE_ACTION_W * 2; // toplam açılan alan

function SwipeToHideRow({ children, onHide, onReport }: { children: React.ReactNode; onHide: () => void; onReport?: () => void }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [isOpen, setIsOpen] = useState(false);
  // ★ v107.12: isOpen ref — panResponder closure'da güncel state
  const isOpenRef = useRef(false);
  isOpenRef.current = isOpen;
  const totalW = onReport ? SWIPE_TOTAL_W : SWIPE_ACTION_W;
  const actionOpacity = translateX.interpolate({ inputRange: [-totalW, -20, 0], outputRange: [1, 0.5, 0], extrapolate: 'clamp' });

  const closeSwipe = () => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 100, friction: 10 }).start();
    setIsOpen(false);
  };

  const panResponder = useRef(
    PanResponder.create({
      // ★ v107.12 FIX: Açıkken kart üstüne tap → kapat (eski sürümde tap algılanmıyordu,
      //   inner Pressable'lar oda'ya katıl çağırıyordu)
      onStartShouldSetPanResponder: () => isOpenRef.current,
      onStartShouldSetPanResponderCapture: () => isOpenRef.current,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 15 && Math.abs(gs.dy) < 15,
      onPanResponderGrant: () => {
        // Açıkken tap = kapat
        if (isOpenRef.current) {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 100, friction: 10 }).start();
          setIsOpen(false);
        }
      },
      onPanResponderMove: (_, gs) => {
        // ★ v107.12: Açıkken sağa swipe (gs.dx > 0) ile kapatma desteği
        if (isOpenRef.current) {
          // Açık state: sağa kayma izinli (kapatmak için), sol bloke
          if (gs.dx > 0) translateX.setValue(Math.min(gs.dx - totalW, 0));
        } else {
          // Kapalı state: sola kayma izinli (açmak için)
          if (gs.dx < 0) translateX.setValue(Math.max(gs.dx, -(totalW + 12)));
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (isOpenRef.current) {
          // Açık state release: sağa 30+ → kapat, az → açık tut
          if (gs.dx > 30) {
            closeSwipe();
          } else {
            Animated.spring(translateX, { toValue: -totalW, useNativeDriver: true, tension: 100, friction: 10 }).start();
          }
        } else {
          // Kapalı state release: sola 50+ → aç, az → kapat
          if (gs.dx < -50) {
            Animated.spring(translateX, { toValue: -totalW, useNativeDriver: true, tension: 100, friction: 10 }).start();
            setIsOpen(true);
          } else {
            Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 100, friction: 10 }).start();
            setIsOpen(false);
          }
        }
      },
    })
  ).current;

  return (
    <View style={{ marginHorizontal: 16, marginBottom: 10 }}>
      {/* Actions — arkada, outer'a göre konumlanır (overflow yok, clip yok) */}
      <Animated.View style={[{
        position: 'absolute', right: 0, top: 0, bottom: 0,
        flexDirection: 'row',
        borderRadius: 14,
        overflow: 'hidden',
      }, { opacity: actionOpacity }]}>
        {onReport && (
          <Pressable
            onPress={() => { onReport(); closeSwipe(); }}
            style={{ width: SWIPE_ACTION_W, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="flag" size={20} color="#FFF" />
            <Text style={{ fontSize: 10, fontWeight: '800', color: '#FFF', letterSpacing: 0.5, marginTop: 4 }}>{i18n.t('home.swipe_report')}</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => { onHide(); closeSwipe(); }}
          style={{ width: SWIPE_ACTION_W, backgroundColor: '#64748B', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="eye-off-outline" size={20} color="#FFF" />
          <Text style={{ fontSize: 10, fontWeight: '800', color: '#FFF', letterSpacing: 0.5, marginTop: 4 }}>{i18n.t('home.swipe_hide')}</Text>
        </Pressable>
      </Animated.View>
      {/* Kart — önde, translate ile kayar. borderRadius + overflow kart'ta */}
      <Animated.View
        style={{ transform: [{ translateX }], borderRadius: 14, overflow: 'hidden' }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
      {/* ★ v107.12 FIX: Açıkken outside-tap overlay — Android'de zIndex güvenilir değil,
           elevation lazım. Eski sürümde overlay kart'ın altında kalıyordu, tap closeSwipe yapamıyordu. */}
      {isOpen && (
        <Pressable
          style={[
            StyleSheet.absoluteFillObject,
            { right: totalW, zIndex: 10, elevation: 10 },
          ]}
          onPress={closeSwipe}
        />
      )}
    </View>
  );
}

const BigLiveRoomCard = React.memo(function BigLiveRoomCard({ room, onJoin, isFollowed, onToggleFollow, onIgnore, participants, currentUserId, currentUserDisplayName, inRoom, friendInRoom }: {
  room: Room;
  onJoin: (roomId: string) => void;
  isFollowed?: boolean;
  onToggleFollow?: (roomId: string, currentlyFollowed: boolean) => void;
  onIgnore?: (roomId: string, roomName: string) => void;
  participants?: { avatar_url: string | null; display_name: string | null }[];
  currentUserId?: string;
  currentUserDisplayName?: string;
  inRoom?: boolean; // Kullanıcı başka bir odada mı? → preview engellenir
  friendInRoom?: { name: string; avatar_url: string | null } | null;
}) {
  // ★ 2026-04-21: Preview state — karta uzun basınca LiveKit audio preview başlar.
  //   BUG FIX: Önceki versiyonda useEffect closure stale `previewState`'i tuttuğu için
  //   diğer kartlar idle'a reset olmuyordu → aynı anda birden fazla kart badge gösteriyordu.
  //   Şimdi her state change'de aktif ID ile karşılaştırma yapıp kararlı şekilde set ediyoruz.
  const [previewState, setPreviewState] = React.useState<'idle' | 'connecting' | 'playing' | 'error'>('idle');
  React.useEffect(() => {
    const unsub = roomPreviewService.onStateChange((s) => {
      const activeId = roomPreviewService.getPreviewingRoomId();
      if (activeId === room.id) {
        setPreviewState(s);
      } else {
        // Bu kart aktif değil → her durumda idle'a getir (stale closure riski yok)
        setPreviewState('idle');
      }
    });
    return unsub;
  }, [room.id]);

  const handleLongPress = () => {
    if (!currentUserId || !room.is_live) return;
    Haptics.heavy();
    // ★ 2026-04-21: Kullanıcı başka odada (minimize edilmiş) ise preview çalışmaz —
    //   iki LiveKit bağlantısı eşzamanlı = üst üste ses + çifte maliyet.
    if (inRoom) {
      showToast({ title: i18n.t('tabs.home.002'), message: i18n.t('tabs.home.003'), type: 'info' });
      return;
    }
    roomPreviewService.start(room.id, currentUserId, currentUserDisplayName || i18n.t('auto.tabs.home.012')).catch(() => {});
  };
  const handlePressOut = () => {
    // Aktif önizleme bu kart içinse bırakınca durdur (auto-timeout'a gerek kalmasın)
    if (roomPreviewService.getPreviewingRoomId() === room.id) {
      roomPreviewService.stop().catch(() => {});
    }
  };

  const isPersistent = (room as any).is_persistent;
  const hostName = room.host?.display_name || i18n.t('common.anonymous');
  // ★ v1.7.13.100 (20 May 2026): Yanıltıcı fallback kaldırıldı — DB'de gerçek
  //   participants count varsa onu kullan (getLive'a embedded count eklendi).
  //   listener_count alanı stale olabiliyor; participants_count Supabase'in her
  //   sorguda hesapladığı gerçek count. Fallback yine de raw'a düşer (geri uyum).
  const embedded = (room as any).room_participants;
  const actualCount = Array.isArray(embedded) && embedded[0]?.count !== undefined
    ? Number(embedded[0].count)
    : (room.listener_count || 0);
  const listenerCount = actualCount;
  const isSystem = room.id.startsWith('system_');
  const theme = CATEGORY_THEME[room.category] || CATEGORY_THEME.other;
  const isLive = room.is_live && listenerCount > 0;

  // Oda temasını kontrol et (oda sahibinin seçtiği tema)
  const roomThemeId = (room.room_settings as any)?.theme_id;
  const roomThemeGrad = roomThemeId && ROOM_THEME_GRADIENTS[roomThemeId]
    ? ROOM_THEME_GRADIENTS[roomThemeId]
    : null;

  const isBoosted = (room as any).boost_expires_at && new Date((room as any).boost_expires_at) > new Date();

  // ★ CANLI badge pulse animasyonu
  const livePulse = React.useRef(new Animated.Value(1)).current;
  const livePulseRef = React.useRef<Animated.CompositeAnimation | null>(null);
  React.useEffect(() => {
    if (isLive) {
      livePulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(livePulse, { toValue: 0.3, duration: 800, useNativeDriver: true }),
          Animated.timing(livePulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      livePulseRef.current.start();
    }
    return () => { livePulseRef.current?.stop(); };
  }, [isLive]);

  // ★ v1.3.66: Persistent/boosted room glow Skia ile çiziliyor — Android'de renkli halo
  //   parite (eski shadowColor + elevation Android'de görünmüyordu).
  // ★ v1.7.13.52 (20 May 2026): "Glow yapay ve çirkin" geri bildirimi.
  //   Wide blur tek başına yetmiyor — renk yoğunluğu yüksek olduğunda kart altında
  //   "yapışkan etiket" hissi veriyor. Üç değişiklik:
  //     • Opaklık ~yarıya: persistent 0.20→0.10, boosted 0.28→0.14 (atmosferik).
  //     • Blur büyüdü: 64-68→100-110 (kenar tamamen erir, halka değil sis).
  //     • OffsetY 0→8: hafif aşağı kaçış = doğal ışık cast hissi, sticker bitti.
  const skiaGlowColor = isPersistent ? Colors.premiumGold : (isBoosted ? '#F472B6' : null);
  const skiaGlowOpacity = isPersistent ? 0.10 : 0.14;
  const skiaGlowBlur = isPersistent ? 100 : 110;
  const skiaGlowOffsetY = 8;

  const cardPressable = (
    <Pressable
      style={({ pressed }) => [
        s.bigCard,
        isSystem && { borderColor: '#14B8A6', borderWidth: 1.5 },
        isPersistent && { borderColor: Colors.premiumGold, borderWidth: 1.5 },
        isBoosted && !isPersistent && { borderColor: '#F472B6', borderWidth: 1.5 },
        pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
      ]}
      onPress={() => onJoin(room.id)}
      // ★ 2026-04-21: Long press → audio preview (Clubhouse tarzı). Bırakınca durdurulur.
      //   Gizleme artık swipe ile yapılıyor, onIgnore long-press'i kaldırıldı.
      onLongPress={handleLongPress}
      onPressOut={handlePressOut}
      delayLongPress={400}
    >
      {/* ★ 2026-04-21: Audio preview indicator — gradient zemin + koyu gölge */}
      {(previewState === 'connecting' || previewState === 'playing') && (
        <View style={s.previewBadgeWrap} pointerEvents="none">
          <LinearGradient
            colors={previewState === 'playing'
              ? ['#1E293B', '#0F172A', '#020617']
              : ['#1F2937', '#111827', '#0B1120']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={s.previewBadgeInner}
          >
            <Ionicons
              name={previewState === 'playing' ? 'volume-high' : 'wifi'}
              size={11}
              color={previewState === 'playing' ? '#FBBF24' : '#94A3B8'}
            />
            <Text style={[s.previewBadgeText, previewState === 'playing' && { color: '#FBBF24' }]}>
              {previewState === 'playing' ? i18n.t('home.preview_listening') : i18n.t('auto.tabs.home.011')}
            </Text>
          </LinearGradient>
        </View>
      )}

      {/* Kategori bazlı gradient arka plan */}
      {(room.room_settings as any)?.card_image_url ? (
        <>
          <Image source={{ uri: (room.room_settings as any).card_image_url }} style={[StyleSheet.absoluteFillObject, { borderRadius: 14 }]} resizeMode="cover" />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 14 }]} />
        </>
      ) : roomThemeGrad ? (
        <LinearGradient
          colors={[roomThemeGrad[0], roomThemeGrad[1], 'rgba(0,0,0,0.3)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      ) : (
        <LinearGradient
          colors={theme.colors}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      )}
      {/* Soluk kategori ikonu — sağ üst köşe (küçültüldü) */}
      {!(room.room_settings as any)?.card_image_url && (
        <View style={s.bigCategoryIconWrap}>
          <Ionicons name={theme.icon as any} size={48} color={theme.accent + '18'} />
        </View>
      )}

      {/* === Üst Bar: Sol — CANLI / Boş, Sağ — Premium/Resmi/Boost === */}
      <View style={s.bigTopRow}>
        {/* Sol: Canlı / Boş badge + ★ v1.7.13.49 (20 May 2026) kalan süre countdown */}
        <View style={s.bigTopLeft}>
          {room.is_live && listenerCount > 0 ? (
            <View style={s.bigLiveBadge}>
              <Animated.View style={[s.bigLiveDot, { opacity: livePulse }]} />
              <Text style={s.bigLiveText}>{i18n.t('rooms.live')}</Text>
            </View>
          ) : room.is_live && listenerCount === 0 ? (
            // ★ v1.7.13.139 BUG-3 fix: "Yeni Açıldı" yanıltıcı (yeni mi yoksa herkes çıkmış eski mi belirsiz).
            // FollowedRoomCard'daki "Boş" ile uyumla — semantic doğru, tutarlı.
            <View style={s.bigEmptyBadge}>
              <Ionicons name="radio-outline" size={9} color="#94A3B8" />
              <Text style={s.bigEmptyText}>{i18n.t('home.empty_seat')}</Text>
            </View>
          ) : null}
          {/* ★ Kalan süre — sadece is_live + expires_at var + persistent değil + future. */}
          {room.is_live && (room as any).expires_at && !isPersistent && (() => {
            const expMs = new Date((room as any).expires_at).getTime() - Date.now();
            if (expMs <= 0) return null;
            const totalMin = Math.floor(expMs / 60000);
            const hr = Math.floor(totalMin / 60);
            const mn = totalMin % 60;
            const label = hr > 0 ? i18n.t('time.hours_minutes', { hr, mn }) : `${mn}dk`;
            // Son 15 dakikada uyarı tonu — turuncu/kırmızı
            const isUrgent = totalMin < 15;
            return (
              <View style={[s.bigCountdownPill, isUrgent && s.bigCountdownPillUrgent]}>
                <Ionicons name="time-outline" size={9} color={isUrgent ? '#FCA5A5' : 'rgba(148,163,184,0.85)'} />
                <Text style={[s.bigCountdownText, isUrgent && { color: '#FCA5A5' }]}>{label}</Text>
              </View>
            );
          })()}
        </View>

        {/* ★ v1.7.13.83 (20 May 2026): Sağ üst — priority-based tek rozet (visual hierarchy).
            Öncelik: Boost (en eyecatching) > Sistem > Premium > Trending. Eskiden 2-3
            rozet üst üste bineliyordu, kart kalabalık görünüyordu. */}
        <View style={s.bigTopRight}>
          {isBoosted ? (
            <View style={[s.bigTagBadge, { backgroundColor: 'rgba(244,114,182,0.18)', borderColor: 'rgba(244,114,182,0.35)' }]}>
              <Ionicons name="rocket" size={10} color="#F472B6" style={{
                textShadowColor: 'rgba(244,114,182,0.6)',
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 5,
              }} />
              <Text style={[s.bigTagText, { color: '#F472B6', fontWeight: '900', letterSpacing: 0.5 }]}>{i18n.t('rooms.boost')}</Text>
            </View>
          ) : isSystem ? (
            <View style={[s.bigTagBadge, { backgroundColor: 'rgba(20,184,166,0.15)', borderColor: 'rgba(20,184,166,0.3)' }]}>
              <Ionicons name="shield-checkmark" size={9} color="#14B8A6" />
              <Text style={[s.bigTagText, { color: '#14B8A6' }]}>{i18n.t('rooms.official')}</Text>
            </View>
          ) : listenerCount >= 5 ? (
            <View style={[s.bigTagBadge, { backgroundColor: 'rgba(251,191,36,0.15)', borderColor: 'rgba(251,191,36,0.3)' }]}>
              <Ionicons name="star" size={9} color="#FBBF24" />
              <Text style={[s.bigTagText, { color: '#FBBF24' }]}>{i18n.t('rooms.trend')}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* === Başlık + Küçük İnline Rozetler === */}
      <View style={s.bigTitleRow}>
        <Text style={s.bigCardTitle} numberOfLines={1}>{room.name}</Text>
        <View style={s.bigBadgeWrap}>
          {room.type === 'closed' && !!((room.room_settings as any)?.password || (room as any).room_password) && (
            <View style={s.bigInlineBadgeIcon}>
              <Ionicons name="lock-closed" size={10} color="#F59E0B" />
            </View>
          )}
          {room.type === 'invite' && (
            <View style={[s.bigInlineBadgeIcon, { backgroundColor: 'rgba(139,92,246,0.12)', borderColor: 'rgba(139,92,246,0.25)' }]}>
              <Ionicons name="mail" size={10} color="#8B5CF6" />
            </View>
          )}
          {(room.room_settings as any)?.entry_fee_sp > 0 && (
            <View style={[s.bigInlineBadge, { backgroundColor: 'rgba(212,175,55,0.12)', borderColor: 'rgba(212,175,55,0.25)' }]}>
              <Ionicons name="cash" size={8} color="#D4AF37" />
              <Text style={[s.bigInlineBadgeText, { color: '#D4AF37' }]}>{(room.room_settings as any).entry_fee_sp}</Text>
            </View>
          )}
          {(room.room_settings as any)?.is_locked && <Ionicons name="ban" size={11} color="#EF4444" />}
          {(room.room_settings as any)?.followers_only && <Ionicons name="people" size={11} color="#A78BFA" />}
          {(room.room_settings as any)?.age_restricted && <Text style={{ fontSize: 10 }}>🔞</Text>}
          {(room.room_settings as any)?.donations_enabled && <Ionicons name="heart" size={10} color="#EF4444" />}
          {(room.room_settings as any)?.music_link && <Ionicons name="musical-notes" size={10} color="#FFD700" />}
          {(() => {
            const rl = (room.room_settings as any)?.room_language || (room as any)?.language;
            if (!rl || rl === 'tr') return null;
            const flag = rl === 'en' ? '🇬🇧' : rl === 'ar' ? '🇸🇦' : rl === 'de' ? '🇩🇪' : '🌐';
            return <Text style={{ fontSize: 10 }}>{flag}</Text>;
          })()}
        </View>
      </View>

      {/* Arkadaşın Burada badge */}
      {friendInRoom && (
        <View style={s.friendBadge}>
          <View style={s.friendDot} />
          <Text style={s.friendBadgeText}>{i18n.t('home.friend_in_room', { name: friendInRoom.name })}</Text>
        </View>
      )}

      {/* Tag chips */}
      {Array.isArray((room as any).tags) && (room as any).tags.length > 0 && (
        <View style={[s.fTagRow, { paddingHorizontal: 14 }]}>
          {(room as any).tags.slice(0, 3).map((t: string) => (
            <View key={t} style={s.fTagChip}>
              <Text style={s.fTagText}>#{t}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Host + Stats + Katıl — tek satır */}
      <View style={s.bigHostStatsRow}>
        <StatusAvatar uri={room.host?.avatar_url} size={44} tier={(room.host as any)?.subscription_tier} frameId={(room.host as any)?.active_frame} customBadgeId={(room.host as any)?.active_badge_id ?? null} />
        <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={s.bigHostName} numberOfLines={1}>{hostName}</Text>
          {(room.host as any)?.is_verified === true && <VerifiedBadge size={12} />}
          {isPersistent && (
            <Ionicons name="trophy" size={11} color="#FDE68A" style={{
              textShadowColor: 'rgba(0,0,0,0.5)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 2,
            }} />
          )}
        </View>
        {(() => {
          const list = participants || [];
          if (list.length === 0) {
            return (
              <>
                <Ionicons name="people" size={11} color="#94A3B8" />
                <Text style={s.bigStatText}>{listenerCount}</Text>
              </>
            );
          }
          const shown = list.slice(0, 4);
          const remaining = listenerCount - shown.length;
          return (
            <View style={s.avatarStack}>
              {shown.map((p, i) => (
                <View
                  key={i}
                  style={[s.stackAvatar, { marginLeft: i === 0 ? 0 : -8, zIndex: 10 - i, backgroundColor: '#1E293B' }]}
                >
                  <Image source={getAvatarSource(p.avatar_url)} style={{ width: '100%', height: '100%' }} />
                </View>
              ))}
              {remaining > 0 && (
                <View style={[s.stackAvatar, s.stackMore, { marginLeft: -8 }]}>
                  <Text style={s.stackMoreText}>+{remaining}</Text>
                </View>
              )}
            </View>
          );
        })()}
        {onToggleFollow && (
          <Pressable onPress={(e) => { e.stopPropagation(); onToggleFollow(room.id, !!isFollowed); }} hitSlop={8} style={{ padding: 2 }}>
            <Ionicons name={isFollowed ? 'bookmark' : 'bookmark-outline'} size={13} color={isFollowed ? '#14B8A6' : '#64748B'} />
          </Pressable>
        )}
        <SkiaShadow shadowColor="#14B8A6" shadowOpacity={0.4} shadowBlur={6} shadowOffsetY={2} borderRadius={11}>
        <Pressable onPress={(e) => { e.stopPropagation(); onJoin(room.id); }} onStartShouldSetResponder={() => true}>
          <LinearGradient
            colors={['#14B8A6', '#0D9488', '#065F56']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={s.bigJoinBtn}
          >
            <Ionicons name="headset" size={13} color="#FFF" />
            <Text style={s.bigJoinText}>{i18n.t('rooms.join')}</Text>
          </LinearGradient>
        </Pressable>
        </SkiaShadow>
      </View>
      {/* Kategori accent çizgisi — kartın alt kenarı */}
      <LinearGradient
        colors={[theme.accent + '00', theme.accent + '60', theme.accent + '00']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ position: 'absolute', bottom: 0, left: 16, right: 16, height: 2, borderRadius: 1 }}
      />
    </Pressable>
  );

  // ★ v1.7.13.142: Mount animasyonu — kart fade-in + slide-up (premium hissi)
  const mountAnim = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    const anim = Animated.timing(mountAnim, {
      toValue: 1,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    // ★ v1.7.13.143: Memory leak fix — unmount'ta animasyonu durdur
    return () => anim.stop();
  }, []);

  return (
    <Animated.View style={[s.bigCardWrapper, {
      opacity: mountAnim,
      transform: [{ translateY: mountAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
    }]}>
      {skiaGlowColor ? (
        <SkiaShadow shadowColor={skiaGlowColor} shadowOpacity={skiaGlowOpacity} shadowBlur={skiaGlowBlur} shadowOffsetY={skiaGlowOffsetY} borderRadius={18}>
          {cardPressable}
        </SkiaShadow>
      ) : cardPressable}
    </Animated.View>
  );
});


// ════════════════════════════════════════════════════════════
// ANA EKRAN — KEŞFET (SopranoChat v2)
// ════════════════════════════════════════════════════════════
export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { firebaseUser, profile, refreshProfile, setShowNotifDrawer, setNotifDrawerAnchorRight, minimizedRoom, justCompletedOnboarding, setJustCompletedOnboarding, setTabBarCovered } = useAuth();
  const [showBoostPicker, setShowBoostPicker] = useState(false);
  const { openUserProfile } = useUserProfileSheet();
  const insets = useSafeAreaInsets();
  // ★ 2026-04-24: Banner slide-down — sadece uygulama ilk açılışında
  const bannerTranslateY = useRef(new Animated.Value(bannerIntroPlayed() ? 0 : -140)).current;
  useEffect(() => {
    if (!bannerIntroPlayed()) {
      Animated.timing(bannerTranslateY, { toValue: 0, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      markBannerIntroPlayed();
    }
  }, []);
  const { unreadNotifs: unreadCount, pendingFollows: pendingFollowCount, refreshBadges } = useBadges();
  useTheme();

  const [rooms, setRooms] = useState<Room[]>([]);
  // ★ v1.7.13.143 PERF: roomsRef — handleJoinRoom'un rooms dep'ini kaldırmak için
  const roomsRef = useRef<Room[]>([]);
  useEffect(() => { roomsRef.current = rooms; }, [rooms]);
  const [filteredRooms, setFilteredRooms] = useState<Room[]>([]);
  const [followedRooms, setFollowedRooms] = useState<Room[]>([]);
  // ★ v1.7.13.120: boostedProfiles + topDonorToday state'leri Keşfet sekmesine taşındı.
  //   FourthSlotCard + BoostedProfileCard sub-component tanımları üstte duruyor (dead code,
  //   ileride ortak component'e çıkarılacak). Şimdilik dokunulmadı (refactor scope dışı).
  // ★ v1.7.13.49 (20 May 2026): Planlı (gelecek) odalar — Keşfet'te kompakt yatay scroll.
  const [scheduledRooms, setScheduledRooms] = useState<Room[]>([]);
  // ★ v1.7.13.140 (21 May 2026): Soprano Lobi — 7/24 açık sistem odası. Cold start çözümü.
  const [lobiRoom, setLobiRoom] = useState<Room>(LOBI_FALLBACK_ROOM);
  // ★ v1.7.13.135: Keşfet ASKIYA ALINDIĞINDA boost edilen profiller GÖRÜNMÜYORDU.
  //   SP harcanan ama hiçbir görünürlük kazanılmayan kritik bug. Ana Sayfa'ya geri.
  const [boostedProfiles, setBoostedProfiles] = useState<any[]>([]);
  // ★ v1.7.13.146 (24 May 2026): Clubhouse + takip butonu için takip edilen kullanıcılar.
  const [followedUserIds, setFollowedUserIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!firebaseUser?.uid) return;
    // ★ v1.7.13.146 KRİTİK FIX: FollowService (follows tablo) — profile sayfası
    //   da burayı sayıyor, FriendshipService ayrı tabloya yazıyordu.
    FollowService.getFollowing(firebaseUser.uid)
      .then(list => setFollowedUserIds(new Set(list.map(u => u.id))))
      .catch(() => {});
  }, [firebaseUser?.uid]);
  const handleHomeFollow = useCallback(async (targetId: string) => {
    if (!firebaseUser?.uid || targetId === firebaseUser.uid) return;
    setFollowedUserIds(prev => new Set(prev).add(targetId));
    const result = await FollowService.addFollow(firebaseUser.uid, targetId);
    if (!result.success) {
      setFollowedUserIds(prev => { const n = new Set(prev); n.delete(targetId); return n; });
      showToast({ title: i18n.t('common.error'), message: result.error || '', type: 'error' });
    } else {
      showToast({ title: '✓ Takip edildi', type: 'success' });
    }
  }, [firebaseUser?.uid]);
  // ★ 2026-04-21: Her oda için top N katılımcı avatarı — keşfet kartında stack gösterilir.
  const [participantAvatars, setParticipantAvatars] = useState<Record<string, { avatar_url: string | null; display_name: string | null }[]>>({});
  // ★ 2026-04-21: recentRooms state kaldırıldı — Keşfet'te hiçbir yerde render
  //   edilmiyordu (Son Girdiğin Odalar Odalarım'da yaşıyor). Ölü kod temizliği.

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { openSearch } = useUserSearchSheet();
  // ★ 2026-04-21: API hatasını empty state'ten ayır — kullanıcı retry görebilsin.
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeFilter, setActiveFilter] = useState('all');
  const [advancedFilters, setAdvancedFilters] = useState<string[]>([]);
  // ★ 2026-04-21: Filter state persistence — tab switch / kapanış sonrası tercih kaybolmasın.
  useEffect(() => {
    (async () => {
      try {
        const [af, adv] = await Promise.all([
          AsyncStorage.getItem('discover_active_filter'),
          AsyncStorage.getItem('discover_advanced_filters'),
        ]);
        if (af) setActiveFilter(af);
        if (adv) { try { setAdvancedFilters(JSON.parse(adv)); } catch {} }
      } catch {}
    })();
  }, []);
  useEffect(() => { AsyncStorage.setItem('discover_active_filter', activeFilter).catch(() => {}); }, [activeFilter]);
  useEffect(() => { AsyncStorage.setItem('discover_advanced_filters', JSON.stringify(advancedFilters)).catch(() => {}); }, [advancedFilters]);
  // ★ 2026-04-21: Kullanıcının gizlediği odalar — AsyncStorage ile persist, keşifte hariç tutulur.
  const [ignoredRoomIds, setIgnoredRoomIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    AsyncStorage.getItem('ignored_room_ids').then(val => {
      if (val) { try { setIgnoredRoomIds(new Set(JSON.parse(val))); } catch {} }
    });
  }, []);
  const unignoreOne = useCallback((roomId: string) => {
    setIgnoredRoomIds(prev => {
      const next = new Set(prev); next.delete(roomId);
      AsyncStorage.setItem('ignored_room_ids', JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, []);
  // ★ v107.14: Sessiz gizleme — toast YOK (kullanıcı talebi). Geri getirme yolu
  //   empty state altındaki pill ve liste footer barı ile sağlanıyor.
  const ignoreRoom = useCallback((roomId: string, _roomName?: string) => {
    setIgnoredRoomIds(prev => {
      const next = new Set(prev); next.add(roomId);
      AsyncStorage.setItem('ignored_room_ids', JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, []);
  const unignoreAll = useCallback(() => {
    setIgnoredRoomIds(new Set());
    AsyncStorage.removeItem('ignored_room_ids').catch(() => {});
  }, []);
  const [followedRoomIds, setFollowedRoomIds] = useState<Record<string, boolean>>({});
  const [showFriends, setShowFriends] = useState(false);
  // ★ 2026-04-21: Oda bildirme — swipe ile tetiklenir, ReportModal açar.
  const [reportRoom, setReportRoom] = useState<{ id: string; name: string } | null>(null);
  // ★ 2026-04-23: null = kontrol ediliyor, true = göster, false = gösterme
  //   null durumunda tam ekran örtü render edilir → tab bar flash önlenir
  const [showWelcome, setShowWelcome] = useState<boolean | null>(justCompletedOnboarding ? true : null);
  // ★ 2026-04-29: First-time user "Oda oluştur!" yönlendirmesi — DiscoverWelcome bittikten sonra Keşfet'e düşünce
  const [showRoomHint, setShowRoomHint] = useState(false);
  // ★ 2026-05-09 FLASH FIX v3: Cover şartı değişince tab bar'ı da gizle/göster.
  //   View cover ana içeriği kaplar ama tab bar ayrı katmanda render ediliyor.
  //   Bu effect context flag'ini set eder → CurvedTabBar onu görüp null döner.
  // ★ 2026-05-09 FLASH FIX: RoomHint kararı verilene kadar Keşfet gizli kalsın.
  //   Default true → karar başlamadıysa cover çalışmaz (eski/oda açmış kullanıcı yolu).
  //   Welcome onClose veya onboardingDone branch effect başlamadan önce false yapar.
  const [roomHintReady, setRoomHintReady] = useState(true);
  useEffect(() => {
    const covered = (showWelcome !== false) || !roomHintReady || showRoomHint;
    setTabBarCovered(covered);
  }, [showWelcome, roomHintReady, showRoomHint, setTabBarCovered]);
  // ★ home unmount → tab bar her zaman geri gelsin (gerçi tab nav'da unmount olmaz, ama emniyet)
  useEffect(() => () => { setTabBarCovered(false); }, [setTabBarCovered]);
  // ★ 2026-04-22: Quick-create sheet — FAB ve empty state chip'lerinden tetiklenir.
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  // ★ v299 (17 May 2026): handleJoinRoom double-navigate guard. Önceden hızlı çift
  //   tıklama router.push'u 2 kez çağırıyor, navigation stack'e aynı route 2 kez
  //   ekleniyordu (kullanıcı geri tuşuna 2 kez basmak zorunda kalıyordu). Tek
  //   navigation cycle için kilitliyoruz; sayfa değiştiği için reset gereksiz.
  const joiningRoomRef = useRef<string | null>(null);

  // Hızlı oda açma: limit check → RoomService.quickCreate → navigate.
  // category null ise generic "{ad}'in Odası", kategori varsa o tipte isim üretilir.
  // ★ 2026-04-23: Hızlı akışta limit dolu → kısa toast + direkt /plus (satın alma).
  //   Detaylı akışla FARKLI: kullanıcı "hızlı" başlatıyor, ara limit ekranı yerine
  //   doğrudan çözüm sayfasına gitsin.
  const handleQuickCreate = async (category?: string) => {
    if (!firebaseUser || creatingRoom) return;
    setCreatingRoom(true);
    try {
      const userTier = getEffectiveTier(profile);
      const gate = await RoomService.canCreateToday(firebaseUser.uid, userTier);
      if (!gate.ok) {
        showToast({ title: i18n.t('tabs.home.004'), message: i18n.t('auto.tabs.home.010'), type: 'warning' });
        return;
      }
      const displayName = profile?.display_name || firebaseUser.displayName || i18n.t('auto.tabs.home.009');
      const room = await RoomService.quickCreate(firebaseUser.uid, displayName, category, userTier);
      router.push(`/room/${room.id}` as any);
    } catch (err: any) {
      showToast({ title: i18n.t('tabs.home.005'), message: err?.message || i18n.t('common.unexpected_error'), type: 'error' });
    } finally {
      setCreatingRoom(false);
    }
  };
  // ★ 2026-05-09: Welcome kararı SADECE BİR KEZ verilir (welcomeDecidedRef).
  //   Eski hâlinde: justCompletedOnboarding=true → Welcome açılır → flag false yapılır →
  //   effect re-run → onboardingDone=true (DB güncel) → Welcome KAPATILIR (flash bug).
  //   Yeni hâlinde: ilk geçerli karar verildikten sonra effect dokunmaz; kullanıcı
  //   onClose'a basınca kapanır.
  const welcomeDecidedRef = useRef(false);
  useEffect(() => {
    if (welcomeDecidedRef.current) return;
    if (justCompletedOnboarding) {
      welcomeDecidedRef.current = true;
      setShowWelcome(true);
      setJustCompletedOnboarding(false);
      return;
    }
    if (!firebaseUser?.uid) {
      welcomeDecidedRef.current = true;
      setShowWelcome(false);
      return;
    }
    if (!profile) return; // profil yüklenene kadar bekle, karar verme
    const onboardingDone = (profile as any)?.preferences?.onboarding_completed === true;
    const dbWelcomeSeen = (profile as any)?.preferences?.discover_welcome_seen === true;
    // ★ 2026-05-09: Sadece onboarding tamamlanmış DEĞİL, aynı zamanda Welcome de görülmüş olmalı.
    //   Aksi halde admin DB'den flag'i temizleyince Welcome yine açılabilsin.
    if (onboardingDone && dbWelcomeSeen) {
      welcomeDecidedRef.current = true;
      setRoomHintReady(false);
      setShowWelcome(false);
      return;
    }
    hasSeenDiscoverWelcome(firebaseUser.uid).then(seen => {
      welcomeDecidedRef.current = true;
      if (seen) {
        setRoomHintReady(false);
        setShowWelcome(false);
      } else {
        setShowWelcome(true);
      }
    }).catch(() => {
      welcomeDecidedRef.current = true;
      setRoomHintReady(false);
      setShowWelcome(false);
    });
  }, [firebaseUser?.uid, justCompletedOnboarding, (profile as any)?.preferences?.onboarding_completed, !!profile]);

  // ★ 2026-04-29: DiscoverWelcome bittikten sonra (showWelcome=false) Keşfet'e düşen
  //   YENİ + odası olmayan kullanıcıya "Oda oluştur!" yönlendirmesi. UID-bazlı bir kez
  //   (room_hint flag). Odası olan kullanıcıya gösterilmez (zaten biliyor).
  useEffect(() => {
    if (showWelcome !== false) return;
    if (!firebaseUser?.uid) { setRoomHintReady(true); return; }
    let cancelled = false;
    setRoomHintReady(false);
    // ★ Safety timeout: DB sorgusu pending kalırsa 5sn sonra cover'ı kaldır → siyah ekran riski yok
    const safetyTimer = setTimeout(() => { if (!cancelled) setRoomHintReady(true); }, 5000);
    (async () => {
      const seen = await Promise.race([
        hasSeenRoomCreateHint(firebaseUser.uid),
        new Promise<boolean>(r => setTimeout(() => r(true), 4500)),
      ]).catch(() => true);
      if (cancelled) return;
      if (seen) { clearTimeout(safetyTimer); setRoomHintReady(true); return; }
      try {
        const myRooms = await RoomService.getMyRooms(firebaseUser.uid);
        if (cancelled) return;
        if (myRooms && myRooms.length > 0) {
          await markRoomCreateHintSeen(firebaseUser.uid);
          clearTimeout(safetyTimer);
          setRoomHintReady(true);
          return;
        }
      } catch { /* fetch fail — hint'i yine de göstermek mantıklı (yeni kullanıcı varsayım) */ }
      if (cancelled) return;
      // ★ 2026-05-09 FLASH FIX: hint açılmadan önce kısa nefes (modal animasyonu temiz),
      //   cover hâlâ aktif (showRoomHint cover şartında).
      setShowRoomHint(true);
      clearTimeout(safetyTimer);
      setRoomHintReady(true);
    })();
    return () => { cancelled = true; clearTimeout(safetyTimer); };
  }, [showWelcome, firebaseUser?.uid]);
  const [showAdvFilterPanel, setShowAdvFilterPanel] = useState(false);

  // ★ DUP-3 FIX: Online friends artık merkezî provider'dan geliyor
  const { allFriends, onlineFriends, friendIds: friendIdSet } = useOnlineFriends();
  // ★ v1.7.13.143 PERF: useMemo — her render'da yeni Set oluşturmayı önle
  const onlineIdSet = useMemo(() => new Set(onlineFriends.map(f => f.id)), [onlineFriends]);

  // ★ v1.7.13.150 PERF: friendInRoom map önceden hesapla — renderItem'da yeni obje oluşturmayı önle
  const friendInRoomMap = useMemo(() => {
    const map: Record<string, { name: string; avatar_url: string | null }> = {};
    if (!friendIdSet || friendIdSet.size === 0) return map;
    for (const f of allFriends) {
      map[f.id] = { name: f.display_name || 'Arkadaşın', avatar_url: f.avatar_url || null };
    }
    return map;
  }, [allFriends, friendIdSet]);

  // ★ v1.7.13.150 PERF: Boosted profiles — self filtre tek sefer hesaplanır
  const visibleBoostedProfiles = useMemo(
    () => boostedProfiles.filter(bp => bp.id !== firebaseUser?.uid),
    [boostedProfiles, firebaseUser?.uid]
  );

  // ★ Realtime kanal bağımlılık fix: loadData'yı ref ile sar
  const loadDataRef = useRef<(() => Promise<void>) | null>(null);


  const loadData = useCallback(async () => {
    try {
      setLoadError(null);
      const liveRoomsRaw = await RoomService.getLive(firebaseUser?.uid);
      // ★ v1.7.13.140: Sistem odaları (Lobi) ana listede gösterilmez —
      //   LobiCard özel slot ile en üstte zaten render ediliyor.
      const liveRooms = liveRoomsRaw.filter(r => !isSystemRoom(r.id));

      setRooms(liveRooms);
      setFilteredRooms(liveRooms);

      // ★ 2026-04-21: Keşfet avatar stack için her odanın top 4 katılımcısını çek.
      if (liveRooms.length > 0) {
        try {
          const avatars = await RoomService.getTopParticipants(liveRooms.map(r => r.id), 4);
          setParticipantAvatars(avatars);
        } catch { /* avatar stack opsiyonel */ }
      }

      if (firebaseUser) {
        // Oda takip durumlarını toplu sorgula
        const roomIds = liveRooms.map(r => r.id);
        if (roomIds.length > 0) {
          const followStatus = await RoomFollowService.getBatchFollowStatus(firebaseUser.uid, roomIds);
          setFollowedRoomIds(followStatus);
        }

        // Takip edilen odaları yükle
        const followed = await RoomFollowService.getFollowedRooms(firebaseUser.uid);
        setFollowedRooms(followed);
      }

      // Son girdiğin odalar (AsyncStorage)
      // ★ 2026-04-21: recentRooms fetch'i kaldırıldı — Keşfet'te render edilmiyordu.
      //   addRecentRoom() yazma tarafı yaşamaya devam ediyor (Odalarım okuyor).

      // ★ v1.7.13.135: Boost profilleri Ana Sayfa'ya geri (Keşfet askıda).
      try {
        const bp = await ProfileService.getBoostedProfiles(8);
        setBoostedProfiles(bp || []);
      } catch { }

      // ★ v1.7.13.49 (20 May 2026): Planlı odalar — sonraki 7 gün.
      try {
        const sched = await RoomService.getUpcomingScheduled(10);
        setScheduledRooms(sched);
      } catch { }

      // Soprano Lobi 7/24 görünür. Sorgu geçici olarak başarısız olursa
      // listener sayısı fallback'te 0 kalır; kart hiçbir zaman kaybolmaz.
      try {
        const lobi = await getLobiRoom();
        if (lobi) setLobiRoom({ ...lobi, is_live: true });
      } catch { /* kalıcı UI fallback'ini koru */ }
    } catch (err: any) {
      if (__DEV__) console.warn('[Home] Load error:', err);
      // ★ Kullanıcıya görünür hata — hem toast hem persistent error state
      const msg = err?.message || i18n.t('auto.tabs.home.008');
      setLoadError(msg);
      showToast({ title: i18n.t('tabs.home.006'), message: msg, type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);

    }
  }, [firebaseUser]);

  // ★ loadData ref'ini güncel tut
  useEffect(() => { loadDataRef.current = loadData; }, [loadData]);

  // ★ 2026-04-26 PERF: InteractionManager ile ağır DB sorguları tab geçiş
  //   animasyonu bittikten SONRA çalışır — JS thread animasyon sırasında bloke olmaz.
  useFocusEffect(useCallback(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      loadData();
    });
    // ★ Ekran odaktan çıkınca: overlay'leri kapat + audio preview durdur
    return () => {
      task.cancel();
      roomPreviewService.stop().catch(() => {});
      setShowFriends(false);
    };
  }, [loadData]));

  // ★ v1.7.13.87 (20 May 2026): Client-side autoCloseExpired interval KALDIRILDI.
  //   DB cron `auto-close-free-rooms` zaten her 2 dakikada bir aynı işi yapıyor;
  //   client interval gereksiz network maliyeti + race condition yaratıyordu.
  //   Realtime postgres_changes is_live=false update'ini zaten yakalar → loadData
  //   tetiklenir. Yani UI hâlâ güncel.

  // ★ Realtime: Oda oluşturma/kapanma/güncelleme anında keşfet listesini güncelle
  useEffect(() => {
    const channel = supabase
      .channel('rooms-realtime-home')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'rooms',
        // BUG-R4 FIX: filter kaldırıldı — is_live=false UPDATE eventı yakalanmalı
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          // ★ 2026-04-21: host JOIN verisi payload'da yok — her yeni oda INSERT'inde tam yeniden yükle.
          //   loadData kendi filter'ı ile is_live olanları seçer. Önceki versiyon sadece is_live=true
          //   olanları refetch ediyordu ama hosts tarafında is_live=true ile yaratıldığı anda diğer
          //   client'ların keşifte anlık göremeyişi nedeniyle her durumda loadData çağrılıyor.
          loadDataRef.current?.();
        } else if (payload.eventType === 'DELETE') {
          // ★ BUG-K5 FIX: RLS aktifse payload.old boş obje olabilir — fallback loadData
          const deletedId = (payload.old as any)?.id;
          if (deletedId) {
            setRooms(prev => prev.filter(r => r.id !== deletedId));
          } else {
            loadDataRef.current?.(); // ID yoksa tam yeniden yükle
          }
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as any;
          // is_live false olduysa listeden çıkar
          if (updated.is_live === false) {
            setRooms(prev => prev.filter(r => r.id !== updated.id));
            // ★ v1.7.13.88 (20 May 2026): Oda kapanınca participant avatar cache temizle
            setParticipantAvatars(prev => {
              const n = { ...prev }; delete n[updated.id]; return n;
            });
          } else {
            // ★ 2026-04-22: Uyandırılan oda (is_live false→true) listede YOK olabilir — mevcut
            //   map update bulamayıp eklemiyordu. Şimdi: listede yoksa full reload (host JOIN ile).
            setRooms(prev => {
              const exists = prev.some(r => r.id === updated.id);
              if (exists) {
                // BUG-H1 FIX: host bilgisini koru — payload.new'da JOIN verisi yok
                return prev.map(r => r.id === updated.id ? { ...r, ...updated, host: r.host } : r);
              }
              // Yeni canlıya yükseldi → tam yükleme (host JOIN için)
              loadDataRef.current?.();
              return prev;
            });
            // ★ v1.7.13.88 (20 May 2026): Kullanıcı odadan çıkınca listener_count değişir
            //   ama participantAvatars cache eski avatarı tutar — stack'te hayalet katılımcı
            //   görünür. UPDATE event'inde o oda için top participants yeniden fetch edilir.
            if (typeof updated.listener_count === 'number') {
              RoomService.getTopParticipants([updated.id], 4)
                .then(map => {
                  setParticipantAvatars(prev => ({ ...prev, ...map }));
                })
                .catch(() => {});
            }
          }
        }
      })
      .subscribe();

    return () => {
      // ★ 2026-04-21: Güvenli cleanup — kanal durumu kontrol edilerek kaldırılır.
      //   State hatalı olursa removeChannel exception fırlatabiliyordu; try/catch ile sarıldı.
      try {
        const st = (channel as any).state;
        if (st === 'joined' || st === 'joining') {
          channel.unsubscribe().catch(() => {});
        }
      } catch {}
      try { supabase.removeChannel(channel); } catch {}
    };
  }, []); // ★ FIX: loadData bağımlılığı kaldırıldı — ref kullanılıyor

  // ★ v1.7.13.120: Boost realtime kanalı Keşfet sekmesine taşındı.

  // ★ DUP-3 FIX: Online friends Realtime subscription artık
  // providers/OnlineFriendsProvider.tsx'de merkezileştirildi.
  // Bu sayfadaki yerel friends-online-status kanalı kaldırıldı.
  // Tüm veri useOnlineFriends() hook'undan geliyor.

  useEffect(() => {
    // ★ 2026-04-21: Kullanıcının gizlediği odalar en önce filtrelenir (sistem odalarına dokunma)
    let base = rooms.filter(r => r.id.startsWith('system_') || !ignoredRoomIds.has(r.id));

    // ★ Kategori filtresi
    if (activeFilter !== 'all') {
      base = base.filter(r => r.category === activeFilter);
    }

    // ★ Gelişmiş filtreler
    if (advancedFilters.length > 0) {
      // ★ 2026-04-20: myLang → device locale'a göre filtrele
      const { getDeviceLanguage } = require('../../utils/locale');
      const userLocale = getDeviceLanguage();
      base = base.filter(room => {
        // ★ v1.7.13.143 FIX: Oda tipi filtreleri OR mantığıyla çalışmalı
        // (open + closed seçilince her ikisi de gösterilmeli, AND ile 0 sonuç çıkıyordu)
        const typeFilters = advancedFilters.filter(f => f === 'open' || f === 'closed' || f === 'invite');
        const otherFilters = advancedFilters.filter(f => f !== 'open' && f !== 'closed' && f !== 'invite');

        // Tip filtreleri: OR (herhangi biri eşleşmeli)
        if (typeFilters.length > 0 && !typeFilters.includes(room.type as any)) return false;

        // Diğer filtreler: AND (hepsi sağlanmalı)
        for (const f of otherFilters) {
          if (f === 'age' && !(room.room_settings as any)?.age_restricted) return false;
          if (f === 'premium' && !(room as any).is_persistent) return false;
          if (f === 'myLang') {
            const rl = (room.room_settings as any)?.room_language;
            if (rl && rl !== userLocale) return false;
          }
        }
        return true;
      });
    }

    // ★ Gelişmiş Keşfet Algoritması — çok katmanlı sıralama
    const userInterests = (profile as any)?.interests || (profile as any)?.metadata?.interests || [];
    const followingIds = new Set(allFriends.map(f => f.id));
    const now = new Date().toISOString();

    const scored = base.map(room => {
      let score = 0;
      const isSystem = room.id.startsWith('system_');
      if (isSystem) return { room, score: 9999 };

      // Katman 1: Oda boost aktifse +100
      if ((room as any).boost_expires_at && (room as any).boost_expires_at > now) {
        score += 100 + ((room as any).boost_score || 0);
      }
      // Katman 1.5: Host profil boost aktifse +75
      const hostBoost = (room.host as any)?.profile_boost_expires_at;
      if (hostBoost && hostBoost > now) score += 75;
      // Katman 2: Takip edilen kişinin odası +50
      if (followingIds.has(room.host_id)) score += 50;
      // Katman 3: İlgi alanı eşleşmesi +20
      if (userInterests.length > 0 && userInterests.includes(room.category)) score += 20;
      // Katman 4: Dinleyici sayısı — canlı odaları güçlü öne çıkar, boş odaları alta it
      const listeners = room.listener_count || 0;
      score += Math.min(listeners * 4, 60); // ★ Her dinleyici +4, max +60
      if (listeners === 0 && room.is_live) score -= 30; // ★ Boş canlı oda ciddi penalty
      // Katman 5: Yeni odalar bonus — yeni açılan oda ilk 30dk içinde avantajlı
      const ageMs = Date.now() - new Date(room.created_at).getTime();
      if (ageMs < 30 * 60 * 1000) score += 10;

      return { room, score };
    });

    scored.sort((a, b) => b.score - a.score);
    setFilteredRooms(scored.map(s => s.room));
  }, [activeFilter, advancedFilters, rooms, allFriends, profile, ignoredRoomIds]);

  // ★ 2026-04-21: Refresh spam koruma — devam eden refresh varsa yeni çağrı yoksayılır.
  //   Ayrıca min 1.5 sn aralık (debounce-like) — aynı anda spam edilmesini engeller.
  const lastRefreshRef = useRef<number>(0);
  const handleRefresh = useCallback(() => {
    if (refreshing) return;
    const now = Date.now();
    if (now - lastRefreshRef.current < 1500) {
      setRefreshing(false); // RefreshControl state'ini kapat
      return;
    }
    lastRefreshRef.current = now;
    setRefreshing(true);
    loadData();
  }, [loadData, refreshing]);

  // ★ 2026-04-21: Premium (persistent) odaya katılmadan önce ke\u015ffet kart\u0131nda tier gate.
  //   \u00d6nce oda sayfas\u0131na gidip orada "gir-at\u0131l" yaparak upsell g\u00f6stermektense keşfette dur.
  const handleJoinRoom = useCallback((roomId: string) => {
    if (!firebaseUser) {
      showToast({ title: i18n.t('tabs.home.007'), message: i18n.t('tabs.home.008'), type: 'warning' });
      return;
    }
    // ★ v1.7.13.119 (20 May 2026): Misafir DB satırı var (is_guest=true) → odaya
    //   listener olarak girebilir. RLS engelleri: chat/gift/follow/donate yasak.
    //   Persistent/premium-only oda block'u zaten ileride uygulanır.
    // ★ v299: Double-tap guard — aynı odaya 2 ardışık tıklama tek navigation olarak işlensin.
    //   1sn sonra reset; kullanıcı geri dönüp başka/aynı odaya tekrar girebilsin.
    if (joiningRoomRef.current === roomId) return;
    joiningRoomRef.current = roomId;
    setTimeout(() => { joiningRoomRef.current = null; }, 1000);
    // ★ 2026-04-21: Audio preview aktifse önce kapat — ana LiveKit bağlantısı çakışmasın
    roomPreviewService.stop().catch(() => {});
    const room = roomsRef.current.find(r => r.id === roomId);
    // ★ 2026-04-22 FIX: Persistent oda → Free user block KALDIRILDI.
    //   is_persistent, host'un tier özelliği (Plus+ kalıcı oda açabilir) — dinleyici
    //   tier'ıyla ilgisi yok. Free kullanıcılar da kalıcı odalara girebilmeli.
    //   Gerçek premium-only oda feature'ı ayrı planlanıyor (room_settings.subscribers_only).
    // ★ Kategori tercihi kaydet + son girdiğin odalara ekle
    if (room?.category) {
      RoomService.trackCategoryVisit(firebaseUser.uid, room.category).catch(() => { });
    }
    if (room) {
      addRecentRoom({
        id: room.id,
        name: room.name,
        hostAvatar: room.host?.avatar_url,
        hostName: room.host?.display_name,
        category: room.category,
      });
    }
    router.push(`/room/${roomId}`);
  }, [firebaseUser, profile, router]);

  // ★ Stable follow toggle — BigLiveRoomCard memo'sunu koruyor (inline callback yerine)
  const handleToggleFollow = useCallback(async (roomId: string, currentlyFollowed: boolean) => {
    if (!firebaseUser) return;
    try {
      if (currentlyFollowed) {
        setFollowedRoomIds(prev => { const n = { ...prev }; delete n[roomId]; return n; });
        await RoomFollowService.unfollow(roomId, firebaseUser.uid);
      } else {
        setFollowedRoomIds(prev => ({ ...prev, [roomId]: true }));
        await RoomFollowService.follow(roomId, firebaseUser.uid);
      }
    } catch {
      // Rollback
      if (currentlyFollowed) {
        setFollowedRoomIds(prev => ({ ...prev, [roomId]: true }));
      } else {
        setFollowedRoomIds(prev => { const n = { ...prev }; delete n[roomId]; return n; });
      }
      showToast({ title: i18n.t('tabs.home.009'), message: currentlyFollowed ? i18n.t('auto.tabs.home.007') : i18n.t('home.follow_failed'), type: 'error' });
    }
  }, [firebaseUser]);

  // ★ v1.7.13.150 PERF: Stable keyExtractor — inline arrow yerine sabit referans
  const roomKeyExtractor = useCallback((item: any) => item.id, []);

  // ★ v1.7.13.150 PERF: Stable renderItem — friendInRoom artık map'ten geliyor (yeni obje yok)
  const renderRoomItem = useCallback(({ item: room }: { item: any }) => {
    const friendInRoom = friendInRoomMap[room.host_id] || null;
    return (
      <SwipeToHideRow
        onHide={() => ignoreRoom(room.id, room.name)}
        onReport={() => {
          if (!firebaseUser) { showToast({ title: i18n.t('tabs.home.010'), message: i18n.t('tabs.home.011'), type: 'warning' }); return; }
          setReportRoom({ id: room.id, name: room.name });
        }}
      >
        <BigLiveRoomCard
          room={room}
          onJoin={handleJoinRoom}
          isFollowed={!!followedRoomIds[room.id]}
          onToggleFollow={firebaseUser ? handleToggleFollow : undefined}
          participants={participantAvatars[room.id]}
          currentUserId={firebaseUser?.uid}
          currentUserDisplayName={profile?.display_name || undefined}
          inRoom={!!minimizedRoom}
          friendInRoom={friendInRoom}
        />
      </SwipeToHideRow>
    );
  }, [friendInRoomMap, followedRoomIds, participantAvatars, firebaseUser, profile, minimizedRoom, handleJoinRoom, handleToggleFollow, ignoreRoom]);


  // ★ 2026-04-21: Profile null race guard — firebaseUser varken profile henüz fetch edilmemişse
  //   (ProfileService gecikmeli), getEffectiveTier/avatar undefined olmasın diye loading göster.
  if (loading || (firebaseUser && !profile)) {
    return (
      <AppBackground variant="explore" radialGlow>
        <HomeScreenSkeleton />
      </AppBackground>
    );
  }

  // ★ 2026-04-22: "Gerçekten boş" durumu — filtreler ve FAB'ı gizlemek için.
  //   Boşken pill/filtre/FAB üçlüsü kullanıcıya değer katmıyor; unified empty
  //   kartındaki chip'ler zaten hem seçim hem aksiyon rolünü üstleniyor.
  const isFullyEmpty =
    !loadError &&
    filteredRooms.length === 0 &&
    activeFilter === 'all' &&
    advancedFilters.length === 0;

  return (
    <AppBackground variant="explore" radialGlow>
      {/* ★ v270 (14 May 2026): Kullanıcı kozmetik arkaplan — varsa AppBackground üstüne Skia katman */}
      <CosmeticBackground bgItemId={(profile as any)?.active_bg_id} context="home" style={{ flex: 1 }}>
      <View style={s.container}>
        {/* ═══ Premium Header — Glassmorphic topBar + SP Wallet Hero ═══ */}
        <Animated.View style={[s.topBarWrap, { paddingTop: insets.top, transform: [{ translateY: bannerTranslateY }] }]}>
          <LinearGradient
            colors={['rgba(48,65,94,0.92)', 'rgba(26,40,64,0.82)', 'rgba(12,22,40,0.6)']}
            locations={[0, 0.55, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={s.topBarGlass}
            pointerEvents="none"
          />
          <View style={s.topBar}>
            <AnimatedLogo />
            <View style={s.headerRight}>
              <AnimatedHeaderIconBtn index={0} style={s.headerIconBtn} onPress={() => openSearch({
                mode: 'discover',
                onSelectUser: (userId) => openUserProfile(userId),
                onSelectRoom: (roomId) => handleJoinRoom(roomId),
              })} accessibilityLabel={t('common.search')}>
                <Ionicons name="search-outline" size={22} color="#F1F5F9" style={s.headerIcon} />
              </AnimatedHeaderIconBtn>
              <AnimatedHeaderIconBtn staticIcon>
                <NotificationBell unreadCount={unreadCount} onPress={() => {
                  setNotifDrawerAnchorRight(60);
                  setShowNotifDrawer(true);
                }} />
              </AnimatedHeaderIconBtn>
              <AnimatedHeaderIconBtn
                staticIcon
                style={s.headerIconBtn}
                onPress={() => { setShowFriends(true); }}
                accessibilityLabel={pendingFollowCount > 0 ? i18n.t('auto.tabs.home.006', { 0: pendingFollowCount }) : i18n.t('auto.tabs.home.005')}
              >
                <Ionicons name="people-outline" size={22} color="#F1F5F9" style={s.headerIcon} />
                {pendingFollowCount > 0 && (
                  <View style={[s.notifBadge, { backgroundColor: '#60A5FA' }]}>
                    <Text style={s.notifBadgeText}>{pendingFollowCount > 99 ? '99+' : pendingFollowCount}</Text>
                  </View>
                )}
              </AnimatedHeaderIconBtn>
            </View>
          </View>
          <LinearGradient
            colors={['transparent', 'rgba(20,184,166,0.55)', 'rgba(20,184,166,0.55)', 'transparent']}
            locations={[0, 0.25, 0.75, 1]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.topBarSeparator}
          />
        </Animated.View>

        <FlatList
          data={filteredRooms}
          keyExtractor={roomKeyExtractor}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.accentTeal} colors={[Colors.accentTeal]} />
          }
          // ★ 2026-04-21: Virtualization ayarları — dinamik ListHeader yüksekliği
          //   nedeniyle getItemLayout atlandı (yanlış offset riski). Onun yerine
          //   updateCellsBatchingPeriod ve batch/window parametreleriyle scroll perf'i optimize.
          removeClippedSubviews={true}
          maxToRenderPerBatch={6}
          windowSize={7}
          initialNumToRender={5}
          updateCellsBatchingPeriod={50}

          // ═══ Üst bölümler: Hoşgeldin + Popüler + Filtreler + Section Title ═══
          // ★ 2026-04-21: Welcome + Popüler + divider ListHeader'a taşındı —
          //   scroll sınırı artık top bar (logo+ikonlar); diğer her şey rooms ile birlikte kaydırılıyor.
          ListHeaderComponent={
            <>
              {/* ★ v1.7.13.120 (21 May 2026): Carousel'ler (Karşılama Pilotları, Resmi Tema Odaları,
                   Yeni Sopranolular, Öne Çıkan, Günün Cömerti) Keşfet sekmesine taşındı.
                   Ana Sayfa artık SADECE canlı oda listesi + filtreler + Hoşgeldin card. */}
              {/* Hoşgeldin — Glassmorphism konteyner + Zamana göre selamlama
                  ★ v298 (17 May 2026): Welcome card'a "Oda Aç" gradient pill eklendi.
                  Önceki FAB (yuvarlak floating button) kullanıcı tarafından çirkin
                  bulundu, kaldırıldı. Yerine Clubhouse "Start a Room" pattern —
                  bağlamsal gradient pill, profil avatar yanında. */}
              <View style={s.welcomeCard}>
                <View style={s.welcomeRow}>
                  <Pressable onPress={() => router.push('/(tabs)/profile')}>
                    <StatusAvatar uri={profile?.avatar_url} size={32} isOnline={true} tier={profile?.subscription_tier} isSelf frameId={(profile as any)?.active_frame} customBadgeId={(profile as any)?.active_badge_id ?? null} />
                  </Pressable>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.welcomeTitle} numberOfLines={1}>
                      {(() => {
                        const hour = new Date().getHours();
                        const name = profile?.display_name ? `, ${profile.display_name}` : '';
                        if (hour >= 5 && hour < 12) return `${t('home.good_morning')}${name} ☀️`;
                        if (hour >= 12 && hour < 18) return `${t('home.good_afternoon')}${name} 👋`;
                        if (hour >= 18 && hour < 22) return `${t('home.good_evening')}${name} ✨`;
                        return `${t('home.good_night')}${name} 🌙`;
                      })()}
                    </Text>
                    <Text style={s.welcomeSub} numberOfLines={1}>
                      {(() => {
                        const realRooms = rooms.filter(r => !isSystemRoom(r.id));
                        // ★ v1.7.13.100 (20 May 2026): Embedded count tercih edilir (gerçek)
                        const totalListeners = realRooms.reduce((sum, r) => {
                          const embed = (r as any).room_participants;
                          const count = Array.isArray(embed) && embed[0]?.count !== undefined
                            ? Number(embed[0].count)
                            : (r.listener_count || 0);
                          return sum + count;
                        }, 0);
                        if (totalListeners > 0) {
                          return `🔴 ${t('home.live_count', { count: totalListeners })}`;
                        }
                        if (realRooms.length > 0) {
                          return `🎙️ ${t('home.rooms_waiting', { count: realRooms.length })}`;
                        }
                        return t('home.quiet_moment');
                      })()}
                    </Text>
                  </View>
                  {/* ★ v298 (17 May 2026): "Oda Aç" gradient pill — Clubhouse pattern.
                      Eski FAB kaldırıldı (çirkindi), bağlamsal CTA welcome card'a gömüldü.
                      QuickCreateSheet zaten mount edilmiş — sadece tetik bağlandı. */}
                  <Pressable
                    onPress={() => setShowQuickCreate(true)}
                    style={({ pressed }) => [s.welcomeCreatePill, pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] }]}
                    hitSlop={6}
                    accessibilityLabel={t('home.create_room') || 'Oda Aç'}
                  >
                    <LinearGradient
                      colors={['#14B8A6', '#0891B2']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFillObject}
                    />
                    <Ionicons name="add" size={18} color="#FFF" style={s.welcomeCreatePillIcon} />
                    <Text style={s.welcomeCreatePillText}>{t('home.create_room')}</Text>
                  </Pressable>
                </View>
              </View>

              {/* ★ v213f (10 May 2026): Online arkadaş yatay şerit kaldırıldı —
                  keşfette zaten "Çevrimiçi" drawer (sağ üst person ikonu) bu işlevi
                  üstleniyor. Mükerrer satır karmaşa yaratıyordu. */}

              {/* Soprano Lobi kartı kalıcıdır; DB isteği sürerken de fallback ile görünür. */}
              <Pressable
                  onPress={() => router.push(`/room/${LOBI_ROOM_ID}`)}
                  style={({ pressed }) => [s.lobiCard, pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] }]}
                >
                  <LinearGradient
                    colors={['#14B8A6', '#0EA5E9', '#A78BFA']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <View style={s.lobiCardOverlay} />
                  <View style={s.lobiCardLeft}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={s.lobiLiveDot} />
                      <Text style={s.lobiCardLabel}>{i18n.t('home.soprano_lobi')}</Text>
                    </View>
                    <Text style={s.lobiCardTitle}>{i18n.t('home.lobi_subtitle')}</Text>
                    <Text style={s.lobiCardSub}>{i18n.t('home.lobi_listeners', { count: lobiRoom.listener_count || 0 })}</Text>
                  </View>
                  <View style={s.lobiCardJoin}>
                    <Ionicons name="headset" size={22} color="#0F172A" />
                    <Text style={s.lobiCardJoinText}>{i18n.t('rooms.join')}</Text>
                  </View>
              </Pressable>

              {/* ★ v1.7.13.135: Boost edilen profiller Ana Sayfa'ya GERİ döndü.
                   Keşfet askıya alındı; SP harcayıp boost satın alan kullanıcılar
                   görünürlük kaybetmesin diye welcome card altında yatay carousel. */}
              {visibleBoostedProfiles.length > 0 && (
                <View style={s.boostedSection}>
                  <View style={s.boostedHeader}>
                    <Ionicons name="diamond" size={13} color="#FBBF24" />
                    <Text style={s.boostedTitle}>
                      {i18n.t('home.featured_users')}
                    </Text>
                    <View style={s.boostedDot} />
                    <Text style={s.boostedCount}>
                      {visibleBoostedProfiles.length}
                    </Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
                    decelerationRate="fast"
                  >
                    {visibleBoostedProfiles.map((bp) => (
                      <BoostedProfileCard
                        key={bp.id}
                        profile={bp}
                        isOnline={onlineIdSet.has(bp.id)}
                        onPress={(uid) => openUserProfile(uid)}
                        showFollowButton={!!firebaseUser?.uid && bp.id !== firebaseUser.uid}
                        isFollowing={followedUserIds.has(bp.id)}
                        onFollowPress={() => handleHomeFollow(bp.id)}
                      />
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* ★ v1.7.13.49 (20 May 2026): Planlı odalar — sonraki 7 gün, yatay scroll.
                   Boş state inline link kullanıcı isteği ile kaldırıldı (20 May 2026). */}
              {scheduledRooms.length > 0 && (
                <View style={{ marginBottom: 2, marginTop: 8 }}>
                  <View style={s.popularHeader}>
                    <Ionicons name="calendar" size={14} color="#A78BFA" />
                    <Text style={[s.popularTitle, { color: '#A78BFA' }]}>{i18n.t('home.upcoming_rooms')}</Text>
                    <View style={{ flex: 1 }} />
                    <Text style={s.refreshHint}>{i18n.t('home.planned_count', { count: scheduledRooms.length })}</Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 10, gap: 10 }}
                    decelerationRate="fast"
                  >
                    {scheduledRooms.map((sr) => {
                      const schedIso = (sr.room_settings as any)?.scheduled_at as string | undefined;
                      if (!schedIso) return null;
                      const schedDate = new Date(schedIso);
                      const diffMs = schedDate.getTime() - Date.now();
                      const totalMin = Math.max(0, Math.floor(diffMs / 60000));
                      const hr = Math.floor(totalMin / 60);
                      const mn = totalMin % 60;
                      const day = Math.floor(hr / 24);
                      const dateLabel = day >= 1
                        ? schedDate.toLocaleDateString(i18n.locale, { day: 'numeric', month: 'short', weekday: 'short' })
                        : hr >= 1 ? i18n.t('time.hours_minutes', { hr, mn }) : i18n.t('time.minutes_short', { mn });
                      const timeLabel = schedDate.toLocaleTimeString(i18n.locale, { hour: '2-digit', minute: '2-digit' });
                      const hostName = (sr.host as any)?.display_name || i18n.t('common.anonymous');
                      const hostAvatar = (sr.host as any)?.avatar_url;
                      return (
                        <Pressable
                          key={sr.id}
                          style={({ pressed }) => [s.scheduledCard, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
                          onPress={() => router.push(`/room/${sr.id}` as any)}
                        >
                          <LinearGradient
                            colors={['rgba(167,139,250,0.18)', 'rgba(167,139,250,0.06)']}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFillObject}
                          />
                          <View style={s.scheduledTopRow}>
                            <Ionicons name="time-outline" size={11} color="#A78BFA" />
                            <Text style={s.scheduledTime}>{dateLabel}{day < 1 ? i18n.t('time.from_now') : ''}</Text>
                          </View>
                          <Text style={s.scheduledName} numberOfLines={2}>{sr.name}</Text>
                          <View style={s.scheduledHostRow}>
                            {hostAvatar ? (
                              <Image source={getAvatarSource(hostAvatar)} style={s.scheduledHostAvatar} />
                            ) : (
                              <View style={[s.scheduledHostAvatar, { backgroundColor: 'rgba(167,139,250,0.3)', alignItems: 'center', justifyContent: 'center' }]}>
                                <Text style={{ fontSize: 9, fontWeight: '900', color: '#FFF' }}>{(hostName || '?').charAt(0).toUpperCase()}</Text>
                              </View>
                            )}
                            <Text style={s.scheduledHostName} numberOfLines={1}>{hostName}</Text>
                          </View>
                          <Text style={s.scheduledClock}>{timeLabel}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* ═══ Premium Header Ayırıcı ═══ */}
              <View style={s.headerDivider}>
                <LinearGradient
                  colors={['transparent', 'rgba(20,184,166,0.15)', 'rgba(59,130,246,0.12)', 'transparent']}
                  start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                  style={{ height: 1.5 }}
                />
              </View>

              {/* ═══ Birleşik Filtre Satırı: Kategori chips + Filtre butonu
                   ★ 2026-04-22: Ekran "gerçekten boş" ise filtrelemek mantıksız —
                   pill tıklayınca sadece başka bir empty state açılır. Unified empty
                   kartının chip'leri zaten kategori seçimi + oda oluşturmayı tek tapla yapıyor. */}
              {!isFullyEmpty && (
              <View style={s.filterRow}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.categoryBar}
                  style={{ flex: 1 }}
                >
                  {SMART_FILTERS.map((filter) => {
                    const isActive = activeFilter === filter.id;
                    return (
                      <Pressable
                        key={filter.id}
                        style={[
                          s.categoryChip,
                          isActive && {
                            backgroundColor: filter.accent,
                            borderColor: filter.accent,
                            shadowColor: filter.accent,
                            shadowOpacity: 0.4,
                            shadowRadius: 6,
                          },
                        ]}
                        onPress={() => setActiveFilter(isActive && filter.id !== 'all' ? 'all' : filter.id)}
                      >
                        <Ionicons
                          name={filter.icon as any}
                          size={14}
                          color={isActive ? '#FFF' : '#94A3B8'}
                        />
                        <Text style={[s.categoryText, isActive && s.categoryTextActive]} numberOfLines={1}>
                          {t((filter as any).labelKey)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                {/* ★ 2026-04-21: Gizlenen odalar varsa geri getir butonu */}
                {ignoredRoomIds.size > 0 && (
                  <Pressable
                    style={({ pressed }) => [
                      s.filterToggleBtn,
                      { borderColor: 'rgba(148,163,184,0.35)', marginRight: 6 },
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={unignoreAll}
                    hitSlop={8}
                  >
                    <Ionicons name="eye-outline" size={16} color="#94A3B8" />
                    <View style={[s.filterBadge, { backgroundColor: '#64748B' }]}>
                      <Text style={s.filterBadgeText}>{ignoredRoomIds.size}</Text>
                    </View>
                  </Pressable>
                )}
                {/* Filtre butonu */}
                <Pressable
                  style={({ pressed }) => [
                    s.filterToggleBtn,
                    (advancedFilters.length > 0 || showAdvFilterPanel) && s.filterToggleBtnActive,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => setShowAdvFilterPanel(p => !p)}
                >
                  <Ionicons
                    name="options-outline"
                    size={16}
                    color={advancedFilters.length > 0 ? '#5EEAD4' : '#94A3B8'}
                  />
                  {advancedFilters.length > 0 && (
                    <View style={s.filterBadge}>
                      <Text style={s.filterBadgeText}>{advancedFilters.length}</Text>
                    </View>
                  )}
                </Pressable>
              </View>
              )}

              {/* ═══ Gelişmiş Filtre Paneli (açılır/kapanır) ═══ */}
              {!isFullyEmpty && showAdvFilterPanel && (
                <View style={s.advFilterPanel}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 14, gap: 6 }}
                  >
                    {ADVANCED_FILTER_OPTIONS.map((opt) => {
                      const isActive = advancedFilters.includes(opt.id);
                      return (
                        <Pressable
                          key={opt.id}
                          style={[
                            s.advFilterChip,
                            isActive && s.advFilterChipActive,
                          ]}
                          onPress={() => setAdvancedFilters(prev =>
                            prev.includes(opt.id)
                              ? prev.filter(f => f !== opt.id)
                              : [...prev, opt.id]
                          )}
                        >
                          <Ionicons name={opt.icon} size={11} color={isActive ? '#FFF' : '#64748B'} />
                          <Text style={[s.advFilterText, isActive && s.advFilterTextActive]}>{t((opt as any).labelKey)}</Text>
                        </Pressable>
                      );
                    })}
                    {/* Temizle butonu */}
                    {advancedFilters.length > 0 && (
                      <Pressable
                        style={[s.advFilterChip, { borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.08)' }]}
                        onPress={() => { setAdvancedFilters([]); setShowAdvFilterPanel(false); }}
                      >
                        <Ionicons name="close-circle" size={11} color="#EF4444" />
                        <Text style={[s.advFilterText, { color: '#EF4444' }]}>{t('common.clear')}</Text>
                      </Pressable>
                    )}
                  </ScrollView>
                </View>
              )}

              {/* ★ v1.7.13.107 (20 May 2026): "Az önce" timestamp tamamen kaldırıldı
                  (kullanıcı kararı). Carousel + kategori chips + direkt oda listesi —
                  hiç başlık/timestamp ara katmanı yok. Boşluğu kapatmak için chips ↔
                  oda kartları arası dikey marj azaldı. */}
            </>
          }

          // ═══ Oda Kartları — stable callbacks, React.memo korunur ═══
          renderItem={renderRoomItem}

          // ═══ Boş/Hata durumu — Error: retry, Empty: oda aç hero ═══
          // ★ 2026-04-21: Error state empty state'ten ayrıldı; kullanıcı retry butonu görüyor.
          ListEmptyComponent={loadError ? (
            <View style={s.heroEmptyCard}>
              <LinearGradient
                colors={['rgba(239,68,68,0.12)', 'rgba(127,29,29,0.06)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={s.heroEmptyGradient}
              >
                <View style={[s.heroEmptyIconWrap, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                  <Ionicons name="cloud-offline-outline" size={28} color="#EF4444" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.heroEmptyTitle}>{t('home.connection_issue')}</Text>
                  <Text style={s.heroEmptySub}>{loadError}</Text>
                </View>
                <Pressable onPress={() => loadData()} hitSlop={10} style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(239,68,68,0.2)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)' }}>
                  <Text style={{ color: '#FCA5A5', fontWeight: '800', fontSize: 12 }}>{t('common.retry')}</Text>
                </Pressable>
              </LinearGradient>
            </View>
          ) : advancedFilters.length > 0 ? (
            // ═══ Advanced filtre sonucu boş — kısa ve net mesaj ═══
            <View style={s.heroEmptyCard}>
              <LinearGradient
                colors={['rgba(148,163,184,0.10)', 'rgba(100,116,139,0.05)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={s.heroEmptyGradient}
              >
                <View style={s.heroEmptyIconWrap}>
                  <Ionicons name="filter" size={28} color="#94A3B8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.heroEmptyTitle}>{t('home.filter_empty')}</Text>
                  <Text style={s.heroEmptySub}>{i18n.t('tabs.home.001')}</Text>
                </View>
              </LinearGradient>
            </View>
          ) : activeFilter !== 'all' ? (
            // ═══ Kategori seçili + boş → tek tap o kategoride quick-create ═══
            <Pressable
              style={s.heroEmptyCard}
              onPress={() => {
                if (!firebaseUser) { router.push('/create-room'); return; }
                handleQuickCreate(activeFilter);
              }}
              disabled={creatingRoom}
            >
              <LinearGradient
                colors={['rgba(20,184,166,0.15)', 'rgba(13,148,136,0.08)', 'rgba(6,95,86,0.05)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={s.heroEmptyGradient}
              >
                <View style={s.heroEmptyIconWrap}>
                  <Ionicons name="mic" size={32} color="#14B8A6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.heroEmptyTitle}>{t('home.be_first')}</Text>
                  <Text style={s.heroEmptySub}>
                    {t('home.first_in_category', { category: t((SMART_FILTERS.find(f => f.id === activeFilter) as any)?.labelKey || 'category.all') })}
                  </Text>
                </View>
                <Ionicons name="add-circle" size={24} color="rgba(255,255,255,0.8)" />
              </LinearGradient>
            </Pressable>
          ) : (
            // ═══ ★ v298 (17 May 2026): Eski unifiedEmpty kaldırıldı (kullanıcı "vasat").
            //     Yerine premium DiscoverEmptyState: Skia ses dalgası + kişiselleştirilmiş
            //     başlık + 4 fikir kartı. DiscoverWelcomeSheet'in gem hero'su ile çakışmaz
            //     (farklı motif: gem değil, dalga). ═══
            <DiscoverEmptyState
              firebaseUser={firebaseUser}
              onlineFriendsCount={onlineFriends.length}
              ignoredCount={ignoredRoomIds.size}
              creatingRoom={creatingRoom}
              onIdea={handleQuickCreate}
              onDetailedSetup={() => router.push('/create-room')}
              onRestoreHidden={unignoreAll}
              onMessages={() => router.push('/(tabs)/messages' as any)}
              userName={profile?.display_name}
            />
          )}

          // ═══ Footer: Gizlenen odalar (varsa) + Takip Ettiğin Odalar ═══
          ListFooterComponent={
            <>
              {/* ★ v107.13: Gizlenen odalar barı — SADECE liste doluyken (empty state'te zaten içeride pill var, duplicate olmasın) */}
              {ignoredRoomIds.size > 0 && filteredRooms.length > 0 && (
                <Pressable
                  onPress={unignoreAll}
                  style={({ pressed }) => [s.hiddenRoomsBar, pressed && { opacity: 0.7 }]}
                  hitSlop={6}
                >
                  <Ionicons name="eye-outline" size={14} color="#FBBF24" />
                  <Text style={s.hiddenRoomsBarText}>
                    {i18n.t('home.hidden_rooms', { count: ignoredRoomIds.size })}
                  </Text>
                  <Text style={s.hiddenRoomsBarAction}>{t('home.restore_all')}</Text>
                  <Ionicons name="refresh" size={12} color="#FBBF24" />
                </Pressable>
              )}
              {followedRooms.length > 0 ? (
              <View style={{ marginTop: 8 }}>
                <View style={s.followedPanelHeader}>
                  <Ionicons name="bookmark" size={14} color={Colors.accentTeal} />
                  <Text style={s.followedPanelTitle}>{t('home.followed_rooms')}</Text>
                  <Text style={s.followedPanelCount}>{followedRooms.length}</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 8 }}
                  decelerationRate="fast"
                  snapToInterval={FOLLOWED_CARD_W + 10}
                  snapToAlignment="start"
                >
                  {followedRooms.map((room, i) => (
                    <FollowedRoomCard key={room.id} room={room} index={i} />
                  ))}
                </ScrollView>
              </View>
            ) : null}
              {/* Alt boşluk — tab bar'ın altına scroll edemez */}
              <View style={{ height: 120 }} />
            </>
          }
        />

        {/* ★ 2026-04-27: Arama modalı global mount'a taşındı (app/_layout.tsx) — Tab Bar üst katman sorunu çözüldü. */}

        {/* ═══ Arkadaş Listesi — Sağdan Süzülen Drawer ═══ */}
        <FriendsDrawer
          visible={showFriends}
          friends={allFriends}
          onClose={() => setShowFriends(false)}
          onSelect={(userId) => { setShowFriends(false); openUserProfile(userId); }}
          currentUserId={firebaseUser?.uid}
        />

        {/* ★ 2026-05-09: View cover — content alanını kaplar. Tab bar gizleme useEffect ile. */}
        {(showWelcome !== false || !roomHintReady || showRoomHint) && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: -100, backgroundColor: '#0A0F1A', zIndex: 9998 }} />
        )}

        {/* ═══ Welcome Sheet — İlk kez keşfet ekranını açanlar için ═══ */}
        <DiscoverWelcomeSheet
          visible={!!showWelcome}
          uid={firebaseUser?.uid}
          onClose={() => {
            // ★ 2026-05-09 FLASH FIX: setShowWelcome(false) ile AYNI tick'te roomHintReady=false
            //   → cover şartı kesintisiz aktif kalır, Keşfet flash etmez.
            setRoomHintReady(false);
            setShowWelcome(false);
          }}
        />

        {/* ★ 2026-04-29: First-time "Oda oluştur!" yönlendirmesi — gem hexagon + CTA */}
        <RoomCreateHintSheet
          visible={showRoomHint}
          onGoToMyRooms={() => {
            // ★ 2026-05-09 FLASH FIX: ÖNCE coachmark flag + route push (myrooms tab aktif olur,
            //   modal hâlâ üstte). SONRA modal'ı geç kapat → modal kapandığında arka tab artık
            //   myrooms, dolayısıyla Keşfet asla bir frame bile görünmez.
            markCreateRoomCoachmarkPending(firebaseUser?.uid).catch(() => {});
            markRoomCreateHintSeen(firebaseUser?.uid).catch(() => {});
            // ★ Tab bar'ı navigate'ten ÖNCE göster — home tab freezeOnBlur ile donar,
            //   sonraki setShowRoomHint(false) gecikir, tab bar geri gelmez.
            setTabBarCovered(false);
            router.push('/(tabs)/myrooms' as any);
            setTimeout(() => setShowRoomHint(false), 450);
          }}
          onClose={() => {
            // Skip → kullanıcı şimdi değil dedi ama sonra Odalarım'a kendi giderse
            //   "+ Yeni Oda" butonunu işaret eden oku göster — yardım etmeye devam et.
            setShowRoomHint(false);
            markRoomCreateHintSeen(firebaseUser?.uid).catch(() => {});
            markCreateRoomCoachmarkPending(firebaseUser?.uid).catch(() => {});
          }}
        />


        {/* ═══ Quick Create Sheet — FAB'dan açılır, 2 seçenekli (Hızlı / Detaylı)
             ★ 2026-04-23: bottomOffset=BAR_BOTTOM_OFFSET (84) — panel CurvedTabBar'ın üstünde kalır.
             ★ 2026-04-26: 3. seçenek "Planla" kaldırıldı — Detaylı Ayarla'nın son adımında zaten Hemen/Sonra toggle var. */}
        <QuickCreateSheet
          visible={showQuickCreate}
          onClose={() => setShowQuickCreate(false)}
          onQuickCreate={() => handleQuickCreate()}
          onDetailedCreate={() => router.push('/create-room')}
          bottomInset={insets.bottom}
          bottomOffset={BAR_BOTTOM_OFFSET}
        />

        {/* ★ v1.7.13.52 (20 May 2026): "Sen de Öne Çık" CTA — store'a yönlendirmek yerine
             BoostPickerSheet'i direkt açar. SP yeterse 2 tap'ta boost; yetmezse
             sheet "Yetersiz SP" gösterir. */}
        <BoostPickerSheet
          visible={showBoostPicker}
          onClose={() => setShowBoostPicker(false)}
          currentSP={Number((profile as any)?.system_points ?? 0)}
          onBoost={async (tier: BoostTier) => {
            if (!profile?.id) return;
            try {
              await ProfileService.boostProfile(profile.id, tier.cost, tier.duration);
              await refreshProfile();
              showToast({ title: i18n.t('boost.activated_title'), message: i18n.t('boost.activated_msg', { duration: tier.duration }), type: 'success' });
            } catch (err: any) {
              showToast({ title: i18n.t('boost.error_title'), message: err.message || i18n.t('boost.error_msg'), type: 'error' });
              throw err;
            }
          }}
        />

        {/* ═══ Oda Bildirme Modal — swipe'dan tetiklenir ═══ */}
        {reportRoom && firebaseUser && (
          <ReportModal
            visible={!!reportRoom}
            onClose={() => setReportRoom(null)}
            reporterId={firebaseUser.uid}
            target={{ type: 'room', id: reportRoom.id }}
          />
        )}

        {/* ★ 2026-04-21: Scroll fade-out — reusable component (tüm tab sayfalarında kullanılıyor) */}
        <TabBarFadeOut />


      </View>
      </CosmeticBackground>
    </AppBackground>
  );
}

// FAB'nin alt tab bar'dan uzaklığı (tab bar yaklaşık 60+16 padding)
const BAR_BOTTOM_OFFSET = 84;

// ════════════════════════════════════════════════════════════
// STİLLER
// ════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },



  // ★ Premium Header — Glassmorphic wrap + SP pill + teal hairline separator
  topBarWrap: {
    position: 'relative',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 8,
  },
  topBarGlass: {
    ...StyleSheet.absoluteFillObject,
  },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingBottom: 4,
  },
  topBarSeparator: {
    height: 1.5,
    width: '100%',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },

  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerIconBtn: {
    width: 44, height: 44,
    justifyContent: 'center', alignItems: 'center', overflow: 'visible',
  },
  headerIcon: {
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },

  notifBadge: { position: 'absolute', top: -2, right: -2, backgroundColor: '#EF4444', minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: Colors.bg },
  notifBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFF' },

  // Welcome — Glassmorphism konteyner
  // ★ v1.7.13.81 (20 May 2026): Kompakt welcome — avatar 42→32, padding 8→5,
  //   title 15→13, sub 11→10. Toplam yükseklik ~58 → ~42 (%28 ↓).
  welcomeCard: {
    marginHorizontal: 14, marginTop: 0, marginBottom: 4,
    borderRadius: 12, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  welcomeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 11, paddingVertical: 5,
  },

  welcomeTitle: { fontSize: 13, fontWeight: '700', color: '#F1F5F9', ...Shadows.text },
  welcomeSub: { fontSize: 10, color: '#94A3B8', marginTop: 1, ...Shadows.textLight },
  // ★ v298 (17 May 2026): "Oda Aç" gradient pill — welcome card sağında (Clubhouse pattern)
  // ★ v1.7.13.81 (20 May 2026): Pill kompakt — padding 11/7 → 9/5, fontSize 12 → 11
  welcomeCreatePill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.45)',
    gap: 3,
    shadowColor: '#14B8A6',
    shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  // ★ v1.7.13.140: Soprano Lobi kart stilleri
  lobiCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 18,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16, paddingHorizontal: 16,
    minHeight: 88,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#14B8A6',
    shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  lobiCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  lobiCardLeft: { flex: 1, gap: 3 },
  lobiCardLabel: {
    fontSize: 10, fontWeight: '900', letterSpacing: 1.4,
    color: 'rgba(255,255,255,0.85)',
  },
  lobiCardTitle: {
    fontSize: 16, fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  lobiCardSub: {
    fontSize: 11, fontWeight: '600',
    color: 'rgba(255,255,255,0.88)',
    marginTop: 2,
  },
  lobiCardJoin: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFFFFF',
    paddingVertical: 9, paddingHorizontal: 14,
    borderRadius: 999,
  },
  lobiCardJoinText: {
    fontSize: 13, fontWeight: '800',
    color: '#0F172A',
  },
  lobiLiveDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#22C55E',
    shadowColor: '#22C55E', shadowOpacity: 0.8, shadowRadius: 4,
  },
  welcomeCreatePillIcon: {
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  welcomeCreatePillText: {
    fontSize: 11, fontWeight: '800', color: '#FFF',
    letterSpacing: 0.3,
    ...Shadows.text,
  },




  // ═══ Gelişmiş Filtre Chips ═══
  advFilterChip: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  advFilterChipActive: {
    backgroundColor: 'rgba(20,184,166,0.15)',
    borderColor: 'rgba(20,184,166,0.4)',
  },
  advFilterText: { fontSize: 10, fontWeight: '600' as const, color: '#64748B' },
  advFilterTextActive: { color: '#5EEAD4' },

  // ═══ Filtre Satırı (Kategori + Filtre Butonu) ═══
  filterRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  filterToggleBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center' as const, justifyContent: 'center' as const,
    marginRight: 12,
    position: 'relative' as const,
  },
  filterToggleBtnActive: {
    backgroundColor: 'rgba(20,184,166,0.1)',
    borderColor: 'rgba(20,184,166,0.3)',
  },
  filterBadge: {
    position: 'absolute' as const, top: -4, right: -4,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#14B8A6',
    alignItems: 'center' as const, justifyContent: 'center' as const,
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: '#0F172A',
  },
  filterBadgeText: { fontSize: 9, fontWeight: '800' as const, color: '#FFF' },
  advFilterPanel: {
    paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
    marginBottom: 2,
  },

  // ═══ Birleşik Akıllı Filtre ═══
  categoryBar: { paddingHorizontal: 14, paddingVertical: 8, gap: 8 },
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 2 },

  categoryText: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
  categoryTextActive: { color: '#FFF' },

  // ═══ Öne Çıkan Profiller — Premium 3D ═══
  // (Stiller BoostedProfileCard bileşeninde inline tanımlı)



  // ═══ Kompakt Canlı Oda Kartı — İyileştirilmiş ═══
  // ★ 2026-04-21 (güncel): marginHorizontal SwipeToHideRow'a taşındı.
  //   Swipe açılınca card'ın sağ margin alanı actions panel'i örtüyordu → Bildir daralıyordu.
  // ★ v1.7.13.107 (20 May 2026): Kart aşağıdaki boşluk azaltıldı 14→8
  bigCardWrapper: {
    marginBottom: 8,
  },
  bigCard: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 14,
    ...Shadows.card,
  },
  bigCategoryIconWrap: {
    position: 'absolute',
    top: -4,
    right: -4,
  },
  bigTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  bigTopLeft: {
    flexDirection: 'row',
    gap: 5,
  },
  bigTopRight: {
    flexDirection: 'row',
    gap: 5,
  },
  bigTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  bigTagText: { fontSize: 8, fontWeight: '600', color: '#94A3B8' },
  bigLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239,68,68,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  // ★ v1.7.13.49 (20 May 2026): Kalan süre countdown pill — bigLiveBadge yanında.
  bigCountdownPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(148,163,184,0.20)',
  },
  bigCountdownPillUrgent: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(252,165,165,0.40)',
  },
  bigCountdownText: {
    fontSize: 9, fontWeight: '700',
    color: 'rgba(148,163,184,0.85)',
    letterSpacing: 0.2,
  },
  bigLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF' },
  bigLiveText: { fontSize: 9, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  bigEmptyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(251,191,36,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)',
  },
  bigEmptyText: { fontSize: 9, fontWeight: '700', color: '#FBBF24', letterSpacing: 0.3 },
  // ★ 2026-04-21: Audio preview badge — gradient zemin + derin siyah gölge.
  //   Wrap (outer) sadece shadow için; inner gradient + content.
  previewBadgeWrap: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    left: 0, right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
    shadowColor: '#000',
    shadowOpacity: 0.7,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 14,
  },
  previewBadgeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  previewBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#CBD5E1',
    letterSpacing: 0.4,
  },
  // ★ 2026-04-21: Avatar stack — oda kartında katılımcılar üst üste (Clubhouse tarzı)
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
  },
  stackAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#0F1929',
    overflow: 'hidden',
  },
  stackMore: {
    backgroundColor: 'rgba(20,184,166,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: 'rgba(20,184,166,0.4)',
  },
  stackMoreText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#5EEAD4',
    letterSpacing: 0.2,
  },

  bigTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  bigBadgeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  bigCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F1F5F9',
    flex: 1,
    ...Shadows.text,
  },
  bigInlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(245,158,11,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    marginLeft: 6,
  },
  bigInlineBadgeText: {
    fontSize: 8,
    fontWeight: '700',
  },
  // ★ v1.7.13.83 (20 May 2026): Label'sız ikonik mini badge — title row kompakt
  bigInlineBadgeIcon: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)',
    marginLeft: 6,
  },
  bigHostStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  bigHostName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    flexShrink: 1,
  },

  bigStatText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    marginLeft: 1,
    marginRight: 3,
  },

  // ★ 2026-05-22: Clubhouse-style card layout
  chCardBody: {
    flexDirection: 'row' as const,
    paddingHorizontal: 14,
    paddingTop: 4,
    gap: 10,
  },
  chLeftCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center' as const,
  },
  chHostRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: 8,
  },
  chAvatarGrid: {
    width: 90,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  chGridInner: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    width: 84,
    gap: 3,
    justifyContent: 'flex-end' as const,
  },
  chGridAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden' as const,
    borderWidth: 2,
    borderColor: 'rgba(15,25,38,0.8)',
    backgroundColor: '#1E293B',
  },
  chGridAvatarImg: {
    width: '100%' as any,
    height: '100%' as any,
  },
  chGridMore: {
    backgroundColor: 'rgba(20,184,166,0.15)',
    borderColor: 'rgba(20,184,166,0.3)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  chGridMoreText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: '#14B8A6',
  },
  chEmptyGrid: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 2,
  },
  chEmptyCount: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: 'rgba(148,163,184,0.5)',
  },
  chBottomBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 4,
    gap: 8,
  },

  bigJoinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 11,
    marginLeft: 4,
    borderWidth: 0.8,
    borderColor: 'rgba(255,255,255,0.22)',
    // ★ v1.3.69: Skia ile cross-platform teal glow (dış SkiaShadow wrap)
  },
  bigJoinText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.3,
  },

  // ═══ Section ═══
  // ═══ Popüler Başlık ═══
  popularHeader: {
    flexDirection: 'row' as const, alignItems: 'baseline' as const, gap: 5,
    paddingHorizontal: 18, paddingTop: 4, paddingBottom: 6,
  },
  // ★ v1.7.13.109 (20 May 2026): popularTitle daha profesyonel — fontWeight 800,
  //   letterSpacing 0.5, color slate-200 (daha okunaklı). popularSub silindi (dead).
  popularTitle: {
    fontSize: 13, fontWeight: '800' as const, color: '#E2E8F0',
    letterSpacing: 0.5,
  },
  // ═══ Header Gradient Ayırıcı ═══
  headerDivider: {
    marginTop: 4,
    marginBottom: 2,
    shadowColor: 'rgba(0,0,0,0.5)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },

  // ★ v1.7.13.49 (20 May 2026): "Güncellendi: X dk önce" — sade gri yazı.
  refreshHint: {
    fontSize: 10, fontWeight: '600' as const,
    color: 'rgba(148,163,184,0.65)',
    letterSpacing: 0.2,
  },
  // ★ v1.7.13.49 (20 May 2026): Planlı odalar card stilleri — mor temalı, kompakt.
  scheduledCard: {
    width: 150, minHeight: 100, borderRadius: 14,
    backgroundColor: 'rgba(15,23,42,0.5)',
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.30)',
    overflow: 'hidden',
    padding: 10,
    position: 'relative',
  },
  scheduledTopRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  scheduledTime: {
    fontSize: 10, fontWeight: '800',
    color: '#A78BFA', letterSpacing: 0.3,
  },
  scheduledName: {
    fontSize: 12, fontWeight: '800',
    color: '#F1F5F9', marginTop: 6,
    lineHeight: 15,
  },
  scheduledHostRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 5, marginTop: 8,
  },
  scheduledHostAvatar: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.40)',
  },
  scheduledHostName: {
    fontSize: 10, fontWeight: '600',
    color: 'rgba(241,245,249,0.75)', flex: 1,
  },
  scheduledClock: {
    position: 'absolute', top: 8, right: 10,
    fontSize: 10, fontWeight: '900',
    color: 'rgba(167,139,250,0.95)', letterSpacing: 0.5,
  },


  // ═══ Hero Empty State — RandomRoomButton DNA ═══
  heroEmptyCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.25)',
    backgroundColor: 'rgba(10,18,30,0.6)',
  },
  heroEmptyGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 22,
    paddingHorizontal: 18,
    gap: 14,
  },
  heroEmptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(20,184,166,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.25)',
  },
  heroEmptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F1F5F9',
  },
  heroEmptySub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 3,
    lineHeight: 17,
  },




  // ═══ Takip Edilen Oda — Premium Horizontal Card ═══
  fCard: {
    width: FOLLOWED_CARD_W,
    height: 120,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.15)',
    padding: 10,
    justifyContent: 'space-between',
    ...Shadows.card,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fShimmer: {
    position: 'absolute',
    top: 0, bottom: 0,
    width: 40,
    backgroundColor: 'transparent',
    borderRadius: 14,
    opacity: 0.3,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.12)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.06)',
  },
  fTopRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 5,
  },
  fLiveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(239,68,68,0.9)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  fLiveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#FFF' },
  fLiveText: { fontSize: 9, fontWeight: '800', color: '#FFF', letterSpacing: 0.3 },
  fEmptyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(148,163,184,0.15)',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(148,163,184,0.2)',
  },
  fEmptyText: { fontSize: 9, fontWeight: '700', color: '#94A3B8' },
  fSleepBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(245,158,11,0.12)',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)',
  },
  fSleepText: { fontSize: 9, fontWeight: '700', color: '#F59E0B' },
  fBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  fBottomLeft: {
    flex: 1,
    marginRight: 8,
  },
  fRoomName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F1F5F9',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  fHostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  fHostName: {
    fontSize: 10, fontWeight: '600', color: '#FFFFFF',
    maxWidth: 80,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  fListenerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 6,
    marginLeft: 4,
  },
  fListenerText: {
    fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.6)',
  },
  // ★ Faz 4.3 — Tag chip strip on room card
  fTagRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 5,
  },
  fTagChip: {
    paddingHorizontal: 6, paddingVertical: 1.5,
    borderRadius: 6,
    backgroundColor: 'rgba(20,184,166,0.18)',
    borderWidth: 0.5, borderColor: 'rgba(20,184,166,0.35)',
  },
  fTagText: {
    fontSize: 9, fontWeight: '700', color: '#5EEAD4',
    letterSpacing: 0.2,
  },
  fCatIconWrap: {
    opacity: 0.4,
  },
  fPremiumBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(212,175,55,0.15)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)',
    marginLeft: 'auto',
  },
  fPremiumText: { fontSize: 7, fontWeight: '800', color: Colors.premiumGold },

  // ★ 2026-05-22: Arkadaşın Burada badge — BigLiveRoomCard
  friendBadge: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingHorizontal: 14, marginTop: 2 },
  friendDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
  friendBadgeText: { fontSize: 10, fontWeight: '700' as const, color: '#22C55E', ...Shadows.text },

  // ═══ Takip Edilen Odalar Panel Header ═══
  followedPanelHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, marginBottom: 8,
  },
  followedPanelTitle: {
    fontSize: 14, fontWeight: '800', color: '#E2E8F0', flex: 1,
    ...Shadows.text,
  },
  followedPanelCount: {
    fontSize: 11, fontWeight: '800', color: Colors.accentTeal,
    backgroundColor: 'rgba(20,184,166,0.1)',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
  },



  hiddenRoomsBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 14,
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.15)',
  },
  hiddenRoomsBarText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#FDE68A',
  },
  hiddenRoomsBarAction: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FBBF24',
  },
  boostedSection: {
    marginTop: 10,
    marginBottom: 4,
  },
  boostedHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  boostedTitle: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '900' as const,
    letterSpacing: 0.7,
  },
  boostedDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FBBF24',
    marginLeft: 4,
  },
  boostedCount: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '800' as const,
    marginLeft: 4,
  },
});
