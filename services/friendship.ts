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
  subscription_tier: string;
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
    subscription_tier: string;
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

      // ★ Bildirimler tablosuna kaydet (zil + dropdown + sayfa için)
      try {
        const notifPayload: any = { user_id: targetId, sender_id: userId, type: 'follow_request', reference_id: null };
        const { error: nErr } = await supabase.from('notifications').insert({ ...notifPayload, body: 'seni takip etmek istiyor' });
        if (nErr) await supabase.from('notifications').insert(notifPayload);
      } catch { /* silent */ }

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
   * Toplu takip durumu sorgulama (N+1 problemini çözer)
   * Tek sorguda birden fazla kullanıcının takip durumunu döndürür.
   */
  async getBatchStatus(userId: string, targetIds: string[]): Promise<Record<string, FriendshipStatus>> {
    if (!targetIds.length) return {};
    try {
      const { data, error } = await supabase
        .from('friendships')
        .select('friend_id, status')
        .eq('user_id', userId)
        .in('friend_id', targetIds);
      if (error) throw error;
      const map: Record<string, FriendshipStatus> = {};
      (data || []).forEach((row: any) => {
        map[row.friend_id] = row.status;
      });
      return map;
    } catch (e: any) {
      if (__DEV__) console.warn('Batch friendship status error:', e);
      return {};
    }
  },

  /**
   * Bana gelen bekleyen takip istekleri
   */
  async getPendingRequests(userId: string): Promise<PendingRequest[]> {
    try {
      const { data, error } = await supabase
        .from('friendships')
        .select('id, user_id, created_at, sender:profiles!friendships_user_id_fkey(id, display_name, avatar_url, username, subscription_tier)')
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

      // ★ Bildirimler tablosuna kaydet
      try {
        const notifPayload: any = { user_id: followerId, sender_id: userId, type: 'follow_accepted', reference_id: null };
        const { error: nErr } = await supabase.from('notifications').insert({ ...notifPayload, body: 'takip isteğini kabul etti' });
        if (nErr) await supabase.from('notifications').insert(notifPayload);
      } catch { /* silent */ }

      // SP: Yeni takipçi kazanan kişiye +15 SP
      try { await supabase.rpc('grant_system_points', { p_user_id: userId, p_amount: 15, p_action: 'new_follower' }); } catch {}

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
        .select('user_id, profiles!friendships_user_id_fkey(id, display_name, avatar_url, username, subscription_tier, is_online)')
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
        .select('friend_id, profiles!friendships_friend_id_fkey(id, display_name, avatar_url, username, subscription_tier, is_online)')
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

  // ============================================
  // REALTIME — Arkadaşlık değişikliklerini dinle
  // ============================================

  /**
   * Bana gelen takip istekleri değiştiğinde anlık tetiklenir.
   * INSERT (yeni istek), UPDATE (onay/red), DELETE (iptal) hepsini kapsar.
   */
  onFriendshipChange(userId: string, callback: (requests: PendingRequest[]) => void) {
    return supabase
      .channel(`friendships:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `friend_id=eq.${userId}`,
        },
        async () => {
          try {
            const requests = await FriendshipService.getPendingRequests(userId);
            callback(requests);
          } catch (e) {
            if (__DEV__) console.warn('[Friendship Realtime] hata:', e);
          }
        }
      )
      .subscribe();
  },

  /** Realtime kanaldan çık */
  unsubscribe(channel: ReturnType<typeof supabase.channel>) {
    supabase.removeChannel(channel);
  },

  // ============================================
  // FAZ 5: PROFİL GİZLİLİĞİ
  // ============================================

  /**
   * Gizli profili görüntüleme yetkisi kontrolü
   * - is_private = false → herkes görebilir
   * - is_private = true → sadece takipçiler (accepted) görebilir
   * - Kendi profilin → her zaman görebilirsin
   */
  async canViewProfile(viewerId: string, targetId: string): Promise<boolean> {
    // Kendi profilim — her zaman görebilirim
    if (viewerId === targetId) return true;

    // Hedef profilin gizlilik durumunu kontrol et
    const { data: target } = await supabase
      .from('profiles')
      .select('is_private')
      .eq('id', targetId)
      .single();

    // Profil bulunamadı veya açık profil — görebilir
    if (!target || !target.is_private) return true;

    // Gizli profil — takipçi miyim?
    return this.isFollowing(viewerId, targetId);
  },

  /**
   * A kullanıcısı B'yi takip ediyor mu? (accepted durumunda)
   */
  async isFollowing(userId: string, targetId: string): Promise<boolean> {
    const { data } = await supabase
      .from('friendships')
      .select('status')
      .eq('user_id', userId)
      .eq('friend_id', targetId)
      .eq('status', 'accepted')
      .maybeSingle();
    return !!data;
  },

  // ============================================
  // ODA GİZLİLİĞİ (hide_owned_rooms)
  // ============================================

  /**
   * Kullanıcının sahip olduğu odaları görebilir miyim?
   * - hide_owned_rooms = false → herkes görebilir
   * - hide_owned_rooms = true → sadece takipçiler görebilir
   * - Kendi profilin → her zaman görebilirsin
   */
  async canViewOwnedRooms(viewerId: string, targetId: string): Promise<boolean> {
    // Kendi profilim — her zaman görebilirim
    if (viewerId === targetId) return true;

    // Hedef profilin hide_owned_rooms durumunu kontrol et
    const { data: target } = await supabase
      .from('profiles')
      .select('hide_owned_rooms')
      .eq('id', targetId)
      .single();

    // Profil bulunamadı veya gizleme kapalı — görebilir
    if (!target || !target.hide_owned_rooms) return true;

    // Gizleme açık — takipçi miyim?
    return this.isFollowing(viewerId, targetId);
  },

  /**
   * Kullanıcının sahip olduğu odaları getir — gizlilik filtreleme ile.
   * Takipçi değilse ve hide_owned_rooms=true ise boş dizi döner.
   */
  async getUserRoomsFiltered(viewerId: string, targetId: string): Promise<any[]> {
    const canView = await this.canViewOwnedRooms(viewerId, targetId);
    if (!canView) return [];

    // Odaları getir
    const { data, error } = await supabase
      .from('rooms')
      .select('id, name, category, type, is_live, listener_count, created_at')
      .eq('host_id', targetId)
      .eq('is_live', true)
      .order('created_at', { ascending: false });

    if (error) return [];
    return data || [];
  },
};
