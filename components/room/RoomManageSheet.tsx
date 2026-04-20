/**
 * SopranoChat â€” Oda Yönetim Drawer
 * â˜… Sağdan kayan panel â€” RoomChatDrawer stili.
 * Oda-içi RoomSettingsSheet'teki TÃœM ayarları içerir + takipçi listesi.
 * Aynı DB alanlarını kullanır → oda-içindeki ayarlarla otomatik senkron.
 *
 * Sekmeler: Genel | Konuşma | Moderasyon | Görsellik | Monetizasyon | Gelişmiş | Takipçiler
 * â†‘ RoomSettingsSheet ile birebir aynı yapı + Takipçiler â†‘
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput,
  Animated, Dimensions, ActivityIndicator, Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../constants/theme';
import { RoomService, getRoomLimits, type Room } from '../../services/database';
import { RoomFollowService } from '../../services/roomFollow';
import { ModerationService } from '../../services/moderation';
import { isTierAtLeast, TIER_DEFINITIONS } from '../../constants/tiers';
import StatusAvatar from '../StatusAvatar';
import { showToast } from '../Toast';
import { supabase } from '../../constants/supabase';
import { useRouter } from 'expo-router';
import type { SubscriptionTier } from '../../types';

const { width: W } = Dimensions.get('window');
const PANEL_W = W * 0.88;

type Follower = { id: string; display_name: string; avatar_url: string };

// â˜… Sekmeler â€” RoomSettingsSheet ile birebir aynı + Takipçiler
type TabId = 'general' | 'speaking' | 'moderation' | 'visual' | 'monetization' | 'advanced' | 'followers';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'general', label: 'Genel', icon: 'settings-outline' },
  { id: 'speaking', label: 'Konuşma', icon: 'mic-outline' },
  { id: 'moderation', label: 'Moderasyon', icon: 'shield-outline' },
  { id: 'visual', label: 'Görsellik', icon: 'color-palette-outline' },
  { id: 'monetization', label: 'Monetizasyon', icon: 'cash-outline' },
  { id: 'advanced', label: 'Gelişmiş', icon: 'rocket-outline' },
  { id: 'followers', label: 'Takipçiler', icon: 'heart-outline' },
];

// Tema tanımları â€” RoomSettingsSheet ile birebir aynı
const ROOM_THEMES: Record<string, { name: string; colors: [string, string] }> = {
  ocean: { name: 'Okyanus', colors: ['#0E4D6F', '#083344'] },
  sunset: { name: 'Gün Batımı', colors: ['#7F1D1D', '#4C0519'] },
  forest: { name: 'Orman', colors: ['#14532D', '#052E16'] },
  galaxy: { name: 'Galaksi', colors: ['#312E81', '#1E1B4B'] },
  aurora: { name: 'Aurora', colors: ['#134E4A', '#042F2E'] },
  cherry: { name: 'Kiraz', colors: ['#831843', '#500724'] },
  cyber: { name: 'Cyber', colors: ['#1E3A8A', '#172554'] },
  volcano: { name: 'Volkan', colors: ['#7C2D12', '#431407'] },
  midnight: { name: 'Gece', colors: ['#0C0A3E', '#1B1464'] },
  rose: { name: 'Gül', colors: ['#9F1239', '#881337'] },
  arctic: { name: 'Kutup', colors: ['#164E63', '#0E7490'] },
  amber: { name: 'Kehribar', colors: ['#78350F', '#92400E'] },
  slate: { name: 'Arduvaz', colors: ['#1E293B', '#334155'] },
};

interface Props {
  visible: boolean;
  room: Room | null;
  hostId: string;
  ownerTier: string;
  onClose: () => void;
  onWakeUp: (room: Room) => void;
  onDeleted: () => void;
}

export default function RoomManageSheet({ visible, room, hostId, ownerTier, onClose, onWakeUp, onDeleted }: Props) {
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(PANEL_W)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [activeTab, setActiveTab] = useState<TabId>('general');

  // Room state
  const [roomName, setRoomName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [welcomeMsg, setWelcomeMsg] = useState('');
  const [editingWelcome, setEditingWelcome] = useState(false);
  const [rules, setRules] = useState('');
  const [editingRules, setEditingRules] = useState(false);

  // Settings â€” Genel
  const [isLocked, setIsLocked] = useState(false);
  const [roomType, setRoomType] = useState<string>('open');
  const [roomPassword, setRoomPassword] = useState('');
  const [editingPassword, setEditingPassword] = useState(false);

  // Settings â€” Konuşma
  const [speakingMode, setSpeakingMode] = useState<string>('permission_only');

  // Settings â€” Moderasyon
  const [followersOnly, setFollowersOnly] = useState(false);
  const [slowMode, setSlowMode] = useState(0);
  const [roomLang, setRoomLang] = useState('tr');
  const [ageRestricted, setAgeRestricted] = useState(false);
  const [bannedUsers, setBannedUsers] = useState<any[]>([]);
  const [mutedUsers, setMutedUsers] = useState<any[]>([]);
  const [loadingModData, setLoadingModData] = useState(false);

  // Settings â€” Görsellik
  const [themeId, setThemeId] = useState<string | null>(null);
  const [musicTrack, setMusicTrack] = useState<string | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);

  // Settings â€” Monetizasyon
  const [donationsEnabled, setDonationsEnabled] = useState(false);
  const [entryFee, setEntryFee] = useState(0);

  // Followers
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [loadingFollowers, setLoadingFollowers] = useState(false);

  const tier = (ownerTier || 'Free') as SubscriptionTier;
  const can = (req: SubscriptionTier) => isTierAtLeast(tier, req);

  // â˜… Slide animasyonu â€” RoomChatDrawer ile aynı pattern
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
  // Sürükleyerek kapatma (sağa swipe)
  const panResponder = useRef(
    React.useMemo(() => {
      let startX = 0;
      return require('react-native').PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_: any, g: any) => g.dx > 10 && Math.abs(g.dy) < g.dx,
        onPanResponderGrant: () => { startX = (slideAnim as any)._value || 0; },
        onPanResponderMove: (_: any, g: any) => {
          const newX = Math.max(0, startX + g.dx);
          slideAnim.setValue(newX);
          fadeAnim.setValue(1 - (newX / PANEL_W) * 0.8);
        },
        onPanResponderRelease: (_: any, g: any) => {
          if (g.dx > 60 || g.vx > 0.5) {
            Animated.parallel([
              Animated.spring(slideAnim, { toValue: PANEL_W, useNativeDriver: true, damping: 18, stiffness: 200 }),
              Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
            ]).start(() => onClose());
          } else {
            Animated.parallel([
              Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 180 }),
              Animated.timing(fadeAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
            ]).start();
          }
        },
      });
    }, [])
  ).current;

  // Load data
  useEffect(() => {
    if (!visible || !room) return;
    setRoomName(room.name || '');
    const rs = (room.room_settings || {}) as any;
    setIsLocked(rs.is_locked || false);
    setFollowersOnly(rs.followers_only || false);
    setDonationsEnabled(rs.donations_enabled || false);
    setEntryFee(rs.entry_fee_sp || 0);
    setSlowMode(rs.slow_mode_seconds || 0);
    setSpeakingMode(rs.speaking_mode || 'permission_only');
    setRoomType(room.type || 'open');
    setRoomPassword(rs.room_password || '');
    setEditingPassword(false);
    setRoomLang(rs.room_language || 'tr');
    setAgeRestricted(rs.age_restricted || false);
    setThemeId((room as any).theme_id || null);
    setMusicTrack(rs.music_track || null);
    setBackgroundImage(rs.room_image_url || (room as any).room_image_url || null);
    setCoverImage(rs.cover_image_url || null);
    setWelcomeMsg(rs.welcome_message || '');
    setRules(typeof rs.rules === 'string' ? rs.rules : Array.isArray(rs.rules) ? rs.rules.join('\n') : '');
    setActiveTab('general');
    setEditingName(false);
    setEditingWelcome(false);
    setEditingRules(false);

    // Load followers
    setLoadingFollowers(true);
    Promise.all([
      RoomFollowService.getRoomFollowers(room.id),
      RoomFollowService.getFollowerCount(room.id),
    ]).then(([f, c]) => { setFollowers(f); setFollowerCount(c); })
      .finally(() => setLoadingFollowers(false));

    // â˜… Moderasyon verilerini de yükle (ilk açılışta)
    loadModerationData();
  }, [visible, room?.id]);

  // â˜… Moderasyon verilerini yükle (ban + mute listeleri)
  const loadModerationData = useCallback(async () => {
    if (!room) return;
    setLoadingModData(true);
    try {
      const [bans, mutes] = await Promise.all([
        ModerationService.getRoomBans(room.id),
        ModerationService.getRoomMutes(room.id),
      ]);
      setBannedUsers(bans);
      setMutedUsers(mutes);
    } catch (e) {
      if (__DEV__) console.warn('[RoomManageSheet] Mod data error:', e);
    } finally {
      setLoadingModData(false);
    }
  }, [room?.id]);

  // â˜… SYNC FIX: room prop değiştiğinde local state'i güncelle
  // (oda-içi kullanıcı ayar değiştirdiğinde realtime → myrooms → room prop güncellenir)
  useEffect(() => {
    if (!room) return;
    const rs = (room.room_settings || {}) as any;
    setRoomName(room.name || '');
    setIsLocked(rs.is_locked || false);
    setFollowersOnly(rs.followers_only || false);
    setDonationsEnabled(rs.donations_enabled || false);
    setEntryFee(rs.entry_fee_sp || 0);
    setSlowMode(rs.slow_mode_seconds || 0);
    setSpeakingMode(rs.speaking_mode || 'permission_only');
    setRoomType(room.type || 'open');
    setRoomPassword(rs.room_password || '');
    setRoomLang(rs.room_language || 'tr');
    setAgeRestricted(rs.age_restricted || false);
    setThemeId((room as any).theme_id || null);
    setMusicTrack(rs.music_track || null);
    setBackgroundImage(rs.room_image_url || (room as any).room_image_url || null);
    setCoverImage(rs.cover_image_url || null);
    setWelcomeMsg(rs.welcome_message || '');
    setRules(typeof rs.rules === 'string' ? rs.rules : Array.isArray(rs.rules) ? rs.rules.join('\n') : '');
  }, [room?.room_settings, room?.name, room?.type, (room as any)?.theme_id]);

  // â˜… Broadcast helper â€” oda-içi kullanıcılara anında yansıtmak için
  const broadcastSettingsChange = useCallback((payload: Record<string, any>) => {
    if (!room) return;
    // Fire-and-forget: geçici broadcast kanalı aç → gönder → kapat
    const ch = supabase.channel(`mod_action:${room.id}`);
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        ch.send({ type: 'broadcast', event: 'settings_changed', payload }).then(() => {
          setTimeout(() => { try { supabase.removeChannel(ch); } catch {} }, 1000);
        });
      }
    });
  }, [room?.id]);

  // â˜… DB güncelleme yardımcıları â€” artık broadcast ile senkron
  const updateRS = useCallback(async (field: string, value: any) => {
    if (!room || !hostId) return;
    try {
      await RoomService.updateSettings(room.id, hostId, { room_settings: { [field]: value } });
      // â˜… Oda-içi kullanıcılara anında yansıt
      broadcastSettingsChange({ room_settings: { [field]: value } });
    } catch (e: any) { showToast({ title: 'Hata', message: e.message || '', type: 'error' }); }
  }, [room, hostId, broadcastSettingsChange]);

  const handleRename = useCallback(async () => {
    if (!room || !roomName.trim() || roomName.trim() === room.name) { setEditingName(false); return; }
    try {
      await ModerationService.editRoomName(room.id, roomName.trim());
      broadcastSettingsChange({ name: roomName.trim() });
      showToast({ title: 'âœ…', type: 'success' });
    } catch { showToast({ title: 'Hata', type: 'error' }); setRoomName(room.name || ''); }
    setEditingName(false);
  }, [room, roomName, broadcastSettingsChange]);

  const handleDelete = useCallback(async () => {
    if (!room || !hostId) return;
    try { await RoomService.deleteRoom(room.id, hostId); showToast({ title: 'Oda Silindi', type: 'success' }); onDeleted(); onClose(); }
    catch (e: any) { showToast({ title: 'Hata', message: e.message || '', type: 'error' }); }
  }, [room, hostId, onDeleted, onClose]);

  const handleFreeze = useCallback(async () => {
    if (!room || !hostId) return;
    try {
      await RoomService.freezeRoom(room.id, hostId);
      showToast({ title: 'Oda Donduruldu', message: 'Odalarım sekmesinden tekrar aktifleştirebilirsin.', type: 'success' });
      onDeleted(); // refresh list
      onClose();
    } catch (e: any) { showToast({ title: 'Hata', message: e.message || '', type: 'error' }); }
  }, [room, hostId, onDeleted, onClose]);

  const handleBgImage = useCallback(async (imageUri: string | null) => {
    if (!room || !hostId) return;
    try {
      if (imageUri === 'default') {
        const ImagePicker = require('expo-image-picker');
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { showToast({ title: 'İzin Gerekli', type: 'warning' }); return; }
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [16, 9], quality: 0.7 });
        if (result.canceled) return;
        const { StorageService } = require('../../services/storage');
        const fileName = `room_bg/${room.id}_${Date.now()}.jpg`;
        const url = await StorageService.uploadFile('post-images', fileName, result.assets[0].uri);
        await RoomService.updateSettings(room.id, hostId, { room_settings: { room_image_url: url } });
        setBackgroundImage(url);
        showToast({ title: 'Arka Plan Güncellendi', type: 'success' });
      } else {
        await RoomService.updateSettings(room.id, hostId, { room_settings: { room_image_url: null } });
        setBackgroundImage(null);
        showToast({ title: 'Arka Plan Kaldırıldı', type: 'success' });
      }
    } catch (e: any) { showToast({ title: 'Hata', message: e.message || '', type: 'error' }); }
  }, [room, hostId]);

  const handleCoverImage = useCallback(async (imageUri: string | null) => {
    if (!room || !hostId) return;
    try {
      if (imageUri === 'pick') {
        const ImagePicker = require('expo-image-picker');
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
        if (result.canceled) return;
        const { StorageService } = require('../../services/storage');
        const fileName = `room_cover/${room.id}_${Date.now()}.jpg`;
        const url = await StorageService.uploadFile('post-images', fileName, result.assets[0].uri);
        await RoomService.updateSettings(room.id, hostId, { room_settings: { cover_image_url: url } });
        setCoverImage(url);
        showToast({ title: 'Banner Yüklendi', type: 'success' });
      } else {
        await RoomService.updateSettings(room.id, hostId, { room_settings: { cover_image_url: null } });
        setCoverImage(null);
        showToast({ title: 'Banner Kaldırıldı', type: 'success' });
      }
    } catch (e: any) { showToast({ title: 'Hata', message: e.message || '', type: 'error' }); }
  }, [room, hostId]);

  if (!visible || !room) return null;

  const isLive = room.is_live;

  // ���������������������������������������������������
  // GENEL â€” RoomSettingsSheet ile birebir aynı
  // ���������������������������������������������������
  const renderGeneral = () => (
    <View>
      {/* Oda İsmi â€” Free */}
      {editingName ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <TextInput style={p.nameInput} value={roomName} onChangeText={setRoomName} autoFocus maxLength={50} returnKeyType="done" onSubmitEditing={handleRename} />
          <Pressable style={p.saveBtn} onPress={handleRename}><Ionicons name="checkmark" size={14} color="#FFF" /></Pressable>
          <Pressable onPress={() => { setEditingName(false); setRoomName(room.name || ''); }}><Ionicons name="close" size={14} color="#64748B" /></Pressable>
        </View>
      ) : (
        <Row icon="create" bg="rgba(59,130,246,0.2)" label="Oda İsmi" desc={roomName} onPress={() => setEditingName(true)} right={<Ionicons name="pencil-outline" size={10} color="rgba(255,255,255,0.15)" />} />
      )}

      {/* Hoş Geldin Mesajı â€” Free */}
      {editingWelcome ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <TextInput style={[p.nameInput, { fontSize: 11 }]} value={welcomeMsg} onChangeText={setWelcomeMsg} autoFocus maxLength={120} returnKeyType="done"
            onSubmitEditing={() => { updateRS('welcome_message', welcomeMsg.trim()); setEditingWelcome(false); }} />
          <Pressable style={p.saveBtn} onPress={() => { updateRS('welcome_message', welcomeMsg.trim()); setEditingWelcome(false); }}><Ionicons name="checkmark" size={14} color="#FFF" /></Pressable>
          <Pressable onPress={() => setEditingWelcome(false)}><Ionicons name="close" size={14} color="#64748B" /></Pressable>
        </View>
      ) : (
        <Row icon="chatbubble-ellipses" bg="rgba(20,184,166,0.2)" label="Hoş Geldin Mesajı" desc={welcomeMsg || 'Ayarlanmadı'} onPress={() => setEditingWelcome(true)} right={<Ionicons name="pencil-outline" size={10} color="rgba(255,255,255,0.15)" />} />
      )}

      {/* Kurallar â€” Free */}
      {editingRules ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <TextInput style={[p.nameInput, { fontSize: 11, height: 50, textAlignVertical: 'top' }]} value={rules} onChangeText={setRules} autoFocus maxLength={300} multiline />
          <Pressable style={p.saveBtn} onPress={() => { updateRS('rules', rules.trim()); setEditingRules(false); }}><Ionicons name="checkmark" size={14} color="#FFF" /></Pressable>
          <Pressable onPress={() => setEditingRules(false)}><Ionicons name="close" size={14} color="#64748B" /></Pressable>
        </View>
      ) : (
        <Row icon="document-text" bg="rgba(245,158,11,0.2)" label="Oda Kuralları" desc={rules || 'Ayarlanmadı'} onPress={() => setEditingRules(true)} right={<Ionicons name="pencil-outline" size={10} color="rgba(255,255,255,0.15)" />} />
      )}

      {/* Oda Tipi â€” Plus+ */}
      {can('Plus') ? (
        <Row icon="globe" bg="rgba(59,130,246,0.2)" label={roomType === 'open' ? 'Herkese Açık' : roomType === 'closed' ? 'Şifreli Oda' : 'Davetiye ile'} desc="Oda erişim tipini değiştir"
          right={
            <View style={{ flexDirection: 'row', gap: 3 }}>
              {(['open', 'closed', 'invite'] as const).map(t => (
                <Pressable key={t} style={[p.pill, roomType === t && p.pillActive]} onPress={async () => {
                  setRoomType(t);
                  try {
                    await supabase.from('rooms').update({ type: t }).eq('id', room.id);
                    broadcastSettingsChange({ type: t });
                  } catch { showToast({ title: 'Hata', type: 'error' }); }
                }}>
                  <Text style={[p.pillText, roomType === t && p.pillTextActive]}>{t === 'open' ? 'Açık' : t === 'closed' ? 'Şifreli' : 'Davet'}</Text>
                </Pressable>
              ))}
            </View>
          }
        />
      ) : <LockedRow label="Şifreli Oda Oluşturma" tier="Plus" />}

      {/* Şifre — Plus+ (sadece roomType === 'closed') */}
      {roomType === 'closed' && can('Plus') && (
        editingPassword ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <TextInput style={[p.nameInput, { fontSize: 11 }]} value={roomPassword} onChangeText={setRoomPassword} autoFocus maxLength={20} returnKeyType="done" placeholder="Oda şifresi..." placeholderTextColor="#475569"
              onSubmitEditing={() => { updateRS('room_password', roomPassword.trim()); setEditingPassword(false); }} />
            <Pressable style={p.saveBtn} onPress={() => { updateRS('room_password', roomPassword.trim()); setEditingPassword(false); }}><Ionicons name="checkmark" size={14} color="#FFF" /></Pressable>
            <Pressable onPress={() => setEditingPassword(false)}><Ionicons name="close" size={14} color="#64748B" /></Pressable>
          </View>
        ) : (
          <Row icon="key" bg="rgba(245,158,11,0.2)" label="Oda Şifresi" desc={roomPassword || 'Ayarlanmadı'} onPress={() => setEditingPassword(true)} right={<Ionicons name="pencil-outline" size={10} color="rgba(255,255,255,0.15)" />} />
        )
      )}

      {/* Kilit â€” Plus+ */}
      {can('Plus') ? (
        <Row icon="lock-closed" bg="rgba(245,158,11,0.2)" label={isLocked ? 'Oda Kilitli' : 'Oda Açık'} desc={isLocked ? 'Yeni girişler engellendi' : 'Herkes katılabilir'}
          right={<Switch value={isLocked} onValueChange={(v) => { setIsLocked(v); RoomService.setRoomLock(room.id, v).then(() => broadcastSettingsChange({ room_settings: { is_locked: v } })).catch(() => {}); }} trackColor={{ false: 'rgba(255,255,255,0.08)', true: 'rgba(245,158,11,0.4)' }} thumbColor={isLocked ? '#F59E0B' : '#475569'} />} />
      ) : <LockedRow label="Oda Kilitleme" tier="Plus" />}

      {/* â˜… Eylem CTA'ları â€” RoomSettingsSheet ile birebir aynı gradient stili */}
      <View style={{ marginTop: 10, gap: 6 }}>
        {/* Odaya Git / Uyandır */}
        {isLive ? (
          <Pressable style={p.actionCta} onPress={() => { onClose(); router.push(`/room/${room.id}`); }}>
            <LinearGradient colors={['#14B8A6', '#0D9488', '#065F56']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={p.actionCtaGrad}>
              <View style={p.actionCtaIcon}><Ionicons name="enter-outline" size={20} color="#FFF" /></View>
              <View style={{ flex: 1 }}>
                <Text style={p.actionCtaTitle}>Odaya Git</Text>
                <Text style={p.actionCtaSub}>Canlı odana gir ve yönet</Text>
              </View>
            </LinearGradient>
          </Pressable>
        ) : (
          <Pressable style={p.actionCta} onPress={() => { onClose(); onWakeUp(room); }}>
            <LinearGradient colors={['#F59E0B', '#D97706', '#B45309']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={p.actionCtaGrad}>
              <View style={p.actionCtaIcon}><Ionicons name="sunny" size={20} color="#FFF" /></View>
              <View style={{ flex: 1 }}>
                <Text style={p.actionCtaTitle}>Uyandır</Text>
                <Text style={p.actionCtaSub}>Dondurulmuş odayı tekrar aktifleştir</Text>
              </View>
            </LinearGradient>
          </Pressable>
        )}

        {/* Odayı Dondur â€” Plus+ (sadece canlı odalar) */}
        {isLive && can('Plus') && (
          <Pressable style={p.actionCta} onPress={handleFreeze}>
            <LinearGradient colors={['#3B82F6', '#2563EB', '#1D4ED8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={p.actionCtaGrad}>
              <View style={p.actionCtaIcon}><Ionicons name="snow" size={20} color="#FFF" /></View>
              <View style={{ flex: 1 }}>
                <Text style={p.actionCtaTitle}>Odayı Dondur</Text>
                <Text style={p.actionCtaSub}>Oda dondurulur, dilediğinde tekrar aktifleştir</Text>
              </View>
            </LinearGradient>
          </Pressable>
        )}

        {/* Odayı Sil */}
        <Pressable style={p.actionCta} onPress={handleDelete}>
          <LinearGradient colors={['#EF4444', '#DC2626', '#B91C1C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={p.actionCtaGrad}>
            <View style={p.actionCtaIcon}><Ionicons name="trash" size={20} color="#FFF" /></View>
            <View style={{ flex: 1 }}>
              <Text style={p.actionCtaTitle}>Odayı Sil</Text>
              <Text style={p.actionCtaSub}>Oda kalıcı olarak silinir, geri alınamaz</Text>
            </View>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );

  // ���������������������������������������������������
  // KONUŞMA â€” RoomSettingsSheet ile birebir aynı
  // ���������������������������������������������������
  const renderSpeaking = () => (
    <View>
      {/* Konuşma Modu â€” Free (2 mod) / Pro (3 mod) */}
      <Row icon="mic-circle" bg="rgba(20,184,166,0.25)" label={speakingMode === 'free_for_all' ? 'Herkes Konuşabilir' : speakingMode === 'selected_only' ? 'Sadece Seçilmişler' : 'Sadece İzinli'} desc={speakingMode === 'free_for_all' ? 'Dinleyiciler doğrudan sahneye çıkabilir' : speakingMode === 'selected_only' ? 'Sadece owner tarafından seçilen kişiler' : 'Dinleyiciler el kaldırarak söz ister'}
        right={
          <View style={{ flexDirection: 'row', gap: 3 }}>
            {(['free_for_all', 'permission_only', 'selected_only'] as const).map(m => {
              const locked = m === 'selected_only' && !can('Pro');
              const labels: Record<string, string> = { free_for_all: 'Serbest', permission_only: 'İzinli', selected_only: 'Seçili' };
              return (
                <Pressable key={m} style={[p.pill, speakingMode === m && p.pillActive, locked && { opacity: 0.35 }]}
                  onPress={() => { if (locked) { showToast({ title: 'Pro+ ile açılır', type: 'info' }); return; } setSpeakingMode(m); updateRS('speaking_mode', m); }}>
                  <Text style={[p.pillText, speakingMode === m && p.pillTextActive]}>{labels[m]}</Text>
                </Pressable>
              );
            })}
          </View>
        }
      />

      {/* Sahne Düzeni â€” Plus+ locked */}
      {!can('Plus') && <LockedRow label="Sahne Düzeni (Kaç kişi konuşabilir)" tier="Plus" />}
    </View>
  );

  // ���������������������������������������������������
  // MODERASYON â€” RoomSettingsSheet ile birebir aynı
  // ���������������������������������������������������
  const renderModeration = () => (
    <View>
      {/* Slow Mode â€” Free */}
      <Row icon="time" bg="rgba(59,130,246,0.2)" label={slowMode ? `Slow Mode: ${slowMode}sn` : 'Slow Mode Kapalı'} desc="Chat mesaj aralığını sınırla"
        right={
          <View style={{ flexDirection: 'row', gap: 3 }}>
            {[0, 5, 15, 30].map(sec => (
              <Pressable key={sec} style={[p.pill, slowMode === sec && p.pillActive]} onPress={() => { setSlowMode(sec); updateRS('slow_mode_seconds', sec); }}>
                <Text style={[p.pillText, slowMode === sec && p.pillTextActive]}>{sec === 0 ? 'Off' : `${sec}s`}</Text>
              </Pressable>
            ))}
          </View>
        }
      />

      {/* Dil Filtresi â€” Plus+ */}
      {can('Plus') ? (
        <Row icon="globe" bg="rgba(192,192,192,0.2)" label={`Oda Dili: ${({ tr: 'Türkçe', en: 'English', de: 'Deutsch', ar: 'Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©' } as any)[roomLang] || roomLang}`} desc="Oda dil tercihini belirle"
          right={
            <View style={{ flexDirection: 'row', gap: 3 }}>
              {['tr', 'en', 'de', 'ar'].map(l => (
                <Pressable key={l} style={[p.pill, roomLang === l && p.pillActive]} onPress={() => { setRoomLang(l); updateRS('room_language', l); }}>
                  <Text style={[p.pillText, roomLang === l && p.pillTextActive]}>{({ tr: 'TR', en: 'EN', de: 'DE', ar: 'AR' } as any)[l]}</Text>
                </Pressable>
              ))}
            </View>
          }
        />
      ) : <LockedRow label="Dil Filtresi" tier="Plus" />}

      {/* Yaş Filtresi (+18) â€” Plus+ */}
      {can('Plus') ? (
        <Row icon="warning" bg={ageRestricted ? 'rgba(239,68,68,0.2)' : 'rgba(192,192,192,0.2)'} label={ageRestricted ? '+18 İçerik Aktif' : 'Yaş Sınırı Yok'} desc={ageRestricted ? 'Sadece 18 yaş üstü katılabilir' : 'Tüm yaş gruplarına açık'}
          right={<Switch value={ageRestricted} onValueChange={(v) => { setAgeRestricted(v); updateRS('age_restricted', v); }} trackColor={{ false: 'rgba(255,255,255,0.08)', true: 'rgba(239,68,68,0.4)' }} thumbColor={ageRestricted ? '#EF4444' : '#475569'} />} />
      ) : <LockedRow label="Yaş Filtresi (+18)" tier="Plus" />}

      {/* Takipçilere Özel â€” Pro+ */}
      {can('Pro') ? (
        <Row icon="people" bg="rgba(212,175,55,0.2)" label={followersOnly ? 'Takipçilere Özel' : 'Herkese Açık'} desc={followersOnly ? 'Sadece takipçiler katılabilir' : 'Herkes odaya katılabilir'}
          right={<Switch value={followersOnly} onValueChange={(v) => { setFollowersOnly(v); updateRS('followers_only', v); }} trackColor={{ false: 'rgba(255,255,255,0.08)', true: 'rgba(212,175,55,0.4)' }} thumbColor={followersOnly ? '#D4AF37' : '#475569'} />} />
      ) : <LockedRow label="Sadece Takipçiler Girebilir" tier="Pro" />}

      {/* Tümünü Sustur â€” Pro locked */}
      {!can('Pro') && <LockedRow label="Tümünü Sustur (Cooldown ile)" tier="Pro" />}

      {/* Gelişmiş Ban â€” Pro locked */}
      {!can('Pro') && <LockedRow label="Gelişmiş Ban Seçenekleri" tier="Pro" />}

      {/* ��� BANLI KULLANICILAR ��� */}
      <View style={{ marginTop: 12 }}>
        <Text style={p.subTitle}>Banlı Kullanıcılar ({bannedUsers.length})</Text>
        {loadingModData ? (
          <ActivityIndicator color="#EF4444" style={{ marginVertical: 12 }} />
        ) : bannedUsers.length === 0 ? (
          <View style={p.emptyCard}>
            <Ionicons name="shield-checkmark" size={20} color="rgba(34,197,94,0.3)" />
            <Text style={p.emptyText}>Banlı kullanıcı yok</Text>
          </View>
        ) : (
          bannedUsers.map((ban: any) => {
            const isPerm = ban.ban_type === 'permanent' || ban.duration === 'permanent';
            const expiresAt = ban.expires_at ? new Date(ban.expires_at) : null;
            const isExpired = expiresAt && expiresAt < new Date();
            const remainMin = expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 60000)) : 0;
            const timeLabel = isPerm ? 'Kalıcı' : isExpired ? 'Süresi dolmuş' : remainMin > 60 ? `${Math.floor(remainMin / 60)}sa ${remainMin % 60}dk` : `${remainMin}dk kaldı`;
            return (
              <View key={ban.id} style={p.modRow}>
                <StatusAvatar uri={ban.user?.avatar_url} size={28} />
                <View style={{ flex: 1 }}>
                  <Text style={p.rowLabel} numberOfLines={1}>{ban.user?.display_name || 'Kullanıcı'}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <View style={{ paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, backgroundColor: isPerm ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)' }}>
                      <Text style={{ fontSize: 7, fontWeight: '700', color: isPerm ? '#EF4444' : '#F59E0B' }}>{isPerm ? 'KALICI' : 'GEÇİCİ'}</Text>
                    </View>
                    <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>{timeLabel}</Text>
                  </View>
                </View>
                <Pressable style={p.unbanBtn} onPress={async () => {
                  setBannedUsers(prev => prev.filter(b => b.id !== ban.id));
                  try {
                    await ModerationService.unbanFromRoom(room.id, ban.user_id || ban.user?.id);
                  } catch { setBannedUsers(prev => [...prev, ban]); showToast({ title: 'Hata', type: 'error' }); }
                }}>
                  <Ionicons name="lock-open-outline" size={10} color="#14B8A6" />
                  <Text style={{ fontSize: 9, fontWeight: '700', color: '#14B8A6' }}>Kaldır</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </View>

      {/* ��� SUSTURULAN KULLANICILAR ��� */}
      <View style={{ marginTop: 12 }}>
        <Text style={p.subTitle}>Susturulan Kullanıcılar ({mutedUsers.length})</Text>
        {loadingModData ? null : mutedUsers.length === 0 ? (
          <View style={p.emptyCard}>
            <Ionicons name="volume-high" size={20} color="rgba(34,197,94,0.3)" />
            <Text style={p.emptyText}>Susturulan kullanıcı yok</Text>
          </View>
        ) : (
          mutedUsers.map((mute: any) => {
            const expiresAt = mute.expires_at ? new Date(mute.expires_at) : null;
            const remainMin = expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 60000)) : 0;
            const timeLabel = expiresAt ? (remainMin > 60 ? `${Math.floor(remainMin / 60)}sa ${remainMin % 60}dk` : `${remainMin}dk kaldı`) : 'Süresiz';
            return (
              <View key={mute.id} style={p.modRow}>
                <StatusAvatar uri={mute.user?.avatar_url} size={28} />
                <View style={{ flex: 1 }}>
                  <Text style={p.rowLabel} numberOfLines={1}>{mute.user?.display_name || 'Kullanıcı'}</Text>
                  <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>{timeLabel}{mute.reason ? ` - ${mute.reason}` : ''}</Text>
                </View>
                <Pressable style={p.unbanBtn} onPress={async () => {
                  setMutedUsers(prev => prev.filter(m => m.id !== mute.id));
                  try {
                    await ModerationService.unmuteInRoom(room.id, mute.muted_user_id || mute.user?.id);
                  } catch { setMutedUsers(prev => [...prev, mute]); showToast({ title: 'Hata', type: 'error' }); }
                }}>
                  <Ionicons name="volume-high-outline" size={10} color="#14B8A6" />
                  <Text style={{ fontSize: 9, fontWeight: '700', color: '#14B8A6' }}>Aç</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </View>
    </View>
  );

  // ���������������������������������������������������
  // GÖRSELLİK â€” RoomSettingsSheet ile birebir aynı
  // ���������������������������������������������������
  const renderVisual = () => (
    <View>
      {/* Tema â€” Plus+ */}
      {can('Plus') ? (
        <View style={{ marginBottom: 8 }}>
          <Text style={p.subTitle}>Oda Teması</Text>
          <View style={p.themeGrid}>
            <Pressable style={[p.themeCircle, !themeId && p.themeCircleActive]} onPress={() => { setThemeId(null); RoomService.setRoomTheme(room.id, hostId, null).then(() => broadcastSettingsChange({ theme_id: null })).catch(() => {}); }}>
              <LinearGradient colors={['#0E1420', '#070B14']} style={p.themeGrad}><Ionicons name="moon-outline" size={12} color="rgba(255,255,255,0.35)" /></LinearGradient>
            </Pressable>
            {Object.entries(ROOM_THEMES).map(([id, t]) => (
              <Pressable key={id} style={[p.themeCircle, themeId === id && p.themeCircleActive]} onPress={() => { setThemeId(id); RoomService.setRoomTheme(room.id, hostId, id).then(() => broadcastSettingsChange({ theme_id: id })).catch(() => {}); }}>
                <LinearGradient colors={t.colors} style={p.themeGrad}><Text style={{ fontSize: 7, fontWeight: '700', color: '#FFF' }}>{t.name.slice(0, 2)}</Text></LinearGradient>
              </Pressable>
            ))}
          </View>
        </View>
      ) : <LockedRow label="Oda Teması" tier="Plus" />}

      {/* Arka Plan Resmi â€” Plus+ */}
      {can('Plus') ? (
        <Row icon="image" bg="rgba(139,92,246,0.2)" label="Arka Plan Resmi" desc={backgroundImage ? 'Arka plan ayarlandı' : 'Üyelik statüsüne göre'}
          right={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {backgroundImage ? (
                <Pressable onPress={() => handleBgImage(null)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}>
                  <Ionicons name="trash-outline" size={12} color="#EF4444" /><Text style={{ fontSize: 10, fontWeight: '600', color: '#EF4444' }}>Kaldır</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => handleBgImage('default')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(139,92,246,0.1)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.2)' }}>
                  <Ionicons name="add" size={12} color="#A78BFA" /><Text style={{ fontSize: 10, fontWeight: '600', color: '#A78BFA' }}>Seç</Text>
                </Pressable>
              )}
            </View>
          }
        />
      ) : <LockedRow label="Arka Plan Resmi" tier="Plus" />}

      {/* Oda Kapak Görseli â€” Pro+ */}
      {can('Pro') ? (
        <Row icon="albums" bg="rgba(255,215,0,0.2)" label="Oda Kapak Görseli" desc={coverImage ? 'Banner ayarlandı' : 'Keşfet akışında görünen banner'}
          right={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {coverImage ? (
                <Pressable onPress={() => handleCoverImage(null)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}>
                  <Ionicons name="trash-outline" size={12} color="#EF4444" /><Text style={{ fontSize: 10, fontWeight: '600', color: '#EF4444' }}>Kaldır</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => handleCoverImage('pick')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(255,215,0,0.1)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)' }}>
                  <Ionicons name="add" size={12} color="#FFD700" /><Text style={{ fontSize: 10, fontWeight: '600', color: '#FFD700' }}>Seç</Text>
                </Pressable>
              )}
            </View>
          }
        />
      ) : <LockedRow label="Oda Kapak Görseli (Banner)" tier="Pro" />}

      {/* Müzik â€” Pro+ */}
      {can('Pro') ? (
        <Row icon="musical-notes" bg="rgba(255,215,0,0.2)" label={musicTrack ? `Müzik: ${({ lofi: 'Lofi', ambient: 'Ambient', jazz: 'Jazz' } as any)[musicTrack] || musicTrack}` : 'Oda Müziği Kapalı'} desc="Arka planda ambient ses döngüsü"
          right={
            <View style={{ flexDirection: 'row', gap: 3 }}>
              {([null, 'lofi', 'ambient', 'jazz'] as const).map(t => (
                <Pressable key={t || 'off'} style={[p.pill, musicTrack === t && p.pillActive]} onPress={() => { setMusicTrack(t); updateRS('music_track', t); }}>
                  <Text style={[p.pillText, musicTrack === t && p.pillTextActive]}>{t === null ? 'Off' : t === 'lofi' ? 'Lo' : t === 'ambient' ? 'Am' : 'Jz'}</Text>
                </Pressable>
              ))}
            </View>
          }
        />
      ) : <LockedRow label="Oda Arka Plan Müziği" tier="Pro" />}
    </View>
  );

  // ���������������������������������������������������
  // MONETİZASYON â€” RoomSettingsSheet ile birebir aynı
  // ���������������������������������������������������
  const renderMonetization = () => (
    <View>
      {/* Bağış â€” Pro+ */}
      {/* Bağış â€” Pro */}
      {can('Pro') ? (
        <Row icon="heart" bg="rgba(239,68,68,0.2)" label={donationsEnabled ? 'Bağış Açık' : 'Bağış Kapalı'} desc="Dinleyicilerden SP bağışı kabul et"
          right={<Switch value={donationsEnabled} onValueChange={(v) => { setDonationsEnabled(v); updateRS('donations_enabled', v); }} trackColor={{ false: 'rgba(255,255,255,0.08)', true: 'rgba(239,68,68,0.4)' }} thumbColor={donationsEnabled ? '#EF4444' : '#475569'} />} />
      ) : <LockedRow label="Bağış (Tip) Aç/Kapat" tier="Pro" />}

      {/* Giriş Ãœcreti â€” Pro */}
      {can('Pro') ? (
        <Row icon="cash" bg="rgba(212,175,55,0.2)" label={entryFee ? `Giriş: ${entryFee} SP` : 'Giriş Ücretsiz'} desc="SP cinsinden oda giriş ücreti"
          right={
            <View style={{ flexDirection: 'row', gap: 3 }}>
              {[0, 25, 50, 100, 250, 500].map(fee => (
                <Pressable key={fee} style={[p.pill, entryFee === fee && p.pillActive]} onPress={() => { setEntryFee(fee); updateRS('entry_fee_sp', fee); }}>
                  <Text style={[p.pillText, entryFee === fee && p.pillTextActive]}>{fee === 0 ? 'Free' : `${fee}`}</Text>
                </Pressable>
              ))}
            </View>
          }
        />
      ) : <LockedRow label="Giriş Ücreti Belirleme (SP)" tier="Pro" />}

      {/* Oda Boost â€” Pro */}
      {can('Pro') && isLive ? (
        <Row icon="rocket" bg="rgba(255,107,53,0.2)" label="Boost" desc="Odaya gir ve + den boost"
          onPress={() => { onClose(); router.push(`/room/${room.id}`); }}
          right={<Ionicons name="chevron-forward" size={12} color="#FF6B35" />} />
      ) : !can('Pro') ? <LockedRow label="Boost" tier="Pro" /> : null}
    </View>
  );

  // � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � 
  // GELİÅžMİÅž â€” RoomSettingsSheet ile birebir aynı
  // � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � � 
  const renderAdvanced = () => {
    const limits = getRoomLimits(tier as any);
    return (
    <View>
      <Row icon="people" bg="rgba(20,184,166,0.2)" label="Sahne Kapasitesi" desc={`Maks ${limits.maxSpeakers} konusmaci`}
        right={<View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(20,184,166,0.12)' }}><Text style={{ fontSize: 8, fontWeight: '700', color: '#14B8A6' }}>{limits.maxSpeakers}</Text></View>} />
      <Row icon="videocam" bg="rgba(139,92,246,0.2)" label="Kamera Limiti" desc={limits.maxCameras > 0 ? `Maks ${limits.maxCameras} kamera` : 'Yok'}
        right={<View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(139,92,246,0.12)' }}><Text style={{ fontSize: 8, fontWeight: '700', color: '#A78BFA' }}>{limits.maxCameras || '-'}</Text></View>} />
      <Row icon="time" bg="rgba(245,158,11,0.2)" label="Oda Suresi" desc={limits.durationHours === 0 ? 'Suresiz' : `Maks ${limits.durationHours} saat`}
        right={<View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(245,158,11,0.12)' }}><Text style={{ fontSize: 8, fontWeight: '700', color: '#F59E0B' }}>{limits.durationHours === 0 ? '\u221e' : `${limits.durationHours}sa`}</Text></View>} />
      {!can('Pro') && <LockedRow label="13 Kisilik Sahne" tier="Pro" />}
    </View>
    );
  };
  // ���������������������������������������������������
  // TAKİPÇİLER
  // ���������������������������������������������������
  const renderFollowers = () => (
    <View>
      <Text style={p.subTitle}>{followerCount} Takipçi</Text>
      {loadingFollowers ? (
        <ActivityIndicator color={Colors.accentTeal} style={{ marginVertical: 16 }} />
      ) : followers.length > 0 ? (
        <View style={p.followerGrid}>
          {followers.map(f => (
            <Pressable key={f.id} style={p.followerCard} onPress={() => { onClose(); router.push(`/user/${f.id}` as any); }}>
              <StatusAvatar uri={f.avatar_url} size={36} />
              <Text style={p.followerName} numberOfLines={1}>{f.display_name}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={p.emptyCard}>
          <Ionicons name="heart-outline" size={24} color="#475569" />
          <Text style={p.emptyText}>Henüz takipçi yok</Text>
        </View>
      )}
    </View>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'general': return renderGeneral();
      case 'speaking': return renderSpeaking();
      case 'moderation': return renderModeration();
      case 'visual': return renderVisual();
      case 'monetization': return renderMonetization();
      case 'advanced': return renderAdvanced();
      case 'followers': return renderFollowers();
    }
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[p.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Panel â€” sağdan kayar */}
      <Animated.View style={[p.panel, { transform: [{ translateX: slideAnim }] }]}>
        <LinearGradient colors={['#4a5668', '#37414f', '#232a35']} locations={[0, 0.35, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
        {/* Drag Handle - sadece buradan surukle */}
        <View {...panResponder.panHandlers} style={p.dragHandle}>
          <View style={p.dragPill} />
        </View>
        <View style={p.header}>
          <View style={p.headerLeft}>
            <StatusAvatar uri={(room as any).host?.avatar_url} size={30} tier={(room as any).host?.subscription_tier} />
            <View style={{ flex: 1 }}>
              <Text style={p.headerTitle} numberOfLines={1}>{roomName || room.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {isLive ? (
                  <View style={p.liveBadge}><View style={p.liveDot} /><Text style={p.liveText}>Canlı</Text></View>
                ) : (
                  <Text style={{ fontSize: 9, color: '#94A3B8' }}>â„ï¸ Dondurulmuş</Text>
                )}
                <View style={p.followerBadge}><Ionicons name="heart" size={8} color="#EF4444" /><Text style={p.followerBadgeText}>{followerCount}</Text></View>
              </View>
            </View>
          </View>
        </View>

        {/* Tab Bar */}
        <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4, paddingHorizontal: 10 }} style={{ maxHeight: 34, marginBottom: 6 }}>
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <Pressable key={tab.id} style={[p.tab, active && p.tabActive]} onPress={() => {
                setActiveTab(tab.id);
                // â˜… Moderasyon sekmesine geçildiğinde verileri tazele
                if (tab.id === 'moderation') loadModerationData();
              }}>
                <Ionicons name={tab.icon as any} size={11} color={active ? Colors.accentTeal : '#475569'} />
                <Text style={[p.tabText, active && p.tabTextActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Content */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 30 }}>
          {renderContent()}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

// â˜… Küçük yardımcı bileşenler
function Row({ icon, bg, label, desc, right, onPress }: { icon: string; bg: string; label: string; desc?: string; right: React.ReactNode; onPress?: () => void }) {
  const Container = onPress ? Pressable : View;
  return (
    <Container style={p.row} onPress={onPress as any}>
      <View style={p.rowIcon}><Ionicons name={icon as any} size={14} color={bg} style={p.iconShadow} /></View>
      <View style={{ flex: 1 }}><Text style={p.rowLabel}>{label}</Text>{desc ? <Text style={p.rowDesc} numberOfLines={1}>{desc}</Text> : null}</View>
      {right}
    </Container>
  );
}

function LockedRow({ label, tier }: { label: string; tier: string }) {
  const tierDef = TIER_DEFINITIONS[tier as SubscriptionTier];
  return (
    <Pressable style={[p.row, { opacity: 0.35 }]} onPress={() => showToast({ title: `${tier}+ ile açılır`, message: `"${label}" özelliği ${tier} ve üzeri üyeliklerde kullanılabilir.`, type: 'info' })}>
      <View style={p.rowIcon}><Ionicons name="lock-closed" size={14} color={tierDef?.color || '#94A3B8'} style={p.iconShadow} /></View>
      <View style={{ flex: 1 }}><Text style={p.rowLabel}>{label}</Text><Text style={p.rowDesc}>{tier}+ ile açılır</Text></View>
      {tierDef && (
        <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: `${tierDef.color}12`, borderWidth: 1, borderColor: `${tierDef.color}30` }}>
          <Text style={{ fontSize: 8, fontWeight: '700', color: tierDef.color }}>{tierDef.emoji} {tier}</Text>
        </View>
      )}
    </Pressable>
  );
}

const p = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  panel: {
    position: 'absolute', right: 0, top: 50, bottom: 0,
    width: PANEL_W,
    borderTopLeftRadius: 18, borderBottomLeftRadius: 18,
    borderWidth: 1, borderRightWidth: 0, borderColor: Colors.cardBorder,
    overflow: 'hidden',
  },
  dragHandle: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(149,161,174,0.06)',
  },
  dragPill: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(148,163,184,0.35)',
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(149,161,174,0.1)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },

  headerTitle: { fontSize: 14, fontWeight: '800', color: '#F1F5F9', ...Shadows.text },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#EF4444' },
  liveText: { fontSize: 8, fontWeight: '700', color: '#EF4444' },
  followerBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(239,68,68,0.08)' },
  followerBadgeText: { fontSize: 8, fontWeight: '700', color: '#EF4444' },

  // Tabs
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  tabActive: { backgroundColor: 'rgba(115,194,189,0.12)' },
  tabText: { fontSize: 9, fontWeight: '700', color: '#64748B' },
  tabTextActive: { color: Colors.accentTeal },

  // Row
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(149,161,174,0.06)' },
  rowIcon: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  iconShadow: { textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 3 },
  rowLabel: { fontSize: 12, fontWeight: '700', color: '#F1F5F9', ...Shadows.textLight },
  rowDesc: { fontSize: 9, color: '#94A3B8', marginTop: 1 },

  // Pill
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(149,161,174,0.12)' },
  pillActive: { backgroundColor: 'rgba(115,194,189,0.15)', borderColor: 'rgba(115,194,189,0.35)' },
  pillText: { fontSize: 9, fontWeight: '700', color: '#64748B' },
  pillTextActive: { color: Colors.accentTeal },

  // Name input
  nameInput: { flex: 1, fontSize: 13, fontWeight: '600', color: '#F1F5F9', borderBottomWidth: 1, borderBottomColor: Colors.accentTeal, paddingVertical: 4 },
  saveBtn: { width: 26, height: 26, borderRadius: 8, backgroundColor: Colors.accentTeal, alignItems: 'center', justifyContent: 'center' },

  // â˜… Action CTA â€” RoomSettingsSheet ile birebir aynı gradient stili
  actionCta: {
    borderRadius: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 5,
  },
  actionCtaGrad: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 12, gap: 10,
  },
  actionCtaIcon: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  actionCtaTitle: {
    fontSize: 13, fontWeight: '800', color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  actionCtaSub: {
    fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 1,
  },

  // Sub title
  subTitle: { fontSize: 11, fontWeight: '700', color: '#F1F5F9', marginBottom: 8, ...Shadows.text },

  // Theme
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  themeCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: 'rgba(149,161,174,0.15)', overflow: 'hidden' },
  themeCircleActive: { borderColor: Colors.accentTeal, borderWidth: 2.5 },
  themeGrad: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' } as any,

  // Followers
  followerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  followerCard: { alignItems: 'center', width: 56 },

  followerName: { fontSize: 9, fontWeight: '600', color: '#94A3B8', textAlign: 'center' },
  emptyCard: { padding: 20, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 11, color: '#64748B' },

  // Moderation â€” ban/mute rows
  modRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, paddingHorizontal: 4, borderRadius: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)',
  },

  unbanBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8,
    backgroundColor: 'rgba(20,184,166,0.08)',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.18)',
  },
});

