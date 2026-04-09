/**
 * SopranoChat — Rozet (Badge) Kataloğu
 * 30 rozet: Sosyal, Hosting, Ekonomi, Dinleyici, Özel
 * Her rozet için otomatik kontrol fonksiyonu dahil
 */
import type { Badge } from '../types';

export interface BadgeDefinition extends Omit<Badge, 'unlockedAt'> {
  /** Kategori */
  category: 'social' | 'hosting' | 'economy' | 'listening' | 'special' | 'tier';
  /** Sıralama önceliği (düşük = üstte) */
  order: number;
  /** Rozet açıklama metni (koşul karşılandığında gösterilir) */
  unlockText: string;
  /** Rozet nadir mi? Profilde özel gösterim */
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

// ════════════════════════════════════════════════════════════
// ROZET KATEGORİLERİ
// ════════════════════════════════════════════════════════════

export const BADGE_CATEGORIES = [
  { id: 'social', label: 'Sosyal', icon: 'people', color: '#8B5CF6' },
  { id: 'hosting', label: 'Hosting', icon: 'mic', color: '#14B8A6' },
  { id: 'economy', label: 'Ekonomi', icon: 'diamond', color: '#F59E0B' },
  { id: 'listening', label: 'Dinleyici', icon: 'headset', color: '#3B82F6' },
  { id: 'special', label: 'Özel', icon: 'star', color: '#EC4899' },
  { id: 'tier', label: 'Tier', icon: 'shield', color: '#00BFFF' },
] as const;

// ════════════════════════════════════════════════════════════
// 30 ROZET TANIMI
// ════════════════════════════════════════════════════════════

export const BADGE_CATALOG: BadgeDefinition[] = [
  // ═══ SOSYAL (7) ═══
  {
    id: 'first_friend',
    name: 'İlk Arkadaş',
    icon: 'person-add',
    color: '#8B5CF6',
    description: 'İlk takipçini kazan',
    condition: 'followers >= 1',
    category: 'social',
    order: 1,
    unlockText: 'Sosyal yolculuğun başladı! 🎉',
    rarity: 'common',
  },
  {
    id: 'social_butterfly',
    name: 'Sosyal Kelebek',
    icon: 'people',
    color: '#A855F7',
    description: '10 takipçiye ulaş',
    condition: 'followers >= 10',
    category: 'social',
    order: 2,
    unlockText: 'Herkes seni tanıyor!',
    rarity: 'common',
  },
  {
    id: 'influencer',
    name: 'Influencer',
    icon: 'megaphone',
    color: '#EC4899',
    description: '50 takipçiye ulaş',
    condition: 'followers >= 50',
    category: 'social',
    order: 3,
    unlockText: 'Etkili bir ses oldun!',
    rarity: 'rare',
  },
  {
    id: 'celebrity',
    name: 'Ünlü',
    icon: 'star',
    color: '#F59E0B',
    description: '200 takipçiye ulaş',
    condition: 'followers >= 200',
    category: 'social',
    order: 4,
    unlockText: 'SopranoChat ünlüsü!',
    rarity: 'epic',
  },
  {
    id: 'legend',
    name: 'Efsane',
    icon: 'flame',
    color: '#EF4444',
    description: '1000 takipçiye ulaş',
    condition: 'followers >= 1000',
    category: 'social',
    order: 5,
    unlockText: 'Artık bir efsanesin! 🔥',
    rarity: 'legendary',
  },
  {
    id: 'wall_writer',
    name: 'Duvar Yazarı',
    icon: 'create',
    color: '#6366F1',
    description: '10 oda duvarı paylaşımı yap',
    condition: 'wall_posts >= 10',
    category: 'social',
    order: 6,
    unlockText: 'Duvarları konuşturuyorsun!',
    rarity: 'common',
  },
  {
    id: 'dm_master',
    name: 'DM Ustası',
    icon: 'chatbubble-ellipses',
    color: '#8B5CF6',
    description: '100 mesaj gönder',
    condition: 'messages_sent >= 100',
    category: 'social',
    order: 7,
    unlockText: 'Sohbetin kralı!',
    rarity: 'rare',
  },

  // ═══ HOSTİNG (7) ═══
  {
    id: 'first_room',
    name: 'İlk Oda',
    icon: 'home',
    color: '#14B8A6',
    description: 'İlk odanı oluştur',
    condition: 'rooms_created >= 1',
    category: 'hosting',
    order: 10,
    unlockText: 'Hoş geldin, host! 🎙️',
    rarity: 'common',
  },
  {
    id: 'frequent_host',
    name: 'Sık Host',
    icon: 'mic',
    color: '#0D9488',
    description: '10 oda oluştur',
    condition: 'rooms_created >= 10',
    category: 'hosting',
    order: 11,
    unlockText: 'Düzenli host\'sun!',
    rarity: 'common',
  },
  {
    id: 'veteran_host',
    name: 'Kıdemli Host',
    icon: 'shield-checkmark',
    color: '#059669',
    description: '50 oda oluştur',
    condition: 'rooms_created >= 50',
    category: 'hosting',
    order: 12,
    unlockText: 'Tecrübeli bir host!',
    rarity: 'rare',
  },
  {
    id: 'crowd_puller',
    name: 'Kalabalık Toplayıcı',
    icon: 'people-circle',
    color: '#10B981',
    description: 'Bir odada 20+ dinleyiciye ulaş',
    condition: 'max_listeners_in_room >= 20',
    category: 'hosting',
    order: 13,
    unlockText: 'Odanı tıka basa doldurdun!',
    rarity: 'rare',
  },
  {
    id: 'marathon_host',
    name: 'Maraton Host',
    icon: 'time',
    color: '#06B6D4',
    description: 'Tek seferde 3+ saat oda açık tut',
    condition: 'longest_room_hours >= 3',
    category: 'hosting',
    order: 14,
    unlockText: 'Dayanıklılık rekoru! ⏰',
    rarity: 'epic',
  },
  {
    id: 'night_owl',
    name: 'Gece Kuşu',
    icon: 'moon',
    color: '#7C3AED',
    description: 'Gece 02:00-05:00 arası oda oluştur',
    condition: 'room_created_at_night',
    category: 'hosting',
    order: 15,
    unlockText: 'Gece kuşları seni seviyor! 🦉',
    rarity: 'rare',
  },
  {
    id: 'music_maestro',
    name: 'Müzik Maestrosu',
    icon: 'musical-notes',
    color: '#D946EF',
    description: '20 müzik kategorisi oda oluştur',
    condition: 'music_rooms_created >= 20',
    category: 'hosting',
    order: 16,
    unlockText: 'Müziğin sesi! 🎵',
    rarity: 'rare',
  },

  // ═══ EKONOMİ (6) ═══
  {
    id: 'first_gift',
    name: 'İlk Hediye',
    icon: 'gift',
    color: '#F59E0B',
    description: 'İlk hediyeni gönder',
    condition: 'gifts_sent >= 1',
    category: 'economy',
    order: 20,
    unlockText: 'Cömertlik güzel bir şey! 🎁',
    rarity: 'common',
  },
  {
    id: 'generous',
    name: 'Cömert',
    icon: 'gift',
    color: '#EAB308',
    description: '50 hediye gönder',
    condition: 'gifts_sent >= 50',
    category: 'economy',
    order: 21,
    unlockText: 'Cömertlikte sınır yok!',
    rarity: 'rare',
  },
  {
    id: 'philanthropist',
    name: 'Hayırsever',
    icon: 'heart',
    color: '#EF4444',
    description: '500 hediye gönder',
    condition: 'gifts_sent >= 500',
    category: 'economy',
    order: 22,
    unlockText: 'SopranoChat hayırseveri!',
    rarity: 'legendary',
  },
  {
    id: 'gift_magnet',
    name: 'Hediye Mıknatısı',
    icon: 'magnet',
    color: '#DC2626',
    description: '100 hediye al',
    condition: 'gifts_received >= 100',
    category: 'economy',
    order: 23,
    unlockText: 'Herkes sana hediye yağdırıyor!',
    rarity: 'rare',
  },
  {
    id: 'sp_collector',
    name: 'SP Koleksiyoncusu',
    icon: 'diamond',
    color: '#00BFFF',
    description: '1000 SP biriktir',
    condition: 'system_points >= 1000',
    category: 'economy',
    order: 24,
    unlockText: 'Parıl parıl! 💎',
    rarity: 'epic',
  },
  {
    id: 'sp_hoarder',
    name: 'SP Biriktirici',
    icon: 'cash',
    color: '#FCD34D',
    description: '10.000 SP biriktir',
    condition: 'system_points >= 10000',
    category: 'economy',
    order: 25,
    unlockText: 'Hazine sandığın doluyor! 🪙',
    rarity: 'rare',
  },

  // ═══ DİNLEYİCİ (5) ═══
  {
    id: 'curious_listener',
    name: 'Meraklı Dinleyici',
    icon: 'headset',
    color: '#3B82F6',
    description: '10 farklı odayı ziyaret et',
    condition: 'rooms_visited >= 10',
    category: 'listening',
    order: 30,
    unlockText: 'Keşfetmeye başladın!',
    rarity: 'common',
  },
  {
    id: 'explorer',
    name: 'Kaşif',
    icon: 'compass',
    color: '#2563EB',
    description: '50 farklı odayı ziyaret et',
    condition: 'rooms_visited >= 50',
    category: 'listening',
    order: 31,
    unlockText: 'Her yeri gezdin! 🧭',
    rarity: 'rare',
  },
  {
    id: 'active_listener',
    name: 'Aktif Dinleyici',
    icon: 'ear',
    color: '#1D4ED8',
    description: '100 saat oda dinle',
    condition: 'listen_hours >= 100',
    category: 'listening',
    order: 32,
    unlockText: 'Dinleme uzmanı! 👂',
    rarity: 'epic',
  },
  {
    id: 'stage_star',
    name: 'Sahne Yıldızı',
    icon: 'sparkles',
    color: '#60A5FA',
    description: '50 kez sahneye çık',
    condition: 'times_on_stage >= 50',
    category: 'listening',
    order: 33,
    unlockText: 'Sahnenin yıldızı! ⭐',
    rarity: 'rare',
  },
  {
    id: 'chat_warrior',
    name: 'Sohbet Savaşçısı',
    icon: 'chatbubbles',
    color: '#818CF8',
    description: 'Oda sohbetinde 500 mesaj yaz',
    condition: 'room_chats >= 500',
    category: 'listening',
    order: 34,
    unlockText: 'Sohbetin kalbi sensin!',
    rarity: 'rare',
  },

  // ═══ ÖZEL (5) ═══
  {
    id: 'early_bird',
    name: 'Kurucu Üye',
    icon: 'ribbon',
    color: '#EC4899',
    description: 'SopranoChat\'in ilk 1000 üyesinden biri ol',
    condition: 'user_number <= 1000',
    category: 'special',
    order: 40,
    unlockText: 'OG üye! Sen bir efsanesin! 🏅',
    rarity: 'legendary',
  },
  {
    id: 'streak_master',
    name: 'Seri Ustası',
    icon: 'flame',
    color: '#F97316',
    description: '30 gün üst üste giriş yap',
    condition: 'login_streak >= 30',
    category: 'special',
    order: 41,
    unlockText: 'Bir ay boyunca hiç kaçırmadın! 🔥',
    rarity: 'epic',
  },
  {
    id: 'referral_king',
    name: 'Davet Kralı',
    icon: 'link',
    color: '#14B8A6',
    description: '10 arkadaşını davet et',
    condition: 'referrals >= 10',
    category: 'special',
    order: 42,
    unlockText: 'Topluluğu büyütüyorsun! 👑',
    rarity: 'rare',
  },
  {
    id: 'sp_hunter',
    name: 'SP Avcısı',
    icon: 'trending-up',
    color: '#22C55E',
    description: '10.000 SP kazan',
    condition: 'system_points >= 10000',
    category: 'special',
    order: 43,
    unlockText: 'SP makinesini durduramazsınız!',
    rarity: 'rare',
  },
  {
    id: 'tier_master',
    name: 'Tier Ustası',
    icon: 'trophy',
    color: '#FFD700',
    description: '50.000 SP biriktir',
    condition: 'system_points >= 50000',
    category: 'special',
    order: 44,
    unlockText: 'Ekonominin efendisi! 🏆',
    rarity: 'epic',
  },

  // ═══ TIER ROZETLERİ (5 — otomatik) ═══
  {
    id: 'tier_bronze',
    name: 'Bronz Üye',
    icon: 'shield',
    color: '#CD7F32',
    description: 'Bronz tier\'a ulaş',
    condition: 'tier >= Bronze',
    category: 'tier',
    order: 50,
    unlockText: 'Bronz çağına hoş geldin! 🥉',
    rarity: 'common',
  },
  {
    id: 'tier_silver',
    name: 'Gümüş Üye',
    icon: 'shield',
    color: '#C0C0C0',
    description: 'Gümüş tier\'a ulaş',
    condition: 'tier >= Silver',
    category: 'tier',
    order: 51,
    unlockText: 'Gümüş parıltısı! 🥈',
    rarity: 'common',
  },
  {
    id: 'tier_gold',
    name: 'Altın Üye',
    icon: 'star',
    color: '#FFD700',
    description: 'Altın tier\'a ulaş',
    condition: 'tier >= Gold',
    category: 'tier',
    order: 52,
    unlockText: 'Altın çağ! ⭐',
    rarity: 'rare',
  },
  {
    id: 'tier_vip',
    name: 'VIP Üye',
    icon: 'diamond',
    color: '#00BFFF',
    description: 'VIP tier\'a ulaş',
    condition: 'tier >= VIP',
    category: 'tier',
    order: 53,
    unlockText: 'Platformun en ayrıcalıklı üyesi! 💎',
    rarity: 'epic',
  },
] as const;

// ════════════════════════════════════════════════════════════
// YARDIMCI FONKSİYONLAR
// ════════════════════════════════════════════════════════════

/** Rozet ID ile tanımı bul */
export function getBadgeById(id: string): BadgeDefinition | undefined {
  return BADGE_CATALOG.find(b => b.id === id);
}

/** Kategoriye göre rozetleri filtrele */
export function getBadgesByCategory(category: string): BadgeDefinition[] {
  return BADGE_CATALOG.filter(b => b.category === category).sort((a, b) => a.order - b.order);
}

/** Nadirlık sırasına göre sırala */
const RARITY_ORDER = { common: 1, rare: 2, epic: 3, legendary: 4 };
export function sortByRarity(badges: BadgeDefinition[]): BadgeDefinition[] {
  return [...badges].sort((a, b) => RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity]);
}

/** Nadirlık rengi */
export function getRarityColor(rarity: string): string {
  switch (rarity) {
    case 'legendary': return '#FF6B6B';
    case 'epic': return '#A855F7';
    case 'rare': return '#3B82F6';
    default: return '#94A3B8';
  }
}

/** Nadirlık etiketi */
export function getRarityLabel(rarity: string): string {
  switch (rarity) {
    case 'legendary': return 'Efsanevi';
    case 'epic': return 'Destansı';
    case 'rare': return 'Nadir';
    default: return 'Normal';
  }
}

/** Toplam rozet sayısı */
export const TOTAL_BADGES = BADGE_CATALOG.length; // 30

/** Rozet ilerleme yüzdesi hesapla */
export function getBadgeProgress(unlockedCount: number): { percent: number; label: string } {
  const percent = Math.round((unlockedCount / TOTAL_BADGES) * 100);
  let label = 'Başlangıç';
  if (percent >= 90) label = 'Efsane Koleksiyoncu';
  else if (percent >= 70) label = 'Uzman Koleksiyoncu';
  else if (percent >= 50) label = 'Koleksiyoncu';
  else if (percent >= 25) label = 'Meraklı';
  else if (percent >= 10) label = 'Toplayıcı';
  return { percent, label };
}
