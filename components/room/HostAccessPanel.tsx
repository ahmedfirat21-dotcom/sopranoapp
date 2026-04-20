/**
 * SopranoChat — Host Erişim Paneli (v2)
 * ★ FriendsDrawer tarzı sağdan kayan animasyonlu drawer
 * Katılım istekleri + Davet + Banlı kullanıcılar
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList,
  Image, TextInput, ActivityIndicator, Animated,
  Dimensions, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { RoomAccessService } from '../../services/roomAccess';
import { ProfileService, type Profile } from '../../services/database';
import { ModerationService } from '../../services/moderation';
import { getAvatarSource } from '../../constants/avatars';
import { showToast } from '../Toast';
import { useSwipeToDismiss } from '../../hooks/useSwipeToDismiss';

const { width: W } = Dimensions.get('window');
const DRAWER_W = W * 0.72;

interface Props {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  roomType: string; // 'closed' | 'invite' | 'open'
  hostId: string;
}

export default function HostAccessPanel({ visible, onClose, roomId, roomType, hostId }: Props) {
  const slideAnim = useRef(new Animated.Value(DRAWER_W)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ★ Swipe-right-to-dismiss (ChatDrawer ile aynı kalıp)
  const { translateValue: swipeX, panHandlers } = useSwipeToDismiss({
    direction: 'right',
    threshold: 60,
    onDismiss: onClose,
  });

  const [tab, setTab] = useState<'requests' | 'invite' | 'bans'>(roomType === 'closed' ? 'requests' : roomType === 'invite' ? 'requests' : 'bans');
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
      showToast({ title: '✅ Kabul Edildi', message: `${req.user?.display_name || 'Kullanıcı'} artık odaya girebilir.`, type: 'success' });
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
      await ModerationService.unbanFromRoom(roomId, ban.user_id);
      setBannedUsers(prev => prev.filter(b => b.id !== ban.id));
      showToast({ title: '✅ Ban Kaldırıldı', message: `${ban.user?.display_name || 'Kullanıcı'} artık odaya girebilir.`, type: 'success' });
    } catch {
      showToast({ title: 'Hata', message: 'Ban kaldırılamadı', type: 'error' });
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
      const results = await ProfileService.search(query, 15);
      setSearchResults(results);
    } catch {}
    setSearching(false);
  }, []);

  const handleInvite = async (user: Profile) => {
    setProcessingIds(prev => new Set(prev).add(user.id));
    try {
      const result = await RoomAccessService.inviteUser(roomId, user.id, hostId);
      if (result.success) {
        showToast({ title: '📨 Davet Gönderildi', message: `${user.display_name} odaya davet edildi.`, type: 'success' });
        setSearchResults(prev => prev.filter(u => u.id !== user.id));
      } else {
        showToast({ title: 'Hata', message: result.error || 'Davet gönderilemedi.', type: 'error' });
      }
    } catch {} finally {
      setProcessingIds(prev => { const n = new Set(prev); n.delete(user.id); return n; });
    }
  };

  // Tab tanımları
  const tabs = [
    ...((roomType === 'closed' || roomType === 'invite') ? [{ id: 'requests' as const, label: 'İstekler', icon: 'hourglass-outline' as const, count: requests.length }] : []),
    { id: 'invite' as const, label: 'Davet Et', icon: 'person-add-outline' as const, count: 0 },
    { id: 'bans' as const, label: 'Banlılar', icon: 'ban-outline' as const, count: bannedUsers.length },
  ];

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9998 }]} pointerEvents={visible ? 'box-none' : 'none'}>
      {/* Backdrop — sadece dismiss alanı, görsel efekt yok */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      {/* Panel — sağdan süzülür + sağa sürükle kapat */}
      <Animated.View style={[s.panel, { transform: [{ translateX: Animated.add(slideAnim, swipeX) }] }]} {...panHandlers}>
        <LinearGradient colors={['#4a5668', '#37414f', '#232a35']} locations={[0, 0.35, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
        {/* Üst parlak mor accent — palette üzerine hafif ışık */}
        <LinearGradient
          colors={['rgba(167,139,250,0.12)', 'rgba(167,139,250,0.03)', 'transparent']}
          style={s.topGlow}
        />

        {/* Başlık */}
        <View style={s.header}>
          <View style={s.headerIcon}>
            <Ionicons name="shield-checkmark" size={14} color="#A78BFA" style={s.iconShadow} />
          </View>
          <Text style={s.headerTitle}>Moderasyon</Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={onClose} hitSlop={12} style={s.closeBtn}>
            <Ionicons name="close" size={16} color="rgba(255,255,255,0.4)" />
          </Pressable>
        </View>

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
                <ActivityIndicator color="#A78BFA" style={{ marginTop: 40 }} />
              ) : requests.length === 0 ? (
                <View style={s.empty}>
                  <View style={s.emptyIcon}>
                    <Ionicons name="checkmark-circle" size={28} color="rgba(167,139,250,0.25)" />
                  </View>
                  <Text style={s.emptyTitle}>Bekleyen istek yok</Text>
                  <Text style={s.emptySub}>Yeni katılım istekleri burada görünecek</Text>
                </View>
              ) : (
                requests.map((req) => {
                  const isProcessing = processingIds.has(req.id);
                  return (
                    <View key={req.id} style={s.row}>
                      <Image source={getAvatarSource(req.user?.avatar_url)} style={s.avatar} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.name} numberOfLines={1}>{req.user?.display_name || 'Kullanıcı'}</Text>
                      </View>
                      {isProcessing ? (
                        <ActivityIndicator size="small" color="#A78BFA" />
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

          {/* ═══ DAVET TAB ═══ */}
          {tab === 'invite' && (
            <>
              <View style={s.searchWrap}>
                <Ionicons name="search" size={14} color="rgba(255,255,255,0.3)" />
                <TextInput
                  style={s.searchInput}
                  placeholder="Kullanıcı ara..."
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  value={searchQuery}
                  onChangeText={handleSearch}
                  autoCapitalize="none"
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => { setSearchQuery(''); setSearchResults([]); }} hitSlop={8}>
                    <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.2)" />
                  </Pressable>
                )}
              </View>

              {searching ? (
                <ActivityIndicator color="#A78BFA" style={{ marginTop: 30 }} />
              ) : searchResults.length === 0 && searchQuery.length >= 2 ? (
                <View style={s.empty}>
                  <Ionicons name="search-outline" size={28} color="rgba(255,255,255,0.15)" />
                  <Text style={s.emptyTitle}>Sonuç bulunamadı</Text>
                </View>
              ) : searchResults.length === 0 && searchQuery.length < 2 ? (
                <View style={s.empty}>
                  <View style={s.emptyIcon}>
                    <Ionicons name="person-add-outline" size={28} color="rgba(167,139,250,0.25)" />
                  </View>
                  <Text style={s.emptyTitle}>Kullanıcı Davet Et</Text>
                  <Text style={s.emptySub}>Kullanıcı adını arayarak odana davet gönder</Text>
                </View>
              ) : (
                searchResults.map((user) => {
                  const isProcessing = processingIds.has(user.id);
                  return (
                    <View key={user.id} style={s.row}>
                      <Image source={getAvatarSource(user.avatar_url)} style={s.avatar} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.name} numberOfLines={1}>{user.display_name}</Text>
                        {user.username && <Text style={s.username}>@{user.username}</Text>}
                      </View>
                      {isProcessing ? (
                        <ActivityIndicator size="small" color="#A78BFA" />
                      ) : (
                        <Pressable style={s.inviteBtn} onPress={() => handleInvite(user)}>
                          <Ionicons name="person-add" size={12} color="#A78BFA" />
                          <Text style={s.inviteBtnText}>Davet</Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })
              )}
            </>
          )}

          {/* ═══ BANLILAR TAB ═══ */}
          {tab === 'bans' && (
            <>
              {loadingBans ? (
                <ActivityIndicator color="#EF4444" style={{ marginTop: 40 }} />
              ) : bannedUsers.length === 0 ? (
                <View style={s.empty}>
                  <View style={[s.emptyIcon, { backgroundColor: 'rgba(34,197,94,0.08)' }]}>
                    <Ionicons name="shield-checkmark" size={28} color="rgba(34,197,94,0.3)" />
                  </View>
                  <Text style={s.emptyTitle}>Banlı kullanıcı yok</Text>
                  <Text style={s.emptySub}>Oda temiz! 🎉</Text>
                </View>
              ) : (
                bannedUsers.map((ban) => {
                  const isPermanent = ban.ban_type === 'permanent';
                  const expiresAt = ban.expires_at ? new Date(ban.expires_at) : null;
                  const isExpired = expiresAt && expiresAt < new Date();
                  const remainingMin = expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 60000)) : 0;
                  const timeLabel = isPermanent ? 'Kalıcı' : isExpired ? 'Süresi dolmuş' : remainingMin > 60 ? `${Math.floor(remainingMin / 60)}sa ${remainingMin % 60}dk` : `${remainingMin}dk kaldı`;
                  const isProcessing = processingIds.has(ban.id);

                  return (
                    <View key={ban.id} style={s.row}>
                      <Image source={getAvatarSource(ban.user?.avatar_url)} style={s.avatar} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.name} numberOfLines={1}>{ban.user?.display_name || 'Kullanıcı'}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                          <View style={[s.banTypePill, isPermanent ? s.banPermanent : s.banTemp]}>
                            <Text style={[s.banTypeText, { color: isPermanent ? '#EF4444' : '#F59E0B' }]}>
                              {isPermanent ? '⛔ KALICI' : '⏳ GEÇİCİ'}
                            </Text>
                          </View>
                          <Text style={s.banTime}>{timeLabel}</Text>
                        </View>
                      </View>
                      {isProcessing ? (
                        <ActivityIndicator size="small" color="#14B8A6" />
                      ) : (
                        <Pressable style={s.unbanBtn} onPress={() => handleUnban(ban)}>
                          <Ionicons name="lock-open-outline" size={12} color="#14B8A6" />
                          <Text style={s.unbanText}>Kaldır</Text>
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
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent' },
  panel: {
    position: 'absolute', right: 0, top: 70, bottom: 80,
    width: DRAWER_W,
    borderTopLeftRadius: 18, borderBottomLeftRadius: 18,
    borderWidth: 1, borderRightWidth: 0,
    borderColor: '#95a1ae',
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: -2, height: 0 }, shadowOpacity: 0.2, shadowRadius: 8,
    elevation: 8,
  },
  topGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 120,
    borderTopLeftRadius: 22,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  headerIcon: {
    width: 28, height: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  iconShadow: { textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 3 },
  headerTitle: {
    fontSize: 15, fontWeight: '700', color: '#F1F5F9',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
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
 