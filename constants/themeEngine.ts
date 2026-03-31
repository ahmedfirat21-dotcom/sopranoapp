// SopranoChat — Tema Sistemi (sc2 Premium VIP Dili)
// 3 tema: OLED Siyah, Koyu, Gece Mavisi
// Tema seçimi AsyncStorage'dan okunur ve tüm uygulamaya uygulanır.

export type ThemeKey = 'oled' | 'dark' | 'midnight';

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

const OLED_COLORS: ThemeColors = {
  bg: '#000000',       // Saf OLED siyah (sc2 referans)
  bg2: '#0A0A0F',      // Çok hafif koyu mavi ton
  bg3: '#111118',      // Kart arka planı
  bg4: '#18181F',      // İkincil kart
  bg5: '#1E1E28',      // Üçüncül
  text: '#F8FAFC',     // Ana metin - parlak beyaz
  text2: '#A0AEC0',    // İkincil metin - gümüş
  text3: '#64748B',    // Soluk metin
  glass: 'rgba(255,255,255,0.03)',
  glass2: 'rgba(255,255,255,0.05)',
  glass3: 'rgba(255,255,255,0.08)',
  glassBorder: 'rgba(255,255,255,0.06)',
  glassBorder2: 'rgba(255,255,255,0.1)',
};

const DARK_COLORS: ThemeColors = {
  bg: '#0A0A0F',
  bg2: '#111118',
  bg3: '#18181F',
  bg4: '#1E1E28',
  bg5: '#262630',
  text: '#EAEDF2',
  text2: '#9DA5B2',
  text3: '#616B79',
  glass: 'rgba(255,255,255,0.04)',
  glass2: 'rgba(255,255,255,0.06)',
  glass3: 'rgba(255,255,255,0.09)',
  glassBorder: 'rgba(255,255,255,0.08)',
  glassBorder2: 'rgba(255,255,255,0.12)',
};

const MIDNIGHT_COLORS: ThemeColors = {
  bg: '#020511',       // sc2'deki koyu gece mavisi
  bg2: '#0A122E',      // Gece mavisi kartlar
  bg3: '#111D40',
  bg4: '#1A2550',
  bg5: '#243060',
  text: '#E2E8F0',
  text2: '#94A3B8',
  text3: '#475569',
  glass: 'rgba(100,150,255,0.03)',
  glass2: 'rgba(100,150,255,0.05)',
  glass3: 'rgba(100,150,255,0.08)',
  glassBorder: 'rgba(100,150,255,0.08)',
  glassBorder2: 'rgba(100,150,255,0.12)',
};

export const THEME_PALETTES: Record<ThemeKey, ThemeColors> = {
  oled: OLED_COLORS,
  dark: DARK_COLORS,
  midnight: MIDNIGHT_COLORS,
};

// Mutable theme state — tüm uygulama bu referansı kullanır
let currentTheme: ThemeKey = 'oled';

export function setActiveTheme(key: ThemeKey) {
  currentTheme = key;
}

export function getActiveTheme(): ThemeKey {
  return currentTheme;
}

export function getThemeColors(key?: ThemeKey): ThemeColors {
  return THEME_PALETTES[key || currentTheme];
}
