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
import { i18n } from '../services/i18n';
import {
  View, Text, StyleSheet, Image, Pressable, ScrollView, Animated, Dimensions, RefreshControl, Platform,
} from 'react-native';
import AppLoader from '../components/AppLoader';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safeGoBack } from '../constants/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../constants/supabase';
import { GiftStatsService } from '../services/giftStats';
import { getAvatarSource, getLevelFromSP, getTierBadgeInfo } from '../constants/avatars';
import StatusAvatar from '../components/StatusAvatar';
import { Colors } from '../constants/theme';
import AppBackground from '../components/AppBackground';
import SPIcon from '../components/SPIcon';
import { useUserProfileSheet, useAuth } from './_layout';
import { CosmeticBackground } from '../components/skia';

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
  /** ★ v107: Mağaza avatar çerçevesi */
  active_frame?: string | null;
  count: number;
}

interface RoomEntry {
  room_id: string;
  room_name: string;
  host_name: string;
  host_avatar: string;
  /** ★ v107: Mağaza avatar çerçevesi (host) */
  host_frame?: string | null;
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
  const { openUserProfile } = useUserProfileSheet();
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
        onPress={() => openUserProfile(entry.user_id)}
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
  const { openUserProfile } = useUserProfileSheet();
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
        onPress={() => openUserProfile(entry.user_id)}
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
        <StatusAvatar uri={entry.avatar_url} size={46} tier={entry.tier} frameId={(entry as any).active_frame || null} customBadgeId={(entry as any).active_badge_id ?? null} />
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
      <StatusAvatar uri={entry.host_avatar} size={46} frameId={entry.host_frame || null} customBadgeId={(entry as any).host_active_badge_id ?? null} />
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
  const { profile } = useAuth();

  const [period, setPeriod] = useState<TimePeriod>('weekly');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data state
  const [topReceivers, setTopReceivers] = useState<LeaderEntry[]>([]);
  const [topSenders, setTopSenders] = useState<LeaderEntry[]>([]);
  const [topRooms, setTopRooms] = useState<RoomEntry[]>([]);
  const [topCreators, setTopCreators] = useState<LeaderEntry[]>([]);
  // ★ v107: Cömert (top gifters) — son 30 gün hediye değeri
  const [topGifters, setTopGifters] = useState<LeaderEntry[]>([]);
  // ★ v91 (1 May 2026): Haftalık SP Ligi — RPC'lerden anlık çekilir (cache yok, haftada bir bakılır)
  const [weeklyDonors, setWeeklyDonors] = useState<LeaderEntry[]>([]);
  const [weeklyEarners, setWeeklyEarners] = useState<LeaderEntry[]>([]);
  const [weeklyHosts, setWeeklyHosts] = useState<LeaderEntry[]>([]);

  const loadData = useCallback(async () => {
    try {
      const cutoff = getDateCutoff(period);

      // ★ v91: Haftalık SP Ligi — 3 RPC paralel (cari haftanın top 5'i her kategoride)
      const [donorsRes, earnersRes, hostsRes] = await Promise.all([
        supabase.rpc('weekly_top_donors', { p_limit: 5 }),
        supabase.rpc('weekly_top_earners', { p_limit: 5 }),
        supabase.rpc('weekly_top_hosts', { p_limit: 5 }),
      ]);
      setWeeklyDonors((donorsRes.data || []).map((r: any) => ({
        user_id: r.user_id,
        display_name: r.display_name || 'Kullanıcı',
        avatar_url: r.avatar_url || '',
        tier: r.subscription_tier || 'Free',
        count: Number(r.total_sp) || 0,
      })));
      setWeeklyEarners((earnersRes.data || []).map((r: any) => ({
        user_id: r.user_id,
        display_name: r.display_name || 'Kullanıcı',
        avatar_url: r.avatar_url || '',
        tier: r.subscription_tier || 'Free',
        count: Number(r.total_sp) || 0,
      })));
      setWeeklyHosts((hostsRes.data || []).map((r: any) => ({
        user_id: r.user_id,
        display_name: r.display_name || 'Kullanıcı',
        avatar_url: r.avatar_url || '',
        tier: r.subscription_tier || 'Free',
        count: Number(r.room_count) || 0,
      })));

      // ★ 1. En Zengin — SP sıralaması (O8: GodMaster/admin hesaplar leaderboard'da görünmemeli)
      const { data: spData } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, subscription_tier, system_points, is_admin, active_frame')
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
          active_frame: p.active_frame || null,
          count: p.system_points || 0,
        })));
      } else {
        setTopReceivers([]);
      }

      // ★ 2. En Popüler — En çok takipçisi olan (O8: admin'leri hariç tut)
      const { data: friendData } = await supabase
        .from('friendships')
        .select('friend_id, friend:profiles!friendships_friend_id_fkey(display_name, avatar_url, subscription_tier, is_admin, active_frame)')
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
              active_frame: profile?.active_frame || null,
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
        .select('room_id, room:rooms!inner(id, name, host_id, host:profiles!rooms_host_id_fkey(display_name, avatar_url, active_frame))');
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
              host_frame: host?.active_frame || null,
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
        .select('host_id, host:profiles!host_id(display_name, avatar_url, subscription_tier, is_admin, active_frame)');
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
              active_frame: profile?.active_frame || null,
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

      // ★ v107: 5. CÖMERT — son 30 gün toplam hediye SP değeri
      const gifters = await GiftStatsService.getTopGifters(10);
      setTopGifters(gifters.map((g) => ({
        user_id: g.user_id,
        display_name: g.display_name,
        avatar_url: g.avatar_url,
        tier: g.subscription_tier,
        active_frame: g.active_frame,
        count: g.total_amount,
      })));
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
    // ★ Audit fix: statik kanal adı + purge — Date.now() leak'iydi
    const channelName = 'leaderboard_rt';
    try {
      const { purgeChannelByName } = require('../services/realtime');
      purgeChannelByName(channelName);
    } catch {}
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
    <AppBackground radialGlow><CosmeticBackground bgItemId={(profile as any)?.active_bg_id} context="leaderboard" style={{ flex: 1 }}><View style={s.container}>{/* ─── Header ─── */}
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
          <AppLoader size={56} color="#D4AF37" />
          <Text style={s.loadingText}>{i18n.t('leaderboard.001')}</Text>
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
          {/* ════════════════════════════════════════════════════════
              ★ v91: HAFTALIK SP LİGİ — sadece "Haftalık" tab seçildiğinde
              görünür. Diğer tab'larda (Genel/Aylık) eski sıralamalar gösterilir
              — hero kart çelişkisi (Aylık seçili ama "Haftalık SP Ligi"
              başlığı görünmesi sorunu) bu şekilde kapatıldı.
              ════════════════════════════════════════════════════════ */}
          {period === 'weekly' && (
            <>
              <View style={ws.heroWrap}>
                <LinearGradient
                  colors={['#5a3a10', '#2a1a08', '#080403']}
                  locations={[0, 0.55, 1]}
                  start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <LinearGradient
                  colors={['transparent', 'rgba(255,215,130,0.95)', 'transparent']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={ws.heroTopEdge}
                />
                <LinearGradient
                  colors={['rgba(251,191,36,0.18)', 'transparent']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={ws.heroHeader}>
                  <View style={ws.heroIconWrap}>
                    <Ionicons name="trophy" size={20} color="#FFD700" style={{
                      textShadowColor: 'rgba(255,215,0,0.85)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12,
                    }} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={ws.heroTitle}>{i18n.t('leaderboard.002')}</Text>
                    <Text style={ws.heroSubtitle}>
                      Pazartesi 09:00'da sıfırlanır. Her kategoride <Text style={ws.heroHighlight}>top 3</Text> ödülü:{' '}
                      <Text style={ws.heroHighlight}>100 / 50 / 25 SP</Text>
                    </Text>
                  </View>
                </View>
              </View>

              {/* ── Top Cömert — bağış lideri ── */}
              <SectionHeader icon="gift" iconColor="#22C55E" title="Top Cömert" />
              {weeklyDonors.length > 0 ? (
                <View style={[s.listCard]}>
                  {weeklyDonors.map((entry, idx) => (
                    <LeaderListItem key={`wd_${entry.user_id}`} entry={entry} rank={idx + 1} label="SP bağış" />
                  ))}
                </View>
              ) : (
                <View style={[s.emptySection]}>
                  <Ionicons name="gift-outline" size={28} color="rgba(255,255,255,0.15)" />
                  <Text style={s.emptyText}>{i18n.t('leaderboard.003')}</Text>
                </View>
              )}

              {/* ── Top Kazanan — SP üretim lideri ── */}
              <SectionHeader icon="flash" iconColor="#FBBF24" title="Top Kazanan" />
              {weeklyEarners.length > 0 ? (
                <View style={[s.listCard]}>
                  {weeklyEarners.map((entry, idx) => (
                    <LeaderListItem key={`we_${entry.user_id}`} entry={entry} rank={idx + 1} label="SP kazandı" />
                  ))}
                </View>
              ) : (
                <View style={[s.emptySection]}>
                  <Ionicons name="flash-outline" size={28} color="rgba(255,255,255,0.15)" />
                  <Text style={s.emptyText}>{i18n.t('leaderboard.004')}</Text>
                </View>
              )}

              {/* ── Top Host — en aktif oda sahibi ── */}
              <SectionHeader icon="mic" iconColor="#A78BFA" title="Top Host" />
              {weeklyHosts.length > 0 ? (
                <View style={[s.listCard]}>
                  {weeklyHosts.map((entry, idx) => (
                    <LeaderListItem key={`wh_${entry.user_id}`} entry={entry} rank={idx + 1} label="oda açtı" />
                  ))}
                </View>
              ) : (
                <View style={[s.emptySection]}>
                  <Ionicons name="mic-outline" size={28} color="rgba(255,255,255,0.15)" />
                  <Text style={s.emptyText}>{i18n.t('leaderboard.005')}</Text>
                </View>
              )}
            </>
          )}

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
              <SPIcon size={28} style={{ opacity: 0.4 }} />
              <Text style={s.emptyText}>{i18n.t('leaderboard.006')}</Text>
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
              <Text style={s.emptyText}>{i18n.t('leaderboard.007')}</Text>
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
              <Text style={s.emptyText}>{i18n.t('leaderboard.008')}</Text>
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
              <Text style={s.emptyText}>{i18n.t('leaderboard.009')}</Text>
            </View>
          )}

          {/* ════ v107: BÖLÜM 5: EN CÖMERT (Top Gifters) ════ */}
          <SectionHeader icon="gift" iconColor="#F472B6" title="En Cömert" />

          {topGifters.length >= 3 ? (
            <>
              <View style={s.podiumRow}>
                <PodiumCard entry={topGifters[1]} rank={2} label="SP hediye" />
                <PodiumCard entry={topGifters[0]} rank={1} label="SP hediye" />
                <PodiumCard entry={topGifters[2]} rank={3} label="SP hediye" />
              </View>
              <View style={[s.listCard]}>
                {topGifters.slice(3).map((entry, idx) => (
                  <LeaderListItem key={entry.user_id} entry={entry} rank={idx + 4} label="SP hediye" />
                ))}
              </View>
            </>
          ) : topGifters.length > 0 ? (
            <View style={[s.listCard]}>
              {topGifters.map((entry, idx) => (
                <LeaderListItem key={entry.user_id} entry={entry} rank={idx + 1} label="SP hediye" />
              ))}
            </View>
          ) : (
            <View style={[s.emptySection]}>
              <Ionicons name="gift-outline" size={28} color="rgba(255,255,255,0.15)" />
              <Text style={s.emptyText}>{i18n.t('leaderboard.010')}</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View></CosmeticBackground></AppBackground>
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

// ★ v91 (1 May 2026): Haftalık SP Ligi hero card stilleri.
// Premium altın gradient + Android shadow uyumlu (border + elevation).
const ws = StyleSheet.create({
  heroWrap: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 6,
    borderRadius: 18,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: Platform.OS === 'android' ? 2 : 1.2,
    borderColor: Platform.OS === 'android' ? 'rgba(255,224,130,0.85)' : 'rgba(255,224,130,0.55)',
    ...Platform.select({
      ios: {
        shadowColor: '#FBBF24',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  heroTopEdge: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1.6,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(251,191,36,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,224,130,0.55)',
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFE082',
    letterSpacing: 0.4,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    marginBottom: 3,
  },
  heroSubtitle: {
    fontSize: 11.5,
    color: 'rgba(255, 240, 200, 0.75)',
    lineHeight: 16,
    fontWeight: '600',
  },
  heroHighlight: {
    color: '#FFD700',
    fontWeight: '900',
  },
});
