import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Image, Pressable,
  ActivityIndicator, ScrollView, RefreshControl, Dimensions, Animated, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, Shadows } from '../../constants/theme';
import { RoomService, type Room } from '../../services/database';
import { RoomFollowService } from '../../services/roomFollow';
import { ProfileService } from '../../services/profile';
import { supabase } from '../../constants/supabase';
import { useAuth, useTheme, useBadges, useOnlineFriends } from '../_layout';
import { getAvatarSource } from '../../constants/avatars';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { UserSearchModal } from '../../components/UserSearchModal';
import FriendsDrawer from '../../components/FriendsDrawer';
import AppBackground from '../../components/AppBackground';

import { showToast } from '../../components/Toast';
import { isSystemRoom } from '../../services/showcaseRooms';



// ════════════════════════════════════════════════════════════
// BİRLEŞİK AKILLI FİLTRE (Kategori + Etiket → Tek Bar)
// ════════════════════════════════════════════════════════════
const SMART_FILTERS = [
  { id: 'all',       label: 'Tümü',      icon: 'apps',             type: 'category' as const, accent: '#14B8A6' },
  { id: 'chat',      label: 'Sohbet',    icon: 'chatbubbles',      type: 'category' as const, accent: '#3B82F6' },
  { id: 'music',     label: 'Müzik',     icon: 'musical-notes',    type: 'category' as const, accent: '#8B5CF6' },
  { id: 'game',      label: 'Oyun',      icon: 'game-controller',  type: 'category' as const, accent: '#EF4444' },
  { id: 'tech',      label: 'Teknoloji', icon: 'code-slash',       type: 'category' as const, accent: '#06B6D4' },
  { id: 'book',      label: 'Kitap',     icon: 'book',             type: 'category' as const, accent: '#D97706' },
  { id: 'film',      label: 'Film',      icon: 'film',             type: 'category' as const, accent: '#EC4899' },
] as const;

// ════════════════════════════════════════════════════════════
// RASTGELE ODA BUTONU — Hero
// ════════════════════════════════════════════════════════════


// ════════════════════════════════════════════════════════════
// TAKİP EDİLEN ODA KARTI — Premium Horizontal Scroll
// ════════════════════════════════════════════════════════════

// Oda teması → gradient mapping (create-room ile senkron)
const ROOM_THEME_GRADIENTS: Record<string, [string, string]> = {
  ocean:   ['#0E4D6F', '#083344'],
  sunset:  ['#7F1D1D', '#4C0519'],
  forest:  ['#14532D', '#052E16'],
  galaxy:  ['#312E81', '#1E1B4B'],
  aurora:  ['#134E4A', '#042F2E'],
  cherry:  ['#831843', '#500724'],
  cyber:   ['#1E3A8A', '#172554'],
  volcano: ['#7C2D12', '#431407'],
};

const { width: SCREEN_W } = Dimensions.get('window');
const FOLLOWED_CARD_W = SCREEN_W * 0.44;

function FollowedRoomCard({ room, index }: { room: Room; index: number }) {
  const router = useRouter();
  const shimmerAnim = React.useRef(new Animated.Value(-1)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 2400 + index * 300,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    ).start();
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

  return (
    <Pressable
      style={({ pressed }) => [
        s.fCard,
        isPremiumOwner && { borderColor: Colors.premiumGold, borderWidth: 1.5 },
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
            <Text style={s.fLiveText}>CANLI · {room.listener_count}</Text>
          </View>
        ) : isEmpty ? (
          <View style={s.fEmptyBadge}>
            <Ionicons name="radio-outline" size={9} color="#94A3B8" />
            <Text style={s.fEmptyText}>Boş</Text>
          </View>
        ) : isSleeping ? (
          <View style={s.fSleepBadge}>
            <Ionicons name="moon" size={9} color="#F59E0B" />
            <Text style={s.fSleepText}>Uyuyor</Text>
          </View>
        ) : null}
        {isPremiumOwner && (
          <View style={s.fPremiumBadge}>
            <Ionicons name="trophy" size={8} color={Colors.premiumGold} />
            <Text style={s.fPremiumText}>Premium</Text>
          </View>
        )}
      </View>

      {/* Asimetrik alt bölge — avatar + isim + dinleyici */}
      <View style={s.fBottom}>
        <View style={s.fBottomLeft}>
          <Text style={s.fRoomName} numberOfLines={2}>{room.name}</Text>
          <View style={s.fHostRow}>
            <Image source={getAvatarSource(room.host?.avatar_url)} style={s.fHostAvatar} />
            <Text style={s.fHostName} numberOfLines={1}>{room.host?.display_name || 'Anonim'}</Text>
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

// Kategori bazlı gradient renkleri + ikon
const CATEGORY_THEME: Record<string, { colors: [string, string, string]; icon: string }> = {
  chat:  { colors: ['#1E3A5F', '#0F2744', '#0A1929'], icon: 'chatbubbles' },
  music: { colors: ['#3B1F5E', '#2D1648', '#1A0D2E'], icon: 'musical-notes' },
  game:  { colors: ['#4A1525', '#3A0F1E', '#260A14'], icon: 'game-controller' },
  tech:  { colors: ['#0F2E4A', '#0A2038', '#061525'], icon: 'code-slash' },
  book:  { colors: ['#3D2E10', '#2E2108', '#1F1605'], icon: 'book' },
  film:  { colors: ['#3B1042', '#2D0C34', '#1F0824'], icon: 'film' },
  other: { colors: ['#1E293B', '#151E2E', '#0F172A'], icon: 'ellipsis-horizontal' },
};


function BigLiveRoomCard({ room, onJoin, isFollowed, onToggleFollow }: { room: Room; onJoin: () => void; isFollowed?: boolean; onToggleFollow?: () => void }) {
  const isPersistent = (room as any).is_persistent;
  const hostName = room.host?.display_name || 'Anonim';
  const listenerCount = room.listener_count || 0;
  const isSystem = room.id.startsWith('system_');
  const theme = CATEGORY_THEME[room.category] || CATEGORY_THEME.other;

  // Oda temasını kontrol et (oda sahibinin seçtiği tema)
  const roomThemeId = (room.room_settings as any)?.theme_id;
  const roomThemeGrad = roomThemeId && ROOM_THEME_GRADIENTS[roomThemeId]
    ? ROOM_THEME_GRADIENTS[roomThemeId]
    : null;

  const isBoosted = (room as any).boost_expires_at && new Date((room as any).boost_expires_at) > new Date();

  return (
    <Pressable
      style={({ pressed }) => [
        s.bigCard,
        isSystem && { borderColor: '#14B8A6', borderWidth: 1.5 },
        isPersistent && { borderColor: Colors.premiumGold, borderWidth: 1.5 },
        pressed && { opacity: 0.95, transform: [{ scale: 0.985 }] },
      ]}
      onPress={onJoin}
    >
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
          <Ionicons name={theme.icon as any} size={48} color="rgba(255,255,255,0.06)" />
        </View>
      )}

      {/* === Üst Bar: Sol — CANLI / Boş, Sağ — Premium/Resmi/Boost === */}
      <View style={s.bigTopRow}>
        {/* Sol: Canlı / Boş badge */}
        <View style={s.bigTopLeft}>
          {room.is_live && listenerCount > 0 ? (
            <View style={s.bigLiveBadge}>
              <View style={s.bigLiveDot} />
              <Text style={s.bigLiveText}>CANLI</Text>
            </View>
          ) : room.is_live && listenerCount === 0 ? (
            <View style={s.bigEmptyBadge}>
              <Ionicons name="moon-outline" size={9} color="#94A3B8" />
              <Text style={s.bigEmptyText}>Boş Oda</Text>
            </View>
          ) : null}
        </View>

        {/* Sağ: Premium / Resmi / Boost */}
        <View style={s.bigTopRight}>
          {isPersistent && (
            <View style={s.bigPremiumBadge}>
              <Ionicons name="trophy" size={9} color={Colors.premiumGold} />
              <Text style={s.bigPremiumText}>Premium</Text>
            </View>
          )}
          {isSystem && (
            <View style={[s.bigTagBadge, { backgroundColor: 'rgba(20,184,166,0.15)', borderColor: 'rgba(20,184,166,0.3)' }]}>
              <Ionicons name="shield-checkmark" size={9} color="#14B8A6" />
              <Text style={[s.bigTagText, { color: '#14B8A6' }]}>Resmi</Text>
            </View>
          )}
          {isBoosted && (
            <View style={[s.bigTagBadge, { backgroundColor: 'rgba(251,146,60,0.15)', borderColor: 'rgba(251,146,60,0.3)' }]}>
              <Ionicons name="flame" size={9} color="#FB923C" />
              <Text style={[s.bigTagText, { color: '#FB923C' }]}>Boost</Text>
            </View>
          )}
        </View>
      </View>

      {/* === Başlık + Küçük İnline Rozetler === */}
      <View style={s.bigTitleRow}>
        <Text style={s.bigCardTitle} numberOfLines={1}>{room.name}</Text>
        {/* Oda Tipi badge'leri */}
        {room.type === 'closed' && (
          <View style={s.bigInlineBadge}>
            <Ionicons name="lock-closed" size={8} color="#F59E0B" />
            <Text style={[s.bigInlineBadgeText, { color: '#F59E0B' }]}>Şifreli</Text>
          </View>
        )}
        {room.type === 'invite' && (
          <View style={[s.bigInlineBadge, { backgroundColor: 'rgba(139,92,246,0.12)', borderColor: 'rgba(139,92,246,0.25)' }]}>
            <Ionicons name="mail" size={8} color="#8B5CF6" />
            <Text style={[s.bigInlineBadgeText, { color: '#8B5CF6' }]}>Davetli</Text>
          </View>
        )}
        {/* Giriş ücreti (SP) badge */}
        {(room.room_settings as any)?.entry_fee_sp > 0 && (
          <View style={[s.bigInlineBadge, { backgroundColor: 'rgba(212,175,55,0.12)', borderColor: 'rgba(212,175,55,0.25)' }]}>
            <Ionicons name="cash" size={8} color="#D4AF37" />
            <Text style={[s.bigInlineBadgeText, { color: '#D4AF37' }]}>{(room.room_settings as any).entry_fee_sp} SP</Text>
          </View>
        )}
        {/* Mevcut rozetler */}
        {(room.room_settings as any)?.is_locked && (
          <Ionicons name="lock-closed" size={11} color="#F59E0B" style={{ marginLeft: 4 }} />
        )}
        {(room.room_settings as any)?.followers_only && (
          <Ionicons name="people" size={11} color="#A78BFA" style={{ marginLeft: 4 }} />
        )}
        {(room.room_settings as any)?.age_restricted && (
          <Text style={{ fontSize: 10, marginLeft: 4 }}>🔞</Text>
        )}
        {/* Bağış açık ikonu */}
        {(room.room_settings as any)?.donations_enabled && (
          <Ionicons name="heart" size={10} color="#EF4444" style={{ marginLeft: 4 }} />
        )}
        {/* Konuşma modu ikonu */}
        {(room.room_settings as any)?.speaking_mode === 'free_for_all' && (
          <Ionicons name="chatbubbles" size={10} color="rgba(255,255,255,0.25)" style={{ marginLeft: 4 }} />
        )}
        {(room.room_settings as any)?.speaking_mode === 'selected_only' && (
          <Ionicons name="shield-checkmark" size={10} color="rgba(255,255,255,0.25)" style={{ marginLeft: 4 }} />
        )}
      </View>

      {/* === Host + Stats + Katıl — tek satır === */}
      <View style={s.bigHostStatsRow}>
        <Image source={getAvatarSource(room.host?.avatar_url)} style={s.bigHostAvatar} />
        <Text style={s.bigHostName} numberOfLines={1}>{hostName}</Text>
        <View style={s.bigStatDivider} />
        <Ionicons name="people" size={11} color="#64748B" />
        <Text style={s.bigStatText}>{listenerCount}</Text>
        <Ionicons name="mic" size={11} color="#64748B" />
        <Text style={s.bigStatText}>{room.max_speakers || 4}</Text>
        {onToggleFollow && (
          <Pressable onPress={(e) => { e.stopPropagation(); onToggleFollow(); }} hitSlop={8} style={{ marginLeft: 'auto', padding: 2 }}>
            <Ionicons name={isFollowed ? 'bookmark' : 'bookmark-outline'} size={14} color={isFollowed ? '#14B8A6' : '#64748B'} />
          </Pressable>
        )}
        <Pressable onPress={onJoin} style={{ marginLeft: onToggleFollow ? 6 : 'auto' }}>
          <LinearGradient
            colors={['#14B8A6', '#0D9488', '#065F56']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={s.bigJoinBtn}
          >
            <Ionicons name="headset" size={13} color="#FFF" />
            <Text style={s.bigJoinText}>Katıl</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </Pressable>
  );
}

// ════════════════════════════════════════════════════════════
// ANA EKRAN — KEŞFET (SopranoChat v2)
// ════════════════════════════════════════════════════════════
export default function HomeScreen() {
  const router = useRouter();
  const { firebaseUser, profile, setShowNotifDrawer } = useAuth();
  const insets = useSafeAreaInsets();
  const { unreadNotifs: unreadCount, pendingFollows: pendingFollowCount, refreshBadges } = useBadges();
  useTheme();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [filteredRooms, setFilteredRooms] = useState<Room[]>([]);
  const [followedRooms, setFollowedRooms] = useState<Room[]>([]);
  const [boostedProfiles, setBoostedProfiles] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const [activeFilter, setActiveFilter] = useState('all');
  const [followedRoomIds, setFollowedRoomIds] = useState<Record<string, boolean>>({});
  const [showFriends, setShowFriends] = useState(false);

  // ★ DUP-3 FIX: Online friends artık merkezî provider'dan geliyor
  const { allFriends } = useOnlineFriends();


  const loadData = useCallback(async () => {
    try {
      const liveRooms = await RoomService.getLive(firebaseUser?.uid);

      setRooms(liveRooms);
      setFilteredRooms(liveRooms);

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

      // Öne Çıkan Profiller (herkes görebilir)
      try {
        const bp = await ProfileService.getBoostedProfiles(8);
        setBoostedProfiles(bp);
      } catch {}
    } catch (err) {
      if (__DEV__) console.warn('[Home] Load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [firebaseUser]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // ★ Periyodik: Free tier boş/süresi dolmuş odaları otomatik kapat
  // Plus+ odalar muaf — host manuel yönetir (dondur/kapat/sil)
  useEffect(() => {
    const cleanup = async () => {
      try {
        const count = await RoomService.autoCloseExpired();
        if (count > 0) {
          if (__DEV__) console.log(`[Home] AutoClose: ${count} Free oda kapatıldı`);
          loadData();
        }
      } catch {}
    };
    cleanup();
    const interval = setInterval(cleanup, 120000);
    return () => clearInterval(interval);
  }, [loadData]);

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
          const newRoom = payload.new as any;
          if (newRoom.is_live) loadData(); // Sadece canlı odaları yükle
        } else if (payload.eventType === 'DELETE') {
          // ★ BUG-K5 FIX: RLS aktifse payload.old boş obje olabilir — fallback loadData
          const deletedId = (payload.old as any)?.id;
          if (deletedId) {
            setRooms(prev => prev.filter(r => r.id !== deletedId));
          } else {
            loadData(); // ID yoksa tam yeniden yükle
          }
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as any;
          // is_live false olduysa listeden çıkar
          if (updated.is_live === false) {
            setRooms(prev => prev.filter(r => r.id !== updated.id));
          } else {
            // BUG-H1 FIX: host bilgisini koru — payload.new'da JOIN verisi yok
            setRooms(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated, host: r.host } : r));
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  // ★ DUP-3 FIX: Online friends Realtime subscription artık
  // providers/OnlineFriendsProvider.tsx'de merkezileştirildi.
  // Bu sayfadaki yerel friends-online-status kanalı kaldırıldı.
  // Tüm veri useOnlineFriends() hook'undan geliyor.

  useEffect(() => {
    if (activeFilter === 'all') {
      // ★ Gelişmiş Keşfet Algoritması — çok katmanlı sıralama
      const userInterests = (profile as any)?.interests || (profile as any)?.metadata?.interests || [];
      // ★ BUG-K6 FIX: onlineFriends yerine allFriends kullanılmalı — offline arkadaşın canlı odası da bonus almalı
      const followingIds = new Set(allFriends.map(f => f.id));
      const now = new Date().toISOString();

      const scored = [...rooms].map(room => {
        let score = 0;
        const isSystem = room.id.startsWith('system_');
        if (isSystem) return { room, score: 9999 }; // Sistem odaları her zaman üstte

        // Katman 1: Oda boost aktifse +100
        if ((room as any).boost_expires_at && (room as any).boost_expires_at > now) {
          score += 100 + ((room as any).boost_score || 0);
        }
        // Katman 1.5: Host profil boost aktifse +75 (profil öne çıkarma → odaları da öne çıkar)
        const hostBoost = (room.host as any)?.profile_boost_expires_at;
        if (hostBoost && hostBoost > now) {
          score += 75;
        }
        // Katman 2: Takip edilen kişinin odası +50
        if (followingIds.has(room.host_id)) score += 50;
        // Katman 3: İlgi alanı eşleşmesi +20
        if (userInterests.length > 0 && userInterests.includes(room.category)) score += 20;
        // Katman 4: Dinleyici sayısı (normalleştirilmiş)
        score += Math.min((room.listener_count || 0) * 2, 40);
        // Katman 5: Yeni odalar hafif bonus (+5 ilk 30dk)
        const ageMs = Date.now() - new Date(room.created_at).getTime();
        if (ageMs < 30 * 60 * 1000) score += 5;

        return { room, score };
      });

      scored.sort((a, b) => b.score - a.score);
      setFilteredRooms(scored.map(s => s.room));
      return;
    }
    setFilteredRooms(rooms.filter(r => r.category === activeFilter));
  }, [activeFilter, rooms, allFriends, profile]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleJoinRoom = (roomId: string) => {
    if (!firebaseUser) {
      showToast({ title: 'Giriş Gerekli', message: 'Odaya katılmak için giriş yapmalısınız.', type: 'warning' });
      return;
    }
    // ★ Kategori tercihi kaydet (keşfet algoritması için)
    const room = rooms.find(r => r.id === roomId);
    if (room?.category) {
      RoomService.trackCategoryVisit(firebaseUser.uid, room.category).catch(() => {});
    }
    router.push(`/room/${roomId}`);
  };

  if (loading) {
    return (
      <AppBackground variant="explore">
        <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color={Colors.accentTeal} />
        </View>
      </AppBackground>
    );
  }

  return (
    <AppBackground variant="explore">
    <View style={s.container}>
      {/* ═══ Üst Bar: Logo (sol) + İkonlar (sağ) ═══ */}
      <View style={[s.topBar, { paddingTop: insets.top + 4 }]}>
        <Image source={require('../../assets/logo.png')} style={s.logo} resizeMode="contain" />
        <View style={s.headerRight}>
          <Pressable style={s.headerIconBtn} onPress={() => setShowSearch(true)}>
            <Ionicons name="search-outline" size={20} color="#F1F5F9" />
          </Pressable>
          <Pressable style={s.headerIconBtn} onPress={() => setShowNotifDrawer(true)}>
            <Ionicons name="notifications-outline" size={20} color="#F1F5F9" />
            {unreadCount > 0 && (
              <View style={s.notifBadge}>
                <Text style={s.notifBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </Pressable>
          <Pressable style={s.headerIconBtn} onPress={() => { setShowFriends(true); }}>
            <Ionicons name="people-outline" size={20} color="#F1F5F9" />
            {pendingFollowCount > 0 && (
              <View style={[s.notifBadge, { backgroundColor: '#60A5FA' }]}>
                <Text style={s.notifBadgeText}>{pendingFollowCount > 99 ? '99+' : pendingFollowCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Hoşgeldin — Avatar + İsim satırı */}
      <View style={s.welcomeRow}>
        <Pressable onPress={() => router.push('/(tabs)/profile')}>
          <Image source={getAvatarSource(profile?.avatar_url)} style={s.headerAvatar} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.welcomeTitle}>Merhaba{profile?.display_name ? `, ${profile.display_name}` : ''} 👋</Text>
          <Text style={s.welcomeSub}>
            {(() => {
              const realRooms = rooms.filter(r => !isSystemRoom(r.id));
              // ★ BUG-7 FIX: Sadece gerçek odaların dinleyicilerini say
              const totalListeners = realRooms.reduce((sum, r) => sum + (r.listener_count || 0), 0);
              if (realRooms.length > 0) {
                return `🔴 ${realRooms.length} oda canlı · ${totalListeners} kişi aktif`;
              }
              return `🎙️ ${rooms.length} oda keşfedilmeyi bekliyor`;
            })()}
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.accentTeal} colors={[Colors.accentTeal]} />
        }
      >

        {/* ═══ Birleşik Akıllı Filtre ═══ */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.categoryBar}
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
                    elevation: 5,
                  },
                ]}
                onPress={() => setActiveFilter(isActive && filter.id !== 'all' ? 'all' : filter.id)}
              >
                <Ionicons
                  name={filter.icon as any}
                  size={14}
                  color={isActive ? '#FFF' : '#94A3B8'}
                />
                <Text style={[s.categoryText, isActive && s.categoryTextActive]}>
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ═══ Öne Çıkan Profiller ═══ */}
        {boostedProfiles.length > 0 && (
          <View style={{ marginBottom: 4 }}>
            <Text style={s.sectionTitle}>
              <Ionicons name="rocket" size={16} color="#F472B6" />
              {'  Öne Çıkan Profiller'}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
            >
              {boostedProfiles.map((bp) => (
                <Pressable
                  key={bp.id}
                  style={({ pressed }) => [
                    s.boostCard,
                    pressed && { opacity: 0.9, transform: [{ scale: 0.96 }] },
                  ]}
                  onPress={() => router.push(`/user/${bp.id}` as any)}
                >
                  <Image source={getAvatarSource(bp.avatar_url)} style={s.boostAvatar} />
                  <Text style={s.boostName} numberOfLines={1}>{bp.display_name || 'Kullanıcı'}</Text>
                  {bp.is_online && <View style={s.boostOnline} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ═══ Şu An Canlı — Büyük Kartlar ═══ */}
        <Text style={s.sectionTitle}>
          <Ionicons name="radio" size={16} color="#EF4444" />
          {'  '}
          {activeFilter === 'all'
            ? 'Şu An Canlı'
            : `${SMART_FILTERS.find(f => f.id === activeFilter)?.label || ''} Odaları`}
        </Text>

        {filteredRooms.length > 0 ? (
          filteredRooms.map((room) => (
            <BigLiveRoomCard
              key={room.id}
              room={room}
              onJoin={() => handleJoinRoom(room.id)}
              isFollowed={!!followedRoomIds[room.id]}
              onToggleFollow={firebaseUser ? async () => {
                const isNow = !!followedRoomIds[room.id];
                try {
                  if (isNow) {
                    setFollowedRoomIds(prev => { const n = { ...prev }; delete n[room.id]; return n; });
                    await RoomFollowService.unfollow(room.id, firebaseUser.uid);
                  } else {
                    setFollowedRoomIds(prev => ({ ...prev, [room.id]: true }));
                    await RoomFollowService.follow(room.id, firebaseUser.uid);
                  }
                } catch {
                  if (isNow) {
                    setFollowedRoomIds(prev => ({ ...prev, [room.id]: true }));
                  } else {
                    setFollowedRoomIds(prev => { const n = { ...prev }; delete n[room.id]; return n; });
                  }
                  showToast({ title: 'İşlem başarısız', type: 'error' });
                }
              } : undefined}
            />
          ))
        ) : (
          <Pressable
            style={s.heroEmptyCard}
            onPress={() => router.push('/create-room')}
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
                <Text style={s.heroEmptyTitle}>
                  {activeFilter === 'all' 
                    ? '✨ Sahne Seni Bekliyor'
                    : 'Bu Kategoride İlk Ol'}
                </Text>
                <Text style={s.heroEmptySub}>
                  {activeFilter === 'all'
                    ? 'Günün ilk locasını kur ve sahnede yerini al. Herkes seni dinlesin!'
                    : `İlk ${SMART_FILTERS.find(f => f.id === activeFilter)?.label || ''} odasını açarak öncü ol!`}
                </Text>
              </View>
              <Ionicons name="add-circle" size={24} color="rgba(255,255,255,0.8)" />
            </LinearGradient>
          </Pressable>
        )}

        {/* ═══ Takip Ettiğin Odalar — Canlı odaların altında, doğal akışta ═══ */}
        {followedRooms.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <View style={s.followedPanelHeader}>
              <Ionicons name="bookmark" size={14} color={Colors.accentTeal} />
              <Text style={s.followedPanelTitle}>Takip Ettiğin Odalar</Text>
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
        )}

      </ScrollView>

      {/* ═══ Arama Modalı ═══ */}
      {firebaseUser && (
        <UserSearchModal
          visible={showSearch}
          onClose={() => setShowSearch(false)}
          currentUserId={firebaseUser.uid}
          mode="discover"
          onSelectUser={(userId) => {
            setShowSearch(false);
            router.push(`/user/${userId}` as any);
          }}
          onSelectRoom={(roomId) => {
            setShowSearch(false);
            handleJoinRoom(roomId);
          }}
        />
      )}

      {/* ═══ Arkadaş Listesi — Sağdan Süzülen Drawer ═══ */}
      <FriendsDrawer
        visible={showFriends}
        friends={allFriends}
        onClose={() => setShowFriends(false)}
        onSelect={(userId) => { setShowFriends(false); router.push(`/user/${userId}` as any); }}
        currentUserId={firebaseUser?.uid}
      />
    </View>
    </AppBackground>
  );
}

// ════════════════════════════════════════════════════════════
// STİLLER
// ════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },

  // Top Bar — Logo (sol) + İkonlar (sağ)
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingBottom: 2,
  },
  logo: { height: 32, width: 150 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerIconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center', overflow: 'visible', ...Shadows.icon },
  notifBadge: { position: 'absolute', top: -2, right: -2, backgroundColor: '#EF4444', minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: Colors.bg },
  notifBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFF' },

  // Welcome — Avatar + İsim satırı
  welcomeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 8,
  },
  headerAvatar: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 2, borderColor: 'rgba(20,184,166,0.4)',
  },
  welcomeTitle: { fontSize: 15, fontWeight: '700', color: '#F1F5F9', ...Shadows.text },
  welcomeSub: { fontSize: 11, color: '#94A3B8', marginTop: 2, ...Shadows.textLight },


  // ═══ Son Girdiğin Odalar ═══
  recentCard: {
    width: 80,
    alignItems: 'center',
    marginRight: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 14,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...Shadows.card,
  },
  recentAvatar: { width: 44, height: 44, borderRadius: 22, marginBottom: 6 },
  recentName: { fontSize: 10, fontWeight: '700', color: '#F1F5F9', textAlign: 'center', ...Shadows.text },
  recentHost: { fontSize: 9, color: '#94A3B8', textAlign: 'center', marginTop: 1 },

  // ═══ Birleşik Akıllı Filtre ═══
  categoryBar: { paddingHorizontal: 14, paddingVertical: 8, gap: 8 },
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 3 },
  categoryChipActive: { /* artık dinamik inline stil kullanılıyor */ },
  categoryText: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
  categoryTextActive: { color: '#FFF' },

  // ═══ Öne Çıkan Profiller ═══
  boostCard: {
    alignItems: 'center',
    width: 72, paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(244,114,182,0.06)',
    borderWidth: 1, borderColor: 'rgba(244,114,182,0.15)',
    shadowColor: '#F472B6', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 3,
  },
  boostAvatar: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 2, borderColor: 'rgba(244,114,182,0.4)',
    marginBottom: 4,
  },
  boostName: {
    fontSize: 9, fontWeight: '700', color: '#E2E8F0',
    textAlign: 'center', maxWidth: 64,
  },
  boostOnline: {
    position: 'absolute', top: 6, right: 12,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#22C55E',
    borderWidth: 2, borderColor: 'rgba(10,18,30,0.9)',
  },



  // ═══ Kompakt Canlı Oda Kartı ═══
  bigCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
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
  bigLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF' },
  bigLiveText: { fontSize: 9, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  bigEmptyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(148,163,184,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
  },
  bigEmptyText: { fontSize: 9, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.3 },
  bigPremiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.premiumGold,
  },
  bigPremiumText: { fontSize: 8, fontWeight: '700', color: Colors.premiumGold },
  bigTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
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
  bigHostStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  bigHostAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(115,194,189,0.4)',
  },
  bigHostName: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.accentTeal,
    maxWidth: 90,
  },
  bigStatDivider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 3,
  },
  bigStatText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    marginLeft: 1,
    marginRight: 4,
  },
  bigJoinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  bigJoinText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },

  // ═══ Section ═══
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#F1F5F9', letterSpacing: 0.2, paddingHorizontal: 16, marginTop: 20, marginBottom: 12, ...Shadows.text },


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
  fHostAvatar: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
  },
  fHostName: {
    fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.7)',
    maxWidth: 80,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
});

