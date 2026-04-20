import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Dimensions, ScrollView, PanResponder, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: W, height: H } = Dimensions.get('window');

type StatItem = {
  icon: string;
  label: string;
  value: string | number;
  color: string;
  desc?: string;
};

type TopUser = {
  nick: string;
  score: number;
  avatar?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  // Canlı veriler
  currentListeners: number;
  totalUniqueListeners: number;
  peakCCU: number;
  avgStayMinutes: number;
  totalReactions: number;
  topUsers: TopUser[];
  /** Oda açılış süresi (dakika) */
  roomDurationMinutes: number;
  /** Kayıt aktif mi */
  isRecording?: boolean;
  /** ★ Takipçi sistemi */
  followerCount?: number;
  followers?: { id: string; display_name: string; avatar_url: string }[];
};

export default function RoomStatsPanel({
  visible, onClose,
  currentListeners, totalUniqueListeners, peakCCU,
  avgStayMinutes, totalReactions, topUsers,
  roomDurationMinutes, isRecording,
  followerCount = 0, followers = [],
}: Props) {
  const slideAnim = useRef(new Animated.Value(H)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 200 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: H, useNativeDriver: true, damping: 22, stiffness: 280 }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  // ★ Swipe-to-dismiss
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
    onPanResponderMove: (_, g) => { if (g.dy > 0) slideAnim.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 80 || g.vy > 0.5) { onClose(); }
      else { Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 12 }).start(); }
    },
  });

  const stats: StatItem[] = [
    { icon: 'people', label: 'Mevcut', value: currentListeners, color: '#14B8A6', desc: 'Anlık katılımcı' },
    { icon: 'person-add', label: 'Toplam', value: totalUniqueListeners, color: '#3B82F6', desc: 'Benzersiz katılımcı' },
    { icon: 'trending-up', label: 'Zirve CCU', value: peakCCU, color: '#D4AF37', desc: 'En yüksek eşzamanlı' },
    { icon: 'time', label: 'Ort. Kalma', value: `${avgStayMinutes}dk`, color: '#8B5CF6', desc: 'Ortalama süre' },
    { icon: 'heart', label: 'Reaksiyonlar', value: totalReactions, color: '#EF4444', desc: 'Toplam emoji' },
    { icon: 'timer', label: 'Süre', value: `${roomDurationMinutes}dk`, color: '#F59E0B', desc: 'Oda açık süresi' },
    { icon: 'people-circle', label: 'Takipçi', value: followerCount, color: '#EC4899', desc: 'Oda takipçisi' },
  ];

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9997, elevation: 50 }]} pointerEvents="box-none">
      <Animated.View style={[st.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[st.panel, { transform: [{ translateY: slideAnim }] }]} {...panResponder.panHandlers}>
        <LinearGradient colors={['#4a5668', '#37414f', '#232a35']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFillObject, { borderTopLeftRadius: 20, borderTopRightRadius: 20 }]} />
        {/* Handle */}
        <View style={st.handle} />

        {/* Header */}
        <View style={st.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={st.headerIcon}>
              <Ionicons name="stats-chart" size={16} color="#3B82F6" />
            </View>
            <Text style={st.headerTitle}>Oda İstatistikleri</Text>
            {isRecording && (
              <View style={st.recBadge}>
                <View style={st.recDot} />
                <Text style={st.recText}>REC</Text>
              </View>
            )}
          </View>
        </View>

        <ScrollView bounces={false} showsVerticalScrollIndicator={false} style={{ maxHeight: H * 0.55 }}>
          {/* Stats Grid */}
          <View style={st.grid}>
            {stats.map((s) => (
              <View key={s.label} style={st.statCard}>
                <View style={[st.statIcon, { backgroundColor: s.color + '14' }]}>
                  <Ionicons name={s.icon as any} size={13} color={s.color} />
                </View>
                <Text style={st.statValue}>{s.value}</Text>
                <Text style={st.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Top Users */}
          {topUsers.length > 0 && (
            <View style={st.topSection}>
              <Text style={st.sectionTitle}>🏆 En Aktif Kullanıcılar</Text>
              {topUsers.slice(0, 3).map((u, i) => (
                <View key={u.nick} style={st.topRow}>
                  <View style={[st.rankBadge, i === 0 && { backgroundColor: 'rgba(212,175,55,0.15)' }]}>
                    <Text style={[st.rankText, i === 0 && { color: '#D4AF37' }]}>{i + 1}</Text>
                  </View>
                  <Text style={st.topNick} numberOfLines={1}>{u.nick}</Text>
                  <Text style={st.topScore}>{u.score} puan</Text>
                </View>
              ))}
            </View>
          )}

          {/* ★ Takipçi Listesi */}
          {followers.length > 0 && (
            <View style={st.topSection}>
              <Text style={st.sectionTitle}>❤️ Oda Takipçileri ({followerCount})</Text>
              {followers.slice(0, 20).map((f) => (
                <View key={f.id} style={st.followerRow}>
                  {f.avatar_url ? (
                    <Image source={{ uri: f.avatar_url }} style={st.followerAvatar} />
                  ) : (
                    <View style={[st.followerAvatar, { backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="person" size={12} color="#64748B" />
                    </View>
                  )}
                  <Text style={st.followerName} numberOfLines={1}>{f.display_name}</Text>
                </View>
              ))}
              {followerCount > 20 && (
                <Text style={{ fontSize: 9, color: '#64748B', textAlign: 'center', marginTop: 6 }}>+{followerCount - 20} daha...</Text>
              )}
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    elevation: 49,
  },
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 14,
    paddingBottom: 28,
    elevation: 50,
    overflow: 'hidden',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    marginBottom: 10,
  },
  headerIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: 'rgba(59,130,246,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E2E8F0',
    letterSpacing: 0.2,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  recDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  recText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#EF4444',
    letterSpacing: 0.5,
  },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statCard: {
    width: '31%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    padding: 6,
    alignItems: 'center',
    gap: 1,
  },
  statIcon: {
    width: 20,
    height: 20,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 1,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F1F5F9',
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#94A3B8',
  },
  statDesc: {
    fontSize: 7,
    color: '#475569',
    textAlign: 'center' as any,
  },

  // Top Users
  topSection: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E2E8F0',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.02)',
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
  },
  topNick: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  topScore: {
    fontSize: 11,
    fontWeight: '700',
    color: '#14B8A6',
  },

  // ★ Takipçi listesi
  followerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.02)',
  },
  followerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  followerName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#CBD5E1',
  },
});
