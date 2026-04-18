import { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Image, Pressable, ActivityIndicator, TextInput, ScrollView, Animated as RNAnimated, PanResponder, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useRouter } from 'expo-router';
import { Colors, Shadows } from '../../constants/theme';
import { MessageService, ProfileService, type InboxItem, type Message } from '../../services/database';
import { supabase } from '../../constants/supabase';
import EmptyState from '../../components/EmptyState';
import { useAuth, useBadges, useTheme, useOnlineFriends } from '../_layout';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import StatusAvatar from '../../components/StatusAvatar';
import { UserSearchModal } from '../../components/UserSearchModal';
import AppBackground from '../../components/AppBackground';
import { showToast } from '../../components/Toast';
import { getRelativeTime } from '../../constants/time';
import PremiumAlert, { type AlertButton } from '../../components/PremiumAlert';
import { ModerationService } from '../../services/moderation';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ═══ Pure-RN Swipe-to-Delete Row ═══
function SwipeableRow({ children, onDelete, containerStyle }: { children: React.ReactNode; onDelete: () => void; containerStyle?: any }) {
  const translateX = useRef(new RNAnimated.Value(0)).current;
  const deleteOpacity = translateX.interpolate({ inputRange: [-80, -20, 0], outputRange: [1, 0.6, 0], extrapolate: 'clamp' });
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 15 && Math.abs(gs.dy) < 15,
      onPanResponderMove: (_, gs) => {
        if (gs.dx < 0) translateX.setValue(Math.max(gs.dx, -90));
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -60) {
          RNAnimated.spring(translateX, { toValue: -80, useNativeDriver: true, tension: 100, friction: 10 }).start();
        } else {
          RNAnimated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 100, friction: 10 }).start();
        }
      },
    })
  ).current;

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
      </View>
    </View>
  );
}

export default function MessagesScreen() {
  const router = useRouter();
  const { firebaseUser, setShowNotifDrawer } = useAuth();
  const { refreshBadges } = useBadges();
  useTheme();
  const [conversations, setConversations] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { onlineFriends, friendIds, blockedIdsRef, refreshFriends } = useOnlineFriends();
  const { unreadNotifs: unreadCount } = useBadges();
  const [cAlert, setCAlert] = useState<{ visible: boolean; title: string; message: string; type?: 'info' | 'warning' | 'error' | 'success'; buttons?: AlertButton[] }>({ visible: false, title: '', message: '' });
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(c => c.partner_name.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  const loadInbox = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const inbox = await MessageService.getInbox(firebaseUser.uid);
      const hiddenMap = await MessageService.getHiddenConversations(firebaseUser.uid);
      const filtered = inbox.filter(c => {
        if (blockedIdsRef.current.has(c.partner_id)) return false;
        const hiddenBefore = hiddenMap[c.partner_id];
        if (hiddenBefore && new Date(c.last_message_time) <= new Date(hiddenBefore)) return false;
        return true;
      });
      setConversations(filtered);
    } catch (err) {
      if (__DEV__) console.warn('Mesajlar yüklenemedi:', err);
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
    }, [firebaseUser])
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

      const hiddenMap = await MessageService.getHiddenConversations(firebaseUser.uid);
      const hiddenBefore = hiddenMap[otherId];
      if (hiddenBefore && new Date(newMsg.created_at) > new Date(hiddenBefore)) {
        delete hiddenMap[otherId];
        const key = `hidden_conversations_${firebaseUser.uid}`;
        await AsyncStorage.setItem(key, JSON.stringify(hiddenMap));
      } else if (hiddenBefore) {
        return;
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
        if (data && !(data as any).is_deleted) updateInbox(data as Message);
      })
      .subscribe();

    return () => {
      incomingChannel.unsubscribe();
      supabase.removeChannel(sentChannel);
    };
  }, [firebaseUser]);

  const insets = useSafeAreaInsets();

  return (
    <AppBackground variant="messages">
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>

      {/* ═══ Header ═══ */}
      <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
        <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
        <View style={styles.headerRight}>
          <Pressable style={styles.headerIconBtn} onPress={() => setShowNotifDrawer(true)}>
            <Ionicons name="notifications-outline" size={20} color="#F1F5F9" />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </Pressable>
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

      {/* ═══ Online Arkadaşlar ═══ */}
      {onlineFriends.length > 0 && (
        <View style={styles.friendSection}>
          <View style={styles.friendSectionHeader}>
            <View style={styles.onlineDot} />
            <Text style={styles.friendSectionTitle}>Çevrimiçi</Text>
            <View style={styles.friendCountBadge}>
              <Text style={styles.friendCountText}>{onlineFriends.length}</Text>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.friendStrip}
          >
            {onlineFriends.map((friend) => (
              <Pressable
                key={friend.id}
                style={styles.friendChip}
                onPress={() => router.push(`/chat/${friend.id}`)}
              >
                <StatusAvatar uri={friend.avatar_url} size={52} isOnline={true} tier={(friend as any).subscription_tier} />
                <Text style={styles.friendName} numberOfLines={1}>{friend.display_name?.split(' ')[0] || 'Kullanıcı'}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ═══ Sohbet Listesi ═══ */}
      {loading ? (
        <ActivityIndicator size="large" color={Colors.teal} style={{ marginTop: 50 }} />
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
            <EmptyState
              icon="chatbubbles-outline"
              title="Henüz mesajın yok"
              subtitle="Birinin profiline git ve sohbet başlat!"
              actionLabel="Keşfet"
              onAction={() => router.push('/(tabs)/home')}
            />
          }
          renderItem={({ item }) => {
            const unread = item.unread_count > 0;
            const isSelected = selectedIds.has(item.partner_id);
            const cardGradient = isSelected
              ? ['rgba(10,15,28,0.98)', 'rgba(20,184,166,0.10)', 'rgba(45,212,191,0.16)', 'rgba(20,184,166,0.08)', 'rgba(10,15,28,0.98)']
              : unread
                ? ['rgba(11,18,32,0.98)', 'rgba(56,189,248,0.09)', 'rgba(147,197,253,0.15)', 'rgba(56,189,248,0.07)', 'rgba(11,18,32,0.98)']
                : ['rgba(10,15,28,0.97)', 'rgba(37,99,235,0.08)', 'rgba(255,255,255,0.09)', 'rgba(37,99,235,0.07)', 'rgba(10,15,28,0.97)'];
            return (
              <SwipeableRow
                containerStyle={[styles.msgCard, isSelected && styles.msgCardSelected, unread && styles.msgCardUnread]}
                onDelete={async () => {
                  if (!firebaseUser) return;
                  try {
                    await MessageService.markAsRead(firebaseUser.uid, item.partner_id);
                    await MessageService.deleteConversation(firebaseUser.uid, item.partner_id);
                    setConversations(prev => prev.filter(c => c.partner_id !== item.partner_id));
                    refreshBadges();
                  } catch {
                    showToast({ title: 'Silinemedi', type: 'error' });
                  }
                }}
              >
              <Pressable
                style={styles.msgPressable}
                android_ripple={{ color: 'rgba(255,255,255,0.04)' }}
                onPress={() => {
                  if (selectionMode) {
                    setSelectedIds(prev => {
                      const next = new Set(prev);
                      if (next.has(item.partner_id)) next.delete(item.partner_id);
                      else next.add(item.partner_id);
                      return next;
                    });
                  } else {
                    router.push(`/chat/${item.partner_id}`);
                  }
                }}
                onLongPress={() => {
                  setCAlert({
                    visible: true,
                    title: item.partner_name,
                    message: 'Bu sohbet için ne yapmak istersin?',
                    type: 'info',
                    buttons: [
                      ...(friendIds.has(item.partner_id) ? [
                        { text: '📞 Sesli Ara', onPress: () => router.push(`/call/${item.partner_id}?callType=audio` as any) },
                      ] : []),
                      { text: '🗑️ Sohbeti Sil', style: 'destructive', onPress: async () => {
                        if (!firebaseUser) return;
                        try {
                          await MessageService.markAsRead(firebaseUser.uid, item.partner_id);
                          await MessageService.deleteConversation(firebaseUser.uid, item.partner_id);
                          setConversations(prev => prev.filter(c => c.partner_id !== item.partner_id));
                          refreshBadges();
                        } catch {}
                      }},
                      { text: '🚫 Engelle', style: 'destructive', onPress: async () => {
                        if (!firebaseUser) return;
                        try {
                          await ModerationService.blockUser(firebaseUser.uid, item.partner_id);
                          setConversations(prev => prev.filter(c => c.partner_id !== item.partner_id));
                          showToast({ title: '⛔ Engellendi', message: `${item.partner_name} engellendi.`, type: 'success' });
                        } catch {
                          showToast({ title: 'Hata', message: 'Engellenemedi.', type: 'error' });
                        }
                      }},
                      { text: 'Vazgeç', style: 'cancel' },
                    ],
                  });
                }}
                delayLongPress={500}
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

                  <Pressable
                    style={styles.avatarWrap}
                    onPress={() => router.push(`/user/${item.partner_id}` as any)}
                  >
                    <StatusAvatar uri={item.partner_avatar} size={52} isOnline={item.partner_is_online} tier={item.partner_tier} />
                  </Pressable>

                  <View style={styles.msgInfo}>
                    <View style={styles.msgTop}>
                      <Text style={[styles.msgName, unread && styles.msgNameUnread]} numberOfLines={1}>
                        {item.partner_name}
                      </Text>
                      <Text style={[styles.msgTime, unread && styles.msgTimeUnread]}>
                        {getRelativeTime(item.last_message_time)}
                      </Text>
                    </View>
                    <View style={styles.msgPreviewRow}>
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
                    </View>
                  </View>

                  <View style={styles.msgRight}>
                    {friendIds.has(item.partner_id) && !selectionMode && (
                      <Pressable
                        style={styles.msgCallBtn}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          router.push(`/call/${item.partner_id}?callType=audio` as any);
                        }}
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
          }}
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
                      await Promise.all(ids.map(async (pid) => {
                        try {
                          await MessageService.markAsRead(firebaseUser.uid, pid);
                          await MessageService.deleteConversation(firebaseUser.uid, pid);
                        } catch {}
                      }));
                      setConversations(prev => prev.filter(c => !selectedIds.has(c.partner_id)));
                      setSelectedIds(new Set());
                      setSelectionMode(false);
                      refreshBadges();
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
    width: 36, height: 36, borderRadius: 18,
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
  headerSub: { fontSize: 11, color: '#64748B', marginTop: 2, ...Shadows.textLight },
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

  // ─── Arama ───
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
    gap: 10,
  },
  searchInputWrap: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  searchInput: { fontSize: 13, color: '#CBD5E1', padding: 0, ...Shadows.textLight },
  searchPlaceholder: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.22)',
    ...Shadows.textLight,
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
    fontSize: 12, fontWeight: '700', color: '#94A3B8',
    letterSpacing: 0.8, textTransform: 'uppercase', ...Shadows.textLight,
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
    fontSize: 10, color: 'rgba(255,255,255,0.6)',
    marginTop: 5, textAlign: 'center', fontWeight: '500', ...Shadows.textLight,
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
  msgName: { fontSize: 15, fontWeight: '500', color: '#94A3B8', flex: 1, marginRight: 8, ...Shadows.textLight },
  msgNameUnread: { fontWeight: '700', color: '#F1F5F9' },
  msgTime: { fontSize: 11, color: '#475569', ...Shadows.textLight },
  msgTimeUnread: { color: Colors.teal, fontWeight: '600' },
  msgPreviewRow: { flexDirection: 'row', alignItems: 'center' },
  msgText: { fontSize: 13, color: 'rgba(255,255,255,0.35)', flex: 1, ...Shadows.textLight },
  msgTextUnread: { color: '#94A3B8', fontWeight: '500' },

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
