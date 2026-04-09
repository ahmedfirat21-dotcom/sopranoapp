/**
 * SopranoChat — Arkadaş Davet Modalı
 * Oda oluşturma sayfasında "Davetli" seçilince açılır.
 * Kullanıcının arkadaş listesini gösterir, seçilenleri davet eder.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Image, FlatList, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FriendshipService, FollowUser } from '../../services/friendship';
import { getAvatarSource } from '../../constants/avatars';

const { width: W } = Dimensions.get('window');

interface Props {
  visible: boolean;
  userId: string;
  onClose: () => void;
  onInvite: (selectedUsers: FollowUser[]) => void;
}

export default function InviteFriendsModal({ visible, userId, onClose, onInvite }: Props) {
  const [friends, setFriends] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible && userId) {
      loadFriends();
    }
  }, [visible, userId]);

  const loadFriends = async () => {
    setLoading(true);
    try {
      // Hem takipçileri hem takip edilenleri al (karşılıklı arkadaşlar)
      const [followers, following] = await Promise.all([
        FriendshipService.getFollowers(userId),
        FriendshipService.getFollowing(userId),
      ]);
      // Birleştir ve deduplicate
      const map = new Map<string, FollowUser>();
      followers.forEach(f => map.set(f.id, f));
      following.forEach(f => map.set(f.id, f));
      setFriends(Array.from(map.values()));
    } catch {
      setFriends([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDone = () => {
    const selectedUsers = friends.filter(f => selected.has(f.id));
    onInvite(selectedUsers);
    onClose();
  };

  if (!visible) return null;

  return (
    <View style={s.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={s.modal}>
        {/* Header */}
        <View style={s.header}>
          <Ionicons name="people" size={16} color="#14B8A6" />
          <Text style={s.headerTitle}>Arkadaşlarını Davet Et</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.4)" />
          </Pressable>
        </View>

        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator color="#14B8A6" />
            <Text style={s.loadingText}>Arkadaşlar yükleniyor...</Text>
          </View>
        ) : friends.length === 0 ? (
          <View style={s.emptyWrap}>
            <Ionicons name="people-outline" size={36} color="rgba(255,255,255,0.12)" />
            <Text style={s.emptyText}>Henüz arkadaşın yok</Text>
          </View>
        ) : (
          <FlatList
            data={friends}
            keyExtractor={(f) => f.id}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 12 }}
            renderItem={({ item }) => {
              const isChecked = selected.has(item.id);
              return (
                <Pressable style={s.userRow} onPress={() => toggleSelect(item.id)}>
                  <Image source={getAvatarSource(item.avatar_url)} style={s.avatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.userName} numberOfLines={1}>{item.display_name}</Text>
                    {item.is_online && <Text style={s.onlineText}>Çevrimiçi</Text>}
                  </View>
                  <View style={[s.checkbox, isChecked && s.checkboxActive]}>
                    {isChecked && <Ionicons name="checkmark" size={14} color="#FFF" />}
                  </View>
                </Pressable>
              );
            }}
          />
        )}

        {/* Davet Et butonu */}
        {selected.size > 0 && (
          <Pressable style={s.inviteBtn} onPress={handleDone}>
            <Ionicons name="send" size={14} color="#FFF" />
            <Text style={s.inviteBtnText}>{selected.size} Kişiyi Davet Et</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 500,
  },
  modal: {
    width: W * 0.88,
    maxHeight: 420,
    backgroundColor: 'rgba(45,61,77,0.97)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#F1F5F9', textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  loadingWrap: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  loadingText: { color: 'rgba(255,255,255,0.3)', fontSize: 12 },
  emptyWrap: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { color: 'rgba(255,255,255,0.3)', fontSize: 12 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 8,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  userName: { fontSize: 13, fontWeight: '600', color: '#F1F5F9', textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  onlineText: { fontSize: 9, color: '#22C55E', marginTop: 1 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#14B8A6',
    borderColor: '#14B8A6',
  },
  inviteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginHorizontal: 12, marginVertical: 10,
    paddingVertical: 12, borderRadius: 14,
    backgroundColor: '#14B8A6',
  },
  inviteBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
