/**
 * SopranoChat — Profil Servis Modülü
 * database.ts'den ayrılmış — ProfileService
 */
import { supabase } from '../../constants/supabase';
import type { Profile } from '../../types';

export const ProfileService = {
  /** Yeni profil oluştur (ilk giriş sonrası) */
  async create(userId: string, data: Partial<Profile>) {
    const baseUsername = (data.username || `user_${userId.substring(0, 6)}`).toLowerCase().replace(/[^a-z0-9_]/g, '');
    const username = `${baseUsername}_${userId.substring(0, 4)}`;

    const { data: profile, error } = await supabase
      .from('profiles')
      .upsert(
        { id: userId, ...data, username },
        { onConflict: 'id' }
      )
      .select()
      .single();
    if (error) throw error;
    return profile as Profile;
  },

  /** Profil bilgisi getir */
  async get(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data as Profile | null;
  },

  /** Profil güncelle */
  async update(userId: string, updates: Partial<Profile>) {
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data as Profile;
  },

  /** Online durumunu güncelle */
  async setOnline(userId: string, isOnline: boolean) {
    await supabase
      .from('profiles')
      .update({ is_online: isOnline, last_seen: new Date().toISOString() })
      .eq('id', userId);
  },

  /** Önerilen kullanıcıları getir (akıllı sıralama) */
  async getRecommended(currentUserId: string, limit: number = 10, offset: number = 0): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, profile_boost_expires_at')
      .neq('id', currentUserId)
      .neq('is_private', true)
      .order('last_seen', { ascending: false })
      .range(offset, offset + limit * 2 - 1);
    if (error) throw error;

    const now = new Date();
    const FIVE_MIN = 5 * 60 * 1000;

    // 5-tier abonelik bazlı skor
    const TIER_SCORE: Record<string, number> = {
      VIP: 600, Gold: 500, Silver: 400, Bronze: 200, Free: 100,
      // DB normalizasyonu (eski isimler)
      Diamond: 500, Premium: 400, Plus: 200, Plat: 400, Newcomer: 100,
    };

    const profiles = (data || []) as (Profile & { profile_boost_expires_at?: string })[];

    const scored = profiles.map(p => {
      let score = 0;
      const lastSeen = p.last_seen ? new Date(p.last_seen).getTime() : 0;
      const isReallyOnline = p.is_online && (now.getTime() - lastSeen < FIVE_MIN);

      if (p.is_online && !isReallyOnline) p.is_online = false;
      if (isReallyOnline) score += 1000;

      // Önce subscription_tier kullan, yoksa eski tier'a bak
      const tierKey = p.subscription_tier || (p as any).tier || 'Free';
      score += TIER_SCORE[tierKey] || 100;
      score += Math.min(50, Math.log10(Math.max(1, p.system_points)) * 10);

      const isBoosted = p.profile_boost_expires_at && new Date(p.profile_boost_expires_at) > now;
      if (isBoosted) score += 500;

      const hoursAgo = (now.getTime() - lastSeen) / (1000 * 60 * 60);
      if (hoursAgo < 1) score += 100;
      else if (hoursAgo < 24) score += 50;
      else if (hoursAgo < 168) score += 10;

      return { ...p, _score: score };
    });

    scored.sort((a, b) => b._score - a._score);
    return scored.slice(0, limit).map(({ _score, ...p }) => p as Profile);
  },

  /** Profili öne çıkar (Boost) — SP ile */
  async boostProfile(userId: string, spCost: number = 50) {
    const profile = await this.get(userId);
    if (!profile || profile.system_points < spCost) {
      throw new Error('Yetersiz SP');
    }
    const boostUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({
        system_points: profile.system_points - spCost,
        profile_boost_expires_at: boostUntil,
      })
      .eq('id', userId);
    if (updateErr) throw updateErr;

    try {
      await supabase.from('sp_transactions').insert({
        user_id: userId,
        amount: -spCost,
        type: 'profile_boost',
        description: 'Profil Boost (1 saat)',
      });
    } catch { /* opsiyonel */ }
    return { success: true, boost_expires_at: boostUntil };
  },

  /** Kullanıcı ara */
  async search(query: string, limit: number = 20): Promise<Profile[]> {
    if (!query || query.trim().length < 2) return [];
    const q = query.trim().toLowerCase();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`display_name.ilike.%${q}%,username.ilike.%${q}%`)
      .order('is_online', { ascending: false })
      .limit(limit);
    if (error) {
      if (__DEV__) console.warn('Kullanıcı arama hatası:', error);
      return [];
    }
    return (data || []) as Profile[];
  },
};
