import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Animated,
  Dimensions, LayoutAnimation, Platform, UIManager, Switch, TextInput, PanResponder,
  Image, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { isTierAtLeast } from '../../constants/tiers';
import { useSwipeToDismiss } from '../../hooks/useSwipeToDismiss';
import { Colors } from '../../constants/theme';
import { RoomAccessService } from '../../services/roomAccess';
import { ModerationService } from '../../services/moderation';
import { getAvatarSource } from '../../constants/avatars';
import { showToast } from '../Toast';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: W, height: H } = Dimensions.get('window');
// ★ 2026-04-20: Responsive panel genişlik — küçük telefonlarda daha geniş oran
const IS_SMALL_SCREEN = W <= 375;
const PANEL_W = IS_SMALL_SCREEN ? Math.min(W * 0.78, 310) : Math.min(W * 0.68, 320);

const layoutAnim = () => LayoutAnimation.configureNext({
  duration: 220,
  create: { type: 'easeInEaseOut', property: 'opacity' },
  update: { type: 'easeInEaseOut' },
  delete: { type: 'easeInEaseOut', property: 'opacity' },
});

// ═══ Sabitler ═══
const SPEAKING_MODES = [
  { id: 'free_for_all', label: 'Serbest' },
  { id: 'permission_only', label: 'İzinli' },
  { id: 'selected_only', label: 'Seçili' },
] as const;
const SLOW_MODES = [0, 5, 15, 30, 60];
const ENTRY_FEES = [0, 25, 50, 100, 250, 500]; // ★ Genişletildi: host'ların gelir potansiyeli artırıldı
const LANGUAGES = [
  { id: 'tr', label: 'TR' }, { id: 'en', label: 'EN' },
  { id: 'ar', label: 'AR' }, { id: 'de', label: 'DE' },
];
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
const ROOM_TYPES = [
  { id: 'open', label: 'Açık', icon: 'globe-outline' },
  { id: 'closed', label: 'Şifreli', icon: 'lock-closed-outline' },
  { id: 'invite', label: 'Davet', icon: 'mail-outline' },
] as const;

// ═══ Settings Config Type ═══
type SettingsConfig = {
  speakingMode: string;
  onSpeakingModeChange: (mode: string) => void;
  slowModeSeconds: number;
  onSlowModeChange: (seconds: number) => void;
  ageRestricted: boolean;
  onAgeRestrictedChange: (v: boolean) => void;
  followersOnly: boolean;
  onToggleFollowersOnly: (v: boolean) => void;
  donationsEnabled: boolean;
  onDonationsToggle: (v: boolean) => void;
  roomLanguage: string;
  onLanguageChange: (lang: string) => void;
  roomName: string;
  onRenameRoom: (name: string) => void;
  welcomeMessage: string;
  onWelcomeMessageChange: (msg: string) => void;
  roomRules: string;
  onRulesChange: (rules: string) => void;
  /** ★ 2026-04-20: Oda açıklaması — create-room'da set, PlusMenu'de de edit edilebilir */
  description?: string;
  onDescriptionChange?: (desc: string) => void;
  roomType: string;
  onRoomTypeChange: (type: string) => void;
  roomPassword?: string;
  onPasswordChange?: (pw: string) => void;
  themeId: string | null;
  onThemeChange: (themeId: string | null) => void;
  onFreezeRoom?: () => void;
  // ★ Eksik 4 ayar
  entryFee: number;
  onEntryFeeChange: (fee: number) => void;
  musicLink: string | null;
  onMusicLinkChange: (link: string | null) => void;
  backgroundImage: string | null;
  onPickBackgroundImage: () => void;
  onRemoveBackgroundImage: () => void;
  coverImage: string | null;
  onPickCoverImage: () => void;
  onRemoveCoverImage: () => void;
};

type PlusMenuProps = {
  visible: boolean;
  onClose: () => void;
  onInviteFriends: () => void;
  onShareLink: () => void;
  onRoomSettings?: () => void;
  onModeration?: () => void;
  onRoomLock?: () => void;
  onReportRoom?: () => void;
  isRoomLocked?: boolean;
  micRequestCount?: number;
  userRole?: 'owner' | 'moderator' | 'speaker' | 'listener';
  ownerTier?: string;
  onMuteAll?: () => void;
  onUnmuteAll?: () => void;
  onRoomStats?: () => void;
  onDeleteRoom?: () => void;
  onBoostRoom?: () => void;
  onToggleFollow?: () => void;
  isFollowingRoom?: boolean;
  settingsConfig?: SettingsConfig;
  followerCount?: number;
  onDonate?: () => void;
  isDonationsEnabled?: boolean;
  bottomInset?: number;
  // ★ Odadan ayrıl — tüm rollerde erişilebilir; owner'da host transfer uyarısı backend'de
  onLeaveRoom?: () => void;
  // ★ 2026-04-18: Cihaz ayarları inline — ayrı modal yerine "Konuşma & Ses" accordion içinde
  deviceConfig?: {
    micMode: 'normal' | 'music';
    onMicModeChange: (m: 'normal' | 'music') => void;
    noiseCancellation: boolean;
    onNoiseCancellationChange: (v: boolean) => void;
    useSpeaker: boolean;
    onSpeakerChange: (v: boolean) => void;
  };
  // ★ 2026-04-20: Inline Banlılar & İstekler — ayrı modal yerine accordion
  roomId?: string;
  hostId?: string;
  roomType?: string;
};

const ROLE_META: Record<string, { label: string; color: string; icon: string }> = {
  owner: { label: 'Oda Sahibi', color: '#D4AF37', icon: 'star' },
  moderator: { label: 'Moderatör', color: '#A78BFA', icon: 'shield-checkmark' },
  speaker: { label: 'Konuşmacı', color: '#14B8A6', icon: 'mic' },
  listener: { label: 'Dinleyici', color: '#94A3B8', icon: 'headset' },
};

// ═══ Yardımcı Bileşenler ═══

function SettingToggle({ icon, label, value, onValueChange, accent = '#14B8A6', locked, lockTier }: {
  icon: string; label: string; value: boolean; onValueChange?: (v: boolean) => void;
  accent?: string; locked?: boolean; lockTier?: string;
}) {
  if (locked) {
    return (
      <View style={st.toggleRow}>
        <Ionicons name="lock-closed" size={12} color="#475569" />
        <Text style={[st.toggleLabel, { color: '#475569' }]}>{label}</Text>
        <View style={st.tierPill}><Text style={st.tierPillText}>{lockTier}+</Text></View>
      </View>
    );
  }
  return (
    <View style={st.toggleRow}>
      <Ionicons name={icon as any} size={13} color={accent} />
      <Text style={st.toggleLabel}>{label}</Text>
      <Switch
        value={value} onValueChange={onValueChange}
        trackColor={{ false: 'rgba(255,255,255,0.06)', true: accent + '35' }}
        thumbColor={value ? accent : '#475569'}
        style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }}
      />
    </View>
  );
}

function SettingChips({ icon, label, options, value, onSelect, locked, lockTier }: {
  icon: string; label: string; options: { id: string | number; label: string }[];
  value: string | number; onSelect?: (v: any) => void;
  locked?: boolean; lockTier?: string;
}) {
  if (locked) {
    return (
      <View style={st.chipRow}>
        <Ionicons name="lock-closed" size={12} color="#475569" />
        <Text style={[st.chipLabel, { color: '#475569' }]}>{label}</Text>
        <View style={st.tierPill}><Text style={st.tierPillText}>{lockTier}+</Text></View>
      </View>
    );
  }
  return (
    <View style={st.chipRow}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 }}>
        <Ionicons name={icon as any} size={12} color="#64748B" />
        <Text style={st.chipLabel}>{label}</Text>
      </View>
      <View style={st.chipGroup}>
        {options.map(opt => {
          const active = value === opt.id;
          return (
            <Pressable key={String(opt.id)} style={[st.chip, active && st.chipActive]} onPress={() => onSelect?.(opt.id)}>
              <Text style={[st.chipText, active && st.chipTextActive]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function InlineTextEditor({ icon, label, value, onSave, placeholder, multiline, accent = '#14B8A6', secureTextEntry, maxLength }: {
  icon: string; label: string; value: string; onSave: (v: string) => void;
  placeholder?: string; multiline?: boolean; accent?: string;
  secureTextEntry?: boolean; maxLength?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [reveal, setReveal] = useState(false);
  useEffect(() => { setDraft(value); }, [value]);

  // ★ Şifre alanı: değer varsa görsel olarak • ile maskele
  const displayValue = secureTextEntry && value ? '•'.repeat(Math.min(value.length, 8)) : (value || '—');

  if (!editing) {
    return (
      <Pressable style={st.editorRow} onPress={() => setEditing(true)}>
        <Ionicons name={icon as any} size={12} color={accent} />
        <Text style={st.editorLabel} numberOfLines={1}>{label}</Text>
        <Text style={[st.editorValue, { flex: 1 }]} numberOfLines={1}>{displayValue}</Text>
        <Ionicons name="pencil-outline" size={10} color="rgba(255,255,255,0.15)" />
      </Pressable>
    );
  }
  const effectiveMax = maxLength ?? (multiline ? 500 : 60);
  return (
    <View style={st.editorExpanded}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <Ionicons name={icon as any} size={12} color={accent} />
        <Text style={[st.editorLabel, { flex: 0 }]}>{label}</Text>
        {secureTextEntry && (
          <Pressable onPress={() => setReveal(r => !r)} hitSlop={6} style={{ marginLeft: 'auto' }}>
            <Ionicons name={reveal ? 'eye-off-outline' : 'eye-outline'} size={12} color="#94A3B8" />
          </Pressable>
        )}
      </View>
      <TextInput
        style={[st.editorInput, multiline && { height: 50, textAlignVertical: 'top' }]}
        value={draft} onChangeText={setDraft}
        placeholder={placeholder} placeholderTextColor="rgba(255,255,255,0.15)"
        multiline={multiline} maxLength={effectiveMax} autoFocus
        secureTextEntry={secureTextEntry && !reveal}
        autoCapitalize={secureTextEntry ? 'none' : 'sentences'}
        autoCorrect={!secureTextEntry}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
        <Pressable onPress={() => { setDraft(value); setEditing(false); }} hitSlop={6}>
          <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}>İptal</Text>
        </Pressable>
        <Pressable onPress={() => { onSave(draft.trim()); setEditing(false); }} hitSlop={6}>
          <Text style={{ fontSize: 10, color: '#14B8A6', fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}>Kaydet</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// ★ PLUS MENÜ
// ═══════════════════════════════════════════════════════
export function PlusMenu({
  visible, onClose,
  onInviteFriends, onShareLink, onRoomSettings,
  onModeration, onRoomLock, onReportRoom,
  isRoomLocked, micRequestCount,
  userRole = 'listener',
  ownerTier = 'Free',
  onMuteAll, onUnmuteAll, onRoomStats, onDeleteRoom,
  onBoostRoom, onToggleFollow, isFollowingRoom,
  settingsConfig,
  followerCount = 0,
  onDonate, isDonationsEnabled,
  bottomInset = 14,
  onLeaveRoom, deviceConfig,
  roomId: _roomId, hostId: _hostId, roomType: _roomType,
}: PlusMenuProps) {
  const slideAnim = useRef(new Animated.Value(PANEL_W)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const compactSlideY = useRef(new Animated.Value(300)).current;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const rowRefs = useRef<Record<string, number>>({});

  // ★ 2026-04-20: Inline ban/request state
  const [inlineBans, setInlineBans] = useState<any[]>([]);
  const [inlineRequests, setInlineRequests] = useState<any[]>([]);
  const [bansLoading, setBansLoading] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const loadBans = useCallback(async () => {
    if (!_roomId) return;
    setBansLoading(true);
    try { setInlineBans(await ModerationService.getRoomBans(_roomId)); } catch {}
    setBansLoading(false);
  }, [_roomId]);

  const loadRequests = useCallback(async () => {
    if (!_roomId) return;
    setRequestsLoading(true);
    try { setInlineRequests(await RoomAccessService.getPendingRequests(_roomId)); } catch {}
    setRequestsLoading(false);
  }, [_roomId]);

  const handleAcceptReq = useCallback(async (req: any) => {
    if (!_hostId) return;
    setProcessingIds(p => new Set(p).add(req.id));
    try {
      await RoomAccessService.approveRequest(req.id, _hostId);
      setInlineRequests(prev => prev.filter(r => r.id !== req.id));
      showToast({ title: '✅ Kabul Edildi', type: 'success' });
    } catch {} finally { setProcessingIds(p => { const n = new Set(p); n.delete(req.id); return n; }); }
  }, [_hostId]);

  const handleRejectReq = useCallback(async (req: any) => {
    if (!_hostId) return;
    setProcessingIds(p => new Set(p).add(req.id));
    try {
      await RoomAccessService.rejectRequest(req.id, _hostId);
      setInlineRequests(prev => prev.filter(r => r.id !== req.id));
      showToast({ title: '❌ Reddedildi', type: 'info' });
    } catch {} finally { setProcessingIds(p => { const n = new Set(p); n.delete(req.id); return n; }); }
  }, [_hostId]);

  const handleUnban = useCallback(async (ban: any) => {
    if (!_roomId || !_hostId) return;
    setProcessingIds(p => new Set(p).add(ban.id));
    try {
      await ModerationService.unbanFromRoom(_roomId, ban.user_id, _hostId);
      setInlineBans(prev => prev.filter(b => b.id !== ban.id));
      showToast({ title: '✅ Ban Kaldırıldı', type: 'success' });
    } catch { showToast({ title: 'Hata', type: 'error' }); }
    finally { setProcessingIds(p => { const n = new Set(p); n.delete(ban.id); return n; }); }
  }, [_roomId, _hostId]);

  const { translateValue: swipeX, panHandlers } = useSwipeToDismiss({
    direction: 'right', threshold: 60, onDismiss: onClose,
  });

  // Compact panel swipe-down
  const compactPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 10 && Math.abs(gs.dx) < 20,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) compactSlideY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 50 || gs.vy > 0.5) {
          Animated.timing(compactSlideY, { toValue: 300, duration: 200, useNativeDriver: true }).start(() => onClose());
        } else {
          Animated.spring(compactSlideY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 180 }),
        Animated.spring(compactSlideY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: PANEL_W, useNativeDriver: true, damping: 18, stiffness: 200 }),
        Animated.timing(compactSlideY, { toValue: 300, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
      setExpandedId(null);
    }
  }, [visible]);

  const toggle = useCallback((id: string) => {
    layoutAnim();
    setExpandedId(prev => {
      const next = prev === id ? null : id;
      // ★ Accordion açıldığında o satırı görünür alana kaydır
      if (next && scrollRef.current && rowRefs.current[id] !== undefined) {
        setTimeout(() => {
          scrollRef.current?.scrollTo({ y: Math.max(0, rowRefs.current[id] - 40), animated: true });
        }, 260);
      }
      return next;
    });
  }, []);

  if (!visible) return null;

  const isOwner = userRole === 'owner';
  const isMod = userRole === 'moderator';
  const isOnStage = isOwner || isMod || userRole === 'speaker';
  const role = ROLE_META[userRole] || ROLE_META.listener;
  const tier = (ownerTier || 'Free') as any;
  const can = (req: string) => isTierAtLeast(tier, req as any);
  const sc = settingsConfig;

  // ═══ Accordion İçerik Renderları ═══

  // 1️⃣ ODA BİLGİLERİ — SADECE isim/metin alanları (Erişim Tipi ve Şifre yeni "Giriş & Erişim" menüsüne taşındı)
  const renderRoomInfo = () => {
    if (!sc) return null;
    return (
      <View style={st.subWrap}>
        <InlineTextEditor icon="create-outline" label="Oda Adı" value={sc.roomName} onSave={sc.onRenameRoom} placeholder="Oda adı..." accent="#D4AF37" />
        <View style={st.sep} />
        {sc.onDescriptionChange && (
          <>
            <InlineTextEditor icon="information-circle-outline" label="Açıklama" value={sc.description || ''} onSave={sc.onDescriptionChange} placeholder="Odanın kısa açıklaması..." multiline accent="#14B8A6" />
            <View style={st.sep} />
          </>
        )}
        <InlineTextEditor icon="chatbubble-outline" label="Hoş Geldin" value={sc.welcomeMessage} onSave={sc.onWelcomeMessageChange} placeholder="Hoş geldin mesajı..." multiline accent="#3B82F6" />
        <View style={st.sep} />
        <InlineTextEditor icon="document-text-outline" label="Kurallar" value={sc.roomRules} onSave={sc.onRulesChange} placeholder="Oda kuralları..." multiline accent="#A78BFA" />
      </View>
    );
  };

  // 🔐 GİRİŞ & ERİŞİM (yeni) — "kime açık?" sorusunun TÜM cevabı burada
  // Önceden 3 farklı menüde dağılmıştı (Oda Bilgileri: tip/şifre + Moderasyon: kilit/yaş/dil/arkadaş + Monetizasyon: ücret)
  const renderAccess = () => {
    if (!sc) return null;
    return (
      <View style={st.subWrap}>
        <SettingChips icon="globe-outline" label="Oda Tipi" options={ROOM_TYPES.map(t => ({ id: t.id, label: t.label }))} value={sc.roomType} onSelect={can('Plus') ? sc.onRoomTypeChange : undefined} locked={!can('Plus')} lockTier="Plus" />
        {sc.roomType === 'closed' && can('Plus') && (
          <>
            <View style={st.sep} />
            <InlineTextEditor icon="key-outline" label="Şifre" value={sc.roomPassword || ''} onSave={sc.onPasswordChange || (() => {})} placeholder="Min 4 karakter" accent="#F59E0B" secureTextEntry maxLength={20} />
          </>
        )}
        <View style={st.sep} />
        <SettingChips icon="diamond-outline" label="Giriş Ücreti (SP)" options={ENTRY_FEES.map(f => ({ id: f, label: f === 0 ? 'Ücretsiz' : `${f}` }))} value={sc.entryFee} onSelect={can('Pro') ? sc.onEntryFeeChange : undefined} locked={!can('Pro')} lockTier="Pro" />
        <View style={st.sep} />
        <SettingToggle icon={isRoomLocked ? 'lock-closed' : 'lock-open-outline'} label="Odayı Kilitle (yeni giriş yok)" value={!!isRoomLocked} onValueChange={onRoomLock ? () => onRoomLock() : undefined} accent="#F59E0B" locked={!can('Plus')} lockTier="Plus" />
        <View style={st.sep} />
        <SettingToggle icon="warning-outline" label="+18 İçerik" value={sc.ageRestricted} onValueChange={can('Plus') ? sc.onAgeRestrictedChange : undefined} accent="#EF4444" locked={!can('Plus')} lockTier="Plus" />
        <View style={st.sep} />
        <SettingChips icon="language-outline" label="Dil Filtresi" options={LANGUAGES.map(l => ({ id: l.id, label: l.label }))} value={sc.roomLanguage} onSelect={can('Plus') ? sc.onLanguageChange : undefined} locked={!can('Plus')} lockTier="Plus" />
        <View style={st.sep} />
        <SettingToggle icon="people-outline" label="Sadece Arkadaşlar" value={sc.followersOnly} onValueChange={can('Pro') ? sc.onToggleFollowersOnly : undefined} accent="#D4AF37" locked={!can('Pro')} lockTier="Pro" />
      </View>
    );
  };

  // 2️⃣ KONUŞMA & SES — Owner/mod yetkileri + inline cihaz ayarları (role bazlı filter)
  const renderSpeaking = () => {
    const showOwnerControls = isOwner && sc;
    const showModControls = (isOwner || isMod) && sc;
    const showDeviceMic = isOnStage && deviceConfig; // mic mode/noise: sadece sahnedekiler için anlamlı
    const showDeviceSpeaker = !!deviceConfig; // hoparlör/kulaklık: herkese lazım

    return (
      <View style={st.subWrap}>
        {/* ── Owner Kontrolleri ── */}
        {showOwnerControls && (
          <>
            <SettingChips icon="mic-outline" label="Konuşma Modu" options={SPEAKING_MODES.map(m => ({ id: m.id, label: m.label }))} value={sc!.speakingMode} onSelect={(v: any) => { if (v === 'selected_only' && !can('Pro')) return; sc!.onSpeakingModeChange(v); }} />
            <View style={st.sep} />
          </>
        )}

        {/* ── Mod Kontrolleri (owner+mod) ── */}
        {showModControls && (
          <>
            <SettingChips icon="timer-outline" label="Slow Mode" options={SLOW_MODES.map(s => ({ id: s, label: s === 0 ? 'Yok' : `${s}s` }))} value={sc!.slowModeSeconds} onSelect={can('Plus') ? sc!.onSlowModeChange : undefined} locked={!can('Plus')} lockTier="Plus" />
            {onMuteAll && can('Pro') && (
              <>
                <View style={st.sep} />
                <Pressable style={({ pressed }) => [st.actionBtn, pressed && { opacity: 0.7 }]} onPress={() => { onMuteAll(); onClose(); }}>
                  <Ionicons name="volume-mute-outline" size={13} color="#EF4444" />
                  <Text style={st.actionBtnText}>Tümünü Sustur</Text>
                </Pressable>
              </>
            )}
            {onUnmuteAll && can('Pro') && (
              <>
                <View style={st.sep} />
                <Pressable style={({ pressed }) => [st.actionBtn, pressed && { opacity: 0.7 }]} onPress={() => { onUnmuteAll(); onClose(); }}>
                  <Ionicons name="volume-high-outline" size={13} color="#14B8A6" />
                  <Text style={[st.actionBtnText, { color: '#14B8A6' }]}>Tümünü Aç</Text>
                </Pressable>
              </>
            )}
          </>
        )}

        {/* ── Cihaz Ayarları (inline) ── */}
        {showDeviceMic && (
          <>
            {showModControls && <View style={st.sep} />}
            <View style={st.toggleRow}>
              <Ionicons name="mic" size={13} color="#14B8A6" />
              <Text style={st.toggleLabel}>Mikrofon Modu</Text>
              <View style={{ flexDirection: 'row', gap: 3 }}>
                {([
                  { id: 'normal' as const, label: 'Konuşma' },
                  { id: 'music' as const, label: 'Müzik' },
                ]).map(opt => {
                  const active = deviceConfig!.micMode === opt.id;
                  return (
                    <Pressable key={opt.id} onPress={() => deviceConfig!.onMicModeChange(opt.id)} style={[st.chip, active && st.chipActive]}>
                      <Text style={[st.chipText, active && st.chipTextActive]}>{opt.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={st.sep} />
            <SettingToggle
              icon="ear-outline"
              label="Gürültü Engelleme"
              value={deviceConfig!.micMode === 'music' ? false : deviceConfig!.noiseCancellation}
              onValueChange={deviceConfig!.micMode === 'music' ? undefined : deviceConfig!.onNoiseCancellationChange}
              accent="#4ADE80"
            />
          </>
        )}

        {showDeviceSpeaker && (
          <>
            {(showModControls || showDeviceMic) && <View style={st.sep} />}
            <View style={st.toggleRow}>
              <Ionicons name={deviceConfig!.useSpeaker ? 'volume-high' : 'headset'} size={13} color={deviceConfig!.useSpeaker ? '#F59E0B' : '#A78BFA'} />
              <Text style={st.toggleLabel}>{deviceConfig!.useSpeaker ? 'Hoparlör' : 'Kulaklık'}</Text>
              <Pressable
                onPress={() => deviceConfig!.onSpeakerChange(!deviceConfig!.useSpeaker)}
                style={[st.chip, deviceConfig!.useSpeaker && st.chipActive]}
              >
                <Text style={[st.chipText, deviceConfig!.useSpeaker && st.chipTextActive]}>
                  {deviceConfig!.useSpeaker ? 'Hoparlör' : 'Kulaklık'}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    );
  };

  // ~~3️⃣ MODERASYON~~ KALDIRILDI — tüm toggle'lar "Giriş & Erişim" menüsüne taşındı.
  // Banlılar & İstekler zaten ayrı top-level item.

  // 4️⃣ MONETİZASYON — Giriş Ücreti "Giriş & Erişim"e taşındı, burada sadece Bağış
  const renderMonetization = () => {
    if (!sc) return null;
    return (
      <View style={st.subWrap}>
        <SettingToggle icon="heart-outline" label="Bağış" value={sc.donationsEnabled} onValueChange={can('Pro') ? sc.onDonationsToggle : undefined} accent="#EC4899" locked={!can('Pro')} lockTier="Pro" />
      </View>
    );
  };

  // ★ 2026-04-20: İnline Banlılar
  const renderBans = () => (
    <View style={st.subWrap}>
      {bansLoading ? <ActivityIndicator color="#EF4444" style={{ marginVertical: 12 }} /> :
       inlineBans.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 16 }}>
          <Ionicons name="shield-checkmark" size={20} color="rgba(34,197,94,0.3)" />
          <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>Banlı kullanıcı yok 🎉</Text>
        </View>
      ) : inlineBans.map(ban => {
        const isPermanent = ban.ban_type === 'permanent';
        const expiresAt = ban.expires_at ? new Date(ban.expires_at) : null;
        const remainingMin = expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 60000)) : 0;
        const timeLabel = isPermanent ? 'Kalıcı' : remainingMin > 60 ? `${Math.floor(remainingMin / 60)}sa` : `${remainingMin}dk`;
        return (
          <View key={ban.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' }}>
            <Image source={getAvatarSource(ban.user?.avatar_url)} style={{ width: 28, height: 28, borderRadius: 14 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#F1F5F9' }} numberOfLines={1}>{ban.user?.display_name || 'Kullanıcı'}</Text>
              <Text style={{ fontSize: 8, color: isPermanent ? '#EF4444' : '#F59E0B', fontWeight: '700' }}>{isPermanent ? '⛔ KALICI' : `⏳ ${timeLabel}`}</Text>
            </View>
            {processingIds.has(ban.id) ? <ActivityIndicator size="small" color="#14B8A6" /> : (
              <Pressable onPress={() => handleUnban(ban)} style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(20,184,166,0.08)', borderWidth: 1, borderColor: 'rgba(20,184,166,0.18)' }}>
                <Text style={{ fontSize: 9, fontWeight: '700', color: '#14B8A6' }}>Kaldır</Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );

  // ★ 2026-04-20: İnline İstekler
  const renderRequestsInline = () => (
    <View style={st.subWrap}>
      {requestsLoading ? <ActivityIndicator color="#A78BFA" style={{ marginVertical: 12 }} /> :
       inlineRequests.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 16 }}>
          <Ionicons name="checkmark-circle" size={20} color="rgba(167,139,250,0.25)" />
          <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>Bekleyen istek yok</Text>
        </View>
      ) : inlineRequests.map(req => (
        <View key={req.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' }}>
          <Image source={getAvatarSource(req.user?.avatar_url)} style={{ width: 28, height: 28, borderRadius: 14 }} />
          <Text style={{ flex: 1, fontSize: 11, fontWeight: '600', color: '#F1F5F9' }} numberOfLines={1}>{req.user?.display_name || 'Kullanıcı'}</Text>
          {processingIds.has(req.id) ? <ActivityIndicator size="small" color="#A78BFA" /> : (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <Pressable onPress={() => handleAcceptReq(req)} style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: '#14B8A6', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="checkmark" size={14} color="#FFF" />
              </Pressable>
              <Pressable onPress={() => handleRejectReq(req)} style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                <Ionicons name="close" size={14} color="#94A3B8" />
              </Pressable>
            </View>
          )}
        </View>
      ))}
    </View>
  );

  // 5️⃣ GÖRSEL & TEMA
  const renderVisual = () => {
    if (!sc) return null;
    return (
      <View style={st.subWrap}>
        {can('Plus') ? (
          <>
            <View style={st.chipRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                <Ionicons name="color-palette-outline" size={12} color="#64748B" />
                <Text style={st.chipLabel}>Tema</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 4, paddingRight: 8 }}>
                  <Pressable style={[st.themeChip, !sc.themeId && st.themeChipActive]} onPress={() => sc.onThemeChange(null)}>
                    <View style={[st.themeColor, { backgroundColor: '#1E293B' }]} />
                    <Text style={[st.chipText, !sc.themeId && st.chipTextActive]}>Yok</Text>
                  </Pressable>
                  {Object.entries(ROOM_THEMES).map(([id, theme]) => (
                    <Pressable key={id} style={[st.themeChip, sc.themeId === id && st.themeChipActive]} onPress={() => sc.onThemeChange(id)}>
                      <View style={[st.themeColor, { backgroundColor: theme.colors[0] }]} />
                      <Text style={[st.chipText, sc.themeId === id && st.chipTextActive]}>{theme.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
            <View style={st.sep} />
          </>
        ) : (
          <View style={st.chipRow}>
            <Ionicons name="lock-closed" size={12} color="#475569" />
            <Text style={[st.chipLabel, { color: '#475569', marginLeft: 4 }]}>Tema</Text>
            <View style={st.tierPill}><Text style={st.tierPillText}>Plus+</Text></View>
          </View>
        )}

        {/* Arka Plan Resmi — Plus+ */}
        <View style={st.toggleRow}>
          <Ionicons name="image-outline" size={13} color={can('Plus') ? '#A78BFA' : '#475569'} />
          <Text style={[st.toggleLabel, !can('Plus') && { color: '#475569' }]}>Arka Plan</Text>
          {can('Plus') ? (
            sc.backgroundImage ? (
              <Pressable hitSlop={6} onPress={sc.onRemoveBackgroundImage}>
                <Ionicons name="close-circle" size={16} color="#EF4444" />
              </Pressable>
            ) : (
              <Pressable hitSlop={6} onPress={sc.onPickBackgroundImage}>
                <Ionicons name="cloud-upload-outline" size={14} color="#A78BFA" />
              </Pressable>
            )
          ) : (
            <View style={st.tierPill}><Text style={st.tierPillText}>Plus+</Text></View>
          )}
        </View>
        <View style={st.sep} />

        {/* ★ 2026-04-21: Kart Görseli — artık herkes (oluşturma ile aynı kural). */}
        <View style={st.toggleRow}>
          <Ionicons name="albums-outline" size={13} color="#D4AF37" />
          <Text style={st.toggleLabel}>Kart Görseli</Text>
          {sc.coverImage ? (
            <Pressable hitSlop={6} onPress={sc.onRemoveCoverImage}>
              <Ionicons name="close-circle" size={16} color="#EF4444" />
            </Pressable>
          ) : (
            <Pressable hitSlop={6} onPress={sc.onPickCoverImage}>
              <Ionicons name="cloud-upload-outline" size={14} color="#D4AF37" />
            </Pressable>
          )}
        </View>
        <View style={st.sep} />

        {/* Müzik Linki — Pro+ (YouTube/Spotify/SoundCloud) */}
        {can('Pro') ? (
          <InlineTextEditor icon="musical-notes-outline" label="Müzik Linki"
            value={sc.musicLink || ''}
            onSave={(v) => sc.onMusicLinkChange(v.trim() || null)}
            placeholder="https://youtube.com/... veya https://spotify.com/..."
            accent="#FFD700"
          />
        ) : (
          <View style={st.chipRow}>
            <Ionicons name="lock-closed" size={12} color="#475569" />
            <Text style={[st.chipLabel, { color: '#475569' }]}>Oda Müzik Linki</Text>
            <View style={st.tierPill}><Text style={st.tierPillText}>Pro+</Text></View>
          </View>
        )}
      </View>
    );
  };

  // 6️⃣ DAVET & PAYLAŞ
  const renderInvite = () => (
    <View style={st.subWrap}>
      <Pressable style={({ pressed }) => [s.subRow, pressed && s.subRowPressed]} onPress={() => { onInviteFriends(); onClose(); }}>
        <View style={s.subIconCircle}><Ionicons name="people-outline" size={13} color="#14B8A6" style={s.iconShadow} /></View>
        <Text style={s.subLabel}>Arkadaşlarını Davet Et</Text>
        <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.15)" />
      </Pressable>
      <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.03)' }} />
      <Pressable style={({ pressed }) => [s.subRow, pressed && s.subRowPressed]} onPress={() => { onShareLink(); onClose(); }}>
        <View style={s.subIconCircle}><Ionicons name="link-outline" size={13} color="#3B82F6" style={s.iconShadow} /></View>
        <Text style={s.subLabel}>Oda Linkini Paylaş</Text>
        <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.15)" />
      </Pressable>
    </View>
  );

  // 7️⃣ İSTATİSTİKLER & BOOST
  const renderStats = () => (
    <View style={st.subWrap}>
      {/* ★ Takipçi sayısı */}
      <View style={st.toggleRow}>
        <Ionicons name="people-circle-outline" size={13} color="#EC4899" />
        <Text style={st.toggleLabel}>Oda Takipçileri</Text>
        <View style={{ backgroundColor: 'rgba(236,72,153,0.12)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 0.5, borderColor: 'rgba(236,72,153,0.25)' }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: '#EC4899', textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}>{followerCount}</Text>
        </View>
      </View>
      <View style={st.sep} />
      <Pressable style={({ pressed }) => [s.subRow, pressed && s.subRowPressed]} onPress={() => { onRoomStats?.(); onClose(); }}>
        <View style={s.subIconCircle}><Ionicons name="analytics-outline" size={13} color="#3B82F6" style={s.iconShadow} /></View>
        <Text style={s.subLabel}>Oda İstatistikleri</Text>
        <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.15)" />
      </Pressable>
      {onBoostRoom && can('Plus') && (
        <>
          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.03)' }} />
          <Pressable style={({ pressed }) => [s.subRow, pressed && s.subRowPressed]} onPress={() => { onBoostRoom(); onClose(); }}>
            <View style={s.subIconCircle}><Ionicons name="rocket-outline" size={13} color="#F59E0B" style={s.iconShadow} /></View>
            <Text style={s.subLabel}>Keşfette Öne Çıkar</Text>
            <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.15)" />
          </Pressable>
        </>
      )}
    </View>
  );

  // ═══ Menü Öğelerini Oluştur ═══
  type MenuItem = {
    id: string; icon: string; label: string; desc?: string;
    accent: string; onPress: () => void; destructive?: boolean;
    badge?: number; expandable?: boolean; renderContent?: () => React.ReactNode;
  };
  const items: MenuItem[] = [];

  if (isOwner && sc) {
    // 1. Oda Bilgileri (yalnız isim/kurallar/hoş geldin)
    items.push({ id: 'room_info', icon: 'information-circle-outline', label: 'Oda Bilgileri', accent: '#D4AF37', onPress: () => toggle('room_info'), expandable: true, renderContent: renderRoomInfo });
    // 2. Konuşma & Ses
    items.push({ id: 'speaking', icon: 'mic-outline', label: 'Konuşma & Ses', accent: '#14B8A6', onPress: () => toggle('speaking'), expandable: true, renderContent: renderSpeaking });
    // ★ 2026-04-20: Giriş & Erişim — "kime açık?" sorusunun tek merkezi.
    //   Önceden 3 farklı menüde dağılmış (tip, şifre, ücret, kilit, yaş, dil, arkadaş).
    items.push({ id: 'access', icon: 'key-outline', label: 'Giriş & Erişim', accent: '#F59E0B', onPress: () => toggle('access'), expandable: true, renderContent: renderAccess });
    // ★ 2026-04-20: Banlılar & İstekler — ayrı inline accordion (modal kaldırıldı)
    if ((_roomType === 'closed' || _roomType === 'invite') && _roomId) {
      items.push({ id: 'requests', icon: 'hourglass-outline', label: 'Katılım İstekleri', accent: '#A78BFA', badge: micRequestCount, onPress: () => { if (expandedId !== 'requests') loadRequests(); toggle('requests'); }, expandable: true, renderContent: renderRequestsInline });
    }
    if (_roomId) {
      items.push({ id: 'bans', icon: 'ban-outline', label: 'Banlılar', accent: '#EF4444', onPress: () => { if (expandedId !== 'bans') loadBans(); toggle('bans'); }, expandable: true, renderContent: renderBans });
    }
    // 4. Bağış Ayarları (sadece Bağış toggle kaldı)
    items.push({ id: 'monetization', icon: 'heart-outline', label: 'Bağış Ayarları', accent: '#EC4899', onPress: () => toggle('monetization'), expandable: true, renderContent: renderMonetization });
    // 5. Görsel & Tema
    items.push({ id: 'visual', icon: 'color-palette-outline', label: 'Görsel & Tema', accent: '#F59E0B', onPress: () => toggle('visual'), expandable: true, renderContent: renderVisual });
  } else if (isMod) {
    // Moderatör: Konuşma & Ses (slow mode + cihaz) + Banlılar & İstekler
    items.push({ id: 'speaking', icon: 'mic-outline', label: 'Konuşma & Ses', accent: '#14B8A6', onPress: () => toggle('speaking'), expandable: true, renderContent: renderSpeaking });
    // ★ İstekler + Banlılar inline (moderatör)
    if ((_roomType === 'closed' || _roomType === 'invite') && _roomId) {
      items.push({ id: 'requests', icon: 'hourglass-outline', label: 'Katılım İstekleri', accent: '#A78BFA', badge: micRequestCount, onPress: () => { if (expandedId !== 'requests') loadRequests(); toggle('requests'); }, expandable: true, renderContent: renderRequestsInline });
    }
    if (_roomId) {
      items.push({ id: 'bans', icon: 'ban-outline', label: 'Banlılar', accent: '#EF4444', onPress: () => { if (expandedId !== 'bans') loadBans(); toggle('bans'); }, expandable: true, renderContent: renderBans });
    }
  } else if (deviceConfig) {
    // ★ Speaker/Listener: Sadece cihaz ayarları (hoparlör + sahnedeyse mic/noise)
    items.push({ id: 'speaking', icon: 'headset-outline', label: 'Konuşma & Ses', accent: '#3B82F6', onPress: () => toggle('speaking'), expandable: true, renderContent: renderSpeaking });
  }

  // 6. Davet & Paylaş (sahnedekiler)
  if (isOnStage) {
    items.push({ id: 'invite', icon: 'person-add-outline', label: 'Davet & Paylaş', accent: '#14B8A6', onPress: () => toggle('invite'), expandable: true, renderContent: renderInvite });
  } else {
    items.push({ id: 'share', icon: 'share-social-outline', label: 'Oda Linkini Paylaş', accent: '#3B82F6', onPress: () => { onShareLink(); onClose(); } });
  }

  // 7. İstatistikler & Boost
  if (isOwner && onRoomStats && can('Pro')) {
    items.push({ id: 'stats', icon: 'stats-chart-outline', label: 'İstatistikler & Boost', accent: '#3B82F6', onPress: () => toggle('stats'), expandable: true, renderContent: renderStats });
  } else if (isOwner && onBoostRoom && can('Plus')) {
    items.push({ id: 'boost', icon: 'rocket-outline', label: 'Keşfette Öne Çıkar', accent: '#F59E0B', onPress: () => { onBoostRoom(); onClose(); } });
  }

  // Takip (listener)
  if (!isOwner && onToggleFollow) {
    items.push({ id: 'follow', icon: isFollowingRoom ? 'heart' : 'heart-outline', label: isFollowingRoom ? 'Takibi Bırak' : 'Odayı Takip Et', accent: isFollowingRoom ? '#EF4444' : '#EC4899', onPress: () => { onToggleFollow(); onClose(); } });
  }
  // Bildir (listener)
  if (!isOnStage && onReportRoom) {
    items.push({ id: 'report', icon: 'flag-outline', label: 'Odayı Bildir', accent: '#EF4444', onPress: () => { onReportRoom(); onClose(); }, destructive: true });
  }

  // ★ Bağış Yap (host olmayan herkes, bağış açıkken)
  if (!isOwner && isDonationsEnabled && onDonate) {
    items.push({ id: 'donate', icon: 'heart', label: 'Bağış Yap', desc: 'Host\'a SP bağışla', accent: '#EF4444', onPress: () => { onDonate(); onClose(); } });
  }

  // Dondur & Sil (owner, direkt aksiyon)
  if (isOwner && sc?.onFreezeRoom) {
    items.push({ id: 'freeze', icon: 'snow-outline', label: 'Odayı Dondur', desc: 'Katılımcılar çıkar, sonra tekrar aç', accent: '#3B82F6', onPress: () => { onClose(); sc.onFreezeRoom?.(); } });
  }

  // ★ Odadan Ayrıl — tüm roller için (owner'da host transfer / moderator/speaker/listener normal çıkış)
  if (onLeaveRoom) {
    items.push({
      id: 'leave',
      icon: 'exit-outline',
      label: 'Odadan Ayrıl',
      desc: isOwner ? 'Oda açık kalır, sahiplik devri yapılır' : 'Odayı terk et',
      accent: '#F59E0B',
      onPress: () => { onClose(); onLeaveRoom(); },
    });
  }

  if (isOwner && onDeleteRoom) {
    items.push({ id: 'delete', icon: 'trash-outline', label: 'Odayı Sil', desc: 'Kalıcı olarak siler, geri alınamaz', accent: '#EF4444', onPress: () => { onDeleteRoom(); onClose(); }, destructive: true });
  }

  // ★ 2026-04-20: Tüm roller aynı sağdan-kayan drawer kullanır (compact bottom-sheet
  // kaldırıldı — kullanıcı talebi: "listener modal owner gibi yanal açılır olsun")
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[s.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View {...panHandlers} style={[s.panel, { bottom: bottomInset + 70, top: IS_SMALL_SCREEN ? 40 : 60, transform: [{ translateX: Animated.add(slideAnim, swipeX) }] }]}>
        {/* ★ FriendsDrawer paleti — diagonal warm-neutral gradient */}
        <LinearGradient
          colors={['#4a5668', '#37414f', '#232a35']}
          locations={[0, 0.35, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Header */}
        <View style={s.header}>
          <View style={[s.headerDot, { backgroundColor: role.color }]} />
          <Text style={s.headerTitle}>Menü</Text>
          <View style={[s.rolePill, { backgroundColor: role.color + '22', borderColor: role.color + '35' }]}>
            <Ionicons name={role.icon as any} size={10} color={role.color} />
            <Text style={[s.roleLabel, { color: role.color }]}>{role.label}</Text>
          </View>
          {/* ★ Kapatma butonu — swipe-to-dismiss yerine ek olarak */}
          <Pressable onPress={onClose} hitSlop={10} style={s.closeBtn}>
            <Ionicons name="close" size={16} color="rgba(255,255,255,0.5)" />
          </Pressable>
        </View>

        <ScrollView ref={scrollRef} bounces={false} showsVerticalScrollIndicator={true} scrollIndicatorInsets={{ right: 1 }} contentContainerStyle={{ paddingVertical: 4, paddingBottom: 12 }} nestedScrollEnabled>
          {items.map((item, i) => {
            const isExpanded = expandedId === item.id;
            return (
              <View key={item.id}
                onLayout={(e) => { rowRefs.current[item.id] = e.nativeEvent.layout.y; }}
              >
                <Pressable
                  onPress={item.onPress}
                  android_ripple={{ color: 'transparent' }}
                  style={({ pressed }) => [
                    s.row, pressed && s.rowPressed,
                    isExpanded && s.rowExpanded,
                    i < items.length - 1 && !isExpanded && s.rowBorder,
                  ]}
                >
                  <View style={s.iconCircle}>
                    <Ionicons name={item.icon as any} size={IS_SMALL_SCREEN ? 14 : 16} color={item.destructive ? '#EF4444' : item.accent} style={s.iconShadow} />
                  </View>
                  <View style={s.rowText}>
                    <Text style={[s.rowLabel, item.destructive && { color: '#EF4444' }]} numberOfLines={1}>{item.label}</Text>
                    {item.desc && <Text style={s.rowDesc} numberOfLines={1}>{item.desc}</Text>}
                  </View>
                  {item.badge && item.badge > 0 ? (
                    <View style={s.badge}><Text style={s.badgeText}>{item.badge > 9 ? '9+' : item.badge}</Text></View>
                  ) : null}
                  {item.expandable && (
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color="rgba(255,255,255,0.25)" />
                  )}
                </Pressable>

                {/* Accordion içerik — lazy render */}
                {item.expandable && isExpanded && item.renderContent?.()}
              </View>
            );
          })}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

// Geriye uyumluluk
export function AdvancedSettingsPanel({ visible }: { visible: boolean;[key: string]: any }) {
  return null;
}

// ═══════════════════════════════════════════════════════
// STİLLER
// ═══════════════════════════════════════════════════════
const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  panel: {
    // ★ 2026-04-20: Full-height responsive panel — küçük ekranlarda daha fazla alan kullanır.
    // top + bottom ile esnek yükseklik — maxHeight kaldırıldı, absolute pozisyonla hesaplanır.
    position: 'absolute', right: 0,
    width: PANEL_W,
    borderTopLeftRadius: 22, borderBottomLeftRadius: 22,
    borderWidth: 1, borderRightWidth: 0,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: -6, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 16,
  },
  compactPanel: {
    position: 'absolute',
    left: 0, right: 0,
    zIndex: 50,
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingBottom: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 20,
  },
  compactHandle: { alignItems: 'center', paddingVertical: 8 },
  compactHandleBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerDot: { width: 6, height: 6, borderRadius: 3 },
  headerTitle: {
    flex: 1, fontSize: 14, fontWeight: '700', color: '#F1F5F9',
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  rolePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1,
  },
  roleLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.3, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  closeBtn: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: IS_SMALL_SCREEN ? 7 : 10,
    paddingVertical: IS_SMALL_SCREEN ? 9 : 11, paddingHorizontal: IS_SMALL_SCREEN ? 10 : 12,
  },
  rowPressed: { backgroundColor: 'rgba(20,184,166,0.08)' },
  rowExpanded: { backgroundColor: 'rgba(255,255,255,0.03)' },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  iconCircle: { width: IS_SMALL_SCREEN ? 26 : 30, height: IS_SMALL_SCREEN ? 26 : 30, justifyContent: 'center', alignItems: 'center' },
  iconShadow: { textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 3 },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 12, fontWeight: '600', color: '#F1F5F9', letterSpacing: 0.1, textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  rowDesc: { fontSize: 9, color: '#64748B', marginTop: 1, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  badge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#14B8A6', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  badgeText: { fontSize: 9, fontWeight: '800', color: '#FFF', textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 10 },
  subRowPressed: { backgroundColor: 'rgba(20,184,166,0.1)' },
  subIconCircle: { width: 24, height: 24, justifyContent: 'center', alignItems: 'center' },
  subLabel: { flex: 1, fontSize: 11, fontWeight: '600', color: '#CBD5E1', letterSpacing: 0.1, textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
});

const st = StyleSheet.create({
  subWrap: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderLeftWidth: 2, borderLeftColor: 'rgba(20,184,166,0.15)',
    marginLeft: 20, marginRight: 8, borderRadius: 8,
    marginBottom: 4, overflow: 'hidden', paddingVertical: 2,
  },
  sep: { height: 1, backgroundColor: 'rgba(255,255,255,0.04)', marginHorizontal: 10 },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  toggleLabel: { flex: 1, fontSize: 11, fontWeight: '600', color: '#CBD5E1', textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  chipRow: { paddingHorizontal: 10, paddingVertical: 5 },
  chipLabel: { fontSize: 10, fontWeight: '600', color: '#64748B', textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  chip: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
  },
  chipActive: { backgroundColor: 'rgba(20,184,166,0.15)', borderColor: 'rgba(20,184,166,0.35)' },
  chipText: { fontSize: 9, fontWeight: '600', color: '#64748B', textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  chipTextActive: { color: '#14B8A6', fontWeight: '700' },
  tierPill: {
    paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4,
    backgroundColor: 'rgba(212,175,55,0.1)', borderWidth: 0.5, borderColor: 'rgba(212,175,55,0.2)',
  },
  tierPillText: { fontSize: 7, fontWeight: '800', color: '#D4AF37', textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7 },
  actionBtnText: { fontSize: 11, fontWeight: '600', color: '#EF4444', textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  themeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
  },
  themeChipActive: { backgroundColor: 'rgba(20,184,166,0.15)', borderColor: 'rgba(20,184,166,0.35)' },
  themeColor: { width: 10, height: 10, borderRadius: 5 },
  editorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  editorLabel: { fontSize: 10, fontWeight: '600', color: '#64748B', width: 60, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  editorValue: { flex: 1, fontSize: 10, color: '#CBD5E1', fontWeight: '500', textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  editorExpanded: { paddingHorizontal: 10, paddingVertical: 5 },
  editorInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 6, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8, paddingVertical: 4,
    fontSize: 10, color: '#F1F5F9', height: 28,
  },
});
