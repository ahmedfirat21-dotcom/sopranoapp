/**
 * SopranoChat — Arkadaş Davet Modalı
 * Oda oluşturma sayfasında ve oda içinde arkadaş davet etmek için kullanılır.
 * Kullanıcının arkadaş listesini gösterir, seçilenleri davet eder.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Image, FlatList, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FriendshipService, FollowUser } from '../../services/friendship';
import { getAvatarSource } from '../../constants/avatars';
import { supabase } from '../../constants/supabase';

const { width: W } = Dimensions.get('window');

interface Props {
  visible: boolean;
  userId: string;
  onClose: () => void;
  onInvite: (selectedUsers: FollowUser[]) => void;
  /** ★ 2026-04-19: Oda içinden çağrıldığında verilirse, zaten odada/davet edilmiş
   *  kullanıcılar listeden filtrelenir. create-room'da verilmez (oda henüz yok). */
  roomId?: string;
}

export default function InviteFriendsModal({ visible, userId, onClose, onInvite, roomId }: Props) {
  const [friends, setFriends] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const loadFriends = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      setFriends([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // 1. Hem takipçi hem takip edilen ID'leri al
      const [res1, res2] = await Promise.all([
        supabase.from('friendships').select('user_id').eq('friend_id', userId).eq('status', 'accepted'),
        supabase.from('friendships').select('friend_id').eq('user_id', userId).eq('status', 'accepted'),
      ]);
      const ids = new Set<string>();
      (res1.data || []).forEach((r: any) => ids.add(r.user_id));
      (res2.data || []).forEach((r: any) => ids.add(r.friend_id));

      if (ids.size === 0) {
        setFriends([]);
        setLoading(false);
        return;
      }

      // ★ 2026-04-19: Zaten odada / pending davet edilenleri çıkar (roomId varsa)
      let excludeIds = new Set<string>();
      if (roomId) {
        const [partRes, inviteRes] = await Promise.all([
          supabase.from('room_participants').select('user_id').eq('room_id', roomId),
          supabase.from('room_invites').select('user_id').eq('room_id', roomId).in('status', ['pending', 'accepted']),
        ]);
        (partRes.data || []).forEach((r: any) => excludeIds.add(r.user_id));
        (inviteRes.data || []).forEach((r: any) => excludeIds.add(r.user_id));
      }

      // ★ Block edilmiş kullanıcıları filtrele (blocked_users — iki yönlü)
      const { data: blockedOut } = await supabase.from('blocked_users').select('blocked_id').eq('blocker_id', userId);
      const { data: blockedIn } = await supabase.from('blocked_users').select('blocker_id').eq('blocked_id', userId);
      (blockedOut || []).forEach((r: any) => excludeIds.add(r.blocked_id));
      (blockedIn || []).forEach((r: any) => excludeIds.add(r.blocker_id));

      const filteredIds = Array.from(ids).filter(id => !excludeIds.has(id));
      if (filteredIds.length === 0) {
        setFriends([]);
        setLoading(false);
        return;
      }

      // 2. Profilleri toplu çek
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, username, subscription_tier, is_online')
        .in('id', filteredIds);

      setFriends((profiles || []) as FollowUser[]);
    } catch (err: any) {
      console.warn('[InviteFriendsModal] loadFriends error:', err?.message || err);
      setError('Arkadaş listesi yüklenemedi');
      setFriends([]);
    } finally {
      setLoading(false);
    }
  }, [userId, roomId]);

  useEffect(() => {
    if (visible && userId) {
      setSelected(new Set()); // Her açılışta seçimi sıfırla
      loadFriends();
    }
  }, [visible, userId, loadFriends]);

  // ★ O5 FIX: Modal açıkken arkadaşlık tablosunda değişiklik olursa listeyi tazele.
  // Aksi halde yeni arkadaş ekleyen kullanıcı modal'ı kapatıp açmak zorunda kalıyordu.
  useEffect(() => {
    if (!visible || !userId) return;
    const channelName = `invite_friends_rt_${userId}`;
    const existing = supabase.getChannels().find((ch: any) => ch.topic === `realtime:${channelName}`);
    if (existing) supabase.removeChannel(existing);
    const ch = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `user_id=eq.${userId}` }, () => loadFriends())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `friend_id=eq.${userId}` }, () => loadFriends())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [visible, userId, loadFriends]);

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
  };

  if (!visible) return null;

  // ── İçerik render'ı ──
  const renderContent = () => {
    if (loading) {
      return (
        <View style={s.centerWrap}>
          <ActivityIndicator color="#14B8A6" size="large" />
          <Text style={s.centerText}>Arkadaşlar yükleniyor...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={s.centerWrap}>
          <Ionicons name="alert-circle-outline" size={44} color="rgba(239,68,68,0.4)" />
          <Text style={s.centerText}>{error}</Text>
          <Pressable style={s.retryBtn} onPress={loadFriends}>
            <Ionicons name="refresh" size={14} color="#14B8A6" />
            <Text style={s.retryText}>Tekrar Dene</Text>
          </Pressable>
        </View>
      );
    }

    if (friends.length === 0) {
      return (
        <View style={s.centerWrap}>
          <Ionicons name="people-outline" size={48} color="rgba(255,255,255,0.1)" />
          <Text style={s.emptyTitle}>Henüz arkadaşın yok</Text>
          <Text style={s.emptySubtext}>Keşfet sayfasından yeni insanlar bul ve takip et!</Text>
          <Pressable style={s.closeBtn} onPress={onClose}>
            <Text style={s.closeBtnText}>Kapat</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <FlatList
        data={friends}
        keyExtractor={(f) => f.id}
        style={{ maxHeight: 300 }}
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
    );
  };

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

        {renderContent()}

        {/* Davet Et butonu — sadece seçim varsa ve liste yüklüyse */}
        {!loading && friends.length > 0 && selected.size > 0 && (
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
    maxHeight: 460,
    minHeight: 200,
    backgroundColor: 'rgba(30,41,59,0.97)',
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
  
  // ── Merkez wrap (loading / error / empty) ──
  centerWrap: { 
    alignItems: 'center', 
    justifyContent: 'center',
    paddingVertical: 36, 
    paddingHorizontal: 24,
    gap: 10,
    minHeight: 160,
  },
  centerText: { color: 'rgba(255,255,255,0.35)', fontSize: 13, fontWeight: '500', textAlign: 'center' },
  
  // ── Empty state ──
  emptyTitle: { color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  emptySubtext: { color: 'rgba(255,255,255,0.25)', fontSize: 11, textAlign: 'center', lineHeight: 16, maxWidth: 220 },
  closeBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  closeBtnText: { fontSize: 12, fontWeight: '700', color: '#94A3B8' },

  // ── Error / Retry ──
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(20,184,166,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.2)',
  },
  retryText: { fontSize: 12, fontWeight: '600', color: '#14B8A6' },

  // ── User list ──
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
