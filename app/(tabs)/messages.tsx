import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Image, Pressable, ActivityIndicator, TextInput, ScrollView, Animated as RNAnimated, PanResponder, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useRouter } from 'expo-router';
import { Colors, Shadows } from '../../constants/theme';
import { MessageService, ProfileService, type InboxItem, type Message } from '../../services/database';
import { supabase } from '../../constants/supabase';
import { useAuth, useBadges, useTheme, useOnlineFriends } from '../_layout';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import StatusAvatar from '../../components/StatusAvatar';
import { UserSearchModal } from '../../components/UserSearchModal';
import AppBackground from '../../components/AppBackground';
import TabBarFadeOut from '../../components/TabBarFadeOut';
import { showToast } from '../../components/Toast';
import NotificationBell from '../../components/NotificationBell';
import { getRelativeTime } from '../../constants/time';
import { getAvatarSource } from '../../constants/avatars';
import PremiumAlert, { type AlertButton } from '../../components/PremiumAlert';
import ConversationActionSheet, { type SheetAction } from '../../components/ConversationActionSheet';
import { ModerationService } from '../../services/moderation';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ═══ Skeleton Card — Initial load'da iskelet gösterimi ═══
function SkeletonCard() {
  const pulseAnim = useRef(new RNAnimated.Value(0.3)).current;
  useEffect(() => {
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulseAnim, { toValue: 0.7, duration: 900, useNativeDriver: true }),
        RNAnimated.timing(pulseAnim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <RNAnimated.View style={[skStyles.card, { opacity: pulseAnim }]}>
      <View style={skStyles.avatar} />
      <View style={skStyles.lines}>
        <View style={skStyles.lineLong} />
        <View style={skStyles.lineShort} />
      </View>
      <View style={skStyles.timePill} />
    </RNAnimated.View>
  );
}
function SkeletonList() {
  return (
    <View style={{ paddingTop: 6 }}>
      {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
    </View>
  );
}
const skStyles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 14, marginVertical: 5,
    padding: 14, borderRadius: 20,
    backgroundColor: 'rgba(6,10,18,0.58)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.08)' },
  lines: { flex: 1, gap: 8 },
  lineLong: { height: 12, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)', width: '60%' },
  lineShort: { height: 10, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', width: '85%' },
  timePill: { width: 36, height: 10, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)' },
});

// ═══ Memoized Conversation Card — FlatList re-render'ı izole ═══
// ★ 2026-04-21: TypingDots — "yazıyor" metninin sağında 3 animasyonlu nokta,
//   teker teker parlar (typing indicator). Typing state aktifken loop eder, kapanınca durur.
function TypingDots() {
  const d1 = useRef(new RNAnimated.Value(0.3)).current;
  const d2 = useRef(new RNAnimated.Value(0.3)).current;
  const d3 = useRef(new RNAnimated.Value(0.3)).current;
  useEffect(() => {
    const make = (v: RNAnimated.Value, delay: number) => RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.delay(delay),
        RNAnimated.timing(v, { toValue: 1, duration: 250, useNativeDriver: true }),
        RNAnimated.timing(v, { toValue: 0.3, duration: 250, useNativeDriver: true }),
        RNAnimated.delay(Math.max(0, 450 - delay)),
      ])
    );
    const a1 = make(d1, 0);
    const a2 = make(d2, 150);
    const a3 = make(d3, 300);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);
  const dot = (v: RNAnimated.Value) => (
    <RNAnimated.View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.teal, opacity: v, marginLeft: 2 }} />
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 4 }}>
      {dot(d1)}{dot(d2)}{dot(d3)}
    </View>
  );
}

const ConversationCard = React.memo(function ConversationCard({
  item, isSelected, selectionMode, isFriend, isTyping,
  onOpenChat, onToggleSelection, onLongPress, onDelete, onAvatarPress, onCallPress,
}: {
  item: InboxItem;
  isSelected: boolean;
  selectionMode: boolean;
  isFriend: boolean;
  isTyping: boolean;
  onOpenChat: (partnerId: string) => void;
  onToggleSelection: (partnerId: string) => void;
  onLongPress: (item: InboxItem) => void;
  onDelete: (partnerId: string) => void;
  onAvatarPress: (partnerId: string) => void;
  onCallPress: (partnerId: string) => void;
}) {
  const unread = item.unread_count > 0;
  const cardGradient = isSelected
    ? ['rgba(10,15,28,0.98)', 'rgba(20,184,166,0.10)', 'rgba(45,212,191,0.16)', 'rgba(20,184,166,0.08)', 'rgba(10,15,28,0.98)']
    : unread
      ? ['rgba(11,18,32,0.98)', 'rgba(56,189,248,0.09)', 'rgba(147,197,253,0.15)', 'rgba(56,189,248,0.07)', 'rgba(11,18,32,0.98)']
      : ['rgba(10,15,28,0.97)', 'rgba(37,99,235,0.08)', 'rgba(255,255,255,0.09)', 'rgba(37,99,235,0.07)', 'rgba(10,15,28,0.97)'];
  return (
    <SwipeableRow
      containerStyle={[styles.msgCard, isSelected && styles.msgCardSelected, unread && styles.msgCardUnread]}
      onDelete={() => onDelete(item.partner_id)}
    >
      <Pressable
        style={styles.msgPressable}
        android_ripple={{ color: 'rgba(255,255,255,0.04)' }}
        onPress={() => selectionMode ? onToggleSelection(item.partner_id) : onOpenChat(item.partner_id)}
        onLongPress={() => onLongPress(item)}
        delayLongPress={400}
      >
        <LinearGradient
          colors={cardGradient as [string, string, string, string, string]}
          locations={[0, 0.28, 0.5, 0.72, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.msgRow}
        >
          {unread && <View style={styles.unreadStripe} />}
          {selectionMode && (
            <View style={styles.checkWrap}>
              <Ionicons name={isSelected ? 'checkbox' : 'square-outline'} size={22} color={isSelected ? Colors.teal : 'rgba(255,255,255,0.3)'} />
            </View>
          )}
          <Pressable style={styles.avatarWrap} onPress={() => onAvatarPress(item.partner_id)}>
            <StatusAvatar uri={item.partner_avatar} size={52} isOnline={item.partner_is_online} tier={item.partner_tier} />
          </Pressable>
          <View style={styles.msgInfo}>
            <View style={styles.msgTop}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, marginRight: 8 }}>
                {item.is_pinned && (
                  <Ionicons name="pin" size={11} color={Colors.teal} />
                )}
                <Text style={[styles.msgName, unread && styles.msgNameUnread]} numberOfLines={1}>
                  {item.partner_name}
                </Text>
                {item.is_muted && (
                  <Ionicons name="notifications-off" size={11} color="rgba(255,255,255,0.35)" />
                )}
              </View>
              <Text style={[styles.msgTime, unread && styles.msgTimeUnread]}>
                {getRelativeTime(item.last_message_time)}
              </Text>
            </View>
            <View style={styles.msgPreviewRow}>
              {isTyping ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[styles.msgText, { color: Colors.teal, fontWeight: '700' }]} numberOfLines={1}>
                    yazıyor
                  </Text>
                  <TypingDots />
                </View>
              ) : (
                <>
                  {item.is_last_msg_mine && (
                    <Ionicons
                      name="checkmark-done"
                      size={14}
                      color={item.is_last_msg_read ? Colors.teal : 'rgba(255,255,255,0.3)'}
                      style={{ marginRight: 2 }}
                    />
                  )}
                  <Text style={[styles.msgText, unread && styles.msgTextUnread]} numberOfLines={1}>
                    {item.is_last_msg_mine
                      ? item.last_message_content?.replace(/^Sen:\s*/, '')
                      : item.last_message_content}
                  </Text>
                </>
              )}
            </View>
          </View>
          <View style={styles.msgRight}>
            {isFriend && !selectionMode && (
              <Pressable
                style={styles.msgCallBtn}
                onPress={(e) => { e.stopPropagation?.(); onCallPress(item.partner_id); }}
              >
                <Ionicons name="call" size={14} color="#4ADE80" />
              </Pressable>
            )}
            {unread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadCountText}>{item.unread_count > 99 ? '99+' : item.unread_count}</Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </Pressable>
    </SwipeableRow>
  );
});

// ═══ Pure-RN Swipe-to-Delete Row ═══
function SwipeableRow({ children, onDelete, containerStyle }: { children: React.ReactNode; onDelete: () => void; containerStyle?: any }) {
  const translateX = useRef(new RNAnimated.Value(0)).current;
  const [isOpen, setIsOpen] = useState(false);
  const hapticTriggeredRef = useRef(false); // Threshold geçişinde sadece 1 kere
  const deleteOpacity = translateX.interpolate({ inputRange: [-80, -20, 0], outputRange: [1, 0.6, 0], extrapolate: 'clamp' });
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 15 && Math.abs(gs.dy) < 15,
      onPanResponderGrant: () => { hapticTriggeredRef.current = false; },
      onPanResponderMove: (_, gs) => {
        if (gs.dx < 0) {
          translateX.setValue(Math.max(gs.dx, -90));
          // ★ 2026-04-21: Swipe threshold geçişinde tek sefer haptic feedback
          if (gs.dx < -60 && !hapticTriggeredRef.current) {
            hapticTriggeredRef.current = true;
            try {
              const Haptics = require('expo-haptics');
              Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle?.Medium);
            } catch {}
          } else if (gs.dx > -60) {
            hapticTriggeredRef.current = false; // Geri çekerse sıfırla
          }
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -60) {
          RNAnimated.spring(translateX, { toValue: -80, useNativeDriver: true, tension: 100, friction: 10 }).start();
          setIsOpen(true);
        } else {
          RNAnimated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 100, friction: 10 }).start();
          setIsOpen(false);
        }
      },
    })
  ).current;

  const closeSwipe = () => {
    RNAnimated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 100, friction: 10 }).start();
    setIsOpen(false);
  };

  return (
    <View style={containerStyle}>
      <View style={styles.swipeClip}>
        <RNAnimated.View style={[styles.swipeDeleteBtn, { opacity: deleteOpacity }]}>
          <Pressable onPress={onDelete} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 4 }}>
            <Ionicons name="trash-outline" size={18} color="#FFF" />
            <Text style={styles.swipeDeleteText}>Sil</Text>
          </Pressable>
        </RNAnimated.View>
        <RNAnimated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
          {children}
        </RNAnimated.View>
        {/* ★ Açık swipe üzerinde overlay — herhangi bir tap snap-back yapar (iOS Mail/WhatsApp pattern) */}
        {isOpen && (
          <Pressable
            style={[StyleSheet.absoluteFillObject, { right: 80 }]}
            onPress={closeSwipe}
          />
        )}
      </View>
    </View>
  );
}

export default function MessagesScreen() {
  const router = useRouter();
  const { firebaseUser, profile, setShowNotifDrawer, setNotifDrawerAnchorRight } = useAuth();
  const { refreshBadges } = useBadges();
  useTheme();
  const [conversations, setConversations] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // ★ 2026-04-21: Error state — empty state'ten ayır, retry butonu göster.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // ★ Debounced sorgu — her karakter 100+ yeniden render yapıyordu
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const { onlineFriends, friendIds, blockedIdsRef, refreshFriends } = useOnlineFriends();
  const { unreadNotifs: unreadCount } = useBadges();
  type AlertState = {
    visible: boolean;
    title: string;
    message: string;
    type?: 'info' | 'warning' | 'error' | 'success';
    buttons?: AlertButton[];
  };
  const [cAlert, setCAlert] = useState<AlertState>({ visible: false, title: '', message: '' });
  // ★ 2026-04-21: Long-press action sheet state — PremiumAlert yerine modern bottom sheet.
  const [sheetItem, setSheetItem] = useState<InboxItem | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // ★ Yazıyor... — listedeki konuşmalarda canlı typing indicator
  const [typingPartners, setTypingPartners] = useState<Set<string>>(new Set());
  const typingTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  // ★ Arşiv görünümü — varsayılan: normal (arşivsiz), toggle ile arşivlenenleri göster
  const [showArchived, setShowArchived] = useState(false);
  // ★ 2026-04-22: Mesaj istekleri görünümü — Instagram-style "İstekler" bölümü
  const [showRequests, setShowRequests] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  // ★ Görünür liste: arşiv modu açık → sadece arşivlenmiş, kapalı → arşivsiz
  // ★ 2026-04-21: Arama artık son mesaj içeriğinde de çalışıyor (partner_name + last_message_content).
  const filteredConversations = useMemo(() => {
    const base = conversations.filter(c => showArchived ? c.is_archived : !c.is_archived);
    if (!debouncedQuery.trim()) return base;
    const q = debouncedQuery.toLowerCase();
    return base.filter(c =>
      c.partner_name.toLowerCase().includes(q) ||
      (c.last_message_content || '').toLowerCase().includes(q)
    );
  }, [conversations, debouncedQuery, showArchived]);

  // Arşivlenmiş sohbet sayısı — toggle chip için
  const archivedCount = useMemo(
    () => conversations.filter(c => c.is_archived).length,
    [conversations]
  );

  const loadInbox = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      setLoadError(null);
      const inbox = await MessageService.getInbox(firebaseUser.uid);
      const hiddenMap = await MessageService.getHiddenConversations(firebaseUser.uid);
      const filtered = inbox.filter(c => {
        if (blockedIdsRef.current.has(c.partner_id)) return false;
        // ★ 2026-04-21: Hidden entry varsa filtrele (auto-unhide kaldırıldı)
        if (hiddenMap[c.partner_id]) return false;
        return true;
      });
      setConversations(filtered);
      // ★ 2026-04-22: Pending mesaj isteklerini paralel çek
      try {
        const reqs = await MessageService.getPendingRequests(firebaseUser.uid);
        setPendingRequests(reqs || []);
      } catch {}
    } catch (err: any) {
      if (__DEV__) console.warn('Mesajlar yüklenemedi:', err);
      const msg = err?.message || 'İnternet bağlantını kontrol et.';
      setLoadError(msg);
      showToast({ title: 'Mesajlar yüklenemedi', message: msg, type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [firebaseUser]);

  useFocusEffect(
    useCallback(() => {
      loadInbox();
      refreshFriends();
      refreshBadges();
    }, [loadInbox, refreshFriends, refreshBadges])
  );

  useEffect(() => {
    const onlineIdSet = new Set(onlineFriends.map(f => f.id));
    setConversations(prev => {
      let changed = false;
      const updated = prev.map(c => {
        const shouldBeOnline = onlineIdSet.has(c.partner_id);
        if (c.partner_is_online !== shouldBeOnline) {
          changed = true;
          return { ...c, partner_is_online: shouldBeOnline };
        }
        return c;
      });
      return changed ? updated : prev;
    });
  }, [onlineFriends]);

  useEffect(() => {
    if (!firebaseUser) return;
    const updateInbox = async (newMsg: Message) => {
      const otherId = newMsg.sender_id === firebaseUser.uid ? newMsg.receiver_id : newMsg.sender_id;
      if (blockedIdsRef.current.has(otherId)) return;
      const isSentByMe = newMsg.sender_id === firebaseUser.uid;

      let partnerName = 'Kullanıcı';
      let partnerAvatar = '';
      let partnerOnline = false;
      let resolved = false;

      if (!isSentByMe && newMsg.sender) {
        partnerName = newMsg.sender.display_name || 'Kullanıcı';
        partnerAvatar = newMsg.sender.avatar_url || '';
        partnerOnline = newMsg.sender.is_online || false;
        resolved = true;
      }
      if (!resolved && isSentByMe && newMsg.receiver) {
        partnerName = newMsg.receiver.display_name || 'Kullanıcı';
        partnerAvatar = newMsg.receiver.avatar_url || '';
        partnerOnline = newMsg.receiver.is_online || false;
        resolved = true;
      }
      if (!resolved) {
        setConversations(prev => {
          const existingIdx = prev.findIndex(c => c.partner_id === otherId);
          if (existingIdx >= 0) {
            partnerName = prev[existingIdx].partner_name;
            partnerAvatar = prev[existingIdx].partner_avatar;
            partnerOnline = prev[existingIdx].partner_is_online;
            resolved = true;
          }
          return prev;
        });
      }
      if (!resolved) {
        try {
          const prof = await ProfileService.get(otherId);
          if (prof) {
            partnerName = prof.display_name || 'Kullanıcı';
            partnerAvatar = prof.avatar_url || '';
            partnerOnline = prof.is_online || false;
          }
        } catch {}
      }

      // ★ 2026-04-21: Silinen sohbet artık auto-unhide OLMAZ.
      //   Kullanıcı sildiğinde kalıcı olarak gizli kalır. Sadece explicit olarak (push/profile/search
      //   üzerinden) chat ekranına geçerse chat screen hidden entry'yi temizler ve görünür hale gelir.
      const hiddenMap = await MessageService.getHiddenConversations(firebaseUser.uid);
      if (hiddenMap[otherId]) {
        return; // Hidden kalıyor — inbox'a eklenmez
      }

      setConversations(prev => {
        const existingIdx = prev.findIndex(c => c.partner_id === otherId);
        const newItem: InboxItem = {
          partner_id: otherId,
          partner_name: partnerName,
          partner_avatar: partnerAvatar,
          partner_is_online: partnerOnline,
          last_message_content: isSentByMe ? `Sen: ${newMsg.content}` : newMsg.content,
          last_message_time: newMsg.created_at,
          unread_count: isSentByMe
            ? (existingIdx >= 0 ? prev[existingIdx].unread_count : 0)
            : (existingIdx >= 0 ? prev[existingIdx].unread_count + 1 : 1),
          is_last_msg_mine: isSentByMe,
          is_last_msg_read: isSentByMe ? !!newMsg.is_read : undefined,
        };
        const filtered = prev.filter(c => c.partner_id !== otherId);
        return [newItem, ...filtered];
      });

      if (!isSentByMe) refreshBadges();
    };

    const incomingChannel = MessageService.onNewMessage(firebaseUser.uid, updateInbox);
    const sentChannelName = `user_sent_${firebaseUser.uid}`;
    const sentChannel = supabase
      .channel(sentChannelName)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `sender_id=eq.${firebaseUser.uid}`,
      }, async (payload) => {
        const { data } = await supabase
          .from('messages')
          .select('*, sender:profiles!sender_id(*), receiver:profiles!receiver_id(*)')
          .eq('id', payload.new.id)
          .single();
        if (data && !(data as Message).is_deleted) updateInbox(data as Message);
      })
      // ★ UPDATE: Karşı taraf okuduğunda is_read flip olur → ✓ → ✓✓ (teal) anında
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `sender_id=eq.${firebaseUser.uid}`,
      }, (payload) => {
        const updated = payload.new as any;
        if (!updated.is_read) return; // sadece read=true geçişlerini yakala
        setConversations(prev => prev.map(c => {
          if (c.partner_id !== updated.receiver_id) return c;
          if (!c.is_last_msg_mine) return c;
          if (c.is_last_msg_read === true) return c;
          return { ...c, is_last_msg_read: true };
        }));
      })
      .subscribe();

    return () => {
      incomingChannel.unsubscribe();
      supabase.removeChannel(sentChannel);
    };
  }, [firebaseUser, refreshBadges, blockedIdsRef]);

  // ★ Typing broadcast dinleyicisi — listede "yazıyor..." göstergesi
  useEffect(() => {
    if (!firebaseUser) return;
    const timeouts = typingTimeoutsRef.current;
    const typingChannel = MessageService.onTypingStatus(firebaseUser.uid, (payload) => {
      if (payload.conversation_partner_id !== firebaseUser.uid) return;
      const senderId = payload.user_id;
      // Engellenmişse görmezden gel
      if (blockedIdsRef.current.has(senderId)) return;

      if (payload.is_typing) {
        setTypingPartners(prev => {
          if (prev.has(senderId)) return prev;
          const next = new Set(prev); next.add(senderId); return next;
        });
        // 3s auto-clear — karşı taraf durduğunda is_typing=false gelmezse
        const existing = timeouts.get(senderId);
        if (existing) clearTimeout(existing);
        timeouts.set(senderId, setTimeout(() => {
          setTypingPartners(prev => { const n = new Set(prev); n.delete(senderId); return n; });
          timeouts.delete(senderId);
        }, 3000));
      } else {
        setTypingPartners(prev => { const n = new Set(prev); n.delete(senderId); return n; });
        const existing = timeouts.get(senderId);
        if (existing) { clearTimeout(existing); timeouts.delete(senderId); }
      }
    });
    return () => {
      // ★ 2026-04-20 FIX: unsubscribe() kanalı siler ama Supabase client cache'inde
      //   referans kalabilir. removeChannel() ile bellek sızıntısını önle.
      typingChannel.unsubscribe();
      supabase.removeChannel(typingChannel);
      timeouts.forEach(t => clearTimeout(t));
      timeouts.clear();
    };
  }, [firebaseUser, blockedIdsRef]);

  const insets = useSafeAreaInsets();

  // ═══ Stable card callbacks — React.memo ile birlikte FlatList perf'i sağlar ═══
  const handleOpenChat = useCallback((partnerId: string) => {
    router.push(`/chat/${partnerId}` as any);
  }, [router]);

  const handleToggleSelection = useCallback((partnerId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(partnerId)) next.delete(partnerId);
      else next.add(partnerId);
      return next;
    });
  }, []);

  const handleDeleteConversation = useCallback(async (partnerId: string) => {
    if (!firebaseUser) return;
    try {
      await MessageService.markAsRead(firebaseUser.uid, partnerId);
      await MessageService.deleteConversation(firebaseUser.uid, partnerId);
      setConversations(prev => prev.filter(c => c.partner_id !== partnerId));
      refreshBadges();
    } catch {
      showToast({ title: 'Silinemedi', message: 'Sohbet silinemedi, tekrar dene.', type: 'error' });
    }
  }, [firebaseUser, refreshBadges]);

  const handleAvatarPress = useCallback((partnerId: string) => {
    router.push(`/user/${partnerId}` as any);
  }, [router]);

  // ★ 2026-04-21: initiateCall çağrılıyor — eskiden sadece navigate vardı,
  //   friendship check ve callId tetiklenmiyordu → arama sessizce bağlanamıyordu.
  const handleCallPress = useCallback(async (partnerId: string) => {
    if (!firebaseUser || !profile) return;
    try {
      const { CallService } = require('../../services/call');
      const tier = (profile as any)?.subscription_tier || 'Free';
      const { callId, receiverIsOnline } = await CallService.initiateCall(
        firebaseUser.uid,
        profile.display_name || 'Kullanıcı',
        profile.avatar_url || undefined,
        partnerId, 'audio', tier
      );
      router.push(`/call/${partnerId}?callId=${callId}&callType=audio&isIncoming=false&receiverOnline=${receiverIsOnline}` as any);
    } catch (err: any) {
      showToast({ title: 'Arama Hatası', message: err?.message || 'Arama başlatılamadı.', type: 'error' });
    }
  }, [firebaseUser, profile, router]);

  // ★ Pin toggle — optimistic update + RPC, hata durumunda geri al
  const handleTogglePin = useCallback(async (partnerId: string) => {
    const current = conversations.find(c => c.partner_id === partnerId);
    if (!current) return;
    const newPinned = !current.is_pinned;
    // Optimistic update + resort
    setConversations(prev => {
      const updated = prev.map(c => c.partner_id === partnerId ? { ...c, is_pinned: newPinned } : c);
      return [...updated].sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime();
      });
    });
    try {
      await MessageService.togglePin(partnerId, firebaseUser?.uid);
      showToast({
        title: newPinned ? '📌 Sabitlendi' : 'Sabitleme kaldırıldı',
        type: 'success',
      });
    } catch {
      // Rollback
      setConversations(prev => prev.map(c =>
        c.partner_id === partnerId ? { ...c, is_pinned: current.is_pinned } : c));
      showToast({ title: 'Hata', message: 'İşlem tamamlanamadı.', type: 'error' });
    }
  }, [conversations]);

  // ★ Archive toggle — optimistic update + RPC
  const handleToggleArchive = useCallback(async (partnerId: string, partnerName: string) => {
    const current = conversations.find(c => c.partner_id === partnerId);
    if (!current) return;
    const newArchived = !current.is_archived;
    setConversations(prev => prev.map(c =>
      c.partner_id === partnerId ? { ...c, is_archived: newArchived } : c));
    try {
      await MessageService.toggleArchive(partnerId, firebaseUser?.uid);
      showToast({
        title: newArchived ? `🗄️ ${partnerName} arşivlendi` : `↩️ Arşivden çıkarıldı`,
        message: newArchived ? 'Yeni mesaj gelince otomatik geri çıkacak.' : undefined,
        type: 'success',
      });
    } catch {
      setConversations(prev => prev.map(c =>
        c.partner_id === partnerId ? { ...c, is_archived: current.is_archived } : c));
      showToast({ title: 'Hata', message: 'İşlem tamamlanamadı.', type: 'error' });
    }
  }, [conversations]);

  const handleBlockUser = useCallback(async (partnerId: string, partnerName: string) => {
    if (!firebaseUser) return;
    try {
      await ModerationService.blockUser(firebaseUser.uid, partnerId);
      setConversations(prev => prev.filter(c => c.partner_id !== partnerId));
      showToast({ title: '⛔ Engellendi', message: `${partnerName} engellendi.`, type: 'success' });
    } catch {
      showToast({ title: 'Hata', message: 'Engellenemedi.', type: 'error' });
    }
  }, [firebaseUser]);

  // ★ 2026-04-21: Long-press → bottom sheet (eski PremiumAlert modal'ı yerine).
  //   Sheet daha modern, native hissi, swipe-to-dismiss + haptic.
  const handleLongPress = useCallback((item: InboxItem) => {
    setSheetItem(item);
  }, []);

  // Sheet action'ları dinamik olarak builder fonksiyonla üret (partner durumuna göre).
  const sheetActions: SheetAction[] = sheetItem ? [
    ...(friendIds.has(sheetItem.partner_id) ? [{
      id: 'call',
      label: 'Sesli Ara',
      icon: 'call' as const,
      style: 'primary' as const,
      onPress: () => handleCallPress(sheetItem.partner_id),
    }] : []),
    {
      id: 'pin',
      label: sheetItem.is_pinned ? 'Sabitlemeyi Kaldır' : 'Sabitle',
      icon: (sheetItem.is_pinned ? 'pin-outline' : 'pin') as any,
      onPress: () => handleTogglePin(sheetItem.partner_id),
    },
    {
      id: 'archive',
      label: sheetItem.is_archived ? 'Arşivden Çıkar' : 'Arşivle',
      icon: (sheetItem.is_archived ? 'arrow-undo' : 'archive') as any,
      onPress: () => handleToggleArchive(sheetItem.partner_id, sheetItem.partner_name),
    },
    {
      id: 'delete',
      label: 'Sohbeti Sil',
      icon: 'trash' as const,
      style: 'destructive' as const,
      onPress: () => handleDeleteConversation(sheetItem.partner_id),
    },
    {
      id: 'block',
      label: 'Engelle',
      icon: 'ban' as const,
      style: 'destructive' as const,
      onPress: () => handleBlockUser(sheetItem.partner_id, sheetItem.partner_name),
    },
  ] : [];

  return (
    <AppBackground variant="messages">
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>

      {/* ═══ Header ═══ */}
      <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
        <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
        <View style={styles.headerRight}>
          <NotificationBell unreadCount={unreadCount} onPress={() => { setNotifDrawerAnchorRight(60); setShowNotifDrawer(true); }} />
          <Pressable style={[styles.headerIconBtn, styles.composeBtn]} onPress={() => setShowComposeModal(true)}>
            <Ionicons name="create-outline" size={19} color="#F1F5F9" />
          </Pressable>
        </View>
      </View>

      {/* ═══ Sayfa Başlığı ═══ */}
      <View style={styles.pageTitleRow}>
        <View>
          <Text style={styles.headerTitle}>Mesajlar</Text>
          <Text style={styles.headerSub}>
            {conversations.length > 0 ? `${conversations.length} sohbet` : 'Sohbetlerin'}
          </Text>
        </View>
        {conversations.length > 0 && (
          <Pressable
            style={[styles.editBtn, selectionMode && styles.editBtnActive]}
            onPress={() => {
              if (selectionMode) { setSelectionMode(false); setSelectedIds(new Set()); }
              else setSelectionMode(true);
            }}
          >
            <Text style={[styles.editBtnText, selectionMode && { color: '#F87171' }]}>
              {selectionMode ? 'Vazgeç' : 'Düzenle'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* ═══ Arama Çubuğu ═══ */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={15} color={Colors.teal} style={{ textShadowColor: Colors.teal, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6 }} />
        <View style={styles.searchInputWrap}>
          <TextInput
            style={styles.searchInput}
            placeholder=""
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />
          {searchQuery.length === 0 && (
            <View pointerEvents="none" style={styles.searchPlaceholderWrap}>
              <Text style={styles.searchPlaceholder}>Sohbet ara...</Text>
            </View>
          )}
        </View>
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.3)" />
          </Pressable>
        )}
      </View>

      {/* ═══ Online Arkadaşlar — horizontal FlatList (nested ScrollView'den dönüştürüldü) ═══
         ★ 2026-04-21: ScrollView içinde FlatList = Android momentum glitch + warning.
         FlatList ile virtualization + keyExtractor. */}
      {onlineFriends.length > 0 && (
        <View style={styles.friendSection}>
          <View style={styles.friendSectionHeader}>
            <View style={styles.onlineDot} />
            <Text style={styles.friendSectionTitle}>Çevrimiçi</Text>
            <View style={styles.friendCountBadge}>
              <Text style={styles.friendCountText}>{onlineFriends.length}</Text>
            </View>
          </View>
          <FlatList
            horizontal
            data={onlineFriends}
            keyExtractor={(f) => f.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.friendStrip}
            removeClippedSubviews
            initialNumToRender={8}
            renderItem={({ item: friend }) => (
              <Pressable
                style={styles.friendChip}
                onPress={() => router.push(`/chat/${friend.id}`)}
              >
                <StatusAvatar uri={friend.avatar_url} size={52} isOnline={true} tier={(friend as any).subscription_tier} />
                <Text style={styles.friendName} numberOfLines={1}>{friend.display_name?.split(' ')[0] || 'Kullanıcı'}</Text>
              </Pressable>
            )}
          />
        </View>
      )}

      {/* ═══ 2026-04-22: Mesaj İstekleri + Arşiv chip — yan yana */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 14, marginTop: 2 }}>
        {/* İstekler chip — pending request varsa belirginleşir */}
        <Pressable
          style={[styles.archiveChip, { flex: 1, marginHorizontal: 0 }, pendingRequests.length === 0 && !showRequests && { opacity: 0.5 }]}
          onPress={() => {
            if (pendingRequests.length === 0 && !showRequests) {
              showToast({ title: 'İstek yok', message: 'Bekleyen mesaj isteğin yok.', type: 'info' });
              return;
            }
            setShowRequests(v => !v);
            if (!showRequests) setShowArchived(false); // tek mod aktif
          }}
        >
          <Ionicons
            name={showRequests ? 'arrow-back' : 'mail-unread-outline'}
            size={16}
            color={pendingRequests.length === 0 && !showRequests ? 'rgba(94,234,212,0.5)' : '#60A5FA'}
          />
          <Text style={[styles.archiveChipText, { color: '#93C5FD' }]}>
            {showRequests ? `Geri` : `İstekler (${pendingRequests.length})`}
          </Text>
          <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.3)" />
        </Pressable>

        <Pressable
          style={[styles.archiveChip, { flex: 1, marginHorizontal: 0 }, archivedCount === 0 && !showArchived && { opacity: 0.5 }]}
          onPress={() => {
            if (archivedCount === 0 && !showArchived) {
              showToast({ title: 'Arşiv boş', message: 'Henüz arşivlenmiş sohbetin yok.', type: 'info' });
              return;
            }
            setShowArchived(v => !v);
            if (!showArchived) setShowRequests(false); // tek mod aktif
          }}
        >
          <Ionicons
            name={showArchived ? 'arrow-back' : 'archive'}
            size={16}
            color={archivedCount === 0 && !showArchived ? 'rgba(94,234,212,0.5)' : Colors.teal}
          />
          <Text style={[styles.archiveChipText, archivedCount === 0 && !showArchived && { color: 'rgba(255,255,255,0.5)' }]}>
            {showArchived ? `Geri` : `Arşiv (${archivedCount})`}
          </Text>
          <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.3)" />
        </Pressable>
      </View>

      {/* ═══ 2026-04-22: Mesaj İstekleri Listesi (showRequests=true iken) ═══ */}
      {showRequests ? (
        pendingRequests.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Ionicons name="mail-open-outline" size={40} color="rgba(148,163,184,0.4)" />
            <Text style={{ marginTop: 10, fontSize: 13, color: '#94A3B8' }}>Bekleyen mesaj isteği yok</Text>
          </View>
        ) : (
          <FlatList
            data={pendingRequests}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 6, paddingBottom: 20 }}
            renderItem={({ item }: any) => {
              const sender = item.sender || {};
              return (
                <Pressable
                  onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.sender_id } } as any)}
                  style={({ pressed }) => [{
                    flexDirection: 'row', alignItems: 'center', gap: 10,
                    paddingHorizontal: 14, paddingVertical: 10,
                    backgroundColor: pressed ? 'rgba(96,165,250,0.08)' : 'transparent',
                  }]}>
                  <Image source={getAvatarSource(sender.avatar_url)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#1E293B' }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#F1F5F9' }} numberOfLines={1}>
                      {sender.display_name || 'Kullanıcı'}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }} numberOfLines={1}>
                      Sizinle mesajlaşmak istiyor — dokun ve cevap ver
                    </Text>
                  </View>
                  <View style={{ backgroundColor: 'rgba(59,130,246,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#60A5FA' }}>İstek</Text>
                  </View>
                </Pressable>
              );
            }}
          />
        )
      ) : loading ? (
        <SkeletonList />
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.partner_id}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={7}
          initialNumToRender={12}
          contentContainerStyle={{ paddingTop: 6, paddingBottom: 20 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await loadInbox();
                await refreshFriends();
                refreshBadges();
                setRefreshing(false);
              }}
              tintColor="#2DD4BF"
              colors={['#2DD4BF']}
            />
          }
          ListEmptyComponent={
            loadError ? (
              // ★ 2026-04-21: Hata state — empty'den ayrı, retry butonu
              <View style={styles.emptyWrap}>
                <Ionicons name="cloud-offline-outline" size={64} color="#EF4444" style={styles.emptyIcon} />
                <Text style={styles.emptyTitle}>Bağlantı sorunu</Text>
                <Text style={styles.emptySubtitle}>{loadError}</Text>
                <Pressable style={styles.emptyActionBtn} onPress={() => { setLoading(true); loadInbox(); }}>
                  <LinearGradient
                    colors={['#EF4444', '#DC2626']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.emptyActionGrad}
                  >
                    <Ionicons name="refresh" size={16} color="#FFF" />
                    <Text style={styles.emptyActionText}>Tekrar Dene</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            ) : (
              <View style={styles.emptyWrap}>
                <Ionicons name="chatbubbles" size={72} color={Colors.teal} style={styles.emptyIcon} />
                <Text style={styles.emptyTitle}>Henüz mesajın yok</Text>
                <Text style={styles.emptySubtitle}>
                  Keşfet sayfasından birine git,{'\n'}sohbet başlat!
                </Text>
                <Pressable style={styles.emptyActionBtn} onPress={() => router.push('/(tabs)/home')}>
                  <LinearGradient
                    colors={['#14B8A6', '#0D9488']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.emptyActionGrad}
                  >
                    <Ionicons name="compass" size={16} color="#FFF" />
                    <Text style={styles.emptyActionText}>Keşfet</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            )
          }
          renderItem={({ item }) => (
            <ConversationCard
              item={item}
              isSelected={selectedIds.has(item.partner_id)}
              selectionMode={selectionMode}
              isFriend={friendIds.has(item.partner_id)}
              isTyping={typingPartners.has(item.partner_id)}
              onOpenChat={handleOpenChat}
              onToggleSelection={handleToggleSelection}
              onLongPress={handleLongPress}
              onDelete={handleDeleteConversation}
              onAvatarPress={handleAvatarPress}
              onCallPress={handleCallPress}
            />
          )}
        />
      )}

      {/* ═══ Toplu Silme Alt Bar ═══ */}
      {selectionMode && selectedIds.size > 0 && (
        <View style={[styles.bulkBar, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            style={styles.bulkSelectAll}
            onPress={() => {
              if (selectedIds.size === conversations.length) setSelectedIds(new Set());
              else setSelectedIds(new Set(conversations.map(c => c.partner_id)));
            }}
          >
            <Ionicons name={selectedIds.size === conversations.length ? 'checkbox' : 'square-outline'} size={20} color={Colors.text2} />
            <Text style={styles.bulkSelectAllText}>
              {selectedIds.size === conversations.length ? 'Seçimi Kaldır' : 'Tümünü Seç'}
            </Text>
          </Pressable>
          <Pressable
            style={styles.bulkDeleteBtn}
            onPress={() => {
              setCAlert({
                visible: true,
                title: `${selectedIds.size} sohbet silinecek`,
                message: 'Seçili sohbetler kalıcı olarak silinecek.',
                type: 'warning',
                buttons: [
                  {
                    text: 'Sil', style: 'destructive',
                    onPress: async () => {
                      if (!firebaseUser) return;
                      const ids = [...selectedIds];
                      const results = await Promise.allSettled(ids.map(async (pid) => {
                        await MessageService.markAsRead(firebaseUser.uid, pid);
                        await MessageService.deleteConversation(firebaseUser.uid, pid);
                      }));
                      const failed = results.filter(r => r.status === 'rejected').length;
                      const succeededIds = ids.filter((_, i) => results[i].status === 'fulfilled');
                      setConversations(prev => prev.filter(c => !succeededIds.includes(c.partner_id)));
                      setSelectedIds(new Set());
                      setSelectionMode(false);
                      refreshBadges();
                      if (failed > 0) {
                        showToast({ title: 'Kısmen silindi', message: `${failed} sohbet silinemedi, tekrar dene.`, type: 'warning' });
                      }
                    },
                  },
                  { text: 'Vazgeç', style: 'cancel' },
                ],
              });
            }}
          >
            <Ionicons name="trash" size={16} color="#fff" />
            <Text style={styles.bulkDeleteText}>{selectedIds.size} Sil</Text>
          </Pressable>
        </View>
      )}

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

      <PremiumAlert {...cAlert} onDismiss={() => setCAlert(prev => ({ ...prev, visible: false }))} />

      {/* ★ 2026-04-21: Modern bottom sheet — DM uzun bas aksiyonları */}
      <ConversationActionSheet
        visible={!!sheetItem}
        onClose={() => setSheetItem(null)}
        partnerName={sheetItem?.partner_name || ''}
        partnerAvatar={sheetItem?.partner_avatar}
        partnerOnline={sheetItem?.partner_is_online}
        subtitle={sheetItem?.unread_count
          ? `${sheetItem.unread_count} yeni mesaj`
          : sheetItem?.is_muted ? 'Sessize alındı' : undefined}
        actions={sheetActions}
      />
      {/* ★ 2026-04-21: Tab bar scroll fade — tüm tab sayfalarında tutarlı */}
      <TabBarFadeOut />
    </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ─── Header ───
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 4,
  },
  logo: { height: 30, width: 140 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  composeBtn: {
    backgroundColor: 'rgba(20,184,166,0.15)',
    borderColor: 'rgba(20,184,166,0.3)',
  },
  notifBadge: {
    position: 'absolute', top: -2, right: -2,
    backgroundColor: '#EF4444', minWidth: 16, height: 16,
    borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3, borderWidth: 1.5, borderColor: Colors.bg,
  },
  notifBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFF', ...Shadows.textLight },

  // ─── Sayfa Başlığı ───
  pageTitleRow: {
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#F1F5F9', letterSpacing: -0.5, ...Shadows.text },
  headerSub: { fontSize: 11, fontWeight: '600', color: '#94A3B8', marginTop: 3, ...Shadows.text },
  editBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(20,184,166,0.1)',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.2)',
  },
  editBtnActive: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderColor: 'rgba(239,68,68,0.25)',
  },
  editBtnText: { fontSize: 13, fontWeight: '600', color: Colors.teal, ...Shadows.textLight },

  // ─── Arama ─── Solid koyu zemin + teal aksent border + derin gölge
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: '#0E1626',
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.22)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
    gap: 10,
  },
  searchInputWrap: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  searchInput: {
    fontSize: 14, fontWeight: '600',
    color: '#F1F5F9',
    padding: 0,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  searchPlaceholder: {
    fontSize: 14, fontWeight: '500',
    color: 'rgba(203,213,225,0.55)',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  searchPlaceholderWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
  },

  // ─── Online Arkadaşlar ───
  friendSection: { marginBottom: 8 },
  friendSectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, marginBottom: 8,
  },
  onlineDot: {
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: '#22C55E',
    shadowColor: '#22C55E', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 4, elevation: 2,
  },
  friendSectionTitle: {
    fontSize: 12, fontWeight: '800', color: '#CBD5E1',
    letterSpacing: 0.8, textTransform: 'uppercase', ...Shadows.text,
  },
  friendCountBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(20,184,166,0.15)',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.25)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5,
  },
  friendCountText: { fontSize: 10, fontWeight: '800', color: Colors.teal, ...Shadows.textLight },
  friendStrip: { paddingHorizontal: 16, paddingVertical: 4, gap: 16 },
  friendChip: { alignItems: 'center', width: 60 },
  friendName: {
    fontSize: 10, fontWeight: '700', color: '#E2E8F0',
    marginTop: 5, textAlign: 'center', ...Shadows.text,
  },

  // ─── Empty State (custom, premium hissi) ───
  emptyWrap: {
    alignItems: 'center', justifyContent: 'center',
    paddingTop: 48, paddingHorizontal: 32, gap: 12,
  },
  emptyIcon: {
    marginBottom: 12,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 5 },
    textShadowRadius: 14,
  },
  emptyTitle: {
    fontSize: 18, fontWeight: '800', color: '#F1F5F9',
    letterSpacing: 0.2, textAlign: 'center',
    ...Shadows.text,
  },
  emptySubtitle: {
    fontSize: 13, fontWeight: '500',
    color: 'rgba(203,213,225,0.75)',
    textAlign: 'center', lineHeight: 19,
    marginBottom: 8,
    ...Shadows.textLight,
  },
  emptyActionBtn: {
    marginTop: 4,
    borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  emptyActionGrad: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 22, paddingVertical: 12,
  },
  emptyActionText: {
    fontSize: 14, fontWeight: '800', color: '#FFF',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },

  // ─── Sohbet Kartı (SwipeableRow container) ───
  msgCard: {
    marginHorizontal: 14, marginVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(6,10,18,0.58)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 10,
  },
  msgCardSelected: {
    borderColor: 'rgba(45,212,191,0.22)',
  },
  msgCardUnread: {
    borderColor: 'rgba(56,189,248,0.18)',
  },

  swipeClip: {
    borderRadius: 20,
    overflow: 'hidden',
  },

  // ─── Sohbet Satırı (iç Pressable) ───
  msgPressable: {
    overflow: 'hidden',
  },
  msgRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    position: 'relative',
  },
  unreadStripe: {
    position: 'absolute', left: 0, top: 8, bottom: 8,
    width: 3, borderRadius: 2,
    backgroundColor: Colors.teal,
    shadowColor: Colors.teal, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 4,
  },
  checkWrap: { marginRight: 10 },
  avatarWrap: { marginRight: 12 },
  msgInfo: { flex: 1, justifyContent: 'center', gap: 4 },
  msgTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  msgName: { fontSize: 15, fontWeight: '600', color: '#E2E8F0', flexShrink: 1, ...Shadows.text },
  // ─── Arşiv chip ───
  archiveChip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 14, marginTop: 4, marginBottom: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(20,184,166,0.08)',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.2)',
  },
  archiveChipText: {
    flex: 1, fontSize: 13, fontWeight: '700',
    color: Colors.teal, letterSpacing: 0.2,
    ...Shadows.textLight,
  },
  msgNameUnread: { fontWeight: '800', color: '#FFFFFF' },
  msgTime: { fontSize: 11, fontWeight: '600', color: '#94A3B8', ...Shadows.text },
  msgTimeUnread: { color: Colors.teal, fontWeight: '700' },
  msgPreviewRow: { flexDirection: 'row', alignItems: 'center' },
  msgText: { fontSize: 13, fontWeight: '500', color: 'rgba(203,213,225,0.75)', flex: 1, ...Shadows.text },
  msgTextUnread: { color: '#E2E8F0', fontWeight: '600' },

  // ─── Sağ aksiyonlar ───
  msgRight: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 6 },
  msgCallBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(74,222,128,0.1)',
    borderWidth: 1, borderColor: 'rgba(74,222,128,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  unreadBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.teal,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5,
    shadowColor: Colors.teal, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 6, elevation: 4,
  },
  unreadCountText: { color: '#fff', fontSize: 10, fontWeight: '800', ...Shadows.textLight },

  // ─── Swipe-to-Delete ───
  swipeDeleteBtn: {
    position: 'absolute', right: 0, top: 0, bottom: 0, width: 80,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#DC2626',
    borderTopRightRadius: 20, borderBottomRightRadius: 20,
  },
  swipeDeleteText: { fontSize: 10, fontWeight: '700', color: '#FFF', ...Shadows.textLight },

  // ─── Toplu Silme ───
  bulkBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 14,
    backgroundColor: 'rgba(15,23,42,0.98)',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
  },
  bulkSelectAll: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bulkSelectAllText: { fontSize: 13, color: Colors.text2, fontWeight: '500', ...Shadows.textLight },
  bulkDeleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#EF4444',
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#EF4444', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 4,
  },
  bulkDeleteText: { fontSize: 13, fontWeight: '700', color: '#fff', ...Shadows.textLight },
});
