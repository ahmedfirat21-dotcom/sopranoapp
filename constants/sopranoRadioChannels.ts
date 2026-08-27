/**
 * SopranoChat — Soprano Lobi Radyo Kanal Listesi
 * ═══════════════════════════════════════════════════
 * Sadece Lobi (sistem odası) içinde kullanılır. Stream URL'leri Mayıs 2026
 * itibariyle test edilip çalışan TR radyo istasyonları. Ölü link tespit edilirse
 * `enabled: false` ile gizle, alternatif eklenirse listeye yeni satır eklenir.
 *
 * Test komutu (PowerShell):
 *   HttpWebRequest -UserAgent "WinampMPEG/5.0" → audio/mpeg veya audio/aacp dönüyorsa OK.
 */

export interface RadioChannel {
  id: string;
  name: string;
  subtitle: string;
  streamUrl: string;
  /** Gradient renkleri — kart görselleri için */
  gradient: readonly [string, string];
  /** Container icon (Ionicons name) */
  icon: string;
  enabled?: boolean; // default true; ölü ise false
}

export const SOPRANO_RADIO_CHANNELS: readonly RadioChannel[] = [
  {
    id: 'joy_turk',
    name: 'JoyTürk',
    subtitle: 'Türk Pop & Hit',
    streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/JOY_TURK128AAC.aac',
    gradient: ['#F472B6', '#A78BFA'] as const,
    icon: 'musical-notes',
  },
  {
    id: 'kral_fm',
    name: 'Kral FM',
    subtitle: 'Türk Pop Klasikleri',
    streamUrl: 'https://ssldyg.radyotvonline.com/smil/smil:kralfm.smil/playlist.m3u8',
    gradient: ['#FBBF24', '#F59E0B'] as const,
    icon: 'star',
  },
  {
    id: 'radyo_viva',
    name: 'Radyo Viva',
    subtitle: 'Slow & Dinlendirici',
    streamUrl: 'http://46.20.3.231:80/',
    gradient: ['#14B8A6', '#0EA5E9'] as const,
    icon: 'cafe',
  },
  {
    id: 'joy_fm',
    name: 'Joy FM',
    subtitle: 'Pop & Slow Karışım',
    streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/JOY_FM.mp3',
    gradient: ['#EC4899', '#8B5CF6'] as const,
    icon: 'heart',
  },
  {
    id: 'metro_fm',
    name: 'Metro FM',
    subtitle: 'Pop Hits',
    streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/METRO_FM.mp3',
    gradient: ['#3B82F6', '#06B6D4'] as const,
    icon: 'pulse',
  },
  {
    id: 'show_radyo',
    name: 'Show Radyo',
    subtitle: 'Karışık',
    streamUrl: 'http://46.20.3.229:80/',
    gradient: ['#A78BFA', '#6366F1'] as const,
    icon: 'radio',
  },
];

/** Default kanal — Lobi'ye ilk girişte autoplay */
export const DEFAULT_RADIO_CHANNEL_ID = 'joy_turk';

/** AsyncStorage key'leri */
export const RADIO_STORAGE = {
  channelId: 'soprano_lobi:radio:channel',
  hidden: 'soprano_lobi:radio:hidden',
  muted: 'soprano_lobi:radio:muted',
} as const;
