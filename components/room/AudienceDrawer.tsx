/**
 * SopranoChat — Kişi Listesi Çekmecesi
 * Sağdan açılan sohbet-drawer tarzı panel — tüm oda kullanıcıları
 * ★ Sağa sürükleyerek kapatma özelliği (DM panel ile aynı useSwipeToDismiss pattern)
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, Animated, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSwipeToDismiss } from '../../hooks/useSwipeToDismiss';
import StatusAvatar from '../StatusAvatar';
import { migrateLegacyTier } from '../../types';

// ★ 2026-05-05: Keşfet drawer dili (NotificationDrawer/FriendsDrawer) — birebir aynı
//   boyut + 3 katman gradient + slate kabuk. Karakter rengi: teal (insan listesi).
const ROOM_TOP_GAP = 70;     // RoomInfoHeader altında bitsin
const ROOM_BOTTOM_GAP = 90;  // RoomControlBar üstünde bitsin

interface UserItem {
  id: string;
  user_id: string;
  role: string;
  user?: { display_name?: string; avatar_url?: string; subscription_tier?: string };
}

interface Props {
  visible: boolean;
  users: UserItem[];
  onClose: () => void;
  onSelectUser: (u: UserItem) => void;
  micRequests?: string[];
}

export default function AudienceDrawer({ visible, users, onClose, onSelectUser, micRequests = [] }: Props) {
  // ★ Runtime window width — cihazın gerçek ekran genişliği
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // ★ NotificationDrawer/FriendsDrawer ile birebir aynı ölçü
  const PANEL_W = Math.min(W * 0.72, 300);
  const slideAnim = useRef(new Animated.Value(W)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ★ 2026-04-23: Internal mount — kapanış animasyonu bitince unmount, aksi halde kesik görünür
  const [mounted, setMounted] = useState(visible);

  // ★ Sağa sürükleyerek kapatma — DM panel ile aynı pattern
  const { translateValue: swipeX, panHandlers } = useSwipeToDismiss({
    direction: 'right',
    threshold: 60,
    onDismiss: onClose,
  });

  useEffect(() => {
    if (visible) {
      setMounted(true);
      swipeX.setValue(0); // ★ double-drag fix: önceki swipe offset'ini sıfırla
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 180 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: PANEL_W, duration: 220, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible]);

  if (!mounted) return null;

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
          width: PANEL_W,
          top: Math.max(insets.top + 12, ROOM_TOP_GAP),
          bottom: Math.max(insets.bottom + 8, ROOM_BOTTOM_GAP),
          transform: [{ translateX: Animated.add(slideAnim, swipeX) }],
        }]}
      >
        {/* Profil sayfası gradient dili — diagonal slate */}
        <LinearGradient
          colors={['#3a4658', '#2a3344', '#1a2030']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        {/* ★ 2026-05-05: 3 katman aile dili — slate + halo + soft glow.
            Karakter teal: Odadakiler. */}
        <LinearGradient
          colors={['rgba(20,184,166,0.20)', 'rgba(20,184,166,0.05)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(20,184,166,0.08)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.6 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        {/* Başlık — NotificationDrawer dili: ikon + başlık + count pill + separator */}
        <View style={s.header}>
          <Ionicons name="people" size={18} color="#14B8A6" style={s.headerIcon} />
          <Text style={s.headerTitle}>Odadakiler</Text>
          {users.length > 0 && (
            <View style={s.countPill}>
              <Text style={s.countText}>{users.length}</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={16} color="rgba(255,255,255,0.4)" />
          </Pressable>
        </View>
        <View style={s.headerSeparator} />

        {/* ★ v92.28 (2 May 2026) PERF: ScrollView + .map() → FlatList virtualization.
            Önceden 100+ listener'da TÜM cell'ler render ediliyordu. FlatList ile
            sadece görünen ~12 cell, scroll'da yenileri ekleniyor. 200 kişi rahat. */}
        <FlatList
          data={sorted}
          keyExtractor={(u) => u.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 40 }}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
          renderItem={({ item: u }) => {
            const role = getRoleLabel(u.role);
            const hasMicReq = micRequests.includes(u.user_id);
            // ★ 2026-05-05: Plus/Pro/GM kompakt tier etiketi — avatar sağ-altında.
            const userTier = migrateLegacyTier(u.user?.subscription_tier as string);
            const showTier = userTier !== 'Free';
            return (
              <Pressable
                style={({ pressed }) => [s.userRow, pressed && s.userRowPressed]}
                onPress={() => { onClose(); setTimeout(() => onSelectUser(u), 200); }}
              >
                <View style={{ width: 34, height: 34 }}>
                  <StatusAvatar
                    uri={u.user?.avatar_url}
                    size={34}
                    tier={userTier}
                    frameId={(u.user as any)?.active_frame}
                    contextKey="listener"
                    showTierBadge={showTier}
                    customBadgeId={(u.user as any)?.active_badge_id ?? null}
                  />
                </View>
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
          }}
        />
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,12,22,0.45)',
  },
  panel: {
    position: 'absolute',
    right: 0,
    // top + bottom inline veriliyor (insets bazlı, oda header/control bar üstünde biter)
    // width inline olarak component içinde atanır (useWindowDimensions runtime).
    borderTopLeftRadius: 26, borderBottomLeftRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#1a2030',
    // ★ 2026-05-05 perf: Android elevation 22→10 (GPU pahalı), iOS shadow azaltıldı.
    shadowColor: '#000',
    shadowOffset: { width: -6, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerIcon: {
    textShadowColor: 'rgba(20,184,166,0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
  },
  headerSeparator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F1F5F9',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  countPill: {
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 100, minWidth: 20, alignItems: 'center',
    backgroundColor: 'rgba(20,184,166,0.18)',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.45)',
  },
  countText: { color: '#5EEAD4', fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
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
