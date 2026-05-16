/**
 * SopranoChat — Host Erişim Paneli (v2)
 * ★ FriendsDrawer tarzı sağdan kayan animasyonlu drawer
 * Katılım istekleri + Davet + Banlı kullanıcılar
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { i18n } from '../../services/i18n';
import {
  View, Text, StyleSheet, Pressable, FlatList,
  Image, TextInput, Animated,
  Dimensions, ScrollView,
} from 'react-native';
import AppLoader from '../AppLoader';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoomAccessService } from '../../services/roomAccess';
import { ProfileService, type Profile } from '../../services/database';
import { useUserProfileSheet } from '../../app/_layout';
import { ModerationService } from '../../services/moderation';
import { getAvatarSource } from '../../constants/avatars';
import { showToast } from '../Toast';
import { useSwipeToDismiss } from '../../hooks/useSwipeToDismiss';
import { supabase } from '../../constants/supabase';

const { width: W } = Dimensions.get('window');
// ★ 2026-05-05: Keşfet drawer dili — birebir aynı boyut (NotificationDrawer ile).
const DRAWER_W = Math.min(W * 0.72, 300);
const ROOM_TOP_GAP = 70;
const ROOM_BOTTOM_GAP = 90;

interface Props {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  roomType: string; // 'closed' | 'invite' | 'open'
  hostId: string;
}

export default function HostAccessPanel({ visible, onClose, roomId, roomType, hostId }: Props) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(DRAWER_W)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { openUserProfile } = useUserProfileSheet();

  // ★ Swipe-right-to-dismiss (ChatDrawer ile aynı kalıp)
  const { translateValue: swipeX, panHandlers } = useSwipeToDismiss({
    direction: 'right',
    threshold: 60,
    onDismiss: onClose,
  });

  // ★ 2026-04-20: 'invite' tab kaldırıldı — davet PlusMenu'de tek merkezde.
  //   HostAccessPanel artık sadece moderasyon (istekler + banlar).
  const [tab, setTab] = useState<'requests' | 'bans'>(roomType === 'closed' || roomType === 'invite' ? 'requests' : 'bans');
  const [requests, setRequests] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [bannedUsers, setBannedUsers] = useState<any[]>([]);
  const [loadingBans, setLoadingBans] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // ★ Animasyon
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: DRAWER_W, useNativeDriver: true, damping: 20, stiffness: 220 }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  // ★ Veri yükle
  useEffect(() => {
    if (visible) {
      if (roomType === 'closed' || roomType === 'invite') loadRequests();
      loadBans();
      // Reset search on open
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [visible]);

  // ★ 2026-04-20: Banlılar listesi realtime — yeni ban eklenince anında yansır
  useEffect(() => {
    if (!visible || !roomId) return;
    const banChannel = supabase
      .channel(`room_bans:${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'room_bans',
        filter: `room_id=eq.${roomId}`,
      }, () => { loadBans(); })
      .subscribe();
    return () => { supabase.removeChannel(banChannel); };
  }, [visible, roomId]);

  const loadRequests = async () => {
    setLoadingRequests(true);
    try {
      const reqs = await RoomAccessService.getPendingRequests(roomId);
      setRequests(reqs);
    } catch {}
    setLoadingRequests(false);
  };

  const loadBans = async () => {
    setLoadingBans(true);
    try {
      const bans = await ModerationService.getRoomBans(roomId);
      setBannedUsers(bans);
    } catch {}
    setLoadingBans(false);
  };

  const handleAccept = async (req: any) => {
    setProcessingIds(prev => new Set(prev).add(req.id));
    try {
      await RoomAccessService.approveRequest(req.id, hostId);
      setRequests(prev => prev.filter(r => r.id !== req.id));
      showToast({ title: '✅ Kabul Edildi', message: `${req.user?.display_name || i18n.t('auto.room.HostAccessPanel.009')} artık odaya girebilir.`, type: 'success' });
    } catch {} finally {
      setProcessingIds(prev => { const n = new Set(prev); n.delete(req.id); return n; });
    }
  };

  const handleReject = async (req: any) => {
    setProcessingIds(prev => new Set(prev).add(req.id));
    try {
      await RoomAccessService.rejectRequest(req.id, hostId);
      setRequests(prev => prev.filter(r => r.id !== req.id));
      showToast({ title: '❌ Reddedildi', type: 'info' });
    } catch {} finally {
      setProcessingIds(prev => { const n = new Set(prev); n.delete(req.id); return n; });
    }
  };

  const handleUnban = async (ban: any) => {
    setProcessingIds(prev => new Set(prev).add(ban.id));
    try {
      await ModerationService.unbanFromRoom(roomId, ban.user_id, hostId);
      setBannedUsers(prev => prev.filter(b => b.id !== ban.id));
      showToast({ title: i18n.t('room.hostaccesspanel.001'), message: `${ban.user?.display_name || i18n.t('auto.room.HostAccessPanel.008')} artık odaya girebilir.`, type: 'success' });
    } catch {
      showToast({ title: i18n.t('room.hostaccesspanel.002'), message: `${ban.user?.display_name || i18n.t('auto.room.HostAccessPanel.007')} banı kaldırılamadı.`, type: 'error' });
    } finally {
      setProcessingIds(prev => { const n = new Set(prev); n.delete(ban.id); return n; });
    }
  };

  // Kullanıcı ara (davet için)
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const results = await ProfileService.search(query, 15, hostId);
      setSearchResults(results);
    } catch {}
    setSearching(false);
  }, []);

  const handleInvite = async (user: Profile) => {
    setProcessingIds(prev => new Set(prev).add(user.id));
    try {
      const result = await RoomAccessService.inviteUser(roomId, user.id, hostId);
      if (result.success) {
        showToast({ title: i18n.t('room.hostaccesspanel.003'), message: `${user.display_name} odaya davet edildi.`, type: 'success' });
        setSearchResults(prev => prev.filter(u => u.id !== user.id));
      } else {
        showToast({ title: i18n.t('room.hostaccesspanel.004'), message: result.error || `${user.display_name} davet edilemedi.`, type: 'error' });
      }
    } catch {} finally {
      setProcessingIds(prev => { const n = new Set(prev); n.delete(user.id); return n; });
    }
  };

  // Tab tanımları — 'invite' KALDIRILDI (duplikasyon; PlusMenu > Davet akışı tek yer).
  const tabs = [
    ...((roomType === 'closed' || roomType === 'invite') ? [{ id: 'requests' as const, label: i18n.t('room.hostaccesspanel.005'), icon: 'hourglass-outline' as const, count: requests.length }] : []),
    { id: 'bans' as const, label: i18n.t('room.hostaccesspanel.006'), icon: 'ban-outline' as const, count: bannedUsers.length },
  ];

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9998 }]} pointerEvents={visible ? 'box-none' : 'none'}>
      {/* Backdrop — keşfet drawer dim tonu */}
      <Animated.View style={[s.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Panel — sağdan süzülür + sağa sürükle kapat */}
      <Animated.View
        style={[s.panel, {
          top: Math.max(insets.top + 12, ROOM_TOP_GAP),
          bottom: Math.max(insets.bottom + 8, ROOM_BOTTOM_GAP),
          transform: [{ translateX: Animated.add(slideAnim, swipeX) }],
        }]}
        {...panHandlers}
      >
        {/* Profil sayfası gradient dili — diagonal slate */}
        <LinearGradient
          colors={['#3a4658', '#2a3344', '#1a2030']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        {/* ★ 2026-05-05: 3 katman aile dili — slate + halo + soft glow. Mor: Moderasyon. */}
        <LinearGradient
          colors={['rgba(167,139,250,0.22)', 'rgba(167,139,250,0.06)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(167,139,250,0.08)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.6 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        {/* Başlık — NotificationDrawer dili */}
        <View style={s.header}>
          <Ionicons name="shield-checkmark" size={18} color="#A78BFA" style={s.headerIconGlow} />
          <Text style={s.headerTitle}>Moderasyon</Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={onClose} hitSlop={12} style={s.closeBtn}>
            <Ionicons name="close" size={16} color="rgba(255,255,255,0.4)" />
          </Pressable>
        </View>
        <View style={s.headerSeparator} />

        {/* Tab Bar */}
        <View style={s.tabBar}>
          {tabs.map(t => (
            <Pressable
              key={t.id}
              style={[s.tab, tab === t.id && s.tabActive]}
              onPress={() => { setTab(t.id); if (t.id === 'bans') loadBans(); }}
            >
              <Ionicons name={t.icon} size={12} color={tab === t.id ? '#A78BFA' : 'rgba(255,255,255,0.3)'} />
              <Text style={[s.tabText, tab === t.id && s.tabTextActive]}>{t.label}</Text>
              {t.count > 0 && (
                <View style={s.tabBadge}>
                  <Text style={s.tabBadgeText}>{t.count}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>

        {/* İçerik */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 40 }}>

          {/* ═══ İSTEKLER TAB ═══ */}
          {tab === 'requests' && (roomType === 'closed' || roomType === 'invite') && (
            <>
              {loadingRequests ? (
                <AppLoader color="#A78BFA" style={{ marginTop: 40 }} />
              ) : requests.length === 0 ? (
                <View style={s.empty}>
                  <View style={s.emptyIcon}>
                    <Ionicons name="checkmark-circle" size={28} color="rgba(167,139,250,0.25)" />
                  </View>
                  <Text style={s.emptyTitle}>Bekleyen istek yok</Text>
                  <Text style={s.emptySub}>{i18n.t('room.hostaccesspanel.001')}</Text>
                </View>
              ) : (
                requests.map((req) => {
                  const isProcessing = processingIds.has(req.id);
                  return (
                    <View key={req.id} style={s.row}>
                      <Pressable onPress={() => openUserProfile(req.user_id)} hitSlop={6}>
                        <Image source={getAvatarSource(req.user?.avatar_url)} style={s.avatar} />
                      </Pressable>
                      <Pressable style={{ flex: 1 }} onPress={() => openUserProfile(req.user_id)} hitSlop={4}>
                        <Text style={s.name} numberOfLines={1}>{req.user?.display_name || i18n.t('auto.room.HostAccessPanel.006')}</Text>
                      </Pressable>
                      {isProcessing ? (
                        <AppLoader size="small" color="#A78BFA" />
                      ) : (
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <Pressable style={s.acceptBtn} onPress={() => handleAccept(req)}>
                            <Ionicons name="checkmark" size={15} color="#FFF" />
                          </Pressable>
                          <Pressable style={s.rejectBtn} onPress={() => handleReject(req)}>
                            <Ionicons name="close" size={15} color="#94A3B8" />
                          </Pressable>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </>
          )}

          {/* Davet tab kaldırıldı — PlusMenu > Davet tek merkezde */}

          {/* ═══ BANLILAR TAB ═══ */}
          {tab === 'bans' && (
            <>
              {loadingBans ? (
                <AppLoader color="#EF4444" style={{ marginTop: 40 }} />
              ) : bannedUsers.length === 0 ? (
                <View style={s.empty}>
                  <View style={[s.emptyIcon, { backgroundColor: 'rgba(34,197,94,0.08)' }]}>
                    <Ionicons name="shield-checkmark" size={28} color="rgba(34,197,94,0.3)" />
                  </View>
                  <Text style={s.emptyTitle}>{i18n.t('room.hostaccesspanel.002')}</Text>
                  <Text style={s.emptySub}>Oda temiz! 🎉</Text>
                </View>
              ) : (
                bannedUsers.map((ban) => {
                  const isPermanent = ban.ban_type === 'permanent';
                  const expiresAt = ban.expires_at ? new Date(ban.expires_at) : null;
                  const isExpired = expiresAt && expiresAt < new Date();
                  const remainingMin = expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 60000)) : 0;
                  const timeLabel = isPermanent ? i18n.t('auto.room.HostAccessPanel.005') : isExpired ? i18n.t('auto.room.HostAccessPanel.004') : remainingMin > 60 ? `${Math.floor(remainingMin / 60)}sa ${remainingMin % 60}dk` : i18n.t('auto.room.HostAccessPanel.003', { 0: remainingMin });
                  const isProcessing = processingIds.has(ban.id);

                  return (
                    <View key={ban.id} style={s.row}>
                      <Pressable onPress={() => openUserProfile(ban.user_id)} hitSlop={6}>
                        <Image source={getAvatarSource(ban.user?.avatar_url)} style={s.avatar} />
                      </Pressable>
                      <View style={{ flex: 1 }}>
                        <Pressable onPress={() => openUserProfile(ban.user_id)} hitSlop={4}>
                          <Text style={s.name} numberOfLines={1}>{ban.user?.display_name || i18n.t('auto.room.HostAccessPanel.002')}</Text>
                        </Pressable>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                          <View style={[s.banTypePill, isPermanent ? s.banPermanent : s.banTemp]}>
                            <Text style={[s.banTypeText, { color: isPermanent ? '#EF4444' : '#F59E0B' }]}>
                              {isPermanent ? '⛔ KALICI' : i18n.t('auto.room.HostAccessPanel.001')}
                            </Text>
                          </View>
                          <Text style={s.banTime}>{timeLabel}</Text>
                        </View>
                        {/* ★ 2026-04-20: Banı kim attı — hesap verebilirlik için */}
                        {(ban as any).banned_by_user && (
                          <Text style={s.bannedBy} numberOfLines={1}>
                            🛡️ {(ban as any).banned_by_user.display_name} tarafından
                          </Text>
                        )}
                      </View>
                      {isProcessing ? (
                        <AppLoader size="small" color="#14B8A6" />
                      ) : (
                        <Pressable style={s.unbanBtn} onPress={() => handleUnban(ban)}>
                          <Ionicons name="lock-open-outline" size={12} color="#14B8A6" />
                          <Text style={s.unbanText}>{i18n.t('room.hostaccesspanel.003')}</Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })
              )}
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,12,22,0.45)' },
  panel: {
    position: 'absolute', right: 0,
    width: DRAWER_W,
    borderTopLeftRadius: 26, borderBottomLeftRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#1a2030',
    // ★ 2026-05-05 perf: Android elevation azaltıldı (FPS koruma)
    shadowColor: '#000',
    shadowOffset: { width: -6, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingTop: 16, paddingBottom: 12,
  },
  headerIconGlow: {
    textShadowColor: 'rgba(167,139,250,0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
  },
  headerSeparator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 12,
  },
  iconShadow: { textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 3 },
  headerTitle: {
    fontSize: 15, fontWeight: '800', color: '#F1F5F9',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4,
  },
  closeBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 7, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  tabActive: {
    backgroundColor: 'rgba(167,139,250,0.1)',
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.18)',
  },
  tabText: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.3)' },
  tabTextActive: { color: '#A78BFA', fontWeight: '700' },
  tabBadge: {
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: 'rgba(167,139,250,0.2)',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  tabBadgeText: { fontSize: 9, fontWeight: '800', color: '#A78BFA' },

  // Rows
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 6, borderRadius: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  name: {
    fontSize: 13, fontWeight: '600', color: '#F1F5F9',
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  username: { fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 },

  // Empty states
  empty: { alignItems: 'center', paddingVertical: 50, gap: 8 },
  emptyIcon: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(167,139,250,0.08)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.35)' },
  emptySub: { fontSize: 11, color: 'rgba(255,255,255,0.15)', textAlign: 'center' },

  // Action buttons
  acceptBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#14B8A6', alignItems: 'center', justifyContent: 'center',
  },
  rejectBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  inviteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    backgroundColor: 'rgba(167,139,250,0.1)',
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)',
  },
  inviteBtnText: { fontSize: 11, fontWeight: '700', color: '#A78BFA' },

  // Ban row extras
  banTypePill: {
    paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 4,
  },
  banPermanent: { backgroundColor: 'rgba(239,68,68,0.12)' },
  banTemp: { backgroundColor: 'rgba(245,158,11,0.12)' },
  banTypeText: { fontSize: 8, fontWeight: '700' },
  banTime: { fontSize: 9, color: 'rgba(255,255,255,0.25)' },
  bannedBy: { fontSize: 9, color: 'rgba(167,139,250,0.65)', marginTop: 2, letterSpacing: 0.2 },

  unbanBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
    backgroundColor: 'rgba(20,184,166,0.08)',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.18)',
  },
  unbanText: { fontSize: 10, fontWeight: '700', color: '#14B8A6' },

  // Search
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, paddingHorizontal: 12, marginVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  searchInput: {
    flex: 1, paddingVertical: 10, fontSize: 13, color: '#F1F5F9',
  },
});
 