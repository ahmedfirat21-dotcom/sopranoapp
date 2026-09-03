import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { auth } from '../../constants/firebase';
import { supabase } from '../../constants/supabase';

const FALLBACK = 'https://ui-avatars.com/api/?background=666987&color=fff&name=S';

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content?: string | null;
  created_at?: string | null;
  is_read?: boolean | null;
};

type Profile = {
  id: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  is_online?: boolean | null;
};

type Thread = {
  userId: string;
  profile?: Profile;
  last?: Message;
  unread: number;
};

function timeLabel(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
}

export default function MessagesScreen() {
  const uid = auth.currentUser?.uid || '';
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (!uid) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const result = await supabase
        .from('messages')
        .select('id,sender_id,receiver_id,content,created_at,is_read')
        .is('room_id', null)
        .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
        .order('created_at', { ascending: false })
        .limit(150);

      const rows = (result.data || []) as Message[];
      setMessages(rows);
      const otherIds = Array.from(new Set(rows.map(m => m.sender_id === uid ? m.receiver_id : m.sender_id).filter(Boolean)));
      if (otherIds.length) {
        const profileResult = await supabase
          .from('profiles')
          .select('id,username,display_name,avatar_url,is_online')
          .in('id', otherIds);
        const map: Record<string, Profile> = {};
        ((profileResult.data || []) as Profile[]).forEach(p => { map[p.id] = p; });
        setProfiles(map);
      } else {
        setProfiles({});
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  const threads = useMemo<Thread[]>(() => {
    const map = new Map<string, Thread>();
    for (const message of messages) {
      const other = message.sender_id === uid ? message.receiver_id : message.sender_id;
      if (!other) continue;
      const existing = map.get(other) || { userId: other, profile: profiles[other], unread: 0 };
      if (!existing.last) existing.last = message;
      if (message.receiver_id === uid && !message.is_read) existing.unread += 1;
      existing.profile = profiles[other] || existing.profile;
      map.set(other, existing);
    }
    return Array.from(map.values()).sort((a, b) => {
      const aa = new Date(a.last?.created_at || 0).getTime();
      const bb = new Date(b.last?.created_at || 0).getTime();
      return bb - aa;
    });
  }, [messages, profiles, uid]);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('tr-TR');
    if (!needle) return threads;
    return threads.filter(thread => {
      const p = thread.profile;
      return `${p?.display_name || ''} ${p?.username || ''}`.toLocaleLowerCase('tr-TR').includes(needle);
    });
  }, [threads, query]);

  const totalUnread = useMemo(() => threads.reduce((sum, t) => sum + t.unread, 0), [threads]);

  const openThread = (thread: Thread) => {
    router.push({ pathname: '/chat/[id]', params: { id: thread.userId } });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <LinearGradient colors={['#6F7079', '#37383F', '#17181C']} style={styles.header}>
        <View style={styles.headerIcon}><Ionicons name="chatbubbles" size={21} color="#F2F3FB" /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Sohbet</Text>
          <Text style={styles.headerSub}>ÖZEL MESAJLAR · KONUŞMALAR</Text>
        </View>
        <View style={styles.unreadPill}>
          <Text style={styles.unreadValue}>{totalUnread}</Text>
          <Text style={styles.unreadLabel}>yeni</Text>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor="#FFF" onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <LinearGradient colors={['rgba(255,255,255,.22)', 'rgba(255,255,255,.07)']} style={styles.introCard}>
          <Text style={styles.introKicker}>SESİN DEVAM ETTİĞİ YER</Text>
          <Text style={styles.introTitle}>Konuşmaların burada.</Text>
          <Text style={styles.introCopy}>Odada tanıştığın insanlarla özel konuşmalarını tek yerde takip et.</Text>
        </LinearGradient>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color="#686A7E" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Konuşma ara..."
            placeholderTextColor="#9A9CAD"
            style={styles.searchInput}
          />
          {!!query && <Pressable onPress={() => setQuery('')}><Ionicons name="close-circle" size={18} color="#898B9E" /></Pressable>}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Son konuşmalar</Text>
          <Text style={styles.sectionMeta}>{visible.length} KİŞİ</Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#FFF" style={{ marginVertical: 36 }} />
        ) : visible.length ? (
          <View style={styles.list}>
            {visible.map(thread => {
              const p = thread.profile;
              const name = p?.display_name || p?.username || 'Soprano kullanıcısı';
              return (
                <Pressable key={thread.userId} onPress={() => openThread(thread)} style={({ pressed }) => [styles.thread, pressed && { opacity: .8 }]}>
                  <View style={styles.avatarRing}>
                    <Image source={{ uri: p?.avatar_url || FALLBACK }} style={styles.avatar} />
                    {p?.is_online && <View style={styles.onlineDot} />}
                  </View>
                  <View style={styles.threadBody}>
                    <View style={styles.threadTop}>
                      <Text numberOfLines={1} style={styles.name}>{name}</Text>
                      <Text style={styles.time}>{timeLabel(thread.last?.created_at)}</Text>
                    </View>
                    <View style={styles.threadBottom}>
                      <Text numberOfLines={1} style={[styles.preview, thread.unread > 0 && styles.previewUnread]}>
                        {thread.last?.sender_id === uid ? 'Sen: ' : ''}{thread.last?.content || 'Yeni bir mesaj'}
                      </Text>
                      {thread.unread > 0 && (
                        <View style={styles.badge}><Text style={styles.badgeText}>{thread.unread > 99 ? '99+' : thread.unread}</Text></View>
                      )}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#8A8C9E" />
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.empty}>
            <LinearGradient colors={['#F7F7FB', '#D6D8E5']} style={styles.emptyIcon}>
              <Ionicons name="chatbubble-ellipses-outline" size={28} color="#66687D" />
            </LinearGradient>
            <Text style={styles.emptyTitle}>Henüz özel sohbet yok</Text>
            <Text style={styles.emptyCopy}>Bir odaya gir, bir kullanıcı profiline dokun ve ilk mesajı gönder.</Text>
            <Pressable onPress={() => router.push('/(tabs)/home')}>
              <LinearGradient colors={['#73768F', '#4C4E66', '#2D2F3D']} style={styles.emptyButton}>
                <Text style={styles.emptyButtonText}>Lobiye Git</Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#727493' },
  header: { minHeight: 82, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,.45)' },
  headerIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.09)', borderWidth: 1, borderColor: 'rgba(255,255,255,.24)' },
  headerTitle: { color: '#F7F8FF', fontSize: 22, fontWeight: '900' },
  headerSub: { color: '#C7C9D8', fontSize: 8, fontWeight: '900', letterSpacing: 1.2, marginTop: 2 },
  unreadPill: { minWidth: 44, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,.22)' },
  unreadValue: { color: '#FFF', fontSize: 13, fontWeight: '900' },
  unreadLabel: { color: '#C9CBD9', fontSize: 7.5, fontWeight: '800' },
  content: { padding: 14, paddingBottom: 110 },
  introCard: { borderRadius: 19, padding: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,.36)' },
  introKicker: { color: '#E7E9F3', fontSize: 8.5, fontWeight: '900', letterSpacing: 1.35 },
  introTitle: { color: '#FFF', fontSize: 20, fontWeight: '900', marginTop: 4 },
  introCopy: { color: '#E1E3EE', fontSize: 10.5, lineHeight: 16, marginTop: 4 },
  searchWrap: { height: 49, borderRadius: 14, marginTop: 10, paddingHorizontal: 12, flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#F5F5FA', borderWidth: 1, borderColor: '#D0D2DE' },
  searchInput: { flex: 1, color: '#4A4C60', fontSize: 12.5 },
  sectionHeader: { marginTop: 16, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: '#F5F6FC', fontSize: 14, fontWeight: '900' },
  sectionMeta: { color: '#D4D6E2', fontSize: 8, fontWeight: '900', letterSpacing: 1.05 },
  list: { gap: 7 },
  thread: { minHeight: 78, borderRadius: 16, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(245,246,251,.97)', borderWidth: 1, borderColor: '#FFF' },
  avatarRing: { width: 55, height: 55, borderRadius: 28, padding: 3, backgroundColor: '#A8AABD', position: 'relative' },
  avatar: { width: 49, height: 49, borderRadius: 25, backgroundColor: '#D8DAE5' },
  onlineDot: { position: 'absolute', right: 1, bottom: 4, width: 12, height: 12, borderRadius: 6, backgroundColor: '#55C65D', borderWidth: 2, borderColor: '#F5F6FB' },
  threadBody: { flex: 1, minWidth: 0 },
  threadTop: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  name: { flex: 1, color: '#4A4C61', fontSize: 13, fontWeight: '900' },
  time: { color: '#999BAB', fontSize: 8.5, fontWeight: '700' },
  threadBottom: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 5 },
  preview: { flex: 1, color: '#898B9D', fontSize: 10.5 },
  previewUnread: { color: '#5C5E73', fontWeight: '800' },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#8A5871' },
  badgeText: { color: '#FFF', fontSize: 8.5, fontWeight: '900' },
  empty: { minHeight: 260, borderRadius: 20, padding: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(244,245,251,.96)', borderWidth: 1, borderColor: '#FFF' },
  emptyIcon: { width: 68, height: 68, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#BFC1D0' },
  emptyTitle: { color: '#4F5166', fontSize: 15, fontWeight: '900', marginTop: 12 },
  emptyCopy: { color: '#898B9D', fontSize: 10.5, lineHeight: 16, textAlign: 'center', maxWidth: 260, marginTop: 5 },
  emptyButton: { height: 42, minWidth: 130, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  emptyButtonText: { color: '#FFF', fontSize: 10.5, fontWeight: '900' },
});
