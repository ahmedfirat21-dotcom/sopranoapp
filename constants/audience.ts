/**
 * SopranoChat — Oda Audience (Erişim Modu) Modeli
 * ═══════════════════════════════════════════════════
 * UI'da TEK select altında 4 mod sunulur. Backend `type` + `followers_only`
 * kolonlarına dönüştürülür (geriye uyum için).
 *
 * 4 mod:
 *   - public:        herkes girebilir            (type='open',  followers_only=false)
 *   - followers:     sadece takipçiler           (type='open',  followers_only=true)
 *   - password:      şifreli                     (type='closed', password set)
 *   - invite:        sadece davetli              (type='invite')
 *
 * Helper'lar UI'nın tek bir select state'i ile çalışmasını sağlar; backend
 * okumalarında (badge, access check) mevcut kolonlar olduğu gibi kullanılır.
 */
import type { Ionicons } from '@expo/vector-icons';

export type AudienceMode = 'public' | 'followers' | 'password' | 'invite';

export interface AudienceOption {
  mode: AudienceMode;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  /** Plus+ tier gerektiriyor mu */
  requiresPremium?: boolean;
}

/**
 * Sırasıyla göster: en açıktan en kapalıya.
 */
export const AUDIENCE_OPTIONS: AudienceOption[] = [
  {
    mode: 'public',
    label: 'Herkese Açık',
    description: 'Herkes katılabilir',
    icon: 'globe-outline',
    color: '#14B8A6',
  },
  {
    mode: 'followers',
    label: 'Sadece Takipçilerim',
    description: 'Yalnızca seni takip edenler katılabilir',
    icon: 'people-outline',
    color: '#A78BFA',
  },
  {
    mode: 'password',
    label: 'Şifreli',
    description: 'Şifreyi bilen herkes katılabilir',
    icon: 'key-outline',
    color: '#F59E0B',
  },
  {
    mode: 'invite',
    label: 'Sadece Davetli',
    description: 'Yalnızca davet ettiklerin katılabilir',
    icon: 'mail-outline',
    color: '#8B5CF6',
  },
];

/**
 * Mevcut oda kolonlarından unified mode'u türet.
 * Tutarsız kombinasyonlar için en restrictive olanı seç.
 */
export function getAudienceMode(opts: {
  type?: string | null;
  followers_only?: boolean | null;
  has_password?: boolean | null;
}): AudienceMode {
  const { type, followers_only, has_password } = opts;
  // En kısıtlayıcıdan en açığa öncelik
  if (type === 'invite') return 'invite';
  if (type === 'closed' || has_password) return 'password';
  if (followers_only) return 'followers';
  return 'public';
}

/**
 * Unified mode'u backend kolonlarına dönüştür.
 * password modu için şifre değeri ayrıca verilmelidir.
 */
export function audienceModeToFields(mode: AudienceMode, password?: string): {
  type: 'open' | 'closed' | 'invite';
  followers_only: boolean;
  room_password: string | null;
} {
  switch (mode) {
    case 'public':
      return { type: 'open', followers_only: false, room_password: null };
    case 'followers':
      return { type: 'open', followers_only: true, room_password: null };
    case 'password':
      return { type: 'closed', followers_only: false, room_password: (password || '').trim() || null };
    case 'invite':
      return { type: 'invite', followers_only: false, room_password: null };
  }
}

/**
 * Mode meta — UI gösteriminde kullanılır (badge, kart).
 */
export function getAudienceOption(mode: AudienceMode): AudienceOption {
  return AUDIENCE_OPTIONS.find(o => o.mode === mode) || AUDIENCE_OPTIONS[0];
}
