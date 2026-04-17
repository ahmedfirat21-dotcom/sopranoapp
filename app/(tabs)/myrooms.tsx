import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Image, Pressable, ScrollView,
  RefreshControl, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AppBackground from '../../components/AppBackground';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, Shadows } from '../../constants/theme';
import { RoomService, type Room } from '../../services/database';
import { supabase } from '../../constants/supabase';
import { useAuth, useTheme, useBadges } from '../_layout';

import StatusAvatar from '../../components/StatusAvatar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { showToast } from '../../components/Toast';
import { RoomHistoryService, type RoomHistoryItem } from '../../services/roomHistory';
import { useOnlineFriends } from '../../providers/OnlineFriendsProvider';
import { SPService } from '../../services/sp';
import { PlusMenu } from '../../components/room/RoomOverlays';
import { RoomFollowService } from '../../services/roomFollow';
import { ModerationService } from '../../services/moderation';
import { isTierAtLeast } from '../../constants/tiers';
import InviteFriendsModal from '../../components/room/InviteFriendsModal';
import { RoomAccessService } from '../../services/roomAccess';
import { PushService } from '../../services/push';
import type { FollowUser } from '../../services/friendship';

// ════════════════════════════════════════════════════════════
// YÖNETİLEN ODA KARTI — Yönet/Başlat butonları
// ════════════════════════════════════════════════════════════
function ManagedRoomCard({ room, onManage, onStart, onSettings }: {
  room: Room; onManage: () => void; onStart: () => void; onSettings: () => void;
}) {
  const listeners = (room as any).participant_count || (room as any).listener_count || 0;
  const isLive = room.is_live;
  const isPersistent = (room as any).is_persistent;
  const settings = (room.room_settings || {}) as any;

  return (
    <View style={[mS.card, isPersistent && { borderColor: Colors.premiumGold, borderWidth: 1.5 }]}>
      {/* Sol accent çizgisi — canlı: yeşil, dondurulmuş: gri */}
      <View style={[mS.accentStripe, isLive ? { backgroundColor: '#14B8A6' } : { backgroundColor: '#475569' }]} />
      <View style={mS.cardLeft}>
        <StatusAvatar uri={room.host?.avatar_url} size={40} tier={(room.host as any)?.subscription_tier} />
        <View style={mS.cardInfo}>
          <Text style={mS.roomName} numberOfLines={1}>{room.name}</Text>
          <View style={mS.metaRow}>
            {isLive ? (
              <View style={mS.liveBadge}>
                <View style={mS.liveDot} />
                <Text style={mS.liveText}>Canlı</Text>
                {listeners > 0 && <Text style={mS.listenerCount}>· {listeners}</Text>}
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
        {/* ⚙️ Yönet butonu — her zaman göster */}
        <Pressable style={mS.settingsBtn} onPress={onSettings}>
          <Ionicons name="settings-outline" size={18} color="#94A3B8" />
        </Pressable>
        {isLive ? (
          <Pressable style={({ pressed }) => [mS.manageBtn, pressed && { opacity: 0.8 }]} onPress={onManage}>
            <Ionicons name="enter-outline" size={14} color={Colors.accentTeal} />
            <Text style={mS.manageBtnText}>Odaya Git</Text>
          </Pressable>
        ) : (
          <Pressable style={({ pressed }) => [mS.startBtn, pressed && { opacity: 0.8 }]} onPress={onStart}>
            <Ionicons name="sunny" size={14} color="#FBBF24" />
            <Text style={mS.startBtnText}>Uyandır</Text>
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
    marginBottom: 8,
    padding: 12,
    paddingLeft: 16,
    borderRadius: 16,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
    ...Shadows.card,
  },
  accentStripe: {
    position: 'absolute', left: 0, top: 8, bottom: 8,
    width: 3, borderRadius: 2,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)' },
  cardInfo: { flex: 1 },
  roomName: {
    fontSize: 14, fontWeight: '700', color: '#F1F5F9',
    ...Shadows.text,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },
  liveText: { fontSize: 10, fontWeight: '700', color: '#EF4444' },
  listenerCount: { fontSize: 10, fontWeight: '600', color: '#94A3B8', marginLeft: 2 },
  offlineText: { fontSize: 11, color: '#94A3B8' },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(245,158,11,0.12)', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6, borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)',
  },
  typeBadgeText: { fontSize: 8, fontWeight: '700' },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  settingsBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(149,161,174,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
  manageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12,
    backgroundColor: 'rgba(20,184,166,0.12)', borderWidth: 1, borderColor: 'rgba(20,184,166,0.30)',
  },
  manageBtnText: { fontSize: 11, fontWeight: '700', color: Colors.accentTeal },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12,
    backgroundColor: 'rgba(251,191,36,0.12)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)',
  },
  startBtnText: { fontSize: 11, fontWeight: '700', color: '#FBBF24' },
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
      <StatusAvatar uri={item.hostAvatar} size={44} />
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

  name: {
    fontSize: 10, fontWeight: '700', color: '#F1F5F9', textAlign: 'center',
    ...Shadows.text,
  },
  host: { fontSize: 9, color: '#94A3B8', textAlign: 'center', marginTop: 1 },
});

// ════════════════════════════════════════════════════════════
// ARKADAŞLARIN CANLI — Sosyal FOMO Kartı
// ════════════════════════════════════════════════════════════
type FriendInRoom = {
  friendId: string;
  friendName: string;
  friendAvatar: string;
  roomId: string;
  roomName: string;
};

function FriendLiveCard({ item, onPress }: { item: FriendInRoom; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [flcS.card, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
      onPress={onPress}
    >
      <StatusAvatar uri={item.friendAvatar} size={36} isOnline={true} />
      <Text style={flcS.friendName} numberOfLines={1}>{item.friendName}</Text>
      <Text style={flcS.roomName} numberOfLines={1}>{item.roomName}</Text>
      <View style={flcS.joinBtn}>
        <Ionicons name="enter-outline" size={10} color="#22C55E" />
        <Text style={flcS.joinText}>Katıl</Text>
      </View>
    </Pressable>
  );
}

const flcS = StyleSheet.create({
  card: {
    width: 88, alignItems: 'center', marginRight: 12,
    paddingVertical: 10, paddingHorizontal: 6, borderRadius: 14,
    backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder,
    ...Shadows.card, position: 'relative',
  },

  friendName: {
    fontSize: 10, fontWeight: '700', color: '#F1F5F9', textAlign: 'center',
    ...Shadows.text,
  },
  roomName: {
    fontSize: 8, color: '#94A3B8', textAlign: 'center', marginTop: 2,
    lineHeight: 11,
  },
  joinBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    marginTop: 5, backgroundColor: 'rgba(34,197,94,0.12)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)',
  },
  joinText: { fontSize: 9, fontWeight: '800', color: '#22C55E' },
});

// ════════════════════════════════════════════════════════════
// SP KAZANÇ ÖZETİ — Motivasyon Banner
// ════════════════════════════════════════════════════════════
function SPBanner({ weeklySP }: { weeklySP: number }) {
  // ★ BUG FIX: Pulsing glow animasyonu — cleanup eklendi (memory leak fix)
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const pulseRef = React.useRef<Animated.CompositeAnimation | null>(null);
  React.useEffect(() => {
    if (weeklySP > 0) {
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        ])
      );
      pulseRef.current.start();
    }
    return () => { pulseRef.current?.stop(); };
  }, [weeklySP]);

  const motivationText = weeklySP === 0
    ? 'Bu hafta henüz SP kazanmadın. Oda aç ve kazan!'
    : weeklySP < 50
      ? 'İyi başlangıç! Daha fazla kazanmak için devam et 💪'
      : weeklySP < 200
        ? 'Harika gidiyorsun! Rakamlar yükseliyor 📈'
        : 'Efsane bir hafta! Sen bir SP makinesisin 🔥';

  return (
    <View style={spS.wrap}>
      <LinearGradient
        colors={['#7C3AED', '#6D28D9', '#4C1D95']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={spS.gradient}
      >
        <Animated.View style={[spS.iconWrap, { transform: [{ scale: pulseAnim }] }]}>
          <Text style={spS.iconText}>💎</Text>
        </Animated.View>
        <View style={spS.textCol}>
          <Text style={spS.title}>Bu Hafta</Text>
          <Text style={spS.amount}>{weeklySP.toLocaleString('tr-TR')} SP</Text>
        </View>
        <Text style={spS.motivation} numberOfLines={1}>{motivationText}</Text>
      </LinearGradient>
    </View>
  );
}

const spS = StyleSheet.create({
  wrap: {
    marginHorizontal: 16, marginTop: 6, marginBottom: 12,
    borderRadius: 14, overflow: 'hidden',
    // Opak gradient — elevation güvenli
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  gradient: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 14, gap: 10,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  iconText: { fontSize: 18 },
  textCol: {},
  title: {
    fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.3,
  },
  amount: {
    fontSize: 16, fontWeight: '900', color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  motivation: {
    flex: 1, fontSize: 10, color: 'rgba(255,255,255,0.55)',
    textAlign: 'right', fontWeight: '500',
  },
});

// ════════════════════════════════════════════════════════════
// ODA İSTATİSTİKLERİ — Kompakt Bar
// ════════════════════════════════════════════════════════════
type RoomStats = {
  totalRooms: number;
  liveRooms: number;
  totalListeners: number;
  weeklySP: number;
};

function StatsBar({ stats }: { stats: RoomStats }) {
  const items = [
    { value: stats.totalRooms, label: 'Oda', color: '#38BDF8', icon: 'home' as const },
    { value: stats.liveRooms, label: 'Canlı', color: '#EF4444', icon: 'radio' as const },
    { value: stats.totalListeners, label: 'Dinleyici', color: '#22C55E', icon: 'people' as const },
    { value: stats.weeklySP, label: 'SP/Hafta', color: '#A78BFA', icon: 'diamond' as const },
  ];

  return (
    <View style={dashS.bar}>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <View style={dashS.sep} />}
          <View style={dashS.cell}>
            <View style={dashS.valueRow}>
              <Ionicons name={item.icon} size={11} color={item.color} />
              <Text style={[dashS.value, { color: item.color }]}>
                {item.value > 999 ? `${(item.value / 1000).toFixed(1)}k` : item.value}
              </Text>
            </View>
            <Text style={dashS.label}>{item.label}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

const dashS = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 8,
    paddingVertical: 8, paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(51,59,69,0.7)',
    borderWidth: 1, borderColor: 'rgba(149,161,174,0.15)',
  },
  sep: {
    width: 1, height: 22, backgroundColor: 'rgba(148,163,184,0.15)',
  },
  cell: {
    flex: 1, alignItems: 'center',
  },
  valueRow: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
  },
  value: {
    fontSize: 14, fontWeight: '800',
  },
  label: {
    fontSize: 8, fontWeight: '600', color: '#64748B',
    marginTop: 1, letterSpacing: 0.2,
  },
});

// ════════════════════════════════════════════════════════════
// HIZLI ODA ŞABLONLARI
// ════════════════════════════════════════════════════════════
const ROOM_TEMPLATES = [
  { id: 'chat', emoji: '💬', label: 'Sohbet', name: '', category: 'chat', type: 'open', mode: 'audio', speaking: 'free_for_all', colors: ['#14B8A6', '#065F56'] as [string, string] },
  { id: 'music', emoji: '🎵', label: 'Müzik', name: '', category: 'music', type: 'open', mode: 'audio', speaking: 'permission_only', colors: ['#8B5CF6', '#4C1D95'] as [string, string] },
  { id: 'game', emoji: '🎮', label: 'Oyun', name: '', category: 'game', type: 'open', mode: 'audio', speaking: 'free_for_all', colors: ['#EF4444', '#7F1D1D'] as [string, string] },
  { id: 'private', emoji: '🔒', label: 'Özel', name: '', category: 'chat', type: 'closed', mode: 'audio', speaking: 'permission_only', colors: ['#F59E0B', '#78350F'] as [string, string] },
  { id: 'podcast', emoji: '🎤', label: 'Podcast', name: '', category: 'tech', type: 'open', mode: 'audio', speaking: 'selected_only', colors: ['#3B82F6', '#1E3A8A'] as [string, string] },
];

const tplS = StyleSheet.create({
  card: {
    marginRight: 8, borderRadius: 10, overflow: 'hidden',
  },
  gradient: {
    width: 64, height: 52, alignItems: 'center', justifyContent: 'center',
    borderRadius: 10,
  },
  emoji: { fontSize: 18 },
  label: {
    fontSize: 8, fontWeight: '700', color: 'rgba(255,255,255,0.85)',
    marginTop: 2, letterSpacing: 0.2,
  },
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
  const [friendsLive, setFriendsLive] = useState<FriendInRoom[]>([]);
  const [weeklySP, setWeeklySP] = useState(0);
  const [roomStats, setRoomStats] = useState<RoomStats>({ totalRooms: 0, liveRooms: 0, totalListeners: 0, weeklySP: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showInviteFriends, setShowInviteFriends] = useState(false);

  const { unreadNotifs: unreadCount } = useBadges();
  const { allFriends } = useOnlineFriends();

  // ★ Realtime kanal bağımlılık fix: ref pattern
  const loadDataRef = useRef<() => Promise<void>>();
  const refreshFriendsLiveRef = useRef<() => Promise<void>>();

  const loadData = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const managed = await RoomService.getMyRooms(firebaseUser.uid);

      // ★ STATS FIX: Gerçek katılımcı sayısını room_participants'tan hesapla
      // listener_count DB'de güncel olmayabilir (RPC yoksa)
      const liveRoomIds = managed.filter(r => r.is_live).map(r => r.id);
      let totalListeners = 0;
      if (liveRoomIds.length > 0) {
        try {
          const { data: participantRows } = await supabase
            .from('room_participants')
            .select('room_id')
            .in('room_id', liveRoomIds);
          // Room bazlı sayım
          const countMap = new Map<string, number>();
          (participantRows || []).forEach((row: any) => {
            countMap.set(row.room_id, (countMap.get(row.room_id) || 0) + 1);
          });
          // Her odaya gerçek katılımcı sayısını ata
          managed.forEach(r => {
            if (countMap.has(r.id)) {
              (r as any).participant_count = countMap.get(r.id) || 0;
            }
          });
          totalListeners = Array.from(countMap.values()).reduce((sum, c) => sum + c, 0);
        } catch {
          // Fallback: listener_count'u kullan
          totalListeners = managed.reduce((sum, r) => sum + ((r as any).listener_count || 0), 0);
        }
      }
      setMyRooms(managed);
      const liveRooms = liveRoomIds.length;
      setRoomStats(prev => ({ ...prev, totalRooms: managed.length, liveRooms, totalListeners }));

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

      // ★ Faz 1: Arkadaşlarının canlı olduğu odalar
      try {
        const friendIds = allFriends.map(f => f.id);
        if (friendIds.length > 0) {
          const { data: participantData } = await supabase
            .from('room_participants')
            .select('user_id, room_id, rooms:rooms!room_id(id, name, is_live), profiles:profiles!user_id(display_name, avatar_url)')
            .in('user_id', friendIds.slice(0, 50));

          const liveItems: FriendInRoom[] = (participantData || [])
            .filter((p: any) => p.rooms?.is_live)
            .map((p: any) => ({
              friendId: p.user_id,
              friendName: p.profiles?.display_name || 'Arkadaş',
              friendAvatar: p.profiles?.avatar_url || '',
              roomId: p.rooms?.id || p.room_id,
              roomName: p.rooms?.name || 'Oda',
            }));
          // Aynı arkadaşı tekrar gösterme (birden fazla oda katılımı olabilir)
          const seen = new Set<string>();
          const unique = liveItems.filter(item => {
            if (seen.has(item.friendId)) return false;
            seen.add(item.friendId);
            return true;
          });
          setFriendsLive(unique.slice(0, 10));
        } else {
          setFriendsLive([]);
        }
      } catch (flErr) {
        if (__DEV__) console.warn('[MyRooms] Friends live error:', flErr);
        setFriendsLive([]);
      }

      // ★ Faz 1: Haftalık SP kazancı
      try {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const { data: spData } = await supabase
          .from('sp_transactions')
          .select('amount')
          .eq('user_id', firebaseUser.uid)
          .gt('amount', 0)
          .gte('created_at', weekAgo.toISOString());
        const total = (spData || []).reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
        setWeeklySP(total);
        // ★ Faz 2: Stats dashboard güncelle (SP dahil)
        setRoomStats(prev => ({ ...prev, weeklySP: total }));
      } catch (spErr) {
        if (__DEV__) console.warn('[MyRooms] SP load error:', spErr);
      }


    } catch (err) {
      if (__DEV__) console.warn('[MyRooms] Load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [firebaseUser, allFriends]);

  // ★ Ref'leri güncel tut — realtime handler'ları için
  useEffect(() => { loadDataRef.current = loadData; }, [loadData]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // ★ Yardımcı: Sadece arkadaşların canlı olduğu odaları yenile (hafif sorgu)
  const refreshFriendsLive = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const friendIds = allFriends.map(f => f.id);
      if (friendIds.length === 0) { setFriendsLive([]); return; }
      const { data: participantData } = await supabase
        .from('room_participants')
        .select('user_id, room_id, rooms:rooms!room_id(id, name, is_live), profiles:profiles!user_id(display_name, avatar_url)')
        .in('user_id', friendIds.slice(0, 50));

      const liveItems: FriendInRoom[] = (participantData || [])
        .filter((p: any) => p.rooms?.is_live)
        .map((p: any) => ({
          friendId: p.user_id,
          friendName: p.profiles?.display_name || 'Arkadaş',
          friendAvatar: p.profiles?.avatar_url || '',
          roomId: p.rooms?.id || p.room_id,
          roomName: p.rooms?.name || 'Oda',
        }));
      const seen = new Set<string>();
      const unique = liveItems.filter(item => {
        if (seen.has(item.friendId)) return false;
        seen.add(item.friendId);
        return true;
      });
      setFriendsLive(unique.slice(0, 10));
    } catch (e) {
      if (__DEV__) console.warn('[MyRooms] Friends live refresh error:', e);
    }
  }, [firebaseUser, allFriends]);

  useEffect(() => { refreshFriendsLiveRef.current = refreshFriendsLive; }, [refreshFriendsLive]);

  // ════════════════════════════════════════════════════════════
  // REALTIME MOTOR — 3 kanal
  // ════════════════════════════════════════════════════════════
  // ★ BUG FIX: Realtime kanal — ref pattern ile dependency döngüsü engellendi
  useEffect(() => {
    if (!firebaseUser) return;

    // ── Kanal 1: Yönettiğim Odalar (rooms tablosu) ──
    const roomsChannel = supabase
      .channel('myrooms-realtime')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'rooms',
        filter: `host_id=eq.${firebaseUser.uid}`,
      }, (payload) => {
        if (payload.eventType !== 'UPDATE') { loadDataRef.current?.(); return; }
        const updated = payload.new as any;
        const old = payload.old as any;
        if (updated.is_live !== old?.is_live || updated.name !== old?.name || updated.type !== old?.type) {
          loadDataRef.current?.();
        } else {
          // ★ Kozmetik değişiklik (listener_count, room_settings vb.) → inline güncelle + stats barı
          const mergedFields: Record<string, any> = {
            listener_count: updated.listener_count,
            ...(updated.room_settings ? { room_settings: updated.room_settings } : {}),
            ...(updated.theme_id !== undefined ? { theme_id: updated.theme_id } : {}),
            ...(updated.name ? { name: updated.name } : {}),
            ...(updated.type ? { type: updated.type } : {}),
          };
          setMyRooms(prev => {
            const next = prev.map(r =>
              r.id === updated.id ? { ...r, ...mergedFields } : r
            );
            // Stats barını da güncelle
            const liveCount = next.filter(r => r.is_live).length;
            const totalListeners = next.reduce((sum, r) => sum + ((r as any).listener_count || (r as any).participant_count || 0), 0);
            setRoomStats(prev2 => ({ ...prev2, totalRooms: next.length, liveRooms: liveCount, totalListeners }));
            return next;
          });
          // ★ SYNC FIX: Açık olan RoomManageSheet'i de güncelle
          setSelectedRoom(prev =>
            prev && prev.id === updated.id ? { ...prev, ...mergedFields } : prev
          );
        }
      })
      .subscribe();

    // ── Kanal 2: Arkadaşların Canlı (room_participants tablosu) ──
    const friendsChannel = supabase
      .channel('friends-live-rt')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'room_participants',
      }, () => {
        refreshFriendsLiveRef.current?.();
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'room_participants',
      }, () => {
        refreshFriendsLiveRef.current?.();
      })
      .subscribe();

    // ── Kanal 3: SP Kazancı (sp_transactions tablosu) ──
    const spChannel = supabase
      .channel('sp-rt')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'sp_transactions',
        filter: `user_id=eq.${firebaseUser.uid}`,
      }, (payload) => {
        const newAmount = (payload.new as any)?.amount || 0;
        if (newAmount > 0) {
          // ★ İnkremental güncelleme — tam yenileme gerekmez
          setWeeklySP(prev => prev + newAmount);
          setRoomStats(prev => ({ ...prev, weeklySP: prev.weeklySP + newAmount }));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(roomsChannel);
      supabase.removeChannel(friendsChannel);
      supabase.removeChannel(spChannel);
    };
  }, [firebaseUser]); // ★ Sadece firebaseUser — ref pattern sayesinde diğerleri gerekmiyor

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
      // Başarı toast gereksiz — kullanıcı direkt odaya yönlendiriliyor
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
      handleWakeUp(room);
    }
  };

  // ★ PlusMenu için settings state + DB handlers
  const [rmName, setRmName] = useState('');
  const [rmType, setRmType] = useState('open');
  const [rmSpeakingMode, setRmSpeakingMode] = useState('permission_only');
  const [rmSlowMode, setRmSlowMode] = useState(0);
  const [rmAgeRestricted, setRmAgeRestricted] = useState(false);
  const [rmFollowersOnly, setRmFollowersOnly] = useState(false);
  const [rmDonations, setRmDonations] = useState(false);
  const [rmEntryFee, setRmEntryFee] = useState(0);
  const [rmLang, setRmLang] = useState('tr');
  const [rmWelcome, setRmWelcome] = useState('');
  const [rmRules, setRmRules] = useState('');
  const [rmThemeId, setRmThemeId] = useState<string | null>(null);
  const [rmMusicTrack, setRmMusicTrack] = useState<string | null>(null);
  const [rmBgImage, setRmBgImage] = useState<string | null>(null);
  const [rmCoverImage, setRmCoverImage] = useState<string | null>(null);
  const [rmPassword, setRmPassword] = useState('');
  const [rmIsLocked, setRmIsLocked] = useState(false);
  const [rmFollowerCount, setRmFollowerCount] = useState(0);

  // selectedRoom değiştiğinde state'leri yükle
  useEffect(() => {
    if (!selectedRoom) return;
    const rs = (selectedRoom.room_settings || {}) as any;
    setRmName(selectedRoom.name || '');
    setRmType(selectedRoom.type || 'open');
    setRmSpeakingMode(rs.speaking_mode || 'permission_only');
    setRmSlowMode(rs.slow_mode_seconds || 0);
    setRmAgeRestricted(rs.age_restricted || false);
    setRmFollowersOnly(rs.followers_only || false);
    setRmDonations(rs.donations_enabled || false);
    setRmEntryFee(rs.entry_fee_sp || 0);
    setRmLang(rs.room_language || 'tr');
    setRmWelcome(rs.welcome_message || '');
    setRmRules(typeof rs.rules === 'string' ? rs.rules : Array.isArray(rs.rules) ? rs.rules.join('\n') : '');
    setRmThemeId((selectedRoom as any).theme_id || null);
    setRmMusicTrack(rs.music_track || null);
    setRmBgImage(rs.room_image_url || (selectedRoom as any).room_image_url || null);
    setRmCoverImage(rs.cover_image_url || null);
    setRmPassword(rs.password || '');
    setRmIsLocked(rs.is_locked || false);
    // Takipçi sayısı
    RoomFollowService.getFollowerCount(selectedRoom.id).then(c => setRmFollowerCount(c)).catch(() => {});
  }, [selectedRoom?.id]);

  // ★ Realtime broadcast — odadaki kullanıcılara ayar değişikliğini bildir
  const broadcast = useCallback((roomId: string, payload: Record<string, any>) => {
    const ch = supabase.channel(`mod_action:${roomId}`);
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        ch.send({ type: 'broadcast', event: 'settings_changed', payload }).then(() => {
          setTimeout(() => { try { supabase.removeChannel(ch); } catch {} }, 1000);
        });
      }
    });
  }, []);

  // DB güncelleme helpers
  const updateRoomSetting = useCallback(async (field: string, value: any) => {
    if (!selectedRoom || !firebaseUser) return;
    try {
      await RoomService.updateSettings(selectedRoom.id, firebaseUser.uid, { room_settings: { [field]: value } });
      broadcast(selectedRoom.id, { room_settings: { [field]: value } });
    } catch (e: any) { showToast({ title: 'Hata', message: e.message || '', type: 'error' }); }
  }, [selectedRoom, firebaseUser, broadcast]);

  const handleRoomRename = useCallback(async (name: string) => {
    if (!selectedRoom || !firebaseUser || !name.trim()) return;
    setRmName(name.trim());
    try {
      await ModerationService.editRoomName(selectedRoom.id, name.trim());
      broadcast(selectedRoom.id, { name: name.trim() });
    } catch { showToast({ title: 'Hata', type: 'error' }); }
  }, [selectedRoom, firebaseUser, broadcast]);

  const handleRoomTypeChange = useCallback(async (newType: string) => {
    if (!selectedRoom || !firebaseUser) return;
    setRmType(newType);
    try {
      await RoomService.updateSettings(selectedRoom.id, firebaseUser.uid, { type: newType as any });
      broadcast(selectedRoom.id, { type: newType });
    } catch { showToast({ title: 'Hata', type: 'error' }); setRmType(selectedRoom.type || 'open'); }
  }, [selectedRoom, firebaseUser, broadcast]);

  const handleRoomThemeChange = useCallback(async (id: string | null) => {
    if (!selectedRoom || !firebaseUser) return;
    setRmThemeId(id);
    try {
      await RoomService.updateSettings(selectedRoom.id, firebaseUser.uid, { theme_id: id });
      broadcast(selectedRoom.id, { theme_id: id });
    } catch { showToast({ title: 'Hata', type: 'error' }); }
  }, [selectedRoom, firebaseUser, broadcast]);

  const handleRoomDelete = useCallback(async () => {
    if (!selectedRoom || !firebaseUser) return;
    try {
      await RoomService.deleteRoom(selectedRoom.id, firebaseUser.uid);
      showToast({ title: 'Oda silindi', type: 'success' });
      setSelectedRoom(null);
      loadData();
    } catch (e: any) { showToast({ title: 'Hata', message: e.message || '', type: 'error' }); }
  }, [selectedRoom, firebaseUser, loadData]);

  const handleRoomFreeze = useCallback(async () => {
    if (!selectedRoom || !firebaseUser) return;
    try {
      await RoomService.freezeRoom(selectedRoom.id, firebaseUser.uid);
      showToast({ title: 'Oda donduruldu', type: 'success' });
      setSelectedRoom(null);
      loadData();
    } catch (e: any) { showToast({ title: 'Hata', message: e.message || '', type: 'error' }); }
  }, [selectedRoom, firebaseUser, loadData]);

  // settingsConfig objesi — PlusMenu'ye geçirilir
  const settingsConfig = selectedRoom ? {
    speakingMode: rmSpeakingMode,
    onSpeakingModeChange: (m: string) => { setRmSpeakingMode(m); updateRoomSetting('speaking_mode', m); },
    slowModeSeconds: rmSlowMode,
    onSlowModeChange: (s: number) => { setRmSlowMode(s); updateRoomSetting('slow_mode_seconds', s); },
    ageRestricted: rmAgeRestricted,
    onAgeRestrictedChange: (v: boolean) => { setRmAgeRestricted(v); updateRoomSetting('age_restricted', v); },
    followersOnly: rmFollowersOnly,
    onToggleFollowersOnly: (v: boolean) => { setRmFollowersOnly(v); updateRoomSetting('followers_only', v); },
    donationsEnabled: rmDonations,
    onDonationsToggle: (v: boolean) => { setRmDonations(v); updateRoomSetting('donations_enabled', v); },
    roomLanguage: rmLang,
    onLanguageChange: (l: string) => { setRmLang(l); updateRoomSetting('room_language', l); },
    roomName: rmName,
    onRenameRoom: handleRoomRename,
    welcomeMessage: rmWelcome,
    onWelcomeMessageChange: (msg: string) => { setRmWelcome(msg); updateRoomSetting('welcome_message', msg); },
    roomRules: rmRules,
    onRulesChange: (r: string) => { setRmRules(r); updateRoomSetting('rules', r); },
    roomType: rmType,
    onRoomTypeChange: handleRoomTypeChange,
    roomPassword: rmPassword,
    onPasswordChange: (pw: string) => { setRmPassword(pw); updateRoomSetting('password', pw); },
    themeId: rmThemeId,
    onThemeChange: handleRoomThemeChange,
    onFreezeRoom: handleRoomFreeze,
    entryFee: rmEntryFee,
    onEntryFeeChange: (f: number) => { setRmEntryFee(f); updateRoomSetting('entry_fee_sp', f); },
    musicTrack: rmMusicTrack,
    onMusicTrackChange: (t: string | null) => { setRmMusicTrack(t); updateRoomSetting('music_track', t); },
    backgroundImage: rmBgImage,
    onPickBackgroundImage: () => { /* TODO: image picker */ },
    onRemoveBackgroundImage: () => { setRmBgImage(null); updateRoomSetting('room_image_url', null); },
    coverImage: rmCoverImage,
    onPickCoverImage: () => { /* TODO: image picker */ },
    onRemoveCoverImage: () => { setRmCoverImage(null); updateRoomSetting('cover_image_url', null); },
  } : undefined;

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
        {/* 📊 Kompakt İstatistik Barı */}
        {myRooms.length > 0 && <StatsBar stats={roomStats} />}

        {/* Yönettiğim Odalar */}
        {/* Section title — gradient accent çizgisi (home ile tutarlı) */}
        <View style={s.sectionRow}>
          <View style={[s.sectionAccent, { backgroundColor: '#14B8A6' }]} />
          <Ionicons name="headset" size={14} color="#14B8A6" style={{ opacity: 0.7 }} />
          <Text style={s.sectionTitle}>Yönettiğim Odalar</Text>
        </View>
        {myRooms.length > 0 ? (
          myRooms.map((room) => (
            <ManagedRoomCard
              key={room.id}
              room={room}
              onManage={() => handleManage(room)}
              onStart={() => handleWakeUp(room)}
              onSettings={() => setSelectedRoom(room)}
            />
          ))
        ) : (
          <View style={s.emptyCard}>
            <Text style={s.emptyTitle}>Henüz bir odanız yok.{'\n'}İlk odanızı oluşturun!</Text>
            <View style={s.emptyImageWrap}>
              <Image source={require('../../assets/images/mock/empty_room_mic.png')} style={s.emptyImage} resizeMode="contain" />
            </View>
            <Text style={s.emptySub}>Sesli sohbet, müzik, oyun ve daha fazlası...</Text>
          </View>
        )}

        {/* Son Girdiğin Odalar */}
        <View style={s.sectionRow}>
          <View style={[s.sectionAccent, { backgroundColor: '#3B82F6' }]} />
          <Ionicons name="time" size={14} color="#3B82F6" style={{ opacity: 0.7 }} />
          <Text style={s.sectionTitle}>Son Girdiğin Odalar</Text>
        </View>
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
              🔇 Şu an canlı oda yok.{`\n`}Daha önce girdiğin odalar canlı olduğunda burada görünür!
            </Text>
          </View>
        )}

        {/* 👥 Arkadaşların Canlı */}
        <View style={s.sectionRow}>
          <View style={[s.sectionAccent, { backgroundColor: '#22C55E' }]} />
          <Ionicons name="people" size={14} color="#22C55E" style={{ opacity: 0.7 }} />
          <Text style={s.sectionTitle}>Arkadaşların Canlı</Text>
        </View>
        {friendsLive.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            style={{ marginBottom: 4 }}
          >
            {friendsLive.map((item) => (
              <FriendLiveCard
                key={item.friendId}
                item={item}
                onPress={() => router.push(`/room/${item.roomId}`)}
              />
            ))}
          </ScrollView>
        ) : (
          <View style={s.emptyFollowed}>
            <Text style={s.emptyFollowedText}>
              👥 Arkadaşların şu an bir odada değil.{`\n`}Takip ettiğin kişiler odaya girdiğinde burada görünür!
            </Text>
          </View>
        )}

        {/* 💰 SP Kazanç Özeti */}
        <View style={s.sectionRow}>
          <View style={[s.sectionAccent, { backgroundColor: '#A78BFA' }]} />
          <Ionicons name="diamond" size={14} color="#A78BFA" style={{ opacity: 0.7 }} />
          <Text style={s.sectionTitle}>SP Kazanç Özeti</Text>
        </View>
        <SPBanner weeklySP={weeklySP} />
      </ScrollView>

      {/* ★ PlusMenu — Oda Yönetim Paneli (sağdan slide) */}
      <PlusMenu
        visible={!!selectedRoom}
        onClose={() => setSelectedRoom(null)}
        onInviteFriends={() => setShowInviteFriends(true)}
        onShareLink={async () => {
          if (!selectedRoom) return;
          try {
            const { Share } = require('react-native');
            await Share.share({
              message: `🎤 "${selectedRoom.name || 'Oda'}" odasına gel! SopranoChat'te konuşalım:\nhttps://sopranochat.com/room/${selectedRoom.id}`,
              title: selectedRoom.name || 'SopranoChat Odası',
            });
          } catch {}
        }}
        userRole="owner"
        ownerTier={profile?.subscription_tier || 'Free'}
        onDeleteRoom={handleRoomDelete}
        isFollowingRoom={false}
        isRoomLocked={rmIsLocked}
        onRoomLock={isTierAtLeast((profile?.subscription_tier || 'Free') as any, 'Plus') ? () => {
          const newLocked = !rmIsLocked;
          setRmIsLocked(newLocked);
          updateRoomSetting('is_locked', newLocked);
        } : undefined}
        settingsConfig={settingsConfig}
        followerCount={rmFollowerCount}
        micRequestCount={0}
      />

      {/* ★ Arkadaş Davet Modalı — Odalarım sayfası */}
      {firebaseUser && selectedRoom && (
        <InviteFriendsModal
          visible={showInviteFriends}
          userId={firebaseUser.uid}
          onClose={() => setShowInviteFriends(false)}
          onInvite={async (selectedUsers: FollowUser[]) => {
            if (!selectedRoom || !firebaseUser || !profile) {
              setShowInviteFriends(false);
              return;
            }
            const hostName = profile.display_name || 'Birisi';
            let successCount = 0;
            for (const user of selectedUsers) {
              try {
                const result = await RoomAccessService.inviteUser(selectedRoom.id, user.id, firebaseUser.uid);
                if (result.success) successCount++;
                PushService.sendRoomInvite(user.id, hostName, selectedRoom.name || 'Oda', selectedRoom.id).catch(() => {});
              } catch {}
            }
            if (successCount > 0) {
              showToast({ title: '📨 Davet Gönderildi', message: `${successCount} kişiye davet gönderildi`, type: 'success' });
            }
            setShowInviteFriends(false);
          }}
        />
      )}

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
    paddingHorizontal: 14, paddingBottom: 6,
  },
  logo: { height: 32, width: 150 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center',
    overflow: 'visible',
  },
  notifBadge: {
    position: 'absolute', top: -2, right: -2, backgroundColor: '#EF4444', minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: Colors.bg
  },
  notifBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFF' },



  /* CTA — Premium Gradient */
  ctaWrap: {
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 5,
  },
  ctaGradient: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 14, gap: 10,
  },
  ctaIconWrap: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  ctaTitle: {
    fontSize: 14, fontWeight: '800', color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  ctaSub: {
    fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1,
  },

  /* Section Title — gradient accent çizgisi */
  sectionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, marginTop: 14, marginBottom: 8,
  },
  sectionAccent: {
    width: 3, height: 16, borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 14, fontWeight: '700', color: '#F1F5F9', letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },

  /* Empty — Yönettiğim Odalar */
  emptyCard: {
    marginHorizontal: 16, borderRadius: 14,
    backgroundColor: '#414e5f', borderWidth: 1, borderColor: Colors.cardBorder,
    overflow: 'hidden', alignItems: 'center', paddingBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  emptyImageWrap: {
    width: '70%', marginBottom: 10, borderRadius: 80, overflow: 'hidden',
  },
  emptyImage: { width: '100%', height: 140 },
  emptyTitle: {
    fontSize: 13, fontWeight: '800', color: '#F1F5F9', textAlign: 'center', lineHeight: 20, marginTop: 16, marginBottom: 10,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  emptySub: {
    fontSize: 11, color: '#94A3B8', textAlign: 'center', lineHeight: 16,
    textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },

  /* Empty — Takip Ettiğim Odalar */
  emptyFollowed: {
    marginHorizontal: 16, padding: 14, borderRadius: 14,
    backgroundColor: '#414e5f', borderWidth: 1, borderColor: Colors.cardBorder,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  emptyFollowedText: {
    fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
});
