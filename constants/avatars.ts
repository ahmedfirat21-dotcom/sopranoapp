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
  if (!sourceUrl) return { uri: 'https://i.pravatar.cc/120?img=1' };
  
  // Eğer kendi oluşturduğumuz premium bot avatarlarıysa (örn: "avatar_f_1.png")
  if (LOCAL_AVATARS[sourceUrl]) {
    return LOCAL_AVATARS[sourceUrl];
  }
  
  // Aksi halde (gerçek kullanıcı yüklemesiyse) doğrudan https://.. ver
  return { uri: sourceUrl };
}
