/**
 * SopranoChat — Profil dilleri + ilgi alanı sözlüğü
 * v110.5 (6 May 2026)
 *
 * ★ Diller: ISO 639-1 kodu + bayrak emoji + Türkçe etiket
 * ★ İlgi alanları: önceden tanımlı sade kümme — keşfet algoritması ve
 *    profil chip'leri için ortak vokabüler. Free-form text yerine kapalı
 *    küme tercih edildi (filtreleme + i18n + spelling).
 */

export type LanguageCode = 'tr' | 'en' | 'ar' | 'ku' | 'de' | 'fr' | 'ru' | 'es' | 'it' | 'fa' | 'az' | 'nl' | 'pt' | 'zh' | 'ja' | 'ko';

export type LanguageOption = {
  code: LanguageCode;
  flag: string;       // Bayrak emoji (Unicode regional indicators)
  label: string;      // Türkçe görüntüleme adı
  nativeLabel: string; // Kendi dilinde adı
};

/** Sırala: kullanım yoğunluğuna göre Türkiye + bölge öncelikli */
export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'tr', flag: '🇹🇷', label: 'Türkçe',     nativeLabel: 'Türkçe' },
  { code: 'en', flag: '🇬🇧', label: 'İngilizce',  nativeLabel: 'English' },
  { code: 'ar', flag: '🇸🇦', label: 'Arapça',     nativeLabel: 'العربية' },
  { code: 'ku', flag: '🟨', label: 'Kürtçe',     nativeLabel: 'Kurdî' },
  { code: 'az', flag: '🇦🇿', label: 'Azerice',    nativeLabel: 'Azərbaycan' },
  { code: 'fa', flag: '🇮🇷', label: 'Farsça',     nativeLabel: 'فارسی' },
  { code: 'de', flag: '🇩🇪', label: 'Almanca',    nativeLabel: 'Deutsch' },
  { code: 'fr', flag: '🇫🇷', label: 'Fransızca',  nativeLabel: 'Français' },
  { code: 'es', flag: '🇪🇸', label: 'İspanyolca', nativeLabel: 'Español' },
  { code: 'it', flag: '🇮🇹', label: 'İtalyanca',  nativeLabel: 'Italiano' },
  { code: 'ru', flag: '🇷🇺', label: 'Rusça',      nativeLabel: 'Русский' },
  { code: 'nl', flag: '🇳🇱', label: 'Felemenkçe', nativeLabel: 'Nederlands' },
  { code: 'pt', flag: '🇵🇹', label: 'Portekizce', nativeLabel: 'Português' },
  { code: 'zh', flag: '🇨🇳', label: 'Çince',      nativeLabel: '中文' },
  { code: 'ja', flag: '🇯🇵', label: 'Japonca',    nativeLabel: '日本語' },
  { code: 'ko', flag: '🇰🇷', label: 'Korece',     nativeLabel: '한국어' },
];

const LANGUAGE_BY_CODE: Record<string, LanguageOption> = LANGUAGE_OPTIONS.reduce(
  (acc, l) => { acc[l.code] = l; return acc; },
  {} as Record<string, LanguageOption>,
);

/** Kullanıcı kaydından dil kodunu UI representation'ına çevir */
export function getLanguage(code: string): LanguageOption | null {
  return LANGUAGE_BY_CODE[code as LanguageCode] || null;
}

/** Bir kullanıcının seçebileceği maksimum dil sayısı (UX baloncuğu) */
export const MAX_LANGUAGES = 5;

// ═══════════════════════════════════════════════════════════════════
// İLGİ ALANLARI — kategorilere bölünmüş, sözlük sabit
// ═══════════════════════════════════════════════════════════════════

export type InterestTag = {
  /** Sabit kod (DB'ye yazılan) — değişmez */
  id: string;
  /** Türkçe etiket */
  label: string;
  /** Ionicons name (chip'te ikon olarak) */
  icon: string;
  /** Kategori — UI gruplandırma + renk hint */
  category: InterestCategory;
};

export type InterestCategory =
  | 'social'    // sohbet, gece kuşu, terapi, felsefe...
  | 'music'     // pop, rock, türkü, klasik...
  | 'creative'  // sanat, yazı, fotoğraf...
  | 'sports'    // futbol, basketbol, fitness...
  | 'tech'      // yazılım, oyun, donanım...
  | 'culture'   // sinema, kitap, tiyatro...
  | 'lifestyle' // yemek, seyahat, doğa...
  | 'learning'; // dil, bilim, tarih...

/** Sıra: kategori → alfabetik. UI tag selector buna göre gruplanır. */
export const INTEREST_TAGS: InterestTag[] = [
  // — Sosyal —
  { id: 'chat',         label: 'Sohbet',         icon: 'chatbubbles',        category: 'social' },
  { id: 'philosophy',   label: 'Felsefe',        icon: 'bulb',               category: 'social' },
  { id: 'night_owl',    label: 'Gece Kuşu',      icon: 'moon',               category: 'social' },
  { id: 'therapy',      label: 'Dertleşme',      icon: 'heart',              category: 'social' },
  { id: 'flirt',        label: 'Tanışma',        icon: 'rose',               category: 'social' },
  { id: 'comedy',       label: 'Mizah',          icon: 'happy',              category: 'social' },

  // — Müzik —
  // ★ 2026-05-09: Onboarding'de seçilen genel "Müzik" kategorisi için (id eşleşmesi).
  { id: 'music',        label: 'Müzik',          icon: 'musical-notes',      category: 'music' },
  { id: 'music_pop',    label: 'Pop',            icon: 'musical-notes',      category: 'music' },
  { id: 'music_rock',   label: 'Rock',           icon: 'flame',              category: 'music' },
  { id: 'music_rap',    label: 'Rap',            icon: 'mic',                category: 'music' },
  { id: 'music_turku',  label: 'Türkü',          icon: 'leaf',               category: 'music' },
  { id: 'music_arabesk',label: 'Arabesk',        icon: 'rainy',              category: 'music' },
  { id: 'music_classical', label: 'Klasik',      icon: 'musical-note',       category: 'music' },
  { id: 'music_jazz',   label: 'Jazz',           icon: 'wine',               category: 'music' },
  { id: 'music_electronic', label: 'Elektronik', icon: 'pulse',              category: 'music' },

  // — Sanatsal —
  { id: 'art',          label: 'Sanat',          icon: 'color-palette',      category: 'creative' },
  { id: 'writing',      label: 'Yazı',           icon: 'create',             category: 'creative' },
  { id: 'photography',  label: 'Fotoğraf',       icon: 'camera',             category: 'creative' },
  { id: 'design',       label: 'Tasarım',        icon: 'shapes',             category: 'creative' },

  // — Spor —
  // ★ 2026-05-09: Onboarding'de seçilen genel "Spor" kategorisi için.
  { id: 'sport',        label: 'Spor',           icon: 'football',           category: 'sports' },
  { id: 'football',     label: 'Futbol',         icon: 'football',           category: 'sports' },
  { id: 'basketball',   label: 'Basketbol',      icon: 'basketball',         category: 'sports' },
  { id: 'fitness',      label: 'Fitness',        icon: 'barbell',            category: 'sports' },
  { id: 'esports',      label: 'E-Spor',         icon: 'game-controller',    category: 'sports' },

  // — Teknoloji —
  { id: 'tech',         label: 'Yazılım',        icon: 'code-slash',         category: 'tech' },
  // ★ 2026-05-09: Onboarding'de seçilen genel "Oyun" kategorisi için (gaming alias).
  { id: 'game',         label: 'Oyun',           icon: 'game-controller',    category: 'tech' },
  { id: 'gaming',       label: 'Oyun',           icon: 'rocket',             category: 'tech' },
  { id: 'crypto',       label: 'Kripto',         icon: 'logo-bitcoin',       category: 'tech' },
  { id: 'ai',           label: 'Yapay Zeka',     icon: 'planet',             category: 'tech' },

  // — Kültür —
  { id: 'film',         label: 'Sinema',         icon: 'film',               category: 'culture' },
  { id: 'book',         label: 'Kitap',          icon: 'book',               category: 'culture' },
  { id: 'theater',      label: 'Tiyatro',        icon: 'glasses',            category: 'culture' },
  { id: 'history',      label: 'Tarih',          icon: 'time',               category: 'culture' },

  // — Yaşam —
  { id: 'food',         label: 'Yemek',          icon: 'restaurant',         category: 'lifestyle' },
  { id: 'travel',       label: 'Seyahat',        icon: 'airplane',           category: 'lifestyle' },
  { id: 'nature',       label: 'Doğa',           icon: 'leaf',               category: 'lifestyle' },
  { id: 'pets',         label: 'Evcil Hayvan',   icon: 'paw',                category: 'lifestyle' },
  { id: 'cars',         label: 'Otomobil',       icon: 'car-sport',          category: 'lifestyle' },

  // — Öğrenme —
  { id: 'language',     label: 'Dil Öğrenme',    icon: 'language',           category: 'learning' },
  { id: 'science',      label: 'Bilim',          icon: 'flask',              category: 'learning' },
  { id: 'business',     label: 'İş & Kariyer',   icon: 'briefcase',          category: 'learning' },
  { id: 'self_growth',  label: 'Kişisel Gelişim',icon: 'trending-up',        category: 'learning' },
];

const INTEREST_BY_ID: Record<string, InterestTag> = INTEREST_TAGS.reduce(
  (acc, t) => { acc[t.id] = t; return acc; },
  {} as Record<string, InterestTag>,
);

export function getInterest(id: string): InterestTag | null {
  return INTEREST_BY_ID[id] || null;
}

/** UX baloncuğu: kullanıcı en fazla 8 ilgi alanı seçebilir */
export const MAX_INTERESTS = 8;

/** Kategoriye göre Türkçe başlık (Edit profile selector'da grup başlığı) */
export const INTEREST_CATEGORY_LABELS: Record<InterestCategory, string> = {
  social:    'Sosyal',
  music:     'Müzik',
  creative:  'Sanatsal',
  sports:    'Spor',
  tech:      'Teknoloji',
  culture:   'Kültür',
  lifestyle: 'Yaşam',
  learning:  'Öğrenme',
};

/** Kategoriye göre vurgu rengi (chip border/glow için) */
export const INTEREST_CATEGORY_COLOR: Record<InterestCategory, string> = {
  social:    '#14B8A6', // teal
  music:     '#F472B6', // pink
  creative:  '#A855F7', // purple
  sports:    '#22C55E', // green
  tech:      '#3B82F6', // blue
  culture:   '#FBBF24', // amber
  lifestyle: '#F97316', // orange
  learning:  '#06B6D4', // cyan
};
