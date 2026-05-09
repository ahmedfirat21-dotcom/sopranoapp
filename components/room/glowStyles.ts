// ★ v107 (3 May 2026): Mesaj Parlat — 6 sabit stil + 5 premium (Mağaza unlock).
//   RoomChatDrawer (render) ve MessageGlowPickerSheet (seçim) burayı paylaşır.
//   Tek kaynak — circular import riskini önler.
//
// Sabit 6 stil = pay-per-use (her mesajda SP düşer).
// Premium 5 stil = one-time-buy (Mağaza'dan satın alınca free unlock).

export type GlowStyleId =
  | 'gold' | 'heart' | 'neon' | 'fire' | 'celebration' | 'galaxy'
  | 'constellation' | 'or-ancien' | 'inferno' | 'voltaire' | 'belle-epoque';

// ★ v107 hotfix (4 May 2026): Inferno geri eklendi — manuel SVG yerine PNG asset
//   kullanıldığı için görsel kalitesi uygun. Tüm premium glow ID'leri burada.
export const PREMIUM_GLOW_IDS: GlowStyleId[] = [
  'constellation', 'or-ancien', 'inferno', 'voltaire', 'belle-epoque',
];

export const GLOW_STYLES: Record<GlowStyleId, {
  cost: number;
  label: string;
  icon: string;
  headerBg: string[];
  headerColor: string;
  bodyBg: string;
  nameColor: string;
  textColor: string;
  bgGradient: string[];
  bgLocations?: number[];
  bgStart?: { x: number; y: number };
  bgEnd?: { x: number; y: number };
  particles: 'shine' | 'hearts' | 'neon-border' | 'fire-icon' | 'confetti' | 'stars';
  /** ★ Premium = mağazadan tek seferlik satın alma; envanterde varsa SP düşmez. */
  premium?: boolean;
  /** Premium stilin satın alma ücreti (gösterim için, gerçek price_sp DB'de). */
  unlockPrice?: number;
}> = {
  gold: {
    cost: 5, label: 'ALTIN PARLAT', icon: '✨',
    bgGradient: ['#854F0B', '#EF9F27', '#FBBF24'],
    headerBg: ['rgba(0,0,0,0.3)', 'transparent'],
    headerColor: '#FFE082',
    bodyBg: 'rgba(0,0,0,0.15)',
    nameColor: '#3D1F00', textColor: '#1A0A00',
    particles: 'shine',
  },
  heart: {
    cost: 8, label: 'KALP ATIŞI', icon: '💗',
    bgGradient: ['#BE185D', '#F472B6', '#F9A8D4'],
    headerBg: ['rgba(0,0,0,0.25)', 'transparent'],
    headerColor: '#FCE7F3',
    bodyBg: 'rgba(255,255,255,0.1)',
    nameColor: '#831843', textColor: '#500724',
    particles: 'hearts',
  },
  neon: {
    cost: 12, label: 'NEON', icon: '⚡',
    bgGradient: ['#1E1B4B', '#3730A3', '#6366F1'],
    headerBg: ['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.4)'],
    headerColor: '#00FFFF',
    bodyBg: 'rgba(0,0,0,0.5)',
    nameColor: '#00FFFF', textColor: '#FFFFFF',
    particles: 'neon-border',
  },
  fire: {
    cost: 10, label: 'ATEŞ', icon: '🔥',
    bgGradient: ['#7F1D1D', '#DC2626', '#FB923C'],
    headerBg: ['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.35)'],
    headerColor: '#FED7AA',
    bodyBg: 'rgba(0,0,0,0.2)',
    nameColor: '#FED7AA', textColor: '#FFFFFF',
    particles: 'fire-icon',
  },
  celebration: {
    cost: 15, label: 'KUTLAMA', icon: '🎊',
    bgGradient: ['#064E3B', '#059669', '#10B981'],
    headerBg: ['rgba(0,0,0,0.25)', 'transparent'],
    headerColor: '#D1FAE5',
    bodyBg: 'rgba(0,0,0,0.15)',
    nameColor: '#064E3B', textColor: '#FFFFFF',
    particles: 'confetti',
  },
  galaxy: {
    cost: 20, label: 'GALAKSİ', icon: '🌌',
    bgGradient: ['#1E1B4B', '#4C1D95', '#7C3AED'],
    headerBg: ['rgba(251,191,36,0.3)', 'rgba(167,139,250,0.3)'],
    headerColor: '#FBBF24',
    bodyBg: 'rgba(0,0,0,0.4)',
    nameColor: '#FBBF24', textColor: '#FDE68A',
    particles: 'stars',
  },

  // ─── Premium stiller (Mağaza unlock) ───
  // Tek seferlik satın alma → envanterde varsa free render, RPC SP düşmez.
  // unlockPrice: cosmetic_items.price_sp ile birebir.
  constellation: {
    cost: 0, premium: true, unlockPrice: 400,
    label: 'CONSTELLATION', icon: '✨',
    bgGradient: ['#0A0518', '#1E1B4B', '#312E81'],
    headerBg: ['rgba(255,224,130,0.4)', 'rgba(167,139,250,0.3)'],
    headerColor: '#FBBF24',
    bodyBg: 'rgba(0,0,0,0.4)',
    nameColor: '#FBBF24', textColor: '#FDE68A',
    particles: 'stars',
  },
  'or-ancien': {
    cost: 0, premium: true, unlockPrice: 120,
    label: 'OR ANCIEN', icon: '✦',
    bgGradient: ['#1A1500', '#5C4612', '#854F0B'],
    headerBg: ['rgba(255,224,130,0.45)', 'transparent'],
    headerColor: '#FFE082',
    bodyBg: 'rgba(0,0,0,0.2)',
    nameColor: '#3D1F00', textColor: '#1A0A00',
    particles: 'shine',
  },
  inferno: {
    cost: 0, premium: true, unlockPrice: 180,
    label: 'INFERNO', icon: '🔥',
    bgGradient: ['#1F0500', '#7F1D1D', '#B91C1C'],
    headerBg: ['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.4)'],
    headerColor: '#FED7AA',
    bodyBg: 'rgba(0,0,0,0.25)',
    nameColor: '#FED7AA', textColor: '#FFFFFF',
    particles: 'fire-icon',
  },
  voltaire: {
    cost: 0, premium: true, unlockPrice: 220,
    label: 'VOLTAIRE', icon: '⚡',
    bgGradient: ['#0A1828', '#155E75', '#0E7490'],
    headerBg: ['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.5)'],
    headerColor: '#67E8F9',
    bodyBg: 'rgba(0,0,0,0.5)',
    nameColor: '#67E8F9', textColor: '#FFFFFF',
    particles: 'neon-border',
  },
  'belle-epoque': {
    cost: 0, premium: true, unlockPrice: 280,
    label: 'BELLE ÉPOQUE', icon: '💗',
    bgGradient: ['#1A0518', '#831843', '#BE185D'],
    headerBg: ['rgba(0,0,0,0.3)', 'transparent'],
    headerColor: '#FCE7F3',
    bodyBg: 'rgba(255,255,255,0.08)',
    nameColor: '#FCE7F3', textColor: '#FFFFFF',
    particles: 'hearts',
  },
};
