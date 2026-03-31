import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image,
  ActivityIndicator, Share, TextInput, Dimensions, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Colors, Gradients, Radius, Spacing } from '../../constants/theme';
import { RoomService, ProfileService, type Room, type Profile } from '../../services/database';
import { ReferralService } from '../../services/referral';
import EmptyState from '../../components/EmptyState';
import { useAuth } from '../_layout';
import { showToast } from '../../components/Toast';
import { getAvatarSource } from '../../constants/avatars';

const { width } = Dimensions.get('window');

const CATEGORIES = [
  { id: 'all', icon: 'flame', label: 'Tümü', color: '#EC4899' },
  { id: 'chat', icon: 'mic', label: 'Sohbet', color: Colors.teal },
  { id: 'music', icon: 'musical-notes', label: 'Müzik', color: Colors.sapphire },
  { id: 'game', icon: 'game-controller', label: 'Oyun', color: Colors.emerald },
  { id: 'book', icon: 'book', label: 'Kitap', color: Colors.ice },
  { id: 'film', icon: 'film', label: 'Film', color: Colors.gold },
  { id: 'tech', icon: 'code-slash', label: 'Teknoloji', color: Colors.steel },
];

const CATEGORY_COLOR: Record<string, string> = {
  chat: Colors.teal,
  music: Colors.sapphire,
  game: Colors.emerald,
  book: Colors.ice,
  film: Colors.gold,
  tech: Colors.steel,
};

const CATEGORY_LABEL: Record<string, string> = {
  chat: 'Sohbet',
  music: 'Müzik',
  game: 'Oyun',
  book: 'Kitap',
  film: 'Film',
  tech: 'Teknoloji',
};

// ========== MASONRY ROOM CARD ==========
const MasonryRoomCard = React.memo(function MasonryRoomCard({ room }: { room: Room }) {
  const router = useRouter();
  const color = CATEGORY_COLOR[room.category] || '#00BFFF';
  const catLabel = CATEGORY_LABEL[room.category] || '';
  const isBoosted = (room as any).boost_expires_at && new Date((room as any).boost_expires_at) > new Date();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.roomCard,
        isBoosted && { borderColor: 'rgba(251,191,36,0.4)' },
        pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
      ]}
      onPress={() => router.push(`/room/${room.id}`)}
    >
      {/* Glass glow */}
      <LinearGradient
        colors={[`${color}30`, 'transparent']}
        style={styles.roomGlow}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.02)', 'transparent']}
        style={styles.cardShine}
      />

      {/* Üst: İzleyici + Kategori + Badge */}
      <View style={styles.cardTop}>
        <View style={styles.viewerPill}>
          <Text style={styles.viewerText}>👁️ {room.listener_count || 0}</Text>
        </View>
        <View style={styles.cardTopRight}>
          {catLabel ? (
            <View style={[styles.categoryPill, { backgroundColor: `${color}20` }]}>
              <Text style={[styles.categoryPillText, { color }]}>{catLabel}</Text>
            </View>
          ) : null}
          {room.is_live && (
            <View style={[styles.cardBadge, styles.liveBadge]}>
              <View style={styles.liveDotSmall} />
              <Text style={styles.liveTextSmall}>CANLI</Text>
            </View>
          )}
          {isBoosted && !room.is_live && (
            <View style={[styles.cardBadge, { backgroundColor: 'rgba(251,191,36,0.2)' }]}>
              <Text style={{ fontSize: 10 }}>🔥</Text>
            </View>
          )}
        </View>
      </View>

      {/* Orta: Host Avatar + Halkalar */}
      <View style={styles.centerAvatar}>
        <View style={[styles.ripple, { borderColor: color, opacity: 0.25, transform: [{ scale: 1.4 }] }]} />
        <View style={[styles.ripple, { borderColor: color, opacity: 0.12, transform: [{ scale: 1.7 }] }]} />
        <Image source={getAvatarSource(room.host?.avatar_url)} style={styles.roomAvatar} />
      </View>

      {/* Alt: Başlık + Host */}
      <View style={styles.cardBottom}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {room.type === 'closed' && <Ionicons name="lock-closed" size={12} color="#F59E0B" />}
          {room.type === 'invite' && <Ionicons name="mail" size={12} color="#A78BFA" />}
          <Text style={styles.roomTitle} numberOfLines={1}>{room.name}</Text>
        </View>
        <Text style={styles.roomHostName}>{room.host?.display_name || 'Anonim'}</Text>
      </View>
    </Pressable>
  );
});

// ========== PERSON CARD ==========
const PersonCard = React.memo(function PersonCard({ person }: { person: Profile }) {
  const router = useRouter();
  return (
    <Pressable
      style={({ pressed }) => [styles.personCard, pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] }]}
      onPress={() => router.push(`/user/${person.id}` as any)}
    >
      <Image source={getAvatarSource(person.avatar_url)} style={styles.personAvatar} />
      {person.is_online && <View style={styles.onlineDot} />}
      <Text style={styles.personName} numberOfLines={1}>{person.display_name}</Text>
      <Text style={styles.personTier}>{person.tier || 'Silver'}</Text>
    </Pressable>
  );
});

// ========== DISCOVER SCREEN ==========
export default function DiscoverScreen() {
  const router = useRouter();
  const { firebaseUser } = useAuth();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsLoadingMore, setRoomsLoadingMore] = useState(false);
  const [roomsHasMore, setRoomsHasMore] = useState(true);

  const [people, setPeople] = useState<Profile[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchedPeople, setSearchedPeople] = useState<Profile[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const roomsRef = useRef(rooms);
  roomsRef.current = rooms;

  const loadRooms = useCallback(async (isLoadMore = false) => {
    try {
      if (isLoadMore) setRoomsLoadingMore(true);
      else setRoomsLoading(true);

      const currentRooms = isLoadMore ? roomsRef.current : [];
      const offset = currentRooms.length;
      let roomData: Room[] = [];

      if (selectedCategory && selectedCategory !== 'all') {
        roomData = await RoomService.getByCategory(selectedCategory, 20, offset);
      } else {
        roomData = await RoomService.getLive(20, offset);
      }

      setRoomsHasMore(roomData.length >= 20);
      setRooms(isLoadMore ? [...currentRooms, ...roomData] : roomData);
    } catch (err) {
      console.warn('Odalar yüklenemedi:', err);
    } finally {
      setRoomsLoading(false);
      setRoomsLoadingMore(false);
    }
  }, [selectedCategory]);

  const loadPeople = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      setPeopleLoading(true);
      const recommended = await ProfileService.getRecommended(firebaseUser.uid, 15, 0);
      setPeople(recommended);
    } catch (err) {
      console.warn('Kişiler yüklenemedi:', err);
    } finally {
      setPeopleLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => { loadRooms(false); }, [selectedCategory]);
  useEffect(() => { if (firebaseUser) loadPeople(); }, [firebaseUser]);

  // Kullanıcı araması — debounce
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchedPeople([]);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      const results = await ProfileService.search(searchQuery, 10);
      setSearchedPeople(results);
    }, 400);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadRooms(false), loadPeople()]);
    setRefreshing(false);
  }, [loadRooms, loadPeople]);

  const handleInvite = async () => {
    if (!firebaseUser) return;
    try {
      const myCode = await ReferralService.getMyCode(firebaseUser.uid);
      await Share.share({
        message: `🎙️ SopranoChat'e katıl! Sesini duyur, gerçek bağlantılar kur.\n\nBe Heard, Be Real ✨\n\nDavet Kodum: ${myCode}\n\nhttps://sopranochat.app/invite`,
        title: 'SopranoChat\'e Katıl!',
      });
    } catch (err: any) {
      showToast({ title: 'Paylaşma iptal edildi', type: 'info' });
    }
  };

  const handleLoadMoreRooms = () => {
    if (!roomsLoadingMore && roomsHasMore && rooms.length > 0) loadRooms(true);
  };

  const filteredRooms = searchQuery
    ? rooms.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : rooms;

  // Masonry — sol ve sağ sütun
  const leftCol = filteredRooms.filter((_, i) => i % 2 === 0);
  const rightCol = filteredRooms.filter((_, i) => i % 2 !== 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Keşfet</Text>
        <Pressable style={styles.searchBtn} onPress={() => setShowSearch(!showSearch)}>
          <Ionicons name={showSearch ? 'close' : 'search'} size={20} color={Colors.text2} />
        </Pressable>
      </View>

      {/* Arama Barı */}
      {showSearch && (
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={Colors.text3} />
          <TextInput
            style={styles.searchInput}
            placeholder="Oda veya kişi ara..."
            placeholderTextColor={Colors.text3}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={Colors.text3} />
            </Pressable>
          )}
        </View>
      )}

      {roomsLoading && rooms.length === 0 ? (
        <ActivityIndicator size="large" color={Colors.teal} style={{ marginTop: 50 }} />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.teal}
              colors={[Colors.teal]}
              progressBackgroundColor={Colors.bg2}
            />
          }
          onScroll={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
            if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 300) {
              handleLoadMoreRooms();
            }
          }}
          scrollEventThrottle={400}
        >
          {/* Davet Banner */}
          {!bannerDismissed && (
            <View style={{ position: 'relative' }}>
              <Pressable onPress={handleInvite} style={({ pressed }) => [pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}>
                <LinearGradient
                  colors={Gradients.teal as [string, string]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.inviteBanner}
                >
                  <View style={styles.inviteContent}>
                    <View>
                      <Text style={styles.inviteTitle}>Arkadaşını Davet Et 🎉</Text>
                      <Text style={styles.inviteDesc}>İkinize de 50 Soprano Coin hediye!</Text>
                    </View>
                    <View style={styles.inviteIconWrap}>
                      <Ionicons name="share-social" size={24} color="#fff" />
                    </View>
                  </View>
                </LinearGradient>
              </Pressable>
              <Pressable
                style={styles.bannerClose}
                onPress={() => setBannerDismissed(true)}
              >
                <Ionicons name="close" size={14} color="#FFF" />
              </Pressable>
            </View>
          )}

          {/* Kişileri Keşfet */}
          {(people.length > 0 || peopleLoading) && (
            <>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="people" size={14} color={Colors.teal} />
                  <Text style={styles.sectionTitle}>Kişileri Keşfet</Text>
                </View>
              </View>
              {peopleLoading && people.length === 0 ? (
                <ActivityIndicator size="small" color={Colors.teal} style={{ marginVertical: 10 }} />
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.peopleScroll}
                >
                  {people.map((person) => (
                    <PersonCard key={person.id} person={person} />
                  ))}
                </ScrollView>
              )}
            </>
          )}

          {/* Kişi Arama Sonuçları */}
          {searchQuery.length >= 2 && searchedPeople.length > 0 && (
            <View style={{ marginTop: 4 }}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="person" size={14} color={Colors.gold} />
                  <Text style={styles.sectionTitle}>Kişi Sonuçları</Text>
                </View>
              </View>
              {searchedPeople.map((person) => (
                <Pressable
                  key={person.id}
                  style={styles.searchResultRow}
                  onPress={() => router.push(`/user/${person.id}` as any)}
                >
                  <Image source={getAvatarSource(person.avatar_url)} style={styles.searchResultAvatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.searchResultName}>{person.display_name}</Text>
                    <Text style={styles.searchResultUsername}>@{person.username || 'kullanıcı'}</Text>
                  </View>
                  {person.is_online && (
                    <View style={styles.onlineTag}>
                      <View style={[styles.onlineDotSmall, { backgroundColor: Colors.emerald }]} />
                      <Text style={styles.onlineTagText}>Çevrimiçi</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          )}

          {/* Kategoriler */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="grid" size={14} color={Colors.cyan} />
              <Text style={styles.sectionTitle}>Kategoriler</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catScroll}>
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id || (!selectedCategory && cat.id === 'all');
              return (
                <Pressable
                  key={cat.id}
                  style={[styles.catChip, isSelected && { borderColor: cat.color, backgroundColor: `${cat.color}15` }]}
                  onPress={() => setSelectedCategory(cat.id === 'all' ? null : (selectedCategory === cat.id ? null : cat.id))}
                >
                  <Ionicons name={cat.icon as any} size={16} color={isSelected ? cat.color : Colors.text3} />
                  <Text style={[styles.catChipText, isSelected && { color: cat.color }]}>{cat.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Canlı Odalar — Masonry Grid */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="radio" size={14} color="#FF4500" />
              <Text style={styles.sectionTitle}>
                {selectedCategory ? `${CATEGORIES.find(c => c.id === selectedCategory)?.label || ''} Odaları` : 'Canlı Odalar'}
              </Text>
            </View>
            <Text style={styles.roomCount}>{filteredRooms.length} oda</Text>
          </View>

          {filteredRooms.length === 0 ? (
            <EmptyState
              icon="mic-outline"
              title="Oda bulunamadı"
              subtitle={searchQuery ? 'Farklı bir arama dene' : 'Henüz bu kategoride canlı oda yok'}
            />
          ) : (
            <View style={styles.masonryWrap}>
              {/* Sol Sütun */}
              <View style={styles.masonryCol}>
                {leftCol.map((room) => (
                  <MasonryRoomCard key={room.id} room={room} />
                ))}
              </View>
              {/* Sağ Sütun (asimetrik offset) */}
              <View style={[styles.masonryCol, { marginTop: 24 }]}>
                {rightCol.map((room) => (
                  <MasonryRoomCard key={room.id} room={room} />
                ))}
              </View>
            </View>
          )}

          {/* Load More */}
          {roomsLoadingMore && (
            <ActivityIndicator size="small" color={Colors.teal} style={{ marginVertical: 20 }} />
          )}
          {!roomsHasMore && filteredRooms.length > 0 && (
            <Text style={styles.endText}>Hepsi bu kadar 🌟</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ========== STYLES ==========
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.text },
  searchBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },

  // Search Bar
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 20, marginBottom: 8,
    paddingHorizontal: 14, height: 44,
    borderRadius: 16, backgroundColor: Colors.bg3,
    borderWidth: 1, borderColor: Colors.glassBorder, gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text, height: '100%' as any },

  // Invite Banner
  inviteBanner: { marginHorizontal: 20, borderRadius: 16, padding: 18, marginBottom: 8 },
  inviteContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inviteTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  inviteDesc: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  inviteIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  bannerClose: {
    position: 'absolute', top: 8, right: 28,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center', alignItems: 'center',
  },

  // Section
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, marginTop: 14, marginBottom: 10,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, letterSpacing: 0.3 },

  // People
  peopleScroll: { paddingHorizontal: 16, gap: 14 },
  personCard: { alignItems: 'center', width: 76, position: 'relative' },
  personAvatar: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 6,
  },
  onlineDot: {
    position: 'absolute', top: 2, right: 8,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: Colors.emerald, borderWidth: 2, borderColor: Colors.bg,
  },
  personName: { fontSize: 11, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  personTier: { fontSize: 9, fontWeight: '700', color: Colors.gold, marginTop: 1 },

  // Search Results
  searchResultRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 20, marginBottom: 8, padding: 12,
    borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  searchResultAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  searchResultName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  searchResultUsername: { fontSize: 11, color: Colors.text3, marginTop: 1 },
  onlineTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
    backgroundColor: 'rgba(16,185,129,0.12)',
  },
  onlineDotSmall: { width: 5, height: 5, borderRadius: 3 },
  onlineTagText: { fontSize: 9, fontWeight: '700', color: Colors.emerald },

  // Categories
  catScroll: { paddingHorizontal: 16, gap: 8, paddingBottom: 4 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  catChipText: { fontSize: 12, fontWeight: '600', color: Colors.text3 },

  // Masonry Room Grid
  masonryWrap: { flexDirection: 'row', paddingHorizontal: 16, gap: 10 },
  masonryCol: { flex: 1, gap: 12 },
  roomCard: {
    borderRadius: 22, padding: 14,
    backgroundColor: 'rgba(20,20,30,0.6)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden',
    justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5, shadowRadius: 16, elevation: 12,
  },
  roomGlow: { ...StyleSheet.absoluteFillObject, borderRadius: 22 },
  cardShine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 40,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' },
  cardTopRight: { flexDirection: 'row', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end', flex: 1, marginLeft: 4 },
  viewerPill: {
    borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  viewerText: { color: '#FFF', fontSize: 10, fontWeight: '600' },
  categoryPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  categoryPillText: { fontSize: 8, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  cardBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10,
  },
  liveBadge: { backgroundColor: 'rgba(255,20,147,0.2)' },
  liveDotSmall: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#FF1493' },
  liveTextSmall: { fontSize: 8, fontWeight: '700', color: '#FF1493', textTransform: 'uppercase', letterSpacing: 0.5 },
  centerAvatar: {
    alignSelf: 'center', width: 52, height: 52,
    justifyContent: 'center', alignItems: 'center', marginVertical: 8,
  },
  roomAvatar: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 2, borderColor: '#FFF', zIndex: 2,
  },
  ripple: {
    position: 'absolute', width: 48, height: 48, borderRadius: 24, borderWidth: 2,
  },
  cardBottom: { gap: 3 },
  roomTitle: { fontSize: 13, fontWeight: '600', color: '#FFF', lineHeight: 16 },
  roomHostName: { fontSize: 10, color: '#94A3B8' },
  roomCount: { fontSize: 11, color: Colors.text3 },
  endText: { textAlign: 'center', color: Colors.text3, marginVertical: 20, fontSize: 13 },
});
