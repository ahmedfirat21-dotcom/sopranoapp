/**
 * SopranoChat — Kullanıcı Arama Modalı (Yeni Mesaj Başlatma)
 * Mesajlar ekranındaki compose butonuna bağlı
 * Arkadaş listesi + arama → seçilen kullanıcıyla sohbet başlat
 */
import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TextInput, FlatList, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius } from '../constants/theme';
import { supabase } from '../constants/supabase';
import { getAvatarSource } from '../constants/avatars';
import type { Profile } from '../services/database';

type UserSearchModalProps = {
  visible: boolean;
  onClose: () => void;
  currentUserId: string;
  onSelectUser: (userId: string, displayName: string) => void;
};

export function UserSearchModal({ visible, onClose, currentUserId, onSelectUser }: UserSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [friendsLoading, setFriendsLoading] = useState(true);

  // Arkadaş listesini yükle (modal açıldığında)
  useEffect(() => {
    if (!visible || !currentUserId) return;
    loadFriends();
    setQuery('');
    setResults([]);
  }, [visible, currentUserId]);

  const loadFriends = async () => {
    setFriendsLoading(true);
    try {
      // Takip edilen kişileri getir (friendships tablosundan)
      const { data: following } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', currentUserId)
        .eq('status', 'accepted');

      if (!following || following.length === 0) { setFriendsLoading(false); return; }

      const followingIds = following.map(f => f.friend_id);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', followingIds)
        .order('display_name', { ascending: true });
      setFriends(profiles as Profile[] || []);
    } catch (e) {
      if (__DEV__) console.warn('[UserSearch] Takip listesi hatası:', e);
    } finally {
      setFriendsLoading(false);
    }
  };

  const searchUsers = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`display_name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%`)
        .neq('id', currentUserId)
        .limit(20);
      if (error) throw error;
      setResults(data as Profile[] || []);
    } catch (e) {
      if (__DEV__) console.warn('[UserSearch] Arama hatası:', e);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    // Debounce arama
    const timeout = setTimeout(() => searchUsers(text), 400);
    return () => clearTimeout(timeout);
  };

  const displayList = query.length >= 2 ? results : friends;
  const isSearchMode = query.length >= 2;

  const renderUser = ({ item }: { item: Profile }) => (
    <Pressable
      style={({ pressed }) => [s.userRow, pressed && { opacity: 0.8, backgroundColor: 'rgba(92,225,230,0.06)' }]}
      onPress={() => {
        onSelectUser(item.id, item.display_name || 'Kullanıcı');
        onClose();
      }}
    >
      <View style={s.avatarWrap}>
        <Image source={getAvatarSource(item.avatar_url)} style={s.avatar} />
        {item.is_online && <View style={s.onlineDot} />}
      </View>
      <View style={s.userInfo}>
        <Text style={s.displayName}>{item.display_name || 'Kullanıcı'}</Text>
        {item.username && <Text style={s.username}>@{item.username}</Text>}
      </View>
      <Ionicons name="chatbubble-outline" size={18} color={Colors.teal} />
    </Pressable>
  );

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={s.overlayBg} onPress={onClose} />
        <View style={s.container}>
          {/* Header */}
          <View style={s.header}>
            <View style={s.headerLeft}>
              <Ionicons name="create" size={18} color={Colors.teal} />
              <Text style={s.headerTitle}>Yeni Mesaj</Text>
            </View>
            <Pressable style={s.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color={Colors.text2} />
            </Pressable>
          </View>

          {/* Arama */}
          <View style={s.searchWrap}>
            <Ionicons name="search" size={16} color={Colors.text3} />
            <TextInput
              style={s.searchInput}
              placeholder="İsim veya kullanıcı adı ara..."
              placeholderTextColor={Colors.text3}
              value={query}
              onChangeText={handleQueryChange}
              autoFocus
            />
            {query.length > 0 && (
              <Pressable onPress={() => { setQuery(''); setResults([]); }}>
                <Ionicons name="close-circle" size={18} color={Colors.text3} />
              </Pressable>
            )}
          </View>

          {/* Başlık */}
          <View style={s.sectionHeader}>
            <Ionicons name={isSearchMode ? 'search' : 'people'} size={13} color={Colors.text3} />
            <Text style={s.sectionTitle}>
              {isSearchMode ? 'Arama Sonuçları' : 'Takip Ettiklerin'}
            </Text>
          </View>

          {/* Liste */}
          {(friendsLoading || loading) ? (
            <ActivityIndicator size="large" color={Colors.teal} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={displayList}
              keyExtractor={(item) => item.id}
              renderItem={renderUser}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
              ListEmptyComponent={
                <View style={s.emptyState}>
                  <Ionicons
                    name={isSearchMode ? 'search-outline' : 'people-outline'}
                    size={36}
                    color="rgba(92,225,230,0.2)"
                  />
                  <Text style={s.emptyText}>
                    {isSearchMode ? 'Kullanıcı bulunamadı' : 'Henüz kimseyi takip etmiyorsun'}
                  </Text>
                  {!isSearchMode && (
                    <Text style={s.emptySubtext}>Keşfet sayfasından yeni kişileri takip et!</Text>
                  )}
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  overlayBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  container: {
    height: '85%',
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, letterSpacing: 0.2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.glass2,
    justifyContent: 'center', alignItems: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.default,
    backgroundColor: Colors.bg3,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 14,
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.bg3,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: Colors.emerald,
    borderWidth: 2, borderColor: Colors.bg,
  },
  userInfo: { flex: 1 },
  displayName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  username: { fontSize: 12, color: Colors.text3, marginTop: 2 },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 10,
  },
  emptyText: { fontSize: 14, fontWeight: '600', color: Colors.text2 },
  emptySubtext: { fontSize: 12, color: Colors.text3 },
});
