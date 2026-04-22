// SopranoChat — Tema Sistemi (Sabit Koyu Tema)
// Tek tema: koyu lacivert (mockup DNA'sına göre)

export type ThemeKey = 'dark';

type ThemeColors = {
  bg: string;
  bg2: string;
  bg3: string;
  bg4: string;
  bg5: string;
  text: string;
  text2: string;
  text3: string;
  glass: string;
  glass2: string;
  glass3: string;
  glassBorder: string;
  glassBorder2: string;
};

// ★ 2026-04-20: Midnight Sapphire — pürüzsüz royal navy zemin, kart yüzeyleri
//   hafif lift ile ayırt edilir. Solid renk, glow yok.
const DARK_COLORS: ThemeColors = {
  bg:  '#0F1929',   // Royal navy — ana uygulama zemini
  bg2: '#070D17',   // En derin katman — modal backdrop
  bg3: '#162236',   // Raised surface — kart içi fon
  bg4: '#1F2E48',   // Elevated — modal/panel arka plan
  bg5: '#2A3C5C',   // Highlighted — active/selected state
  text: '#F1F5F9',
  text2: '#A8B4C7',
  text3: '#6B7A93',
  glass: '#1C2840',
  glass2: '#243350',
  glass3: '#2C3E62',
  glassBorder: 'rgba(125, 170, 229, 0.14)',
  glassBorder2: 'rgba(125, 170, 229, 0.22)',
};

export const THEME_PALETTES: Record<ThemeKey, ThemeColors> = {
  dark: DARK_COLORS,
};

export const THEME_LABELS: Record<ThemeKey, string> = {
  dark: 'Koyu',
};

let currentTheme: ThemeKey = 'dark';

export function setActiveTheme(_key: ThemeKey) {
  currentTheme = 'dark';
}

export function getActiveTheme(): ThemeKey {
  return 'dark';
}

export function getThemeColors(_key?: ThemeKey): ThemeColors {
  return DARK_COLORS;
}

export function isLightTheme(_key?: ThemeKey): boolean {
  return false;
}
