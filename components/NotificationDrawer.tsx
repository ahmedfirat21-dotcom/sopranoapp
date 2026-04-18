/**
 * SopranoChat — Bildirim Dropdown (X.com tarzı)
 * Zil ikonuna yapışık açılan kompakt dropdown panel
 * ★ Sadece oda + arama + hediye bildirimleri gösterilir
 * Takip istekleri → FriendsDrawer, DM → Mesajlar tab'ında
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList,
  ActivityIndicator, Dimensions, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../constants/supabase';
import { RoomAccessService } from '../services/roomAccess';
import StatusAvatar from './StatusAvatar';
import { showToast } from './Toast';

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
// ★ Zil drawer'ında gösterilecek bildirim tipleri (oda + arama + hediye)
const BELL_NOTIF_TYPES = ['room_live', 'room_invite', 'room_invite_accepted', 'room_invite_rejected', 'missed_call', 'incoming_call', 'gift', 'event_reminder'];

function getNotifIcon(type: string): { name: string; color: string } {
  switch (type) {
    case 'gift': return { name: 'gift', color: '#F59E0B' };
    case 'room_live': return { name: 'mic', color: '#EF4444' };
    case 'room_invite': return { name: 'mail-open', color: '#14B8A6' };
    case 'room_invite_accepted': return { name: 'checkmark-circle', color: '#22C55E' };
    case 'room_invite_rejected': return { name: 'close-circle', color: '#EF4444' };
    case 'missed_call': return { name: 'call', color: '#EF4444' };
    case 'incoming_call': return { name: 'videocam', color: '#60A5FA' };
    case 'event_reminder': return { name: 'calendar', color: '#A78BFA' };
    default: return { name: 'notifications', color: '#94A3B8' };
  }
}

function getDefaultBody(type: string): string {
  switch (type) {
    case 'gift': return 'sana hediye gönderdi';
    case 'room_live': return 'odası canlıya geçti';
    case 'room_invite': return 'seni odaya davet etti';
    case 'room_invite_accepted': return 'oda davetini kabul etti 🎉';
    case 'room_invite_rejected': return 'oda davetini reddetti';
    case 'missed_call': return 'Cevapsız sesli arama';
    case 'incoming_call': return 'Cevapsız görüntülü arama';
    case 'event_reminder': return 'Etkinlik hatırlatması';
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
  const [showAll, setShowAll] = useState(false); // ★ Tümünü Gör — modal içinde genişlet
  const [clearing, setClearing] = useState(false); // ★ Tümünü Temizle loading state
  const [processingInvites, setProcessingInvites] = useState<Set<string>>(new Set()); // ★ İşlenmekte olan davet ID'leri

  useEffect(() => {
    if (visible && userId) {
      setShowAll(false);
      loadNotifications();
      // ★ Drawer açılınca sadece zil bildirimleri okundu olarak işaretle
      supabase.from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)
        .in('type', BELL_NOTIF_TYPES)
        .then(() => {});
    }
  }, [visible, userId]);

  // ★ Realtime: Bildirimler + takipleşme değişimlerini anlık dinle
  // SADECE drawer açıkken aktif — kapalıyken hayalet temizleme bildirimleri silmesin
  useEffect(() => {
    if (!userId || !visible) return;

    const channel = supabase
      .channel(`notif-sync-${userId}`)
      // ── Notifications tablosu: INSERT / DELETE / UPDATE ──
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, async (payload) => {
        const { data } = await supabase
          .from('notifications')
          .select('*, sender:profiles!notifications_sender_id_fkey(display_name, avatar_url)')
          .eq('id', payload.new.id)
          .single();
        if (data) {
          setItems(prev => {
            if (prev.some(n => n.id === data.id)) return prev;
            return [data as NotifItem, ...prev];
          });
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const updated = payload.new as any;
        if (updated?.id) {
          setItems(prev => prev.map(n => n.id === updated.id ? { ...n, ...updated } : n));
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'notifications',
        // ★ BUG-F17 FIX: Supabase DELETE'te filter desteklemeyebilir,
        // callback içinde user_id kontrolü yapılıyor.
      }, (payload) => {
        const deleted = (payload.old as any);
        // Sadece kendi bildirimlerimizse UI'dan kaldır
        if (deleted?.user_id && deleted.user_id !== userId) return;
        const deletedId = deleted?.id;
        if (deletedId) {
          setItems(prev => prev.filter(n => n.id !== deletedId));
        }
      })
      // ── Friendships tablosu: Takipleşme değişimi → listeyi yenile ──
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friendships',
        filter: `friend_id=eq.${userId}`,
      }, () => {
        // Takipleşme durumu değişti — bildirimleri tazele (drawer açık)
        loadNotifications();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, visible]);

  const loadNotifications = async (loadAll = false) => {
    if (!userId) return;
    setLoading(true);
    try {
      // ★ Sadece oda + arama + hediye bildirimlerini getir
      // follow_* → FriendsDrawer'da, dm → Mesajlar tab'ında gösteriliyor
      const { data, error } = await supabase
        .from('notifications')
        .select('*, sender:profiles!notifications_sender_id_fkey(display_name, avatar_url)')
        .eq('user_id', userId)
        .in('type', BELL_NOTIF_TYPES)
        .order('created_at', { ascending: false })
        .limit(loadAll ? 100 : 20);
      if (!error && data) {
        setItems(data as NotifItem[]);
      }
    } catch {}
    setLoading(false);
  };

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setItems(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const handlePress = (item: NotifItem) => {
    markAsRead(item.id);
    // room_invite tipinde tıklama ile değil, butonlarla aksiyon alınır
    if (item.type === 'room_invite') return;
    onClose();
    if (item.type === 'room_live' && item.reference_id) {
      router.push(`/room/${item.reference_id}` as any);
    } else if ((item.type === 'room_invite_accepted' || item.type === 'room_invite_rejected') && item.reference_id) {
      router.push(`/room/${item.reference_id}` as any);
    } else if (item.type === 'missed_call' && item.sender_id) {
      router.push(`/user/${item.sender_id}` as any);
    } else if (item.type === 'gift') {
      router.push(`/wallet` as any);
    }
  };

  // ★ Oda daveti kabul et
  const handleAcceptInvite = async (item: NotifItem) => {
    if (!userId || !item.reference_id) return;
    setProcessingInvites(prev => new Set(prev).add(item.id));
    try {
      await RoomAccessService.acceptInvite(item.reference_id, userId);
      // Bildirimi listeden kaldır
      setItems(prev => prev.filter(n => n.id !== item.id));
      // Bildirimi DB'den sil
      try { await supabase.from('notifications').delete().eq('id', item.id); } catch {}
      onClose();
      // Odaya yönlendir
      router.push(`/room/${item.reference_id}` as any);
    } catch {
      showToast({ title: 'Hata', message: 'Davet kabul edilemedi', type: 'error' });
    } finally {
      setProcessingInvites(prev => { const n = new Set(prev); n.delete(item.id); return n; });
    }
  };

  // ★ Oda daveti reddet
  const handleRejectInvite = async (item: NotifItem) => {
    if (!userId || !item.reference_id) return;
    setProcessingInvites(prev => new Set(prev).add(item.id));
    try {
      await RoomAccessService.rejectInvite(item.reference_id, userId);
      // Bildirimi listeden kaldır
      setItems(prev => prev.filter(n => n.id !== item.id));
      showToast({ title: 'Davet Reddedildi', message: 'Oda daveti reddedildi', type: 'info' });
    } catch {
      showToast({ title: 'Hata', message: 'Davet reddedilemedi', type: 'error' });
    } finally {
      setProcessingInvites(prev => { const n = new Set(prev); n.delete(item.id); return n; });
    }
  };

  // ★ Tümünü Temizle — sadece zil bildirimlerini sil
  const handleClearAll = useCallback(async () => {
    if (!userId || items.length === 0) return;
    setClearing(true);
    try {
      await supabase.from('notifications').delete().eq('user_id', userId).in('type', BELL_NOTIF_TYPES);
      setItems([]);
    } catch {
      showToast({ title: 'Hata', message: 'Bildirimler temizlenemedi', type: 'error' });
    } finally {
      setClearing(false);
    }
  }, [userId, items.length]);

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
          {/* ★ Tümünü Temizle butonu */}
          {items.length > 0 && (
            <Pressable
              style={({ pressed }) => [s.clearBtn, pressed && { opacity: 0.6 }]}
              onPress={handleClearAll}
              disabled={clearing}
              hitSlop={8}
            >
              {clearing ? (
                <ActivityIndicator size={13} color="#94A3B8" />
              ) : (
                <Ionicons name="trash-outline" size={15} color="#94A3B8" />
              )}
              <Text style={s.clearBtnText}>Temizle</Text>
            </Pressable>
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
            showsVerticalScrollIndicator={true}
            style={{ maxHeight: showAll ? H * 0.7 : H * 0.45 }}
            ItemSeparatorComponent={() => <View style={s.separator} />}
            renderItem={({ item }) => {
              const icon = getNotifIcon(item.type);

              return (
                <View>
                  <Pressable
                    style={({ pressed }) => [s.notifItem, !item.is_read && s.notifUnread, pressed && { opacity: 0.7 }]}
                    onPress={() => handlePress(item)}
                  >
                    {/* Avatar + tip ikonu overlay */}
                    <View style={s.avatarWrap}>
                      <StatusAvatar uri={item.sender?.avatar_url} size={38} />
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

                  {/* ★ Oda daveti: Kabul / Ret butonları */}
                  {item.type === 'room_invite' && item.reference_id && (
                    <View style={s.inviteActions}>
                      <Pressable
                        style={({ pressed }) => [s.inviteAcceptBtn, pressed && { opacity: 0.7 }]}
                        onPress={() => handleAcceptInvite(item)}
                        disabled={processingInvites.has(item.id)}
                      >
                        {processingInvites.has(item.id) ? (
                          <ActivityIndicator size={12} color="#FFF" />
                        ) : (
                          <>
                            <Ionicons name="checkmark" size={13} color="#FFF" />
                            <Text style={s.inviteAcceptText}>Kabul Et</Text>
                          </>
                        )}
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [s.inviteRejectBtn, pressed && { opacity: 0.7 }]}
                        onPress={() => handleRejectInvite(item)}
                        disabled={processingInvites.has(item.id)}
                      >
                        <Ionicons name="close" size={13} color="#94A3B8" />
                        <Text style={s.inviteRejectText}>Reddet</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            }}
          />
        )}

        {/* Tümünü Gör — aynı modal içinde genişlet */}
        {!showAll && items.length >= 20 && (
          <Pressable style={s.seeAllBtn} onPress={() => { setShowAll(true); loadNotifications(true); }}>
            <Text style={s.seeAllText}>Tümünü Gör</Text>
            <Ionicons name="chevron-down" size={14} color="#14B8A6" />
          </Pressable>
        )}
        {showAll && (
          <Pressable style={s.seeAllBtn} onPress={() => { setShowAll(false); loadNotifications(false); }}>
            <Text style={s.seeAllText}>Daralt</Text>
            <Ionicons name="chevron-up" size={14} color="#14B8A6" />
          </Pressable>
        )}
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
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
    marginTop: 2,
  },
  seeAllText: { fontSize: 13, fontWeight: '600', color: '#14B8A6' },

  // ★ Tümünü Temizle butonu
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.12)',
  },
  clearBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },

  // ★ Oda daveti Kabul/Ret butonları
  inviteActions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 62, // avatar genişliği + padding hizası
    paddingBottom: 8,
  },
  inviteAcceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#14B8A6',
  },
  inviteAcceptText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  inviteRejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  inviteRejectText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
});
