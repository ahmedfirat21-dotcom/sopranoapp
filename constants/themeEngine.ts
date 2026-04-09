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

const DARK_COLORS: ThemeColors = {
  bg:  '#2f404f',
  bg2: '#111720',
  bg3: '#1A2030',
  bg4: '#1F2840',
  bg5: '#263250',
  text: '#F1F5F9',
  text2: '#94A3B8',
  text3: '#64748B',
  glass: '#333b45',
  glass2: '#3a424d',
  glass3: '#414955',
  glassBorder: 'rgba(255,255,255,0.10)',
  glassBorder2: 'rgba(255,255,255,0.14)',
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
