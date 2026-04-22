/**
 * SopranoChat — Abonelik Bazlı Tier Sistemi & Limitler
 * ═══════════════════════════════════════════════════
 *
 * TEMEL FELSEFE:
 *   Altyapı Pro (maksimum) kapasiteye göre tasarlanır,
 *   alt paketler bundan kısıtlanarak (filtrelenerek) oluşturulur.
 *
 * 4 Tier: Free / Plus / Pro / GodMaster
 * SP tek ekonomi birimi.
 */
import type { SubscriptionTier, StageLayout, RoomMusicConfig } from '../types';

export type TierName = SubscriptionTier;

// ════════════════════════════════════════════════════════════
// ABONELİK TIER TANIMLARI (4 Tier: Free / Plus / Pro / GodMaster)
// ════════════════════════════════════════════════════════════

export interface TierDefinition {
  name: SubscriptionTier;
  label: string;
  emoji: string;
  icon: string;          // Ionicons name
  color: string;         // Ana renk
  gradient: [string, string];
  /** Aylık fiyat (TL). 0 = ücretsiz */
  monthlyPrice: number;
  /** Yıllık fiyat (TL). 0 = ücretsiz */
  yearlyPrice: number;
  /** Marketing açıklaması */
  tagline: string;
}

export const TIER_DEFINITIONS: Record<SubscriptionTier, TierDefinition> = {
  Free: {
    name: 'Free',
    label: 'Ücretsiz',
    emoji: '🆓',
    icon: 'person-outline',
    color: '#94A3B8',
    gradient: ['#94A3B8', '#64748B'],
    monthlyPrice: 0,
    yearlyPrice: 0,
    tagline: 'SopranoChat dünyasını keşfet',
  },
  Plus: {
    name: 'Plus',
    label: 'Plus',
    emoji: '🚀',
    icon: 'rocket',
    color: '#A855F7',
    gradient: ['#A855F7', '#7C3AED'],
    monthlyPrice: 39.99,
    yearlyPrice: 349.99,
    tagline: 'Daha fazla güç, daha fazla özgürlük',
  },
  Pro: {
    name: 'Pro',
    label: 'Pro',
    emoji: '👑',
    icon: 'flame',
    color: '#F59E0B',
    gradient: ['#F59E0B', '#D97706'],
    monthlyPrice: 99.99,
    yearlyPrice: 899.99,
    tagline: 'Sınırsız güç, maksimum prestij',
  },
  GodMaster: {
    name: 'GodMaster',
    label: 'GodMaster',
    emoji: '⚡',
    icon: 'flash',
    color: '#EF4444',
    gradient: ['#EF4444', '#B91C1C'],
    monthlyPrice: 0,
    yearlyPrice: 0,
    tagline: 'Sistemin mutlak hâkimi — sınırsız yetki',
  },
} as const;

/** Sıralı tier listesi (düşükten yükseğe) */
export const TIER_ORDER: SubscriptionTier[] = ['Free', 'Plus', 'Pro', 'GodMaster'];

/** ★ GodMaster kontrolü — tek helper */
export function isGodMaster(tier: SubscriptionTier | string): boolean {
  return tier === 'GodMaster';
}

/**
 * ★ 2026-04-21: Profile'dan efektif tier hesapla — tüm keşfet/oda/SP kontrollerinde
 *   aynı mantık kullanılsın diye merkezi util.
 *
 *   Öncelik: subscription_tier === 'GodMaster' → GodMaster
 *            is_admin === true                → Pro (admin = yüksek yetki)
 *            subscription_tier set            → kendisi
 *            default                          → Free
 */
export function getEffectiveTier(profile: { subscription_tier?: string | null; is_admin?: boolean | null } | null | undefined): SubscriptionTier {
  if (!profile) return 'Free';
  if (profile.subscription_tier === 'GodMaster') return 'GodMaster';
  if (profile.is_admin) return 'Pro';
  const t = profile.subscription_tier;
  if (t === 'Plus' || t === 'Pro' || t === 'Free') return t;
  return 'Free';
}

/** Tier karşılaştırma: userTier >= requiredTier mi? */
export function isTierAtLeast(userTier: SubscriptionTier, requiredTier: SubscriptionTier): boolean {
  return TIER_ORDER.indexOf(userTier) >= TIER_ORDER.indexOf(requiredTier);
}

/** Tier seviye numarası (0-4) */
export function getTierLevel(tier: SubscriptionTier): number {
  return TIER_ORDER.indexOf(tier);
}

// ════════════════════════════════════════════════════════════
// ODA LİMİTLERİ (4-Tier Matrisi)
// ════════════════════════════════════════════════════════════

export interface RoomLimits {
  /** Sahnede aynı anda bulunabilecek max kişi (owner dahil) */
  maxSpeakers: number;
  /** Dinleyici grid kapasitesi */
  maxListeners: number;
  /** Seyirci kapasitesi (grid'de görünmez). 999 = sınırsız */
  maxSpectators: number;
  /** Aynı anda açılabilecek max kamera */
  maxCameras: number;
  /** Atanabilecek max moderatör */
  maxModerators: number;
  /** Oda açık kalma süresi (saat). 0 = sınırsız (7/24) */
  durationHours: number;
  /** Günlük oda açma limiti. 999 = sınırsız */
  dailyRooms: number;
  /** Oda kalıcı mı? (kapatılınca dondurulur, silinmez — wakeUpRoom ile tekrar aktif) */
  persistent: boolean;
  /** Max kalıcı oda sayısı */
  maxPersistentRooms: number;
  /** Açılabilecek oda tipleri */
  allowedTypes: readonly string[];
  // ── Ses/Video Kalitesi ──
  /** Mikrofon örnekleme hızı (Hz) */
  audioSampleRate: number;
  /** Kanal sayısı: 1=mono, 2=stereo */
  audioChannels: 1 | 2;
  /** Maksimum video çözünürlüğü */
  videoMaxRes: 0 | 480 | 720 | 1080; // 0 = video yok
  // ── Kişiselleştirme ──
  /** Oda kart resmi değiştirebilir mi? */
  canCustomizeImage: boolean;
  /** Oda iç renk temasını değiştirebilir mi? */
  canCustomizeTheme: boolean;
  /** Avatar çerçevesi kullanabilir mi? */
  canUseAvatarFrame: boolean;
  /** Kullanılabilir sahne düzenleri */
  allowedStageLayouts: readonly StageLayout[];
  /** Oda müziği açabilir mi? */
  canUseRoomMusic: boolean;
  /** Yaş/dil filtresi kullanabilir mi? */
  canUseFilters: boolean;
  /** Takipçi-only mod kullanabilir mi? */
  canUseFollowersOnly: boolean;
  /** Sahip çıkınca ne olur? close: kapanır, keep_alive: açık kalır (host manuel yönetir) */
  ownerLeavePolicy: 'close' | 'keep_alive';
}

export const ROOM_TIER_LIMITS: Record<SubscriptionTier, RoomLimits> = {
  Free: {
    maxSpeakers: 4,
    maxListeners: 10,
    maxSpectators: 50,
    maxCameras: 2,
    // ★ 2026-04-22: Clubhouse/X Spaces referansı — Free tier rekabetçi kılındı.
    //   maxModerators 0→1 (1 asistan), durationHours 2→4, dailyRooms 3→10,
    //   allowedTypes'a 'closed' eklendi (davetli hala Plus+ kilit).
    maxModerators: 1,
    durationHours: 4,
    dailyRooms: 10,
    persistent: false,
    maxPersistentRooms: 0,
    allowedTypes: ['open', 'closed'] as readonly string[],
    audioSampleRate: 16000,
    audioChannels: 1,
    videoMaxRes: 480,
    canCustomizeImage: false,
    canCustomizeTheme: false,
    canUseAvatarFrame: false,
    allowedStageLayouts: ['grid'] as readonly StageLayout[],
    canUseRoomMusic: false,
    canUseFilters: false,
    canUseFollowersOnly: false,
    ownerLeavePolicy: 'close',
  },
  Plus: {
    maxSpeakers: 8,
    maxListeners: 25,
    maxSpectators: 200,
    maxCameras: 6,
    maxModerators: 2,
    durationHours: 12,
    dailyRooms: 10,
    persistent: true,
    maxPersistentRooms: 3,
    allowedTypes: ['open', 'closed', 'invite'] as readonly string[],
    audioSampleRate: 32000,
    audioChannels: 1,
    videoMaxRes: 720,
    canCustomizeImage: true,
    canCustomizeTheme: true,
    canUseAvatarFrame: true,
    allowedStageLayouts: ['grid', 'spotlight'] as readonly StageLayout[],
    canUseRoomMusic: false,
    canUseFilters: true,
    canUseFollowersOnly: false,
    ownerLeavePolicy: 'keep_alive',
  },
  Pro: {
    maxSpeakers: 13,
    maxListeners: 999,          // ★ Sınırsız dinleyici
    maxSpectators: 999,         // ★ Sınırsız seyirci
    maxCameras: 10,
    maxModerators: 5,
    durationHours: 0,           // ★ 7/24 açık
    dailyRooms: 999,
    persistent: true,
    maxPersistentRooms: 999,
    allowedTypes: ['open', 'closed', 'invite'] as readonly string[],
    audioSampleRate: 48000,
    audioChannels: 2,           // ★ Stereo ses
    videoMaxRes: 1080,
    canCustomizeImage: true,
    canCustomizeTheme: true,
    canUseAvatarFrame: true,
    allowedStageLayouts: ['grid', 'spotlight', 'theater'] as readonly StageLayout[],
    canUseRoomMusic: true,
    canUseFilters: true,
    canUseFollowersOnly: true,
    ownerLeavePolicy: 'keep_alive',
  },
  // ★ GodMaster — Mutlak güç, sınırsız her şey
  GodMaster: {
    maxSpeakers: 999,
    maxListeners: 999,
    maxSpectators: 999,
    maxCameras: 999,
    maxModerators: 999,
    durationHours: 0,           // ★ 7/24 — süresiz
    dailyRooms: 999,
    persistent: true,
    maxPersistentRooms: 999,
    allowedTypes: ['open', 'closed', 'invite'] as readonly string[],
    audioSampleRate: 48000,
    audioChannels: 2,
    videoMaxRes: 1080,
    canCustomizeImage: true,
    canCustomizeTheme: true,
    canUseAvatarFrame: true,
    allowedStageLayouts: ['grid', 'spotlight', 'theater'] as readonly StageLayout[],
    canUseRoomMusic: true,
    canUseFilters: true,
    canUseFollowersOnly: true,
    ownerLeavePolicy: 'keep_alive',
  },
} as const;

export const getRoomLimits = (tier: SubscriptionTier = 'Free'): RoomLimits =>
  ROOM_TIER_LIMITS[tier] || ROOM_TIER_LIMITS.Free;

// ════════════════════════════════════════════════════════════
// CANLI YAYIN LİMİTLERİ
// ════════════════════════════════════════════════════════════

export interface BroadcastLimits {
  canBroadcast: boolean;
  durationMinutes: number;
  dailyBroadcasts: number;
  camera: boolean;
  screenShare: boolean;
  maxCoHosts: number;
  canReceiveGifts: boolean;
}

export const BROADCAST_TIER_LIMITS: Record<SubscriptionTier, BroadcastLimits> = {
  Free:      { canBroadcast: false, durationMinutes: 0,   dailyBroadcasts: 0,   camera: false, screenShare: false, maxCoHosts: 0, canReceiveGifts: false },
  Plus:      { canBroadcast: true,  durationMinutes: 60,  dailyBroadcasts: 3,   camera: true,  screenShare: false, maxCoHosts: 1, canReceiveGifts: true },
  Pro:       { canBroadcast: true,  durationMinutes: 0,   dailyBroadcasts: 999, camera: true,  screenShare: true,  maxCoHosts: 4, canReceiveGifts: true },
  GodMaster: { canBroadcast: true,  durationMinutes: 0,   dailyBroadcasts: 999, camera: true,  screenShare: true,  maxCoHosts: 999, canReceiveGifts: true },
} as const;

export const getBroadcastLimits = (tier: SubscriptionTier = 'Free'): BroadcastLimits =>
  BROADCAST_TIER_LIMITS[tier] || BROADCAST_TIER_LIMITS.Free;


// ════════════════════════════════════════════════════════════
// SİSTEM PUANLARI (SP) KAZANIM TABLOSU (Tek Ekonomi)
// ════════════════════════════════════════════════════════════

export interface SPRewardConfig {
  amount: number;
  /** Cooldown süresi (ms). 0 = cooldown yok */
  cooldownMs: number;
  /** Günlük cap. 0 = sınırsız */
  dailyCap: number;
}

export const SP_REWARDS: Record<string, SPRewardConfig> = {
  // ── Günlük & Giriş ──
  daily_login:           { amount: 5,    cooldownMs: 24 * 3600 * 1000, dailyCap: 5 },   // 1×/gün
  prime_time_return:     { amount: 3,    cooldownMs: 4 * 3600 * 1000,  dailyCap: 3 },   // 1×/gün (19-22)
  // ── Oda İçi Aktivite ──
  stage_time:            { amount: 2,    cooldownMs: 15 * 60 * 1000,   dailyCap: 16 },  // Max 2sa sahne = 16 SP
  camera_time:           { amount: 2,    cooldownMs: 15 * 60 * 1000,   dailyCap: 16 },  // Max 2sa kamera = 16 SP
  message_sent:          { amount: 1,    cooldownMs: 60 * 1000,        dailyCap: 10 },  // Max 10 mesaj ödülü/gün
  // ── Üretim & Büyüme ──
  room_create:           { amount: 5,    cooldownMs: 30 * 60 * 1000,   dailyCap: 10 },  // Max 2 oda/gün ödüllü
  wall_post:             { amount: 3,    cooldownMs: 5 * 60 * 1000,    dailyCap: 9 },   // Max 3 post/gün ödüllü
  follower_gain:         { amount: 2,    cooldownMs: 0,                dailyCap: 10 },  // Max 5 takipçi/gün ödüllü
  // ── Milestone (tek sefer / cooldown ile) ──
  ccu_milestone_10:      { amount: 10,   cooldownMs: 24 * 3600 * 1000, dailyCap: 10 },  // 1×/gün
  ccu_milestone_25:      { amount: 20,   cooldownMs: 24 * 3600 * 1000, dailyCap: 20 },  // 1×/gün
  ccu_milestone_50:      { amount: 40,   cooldownMs: 24 * 3600 * 1000, dailyCap: 40 },  // 1×/gün
  // ── Mağaza & Referral ──
  store_purchase:        { amount: 0,    cooldownMs: 0,                dailyCap: 0 },   // Dinamik: tutar × 1
  referral:              { amount: 25,   cooldownMs: 0,                dailyCap: 50 },  // Max 2 referral/gün
};

/** Üyelik satın alma SP bonusları */
export const SUBSCRIPTION_SP_BONUS: Record<SubscriptionTier, number> = {
  Free: 0,
  Plus: 300,
  Pro: 800,
  GodMaster: 999999,
};

/**
 * Oda Sahibi Bonus Formülü
 * Her saat hesaplanır, günlük cap: 80 SP
 *
 * bonus = floor(
 *   (follower_count × 0.1) +
 *   (concurrent_users × 0.3) +
 *   (log2(total_listen_minutes + 1) × 1)
 * )
 *
 * Referans: 50 takipçi + 10 CCU + 60dk = floor(5 + 3 + 6) = 14 SP/saat
 * Günlük max (6 saat aktif): ~84 SP → cap 80 ile sınırlanır
 */
export function calculateOwnerBonus(followerCount: number, ccu: number, totalListenMinutes: number): number {
  const followerScore = followerCount * 0.1;
  const ccuScore = ccu * 0.3;
  const engagementScore = Math.log2(totalListenMinutes + 1) * 1;
  return Math.floor(followerScore + ccuScore + engagementScore);
}

/** Günlük oda sahibi bonus cap'i */
export const OWNER_BONUS_DAILY_CAP = 80;

// ════════════════════════════════════════════════════════════
// GÜNLÜK CHECK-IN ÖDÜLLERİ (Tier çarpanlı)
// ════════════════════════════════════════════════════════════

/** 7 günlük seri baz ödülleri */
export const DAILY_BASE_REWARDS = [2, 4, 6, 8, 10, 15, 25];

/** Tier bazlı check-in çarpanı */
export const CHECKIN_MULTIPLIER: Record<SubscriptionTier, number> = {
  Free:      1,
  Plus:      1.25,
  Pro:       2,
  GodMaster: 10,
};

/** Check-in ödülünü hesapla
 *  ★ BUG-C5 FIX: streak=0 durumunda NaN önleme.
 */
export function getCheckinReward(streak: number, tier: SubscriptionTier): number {
  if (streak <= 0) return 0; // ★ Guard: streak 0 veya negatifse ödül yok
  const rewardIndex = Math.min(streak - 1, DAILY_BASE_REWARDS.length - 1);
  const base = DAILY_BASE_REWARDS[rewardIndex];
  const multiplier = CHECKIN_MULTIPLIER[tier] || 1;
  return Math.floor(base * multiplier);
}


// ════════════════════════════════════════════════════════════
// GİRİŞ EFEKTLERİ & SOHBET RENKLERİ
// ════════════════════════════════════════════════════════════

export const ENTRY_EFFECT_ACCESS: Record<SubscriptionTier, 'none' | 'basic' | 'plus' | 'pro'> = {
  Free:      'none',
  Plus:      'plus',
  Pro:       'pro',
  GodMaster: 'pro',
};

export const CHAT_COLOR_LIMITS: Record<SubscriptionTier, number> = {
  Free:      0,
  Plus:      5,
  Pro:       999,
  GodMaster: 999,
};

// ════════════════════════════════════════════════════════════
// ODA MÜZİĞİ PRESET'LERİ (Pro+ için)
// ════════════════════════════════════════════════════════════

export interface RoomMusicPreset {
  id: string;
  name: string;
  category: 'ambient' | 'lofi' | 'chill' | 'energetic' | 'classical' | 'nature';
  /** Placeholder URL — production'da CDN URL olacak */
  url: string;
  duration_seconds: number;
  icon: string;
}

export const ROOM_MUSIC_PRESETS: RoomMusicPreset[] = [
  { id: 'lofi_beats',       name: 'Lo-Fi Beats',          category: 'lofi',       url: 'preset://lofi_beats',       duration_seconds: 0, icon: '🎵' },
  { id: 'chill_vibes',      name: 'Chill Vibes',          category: 'chill',      url: 'preset://chill_vibes',      duration_seconds: 0, icon: '🌊' },
  { id: 'ambient_space',    name: 'Ambient Space',        category: 'ambient',    url: 'preset://ambient_space',    duration_seconds: 0, icon: '🌌' },
  { id: 'jazz_cafe',        name: 'Jazz Café',            category: 'chill',      url: 'preset://jazz_cafe',        duration_seconds: 0, icon: '☕' },
  { id: 'piano_classical',  name: 'Piano Classics',       category: 'classical',  url: 'preset://piano_classical',  duration_seconds: 0, icon: '🎹' },
  { id: 'rain_sounds',      name: 'Yağmur Sesleri',       category: 'nature',     url: 'preset://rain_sounds',      duration_seconds: 0, icon: '🌧️' },
  { id: 'forest_ambient',   name: 'Orman Ambiyansı',      category: 'nature',     url: 'preset://forest_ambient',   duration_seconds: 0, icon: '🌲' },
  { id: 'upbeat_pop',       name: 'Upbeat Pop',           category: 'energetic',  url: 'preset://upbeat_pop',       duration_seconds: 0, icon: '🎉' },
  { id: 'electronic_chill', name: 'Electronic Chill',     category: 'chill',      url: 'preset://electronic_chill', duration_seconds: 0, icon: '🎧' },
  { id: 'study_focus',      name: 'Çalışma & Odaklanma',  category: 'ambient',    url: 'preset://study_focus',      duration_seconds: 0, icon: '📚' },
];

// ════════════════════════════════════════════════════════════
// YARDIMCI FONKSİYONLAR
// ════════════════════════════════════════════════════════════

/** Tier rozet bilgisi (UI'da kullanılır) */
export function getTierBadgeInfo(tier: SubscriptionTier | string) {
  // Tier isimlerini normalize et
  const { migrateLegacyTier } = require('../types');
  const normalized = migrateLegacyTier(tier);
  const def = TIER_DEFINITIONS[normalized as SubscriptionTier];
  if (!def) return { label: tier, emoji: '❓', color: '#94A3B8', icon: 'help-circle' };
  return { label: def.label, emoji: def.emoji, color: def.color, icon: def.icon };
}

/** Arama/keşfet önceliği */
export const SEARCH_PRIORITY: Record<SubscriptionTier, number> = {
  Free:      0,
  Plus:      200,
  Pro:       600,
  GodMaster: 9999,
};

/**
 * Prime-time kontrolü — 19:00-22:00 arası mı?
 * SP tetikleyicisi olarak kullanılır.
 */
export function isPrimeTime(): boolean {
  const hour = new Date().getHours();
  return hour >= 19 && hour < 22;
}

/**
 * CCU milestone'larını kontrol et.
 * @returns Ulaşılmış milestone'lar listesi (10, 25, 50)
 */
export function checkCCUMilestones(currentCCU: number, previousCCU: number): number[] {
  const milestones = [10, 25, 50];
  return milestones.filter(m => currentCCU >= m && previousCCU < m);
}
