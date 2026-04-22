/**
 * SopranoChat — Arkadaşlık Servis Katmanı
 *
 * ★ Facebook tarzı çift yönlü arkadaşlık (2026-04-18 refactor'ı):
 *   sendFriendRequest() → pending istek oluşturur
 *   acceptFriendRequest() → kabul eder (accepted, çift yönlü geçerli)
 *   rejectFriendRequest() → reddeder (siler)
 *   removeFriend() → arkadaşlığı kaldırır (iki yönlü silinir)
 *   isFriend() → A ve B accepted mi (user_id/friend_id sırasından bağımsız)
 *
 * Legacy API aliases (follow/unfollow/approveRequest/rejectRequest/isFollowing)
 * korunuyor; yeni kod yeni isimleri kullanmalı.
 */
import { supabase } from '../constants/supabase';
import { PushService } from './push';
import { GamificationService } from './gamification';
import { logger } from '../utils/logger';

export type FriendshipStatus = 'pending' | 'accepted' | 'blocked';

export type Friendship = {
  id: string;
  user_id: string;
  friend_id: string;
  status: FriendshipStatus;
  created_at: string;
};

/** ★ Legacy ad — FriendUser ile aynı. Kod geçişi tamamlanınca kaldırılacak. */
export type FollowUser = {
  id: string;
  display_name: string;
  avatar_url: string;
  username: string | null;
  subscription_tier: string;
  is_online: boolean;
};
export type FriendUser = FollowUser;

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
   * ★ 24h cooldown: Reddedilen isteğin ardından 24 saat beklenmeli (X.com/Instagram standardı)
   */
  async follow(userId: string, targetId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // ★ SEC-FOLLOW-RATE: Saatlik takip isteği limiti — bot spam engeli
      const oneHourAgoRL = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count: recentFollowCount, error: rateError } = await supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', oneHourAgoRL);
      if (rateError) throw rateError;
      if ((recentFollowCount || 0) >= 30) {
        return { success: false, error: 'Çok fazla takip isteği gönderdiniz. Lütfen 1 saat sonra tekrar deneyin.' };
      }

      // ★ Cooldown kontrolü: Bu kullanıcıya (userId) hedef (targetId) tarafından
      // gönderilmiş bir 'follow_rejected' bildirimi var mı kontrol et.
      // Eğer varsa ve 24 saatten yeniyse, tekrar istek gönderilemez.
      const cooldownHours = 24;
      const cooldownDate = new Date(Date.now() - cooldownHours * 60 * 60 * 1000).toISOString();
      const { data: recentReject } = await supabase
        .from('notifications')
        .select('id, created_at')
        .eq('user_id', userId)         // Reddedilen kişi (istek gönderen) — bildirim buraya kaydedilir
        .eq('sender_id', targetId)     // Reddeden kişi (istek alan)
        .eq('type', 'follow_rejected')
        .gte('created_at', cooldownDate)
        .limit(1);
      if (recentReject && recentReject.length > 0) {
        return { success: false, error: 'Bu kullanıcıya tekrar istek göndermek için 24 saat beklemelisiniz.' };
      }

      // ★ blocklist kontrolü: Engellenmişsem istek gönderemem
      const { data: blocked } = await supabase
        .from('friendships')
        .select('status')
        .eq('user_id', targetId)
        .eq('friend_id', userId)
        .eq('status', 'blocked')
        .maybeSingle();
      if (blocked) {
        return { success: false, error: 'Bu kullanıcıya istek gönderemezsiniz.' };
      }

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
      PushService.sendToUser(targetId, 'Arkadaşlık İsteği', `${name} seninle arkadaş olmak istiyor`, {
        type: 'follow_request',
        route: `/notifications`,
      }).catch(() => {});

      // ★ Bildirimler tablosuna kaydet (zil + dropdown + sayfa için)
      try {
        const { error: nErr } = await supabase.from('notifications').insert({
          user_id: targetId,
          sender_id: userId,
          type: 'follow_request',
          reference_id: null,
          body: 'seninle arkadaş olmak istiyor',
        });
        if (nErr && __DEV__) console.warn('[Friendship] Bildirim insert hatası:', nErr.message);
      } catch (notifErr) {
        if (__DEV__) console.warn('[Friendship] Bildirim catch:', notifErr);
      }

      return { success: true };
    } catch (e: any) {
      logger.error('Takip istegi hatasi:', e);
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

      // ★ Karşı taraftaki follow_request bildirimini temizle (pending iptal durumu)
      try {
        await supabase.from('notifications')
          .delete()
          .eq('user_id', targetId)
          .eq('sender_id', userId)
          .eq('type', 'follow_request');
      } catch (err) {
        if (__DEV__) console.warn('[Friendship] unfollow bildirim silme başarısız:', err);
      }

      return { success: true };
    } catch (e: any) {
      logger.error('Takipten cikma hatasi:', e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Kullanıcıyı engelle
   * ★ BUG-F11 FIX: Her iki yöndeki accepted/pending kayıtları sil, sonra blocked oluştur
   */
  async block(userId: string, targetId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Önce karşı taraftaki takip kaydını sil (accepted veya pending)
      await supabase
        .from('friendships')
        .delete()
        .eq('user_id', targetId)
        .eq('friend_id', userId)
        .in('status', ['accepted', 'pending']);

      // Kendi taraftaki mevcut accepted/pending kaydını sil
      await supabase
        .from('friendships')
        .delete()
        .eq('user_id', userId)
        .eq('friend_id', targetId)
        .in('status', ['accepted', 'pending']);

      // Blocked kaydı oluştur
      const { error } = await supabase
        .from('friendships')
        .insert({
          user_id: userId,
          friend_id: targetId,
          status: 'blocked',
        });
      if (error) throw error;

      // İlgili bildirimleri temizle
      try {
        await supabase.from('notifications')
          .delete()
          .or(`and(user_id.eq.${userId},sender_id.eq.${targetId}),and(user_id.eq.${targetId},sender_id.eq.${userId})`)
          .in('type', ['follow_request', 'follow_accepted', 'follow_rejected']);
      } catch (err) {
        if (__DEV__) console.warn('[Friendship] Block bildirim temizleme hatası:', err);
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  /**
   * İki kullanıcı arasındaki ilişki durumu
   * ★ BUG-F4 FIX: Sadece outgoing yönünü döndürür (userId → targetId).
   * Incoming yönü için getDetailedStatus() veya getIncomingStatus() kullanın.
   */
  async getStatus(userId: string, targetId: string): Promise<FriendshipStatus | null> {
    try {
      // Sadece userId'nin targetId'ye gönderdiği istek/takip durumunu döndür
      const { data } = await supabase
        .from('friendships')
        .select('status')
        .eq('user_id', userId)
        .eq('friend_id', targetId)
        .maybeSingle();
      return (data?.status as FriendshipStatus) || null;
    } catch (e: any) {
      return null;
    }
  },

  /**
   * Karşı tarafın bana gönderdiği istek durumu (targetId → userId)
   */
  async getIncomingStatus(userId: string, targetId: string): Promise<FriendshipStatus | null> {
    try {
      const { data } = await supabase
        .from('friendships')
        .select('status')
        .eq('user_id', targetId)
        .eq('friend_id', userId)
        .maybeSingle();
      // Karşı taraf bizi engellemiş olabilir — bu bilgiyi gösterme
      if (data?.status === 'blocked') return null;
      return (data?.status as FriendshipStatus) || null;
    } catch (e: any) {
      return null;
    }
  },

  /**
   * ★ X.com tarzı çift yönlü takip durumu
   * Hem "ben onu takip ediyor muyum?" hem "o beni takip etmek istiyor mu?" bilgisini verir
   */
  async getDetailedStatus(userId: string, targetId: string): Promise<{
    outgoing: FriendshipStatus | null;  // Ben → Hedef
    incoming: FriendshipStatus | null;  // Hedef → Ben
  }> {
    try {
      const [outRes, inRes] = await Promise.all([
        supabase.from('friendships').select('status').eq('user_id', userId).eq('friend_id', targetId).maybeSingle(),
        supabase.from('friendships').select('status').eq('user_id', targetId).eq('friend_id', userId).maybeSingle(),
      ]);
      return {
        outgoing: (outRes.data?.status as FriendshipStatus) || null,
        incoming: (inRes.data?.status as FriendshipStatus) || null,
      };
    } catch {
      return { outgoing: null, incoming: null };
    }
  },

  /**
   * Toplu takip durumu sorgulama (N+1 problemini çözer)
   * ★ BUG-F15 FIX: Her iki yönü de kontrol eder (outgoing + incoming)
   */
  async getBatchStatus(userId: string, targetIds: string[]): Promise<Record<string, { outgoing: FriendshipStatus | null; incoming: FriendshipStatus | null }>> {
    if (!targetIds.length) return {};
    try {
      // Outgoing: userId → targets
      const { data: outgoing } = await supabase
        .from('friendships')
        .select('friend_id, status')
        .eq('user_id', userId)
        .in('friend_id', targetIds);

      // Incoming: targets → userId
      const { data: incoming } = await supabase
        .from('friendships')
        .select('user_id, status')
        .eq('friend_id', userId)
        .in('user_id', targetIds);

      const result: Record<string, { outgoing: FriendshipStatus | null; incoming: FriendshipStatus | null }> = {};
      for (const id of targetIds) {
        result[id] = {
          outgoing: (outgoing || []).find((r: any) => r.friend_id === id)?.status || null,
          incoming: (incoming || []).find((r: any) => r.user_id === id)?.status || null,
        };
      }
      return result;
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
      logger.error('Bekleyen istek listesi hatasi:', e);
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

      // ★ Eski follow_request bildirimini sil — hayalet bildirim önleme
      try {
        await supabase.from('notifications')
          .delete()
          .eq('user_id', userId)
          .eq('sender_id', followerId)
          .eq('type', 'follow_request');
      } catch (err) {
        if (__DEV__) console.warn('[Friendship] approveRequest bildirim silme başarısız:', err);
      }

      // Onaylayan kullanıcıya bildirim gönder
      const { data: approver } = await supabase.from('profiles').select('display_name').eq('id', userId).single();
      const name = approver?.display_name || 'Birisi';
      PushService.sendToUser(followerId, 'Arkadaşlık Kabul Edildi', `${name} seninle arkadaş oldu`, {
        type: 'follow_accepted',
        route: `/user/${userId}`,
      }).catch(() => {});

      // ★ Bildirimler tablosuna kaydet
      try {
        const { error: nErr } = await supabase.from('notifications').insert({
          user_id: followerId,
          sender_id: userId,
          type: 'follow_accepted',
          reference_id: null,
          body: 'arkadaşlık isteğini kabul etti',
        });
        if (nErr && __DEV__) console.warn('[Friendship] Onay bildirimi insert hatası:', nErr.message);
      } catch (notifErr) {
        if (__DEV__) console.warn('[Friendship] Onay bildirimi catch:', notifErr);
      }

      // ★ BUG-F16 FIX: İsteği onaylayan (userId) yeni bir takipçi kazandı → SP ver
      // userId = B (onaylayan, takipçi kazanan), followerId = A (istek gönderen, takip eden)
      try { await GamificationService.onFollowerGain(userId); } catch {}

      return { success: true };
    } catch (e: any) {
      logger.error('Istek onaylama hatasi:', e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Takip isteğini reddet (satırı sil)
   * ★ follow_rejected bildirimi kaydeder → cooldown mekanizması bu kayda bakar
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

      // ★ Eski follow_request bildirimini sil — hayalet bildirim önleme
      try {
        await supabase.from('notifications')
          .delete()
          .eq('user_id', userId)
          .eq('sender_id', followerId)
          .eq('type', 'follow_request');
      } catch (err) {
        if (__DEV__) console.warn('[Friendship] rejectRequest bildirim silme başarısız:', err);
      }

      // ★ Cooldown kaydı: Reddedilen kişiye bildirim ekle (24h spam engelleme)
      try {
        await supabase.from('notifications').insert({
          user_id: followerId,
          sender_id: userId,
          type: 'follow_rejected',
          body: 'takip isteğini reddetti',
        });
      } catch { /* silent */ }

      return { success: true };
    } catch (e: any) {
      logger.error('Istek reddetme hatasi:', e);
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
      const all = (data || []).map((d: any) => d.profiles).filter(Boolean) as FollowUser[];

      // ★ Engellenen kişileri filtrele
      const blockedIds = await this._getBlockedIds(userId);
      if (blockedIds.size === 0) return all;
      return all.filter(f => !blockedIds.has(f.id));
    } catch (e: any) {
      logger.error('Takipci listesi hatasi:', e);
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
      const all = (data || []).map((d: any) => d.profiles).filter(Boolean) as FollowUser[];

      // ★ Engellenen kişileri filtrele (her iki yön)
      const blockedIds = await this._getBlockedIds(userId);
      if (blockedIds.size === 0) return all;
      return all.filter(f => !blockedIds.has(f.id));
    } catch (e: any) {
      logger.error('Takip listesi hatasi:', e);
      return [];
    }
  },

  /**
   * ★ Karşılıklı takip edilen kişiler (mutual friends)
   * Hem "ben onu takip ediyorum" hem "o beni takip ediyor" durumundaki kişileri döndürür.
   * Online arkadaş şeridi, arama butonu gibi arkadaşlık gerektiren yerlerde kullanılır.
   */
  async getMutualFriends(userId: string): Promise<FollowUser[]> {
    try {
      // 1. Benim takip ettiklerim (userId → friend_id, accepted)
      const { data: outgoing, error: e1 } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', userId)
        .eq('status', 'accepted');
      if (e1) throw e1;
      const outgoingIds = new Set((outgoing || []).map((r: any) => r.friend_id));
      if (outgoingIds.size === 0) return [];

      // 2. Beni takip edenler (friend_id → userId, accepted) — sadece outgoingIds içindekiler
      const { data: incoming, error: e2 } = await supabase
        .from('friendships')
        .select('user_id')
        .eq('friend_id', userId)
        .eq('status', 'accepted')
        .in('user_id', Array.from(outgoingIds));
      if (e2) throw e2;
      const mutualIds = (incoming || []).map((r: any) => r.user_id);
      if (mutualIds.length === 0) return [];

      // 3. Mutual friend profillerini toplu çek
      const { data: profiles, error: e3 } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, username, subscription_tier, is_online')
        .in('id', mutualIds);
      if (e3) throw e3;
      return (profiles || []) as FollowUser[];
    } catch (e: any) {
      if (__DEV__) console.warn('[Friendship] getMutualFriends hatası:', e);
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
   * ★ BUG-F12 FIX: Sabit kanal adı — her çağrıda Date.now() eklenmez.
   */
  onFriendshipChange(userId: string, callback: (requests: PendingRequest[]) => void) {
    const channelName = `friendships:${userId}`;
    return supabase
      .channel(channelName)
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
   * - is_private = true → sadece arkadaşlar (bidirectional accepted) görebilir
   * - Kendi profilin → her zaman görebilirsin
   */
  async canViewProfile(viewerId: string, targetId: string): Promise<boolean> {
    if (viewerId === targetId) return true;

    const { data: target } = await supabase
      .from('profiles')
      .select('is_private')
      .eq('id', targetId)
      .single();

    if (!target || !target.is_private) return true;

    // Facebook modeli — herhangi bir yönde accepted yeterli
    return this.isFriend(viewerId, targetId);
  },

  /**
   * A kullanıcısı B'yi takip ediyor mu? (accepted durumunda)
   * ★ Legacy: Unidirectional check — yalnızca (userId→targetId, accepted) eşleşmesi.
   * Yeni kod isFriend() kullanmalı (bidirectional).
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

  // ═════════════════════════════════════════════════════════
  // ★ Facebook tarzı arkadaşlık API'ları (2026-04-18)
  // ═════════════════════════════════════════════════════════

  /**
   * İki kullanıcı arasında accepted arkadaşlık var mı? (çift yönlü)
   * (a,b,accepted) VEYA (b,a,accepted) doğruysa true.
   */
  async isFriend(userA: string, userB: string): Promise<boolean> {
    if (userA === userB) return false;
    const { data } = await supabase
      .from('friendships')
      .select('id, user_id, friend_id, status')
      .or(`and(user_id.eq.${userA},friend_id.eq.${userB}),and(user_id.eq.${userB},friend_id.eq.${userA})`)
      .eq('status', 'accepted')
      .limit(1);
    return !!(data && data.length > 0);
  },

  /** Arkadaşlık isteği gönder — follow() alias. */
  async sendFriendRequest(fromUserId: string, targetUserId: string) {
    return this.follow(fromUserId, targetUserId);
  },

  /** Arkadaşlık isteğini kabul et — approveRequest() alias. */
  async acceptFriendRequest(userId: string, requesterId: string) {
    return this.approveRequest(userId, requesterId);
  },

  /** Arkadaşlık isteğini reddet — rejectRequest() alias. */
  async rejectFriendRequest(userId: string, requesterId: string) {
    return this.rejectRequest(userId, requesterId);
  },

  /**
   * Arkadaşlığı kaldır — unfollow() alias AMA bidirectional:
   * hem (userId→friendId) hem (friendId→userId) satırlarını siler.
   */
  async removeFriend(userId: string, friendId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // ★ v41 (2026-04-20): Atomic RPC — race condition önler.
      //   Eski: iki yön DELETE client-tarafında. Eşzamanlı unfriend duplicate
      //   çağrıda inconsistent sonuç veriyordu. RPC tek transaction.
      const { error } = await supabase.rpc('unfriend_atomic', { p_friend_id: friendId });
      if (!error) return { success: true };
      // RPC yoksa (henüz deploy edilmedi) fallback
      if (/function .* does not exist|42883/i.test(error.message || '')) {
        await supabase
          .from('friendships')
          .delete()
          .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`)
          .eq('status', 'accepted');
        return { success: true };
      }
      return { success: false, error: error.message };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Arkadaşlık kaldırılamadı' };
    }
  },

  /**
   * Kullanıcının tüm arkadaşları — çift yönlü accepted birleşik liste.
   * Hem "beni takip eden accepted" hem "benim takip ettiğim accepted" kayıtlar.
   */
  async getFriends(userId: string): Promise<FriendUser[]> {
    // Kullanıcı A olarak benim user_id'yim, partner friend_id olur
    const [outRes, inRes] = await Promise.all([
      supabase
        .from('friendships')
        .select('friend_id, friend:profiles!friend_id(id, display_name, avatar_url, username, subscription_tier, is_online)')
        .eq('user_id', userId)
        .eq('status', 'accepted'),
      supabase
        .from('friendships')
        .select('user_id, user:profiles!user_id(id, display_name, avatar_url, username, subscription_tier, is_online)')
        .eq('friend_id', userId)
        .eq('status', 'accepted'),
    ]);

    const map = new Map<string, FriendUser>();
    (outRes.data || []).forEach((r: any) => {
      const p = Array.isArray(r.friend) ? r.friend[0] : r.friend;
      if (p?.id) map.set(p.id, p);
    });
    (inRes.data || []).forEach((r: any) => {
      const p = Array.isArray(r.user) ? r.user[0] : r.user;
      if (p?.id) map.set(p.id, p);
    });
    return Array.from(map.values());
  },

  /** Arkadaş sayısı — çift yönlü tekil count. */
  async getFriendCount(userId: string): Promise<number> {
    const friends = await this.getFriends(userId);
    return friends.length;
  },

  /**
   * Bekleyen gelen istekler — getFollowRequests() alias.
   * Legacy implementasyonu var, rename edilmez.
   */
  async getPendingFriendRequests(userId: string) {
    // Dışarıda getFollowRequests varsa onu kullan, yoksa inline
    if (typeof (this as any).getFollowRequests === 'function') {
      return (this as any).getFollowRequests(userId);
    }
    const { data } = await supabase
      .from('friendships')
      .select('id, user_id, created_at, sender:profiles!user_id(id, display_name, avatar_url, username, subscription_tier)')
      .eq('friend_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    return (data || []) as any;
  },

  // ============================================
  // ODA GİZLİLİĞİ (hide_owned_rooms)
  // ============================================

  /**
   * Kullanıcının sahip olduğu odaları görebilir miyim?
   * - hide_owned_rooms = false → herkes görebilir
   * - hide_owned_rooms = true → sadece arkadaşlar görebilir (bidirectional)
   * - Kendi profilin → her zaman görebilirsin
   */
  async canViewOwnedRooms(viewerId: string, targetId: string): Promise<boolean> {
    if (viewerId === targetId) return true;

    const { data: target } = await supabase
      .from('profiles')
      .select('hide_owned_rooms')
      .eq('id', targetId)
      .single();

    if (!target || !target.hide_owned_rooms) return true;

    // Facebook modeli — herhangi bir yönde accepted yeterli
    return this.isFriend(viewerId, targetId);
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

  /**
   * ★ BUG-F1 FIX: Takipçi çıkarma (accepted olan takipçiyi siler)
   * rejectRequest sadece pending kaydı sildiği için, accepted takipçi çıkarmak
   * için bu ayrı fonksiyon gerekli. Sessizce siler — cooldown bildirimi OLUŞTURMAZ.
   */
  async removeFollower(userId: string, followerId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('user_id', followerId)
        .eq('friend_id', userId)
        .eq('status', 'accepted');
      if (error) throw error;
      return { success: true };
    } catch (e: any) {
      if (__DEV__) console.warn('[Friendship] removeFollower hatası:', e);
      return { success: false, error: e.message };
    }
  },

  /**
   * ★ ARCH-3 FIX: Shared utility'ye delege edildi — kod tekrarı önlendi
   * Kaynak 1: friendships tablosu (status = 'blocked')
   * Kaynak 2: blocked_users tablosu (ModerationService)
   */
  async _getBlockedIds(userId: string): Promise<Set<string>> {
    // ★ ARCH-3: Shared utility — circular dependency kırıldı
    const { getBlockedUserIds } = require('./blocklist');
    return getBlockedUserIds(userId);
  },
};
