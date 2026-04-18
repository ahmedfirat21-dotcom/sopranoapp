// SopranoChat — Design System (Sabit Koyu Tema)
// Mockup DNA'sına uygun: koyu lacivert bg, teal aksan, beyaz metin

import { getThemeColors } from './themeEngine';

// Sabit marka renkleri
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

  // Premium Neon
  neonCyan: '#00BFFF',
  neonPurple: '#8B5CF6',
  neonPink: '#FF1493',
  neonGold: '#FFD700',
  neonGoldLight: '#FFA500',
  vipGold: '#D4AF37',

  // Semantic Card Colors
  cardBg: '#414e5f',
  cardBorder: '#95a1ae',
  accentTeal: '#73c2bd',
  premiumGold: '#c9b981',
} as const;

// Colors — her erişimde aktif temadan çeker
export const Colors = {
  ...BRAND_COLORS,

  /** Compat shim — her zaman false (açık tema yok) */
  isLight: false as const,

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
  gold: ['#FFD700', '#FFA500'],
  ice: ['#38BDF8', '#0284C7'],
  steel: ['#64748B', '#334155'],
  // Tier gradients
  vipGlow: ['#8B5CF6', '#00BFFF'],
  goldGlow: ['#FFE000', '#FF8C00'],
  silverGlow: ['#94A3B8', '#64748B'],
  bronzeGlow: ['#CD7F32', '#8B4513'],
  // Utility gradients
  tabBar: ['#2a3444', '#273040', '#252e3c'],
  nightSky: ['#0A122E', '#020511', '#000000'],
  hostAura: ['#FFD700', '#FFA500', 'transparent', 'transparent'],
};

export const Radius = {
  default: 16,
  card: 24,
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
  h1: { fontSize: 24, fontWeight: '800' as const, fontFamily: 'Inter_700Bold' },
  h2: { fontSize: 18, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  h3: { fontSize: 15, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  body: { fontSize: 14, fontWeight: '400' as const, fontFamily: 'Inter_400Regular' },
  bodySmall: { fontSize: 12, fontWeight: '400' as const, fontFamily: 'Inter_400Regular' },
  caption: { fontSize: 11, fontWeight: '500' as const, fontFamily: 'Inter_500Medium' },
  tiny: { fontSize: 10, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold' },
  micro: { fontSize: 9, fontWeight: '700' as const, fontFamily: 'Inter_700Bold' },
  vipTitle: { fontSize: 13, fontWeight: '400' as const, letterSpacing: 2, fontFamily: 'Inter_400Regular' },
  vipLabel: { fontSize: 12, fontWeight: '400' as const, letterSpacing: 4, fontFamily: 'Inter_400Regular' },
};

export const BlurStyles = {
  cardBg: 'rgba(20, 20, 30, 0.4)',
  cardBorder: 'rgba(255, 255, 255, 0.1)',
  pillBg: 'rgba(255, 255, 255, 0.08)',
  chatPillBg: 'rgba(255, 255, 255, 0.08)',
  controlBg: 'rgba(255, 255, 255, 0.06)',
};

/** Global gölge stilleri — tüm ekranlarda tutarlı kullanım için */
export const Shadows = {
  /** Metin gölgesi — Text bileşenlerine spread edin */
  text: {
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  } as const,
  /** Hafif metin gölgesi — ikincil metinler için */
  textLight: {
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  } as const,
  /** Kart / düğme gölgesi — View bileşenlerine spread edin */
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  } as const,
  /** Düğme gölgesi */
  button: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  } as const,
  /** İkon wrap gölgesi */
  icon: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  } as const,
};
