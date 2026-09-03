import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../../constants/supabase';

const FALLBACK = 'https://ui-avatars.com/api/?background=656887&color=fff&name=S';

type Room = {
  id: string;
  name?: string | null;
  description?: string | null;
  listener_count?: number | null;
  is_system_room?: boolean | null;
  max_speakers?: number | null;
};

type Person = {
  id: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  is_online?: boolean | null;
};

const chips = ['Tümü', 'Sohbet', 'Müzik', 'Oyun'];

export default function HomeScreen() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedChip, setSelectedChip] = useState('Tümü');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [roomResult, profileResult] = await Promise.all([
        supabase
          .from('rooms')
          .select('id,name,description,listener_count,is_system_room,max_speakers')
          .eq('is_live', true)
          .order('is_system_room', { ascending: false })
          .order('listener_count', { ascending: false })
          .limit(16),
        supabase
          .from('profiles')
          .select('id,username,display_name,avatar_url,is_online')
          .eq('is_online', true)
          .limit(12),
      ]);
      setRooms((roomResult.data || []) as Room[]);
      setPeople((profileResult.data || []) as Person[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const systemRoom = useMemo(() => rooms.find(room => room.is_system_room) || rooms[0], [rooms]);
  const otherRooms = useMemo(() => rooms.filter(room => !systemRoom || room.id !== systemRoom.id), [rooms, systemRoom]);
  const totalListeners = useMemo(() => rooms.reduce((sum, room) => sum + Number(room.listener_count || 0), 0), [rooms]);

  const enterRoom = (room: Room) => {
    router.push({ pathname: '/room/[id]', params: { id: room.id } });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <LinearGradient colors={['#71727B', '#3A3B42', '#15161A']} style={styles.header}>
        <View style={styles.brandWrap}>
          <Text style={styles.brand}>SopranoChat</Text>
          <Text style={styles.brandSub}>hear my voice</Text>
        </View>
        <Pressable onPress={() => router.push('/notifications')} style={styles.headerButton}>
          <Ionicons name="notifications-outline" size={20} color="#F0F1FA" />
        </Pressable>
        <Pressable onPress={() => router.push('/create-room')} style={styles.headerButton}>
          <Ionicons name="add" size={22} color="#F0F1FA" />
        </Pressable>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor="#FFF"
            onRefresh={() => { setRefreshing(true); load(); }}
          />
        }
      >
        <LinearGradient
          colors={['rgba(248,249,255,.96)', 'rgba(219,221,235,.96)']}
          style={styles.hero}
        >
          <View style={styles.heroTopLine} />
          <Text style={styles.heroKicker}>BU AKŞAM SOPRANO'DA</Text>
          <Text style={styles.heroTitle}>Bir ses bazen bütün mesafeyi kapatır.</Text>
          <Text style={styles.heroCopy}>
            Kahveni al, kapısı açık bir odaya uğra. Profilinden önce sesinle tanış.
          </Text>
          <View style={styles.heroActions}>
            <Pressable
              disabled={!systemRoom}
              onPress={() => systemRoom && enterRoom(systemRoom)}
              style={({ pressed }) => [styles.heroButtonWrap, pressed && { opacity: .8 }]}
            >
              <LinearGradient colors={['#7A7D99', '#51536C', '#303242']} style={styles.heroPrimary}>
                <Ionicons name="mic" size={16} color="#FFF" />
                <Text style={styles.heroPrimaryText}>Aramıza Katıl</Text>
              </LinearGradient>
            </Pressable>
            <Pressable onPress={() => router.push('/(tabs)/cevre')} style={styles.heroSecondary}>
              <Ionicons name="people-outline" size={16} color="#56586E" />
              <Text style={styles.heroSecondaryText}>İnsanları Tanı</Text>
            </Pressable>
          </View>
        </LinearGradient>

        <View style={styles.statsStrip}>
          <View style={styles.stat}>
            <View style={[styles.dot, { backgroundColor: '#6ED66E' }]} />
            <Text style={styles.statValue}>{people.length}</Text>
            <Text style={styles.statLabel}>çevrimiçi</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Ionicons name="radio-outline" size={15} color="#E9EBF5" />
            <Text style={styles.statValue}>{rooms.length}</Text>
            <Text style={styles.statLabel}>canlı oda</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Ionicons name="headset-outline" size={15} color="#E9EBF5" />
            <Text style={styles.statValue}>{totalListeners}</Text>
            <Text style={styles.statLabel}>dinleyen</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {chips.map(chip => (
            <Pressable key={chip} onPress={() => setSelectedChip(chip)}>
              {selectedChip === chip ? (
                <LinearGradient colors={['#FFFFFF', '#D8DAE6', '#AFB1C4']} style={styles.chipActive}>
                  <Text style={styles.chipActiveText}>{chip}</Text>
                </LinearGradient>
              ) : (
                <View style={styles.chip}><Text style={styles.chipText}>{chip}</Text></View>
              )}
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Şu an uğrayabileceğin yer</Text>
          <Text style={styles.sectionMeta}>güncel</Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#FFF" style={{ marginVertical: 24 }} />
        ) : systemRoom ? (
          <Pressable onPress={() => enterRoom(systemRoom)} style={({ pressed }) => [styles.featuredRoom, pressed && { opacity: .83 }]}>
            <LinearGradient colors={['#FBFBFE', '#D9DBE8']} style={styles.roomGlyph}>
              <Ionicons name="radio" size={28} color="#575970" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.roomKicker}>KAPISI AÇIK</Text>
              <Text style={styles.featuredName}>{systemRoom.name || 'Soprano Lobi'}</Text>
              <Text style={styles.featuredCopy}>{systemRoom.description || 'İlk cümleyi sen kur.'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#74768A" />
          </Pressable>
        ) : (
          <View style={styles.emptyCard}><Text style={styles.emptyText}>Şu anda açık oda bulunamadı.</Text></View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Diğer odalar</Text>
          <Pressable onPress={() => router.push('/(tabs)/myrooms')}>
            <Text style={styles.sectionLink}>Frekanslar →</Text>
          </Pressable>
        </View>

        <View style={styles.roomList}>
          {otherRooms.slice(0, 7).map(room => (
            <Pressable key={room.id} onPress={() => enterRoom(room)} style={({ pressed }) => [styles.roomRow, pressed && { opacity: .8 }]}>
              <View style={styles.roomStatusDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.roomName}>{room.name || 'Soprano Odası'}</Text>
                <Text numberOfLines={1} style={styles.roomSub}>{room.description || 'Katılmaya açık'}</Text>
              </View>
              <View style={styles.roomCount}>
                <Ionicons name="headset" size={11} color="#64667A" />
                <Text style={styles.roomCountText}>{room.listener_count || 0}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Yeni tanışabileceğin insanlar</Text>
          <Text style={styles.sectionMeta}>şimdi</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.peopleRow}>
          {people.map(person => {
            const name = person.display_name || person.username || 'Soprano';
            return (
              <View key={person.id} style={styles.person}>
                <View style={styles.avatarRing}>
                  <Image source={{ uri: person.avatar_url || FALLBACK }} style={styles.avatar} />
                  <View style={styles.personOnline} />
                </View>
                <Text numberOfLines={1} style={styles.personName}>{name}</Text>
                <Text style={styles.personSub}>çevrimiçi</Text>
              </View>
            );
          })}
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#727493' },
  header: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,.48)',
  },
  brandWrap: { flex: 1 },
  brand: { color: '#F7F8FF', fontSize: 27, fontWeight: '900', letterSpacing: -1 },
  brandSub: { color: '#C7C9D7', fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginTop: -2 },
  headerButton: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,.22)',
  },
  content: { padding: 14, paddingBottom: 110 },
  hero: {
    borderRadius: 22, padding: 17, borderWidth: 1, borderColor: '#F8F8FC', overflow: 'hidden',
    shadowColor: '#242534', shadowOpacity: .28, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 7,
  },
  heroTopLine: { position: 'absolute', top: 0, left: 16, right: 16, height: 2, backgroundColor: 'rgba(255,255,255,.82)' },
  heroKicker: { color: '#75778E', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  heroTitle: { color: '#4B4D62', fontSize: 24, fontWeight: '900', lineHeight: 29, marginTop: 5 },
  heroCopy: { color: '#7B7D90', fontSize: 11.5, lineHeight: 17, marginTop: 6, maxWidth: 330 },
  heroActions: { flexDirection: 'row', gap: 9, marginTop: 14 },
  heroButtonWrap: { flex: 1 },
  heroPrimary: { height: 44, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,.45)' },
  heroPrimaryText: { color: '#FFF', fontSize: 11, fontWeight: '900' },
  heroSecondary: { flex: 1, height: 44, borderRadius: 11, backgroundColor: '#F7F7FB', borderWidth: 1, borderColor: '#BFC1D0', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  heroSecondaryText: { color: '#56586E', fontSize: 11, fontWeight: '900' },
  statsStrip: {
    marginTop: 10, minHeight: 58, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    backgroundColor: 'rgba(55,57,72,.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,.23)',
  },
  stat: { flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  statDivider: { height: 26, width: 1, backgroundColor: 'rgba(255,255,255,.18)' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statValue: { color: '#FFF', fontSize: 14, fontWeight: '900' },
  statLabel: { color: '#D9DBE8', fontSize: 8.5, fontWeight: '700' },
  chips: { paddingVertical: 12, gap: 7, paddingRight: 18 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(48,50,65,.38)', borderWidth: 1, borderColor: 'rgba(255,255,255,.20)' },
  chipText: { color: '#E8EAF4', fontSize: 10, fontWeight: '800' },
  chipActive: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,.75)' },
  chipActiveText: { color: '#4E5065', fontSize: 10, fontWeight: '900' },
  sectionHeader: { marginTop: 8, marginBottom: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#F4F5FC', fontSize: 14, fontWeight: '900' },
  sectionMeta: { color: '#D5D7E3', fontSize: 8.5, fontWeight: '800' },
  sectionLink: { color: '#E2E4EF', fontSize: 9.5, fontWeight: '900' },
  featuredRoom: {
    minHeight: 92, borderRadius: 17, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(245,246,251,.97)', borderWidth: 1, borderColor: '#FFFFFF',
  },
  roomGlyph: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#B9BBCB' },
  roomKicker: { color: '#A17079', fontSize: 8, fontWeight: '900', letterSpacing: .9 },
  featuredName: { color: '#4B4D61', fontSize: 17, fontWeight: '900', marginTop: 2 },
  featuredCopy: { color: '#87899A', fontSize: 10, marginTop: 2 },
  emptyCard: { height: 82, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,.2)' },
  emptyText: { color: '#E5E6F0', fontSize: 11 },
  roomList: { gap: 7 },
  roomRow: {
    minHeight: 68, borderRadius: 14, backgroundColor: 'rgba(242,243,249,.95)', borderWidth: 1, borderColor: '#FDFDFF',
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 9,
  },
  roomStatusDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#B1B3C3', borderWidth: 1, borderColor: '#7E8094' },
  roomName: { color: '#54566B', fontSize: 13, fontWeight: '900' },
  roomSub: { color: '#999BAB', fontSize: 9.5, marginTop: 2 },
  roomCount: { minWidth: 44, height: 27, borderRadius: 10, backgroundColor: '#E1E2EC', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  roomCountText: { color: '#64667A', fontSize: 9, fontWeight: '900' },
  peopleRow: { gap: 9, paddingRight: 16, paddingBottom: 6 },
  person: { width: 104, minHeight: 128, borderRadius: 17, padding: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(244,245,251,.95)', borderWidth: 1, borderColor: '#FFF' },
  avatarRing: { width: 63, height: 63, borderRadius: 32, padding: 3, backgroundColor: '#A7A9BE', position: 'relative' },
  avatar: { width: 57, height: 57, borderRadius: 29, backgroundColor: '#D7D9E5' },
  personOnline: { position: 'absolute', right: 2, bottom: 4, width: 13, height: 13, borderRadius: 7, backgroundColor: '#55C65D', borderWidth: 2, borderColor: '#F4F5FB' },
  personName: { color: '#515367', fontSize: 10.5, fontWeight: '900', marginTop: 7, maxWidth: 88 },
  personSub: { color: '#999BAB', fontSize: 8, marginTop: 2 },
});
