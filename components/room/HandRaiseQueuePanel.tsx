/**
 * SopranoChat — El Kaldırma Kuyruk Yönetim Paneli
 * Host/Moderatör için bottom sheet: Bekleyen konuşmacı isteklerini yönetir.
 * 
 * Özellikler:
 * - Sıra numaralı kuyruk listesi
 * - Bekleme süresi göstergesi (zamanlayıcı)
 * - "Sahneye Al" / "Reddet" butonları
 * - Plus kullanıcı öncelik badge'i
 * - "Sıradaki" tek tuşla ilk sıradakini sahneye alır
 * - Boş kuyruk güzel empty state
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, FlatList,
  Image, Animated, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows } from '../../constants/theme';
import { getAvatarSource } from '../../constants/avatars';
import { RoomService, type RoomParticipant } from '../../services/database';

const { width: W } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  /** El kaldıran kullanıcıların user_id'leri */
  pendingUserIds: string[];
  /** Tüm oda katılımcıları (kullanıcı bilgilerine erişmek için) */
  participants: RoomParticipant[];
  /** Bir kullanıcıyı sahneye al */
  onApprove: (userId: string, displayName: string) => void;
  /** Bir kullanıcıyı reddet */
  onReject: (userId: string) => void;
  /** Sahne slot sayısı */
  maxStageSlots: number;
  /** Mevcut sahnedeki kişi sayısı */
  currentStageCount: number;
}

function getWaitTime(idx: number): string {
  // Basit tahmin — gerçek bekleme süresi mic_request broadcast zamanıyla yapılabilir
  // Şimdilik sıra numarasına göre yaklaşık süre
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
          <Ionicons name="mic" size={14} color="#FFF" />
          <Text style={q.approveBtnText}>Al</Text>
        </Pressable>
        <Pressable style={q.rejectBtn} onPress={onReject}>
          <Ionicons name="close" size={14} color="#EF4444" />
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
}: Props) {
  const stageSlotsFull = currentStageCount >= maxStageSlots;

  // Kuyruk listesi — participant bilgisiyle eşleştir
  const queueList = useMemo(() => {
    return pendingUserIds
      .map(uid => participants.find(p => p.user_id === uid))
      .filter(Boolean) as RoomParticipant[];
  }, [pendingUserIds, participants]);

  // "Sıradaki" — kuyruğun en başındakini otomatik sahneye al
  const handleNextInQueue = () => {
    if (queueList.length === 0 || stageSlotsFull) return;
    const first = queueList[0];
    onApprove(first.user_id, first.user?.display_name || 'Kullanıcı');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.panel} onPress={e => e.stopPropagation()}>
          {/* Handle Bar */}
          <View style={s.handleBar} />

          {/* Header */}
          <View style={s.header}>
            <View style={s.headerLeft}>
              <Ionicons name="hand-left" size={20} color={Colors.accentTeal} />
              <Text style={s.headerTitle}>El Kaldıranlar</Text>
              {queueList.length > 0 && (
                <View style={s.countBadge}>
                  <Text style={s.countText}>{queueList.length}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Sahne Durumu */}
          <View style={s.stageInfo}>
            <View style={[s.stageBar, stageSlotsFull && { borderColor: '#EF4444' }]}>
              <Ionicons name="people" size={12} color={stageSlotsFull ? '#EF4444' : Colors.accentTeal} />
              <Text style={[s.stageText, stageSlotsFull && { color: '#EF4444' }]}>
                Sahne: {currentStageCount}/{maxStageSlots}
                {stageSlotsFull ? ' (Dolu)' : ''}
              </Text>
            </View>
            {/* Sıradaki Butonu */}
            {queueList.length > 0 && !stageSlotsFull && (
              <Pressable style={s.nextBtn} onPress={handleNextInQueue}>
                <Ionicons name="arrow-up-circle" size={14} color="#FFF" />
                <Text style={s.nextBtnText}>Sıradaki</Text>
              </Pressable>
            )}
          </View>

          {/* Kuyruk Listesi */}
          {queueList.length > 0 ? (
            <FlatList
              data={queueList}
              keyExtractor={(item) => item.user_id}
              style={{ maxHeight: 330 }}
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
              <Ionicons name="hand-left-outline" size={40} color="rgba(255,255,255,0.08)" />
              <Text style={s.emptyTitle}>Kuyruk Boş</Text>
              <Text style={s.emptySub}>Henüz kimse el kaldırmadı</Text>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  panel: {
    backgroundColor: '#2D3740',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: 40,
    maxHeight: '65%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F1F5F9',
    ...Shadows.text,
  },
  countBadge: {
    backgroundColor: Colors.accentTeal,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  stageBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(115,194,189,0.2)',
    backgroundColor: 'rgba(115,194,189,0.06)',
  },
  stageText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.accentTeal,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Colors.accentTeal,
    ...Shadows.button,
  },
  nextBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 12,
    color: '#475569',
  },
});

const q = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  orderBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(115,194,189,0.3)',
  },
  nameWrap: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F1F5F9',
    ...Shadows.text,
  },
  plusBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,215,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
  },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: Colors.accentTeal,
    ...Shadows.button,
  },
  approveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  rejectBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
