/**
 * SopranoChat — Liderlik Tablosu (Leaderboard)
 * ★ Premium glassmorphic dark UI
 *
 * Bölümler:
 * 1. En Çok Hediye Alan — altın/gümüş/bronz podium + liste
 * 2. En Cömert — en çok hediye gönderenler
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../constants/supabase';
import { getAvatarSource, getLevelFromSP, getTierBadgeInfo } from '../constants/avatars';
import { Colors } from '../constants/theme';
import AppBackground from '../components/AppBackground';

const { width: W } = Dimensions.get('window');
const SCREEN_BG = '#2f404f';

// ─── Zaman Filtreleri ────────────────────────────────────
type TimePeriod = 'weekly' | 'monthly' | 'all';

const TIME_LABELS: Record<TimePeriod, string> = {
  weekly: 'Haftalık',
  monthly: 'Aylık',
  all: 'Tüm Zamanlar',
};

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

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true, delay: rank * 150 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 500, delay: rank * 150, useNativeDriver: true }),
    ]).start();
  }, []);

  const isFirst = rank === 1;
  const avatarSize = isFirst ? 72 : 58;

  return (
    <Animated.View style={[{ flex: 1, opacity: opacityAnim, transform: [{ scale: scaleAnim }] }, isFirst && { marginTop: -10 }]}>
      <Pressable
        style={({ pressed }) => [pS.card, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
        onPress={() => router.push(`/user/${entry.user_id}` as any)}
      >
        <LinearGradient
          colors={[medal.bg[0] + '18', medal.bg[1] + '08']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        />

        {/* Rank Badge */}
        <View style={[pS.rankBadge, { backgroundColor: medal.bg[0] }]}>
          <Text style={pS.rankText}>{rank}</Text>
        </View>

        {/* Avatar */}
        <View style={[pS.avatarWrap, { width: avatarSize + 6, height: avatarSize + 6 }]}>
          <LinearGradient
            colors={medal.bg}
            style={[pS.avatarRing, { width: avatarSize + 6, height: avatarSize + 6, borderRadius: (avatarSize + 6) / 2 }]}
          >
            <Image
              source={getAvatarSource(entry.avatar_url)}
              style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, borderWidth: 2.5, borderColor: Colors.bg }}
            />
          </LinearGradient>
          {isFirst && (
            <View style={pS.crownWrap}>
              <Ionicons name="trophy" size={18} color="#FFD700" />
            </View>
          )}
        </View>

        {/* User Info */}
        <Text style={[pS.name, { color: medal.text }]} numberOfLines={1}>{entry.display_name}</Text>

        {/* Count */}
        <View style={[pS.countPill, { borderColor: medal.bg[0] + '30' }]}>
          <Text style={[pS.countText, { color: medal.text }]}>{entry.count}</Text>
          <Text style={[pS.countLabel]}>{label}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const pS = StyleSheet.create({
  card: {
    alignItems: 'center', paddingVertical: 16, paddingHorizontal: 4,
    borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  rankBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 22, height: 22, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
  },
  rankText: { fontSize: 11, fontWeight: '900', color: '#FFF' },
  avatarWrap: { position: 'relative', marginBottom: 8 },
  avatarRing: { justifyContent: 'center', alignItems: 'center' },
  crownWrap: {
    position: 'absolute', top: -12, alignSelf: 'center',
    backgroundColor: 'rgba(13,20,33,0.8)', borderRadius: 12,
    padding: 2,
  },
  name: { fontSize: 12, fontWeight: '700', letterSpacing: 0.1, textAlign: 'center' },
  countPill: {
    marginTop: 6, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, alignItems: 'center',
  },
  countText: { fontSize: 16, fontWeight: '900' },
  countLabel: { fontSize: 8, color: '#64748B', fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
});

// ═══════════════════════════════════════════════════════════
// LIST ITEM — 4-10 sıra
// ═══════════════════════════════════════════════════════════
function LeaderListItem({ entry, rank, label }: { entry: LeaderEntry; rank: number; label: string }) {
  const router = useRouter();
  const enterAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enterAnim, { toValue: 1, duration: 400, delay: rank * 60, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={{ opacity: enterAnim, transform: [{ translateX: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }}>
      <Pressable
        style={({ pressed }) => [liS.row, pressed && { opacity: 0.8 }]}
        onPress={() => router.push(`/user/${entry.user_id}` as any)}
      >
        <Text style={liS.rank}>{rank}</Text>
        <Image source={getAvatarSource(entry.avatar_url)} style={[liS.avatar]} />
        <View style={liS.info}>
          <Text style={[liS.name]} numberOfLines={1}>{entry.display_name}</Text>
          {entry.tier && (
            <Text style={[liS.tier]}>{getTierBadgeInfo(entry.tier).label || entry.tier}</Text>
          )}
        </View>
        <View style={liS.countWrap}>
          <Text style={liS.count}>{entry.count}</Text>
          <Text style={liS.countLabel}>{label}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const liS = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  rank: { fontSize: 14, fontWeight: '800', color: '#64748B', width: 24, textAlign: 'center' },
  avatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)' },
  info: { flex: 1 },
  name: { fontSize: 13, fontWeight: '700', color: '#E2E8F0' },
  tier: { fontSize: 10, color: '#94A3B8', marginTop: 1 },
  countWrap: { alignItems: 'flex-end' },
  count: { fontSize: 15, fontWeight: '800', color: '#D4AF37' },
  countLabel: { fontSize: 8, color: '#64748B', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
});

// ═══════════════════════════════════════════════════════════
// ROOM LIST ITEM — Popüler Odalar
// ═══════════════════════════════════════════════════════════
function RoomListItem({ entry, rank }: { entry: RoomEntry; rank: number }) {
  const router = useRouter();
  return (
    <Pressable
      style={({ pressed }) => [rS.row, pressed && { opacity: 0.8 }]}
      onPress={() => router.push(`/room/${entry.room_id}` as any)}
    >
      <Text style={rS.rank}>{rank}</Text>
      <Image source={getAvatarSource(entry.host_avatar)} style={[rS.avatar]} />
      <View style={rS.info}>
        <Text style={[rS.name]} numberOfLines={1}>{entry.room_name}</Text>
        <Text style={[rS.host]}>{entry.host_name}</Text>
      </View>
      <View style={rS.countWrap}>
        <Text style={rS.count}>{entry.count}</Text>
        <Text style={rS.countLabel}>katılımcı</Text>
      </View>
    </Pressable>
  );
}

const rS = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  rank: { fontSize: 14, fontWeight: '800', color: '#64748B', width: 24, textAlign: 'center' },
  avatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)' },
  info: { flex: 1 },
  name: { fontSize: 13, fontWeight: '700', color: '#E2E8F0' },
  host: { fontSize: 10, color: '#94A3B8', marginTop: 1 },
  countWrap: { alignItems: 'flex-end' },
  count: { fontSize: 15, fontWeight: '800', color: '#5CC6C6' },
  countLabel: { fontSize: 8, color: '#64748B', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
});

// ═══════════════════════════════════════════════════════════
// SECTION HEADER
// ═══════════════════════════════════════════════════════════
function SectionHeader({ icon, iconColor, title }: { icon: string; iconColor: string; title: string }) {
  return (
    <View style={shS.wrap}>
      <View style={[shS.iconWrap, { backgroundColor: iconColor + '15' }]}>
        <Ionicons name={icon as any} size={16} color={iconColor} />
      </View>
      <Text style={[shS.title]}>{title}</Text>
    </View>
  );
}

const shS = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 22, paddingBottom: 10 },
  iconWrap: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '800', color: '#F1F5F9', letterSpacing: 0.2 },
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

      // ★ 1. En Çok Hediye Alan — receiver_id gruplaması
      let receiverQuery = supabase
        .from('room_live_gifts')
        .select('receiver_id, receiver:profiles!receiver_id(display_name, avatar_url, subscription_tier)');
      if (cutoff) receiverQuery = receiverQuery.gte('created_at', cutoff);
      const { data: giftData } = await receiverQuery;

      if (giftData) {
        const receiverMap: Record<string, LeaderEntry> = {};
        giftData.forEach((g: any) => {
          const uid = g.receiver_id;
          const profile = Array.isArray(g.receiver) ? g.receiver[0] : g.receiver;
          if (!receiverMap[uid]) {
            receiverMap[uid] = {
              user_id: uid,
              display_name: profile?.display_name || 'Kullanıcı',
              avatar_url: profile?.avatar_url || '',
              tier: profile?.subscription_tier || 'Free',
              count: 0,
            };
          }
          receiverMap[uid].count++;
        });
        const sorted = Object.values(receiverMap).sort((a, b) => b.count - a.count).slice(0, 10);
        setTopReceivers(sorted);
      } else {
        setTopReceivers([]);
      }

      // ★ 2. En Cömert — sender_id gruplaması
      let senderQuery = supabase
        .from('room_live_gifts')
        .select('sender_id, sender:profiles!sender_id(display_name, avatar_url, subscription_tier)');
      if (cutoff) senderQuery = senderQuery.gte('created_at', cutoff);
      const { data: senderData } = await senderQuery;

      if (senderData) {
        const senderMap: Record<string, LeaderEntry> = {};
        senderData.forEach((g: any) => {
          const uid = g.sender_id;
          const profile = Array.isArray(g.sender) ? g.sender[0] : g.sender;
          if (!senderMap[uid]) {
            senderMap[uid] = {
              user_id: uid,
              display_name: profile?.display_name || 'Kullanıcı',
              avatar_url: profile?.avatar_url || '',
              tier: profile?.subscription_tier || 'Free',
              count: 0,
            };
          }
          senderMap[uid].count++;
        });
        const sorted = Object.values(senderMap).sort((a, b) => b.count - a.count).slice(0, 10);
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

      // ★ 4. En Aktif — en çok oda açanlar (host_id)
      let creatorQuery = supabase
        .from('rooms')
        .select('host_id, host:profiles!host_id(display_name, avatar_url, subscription_tier)');
      if (cutoff) creatorQuery = creatorQuery.gte('created_at', cutoff);
      const { data: roomsCreated } = await creatorQuery;

      if (roomsCreated) {
        const creatorMap: Record<string, LeaderEntry> = {};
        roomsCreated.forEach((r: any) => {
          const uid = r.host_id;
          const profile = Array.isArray(r.host) ? r.host[0] : r.host;
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

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // ─── RENDER ────────────────────────────────────────────
  return (
    <AppBackground><View style={s.container}>{/* ─── Header ─── */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={[s.backBtn]} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#F1F5F9" />
        </Pressable>
        <Text style={[s.headerTitle]}>Liderlik Tablosu</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* ─── Period Tabs ─── */}
      <View style={s.periodBar}>
        {(['weekly', 'monthly', 'all'] as TimePeriod[]).map((p) => (
          <Pressable
            key={p}
            style={[s.periodTab, period === p && s.periodTabActive, period === p && Colors.isLight && { backgroundColor: 'rgba(212,175,55,0.15)', borderColor: 'rgba(212,175,55,0.3)' }]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[s.periodText, period === p && s.periodTextActive, period === p && Colors.isLight && { color: '#B8860B' }]}>
              {TIME_LABELS[p]}
            </Text>
          </Pressable>
        ))}
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
          <SectionHeader icon="gift" iconColor="#D4AF37" title="En Çok Hediye Alan" />

          {topReceivers.length >= 3 ? (
            <>
              {/* Podium — 2, 1, 3 sıralamayla */}
              <View style={s.podiumRow}>
                <PodiumCard entry={topReceivers[1]} rank={2} label="hediye" />
                <PodiumCard entry={topReceivers[0]} rank={1} label="hediye" />
                <PodiumCard entry={topReceivers[2]} rank={3} label="hediye" />
              </View>

              {/* 4-10 arası liste */}
              <View style={[s.listCard]}>
                {topReceivers.slice(3).map((entry, idx) => (
                  <LeaderListItem key={entry.user_id} entry={entry} rank={idx + 4} label="hediye" />
                ))}
              </View>
            </>
          ) : topReceivers.length > 0 ? (
            <View style={[s.listCard]}>
              {topReceivers.map((entry, idx) => (
                <LeaderListItem key={entry.user_id} entry={entry} rank={idx + 1} label="hediye" />
              ))}
            </View>
          ) : (
            <View style={[s.emptySection]}>
              <Ionicons name="gift-outline" size={28} color="rgba(255,255,255,0.15)" />
              <Text style={s.emptyText}>Henüz hediye verisi yok</Text>
            </View>
          )}

          {/* ════ BÖLÜM 2: EN CÖMERT ════ */}
          <SectionHeader icon="heart" iconColor="#EF4444" title="En Cömert" />

          {topSenders.length > 0 ? (
            <View style={[s.listCard]}>
              {topSenders.map((entry, idx) => (
                <LeaderListItem key={entry.user_id} entry={entry} rank={idx + 1} label="gönderim" />
              ))}
            </View>
          ) : (
            <View style={[s.emptySection]}>
              <Ionicons name="heart-outline" size={28} color="rgba(255,255,255,0.15)" />
              <Text style={s.emptyText}>Henüz gönderim verisi yok</Text>
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
    paddingHorizontal: 16, paddingBottom: 10,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#F1F5F9', letterSpacing: 0.2 },

  // Period Tabs
  periodBar: {
    flexDirection: 'row', gap: 6,
    paddingHorizontal: 16, paddingBottom: 12,
  },
  periodTab: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  periodTabActive: {
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderColor: 'rgba(212,175,55,0.3)',
  },
  periodText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  periodTextActive: { color: '#D4AF37', fontWeight: '700' },

  // Podium
  podiumRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, alignItems: 'flex-end',
  },

  // List Card
  listCard: {
    marginHorizontal: 16, marginTop: 8,
    borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },

  // Empty
  emptySection: {
    alignItems: 'center', paddingVertical: 28, gap: 8,
    marginHorizontal: 16,
    borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
  },
  emptyText: { fontSize: 12, color: '#475569', fontWeight: '500' },

  // Loading
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
});
