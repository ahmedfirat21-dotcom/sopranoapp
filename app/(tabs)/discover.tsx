import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, ActivityIndicator, Share, TextInput, FlatList } from 'react-native';
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

const CATEGORIES = [
  { id: 'chat', icon: 'mic', label: 'Sohbet', color: Colors.teal },
  { id: 'music', icon: 'musical-notes', label: 'Müzik', color: Colors.sapphire },
  { id: 'game', icon: 'game-controller', label: 'Oyun', color: Colors.emerald },
  { id: 'book', icon: 'book', label: 'Kitap', color: Colors.ice },
  { id: 'film', icon: 'film', label: 'Film & Dizi', color: Colors.gold },
  { id: 'tech', icon: 'code-slash', label: 'Teknoloji', color: Colors.steel },
  { id: 'all', icon: 'heart', label: 'Tüm Odalar', color: '#EC4899' },
];

export default function DiscoverScreen() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsLoadingMore, setRoomsLoadingMore] = useState(false);
  const [roomsHasMore, setRoomsHasMore] = useState(true);

  const [people, setPeople] = useState<Profile[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(true);
  const [peopleLoadingMore, setPeopleLoadingMore] = useState(false);
  const [peopleHasMore, setPeopleHasMore] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchedPeople, setSearchedPeople] = useState<Profile[]>([]);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadRooms = async (isLoadMore = false) => {
    try {
      if (isLoadMore) setRoomsLoadingMore(true);
      else setRoomsLoading(true);

      const currentRooms = isLoadMore ? rooms : [];
      const offset = currentRooms.length;
      let roomData: Room[] = [];

      if (selectedCategory && selectedCategory !== 'all') {
        roomData = await RoomService.getByCategory(selectedCategory, 20, offset);
      } else {
        roomData = await RoomService.getLive(20, offset);
      }

      if (roomData.length < 20) setRoomsHasMore(false);
      else setRoomsHasMore(true);

      setRooms(isLoadMore ? [...currentRooms, ...roomData] : roomData);
    } catch (err) {
      console.warn('Odalar yüklenemedi:', err);
    } finally {
      setRoomsLoading(false);
      setRoomsLoadingMore(false);
    }
  };

  const loadPeople = async (isLoadMore = false) => {
    if (!firebaseUser) return;
    try {
      if (isLoadMore) setPeopleLoadingMore(true);
      else setPeopleLoading(true);

      const currentPeople = isLoadMore ? people : [];
      const offset = currentPeople.length;
      const recommended = await ProfileService.getRecommended(firebaseUser.uid, 10, offset);
      
      if (recommended.length < 10) setPeopleHasMore(false);
      else setPeopleHasMore(true);

      setPeople(isLoadMore ? [...currentPeople, ...recommended] : recommended);
    } catch (err) {
      console.warn('Kişiler yüklenemedi:', err);
    } finally {
      setPeopleLoading(false);
      setPeopleLoadingMore(false);
    }
  };

  useEffect(() => {
    loadRooms(false);
  }, [selectedCategory]);

  useEffect(() => {
    if (firebaseUser) {
      loadPeople(false);
    }
  }, [firebaseUser]);

  const handleInvite = async () => {
    if (!firebaseUser) return;
    try {
      const myCode = await ReferralService.getMyCode(firebaseUser.uid);
      await Share.share({
        message: `🎙️ SopranoChat'e katil! Sesini duyur, gercek baglantilar kur.\n\nBe Heard, Be Real ✨\n\nDavet Kodum: ${myCode}\n\nhttps://sopranochat.app/invite`,
        title: 'SopranoChat\'e Katil!',
      });
    } catch (err: any) {
      showToast({ title: 'Paylasma iptal edildi', type: 'info' });
    }
  };

  const handleLoadMoreRooms = () => {
    if (!roomsLoadingMore && roomsHasMore && rooms.length > 0) {
      loadRooms(true);
    }
  };

  const handleLoadMorePeople = () => {
    if (!peopleLoadingMore && peopleHasMore && people.length > 0) {
      loadPeople(true);
    }
  };

  const renderHeader = () => (
    <View>
      {/* Arkadaşını Davet Et Banner */}
      {!bannerDismissed && (
        <View style={{ position: 'relative' }}>
          <Pressable onPress={handleInvite} style={({ pressed }) => [pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}>
            <LinearGradient
              colors={Gradients.teal as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
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
            style={{ position: 'absolute', top: 8, right: 24, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}
            onPress={() => setBannerDismissed(true)}
          >
            <Ionicons name="close" size={14} color="#FFF" />
          </Pressable>
        </View>
      )}

      {/* Kişileri Keşfet */}
      {(people.length > 0 || peopleLoading) && (
        <>
          <Text style={styles.sectionTitle}>👥 Kişileri Keşfet</Text>
          {peopleLoading && people.length === 0 ? (
            <ActivityIndicator size="small" color={Colors.teal} style={{ marginVertical: 10 }} />
          ) : (
            <FlatList
              data={people}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.peopleScroll}
              renderItem={({ item: person }) => (
                <Pressable
                  style={styles.personCard}
                  onPress={() => router.push(`/chat/${person.id}` as any)}
                >
                  <Image source={getAvatarSource(person.avatar_url)} style={styles.personAvatar} />
                  {person.is_online && <View style={styles.onlineDot} />}
                  <Text style={styles.personName} numberOfLines={1}>{person.display_name}</Text>
                  <Text style={styles.personTier}>{person.tier || 'Bronz'}</Text>
                </Pressable>
              )}
              onEndReached={handleLoadMorePeople}
              onEndReachedThreshold={0.5}
              ListFooterComponent={peopleLoadingMore ? <ActivityIndicator size="small" color={Colors.teal} style={{ marginLeft: 16, marginRight: 32 }} /> : null}
            />
          )}
        </>
      )}

      {/* Kategoriler (Statik oldugu icin horizontal ScrollView pratik kalabilir veya FlatList yapılabilir. Eleman sayısı 7 olduğu için native ScrollView dahi sıkıntı çıkarmaz ama görsel tutarlılık yapalım) */}
      <Text style={styles.sectionTitle}>Kategoriler</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catScroll}>
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat.id}
            style={[styles.catCard, selectedCategory === cat.id && { borderColor: cat.color, borderWidth: 1.5 }]}
            onPress={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
          >
            <View style={[styles.catIconWrap, { backgroundColor: `${cat.color}18` }]}>
              <Ionicons name={cat.icon as any} size={22} color={cat.color} />
            </View>
            <Text style={styles.catLabel}>{cat.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Popüler Odalar Başlığı */}
      <Text style={styles.sectionTitle}>
        {selectedCategory ? `🎯 ${CATEGORIES.find(c => c.id === selectedCategory)?.label || ''} Odaları` : '🔥 Şu An Popüler'}
      </Text>
    </View>
  );

  const filteredRooms = rooms.filter(r => !searchQuery || r.name.toLowerCase().includes(searchQuery.toLowerCase()));

  // Kullanıcı araması — debounce ile
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



  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Keşfet</Text>
        <Pressable style={styles.searchBtn} onPress={() => setShowSearch(!showSearch)}>
          <Ionicons name={showSearch ? 'close' : 'search'} size={20} color={Colors.text2} />
        </Pressable>
      </View>

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
        <FlatList
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderHeader}

          data={filteredRooms}
          keyExtractor={(item) => item.id}
          renderItem={({ item: room }) => (
             <Pressable style={styles.topRoom} onPress={() => router.push(`/room/${room.id}`)}>
               <Image source={getAvatarSource(room.host?.avatar_url)} style={styles.topRoomAvatar} />
               <View style={styles.topRoomInfo}>
                 <Text style={styles.topRoomTitle}>{room.name}</Text>
                 <Text style={styles.topRoomHost}>{room.host?.display_name || 'Anonim'}</Text>
               </View>
               <View style={styles.topRoomRight}>
                 {room.is_live && (
                   <View style={styles.liveTag}>
                     <View style={styles.liveDot} />
                     <Text style={styles.liveText}>CANLI</Text>
                   </View>
                 )}
                 <Text style={styles.listenerCount}>
                   <Ionicons name="person" size={10} color={Colors.text3} /> {room.listener_count}
                 </Text>
               </View>
             </Pressable>
          )}
          ListEmptyComponent={
            searchedPeople.length === 0 ? (
              <EmptyState
                icon="search-outline"
                title="Sonuç bulunamadı"
                subtitle="Farklı bir arama veya kategori dene"
              />
            ) : null
          }
          ListFooterComponent={() => (
            <View>
              {/* Kişi Arama Sonuçları */}
              {searchQuery.length >= 2 && searchedPeople.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.sectionTitle}>👤 Kişiler</Text>
                  {searchedPeople.map((person) => (
                    <Pressable
                      key={person.id}
                      style={styles.topRoom}
                      onPress={() => router.push(`/user/${person.id}` as any)}
                    >
                      <Image source={getAvatarSource(person.avatar_url)} style={styles.topRoomAvatar} />
                      <View style={styles.topRoomInfo}>
                        <Text style={styles.topRoomTitle}>{person.display_name}</Text>
                        <Text style={styles.topRoomHost}>@{person.username || 'kullanici'}</Text>
                      </View>
                      <View style={styles.topRoomRight}>
                        {person.is_online && (
                          <View style={[styles.liveTag, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
                            <View style={[styles.liveDot, { backgroundColor: Colors.emerald }]} />
                            <Text style={[styles.liveText, { color: Colors.emerald }]}>Çevrimiçi</Text>
                          </View>
                        )}
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
              <View style={{ paddingBottom: 20 }}>
                {roomsLoadingMore && (
                  <ActivityIndicator size="small" color={Colors.teal} style={{ marginVertical: 20 }} />
                )}
                {!roomsHasMore && filteredRooms.length > 0 && (
                  <Text style={{ textAlign: 'center', color: Colors.text3, marginVertical: 20, fontSize: 13 }}>
                    Hepsi bu kadar 🌟
                  </Text>
                )}
              </View>
            </View>
          )}
          onEndReached={searchQuery ? undefined : handleLoadMoreRooms} // Arama varken infinite scroll devre dışı
          onEndReachedThreshold={0.5}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.text },
  searchBtn: { width: 40, height: 40, borderRadius: Radius.sm, backgroundColor: Colors.glass2, borderWidth: 1, borderColor: Colors.glassBorder, justifyContent: 'center', alignItems: 'center' },

  // Search Bar
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 8, paddingHorizontal: 14, height: 44, borderRadius: Radius.default, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.glassBorder, gap: 10 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text, height: '100%' },

  // Invite Banner
  inviteBanner: { marginHorizontal: 20, borderRadius: Radius.default, padding: 18, marginBottom: 8 },
  inviteContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inviteTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  inviteDesc: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  inviteIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },

  // People
  peopleScroll: { paddingHorizontal: 16, gap: 12 },
  personCard: { alignItems: 'center', width: 76, position: 'relative' },
  personAvatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: Colors.glassBorder, marginBottom: 6 },
  onlineDot: { position: 'absolute', top: 2, right: 8, width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.emerald, borderWidth: 2, borderColor: Colors.bg },
  personName: { fontSize: 11, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  personTier: { fontSize: 9, fontWeight: '700', color: Colors.gold, marginTop: 1 },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, paddingHorizontal: 20, marginTop: 16, marginBottom: 12 },
  catScroll: { paddingHorizontal: 16, gap: 10 },
  catCard: { alignItems: 'center', padding: 12, borderRadius: Radius.default, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.glassBorder, width: 80 },
  catIconWrap: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  catLabel: { fontSize: 10, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  topRoom: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 10, padding: 14, borderRadius: Radius.default, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.glassBorder },
  topRoomAvatar: { width: 44, height: 44, borderRadius: 22 },
  topRoomInfo: { flex: 1, marginLeft: 12 },
  topRoomTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  topRoomHost: { fontSize: 11, color: Colors.text2, marginTop: 2 },
  topRoomRight: { alignItems: 'flex-end', gap: 4 },
  liveTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(239,68,68,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.red },
  liveText: { fontSize: 9, fontWeight: '700', color: Colors.red },
  listenerCount: { fontSize: 10, color: Colors.text3 },
  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 13, color: Colors.text3 },
});
