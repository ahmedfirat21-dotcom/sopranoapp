/**
 * SopranoChat — Blocked Users Bottom Sheet
 * Aşağıdan kayar, swipe-down ile kapanır. QuickCreateSheet pattern.
 * Engelli kullanıcı listesi + tek tek "Engeli Kaldır" aksiyonu.
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { i18n } from '../services/i18n';
import {
  View, Text, StyleSheet, Animated, PanResponder, Pressable, Dimensions,
  ScrollView,
} from 'react-native';
import AppLoader from './AppLoader';
import UserListSkeleton from './UserListSkeleton';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../constants/supabase';
import { ModerationService } from '../services/moderation';
import { useUserProfileSheet } from '../app/_layout';
import { showToast } from './Toast';
import StatusAvatar from './StatusAvatar';
import { useRouter } from 'expo-router';

const { height: SCREEN_H } = Dimensions.get('window');
const PANEL_HEIGHT = Math.min(SCREEN_H * 0.7, 560);

interface BlockedUser {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  subscription_tier?: string | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  currentUserId: string;
}

export default function BlockedUsersSheet({ visible, onClose, currentUserId }: Props) {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 14);
  const { openUserProfile } = useUserProfileSheet();
  const router = useRouter();
  const CLOSED_Y = PANEL_HEIGHT + bottomInset + 50;

  const translateY = useRef(new Animated.Value(CLOSED_Y)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [unblockingIds, setUnblockingIds] = useState<Set<string>>(new Set());

  const loadBlocked = useCallback(async () => {
    setLoading(true);
    try {
      const ids = await ModerationService.getBlockedUsers(currentUserId);
      if (ids.length === 0) {
        setUsers([]);
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, subscription_tier')
        .in('id', ids);
      setUsers((data as BlockedUser[]) || []);
    } catch {
      showToast({ title: i18n.t('blockeduserssheet.001'), message: i18n.t('blockeduserssheet.002'), type: 'error' });
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      loadBlocked();
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 220 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: CLOSED_Y, duration: 200, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible]);

  // ★ 2026-04-28: Clubhouse pattern — pan tüm sheet'e bağlı, ScrollView ile koordineli.
  const scrollOffsetRef = useRef(0);
  const handleScroll = useCallback((e: any) => {
    scrollOffsetRef.current = e?.nativeEvent?.contentOffset?.y ?? 0;
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx) && scrollOffsetRef.current <= 0,
      onMoveShouldSetPanResponderCapture: (_, gs) =>
        gs.dy > 25 && Math.abs(gs.dy) > Math.abs(gs.dx) * 2 && scrollOffsetRef.current <= 0,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gs) => {
        translateY.setValue(Math.max(0, gs.dy));
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80 || gs.vy > 0.4) {
          Animated.timing(translateY, { toValue: CLOSED_Y, duration: 180, useNativeDriver: true })
            .start(() => onClose());
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 220 }).start();
        }
      },
    })
  ).current;

  const handleUnblock = async (user: BlockedUser) => {
    if (unblockingIds.has(user.id)) return;
    setUnblockingIds(prev => new Set(prev).add(user.id));
    try {
      await ModerationService.unblockUser(currentUserId, user.id);
      setUsers(prev => prev.filter(u => u.id !== user.id));
      showToast({
        title: i18n.t('blockeduserssheet.003'),
        message: `${user.display_name || i18n.t('auto.BlockedUsersSheet.003')} artık engelli değil.`,
        type: 'success',
      });
    } catch {
      showToast({ title: i18n.t('blockeduserssheet.004'), message: `${user.display_name || i18n.t('auto.BlockedUsersSheet.002')} engelli kaldı.`, type: 'error' });
    } finally {
      setUnblockingIds(prev => { const n = new Set(prev); n.delete(user.id); return n; });
    }
  };

  if (!mounted) return null;

  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 100, opacity: backdropOpacity }]}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          s.panel,
          {
            bottom: 0,
            paddingBottom: bottomInset + 14,
            height: PANEL_HEIGHT + bottomInset + 14,
            transform: [{ translateY }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <LinearGradient
          colors={['#4a5668', '#37414f', '#232a35']}
          locations={[0, 0.35, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFillObject, { borderTopLeftRadius: 20, borderTopRightRadius: 20 }]}
        />

        {/* ★ 2026-04-28: Drag handle/header artık görsel — pan tüm sheet'te (Clubhouse). */}
        <View>
          <View style={s.handle}>
            <View style={s.handleBar} />
          </View>
          <View style={s.header}>
            <Ionicons name="ban-outline" size={18} color="#EF4444" />
            <Text style={s.headerTitle}>{i18n.t('blockeduserssheet.001')}</Text>
            {users.length > 0 && (
              <View style={s.countBadge}>
                <Text style={s.countText}>{users.length}</Text>
              </View>
            )}
          </View>
        </View>

        {loading ? (
          /* ★ v107.27: AppLoader kaldırıldı — skeleton (myrooms pattern'i) */
          <UserListSkeleton count={3} showAction />
        ) : users.length === 0 ? (
          <View style={s.emptyWrap}>
            <Ionicons name="shield-checkmark-outline" size={44} color="rgba(20,184,166,0.4)" />
            <Text style={s.emptyTitle}>Engellenen yok</Text>
            <Text style={s.emptySub}>{i18n.t('blockeduserssheet.002')}</Text>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: 12, gap: 6 }}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {users.map((u) => {
              const isUnblocking = unblockingIds.has(u.id);
              return (
                <View key={u.id} style={s.row}>
                  {/* ★ 2026-04-26: Avatar tıklanınca profil sheet — engeli kaldırma alternatif yolu da olur */}
                  <Pressable onPress={() => openUserProfile(u.id)} hitSlop={6}>
                    <StatusAvatar
                      uri={u.avatar_url || undefined}
                      size={36}
                      tier={(u.subscription_tier as any) || undefined}
                      frameId={(u as any).active_frame}
                      customBadgeId={(u as any).active_badge_id ?? null}
                    />
                  </Pressable>
                  <Pressable style={{ flex: 1 }} onPress={() => openUserProfile(u.id)} hitSlop={4}>
                    <Text style={s.name} numberOfLines={1}>
                      {u.display_name || i18n.t('auto.BlockedUsersSheet.001')}
                    </Text>
                    <Text style={s.sub} numberOfLines={1}>Engelli</Text>
                  </Pressable>
                  {/* ★ v110.5.23: Sohbeti aç — engellediği kişinin eski mesajlarına erişim */}
                  <Pressable
                    onPress={() => {
                      onClose();
                      setTimeout(() => router.push(`/chat/${u.id}` as any), 250);
                    }}
                    style={({ pressed }) => [
                      { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(20,184,166,0.10)', borderWidth: 1, borderColor: 'rgba(20,184,166,0.25)' },
                      pressed && { opacity: 0.7 },
                    ]}
                    hitSlop={6}
                  >
                    <Ionicons name="chatbubble-outline" size={16} color="#14B8A6" />
                  </Pressable>
                  <Pressable
                    onPress={() => handleUnblock(u)}
                    disabled={isUnblocking}
                    style={({ pressed }) => [
                      s.unblockBtn,
                      pressed && { opacity: 0.7 },
                      isUnblocking && { opacity: 0.5 },
                    ]}
                  >
                    {isUnblocking ? (
                      <AppLoader color="#14B8A6" size="small" />
                    ) : (
                      <>
                        <Ionicons name="person-add-outline" size={14} color="#14B8A6" />
                        <Text style={s.unblockText}>{i18n.t('blockeduserssheet.003')}</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
        )}
      </Animated.View>
    </>
  );
}

const s = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 101,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#95a1ae',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 20,
  },
  handle: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(239,68,68,0.05)',
  },
  headerTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#F1F5F9',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  countBadge: {
    backgroundColor: 'rgba(239,68,68,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: { fontSize: 11, fontWeight: '800', color: '#EF4444' },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E2E8F0',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  emptySub: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 17,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E2E8F0',
    letterSpacing: 0.15,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  sub: {
    fontSize: 11,
    color: '#EF4444',
    marginTop: 1,
    fontWeight: '500',
  },
  unblockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(20,184,166,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    minWidth: 78,
    justifyContent: 'center',
  },
  unblockText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#14B8A6',
    letterSpacing: 0.2,
  },
});
