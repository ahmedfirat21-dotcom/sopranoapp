import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../../constants/supabase';
import { auth } from '../../constants/firebase';

type Room = {
  id: string;
  name?: string | null;
  description?: string | null;
  listener_count?: number | null;
  max_speakers?: number | null;
  host_id?: string | null;
  is_system_room?: boolean | null;
};

const categories = [
  { key: 'all', label: 'Tümü', icon: 'apps-outline' as const },
  { key: 'voice', label: 'Sohbet', icon: 'mic-outline' as const },
  { key: 'music', label: 'Müzik', icon: 'musical-notes-outline' as const },
  { key: 'game', label: 'Oyun', icon: 'game-controller-outline' as const },
];

export default function FrekansScreen() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');

  const uid = auth.currentUser?.uid || '';

  const load = useCallback(async () => {
    try {
      const result = await supabase
        .from('rooms')
        .select('id,name,description,listener_count,max_speakers,host_id,is_system_room')
        .eq('is_live', true)
        .order('is_system_room', { ascending: false })
        .order('listener_count', { ascending: false })
        .limit(60);
      setRooms((result.data || []) as Room[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visibleRooms = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('tr-TR');
    return rooms.filter(room => {
      if (!needle) return true;
      return `${room.name || ''} ${room.description || ''}`.toLocaleLowerCase('tr-TR').includes(needle);
    });
  }, [rooms, query]);

  const myRooms = useMemo(() => rooms.filter(room => uid && room.host_id === uid), [rooms, uid]);
  const trending = useMemo(() => visibleRooms.filter(room => !room.is_system_room).slice(0, 12), [visibleRooms]);
  const systemRoom = useMemo(() => rooms.find(room => room.is_system_room), [rooms]);

  const enter = (id: string) => router.push({ pathname: '/room/[id]', params: { id } });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <LinearGradient colors={['#70717A', '#383940', '#17181C']} style={styles.header}>
        <View style={styles.headerIcon}><Ionicons name="radio" size={21} color="#F1F2FB" /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Frekans</Text>
          <Text style={styles.headerSub}>CANLI ODALAR · SES KANALLARI</Text>
        </View>
        <Pressable onPress={() => router.push('/create-room')} style={styles.addButton}>
          <Ionicons name="add" size={23} color="#F2F3FC" />
        </Pressable>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor="#FFF" onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color="#66687C" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Oda veya konu ara..."
            placeholderTextColor="#9A9CAE"
            style={styles.searchInput}
          />
          {!!query && (
            <Pressable onPress={() => setQuery('')} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color="#85879A" />
            </Pressable>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
          {categories.map(item => (
            <Pressable key={item.key} onPress={() => setCategory(item.key)}>
              {category === item.key ? (
                <LinearGradient colors={['#FFFFFF', '#D9DBE7', '#AEB0C3']} style={styles.categoryActive}>
                  <Ionicons name={item.icon} size={15} color="#505267" />
                  <Text style={styles.categoryActiveText}>{item.label}</Text>
                </LinearGradient>
              ) : (
                <View style={styles.category}>
                  <Ionicons name={item.icon} size={15} color="#E3E5EF" />
                  <Text style={styles.categoryText}>{item.label}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </ScrollView>

        {systemRoom && (
          <LinearGradient colors={['rgba(250,250,255,.98)', 'rgba(220,222,236,.98)']} style={styles.featured}>
            <View style={styles.liveFlag}><View style={styles.liveDot} /><Text style={styles.liveFlagText}>ANA FREKANS</Text></View>
            <View style={styles.featuredBody}>
              <LinearGradient colors={['#F8F8FC', '#C5C7D8']} style={styles.featuredIcon}>
                <Ionicons name="radio" size={31} color="#54566D" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.featuredName}>{systemRoom.name || 'Soprano Lobi'}</Text>
                <Text numberOfLines={2} style={styles.featuredDesc}>{systemRoom.description || 'SopranoChat’in kalıcı buluşma odası.'}</Text>
                <View style={styles.featuredMeta}>
                  <Ionicons name="headset" size={12} color="#6D6F83" />
                  <Text style={styles.featuredMetaText}>{systemRoom.listener_count || 0} dinleyici</Text>
                  <View style={styles.metaDot} />
                  <Text style={styles.featuredMetaText}>kapısı açık</Text>
                </View>
              </View>
            </View>
            <Pressable onPress={() => enter(systemRoom.id)}>
              <LinearGradient colors={['#72758F', '#4A4C64', '#2A2C3A']} style={styles.enterButton}>
                <Text style={styles.enterText}>Frekansa Gir</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFF" />
              </LinearGradient>
            </Pressable>
          </LinearGradient>
        )}

        {myRooms.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Senin odaların</Text>
              <Text style={styles.sectionMeta}>{myRooms.length} ODA</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.myRoomsRow}>
              {myRooms.map(room => (
                <Pressable key={room.id} onPress={() => enter(room.id)} style={styles.myRoomCard}>
                  <View style={styles.myRoomIcon}><Ionicons name="home-outline" size={22} color="#5C5E73" /></View>
                  <Text numberOfLines={1} style={styles.myRoomName}>{room.name || 'Odam'}</Text>
                  <Text style={styles.myRoomSub}>{room.listener_count || 0} dinleyici</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Trend frekanslar</Text>
          <Text style={styles.sectionMeta}>ŞİMDİ</Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#FFF" style={{ marginVertical: 28 }} />
        ) : (
          <View style={styles.list}>
            {trending.map((room, index) => (
              <Pressable key={room.id} onPress={() => enter(room.id)} style={({ pressed }) => [styles.roomCard, pressed && { opacity: .8 }]}>
                <View style={styles.rank}><Text style={styles.rankText}>{String(index + 1).padStart(2, '0')}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={styles.roomName}>{room.name || 'Soprano Frekansı'}</Text>
                  <Text numberOfLines={1} style={styles.roomDesc}>{room.description || 'Canlı sohbet odası'}</Text>
                  <View style={styles.waveRow}>
                    {[8, 15, 11, 18, 9, 14, 7, 17, 10].map((height, i) => <View key={i} style={[styles.wave, { height }]} />)}
                  </View>
                </View>
                <View style={styles.listenerBadge}>
                  <Ionicons name="headset" size={12} color="#5A5C70" />
                  <Text style={styles.listenerText}>{room.listener_count || 0}</Text>
                </View>
              </Pressable>
            ))}
            {!trending.length && <View style={styles.empty}><Text style={styles.emptyText}>Aradığın frekansta açık oda yok.</Text></View>}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#727493' },
  header: { minHeight: 82, paddingHorizontal: 15, flexDirection: 'row', gap: 11, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,.45)' },
  headerIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.09)', borderWidth: 1, borderColor: 'rgba(255,255,255,.24)' },
  headerTitle: { color: '#F8F8FF', fontSize: 22, fontWeight: '900' },
  headerSub: { color: '#C5C8D7', fontSize: 8, fontWeight: '900', letterSpacing: 1.25, marginTop: 2 },
  addButton: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,.22)' },
  content: { padding: 14, paddingBottom: 110 },
  searchWrap: { height: 50, borderRadius: 15, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F5F5FA', borderWidth: 1, borderColor: '#D0D2DE' },
  searchInput: { flex: 1, color: '#484A5E', fontSize: 12.5 },
  categories: { gap: 7, paddingVertical: 11, paddingRight: 16 },
  category: { height: 36, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(49,51,66,.38)', borderWidth: 1, borderColor: 'rgba(255,255,255,.20)' },
  categoryText: { color: '#E2E4EF', fontSize: 10, fontWeight: '800' },
  categoryActive: { height: 36, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,.8)' },
  categoryActiveText: { color: '#505267', fontSize: 10, fontWeight: '900' },
  featured: { borderRadius: 21, padding: 14, borderWidth: 1, borderColor: '#FFF', shadowColor: '#2B2C39', shadowOpacity: .25, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
  liveFlag: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#EEEFF5' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#57C65F' },
  liveFlagText: { color: '#6C6E82', fontSize: 7.5, fontWeight: '900', letterSpacing: .9 },
  featuredBody: { flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 10 },
  featuredIcon: { width: 66, height: 66, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#B8BACB' },
  featuredName: { color: '#484A5F', fontSize: 18, fontWeight: '900' },
  featuredDesc: { color: '#7E8092', fontSize: 10.5, lineHeight: 15, marginTop: 3 },
  featuredMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 7 },
  featuredMetaText: { color: '#727487', fontSize: 8.5, fontWeight: '700' },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#999BAB', marginHorizontal: 2 },
  enterButton: { height: 43, borderRadius: 12, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,.35)' },
  enterText: { color: '#FFF', fontSize: 11.5, fontWeight: '900' },
  sectionHeader: { marginTop: 18, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#F5F6FC', fontSize: 14, fontWeight: '900' },
  sectionMeta: { color: '#D4D6E2', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  myRoomsRow: { gap: 8, paddingRight: 16 },
  myRoomCard: { width: 120, minHeight: 112, padding: 10, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(244,245,251,.96)', borderWidth: 1, borderColor: '#FFF' },
  myRoomIcon: { width: 45, height: 45, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E1E2EC', borderWidth: 1, borderColor: '#C0C2D0' },
  myRoomName: { marginTop: 8, color: '#53556A', fontSize: 10.5, fontWeight: '900', maxWidth: 100 },
  myRoomSub: { color: '#999BAB', fontSize: 8.5, marginTop: 2 },
  list: { gap: 7 },
  roomCard: { minHeight: 82, borderRadius: 16, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(244,245,251,.96)', borderWidth: 1, borderColor: '#FFF' },
  rank: { width: 34, height: 50, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DDDFEA' },
  rankText: { color: '#65677B', fontSize: 10, fontWeight: '900' },
  roomName: { color: '#4E5065', fontSize: 13, fontWeight: '900' },
  roomDesc: { color: '#8A8C9D', fontSize: 9.5, marginTop: 2 },
  waveRow: { height: 19, marginTop: 5, flexDirection: 'row', gap: 2, alignItems: 'center' },
  wave: { width: 2, borderRadius: 2, backgroundColor: '#A0A3BA' },
  listenerBadge: { minWidth: 46, height: 29, borderRadius: 10, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E2E3EC' },
  listenerText: { color: '#5A5C70', fontSize: 9.5, fontWeight: '900' },
  empty: { minHeight: 88, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,.20)' },
  emptyText: { color: '#E5E7F1', fontSize: 11 },
});
