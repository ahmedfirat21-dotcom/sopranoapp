// ★ v1.7.13.112 (20 May 2026): Karşılama Pilotları (Welcome Hosts) servisi.
// Yeni kullanıcı (kayıt < 24h) home'da WelcomeMentorCarousel görür → tek tıkla
// gönüllü mentor host'ları takip eder.

import { supabase } from '../constants/supabase';

export interface WelcomeHost {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  system_points: number;
  subscription_tier: string;
  active_frame: string | null;
  active_badge_id: string | null;
  is_online: boolean;
  streak_days: number;
}

export const WelcomeHostService = {
  /**
   * Top welcome host'ları getir (en aktif + en yüksek SP'li).
   * Carousel için ideal limit 5.
   */
  async getWelcomeHosts(limit: number = 5): Promise<WelcomeHost[]> {
    const { data, error } = await supabase.rpc('get_welcome_hosts', { p_limit: limit });
    if (error) {
      if (__DEV__) console.warn('[WelcomeHost] getWelcomeHosts error:', error);
      return [];
    }
    return (data as WelcomeHost[]) || [];
  },

  /**
   * Mevcut kullanıcı 24 saat içinde mi kayıtlı?
   * Carousel görünürlük gating'i için.
   */
  async isNewUser(): Promise<boolean> {
    const { data, error } = await supabase.rpc('is_new_user');
    if (error) {
      if (__DEV__) console.warn('[WelcomeHost] isNewUser error:', error);
      return false;
    }
    return data === true;
  },
};
