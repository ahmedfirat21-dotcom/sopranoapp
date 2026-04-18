/**
 * SopranoChat — Oda Takip Servisi
 * Kullanıcılar odaları takip edebilir, takip bırakabilir.
 * Takip edilen odalar "Odalarım" ve "Keşfet" sayfalarında görünür.
 */
import { supabase } from '../constants/supabase';
import { PushService } from './push';
import type { Room } from './database';

export interface RoomFollow {
  id: string;
  room_id: string;
  user_id: string;
  created_at: string;
}

export const RoomFollowService = {
  /** Odayı takip et + oda sahibine bildirim gönder */
  async follow(roomId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.from('room_follows').upsert({
        room_id: roomId,
        user_id: userId,
      }, { onConflict: 'room_id,user_id' });
      if (error) throw error;

      // ★ Oda sahibine bildirim gönder (arka planda, follow'u bloklamaz)
      this._notifyRoomOwner(roomId, userId).catch(() => {});

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  /** @internal Oda sahibine takip bildirimi gönder */
  async _notifyRoomOwner(roomId: string, followerId: string): Promise<void> {
    try {
      // Oda bilgilerini çek (host_id + name)
      const { data: room } = await supabase
        .from('rooms')
        .select('host_id, name')
        .eq('id', roomId)
        .single();
      if (!room || !room.host_id || room.host_id === followerId) return; // Kendi odanı takip ediyorsan bildirim gönderme

      // Takipçi profil bilgisini çek
      const { data: followerProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', followerId)
        .single();
      const followerName = followerProfile?.display_name || 'Birisi';
      const roomName = room.name || 'Oda';

      // 1. In-app notification (notifications tablosu)
      try {
        await supabase.from('notifications').insert({
          user_id: room.host_id,
          sender_id: followerId,
          type: 'room_follow',
          reference_id: roomId,
          body: `🏠 ${followerName} "${roomName}" odanızı takip etmeye başladı`,
        });
      } catch {
        // body kolonu yoksa body olmadan tekrar dene
        try {
          await supabase.from('notifications').insert({
            user_id: room.host_id,
            sender_id: followerId,
            type: 'room_follow',
            reference_id: roomId,
          });
        } catch { /* sessiz */ }
      }

      // 2. Push notification
      await PushService.sendRoomFollowNotification(
        room.host_id,
        followerName,
        followerId,
        roomId,
        roomName
      );
    } catch (e) {
      if (__DEV__) console.warn('[RoomFollowService] _notifyRoomOwner error:', e);
    }
  },

  /** Odayı takipten çık */
  async unfollow(roomId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('room_follows')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', userId);
      if (error) throw error;
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  /** Kullanıcı bu odayı takip ediyor mu? */
  async isFollowing(roomId: string, userId: string): Promise<boolean> {
    const { data } = await supabase
      .from('room_follows')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();
    return !!data;
  },

  /** Odanın takipçi sayısı */
  async getFollowerCount(roomId: string): Promise<number> {
    const { count, error } = await supabase
      .from('room_follows')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId);
    if (error) return 0;
    return count || 0;
  },

  /** Odanın takipçi profillerini getir (avatar + isim) */
  async getRoomFollowers(roomId: string, limit = 20): Promise<{ id: string; display_name: string; avatar_url: string }[]> {
    try {
      const { data, error } = await supabase
        .from('room_follows')
        .select('user_id, profiles:profiles!user_id(id, display_name, avatar_url)')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || [])
        .map((d: any) => d.profiles)
        .filter(Boolean)
        .map((p: any) => ({ id: p.id, display_name: p.display_name || 'Kullanıcı', avatar_url: p.avatar_url || '' }));
    } catch (e) {
      if (__DEV__) console.warn('[RoomFollowService] getRoomFollowers error:', e);
      return [];
    }
  },

  /** Kullanıcının takip ettiği odaları getir (canlı + kapalı kalıcı) */
  async getFollowedRooms(userId: string): Promise<Room[]> {
    const { data, error } = await supabase
      .from('room_follows')
      .select('room_id, rooms:rooms!room_id(*, host:profiles!host_id(*))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      if (__DEV__) console.warn('[RoomFollowService] getFollowedRooms error:', error);
      return [];
    }

    // rooms join'den gelen nested data'yı düzleştir
    return (data || [])
      .map((d: any) => d.rooms)
      .filter(Boolean)
      .filter((r: any) => r.is_live || r.is_persistent) as Room[];
  },

  /** Toplu takip durumu sorgulama (N+1 önleme) */
  async getBatchFollowStatus(userId: string, roomIds: string[]): Promise<Record<string, boolean>> {
    if (!roomIds.length) return {};
    const { data, error } = await supabase
      .from('room_follows')
      .select('room_id')
      .eq('user_id', userId)
      .in('room_id', roomIds);
    if (error) return {};
    const map: Record<string, boolean> = {};
    (data || []).forEach((d: any) => { map[d.room_id] = true; });
    return map;
  },

  /**
   * Host'un takipçi ID'lerini getir (friendships tablosundan)
   * ★ BUG-F2 FIX: Kolon adları düzeltildi — user_id (takip eden), friend_id (takip edilen)
   */
  async getFollowerIds(hostUserId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('friendships')
        .select('user_id')
        .eq('friend_id', hostUserId)
        .eq('status', 'accepted');
      if (error) throw error;
      return (data || []).map((d: any) => d.user_id).filter(Boolean);
    } catch (e) {
      if (__DEV__) console.warn('[RoomFollowService] getFollowerIds error:', e);
      return [];
    }
  },

  /** Takipçilere "yeni oda açıldı" bildirimi gönder */
  async notifyFollowersRoomLive(hostUserId: string, roomName: string, roomId: string): Promise<void> {
    try {
      const followerIds = await RoomFollowService.getFollowerIds(hostUserId);
      if (followerIds.length === 0) return;

      // Toplu notification insert (max 50 kişi)
      const batch = followerIds.slice(0, 50).map(uid => ({
        user_id: uid,
        sender_id: hostUserId,
        type: 'room_live',
        reference_id: roomId,
        body: `🎤 yeni bir oda açtı: "${roomName}"`,
      }));

      const { error } = await supabase.from('notifications').insert(batch);
      if (error) {
        if (__DEV__) console.warn('[RoomFollowService] notify error:', error.message);
        // body kolonu yoksa body olmadan tekrar dene
        const batchNoBody = batch.map(({ body, ...rest }) => rest);
        await supabase.from('notifications').insert(batchNoBody);
      }
    } catch (e) {
      if (__DEV__) console.warn('[RoomFollowService] notifyFollowersRoomLive error:', e);
    }
  },
};
