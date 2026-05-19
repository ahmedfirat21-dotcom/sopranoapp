/**
 * SopranoChat — Keşfet Arama Modalı
 * Oda ve kişi araması — keşfet ekranındaki arama ikonuna bağlı
 * Hem oda hem kullanıcı sonuçlarını listeler
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, FlatList, Animated, PanResponder, Dimensions, Keyboard } from 'react-native';
import AppLoader from './AppLoader';
import UserListSkeleton from './UserListSkeleton';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../constants/theme';
import { supabase } from '../constants/supabase';
import StatusAvatar from './StatusAvatar';
import type { Profile } from '../services/database';
import { useOnlineFriends } from '../providers/OnlineFriendsProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { i18n } from '../services/i18n';

// ★ 2026-04-27: FollowListModal/InRoomUserProfile ile aynı 2-snap mekanik.
//   Modal sarmalı YOK (Modal native dialog Pressable backdrop'u yutuyor + pan responder Capture
//   ile çakışıyor → sadece handle çekilebilir oluyor). View overlay zIndex:300 kullanılıyor.
const SCREEN_H = Dimensions.get('window').height;
const SNAP_HALF = SCREEN_H * 0.45;   // başlangıç: ekranın yarısından biraz yukarı
const SNAP_FULL = 60;                // tam ekran: üstten 60px boşluk
const SNAP_DISMISS = SCREEN_H + 50;  // ekran dışı

type UserSearchModalProps = {
  visible: boolean;
  onClose: () => void;
  currentUserId: string;
  onSelectUser: (userId: string, displayName: string) => void;
  onSelectRoom?: (roomId: string) => void;
  mode?: 'discover' | 'compose';
};

export function UserSearchModal({ visible, onClose, currentUserId, onSelectUser, onSelectRoom, mode = 'compose' }: UserSearchModalProps) {
  const isDiscover = mode === 'discover';
  // ★ 2026-05-10: Samsung 3-button nav + iPhone home indicator için dinamik alt padding.
  //   Eski sabit 40 — son kullanıcı satırı navigasyon tuşları arkasında kalıyordu.
  const insets = useSafeAreaInsets();
  const listBottomPad = Math.max(insets.bottom, 16) + 32;
  // ★ 2026-04-30: Presence-based online — stale DB flag yerine canlı websocket durumu.
  const { onlineFriends: liveFriends } = useOnlineFriends();
  const liveOnlineIds = new Set(liveFriends.map(f => f.id));
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [roomResults, setRoomResults] = useState<any[]>([]);
  const [friends, setFriends] = useState<Profile[]>([]);
  // ★ v1.7.13.37 (19 May 2026): suggestedUsers KALDIRILDI — kullanıcı mahremiyeti.
  //   Eski: arama yazılmadan tüm üyelerin son aktif 20'si listeleniyordu (Clubhouse/
  //   TikTok/Instagram'da yok). Yeni: empty state'te SADECE canlı odalar + mutual
  //   arkadaşlar. Kişi arama YAZILDIĞINDA explicit niyet ile DB'ye gider.
  const [trendingRooms, setTrendingRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [friendsLoading, setFriendsLoading] = useState(true);

  // Arkadaş listesini yükle (modal açıldığında)
  useEffect(() => {
    if (!visible || !currentUserId) return;
    loadFriends();
    if (isDiscover) loadTrendingRooms();
    setQuery('');
    setResults([]);
    setRoomResults([]);
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

      if (!following || following.length === 0) { setFriends([]); setFriendsLoading(false); return; }

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

  /** ★ v1.7.13.37: Empty state'te "tüm üyeleri keşfet" yerine canlı odalar.
   *  Mahremiyet: kullanıcılar arama yazmadan rastgele başkalarını göremez.
   *  Sektör paterni: Clubhouse / TikTok / Spaces — search-only kişi keşfi. */
  const loadTrendingRooms = async () => {
    try {
      const { data: rooms } = await supabase
        .from('rooms')
        .select('id, name, category, is_live, listener_count, host:profiles!host_id(display_name, avatar_url)')
        .eq('is_live', true)
        .order('listener_count', { ascending: false })
        .limit(5);
      setTrendingRooms(rooms || []);
    } catch (e) {
      if (__DEV__) console.warn('[UserSearch] Trending oda hatası:', e);
    }
  };

  const searchUsers = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      // ★ SEC-SEARCH: ilike wildcard karakterlerini escape et — SQL injection önleme
      const sanitized = searchQuery
        .replace(/\\/g, '\\\\')  // Backslash
        .replace(/%/g, '\\%')    // Wildcard %
        .replace(/_/g, '\\_');   // Wildcard _

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`display_name.ilike.%${sanitized}%,username.ilike.%${sanitized}%`)
        .neq('id', currentUserId)
        .limit(40); // Block filter sonrası 20'ye düşürüleceği için 40 al
      if (error) throw error;

      // ★ Block-aware: engellediğin + seni engelleyen kullanıcıları sonuçtan çıkar
      let filtered = (data as Profile[]) || [];
      try {
        const { getBlockedUserIds } = await import('../services/blocklist');
        const blockedSet = await getBlockedUserIds(currentUserId);
        if (blockedSet.size > 0) filtered = filtered.filter(p => !blockedSet.has(p.id));
      } catch { /* blocklist yoksa devam */ }
      setResults(filtered.slice(0, 20));

      // Keşfet modunda odaları da ara
      if (isDiscover && searchQuery.length >= 2) {
        const { data: rooms } = await supabase
          .from('rooms')
          .select('id, name, category, is_live, listener_count, host:profiles!host_id(display_name, avatar_url)')
          .ilike('name', `%${sanitized}%`)
          .eq('is_live', true)
          .limit(10);
        setRoomResults(rooms || []);
      } else {
        setRoomResults([]);
      }
    } catch (e) {
      if (__DEV__) console.warn('[UserSearch] Arama hatası:', e);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    // ★ Compose modunda DB araması yapmıyoruz — sadece arkadaşlar arasında filtre.
    // Reason: MessageService arkadaş olmayan kullanıcılara mesaj engelliyor, UI
    // bu kısıtlamayı yansıtmalı. Discover modunda tüm kullanıcılar aranır.
    if (isDiscover) {
      const timeout = setTimeout(() => searchUsers(text), 400);
      return () => clearTimeout(timeout);
    }
  };

  // ★ 2026-04-27: 2-snap pan sistemi (FollowListModal pattern).
  const translateY = useRef(new Animated.Value(SNAP_DISMISS)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const currentSnap = useRef(SNAP_HALF);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const scrollOffsetRef = useRef(0);
  const handleScroll = useCallback((e: any) => {
    scrollOffsetRef.current = e?.nativeEvent?.contentOffset?.y ?? 0;
  }, []);

  const isHalfState = () => currentSnap.current !== SNAP_FULL;

  // Header pan — handle + başlık alanı, scroll-aware DEĞİL, her zaman drag yakalar.
  const headerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        const newY = currentSnap.current + g.dy;
        translateY.setValue(Math.max(SNAP_FULL - 20, newY));
      },
      onPanResponderRelease: (_, g) => {
        const finalPos = currentSnap.current + g.dy;
        if (finalPos > SCREEN_H * 0.65 || g.vy > 0.8) {
          currentSnap.current = SNAP_DISMISS;
          Animated.parallel([
            Animated.timing(translateY, { toValue: SNAP_DISMISS, duration: 200, useNativeDriver: true }),
            Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
          ]).start(() => onCloseRef.current());
          return;
        }
        if (finalPos < SCREEN_H * 0.35 || g.vy < -0.5) {
          currentSnap.current = SNAP_FULL;
          Animated.spring(translateY, { toValue: SNAP_FULL, useNativeDriver: true, damping: 22, stiffness: 200 }).start();
          return;
        }
        currentSnap.current = SNAP_HALF;
        Animated.spring(translateY, { toValue: SNAP_HALF, useNativeDriver: true, damping: 22, stiffness: 200 }).start();
      },
    })
  ).current;

  // Body pan — half state'te her drag, full state'te sadece scroll-top'taki aşağı drag.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, g) => {
        if (Math.abs(g.dy) < 8) return false;
        if (Math.abs(g.dy) <= Math.abs(g.dx)) return false;
        if (isHalfState()) return true;
        return g.dy > 0 && scrollOffsetRef.current <= 0;
      },
      onMoveShouldSetPanResponderCapture: (_, g) => {
        if (Math.abs(g.dy) < 25) return false;
        if (Math.abs(g.dy) <= Math.abs(g.dx) * 2) return false;
        if (isHalfState()) return true;
        return g.dy > 0 && scrollOffsetRef.current <= 0;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        const newY = currentSnap.current + g.dy;
        translateY.setValue(Math.max(SNAP_FULL - 20, newY));
      },
      onPanResponderRelease: (_, g) => {
        const finalPos = currentSnap.current + g.dy;
        if (finalPos > SCREEN_H * 0.65 || g.vy > 0.8) {
          currentSnap.current = SNAP_DISMISS;
          Animated.parallel([
            Animated.timing(translateY, { toValue: SNAP_DISMISS, duration: 200, useNativeDriver: true }),
            Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
          ]).start(() => onCloseRef.current());
          return;
        }
        if (finalPos < SCREEN_H * 0.35 || g.vy < -0.5) {
          currentSnap.current = SNAP_FULL;
          Animated.spring(translateY, { toValue: SNAP_FULL, useNativeDriver: true, damping: 22, stiffness: 200 }).start();
          return;
        }
        currentSnap.current = SNAP_HALF;
        Animated.spring(translateY, { toValue: SNAP_HALF, useNativeDriver: true, damping: 22, stiffness: 200 }).start();
      },
    })
  ).current;

  const dismiss = useCallback(() => {
    currentSnap.current = SNAP_DISMISS;
    Animated.parallel([
      Animated.timing(translateY, { toValue: SNAP_DISMISS, duration: 200, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => onClose());
  }, [onClose, translateY, backdropOpacity]);

  // Açılış animasyonu — dismiss konumundan SNAP_HALF'a yay
  useEffect(() => {
    if (visible) {
      translateY.setValue(SNAP_DISMISS);
      backdropOpacity.setValue(0);
      currentSnap.current = SNAP_HALF;
      Animated.parallel([
        Animated.spring(translateY, { toValue: SNAP_HALF, useNativeDriver: true, damping: 22, stiffness: 200 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  // ★ 2026-04-27: TextInput autoFocus ile klavye açılınca yarım snap'te modal ezilip
  //   sadece header görünüyordu. Klavye açılınca otomatik FULL snap'e çıkar; klavye
  //   kapanınca HALF'a geri döner. Listeyi görmek için ekstra tıklama yok.
  useEffect(() => {
    if (!visible) return;
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      if (currentSnap.current !== SNAP_FULL) {
        currentSnap.current = SNAP_FULL;
        Animated.spring(translateY, { toValue: SNAP_FULL, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
      }
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      if (currentSnap.current === SNAP_FULL && !query) {
        // Klavye kapandıysa ve sorgu yoksa half'a geri dön (peek hissi için).
        // Sorgu varsa kullanıcı listeye bakıyor, full'da bırak.
        currentSnap.current = SNAP_HALF;
        Animated.spring(translateY, { toValue: SNAP_HALF, useNativeDriver: true, damping: 22, stiffness: 200 }).start();
      }
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, [visible, query, translateY]);

  const isSearchMode = query.length >= 2;
  // ★ Compose modunda arama = arkadaşlar arasında client-side filter
  const filteredFriends = isSearchMode && !isDiscover
    ? friends.filter(f => {
        const q = query.toLowerCase();
        return (f.display_name || '').toLowerCase().includes(q) ||
               (f.username || '').toLowerCase().includes(q);
      })
    : friends;
  const displayList = isDiscover ? (isSearchMode ? results : friends) : filteredFriends;

  const renderUser = ({ item }: { item: Profile }) => (
    <Pressable
      style={({ pressed }) => [s.userRow, pressed && { opacity: 0.8, backgroundColor: 'rgba(92,225,230,0.06)' }]}
      onPress={() => {
        onSelectUser(item.id, item.display_name || i18n.t('auto.UserSearchModal.006'));
        onClose();
      }}
    >
      <StatusAvatar uri={item.avatar_url} size={48} isOnline={liveOnlineIds.has(item.id)} tier={item.subscription_tier} frameId={(item as any).active_frame || null} customBadgeId={(item as any).active_badge_id ?? null} />
      <View style={s.userInfo}>
        <Text style={s.displayName}>{item.display_name || i18n.t('auto.UserSearchModal.005')}</Text>
        {item.username && <Text style={s.username}>@{item.username.replace(/_[a-zA-Z0-9]{4}$/, "")}</Text>}
      </View>
      <Ionicons name={isDiscover ? 'open-outline' : 'chatbubble-outline'} size={18} color={Colors.teal} />
    </Pressable>
  );

  if (!visible) return null;

  return (
    // ★ 2026-04-27: Modal sarmalı kaldırıldı — FollowListModal ile aynı pattern.
    //   View overlay zIndex:300 ile sayfanın üstünde kalır.
    <View style={s.overlay} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(8,12,22,0.45)', opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={dismiss} />
      </Animated.View>

      {/* Sheet — translateY-based positioning (useNativeDriver:true) */}
      <Animated.View style={[s.sheet, { transform: [{ translateY }] }]} {...panResponder.panHandlers}>
          {/* ★ 2026-05-05: NotificationDrawer aile dili — slate diagonal + teal halo + soft glow */}
          <LinearGradient
            colors={['#3a4658', '#2a3344', '#1a2030']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(20,184,166,0.20)', 'rgba(20,184,166,0.05)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(20,184,166,0.08)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.6 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          {/* Üst teal hairline */}
          <LinearGradient
            colors={['transparent', 'rgba(20,184,166,0.55)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.topEdge}
            pointerEvents="none"
          />

          {/* ★ Header bölgesi her zaman drag yakalar (FULL state'te scroll-top değilken bile). */}
          <View {...headerPanResponder.panHandlers}>
            <View style={s.handleWrap}>
              <View style={s.handle} />
            </View>
            <View style={s.header}>
              <View style={s.headerLeft}>
                <Ionicons name={isDiscover ? 'search' : 'create'} size={18} color={Colors.teal} />
                <Text style={s.headerTitle}>{isDiscover ? i18n.t('search.discover_title') : i18n.t('search.new_message')}</Text>
              </View>
            </View>
          </View>

          {/* Arama */}
          <View style={s.searchWrap}>
            <Ionicons name="search" size={16} color={Colors.text3} />
            <TextInput
              style={s.searchInput}
              placeholder={isDiscover ? i18n.t('search.placeholder_discover') : i18n.t('search.placeholder_message')}
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
          {isDiscover && isSearchMode && roomResults.length > 0 && (
            <>
              <View style={s.sectionHeader}>
                <Ionicons name="radio" size={13} color={Colors.text3} />
                <Text style={s.sectionTitle}>{i18n.t('search.rooms_section')}</Text>
              </View>
              {roomResults.map((room: any) => (
                <Pressable
                  key={room.id}
                  style={({ pressed }) => [s.userRow, pressed && { opacity: 0.8, backgroundColor: 'rgba(92,225,230,0.06)' }]}
                  onPress={() => { onSelectRoom?.(room.id); onClose(); }}
                >
                  <View style={[s.avatarWrap, { backgroundColor: 'rgba(20,184,166,0.1)', width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="mic" size={20} color={Colors.teal} />
                  </View>
                  <View style={s.userInfo}>
                    <Text style={s.displayName}>{room.name}</Text>
                    <Text style={s.username}>{room.host?.display_name || 'Anonim'} · {room.listener_count || 0} dinleyici</Text>
                  </View>
                  <Ionicons name="enter-outline" size={18} color={Colors.teal} />
                </Pressable>
              ))}
            </>
          )}
          {isSearchMode ? (
            /* ═══ Arama Sonuçları ═══ */
            <>
              <View style={s.sectionHeader}>
                <Ionicons name="search" size={13} color={Colors.text3} />
                <Text style={s.sectionTitle}>{i18n.t('search.people_section')}</Text>
              </View>
              {loading ? (
                <UserListSkeleton count={5} showAction />
              ) : (
                <FlatList
                  data={displayList}
                  keyExtractor={(item) => item.id}
                  renderItem={renderUser}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: listBottomPad }}
                  onScroll={handleScroll}
                  scrollEventThrottle={16}
                  // ★ v110.5.5: Klavye açıkken arama sonucuna ilk dokunuşta tıklama yakalansın
                  //   "handled" → tap çocuk handler'ı (Pressable) tarafından yutulur, klavye kapanmaz.
                  //   Aksi halde Android'de tap önce klavyeyi kapatır, modal hareket eder, tap kaçar.
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  // ★ v284 (16 May 2026): Performans config (büyük kullanıcı arama listeleri)
                  initialNumToRender={15}
                  maxToRenderPerBatch={10}
                  windowSize={9}
                  removeClippedSubviews
                  ListEmptyComponent={
                    <View style={s.emptyState}>
                      <Ionicons name="search-outline" size={36} color="rgba(92,225,230,0.2)" />
                      <Text style={s.emptyText}>{i18n.t('search.user_not_found')}</Text>
                    </View>
                  }
                />
              )}
            </>
          ) : (
            /* ═══ Boş Durum: Takip Ettiklerin + Önerilen Üyeler ═══ */
            <>
              {friendsLoading ? (
                <UserListSkeleton count={4} showAction />
              ) : (
                <FlatList
                  data={[]} // Header-only — gerçek veriler ListHeader'da
                  keyExtractor={() => 'dummy'}
                  renderItem={() => null}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: listBottomPad }}
                  onScroll={handleScroll}
                  scrollEventThrottle={16}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  ListHeaderComponent={
                    <>
                      {/* Arkadaşların */}
                      {friends.length > 0 && (
                        <>
                          <View style={s.sectionHeader}>
                            <Ionicons name="people" size={13} color={Colors.text3} />
                            <Text style={s.sectionTitle}>{i18n.t('search.your_friends')}</Text>
                          </View>
                          {friends.map((item) => (
                            <Pressable
                              key={item.id}
                              style={({ pressed }) => [s.userRow, pressed && { opacity: 0.8, backgroundColor: 'rgba(92,225,230,0.06)' }]}
                              onPress={() => { onSelectUser(item.id, item.display_name || i18n.t('auto.UserSearchModal.004')); onClose(); }}
                            >
                              <StatusAvatar uri={item.avatar_url} size={48} isOnline={liveOnlineIds.has(item.id)} tier={item.subscription_tier} frameId={(item as any).active_frame || null} customBadgeId={(item as any).active_badge_id ?? null} />
                              <View style={s.userInfo}>
                                <Text style={s.displayName}>{item.display_name || i18n.t('auto.UserSearchModal.003')}</Text>
                                {item.username && <Text style={s.username}>@{item.username.replace(/_[a-zA-Z0-9]{4}$/, "")}</Text>}
                              </View>
                              <Ionicons name={isDiscover ? 'open-outline' : 'chatbubble-outline'} size={18} color={Colors.teal} />
                            </Pressable>
                          ))}
                        </>
                      )}

                      {/* ★ v1.7.13.37: "Önerilen Üyeler" KALDIRILDI (mahremiyet).
                          Yerine canlı oda listesi — kullanıcı aktif yerleri görür,
                          rastgele kişiler değil. */}
                      {isDiscover && trendingRooms.length > 0 && (
                        <>
                          <View style={[s.sectionHeader, { marginTop: friends.length > 0 ? 8 : 0 }]}>
                            <Ionicons name="radio" size={13} color={Colors.teal} />
                            <Text style={s.sectionTitle}>Şu An Canlı Odalar</Text>
                          </View>
                          {trendingRooms.map((room: any) => (
                            <Pressable
                              key={room.id}
                              style={({ pressed }) => [s.userRow, pressed && { opacity: 0.8, backgroundColor: 'rgba(92,225,230,0.06)' }]}
                              onPress={() => { onSelectRoom?.(room.id); onClose(); }}
                            >
                              <View style={[s.avatarWrap, { backgroundColor: 'rgba(20,184,166,0.1)', width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' }]}>
                                <Ionicons name="mic" size={20} color={Colors.teal} />
                              </View>
                              <View style={s.userInfo}>
                                <Text style={s.displayName}>{room.name}</Text>
                                <Text style={s.username}>{room.host?.display_name || 'Anonim'} · {room.listener_count || 0} dinleyici</Text>
                              </View>
                              <Ionicons name="enter-outline" size={18} color={Colors.teal} />
                            </Pressable>
                          ))}
                        </>
                      )}

                      {/* Hiç arkadaş ve canlı oda yoksa — açıklayıcı boş state */}
                      {friends.length === 0 && trendingRooms.length === 0 && (
                        <View style={s.emptyState}>
                          <Ionicons name="search-outline" size={36} color="rgba(92,225,230,0.2)" />
                          <Text style={s.emptyText}>Kişi veya oda ara</Text>
                          <Text style={s.emptySubtext}>İsim, kullanıcı adı veya oda adıyla arayabilirsin</Text>
                        </View>
                      )}
                    </>
                  }
                />
              )}
            </>
          )}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  // ★ 2026-04-27: FollowListModal pattern — overlay tüm ekrana yayılır, sheet absolute.
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 300,
    elevation: 24,
  },
  // ★ 2026-05-05: Aile standardı — radius 22→26, slate bg, gri border kaldırıldı
  sheet: {
    position: 'absolute',
    left: 0, right: 0,
    top: 0, bottom: 0,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#1a2030',
    ...Shadows.card,
  },
  topEdge: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, zIndex: 1,
  },
  // ★ 2026-04-27: Handle zone genişletildi — kullanıcı sürükleneceğini görsün
  handleWrap: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 56,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, letterSpacing: 0.2 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
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
