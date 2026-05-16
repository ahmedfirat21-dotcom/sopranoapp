import React from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing, ScrollView, Dimensions } from 'react-native';
import AppLoader from './AppLoader';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { FriendshipService, type FollowUser } from '../services/friendship';
import { supabase } from '../constants/supabase';
import StatusAvatar from './StatusAvatar';
import { Colors } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Tab bar height + gap — alt navigasyon barının üstünde bitsin
const TAB_BAR_SPACE = 60 + 8 + 6; // BAR_H (60) + min paddingBottom (8) + extra gap

const { width: W, height: H } = Dimensions.get('window');
// ★ 2026-05-05: NotificationDrawer ile birebir eşit boyut — iki kardeş drawer
//   aynı ölçüde, görsel tutarlılık. Eski 230px dar idi, bildirim cardları sığmadı;
//   300px ortak değer ikisinde de dengeli görünür.
const DRAWER_W = Math.min(W * 0.72, 300);
const DRAWER_H = Math.min(H * 0.86, 820);

export default function FriendsDrawer({ visible, friends, onClose, onSelect, currentUserId }: {
  visible: boolean;
  friends: FollowUser[];
  onClose: () => void;
  onSelect: (userId: string) => void;
  currentUserId?: string;
}) {
  const insets = useSafeAreaInsets();
  // ★ 2026-04-24: Dikey olarak ekran ortasına konumlandır.
  const topGap = Math.max((H - DRAWER_H) / 2, insets.top + 12);
  const slideAnim = React.useRef(new Animated.Value(DRAWER_W)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const isClosingRef = React.useRef(false);
  const [pendingRequests, setPendingRequests] = React.useState<any[]>([]);
  const [processingIds, setProcessingIds] = React.useState<Set<string>>(new Set());
  // ★ İşlenen isteklerin durumunu drawer kapanana kadar göster
  const [handledIds, setHandledIds] = React.useState<Record<string, 'approved' | 'rejected'>>({});

  // ★ Drawer açılınca bekleyen takip isteklerini çek + handled sıfırla
  React.useEffect(() => {
    if (visible && currentUserId) {
      setHandledIds({});
      loadPendingRequests();
    }
  }, [visible, currentUserId]);

  const loadPendingRequests = async () => {
    if (!currentUserId) return;
    try {
      const { data } = await supabase
        .from('friendships')
        .select('id, user_id, created_at, user:profiles!friendships_user_id_fkey(id, display_name, avatar_url, subscription_tier)')
        .eq('friend_id', currentUserId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      setPendingRequests(data || []);
    } catch {}
  };

  const handleApprove = async (senderId: string) => {
    if (!currentUserId) return;
    setProcessingIds(prev => new Set(prev).add(senderId));
    try {
      const result = await FriendshipService.approveRequest(currentUserId, senderId);
      if (result.success) {
        // ★ Kişiyi listeden silme — inline "Onaylandı" göster
        setHandledIds(prev => ({ ...prev, [senderId]: 'approved' }));
      }
    } catch {} finally {
      setProcessingIds(prev => { const n = new Set(prev); n.delete(senderId); return n; });
    }
  };

  const handleReject = async (senderId: string) => {
    if (!currentUserId) return;
    setProcessingIds(prev => new Set(prev).add(senderId));
    try {
      const result = await FriendshipService.rejectRequest(currentUserId, senderId);
      if (result.success) {
        // ★ Kişiyi listeden silme — inline "Reddedildi" göster
        setHandledIds(prev => ({ ...prev, [senderId]: 'rejected' }));
      }
    } catch {} finally {
      setProcessingIds(prev => { const n = new Set(prev); n.delete(senderId); return n; });
    }
  };

  React.useEffect(() => {
    if (visible) {
      isClosingRef.current = false;
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      if (isClosingRef.current) return; // swipe-close zaten yönetiyor
      // ★ 2026-04-25 FIX: Tab değişiminde anında kapat (animasyonsuz) —
      //   sayfa artık görünmediği için yavaş animasyon gereksiz, ghost overlay riski var.
      slideAnim.setValue(DRAWER_W);
      fadeAnim.setValue(0);
    }
  }, [visible]);

  // ★ 2026-05-05: Animasyonlu kapatma — backdrop tap'ında pürüzsüz translateX
  //   animasyonu çalışır, anlık setValue ile drawer "yarıda kalma" görsel artifact'i olmaz.
  const closeWithAnim = React.useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: DRAWER_W, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => onClose());
  }, [onClose]);

  // ★ Sürükleyerek kapatma (sağa swipe) — sıkı eşik, tap güvenliği
  const panResponder = React.useRef(
    React.useMemo(() => {
      let startX = 0;
      return require('react-native').PanResponder.create({
        // Dokunma başlangıcında asla responder olma — tap'lar child'a ulaşsın
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        // Hareket baskın yatay + minimum 25px olunca responder ol
        onMoveShouldSetPanResponder: (_: any, g: any) => {
          return g.dx > 25 && Math.abs(g.dx) > Math.abs(g.dy) * 2;
        },
        onMoveShouldSetPanResponderCapture: () => false,
        // Child'lar responder'ı asla kaybetmesin
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => { startX = (slideAnim as any)._value || 0; },
        onPanResponderMove: (_: any, g: any) => {
          // Parmağın konumunu aynen takip et (sadece sağa 0+)
          const newX = Math.max(0, startX + g.dx);
          slideAnim.setValue(newX);
          fadeAnim.setValue(Math.max(0, 1 - (newX / DRAWER_W) * 0.8));
        },
        onPanResponderRelease: (_: any, g: any) => {
          // Kapanma eşiği: drawer genişliğinin 1/3'ü veya hız > 0.5
          const closeThreshold = DRAWER_W / 3;
          if (g.dx > closeThreshold || g.vx > 0.5) {
            isClosingRef.current = true; // ★ Duplikasyon önleyici flag
            Animated.parallel([
              Animated.timing(slideAnim, { toValue: DRAWER_W, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
              Animated.timing(fadeAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
            ]).start(() => onClose());
          } else {
            // Geri yay — açık kal
            Animated.parallel([
              Animated.timing(slideAnim, { toValue: 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
              Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
            ]).start();
          }
        },
      });
    }, [])
  ).current;

  // ★ Sadece online arkadaşları göster (takip ilişkisi olan — her iki yön dahil)
  const onlineOnly = friends.filter(f => f.is_online);
  const onlineCount = onlineOnly.length;
  // ★ Bekleyen istek sayısı — handled olanları çıkar
  const activePendingCount = pendingRequests.filter(r => !handledIds[r.user_id]).length;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'box-none' : 'none'}>
      {/* Backdrop — tıklayınca animasyonlu kapanır */}
      <Animated.View style={[fd.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeWithAnim} />
      </Animated.View>

      {/* Panel — sağdan süzülür + sürüklenebilir, alt barın üstünde biter.
          ★ 2026-05-05 modernize: NotificationDrawer palette dilinde (3 katman gradient,
          accent halo, kart stili list rows) — modal tasarım tutarlılığı. */}
      <Animated.View {...panResponder.panHandlers} style={[fd.panel, { top: topGap, height: DRAWER_H, transform: [{ translateX: slideAnim }] }]}>
        {/* Profil sayfası gradient dili — diagonal slate */}
        <LinearGradient
          colors={['#3a4658', '#2a3344', '#1a2030']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        {/* Üst kenar yeşil accent halo — Çevrimiçi semantik */}
        <LinearGradient
          colors={['rgba(34,197,94,0.18)', 'rgba(34,197,94,0.05)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        {/* Üst-sol diyagonal yumuşak glow */}
        <LinearGradient
          colors={['rgba(20,184,166,0.08)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.6 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        {/* Başlık — sade ikon + yumuşak yeşil glow (halka yok, NotificationDrawer dili) */}
        <View style={fd.header}>
          <Ionicons name="radio" size={18} color="#22C55E" style={fd.headerIcon} />
          <Text style={fd.headerTitle}>Çevrimiçi</Text>
          {onlineCount > 0 && (
            <View style={fd.countPill}>
              <Text style={fd.countText}>{onlineCount}</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
        </View>
        <View style={fd.headerSeparator} />

        {/* Liste */}
        <ScrollView
          showsVerticalScrollIndicator
          indicatorStyle="white"
          contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 40 }}
        >

          {/* ★ TAKİP İSTEKLERİ — Instagram/X tarzı */}
          {pendingRequests.length > 0 && (
            <View style={fd.requestSection}>
              <View style={fd.requestHeader}>
                <Ionicons name="person-add" size={13} color="#60A5FA" />
                <Text style={fd.requestTitle}>Arkadaşlık İstekleri</Text>
                {activePendingCount > 0 && (
                  <View style={fd.requestCountPill}>
                    <Text style={fd.requestCountText}>{activePendingCount}</Text>
                  </View>
                )}
              </View>
              {pendingRequests.map((req) => {
                const sender = req.user;
                const isProcessing = processingIds.has(req.user_id);
                const handled = handledIds[req.user_id];

                return (
                  <View key={req.user_id} style={[fd.requestRow, handled && fd.requestRowHandled]}>
                    <Pressable
                      style={fd.requestAvatarWrap}
                      onPress={() => { onSelect(req.user_id); onClose(); }}
                    >
                      <StatusAvatar uri={sender?.avatar_url} size={34} tier={sender?.subscription_tier} frameId={(sender as any)?.active_frame || null} customBadgeId={(sender as any)?.active_badge_id ?? null} />
                    </Pressable>
                    <View style={{ flex: 1, marginRight: 6 }}>
                      <Text style={[fd.requestName, handled && { opacity: 0.6 }]} numberOfLines={1}>
                        {sender?.display_name || 'Kullanıcı'}
                      </Text>
                    </View>
                    {handled ? (
                      // ★ İşlenmiş durum — inline metin göster, kişiyi silme
                      <View style={[fd.handledPill, handled === 'approved' ? fd.handledApproved : fd.handledRejected]}>
                        <Ionicons
                          name={handled === 'approved' ? 'checkmark-circle' : 'close-circle'}
                          size={12}
                          color={handled === 'approved' ? '#22C55E' : '#EF4444'}
                        />
                        <Text style={[fd.handledText, { color: handled === 'approved' ? '#22C55E' : '#EF4444' }]}>
                          {handled === 'approved' ? 'Onaylandı' : 'Reddedildi'}
                        </Text>
                      </View>
                    ) : isProcessing ? (
                      <AppLoader size="small" color="#14B8A6" />
                    ) : (
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <Pressable style={fd.approveBtn} onPress={() => handleApprove(req.user_id)}>
                          <Ionicons name="checkmark" size={14} color="#FFF" />
                        </Pressable>
                        <Pressable style={fd.rejectBtn} onPress={() => handleReject(req.user_id)}>
                          <Ionicons name="close" size={14} color="#94A3B8" />
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Çevrimiçi Arkadaş Listesi — Sadece online olanlar */}
          {onlineOnly.length === 0 && pendingRequests.length === 0 ? (
            <View style={fd.empty}>
              <View style={fd.emptyIconWrap}>
                <Ionicons name="radio-outline" size={28} color="rgba(255,255,255,0.4)" />
              </View>
              <Text style={fd.emptyText}>Şu an kimse çevrimiçi değil</Text>
              <Text style={fd.emptySub}>Çevrimdışı arkadaşların profilinde listelenir</Text>
            </View>
          ) : onlineOnly.map((friend) => (
              <Pressable
                key={friend.id}
                style={({ pressed }) => [fd.row, pressed && { opacity: 0.7 }]}
                onPress={() => { onSelect(friend.id); onClose(); }}
              >
                <StatusAvatar uri={friend.avatar_url} size={36} isOnline={true} tier={(friend as any).subscription_tier} frameId={(friend as any).active_frame || null} customBadgeId={(friend as any).active_badge_id ?? null} />
                <View style={{ flex: 1 }}>
                  <Text style={fd.name} numberOfLines={1}>{friend.display_name}</Text>
                  <Text style={fd.status}>Çevrimiçi</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.15)" />
              </Pressable>
            ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const fd = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,12,22,0.45)' },
  panel: {
    position: 'absolute', right: 0,
    width: DRAWER_W,
    borderTopLeftRadius: 26, borderBottomLeftRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#1a2030',
    shadowColor: '#000',
    shadowOffset: { width: -8, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 22,
    elevation: 22,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingTop: 16, paddingBottom: 12,
  },
  // ★ 2026-05-05: NotificationDrawer dili — sade ikon + yumuşak glow (halka yok)
  headerIcon: {
    textShadowColor: 'rgba(34,197,94,0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
  },
  headerTitle: {
    fontSize: 15, fontWeight: '800', color: '#F1F5F9', letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4,
  },
  headerSeparator: {
    height: 1, backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 12,
  },
  countPill: {
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 100, minWidth: 20, alignItems: 'center',
    backgroundColor: 'rgba(34,197,94,0.18)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.45)',
  },
  countText: { color: '#86EFAC', fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  empty: { alignItems: 'center', paddingVertical: 56, gap: 14 },
  emptyIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyText: { fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: '600', letterSpacing: 0.3 },
  emptySub: { fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: -8, textAlign: 'center', paddingHorizontal: 12 },
  // ★ Kart stili row — NotificationDrawer'daki notifItem ile aynı dil
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    marginVertical: 3,
  },
  avatarWrap: {
    width: 36, height: 36, borderRadius: 18, position: 'relative' as const,
  },
  avatar: { width: 33, height: 33, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.05)' },
  dot: {
    position: 'absolute' as const, bottom: -1, right: -1,
    width: 11, height: 11, borderRadius: 6,
    borderWidth: 2, borderColor: 'rgba(15,23,42,0.96)',
  },
  dotOn: { backgroundColor: '#22C55E' },
  dotOff: { backgroundColor: '#475569' },
  name: {
    fontSize: 13, fontWeight: '700', color: '#F1F5F9',
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  status: { fontSize: 10, color: '#86EFAC', marginTop: 2, fontWeight: '600', letterSpacing: 0.2 },

  // ★ Takip İstekleri bölümü
  requestSection: {
    marginBottom: 8, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  requestHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 6, paddingVertical: 8,
  },
  requestTitle: {
    fontSize: 11, fontWeight: '700', color: '#60A5FA',
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  requestCountPill: {
    backgroundColor: 'rgba(96,165,250,0.15)', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 1,
    borderWidth: 1, borderColor: 'rgba(96,165,250,0.2)',
  },
  requestCountText: { fontSize: 9, fontWeight: '800', color: '#60A5FA' },
  requestRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 9, paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(96,165,250,0.06)',
    borderWidth: 1, borderColor: 'rgba(96,165,250,0.18)',
    marginVertical: 3,
  },
  requestAvatarWrap: {},
  requestAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.05)' },
  requestName: {
    fontSize: 12, fontWeight: '600', color: '#F1F5F9',
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  approveBtn: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: '#14B8A6', alignItems: 'center', justifyContent: 'center',
  },
  rejectBtn: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  // ★ İnline işlenmiş durum stilleri
  requestRowHandled: {
    opacity: 0.7,
  },
  handledPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8,
  },
  handledApproved: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)',
  },
  handledRejected: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)',
  },
  handledText: {
    fontSize: 10, fontWeight: '700',
  },
});
