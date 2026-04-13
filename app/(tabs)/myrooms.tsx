import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Image, Pressable, ScrollView,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AppBackground from '../../components/AppBackground';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, Shadows } from '../../constants/theme';
import { RoomService, type Room } from '../../services/database';
import { supabase } from '../../constants/supabase';
import { useAuth, useTheme, useBadges } from '../_layout';
import { getAvatarSource } from '../../constants/avatars';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { showToast } from '../../components/Toast';
import { RoomHistoryService, type RoomHistoryItem } from '../../services/roomHistory';

// ════════════════════════════════════════════════════════════
// YÖNETİLEN ODA KARTI — Yönet/Başlat butonları
// ════════════════════════════════════════════════════════════
function ManagedRoomCard({ room, onManage, onStart }: {
  room: Room; onManage: () => void; onStart: () => void;
}) {
  const listeners = (room as any).participant_count || (room as any).listener_count || 0;
  const isLive = room.is_live;
  const isPersistent = (room as any).is_persistent;
  const settings = (room.room_settings || {}) as any;

  return (
    <View style={[mS.card, isPersistent && { borderColor: Colors.premiumGold, borderWidth: 1.5 }]}>
      <View style={mS.cardLeft}>
        <Image source={getAvatarSource(room.host?.avatar_url)} style={mS.avatar} />
        <View style={mS.cardInfo}>
          <Text style={mS.roomName} numberOfLines={1}>{room.name}</Text>
          <View style={mS.metaRow}>
            {isLive ? (
              <View style={mS.liveBadge}>
                <View style={mS.liveDot} />
                <Text style={mS.liveText}>Canlı</Text>
              </View>
            ) : (
              <Text style={mS.offlineText}>❄️ Dondurulmuş</Text>
            )}
            {/* Oda tipi badge'leri */}
            {room.type === 'closed' && (
              <View style={mS.typeBadge}>
                <Ionicons name="lock-closed" size={8} color="#F59E0B" />
                <Text style={[mS.typeBadgeText, { color: '#F59E0B' }]}>Şifreli</Text>
              </View>
            )}
            {room.type === 'invite' && (
              <View style={[mS.typeBadge, { backgroundColor: 'rgba(139,92,246,0.12)', borderColor: 'rgba(139,92,246,0.25)' }]}>
                <Ionicons name="mail" size={8} color="#8B5CF6" />
                <Text style={[mS.typeBadgeText, { color: '#8B5CF6' }]}>Davetli</Text>
              </View>
            )}
            {settings.entry_fee_sp > 0 && (
              <View style={[mS.typeBadge, { backgroundColor: 'rgba(212,175,55,0.12)', borderColor: 'rgba(212,175,55,0.25)' }]}>
                <Text style={[mS.typeBadgeText, { color: '#D4AF37' }]}>{settings.entry_fee_sp} SP</Text>
              </View>
            )}
            {settings.followers_only && (
              <Ionicons name="people" size={9} color="#A78BFA" style={{ marginLeft: 2 }} />
            )}
            {settings.donations_enabled && (
              <Ionicons name="heart" size={9} color="#EF4444" style={{ marginLeft: 2 }} />
            )}
          </View>
        </View>
      </View>
      <View style={mS.cardRight}>
        {isLive ? (
          <Pressable style={mS.manageBtn} onPress={onManage}>
            <Ionicons name="enter-outline" size={14} color={Colors.accentTeal} />
            <Text style={mS.manageBtnText}>Odaya Git</Text>
          </Pressable>
        ) : (
          <Pressable style={[mS.startBtn, { backgroundColor: 'rgba(251,191,36,0.12)', borderColor: 'rgba(251,191,36,0.3)' }]} onPress={onStart}>
            <Ionicons name="sunny" size={14} color="#FBBF24" />
            <Text style={[mS.startBtnText, { color: '#FBBF24' }]}>Uyandır</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const mS = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...Shadows.card,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)' },
  cardInfo: { flex: 1 },
  roomName: {
    fontSize: 14, fontWeight: '700', color: '#F1F5F9',
    ...Shadows.text,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },
  liveText: { fontSize: 10, fontWeight: '700', color: '#EF4444' },
  offlineText: { fontSize: 11, color: '#94A3B8' },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(245,158,11,0.12)', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6, borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)',
  },
  typeBadgeText: { fontSize: 8, fontWeight: '700' },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  manageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    backgroundColor: 'rgba(115,194,189,0.1)', borderWidth: 1, borderColor: 'rgba(115,194,189,0.25)',
  },
  manageBtnText: { fontSize: 11, fontWeight: '700', color: Colors.accentTeal },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    backgroundColor: 'rgba(115,194,189,0.1)', borderWidth: 1, borderColor: 'rgba(115,194,189,0.25)',
  },
  startBtnText: { fontSize: 11, fontWeight: '700', color: Colors.accentTeal },
});

// ════════════════════════════════════════════════════════════
// SON GİRDİĞİN ODALAR — Kısayol Kartı
// ════════════════════════════════════════════════════════════
function RecentRoomCard({ item, onPress }: { item: RoomHistoryItem; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [rcS.card, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
      onPress={onPress}
    >
      <Image source={getAvatarSource(item.hostAvatar)} style={rcS.avatar} />
      <Text style={rcS.name} numberOfLines={1}>{item.name}</Text>
      <Text style={rcS.host} numberOfLines={1}>{item.hostName}</Text>
    </Pressable>
  );
}

const rcS = StyleSheet.create({
  card: {
    width: 80, alignItems: 'center', marginRight: 12,
    paddingVertical: 10, paddingHorizontal: 6, borderRadius: 14,
    backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder,
    ...Shadows.card,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, marginBottom: 6 },
  name: {
    fontSize: 10, fontWeight: '700', color: '#F1F5F9', textAlign: 'center',
    ...Shadows.text,
  },
  host: { fontSize: 9, color: '#94A3B8', textAlign: 'center', marginTop: 1 },
});

// ════════════════════════════════════════════════════════════
// ODALARIM EKRANI
// ════════════════════════════════════════════════════════════
export default function MyRoomsScreen() {
  const router = useRouter();
  const { firebaseUser, profile, setShowNotifDrawer } = useAuth();
  const insets = useSafeAreaInsets();
  useTheme();

  const [myRooms, setMyRooms] = useState<Room[]>([]);
  const [recentRooms, setRecentRooms] = useState<RoomHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { unreadNotifs: unreadCount } = useBadges();

  const loadData = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const managed = await RoomService.getMyRooms(firebaseUser.uid);
      setMyRooms(managed);

      // ★ OPT-M1 FIX: getLive() kaldırıldı — history ID'leriyle toplu kontrol
      const history = await RoomHistoryService.getRecent(6);
      if (history.length > 0) {
        const historyIds = history.map(h => h.id);
        const { data: liveCheck } = await supabase
          .from('rooms')
          .select('id')
          .in('id', historyIds)
          .eq('is_live', true);
        const liveSet = new Set((liveCheck || []).map((r: any) => r.id));
        setRecentRooms(history.filter(h => liveSet.has(h.id)));
      } else {
        setRecentRooms([]);
      }


    } catch (err) {
      if (__DEV__) console.warn('[MyRooms] Load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [firebaseUser]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // BUG-M1 FIX: Realtime oda değişikliklerini dinle (canlı↔uyku, katılımcı sayısı)
  useEffect(() => {
    if (!firebaseUser) return;
    // ★ BUG-M2 FIX: Sadece anlamlı değişikliklerde yeniden yükle (listener_count hariç)
    const channel = supabase
      .channel('myrooms-realtime')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'rooms',
        filter: `host_id=eq.${firebaseUser.uid}`,
      }, (payload) => {
        // INSERT/DELETE → her zaman yenile
        if (payload.eventType !== 'UPDATE') { loadData(); return; }
        // UPDATE → sadece is_live, name, type gibi önemli alan değişikliklerinde yenile
        const updated = payload.new as any;
        const old = payload.old as any;
        if (updated.is_live !== old?.is_live || updated.name !== old?.name || updated.type !== old?.type) {
          loadData();
        } else {
          // listener_count gibi kozmetik değişikliklerde inline güncelle
          setMyRooms(prev => prev.map(r =>
            r.id === updated.id ? { ...r, listener_count: updated.listener_count } : r
          ));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [firebaseUser, loadData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // Uyuyan odayı uyandır — DB'de is_live=true yap, süre sıfırla, sonra odaya git
  const handleWakeUp = async (room: Room) => {
    if (!firebaseUser) return;
    try {
      const tier = (profile?.subscription_tier || 'Free') as any;
      await RoomService.wakeUpRoom(room.id, firebaseUser.uid, tier);
      showToast({ title: '☀️ Oda Uyandırıldı!', message: `"${room.name}" tekrar canlı!`, type: 'success' });
      router.push(`/room/${room.id}`);
    } catch (err: any) {
      showToast({ title: 'Uyandırma Başarısız', message: err.message || 'Oda uyandırılamadı.', type: 'error' });
    }
  };

  // Canlı odayı yönet — direkt odaya git
  const handleManage = (room: Room) => {
    if (room.is_live) {
      router.push(`/room/${room.id}`);
    } else {
      // Uyuyan oda — önce uyandır
      handleWakeUp(room);
    }
  };

  return (
    <AppBackground variant="myrooms">
    <View style={s.container}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 4 }]}>
        <Image source={require('../../assets/logo.png')} style={s.logo} resizeMode="contain" />
        <View style={s.headerRight}>
          <Pressable style={s.headerIconBtn} onPress={() => setShowNotifDrawer(true)}>
            <Ionicons name="notifications-outline" size={20} color="#F1F5F9" />
            {unreadCount > 0 && (
              <View style={s.notifBadge}>
                <Text style={s.notifBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>


      {/* Yeni Oda Oluştur — Premium Gradient */}
      <Pressable style={s.ctaWrap} onPress={() => router.push('/create-room')}>
        <LinearGradient
          colors={['#14B8A6', '#0D9488', '#065F56']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.ctaGradient}
        >
          <View style={s.ctaIconWrap}>
            <Ionicons name="add-circle" size={22} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.ctaTitle}>Yeni Oda Oluştur</Text>
            <Text style={s.ctaSub}>Sesli veya görüntülü oda aç</Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color="rgba(255,255,255,0.7)" />
        </LinearGradient>
      </Pressable>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.accentTeal} colors={[Colors.accentTeal]} />
        }
      >
        {/* Yönettiğim Odalar */}
        <Text style={s.sectionTitle}>Yönettiğim Odalar</Text>
        {myRooms.length > 0 ? (
          myRooms.map((room) => (
            <ManagedRoomCard
              key={room.id}
              room={room}
              onManage={() => handleManage(room)}
              onStart={() => handleWakeUp(room)}
            />
          ))
        ) : (
          <View style={s.emptyCard}>
            <View style={s.emptyImageWrap}>
              <Image source={require('../../assets/images/mock/empty_room_mic.png')} style={s.emptyImage} resizeMode="contain" />
            </View>
            <Text style={s.emptyTitle}>Henüz bir odanız yok.{'\n'}İlk odanızı oluşturun!</Text>
            <Text style={s.emptySub}>Sesli sohbet, müzik, oyun ve daha fazlası...</Text>
          </View>
        )}

        {/* Son Girdiğin Odalar */}
        <Text style={s.sectionTitle}>Son Girdiğin Odalar</Text>
        {recentRooms.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            style={{ marginBottom: 4 }}
          >
            {recentRooms.map((item) => (
              <RecentRoomCard
                key={item.id}
                item={item}
                onPress={() => router.push(`/room/${item.id}`)}
              />
            ))}
          </ScrollView>
        ) : (
          <View style={s.emptyFollowed}>
            <Text style={s.emptyFollowedText}>
              Henüz bir odaya girmedin.{`\n`}Keşfet sayfasından odalara katıl!
            </Text>
          </View>
        )}
      </ScrollView>


    </View></AppBackground>
  );
}

// ════════════════════════════════════════════════════════════
// ANA STİLLER
// ════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },

  /* Header */
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingBottom: 2,
  },
  logo: { height: 32, width: 150 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3,
    overflow: 'visible',
  },
  notifBadge: {
    position: 'absolute', top: -2, right: -2, backgroundColor: '#EF4444', minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: Colors.bg
  },
  notifBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFF' },

  /* Welcome */
  welcomeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingBottom: 10,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 1.5, borderColor: 'rgba(115,194,189,0.35)',
  },
  welcomeTitle: {
    fontSize: 15, fontWeight: '700', color: '#F1F5F9',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  welcomeSub: {
    fontSize: 11, color: '#94A3B8', marginTop: 1,
    textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },

  /* CTA — Premium Gradient */
  ctaWrap: {
    marginHorizontal: 16, marginBottom: 16,
    borderRadius: 18, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 5,
  },
  ctaGradient: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 18, paddingHorizontal: 18, gap: 14,
  },
  ctaIconWrap: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  ctaTitle: {
    fontSize: 16, fontWeight: '800', color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  ctaSub: {
    fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2,
  },

  /* Section Title */
  sectionTitle: {
    fontSize: 16, fontWeight: '700', color: '#F1F5F9', letterSpacing: 0.3,
    paddingHorizontal: 16, marginTop: 16, marginBottom: 10,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },

  /* Empty — Yönettiğim Odalar */
  emptyCard: {
    marginHorizontal: 16, borderRadius: 16,
    backgroundColor: '#414e5f', borderWidth: 1, borderColor: Colors.cardBorder,
    overflow: 'hidden', alignItems: 'center', paddingBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  emptyImageWrap: {
    width: '80%', marginTop: 12, marginBottom: 16, borderRadius: 80, overflow: 'hidden',
  },
  emptyImage: { width: '100%', height: 180 },
  emptyTitle: {
    fontSize: 15, fontWeight: '800', color: '#F1F5F9', textAlign: 'center', lineHeight: 22, marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  emptySub: {
    fontSize: 12, color: '#94A3B8', textAlign: 'center', lineHeight: 18,
    textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },

  /* Empty — Takip Ettiğim Odalar */
  emptyFollowed: {
    marginHorizontal: 16, padding: 20, borderRadius: 16,
    backgroundColor: '#414e5f', borderWidth: 1, borderColor: Colors.cardBorder,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  emptyFollowedText: {
    fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
});
