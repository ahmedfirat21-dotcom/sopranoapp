/**
 * SopranoChat — Kompakt Oda Ayarları Bottom Sheet
 * ★ RoomManageSheet'in tüm ayarlarını kompakt grouped-card layout'ta sunar.
 * Sekmeler: Genel + Konuşma + Moderasyon + Görsellik + Monetizasyon + Gelişmiş + Takipçiler
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput,
  Animated, Dimensions, Switch, Image, ActivityIndicator, Alert, LayoutAnimation,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { RoomService, type Room } from '../../services/database';
import { RoomFollowService } from '../../services/roomFollow';
import { ModerationService } from '../../services/moderation';
import { isTierAtLeast, ROOM_TIER_LIMITS } from '../../constants/tiers';
import StatusAvatar from '../StatusAvatar';
import { showToast } from '../Toast';
import { supabase } from '../../constants/supabase';
import { useRouter } from 'expo-router';
import type { SubscriptionTier } from '../../types';

const { height: H } = Dimensions.get('window');
const SHEET_H = H * 0.88;

// ★ Kilitli ayar satırı
function LockedRow({ label, tier }: { label: string; tier: string }) {
  return (
    <View style={sty.row}>
      <Ionicons name="lock-closed" size={14} color="#475569" />
      <Text style={[sty.rowLabel, { color: '#475569' }]} numberOfLines={1}>{label}</Text>
      <View style={sty.tierBadge}>
        <Text style={sty.tierBadgeText}>{tier}+</Text>
      </View>
    </View>
  );
}

// Tema tanımları
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

const SPEAKING_MODES = [
  { id: 'free_for_all', label: 'Serbest' },
  { id: 'permission_only', label: 'İzinli' },
  { id: 'selected_only', label: 'Seçili', tier: 'Pro' as SubscriptionTier },
] as const;

const ROOM_TYPES = [
  { id: 'open', label: 'Açık', icon: 'globe-outline' },
  { id: 'closed', label: 'Şifreli', icon: 'lock-closed-outline' },
  { id: 'invite', label: 'Davet', icon: 'mail-outline' },
] as const;

const SLOW_MODES = [0, 5, 15, 30, 60];
const LANGUAGES = [
  { id: 'tr', label: 'TR' }, { id: 'en', label: 'EN' },
  { id: 'ar', label: 'AR' }, { id: 'de', label: 'DE' },
];
const MUSIC_TRACKS = [
  { id: null, label: 'Kapalı' },
  { id: 'lofi', label: 'Lofi' },
  { id: 'ambient', label: 'Ambient' },
  { id: 'jazz', label: 'Jazz' },
];

type Follower = { id: string; display_name: string; avatar_url: string };

interface Props {
  visible: boolean;
  room: Room | null;
  hostId: string;
  ownerTier: string;
  onClose: () => void;
  onWakeUp: (room: Room) => void;
  onDeleted: () => void;
}

// ★ Section tanımları — quick-nav için
const SECTIONS = [
  { id: 'basic', label: 'Temel', icon: 'settings-outline' },
  { id: 'speaking', label: 'Konuşma', icon: 'mic-outline' },
  { id: 'moderation', label: 'Mod', icon: 'shield-outline' },
  { id: 'visual', label: 'Görsel', icon: 'color-palette-outline' },
  { id: 'money', label: 'Para', icon: 'cash-outline' },
  { id: 'advanced', label: 'Gelişmiş', icon: 'rocket-outline' },
  { id: 'followers', label: 'Takip', icon: 'heart-outline' },
  { id: 'actions', label: 'Eylem', icon: 'flash-outline' },
] as const;
type SectionId = typeof SECTIONS[number]['id'];

export default function RoomQuickSettings({ visible, room, hostId, ownerTier, onClose, onWakeUp, onDeleted }: Props) {
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(SHEET_H)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Record<string, number>>({});
  const [activeSection, setActiveSection] = useState<SectionId>('basic');

  // ═══ State ═══
  const [roomName, setRoomName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [roomType, setRoomType] = useState('open');
  const [isLocked, setIsLocked] = useState(false);
  const [speakingMode, setSpeakingMode] = useState('permission_only');
  const [followersOnly, setFollowersOnly] = useState(false);
  const [slowMode, setSlowMode] = useState(0);
  const [roomLang, setRoomLang] = useState('tr');
  const [ageRestricted, setAgeRestricted] = useState(false);
  const [themeId, setThemeId] = useState<string | null>(null);
  const [musicTrack, setMusicTrack] = useState<string | null>(null);
  const [donationsEnabled, setDonationsEnabled] = useState(false);
  const [entryFee, setEntryFee] = useState(0);
  const [welcomeMsg, setWelcomeMsg] = useState('');
  const [editingWelcome, setEditingWelcome] = useState(false);
  const [rules, setRules] = useState('');
  const [editingRules, setEditingRules] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showBoostPanel, setShowBoostPanel] = useState(false);
  const [stageCapacity, setStageCapacity] = useState(0); // 0 = tier default

  // Followers
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [loadingFollowers, setLoadingFollowers] = useState(false);

  // Moderation
  const [bannedUsers, setBannedUsers] = useState<any[]>([]);
  const [mutedUsers, setMutedUsers] = useState<any[]>([]);
  const [loadingMod, setLoadingMod] = useState(false);

  const tier = (ownerTier || 'Free') as SubscriptionTier;
  const can = (req: SubscriptionTier) => isTierAtLeast(tier, req);

  // Animate
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 200 }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: SHEET_H, useNativeDriver: true, damping: 22, stiffness: 220 }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
      setConfirmDelete(false);
    }
  }, [visible]);

  // Load room data
  useEffect(() => {
    if (!visible || !room) return;
    const rs = (room.room_settings || {}) as any;
    setRoomName(room.name || '');
    setRoomType(room.type || 'open');
    setIsLocked(rs.is_locked || false);
    setSpeakingMode(rs.speaking_mode || 'permission_only');
    setFollowersOnly(rs.followers_only || false);
    setSlowMode(rs.slow_mode_seconds || 0);
    setRoomLang(rs.room_language || 'tr');
    setAgeRestricted(rs.age_restricted || false);
    setStageCapacity(rs.max_stage_speakers || 0);
    setThemeId((room as any).theme_id || null);
    setMusicTrack(rs.music_track || null);
    setDonationsEnabled(rs.donations_enabled || false);
    setEntryFee(rs.entry_fee_sp || 0);
    setWelcomeMsg(rs.welcome_message || '');
    setRules(typeof rs.rules === 'string' ? rs.rules : Array.isArray(rs.rules) ? rs.rules.join('\n') : '');
    setBackgroundImage(rs.room_image_url || (room as any).room_image_url || null);
    setCoverImage(rs.cover_image_url || null);
    setEditingName(false); setEditingWelcome(false); setEditingRules(false); setConfirmDelete(false);

    // Followers
    setLoadingFollowers(true);
    Promise.all([
      RoomFollowService.getRoomFollowers(room.id),
      RoomFollowService.getFollowerCount(room.id),
    ]).then(([f, c]) => { setFollowers(f); setFollowerCount(c); }).catch(() => {}).finally(() => setLoadingFollowers(false));

    // Moderation
    setLoadingMod(true);
    Promise.all([
      ModerationService.getRoomBans(room.id),
      ModerationService.getRoomMutes(room.id),
    ]).then(([b, m]) => { setBannedUsers(b); setMutedUsers(m); }).catch(() => {}).finally(() => setLoadingMod(false));
  }, [visible, room?.id]);

  // ★ Realtime sync
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
    setWelcomeMsg(rs.welcome_message || '');
    setBackgroundImage(rs.room_image_url || (room as any).room_image_url || null);
    setCoverImage(rs.cover_image_url || null);
  }, [room?.room_settings, room?.name, room?.type, (room as any)?.theme_id]);

  // ★ Broadcast
  const broadcast = useCallback((payload: Record<string, any>) => {
    if (!room) return;
    const ch = supabase.channel(`mod_action:${room.id}`);
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        ch.send({ type: 'broadcast', event: 'settings_changed', payload }).then(() => {
          setTimeout(() => { try { supabase.removeChannel(ch); } catch {} }, 1000);
        });
      }
    });
  }, [room?.id]);

  // ★ DB helpers
  const updateRS = useCallback(async (field: string, value: any) => {
    if (!room || !hostId) return;
    try {
      await RoomService.updateSettings(room.id, hostId, { room_settings: { [field]: value } });
      broadcast({ room_settings: { [field]: value } });
    } catch (e: any) { showToast({ title: 'Hata', message: e.message || '', type: 'error' }); }
  }, [room, hostId, broadcast]);

  const handleRename = useCallback(async () => {
    if (!room || !roomName.trim() || roomName.trim() === room.name) { setEditingName(false); return; }
    try {
      await ModerationService.editRoomName(room.id, roomName.trim());
      broadcast({ name: roomName.trim() });
      showToast({ title: 'İsim güncellendi', type: 'success' });
    } catch { showToast({ title: 'Hata', type: 'error' }); setRoomName(room.name || ''); }
    setEditingName(false);
  }, [room, roomName, broadcast]);

  const handleSaveWelcome = useCallback(() => {
    setEditingWelcome(false); updateRS('welcome_message', welcomeMsg.trim());
  }, [welcomeMsg, updateRS]);

  const handleSaveRules = useCallback(() => {
    setEditingRules(false); updateRS('rules', rules.trim());
  }, [rules, updateRS]);

  const handleDelete = useCallback(async () => {
    if (!room || !hostId) return;
    try { await RoomService.deleteRoom(room.id, hostId); showToast({ title: 'Oda silindi', type: 'success' }); onDeleted(); onClose(); }
    catch (e: any) { showToast({ title: 'Hata', message: e.message || '', type: 'error' }); }
  }, [room, hostId, onDeleted, onClose]);

  const handleFreeze = useCallback(async () => {
    if (!room || !hostId) return;
    try { await RoomService.freezeRoom(room.id, hostId); showToast({ title: 'Oda donduruldu', type: 'success' }); onDeleted(); onClose(); }
    catch (e: any) { showToast({ title: 'Hata', message: e.message || '', type: 'error' }); }
  }, [room, hostId, onDeleted, onClose]);

  const handleTypeChange = useCallback(async (newType: string) => {
    if (!room || !hostId) return;
    setRoomType(newType);
    try { await RoomService.updateSettings(room.id, hostId, { type: newType as any }); broadcast({ type: newType }); }
    catch (e: any) { showToast({ title: 'Hata', type: 'error' }); setRoomType(room.type || 'open'); }
  }, [room, hostId, broadcast]);

  const handleThemeChange = useCallback(async (id: string | null) => {
    if (!room || !hostId) return;
    setThemeId(id);
    try {
      await RoomService.updateSettings(room.id, hostId, { theme_id: id });
      broadcast({ theme_id: id });
    } catch (e: any) { showToast({ title: 'Hata', type: 'error' }); }
  }, [room, hostId, broadcast]);

  // ★ Görsel yükleme
  const pickImage = useCallback(async (field: 'room_image_url' | 'cover_image_url', folder: string) => {
    if (!room || !hostId) return;
    try {
      const ImagePicker = require('expo-image-picker');
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { showToast({ title: 'İzin Gerekli', type: 'warning' }); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [16, 9], quality: 0.7 });
      if (result.canceled) return;
      const { StorageService } = require('../../services/storage');
      const fileName = `${folder}/${room.id}_${Date.now()}.jpg`;
      const url = await StorageService.uploadFile('post-images', fileName, result.assets[0].uri);
      await RoomService.updateSettings(room.id, hostId, { room_settings: { [field]: url } });
      if (field === 'room_image_url') setBackgroundImage(url); else setCoverImage(url);
      showToast({ title: 'Görsel güncellendi', type: 'success' });
    } catch (e: any) { showToast({ title: 'Hata', message: e.message || '', type: 'error' }); }
  }, [room, hostId]);

  const removeImage = useCallback(async (field: 'room_image_url' | 'cover_image_url') => {
    if (!room || !hostId) return;
    try {
      await RoomService.updateSettings(room.id, hostId, { room_settings: { [field]: null } });
      if (field === 'room_image_url') setBackgroundImage(null); else setCoverImage(null);
      showToast({ title: 'Görsel kaldırıldı', type: 'success' });
    } catch (e: any) { showToast({ title: 'Hata', type: 'error' }); }
  }, [room, hostId]);

  const handleUnban = useCallback(async (ban: any) => {
    if (!room) return;
    setBannedUsers(prev => prev.filter(b => b.id !== ban.id));
    try { await ModerationService.unbanFromRoom(room.id, ban.user_id || ban.user?.id); }
    catch { setBannedUsers(prev => [...prev, ban]); showToast({ title: 'Hata', type: 'error' }); }
  }, [room]);

  const handleUnmute = useCallback(async (mute: any) => {
    if (!room) return;
    setMutedUsers(prev => prev.filter(m => m.id !== mute.id));
    try { await ModerationService.unmuteInRoom(room.id, mute.muted_user_id || mute.user?.id); }
    catch { setMutedUsers(prev => [...prev, mute]); showToast({ title: 'Hata', type: 'error' }); }
  }, [room]);

  if (!visible || !room) return null;
  const isLive = room.is_live;

  // ★ Section'a scroll
  const scrollToSection = useCallback((id: SectionId) => {
    setActiveSection(id);
    const y = sectionOffsets.current[id];
    if (y !== undefined && scrollRef.current) {
      scrollRef.current.scrollTo({ y: Math.max(0, y - 8), animated: true });
    }
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'box-none' : 'none'}>
      <Animated.View style={[sty.backdrop, { opacity: backdropAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[sty.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* ★ FriendsDrawer paleti — warm/neutral diagonal gradient */}
        <LinearGradient
          colors={['#4a5668', '#37414f', '#232a35']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={sty.handleWrap}><View style={sty.handle} /></View>

        {/* ★ Premium Header */}
        <View style={sty.header}>
          <StatusAvatar uri={(room as any).host?.avatar_url} size={34} tier={(room as any).host?.subscription_tier} />
          <View style={{ flex: 1 }}>
            <Text style={sty.headerTitle} numberOfLines={1}>{roomName || room.name}</Text>
            <Text style={sty.headerSub}>{isLive ? '🟢 Canlı Yayın' : '❄️ Dondurulmuş'}</Text>
          </View>
          {isLive && <View style={sty.livePill}><View style={sty.liveDot} /><Text style={sty.liveText}>CANLI</Text></View>}
          <Pressable onPress={onClose} hitSlop={12} style={sty.closeBtn}>
            <Ionicons name="close" size={16} color="rgba(255,255,255,0.5)" />
          </Pressable>
        </View>

        {/* ★ Section Quick-Nav Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={sty.navBar} contentContainerStyle={sty.navBarContent}>
          {SECTIONS.map(sec => (
            <Pressable
              key={sec.id}
              style={[sty.navPill, activeSection === sec.id && sty.navPillActive]}
              onPress={() => scrollToSection(sec.id)}
            >
              <Ionicons name={sec.icon as any} size={12} color={activeSection === sec.id ? '#5EEAD4' : '#475569'} />
              <Text style={[sty.navPillText, activeSection === sec.id && sty.navPillTextActive]}>{sec.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={sty.scrollContent}>

          {/* ═══ GRUP 1: Temel ═══ */}
          <View onLayout={e => { sectionOffsets.current['basic'] = e.nativeEvent.layout.y; }}>
          <View style={sty.groupLabelRow}>
            <Ionicons name="settings-outline" size={12} color="#14B8A6" />
            <Text style={sty.groupLabel}>Temel Ayarlar</Text>
          </View>
          <View style={sty.card}>
            {/* Oda Adı */}
            <View style={sty.row}>
              <Ionicons name="create-outline" size={16} color="#94A3B8" />
              {editingName ? (
                <TextInput style={sty.nameInput} value={roomName} onChangeText={setRoomName}
                  autoFocus maxLength={50} returnKeyType="done" onSubmitEditing={handleRename} onBlur={handleRename} />
              ) : (
                <Pressable style={{ flex: 1 }} onPress={() => setEditingName(true)}>
                  <Text style={sty.rowValue} numberOfLines={1}>{roomName || 'İsimsiz Oda'}</Text>
                </Pressable>
              )}
            </View>
            <View style={sty.sep} />

            {/* Hoş Geldin Mesajı */}
            <View style={sty.rowCol}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="chatbox-ellipses-outline" size={16} color="#94A3B8" />
                <Text style={sty.rowLabel}>Hoş Geldin Mesajı</Text>
                {!editingWelcome && <Pressable onPress={() => setEditingWelcome(true)}><Ionicons name="create" size={13} color="#475569" /></Pressable>}
              </View>
              {editingWelcome ? (
                <View style={{ marginTop: 6 }}>
                  <TextInput style={sty.textArea} value={welcomeMsg} onChangeText={setWelcomeMsg}
                    multiline maxLength={200} placeholder="Hoş geldin mesajı..." placeholderTextColor="#475569" />
                  <Pressable style={sty.saveBtn} onPress={handleSaveWelcome}><Text style={sty.saveBtnText}>Kaydet</Text></Pressable>
                </View>
              ) : welcomeMsg ? <Text style={sty.preview} numberOfLines={2}>{welcomeMsg}</Text> : null}
            </View>
            <View style={sty.sep} />

            {/* Kurallar */}
            <View style={sty.rowCol}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="list-outline" size={16} color="#94A3B8" />
                <Text style={sty.rowLabel}>Oda Kuralları</Text>
                {!editingRules && <Pressable onPress={() => setEditingRules(true)}><Ionicons name="create" size={13} color="#475569" /></Pressable>}
              </View>
              {editingRules ? (
                <View style={{ marginTop: 6 }}>
                  <TextInput style={[sty.textArea, { height: 80 }]} value={rules} onChangeText={setRules}
                    multiline maxLength={500} placeholder="Her satır bir kural..." placeholderTextColor="#475569" />
                  <Pressable style={sty.saveBtn} onPress={handleSaveRules}><Text style={sty.saveBtnText}>Kaydet</Text></Pressable>
                </View>
              ) : rules ? <Text style={sty.preview} numberOfLines={3}>{rules}</Text> : null}
            </View>
            <View style={sty.sep} />

            {/* Oda Tipi — Plus+ */}
            {can('Plus') ? (
              <View style={sty.row}>
                <Ionicons name="globe-outline" size={16} color="#94A3B8" />
                <Text style={sty.rowLabel}>Oda Tipi</Text>
                <View style={sty.chipRow}>
                  {ROOM_TYPES.map(t => (
                    <Pressable key={t.id} style={[sty.chip, roomType === t.id && sty.chipOn]} onPress={() => handleTypeChange(t.id)}>
                      <Ionicons name={t.icon as any} size={10} color={roomType === t.id ? '#FFF' : '#64748B'} />
                      <Text style={[sty.chipT, roomType === t.id && sty.chipTOn]}>{t.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : <LockedRow label="Şifreli Oda / Davet" tier="Plus" />}
            <View style={sty.sep} />

            {/* Kilit — Plus+ */}
            {can('Plus') ? (
              <View style={sty.row}>
                <Ionicons name={isLocked ? 'lock-closed' : 'lock-open-outline'} size={16} color={isLocked ? '#EF4444' : '#94A3B8'} />
                <Text style={sty.rowLabel}>Kilitli</Text>
                <Switch value={isLocked} onValueChange={v => { setIsLocked(v); updateRS('is_locked', v); }}
                  trackColor={{ false: 'rgba(255,255,255,0.08)', true: 'rgba(239,68,68,0.3)' }} thumbColor={isLocked ? '#EF4444' : '#475569'} />
              </View>
            ) : <LockedRow label="Oda Kilitleme" tier="Plus" />}
          </View>
          </View>

          {/* ═══ GRUP 2: Konuşma & Moderasyon ═══ */}
          <View onLayout={e => { sectionOffsets.current['speaking'] = e.nativeEvent.layout.y; }}>
          <View style={sty.groupLabelRow}>
            <Ionicons name="mic-outline" size={12} color="#A78BFA" />
            <Text style={sty.groupLabel}>Konuşma & Moderasyon</Text>
          </View>
          <View style={sty.card}>
            {/* Konuşma Modu */}
            <View style={sty.row}>
              <Ionicons name="mic-outline" size={16} color="#94A3B8" />
              <Text style={sty.rowLabel}>Konuşma</Text>
              <View style={sty.chipRow}>
                {SPEAKING_MODES.map(m => {
                  const locked = 'tier' in m && m.tier && !can(m.tier);
                  return (
                    <Pressable key={m.id} style={[sty.chip, speakingMode === m.id && sty.chipOn, locked && { opacity: 0.3 }]}
                      onPress={() => { if (locked) { showToast({ title: `${'tier' in m ? m.tier : ''}+ gerekli`, type: 'info' }); return; } setSpeakingMode(m.id); updateRS('speaking_mode', m.id); }}>
                      <Text style={[sty.chipT, speakingMode === m.id && sty.chipTOn]}>{m.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={sty.sep} />

            {/* Slow Mode */}
            <View style={sty.row}>
              <Ionicons name="timer-outline" size={16} color="#94A3B8" />
              <Text style={sty.rowLabel}>Slow Mode</Text>
              <View style={sty.chipRow}>
                {SLOW_MODES.map(sec => (
                  <Pressable key={sec} style={[sty.chipSm, slowMode === sec && sty.chipOn]}
                    onPress={() => { setSlowMode(sec); updateRS('slow_mode_seconds', sec); }}>
                    <Text style={[sty.chipT, slowMode === sec && sty.chipTOn]}>{sec === 0 ? 'Yok' : `${sec}s`}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={sty.sep} />

            {/* Dil Filtresi — Plus+ */}
            {can('Plus') ? (
              <View style={sty.row}>
                <Ionicons name="language-outline" size={16} color="#94A3B8" />
                <Text style={sty.rowLabel}>Dil</Text>
                <View style={sty.chipRow}>
                  {LANGUAGES.map(l => (
                    <Pressable key={l.id} style={[sty.chipSm, roomLang === l.id && sty.chipOn]}
                      onPress={() => { setRoomLang(l.id); updateRS('room_language', l.id); }}>
                      <Text style={[sty.chipT, roomLang === l.id && sty.chipTOn]}>{l.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : <LockedRow label="Dil Filtresi" tier="Plus" />}
            <View style={sty.sep} />

            {/* 18+ — Plus+ */}
            {can('Plus') ? (
              <View style={sty.row}>
                <Ionicons name="warning-outline" size={16} color={ageRestricted ? '#EF4444' : '#94A3B8'} />
                <Text style={sty.rowLabel}>18+ İçerik</Text>
                <Switch value={ageRestricted} onValueChange={v => { setAgeRestricted(v); updateRS('age_restricted', v); }}
                  trackColor={{ false: 'rgba(255,255,255,0.08)', true: 'rgba(239,68,68,0.3)' }} thumbColor={ageRestricted ? '#EF4444' : '#475569'} />
              </View>
            ) : <LockedRow label="Yaş Filtresi (+18)" tier="Plus" />}
            <View style={sty.sep} />

            {/* Takipçilere Özel — Pro+ */}
            {can('Pro') ? (
              <View style={sty.row}>
                <Ionicons name="people-outline" size={16} color="#94A3B8" />
                <Text style={sty.rowLabel}>Sadece Takipçiler</Text>
                <Switch value={followersOnly} onValueChange={v => { setFollowersOnly(v); updateRS('followers_only', v); }}
                  trackColor={{ false: 'rgba(255,255,255,0.08)', true: 'rgba(212,175,55,0.3)' }} thumbColor={followersOnly ? '#D4AF37' : '#475569'} />
              </View>
            ) : <LockedRow label="Sadece Takipçiler Girebilir" tier="Pro" />}

            {/* Locked hints */}
            {!can('Pro') && <><View style={sty.sep} /><LockedRow label="Tümünü Sustur (Cooldown)" tier="Pro" /></>}
            {!can('Pro') && <><View style={sty.sep} /><LockedRow label="Gelişmiş Ban Seçenekleri" tier="Pro" /></>}
          </View>
          </View>

          {/* ═══ GRUP 3: Banlı & Susturulanlar ═══ */}
          <View onLayout={e => { sectionOffsets.current['moderation'] = e.nativeEvent.layout.y; }}>
          <View style={sty.groupLabelRow}>
            <Ionicons name="shield-outline" size={12} color="#EF4444" />
            <Text style={sty.groupLabel}>Banlı ({bannedUsers.length}) & Susturulan ({mutedUsers.length})</Text>
          </View>
          <View style={sty.card}>
            {loadingMod ? (
              <View style={sty.row}><ActivityIndicator color="#EF4444" /></View>
            ) : bannedUsers.length === 0 && mutedUsers.length === 0 ? (
              <View style={sty.row}>
                <Ionicons name="shield-checkmark" size={14} color="rgba(34,197,94,0.4)" />
                <Text style={{ fontSize: 12, color: '#475569' }}>Banlı veya susturulan kullanıcı yok</Text>
              </View>
            ) : (
              <>
                {bannedUsers.map((ban: any) => {
                  const isPerm = ban.ban_type === 'permanent' || ban.duration === 'permanent';
                  const expiresAt = ban.expires_at ? new Date(ban.expires_at) : null;
                  const remainMin = expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 60000)) : 0;
                  const timeLabel = isPerm ? 'Kalıcı' : remainMin > 60 ? `${Math.floor(remainMin / 60)}sa ${remainMin % 60}dk` : `${remainMin}dk kaldı`;
                  return (
                    <View key={ban.id} style={sty.modRow}>
                      <StatusAvatar uri={ban.user?.avatar_url} size={26} />
                      <View style={{ flex: 1 }}>
                        <Text style={sty.modName} numberOfLines={1}>{ban.user?.display_name || 'Kullanıcı'}</Text>
                        <View style={{ flexDirection: 'row', gap: 4, marginTop: 1 }}>
                          <View style={[sty.modBadge, { backgroundColor: isPerm ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)' }]}>
                            <Text style={{ fontSize: 7, fontWeight: '700', color: isPerm ? '#EF4444' : '#F59E0B' }}>{isPerm ? 'KALICI' : 'GEÇİCİ'}</Text>
                          </View>
                          <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>{timeLabel}</Text>
                        </View>
                      </View>
                      <Pressable style={sty.unbanBtn} onPress={() => handleUnban(ban)}>
                        <Ionicons name="lock-open-outline" size={10} color={Colors.accentTeal} />
                        <Text style={{ fontSize: 9, fontWeight: '700', color: Colors.accentTeal }}>Kaldır</Text>
                      </Pressable>
                    </View>
                  );
                })}
                {mutedUsers.map((mute: any) => {
                  const expiresAt = mute.expires_at ? new Date(mute.expires_at) : null;
                  const remainMin = expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 60000)) : 0;
                  const timeLabel = expiresAt ? (remainMin > 60 ? `${Math.floor(remainMin / 60)}sa ${remainMin % 60}dk` : `${remainMin}dk kaldı`) : 'Süresiz';
                  return (
                    <View key={mute.id} style={sty.modRow}>
                      <StatusAvatar uri={mute.user?.avatar_url} size={26} />
                      <View style={{ flex: 1 }}>
                        <Text style={sty.modName} numberOfLines={1}>{mute.user?.display_name || 'Kullanıcı'}</Text>
                        <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>{timeLabel}{mute.reason ? ` - ${mute.reason}` : ''}</Text>
                      </View>
                      <Pressable style={sty.unbanBtn} onPress={() => handleUnmute(mute)}>
                        <Ionicons name="volume-high-outline" size={10} color={Colors.accentTeal} />
                        <Text style={{ fontSize: 9, fontWeight: '700', color: Colors.accentTeal }}>Aç</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </>
            )}
          </View>

          </View>

          {/* ═══ GRUP 4: Görsellik ═══ */}
          <View onLayout={e => { sectionOffsets.current['visual'] = e.nativeEvent.layout.y; }}>
          <View style={sty.groupLabelRow}>
            <Ionicons name="color-palette-outline" size={12} color="#F59E0B" />
            <Text style={sty.groupLabel}>Görsellik</Text>
          </View>
          <View style={sty.card}>
            {/* Tema — Plus+ */}
            {can('Plus') ? (
              <View style={sty.themeGrid}>
                {/* Varsayılan */}
                <Pressable style={[sty.themeItem, !themeId && sty.themeItemOn]} onPress={() => handleThemeChange(null)}>
                  <LinearGradient colors={['#0E1420', '#070B14']} style={sty.themeSwatch}>
                    <Ionicons name="moon-outline" size={10} color="rgba(255,255,255,0.3)" />
                  </LinearGradient>
                  <Text style={[sty.themeN, !themeId && { color: '#FFF' }]}>Varsayılan</Text>
                </Pressable>
                {Object.entries(ROOM_THEMES).map(([id, t]) => (
                  <Pressable key={id} style={[sty.themeItem, themeId === id && sty.themeItemOn]} onPress={() => handleThemeChange(id)}>
                    <LinearGradient colors={t.colors} style={sty.themeSwatch} />
                    <Text style={[sty.themeN, themeId === id && { color: '#FFF' }]}>{t.name}</Text>
                  </Pressable>
                ))}
              </View>
            ) : <LockedRow label="Oda Teması" tier="Plus" />}
            <View style={sty.sep} />

            {/* Arka Plan Resmi — Plus+ */}
            {can('Plus') ? (
              <View style={sty.row}>
                <Ionicons name="image-outline" size={16} color="#94A3B8" />
                <Text style={sty.rowLabel}>Arka Plan</Text>
                {backgroundImage ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Image source={{ uri: backgroundImage }} style={{ width: 32, height: 20, borderRadius: 4 }} />
                    <Pressable onPress={() => removeImage('room_image_url')}><Ionicons name="close-circle" size={16} color="#EF4444" /></Pressable>
                  </View>
                ) : (
                  <Pressable style={sty.chip} onPress={() => pickImage('room_image_url', 'room_bg')}>
                    <Ionicons name="cloud-upload-outline" size={12} color="#A78BFA" />
                    <Text style={sty.chipT}>Seç</Text>
                  </Pressable>
                )}
              </View>
            ) : <LockedRow label="Arka Plan Resmi" tier="Plus" />}
            <View style={sty.sep} />

            {/* Kapak Görseli — Pro+ */}
            {can('Pro') ? (
              <View style={sty.row}>
                <Ionicons name="albums-outline" size={16} color="#94A3B8" />
                <Text style={sty.rowLabel}>Kapak Görseli</Text>
                {coverImage ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Image source={{ uri: coverImage }} style={{ width: 32, height: 20, borderRadius: 4 }} />
                    <Pressable onPress={() => removeImage('cover_image_url')}><Ionicons name="close-circle" size={16} color="#EF4444" /></Pressable>
                  </View>
                ) : (
                  <Pressable style={sty.chip} onPress={() => pickImage('cover_image_url', 'room_cover')}>
                    <Ionicons name="add" size={12} color="#FFD700" />
                    <Text style={sty.chipT}>Seç</Text>
                  </Pressable>
                )}
              </View>
            ) : <LockedRow label="Oda Kapak Görseli (Banner)" tier="Pro" />}
            <View style={sty.sep} />

            {/* Müzik — Pro+ */}
            {can('Pro') ? (
              <View style={sty.row}>
                <Ionicons name="musical-notes-outline" size={16} color="#94A3B8" />
                <Text style={sty.rowLabel}>Müzik</Text>
                <View style={sty.chipRow}>
                  {MUSIC_TRACKS.map(t => (
                    <Pressable key={t.id || 'off'} style={[sty.chipSm, musicTrack === t.id && sty.chipOn]}
                      onPress={() => { setMusicTrack(t.id); updateRS('music_track', t.id); }}>
                      <Text style={[sty.chipT, musicTrack === t.id && sty.chipTOn]}>{t.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : <LockedRow label="Oda Arka Plan Müziği" tier="Pro" />}
          </View>

          </View>

          {/* ═══ GRUP 5: Monetizasyon ═══ */}
          <View onLayout={e => { sectionOffsets.current['money'] = e.nativeEvent.layout.y; }}>
          <View style={sty.groupLabelRow}>
            <Ionicons name="cash-outline" size={12} color="#D4AF37" />
            <Text style={sty.groupLabel}>Monetizasyon</Text>
          </View>
          <View style={sty.card}>
            {can('Pro') ? (
              <View style={sty.row}>
                <Ionicons name="heart-outline" size={16} color="#EF4444" />
                <Text style={sty.rowLabel}>Bağışlar</Text>
                <Switch value={donationsEnabled} onValueChange={v => { setDonationsEnabled(v); updateRS('donations_enabled', v); }}
                  trackColor={{ false: 'rgba(255,255,255,0.08)', true: 'rgba(239,68,68,0.3)' }} thumbColor={donationsEnabled ? '#EF4444' : '#475569'} />
              </View>
            ) : <LockedRow label="Bağış (Tip) Aç/Kapat" tier="Pro" />}
            <View style={sty.sep} />
            {can('Pro') ? (
              <View style={sty.row}>
                <Ionicons name="diamond-outline" size={16} color="#D4AF37" />
                <Text style={sty.rowLabel}>Giriş Ücreti</Text>
                <View style={sty.chipRow}>
                  {[0, 25, 50, 100, 250, 500].map(fee => (
                    <Pressable key={fee} style={[sty.chipSm, entryFee === fee && sty.chipOn]}
                      onPress={() => { setEntryFee(fee); updateRS('entry_fee_sp', fee); }}>
                      <Text style={[sty.chipT, entryFee === fee && sty.chipTOn]}>{fee === 0 ? 'Free' : `${fee}`}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : <LockedRow label="Giriş Ücreti (SP)" tier="Pro" />}
            <View style={sty.sep} />
            {can('Pro') ? (() => {
              const rs = (room.room_settings || {}) as any;
              const boostExpires = rs.boost_expires_at || (room as any).boost_expires_at;
              const isActive = boostExpires && new Date(boostExpires).getTime() > Date.now();
              const remainMin = isActive ? Math.max(0, Math.floor((new Date(boostExpires).getTime() - Date.now()) / 60000)) : 0;
              const timeLabel = remainMin > 60 ? `${Math.floor(remainMin / 60)}sa ${remainMin % 60}dk` : `${remainMin}dk`;
              return (
                <>
                  <Pressable style={sty.row} onPress={() => {
                    if (isActive) { showToast({ title: '🚀 Boost Aktif', message: `Kalan süre: ${timeLabel}`, type: 'info' }); return; }
                    setShowBoostPanel(prev => !prev);
                  }}>
                    <Ionicons name="rocket-outline" size={16} color={isActive ? '#22C55E' : '#FF6B35'} />
                    <Text style={sty.rowLabel}>Odayı Öne Çıkar</Text>
                    {isActive ? (
                      <View style={[sty.infoBadge, { backgroundColor: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.25)' }]}>
                        <Text style={[sty.infoBadgeText, { color: '#22C55E' }]}>🚀 {timeLabel}</Text>
                      </View>
                    ) : (
                      <Ionicons name={showBoostPanel ? 'chevron-up' : 'chevron-down'} size={14} color="rgba(255,255,255,0.25)" />
                    )}
                  </Pressable>
                  {showBoostPanel && !isActive && (
                    <View style={{ marginHorizontal: 10, marginBottom: 10, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,107,53,0.15)' }}>
                      <LinearGradient colors={['rgba(255,107,53,0.08)', 'rgba(255,107,53,0.02)', 'transparent']} style={{ padding: 14, gap: 10 }}>
                        <Text style={{ fontSize: 11, color: '#94A3B8', lineHeight: 16 }}>
                          Odanı keşfet sayfasında üst sıralara çıkar. Daha fazla dinleyici kazan!
                        </Text>
                        {!room.is_live && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(245,158,11,0.08)', padding: 8, borderRadius: 8 }}>
                            <Ionicons name="warning-outline" size={12} color="#F59E0B" />
                            <Text style={{ fontSize: 10, color: '#F59E0B', flex: 1 }}>Boost için odanın canlı olması gerekir</Text>
                          </View>
                        )}
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          {([{ h: 1, sp: 50, score: 50 }, { h: 6, sp: 200, score: 100 }] as const).map(opt => (
                            <Pressable
                              key={opt.h}
                              onPress={async () => {
                                if (!room.is_live) { showToast({ title: 'Oda canlı değil', type: 'warning' }); return; }
                                try {
                                  const { GamificationService } = await import('../../services/gamification');
                                  const result = await GamificationService.purchaseRoomBoost(hostId, opt.h as 1 | 6);
                                  if (!result.success) { showToast({ title: 'Yetersiz SP', message: result.error || '', type: 'warning' }); return; }
                                  await RoomService.activateBoost(room.id, hostId, opt.h as 1 | 6);
                                  setShowBoostPanel(false);
                                  showToast({ title: '🚀 Boost Aktif!', message: `${opt.h} saat boyunca öne çıkacaksın!`, type: 'success' });
                                } catch (e: any) { showToast({ title: 'Hata', message: e.message || '', type: 'error' }); }
                              }}
                              style={({ pressed }) => ({
                                flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', gap: 4,
                                backgroundColor: pressed ? 'rgba(255,107,53,0.2)' : 'rgba(255,107,53,0.08)',
                                borderWidth: 1.5, borderColor: opt.h === 6 ? 'rgba(255,107,53,0.35)' : 'rgba(255,255,255,0.08)',
                              })}
                            >
                              <Text style={{ fontSize: 16 }}>{opt.h === 6 ? '⚡' : '🚀'}</Text>
                              <Text style={{ fontSize: 13, fontWeight: '800', color: '#FF6B35' }}>{opt.h} Saat</Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                <Image source={require('../../assets/soprano_coin.png')} style={{ width: 12, height: 12 }} />
                                <Text style={{ fontSize: 11, fontWeight: '700', color: '#CBD5E1' }}>{opt.sp} SP</Text>
                              </View>
                            </Pressable>
                          ))}
                        </View>
                      </LinearGradient>
                    </View>
                  )}
                </>
              );
            })() : <LockedRow label="Odayı Öne Çıkarma / Boost" tier="Pro" />}
          </View>

          </View>

          {/* ═══ GRUP 6: Gelişmiş ═══ */}
          <View onLayout={e => { sectionOffsets.current['advanced'] = e.nativeEvent.layout.y; }}>
          <View style={sty.groupLabelRow}>
            <Ionicons name="rocket-outline" size={12} color="#FF6B35" />
            <Text style={sty.groupLabel}>Gelişmiş</Text>
          </View>
          <View style={sty.card}>
            {/* Sahne Kapasitesi — tier'a göre seçilebilir */}
            <View style={sty.row}>
              <Ionicons name="people-outline" size={16} color="#FF6B35" />
              <Text style={sty.rowLabel}>Sahne Kapasitesi</Text>
              <View style={sty.chipRow}>
                {[
                  { v: 4, label: '4', minTier: 'Free' as const },
                  { v: 8, label: '8', minTier: 'Plus' as const },
                  { v: 13, label: '13', minTier: 'Pro' as const },
                ].map(opt => {
                  const allowed = can(opt.minTier);
                  const tierMax = ROOM_TIER_LIMITS[tier]?.maxSpeakers || 4;
                  const currentVal = stageCapacity || tierMax;
                  const isActive = currentVal === opt.v;
                  return (
                    <Pressable
                      key={opt.v}
                      style={[sty.chipSm, isActive && sty.chipOn, !allowed && { opacity: 0.3 }]}
                      onPress={() => {
                        if (!allowed) { showToast({ title: `${opt.minTier}+ gerekli`, type: 'info' }); return; }
                        setStageCapacity(opt.v);
                        updateRS('max_stage_speakers', opt.v);
                      }}
                    >
                      <Text style={[sty.chipT, isActive && sty.chipTOn]}>{opt.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            {!can('Plus') && <><View style={sty.sep} /><LockedRow label="Sahne Düzeni" tier="Plus" /></>}
          </View>

          </View>

          {/* ═══ GRUP 7: Takipçiler ═══ */}
          <View onLayout={e => { sectionOffsets.current['followers'] = e.nativeEvent.layout.y; }}>
          <View style={sty.groupLabelRow}>
            <Ionicons name="heart-outline" size={12} color="#F472B6" />
            <Text style={sty.groupLabel}>Takipçiler ({followerCount})</Text>
          </View>
          <View style={sty.card}>
            {loadingFollowers ? (
              <View style={sty.row}><ActivityIndicator color={Colors.accentTeal} /></View>
            ) : followers.length === 0 ? (
              <View style={sty.row}>
                <Ionicons name="heart-outline" size={14} color="#475569" />
                <Text style={{ fontSize: 12, color: '#475569' }}>Henüz takipçi yok</Text>
              </View>
            ) : (
              <View style={sty.followerGrid}>
                {followers.map(f => (
                  <Pressable key={f.id} style={sty.followerCard} onPress={() => { onClose(); router.push(`/user/${f.id}` as any); }}>
                    <StatusAvatar uri={f.avatar_url} size={32} />
                    <Text style={sty.followerName} numberOfLines={1}>{f.display_name}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          </View>

          {/* ═══ GRUP 8: Eylemler ═══ */}
          <View onLayout={e => { sectionOffsets.current['actions'] = e.nativeEvent.layout.y; }}>
          <View style={sty.groupLabelRow}>
            <Ionicons name="flash-outline" size={12} color="#60A5FA" />
            <Text style={sty.groupLabel}>Eylemler</Text>
          </View>
          <View style={sty.card}>
            {isLive ? (
              <Pressable style={sty.actionRow} onPress={() => { onClose(); router.push(`/room/${room.id}`); }}>
                <Ionicons name="enter-outline" size={16} color={Colors.accentTeal} />
                <Text style={[sty.actionText, { color: Colors.accentTeal }]}>Odaya Git</Text>
              </Pressable>
            ) : (
              <Pressable style={sty.actionRow} onPress={() => { onClose(); onWakeUp(room); }}>
                <Ionicons name="sunny" size={16} color="#FBBF24" />
                <Text style={[sty.actionText, { color: '#FBBF24' }]}>Uyandır</Text>
              </Pressable>
            )}
            {isLive && can('Plus') && (
              <><View style={sty.sep} />
              <Pressable style={sty.actionRow} onPress={handleFreeze}>
                <Ionicons name="snow-outline" size={16} color="#60A5FA" />
                <Text style={[sty.actionText, { color: '#60A5FA' }]}>Dondur</Text>
              </Pressable></>
            )}
            <View style={sty.sep} />
            {confirmDelete ? (
              <View style={sty.deleteRow}>
                <Text style={sty.deleteText}>Emin misin?</Text>
                <Pressable style={sty.deleteYes} onPress={handleDelete}><Text style={sty.deleteYesT}>Sil</Text></Pressable>
                <Pressable style={sty.deleteNo} onPress={() => setConfirmDelete(false)}><Text style={sty.deleteNoT}>Vazgeç</Text></Pressable>
              </View>
            ) : (
              <Pressable style={sty.actionRow} onPress={() => setConfirmDelete(true)}>
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
                <Text style={[sty.actionText, { color: '#EF4444' }]}>Odayı Sil</Text>
              </Pressable>
            )}
          </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

// ════════════════════════════════════════════════════════════
const sty = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: SHEET_H,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden',
  },
  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 2 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 18, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(20,184,166,0.03)',
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#F1F5F9' },
  headerSub: { fontSize: 10, color: '#64748B', marginTop: 2 },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginRight: 6,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },
  liveText: { fontSize: 9, fontWeight: '700', color: '#EF4444' },
  scrollContent: { padding: 16, paddingTop: 6, paddingBottom: 100 },
  // ★ Section quick-nav
  navBar: { maxHeight: 40, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  navBarContent: { gap: 4, paddingHorizontal: 14, paddingVertical: 6 },
  navPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  navPillActive: {
    backgroundColor: 'rgba(20,184,166,0.12)', borderColor: 'rgba(20,184,166,0.3)',
    shadowColor: '#14B8A6', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 2,
  },
  navPillText: { fontSize: 10, fontWeight: '600', color: '#475569' },
  navPillTextActive: { color: '#5EEAD4' },
  // ★ Group label row
  groupLabelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 16, marginBottom: 6, marginLeft: 4,
  },
  groupLabel: {
    fontSize: 11, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  card: {
    backgroundColor: 'rgba(37,53,69,0.9)', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  rowCol: { paddingHorizontal: 16, paddingVertical: 14 },
  rowLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: '#E2E8F0' },
  rowValue: { flex: 1, fontSize: 13, fontWeight: '600', color: '#F1F5F9' },
  sep: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 16 },
  nameInput: {
    flex: 1, fontSize: 13, fontWeight: '600', color: '#F1F5F9',
    backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(20,184,166,0.3)',
  },
  textArea: {
    fontSize: 12, color: '#F1F5F9', backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', minHeight: 48, textAlignVertical: 'top' as const,
  },
  preview: { fontSize: 11, color: '#94A3B8', marginTop: 4, lineHeight: 16 },
  saveBtn: {
    alignSelf: 'flex-end', marginTop: 6, paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: 8, backgroundColor: 'rgba(20,184,166,0.2)', borderWidth: 1, borderColor: 'rgba(20,184,166,0.3)',
  },
  saveBtnText: { fontSize: 11, fontWeight: '700', color: Colors.accentTeal },
  chipRow: { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 10, backgroundColor: 'rgba(30,48,64,0.9)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)',
  },
  chipSm: {
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9,
    backgroundColor: 'rgba(30,48,64,0.9)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)',
  },
  chipOn: {
    backgroundColor: '#14B8A6', borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#14B8A6', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 4,
  },
  chipT: { fontSize: 10, fontWeight: '700', color: '#7B8D9F' },
  chipTOn: { color: '#FFF' },
  tierBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    backgroundColor: 'rgba(251,191,36,0.1)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)',
  },
  tierBadgeText: { fontSize: 8, fontWeight: '800', color: '#FBBF24' },
  infoBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    backgroundColor: 'rgba(255,107,53,0.12)', borderWidth: 1, borderColor: 'rgba(255,107,53,0.2)',
  },
  infoBadgeText: { fontSize: 9, fontWeight: '700', color: '#FF6B35' },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 },
  themeItem: {
    alignItems: 'center', width: 52, gap: 3, padding: 4, borderRadius: 10,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  themeItemOn: { borderColor: Colors.accentTeal, backgroundColor: 'rgba(20,184,166,0.1)' },
  themeSwatch: { width: 40, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  themeN: { fontSize: 7, fontWeight: '600', color: '#64748B' },
  modRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8 },
  modName: { fontSize: 12, fontWeight: '600', color: '#CBD5E1' },
  modBadge: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 },
  unbanBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
    backgroundColor: 'rgba(20,184,166,0.1)', borderWidth: 1, borderColor: 'rgba(20,184,166,0.2)',
  },
  followerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 12 },
  followerCard: { alignItems: 'center', width: 56, gap: 3 },
  followerName: { fontSize: 8, fontWeight: '600', color: '#94A3B8', textAlign: 'center' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 15 },
  actionText: { fontSize: 14, fontWeight: '700' },
  deleteRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  deleteText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#EF4444' },
  deleteYes: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: '#EF4444' },
  deleteYesT: { fontSize: 11, fontWeight: '800', color: '#FFF' },
  deleteNo: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  deleteNoT: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
});
