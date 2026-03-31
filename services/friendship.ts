/**
 * SopranoChat — Arkadaşlık / Takip Servis Katmanı
 * Instagram tarzı karşılıklı onay sistemi:
 *   follow()  → pending istek oluşturur
 *   approve() → kabul eder (accepted)
 *   reject()  → reddeder (siler)
 */
import { supabase } from '../constants/supabase';
import { PushService } from './push';

export type FriendshipStatus = 'pending' | 'accepted' | 'blocked';

export type Friendship = {
  id: string;
  user_id: string;
  friend_id: string;
  status: FriendshipStatus;
  created_at: string;
};

export type FollowUser = {
  id: string;
  display_name: string;
  avatar_url: string;
  username: string | null;
  tier: string;
  is_online: boolean;
};

export type PendingRequest = {
  id: string;
  user_id: string;
  created_at: string;
  sender: {
    id: string;
    display_name: string;
    avatar_url: string;
    username: string | null;
    tier: string;
  };
};

export const FriendshipService = {
  /**
   * Takip isteği gönder (pending)
   * Karşı taraf onaylayana kadar "İstek Gönderildi" durumunda kalır.
   */
  async follow(userId: string, targetId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('friendships')
        .upsert({
          user_id: userId,
          friend_id: targetId,
          status: 'pending',
        }, { onConflict: 'user_id,friend_id' });
      if (error) throw error;

      // Push bildirim gönder
      const { data: follower } = await supabase.from('profiles').select('display_name').eq('id', userId).single();
      const name = follower?.display_name || 'Birisi';
      PushService.sendToUser(targetId, 'Takip İsteği', `${name} seni takip etmek istiyor`, {
        type: 'follow_request',
        route: `/notifications`,
      }).catch(() => {});

      return { success: true };
    } catch (e: any) {
      console.error('Takip istegi hatasi:', e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Takipten çık veya gönderilen isteği iptal et
   */
  async unfollow(userId: string, targetId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('user_id', userId)
        .eq('friend_id', targetId);
      if (error) throw error;
      return { success: true };
    } catch (e: any) {
      console.error('Takipten cikma hatasi:', e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Kullanıcıyı engelle
   */
  async block(userId: string, targetId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('friendships')
        .upsert({
          user_id: userId,
          friend_id: targetId,
          status: 'blocked',
        }, { onConflict: 'user_id,friend_id' });
      if (error) throw error;
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  /**
   * İki kullanıcı arasındaki ilişki durumu
   * Hem user→target hem target→user yönünü kontrol eder.
   */
  async getStatus(userId: string, targetId: string): Promise<FriendshipStatus | null> {
    try {
      // Benim gönderdiğim istek
      const { data, error } = await supabase
        .from('friendships')
        .select('status')
        .eq('user_id', userId)
        .eq('friend_id', targetId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data?.status || null;
    } catch (e: any) {
      return null;
    }
  },

  /**
   * Bana gelen bekleyen takip istekleri
   */
  async getPendingRequests(userId: string): Promise<PendingRequest[]> {
    try {
      const { data, error } = await supabase
        .from('friendships')
        .select('id, user_id, created_at, sender:profiles!friendships_user_id_fkey(id, display_name, avatar_url, username, tier)')
        .eq('friend_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PendingRequest[];
    } catch (e: any) {
      console.error('Bekleyen istek listesi hatasi:', e);
      return [];
    }
  },

  /**
   * Takip isteğini onayla (pending → accepted)
   */
  async approveRequest(userId: string, followerId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('user_id', followerId)
        .eq('friend_id', userId)
        .eq('status', 'pending');
      if (error) throw error;

      // Onaylayan kullanıcıya bildirim gönder
      const { data: approver } = await supabase.from('profiles').select('display_name').eq('id', userId).single();
      const name = approver?.display_name || 'Birisi';
      PushService.sendToUser(followerId, 'Takip Onaylandı', `${name} takip isteğini kabul etti`, {
        type: 'follow_accepted',
        route: `/user/${userId}`,
      }).catch(() => {});

      return { success: true };
    } catch (e: any) {
      console.error('Istek onaylama hatasi:', e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Takip isteğini reddet (satırı sil)
   */
  async rejectRequest(userId: string, followerId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('user_id', followerId)
        .eq('friend_id', userId)
        .eq('status', 'pending');
      if (error) throw error;
      return { success: true };
    } catch (e: any) {
      console.error('Istek reddetme hatasi:', e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Takipçi listesi (beni takip edenler - sadece accepted)
   */
  async getFollowers(userId: string): Promise<FollowUser[]> {
    try {
      const { data, error } = await supabase
        .from('friendships')
        .select('user_id, profiles!friendships_user_id_fkey(id, display_name, avatar_url, username, tier, is_online)')
        .eq('friend_id', userId)
        .eq('status', 'accepted');
      if (error) throw error;
      return (data || []).map((d: any) => d.profiles).filter(Boolean) as FollowUser[];
    } catch (e: any) {
      console.error('Takipci listesi hatasi:', e);
      return [];
    }
  },

  /**
   * Takip listesi (benim takip ettiklerim - sadece accepted)
   */
  async getFollowing(userId: string): Promise<FollowUser[]> {
    try {
      const { data, error } = await supabase
        .from('friendships')
        .select('friend_id, profiles!friendships_friend_id_fkey(id, display_name, avatar_url, username, tier, is_online)')
        .eq('user_id', userId)
        .eq('status', 'accepted');
      if (error) throw error;
      return (data || []).map((d: any) => d.profiles).filter(Boolean) as FollowUser[];
    } catch (e: any) {
      console.error('Takip listesi hatasi:', e);
      return [];
    }
  },

  /**
   * Takipçi sayısı (sadece accepted)
   */
  async getFollowerCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .eq('friend_id', userId)
      .eq('status', 'accepted');
    if (error) return 0;
    return count || 0;
  },

  /**
   * Takip sayısı (sadece accepted)
   */
  async getFollowingCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'accepted');
    if (error) return 0;
    return count || 0;
  },

  /**
   * Bekleyen istek sayısı (badge için)
   */
  async getPendingCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .eq('friend_id', userId)
      .eq('status', 'pending');
    if (error) return 0;
    return count || 0;
  },
};
