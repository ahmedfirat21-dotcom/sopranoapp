// ★ v1.7.13.115 (20 May 2026): Yeni Üyeler servisi — son 7 gün kayıt olan + onboarding done.

import { supabase } from '../constants/supabase';

export interface NewMember {
  id: string;
  display_name: string;
  avatar_url: string | null;
  subscription_tier: string;
  is_online: boolean;
  active_frame: string | null;
  active_badge_id: string | null;
  bio: string | null;
  created_at: string;
  days_old: number;
}

export const NewMembersService = {
  async getRecent(limit: number = 10): Promise<NewMember[]> {
    const { data, error } = await supabase.rpc('get_new_members', { p_limit: limit });
    if (error) {
      if (__DEV__) console.warn('[NewMembers] error:', error);
      return [];
    }
    return (data as NewMember[]) || [];
  },
};
