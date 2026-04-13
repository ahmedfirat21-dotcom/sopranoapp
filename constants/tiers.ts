/**
 * SopranoChat — Abonelik Bazlı Tier Sistemi & Limitler
 * ═══════════════════════════════════════════════════
 *
 * TEMEL FELSEFE:
 *   Altyapı VIP (maksimum) kapasiteye göre tasarlanır,
 *   alt paketler bundan kısıtlanarak (filtrelenerek) oluşturulur.
 *
 * 5 Tier: Free / Bronze / Silver / Gold / VIP
 * SP tek ekonomi birimi.
 */
import type { SubscriptionTier, StageLayout, RoomMusicConfig } from '../types';

// Alias
export type TierName = SubscriptionTier;

// ════════════════════════════════════════════════════════════
// ABONELİK TIER TANIMLARI (5 Katman)
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
  Bronze: {
    name: 'Bronze',
    label: 'Bronze',
    emoji: '🥉',
    icon: 'shield-outline',
    color: '#CD7F32',
    gradient: ['#CD7F32', '#A0522D'],
    monthlyPrice: 79.99,
    yearlyPrice: 699.99,
    tagline: 'İlk adımı at, daha fazlasını keşfet',
  },
  Silver: {
    name: 'Silver',
    label: 'Silver',
    emoji: '⭐',
    icon: 'star',
    color: '#C0C0C0',
    gradient: ['#C0C0C0', '#A8A8A8'],
    monthlyPrice: 149.99,
    yearlyPrice: 1299.99,
    tagline: 'Kişiselleştir, özelleştir, öne çık',
  },
  Gold: {
    name: 'Gold',
    label: 'Gold',
    emoji: '💎',
    icon: 'diamond',
    color: '#FFD700',
    gradient: ['#FFD700', '#DAA520'],
    monthlyPrice: 279.99,
    yearlyPrice: 2399.99,
    tagline: 'Profesyonel yayıncı deneyimi',
  },
  VIP: {
    name: 'VIP',
    label: 'VIP',
    emoji: '👑',
    icon: 'diamond',
    color: '#FF6B35',
    gradient: ['#FF6B35', '#E55100'],
    monthlyPrice: 549.99,
    yearlyPrice: 4699.99,
    tagline: 'Sınırsız güç, maksimum prestij',
  },
} as const;

/** Sıralı tier listesi (düşükten yükseğe) */
export const TIER_ORDER: SubscriptionTier[] = ['Free', 'Bronze', 'Silver', 'Gold', 'VIP'];

/** Tier karşılaştırma: userTier >= requiredTier mi? */
export function isTierAtLeast(userTier: SubscriptionTier, requiredTier: SubscriptionTier): boolean {
  return TIER_ORDER.indexOf(userTier) >= TIER_ORDER.indexOf(requiredTier);
}

/** Tier seviye numarası (0-4) */
export function getTierLevel(tier: SubscriptionTier): number {
  return TIER_ORDER.indexOf(tier);
}

// ════════════════════════════════════════════════════════════
// ODA LİMİTLERİ (5-Tier Matrisi)
// ════════════════════════════════════════════════════════════

export interface RoomLimits {
  /** Sahnede aynı anda bulunabilecek max kişi (owner dahil) */
  maxSpeakers: number;
  /** Dinleyici grid kapasitesi (tüm tierlarda 20) */
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
    maxModerators: 0,
    durationHours: 2,
    dailyRooms: 3,
    persistent: false,
    maxPersistentRooms: 0,
    allowedTypes: ['open'] as readonly string[],
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
  Bronze: {
    maxSpeakers: 6,
    maxListeners: 15,
    maxSpectators: 100,
    maxCameras: 5,
    maxModerators: 1,
    durationHours: 6,
    dailyRooms: 5,
    persistent: true,
    maxPersistentRooms: 1,
    allowedTypes: ['open', 'closed'] as readonly string[],
    audioSampleRate: 32000,
    audioChannels: 1,
    videoMaxRes: 480,
    canCustomizeImage: false,
    canCustomizeTheme: false,
    canUseAvatarFrame: false,
    allowedStageLayouts: ['grid'] as readonly StageLayout[],
    canUseRoomMusic: false,
    canUseFilters: false,
    canUseFollowersOnly: false,
    ownerLeavePolicy: 'keep_alive',
  },
  Silver: {
    maxSpeakers: 8,
    maxListeners: 20,
    maxSpectators: 200,
    maxCameras: 6,
    maxModerators: 2,
    durationHours: 12,
    dailyRooms: 10,
    persistent: true,
    maxPersistentRooms: 2,
    allowedTypes: ['open', 'closed'] as readonly string[],
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
  Gold: {
    maxSpeakers: 10,
    maxListeners: 25,
    maxSpectators: 500,
    maxCameras: 8,
    maxModerators: 3,
    durationHours: 24,
    dailyRooms: 999,
    persistent: true,
    maxPersistentRooms: 5,
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
  VIP: {
    maxSpeakers: 13,           // ★ Owner dahil 13 kişi
    maxListeners: 30,          // ★ Gold(25)'ten fazla
    maxSpectators: 999,        // ★ Sınırsız seyirci
    maxCameras: 10,            // ★ Gold(8)'den fazla
    maxModerators: 5,
    durationHours: 0,          // ★ 7/24 açık
    dailyRooms: 999,
    persistent: true,
    maxPersistentRooms: 999,
    allowedTypes: ['open', 'closed', 'invite'] as readonly string[],
    audioSampleRate: 48000,
    audioChannels: 2,          // ★ Stereo ses
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
  Free:   { canBroadcast: false, durationMinutes: 0,   dailyBroadcasts: 0,   camera: false, screenShare: false, maxCoHosts: 0, canReceiveGifts: false },
  Bronze: { canBroadcast: true,  durationMinutes: 30,  dailyBroadcasts: 1,   camera: true,  screenShare: false, maxCoHosts: 0, canReceiveGifts: false },
  Silver: { canBroadcast: true,  durationMinutes: 60,  dailyBroadcasts: 2,   camera: true,  screenShare: false, maxCoHosts: 1, canReceiveGifts: true },
  Gold:   { canBroadcast: true,  durationMinutes: 180, dailyBroadcasts: 5,   camera: true,  screenShare: true,  maxCoHosts: 2, canReceiveGifts: true },
  VIP:    { canBroadcast: true,  durationMinutes: 0,   dailyBroadcasts: 999, camera: true,  screenShare: true,  maxCoHosts: 4, canReceiveGifts: true },
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
  daily_login:           { amount: 15,   cooldownMs: 24 * 3600 * 1000, dailyCap: 15 },
  prime_time_return:     { amount: 10,   cooldownMs: 3 * 3600 * 1000,  dailyCap: 20 },
  stage_time:            { amount: 8,    cooldownMs: 10 * 60 * 1000,   dailyCap: 120 },
  camera_time:           { amount: 12,   cooldownMs: 10 * 60 * 1000,   dailyCap: 180 },
  message_sent:          { amount: 1,    cooldownMs: 30 * 1000,        dailyCap: 50 },
  room_create:           { amount: 30,   cooldownMs: 0,                dailyCap: 90 },
  follower_gain:         { amount: 5,    cooldownMs: 0,                dailyCap: 100 },
  ccu_milestone_10:      { amount: 25,   cooldownMs: 0,                dailyCap: 200 },
  ccu_milestone_25:      { amount: 50,   cooldownMs: 0,                dailyCap: 200 },
  ccu_milestone_50:      { amount: 100,  cooldownMs: 0,                dailyCap: 200 },
  store_purchase:        { amount: 0,    cooldownMs: 0,                dailyCap: 0 },    // Dinamik: tutar × 2
  referral:              { amount: 100,  cooldownMs: 0,                dailyCap: 500 },
};

/** Üyelik satın alma SP bonusları */
export const SUBSCRIPTION_SP_BONUS: Record<SubscriptionTier, number> = {
  Free: 0,
  Bronze: 500,
  Silver: 800,
  Gold: 1200,
  VIP: 2000,
};

/**
 * Oda Sahibi Bonus Formülü
 * Her saat hesaplanır, günlük cap: 250 SP
 *
 * bonus = floor(
 *   (follower_count × 0.5) +
 *   (concurrent_users × 2) +
 *   (log2(total_listen_minutes + 1) × 3)
 * )
 */
export function calculateOwnerBonus(followerCount: number, ccu: number, totalListenMinutes: number): number {
  const followerScore = followerCount * 0.5;
  const ccuScore = ccu * 2;
  const engagementScore = Math.log2(totalListenMinutes + 1) * 3;
  return Math.floor(followerScore + ccuScore + engagementScore);
}

/** Günlük oda sahibi bonus cap'i */
export const OWNER_BONUS_DAILY_CAP = 250;

// ════════════════════════════════════════════════════════════
// GÜNLÜK CHECK-IN ÖDÜLLERİ (Tier çarpanlı)
// ════════════════════════════════════════════════════════════

/** 7 günlük seri baz ödülleri */
export const DAILY_BASE_REWARDS = [5, 10, 15, 20, 25, 35, 50];

/** Tier bazlı check-in çarpanı */
export const CHECKIN_MULTIPLIER: Record<SubscriptionTier, number> = {
  Free:   1,
  Bronze: 1.25,
  Silver: 1.5,
  Gold:   2,
  VIP:    3,
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

export const ENTRY_EFFECT_ACCESS: Record<SubscriptionTier, 'none' | 'basic' | 'silver' | 'gold' | 'vip'> = {
  Free:   'none',
  Bronze: 'basic',
  Silver: 'silver',
  Gold:   'gold',
  VIP:    'vip',
};

export const CHAT_COLOR_LIMITS: Record<SubscriptionTier, number> = {
  Free:   0,   // Sadece beyaz
  Bronze: 2,
  Silver: 5,
  Gold:   10,
  VIP:    999, // Özel renk dahil tümü
};

// ════════════════════════════════════════════════════════════
// ODA MÜZİĞİ PRESET'LERİ (Gold+ için)
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
  Free:   0,
  Bronze: 100,
  Silver: 200,
  Gold:   400,
  VIP:    600,
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
