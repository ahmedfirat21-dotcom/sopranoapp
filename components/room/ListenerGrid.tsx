import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Dimensions, Animated, Easing } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getAvatarSource } from '../../constants/avatars';
import type { RoomParticipant } from '../../services/database';

const { width: W } = Dimensions.get('window');
const COLS = 5;
const AVATAR_GAP = 10;
const CELL_W = Math.floor((W - 32 - AVATAR_GAP * (COLS - 1)) / COLS);
const AVATAR_SIZE = CELL_W - 10;

interface Props {
  listeners: RoomParticipant[];
  onSelectUser: (user: RoomParticipant) => void;
  selectedUserId?: string | null;
  onShowAllUsers?: () => void;
  /** Tier bazlı max dinleyici grid kapasitesi (Free=10, Bronze=15, Silver/Gold/VIP=20) */
  maxListeners?: number;
  /** Seyirci sayısı — grid'de gösterilmez, sadece sayı badge'i */
  spectatorCount?: number;
  /** Oda sahibi user_id — dinleyiciye indiğinde taç gösterilir */
  roomOwnerId?: string;
}

export default function ListenerGrid({ listeners, onSelectUser, selectedUserId, onShowAllUsers, maxListeners = 20, spectatorCount = 0, roomOwnerId }: Props) {
  if (listeners.length === 0 && spectatorCount === 0) return null;

  // ★ Owner'u en başa taşı
  const sortedListeners = React.useMemo(() => {
    if (!roomOwnerId) return listeners;
    return [...listeners].sort((a, b) => {
      if (a.user_id === roomOwnerId) return -1;
      if (b.user_id === roomOwnerId) return 1;
      return 0;
    });
  }, [listeners, roomOwnerId]);

  // ★ Tier bazlı max grid kapasitesi — sadece listener'lar gösterilir
  const visibleListeners = sortedListeners.slice(0, maxListeners);
  const overflowListeners = listeners.length - maxListeners;
  const overflowCount = Math.max(0, overflowListeners) + spectatorCount;

  return (
    <View style={s.wrap}>
      {/* Başlık — "Dinleyiciler (N)" + 👥 simge */}
      <View style={s.headerRow}>
        <Text style={s.title}>Dinleyiciler ({listeners.length})</Text>
        {onShowAllUsers && (
          <Pressable style={s.allUsersBtn} onPress={onShowAllUsers} hitSlop={10}>
            <Ionicons name="people" size={14} color="#14B8A6" />
            <Text style={s.allUsersText}>Tümü</Text>
          </Pressable>
        )}
      </View>
      <View style={s.grid}>
        {visibleListeners.map((u) => {
          const isSelected = selectedUserId === u.user_id;
          const isOwner = u.user_id === roomOwnerId;
          return (
            <Pressable key={u.id} style={s.cell} onPress={() => onSelectUser(u)}>
              {/* ★ Owner taç — küçük versiyon */}
              {isOwner && <ListenerCrown />}
              <View style={[s.avatarWrap, isSelected && s.avatarSelected, isOwner && s.avatarOwner]}>
                <Image
                  source={getAvatarSource((u as any).disguise?.avatar_url || u.user?.avatar_url)}
                  style={s.avatar}
                />
              </View>
              <Text style={[s.name, isOwner && { color: '#FFD700', fontWeight: '700' }]} numberOfLines={1}>
                {(u as any).disguise?.display_name || u.user?.display_name || 'Misafir'}
              </Text>
            </Pressable>
          );
        })}
        {overflowCount > 0 && (
          <Pressable style={s.cell} onPress={onShowAllUsers}>
            <View style={[s.avatarWrap, { backgroundColor: 'rgba(20,184,166,0.1)', alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: '#14B8A6', fontSize: 14, fontWeight: '700' }}>+{overflowCount}</Text>
            </View>
            <Text style={[s.name, { color: '#14B8A6' }]}>Seyirci</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F1F5F9',
  },
  allUsersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(20,184,166,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.2)',
  },
  allUsersText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#14B8A6',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: AVATAR_GAP,
  },
  cell: {
    width: CELL_W,
    alignItems: 'center',
    marginBottom: 4,
  },
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(20,184,166,0.25)',
    backgroundColor: 'rgba(20,184,166,0.05)',
  },
  avatarSelected: {
    borderColor: '#14B8A6',
    borderWidth: 2.5,
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  name: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
    marginTop: 5,
    textAlign: 'center',
  },
  avatarOwner: {
    borderColor: 'rgba(255,215,0,0.45)',
  },
  crownSmall: {
    position: 'absolute',
    top: -6, left: -2,
    zIndex: 20,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 6,
  },
});

// ★ Küçük taç animasyonu — dinleyici avatarlarında
function ListenerCrown() {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: -1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const rotate = rotateAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-18deg', '-15deg', '-12deg'],
  });

  return (
    <Animated.View style={[s.crownSmall, { transform: [{ rotate }] }]}>
      <MaterialCommunityIcons name="crown" size={18} color="#FFD700" />
    </Animated.View>
  );
}
