/**
 * SopranoChat — Host Erişim Paneli
 * Kapalı oda isteklerini onaylama + Davetli odaya kişi davet etme
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, FlatList,
  Image, TextInput, ActivityIndicator, Alert,
  PanResponder, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { RoomAccessService } from '../../services/roomAccess';
import { ProfileService, type Profile } from '../../services/database';
import { ModerationService } from '../../services/moderation';
import { getAvatarSource } from '../../constants/avatars';
import { showToast } from '../Toast';

interface Props {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  roomType: string; // 'closed' | 'invite'
  hostId: string;
}

export default function HostAccessPanel({ visible, onClose, roomId, roomType, hostId }: Props) {
  const [tab, setTab] = useState<'requests' | 'invite' | 'bans'>(roomType === 'invite' ? 'invite' : 'requests');
  const [requests, setRequests] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [bannedUsers, setBannedUsers] = useState<any[]>([]);
  const [loadingBans, setLoadingBans] = useState(false);

  // İstekleri yükle
  useEffect(() => {
    if (visible && roomType === 'closed') {
      loadRequests();
    }
    if (visible) {
      loadBans();
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

  const handleUnban = async (ban: any) => {
    try {
      await ModerationService.unbanFromRoom(roomId, ban.user_id);
      setBannedUsers(prev => prev.filter(b => b.id !== ban.id));
      showToast({ title: '✅ Ban Kaldırıldı', message: `${ban.user?.display_name || 'Kullanıcı'} artık odaya girebilir.`, type: 'success' });
    } catch {
      showToast({ title: 'Hata', message: 'Ban kaldırılamadı', type: 'error' });
    }
  };

  const handleAccept = async (req: any) => {
    await RoomAccessService.approveRequest(req.id, hostId);
    setRequests(prev => prev.filter(r => r.id !== req.id));
    showToast({ title: '✅ Kabul Edildi', message: `${req.user?.display_name || 'Kullanıcı'} artık odaya girebilir.`, type: 'success' });
  };

  const handleReject = async (req: any) => {
    await RoomAccessService.rejectRequest(req.id, hostId);
    setRequests(prev => prev.filter(r => r.id !== req.id));
    showToast({ title: '❌ Reddedildi', type: 'info' });
  };

  // Kullanıcı ara (davet için)
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await ProfileService.search(query, 15);
      setSearchResults(results);
    } catch {}
    setSearching(false);
  }, []);

  const handleInvite = async (user: Profile) => {
    const result = await RoomAccessService.inviteUser(roomId, user.id, hostId);
    if (result.success) {
      showToast({ title: '📨 Davet Gönderildi', message: `${user.display_name} odaya davet edildi.`, type: 'success' });
      // Aramadan kaldır
      setSearchResults(prev => prev.filter(u => u.id !== user.id));
    } else {
      showToast({ title: 'Hata', message: result.error || 'Davet gönderilemedi.', type: 'error' });
    }
  };

  // ★ Swipe-to-dismiss
  const swipeY = React.useRef(new Animated.Value(0)).current;
  const panR = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
      onPanResponderMove: (_, g) => { if (g.dy > 0) swipeY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100 || g.vy > 0.5) { onClose(); swipeY.setValue(0); }
        else { Animated.spring(swipeY, { toValue: 0, useNativeDriver: true, tension: 100, friction: 12 }).start(); }
      },
    })
  ).current;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Animated.View style={[s.sheet, { transform: [{ translateY: swipeY }] }]} {...panR.panHandlers}>
        <Pressable onPress={e => e.stopPropagation()} style={{ flex: 1 }}>
          {/* Handle */}
          <View style={s.handle} />
          <Text style={s.title}>
            {tab === 'bans' ? '⛔ Banlı Kullanıcılar' : roomType === 'invite' ? '📨 Davet Yönetimi' : '🔒 Katılım İstekleri'}
          </Text>

          {/* Tab bar — her zaman göster (istekler/davet/banlılar) */}
          <View style={s.tabBar}>
            {roomType === 'closed' && (
              <Pressable style={[s.tab, tab === 'requests' && s.tabActive]} onPress={() => setTab('requests')}>
                <Text style={[s.tabText, tab === 'requests' && s.tabTextActive]}>
                  İstekler {requests.length > 0 ? `(${requests.length})` : ''}
                </Text>
              </Pressable>
            )}
            <Pressable style={[s.tab, tab === 'invite' && s.tabActive]} onPress={() => setTab('invite')}>
              <Text style={[s.tabText, tab === 'invite' && s.tabTextActive]}>Davet Et</Text>
            </Pressable>
            <Pressable style={[s.tab, tab === 'bans' && s.tabActive]} onPress={() => { setTab('bans'); loadBans(); }}>
              <Text style={[s.tabText, tab === 'bans' && s.tabTextActive]}>
                Banlılar {bannedUsers.length > 0 ? `(${bannedUsers.length})` : ''}
              </Text>
            </Pressable>
          </View>

          {/* İstekler tab'ı */}
          {tab === 'requests' && roomType === 'closed' && (
            <View style={{ flex: 1, minHeight: 200 }}>
              {loadingRequests ? (
                <ActivityIndicator color="#14B8A6" style={{ marginTop: 30 }} />
              ) : requests.length === 0 ? (
                <View style={s.emptyState}>
                  <Ionicons name="checkmark-circle" size={40} color="rgba(255,255,255,0.15)" />
                  <Text style={s.emptyText}>Bekleyen istek yok</Text>
                </View>
              ) : (
                <FlatList
                  data={requests}
                  keyExtractor={item => item.id}
                  renderItem={({ item }) => (
                    <View style={s.requestItem}>
                      <Image source={getAvatarSource(item.user?.avatar_url)} style={s.avatar} />
                      <Text style={s.userName} numberOfLines={1}>{item.user?.display_name || 'Kullanıcı'}</Text>
                      <Pressable style={s.acceptBtn} onPress={() => handleAccept(item)}>
                        <Ionicons name="checkmark" size={18} color="#fff" />
                      </Pressable>
                      <Pressable style={s.rejectBtn} onPress={() => handleReject(item)}>
                        <Ionicons name="close" size={18} color="#EF4444" />
                      </Pressable>
                    </View>
                  )}
                />
              )}
            </View>
          )}

          {/* Davet tab'ı */}
          {tab === 'invite' && (
            <View style={{ flex: 1, minHeight: 200 }}>
              <View style={s.searchWrap}>
                <Ionicons name="search" size={16} color="rgba(255,255,255,0.4)" />
                <TextInput
                  style={s.searchInput}
                  placeholder="Kullanıcı ara..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={searchQuery}
                  onChangeText={handleSearch}
                />
              </View>

              {searching ? (
                <ActivityIndicator color="#14B8A6" style={{ marginTop: 20 }} />
              ) : searchResults.length === 0 && searchQuery.length >= 2 ? (
                <Text style={s.noResult}>Sonuç bulunamadı</Text>
              ) : (
                <FlatList
                  data={searchResults}
                  keyExtractor={item => item.id}
                  renderItem={({ item }) => (
                    <View style={s.requestItem}>
                      <Image source={getAvatarSource(item.avatar_url)} style={s.avatar} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.userName} numberOfLines={1}>{item.display_name}</Text>
                        {item.username && <Text style={s.usernameText}>@{item.username}</Text>}
                      </View>
                      <Pressable style={s.inviteBtn} onPress={() => handleInvite(item)}>
                        <Text style={s.inviteBtnText}>Davet Et</Text>
                      </Pressable>
                    </View>
                  )}
                />
              )}
            </View>
          )}

          {/* Banlılar tab'ı */}
          {tab === 'bans' && (
            <View style={{ flex: 1, minHeight: 200 }}>
              {loadingBans ? (
                <ActivityIndicator color="#EF4444" style={{ marginTop: 30 }} />
              ) : bannedUsers.length === 0 ? (
                <View style={s.emptyState}>
                  <Ionicons name="shield-checkmark" size={40} color="rgba(255,255,255,0.15)" />
                  <Text style={s.emptyText}>Banlı kullanıcı yok</Text>
                </View>
              ) : (
                <FlatList
                  data={bannedUsers}
                  keyExtractor={item => item.id}
                  renderItem={({ item }) => {
                    const isPermanent = item.ban_type === 'permanent';
                    const expiresAt = item.expires_at ? new Date(item.expires_at) : null;
                    const isExpired = expiresAt && expiresAt < new Date();
                    const remainingMin = expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 60000)) : 0;
                    const timeLabel = isPermanent ? 'Kalıcı' : isExpired ? 'Süresi dolmuş' : remainingMin > 60 ? `${Math.floor(remainingMin / 60)}sa ${remainingMin % 60}dk` : `${remainingMin}dk kaldı`;
                    return (
                      <View style={s.requestItem}>
                        <Image source={getAvatarSource(item.user?.avatar_url)} style={s.avatar} />
                        <View style={{ flex: 1 }}>
                          <Text style={s.userName} numberOfLines={1}>{item.user?.display_name || 'Kullanıcı'}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: isPermanent ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)' }}>
                              <Text style={{ fontSize: 9, fontWeight: '700', color: isPermanent ? '#EF4444' : '#F59E0B' }}>{isPermanent ? '⛔ KALICI' : '⏳ GEÇİCİ'}</Text>
                            </View>
                            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{timeLabel}</Text>
                          </View>
                        </View>
                        <Pressable
                          style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: 'rgba(20,184,166,0.12)', borderWidth: 1, borderColor: 'rgba(20,184,166,0.25)' }}
                          onPress={() => handleUnban(item)}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#14B8A6' }}>Ban Kaldır</Text>
                        </Pressable>
                      </View>
                    );
                  }}
                />
              )}
            </View>
          )}
        </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#2D3740',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: 40,
    maxHeight: '70%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center', marginTop: 12, marginBottom: 16,
  },
  title: {
    fontSize: 18, fontWeight: '700', color: '#EAEDF2',
    marginBottom: 16, textAlign: 'center',
  },
  tabBar: {
    flexDirection: 'row', borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 3, marginBottom: 16,
  },
  tab: {
    flex: 1, paddingVertical: 8, borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: 'rgba(20,184,166,0.2)' },
  tabText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  tabTextActive: { color: '#14B8A6' },
  emptyState: {
    alignItems: 'center', paddingVertical: 40, gap: 10,
  },
  emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.4)' },
  requestItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, gap: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  userName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#EAEDF2' },
  usernameText: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 },
  acceptBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(20,184,166,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  rejectBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(239,68,68,0.1)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
  },
  inviteBtn: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, backgroundColor: 'rgba(20,184,166,0.15)',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.3)',
  },
  inviteBtnText: { fontSize: 12, fontWeight: '600', color: '#14B8A6' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, paddingHorizontal: 12, marginBottom: 12,
  },
  searchInput: {
    flex: 1, paddingVertical: 10, fontSize: 14, color: '#EAEDF2',
  },
  noResult: {
    textAlign: 'center', color: 'rgba(255,255,255,0.3)',
    fontSize: 13, marginTop: 20,
  },
});
