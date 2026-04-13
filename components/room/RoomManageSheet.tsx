/**
 * SopranoChat Ã¢â‚¬â€ Oda YÃ¶netim Drawer
 * Ã¢Ëœâ€¦ SaÄŸdan kayan panel Ã¢â‚¬â€ RoomChatDrawer stili.
 * Oda-iÃ§i RoomSettingsSheet'teki TÃƒÅ“M ayarlarÄ± iÃ§erir + takipÃ§i listesi.
 * AynÄ± DB alanlarÄ±nÄ± kullanÄ±r â†’ oda-iÃ§indeki ayarlarla otomatik senkron.
 *
 * Sekmeler: Genel | KonuÅŸma | Moderasyon | GÃ¶rsellik | Monetizasyon | GeliÅŸmiÅŸ | TakipÃ§iler
 * Ã¢â€ â€˜ RoomSettingsSheet ile birebir aynÄ± yapÄ± + TakipÃ§iler Ã¢â€ â€˜
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput,
  Animated, Dimensions, Image, ActivityIndicator, Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../constants/theme';
import { RoomService, type Room } from '../../services/database';
import { RoomFollowService } from '../../services/roomFollow';
import { ModerationService } from '../../services/moderation';
import { isTierAtLeast, TIER_DEFINITIONS } from '../../constants/tiers';
import { getAvatarSource } from '../../constants/avatars';
import { showToast } from '../Toast';
import { supabase } from '../../constants/supabase';
import { useRouter } from 'expo-router';
import type { SubscriptionTier } from '../../types';

const { width: W } = Dimensions.get('window');
const PANEL_W = W * 0.88;

type Follower = { id: string; display_name: string; avatar_url: string };

// Ã¢Ëœâ€¦ Sekmeler Ã¢â‚¬â€ RoomSettingsSheet ile birebir aynÄ± + TakipÃ§iler
type TabId = 'general' | 'speaking' | 'moderation' | 'visual' | 'monetization' | 'advanced' | 'followers';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'general', label: 'Genel', icon: 'settings-outline' },
  { id: 'speaking', label: 'KonuÅŸma', icon: 'mic-outline' },
  { id: 'moderation', label: 'Moderasyon', icon: 'shield-outline' },
  { id: 'visual', label: 'GÃ¶rsellik', icon: 'color-palette-outline' },
  { id: 'monetization', label: 'Monetizasyon', icon: 'cash-outline' },
  { id: 'advanced', label: 'GeliÅŸmiÅŸ', icon: 'rocket-outline' },
  { id: 'followers', label: 'TakipÃ§iler', icon: 'heart-outline' },
];

// Tema tanÄ±mlarÄ± Ã¢â‚¬â€ RoomSettingsSheet ile birebir aynÄ±
const ROOM_THEMES: Record<string, { name: string; colors: [string, string] }> = {
  ocean: { name: 'Okyanus', colors: ['#0E4D6F', '#083344'] },
  sunset: { name: 'GÃ¼n BatÄ±mÄ±', colors: ['#7F1D1D', '#4C0519'] },
  forest: { name: 'Orman', colors: ['#14532D', '#052E16'] },
  galaxy: { name: 'Galaksi', colors: ['#312E81', '#1E1B4B'] },
  aurora: { name: 'Aurora', colors: ['#134E4A', '#042F2E'] },
  cherry: { name: 'Kiraz', colors: ['#831843', '#500724'] },
  cyber: { name: 'Cyber', colors: ['#1E3A8A', '#172554'] },
  volcano: { name: 'Volkan', colors: ['#7C2D12', '#431407'] },
  midnight: { name: 'Gece', colors: ['#0C0A3E', '#1B1464'] },
  rose: { name: 'GÃ¼l', colors: ['#9F1239', '#881337'] },
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

  // Settings Ã¢â‚¬â€ Genel
  const [isLocked, setIsLocked] = useState(false);
  const [roomType, setRoomType] = useState<string>('open');

  // Settings Ã¢â‚¬â€ KonuÅŸma
  const [speakingMode, setSpeakingMode] = useState<string>('permission_only');

  // Settings Ã¢â‚¬â€ Moderasyon
  const [followersOnly, setFollowersOnly] = useState(false);
  const [slowMode, setSlowMode] = useState(0);
  const [roomLang, setRoomLang] = useState('tr');
  const [ageRestricted, setAgeRestricted] = useState(false);
  const [bannedUsers, setBannedUsers] = useState<any[]>([]);
  const [mutedUsers, setMutedUsers] = useState<any[]>([]);
  const [loadingModData, setLoadingModData] = useState(false);

  // Settings Ã¢â‚¬â€ GÃ¶rsellik
  const [themeId, setThemeId] = useState<string | null>(null);
  const [musicTrack, setMusicTrack] = useState<string | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);

  // Settings Ã¢â‚¬â€ Monetizasyon
  const [donationsEnabled, setDonationsEnabled] = useState(false);
  const [entryFee, setEntryFee] = useState(0);

  // Followers
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [loadingFollowers, setLoadingFollowers] = useState(false);

  const tier = (ownerTier || 'Free') as SubscriptionTier;
  const can = (req: SubscriptionTier) => isTierAtLeast(tier, req);

  // Ã¢Ëœâ€¦ Slide animasyonu Ã¢â‚¬â€ RoomChatDrawer ile aynÄ± pattern
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

    // Ã¢Ëœâ€¦ Moderasyon verilerini de yÃ¼kle (ilk aÃ§Ä±lÄ±ÅŸta)
    loadModerationData();
  }, [visible, room?.id]);

  // Ã¢Ëœâ€¦ Moderasyon verilerini yÃ¼kle (ban + mute listeleri)
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

  // Ã¢Ëœâ€¦ SYNC FIX: room prop deÄŸiÅŸtiÄŸinde local state'i gÃ¼ncelle
  // (oda-iÃ§i kullanÄ±cÄ± ayar deÄŸiÅŸtirdiÄŸinde realtime â†’ myrooms â†’ room prop gÃ¼ncellenir)
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
    setRoomLang(rs.room_language || 'tr');
    setAgeRestricted(rs.age_restricted || false);
    setThemeId((room as any).theme_id || null);
    setMusicTrack(rs.music_track || null);
    setBackgroundImage(rs.room_image_url || (room as any).room_image_url || null);
    setCoverImage(rs.cover_image_url || null);
    setWelcomeMsg(rs.welcome_message || '');
    setRules(typeof rs.rules === 'string' ? rs.rules : Array.isArray(rs.rules) ? rs.rules.join('\n') : '');
  }, [room?.room_settings, room?.name, room?.type, (room as any)?.theme_id]);

  // Ã¢Ëœâ€¦ Broadcast helper Ã¢â‚¬â€ oda-iÃ§i kullanÄ±cÄ±lara anÄ±nda yansÄ±tmak iÃ§in
  const broadcastSettingsChange = useCallback((payload: Record<string, any>) => {
    if (!room) return;
    // Fire-and-forget: geÃ§ici broadcast kanalÄ± aÃ§ â†’ gÃ¶nder â†’ kapat
    const ch = supabase.channel(`mod_action:${room.id}`);
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        ch.send({ type: 'broadcast', event: 'settings_changed', payload }).then(() => {
          setTimeout(() => { try { supabase.removeChannel(ch); } catch {} }, 1000);
        });
      }
    });
  }, [room?.id]);

  // Ã¢Ëœâ€¦ DB gÃ¼ncelleme yardÄ±mcÄ±larÄ± Ã¢â‚¬â€ artÄ±k broadcast ile senkron
  const updateRS = useCallback(async (field: string, value: any) => {
    if (!room || !hostId) return;
    try {
      await RoomService.updateSettings(room.id, hostId, { room_settings: { [field]: value } });
      // Ã¢Ëœâ€¦ Oda-iÃ§i kullanÄ±cÄ±lara anÄ±nda yansÄ±t
      broadcastSettingsChange({ room_settings: { [field]: value } });
    } catch (e: any) { showToast({ title: 'Hata', message: e.message || '', type: 'error' }); }
  }, [room, hostId, broadcastSettingsChange]);

  const handleRename = useCallback(async () => {
    if (!room || !roomName.trim() || roomName.trim() === room.name) { setEditingName(false); return; }
    try {
      await ModerationService.editRoomName(room.id, roomName.trim());
      broadcastSettingsChange({ name: roomName.trim() });
      showToast({ title: 'Ã¢Å“â€¦', type: 'success' });
    } catch { showToast({ title: 'Hata', type: 'error' }); setRoomName(room.name || ''); }
    setEditingName(false);
  }, [room, roomName, broadcastSettingsChange]);

  const handleDelete = useCallback(async () => {
    if (!room || !hostId) return;
    try { await RoomService.deleteRoom(room.id, hostId); showToast({ title: 'ÄŸÅ¸â€”â€˜Ã¯Â¸Â Silindi', type: 'success' }); onDeleted(); onClose(); }
    catch (e: any) { showToast({ title: 'Hata', message: e.message || '', type: 'error' }); }
  }, [room, hostId, onDeleted, onClose]);

  const handleFreeze = useCallback(async () => {
    if (!room || !hostId) return;
    try {
      await RoomService.freezeRoom(room.id, hostId);
      showToast({ title: 'Ã¢Ââ€Ã¯Â¸Â Oda Donduruldu', message: 'OdalarÄ±m sekmesinden tekrar aktifleÅŸtirebilirsin.', type: 'success' });
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
        if (!perm.granted) { showToast({ title: 'Ä°zin Gerekli', type: 'warning' }); return; }
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [16, 9], quality: 0.7 });
        if (result.canceled) return;
        const { StorageService } = require('../../services/storage');
        const fileName = `room_bg/${room.id}_${Date.now()}.jpg`;
        const url = await StorageService.uploadFile('post-images', fileName, result.assets[0].uri);
        await RoomService.updateSettings(room.id, hostId, { room_settings: { room_image_url: url } });
        setBackgroundImage(url);
        showToast({ title: 'ÄŸÅ¸â€“Â¼Ã¯Â¸Â Arka Plan GÃ¼ncellendi', type: 'success' });
      } else {
        await RoomService.updateSettings(room.id, hostId, { room_settings: { room_image_url: null } });
        setBackgroundImage(null);
        showToast({ title: 'Arka Plan KaldÄ±rÄ±ldÄ±', type: 'success' });
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
        showToast({ title: 'ÄŸÅ¸â€“Â¼Ã¯Â¸Â Banner YÃ¼klendi', type: 'success' });
      } else {
        await RoomService.updateSettings(room.id, hostId, { room_settings: { cover_image_url: null } });
        setCoverImage(null);
        showToast({ title: 'Banner KaldÄ±rÄ±ldÄ±', type: 'success' });
      }
    } catch (e: any) { showToast({ title: 'Hata', message: e.message || '', type: 'error' }); }
  }, [room, hostId]);

  if (!visible || !room) return null;

  const isLive = room.is_live;

  // â•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Â
  // GENEL Ã¢â‚¬â€ RoomSettingsSheet ile birebir aynÄ±
  // â•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Â
  const renderGeneral = () => (
    <View>
      {/* Oda Ä°smi Ã¢â‚¬â€ Free */}
      {editingName ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <TextInput style={p.nameInput} value={roomName} onChangeText={setRoomName} autoFocus maxLength={50} returnKeyType="done" onSubmitEditing={handleRename} />
          <Pressable style={p.saveBtn} onPress={handleRename}><Ionicons name="checkmark" size={14} color="#FFF" /></Pressable>
          <Pressable onPress={() => { setEditingName(false); setRoomName(room.name || ''); }}><Ionicons name="close" size={14} color="#64748B" /></Pressable>
        </View>
      ) : (
        <Row icon="create" bg="rgba(59,130,246,0.2)" label="Oda Ä°smi" desc={roomName} right={<Pressable onPress={() => setEditingName(true)}><Ionicons name="chevron-forward" size={14} color="#475569" /></Pressable>} />
      )}

      {/* HoÅŸ Geldin MesajÄ± Ã¢â‚¬â€ Free */}
      {editingWelcome ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <TextInput style={[p.nameInput, { fontSize: 11 }]} value={welcomeMsg} onChangeText={setWelcomeMsg} autoFocus maxLength={120} returnKeyType="done"
            onSubmitEditing={() => { updateRS('welcome_message', welcomeMsg.trim()); setEditingWelcome(false); }} />
          <Pressable style={p.saveBtn} onPress={() => { updateRS('welcome_message', welcomeMsg.trim()); setEditingWelcome(false); }}><Ionicons name="checkmark" size={14} color="#FFF" /></Pressable>
          <Pressable onPress={() => setEditingWelcome(false)}><Ionicons name="close" size={14} color="#64748B" /></Pressable>
        </View>
      ) : (
        <Row icon="chatbubble-ellipses" bg="rgba(20,184,166,0.2)" label="HoÅŸ Geldin MesajÄ±" desc={welcomeMsg || 'AyarlanmadÄ±'} right={<Pressable onPress={() => setEditingWelcome(true)}><Ionicons name="chevron-forward" size={14} color="#475569" /></Pressable>} />
      )}

      {/* Kurallar Ã¢â‚¬â€ Free */}
      {editingRules ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <TextInput style={[p.nameInput, { fontSize: 11, height: 50, textAlignVertical: 'top' }]} value={rules} onChangeText={setRules} autoFocus maxLength={300} multiline />
          <Pressable style={p.saveBtn} onPress={() => { updateRS('rules', rules.trim()); setEditingRules(false); }}><Ionicons name="checkmark" size={14} color="#FFF" /></Pressable>
          <Pressable onPress={() => setEditingRules(false)}><Ionicons name="close" size={14} color="#64748B" /></Pressable>
        </View>
      ) : (
        <Row icon="document-text" bg="rgba(245,158,11,0.2)" label="Oda KurallarÄ±" desc={rules || 'AyarlanmadÄ±'} right={<Pressable onPress={() => setEditingRules(true)}><Ionicons name="chevron-forward" size={14} color="#475569" /></Pressable>} />
      )}

      {/* Oda Tipi Ã¢â‚¬â€ Plus+ */}
      {can('Plus') ? (
        <Row icon="globe" bg="rgba(59,130,246,0.2)" label={roomType === 'open' ? 'Herkese AÃ§Ä±k' : roomType === 'closed' ? 'Åifreli Oda' : 'Davetiye ile'} desc="Oda eriÅŸim tipini deÄŸiÅŸtir"
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
                  <Text style={[p.pillText, roomType === t && p.pillTextActive]}>{t === 'open' ? 'AÃ§Ä±k' : t === 'closed' ? 'Åifreli' : 'Davet'}</Text>
                </Pressable>
              ))}
            </View>
          }
        />
      ) : <LockedRow label="Åifreli Oda OluÅŸturma" tier="Plus" />}

      {/* Kilit Ã¢â‚¬â€ Plus+ */}
      {can('Plus') ? (
        <Row icon="lock-closed" bg="rgba(245,158,11,0.2)" label={isLocked ? 'Oda Kilitli' : 'Oda AÃ§Ä±k'} desc={isLocked ? 'Yeni giriÅŸler engellendi' : 'Herkes katÄ±labilir'}
          right={<Switch value={isLocked} onValueChange={(v) => { setIsLocked(v); RoomService.setRoomLock(room.id, v).then(() => broadcastSettingsChange({ room_settings: { is_locked: v } })).catch(() => {}); }} trackColor={{ false: 'rgba(255,255,255,0.08)', true: 'rgba(245,158,11,0.4)' }} thumbColor={isLocked ? '#F59E0B' : '#475569'} />} />
      ) : <LockedRow label="Oda Kilitleme" tier="Plus" />}

      {/* Ã¢Ëœâ€¦ Eylem CTA'larÄ± Ã¢â‚¬â€ RoomSettingsSheet ile birebir aynÄ± gradient stili */}
      <View style={{ marginTop: 10, gap: 6 }}>
        {/* Odaya Git / UyandÄ±r */}
        {isLive ? (
          <Pressable style={p.actionCta} onPress={() => { onClose(); router.push(`/room/${room.id}`); }}>
            <LinearGradient colors={['#14B8A6', '#0D9488', '#065F56']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={p.actionCtaGrad}>
              <View style={p.actionCtaIcon}><Ionicons name="enter-outline" size={20} color="#FFF" /></View>
              <View style={{ flex: 1 }}>
                <Text style={p.actionCtaTitle}>Odaya Git</Text>
                <Text style={p.actionCtaSub}>CanlÄ± odana gir ve yÃ¶net</Text>
              </View>
            </LinearGradient>
          </Pressable>
        ) : (
          <Pressable style={p.actionCta} onPress={() => { onClose(); onWakeUp(room); }}>
            <LinearGradient colors={['#F59E0B', '#D97706', '#B45309']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={p.actionCtaGrad}>
              <View style={p.actionCtaIcon}><Ionicons name="sunny" size={20} color="#FFF" /></View>
              <View style={{ flex: 1 }}>
                <Text style={p.actionCtaTitle}>UyandÄ±r</Text>
                <Text style={p.actionCtaSub}>DondurulmuÅŸ odayÄ± tekrar aktifleÅŸtir</Text>
              </View>
            </LinearGradient>
          </Pressable>
        )}

        {/* OdayÄ± Dondur Ã¢â‚¬â€ Plus+ (sadece canlÄ± odalar) */}
        {isLive && can('Plus') && (
          <Pressable style={p.actionCta} onPress={handleFreeze}>
            <LinearGradient colors={['#3B82F6', '#2563EB', '#1D4ED8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={p.actionCtaGrad}>
              <View style={p.actionCtaIcon}><Ionicons name="snow" size={20} color="#FFF" /></View>
              <View style={{ flex: 1 }}>
                <Text style={p.actionCtaTitle}>OdayÄ± Dondur</Text>
                <Text style={p.actionCtaSub}>Oda dondurulur, dilediÄŸinde tekrar aktifleÅŸtir</Text>
              </View>
            </LinearGradient>
          </Pressable>
        )}

        {/* OdayÄ± Sil */}
        <Pressable style={p.actionCta} onPress={handleDelete}>
          <LinearGradient colors={['#EF4444', '#DC2626', '#B91C1C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={p.actionCtaGrad}>
            <View style={p.actionCtaIcon}><Ionicons name="trash" size={20} color="#FFF" /></View>
            <View style={{ flex: 1 }}>
              <Text style={p.actionCtaTitle}>OdayÄ± Sil</Text>
              <Text style={p.actionCtaSub}>Oda kalÄ±cÄ± olarak silinir, geri alÄ±namaz</Text>
            </View>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );

  // â•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Â
  // KONUÅMA Ã¢â‚¬â€ RoomSettingsSheet ile birebir aynÄ±
  // â•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Â
  const renderSpeaking = () => (
    <View>
      {/* KonuÅŸma Modu Ã¢â‚¬â€ Free (2 mod) / Pro (3 mod) */}
      <Row icon="mic-circle" bg="rgba(20,184,166,0.25)" label={speakingMode === 'free_for_all' ? 'Herkes KonuÅŸabilir' : speakingMode === 'selected_only' ? 'Sadece SeÃ§ilmiÅŸler' : 'Sadece Ä°zinli'} desc={speakingMode === 'free_for_all' ? 'Dinleyiciler doÄŸrudan sahneye Ã§Ä±kabilir' : speakingMode === 'selected_only' ? 'Sadece owner tarafÄ±ndan seÃ§ilen kiÅŸiler' : 'Dinleyiciler el kaldÄ±rarak sÃ¶z ister'}
        right={
          <View style={{ flexDirection: 'row', gap: 3 }}>
            {(['free_for_all', 'permission_only', 'selected_only'] as const).map(m => {
              const locked = m === 'selected_only' && !can('Pro');
              const labels: Record<string, string> = { free_for_all: 'Serbest', permission_only: 'Ä°zinli', selected_only: 'SeÃ§ili' };
              return (
                <Pressable key={m} style={[p.pill, speakingMode === m && p.pillActive, locked && { opacity: 0.35 }]}
                  onPress={() => { if (locked) { showToast({ title: 'ğŸ”’ Pro+ ile aÃ§Ä±lÄ±r', type: 'info' }); return; } setSpeakingMode(m); updateRS('speaking_mode', m); }}>
                  <Text style={[p.pillText, speakingMode === m && p.pillTextActive]}>{locked ? 'ÄŸÅ¸â€â€™' : ''}{labels[m]}</Text>
                </Pressable>
              );
            })}
          </View>
        }
      />

      {/* Sahne DÃ¼zeni Ã¢â‚¬â€ Plus+ locked */}
      {!can('Plus') && <LockedRow label="Sahne DÃ¼zeni (KaÃ§ kiÅŸi konuÅŸabilir)" tier="Plus" />}
    </View>
  );

  // â•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Â
  // MODERASYON Ã¢â‚¬â€ RoomSettingsSheet ile birebir aynÄ±
  // â•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Â
  const renderModeration = () => (
    <View>
      {/* Slow Mode Ã¢â‚¬â€ Free */}
      <Row icon="time" bg="rgba(59,130,246,0.2)" label={slowMode ? `Slow Mode: ${slowMode}sn` : 'Slow Mode KapalÄ±'} desc="Chat mesaj aralÄ±ÄŸÄ±nÄ± sÄ±nÄ±rla"
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

      {/* Dil Filtresi Ã¢â‚¬â€ Plus+ */}
      {can('Plus') ? (
        <Row icon="globe" bg="rgba(192,192,192,0.2)" label={`Oda Dili: ${({ tr: 'TÃ¼rkÃ§e', en: 'English', de: 'Deutsch', ar: 'Ã˜Â§Ã™â€Ã˜Â¹Ã˜Â±Ã˜Â¨Ã™Å Ã˜Â©' } as any)[roomLang] || roomLang}`} desc="Oda dil tercihini belirle"
          right={
            <View style={{ flexDirection: 'row', gap: 3 }}>
              {['tr', 'en', 'de', 'ar'].map(l => (
                <Pressable key={l} style={[p.pill, roomLang === l && p.pillActive]} onPress={() => { setRoomLang(l); updateRS('room_language', l); }}>
                  <Text style={[p.pillText, roomLang === l && p.pillTextActive]}>{({ tr: 'ÄŸÅ¸â€¡Â¹ÄŸÅ¸â€¡Â·', en: 'ÄŸÅ¸â€¡Â¬ÄŸÅ¸â€¡Â§', de: 'ÄŸÅ¸â€¡Â©ÄŸÅ¸â€¡Âª', ar: 'ÄŸÅ¸â€¡Â¸ÄŸÅ¸â€¡Â¦' } as any)[l]}</Text>
                </Pressable>
              ))}
            </View>
          }
        />
      ) : <LockedRow label="Dil Filtresi" tier="Plus" />}

      {/* YaÅŸ Filtresi (+18) Ã¢â‚¬â€ Plus+ */}
      {can('Plus') ? (
        <Row icon="warning" bg={ageRestricted ? 'rgba(239,68,68,0.2)' : 'rgba(192,192,192,0.2)'} label={ageRestricted ? '+18 Ä°Ã§erik Aktif' : 'YaÅŸ SÄ±nÄ±rÄ± Yok'} desc={ageRestricted ? 'Sadece 18 yaÅŸ Ã¼stÃ¼ katÄ±labilir' : 'TÃ¼m yaÅŸ gruplarÄ±na aÃ§Ä±k'}
          right={<Switch value={ageRestricted} onValueChange={(v) => { setAgeRestricted(v); updateRS('age_restricted', v); }} trackColor={{ false: 'rgba(255,255,255,0.08)', true: 'rgba(239,68,68,0.4)' }} thumbColor={ageRestricted ? '#EF4444' : '#475569'} />} />
      ) : <LockedRow label="YaÅŸ Filtresi (+18)" tier="Plus" />}

      {/* TakipÃ§ilere Ã–zel Ã¢â‚¬â€ Pro+ */}
      {can('Pro') ? (
        <Row icon="people" bg="rgba(212,175,55,0.2)" label={followersOnly ? 'TakipÃ§ilere Ã–zel' : 'Herkese AÃ§Ä±k'} desc={followersOnly ? 'Sadece takipÃ§iler katÄ±labilir' : 'Herkes odaya katÄ±labilir'}
          right={<Switch value={followersOnly} onValueChange={(v) => { setFollowersOnly(v); updateRS('followers_only', v); }} trackColor={{ false: 'rgba(255,255,255,0.08)', true: 'rgba(212,175,55,0.4)' }} thumbColor={followersOnly ? '#D4AF37' : '#475569'} />} />
      ) : <LockedRow label="Sadece TakipÃ§iler Girebilir" tier="Pro" />}

      {/* TÃ¼mÃ¼nÃ¼ Sustur Ã¢â‚¬â€ Pro locked */}
      {!can('Pro') && <LockedRow label="TÃ¼mÃ¼nÃ¼ Sustur (Cooldown ile)" tier="Pro" />}

      {/* GeliÅŸmiÅŸ Ban Ã¢â‚¬â€ Pro locked */}
      {!can('Pro') && <LockedRow label="GeliÅŸmiÅŸ Ban SeÃ§enekleri" tier="Pro" />}

      {/* â•Ââ•Ââ•Â BANLI KULLANICILAR â•Ââ•Ââ•Â */}
      <View style={{ marginTop: 12 }}>
        <Text style={p.subTitle}>ÄŸÅ¸Å¡Â« BanlÄ± KullanÄ±cÄ±lar ({bannedUsers.length})</Text>
        {loadingModData ? (
          <ActivityIndicator color="#EF4444" style={{ marginVertical: 12 }} />
        ) : bannedUsers.length === 0 ? (
          <View style={p.emptyCard}>
            <Ionicons name="shield-checkmark" size={20} color="rgba(34,197,94,0.3)" />
            <Text style={p.emptyText}>BanlÄ± kullanÄ±cÄ± yok ÄŸÅ¸Ââ€°</Text>
          </View>
        ) : (
          bannedUsers.map((ban: any) => {
            const isPerm = ban.ban_type === 'permanent' || ban.duration === 'permanent';
            const expiresAt = ban.expires_at ? new Date(ban.expires_at) : null;
            const isExpired = expiresAt && expiresAt < new Date();
            const remainMin = expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 60000)) : 0;
            const timeLabel = isPerm ? 'KalÄ±cÄ±' : isExpired ? 'SÃ¼resi dolmuÅŸ' : remainMin > 60 ? `${Math.floor(remainMin / 60)}sa ${remainMin % 60}dk` : `${remainMin}dk kaldÄ±`;
            return (
              <View key={ban.id} style={p.modRow}>
                <Image source={getAvatarSource(ban.user?.avatar_url)} style={p.modAvatar} />
                <View style={{ flex: 1 }}>
                  <Text style={p.rowLabel} numberOfLines={1}>{ban.user?.display_name || 'KullanÄ±cÄ±'}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <View style={{ paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, backgroundColor: isPerm ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)' }}>
                      <Text style={{ fontSize: 7, fontWeight: '700', color: isPerm ? '#EF4444' : '#F59E0B' }}>{isPerm ? 'Ã¢â€ºâ€ KALICI' : 'Ã¢ÂÂ³ GEÃ‡Ä°CÄ°'}</Text>
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
                  <Text style={{ fontSize: 9, fontWeight: '700', color: '#14B8A6' }}>KaldÄ±r</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </View>

      {/* â•Ââ•Ââ•Â SUSTURULAN KULLANICILAR â•Ââ•Ââ•Â */}
      <View style={{ marginTop: 12 }}>
        <Text style={p.subTitle}>ğŸ”‡ Susturulan KullanÄ±cÄ±lar ({mutedUsers.length})</Text>
        {loadingModData ? null : mutedUsers.length === 0 ? (
          <View style={p.emptyCard}>
            <Ionicons name="volume-high" size={20} color="rgba(34,197,94,0.3)" />
            <Text style={p.emptyText}>Susturulan kullanÄ±cÄ± yok</Text>
          </View>
        ) : (
          mutedUsers.map((mute: any) => {
            const expiresAt = mute.expires_at ? new Date(mute.expires_at) : null;
            const remainMin = expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 60000)) : 0;
            const timeLabel = expiresAt ? (remainMin > 60 ? `${Math.floor(remainMin / 60)}sa ${remainMin % 60}dk` : `${remainMin}dk kaldÄ±`) : 'SÃ¼resiz';
            return (
              <View key={mute.id} style={p.modRow}>
                <Image source={getAvatarSource(mute.user?.avatar_url)} style={p.modAvatar} />
                <View style={{ flex: 1 }}>
                  <Text style={p.rowLabel} numberOfLines={1}>{mute.user?.display_name || 'KullanÄ±cÄ±'}</Text>
                  <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>Ã¢ÂÂ³ {timeLabel}{mute.reason ? ` â€¢ ${mute.reason}` : ''}</Text>
                </View>
                <Pressable style={p.unbanBtn} onPress={async () => {
                  setMutedUsers(prev => prev.filter(m => m.id !== mute.id));
                  try {
                    await ModerationService.unmuteInRoom(room.id, mute.muted_user_id || mute.user?.id);
                  } catch { setMutedUsers(prev => [...prev, mute]); showToast({ title: 'Hata', type: 'error' }); }
                }}>
                  <Ionicons name="volume-high-outline" size={10} color="#14B8A6" />
                  <Text style={{ fontSize: 9, fontWeight: '700', color: '#14B8A6' }}>AÃ§</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </View>
    </View>
  );

  // â•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Â
  // GÃ–RSELLÄ°K Ã¢â‚¬â€ RoomSettingsSheet ile birebir aynÄ±
  // â•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Â
  const renderVisual = () => (
    <View>
      {/* Tema Ã¢â‚¬â€ Plus+ */}
      {can('Plus') ? (
        <View style={{ marginBottom: 8 }}>
          <Text style={p.subTitle}>ÄŸÅ¸ÂÂ¨ Oda TemasÄ±</Text>
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
      ) : <LockedRow label="Oda TemasÄ±" tier="Plus" />}

      {/* Arka Plan Resmi Ã¢â‚¬â€ Plus+ */}
      {can('Plus') ? (
        <Row icon="image" bg="rgba(139,92,246,0.2)" label="Arka Plan Resmi" desc={backgroundImage ? 'Arka plan ayarlandÄ±' : 'ÃƒÅ“yelik statÃ¼sÃ¼ne gÃ¶re'}
          right={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {backgroundImage ? (
                <Pressable onPress={() => handleBgImage(null)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}>
                  <Ionicons name="trash-outline" size={12} color="#EF4444" /><Text style={{ fontSize: 10, fontWeight: '600', color: '#EF4444' }}>KaldÄ±r</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => handleBgImage('default')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(139,92,246,0.1)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.2)' }}>
                  <Ionicons name="add" size={12} color="#A78BFA" /><Text style={{ fontSize: 10, fontWeight: '600', color: '#A78BFA' }}>SeÃ§</Text>
                </Pressable>
              )}
            </View>
          }
        />
      ) : <LockedRow label="Arka Plan Resmi" tier="Plus" />}

      {/* Oda Kapak GÃ¶rseli Ã¢â‚¬â€ Pro+ */}
      {can('Pro') ? (
        <Row icon="albums" bg="rgba(255,215,0,0.2)" label="Oda Kapak GÃ¶rseli" desc={coverImage ? 'Banner ayarlandÄ±' : 'KeÅŸfet akÄ±ÅŸÄ±nda gÃ¶rÃ¼nen banner'}
          right={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {coverImage ? (
                <Pressable onPress={() => handleCoverImage(null)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}>
                  <Ionicons name="trash-outline" size={12} color="#EF4444" /><Text style={{ fontSize: 10, fontWeight: '600', color: '#EF4444' }}>KaldÄ±r</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => handleCoverImage('pick')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(255,215,0,0.1)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)' }}>
                  <Ionicons name="add" size={12} color="#FFD700" /><Text style={{ fontSize: 10, fontWeight: '600', color: '#FFD700' }}>SeÃ§</Text>
                </Pressable>
              )}
            </View>
          }
        />
      ) : <LockedRow label="Oda Kapak GÃ¶rseli (Banner)" tier="Pro" />}

      {/* MÃ¼zik Ã¢â‚¬â€ Pro+ */}
      {can('Pro') ? (
        <Row icon="musical-notes" bg="rgba(255,215,0,0.2)" label={musicTrack ? `MÃ¼zik: ${({ lofi: 'Lofi', ambient: 'Ambient', jazz: 'Jazz' } as any)[musicTrack] || musicTrack}` : 'Oda MÃ¼ziÄŸi KapalÄ±'} desc="Arka planda ambient ses dÃ¶ngÃ¼sÃ¼"
          right={
            <View style={{ flexDirection: 'row', gap: 3 }}>
              {([null, 'lofi', 'ambient', 'jazz'] as const).map(t => (
                <Pressable key={t || 'off'} style={[p.pill, musicTrack === t && p.pillActive]} onPress={() => { setMusicTrack(t); updateRS('music_track', t); }}>
                  <Text style={[p.pillText, musicTrack === t && p.pillTextActive]}>{t === null ? 'ÄŸÅ¸â€â€¡' : t === 'lofi' ? 'ÄŸÅ¸ÂÂµ' : t === 'ambient' ? 'ÄŸÅ¸Å’Å ' : 'ÄŸÅ¸ÂÂ·'}</Text>
                </Pressable>
              ))}
            </View>
          }
        />
      ) : <LockedRow label="Oda Arka Plan MÃ¼ziÄŸi" tier="Pro" />}
    </View>
  );

  // â•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Â
  // MONETÄ°ZASYON Ã¢â‚¬â€ RoomSettingsSheet ile birebir aynÄ±
  // â•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Â
  const renderMonetization = () => (
    <View>
      {/* BaÄŸÄ±ÅŸ Ã¢â‚¬â€ Pro+ */}
      {/* BaÄŸÄ±ÅŸ Ã¢â‚¬â€ Pro */}
      {can('Pro') ? (
        <Row icon="heart" bg="rgba(239,68,68,0.2)" label={donationsEnabled ? 'BaÄŸÄ±ÅŸ AÃ§Ä±k' : 'BaÄŸÄ±ÅŸ KapalÄ±'} desc="Dinleyicilerden SP baÄŸÄ±ÅŸÄ± kabul et"
          right={<Switch value={donationsEnabled} onValueChange={(v) => { setDonationsEnabled(v); updateRS('donations_enabled', v); }} trackColor={{ false: 'rgba(255,255,255,0.08)', true: 'rgba(239,68,68,0.4)' }} thumbColor={donationsEnabled ? '#EF4444' : '#475569'} />} />
      ) : <LockedRow label="BaÄŸÄ±ÅŸ (Tip) AÃ§/Kapat" tier="Pro" />}

      {/* GiriÅŸ ÃƒÅ“creti Ã¢â‚¬â€ Pro */}
      {can('Pro') ? (
        <Row icon="cash" bg="rgba(212,175,55,0.2)" label={entryFee ? `GiriÅŸ: ${entryFee} SP` : 'GiriÅŸ ÃƒÅ“cretsiz'} desc="SP cinsinden oda giriÅŸ Ã¼creti"
          right={
            <View style={{ flexDirection: 'row', gap: 3 }}>
              {[0, 10, 50, 100].map(fee => (
                <Pressable key={fee} style={[p.pill, entryFee === fee && p.pillActive]} onPress={() => { setEntryFee(fee); updateRS('entry_fee_sp', fee); }}>
                  <Text style={[p.pillText, entryFee === fee && p.pillTextActive]}>{fee === 0 ? 'Free' : `${fee}`}</Text>
                </Pressable>
              ))}
            </View>
          }
        />
      ) : <LockedRow label="GiriÅŸ ÃƒÅ“creti Belirleme (SP)" tier="Pro" />}

      {/* Oda Boost Ã¢â‚¬â€ Pro */}
      {can('Pro') ? (
        <Row icon="rocket" bg="rgba(255,107,53,0.2)" label="OdayÄ± Ã–ne Ã‡Ä±kar" desc="Oda iÃ§indeki + menÃ¼sÃ¼nden boost aktifleÅŸtir"
          right={<View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: 'rgba(255,107,53,0.12)', borderWidth: 1, borderColor: 'rgba(255,107,53,0.2)' }}><Text style={{ fontSize: 9, fontWeight: '700', color: '#FF6B35' }}>Oda Ä°Ã§i</Text></View>} />
      ) : <LockedRow label="OdayÄ± Ã–ne Ã‡Ä±karma / Boost" tier="Pro" />}
    </View>
  );

  // â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• 
  // GELÄ°Ã…Å¾MÄ°Ã…Å¾ Ã¢â‚¬â€ RoomSettingsSheet ile birebir aynÄ±
  // â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• 
  const renderAdvanced = () => (
    <View>
      {/* 13 KiÅŸi Sahne Ã¢â‚¬â€ Pro */}
      {can('Pro') ? (
        <Row icon="people" bg="rgba(255,107,53,0.2)" label="13 KiÅŸilik Sahne" desc="GeniÅŸletilmiÅŸ sahne kapasitesi aktif"
          right={<View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(255,107,53,0.12)' }}><Text style={{ fontSize: 8, fontWeight: '700', color: '#FF6B35' }}>13 kiÅŸi</Text></View>} />
      ) : <LockedRow label="13 KiÅŸilik Sahne" tier="Pro" />}
    </View>
  );

  // â•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Â
  // TAKÄ°PÃ‡Ä°LER
  // â•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Ââ•Â
  const renderFollowers = () => (
    <View>
      <Text style={p.subTitle}>â¤ï¸ {followerCount} TakipÃ§i</Text>
      {loadingFollowers ? (
        <ActivityIndicator color={Colors.accentTeal} style={{ marginVertical: 16 }} />
      ) : followers.length > 0 ? (
        <View style={p.followerGrid}>
          {followers.map(f => (
            <Pressable key={f.id} style={p.followerCard} onPress={() => { onClose(); router.push(`/user/${f.id}` as any); }}>
              <Image source={getAvatarSource(f.avatar_url)} style={p.followerAvatar} />
              <Text style={p.followerName} numberOfLines={1}>{f.display_name}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={p.emptyCard}>
          <Ionicons name="heart-outline" size={24} color="#475569" />
          <Text style={p.emptyText}>HenÃ¼z takipÃ§i yok</Text>
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

      {/* Panel Ã¢â‚¬â€ saÄŸdan kayar */}
      <Animated.View style={[p.panel, { transform: [{ translateX: slideAnim }] }]}>
        {/* BaÅŸlÄ±k */}
        <View style={p.header}>
          <View style={p.headerLeft}>
            <Image source={getAvatarSource((room as any).host?.avatar_url)} style={p.headerAvatar} />
            <View style={{ flex: 1 }}>
              <Text style={p.headerTitle} numberOfLines={1}>{roomName || room.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {isLive ? (
                  <View style={p.liveBadge}><View style={p.liveDot} /><Text style={p.liveText}>CanlÄ±</Text></View>
                ) : (
                  <Text style={{ fontSize: 9, color: '#94A3B8' }}>Ã¢Ââ€Ã¯Â¸Â DondurulmuÅŸ</Text>
                )}
                <View style={p.followerBadge}><Ionicons name="heart" size={8} color="#EF4444" /><Text style={p.followerBadgeText}>{followerCount}</Text></View>
              </View>
            </View>
          </View>
        </View>

        {/* Tab Bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4, paddingHorizontal: 10 }} style={{ maxHeight: 34, marginBottom: 6 }}>
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <Pressable key={tab.id} style={[p.tab, active && p.tabActive]} onPress={() => {
                setActiveTab(tab.id);
                // Ã¢Ëœâ€¦ Moderasyon sekmesine geÃ§ildiÄŸinde verileri tazele
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

// Ã¢Ëœâ€¦ KÃ¼Ã§Ã¼k yardÄ±mcÄ± bileÅŸenler
function Row({ icon, bg, label, desc, right }: { icon: string; bg: string; label: string; desc?: string; right: React.ReactNode }) {
  return (
    <View style={p.row}>
      <View style={[p.rowIcon, { backgroundColor: bg }]}><Ionicons name={icon as any} size={14} color="#FFF" /></View>
      <View style={{ flex: 1 }}><Text style={p.rowLabel}>{label}</Text>{desc ? <Text style={p.rowDesc} numberOfLines={1}>{desc}</Text> : null}</View>
      {right}
    </View>
  );
}

function LockedRow({ label, tier }: { label: string; tier: string }) {
  const tierDef = TIER_DEFINITIONS[tier as SubscriptionTier];
  return (
    <Pressable style={[p.row, { opacity: 0.35 }]} onPress={() => showToast({ title: `ÄŸÅ¸â€â€™ ${tier}+ ile aÃ§Ä±lÄ±r`, message: `"${label}" Ã¶zelliÄŸi ${tier} ve Ã¼zeri Ã¼yeliklerde kullanÄ±labilir.`, type: 'info' })}>
      <View style={[p.rowIcon, { backgroundColor: tierDef ? `${tierDef.color}15` : 'rgba(148,163,184,0.15)' }]}><Ionicons name="lock-closed" size={14} color={tierDef?.color || '#94A3B8'} /></View>
      <View style={{ flex: 1 }}><Text style={p.rowLabel}>{label}</Text><Text style={p.rowDesc}>ğŸ”’ {tier}+ ile aÃ§Ä±lÄ±r</Text></View>
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
    backgroundColor: Colors.cardBg,
    borderTopLeftRadius: 18, borderBottomLeftRadius: 18,
    borderWidth: 1, borderRightWidth: 0, borderColor: Colors.cardBorder,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(149,161,174,0.1)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerAvatar: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)' },
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
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(149,161,174,0.1)',
  },
  tabActive: { backgroundColor: 'rgba(115,194,189,0.12)', borderColor: 'rgba(115,194,189,0.3)' },
  tabText: { fontSize: 9, fontWeight: '700', color: '#64748B' },
  tabTextActive: { color: Colors.accentTeal },

  // Row
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(149,161,174,0.06)' },
  rowIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
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

  // Ã¢Ëœâ€¦ Action CTA Ã¢â‚¬â€ RoomSettingsSheet ile birebir aynÄ± gradient stili
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
  followerAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(115,194,189,0.3)', marginBottom: 4 },
  followerName: { fontSize: 9, fontWeight: '600', color: '#94A3B8', textAlign: 'center' },
  emptyCard: { padding: 20, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 11, color: '#64748B' },

  // Moderation Ã¢â‚¬â€ ban/mute rows
  modRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, paddingHorizontal: 4, borderRadius: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  modAvatar: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  unbanBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8,
    backgroundColor: 'rgba(20,184,166,0.08)',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.18)',
  },
});

