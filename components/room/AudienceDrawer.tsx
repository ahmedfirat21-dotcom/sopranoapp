/**
 * SopranoChat — Kişi Listesi Çekmecesi
 * Sağdan açılan sohbet-drawer tarzı panel — tüm oda kullanıcıları
 * ★ Sağa sürükleyerek kapatma özelliği (DM panel ile aynı useSwipeToDismiss pattern)
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, Image, Animated, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAvatarSource } from '../../constants/avatars';
import { useSwipeToDismiss } from '../../hooks/useSwipeToDismiss';

const { width: W } = Dimensions.get('window');
const PANEL_W = W * 0.58;

interface UserItem {
  id: string;
  user_id: string;
  role: string;
  user?: { display_name?: string; avatar_url?: string };
}

interface Props {
  visible: boolean;
  users: UserItem[];
  onClose: () => void;
  onSelectUser: (u: UserItem) => void;
  micRequests?: string[];
}

export default function AudienceDrawer({ visible, users, onClose, onSelectUser, micRequests = [] }: Props) {
  const slideAnim = useRef(new Animated.Value(PANEL_W)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ★ Sağa sürükleyerek kapatma — DM panel ile aynı pattern
  const { translateValue: swipeX, panHandlers } = useSwipeToDismiss({
    direction: 'right',
    threshold: 60,
    onDismiss: onClose,
  });

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 180 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: PANEL_W, useNativeDriver: true, damping: 18, stiffness: 200 }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  // Rol sıralaması
  const roleOrder: Record<string, number> = { owner: 0, moderator: 1, speaker: 2, listener: 3 };
  const sorted = [...users].sort((a, b) => (roleOrder[a.role] ?? 4) - (roleOrder[b.role] ?? 4));

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner': return { text: 'Sahip', color: '#14B8A6', icon: 'star' as const };
      case 'moderator': return { text: 'Mod', color: '#A78BFA', icon: 'shield-checkmark' as const };
      case 'speaker': return { text: 'Konuşmacı', color: '#3B82F6', icon: 'mic' as const };
      default: return { text: 'Dinleyici', color: 'rgba(255,255,255,0.3)', icon: 'headset' as const };
    }
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[s.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Panel — sağdan kayar + sürüklenebilir */}
      <Animated.View
        {...panHandlers}
        style={[s.panel, {
          transform: [{ translateX: Animated.add(slideAnim, swipeX) }],
        }]}
      >
        {/* ★ Sürükleme tutacağı — sol kenar çizgisi */}
        <View style={s.dragHandle}>
          <View style={s.dragHandleBar} />
        </View>

        {/* Başlık */}
        <View style={s.header}>
          <Ionicons name="people" size={15} color="#14B8A6" />
          <Text style={s.headerTitle}>Odadakiler</Text>
          <View style={s.countPill}>
            <Text style={s.countText}>{users.length}</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={16} color="rgba(255,255,255,0.4)" />
          </Pressable>
        </View>

        {/* Kullanıcı listesi */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 40 }}>
          {sorted.map((u) => {
            const role = getRoleLabel(u.role);
            const hasMicReq = micRequests.includes(u.user_id);
            return (
              <Pressable
                key={u.id}
                style={({ pressed }) => [s.userRow, pressed && s.userRowPressed]}
                onPress={() => { onClose(); setTimeout(() => onSelectUser(u), 200); }}
              >
                <Image
                  source={getAvatarSource(u.user?.avatar_url)}
                  style={[s.avatar, u.role === 'owner' && s.avatarOwner]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={s.userName} numberOfLines={1}>
                    {u.user?.display_name || 'Misafir'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 }}>
                    <Ionicons name={role.icon} size={8} color={role.color} />
                    <Text style={[s.userRole, { color: role.color }]}>{role.text}</Text>
                  </View>
                </View>
                {hasMicReq && (
                  <View style={s.micReqBadge}>
                    <Ionicons name="hand-left" size={9} color="#F59E0B" />
                  </View>
                )}
                <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.1)" />
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  panel: {
    position: 'absolute',
    right: 0, top: 70, bottom: 80,
    width: PANEL_W,
    backgroundColor: 'rgba(45,55,64,0.96)',
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: 'rgba(20,184,166,0.1)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 20,
  },
  dragHandle: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  dragHandleBar: {
    width: 3,
    height: 32,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(20,184,166,0.04)',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F1F5F9',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  countPill: {
    backgroundColor: 'rgba(20,184,166,0.12)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.2)',
  },
  countText: { color: '#14B8A6', fontSize: 10, fontWeight: '700' },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  userRowPressed: {
    backgroundColor: 'rgba(20,184,166,0.08)',
  },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  avatarOwner: {
    borderColor: 'rgba(255,215,0,0.4)',
  },
  userName: {
    fontSize: 12, fontWeight: '600', color: '#F1F5F9',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  userRole: { fontSize: 9, fontWeight: '600' },
  micReqBadge: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 4,
  },
});
