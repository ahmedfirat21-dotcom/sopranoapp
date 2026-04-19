import React from 'react';
import { View, Text, StyleSheet, Pressable, Animated, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { FriendshipService, type FollowUser } from '../services/friendship';
import { supabase } from '../constants/supabase';
import StatusAvatar from './StatusAvatar';
import { Colors } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Tab bar height + gap — alt navigasyon barının üstünde bitsin
const TAB_BAR_SPACE = 60 + 8 + 6; // BAR_H (60) + min paddingBottom (8) + extra gap

const { width: W } = Dimensions.get('window');
const DRAWER_W = Math.min(W * 0.55, 280);

export default function FriendsDrawer({ visible, friends, onClose, onSelect, currentUserId }: {
  visible: boolean;
  friends: FollowUser[];
  onClose: () => void;
  onSelect: (userId: string) => void;
  currentUserId?: string;
}) {
  const insets = useSafeAreaInsets();
  // Alt barın üstünde bitsin: BAR_H + safe area + ufak boşluk
  const bottomGap = Math.max(insets.bottom, 8) + TAB_BAR_SPACE;
  // Üst safe area + ekstra kısaltma
  const topGap = insets.top + 12;
  const slideAnim = React.useRef(new Animated.Value(DRAWER_W)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
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
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: DRAWER_W, useNativeDriver: true, damping: 20, stiffness: 220 }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

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
            Animated.parallel([
              Animated.timing(slideAnim, { toValue: DRAWER_W, duration: 220, useNativeDriver: true }),
              Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
            ]).start(() => onClose());
          } else {
            // Geri yay — açık kal
            Animated.parallel([
              Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 240 }),
              Animated.timing(fadeAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
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
      {/* Backdrop */}
      <Animated.View style={[fd.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Panel — sağdan süzülür + sürüklenebilir, alt barın üstünde biter */}
      <Animated.View {...panResponder.panHandlers} style={[fd.panel, { top: topGap, bottom: bottomGap, transform: [{ translateX: slideAnim }] }]}>
        {/* ★ Odalarım kart paleti: diagonal gradient (parlak üst-sol → koyu alt-sağ) */}
        <LinearGradient
          colors={['#4a5668', '#37414f', '#232a35']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Başlık */}
        <View style={fd.header}>
          <Ionicons name="radio" size={15} color="#22C55E" />
          <Text style={fd.headerTitle}>Çevrimiçi</Text>
          <View style={fd.countPill}>
            <Text style={fd.countText}>{onlineCount} aktif</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={16} color="rgba(255,255,255,0.4)" />
          </Pressable>
        </View>

        {/* Liste */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 40 }}>

          {/* ★ TAKİP İSTEKLERİ — Instagram/X tarzı */}
          {pendingRequests.length > 0 && (
            <View style={fd.requestSection}>
              <View style={fd.requestHeader}>
                <Ionicons name="person-add" size={13} color="#60A5FA" />
                <Text style={fd.requestTitle}>Takip İstekleri</Text>
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
                      <StatusAvatar uri={sender?.avatar_url} size={34} tier={sender?.subscription_tier} />
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
                      <ActivityIndicator size="small" color="#14B8A6" />
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
              <Ionicons name="radio-outline" size={32} color="rgba(34,197,94,0.2)" />
              <Text style={fd.emptyText}>Şu an çevrimiçi arkadaşın yok</Text>
              <Text style={[fd.emptyText, { fontSize: 10, marginTop: -4 }]}>Çevrimdışı arkadaşların profilinde listelenir</Text>
            </View>
          ) : onlineOnly.map((friend) => (
              <Pressable
                key={friend.id}
                style={({ pressed }) => [fd.row, pressed && { opacity: 0.8, backgroundColor: 'rgba(255,255,255,0.04)' }]}
                onPress={() => { onSelect(friend.id); onClose(); }}
              >
                  <StatusAvatar uri={friend.avatar_url} size={33} isOnline={true} tier={(friend as any).subscription_tier} />
                <View style={{ flex: 1 }}>
                  <Text style={fd.name} numberOfLines={1}>{friend.display_name}</Text>
                  <Text style={[fd.status, { color: '#22C55E' }]}>Çevrimiçi</Text>
                </View>
                <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.1)" />
              </Pressable>
            ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const fd = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  panel: {
    position: 'absolute', right: 0,
    width: DRAWER_W,
    borderTopLeftRadius: 22, borderBottomLeftRadius: 22,
    borderWidth: 1, borderRightWidth: 0,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: -6, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 16,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  headerTitle: {
    fontSize: 14, fontWeight: '700', color: '#F1F5F9',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  countPill: {
    backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.18)',
  },
  countText: { color: '#22C55E', fontSize: 9, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { fontSize: 12, color: 'rgba(255,255,255,0.25)' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 9, paddingHorizontal: 6, borderRadius: 12,
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
    fontSize: 12, fontWeight: '600', color: '#F1F5F9',
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  status: { fontSize: 9, color: 'rgba(255,255,255,0.25)', marginTop: 1 },

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
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 7, paddingHorizontal: 6, borderRadius: 10,
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
