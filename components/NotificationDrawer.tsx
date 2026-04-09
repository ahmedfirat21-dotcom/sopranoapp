/**
 * SopranoChat — Bildirim Dropdown (Facebook tarzı)
 * Zil ikonuna yapışık açılan kompakt dropdown panel
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList,
  Image, ActivityIndicator, Dimensions, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../constants/supabase';
import { getAvatarSource } from '../constants/avatars';

const { width: W, height: H } = Dimensions.get('window');

type NotifItem = {
  id: string;
  type: string;
  body?: string;
  sender_id?: string;
  reference_id?: string;
  is_read: boolean;
  created_at: string;
  sender?: { display_name: string; avatar_url: string };
};

interface Props {
  visible: boolean;
  onClose: () => void;
  userId?: string;
  anchorTop?: number;
}

// Bildirim tipi → simge eşleşmesi
function getNotifIcon(type: string): { name: string; color: string } {
  switch (type) {
    case 'follow_request': return { name: 'person-add', color: '#60A5FA' };
    case 'follow_accepted': return { name: 'checkmark-circle', color: '#22C55E' };
    case 'gift': return { name: 'gift', color: '#F59E0B' };
    case 'room_live': return { name: 'mic', color: '#EF4444' };
    case 'room_invite': return { name: 'mail-open', color: '#14B8A6' };
    case 'dm': return { name: 'chatbubble', color: '#8B5CF6' };
    case 'missed_call': return { name: 'call', color: '#EF4444' };
    case 'incoming_call': return { name: 'videocam', color: '#60A5FA' };
    default: return { name: 'notifications', color: '#94A3B8' };
  }
}

function getDefaultBody(type: string): string {
  switch (type) {
    case 'follow_request': return 'seni takip etmek istiyor';
    case 'follow_accepted': return 'takip isteğini kabul etti';
    case 'gift': return 'sana hediye gönderdi';
    case 'room_live': return 'odası canlıya geçti';
    case 'room_invite': return 'seni odaya davet etti';
    case 'dm': return 'sana mesaj gönderdi';
    case 'missed_call': return 'Cevapsız sesli arama';
    case 'incoming_call': return 'Cevapsız görüntülü arama';
    default: return '';
  }
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'şimdi';
  if (mins < 60) return `${mins}dk`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}sa`;
  return `${Math.floor(hours / 24)}g`;
}

export default function NotificationDrawer({ visible, onClose, userId, anchorTop = 90 }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && userId) loadNotifications();
  }, [visible, userId]);

  const loadNotifications = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*, sender:profiles!notifications_sender_id_fkey(display_name, avatar_url)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (!error) setItems((data || []) as NotifItem[]);
    } catch {}
    setLoading(false);
  };

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setItems(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const handlePress = (item: NotifItem) => {
    markAsRead(item.id);
    onClose();
    if (item.type === 'follow_request' || item.type === 'follow_accepted') {
      router.push(`/user/${item.sender_id}` as any);
    } else if (item.type === 'room_live' && item.reference_id) {
      router.push(`/room/${item.reference_id}` as any);
    } else if (item.type === 'dm' && item.reference_id) {
      router.push(`/chat/${item.reference_id}` as any);
    } else if (item.type === 'gift') {
      router.push(`/wallet` as any);
    }
  };

  const unreadCount = items.filter(n => !n.is_read).length;

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />

      <View style={[s.dropdown, { top: anchorTop }]}>
        {/* Üçgen ok — zile hizalı */}
        <View style={s.arrow} />

        {/* Başlık */}
        <View style={s.header}>
          <Ionicons name="notifications" size={18} color="#14B8A6" />
          <Text style={s.title}>Bildirimler</Text>
          {unreadCount > 0 && (
            <View style={s.badgePill}>
              <Text style={s.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color="#14B8A6" style={{ marginVertical: 24 }} />
        ) : items.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="notifications-off-outline" size={28} color="rgba(255,255,255,0.1)" />
            <Text style={s.emptyText}>Henüz bildirim yok</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: H * 0.45 }}
            ItemSeparatorComponent={() => <View style={s.separator} />}
            renderItem={({ item }) => {
              const icon = getNotifIcon(item.type);
              return (
                <Pressable
                  style={({ pressed }) => [s.notifItem, !item.is_read && s.notifUnread, pressed && { opacity: 0.7 }]}
                  onPress={() => handlePress(item)}
                >
                  {/* Avatar + tip ikonu overlay */}
                  <View style={s.avatarWrap}>
                    <Image source={getAvatarSource(item.sender?.avatar_url)} style={s.notifAvatar} />
                    <View style={[s.typeIconBadge, { backgroundColor: icon.color }]}>
                      <Ionicons name={icon.name as any} size={10} color="#FFF" />
                    </View>
                  </View>

                  {/* İçerik */}
                  <View style={{ flex: 1 }}>
                    <Text style={s.notifText} numberOfLines={2}>
                      <Text style={s.notifSender}>{item.sender?.display_name || 'Birisi'}</Text>
                      {' '}{item.body || getDefaultBody(item.type)}
                    </Text>
                    <Text style={s.notifTime}>{timeAgo(item.created_at)}</Text>
                  </View>

                  {!item.is_read && <View style={s.unreadDot} />}
                </Pressable>
              );
            }}
          />
        )}

        {/* Tümünü Gör */}
        <Pressable style={s.seeAllBtn} onPress={() => { onClose(); router.push('/notifications' as any); }}>
          <Text style={s.seeAllText}>Tümünü Gör</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  dropdown: {
    position: 'absolute',
    right: 10,
    width: W * 0.88,
    maxWidth: 380,
    backgroundColor: '#2f404f',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.15)',
    paddingBottom: 4,
    elevation: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  arrow: {
    position: 'absolute',
    top: -7,
    right: 58,
    width: 14,
    height: 14,
    backgroundColor: '#2f404f',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: 'rgba(20,184,166,0.15)',
    transform: [{ rotate: '45deg' }],
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  title: { fontSize: 16, fontWeight: '800', color: '#F1F5F9', flex: 1 },
  badgePill: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 10, minWidth: 22, alignItems: 'center',
  },
  badgeText: { fontSize: 11, fontWeight: '800', color: '#FFF' },
  emptyState: {
    alignItems: 'center', paddingVertical: 30, gap: 8,
  },
  emptyText: { fontSize: 12, color: 'rgba(255,255,255,0.25)' },
  separator: {
    height: 1, backgroundColor: 'rgba(255,255,255,0.03)',
    marginHorizontal: 14,
  },
  notifItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 14,
    gap: 10,
  },
  notifUnread: {
    backgroundColor: 'rgba(20,184,166,0.06)',
  },
  avatarWrap: {
    position: 'relative',
  },
  notifAvatar: { width: 38, height: 38, borderRadius: 19 },
  typeIconBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#2f404f',
  },
  notifText: { fontSize: 13, color: '#CBD5E1', lineHeight: 17 },
  notifSender: { fontWeight: '700', color: '#F1F5F9' },
  notifTime: { fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 2 },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#14B8A6',
  },
  seeAllBtn: {
    alignItems: 'center', paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
    marginTop: 2,
  },
  seeAllText: { fontSize: 13, fontWeight: '600', color: '#14B8A6' },
});
