import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Image, Pressable, ActivityIndicator, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useRouter } from 'expo-router';
import { Colors } from '../../constants/theme';
import { MessageService, type InboxItem, type Message } from '../../services/database';
import EmptyState from '../../components/EmptyState';
import { useAuth, useBadges, useTheme } from '../_layout';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAvatarSource } from '../../constants/avatars';
import { UserSearchModal } from '../../components/UserSearchModal';
import AppBackground from '../../components/AppBackground';



function getRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Az önce';
  if (mins < 60) return `${mins}dk`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}sa`;
  const days = Math.floor(hours / 24);
  return `${days}g`;
}

export default function MessagesScreen() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const { refreshBadges } = useBadges();
  useTheme(); // Tema değişince re-render
  const [conversations, setConversations] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Arama filtresi
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(c => c.partner_name.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  const loadInbox = async () => {
    if (!firebaseUser) return;
    try {
      const inbox = await MessageService.getInbox(firebaseUser.uid);
      setConversations(inbox);
    } catch (err) {
      if (__DEV__) console.warn('Mesajlar yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  // Sayfaya her odaklanıldığında güncel inbox'ı çek (Örn: Chat sayfasından geri dönünce okunmuş olmalı)
  useFocusEffect(
    useCallback(() => {
      loadInbox();
      // ★ Sayfa odaklandığında badge’i güncelle (chat’ten geri dönünce okunmuş mesajları yansıt)
      refreshBadges();
    }, [firebaseUser])
  );

  useEffect(() => {
    if (!firebaseUser) return;

    // Realtime yeni mesaj dinleyici
    const channel = MessageService.onNewMessage(firebaseUser.uid, (newMsg: Message) => {
      setConversations(prev => {
        const otherId = newMsg.sender_id === firebaseUser.uid ? newMsg.receiver_id : newMsg.sender_id;
        // Mevcut sohbeti bul
        const existingIdx = prev.findIndex(c => c.partner_id === otherId);
        
        const newItem: InboxItem = {
          partner_id: otherId,
          partner_name: newMsg.sender?.display_name || 'Kullanıcı',
          partner_avatar: newMsg.sender?.avatar_url || '',
          partner_is_online: newMsg.sender?.is_online || false,
          last_message_content: newMsg.content,
          last_message_time: newMsg.created_at,
          unread_count: existingIdx >= 0 ? prev[existingIdx].unread_count + 1 : 1
        };

        if (existingIdx >= 0) {
          // Varsa, bilgileri yeni mesajla güncelle ve unread artır
          newItem.partner_name = prev[existingIdx].partner_name;
          newItem.partner_avatar = prev[existingIdx].partner_avatar;
          newItem.partner_is_online = prev[existingIdx].partner_is_online;
        }

        // Güncellenmiş öğeyi en başa koy, eskisini sil
        const filtered = prev.filter(c => c.partner_id !== otherId);
        return [newItem, ...filtered];
      });
    });

    return () => {
      channel.unsubscribe();
    };
  }, [firebaseUser]);

  const insets = useSafeAreaInsets();

  return (
    <AppBackground variant="messages">
    <View style={[styles.container, { backgroundColor: 'transparent' }]}><View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View>
          <Text style={styles.headerTitle}>Mesajlar</Text>
          <Text style={styles.headerSub}>Sohbetlerin</Text>
        </View>
        <Pressable style={styles.composeBtn} onPress={() => setShowComposeModal(true)}>
          <Ionicons name="create-outline" size={20} color="rgba(255,255,255,0.6)" />
        </Pressable>
      </View>

      {/* ═══ ARAMA ÇUBUĞU ═══ */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color="#64748B" />
        <TextInput
          style={styles.searchInput}
          placeholder="Mesaj veya kişi ara..."
          placeholderTextColor="#4A5568"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#64748B" />
          </Pressable>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.teal} style={{ marginTop: 40 }} />
      ) : filteredConversations.length > 0 ? (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.partner_id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const unread = item.unread_count > 0;
            return (
              <Pressable
                style={styles.msgRow}
                onPress={() => {
                  router.push(`/chat/${item.partner_id}`);
                }}
              >
                <Pressable 
                  style={styles.avatarWrap}
                  onPress={() => {
                    if (item.partner_id === firebaseUser?.uid) {
                      router.push('/edit-profile');
                    } else {
                      router.push(`/user/${item.partner_id}` as any);
                    }
                  }}
                >
                  <Image source={getAvatarSource(item.partner_avatar)} style={styles.avatar} />
                  {item.partner_is_online && <View style={styles.onlineDot} />}
                </Pressable>
                <View style={styles.msgInfo}>
                  <View style={styles.msgTop}>
                    <Text style={styles.msgName}>{item.partner_name}</Text>
                    <Text style={styles.msgTime}>{getRelativeTime(item.last_message_time)}</Text>
                  </View>
                  <Text style={[styles.msgText, unread && styles.msgTextUnread]} numberOfLines={1}>
                    {item.last_message_content}
                  </Text>
                </View>
                {/* ★ Sesli Arama Butonu */}
                <Pressable
                  style={styles.msgCallBtn}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    router.push(`/call/${item.partner_id}?type=audio` as any);
                  }}
                >
                  <Ionicons name="call" size={16} color="#4ADE80" />
                </Pressable>
                {unread && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadCountText}>{item.unread_count}</Text>
                  </View>
                )}
              </Pressable>
            );
          }}
        />
      ) : (
        <EmptyState
          icon="chatbubbles-outline"
          title="Henüz mesajın yok"
          subtitle="Birinin profiline git ve sohbet başlat!"
          actionLabel="Keşfet"
          onAction={() => router.push('/(tabs)/discover' as any)}
        />
      )}

      {/* ★ MSG-1: Yeni Mesaj Modalı */}
      {firebaseUser && (
        <UserSearchModal
          visible={showComposeModal}
          onClose={() => setShowComposeModal(false)}
          currentUserId={firebaseUser.uid}
          onSelectUser={(userId) => {
            setShowComposeModal(false);
            router.push(`/chat/${userId}`);
          }}
        />
      )}
    </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#F1F5F9', letterSpacing: -0.3 },
  headerSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  composeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#F1F5F9',
    padding: 0,
  },
  msgRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  avatarWrap: { position: 'relative', marginRight: 16 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155' },
  onlineDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#4ADE80',
    borderWidth: 2, borderColor: '#000',
    shadowColor: '#4ADE80', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 6, elevation: 5,
  },
  msgInfo: { flex: 1, justifyContent: 'center' },
  msgTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  msgName: { fontSize: 16, fontWeight: '400', color: '#F8FAFC', letterSpacing: 0.5 },
  msgTime: { fontSize: 12, color: '#64748B' },
  msgText: { fontSize: 14, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.2 },
  msgTextUnread: { color: '#F1F5F9', fontWeight: '600' },
  unreadBadge: {
    paddingHorizontal: 6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 5,
  },
  msgCallBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(74,222,128,0.08)',
    borderWidth: 1, borderColor: 'rgba(74,222,128,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 6,
  },
  unreadCountText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#A0AEC0' },
  emptyDesc: { fontSize: 12, color: '#64748B' },
});
