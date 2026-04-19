/**
 * SopranoChat — Liderlik Tablosu (Leaderboard)
 * ★ Premium glassmorphic dark UI
 *
 * Bölümler:
 * 1. En Zengin — en yüksek SP'ye sahip
 * 2. En Popüler — en çok takipçisi olan
 * 3. En Popüler Odalar — en çok katılımcı alan
 * 4. En Aktif — en çok oda açanlar
 *
 * Zaman filtreleri: Haftalık / Aylık / Tüm Zamanlar
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Image, Pressable, ScrollView,
  ActivityIndicator, Animated, Dimensions, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safeGoBack } from '../constants/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../constants/supabase';
import { getAvatarSource, getLevelFromSP, getTierBadgeInfo } from '../constants/avatars';
import StatusAvatar from '../components/StatusAvatar';
import { Colors } from '../constants/theme';
import AppBackground from '../components/AppBackground';

const { width: W } = Dimensions.get('window');


// ─── Zaman Filtreleri ────────────────────────────────────
type TimePeriod = 'weekly' | 'monthly' | 'all';

const TIME_TABS: { key: TimePeriod; label: string }[] = [
  { key: 'all', label: 'Genel' },
  { key: 'weekly', label: 'Haftalık' },
  { key: 'monthly', label: 'Aylık' },
];

function getDateCutoff(period: TimePeriod): string | null {
  if (period === 'all') return null;
  const now = new Date();
  if (period === 'weekly') now.setDate(now.getDate() - 7);
  else now.setMonth(now.getMonth() - 1);
  return now.toISOString();
}

// ─── Tip Tanımları ───────────────────────────────────────
interface LeaderEntry {
  user_id: string;
  display_name: string;
  avatar_url: string;
  tier?: string;
  count: number;
}

interface RoomEntry {
  room_id: string;
  room_name: string;
  host_name: string;
  host_avatar: string;
  count: number;
}

// ─── Podium Renkleri ─────────────────────────────────────
const MEDAL_COLORS = {
  1: { bg: ['#D4AF37', '#B8860B'] as [string, string], border: '#FFD700', text: '#FFD700', crown: 'crown' as const },
  2: { bg: ['#C0C0C0', '#A8A8A8'] as [string, string], border: '#C0C0C0', text: '#E0E0E0', crown: 'medal' as const },
  3: { bg: ['#CD7F32', '#8B5A2B'] as [string, string], border: '#CD7F32', text: '#D2A06B', crown: 'ribbon' as const },
};

// ═══════════════════════════════════════════════════════════
// PODIUM — İlk 3 büyük kartlar
// ═══════════════════════════════════════════════════════════
function PodiumCard({ entry, rank, label }: { entry: LeaderEntry; rank: 1 | 2 | 3; label: string }) {
  const router = useRouter();
  const medal = MEDAL_COLORS[rank];
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true, delay: rank * 150 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 500, delay: rank * 150, useNativeDriver: true }),
    ]).start();
    if (rank === 1) {
      Animated.loop(Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])).start();
    }
  }, []);

  const isFirst = rank === 1;
  const avatarSize = isFirst ? 76 : 60;

  return (
    <Animated.View style={[{ flex: 1, opacity: opacityAnim, transform: [{ scale: scaleAnim }] }, isFirst && { marginTop: -14, zIndex: 2 }]}>
      <Pressable
        style={({ pressed }) => [pS.card, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
          { shadowColor: medal.bg[0], shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 10,
            borderColor: medal.bg[0] + '40' }]}
        onPress={() => router.push(`/user/${entry.user_id}` as any)}
      >
        {/* Katman 1: derin koyu zemin */}
        <LinearGradient
          colors={['#1a2334', '#0D1220', '#050912']}
          start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Katman 2: medal warmth */}
        <LinearGradient
          colors={[medal.bg[0] + '40', medal.bg[1] + '15', 'transparent']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
        {/* Üst medal kenar highlight */}
        <LinearGradient
          colors={['transparent', medal.bg[0] + 'ee', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={pS.shineLine}
        />

        <LinearGradient colors={medal.bg} style={pS.rankBadge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Text style={pS.rankText}>{rank}</Text>
        </LinearGradient>

        <View style={[pS.avatarWrap, { width: avatarSize + 8, height: avatarSize + 8 }]}>
          <LinearGradient
            colors={[medal.bg[0], medal.bg[1], medal.bg[0]]}
            style={[pS.avatarRing, { width: avatarSize + 8, height: avatarSize + 8, borderRadius: (avatarSize + 8) / 2 }]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            <Image
              source={getAvatarSource(entry.avatar_url)}
              style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, borderWidth: 3, borderColor: 'rgba(15,23,42,0.9)' }}
            />
          </LinearGradient>
          {isFirst && (
            <Animated.View style={[pS.crownWrap, { opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }]}>
              <Text style={{ fontSize: 22 }}>👑</Text>
            </Animated.View>
          )}
        </View>

        <Text style={[pS.name, { color: medal.text, textShadowColor: medal.bg[0] + '60', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 }]} numberOfLines={1}>
          {entry.display_name}
        </Text>

        {entry.tier && entry.tier !== 'Free' && (
          <View style={[pS.tierPill, { backgroundColor: medal.bg[0] + '18', borderColor: medal.bg[0] + '30' }]}>
            <Text style={[pS.tierText, { color: medal.text }]}>{getTierBadgeInfo(entry.tier).label}</Text>
          </View>
        )}

        <LinearGradient colors={[medal.bg[0] + '20', medal.bg[1] + '10']} style={pS.countPill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Text style={[pS.countText, { color: medal.text, textShadowColor: medal.bg[0] + '80', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }]}>{entry.count.toLocaleString()}</Text>
          <Text style={pS.countLabel}>{label}</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const pS = StyleSheet.create({
  card: {
    alignItems: 'center', paddingVertical: 18, paddingHorizontal: 6,
    borderRadius: 22,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  shineLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 2 },
  rankBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 26, height: 26, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 6,
  },
  rankText: { fontSize: 12, fontWeight: '900', color: '#FFF', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  avatarWrap: { position: 'relative', marginBottom: 10 },
  avatarRing: { justifyContent: 'center', alignItems: 'center' },
  crownWrap: { position: 'absolute', top: -16, alignSelf: 'center' },
  name: { fontSize: 13, fontWeight: '800', letterSpacing: 0.2, textAlign: 'center', marginHorizontal: 4 },
  tierPill: { marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  tierText: { fontSize: 8, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  countPill: {
    marginTop: 8, paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  countText: { fontSize: 18, fontWeight: '900' },
  countLabel: { fontSize: 8, color: '#94A3B8', fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 1 },
});

// ═══════════════════════════════════════════════════════════
// LIST ITEM — 4-10 sıra
// ═══════════════════════════════════════════════════════════
function LeaderListItem({ entry, rank, label }: { entry: LeaderEntry; rank: number; label: string }) {
  const router = useRouter();
  const enterAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enterAnim, { toValue: 1, duration: 400, delay: (rank - 3) * 80, useNativeDriver: true }).start();
  }, []);

  const rankColor = rank <= 5 ? '#D4AF37' : '#94A3B8';

  return (
    <Animated.View style={{ opacity: enterAnim, transform: [{ translateY: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
      <Pressable
        style={({ pressed }) => [liS.card, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
          { borderColor: rankColor + '30' }]}
        onPress={() => router.push(`/user/${entry.user_id}` as any)}
      >
        {/* 3 katman: deep dark + rank warmth + top edge */}
        <LinearGradient
          colors={['#1a2334', '#0D1220', '#050912']}
          start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <LinearGradient
          colors={[rankColor + '22', rankColor + '08', 'transparent']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
        <LinearGradient
          colors={['transparent', rankColor + 'aa', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1 }}
        />
        <View style={[liS.rankCircle, { borderColor: rankColor + '50' }]}>
          <Text style={[liS.rankText, { color: rankColor }]}>{rank}</Text>
        </View>
        <StatusAvatar uri={entry.avatar_url} size={46} tier={entry.tier} />
        <View style={liS.info}>
          <Text style={liS.name} numberOfLines={1}>{entry.display_name}</Text>
          <Text style={liS.sub}>{label}: {entry.count.toLocaleString()}</Text>
        </View>
        {entry.tier && entry.tier !== 'Free' && (
          <View style={liS.tierBadge}>
            <Ionicons name="shield-checkmark" size={14} color="#D4AF37" />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const liS = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginBottom: 8,
    paddingVertical: 14, paddingHorizontal: 14, paddingLeft: 10,
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
  },
  rankCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center',
  },
  rankText: { fontSize: 14, fontWeight: '900' },
  avatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: '#F1F5F9' },
  sub: { fontSize: 11, color: '#94A3B8', marginTop: 2, fontWeight: '600' },
  tierBadge: { marginLeft: 4 },
});

// ═══════════════════════════════════════════════════════════
// ROOM LIST ITEM — Popüler Odalar
// ═══════════════════════════════════════════════════════════
function RoomListItem({ entry, rank }: { entry: RoomEntry; rank: number }) {
  const router = useRouter();
  const rankColor = rank <= 3 ? '#14B8A6' : '#94A3B8';
  return (
    <Pressable
      style={({ pressed }) => [rlS.card, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        { borderColor: rankColor + '30' }]}
      onPress={() => router.push(`/room/${entry.room_id}` as any)}
    >
      <LinearGradient
        colors={['#1a2334', '#0D1220', '#050912']}
        start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={[rankColor + '22', rankColor + '08', 'transparent']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      />
      <LinearGradient
        colors={['transparent', rankColor + 'aa', 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1 }}
      />
      <View style={[rlS.rankCircle, { borderColor: rankColor + '50' }]}>
        <Text style={[rlS.rankText, { color: rankColor }]}>{rank}</Text>
      </View>
      <StatusAvatar uri={entry.host_avatar} size={46} />
      <View style={rlS.info}>
        <Text style={rlS.name} numberOfLines={1}>{entry.room_name}</Text>
        <Text style={rlS.sub}>{entry.host_name} · {entry.count} katılımcı</Text>
      </View>
    </Pressable>
  );
}

const rlS = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginBottom: 8,
    paddingVertical: 14, paddingHorizontal: 14, paddingLeft: 10,
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
  },
  rankCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center',
  },
  rankText: { fontSize: 14, fontWeight: '900' },
  avatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: '#F1F5F9' },
  sub: { fontSize: 11, color: '#94A3B8', marginTop: 2, fontWeight: '600' },
});

// ═══════════════════════════════════════════════════════════
// SECTION HEADER
// ═══════════════════════════════════════════════════════════
function SectionHeader({ icon, iconColor, title }: { icon: string; iconColor: string; title: string }) {
  return (
    <View style={shS.wrap}>
      <View style={[shS.accent, { backgroundColor: iconColor }]} />
      <Ionicons name={icon as any} size={16} color={iconColor} style={{
        textShadowColor: iconColor + 'dd',
        textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 9,
      }} />
      <Text style={shS.title}>{title}</Text>
    </View>
  );
}

const shS = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 22, paddingBottom: 12 },
  accent: { width: 3, height: 16, borderRadius: 2 },
  title: {
    fontSize: 15, fontWeight: '900', color: '#F1F5F9', letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
});

// ═══════════════════════════════════════════════════════════
// LEADERBOARD SCREEN
// ═══════════════════════════════════════════════════════════
export default function LeaderboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [period, setPeriod] = useState<TimePeriod>('weekly');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data state
  const [topReceivers, setTopReceivers] = useState<LeaderEntry[]>([]);
  const [topSenders, setTopSenders] = useState<LeaderEntry[]>([]);
  const [topRooms, setTopRooms] = useState<RoomEntry[]>([]);
  const [topCreators, setTopCreators] = useState<LeaderEntry[]>([]);

  const loadData = useCallback(async () => {
    try {
      const cutoff = getDateCutoff(period);

      // ★ 1. En Zengin — SP sıralaması (O8: GodMaster/admin hesaplar leaderboard'da görünmemeli)
      const { data: spData } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, subscription_tier, system_points, is_admin')
        .gt('system_points', 0)
        .neq('is_admin', true)
        .order('system_points', { ascending: false })
        .limit(10);

      if (spData) {
        setTopReceivers(spData.map((p: any) => ({
          user_id: p.id,
          display_name: p.display_name || 'Kullanıcı',
          avatar_url: p.avatar_url || '',
          tier: p.subscription_tier || 'Free',
          count: p.system_points || 0,
        })));
      } else {
        setTopReceivers([]);
      }

      // ★ 2. En Popüler — En çok takipçisi olan (O8: admin'leri hariç tut)
      const { data: friendData } = await supabase
        .from('friendships')
        .select('friend_id, friend:profiles!friendships_friend_id_fkey(display_name, avatar_url, subscription_tier, is_admin)')
        .eq('status', 'accepted');

      if (friendData) {
        const followerMap: Record<string, LeaderEntry> = {};
        friendData.forEach((f: any) => {
          const uid = f.friend_id;
          const profile = Array.isArray(f.friend) ? f.friend[0] : f.friend;
          if (profile?.is_admin) return; // GodMaster filtre
          if (!followerMap[uid]) {
            followerMap[uid] = {
              user_id: uid,
              display_name: profile?.display_name || 'Kullanıcı',
              avatar_url: profile?.avatar_url || '',
              tier: profile?.subscription_tier || 'Free',
              count: 0,
            };
          }
          followerMap[uid].count++;
        });
        const sorted = Object.values(followerMap).sort((a, b) => b.count - a.count).slice(0, 10);
        setTopSenders(sorted);
      } else {
        setTopSenders([]);
      }

      // ★ 3. En Popüler Odalar — room_participants sayısı
      let roomQuery = supabase
        .from('room_participants')
        .select('room_id, room:rooms!inner(id, name, host_id, host:profiles!rooms_host_id_fkey(display_name, avatar_url))');
      if (cutoff) roomQuery = roomQuery.gte('joined_at', cutoff);
      const { data: rpData } = await roomQuery;

      if (rpData) {
        const roomMap: Record<string, RoomEntry> = {};
        rpData.forEach((rp: any) => {
          const rid = rp.room_id;
          const room = rp.room;
          const host = Array.isArray(room?.host) ? room.host[0] : room?.host;
          if (!roomMap[rid]) {
            roomMap[rid] = {
              room_id: rid,
              room_name: room?.name || 'İsimsiz Oda',
              host_name: host?.display_name || 'Bilinmeyen',
              host_avatar: host?.avatar_url || '',
              count: 0,
            };
          }
          roomMap[rid].count++;
        });
        const sorted = Object.values(roomMap).sort((a, b) => b.count - a.count).slice(0, 10);
        setTopRooms(sorted);
      } else {
        setTopRooms([]);
      }

      // ★ 4. En Aktif — en çok oda açanlar (O8: admin host hariç)
      let creatorQuery = supabase
        .from('rooms')
        .select('host_id, host:profiles!host_id(display_name, avatar_url, subscription_tier, is_admin)');
      if (cutoff) creatorQuery = creatorQuery.gte('created_at', cutoff);
      const { data: roomsCreated } = await creatorQuery;

      if (roomsCreated) {
        const creatorMap: Record<string, LeaderEntry> = {};
        roomsCreated.forEach((r: any) => {
          const uid = r.host_id;
          const profile = Array.isArray(r.host) ? r.host[0] : r.host;
          if (profile?.is_admin) return;
          if (!creatorMap[uid]) {
            creatorMap[uid] = {
              user_id: uid,
              display_name: profile?.display_name || 'Kullanıcı',
              avatar_url: profile?.avatar_url || '',
              tier: profile?.subscription_tier || 'Free',
              count: 0,
            };
          }
          creatorMap[uid].count++;
        });
        const sorted = Object.values(creatorMap).sort((a, b) => b.count - a.count).slice(0, 10);
        setTopCreators(sorted);
      } else {
        setTopCreators([]);
      }
    } catch (err) {
      if (__DEV__) console.warn('[Leaderboard] Veri yükleme hatası:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  // ★ O8 FIX: sp_transactions'ta yeni hareket olunca leaderboard'u tazele.
  // Debounce 3sn — aşırı refresh önleme.
  useEffect(() => {
    let t: any;
    const schedule = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => loadData(), 3000);
    };
    const channelName = `leaderboard_rt_${Date.now()}`;
    const ch = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sp_transactions' }, schedule)
      .subscribe();
    return () => { if (t) clearTimeout(t); supabase.removeChannel(ch); };
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // ─── RENDER ────────────────────────────────────────────
  return (
    <AppBackground><View style={s.container}>{/* ─── Header ─── */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={[s.backBtn]} onPress={() => safeGoBack(router)}>
          <Ionicons name="chevron-back" size={22} color="#F1F5F9" />
        </Pressable>
        <Text style={[s.headerTitle]}>Liderlik Tablosu</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* ─── Segmented Control ─── */}
      <View style={s.segmentBar}>
        {TIME_TABS.map((t) => {
          const isActive = period === t.key;
          return (
            <Pressable
              key={t.key}
              style={[s.segment, isActive && s.segmentActive]}
              onPress={() => setPeriod(t.key)}
            >
              <Text style={[s.segmentText, isActive && s.segmentTextActive]}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ─── Content ─── */}
      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color="#D4AF37" />
          <Text style={s.loadingText}>Sıralama yükleniyor...</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#D4AF37"
              colors={['#D4AF37']}
              progressBackgroundColor="#1E293B"
            />
          }
        >
          {/* ════ BÖLÜM 1: EN ÇOK HEDİYE ALAN ════ */}
          <SectionHeader icon="diamond" iconColor="#D4AF37" title="En Zengin" />

          {topReceivers.length >= 3 ? (
            <>
              {/* Podium — 2, 1, 3 sıralamayla */}
              <View style={s.podiumRow}>
                <PodiumCard entry={topReceivers[1]} rank={2} label="SP" />
                <PodiumCard entry={topReceivers[0]} rank={1} label="SP" />
                <PodiumCard entry={topReceivers[2]} rank={3} label="SP" />
              </View>

              {/* 4-10 arası liste */}
              <View style={[s.listCard]}>
                {topReceivers.slice(3).map((entry, idx) => (
                  <LeaderListItem key={entry.user_id} entry={entry} rank={idx + 4} label="SP" />
                ))}
              </View>
            </>
          ) : topReceivers.length > 0 ? (
            <View style={[s.listCard]}>
              {topReceivers.map((entry, idx) => (
                <LeaderListItem key={entry.user_id} entry={entry} rank={idx + 1} label="SP" />
              ))}
            </View>
          ) : (
            <View style={[s.emptySection]}>
              <Ionicons name="diamond-outline" size={28} color="rgba(255,255,255,0.15)" />
              <Text style={s.emptyText}>Henüz SP verisi yok</Text>
            </View>
          )}

          {/* ════ BÖLÜM 2: EN CÖMERT ════ */}
          <SectionHeader icon="people" iconColor="#A855F7" title="En Popüler" />

          {topSenders.length > 0 ? (
            <View style={[s.listCard]}>
              {topSenders.map((entry, idx) => (
                <LeaderListItem key={entry.user_id} entry={entry} rank={idx + 1} label="takipçi" />
              ))}
            </View>
          ) : (
            <View style={[s.emptySection]}>
              <Ionicons name="people-outline" size={28} color="rgba(255,255,255,0.15)" />
              <Text style={s.emptyText}>Henüz takipçi verisi yok</Text>
            </View>
          )}

          {/* ════ BÖLÜM 3: EN POPÜLER ODALAR ════ */}
          <SectionHeader icon="people" iconColor="#5CC6C6" title="En Popüler Odalar" />

          {topRooms.length > 0 ? (
            <View style={[s.listCard]}>
              {topRooms.map((entry, idx) => (
                <RoomListItem key={entry.room_id} entry={entry} rank={idx + 1} />
              ))}
            </View>
          ) : (
            <View style={[s.emptySection]}>
              <Ionicons name="people-outline" size={28} color="rgba(255,255,255,0.15)" />
              <Text style={s.emptyText}>Henüz oda verisi yok</Text>
            </View>
          )}

          {/* ════ BÖLÜM 4: EN AKTİF ════ */}
          <SectionHeader icon="flame" iconColor="#F59E0B" title="En Aktif" />

          {topCreators.length > 0 ? (
            <View style={[s.listCard]}>
              {topCreators.map((entry, idx) => (
                <LeaderListItem key={entry.user_id} entry={entry} rank={idx + 1} label="oda" />
              ))}
            </View>
          ) : (
            <View style={[s.emptySection]}>
              <Ionicons name="flame-outline" size={28} color="rgba(255,255,255,0.15)" />
              <Text style={s.emptyText}>Henüz aktivite verisi yok</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View></AppBackground>
  );
}

// ═══════════════════════════════════════════════════════════
// STİLLER
// ═══════════════════════════════════════════════════════════
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 14,
    backgroundColor: 'rgba(30,41,59,0.65)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: {
    fontSize: 20, fontWeight: '900', color: '#F1F5F9', letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },

  // Segmented Control
  segmentBar: {
    flexDirection: 'row',
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: 'rgba(15,23,42,0.7)',
    borderRadius: 14, padding: 3,
  },
  segment: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  segmentText: { fontSize: 14, fontWeight: '600', color: '#94A3B8' },
  segmentTextActive: { color: '#FFFFFF', fontWeight: '700' },

  // Podium
  podiumRow: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, alignItems: 'flex-end',
  },

  // List wrapper
  listCard: {
    marginTop: 12,
  },

  // Empty
  emptySection: {
    alignItems: 'center', paddingVertical: 28, gap: 8,
    marginHorizontal: 16,
  },
  emptyText: { fontSize: 13, color: '#475569', fontWeight: '600' },

  // Loading
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  loadingText: { fontSize: 14, color: '#64748B', fontWeight: '600' },
});
