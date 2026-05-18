import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Animated,
  Dimensions, LayoutAnimation, Platform, UIManager, Switch, TextInput, PanResponder,
  Image,
} from 'react-native';
import AppLoader from '../AppLoader';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { isTierAtLeast } from '../../constants/tiers';
import { useSwipeToDismiss } from '../../hooks/useSwipeToDismiss';
import { Colors } from '../../constants/theme';
import { RoomAccessService } from '../../services/roomAccess';
import { ModerationService } from '../../services/moderation';
import { getAvatarSource } from '../../constants/avatars';
import { showToast } from '../Toast';
import { supabase } from '../../constants/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { i18n } from '../../services/i18n';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: W, height: H } = Dimensions.get('window');
// ★ 2026-04-20: Responsive panel genişlik — küçük telefonlarda daha geniş oran
const IS_SMALL_SCREEN = W <= 375;
// ★ 2026-05-05: Keşfet drawer dili — birebir aynı boyut (NotificationDrawer ile).
const PANEL_W = Math.min(W * 0.72, 300);
const ROOM_TOP_GAP = 70;
const ROOM_BOTTOM_GAP = 90;

const layoutAnim = () => LayoutAnimation.configureNext({
  duration: 220,
  create: { type: 'easeInEaseOut', property: 'opacity' },
  update: { type: 'easeInEaseOut' },
  delete: { type: 'easeInEaseOut', property: 'opacity' },
});

// ═══ Sabitler ═══
const SPEAKING_MODES = [
  { id: 'free_for_all', label: 'Serbest' },
  { id: 'permission_only', label: i18n.t('room.roomoverlays.001') },
  { id: 'selected_only', label: i18n.t('room.roomoverlays.002') },
] as const;
const SLOW_MODES = [0, 5, 15, 30, 60];
const ENTRY_FEES = [0, 25, 50, 100, 250, 500]; // ★ Genişletildi: host'ların gelir potansiyeli artırıldı
const LANGUAGES = [
  { id: 'tr', label: 'TR' }, { id: 'en', label: 'EN' },
  { id: 'ar', label: 'AR' }, { id: 'de', label: 'DE' },
];
const ROOM_THEMES: Record<string, { name: string; colors: [string, string] }> = {
  ocean: { name: 'Okyanus', colors: ['#0E4D6F', '#083344'] },
  sunset: { name: i18n.t('room.roomoverlays.003'), colors: ['#7F1D1D', '#4C0519'] },
  forest: { name: 'Orman', colors: ['#14532D', '#052E16'] },
  galaxy: { name: 'Galaksi', colors: ['#312E81', '#1E1B4B'] },
  aurora: { name: 'Aurora', colors: ['#134E4A', '#042F2E'] },
  cherry: { name: 'Kiraz', colors: ['#831843', '#500724'] },
  cyber: { name: 'Cyber', colors: ['#1E3A8A', '#172554'] },
  volcano: { name: 'Volkan', colors: ['#7C2D12', '#431407'] },
  midnight: { name: 'Gece', colors: ['#0C0A3E', '#1B1464'] },
  rose: { name: i18n.t('room.roomoverlays.004'), colors: ['#9F1239', '#881337'] },
  arctic: { name: 'Kutup', colors: ['#164E63', '#0E7490'] },
  amber: { name: 'Kehribar', colors: ['#78350F', '#92400E'] },
  slate: { name: 'Arduvaz', colors: ['#1E293B', '#334155'] },
};
const ROOM_TYPES = [
  { id: 'open', label: i18n.t('room.roomoverlays.005'), icon: 'globe-outline' },
  { id: 'closed', label: i18n.t('room.roomoverlays.006'), icon: 'lock-closed-outline' },
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
  /** ★ v92.14 (1 May 2026): Bekleyen oda erişim isteği sayısı — "Katılım İstekleri"
   *  accordion satırında badge olarak görünür. micRequestCount (sahneye çıkma)
   *  ile karıştırılmamalı; bu kapalı odaya GİRMEK isteyen kullanıcı sayısıdır. */
  accessRequestCount?: number;
  userRole?: 'owner' | 'moderator' | 'speaker' | 'listener';
  ownerTier?: string;
  onMuteAll?: () => void;
  onUnmuteAll?: () => void;
  onRoomStats?: () => void;
  onDeleteRoom?: () => void;
  onBoostRoom?: () => void;
  /** ★ v92 (1 May 2026): Güçlendiriciler sheet'i açar — Süre Uzat, Altın Davet, vb. */
  onPowerUps?: () => void;
  /** ★ v92.11 (1 May 2026): Oda takipçi listesini sheet ile gösterir (host'a). */
  onShowFollowers?: () => void;
  onToggleFollow?: () => void;
  isFollowingRoom?: boolean;
  settingsConfig?: SettingsConfig;
  followerCount?: number;
  onDonate?: () => void;
  isDonationsEnabled?: boolean;
  bottomInset?: number;
  // ★ Odadan ayrıl — tüm rollerde erişilebilir; owner'da host transfer uyarısı backend'de
  onLeaveRoom?: () => void;
  // ★ 2026-05-10 v111b: Mesajları Temizle (Plus/Pro/GodMaster host only)
  onClearMessages?: () => void;
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
  // ★ 2026-04-27: Asıl sahip dışarda iken devralan geçici host. Kritik aksiyonlar
  // (silme, dondurma, boost, oda ayarları) gizlenir; moderasyon erişimi açık.
  isTempHost?: boolean;
};

const ROLE_META: Record<string, { labelKey: string; color: string; icon: string }> = {
  owner: { labelKey: 'rooms.menu.owner_chip', color: '#D4AF37', icon: 'star' },
  moderator: { labelKey: 'rooms.role_moderator', color: '#A78BFA', icon: 'shield-checkmark' },
  speaker: { labelKey: 'rooms.role_speaker', color: '#14B8A6', icon: 'mic' },
  listener: { labelKey: 'rooms.role_listener', color: '#94A3B8', icon: 'headset' },
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
          <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}>{i18n.t('room.roomoverlays.001')}</Text>
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
  isRoomLocked, micRequestCount, accessRequestCount,
  userRole = 'listener',
  ownerTier = 'Free',
  onMuteAll, onUnmuteAll, onRoomStats, onDeleteRoom,
  onBoostRoom, onPowerUps, onShowFollowers, onToggleFollow, isFollowingRoom,
  settingsConfig,
  followerCount = 0,
  onDonate, isDonationsEnabled,
  bottomInset = 14,
  onLeaveRoom, deviceConfig,
  onClearMessages,
  roomId: _roomId, hostId: _hostId, roomType: _roomType,
  isTempHost = false,
}: PlusMenuProps) {
  const insets = useSafeAreaInsets();
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
    try { setInlineRequests(await RoomAccessService.getPendingRequests(_roomId, _hostId)); } catch {}
    setRequestsLoading(false);
  }, [_roomId, _hostId]);

  // ★ v92.16 (1 May 2026): PlusMenu açıkken erişim isteklerini POLLING ile yenile.
  //   Realtime postgres_changes Firebase JWT'siz çalışmıyordu (Realtime anon kullanıyor).
  //   REST üzerinden 4 sn'de bir refetch — Firebase JWT factory ile RLS host_id eşleşir.
  //   PlusMenu kapalıyken interval temizlenir (idle iken poll yok).
  useEffect(() => {
    if (!visible || !_roomId) return;
    const isClosed = _roomType === 'closed' || _roomType === 'invite';
    if (!isClosed) return;
    loadRequests();
    const interval = setInterval(loadRequests, 4000);
    return () => { clearInterval(interval); };
  }, [visible, _roomId, _roomType, loadRequests]);

  // ★ v92.15 (1 May 2026): Bekleyen istek varsa PlusMenu açılır açılmaz "Katılım İstekleri"
  //   accordion'unu OTOMATİK aç. Önceden host menüyü açıp kendisi tıklamak zorundaydı —
  //   kullanıcı şikâyet etti ("onay/ret mekanizması yok"). Artık menü açıldığında
  //   pending istek varsa direkt onay/ret butonları görünür.
  useEffect(() => {
    if (!visible) return;
    const pending = (accessRequestCount ?? 0) > 0 || inlineRequests.length > 0;
    if (pending && expandedId !== 'requests') {
      setExpandedId('requests');
    }
  }, [visible, accessRequestCount, inlineRequests.length]);

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
      // ★ v1.7.13 (18 May 2026): i18n key shift fix — eskiden 'roomoverlays.007/008/009'
      //   kullanılıyordu ama bu key'ler "Oda Müzik Linki" / "Arkadaşlarını Davet Et" /
      //   "Oda Linkini Paylaş" değerlerini taşıyordu (locale dedup shift mağduru).
      //   Doğru anlamlı key'ler RoomManageSheet'tekilerle aynı: 040/041.
      showToast({ title: i18n.t('room.roommanagesheet.040'), type: 'success' });
    } catch { showToast({ title: i18n.t('room.roommanagesheet.041'), message: 'Tekrar dene.', type: 'error' }); }
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

  // ★ 2026-04-23: Internal mount — kapanış animasyonu bitince unmount, aksi halde kesik görünür
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      swipeX.setValue(0); // ★ double-drag fix: önceki swipe offset'ini sıfırla
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 180 }),
        Animated.spring(compactSlideY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: PANEL_W, duration: 220, useNativeDriver: true }),
        Animated.timing(compactSlideY, { toValue: 300, duration: 220, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
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

  if (!mounted) return null;

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
        <InlineTextEditor icon="create-outline" label={i18n.t('room.roomoverlays.025')} value={sc.roomName} onSave={sc.onRenameRoom} placeholder={i18n.t('room.roomoverlays.013')} accent="#D4AF37" />
        <View style={st.sep} />
        {sc.onDescriptionChange && (
          <>
            <InlineTextEditor icon="information-circle-outline" label={i18n.t('room.roomoverlays.026')} value={sc.description || ''} onSave={sc.onDescriptionChange} placeholder={i18n.t('room.roomoverlays.014')} multiline accent="#14B8A6" />
            <View style={st.sep} />
          </>
        )}
        <InlineTextEditor icon="chatbubble-outline" label={i18n.t('room.roomoverlays.027')} value={sc.welcomeMessage} onSave={sc.onWelcomeMessageChange} placeholder={i18n.t('room.roomoverlays.015')} multiline accent="#3B82F6" />
        <View style={st.sep} />
        <InlineTextEditor icon="document-text-outline" label="Kurallar" value={sc.roomRules} onSave={sc.onRulesChange} placeholder={i18n.t('room.roomoverlays.016')} multiline accent="#A78BFA" />
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
            <InlineTextEditor icon="key-outline" label={i18n.t('room.roomoverlays.028')} value={sc.roomPassword || ''} onSave={sc.onPasswordChange || (() => {})} placeholder="Min 4 karakter" accent="#F59E0B" secureTextEntry maxLength={20} />
          </>
        )}
        <View style={st.sep} />
        <SettingToggle icon={isRoomLocked ? 'lock-closed' : 'lock-open-outline'} label={i18n.t('room.roomoverlays.029')} value={!!isRoomLocked} onValueChange={onRoomLock ? () => onRoomLock() : undefined} accent="#F59E0B" locked={!can('Plus')} lockTier="Plus" />
        <View style={st.sep} />
        <SettingToggle icon="warning-outline" label={i18n.t('room.roomoverlays.030')} value={sc.ageRestricted} onValueChange={can('Plus') ? sc.onAgeRestrictedChange : undefined} accent="#EF4444" locked={!can('Plus')} lockTier="Plus" />
        <View style={st.sep} />
        <SettingChips icon="language-outline" label="Dil Filtresi" options={LANGUAGES.map(l => ({ id: l.id, label: l.label }))} value={sc.roomLanguage} onSelect={can('Plus') ? sc.onLanguageChange : undefined} locked={!can('Plus')} lockTier="Plus" />
        <View style={st.sep} />
        {/* ★ 2026-04-27: Pro → Plus indirildi — oda yönetim aracı (kim girebilir engeli). */}
        <SettingToggle icon="people-outline" label={i18n.t('room.roomoverlays.031')} value={sc.followersOnly} onValueChange={can('Plus') ? sc.onToggleFollowersOnly : undefined} accent="#A78BFA" locked={!can('Plus')} lockTier="Plus" />
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
            <SettingChips icon="mic-outline" label={i18n.t('room.roomoverlays.032')} options={SPEAKING_MODES.map(m => ({ id: m.id, label: m.label }))} value={sc!.speakingMode} onSelect={(v: any) => { if (v === 'selected_only' && !can('Pro')) return; sc!.onSpeakingModeChange(v); }} />
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
                  <Text style={st.actionBtnText}>{i18n.t('room.roomoverlays.002')}</Text>
                </Pressable>
              </>
            )}
            {onUnmuteAll && can('Pro') && (
              <>
                <View style={st.sep} />
                <Pressable style={({ pressed }) => [st.actionBtn, pressed && { opacity: 0.7 }]} onPress={() => { onUnmuteAll(); onClose(); }}>
                  <Ionicons name="volume-high-outline" size={13} color="#14B8A6" />
                  <Text style={[st.actionBtnText, { color: '#14B8A6' }]}>{i18n.t('room.roomoverlays.003')}</Text>
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
                  { id: 'normal' as const, label: i18n.t('room.roomoverlays.010') },
                  { id: 'music' as const, label: i18n.t('room.roomoverlays.011') },
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
              label={i18n.t('room.roomoverlays.033')}
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
              <Text style={st.toggleLabel}>{deviceConfig!.useSpeaker ? i18n.t('auto.room.RoomOverlays.012') : i18n.t('auto.room.RoomOverlays.011')}</Text>
              <Pressable
                onPress={() => deviceConfig!.onSpeakerChange(!deviceConfig!.useSpeaker)}
                style={[st.chip, deviceConfig!.useSpeaker && st.chipActive]}
              >
                <Text style={[st.chipText, deviceConfig!.useSpeaker && st.chipTextActive]}>
                  {deviceConfig!.useSpeaker ? i18n.t('auto.room.RoomOverlays.010') : i18n.t('auto.room.RoomOverlays.009')}
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

  // 4️⃣ MONETİZASYON — Giriş Ücreti + Bağış toggle (2026-04-27: tek kategoride birleşti).
  const renderMonetization = () => {
    if (!sc) return null;
    return (
      <View style={st.subWrap}>
        {/* Giriş Ücreti — odaya girmek için ödenen SP (Pro+) */}
        <SettingChips icon="diamond-outline" label={i18n.t('room.roomoverlays.034')} options={ENTRY_FEES.map(f => ({ id: f, label: f === 0 ? i18n.t('auto.room.RoomOverlays.008') : `${f}` }))} value={sc.entryFee} onSelect={can('Pro') ? sc.onEntryFeeChange : undefined} locked={!can('Pro')} lockTier="Pro" />
        <View style={st.sep} />
        {/* Bağış kabul etme — host'a SP bağışı (Pro+) */}
        <SettingToggle icon="heart-outline" label={i18n.t('room.roomoverlays.035')} value={sc.donationsEnabled} onValueChange={can('Pro') ? sc.onDonationsToggle : undefined} accent="#EC4899" locked={!can('Pro')} lockTier="Pro" />
      </View>
    );
  };

  // ★ 2026-04-20: İnline Banlılar
  const renderBans = () => (
    <View style={st.subWrap}>
      {bansLoading ? <AppLoader color="#EF4444" style={{ marginVertical: 12 }} /> :
       inlineBans.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 16 }}>
          <Ionicons name="shield-checkmark" size={20} color="rgba(34,197,94,0.3)" />
          <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>{i18n.t('room.roomoverlays.004')}</Text>
        </View>
      ) : inlineBans.map(ban => {
        const isPermanent = ban.ban_type === 'permanent';
        const expiresAt = ban.expires_at ? new Date(ban.expires_at) : null;
        const remainingMin = expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 60000)) : 0;
        const timeLabel = isPermanent ? i18n.t('auto.room.RoomOverlays.007') : remainingMin > 60 ? `${Math.floor(remainingMin / 60)}sa` : `${remainingMin}dk`;
        return (
          <View key={ban.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' }}>
            <Image source={getAvatarSource(ban.user?.avatar_url)} style={{ width: 28, height: 28, borderRadius: 14 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#F1F5F9' }} numberOfLines={1}>{ban.user?.display_name || i18n.t('auto.room.RoomOverlays.006')}</Text>
              <Text style={{ fontSize: 8, color: isPermanent ? '#EF4444' : '#F59E0B', fontWeight: '700' }}>{isPermanent ? '⛔ KALICI' : `⏳ ${timeLabel}`}</Text>
            </View>
            {processingIds.has(ban.id) ? <AppLoader size="small" color="#14B8A6" /> : (
              <Pressable onPress={() => handleUnban(ban)} style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(20,184,166,0.08)', borderWidth: 1, borderColor: 'rgba(20,184,166,0.18)' }}>
                <Text style={{ fontSize: 9, fontWeight: '700', color: '#14B8A6' }}>{i18n.t('room.roomoverlays.005')}</Text>
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
      {requestsLoading ? <AppLoader color="#A78BFA" style={{ marginVertical: 12 }} /> :
       inlineRequests.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 16 }}>
          <Ionicons name="checkmark-circle" size={20} color="rgba(167,139,250,0.25)" />
          <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>Bekleyen istek yok</Text>
        </View>
      ) : inlineRequests.map(req => (
        <View key={req.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' }}>
          <Image source={getAvatarSource(req.user?.avatar_url)} style={{ width: 28, height: 28, borderRadius: 14 }} />
          <Text style={{ flex: 1, fontSize: 11, fontWeight: '600', color: '#F1F5F9' }} numberOfLines={1}>{req.user?.display_name || i18n.t('auto.room.RoomOverlays.005')}</Text>
          {processingIds.has(req.id) ? <AppLoader size="small" color="#A78BFA" /> : (
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
            <View style={st.tierPill}><Text style={st.tierPillText}>Plus</Text></View>
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
            <View style={st.tierPill}><Text style={st.tierPillText}>Plus</Text></View>
          )}
        </View>
        <View style={st.sep} />

        {/* ★ 2026-04-21: Kart Görseli — artık herkes (oluşturma ile aynı kural). */}
        <View style={st.toggleRow}>
          <Ionicons name="albums-outline" size={13} color="#D4AF37" />
          <Text style={st.toggleLabel}>{i18n.t('room.roomoverlays.006')}</Text>
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
          <InlineTextEditor icon="musical-notes-outline" label={i18n.t('room.roomoverlays.036')}
            value={sc.musicLink || ''}
            onSave={(v) => sc.onMusicLinkChange(v.trim() || null)}
            placeholder="https://youtube.com/... veya https://spotify.com/..."
            accent="#FFD700"
          />
        ) : (
          <View style={st.chipRow}>
            <Ionicons name="lock-closed" size={12} color="#475569" />
            <Text style={[st.chipLabel, { color: '#475569' }]}>{i18n.t('room.roomoverlays.007')}</Text>
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
        <Text style={s.subLabel}>{i18n.t('room.roomoverlays.008')}</Text>
        <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.15)" />
      </Pressable>
      <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.03)' }} />
      <Pressable style={({ pressed }) => [s.subRow, pressed && s.subRowPressed]} onPress={() => { onShareLink(); onClose(); }}>
        <View style={s.subIconCircle}><Ionicons name="link-outline" size={13} color="#3B82F6" style={s.iconShadow} /></View>
        <Text style={s.subLabel}>{i18n.t('room.roomoverlays.009')}</Text>
        <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.15)" />
      </Pressable>
    </View>
  );

  // 7️⃣ İSTATİSTİKLER & BOOST
  const renderStats = () => (
    <View style={st.subWrap}>
      {/* ★ Takipçi sayısı — tap'te liste sheet açılır (v92.11) */}
      <Pressable
        onPress={() => { if (onShowFollowers) { onShowFollowers(); onClose(); } }}
        style={({ pressed }) => [st.toggleRow, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="people-circle-outline" size={13} color="#EC4899" />
        <Text style={st.toggleLabel}>{i18n.t('room.roomoverlays.010')}</Text>
        <View style={{ backgroundColor: 'rgba(236,72,153,0.12)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 0.5, borderColor: 'rgba(236,72,153,0.25)' }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: '#EC4899', textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}>{followerCount}</Text>
        </View>
        <Ionicons name="chevron-forward" size={11} color="rgba(255,255,255,0.25)" style={{ marginLeft: 4 }} />
      </Pressable>
      <View style={st.sep} />
      <Pressable style={({ pressed }) => [s.subRow, pressed && s.subRowPressed]} onPress={() => { onRoomStats?.(); onClose(); }}>
        <View style={s.subIconCircle}><Ionicons name="analytics-outline" size={13} color="#3B82F6" style={s.iconShadow} /></View>
        <Text style={s.subLabel}>{i18n.t('room.roomoverlays.011')}</Text>
        <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.15)" />
      </Pressable>
      {onBoostRoom && can('Plus') && (
        <>
          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.03)' }} />
          <Pressable style={({ pressed }) => [s.subRow, pressed && s.subRowPressed]} onPress={() => { onBoostRoom(); onClose(); }}>
            <View style={s.subIconCircle}><Ionicons name="rocket-outline" size={13} color="#F59E0B" style={s.iconShadow} /></View>
            <Text style={s.subLabel}>{i18n.t('room.roomoverlays.012')}</Text>
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
    items.push({ id: 'room_info', icon: 'information-circle-outline', label: i18n.t('rooms.menu.room_info'), accent: '#D4AF37', onPress: () => toggle('room_info'), expandable: true, renderContent: renderRoomInfo });
    // 2. Konuşma & Ses
    items.push({ id: 'speaking', icon: 'mic-outline', label: i18n.t('rooms.menu.speaking_audio'), accent: '#14B8A6', onPress: () => toggle('speaking'), expandable: true, renderContent: renderSpeaking });
    // ★ 2026-04-20: Giriş & Erişim — "kime açık?" sorusunun tek merkezi.
    //   Önceden 3 farklı menüde dağılmış (tip, şifre, ücret, kilit, yaş, dil, arkadaş).
    items.push({ id: 'access', icon: 'key-outline', label: i18n.t('rooms.menu.access'), accent: '#F59E0B', onPress: () => toggle('access'), expandable: true, renderContent: renderAccess });
    // ★ 2026-04-20: Banlılar & İstekler — ayrı inline accordion (modal kaldırıldı)
    if ((_roomType === 'closed' || _roomType === 'invite') && _roomId) {
      items.push({ id: 'requests', icon: 'hourglass-outline', label: i18n.t('room.roomoverlays.012'), accent: '#A78BFA', badge: accessRequestCount ?? inlineRequests.length, onPress: () => { if (expandedId !== 'requests') loadRequests(); toggle('requests'); }, expandable: true, renderContent: renderRequestsInline });
    }
    if (_roomId) {
      items.push({ id: 'bans', icon: 'ban-outline', label: i18n.t('rooms.menu.bans'), accent: '#EF4444', onPress: () => { if (expandedId !== 'bans') loadBans(); toggle('bans'); }, expandable: true, renderContent: renderBans });
    }
    // 4. Para Kazanma — Giriş Ücreti + Bağış (2026-04-27: Giriş Ücreti buraya taşındı)
    items.push({ id: 'monetization', icon: 'cash-outline', label: i18n.t('rooms.menu.monetization'), accent: '#EC4899', onPress: () => toggle('monetization'), expandable: true, renderContent: renderMonetization });
    // 5. Görsel & Tema
    items.push({ id: 'visual', icon: 'color-palette-outline', label: i18n.t('rooms.menu.visual'), accent: '#F59E0B', onPress: () => toggle('visual'), expandable: true, renderContent: renderVisual });
  } else if (isMod) {
    // Moderatör: Konuşma & Ses (slow mode + cihaz) + Banlılar & İstekler
    items.push({ id: 'speaking', icon: 'mic-outline', label: i18n.t('rooms.menu.speaking_audio'), accent: '#14B8A6', onPress: () => toggle('speaking'), expandable: true, renderContent: renderSpeaking });
    // ★ İstekler + Banlılar inline (moderatör)
    if ((_roomType === 'closed' || _roomType === 'invite') && _roomId) {
      items.push({ id: 'requests', icon: 'hourglass-outline', label: i18n.t('room.roomoverlays.013'), accent: '#A78BFA', badge: accessRequestCount ?? inlineRequests.length, onPress: () => { if (expandedId !== 'requests') loadRequests(); toggle('requests'); }, expandable: true, renderContent: renderRequestsInline });
    }
    if (_roomId) {
      items.push({ id: 'bans', icon: 'ban-outline', label: i18n.t('rooms.menu.bans'), accent: '#EF4444', onPress: () => { if (expandedId !== 'bans') loadBans(); toggle('bans'); }, expandable: true, renderContent: renderBans });
    }
  } else if (deviceConfig) {
    // ★ Speaker/Listener: Sadece cihaz ayarları (hoparlör + sahnedeyse mic/noise)
    items.push({ id: 'speaking', icon: 'headset-outline', label: i18n.t('rooms.menu.speaking_audio'), accent: '#3B82F6', onPress: () => toggle('speaking'), expandable: true, renderContent: renderSpeaking });
  }

  // 6. Davet & Paylaş (sahnedekiler)
  if (isOnStage) {
    items.push({ id: 'invite', icon: 'person-add-outline', label: i18n.t('rooms.menu.invite_share'), accent: '#14B8A6', onPress: () => toggle('invite'), expandable: true, renderContent: renderInvite });
  } else {
    items.push({ id: 'share', icon: 'share-social-outline', label: i18n.t('room.roomoverlays.014'), accent: '#3B82F6', onPress: () => { onShareLink(); onClose(); } });
  }

  // 7. İstatistikler & Boost — geçici host göremez (asıl sahibin yetkisi)
  if (isOwner && !isTempHost && onRoomStats && can('Pro')) {
    items.push({ id: 'stats', icon: 'stats-chart-outline', label: i18n.t('room.roomoverlays.015'), accent: '#3B82F6', onPress: () => toggle('stats'), expandable: true, renderContent: renderStats });
  } else if (isOwner && !isTempHost && onBoostRoom && can('Plus')) {
    items.push({ id: 'boost', icon: 'rocket-outline', label: i18n.t('room.roomoverlays.016'), accent: '#F59E0B', onPress: () => { onBoostRoom(); onClose(); } });
  }

  // ★ v92 (1 May 2026): Güçlendiriciler — herkese açık (Süre Uzat host-only,
  //   Altın Davet herkese; sheet içinde rol kontrolü yapılır).
  if (onPowerUps) {
    items.push({ id: 'powerups', icon: 'flash-outline', label: i18n.t('room.roomoverlays.017'), accent: '#FBBF24', onPress: () => { onPowerUps(); onClose(); } });
  }

  // Takip (listener)
  if (!isOwner && onToggleFollow) {
    items.push({ id: 'follow', icon: isFollowingRoom ? 'heart' : 'heart-outline', label: isFollowingRoom ? i18n.t('auto.room.RoomOverlays.004') : i18n.t('auto.room.RoomOverlays.003'), accent: isFollowingRoom ? '#EF4444' : '#EC4899', onPress: () => { onToggleFollow(); onClose(); } });
  }
  // Bildir (listener)
  if (!isOnStage && onReportRoom) {
    items.push({ id: 'report', icon: 'flag-outline', label: i18n.t('room.roomoverlays.019'), accent: '#EF4444', onPress: () => { onReportRoom(); onClose(); }, destructive: true });
  }

  // ★ Bağış Yap (host olmayan herkes, bağış açıkken)
  if (!isOwner && isDonationsEnabled && onDonate) {
    items.push({ id: 'donate', icon: 'heart', label: i18n.t('room.roomoverlays.020'), accent: '#EF4444', onPress: () => { onDonate(); onClose(); } });
  }

  // Dondur & Sil (owner, direkt aksiyon) — geçici host yapamaz
  if (isOwner && !isTempHost && sc?.onFreezeRoom) {
    items.push({ id: 'freeze', icon: 'snow-outline', label: i18n.t('rooms.menu.freeze'), accent: '#3B82F6', onPress: () => { onClose(); sc.onFreezeRoom?.(); } });
  }

  // ★ 2026-05-10 v111b: Mesajları Temizle — sadece Plus/Pro/GodMaster host (geçici host yapamaz)
  if (isOwner && !isTempHost && onClearMessages && isTierAtLeast(tier, 'Plus' as any)) {
    items.push({
      id: 'clear-messages',
      icon: 'sparkles-outline',
      label: i18n.t('room.roomoverlays.022'),
      accent: '#F59E0B',
      onPress: () => { onClose(); onClearMessages(); },
    });
  }

  // ★ Odadan Ayrıl — tüm roller için (owner'da host transfer / moderator/speaker/listener normal çıkış)
  if (onLeaveRoom) {
    items.push({
      id: 'leave',
      icon: 'exit-outline',
      label: i18n.t('room.roomoverlays.024'),
      accent: '#F59E0B',
      onPress: () => { onClose(); onLeaveRoom(); },
    });
  }

  // Odayı Sil — yalnız asıl sahip; geçici host göremez
  if (isOwner && !isTempHost && onDeleteRoom) {
    items.push({ id: 'delete', icon: 'trash-outline', label: i18n.t('rooms.menu.delete'), accent: '#EF4444', onPress: () => { onDeleteRoom(); onClose(); }, destructive: true });
  }

  // ★ 2026-04-20: Tüm roller aynı sağdan-kayan drawer kullanır (compact bottom-sheet
  // kaldırıldı — kullanıcı talebi: "listener modal owner gibi yanal açılır olsun")
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[s.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        {...panHandlers}
        style={[s.panel, {
          top: Math.max(insets.top + 12, ROOM_TOP_GAP),
          bottom: Math.max(insets.bottom + 8, ROOM_BOTTOM_GAP),
          transform: [{ translateX: Animated.add(slideAnim, swipeX) }],
        }]}
      >
        {/* Profil sayfası gradient dili — diagonal slate (NotificationDrawer dili) */}
        <LinearGradient
          colors={['#3a4658', '#2a3344', '#1a2030']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        {/* ★ 2026-05-05: 3 katman aile dili — slate + halo + soft glow. Role-based renk. */}
        <LinearGradient
          colors={[`${role.color}33`, `${role.color}0D`, 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <LinearGradient
          colors={[`${role.color}14`, 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.6 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        {/* Header */}
        <View style={s.header}>
          <Ionicons name="grid" size={18} color={role.color} style={[s.iconShadow, { textShadowColor: `${role.color}B0`, textShadowRadius: 5 }]} />
          <Text style={s.headerTitle}>{i18n.t('rooms.menu.title')}</Text>
          <View style={[s.rolePill, { backgroundColor: role.color + '22', borderColor: role.color + '35' }]}>
            <Ionicons name={role.icon as any} size={10} color={role.color} />
            <Text style={[s.roleLabel, { color: role.color }]}>{i18n.t(role.labelKey)}</Text>
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
                    <Ionicons name={item.icon as any} size={IS_SMALL_SCREEN ? 18 : 20} color={item.destructive ? '#EF4444' : item.accent} style={s.iconShadow} />
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
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,12,22,0.45)' },
  panel: {
    // ★ 2026-05-05: NotificationDrawer dili — top+bottom inline insets bazlı
    position: 'absolute', right: 0,
    width: PANEL_W,
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
    flexDirection: 'row', alignItems: 'center', gap: IS_SMALL_SCREEN ? 8 : 10,
    paddingVertical: IS_SMALL_SCREEN ? 10 : 11, paddingHorizontal: IS_SMALL_SCREEN ? 12 : 14,
  },
  rowPressed: { backgroundColor: 'rgba(20,184,166,0.08)' },
  rowExpanded: { backgroundColor: 'rgba(255,255,255,0.03)' },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  iconCircle: {
    width: IS_SMALL_SCREEN ? 30 : 32, height: IS_SMALL_SCREEN ? 30 : 32,
    borderRadius: IS_SMALL_SCREEN ? 15 : 16,
    justifyContent: 'center', alignItems: 'center',
  },
  iconShadow: { textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 3 },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: '600', color: '#F1F5F9', letterSpacing: 0.1, textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  rowDesc: { fontSize: 11, color: '#64748B', marginTop: 2, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
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
