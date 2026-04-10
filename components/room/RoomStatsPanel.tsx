import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Dimensions, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
};

export default function RoomStatsPanel({
  visible, onClose,
  currentListeners, totalUniqueListeners, peakCCU,
  avgStayMinutes, totalReactions, topUsers,
  roomDurationMinutes, isRecording,
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

  const stats: StatItem[] = [
    { icon: 'people', label: 'Mevcut', value: currentListeners, color: '#14B8A6', desc: 'Anlık katılımcı' },
    { icon: 'person-add', label: 'Toplam', value: totalUniqueListeners, color: '#3B82F6', desc: 'Benzersiz katılımcı' },
    { icon: 'trending-up', label: 'Zirve CCU', value: peakCCU, color: '#D4AF37', desc: 'En yüksek eşzamanlı' },
    { icon: 'time', label: 'Ort. Kalma', value: `${avgStayMinutes}dk`, color: '#8B5CF6', desc: 'Ortalama süre' },
    { icon: 'heart', label: 'Reaksiyonlar', value: totalReactions, color: '#EF4444', desc: 'Toplam emoji' },
    { icon: 'timer', label: 'Süre', value: `${roomDurationMinutes}dk`, color: '#F59E0B', desc: 'Oda açık süresi' },
  ];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[st.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[st.panel, { transform: [{ translateY: slideAnim }] }]}>
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
          <Pressable onPress={onClose} hitSlop={8} style={st.closeBtn}>
            <Ionicons name="close" size={16} color="#64748B" />
          </Pressable>
        </View>

        <ScrollView bounces={false} showsVerticalScrollIndicator={false} style={{ maxHeight: H * 0.55 }}>
          {/* Stats Grid */}
          <View style={st.grid}>
            {stats.map((s) => (
              <View key={s.label} style={st.statCard}>
                <View style={[st.statIcon, { backgroundColor: s.color + '14' }]}>
                  <Ionicons name={s.icon as any} size={16} color={s.color} />
                </View>
                <Text style={st.statValue}>{s.value}</Text>
                <Text style={st.statLabel}>{s.label}</Text>
                {s.desc && <Text style={st.statDesc}>{s.desc}</Text>}
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
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1a2a3a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16,
    paddingBottom: 40,
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
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    marginBottom: 14,
  },
  headerIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(59,130,246,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 15,
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
    gap: 10,
  },
  statCard: {
    width: (W - 32 - 20) / 3,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F1F5F9',
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  statDesc: {
    fontSize: 8,
    color: '#475569',
    textAlign: 'center',
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
});
