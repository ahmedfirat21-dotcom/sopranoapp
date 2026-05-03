/**
 * FollowListModal — Arkadaş / Takipçi / Takip Listesi
 * ─────────────────────────────────────────────────────
 * 2026-04-18: Bidirectional arkadaş listesi olarak başladı.
 * 2026-04-25 (Faz 4.1): One-way follows entegrasyonu — 3 mod:
 *   • friends    → mutual friendships (FriendshipService)
 *   • followers  → bana takip eden (FollowService.getFollowers)
 *   • following  → benim takip ettiğim (FollowService.getFollowing)
 *
 * Aksiyonlar moda göre değişir:
 *   • friends  → "Çıkar" (removeFriend) + "Engelle"
 *   • followers → "Engelle" (kendi takipçimi engelle)
 *   • following → "Takipten Çık" (FollowService.removeFollow)
 *
 * 2026-04-25 (Drag Fix): useSwipeToDismiss kaldırıldı, doğrudan
 *   PanResponder + top-based Animated.Value kullanılıyor.
 *   Koro üyeler modalı (MembersSheet) ile aynı pattern.
 *   Modal donma ve sürüklenememe sorunu çözüldü.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList,
  Image, Animated, PanResponder, Dimensions,
} from 'react-native';
import AppLoader from './AppLoader';
import UserListSkeleton from './UserListSkeleton';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FriendshipService, type FollowUser } from '../services/friendship';
import { FollowService } from '../services/follows';
import { getAvatarSource } from '../constants/avatars';
import StatusAvatar from './StatusAvatar';
import PremiumAlert, { type AlertButton } from './PremiumAlert';
import { useRouter } from 'expo-router';
import { Colors, Shadows } from '../constants/theme';
// ★ v107.32: Cycle kırma — _layout yerine direkt context dosyasından
import { useUserProfileSheet } from '../providers/UserProfileSheetContext';

const SCREEN_H = Dimensions.get('window').height;
const SNAP_HALF = SCREEN_H * 0.45;   // başlangıç: ekranın yarısından biraz yukarı
const SNAP_FULL = 60;                // tam ekran: üstten 60px boşluk
const SNAP_DISMISS = SCREEN_H + 50;  // ekran dışı

const iconShadow = {
  textShadowColor: 'rgba(0,0,0,0.5)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 4,
} as const;

type ListMode = 'friends' | 'followers' | 'following';

interface Props {
  visible: boolean;
  onClose: () => void;
  userId: string;          // Profili görüntülenen kullanıcı
  currentUserId: string;   // Giriş yapan kullanıcı
  /** Açılış sekmesi — 'friends' (mutual) | 'followers' (one-way takipçi) | 'following' (one-way takip) */
  initialTab: ListMode;
  isOwnProfile: boolean;
}

const MODE_META: Record<ListMode, { title: string; emptyText: string; icon: keyof typeof Ionicons.glyphMap }> = {
  friends:   { title: 'ARKADAŞLAR', emptyText: 'Henüz arkadaş yok', icon: 'people' },
  followers: { title: 'TAKİPÇİLER', emptyText: 'Henüz takipçi yok', icon: 'person-add' },
  following: { title: 'TAKİP EDİLENLER', emptyText: 'Kimseyi takip etmiyor', icon: 'person' },
};

export default function FollowListModal({
  visible, onClose, userId, currentUserId, initialTab, isOwnProfile,
}: Props) {
  const router = useRouter();
  const { openUserProfile } = useUserProfileSheet();
  const [tab, setTab] = useState<ListMode>(initialTab);
  const [items, setItems] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [cAlert, setCAlert] = useState<{ visible: boolean; title: string; message: string; type?: 'info' | 'warning' | 'error' | 'success'; buttons?: AlertButton[] }>({ visible: false, title: '', message: '' });

  // ★ 2026-04-28: InRoomUserProfile ile aynı hibrit pattern — translateY-based + Modal YOK + büyük capture eşiği.
  //   Eski top-based + useNativeDriver:false + Modal kombinasyonu pan gesture'ı boğuyordu (drag handle dışında ölü).
  const translateY = useRef(new Animated.Value(SNAP_DISMISS)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const currentSnap = useRef(SNAP_HALF);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const scrollOffsetRef = useRef(0);
  const handleScroll = useCallback((e: any) => {
    scrollOffsetRef.current = e?.nativeEvent?.contentOffset?.y ?? 0;
  }, []);

  const isHalfState = () => currentSnap.current !== SNAP_FULL;

  // ★ 2026-04-28: Header pan — scroll-aware DEĞİL, FULL state'te de aşağı drag çalışsın.
  const headerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        const newY = currentSnap.current + g.dy;
        translateY.setValue(Math.max(SNAP_FULL - 20, newY));
      },
      onPanResponderRelease: (_, g) => {
        const finalPos = currentSnap.current + g.dy;
        if (finalPos > SCREEN_H * 0.65 || g.vy > 0.8) {
          currentSnap.current = SNAP_DISMISS;
          Animated.parallel([
            Animated.timing(translateY, { toValue: SNAP_DISMISS, duration: 200, useNativeDriver: true }),
            Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
          ]).start(() => onCloseRef.current());
          return;
        }
        if (finalPos < SCREEN_H * 0.35 || g.vy < -0.5) {
          currentSnap.current = SNAP_FULL;
          Animated.spring(translateY, { toValue: SNAP_FULL, useNativeDriver: true, damping: 22, stiffness: 200 }).start();
          return;
        }
        currentSnap.current = SNAP_HALF;
        Animated.spring(translateY, { toValue: SNAP_HALF, useNativeDriver: true, damping: 22, stiffness: 200 }).start();
      },
    })
  ).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      // Small threshold — child responder yokken (handle bar, başlık)
      onMoveShouldSetPanResponder: (_, g) => {
        if (Math.abs(g.dy) < 8) return false;
        if (Math.abs(g.dy) <= Math.abs(g.dx)) return false;
        if (isHalfState()) return true;
        return g.dy > 0 && scrollOffsetRef.current <= 0;
      },
      // Large threshold — Pressable/FlatList'ten responder ÇAL
      onMoveShouldSetPanResponderCapture: (_, g) => {
        if (Math.abs(g.dy) < 25) return false;
        if (Math.abs(g.dy) <= Math.abs(g.dx) * 2) return false;
        if (isHalfState()) return true;
        return g.dy > 0 && scrollOffsetRef.current <= 0;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        const newY = currentSnap.current + g.dy;
        translateY.setValue(Math.max(SNAP_FULL - 20, newY));
      },
      onPanResponderRelease: (_, g) => {
        const finalPos = currentSnap.current + g.dy;

        if (finalPos > SCREEN_H * 0.65 || g.vy > 0.8) {
          currentSnap.current = SNAP_DISMISS;
          Animated.parallel([
            Animated.timing(translateY, { toValue: SNAP_DISMISS, duration: 200, useNativeDriver: true }),
            Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
          ]).start(() => onCloseRef.current());
          return;
        }

        if (finalPos < SCREEN_H * 0.35 || g.vy < -0.5) {
          currentSnap.current = SNAP_FULL;
          Animated.spring(translateY, { toValue: SNAP_FULL, useNativeDriver: true, damping: 22, stiffness: 200 }).start();
          return;
        }

        currentSnap.current = SNAP_HALF;
        Animated.spring(translateY, { toValue: SNAP_HALF, useNativeDriver: true, damping: 22, stiffness: 200 }).start();
      },
    })
  ).current;

  const dismiss = useCallback(() => {
    currentSnap.current = SNAP_DISMISS;
    Animated.parallel([
      Animated.timing(translateY, { toValue: SNAP_DISMISS, duration: 200, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => onClose());
  }, [onClose, translateY, backdropOpacity]);

  useEffect(() => { setTab(initialTab); }, [initialTab]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let data: FollowUser[] = [];
      if (tab === 'friends') {
        data = await FriendshipService.getFriends(userId);
      } else if (tab === 'followers') {
        data = await FollowService.getFollowers(userId);
      } else {
        data = await FollowService.getFollowing(userId);
      }
      setItems(data);
    } catch (e) {
      if (__DEV__) console.warn('[FollowListModal] Load error:', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [userId, tab]);

  // ── open / data load ────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      translateY.setValue(SNAP_DISMISS);
      backdropOpacity.setValue(0);
      currentSnap.current = SNAP_HALF;
      loadData();
      Animated.parallel([
        Animated.spring(translateY, { toValue: SNAP_HALF, useNativeDriver: true, damping: 22, stiffness: 200 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, loadData]);

  const list = items;
  const meta = MODE_META[tab];

  // ★ Friends mode — bidirectional friendship remove
  const handleRemoveFriend = (targetId: string, name: string) => {
    setCAlert({
      visible: true,
      title: 'Arkadaşlıktan Çıkar',
      message: `${name} ile arkadaşlığın sona ersin mi?`,
      type: 'warning',
      buttons: [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Çıkar', style: 'destructive', onPress: async () => {
            setActionLoading(targetId);
            const result = await FriendshipService.removeFriend(currentUserId, targetId);
            if (result.success) setItems(prev => prev.filter(f => f.id !== targetId));
            setActionLoading(null);
          }
        },
      ],
    });
  };

  const handleBlock = (targetId: string, name: string) => {
    setCAlert({
      visible: true,
      title: 'Engelle',
      message: `${name} engellensin mi?`,
      type: 'error',
      buttons: [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Engelle', style: 'destructive', onPress: async () => {
            setActionLoading(targetId);
            const result = await FriendshipService.block(currentUserId, targetId);
            if (result.success) setItems(prev => prev.filter(f => f.id !== targetId));
            setActionLoading(null);
          }
        },
      ],
    });
  };

  // ★ Following mode — kendi profilim, takip ettiğim birinden çık
  const handleUnfollow = (targetId: string, name: string) => {
    setCAlert({
      visible: true,
      title: 'Takipten Çık',
      message: `${name} kullanıcısını takipten çıkmak istiyor musun?`,
      type: 'warning',
      buttons: [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Takipten Çık', style: 'destructive', onPress: async () => {
            setActionLoading(targetId);
            const result = await FollowService.removeFollow(currentUserId, targetId);
            if (result.success) setItems(prev => prev.filter(f => f.id !== targetId));
            setActionLoading(null);
          }
        },
      ],
    });
  };

  const navigateToProfile = (targetId: string) => {
    dismiss();
    setTimeout(() => openUserProfile(targetId), 200);
  };

  const renderItem = ({ item }: { item: FollowUser }) => {
    const isActioning = actionLoading === item.id;
    const isMe = item.id === currentUserId;

    return (
      <Pressable
        style={({ pressed }) => [st.row, pressed && { backgroundColor: 'rgba(255,255,255,0.04)' }]}
        onPress={() => navigateToProfile(item.id)}
      >
        <StatusAvatar uri={item.avatar_url} size={40} tier={(item as any).subscription_tier} showTierBadge={false} />
        <View style={{ flex: 1 }}>
          <Text style={st.name} numberOfLines={1}>{item.display_name}</Text>
          {item.username && <Text style={st.username}>@{item.username}</Text>}
        </View>

        {/* Aksiyonlar — moda göre değişir, sadece kendi profilinde */}
        {isOwnProfile && !isMe && (
          <View style={st.actions}>
            {isActioning ? (
              <AppLoader size="small" color="#14B8A6" />
            ) : tab === 'friends' ? (
              <>
                <Pressable
                  style={st.removeBtn}
                  onPress={() => handleRemoveFriend(item.id, item.display_name)}
                >
                  <Text style={st.removeBtnText}>Çıkar</Text>
                </Pressable>
                <Pressable
                  style={st.blockBtn}
                  onPress={() => handleBlock(item.id, item.display_name)}
                  hitSlop={6}
                >
                  <Ionicons name="ban" size={14} color="#EF4444" />
                </Pressable>
              </>
            ) : tab === 'following' ? (
              <Pressable
                style={st.removeBtn}
                onPress={() => handleUnfollow(item.id, item.display_name)}
              >
                <Text style={st.removeBtnText}>Takipten Çık</Text>
              </Pressable>
            ) : (
              // followers — sadece engelle aksiyonu
              <Pressable
                style={st.blockBtn}
                onPress={() => handleBlock(item.id, item.display_name)}
                hitSlop={6}
              >
                <Ionicons name="ban" size={14} color="#EF4444" />
              </Pressable>
            )}
          </View>
        )}
      </Pressable>
    );
  };

  if (!visible) return null;

  return (
    // ★ 2026-04-28: Modal sarmalı kaldırıldı — Modal native dialog Pressable backdrop tap'i yutuyordu,
    //   pan responder Capture phase'i de Pressable child'larla çakışıyordu (drag handle dışında ölü).
    //   View overlay zIndex:300 ile sayfanın üstünde kalır (InRoomUserProfile/profile.tsx/user/[id].tsx).
    <View style={st.overlay} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.55)', opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={dismiss} />
      </Animated.View>

      {/* Sheet — translateY-based animated positioning (useNativeDriver:true) */}
      <Animated.View style={[st.sheet, { transform: [{ translateY }] }]} {...panResponder.panHandlers}>
          {/* ★ Diagonal gradient fon — profil sayfası ile birebir */}
          <LinearGradient
            colors={['#4a5668', '#37414f', '#232a35']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          {/* Üst teal hairline — premium aksan */}
          <LinearGradient
            colors={['transparent', 'rgba(20,184,166,0.55)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={st.topEdge}
            pointerEvents="none"
          />

          {/* ★ 2026-04-28: Header bölgesi her zaman drag yakalar (FULL state'te scroll-top değilken bile). */}
          <View {...headerPanResponder.panHandlers}>
            <View style={st.handleWrap}>
              <View style={st.handle} />
            </View>
            <View style={st.header}>
              <View style={st.sectionAccent} />
              <Ionicons name={meta.icon} size={14} color={Colors.teal} style={iconShadow} />
              <Text style={st.headerTitle}>{meta.title}</Text>
              <View style={st.countBadge}>
                <Text style={st.countText}>{list.length}</Text>
              </View>
            </View>
          </View>

          {/* Liste — ★ v107.20: AppLoader yerine skeleton placeholder (kullanıcı talebi) */}
          {loading ? (
            <UserListSkeleton count={4} showAction />
          ) : list.length === 0 ? (
            <View style={st.empty}>
              <Ionicons name="people-outline" size={40} color="rgba(94,234,212,0.2)" style={iconShadow} />
              <Text style={st.emptyText}>{meta.emptyText}</Text>
            </View>
          ) : (
            <FlatList
              data={list}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={{ paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
              style={{ flex: 1 }}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            />
          )}
      </Animated.View>
      <PremiumAlert {...cAlert} onDismiss={() => setCAlert(prev => ({ ...prev, visible: false }))} />
    </View>
  );
}

const st = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 400, // InRoomUserProfile (300) üstünde — profil sheet'inin üzerine açılır
    elevation: 24, // Android için
  },
  sheet: {
    // ★ 2026-04-28: top:0+bottom:0 sabit, transform translateY ile snap (useNativeDriver:true).
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.cardBorder,
    ...Shadows.card,
  },
  topEdge: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, zIndex: 1,
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 8,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  // ★ Premium section header — profil sayfası pattern
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  sectionAccent: {
    width: 3, height: 16, borderRadius: 2, backgroundColor: Colors.teal,
  },
  headerTitle: {
    flex: 1,
    fontSize: 12, fontWeight: '900', color: '#CBD5E1',
    letterSpacing: 1.2, textTransform: 'uppercase',
    ...Shadows.text,
  },
  countBadge: {
    backgroundColor: 'rgba(20,184,166,0.12)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.25)',
  },
  countText: { fontSize: 10, fontWeight: '800', color: '#14B8A6' },
  loading: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  empty: {
    paddingVertical: 72,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    fontSize: 13, color: '#94A3B8', fontWeight: '600',
    ...Shadows.text,
  },
  // ★ Row — ProfileFriendsList ile birebir
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  name: {
    fontSize: 14, fontWeight: '700', color: '#F1F5F9', letterSpacing: 0.15,
    ...Shadows.text,
  },
  username: {
    fontSize: 11, color: '#94A3B8', marginTop: 2, fontWeight: '500',
    ...Shadows.textLight,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  removeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  removeBtnText: {
    fontSize: 12, fontWeight: '700', color: '#CBD5E1',
    ...Shadows.textLight,
  },
  unfollowBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(20,184,166,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.2)',
  },
  unfollowBtnText: {
    fontSize: 12, fontWeight: '700', color: '#14B8A6',
    ...Shadows.text,
  },
  blockBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
