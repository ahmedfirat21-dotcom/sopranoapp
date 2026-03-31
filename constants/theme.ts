// SopranoChat — Design System (sc2 Premium VIP)
// Tema desteği: oled, dark, midnight
// Tema değişikliğinde _layout.tsx'teki themeVersion state artar ve 
// tüm ekranlar re-render olur (Colors her erişimde güncel paletten çeker)

import { getThemeColors } from './themeEngine';

// Sabit renkler — tema değişse de değişmez
const BRAND_COLORS = {
  teal: '#14B8A6',
  tealDark: '#0D9488',
  cyan: '#06B6D4',
  ice: '#38BDF8',
  sapphire: '#2563EB',
  emerald: '#059669',
  gold: '#D97706',
  steel: '#3B82F6',
  silver: '#94A3B8',
  red: '#EF4444',
  amber: '#F59E0B',

  // sc2 Premium Neon Renkleri
  neonCyan: '#00BFFF',
  neonPurple: '#8B5CF6',
  neonPink: '#FF1493',
  neonGold: '#FFD700',
  neonGoldLight: '#FFA500',
  vipGold: '#D4AF37',
} as const;

// Colors — her erişimde aktif temadan çeker
export const Colors = {
  // Brand (sabit)
  ...BRAND_COLORS,

  // Dinamik getter'lar (tema bazlı)
  get bg() { return getThemeColors().bg; },
  get bg2() { return getThemeColors().bg2; },
  get bg3() { return getThemeColors().bg3; },
  get bg4() { return getThemeColors().bg4; },
  get bg5() { return getThemeColors().bg5; },
  get text() { return getThemeColors().text; },
  get text2() { return getThemeColors().text2; },
  get text3() { return getThemeColors().text3; },
  get glass() { return getThemeColors().glass; },
  get glass2() { return getThemeColors().glass2; },
  get glass3() { return getThemeColors().glass3; },
  get glassBorder() { return getThemeColors().glassBorder; },
  get glassBorder2() { return getThemeColors().glassBorder2; },
};

export const Gradients = {
  brand: ['#FFFFFF', '#14B8A6'],
  teal: ['#14B8A6', '#06B6D4'],
  sapphire: ['#3B82F6', '#1D4ED8'],
  emerald: ['#10B981', '#047857'],
  gold: ['#FFD700', '#FFA500'],          // sc2 altın
  ice: ['#38BDF8', '#0284C7'],
  steel: ['#64748B', '#334155'],
  vipGold: ['#FFE000', '#FF8C00'],       // Hediye butonu
  vipPurpleCyan: ['#8B5CF6', '#00BFFF'], // Aktif kategori pill
  plat: ['#06B6D4', '#0891B2'],
  silverG: ['#94A3B8', '#64748B'],
  tabBar: ['#0C0E11', '#070809', '#050607'],
  nightSky: ['#0A122E', '#020511', '#000000'], // sc2 oda arka planı
  hostAura: ['#FFD700', '#FFA500', 'transparent', 'transparent'], // Host altın aura
};

export const Radius = {
  default: 16,
  card: 24,     // sc2 squircle kart radius
  sm: 12,
  xs: 8,
  full: 999,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const Typography = {
  h1: { fontSize: 24, fontWeight: '800' as const },
  h2: { fontSize: 18, fontWeight: '700' as const },
  h3: { fontSize: 15, fontWeight: '700' as const },
  body: { fontSize: 14, fontWeight: '400' as const },
  bodySmall: { fontSize: 12, fontWeight: '400' as const },
  caption: { fontSize: 11, fontWeight: '500' as const },
  tiny: { fontSize: 10, fontWeight: '600' as const },
  micro: { fontSize: 9, fontWeight: '700' as const },
  // sc2 VIP başlık stili
  vipTitle: { fontSize: 13, fontWeight: '400' as const, letterSpacing: 2 },
  vipLabel: { fontSize: 12, fontWeight: '400' as const, letterSpacing: 4 },
};

export const BlurStyles = {
  // Glassmorphism sabit değerler
  cardBg: 'rgba(20, 20, 30, 0.4)',
  cardBorder: 'rgba(255, 255, 255, 0.1)',
  pillBg: 'rgba(255, 255, 255, 0.08)',
  chatPillBg: 'rgba(255, 255, 255, 0.08)',
  controlBg: 'rgba(255, 255, 255, 0.06)',
};
