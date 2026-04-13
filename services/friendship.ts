/**
 * SopranoChat — Arkadaşlık / Takip Servis Katmanı
 * Instagram tarzı karşılıklı onay sistemi:
 *   follow()  → pending istek oluşturur
 *   approve() → kabul eder (accepted)
 *   reject()  → reddeder (siler)
 */
import { supabase } from '../constants/supabase';
import { PushService } from './push';
import { GamificationService } from './gamification';

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
   * ★ 24h cooldown: Reddedilen isteğin ardından 24 saat beklenmeli (X.com/Instagram standardı)
   */
  async follow(userId: string, targetId: string): Promise<{ success: boolean; error?: string }> {
    try {
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
      PushService.sendToUser(targetId, 'Takip İsteği', `${name} seni takip etmek istiyor`, {
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
          body: 'seni takip etmek istiyor',
        });
        if (nErr && __DEV__) console.warn('[Friendship] Bildirim insert hatası:', nErr.message);
      } catch (notifErr) {
        if (__DEV__) console.warn('[Friendship] Bildirim catch:', notifErr);
      }

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
      console.error('Takipten cikma hatasi:', e);
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
      PushService.sendToUser(followerId, 'Takip Onaylandı', `${name} takip isteğini kabul etti`, {
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
          body: 'takip isteğini kabul etti',
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
      console.error('Istek onaylama hatasi:', e);
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
      const all = (data || []).map((d: any) => d.profiles).filter(Boolean) as FollowUser[];

      // ★ Engellenen kişileri filtrele
      const blockedIds = await this._getBlockedIds(userId);
      if (blockedIds.size === 0) return all;
      return all.filter(f => !blockedIds.has(f.id));
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
      const all = (data || []).map((d: any) => d.profiles).filter(Boolean) as FollowUser[];

      // ★ Engellenen kişileri filtrele (her iki yön)
      const blockedIds = await this._getBlockedIds(userId);
      if (blockedIds.size === 0) return all;
      return all.filter(f => !blockedIds.has(f.id));
    } catch (e: any) {
      console.error('Takip listesi hatasi:', e);
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
   * ★ BUG-F14 FIX: Yorum netleştirildi.
   * - is_private = false → herkes görebilir
   * - is_private = true → sadece takipçiler (accepted) görebilir
   * - Kendi profilin → her zaman görebilirsin
   *
   * isFollowing(A, B) = "A, B'yi takip ediyor" = "A, B'nin takipçisi"
   * Gizli profili görmek için viewer, target'ın takipçisi olmalıdır → isFollowing(viewer, target) ✓
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

    // Gizli profil — viewer, target'ı takip ediyor mu? (yani viewer, target'ın takipçisi mi?)
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
