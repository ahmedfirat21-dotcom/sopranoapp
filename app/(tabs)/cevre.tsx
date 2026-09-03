import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../constants/supabase';

const FALLBACK_AVATAR = 'https://ui-avatars.com/api/?background=737694&color=fff&name=S';

type Profile = {
  id: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  is_online?: boolean | null;
  last_seen?: string | null;
};

type Room = {
  id: string;
  name?: string | null;
  description?: string | null;
  listener_count?: number | null;
  is_system_room?: boolean | null;
};

function MetallicHeader() {
  return (
    <LinearGradient colors={['#6C6D76', '#36373E', '#17181C']} style={styles.header}>
      <View style={styles.brandOrb}>
        <Ionicons name="people" size={21} color="#EEF0FF" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.brand}>SopranoChat</Text>
        <Text style={styles.tagline}>ÇEVRE · SESİN ETRAFINDAKİ İNSANLAR</Text>
      </View>
      <View style={styles.livePill}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>CANLI</Text>
      </View>
    </LinearGradient>
  );
}

export default function CevreScreen() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [profileResult, roomResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('id,username,display_name,avatar_url,is_online,last_seen')
            .order('is_online', { ascending: false })
            .order('last_seen', { ascending: false })
            .limit(18),
          supabase
            .from('rooms')
            .select('id,name,description,listener_count,is_system_room')
            .eq('is_live', true)
            .order('listener_count', { ascending: false })
            .limit(8),
        ]);
        if (!mounted) return;
        setProfiles((profileResult.data || []) as Profile[]);
        setRooms((roomResult.data || []) as Room[]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const onlineCount = useMemo(() => profiles.filter(p => p.is_online).length, [profiles]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <MetallicHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['rgba(255,255,255,.24)', 'rgba(255,255,255,.08)']} style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="radio" size={26} color="#5A5C78" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>ŞU AN SOPRANO'DA</Text>
            <Text style={styles.heroTitle}>Sesin çevresini keşfet</Text>
            <Text style={styles.heroCopy}>Canlı odalara uğra, yeni insanlarla tanış ve bir frekansa dokunup sohbete katıl.</Text>
          </View>
        </LinearGradient>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{onlineCount}</Text>
            <Text style={styles.statLabel}>çevrimiçi</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{rooms.length}</Text>
            <Text style={styles.statLabel}>canlı oda</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="mic" size={22} color="#EEEFFF" />
            <Text style={styles.statLabel}>ses açık</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Yakınındaki frekanslar</Text>
          <Text style={styles.sectionMeta}>CANLI</Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#FFFFFF" style={{ marginVertical: 28 }} />
        ) : (
          <View style={styles.roomList}>
            {rooms.map((room, index) => (
              <Pressable
                key={room.id}
                onPress={() => router.push({ pathname: '/room/[id]', params: { id: room.id } })}
                style={({ pressed }) => [styles.roomCard, pressed && { opacity: 0.78 }]}
              >
                <LinearGradient colors={['#F6F6FB', '#D7D9E8']} style={styles.roomIcon}>
                  <Ionicons name={room.is_system_room ? 'radio' : 'mic-outline'} size={22} color="#4B4D68" />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={styles.roomName}>{room.name || `Frekans ${index + 1}`}</Text>
                  <Text numberOfLines={1} style={styles.roomDesc}>{room.description || 'Kapısı açık · katılmak için dokun'}</Text>
                </View>
                <View style={styles.listenerPill}>
                  <Ionicons name="headset" size={12} color="#55576B" />
                  <Text style={styles.listenerText}>{room.listener_count || 0}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Yeni tanışabileceğin insanlar</Text>
          <Text style={styles.sectionMeta}>AKTİF</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.peopleRow}>
          {profiles.map(person => {
            const name = person.display_name || person.username || 'Soprano';
            return (
              <View key={person.id} style={styles.personCard}>
                <View style={styles.avatarRing}>
                  <Image source={{ uri: person.avatar_url || FALLBACK_AVATAR }} style={styles.avatar} />
                  {person.is_online && <View style={styles.onlineDot} />}
                </View>
                <Text numberOfLines={1} style={styles.personName}>{name}</Text>
                <Text style={styles.personStatus}>{person.is_online ? 'çevrimiçi' : 'az önce buradaydı'}</Text>
              </View>
            );
          })}
        </ScrollView>

        <LinearGradient colors={['rgba(37,38,48,.82)', 'rgba(18,19,24,.92)']} style={styles.noteCard}>
          <Ionicons name="sparkles" size={18} color="#E8E9F7" />
          <Text style={styles.noteText}>Bu ekran, webdeki klasik SopranoChat hissini mobil için daha dokunmatik ve okunaklı hale getirir.</Text>
        </LinearGradient>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#727493' },
  header: {
    minHeight: 82,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,.5)',
  },
  brandOrb: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.26)',
  },
  brand: { color: '#F5F6FF', fontSize: 21, fontWeight: '900', letterSpacing: -0.5 },
  tagline: { marginTop: 2, color: '#C8CBDC', fontSize: 8.5, fontWeight: '800', letterSpacing: 1.35 },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 6, borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,.22)',
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#8DF58E' },
  liveText: { color: '#EEF0FA', fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  content: { padding: 14, paddingBottom: 110 },
  hero: {
    borderRadius: 22,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.43)',
    shadowColor: '#252637', shadowOpacity: .28, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 6,
  },
  heroIcon: { width: 50, height: 50, borderRadius: 18, backgroundColor: '#E7E8F2', alignItems: 'center', justifyContent: 'center' },
  kicker: { color: '#E6E8F4', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  heroTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '900', marginTop: 3 },
  heroCopy: { color: '#E5E7F2', fontSize: 11.5, lineHeight: 17, marginTop: 5 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  statCard: {
    flex: 1, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(55,57,73,.50)', borderWidth: 1, borderColor: 'rgba(255,255,255,.24)',
  },
  statValue: { color: '#FFF', fontSize: 20, fontWeight: '900' },
  statLabel: { color: '#D9DBE8', fontSize: 9, fontWeight: '700', marginTop: 1 },
  sectionHeader: { marginTop: 19, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#F7F8FF', fontSize: 14, fontWeight: '900' },
  sectionMeta: { color: '#D6D8E7', fontSize: 8, fontWeight: '900', letterSpacing: 1.3 },
  roomList: { gap: 8 },
  roomCard: {
    minHeight: 72, borderRadius: 16, paddingHorizontal: 11, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', gap: 11,
    backgroundColor: 'rgba(242,243,250,.94)', borderWidth: 1, borderColor: 'rgba(255,255,255,.8)',
  },
  roomIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#B7B9CB' },
  roomName: { color: '#484A60', fontSize: 14, fontWeight: '900' },
  roomDesc: { color: '#85879A', fontSize: 10, marginTop: 3 },
  listenerPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E3E4EE', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10 },
  listenerText: { color: '#55576B', fontSize: 10, fontWeight: '800' },
  peopleRow: { gap: 9, paddingRight: 20 },
  personCard: {
    width: 108, minHeight: 138, borderRadius: 18, alignItems: 'center', justifyContent: 'center', padding: 10,
    backgroundColor: 'rgba(244,245,251,.94)', borderWidth: 1, borderColor: 'rgba(255,255,255,.85)',
  },
  avatarRing: { width: 66, height: 66, borderRadius: 33, padding: 3, backgroundColor: '#A7A9C1', position: 'relative' },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#D8DAE8' },
  onlineDot: { position: 'absolute', right: 2, bottom: 6, width: 13, height: 13, borderRadius: 7, backgroundColor: '#54C95D', borderWidth: 2, borderColor: '#F4F5FB' },
  personName: { marginTop: 8, color: '#4B4D62', fontSize: 11, fontWeight: '900', maxWidth: 92 },
  personStatus: { color: '#9799AA', fontSize: 8.5, marginTop: 2 },
  noteCard: {
    marginTop: 18, borderRadius: 16, padding: 13, flexDirection: 'row', gap: 9, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,.20)',
  },
  noteText: { flex: 1, color: '#DDE0ED', fontSize: 10.5, lineHeight: 15 },
});
