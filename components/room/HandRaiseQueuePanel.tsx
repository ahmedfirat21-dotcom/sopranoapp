/**
 * SopranoChat — El Kaldırma Kuyruk Yönetim Paneli
 * ★ Alt barın üstünde, kompakt bottom sheet.
 * Host/Moderatör için: Bekleyen konuşmacı isteklerini yönetir.
 */
import React, { useRef, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList,
  Image, Animated, Dimensions, PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/theme';
import { getAvatarSource } from '../../constants/avatars';
import { type RoomParticipant } from '../../services/database';

const { width: W } = Dimensions.get('window');
const PANEL_H = 300;

interface Props {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  pendingUserIds: string[];
  participants: RoomParticipant[];
  onApprove: (userId: string, displayName: string) => void;
  onReject: (userId: string) => void;
  maxStageSlots: number;
  currentStageCount: number;
  bottomInset?: number;
}

function getWaitTime(idx: number): string {
  return `~${idx + 1} dk`;
}

function QueueItem({
  participant, index, stageSlotsFull,
  onApprove, onReject,
}: {
  participant: RoomParticipant;
  index: number;
  stageSlotsFull: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const displayName = participant.user?.display_name || 'Kullanıcı';
  const userTier = (participant.user as any)?.subscription_tier || (participant.user as any)?.tier;
  const isPaidTier = userTier && userTier !== 'Free';

  return (
    <View style={q.item}>
      {/* Sıra Numarası */}
      <View style={q.orderBadge}>
        <Text style={q.orderText}>#{index + 1}</Text>
      </View>

      {/* Avatar */}
      <Image source={getAvatarSource(participant.user?.avatar_url)} style={q.avatar} />

      {/* İsim + Badge */}
      <View style={q.nameWrap}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={q.name} numberOfLines={1}>{displayName}</Text>
          {isPaidTier && (
            <View style={q.plusBadge}>
              <Ionicons name="star" size={8} color="#FFD700" />
            </View>
          )}
        </View>
        <Text style={q.waitText}>Bekleme: {getWaitTime(index)}</Text>
      </View>

      {/* Aksiyon Butonları */}
      <View style={q.actions}>
        <Pressable
          style={[q.approveBtn, stageSlotsFull && { opacity: 0.4 }]}
          onPress={onApprove}
          disabled={stageSlotsFull}
        >
          <Ionicons name="mic" size={12} color="#FFF" />
          <Text style={q.approveBtnText}>Al</Text>
        </Pressable>
        <Pressable style={q.rejectBtn} onPress={onReject}>
          <Ionicons name="close" size={12} color="#EF4444" />
        </Pressable>
      </View>
    </View>
  );
}

export default function HandRaiseQueuePanel({
  visible, onClose, roomId,
  pendingUserIds, participants,
  onApprove, onReject,
  maxStageSlots, currentStageCount,
  bottomInset = 14,
}: Props) {
  // ★ 2026-04-23: CLOSED_Y artık panel + paddingBottom'u kapsıyor — panel bottom:0'da
  //   paddingBottom BAR_OFFSET kadar eklendiği için translate off-screen mesafesi de büyümeli.
  const CLOSED_Y = PANEL_H + bottomInset + 76 + 20;
  const translateY = useRef(new Animated.Value(CLOSED_Y)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const stageSlotsFull = currentStageCount >= maxStageSlots;

  const queueList = useMemo(() => {
    return pendingUserIds
      .map(uid => participants.find(p => p.user_id === uid))
      .filter(Boolean) as RoomParticipant[];
  }, [pendingUserIds, participants]);

  // Aşağı sürükleyerek kapatma
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 10 && Math.abs(gs.dx) < 20,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) translateY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 50 || gs.vy > 0.5) {
          Animated.timing(translateY, { toValue: CLOSED_Y, duration: 200, useNativeDriver: true }).start(() => onClose());
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
        }
      },
    })
  ).current;

  // ★ 2026-04-23: Internal mount — kapanış animasyonu bitince unmount (RoomChatDrawer ile aynı pattern)
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: CLOSED_Y, duration: 220, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible]);

  const handleNextInQueue = () => {
    if (queueList.length === 0 || stageSlotsFull) return;
    const first = queueList[0];
    onApprove(first.user_id, first.user?.display_name || 'Kullanıcı');
  };

  if (!mounted) return null;

  // ★ 2026-04-23: RoomChatDrawer ile aynı pattern — panel bottom:0'da, paddingBottom ile
  // content control bar üstünde durur, gradient bar arkasında akar → tek sürekli yüzey.
  const BAR_OFFSET = bottomInset + 76;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 100 }]} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[s.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Panel — bottom:0 continuous surface; control bar üstünde floats, gradient arkasına akar */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[s.panel, { bottom: 0, paddingBottom: BAR_OFFSET, transform: [{ translateY }] }]}
      >
        <LinearGradient colors={['#4a5668', '#37414f', '#232a35']} locations={[0, 0.35, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFillObject, { borderTopLeftRadius: 20, borderTopRightRadius: 20 }]} />
        {/* Sürükleme tutamağı */}
        <View style={s.handle}>
          <View style={s.handleBar} />
        </View>

        {/* Header */}
        <View style={s.header}>
          <View style={s.headerDot} />
          <Text style={s.headerTitle}>El Kaldıranlar</Text>
          {queueList.length > 0 && (
            <View style={s.countBadge}>
              <Text style={s.countText}>{queueList.length}</Text>
            </View>
          )}
        </View>

        {/* Sahne Durumu + Sıradaki */}
        <View style={s.stageInfo}>
          <View style={[s.stageBar, stageSlotsFull && { borderColor: '#EF4444' }]}>
            <Ionicons name="people" size={11} color={stageSlotsFull ? '#EF4444' : '#14B8A6'} />
            <Text style={[s.stageText, stageSlotsFull && { color: '#EF4444' }]}>
              {currentStageCount}/{maxStageSlots}{stageSlotsFull ? ' Dolu' : ''}
            </Text>
          </View>
          {queueList.length > 0 && !stageSlotsFull && (
            <Pressable style={s.nextBtn} onPress={handleNextInQueue}>
              <Ionicons name="arrow-up-circle" size={12} color="#FFF" />
              <Text style={s.nextBtnText}>Sıradaki</Text>
            </Pressable>
          )}
        </View>

        {/* Kuyruk Listesi */}
        {queueList.length > 0 ? (
          <FlatList
            data={queueList}
            keyExtractor={(item) => item.user_id}
            style={{ maxHeight: 160 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => (
              <QueueItem
                participant={item}
                index={index}
                stageSlotsFull={stageSlotsFull}
                onApprove={() => onApprove(item.user_id, item.user?.display_name || 'Kullanıcı')}
                onReject={() => onReject(item.user_id)}
              />
            )}
          />
        ) : (
          <View style={s.emptyState}>
            <Ionicons name="hand-right-outline" size={24} color="rgba(255,255,255,0.06)" />
            <Text style={s.emptyTitle}>Kuyruk Boş</Text>
            <Text style={s.emptySub}>Henüz kimse el kaldırmadı</Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  // ★ Panel — alt barın üstünde, kompakt bottom sheet
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 50,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#95a1ae',
    overflow: 'hidden',
    paddingBottom: 8,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  handle: { alignItems: 'center', paddingVertical: 8 },
  handleBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#FBBF24',
  },
  headerTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#F1F5F9',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  countBadge: {
    backgroundColor: '#FBBF24',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  countText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1E1B12',
  },
  stageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  stageBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.2)',
    backgroundColor: 'rgba(20,184,166,0.06)',
  },
  stageText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#14B8A6',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#14B8A6',
  },
  nextBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 4,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginTop: 6,
  },
  emptySub: {
    fontSize: 10,
    color: '#334155',
  },
});

const q = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  orderBadge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.3)',
  },
  nameWrap: {
    flex: 1,
  },
  name: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  plusBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255,215,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitText: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 4,
  },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#14B8A6',
  },
  approveBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  rejectBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
