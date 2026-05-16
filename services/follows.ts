/**
 * SopranoChat — Tek Yönlü Takip Servisi (Faz 4.1)
 * ═══════════════════════════════════════════════════
 * Twitter-tarzı one-way follow. friendships'ten ayrı kavram.
 *
 * Tablo: public.follows (v62 migration)
 *   - follower_id (TEXT) → kim takip ediyor
 *   - following_id (TEXT) → kim takip ediliyor
 *   - composite PK, no_self_follow check
 *
 * NOT: FriendshipService'in `follow()` metodu yanıltıcı isimde —
 *   gerçekte friendship request gönderiyor (mutual onay). Bu service
 *   o davranışla bozulmuyor; iki sistem paralel çalışır.
 *
 * UI semantics:
 *   - "Takip Et" → FollowService.addFollow
 *   - "Arkadaş Ekle" → FriendshipService.follow (friendship request)
 */
import { supabase } from '../constants/supabase';
import type { FollowUser } from './friendship';

export const FollowService = {
  /**
   * Bir kullanıcıyı takip et.
   * Edge case'ler:
   *  - Self-follow → DB CHECK constraint engeller (no_self_follow)
   *  - Engelli kullanıcı takip edemez (block-aware kontrol)
   *  - Zaten takip ediyorsa idempotent (ON CONFLICT DO NOTHING gibi)
   */
  async addFollow(followerId: string, followingId: string): Promise<{ success: boolean; error?: string }> {
    if (!followerId || !followingId) return { success: false, error: 'Geçersiz kullanıcı.' };
    if (followerId === followingId) return { success: false, error: 'Kendinizi takip edemezsiniz.' };

    // ★ Block-aware: takip edilen kişi takip edeni engellediyse reddet
    try {
      const { data: blocked } = await supabase
        .from('blocked_users')
        .select('blocker_id')
        .eq('blocker_id', followingId)
        .eq('blocked_id', followerId)
        .maybeSingle();
      if (blocked) return { success: false, error: 'Bu kullanıcı seni engelledi.' };
    } catch { /* engel kontrolü başarısızsa devam et — DB tarafı yine validation yapar */ }

    // Reverse: takip eden, takip edilenı engellediyse uyarı
    try {
      const { data: revBlocked } = await supabase
        .from('blocked_users')
        .select('blocker_id')
        .eq('blocker_id', followerId)
        .eq('blocked_id', followingId)
        .maybeSingle();
      if (revBlocked) return { success: false, error: 'Engellediğin birini takip edemezsin.' };
    } catch { /* devam */ }

    const { error } = await supabase
      .from('follows')
      .insert({ follower_id: followerId, following_id: followingId });

    if (error) {
      // Duplicate (zaten takip ediyor) → success kabul et
      if (error.code === '23505') return { success: true };
      if (__DEV__) console.warn('[FollowService] addFollow error:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  },

  /** Takipten çık. Idempotent — yoksa başarı dön. */
  async removeFollow(followerId: string, followingId: string): Promise<{ success: boolean; error?: string }> {
    if (!followerId || !followingId) return { success: false, error: 'Geçersiz kullanıcı.' };

    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId);

    if (error) {
      if (__DEV__) console.warn('[FollowService] removeFollow error:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  },

  /**
   * Bir kullanıcı, hedef kullanıcıyı takip ediyor mu?
   */
  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    if (!followerId || !followingId || followerId === followingId) return false;
    const { data } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .maybeSingle();
    return !!data;
  },

  /**
   * Bir kullanıcının takipçi listesi (kim onu takip ediyor).
   * Engellenenleri çıkarır.
   */
  async getFollowers(userId: string, limit = 100): Promise<FollowUser[]> {
    if (!userId) return [];
    const { data, error } = await supabase
      .from('follows')
      .select('follower:profiles!follower_id(id, display_name, avatar_url, username, subscription_tier, is_online, active_frame, active_badge_id)')
      .eq('following_id', userId)
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 500));
    if (error) {
      if (__DEV__) console.warn('[FollowService] getFollowers error:', error.message);
      return [];
    }
    const profiles = (data || [])
      .map((r: any) => Array.isArray(r.follower) ? r.follower[0] : r.follower)
      .filter(Boolean) as FollowUser[];
    return profiles;
  },

  /**
   * Bir kullanıcının takip ettiği kişiler.
   */
  async getFollowing(userId: string, limit = 100): Promise<FollowUser[]> {
    if (!userId) return [];
    const { data, error } = await supabase
      .from('follows')
      .select('following:profiles!following_id(id, display_name, avatar_url, username, subscription_tier, is_online, active_frame, active_badge_id)')
      .eq('follower_id', userId)
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 500));
    if (error) {
      if (__DEV__) console.warn('[FollowService] getFollowing error:', error.message);
      return [];
    }
    const profiles = (data || [])
      .map((r: any) => Array.isArray(r.following) ? r.following[0] : r.following)
      .filter(Boolean) as FollowUser[];
    return profiles;
  },

  /** Takipçi sayısı — count-only sorgu. */
  async getFollowerCount(userId: string): Promise<number> {
    if (!userId) return 0;
    const { count, error } = await supabase
      .from('follows')
      .select('follower_id', { count: 'exact', head: true })
      .eq('following_id', userId);
    if (error) return 0;
    return count ?? 0;
  },

  /** Takip ettiklerinin sayısı. */
  async getFollowingCount(userId: string): Promise<number> {
    if (!userId) return 0;
    const { count, error } = await supabase
      .from('follows')
      .select('follower_id', { count: 'exact', head: true })
      .eq('follower_id', userId);
    if (error) return 0;
    return count ?? 0;
  },

  /**
   * Toplu durum sorgusu — kullanıcı hangi target'ları takip ediyor?
   * Profile sayfası "Takip Et" buton state'i için.
   */
  async getBatchFollowing(userId: string, targetIds: string[]): Promise<Set<string>> {
    if (!userId || targetIds.length === 0) return new Set();
    const { data } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId)
      .in('following_id', targetIds);
    return new Set((data || []).map((r: any) => r.following_id));
  },
};
