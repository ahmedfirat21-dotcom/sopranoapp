/**
 * SopranoChat — Room Layout Config
 * ════════════════════════════════════════════════════════════════════
 * v115 (13 May 2026) — Web admin'de yapılan oda layout ayarlarını
 * mobile'a çeker. Tek global config (id='default') + realtime UPDATE
 * dinleyici. Frame config cache pattern'ı.
 *
 * Web admin slider değiştirince DB UPDATE → realtime → cache invalidate
 * → useRoomLayout dinleyenler re-render → SpeakerSection/ListenerGrid
 * yeni ölçü/şekil ile yeniden çizilir.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../constants/supabase';

export type AvatarShape = 'circle' | 'square' | 'rounded' | 'hex';
export type RingStyle = 'solid' | 'dashed' | 'dotted' | 'none';
export type NamePosition = 'below' | 'above' | 'inside' | 'hidden';
export type BadgePosition = 'topRight' | 'topLeft' | 'bottomRight' | 'bottomLeft' | 'hidden';
export type StageDivider = 'none' | 'line' | 'gradient';
export type GlobalBg = 'solid' | 'gradient' | 'image' | 'none';
export type CornerPosition = 'topRight' | 'topLeft' | 'bottomRight' | 'bottomLeft';
export type EnterTransition = 'fade' | 'slide' | 'bounce' | 'none';
export type CameraAspect = '1:1' | '16:9' | '4:3';
export type ButtonShape = 'circle' | 'rounded';

export interface HostLayoutConfig {
  avatarShape: AvatarShape;
  avatarSize: number;
  borderRadius: number;
  ringWidth: number;
  ringColor: string;
  ringStyle: RingStyle;
  namePosition: NamePosition;
  nameFontSize: number;
  nameFontWeight: string;
  nameColor: string;
  badgePosition: BadgePosition;
  haloEnabled: boolean;
  haloColor: string;
  haloOpacity: number;
  haloBlur: number;
  containerPadding: number;
}

export interface SpeakersLayoutConfig {
  avatarShape: AvatarShape;
  borderRadius: number;
  maxCols: number;
  colGap: number;
  rowGap: number;
  ringWidth: number;
  ringColor: string;
  speakingRingColor: string;
  namePosition: NamePosition;
  nameFontSize: number;
  nameMaxChars: number;
  showMicIcon: boolean;
  muteOpacity: number;
  sizePresets: { small: number; medium: number; large: number };
}

export interface ListenersLayoutConfig {
  avatarShape: AvatarShape;
  borderRadius: number;
  maxCols: number;
  colGap: number;
  rowGap: number;
  showName: boolean;
  nameFontSize: number;
  nameMaxChars: number;
  ringWidth: number;
  ringColor: string;
  ownerCrownEnabled: boolean;
  ownerScale: number;
  sizePresets: { small: number; medium: number; large: number };
}

export interface StageLayoutConfig {
  backgroundColor: string;
  borderRadius: number;
  padding: number;
  dividerStyle: StageDivider;
  dividerColor: string;
  gapBetweenSpeakersAndListeners: number;
}

export interface GlobalLayoutConfig {
  background: GlobalBg;
  bgColor: string;
  bgGradient: string[];
  bgImageUrl: string | null;
  safePaddingTop: number;
  safePaddingBottom: number;
  horizontalPadding: number;
}

// ── v116 genişletilmiş alt config'ler ──
export interface AnimationsConfig {
  speakingPulseEnabled: boolean;
  speakingPulseSpeed: number;        // ms
  speakingRingExpand: number;        // 1.0 = no expand
  haloPulseEnabled: boolean;
  haloPulseSpeed: number;
  haloPulseAmplitude: number;
  avatarTapScale: number;
  enterTransition: EnterTransition;
  enterDurationMs: number;
  reduceMotion: boolean;
}

export interface AccentsConfig {
  ownerHighlight: string;
  ownerRingWidth: number;
  ownerHaloEnabled: boolean;
  moderatorHighlight: string;
  moderatorRingWidth: number;
  handRaiseColor: string;
  handRaiseEnabled: boolean;
  newJoinHighlight: string;
  newJoinDurationMs: number;
  selectedHighlight: string;
}

export interface IndicatorsConfig {
  onlineDotEnabled: boolean;
  onlineDotColor: string;
  onlineDotSize: number;
  onlineDotPosition: CornerPosition;
  muteIndicatorEnabled: boolean;
  muteIndicatorColor: string;
  muteIndicatorSize: number;
  muteIndicatorPosition: CornerPosition;
  cameraIndicatorEnabled: boolean;
  cameraIndicatorColor: string;
  verifiedTickEnabled: boolean;
  verifiedTickColor: string;
}

export interface ShadowsConfig {
  hostShadowColor: string;
  hostShadowBlur: number;
  hostShadowOpacity: number;
  speakerShadowColor: string;
  speakerShadowBlur: number;
  speakerShadowOpacity: number;
  speakerShadowEnabled: boolean;
  listenerShadowEnabled: boolean;
  listenerShadowColor: string;
  listenerShadowBlur: number;
  listenerShadowOpacity: number;
}

export interface HeaderConfig {
  titleFontSize: number;
  titleFontWeight: string;
  titleColor: string;
  subtitleFontSize: number;
  subtitleColor: string;
  showLiveIndicator: boolean;
  liveDotColor: string;
  liveDotPulse: boolean;
  showListenerCount: boolean;
  headerBgOpacity: number;
  headerBorderBottom: boolean;
  headerBorderColor: string;
  // ★ v300 (17 May 2026): Oda sahibi (host) avatar görsel ayarları — web admin'den
  //   APK ile birebir senkronize.
  showHostAvatar: boolean;
  hostAvatarSize: number;
  hostAvatarBorderWidth: number;
  hostAvatarBorderColor: string;
}

export interface ControlsConfig {
  barBackground: string;
  barBlurEnabled: boolean;
  barBlurIntensity: number;
  barBorderTop: string;
  barPaddingV: number;
  buttonSize: number;
  buttonGap: number;
  buttonShape: ButtonShape;
  buttonBorderRadius: number;
  micActiveColor: string;
  micMutedColor: string;
  leaveButtonColor: string;
  iconColor: string;
  iconSize: number;
}

// ★ v289 (16 May 2026): SpeakersAdvancedConfig + NameAdvancedConfig KALDIRILDI.
//   19 alan tamamen ölüydü (admin'de UI yok, mobile'da hiç okunmuyor). Audit sonucu
//   types/defaults/mobile usage'tan temizlendi. DB jsonb'sinde varsa geriye uyum
//   için mergeWithDefaults görmezden gelir (zaten artık spread'lemiyor).

export interface ListenersAdvancedConfig {
  maxVisibleSmallScreen: number;
  maxVisibleDefault: number;
  overflowBadgeText: string;
  overflowBadgeColor: string;
  overflowBadgeTextColor: string;
  showHandRaiseBadge: boolean;
  handRaiseBadgePosition: CornerPosition;
  showMicRequestPulse: boolean;
}

export interface RoomLayoutConfig {
  host: HostLayoutConfig;
  speakers: SpeakersLayoutConfig;
  listeners: ListenersLayoutConfig;
  stage: StageLayoutConfig;
  global: GlobalLayoutConfig;
  // v116 ek alt config'ler
  animations: AnimationsConfig;
  accents: AccentsConfig;
  indicators: IndicatorsConfig;
  shadows: ShadowsConfig;
  header: HeaderConfig;
  controls: ControlsConfig;
  listeners_advanced: ListenersAdvancedConfig;
}

// ── Default fallback (DB fetch fail/loading) — mevcut hard-coded değerler ──
export const DEFAULT_ROOM_LAYOUT: RoomLayoutConfig = {
  host: {
    avatarShape: 'circle',
    avatarSize: 140,
    borderRadius: 48,
    ringWidth: 3,
    ringColor: '#FBBF24',
    ringStyle: 'solid',
    namePosition: 'below',
    nameFontSize: 14,
    nameFontWeight: '700',
    nameColor: '#FFFFFF',
    badgePosition: 'topRight',
    haloEnabled: true,
    haloColor: '#FBBF24',
    haloOpacity: 0.45,
    haloBlur: 24,
    containerPadding: 12,
  },
  speakers: {
    avatarShape: 'circle',
    borderRadius: 50,
    maxCols: 4,
    colGap: 14,
    rowGap: 16,
    ringWidth: 2,
    ringColor: '#14B8A6',
    speakingRingColor: '#10B981',
    namePosition: 'below',
    nameFontSize: 12,
    nameMaxChars: 0,
    showMicIcon: true,
    muteOpacity: 0.55,
    sizePresets: { small: 84, medium: 100, large: 110 },
  },
  listeners: {
    avatarShape: 'circle',
    borderRadius: 50,
    maxCols: 6,
    colGap: 10,
    rowGap: 12,
    showName: true,
    nameFontSize: 10,
    nameMaxChars: 0,
    ringWidth: 0,
    ringColor: 'transparent',
    ownerCrownEnabled: true,
    ownerScale: 1.10,
    sizePresets: { small: 42, medium: 50, large: 60 },
  },
  stage: {
    backgroundColor: 'rgba(15,25,38,0.0)',
    borderRadius: 0,
    padding: 16,
    dividerStyle: 'none',
    dividerColor: 'rgba(255,255,255,0.08)',
    gapBetweenSpeakersAndListeners: 20,
  },
  global: {
    background: 'gradient',
    bgColor: '#0A0F1A',
    bgGradient: ['#0F1926', '#0A0F1A'],
    bgImageUrl: null,
    safePaddingTop: 12,
    safePaddingBottom: 12,
    horizontalPadding: 16,
  },
  animations: {
    speakingPulseEnabled: true,
    speakingPulseSpeed: 1400,
    speakingRingExpand: 1.35,
    haloPulseEnabled: false,
    haloPulseSpeed: 2000,
    haloPulseAmplitude: 0.20,
    avatarTapScale: 0.96,
    enterTransition: 'fade',
    enterDurationMs: 400,
    reduceMotion: false,
  },
  accents: {
    ownerHighlight: '#FBBF24',
    ownerRingWidth: 3,
    ownerHaloEnabled: true,
    moderatorHighlight: '#A78BFA',
    moderatorRingWidth: 2,
    handRaiseColor: '#FBBF24',
    handRaiseEnabled: true,
    newJoinHighlight: '#10B981',
    newJoinDurationMs: 4000,
    selectedHighlight: '#14B8A6',
  },
  indicators: {
    onlineDotEnabled: true,
    onlineDotColor: '#10B981',
    onlineDotSize: 8,
    onlineDotPosition: 'bottomRight',
    muteIndicatorEnabled: true,
    muteIndicatorColor: '#EF4444',
    muteIndicatorSize: 18,
    muteIndicatorPosition: 'bottomRight',
    cameraIndicatorEnabled: true,
    cameraIndicatorColor: '#3B82F6',
    verifiedTickEnabled: true,
    verifiedTickColor: '#3B82F6',
  },
  shadows: {
    hostShadowColor: '#FBBF24',
    hostShadowBlur: 18,
    hostShadowOpacity: 0.50,
    speakerShadowColor: '#14B8A6',
    speakerShadowBlur: 12,
    speakerShadowOpacity: 0.30,
    speakerShadowEnabled: false,
    listenerShadowEnabled: false,
    listenerShadowColor: '#000000',
    listenerShadowBlur: 4,
    listenerShadowOpacity: 0.30,
  },
  header: {
    titleFontSize: 16,
    titleFontWeight: '700',
    titleColor: '#F1F5F9',
    subtitleFontSize: 11,
    subtitleColor: '#94A3B8',
    showLiveIndicator: true,
    liveDotColor: '#EF4444',
    liveDotPulse: true,
    showListenerCount: true,
    headerBgOpacity: 0.0,
    headerBorderBottom: true,
    headerBorderColor: 'rgba(255,255,255,0.04)',
    // ★ v300: Host avatar varsayılanları — APK ile birebir.
    showHostAvatar: true,
    hostAvatarSize: 36,
    hostAvatarBorderWidth: 1.5,
    hostAvatarBorderColor: 'rgba(20,184,166,0.55)',
  },
  controls: {
    barBackground: 'rgba(15,25,38,0.85)',
    barBlurEnabled: true,
    barBlurIntensity: 28,
    barBorderTop: 'rgba(255,255,255,0.05)',
    barPaddingV: 10,
    buttonSize: 44,
    buttonGap: 12,
    buttonShape: 'circle',
    buttonBorderRadius: 12,
    micActiveColor: '#10B981',
    micMutedColor: '#475569',
    leaveButtonColor: '#EF4444',
    iconColor: '#E2E8F0',
    iconSize: 22,
  },
  listeners_advanced: {
    maxVisibleSmallScreen: 10,
    maxVisibleDefault: 14,
    overflowBadgeText: '+{N} Seyirci',
    overflowBadgeColor: 'rgba(20,184,166,0.16)',
    overflowBadgeTextColor: '#5EEAD4',
    showHandRaiseBadge: true,
    handRaiseBadgePosition: 'topLeft',
    showMicRequestPulse: true,
  },
};

const TTL_MS = 5 * 60 * 1000;
let _cache: { config: RoomLayoutConfig; ts: number } | null = null;
const _listeners = new Set<(cfg: RoomLayoutConfig) => void>();

// ★ v289 (16 May 2026): Nested merge helper — sizePresets gibi iç içe objelerin
//   kısmi update'lerinde default kaybolmasın diye. Önce sığ spread yapıyorduk →
//   DB'de `speakers.sizePresets: {small:60}` saved olursa medium/large kayboluyordu.
function mergeNested(defaults: any, raw: any): any {
  if (raw === null || raw === undefined) return defaults;
  if (typeof raw !== 'object' || typeof defaults !== 'object') return raw;
  if (Array.isArray(defaults) || Array.isArray(raw)) return raw;
  const out: any = { ...defaults };
  for (const k of Object.keys(raw)) {
    const dv = defaults[k];
    const rv = raw[k];
    if (dv && typeof dv === 'object' && !Array.isArray(dv)) {
      out[k] = mergeNested(dv, rv);
    } else {
      out[k] = rv;
    }
  }
  return out;
}

function mergeWithDefaults(raw: any): RoomLayoutConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT_ROOM_LAYOUT;
  // ★ v289: Deep merge — iç içe objelerde (sizePresets gibi) default'lar korunur.
  return {
    host:               mergeNested(DEFAULT_ROOM_LAYOUT.host,               raw.host),
    speakers:           mergeNested(DEFAULT_ROOM_LAYOUT.speakers,           raw.speakers),
    listeners:          mergeNested(DEFAULT_ROOM_LAYOUT.listeners,          raw.listeners),
    stage:              mergeNested(DEFAULT_ROOM_LAYOUT.stage,              raw.stage),
    global:             mergeNested(DEFAULT_ROOM_LAYOUT.global,             raw.global),
    animations:         mergeNested(DEFAULT_ROOM_LAYOUT.animations,         raw.animations),
    accents:            mergeNested(DEFAULT_ROOM_LAYOUT.accents,            raw.accents),
    indicators:         mergeNested(DEFAULT_ROOM_LAYOUT.indicators,         raw.indicators),
    shadows:            mergeNested(DEFAULT_ROOM_LAYOUT.shadows,            raw.shadows),
    header:             mergeNested(DEFAULT_ROOM_LAYOUT.header,             raw.header),
    controls:           mergeNested(DEFAULT_ROOM_LAYOUT.controls,           raw.controls),
    listeners_advanced: mergeNested(DEFAULT_ROOM_LAYOUT.listeners_advanced, raw.listeners_advanced),
  };
}

export function getCachedRoomLayout(): RoomLayoutConfig {
  if (_cache && Date.now() - _cache.ts <= TTL_MS) return _cache.config;
  return DEFAULT_ROOM_LAYOUT;
}

export async function fetchRoomLayout(): Promise<RoomLayoutConfig> {
  try {
    const { data, error } = await supabase
      .from('room_layout_config')
      .select('config')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (error || !data?.config) return DEFAULT_ROOM_LAYOUT;
    const cfg = mergeWithDefaults(data.config);
    _cache = { config: cfg, ts: Date.now() };
    return cfg;
  } catch {
    return DEFAULT_ROOM_LAYOUT;
  }
}

export async function ensureRoomLayout(): Promise<RoomLayoutConfig> {
  if (_cache && Date.now() - _cache.ts <= TTL_MS) return _cache.config;
  return fetchRoomLayout();
}

export function invalidateRoomLayout() {
  _cache = null;
  // Fetch fresh + notify subscribers
  fetchRoomLayout().then((cfg) => {
    _listeners.forEach((fn) => {
      try { fn(cfg); } catch { /* noop */ }
    });
  });
}

let _realtimeSub: any = null;
export function startRoomLayoutSync() {
  if (_realtimeSub) return _realtimeSub;
  _realtimeSub = supabase
    .channel('room_layout_config_changes')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'room_layout_config' },
      () => invalidateRoomLayout(),
    )
    .subscribe();
  // İlk fetch
  fetchRoomLayout();
  return _realtimeSub;
}

export function stopRoomLayoutSync() {
  if (_realtimeSub) {
    supabase.removeChannel(_realtimeSub);
    _realtimeSub = null;
  }
}

export function useRoomLayout(): RoomLayoutConfig {
  const [cfg, setCfg] = useState<RoomLayoutConfig>(() => getCachedRoomLayout());

  useEffect(() => {
    let mounted = true;
    ensureRoomLayout().then((c) => { if (mounted) setCfg(c); });
    const listener = (newCfg: RoomLayoutConfig) => { if (mounted) setCfg(newCfg); };
    _listeners.add(listener);
    return () => { mounted = false; _listeners.delete(listener); };
  }, []);

  return cfg;
}
