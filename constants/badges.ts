/**
 * SopranoChat — Rozet Kataloğu (Faz 6.3)
 * ═══════════════════════════════════════════════════
 * Tüm mevcut rozetlerin master listesi. user_badges tablosu sadece
 * (user_id, badge_id) tutar; metadata burada — değişmesin diye.
 *
 * id: kalıcı slug, asla değişmez (DB'ye yazılır).
 * Yeni rozet eklerken ID rezervasyonu: `{kategori}_{varyant}` (snake_case).
 */
import type { Ionicons } from '@expo/vector-icons';

export type BadgeRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface BadgeDef {
  id: string;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Renkli emoji — illustrated görünüm için BadgeStrip'te kullanılır (icon fallback). */
  emoji: string;
  color: string;
  glow: string;
  rarity: BadgeRarity;
  /** UI'da çıplak gözle hint için kriter metni — kullanıcı "Nasıl alırım?" sorusuna cevap. */
  criteriaText?: string;
  /** Rozet kazanıldığında verilen SP ödülü */
  spReward: number;
  /** ★ v1.7.13.46 (19 May 2026): Rozetin sağladığı somut/görsel avantajlar listesi.
   *  Detail modal'da "Avantajlar" bölümünde gösterilir. Boş bırakılırsa fallback:
   *  'Profilde sergilenir' satırı eklenir. */
  perks?: string[];
}

export const BADGES: Record<string, BadgeDef> = {
  // ── Erken benimseyen ──
  early_adopter: {
    id: 'early_adopter',
    label: 'Öncü',
    description: 'İlk 1000 kullanıcıdan biri',
    icon: 'rocket',
    emoji: '🚀',
    color: '#F59E0B',
    glow: 'rgba(245,158,11,0.5)',
    rarity: 'legendary',
    criteriaText: 'Uygulamanın ilk 1000 kullanıcısından birisin',
    spReward: 500,
    perks: [
      'Profilde kalıcı altın madalya',
      'Erken katılım göstergesi',
      'Topluluğun kurucularından',
    ],
  },

  // ── Host milestone'ları ──
  host_1: {
    id: 'host_1',
    label: 'İlk Oda',
    description: 'İlk odanı kurdun',
    icon: 'mic',
    emoji: '🎙️',
    color: '#14B8A6',
    glow: 'rgba(20,184,166,0.45)',
    rarity: 'common',
    criteriaText: '1 oda kur',
    spReward: 25,
    perks: [
      'Profilde sergilenir',
      'İlk adım göstergesi',
    ],
  },
  host_10: {
    id: 'host_10',
    label: 'Ev Sahibi',
    description: '10 oda kurdun',
    icon: 'home',
    emoji: '🏠',
    color: '#3B82F6',
    glow: 'rgba(59,130,246,0.5)',
    rarity: 'rare',
    criteriaText: '10 oda kur',
    spReward: 75,
    perks: [
      'Profilde sergilenir',
      'Avatar yanında ev simgesi',
      'Tutkulu host kartı',
    ],
  },
  host_100: {
    id: 'host_100',
    label: 'Konser Salonu',
    description: '100 oda kurdun',
    icon: 'sparkles',
    emoji: '🎪',
    color: '#A855F7',
    glow: 'rgba(168,85,247,0.55)',
    rarity: 'epic',
    criteriaText: '100 oda kur',
    spReward: 200,
    perks: [
      'Profilde sergilenir',
      '"Mucit" etiketi avatarda',
      'Keşfette host önceliği',
    ],
  },

  // ── Sosyal ──
  social_butterfly: {
    id: 'social_butterfly',
    label: 'Sosyal Kelebek',
    description: '50+ arkadaş',
    icon: 'people',
    emoji: '🦋',
    color: '#EC4899',
    glow: 'rgba(236,72,153,0.5)',
    rarity: 'rare',
    criteriaText: '50 arkadaş edin',
    spReward: 75,
    perks: [
      'Profilde sergilenir',
      'Arkadaşlar sekmesinde pembe halka',
      'Sosyal kelebek kartı',
    ],
  },
  popular: {
    id: 'popular',
    label: 'Popüler',
    description: '500+ takipçi',
    icon: 'star',
    emoji: '🌟',
    color: '#FBBF24',
    glow: 'rgba(251,191,36,0.5)',
    rarity: 'epic',
    criteriaText: '500 takipçi topla',
    spReward: 200,
    perks: [
      'Profilde sergilenir',
      'Keşfette boost önceliği',
      'Yıldız profil işareti',
    ],
  },

  // ── SP / Hediye ──
  sp_donor: {
    id: 'sp_donor',
    label: 'Cömert',
    description: 'Başkalarına SP gönderdin',
    icon: 'gift',
    emoji: '🎁',
    color: '#F472B6',
    glow: 'rgba(244,114,182,0.5)',
    rarity: 'common',
    criteriaText: 'En az bir kez SP gönder',
    spReward: 25,
    perks: [
      'Profilde sergilenir',
      'Cömertlik göstergesi',
    ],
  },
  sp_whale: {
    id: 'sp_whale',
    label: 'Balina',
    description: '10000+ SP harcadın',
    icon: 'diamond',
    emoji: '🐋',
    color: '#22D3EE',
    glow: 'rgba(34,211,238,0.55)',
    rarity: 'epic',
    criteriaText: '10000 SP harcayarak balinayım de',
    spReward: 200,
    perks: [
      'Profilde sergilenir',
      'Hediye gönderirken altın animasyon',
      'Balina rütbesi (VIP)',
    ],
  },

  // ── Aktiflik / sahne ──
  stage_pro: {
    id: 'stage_pro',
    label: 'Sahne Ustası',
    description: '100 saat sahnede',
    icon: 'mic-circle',
    emoji: '🎤',
    color: '#10B981',
    glow: 'rgba(16,185,129,0.5)',
    rarity: 'epic',
    criteriaText: '100 saat sahnede mikrofon aç',
    spReward: 200,
    perks: [
      'Profilde sergilenir',
      'Sahnede ekstra parıltı efekti',
      'Sahne ustası unvanı',
    ],
  },

  // ── Resmi rozetler ──
  verified: {
    id: 'verified',
    label: 'Doğrulanmış',
    description: 'SopranoChat tarafından doğrulanmış hesap',
    icon: 'shield-checkmark',
    emoji: '✅',
    color: '#3B82F6',
    glow: 'rgba(59,130,246,0.6)',
    rarity: 'legendary',
    criteriaText: 'Resmi olarak doğrulandı (admin atar)',
    spReward: 500,
    perks: [
      'İsim yanında kalıcı mavi tik',
      'Tüm yerlerde doğrulanmış göstergesi',
      'Resmi hesap güvencesi',
    ],
  },
  staff: {
    id: 'staff',
    label: 'Ekip',
    description: 'SopranoChat ekibinden',
    icon: 'briefcase',
    emoji: '💼',
    color: '#DC2626',
    glow: 'rgba(220,38,38,0.6)',
    rarity: 'legendary',
    criteriaText: 'SopranoChat ekibinden bir kullanıcı',
    spReward: 500,
    perks: [
      'Ekip üyesi rozeti',
      'Topluluğa hizmet kartı',
    ],
  },
  // ── Streak ──
  streak_7: {
    id: 'streak_7',
    label: '1 Hafta',
    description: 'Üst üste 7 gün giriş',
    icon: 'flame',
    emoji: '🔥',
    color: '#EF4444',
    glow: 'rgba(239,68,68,0.5)',
    rarity: 'common',
    criteriaText: 'Üst üste 7 gün giriş yap',
    spReward: 25,
    perks: [
      'Profilde sergilenir',
      'Bağlılık göstergesi',
    ],
  },
  streak_30: {
    id: 'streak_30',
    label: '1 Ay',
    description: 'Üst üste 30 gün giriş',
    icon: 'flame',
    emoji: '⚡',
    color: '#FB923C',
    glow: 'rgba(251,146,60,0.55)',
    rarity: 'rare',
    criteriaText: 'Üst üste 30 gün giriş yap',
    spReward: 75,
    perks: [
      'Profilde sergilenir',
      'Sadık kullanıcı kartı',
      'Aktif topluluk üyesi',
    ],
  },
};

/** Bilinmeyen badge_id güvenli fallback. */
export function getBadgeDef(id: string): BadgeDef | null {
  return BADGES[id] || null;
}

/** Kullanıcının badge ID listesinden BadgeDef'leri çözümle. Bilinmeyenler atlanır. */
export function resolveBadges(ids: string[]): BadgeDef[] {
  return ids.map(getBadgeDef).filter((b): b is BadgeDef => !!b);
}

/** Rarity sırası: legendary > epic > rare > common. */
const RARITY_ORDER: Record<BadgeRarity, number> = {
  legendary: 4, epic: 3, rare: 2, common: 1,
};

export function sortBadgesByRarity(badges: BadgeDef[]): BadgeDef[] {
  return [...badges].sort((a, b) => RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity]);
}
