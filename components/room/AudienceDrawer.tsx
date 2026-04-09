/**
 * SopranoChat — Kişi Listesi Çekmecesi
 * Sağdan açılan sohbet-drawer tarzı panel — tüm oda kullanıcıları
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, Image, Animated, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAvatarSource } from '../../constants/avatars';

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
      case 'owner': return { text: 'Sahip', color: '#14B8A6' };
      case 'moderator': return { text: 'Mod', color: '#A78BFA' };
      case 'speaker': return { text: 'Konuşmacı', color: '#3B82F6' };
      default: return { text: 'Dinleyici', color: 'rgba(255,255,255,0.3)' };
    }
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[s.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Panel — sağdan kayar */}
      <Animated.View style={[s.panel, { transform: [{ translateX: slideAnim }] }]}>
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
                style={s.userRow}
                onPress={() => { onClose(); setTimeout(() => onSelectUser(u), 200); }}
              >
                <Image
                  source={getAvatarSource(u.user?.avatar_url)}
                  style={s.avatar}
                />
                <View style={{ flex: 1 }}>
                  <Text style={s.userName} numberOfLines={1}>
                    {u.user?.display_name || 'Misafir'}
                  </Text>
                  <Text style={[s.userRole, { color: role.color }]}>{role.text}</Text>
                </View>
                {hasMicReq && (
                  <View style={s.micReqBadge}>
                    <Ionicons name="mic" size={9} color="#F59E0B" />
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
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  panel: {
    position: 'absolute',
    right: 0, top: 70, bottom: 80,
    width: PANEL_W,
    backgroundColor: 'rgba(45,61,77,0.95)',
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
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
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  userName: { fontSize: 12, fontWeight: '600', color: '#F1F5F9', textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  userRole: { fontSize: 9, marginTop: 1 },
  micReqBadge: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(245,158,11,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 4,
  },
});
