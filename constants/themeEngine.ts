// SopranoChat — Retro Mobile tema sistemi
// Web'deki nostaljik gri-metal + lavanta kimliğini mobilde yeniden yorumlar.

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
  // Klasik SopranoChat lavanta zemini — mobilde biraz daha koyu tutulur ki
  // mevcut beyaz metinler ve ekranlardaki kontrast bozulmasın.
  bg:  '#727493',
  bg2: '#3B3D50',
  bg3: '#8588A8',
  bg4: '#55586F',
  bg5: '#A8ABC7',
  text: '#FFFFFF',
  text2: '#E4E6F1',
  text3: '#C2C5D8',
  glass: '#5E617D',
  glass2: '#747795',
  glass3: '#9194B1',
  glassBorder: 'rgba(244,245,255,0.24)',
  glassBorder2: 'rgba(255,255,255,0.42)',
};

export const THEME_PALETTES: Record<ThemeKey, ThemeColors> = {
  dark: DARK_COLORS,
};

export const THEME_LABELS: Record<ThemeKey, string> = {
  dark: 'Retro',
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
