import { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Image, Pressable, ActivityIndicator, TextInput, ScrollView, Animated as RNAnimated, PanResponder, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useRouter } from 'expo-router';
import { Colors, Shadows } from '../../constants/theme';
import { MessageService, ProfileService, type InboxItem, type Message } from '../../services/database';
import { supabase } from '../../constants/supabase';
import EmptyState from '../../components/EmptyState';
import { useAuth, useBadges, useTheme, useOnlineFriends } from '../_layout';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAvatarSource } from '../../constants/avatars';
import { UserSearchModal } from '../../components/UserSearchModal';
import AppBackground from '../../components/AppBackground';
import { showToast } from '../../components/Toast';
import { getRelativeTime } from '../../constants/time';
import PremiumAlert, { type AlertButton } from '../../components/PremiumAlert';
import { ModerationService } from '../../services/moderation';
import AsyncStorage from '@react-native-async-storage/async-storage';



// ═══ Pure-RN Swipe-to-Delete Row ═══
function SwipeableRow({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
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
    <View style={{ overflow: 'hidden' }}>
      {/* Arka plan — kırmızı delete alanı (sadece swipe'ta görünür) */}
      <RNAnimated.View style={[styles.swipeDeleteBtn, { opacity: deleteOpacity }]}>
        <Pressable onPress={onDelete} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 2 }}>
          <Ionicons name="trash-outline" size={20} color="#FFF" />
          <Text style={styles.swipeDeleteText}>Sil</Text>
        </Pressable>
      </RNAnimated.View>
      {/* Ön plan — kaydırılabilir satır */}
      <RNAnimated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {children}
      </RNAnimated.View>
    </View>
  );
}

export default function MessagesScreen() {
  const router = useRouter();
  const { firebaseUser, setShowNotifDrawer } = useAuth();
  const { refreshBadges } = useBadges();
  useTheme(); // Tema değişince re-render
  const [conversations, setConversations] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // ★ DUP-3 FIX: Online friends artık merkezî provider'dan geliyor
  const { onlineFriends, friendIds, blockedIdsRef, refreshFriends } = useOnlineFriends();

  const { unreadNotifs: unreadCount } = useBadges();
  const [cAlert, setCAlert] = useState<{ visible: boolean; title: string; message: string; type?: 'info' | 'warning' | 'error' | 'success'; buttons?: AlertButton[] }>({ visible: false, title: '', message: '' });
  // ★ Toplu silme modu
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Arama filtresi
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(c => c.partner_name.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  const loadInbox = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      // ★ getInbox artık DB seviyesinde is_deleted filtresi yapıyor
      const inbox = await MessageService.getInbox(firebaseUser.uid);

      // ★ Gizlenmiş sohbetleri filtrele (tek taraflı silme — WhatsApp modeli)
      const hiddenMap = await MessageService.getHiddenConversations(firebaseUser.uid);
      const filtered = inbox.filter(c => {
        if (blockedIdsRef.current.has(c.partner_id)) return false;
        // Gizlenmiş sohbet varsa: son mesaj gizleme zamanından sonraysa tekrar göster
        const hiddenBefore = hiddenMap[c.partner_id];
        if (hiddenBefore && new Date(c.last_message_time) <= new Date(hiddenBefore)) return false;
        return true;
      });
      setConversations(filtered);
    } catch (err) {
      if (__DEV__) console.warn('Mesajlar yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  // Sayfaya her odaklandığında güncel inbox'ı çek
  useFocusEffect(
    useCallback(() => {
      loadInbox();
      // ★ DUP-3 FIX: Online friends artık merkezî provider'dan geliyor
      refreshFriends();
      // ★ Sayfa odaklandığında badge'i güncelle
      refreshBadges();
    }, [firebaseUser])
  );

  // ★ DUP-3 FIX: Yerel loadFriends ve msg-online subscription kaldırıldı.
  // Tüm online friends verisi useOnlineFriends() hook'undan geliyor.
  // Yerel 30sn polling kaldırıldı.

  // ★ DUP-3 FIX: Online friends Realtime subscription artık
  // providers/OnlineFriendsProvider.tsx'de merkezileştirildi.
  // Konuşma listesindeki partner_is_online güncellemesi aşağıdaki
  // basitleştirilmiş effect ile yapılıyor.
  useEffect(() => {
    // Online friends değiştiğinde konuşma listesindeki partner durumlarını güncelle
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

    // BUG-DM1 FIX: Hem gelen hem gönderilen mesajları dinle
    const updateInbox = async (newMsg: Message) => {
      const otherId = newMsg.sender_id === firebaseUser.uid ? newMsg.receiver_id : newMsg.sender_id;
      // ★ Engelli kullanıcı guard (ref ile stale closure önleme)
      if (blockedIdsRef.current.has(otherId)) return;
      const isSentByMe = newMsg.sender_id === firebaseUser.uid;

      // ★ M2 FIX: Partner bilgisini güvenilir şekilde çöz
      let partnerName = 'Kullanıcı';
      let partnerAvatar = '';
      let partnerOnline = false;
      let resolved = false;

      // 1. Gelen mesaj — sender karşı taraf, bilgisi JOIN'den gelir
      if (!isSentByMe && newMsg.sender) {
        partnerName = newMsg.sender.display_name || 'Kullanıcı';
        partnerAvatar = newMsg.sender.avatar_url || '';
        partnerOnline = newMsg.sender.is_online || false;
        resolved = true;
      }
      // 2. Gönderilen mesaj — receiver profili eklenmiş olabilir
      if (!resolved && isSentByMe && newMsg.receiver) {
        partnerName = newMsg.receiver.display_name || 'Kullanıcı';
        partnerAvatar = newMsg.receiver.avatar_url || '';
        partnerOnline = newMsg.receiver.is_online || false;
        resolved = true;
      }

      // 3. Fallback: Mevcut konuşma bilgisi veya API'den çek
      if (!resolved) {
        setConversations(prev => {
          const existingIdx = prev.findIndex(c => c.partner_id === otherId);
          if (existingIdx >= 0) {
            partnerName = prev[existingIdx].partner_name;
            partnerAvatar = prev[existingIdx].partner_avatar;
            partnerOnline = prev[existingIdx].partner_is_online;
            resolved = true;
          }
          return prev; // State değiştirmiyoruz, sadece okuyoruz
        });
      }
      if (!resolved) {
        // Son çare: API'den profil çek
        try {
          const prof = await ProfileService.get(otherId);
          if (prof) {
            partnerName = prof.display_name || 'Kullanıcı';
            partnerAvatar = prof.avatar_url || '';
            partnerOnline = prof.is_online || false;
          }
        } catch { /* silent */ }
      }

      // ★ Yeni mesaj geldiğinde gizlenmiş sohbeti tekrar göster (silmeden sonra yeni mesaj)
      // AsyncStorage'dan gizleme timestamp'i kontrol et
      const hiddenMap = await MessageService.getHiddenConversations(firebaseUser.uid);
      const hiddenBefore = hiddenMap[otherId];
      if (hiddenBefore && new Date(newMsg.created_at) > new Date(hiddenBefore)) {
        // Yeni mesaj gizleme zamanından sonra — gizlemeyi kaldır
        delete hiddenMap[otherId];
        const key = `hidden_conversations_${firebaseUser.uid}`;
        await AsyncStorage.setItem(key, JSON.stringify(hiddenMap));
      } else if (hiddenBefore) {
        return; // Hâlâ gizli — inbox'a ekleme
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
        };

        const filtered = prev.filter(c => c.partner_id !== otherId);
        return [newItem, ...filtered];
      });

      // ★ Badge'i güncelle (realtime yeni mesaj = okunmamış sayısı artar)
      if (!isSentByMe) refreshBadges();
    };

    // Gelen mesajlar
    const incomingChannel = MessageService.onNewMessage(firebaseUser.uid, updateInbox);

    // Gönderilen mesajlar — ayrı subscription
    const sentChannelName = `user_sent_${firebaseUser.uid}`;
    const sentChannel = supabase
      .channel(sentChannelName)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `sender_id=eq.${firebaseUser.uid}`,
      }, async (payload) => {
        // ★ M2 FIX: Hem sender hem receiver profilini çek
        const { data } = await supabase
          .from('messages')
          .select('*, sender:profiles!sender_id(*), receiver:profiles!receiver_id(*)')
          .eq('id', payload.new.id)
          .single();
        if (data && !(data as any).is_deleted) {
          updateInbox(data as Message);
        }
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
      {/* ═══ Standart Logo Header (Keşfet/Odalarım ile tutarlı) ═══ */}
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
          <Pressable style={styles.headerIconBtn} onPress={() => setShowComposeModal(true)}>
            <Ionicons name="create-outline" size={20} color="#F1F5F9" />
          </Pressable>
        </View>
      </View>

      {/* Sayfa Başlığı */}
      <View style={styles.pageTitleRow}>
        <View>
          <Text style={styles.headerTitle}>Mesajlar</Text>
          <Text style={styles.headerSub}>Sohbetlerin</Text>
        </View>
        {conversations.length > 0 && (
          <Pressable
            style={styles.editBtn}
            onPress={() => {
              if (selectionMode) {
                setSelectionMode(false);
                setSelectedIds(new Set());
              } else {
                setSelectionMode(true);
              }
            }}
          >
            <Text style={styles.editBtnText}>{selectionMode ? 'Vazgeç' : 'Düzenle'}</Text>
          </Pressable>
        )}
      </View>

      {/* ═══ ARAMA ÇUBUĞU — koyu glassmorphic ═══ */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={Colors.teal} />
        <TextInput
          style={styles.searchInput}
          placeholder="Ara..."
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.3)" />
          </Pressable>
        )}
      </View>

      {/* ═══ Online Arkadaşlar — Kompakt yatay avatar şeridi ═══ */}
      <View style={styles.friendSection}>
        <Text style={styles.friendSectionTitle}>Çevrimiçi Arkadaşlar</Text>
        {onlineFriends.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.friendStrip}
            style={styles.friendStripWrap}
          >
            {onlineFriends.map((friend) => (
              <Pressable
                key={friend.id}
                style={styles.friendChip}
                onPress={() => router.push(`/chat/${friend.id}`)}
              >
                <View style={styles.friendAvatarWrap}>
                  <Image source={getAvatarSource(friend.avatar_url)} style={styles.friendAvatar} />
                  <View style={styles.friendOnlineDot} />
                </View>
                <Text style={styles.friendName} numberOfLines={1}>{friend.display_name?.split(' ')[0] || 'Kullanıcı'}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.friendEmptyText}>Şu an çevrimiçi arkadaşın yok</Text>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.teal} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.partner_id}
          showsVerticalScrollIndicator={false}
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
            return (
              <SwipeableRow
                onDelete={async () => {
                  try {
                    await MessageService.markAsRead(firebaseUser!.uid, item.partner_id);
                    await MessageService.deleteConversation(firebaseUser!.uid, item.partner_id);
                    setConversations(prev => prev.filter(c => c.partner_id !== item.partner_id));
                    refreshBadges();
                  } catch {
                    showToast({ title: 'Silinemedi', type: 'error' });
                  }
                }}
              >
              <Pressable
                style={[styles.msgRow, isSelected && styles.msgRowSelected]}
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
                      // ★ Arama seçenekleri — sadece takipleşen kişiler arayabilir
                      ...(friendIds.has(item.partner_id) ? [
                        { text: '📞 Sesli Ara', onPress: () => {
                          router.push(`/call/${item.partner_id}?callType=audio` as any);
                        }},
                        { text: '📹 Görüntülü Ara', onPress: () => {
                          router.push(`/call/${item.partner_id}?callType=video&isIncoming=false` as any);
                        }},
                      ] : []),
                      { text: '🗑️ Sohbeti Sil', style: 'destructive', onPress: async () => {
                        try {
                          await MessageService.markAsRead(firebaseUser!.uid, item.partner_id);
                          await MessageService.deleteConversation(firebaseUser!.uid, item.partner_id);
                          setConversations(prev => prev.filter(c => c.partner_id !== item.partner_id));
                          refreshBadges();
                        } catch {}
                      }},
                      { text: '🚫 Engelle', style: 'destructive', onPress: async () => {
                        try {
                          await ModerationService.blockUser(firebaseUser!.uid, item.partner_id);
                          setConversations(prev => prev.filter(c => c.partner_id !== item.partner_id));
                        } catch {}
                      }},
                      { text: 'Vazgeç', style: 'cancel' },
                    ],
                  });
                }}
                delayLongPress={500}
              >
                {selectionMode && (
                  <View style={styles.checkWrap}>
                    <Ionicons name={isSelected ? 'checkbox' : 'square-outline'} size={22} color={isSelected ? Colors.teal : 'rgba(255,255,255,0.3)'} />
                  </View>
                )}
                <Pressable 
                  style={styles.avatarWrap}
                  onPress={() => router.push(`/user/${item.partner_id}` as any)}
                >
                  <Image source={getAvatarSource(item.partner_avatar)} style={styles.avatar} />
                  {item.partner_is_online && <View style={styles.onlineDot} />}
                </Pressable>
                <View style={styles.msgInfo}>
                  <View style={styles.msgTop}>
                    <Text style={styles.msgName}>{item.partner_name}</Text>
                    <Text style={styles.msgTime}>{getRelativeTime(item.last_message_time)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {/* ★ BUG-8 FIX: Gönderilen mesajlarda tek tik göster (karşı taraf okundu bilgisi DB'de yok) */}
                    {item.last_message_content?.startsWith('Sen:') && (
                      <View style={{ flexDirection: 'row' }}>
                        <Ionicons name="checkmark" size={12} color="rgba(255,255,255,0.4)" />
                      </View>
                    )}
                    <Text style={[styles.msgText, unread && styles.msgTextUnread]} numberOfLines={1}>
                      {item.last_message_content}
                    </Text>
                  </View>
                </View>
                {/* ★ Sesli Arama Butonu — sadece arkadaşlara gösterilir */}
                {friendIds.has(item.partner_id) && (
                  <Pressable
                    style={styles.msgCallBtn}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      router.push(`/call/${item.partner_id}?callType=audio` as any);
                    }}
                  >
                    <Ionicons name="call" size={16} color="#4ADE80" />
                  </Pressable>
                )}
                {unread && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadCountText}>{item.unread_count}</Text>
                  </View>
                )}
              </Pressable>
              </SwipeableRow>
            );
          }}
        />
      )}

      {/* ★ Toplu Silme Alt Bar */}
      {selectionMode && selectedIds.size > 0 && (
        <View style={styles.bulkBar}>
          <Pressable
            style={styles.bulkSelectAll}
            onPress={() => {
              if (selectedIds.size === conversations.length) {
                setSelectedIds(new Set());
              } else {
                setSelectedIds(new Set(conversations.map(c => c.partner_id)));
              }
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
                    text: 'Sil',
                    style: 'destructive',
                    onPress: async () => {
                      // ★ BUG-MSG1 FIX: Seri yerine paralel silme
                      const ids = [...selectedIds];
                      await Promise.all(ids.map(async (pid) => {
                        try {
                          await MessageService.markAsRead(firebaseUser!.uid, pid);
                          await MessageService.deleteConversation(firebaseUser!.uid, pid);
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
            <Ionicons name="trash" size={18} color="#fff" />
            <Text style={styles.bulkDeleteText}>{selectedIds.size} Sil</Text>
          </Pressable>
        </View>
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


      <PremiumAlert {...cAlert} onDismiss={() => setCAlert(prev => ({ ...prev, visible: false }))} />
    </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // ═══ Standart Logo Header ═══
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingBottom: 2,
  },
  logo: { height: 32, width: 150 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerIconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center', overflow: 'visible' as const, ...Shadows.icon },
  notifBadge: { position: 'absolute' as const, top: -2, right: -2, backgroundColor: '#EF4444', minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: Colors.bg },
  notifBadgeText: { fontSize: 9, fontWeight: '800' as const, color: '#FFF' },
  pageTitleRow: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800' as const, color: '#F1F5F9', letterSpacing: -0.3 },
  headerSub: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  editBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(45,212,191,0.12)',
  },
  editBtnText: { fontSize: 13, fontWeight: '600' as const, color: Colors.teal },
  checkWrap: {
    marginRight: 10,
  },
  msgRowSelected: {
    backgroundColor: 'rgba(45,212,191,0.08)',
  },
  bulkBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(15,23,42,0.97)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  bulkSelectAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bulkSelectAllText: { fontSize: 13, color: Colors.text2, fontWeight: '500' as const },
  bulkDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EF4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  bulkDeleteText: { fontSize: 13, fontWeight: '700' as const, color: '#fff' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#CBD5E1',
    padding: 0,
  },
  // ★ Satır gölgesi (card shadow)
  msgRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)', backgroundColor: 'rgba(15,23,42,0.95)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 3 },
  avatarWrap: { position: 'relative', marginRight: 16 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 4 },
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

  // ═══ Online Arkadaşlar Şeridi ═══
  friendSection: { marginBottom: 6 },
  friendSectionTitle: { fontSize: 11, fontWeight: '700' as const, color: '#64748B', letterSpacing: 0.5, textTransform: 'uppercase' as const, paddingHorizontal: 20, marginBottom: 6 },
  friendEmptyText: { fontSize: 12, color: 'rgba(255,255,255,0.2)', paddingHorizontal: 20, paddingBottom: 8 },
  friendStripWrap: { },
  friendStrip: { paddingHorizontal: 16, paddingVertical: 6, gap: 16 },
  friendChip: { alignItems: 'center', width: 52 },
  friendAvatarWrap: { position: 'relative' as const },
  friendAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: 'rgba(34,197,94,0.3)' },
  friendOnlineDot: {
    position: 'absolute' as const, bottom: 0, right: 0,
    width: 13, height: 13, borderRadius: 7,
    backgroundColor: '#4ADE80', borderWidth: 2, borderColor: '#0F1923',
    shadowColor: '#4ADE80', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 4, elevation: 3,
  },
  friendName: { fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 3, textAlign: 'center' as const },

  // ═══ Swipe-to-Delete ═══
  swipeDeleteBtn: {
    position: 'absolute' as const,
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#DC2626',
  },
  swipeDeleteText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
});
