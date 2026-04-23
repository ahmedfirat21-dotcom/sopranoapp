/**
 * SopranoChat — Bildirim Dropdown (X.com tarzı)
 * Zil ikonuna yapışık açılan kompakt dropdown panel
 * ★ Sadece oda + arama + hediye bildirimleri gösterilir
 * Takip istekleri → FriendsDrawer, DM → Mesajlar tab'ında
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList,
  ActivityIndicator, Dimensions, Modal,
} from 'react-native';
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../constants/supabase';
import { Colors } from '../constants/theme';
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

export type GiftModalPayload = {
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  amount: number;
};

interface Props {
  visible: boolean;
  onClose: () => void;
  userId?: string;
  anchorTop?: number;
  /** Zil ikonu sağdan kaç px uzakta (ok konumu için). Default 30. */
  anchorRight?: number;
  /** Drawer'ın kendisi sağdan kaç px. Default 8 (screen right edge'ten offset). */
  drawerRight?: number;
  /** Gift bildirimi tıklanınca SPReceivedModal'ı yeniden göster (global state _layout'ta) */
  onShowGiftModal?: (payload: GiftModalPayload) => void;
}

// Bildirim tipi → simge eşleşmesi
// ★ Zil drawer'ında gösterilecek bildirim tipleri (oda + arama + hediye + arkadaşlık yanıtları)
// ★ 2026-04-21: follow_pending context-aware — oda içinde zil gösterir, oda dışında arkadaş simgesi gösterir.
const BELL_NOTIF_TYPES_BASE = [
  'room_live', 'room_invite', 'room_invite_accepted', 'room_invite_rejected',
  'room_access_request',
  'missed_call', 'incoming_call',
  'gift', 'thank_you',
  'event_reminder',
  'follow_accepted', 'follow_rejected',
];
const BELL_NOTIF_TYPES_IN_ROOM = [...BELL_NOTIF_TYPES_BASE, 'follow_pending'];

function getNotifIcon(type: string): { name: string; color: string } {
  switch (type) {
    case 'gift': return { name: 'gift', color: '#F59E0B' };
    case 'thank_you': return { name: 'heart', color: '#EC4899' };
    case 'room_live': return { name: 'mic', color: '#EF4444' };
    case 'room_invite': return { name: 'mail-open', color: '#14B8A6' };
    case 'room_invite_accepted': return { name: 'checkmark-circle', color: '#22C55E' };
    case 'room_invite_rejected': return { name: 'close-circle', color: '#EF4444' };
    case 'room_access_request': return { name: 'enter-outline', color: '#14B8A6' };
    case 'missed_call': return { name: 'call', color: '#EF4444' };
    case 'incoming_call': return { name: 'videocam', color: '#60A5FA' };
    case 'event_reminder': return { name: 'calendar', color: '#A78BFA' };
    case 'follow_pending': return { name: 'person-add', color: '#F59E0B' };
    case 'follow_accepted': return { name: 'person-add', color: '#22C55E' };
    case 'follow_rejected': return { name: 'person-remove', color: '#94A3B8' };
    default: return { name: 'notifications', color: '#94A3B8' };
  }
}

function getDefaultBody(type: string): string {
  switch (type) {
    case 'gift': return 'sana hediye gönderdi';
    case 'thank_you': return 'sana teşekkür etti';
    case 'room_live': return 'odası canlıya geçti';
    case 'room_invite': return 'seni odaya davet etti';
    case 'room_invite_accepted': return 'oda davetini kabul etti 🎉';
    case 'room_invite_rejected': return 'oda davetini reddetti';
    case 'room_access_request': return 'odaya katılmak istiyor';
    case 'missed_call': return 'Cevapsız sesli arama';
    case 'incoming_call': return 'Cevapsız görüntülü arama';
    case 'event_reminder': return 'Etkinlik hatırlatması';
    case 'follow_pending': return 'sana arkadaşlık isteği gönderdi';
    case 'follow_accepted': return 'arkadaşlık isteğini kabul etti 🎉';
    case 'follow_rejected': return 'arkadaşlık isteğini reddetti';
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

export default function NotificationDrawer({ visible, onClose, userId, anchorTop, anchorRight, drawerRight, onShowGiftModal }: Props) {
  const insets = useSafeAreaInsets();
  // Header: paddingTop(insets.top+4) + logo(~32) + padding = bell merkezi ≈ insets.top+22
  // Bell buton alt kenarı ≈ insets.top + 40. Drawer okuyla arasına 6px boşluk.
  const resolvedAnchor = anchorTop ?? (insets.top + 46);
  const router = useRouter();
  const pathname = usePathname();
  // ★ 2026-04-21: Oda içindeyken arkadaşlık istekleri zile düşer; oda dışında arkadaş simgesi gösterir.
  const inRoom = pathname?.startsWith('/room') ?? false;
  const BELL_NOTIF_TYPES = inRoom ? BELL_NOTIF_TYPES_IN_ROOM : BELL_NOTIF_TYPES_BASE;
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false); // ★ Tümünü Gör — modal içinde genişlet
  const [clearing, setClearing] = useState(false); // ★ Tümünü Temizle loading state
  const [processingInvites, setProcessingInvites] = useState<Set<string>>(new Set()); // ★ İşlenmekte olan davet ID'leri
  // ★ 2026-04-24: Teşekkür info modal state
  const [thankYouInfo, setThankYouInfo] = useState<{
    senderName: string; senderAvatar?: string; body?: string; senderId?: string;
  } | null>(null);

  useEffect(() => {
    if (visible && userId) {
      setShowAll(false);
      loadNotifications();
      // ★ ORTA-E: Mark-as-read sadece bu andan ÖNCEKİ unread'leri kapatır —
      // drawer açıkken gelen yeni bildirim unread kalsın (race önleme).
      const openedAt = new Date().toISOString();
      supabase.from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)
        .in('type', BELL_NOTIF_TYPES)
        .lte('created_at', openedAt)
        .then(() => {
          // ★ 2026-04-20 FIX: Badge anında 0'a düşsün. Realtime UPDATE listener
          //   toplu update'te gecikmeli gelir; hemen bildirimi ilet ki UI yansısın.
          try {
            const ev = (global as any).__sopranoBadgeRefresh;
            if (typeof ev === 'function') ev();
          } catch {}
        });
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
        // ★ D-3: Pagination — ilk açılış 20, "Tümünü Gör" 500 (ağır kullanıcı
        // 100'den fazla unread'te takılıyordu). 500'ün ötesinde mobile UX için
        // manuel scroll pagination ekleyebilir ama %99 kullanıcı için yeterli.
        .limit(loadAll ? 500 : 20);
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
    } else if (item.type === 'room_access_request' && item.reference_id) {
      // Host'u odasına yönlendir, moderasyon panelinden istekleri görsün
      router.push(`/room/${item.reference_id}` as any);
    } else if (item.type === 'missed_call' && item.sender_id) {
      router.push(`/user/${item.sender_id}` as any);
    } else if (item.type === 'gift' && item.sender_id && onShowGiftModal) {
      // ★ SP hediye: bildirim zilinden tıklayınca SPReceivedModal'ı yeniden aç
      //   Miktar body'den parse edilir ("XX SP gönderdi" pattern'i — _layout RT ile aynı)
      const amountMatch = /(\d+)\s*SP/.exec(item.body || '');
      const amount = amountMatch ? parseInt(amountMatch[1], 10) : 0;
      if (amount > 0) {
        onShowGiftModal({
          senderId: item.sender_id,
          senderName: item.sender?.display_name || 'Birisi',
          senderAvatar: item.sender?.avatar_url,
          amount,
        });
      }
    } else if (item.type === 'thank_you' && item.sender_id) {
      // ★ 2026-04-24: Teşekkür bildirimi → info modal (profil yerine)
      setThankYouInfo({
        senderName: item.sender?.display_name || 'Birisi',
        senderAvatar: item.sender?.avatar_url,
        body: item.body,
        senderId: item.sender_id,
      });
      // Drawer'dan çıkma — modal zaten içinde görünecek
      return;
    } else if (item.type === 'follow_accepted' || item.type === 'follow_rejected' || item.type === 'follow_pending') {
      if (item.sender_id) router.push(`/user/${item.sender_id}` as any);
    }
  };

  // ★ Oda daveti kabul et
  const handleAcceptInvite = async (item: NotifItem) => {
    if (!userId || !item.reference_id) return;
    setProcessingInvites(prev => new Set(prev).add(item.id));
    try {
      const result = await RoomAccessService.acceptInvite(item.reference_id, userId);
      // ★ 2026-04-19: Oda kapalı/silinmiş ise graceful mesaj göster (hata fırlatma)
      if (!result.success) {
        showToast({ title: 'Davet Geçersiz', message: result.error || 'Davet kabul edilemedi', type: 'warning' });
        // Bildirimi yine de listeden kaldır (artık geçerli değil)
        setItems(prev => prev.filter(n => n.id !== item.id));
        try { await supabase.from('notifications').delete().eq('id', item.id); } catch {}
        return;
      }
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

  // ★ Uzun bas: tümünü okundu işaretle (silmez, sadece is_read=true yapar)
  const handleMarkAllRead = useCallback(async () => {
    if (!userId) return;
    const unread = items.filter(n => !n.is_read);
    if (unread.length === 0) return;
    try {
      await supabase.from('notifications').update({ is_read: true })
        .eq('user_id', userId).eq('is_read', false).in('type', BELL_NOTIF_TYPES);
      setItems(prev => prev.map(n => ({ ...n, is_read: true })));
      showToast({ title: `${unread.length} bildirim okundu ✓`, type: 'success' });
    } catch {
      showToast({ title: 'Hata', type: 'error' });
    }
  }, [userId, items]);

  const unreadCount = items.filter(n => !n.is_read).length;

  // ★ 2026-04-24 v2: Premium entry animation — uniform scale + slide (no squish).
  //   Reanimated native driver (60fps).
  const slideY = useSharedValue(-30);
  const slideOpacity = useSharedValue(0);
  const slideScale = useSharedValue(0.92);
  const hasAnimatedEntry = useRef(false);

  useEffect(() => {
    if (visible) {
      hasAnimatedEntry.current = false;
      slideY.value = -30;
      slideOpacity.value = 0;
      slideScale.value = 0.92;
      // Kısa gecikme — Modal render olduktan sonra animasyon başlat
      const timer = setTimeout(() => {
        slideY.value = withTiming(0, { duration: 350, easing: Easing.out(Easing.exp) });
        slideOpacity.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.quad) });
        slideScale.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.exp) });
        hasAnimatedEntry.current = true;
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const dropdownAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: slideY.value },
      { scale: slideScale.value },
    ],
    opacity: slideOpacity.value,
  }));

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />

      <ReAnimated.View style={[s.dropdown, { top: resolvedAnchor }, dropdownAnimStyle]}>
        {/* ★ Odalarım paleti: diagonal gradient (parlak üst-sol → koyu alt-sağ) */}
        <LinearGradient
          colors={['#4a5668', '#37414f', '#232a35']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        {/* Teal accent üst-sol parıltı */}
        <LinearGradient
          colors={['rgba(20,184,166,0.08)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 0.8 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        {/* Başlık — uzun basınca tümünü okundu işaretle; panHandlers burada swipe-up */}
        <Pressable
          style={s.header}
          onLongPress={handleMarkAllRead}
          delayLongPress={500}
          accessibilityHint="Uzun bas: tümünü okundu işaretle"
        >
          <Ionicons name="notifications" size={18} color="#14B8A6" style={{
            textShadowColor: 'rgba(0,0,0,0.6)',
            textShadowOffset: { width: 0, height: 2 },
            textShadowRadius: 4,
          }} />
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
        </Pressable>

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
            style={{ maxHeight: showAll ? H * 0.75 : H * 0.55 }}
            contentContainerStyle={{ paddingVertical: 4 }}
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
                      <StatusAvatar uri={item.sender?.avatar_url} size={44} />
                      <View style={[s.typeIconBadge, { backgroundColor: icon.color }]}>
                        <Ionicons name={icon.name as any} size={11} color="#FFF" />
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
      </ReAnimated.View>

      {/* ★ 2026-04-24: Teşekkür Info Modal — bildirime tıklanınca açılır */}
      {thankYouInfo && (
        <View style={s.thankOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setThankYouInfo(null)} />
          <View style={s.thankCard}>
            <LinearGradient
              colors={['#1a2e2a', '#0f1f1c', '#091412']}
              start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <LinearGradient
              colors={['rgba(20,184,166,0.15)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 0.8 }}
              style={StyleSheet.absoluteFillObject}
            />
            <LinearGradient
              colors={['transparent', 'rgba(34,197,94,0.7)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5 }}
            />

            <Text style={s.thankHeader}>🙏 TEŞEKKÜR</Text>

            {/* Avatar + sender info */}
            <View style={s.thankSenderRow}>
              {thankYouInfo.senderAvatar && (
                <StatusAvatar uri={thankYouInfo.senderAvatar} size={44} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={s.thankSenderName} numberOfLines={1}>{thankYouInfo.senderName}</Text>
                <Text style={s.thankSenderLabel}>sana teşekkür etti</Text>
              </View>
            </View>

            {/* Emoji + message */}
            {thankYouInfo.body && (
              <View style={s.thankMsgBox}>
                <Text style={s.thankMsgText}>{thankYouInfo.body}</Text>
              </View>
            )}

            {/* Actions */}
            <View style={s.thankActions}>
              <Pressable
                style={({ pressed }) => [s.thankProfileBtn, pressed && { opacity: 0.7 }]}
                onPress={() => {
                  setThankYouInfo(null);
                  onClose();
                  if (thankYouInfo.senderId) router.push(`/user/${thankYouInfo.senderId}` as any);
                }}
              >
                <Ionicons name="person" size={14} color="#14B8A6" />
                <Text style={s.thankProfileText}>Profiline Git</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [s.thankCloseBtn2, pressed && { opacity: 0.7 }]}
                onPress={() => setThankYouInfo(null)}
              >
                <Text style={s.thankCloseText}>Tamam</Text>
              </Pressable>
            </View>

            <Pressable style={s.thankCloseX} onPress={() => setThankYouInfo(null)} hitSlop={8}>
              <Ionicons name="close" size={16} color="rgba(20,184,166,0.6)" />
            </Pressable>
          </View>
        </View>
      )}
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  dropdown: {
    // ★ 2026-04-24 v2: Geniş, premium boyut — neredeyse tam genişlik
    position: 'absolute',
    left: W * 0.04,
    right: W * 0.04,
    borderRadius: 20,
    paddingBottom: 6,
    overflow: 'hidden',
    elevation: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  title: {
    fontSize: 16, fontWeight: '800', color: '#F1F5F9', flex: 1,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  badgePill: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: 9, minWidth: 18, alignItems: 'center',
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#FFF' },
  emptyState: {
    alignItems: 'center', paddingVertical: 40, gap: 10,
  },
  emptyText: { fontSize: 13, color: 'rgba(255,255,255,0.25)', fontWeight: '500' },
  separator: {
    height: 1, backgroundColor: 'rgba(255,255,255,0.04)',
    marginHorizontal: 16,
  },
  notifItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16,
    gap: 12,
  },
  notifUnread: {
    backgroundColor: 'rgba(20,184,166,0.06)',
  },
  avatarWrap: {
    position: 'relative',
  },
  notifAvatar: { width: 44, height: 44, borderRadius: 22 },
  typeIconBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#2f404f',
  },
  notifText: { fontSize: 13, color: '#CBD5E1', lineHeight: 18 },
  notifSender: { fontWeight: '700', color: '#F1F5F9' },
  notifTime: { fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2, fontWeight: '500' },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#14B8A6',
  },

  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: 5,
    paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
    marginTop: 2,
  },
  seeAllText: { fontSize: 14, fontWeight: '700', color: '#14B8A6' },

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

  // ★ 2026-04-24: Teşekkür Info Modal stilleri
  thankOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 100,
  },
  thankCard: {
    width: W * 0.85, maxWidth: 340,
    borderRadius: 20,
    borderWidth: 1.5, borderColor: 'rgba(20,184,166,0.3)',
    overflow: 'hidden',
    paddingVertical: 20, paddingHorizontal: 18,
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 16,
    elevation: 20,
  },
  thankHeader: {
    fontSize: 12, fontWeight: '900', color: '#14B8A6',
    letterSpacing: 2, textAlign: 'center', marginBottom: 14,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4,
  },
  thankSenderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 10, paddingVertical: 10,
    backgroundColor: 'rgba(20,184,166,0.06)',
    borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.15)',
  },
  thankSenderName: {
    fontSize: 14, fontWeight: '800', color: '#F1F5F9',
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  thankSenderLabel: {
    fontSize: 11, fontWeight: '600', color: 'rgba(20,184,166,0.65)', marginTop: 1,
  },
  thankMsgBox: {
    marginTop: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.18)',
    alignItems: 'center',
  },
  thankMsgText: {
    fontSize: 16, color: 'rgba(255,255,255,0.85)', fontWeight: '600',
  },
  thankActions: {
    flexDirection: 'row', gap: 10, marginTop: 16,
    justifyContent: 'center',
  },
  thankProfileBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(20,184,166,0.1)',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.25)',
  },
  thankProfileText: {
    fontSize: 13, fontWeight: '700', color: '#14B8A6',
  },
  thankCloseBtn2: {
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  thankCloseText: {
    fontSize: 13, fontWeight: '700', color: '#94A3B8',
  },
  thankCloseX: {
    position: 'absolute', top: 10, right: 10,
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(20,184,166,0.08)',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
});
