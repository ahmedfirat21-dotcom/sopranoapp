import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Image, Pressable, Dimensions,
  ActivityIndicator, ScrollView, RefreshControl, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, Shadows } from '../../constants/theme';
import { RoomService, type Room } from '../../services/database';
import { FriendshipService, type FollowUser } from '../../services/friendship';

import { RoomHistoryService, type RoomHistoryItem } from '../../services/roomHistory';
import { supabase } from '../../constants/supabase';
import { useAuth, useTheme } from '../_layout';
import { getAvatarSource } from '../../constants/avatars';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NotificationDrawer from '../../components/NotificationDrawer';
import { UserSearchModal } from '../../components/UserSearchModal';
import AppBackground from '../../components/AppBackground';

import { showToast } from '../../components/Toast';
import { getSystemRooms, isSystemRoom } from '../../services/showcaseRooms';

const { width: W } = Dimensions.get('window');

// ════════════════════════════════════════════════════════════
// BİRLEŞİK AKILLI FİLTRE (Kategori + Etiket → Tek Bar)
// ════════════════════════════════════════════════════════════
const SMART_FILTERS = [
  { id: 'all',       label: 'Tümü',      icon: 'apps',             type: 'category' as const },
  { id: 'chat',      label: 'Sohbet',    icon: 'chatbubbles',      type: 'category' as const },
  { id: 'music',     label: 'Müzik',     icon: 'musical-notes',    type: 'category' as const },
  { id: 'game',      label: 'Oyun',      icon: 'game-controller',  type: 'category' as const },
  { id: 'tech',      label: 'Teknoloji', icon: 'code-slash',       type: 'category' as const },
  { id: 'book',      label: 'Kitap',     icon: 'book',             type: 'category' as const },
  { id: 'film',      label: 'Film',      icon: 'film',             type: 'category' as const },
] as const;

// ════════════════════════════════════════════════════════════
// RASTGELE ODA BUTONU — Hero
// ════════════════════════════════════════════════════════════


// ════════════════════════════════════════════════════════════
// SON GİRDİĞİN ODALAR — Kısayol Kartı
// ════════════════════════════════════════════════════════════
function RecentRoomCard({ item, onPress }: { item: RoomHistoryItem; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [s.recentCard, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
      onPress={onPress}
    >
      <Image source={getAvatarSource(item.hostAvatar)} style={s.recentAvatar} />
      <Text style={s.recentName} numberOfLines={1}>{item.name}</Text>
      <Text style={s.recentHost} numberOfLines={1}>{item.hostName}</Text>
    </Pressable>
  );
}

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

function BigLiveRoomCard({ room, onJoin }: { room: Room; onJoin: () => void }) {
  const isPersistent = (room as any).is_persistent;
  const hostName = room.host?.display_name || 'Anonim';
  const listenerCount = room.listener_count || 0;
  const isSystem = room.id.startsWith('system_');
  const theme = CATEGORY_THEME[room.category] || CATEGORY_THEME.other;
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
      <LinearGradient
        colors={theme.colors}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Büyük soluk kategori ikonu — sağ üst köşe */}
      <View style={s.bigCategoryIconWrap}>
        <Ionicons name={theme.icon as any} size={72} color="rgba(255,255,255,0.06)" />
      </View>

      {/* === Üst Bar: Badges === */}
      <View style={s.bigBadgeRow}>
        {room.is_live && (
          <View style={s.bigLiveBadge}>
            <View style={s.bigLiveDot} />
            <Text style={s.bigLiveText}>CANLI</Text>
          </View>
        )}
        {isSystem && (
          <View style={[s.bigShowcaseBadge, { backgroundColor: 'rgba(20,184,166,0.15)', borderColor: 'rgba(20,184,166,0.3)' }]}>
            <Ionicons name="shield-checkmark" size={10} color="#14B8A6" />
            <Text style={[s.bigShowcaseText, { color: '#14B8A6' }]}>Resmi</Text>
          </View>
        )}

        {isPersistent && (
          <View style={s.bigPremiumBadge}>
            <Ionicons name="trophy" size={10} color={Colors.premiumGold} />
            <Text style={s.bigPremiumText}>Premium</Text>
          </View>
        )}
        {isBoosted && (
          <View style={[s.bigShowcaseBadge, { backgroundColor: 'rgba(251,146,60,0.15)', borderColor: 'rgba(251,146,60,0.3)' }]}>
            <Ionicons name="flame" size={10} color="#FB923C" />
            <Text style={[s.bigShowcaseText, { color: '#FB923C' }]}>Boost</Text>
          </View>
        )}
      </View>

      {/* === Başlık === */}
      <Text style={s.bigCardTitle} numberOfLines={2}>{room.name}</Text>

      {/* === Host + Stats satırı === */}
      <View style={s.bigHostStatsRow}>
        <Image source={getAvatarSource(room.host?.avatar_url)} style={s.bigHostAvatar} />
        <Text style={s.bigHostName} numberOfLines={1}>{hostName}</Text>
        <View style={s.bigStatDivider} />
        <Ionicons name="people" size={12} color="#64748B" />
        <Text style={s.bigStatText}>{listenerCount}</Text>
        <Ionicons name="mic" size={12} color="#64748B" />
        <Text style={s.bigStatText}>{room.max_speakers || 4}</Text>
      </View>

      {/* === Alt: Tags + Katıl Butonu === */}
      <View style={s.bigBottomRow}>
        {(room as any).tags && (room as any).tags.length > 0 && (
          <View style={s.bigTagRow}>
            {((room as any).tags as string[]).slice(0, 3).map((tag: string) => (
              <View key={tag} style={s.bigTagChip}>
                <Text style={s.bigTagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        )}
        <Pressable onPress={onJoin} style={{ marginLeft: 'auto' }}>
          <LinearGradient
            colors={['#14B8A6', '#0D9488', '#065F56']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={s.bigJoinBtn}
          >
            <Ionicons name="headset" size={14} color="#FFF" />
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
  const { firebaseUser, profile } = useAuth();
  const insets = useSafeAreaInsets();
  useTheme();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [filteredRooms, setFilteredRooms] = useState<Room[]>([]);
  const [recentRooms, setRecentRooms] = useState<RoomHistoryItem[]>([]);
  const [onlineFriends, setOnlineFriends] = useState<FollowUser[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState('all');

  const loadData = useCallback(async () => {
    try {
      const liveRooms = await RoomService.getLive(firebaseUser?.uid);
      const history = await RoomHistoryService.getRecent(6);

      // Sistem odaları her zaman üstte + kullanıcı odaları altında
      const systemRooms = getSystemRooms();
      const userRooms = liveRooms.filter(r => !r.id.startsWith('system_'));
      const allRooms = [...systemRooms, ...userRooms];

      setRooms(allRooms);
      setRecentRooms(history);
      setFilteredRooms(allRooms);

      if (firebaseUser) {
        const following = await FriendshipService.getFollowing(firebaseUser.uid);

        const onl = following.filter((f: FollowUser) => f.is_online);
        setOnlineFriends(onl);

        const { count } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', firebaseUser.uid)
          .eq('is_read', false);
        setUnreadCount(count || 0);
      }
    } catch (err) {
      if (__DEV__) console.warn('[Home] Load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [firebaseUser]);

  useEffect(() => { loadData(); }, [loadData]);
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  useEffect(() => {
    if (activeFilter === 'all') {
      // ★ Gelişmiş Keşfet Algoritması — çok katmanlı sıralama
      const userInterests = (profile as any)?.interests || (profile as any)?.metadata?.interests || [];
      const followingIds = new Set(onlineFriends.map(f => f.id));
      const now = new Date().toISOString();

      const scored = [...rooms].map(room => {
        let score = 0;
        const isSystem = room.id.startsWith('system_');
        if (isSystem) return { room, score: 9999 }; // Sistem odaları her zaman üstte

        // Katman 1: Boost aktifse +100
        if ((room as any).boost_expires_at && (room as any).boost_expires_at > now) {
          score += 100 + ((room as any).boost_score || 0);
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
  }, [activeFilter, rooms, onlineFriends, profile]);

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
      {/* ═══ Üst Bar ═══ */}
      <View style={[s.topBar, { paddingTop: insets.top + 4 }]}>
        <Image source={require('../../assets/logo.png')} style={s.logo} resizeMode="contain" />
        <View style={s.headerRight}>
          <Pressable style={s.headerIconBtn} onPress={() => setShowSearch(true)}>
            <Ionicons name="search-outline" size={20} color="#F1F5F9" />
          </Pressable>
          <Pressable style={s.headerIconBtn} onPress={() => setShowNotif(!showNotif)}>
            <Ionicons name="notifications-outline" size={20} color="#F1F5F9" />
            {unreadCount > 0 && (
              <View style={s.notifBadge}>
                <Text style={s.notifBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </Pressable>
          <Pressable style={s.headerIconBtn} onPress={() => router.push('/create-room')}>
            <Ionicons name="add-circle-outline" size={20} color="#F1F5F9" />
          </Pressable>
        </View>
      </View>

      {showNotif && firebaseUser && (
        <NotificationDrawer
          userId={firebaseUser.uid}
          visible={showNotif}
          onClose={() => setShowNotif(false)}
          anchorTop={insets.top + 52}
        />
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.accentTeal} colors={[Colors.accentTeal]} />
        }
      >
        {/* ═══ Hoşgeldin + Avatar ═══ */}
        <View style={s.welcomeRow}>
          <Pressable onPress={() => router.push('/(tabs)/profile')}>
            <Image source={getAvatarSource(profile?.avatar_url)} style={s.avatar} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.welcomeTitle}>Merhaba{profile?.display_name ? `, ${profile.display_name}` : ''} 👋</Text>
            <Text style={s.welcomeSub}>
              {(() => {
                const realRooms = rooms.filter(r => !isSystemRoom(r.id));
                const totalListeners = rooms.reduce((sum, r) => sum + (r.listener_count || 0), 0);
                if (realRooms.length > 0) {
                  return `🔴 ${realRooms.length} oda canlı · ${totalListeners} kişi aktif`;
                }
                return `🎙️ ${rooms.length} oda keşfedilmeyi bekliyor`;
              })()}
            </Text>
          </View>
        </View>


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
                style={[s.categoryChip, isActive && s.categoryChipActive]}
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
            />
          ))
        ) : (
          /* ═══ Premium Boş Durum CTA ═══ */
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

        {/* ═══ Son Girdiğin Odalar ═══ */}
        {recentRooms.length > 0 && (
          <>
            <Text style={s.sectionTitle}>
              <Ionicons name="time-outline" size={16} color={Colors.accentTeal} />
              {'  Son Girdiğin Odalar'}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16 }}
              style={{ marginBottom: 4 }}
            >
              {recentRooms.map((item) => (
                <RecentRoomCard
                  key={item.id}
                  item={item}
                  onPress={() => handleJoinRoom(item.id)}
                />
              ))}
            </ScrollView>
          </>
        )}

        {/* ═══ Online Arkadaşlar ═══ */}
        {onlineFriends.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Online Arkadaşların</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.friendStrip}
            >
              {onlineFriends.map((friend) => (
                <Pressable
                  key={friend.id}
                  style={s.friendChip}
                  onPress={() => router.push(`/user/${friend.id}` as any)}
                >
                  <View style={s.friendAvatarWrap}>
                    <Image source={getAvatarSource(friend.avatar_url)} style={s.friendAvatar} />
                    <View style={s.onlineDot} />
                  </View>
                  <Text style={s.friendName} numberOfLines={1}>{friend.display_name?.split(' ')[0] || 'Kullanıcı'}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}




      </ScrollView>

      {/* ═══ Arama Modalı ═══ */}
      {firebaseUser && (
        <UserSearchModal
          visible={showSearch}
          onClose={() => setShowSearch(false)}
          currentUserId={firebaseUser.uid}
          onSelectUser={(userId) => {
            setShowSearch(false);
            router.push(`/user/${userId}` as any);
          }}
        />
      )}
    </View>
    </AppBackground>
  );
}

// ════════════════════════════════════════════════════════════
// STİLLER
// ════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },

  // Top Bar
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 6 },
  logo: { height: 32, width: 150 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerIconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center', overflow: 'visible', ...Shadows.icon },
  notifBadge: { position: 'absolute', top: -2, right: -2, backgroundColor: '#EF4444', minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: Colors.bg },
  notifBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFF' },

  // Welcome
  welcomeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: 'rgba(115,194,189,0.35)' },
  welcomeTitle: { fontSize: 16, fontWeight: '700', color: '#F1F5F9', ...Shadows.text },
  welcomeSub: { fontSize: 11, color: '#94A3B8', marginTop: 1, ...Shadows.textLight },


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
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  categoryChipActive: { backgroundColor: Colors.accentTeal, borderColor: Colors.accentTeal },
  categoryText: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
  categoryTextActive: { color: '#FFF' },

  // ═══ Online Arkadaşlar ═══
  friendStrip: { paddingHorizontal: 14, paddingVertical: 6, gap: 14 },
  friendChip: { alignItems: 'center', width: 56 },
  friendAvatarWrap: { position: 'relative' },
  friendAvatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: 'rgba(115,194,189,0.3)' },
  onlineDot: { position: 'absolute', bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: '#4ADE80', borderWidth: 2, borderColor: '#2f404f' },
  friendName: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 4, textAlign: 'center', ...Shadows.textLight },

  // ═══ Büyük Canlı Oda Kartı ═══
  bigCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 16,
    ...Shadows.card,
  },
  bigCategoryIconWrap: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  bigBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  bigShowcaseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  bigShowcaseText: { fontSize: 9, fontWeight: '600', color: '#94A3B8' },
  bigLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(239,68,68,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  bigLiveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFF' },
  bigLiveText: { fontSize: 10, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  bigPremiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.premiumGold,
  },
  bigPremiumText: { fontSize: 9, fontWeight: '700', color: Colors.premiumGold },
  bigCardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F1F5F9',
    marginBottom: 10,
    ...Shadows.text,
  },
  bigHostStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  bigHostAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(115,194,189,0.4)',
  },
  bigHostName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.accentTeal,
    maxWidth: 100,
  },
  bigStatDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 4,
  },
  bigStatText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginLeft: 2,
    marginRight: 6,
  },
  bigBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bigTagRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    flex: 1,
  },
  bigTagChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(20,184,166,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.2)',
  },
  bigTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.accentTeal,
  },
  bigJoinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  bigJoinText: {
    fontSize: 13,
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
});
