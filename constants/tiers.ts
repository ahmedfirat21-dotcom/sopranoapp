/**
 * SopranoChat — Abonelik Bazlı Tier Sistemi & Limitler
 * ═══════════════════════════════════════════════════
 *
 * TEMEL FELSEFE:
 *   Altyapı Pro (maksimum) kapasiteye göre tasarlanır,
 *   alt paketler bundan kısıtlanarak (filtrelenerek) oluşturulur.
 *
 * 3 Tier: Free / Plus / Pro
 * (★ v1.7.13.132: GodMaster kaldırıldı — admin yetkisi is_admin → Pro mapping ile)
 * SP tek ekonomi birimi.
 */
import type { SubscriptionTier, StageLayout, RoomMusicConfig } from '../types';

export type TierName = SubscriptionTier;

/**
 * Yeni Plus/Pro abonelik satışı kapalıdır. RevenueCat yalnızca SP paketlerinin
 * Google Play ödemesi için kullanılmaya devam eder. Eski abonelik kayıtları
 * rozet/geçmiş uyumluluğu için korunur; uygulama yetkileri üyeliğe bağlanmaz.
 */
export const MEMBERSHIPS_ENABLED = false;

// ════════════════════════════════════════════════════════════
// ABONELİK TIER TANIMLARI (3 Tier: Free / Plus / Pro)
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
    yearlyPrice: 1079.99, // ★ v1.7.13.140: Play Console canlı fiyatla sync (RC livePrices fallback'i için)
    tagline: 'Sınırsız güç, maksimum prestij',
  },
} as const;

/** Sıralı tier listesi (düşükten yükseğe) */
export const TIER_ORDER: SubscriptionTier[] = ['Free', 'Plus', 'Pro'];

/**
 * ★ v1.7.13.132: GodMaster KALDIRILDI. Legacy çağrılar için geriye-uyumlu stub.
 *   Dönen değer artık her zaman false — kullanan kod yolları ölü dal hâline gelir.
 *   Yeni kodda KULLANMA: is_admin pattern'ini tercih et.
 */
export function isGodMaster(_tier: SubscriptionTier | string): boolean {
  return false;
}

/**
 * Profile'dan efektif tier hesapla — tüm keşfet/oda/SP kontrollerinde
 * aynı mantık kullanılsın diye merkezi util.
 *
 * ★ v1.7.13.132: GodMaster KALDIRILDI. Admin yetkisi is_admin → Pro mapping ile.
 *
 *   Öncelik: is_admin === true                → Pro (admin = en yüksek tier)
 *            subscription_tier set            → kendisi
 *            'GodMaster' (eski DB satırı)     → Pro (legacy migration)
 *            default                          → Free
 */
export function getEffectiveTier(profile: { subscription_tier?: string | null; subscription_expires_at?: string | null; is_admin?: boolean | null } | null | undefined): SubscriptionTier {
  if (!profile) return 'Free';
  if (profile.is_admin) return 'Pro';
  const t = profile.subscription_tier;
  if (t === 'GodMaster') return 'Pro'; // legacy DB satırı
  // ★ v1.7.13.135: Aboneliğin expires_at kontrolü — webhook gecikse bile süresi
  //   biten Pro/Plus üye otomatik Free davranır. store_purchase RPC v109 zaten
  //   server-side check ediyor; bu mobile client tarafı (UI + service guard'lar).
  if (t === 'Plus' || t === 'Pro') {
    const exp = profile.subscription_expires_at;
    if (exp && new Date(exp).getTime() <= Date.now()) {
      return 'Free';
    }
    return t;
  }
  if (t === 'Free') return 'Free';
  return 'Free';
}

/** Tier karşılaştırma: userTier >= requiredTier mi? */
export function isTierAtLeast(userTier: SubscriptionTier, requiredTier: SubscriptionTier): boolean {
  if (!MEMBERSHIPS_ENABLED) return true;
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
    // ★ 2026-04-24 (v3): Free esnetildi — "tap taze platform" stratejisi.
    //   Kullanıcı ücretsiz planla rahat hissetmeli, Plus ekstra güç verir.
    // ★ 2026-05-06 (v110): Free oda süresi 24sa — gün boyu açık kalsın, sonra kapansın.
    maxSpeakers: 20,
    maxListeners: 999,
    maxSpectators: 999,
    maxCameras: 10,
    maxModerators: 20,
    durationHours: 0,
    dailyRooms: 999,
    persistent: false,
    maxPersistentRooms: 0,
    allowedTypes: ['open', 'closed', 'invite'] as readonly string[],
    audioSampleRate: 48000,
    audioChannels: 2,
    videoMaxRes: 1080,
    canCustomizeImage: true,
    canCustomizeTheme: true,
    canUseAvatarFrame: true,      // ★ Temel avatar çerçevesi Free'de
    allowedStageLayouts: ['grid', 'spotlight', 'theater'] as readonly StageLayout[],
    canUseRoomMusic: true,
    canUseFilters: true,           // ★ Yaş/dil filtresi Free'de
    canUseFollowersOnly: true,
    ownerLeavePolicy: 'close',
  },
  Plus: {
    maxSpeakers: 20,
    maxListeners: 999,
    maxSpectators: 999,
    maxCameras: 10,
    maxModerators: 20,
    durationHours: 0,
    dailyRooms: 999,
    persistent: false,
    maxPersistentRooms: 0,
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
    // ★ 2026-04-27: Plus'a açıldı — "Sadece Arkadaşlar" oda yönetim aracı (kim girebilir engeli),
    //   monetizasyon değil. +18/kilit/dil ile aynı sınıfta. Pro tier ekstra olarak müzik/stereo ile ayrışır.
    canUseFollowersOnly: true,
    ownerLeavePolicy: 'close',
  },
  Pro: {
    maxSpeakers: 20,
    maxListeners: 999,          // ★ Sınırsız dinleyici
    maxSpectators: 999,         // ★ Sınırsız seyirci
    maxCameras: 10,
    maxModerators: 20,
    durationHours: 0,           // ★ 7/24 açık
    dailyRooms: 999,
    persistent: false,
    maxPersistentRooms: 0,
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
    ownerLeavePolicy: 'close',
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
  Free:      { canBroadcast: true,  durationMinutes: 0,   dailyBroadcasts: 999, camera: true,  screenShare: true,  maxCoHosts: 4, canReceiveGifts: true },
  Plus:      { canBroadcast: true,  durationMinutes: 0,   dailyBroadcasts: 999, camera: true,  screenShare: true,  maxCoHosts: 4, canReceiveGifts: true },
  Pro:       { canBroadcast: true,  durationMinutes: 0,   dailyBroadcasts: 999, camera: true,  screenShare: true,  maxCoHosts: 4, canReceiveGifts: true },
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

// ★ v86 (1 May 2026): SP üretimi yaklaşık %50 azaltıldı — kullanıcılar mağazadan SP
//   satın almaya yönlendirilsin. Closed test sürerken mevcut bakiyeler dokunulmuyor,
//   sadece yeni kazanımlar bu yeni hızda akar.
//   Eski/yeni karşılaştırma yorumlarda parantez içinde.
export const SP_REWARDS: Record<string, SPRewardConfig> = {
  // ── Günlük & Giriş ──
  daily_login:           { amount: 3,    cooldownMs: 24 * 3600 * 1000, dailyCap: 3 },   // (eski 5/gün) 3 SP/gün
  prime_time_return:     { amount: 2,    cooldownMs: 4 * 3600 * 1000,  dailyCap: 2 },   // (eski 3/gün)
  // ── Oda İçi Aktivite ──
  stage_time:            { amount: 1,    cooldownMs: 15 * 60 * 1000,   dailyCap: 8 },   // (eski 16) Max 2sa sahne = 8 SP
  camera_time:           { amount: 1,    cooldownMs: 15 * 60 * 1000,   dailyCap: 8 },   // (eski 16) Max 2sa kamera = 8 SP
  message_sent:          { amount: 1,    cooldownMs: 60 * 1000,        dailyCap: 5 },   // (eski 10) Max 5 mesaj ödülü/gün
  // ── Üretim & Büyüme ──
  room_create:           { amount: 3,    cooldownMs: 30 * 60 * 1000,   dailyCap: 6 },   // (eski 5×2=10) Max 2 oda/gün
  follower_gain:         { amount: 1,    cooldownMs: 0,                dailyCap: 5 },   // (eski 2×5=10) Max 5 takipçi/gün
  // ── Milestone (tek sefer / cooldown ile) ──
  ccu_milestone_10:      { amount: 5,    cooldownMs: 24 * 3600 * 1000, dailyCap: 5 },   // (eski 10)
  ccu_milestone_25:      { amount: 10,   cooldownMs: 24 * 3600 * 1000, dailyCap: 10 },  // (eski 20)
  ccu_milestone_50:      { amount: 20,   cooldownMs: 24 * 3600 * 1000, dailyCap: 20 },  // (eski 40)
  // ── Mağaza & Referral ──
  store_purchase:        { amount: 0,    cooldownMs: 0,                dailyCap: 0 },   // Dinamik: tutar × 1 (değişmedi)
  referral:              { amount: 15,   cooldownMs: 0,                dailyCap: 30 },  // (eski 25×2=50) Max 2 referral/gün
};

/** Üyelik satın alma SP bonusları
 *  ★ v86 (1 May 2026): 2x arttırıldı — SP üretim hızı düşünce abonelik daha cazip olsun. */
export const SUBSCRIPTION_SP_BONUS: Record<SubscriptionTier, number> = {
  Free: 0,
  Plus: 600,        // (eski 300) +2x — 1 ay = 20 SP/gün ekstra
  Pro: 1500,        // (eski 800) +1.9x — 1 ay = 50 SP/gün ekstra
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

/** Günlük oda sahibi bonus cap'i
 *  ★ v86 (1 May 2026): 80→40 — host'lar günlük 80 SP biriktirip mağazaya hiç bakmıyordu. */
export const OWNER_BONUS_DAILY_CAP = 40;

// ════════════════════════════════════════════════════════════
// GÜNLÜK CHECK-IN ÖDÜLLERİ (Tier çarpanlı)
// ════════════════════════════════════════════════════════════

/** 7 günlük seri baz ödülleri
 *  ★ v86 (1 May 2026): toplam 70→40 (7 günde) — daha tasarruflu. */
export const DAILY_BASE_REWARDS = [1, 2, 3, 5, 7, 10, 12];

/** Tier bazlı check-in çarpanı */
export const CHECKIN_MULTIPLIER: Record<SubscriptionTier, number> = {
  Free:      1,
  Plus:      1.25,
  Pro:       2,
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
// ★ v1.7.13.132: ENTRY_EFFECT_ACCESS ve CHAT_COLOR_LIMITS KALDIRILDI.
//   Bu sabitler tanımlıydı ama hiçbir yerde okunmuyordu (ölü kod).
//   Tier-gated kozmetik kontrolü `cosmetic_items.min_tier` (DB) +
//   `store_purchase` RPC `tier_locked` dönüşü ile yapılır — bkz.
//   supabase/migrations/20260505_v109_fixes_and_tier_lock.sql.
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
