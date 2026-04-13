import { ImageSourcePropType } from 'react-native';

export const LOCAL_AVATARS: Record<string, ImageSourcePropType> = {
  // Female Avatars
  'avatar_f_1.png': require('../assets/avatars/avatar_f_1.jpg'),
  'avatar_f_2.png': require('../assets/avatars/avatar_f_2.jpg'),
  'avatar_f_3.png': require('../assets/avatars/avatar_f_3.jpg'),
  'avatar_f_4.png': require('../assets/avatars/avatar_f_4.jpg'),
  'avatar_f_5.png': require('../assets/avatars/avatar_f_5.jpg'),
  'avatar_f_6.png': require('../assets/avatars/avatar_f_6.jpg'),
  'avatar_f_7.png': require('../assets/avatars/avatar_f_7.jpg'),
  'avatar_f_8.png': require('../assets/avatars/avatar_f_8.jpg'),
  'avatar_f_9.png': require('../assets/avatars/avatar_f_9.jpg'),
  'avatar_f_10.png': require('../assets/avatars/avatar_f_10.jpg'),

  // Male Avatars
  'avatar_m_1.png': require('../assets/avatars/avatar_m_1.jpg'),
  'avatar_m_2.png': require('../assets/avatars/avatar_m_2.jpg'),
  'avatar_m_3.png': require('../assets/avatars/avatar_m_3.jpg'),
  'avatar_m_4.png': require('../assets/avatars/avatar_m_4.jpg'),
  'avatar_m_5.png': require('../assets/avatars/avatar_m_5.jpg'),
  'avatar_m_6.png': require('../assets/avatars/avatar_m_6.jpg'),
  'avatar_m_7.png': require('../assets/avatars/avatar_m_7.jpg'),
  'avatar_m_8.png': require('../assets/avatars/avatar_m_8.jpg'),
  'avatar_m_9.png': require('../assets/avatars/avatar_m_9.jpg'),
  'avatar_m_10.png': require('../assets/avatars/avatar_m_10.jpg'),
};

export const AVATAR_OPTIONS = Object.keys(LOCAL_AVATARS);

/**
 * Supabase'den veya local asset'ten gelen avatarı RN Image için doğru formata çevirir.
 */
export function getAvatarSource(sourceUrl?: string | null): ImageSourcePropType {
  if (!sourceUrl) return LOCAL_AVATARS['avatar_m_1.png'] || { uri: 'https://ui-avatars.com/api/?name=S&background=0D1421&color=5CC6C6&size=120' };
  
  // Eğer kendi oluşturduğumuz premium bot avatarlarıysa (örn: "avatar_f_1.png")
  if (LOCAL_AVATARS[sourceUrl]) {
    return LOCAL_AVATARS[sourceUrl];
  }
  
  // Aksi halde (gerçek kullanıcı yüklemesiyse) doğrudan https://.. ver
  return { uri: sourceUrl };
}

// ============================================
// LEVEL SİSTEMİ — Renk & Hesaplama
// ============================================

/**
 * SP'den level hesapla (1-99)
 * Tier bonus: Plus → min Lv15, Pro → min Lv40
 * Legacy uyumlu: eski tier isimlerini de destekler
 */
export function getLevelFromSP(sp: number, tier?: string): number {
  const rawLevel = Math.min(99, Math.floor(sp / 100) + 1);
  const t = (tier || '').toLowerCase();
  // Yeni 3-tier
  if (t === 'pro') return Math.max(40, rawLevel);
  if (t === 'plus') return Math.max(15, rawLevel);
  // Legacy backward compat
  if (t === 'vip' || t === 'gold') return Math.max(40, rawLevel);
  if (t === 'silver' || t === 'bronze') return Math.max(15, rawLevel);
  return rawLevel;
}




/** Level'a göre gradient renkleri + label rengi döndürür */
export function getLevelColors(level: number): { ring: [string, string]; text: string; glow: string } {
  if (level >= 90) return { ring: ['#FF6B6B', '#9333EA'],  text: '#FF6B6B', glow: '#9333EA' };  // 90-99: Efsane (Kırmızı→Mor)
  if (level >= 70) return { ring: ['#EF4444', '#F97316'],  text: '#EF4444', glow: '#EF4444' };  // 70-89: Grandmaster (Kırmızı→Turuncu)
  if (level >= 50) return { ring: ['#F59E0B', '#EAB308'],  text: '#F59E0B', glow: '#F59E0B' };  // 50-69: Master (Altın)
  if (level >= 35) return { ring: ['#A855F7', '#7C3AED'],  text: '#A855F7', glow: '#A855F7' };  // 35-49: Elit (Mor)
  if (level >= 20) return { ring: ['#3B82F6', '#06B6D4'],  text: '#3B82F6', glow: '#3B82F6' };  // 20-34: Uzman (Mavi→Cyan)
  if (level >= 10) return { ring: ['#10B981', '#14B8A6'],  text: '#10B981', glow: '#10B981' };  // 10-19: Deneyimli (Yeşil→Teal)
  if (level >= 5)  return { ring: ['#5CC6C6', '#64748B'],  text: '#5CC6C6', glow: '#5CC6C6' };  //  5-9:  Çırak (Teal→Gri)
  return                   { ring: ['#94A3B8', '#64748B'],  text: '#94A3B8', glow: '#64748B' };  //  1-4:  Acemi (Gri)
}

/**
 * Tier badge görüntüleme bilgileri
 * 3-tier sistemi: Plus (🚀 Mor) / Pro (🔥 Altın)
 * Legacy uyumlu: eski tier isimlerini de destekler
 */
export function getTierBadgeInfo(tier?: string): {
  icon: string | null;
  label: string;
  badgeGradient: [string, string] | null;
} {
  const t = (tier || '').toLowerCase();
  // Pro tier (+ legacy uyumluluk: Gold/VIP → Pro)
  if (t === 'pro' || t === 'vip' || t === 'gold') return {
    icon: 'flame',
    label: 'Pro',
    badgeGradient: ['#F59E0B', '#D97706'],
  };
  // Plus tier (+ legacy uyumluluk: Bronze/Silver → Plus)
  if (t === 'plus' || t === 'silver' || t === 'bronze') return {
    icon: 'rocket',
    label: 'Plus',
    badgeGradient: ['#A855F7', '#7C3AED'],
  };
  return { icon: null, label: '', badgeGradient: null };  // Free — normal level badge
}
