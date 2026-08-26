/**
 * SopranoChat — Bildirim Dropdown (X.com tarzı)
 * Zil ikonuna yapışık açılan kompakt dropdown panel
 * ★ Sadece oda + arama + hediye bildirimleri gösterilir
 * Takip istekleri → FriendsDrawer, DM → Mesajlar tab'ında
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, SectionList, Dimensions, BackHandler, Animated, Easing, PanResponder,
} from 'react-native';
import AppLoader from './AppLoader';
import UserListSkeleton from './UserListSkeleton';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../constants/supabase';
import { Colors } from '../constants/theme';
import { RoomAccessService } from '../services/roomAccess';
import StatusAvatar from './StatusAvatar';
import { showToast } from './Toast';
// ★ v107.34: Cycle kırma — _layout yerine direkt context dosyasından
import { useUserProfileSheet } from '../providers/UserProfileSheetContext';
import { i18n, useTranslation } from '../services/i18n';

const { width: W, height: H } = Dimensions.get('window');
// ★ 2026-05-05: Yan drawer (sağdan kayar) — FriendsDrawer ile birebir aynı ölçü.
//   İki kardeş drawer aynı boyut → görsel tutarlılık.
const DRAWER_W = Math.min(W * 0.72, 300);
const DRAWER_H = Math.min(H * 0.86, 820);
// ★ 2026-05-05: Tab bar gerçek yüksekliği = BAR_H + max(insets.bottom, 6).
//   FriendsDrawer page-level render ediliyor → Tabs z-order'ı drawer alt köşesini
//   tab bar üst kenarında kesiyor (görsel: drawer tab bar'a kadar uzanır, üstüne bindirmez).
//   NotificationDrawer global _layout'ta render edildiği için tab bar onu kesemiyor;
//   aynı GÖRSEL boyutu sağlamak için drawer alt sınırını manuel olarak tab bar üst
//   kenarına oturtuyoruz (extra hava yok — FriendsDrawer ile birebir).
const TAB_BAR_BASE = 60;
const TAB_BAR_MIN_BOTTOM_INSET = 6;

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
  notificationId?: string;
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
  /** ★ 2026-04-26: Teşekkür bildirimi tıklanınca global ThankYouReceivedModal'ı tetikle.
   *  Eski: drawer içinde local modal vardı → drawer kapanınca modal de kapanıyordu (race condition).
   *  Şimdi: parent'taki global modal'a yönlendirir, drawer'dan bağımsız çalışır. */
  onShowThankYou?: (payload: { senderId: string; senderName: string; senderAvatar?: string; emoji?: string; message?: string }) => void;
}

// Bildirim tipi → simge eşleşmesi
// ★ Zil drawer'ında gösterilecek bildirim tipleri (oda + arama + hediye + arkadaşlık yanıtları)
// ★ 2026-04-21: follow_pending context-aware — oda içinde zil gösterir, oda dışında arkadaş simgesi gösterir.
// ★ v92.14 (1 May 2026): 'room_access_request' KALDIRILDI — bu istek artık host'un in-room
//   PlusMenu > Katılım İstekleri accordion'unda gösteriliyor. Zilde duplikasyon istenmiyor.
// ★ v108.21: 'symbol_gift' eklendi — sembol hediye bildirimleri _layout badge query'de
//   sayılıyordu ama drawer okumuyordu → badge "1" kalıyordu. Drawer artık tam kapsam.
const BELL_NOTIF_TYPES_BASE = [
  'room_live', 'room_invite', 'room_invite_accepted', 'room_invite_rejected',
  'room_follow',
  'missed_call', 'incoming_call',
  'gift', 'symbol_gift', 'thank_you',
  'event_reminder',
  'follow', 'follow_accepted', 'follow_rejected',
  // ★ v1.7.13.49 (20 May 2026): message_request drawer'dan KALDIRILDI —
  //   yabancıdan gelen DM istekleri sadece Mesajlar tab > İstekler bölümünde görünür.
];
const BELL_NOTIF_TYPES_IN_ROOM = [...BELL_NOTIF_TYPES_BASE, 'follow_pending'];

function getNotifIcon(type: string): { name: string; color: string } {
  switch (type) {
    case 'gift': return { name: 'gift', color: '#F59E0B' };
    case 'symbol_gift': return { name: 'sparkles', color: '#F472B6' };
    case 'thank_you': return { name: 'heart', color: '#EC4899' };
    case 'room_live': return { name: 'mic', color: '#EF4444' };
    case 'room_follow': return { name: 'heart-circle', color: '#14B8A6' };
    case 'room_invite': return { name: 'mail-open', color: '#14B8A6' };
    case 'room_invite_accepted': return { name: 'checkmark-circle', color: '#22C55E' };
    case 'room_invite_rejected': return { name: 'close-circle', color: '#EF4444' };
    case 'room_access_request': return { name: 'enter-outline', color: '#14B8A6' };
    case 'missed_call': return { name: 'call', color: '#EF4444' };
    case 'incoming_call': return { name: 'videocam', color: '#60A5FA' };
    case 'event_reminder': return { name: 'calendar', color: '#A78BFA' };
    case 'follow_pending': return { name: 'person-add', color: '#F59E0B' };
    case 'follow': return { name: 'person-add', color: '#14B8A6' };
    case 'follow_accepted': return { name: 'person-add', color: '#22C55E' };
    case 'follow_rejected': return { name: 'person-remove', color: '#94A3B8' };
    /* ★ v1.7.13.49 (20 May 2026): message_request drawer'da değil — Mesajlar tab > İstekler bölümünde gösterilir. */
    default: return { name: 'notifications', color: '#94A3B8' };
  }
}

function getDefaultBody(type: string): string {
  switch (type) {
    case 'gift': return i18n.t('auto.NotificationDrawer.015');
    case 'symbol_gift': return i18n.t('auto.NotificationDrawer.014');
    case 'thank_you': return i18n.t('auto.NotificationDrawer.013');
    case 'room_live': return i18n.t('auto.NotificationDrawer.012');
    case 'room_follow': return 'odanı takip etmeye başladı';
    case 'room_invite': return 'seni odaya davet etti';
    case 'room_invite_accepted': return 'oda davetini kabul etti 🎉';
    case 'room_invite_rejected': return 'oda davetini reddetti';
    case 'room_access_request': return i18n.t('auto.NotificationDrawer.011');
    case 'missed_call': return i18n.t('auto.NotificationDrawer.010');
    case 'incoming_call': return i18n.t('auto.NotificationDrawer.009');
    case 'event_reminder': return i18n.t('auto.NotificationDrawer.008');
    case 'follow_pending': return i18n.t('auto.NotificationDrawer.007');
    case 'follow': return 'seni takip etmeye başladı';
    case 'follow_accepted': return i18n.t('auto.NotificationDrawer.006');
    case 'follow_rejected': return i18n.t('auto.NotificationDrawer.005');
    default: return '';
  }
}

// ★ v108.21: Section grouping — "Bugün / Bu Hafta / Önceki" hızlı tarama için
function getTimeGroup(dateStr: string): 'today' | 'week' | 'older' {
  const now = Date.now();
  const t = new Date(dateStr).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  if (now - t < dayMs) return 'today';
  if (now - t < 7 * dayMs) return 'week';
  return 'older';
}
const GROUP_LABELS: Record<string, string> = {
  today: i18n.t('auto.NotificationDrawer.004'),
  week: 'Bu Hafta',
  older: i18n.t('auto.NotificationDrawer.003'),
};

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return i18n.t('auto.NotificationDrawer.002');
  if (mins < 60) return `${mins}dk`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}sa`;
  return `${Math.floor(hours / 24)}g`;
}

export default function NotificationDrawer({ visible, onClose, userId, anchorTop, anchorRight, drawerRight, onShowGiftModal, onShowThankYou }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // Header: paddingTop(insets.top+4) + logo(~32) + padding = bell merkezi ≈ insets.top+22
  // Bell buton alt kenarı ≈ insets.top + 40. Drawer okuyla arasına 6px boşluk.
  const resolvedAnchor = anchorTop ?? (insets.top + 46);
  // ★ 2026-05-05: Drawer alt sınırı = tab bar gerçek yüksekliği. Bu değerle drawer alt
  //   köşesi tam tab bar üst kenarında biter — FriendsDrawer'daki Tabs-z-order kesişimiyle
  //   birebir aynı görsel boyut. Extra hava boşluğu yok (kullanıcı talebi: çevrimiçi boyu).
  const tabBarSpace = TAB_BAR_BASE + Math.max(insets.bottom, TAB_BAR_MIN_BOTTOM_INSET);
  // ★ v1.7.13.170: Oda kontrol barı bottom offset — inRoom tanımından sonra hesaplanır.
  const ROOM_CONTROL_BAR_H = 80 + Math.max(insets.bottom, 14);
  const router = useRouter();
  const { openUserProfile } = useUserProfileSheet();
  const pathname = usePathname();
  // ★ 2026-04-21: Oda içindeyken arkadaşlık istekleri zile düşer; oda dışında arkadaş simgesi gösterir.
  const inRoom = pathname?.startsWith('/room') ?? false;
  const bottomSpace = inRoom ? ROOM_CONTROL_BAR_H : tabBarSpace;
  const BELL_NOTIF_TYPES = inRoom ? BELL_NOTIF_TYPES_IN_ROOM : BELL_NOTIF_TYPES_BASE;
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false); // ★ Tümünü Gör — modal içinde genişlet
  const [clearing, setClearing] = useState(false); // ★ Tümünü Temizle loading state
  const [processingInvites, setProcessingInvites] = useState<Set<string>>(new Set()); // ★ İşlenmekte olan davet ID'leri
  // ★ 2026-04-26: thankYouInfo state KALDIRILDI — drawer içinde modal mount ediliyordu, drawer kapanınca race condition oluyordu.
  //   Artık parent'a onShowThankYou ile callback gönderir, global ThankYouReceivedModal mount edilir.

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
          .select('*, sender:profiles!notifications_sender_id_fkey(display_name, avatar_url, active_frame)')
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
        .select('*, sender:profiles!notifications_sender_id_fkey(display_name, avatar_url, active_frame)')
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
    if ((item.type === 'room_live' || item.type === 'room_follow' || item.type === 'event_reminder') && item.reference_id) {
      router.push(`/room/${item.reference_id}` as any);
    } else if ((item.type === 'room_invite_accepted' || item.type === 'room_invite_rejected') && item.reference_id) {
      router.push(`/room/${item.reference_id}` as any);
    } else if (item.type === 'room_access_request' && item.reference_id) {
      // Host'u odasına yönlendir, moderasyon panelinden istekleri görsün
      router.push(`/room/${item.reference_id}` as any);
    } else if ((item.type === 'missed_call' || item.type === 'incoming_call' || item.type === 'symbol_gift') && item.sender_id) {
      openUserProfile(item.sender_id);
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
          notificationId: item.id,
        });
      }
    } else if (item.type === 'thank_you' && item.sender_id && onShowThankYou) {
      // ★ 2026-04-26 FIX: Teşekkür modal'ı parent'taki global ThankYouReceivedModal'a yönlendirildi.
      //   Eski: drawer içinde local modal vardı → drawer kapanınca modal de kapanıyordu (race condition).
      //   Şimdi: drawer kapanır + global modal açılır, bağımsız çalışır.
      onShowThankYou({
        senderId: item.sender_id,
        senderName: item.sender?.display_name || 'Birisi',
        senderAvatar: item.sender?.avatar_url,
        emoji: '🙏',
        message: item.body,
      });
      onClose();
      return;
    } else if (item.type === 'follow' || item.type === 'follow_accepted' || item.type === 'follow_rejected' || item.type === 'follow_pending') {
      if (item.sender_id) openUserProfile(item.sender_id);
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
        showToast({ title: i18n.t('notificationdrawer.001'), message: result.error || 'Davet kabul edilemedi', type: 'warning' });
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
      showToast({ title: 'Davet Kabul Edilemedi', message: i18n.t('notificationdrawer.002'), type: 'error' });
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
      showToast({ title: '🚫 Davet Reddedildi', message: 'Oda daveti silindi.', type: 'info' });
    } catch {
      showToast({ title: 'Davet Reddedilemedi', message: i18n.t('notificationdrawer.003'), type: 'error' });
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
      showToast({ title: 'Temizlenemedi', message: i18n.t('notificationdrawer.004'), type: 'error' });
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
      showToast({ title: `✓ ${unread.length} bildirim okundu`, type: 'success' });
    } catch {
      showToast({ title: i18n.t('notificationdrawer.005'), message: i18n.t('notificationdrawer.006'), type: 'error' });
    }
  }, [userId, items]);

  const unreadCount = items.filter(n => !n.is_read).length;

  // ★ v108.21: Modernize — bildirimleri zaman gruplarına ayır (Bugün / Bu Hafta / Önceki)
  const sections = (() => {
    const groups: Record<string, NotifItem[]> = { today: [], week: [], older: [] };
    for (const it of items) groups[getTimeGroup(it.created_at)].push(it);
    const result: { title: string; data: NotifItem[] }[] = [];
    if (groups.today.length) result.push({ title: GROUP_LABELS.today, data: groups.today });
    if (groups.week.length) result.push({ title: GROUP_LABELS.week, data: groups.week });
    if (groups.older.length) result.push({ title: GROUP_LABELS.older, data: groups.older });
    return result;
  })();

  // ★ 2026-05-05 modernize v2: Sağdan-açılan yan drawer (FriendsDrawer pattern'i).
  //   Bottom sheet karmaşıktı (Reanimated+Animated çift engine, layout instabilitesi).
  //   Yan drawer: tek engine (Animated), denenmiş, FriendsDrawer ile tutarlı kabuk.
  const slideAnim = useRef(new Animated.Value(DRAWER_W)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);
  const topGap = Math.max((H - DRAWER_H) / 2, insets.top + 12);

  useEffect(() => {
    if (visible) {
      isClosingRef.current = false;
      // ★ Backdrop önce görünsün (flash önleme), panel hafif gecikmeli kayar
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, { toValue: 1, duration: 120, useNativeDriver: true }).start();
      setTimeout(() => {
        Animated.timing(slideAnim, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      }, 40);
    } else {
      if (isClosingRef.current) return;
      slideAnim.setValue(DRAWER_W);
      fadeAnim.setValue(0);
    }
  }, [visible]);

  // ★ 2026-05-05: Animasyonlu kapatma — backdrop tap veya programatik kapatmada
  //   anlık setValue yerine pürüzsüz translateX animasyonu çalışır.
  const closeWithAnim = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: DRAWER_W, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => onClose());
  }, [onClose]);

  // ★ Sürükleyerek kapatma — sağa swipe, FriendsDrawer ile aynı sıkı eşik
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dx > 25 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        const newX = Math.max(0, g.dx);
        slideAnim.setValue(newX);
        fadeAnim.setValue(Math.max(0, 1 - (newX / DRAWER_W) * 0.8));
      },
      onPanResponderRelease: (_, g) => {
        const closeThreshold = DRAWER_W / 3;
        if (g.dx > closeThreshold || g.vx > 0.5) {
          isClosingRef.current = true;
          Animated.parallel([
            Animated.timing(slideAnim, { toValue: DRAWER_W, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
            Animated.timing(fadeAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
          ]).start(() => onClose());
        } else {
          Animated.parallel([
            Animated.timing(slideAnim, { toValue: 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
          ]).start();
        }
      },
    })
  ).current;

  // ★ 2026-05-05: Android back tuşu drawer açıkken kapatma — Modal kaldırıldığı için
  //   onRequestClose yok; manuel BackHandler ile davranışı koru.
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeWithAnim();
      return true;
    });
    return () => sub.remove();
  }, [visible, closeWithAnim]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'box-none' : 'none'}>
      {/* Backdrop — koyu dim, tıklayınca animasyonlu kapanır.
          ★ Alt sınır tab bar üstünde biter (dinamik) → tab bar dim altında kalmaz. */}
      <Animated.View style={[s.backdrop, { bottom: bottomSpace, opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeWithAnim} />
      </Animated.View>

      {/* Yan panel — sağdan kayar */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[s.panel, { top: topGap, bottom: bottomSpace, transform: [{ translateX: slideAnim }] }]}
      >
        {/* Profil sayfası gradient dili — diagonal slate */}
        <LinearGradient
          colors={['#3a4658', '#2a3344', '#1a2030']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        {/* Üst kenar teal accent halo */}
        <LinearGradient
          colors={['rgba(20,184,166,0.22)', 'rgba(20,184,166,0.06)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        {/* Üst-sol diyagonal glow */}
        <LinearGradient
          colors={['rgba(20,184,166,0.08)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.6 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        {/* Header — Bildirimler + okunmamış pill + Temizle */}
        <Pressable
          style={s.header}
          onLongPress={handleMarkAllRead}
          delayLongPress={500}
          accessibilityHint={i18n.t('auto.NotificationDrawer.001')}
        >
          <Ionicons name="notifications" size={20} color="#14B8A6" style={s.headerIcon} />
          <Text style={s.title}>{t('notif.title')}</Text>
          {unreadCount > 0 && (
            <View style={s.badgePill}>
              <Text style={s.badgeText}>{unreadCount}</Text>
            </View>
          )}
          {items.length > 0 && (
            <Pressable
              style={({ pressed }) => [s.clearBtn, pressed && { opacity: 0.6 }]}
              onPress={handleClearAll}
              disabled={clearing}
              hitSlop={8}
            >
              {clearing ? (
                <AppLoader size={13} color="#94A3B8" />
              ) : (
                <Ionicons name="trash-outline" size={15} color="#94A3B8" />
              )}
              <Text style={s.clearBtnText}>{t('common.clear')}</Text>
            </Pressable>
          )}
        </Pressable>
        <View style={s.headerSeparator} />

        {loading ? (
          <UserListSkeleton count={3} showAction={false} />
        ) : items.length === 0 ? (
          <View style={s.emptyState}>
            <View style={s.emptyIconWrap}>
              <Ionicons name="notifications-off-outline" size={28} color="rgba(255,255,255,0.4)" />
            </View>
            <Text style={s.emptyText}>{t('notif.empty')}</Text>
            <Text style={s.emptySub}>{t('notif.empty_sub')}</Text>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: 12, gap: 6 }}
            stickySectionHeadersEnabled={false}
            renderSectionHeader={({ section: { title } }) => (
              <Text style={s.sectionLabel}>{title.toUpperCase()}</Text>
            )}
            renderItem={({ item }) => {
              const icon = getNotifIcon(item.type);

              return (
                <View style={s.notifItemWrap}>
                  <Pressable
                    style={({ pressed }) => [
                      s.notifItem,
                      !item.is_read && s.notifUnread,
                      pressed && { opacity: 0.65 },
                    ]}
                    onPress={() => handlePress(item)}
                  >
                    {/* ★ Sol kenar accent strip — okunmamış için teal vurgu */}
                    {!item.is_read && <View style={s.unreadStrip} />}

                    {/* Avatar + tip ikonu overlay */}
                    <View style={s.avatarWrap}>
                      <StatusAvatar uri={item.sender?.avatar_url} size={42} frameId={(item.sender as any)?.active_frame || null} customBadgeId={(item.sender as any)?.active_badge_id ?? null} />
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
                          <AppLoader size={12} color="#FFF" />
                        ) : (
                          <>
                            <Ionicons name="checkmark" size={13} color="#FFF" />
                            <Text style={s.inviteAcceptText}>{t('common.accept')}</Text>
                          </>
                        )}
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [s.inviteRejectBtn, pressed && { opacity: 0.7 }]}
                        onPress={() => handleRejectInvite(item)}
                        disabled={processingInvites.has(item.id)}
                      >
                        <Ionicons name="close" size={13} color="#94A3B8" />
                        <Text style={s.inviteRejectText}>{t('common.reject')}</Text>
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
            <Text style={s.seeAllText}>{t('notif.see_all')}</Text>
            <Ionicons name="chevron-down" size={14} color="#14B8A6" />
          </Pressable>
        )}
        {showAll && (
          <Pressable style={s.seeAllBtn} onPress={() => { setShowAll(false); loadNotifications(false); }}>
            <Text style={s.seeAllText}>{t('notif.collapse')}</Text>
            <Ionicons name="chevron-up" size={14} color="#14B8A6" />
          </Pressable>
        )}
        {/* ★ Alt fade-out efekti — Çevrimiçi drawer ile aynı koyuluk */}
        <LinearGradient
          colors={['transparent', 'rgba(15,20,35,0.85)', 'rgba(10,14,28,0.95)']}
          locations={[0, 0.6, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={s.bottomFade}
          pointerEvents="none"
        />
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  // ★ 2026-05-05 modernize v2: Yan drawer (sağdan kayar) — FriendsDrawer ile aynı kabuk.
  //   Backdrop alt sınırı tab bar'da biter (TAB_BAR_SPACE) → alt kontroller dim altında
  //   kalmaz, normal renkte görünür. FriendsDrawer Tabs hierarchy'sinde tab bar drawer
  //   üstünde paint olduğu için bu dim'i otomatik atlatıyordu; biz manuel keserek aynı
  //   görsel sonucu sağlıyoruz.
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    // bottom inline veriliyor (dinamik — safe area dahil)
    backgroundColor: 'rgba(8,12,22,0.45)',
  },
  panel: {
    position: 'absolute', right: 0,
    width: DRAWER_W,
    borderTopLeftRadius: 26, borderBottomLeftRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#0d1520',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingTop: 16, paddingBottom: 12,
  },
  headerSeparator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 12,
  },
  // ★ Eski (kullanılmıyor)
  headerGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 60,
    pointerEvents: 'none',
  },
  title: {
    fontSize: 15, fontWeight: '800', color: '#F1F5F9', flex: 1,
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  badgePill: {
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 100, minWidth: 20, alignItems: 'center',
    backgroundColor: 'rgba(20,184,166,0.18)',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.45)',
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#5EEAD4', letterSpacing: 0.3 },
  emptyState: {
    alignItems: 'center', paddingVertical: 56, gap: 14,
  },
  emptyIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyText: { fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: '600', letterSpacing: 0.3 },
  emptySub: { fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: -8 },
  separator: {
    height: 1, backgroundColor: 'rgba(255,255,255,0.04)',
    marginHorizontal: 16,
  },
  // ★ v108.21: Section label — gruplar arası ayraç başlık (Bugün / Bu Hafta / Önceki)
  sectionLabel: {
    fontSize: 10, fontWeight: '800', color: 'rgba(20,184,166,0.65)',
    letterSpacing: 1.6, textTransform: 'uppercase',
    paddingHorizontal: 6, paddingTop: 8, paddingBottom: 4,
  },
  // ★ v108.21: Item wrapper — radius + soft bg, separator yerine kart-stili gap
  notifItemWrap: {
    borderRadius: 14, overflow: 'hidden',
  },
  notifItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, paddingHorizontal: 14, paddingLeft: 16,
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    position: 'relative',
  },
  notifUnread: {
    backgroundColor: 'rgba(20,184,166,0.10)',
    borderColor: 'rgba(20,184,166,0.25)',
  },
  // ★ v108.21: Sol kenar accent strip — okunmamış vurgu (Discord/Slack tarzı)
  unreadStrip: {
    position: 'absolute', left: 0, top: 8, bottom: 8, width: 3,
    borderRadius: 2,
    backgroundColor: '#14B8A6',
    shadowColor: '#14B8A6', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 4,
  },
  avatarWrap: {
    position: 'relative',
  },
  notifAvatar: { width: 42, height: 42, borderRadius: 21 },
  typeIconBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#2f3b4a',
    // ★ v109.3: AvatarFrame (zIndex:1) üstünde kalsın, frame border'ının arkasına gizlenmesin
    zIndex: 4,
    elevation: 7,
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

  // ★ 2026-05-05: Halka kaldırıldı — sadece zil + altta koyu drop shadow.
  //   Kullanıcı talebi: altındaki gölge koyu olsun (klasik depth shadow).
  headerIcon: {
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  // ★ v108.21 modernize: Temizle butonu soft slate (kırmızı yerine), kompakt + zarif
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  clearBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.3,
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
  // ★ 2026-04-26: "Tamam" tek-buton, tam genişlik primary CTA (eski iki ufak buton yerine)
  thankCloseBtnFull: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(20,184,166,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.4)',
    alignItems: 'center',
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
  // ★ Alt fade-out koyuluk efekti — Çevrimiçi drawer ile aynı
  bottomFade: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: 60,
    borderBottomLeftRadius: 26,
  },
});
