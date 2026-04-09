/**
 * SopranoChat — Oda Erişim Kontrol Servisi
 * ═══════════════════════════════════════════════════
 * Oda giriş kontrolü, hiyerarşik erişim isteği, davet sistemi.
 * Tier bazlı normalizasyon, deep link paylaşım.
 */
import { supabase } from '../constants/supabase';
import { ModerationService } from './moderation';
import { getRoomLimits, isTierAtLeast } from '../constants/tiers';
import type { Room, RoomSettings, SubscriptionTier, RoomLanguage, ParticipantRole } from '../types';
import { migrateLegacyTier } from '../types';

export type AccessCheckResult = {
  allowed: boolean;
  reason?: string;
  /** UI'da gösterilecek aksiyon — password_required: şifre input, request_sent: bekle, upsell: tier yükselt */
  action?: 'password_required' | 'request_sent' | 'upsell' | 'age_restricted' | 'language_restricted' | 'followers_only' | 'banned' | 'room_locked' | 'room_full';
};

export const RoomAccessService = {
  /**
   * Kullanıcı bu odaya katılabilir mi? Tüm kontrolleri yapar.
   * Kontrol sırası: ban → kilit → followers_only → yaş → dil → tip → kapasite
   */
  async checkAccess(
    room: Partial<Room>,
    userId: string,
    userTier: SubscriptionTier = 'Free',
    userAge?: number | null,
    userLanguage?: string | null,
    enteredPassword?: string,
  ): Promise<AccessCheckResult> {
    const roomId = room.id!;
    const settings = (room.room_settings || {}) as RoomSettings;

    // ── 1. Ban kontrolü ──
    const isBanned = await ModerationService.isRoomBanned(roomId, userId);
    if (isBanned) {
      return { allowed: false, reason: 'Bu odadan yasaklanmışsınız.', action: 'banned' };
    }

    // ── 2. Oda kilidi kontrolü ──
    if (settings.is_locked) {
      return { allowed: false, reason: 'Oda şu anda kilitli. Yeni katılımcı kabul edilmiyor.', action: 'room_locked' };
    }

    // ── 3. Followers-only modu kontrolü (Gold+) ──
    if (settings.followers_only) {
      const isFollowing = await this._isFollowingHost(userId, room.host_id!);
      if (!isFollowing) {
        return {
          allowed: false,
          reason: 'Bu oda yalnızca oda sahibinin takipçilerine açık.',
          action: 'followers_only',
        };
      }
    }

    // ── 4. Yaş filtresi kontrolü (Silver+) ──
    if (settings.age_filter_min && settings.age_filter_min > 0) {
      if (!userAge || userAge < settings.age_filter_min) {
        return {
          allowed: false,
          reason: `Bu odaya katılmak için en az ${settings.age_filter_min} yaşında olmalısınız.`,
          action: 'age_restricted',
        };
      }
    }

    // ── 5. Dil filtresi kontrolü (Silver+) ──
    if (settings.language_filter && settings.language_filter.length > 0) {
      if (userLanguage && !settings.language_filter.includes(userLanguage as RoomLanguage)) {
        return {
          allowed: false,
          reason: 'Bu odanın dil filtresi sizi engelledi.',
          action: 'language_restricted',
        };
      }
    }

    // ── 6. Oda tipi kontrolü ──
    const roomType = room.type || 'open';

    if (roomType === 'open') {
      // Herkese açık — dinleyici kapasitesini kontrol et
      return this._checkCapacity(room, userId);
    }

    if (roomType === 'closed') {
      // Şifreli oda — şifre gerekli
      if (!enteredPassword) {
        return { allowed: false, reason: 'Bu oda şifre korumalı.', action: 'password_required' };
      }
      if (enteredPassword !== room.room_password) {
        return { allowed: false, reason: 'Yanlış şifre.' };
      }
      return this._checkCapacity(room, userId);
    }

    if (roomType === 'invite') {
      // Davetli oda — erişim isteği gönder
      const hasInvite = await this._hasInvite(roomId, userId);
      if (hasInvite) {
        return this._checkCapacity(room, userId);
      }
      // Erişim isteği gönder (hiyerarşik zincir)
      await this._sendAccessRequest(roomId, userId);
      return { allowed: false, reason: 'Katılma isteği gönderildi. Onay bekleniyor.', action: 'request_sent' };
    }

    // Bilinmeyen tip → izin ver
    return { allowed: true };
  },

  // ════════════════════════════════════════════════════════════
  // ERİŞİM İSTEĞİ ZİNCİRİ
  // ════════════════════════════════════════════════════════════

  /**
   * Hiyerarşik erişim isteği gönder.
   * Sıra: Owner → Moderator → Speaker (en yüksek online yetkili kişiye)
   */
  async _sendAccessRequest(roomId: string, userId: string): Promise<void> {
    // Odadaki yetkili kişileri bul (owner > moderator > speaker sırasıyla)
    const { data: authorizedUsers } = await supabase
      .from('room_participants')
      .select('user_id, role')
      .eq('room_id', roomId)
      .in('role', ['owner', 'moderator', 'speaker'])
      .order('role', { ascending: true }); // owner ilk

    // Hedef rolü belirle: önce owner, yoksa moderator, yoksa speaker
    let targetRole: 'owner' | 'moderator' | 'speaker' = 'owner';
    if (authorizedUsers && authorizedUsers.length > 0) {
      const ownerExists = authorizedUsers.some(u => u.role === 'owner');
      const modExists = authorizedUsers.some(u => u.role === 'moderator');
      if (ownerExists) targetRole = 'owner';
      else if (modExists) targetRole = 'moderator';
      else targetRole = 'speaker';
    }

    await supabase.from('room_access_requests').upsert({
      room_id: roomId,
      user_id: userId,
      status: 'pending',
      target_role: targetRole,
    }, { onConflict: 'room_id,user_id' });
  },

  /** Erişim isteğini onayla */
  async approveRequest(requestId: string, handledBy: string): Promise<void> {
    await supabase
      .from('room_access_requests')
      .update({ status: 'accepted', handled_by: handledBy })
      .eq('id', requestId);
  },

  /** Erişim isteğini reddet */
  async rejectRequest(requestId: string, handledBy: string): Promise<void> {
    await supabase
      .from('room_access_requests')
      .update({ status: 'rejected', handled_by: handledBy })
      .eq('id', requestId);
  },

  /** Odanın bekleyen erişim isteklerini getir */
  async getPendingRequests(roomId: string) {
    const { data, error } = await supabase
      .from('room_access_requests')
      .select('*, user:profiles!user_id(id, display_name, avatar_url, subscription_tier)')
      .eq('room_id', roomId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (error) return [];
    return data || [];
  },

  // ════════════════════════════════════════════════════════════
  // DAVET SİSTEMİ
  // ════════════════════════════════════════════════════════════

  /** Kullanıcıyı odaya davet et */
  async inviteUser(roomId: string, invitedUserId: string, invitedBy: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.from('room_invites').upsert({
        room_id: roomId,
        user_id: invitedUserId,
        invited_by: invitedBy,
      }, { onConflict: 'room_id,user_id' });
      if (error) throw error;

      // Bildirim gönder
      try {
        await supabase.from('notifications').insert({
          user_id: invitedUserId,
          sender_id: invitedBy,
          type: 'room_invite',
          reference_id: roomId,
          body: 'seni odaya davet etti',
        });
      } catch { /* bildirim opsiyonel */ }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  /** Kullanıcının bu odaya daveti var mı? */
  async _hasInvite(roomId: string, userId: string): Promise<boolean> {
    const { data } = await supabase
      .from('room_invites')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();
    return !!data;
  },

  // ════════════════════════════════════════════════════════════
  // YARDIMCI FONKSİYONLAR
  // ════════════════════════════════════════════════════════════

  /** Kullanıcı, oda sahibini takip ediyor mu? */
  async _isFollowingHost(userId: string, hostId: string): Promise<boolean> {
    if (userId === hostId) return true; // Sahibin kendi odası
    const { data } = await supabase
      .from('friendships')
      .select('status')
      .eq('user_id', userId)
      .eq('friend_id', hostId)
      .eq('status', 'accepted')
      .maybeSingle();
    return !!data;
  },

  /** Kapasite kontrolü — dinleyici grid + seyirci */
  async _checkCapacity(room: Partial<Room>, _userId: string): Promise<AccessCheckResult> {
    const maxListeners = room.max_listeners || 20;

    // Mevcut dinleyici sayısını kontrol et (listener rolündekiler)
    const { count } = await supabase
      .from('room_participants')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room.id!)
      .eq('role', 'listener');

    const currentListeners = count || 0;

    if (currentListeners >= maxListeners) {
      // Dinleyici grid dolu — seyirci olarak katılabilir
      // Seyirci kapasitesini de kontrol et
      const maxSpectators = (room as any).max_spectators || 999;
      const { count: specCount } = await supabase
        .from('room_participants')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', room.id!)
        .eq('role', 'spectator');

      const currentSpectators = specCount || 0;
      if (currentSpectators >= maxSpectators) {
        return {
          allowed: false,
          reason: `Oda tamamen dolu (${maxListeners} dinleyici + ${maxSpectators} seyirci).`,
          action: 'room_full',
        };
      }

      return {
        allowed: true,
        reason: 'Dinleyici alanı dolu. Seyirci olarak katılıyorsunuz.',
      };
    }

    return { allowed: true };
  },

  // ════════════════════════════════════════════════════════════
  // DEEP LINK & ARKADAŞ DAVETİ
  // ════════════════════════════════════════════════════════════

  /**
   * Oda davet linki oluştur (deep link).
   * Uygulama içinde `sopranochat://room/{roomId}` şemasını kullanır.
   * Web fallback: `https://sopranochat.com/room/{roomId}`
   */
  generateShareLink(roomId: string, roomName?: string): { deepLink: string; webLink: string; shareText: string } {
    const deepLink = `sopranochat://room/${roomId}`;
    const webLink = `https://sopranochat.com/room/${roomId}`;
    const name = roomName || 'bir oda';
    const shareText = `🎤 SopranoChat'te "${name}" odasına katıl!\n${webLink}`;
    return { deepLink, webLink, shareText };
  },

  /**
   * Arkadaş listesinden toplu davet gönder.
   * @param friendIds - Davet edilecek kullanıcı ID'leri
   * @returns Başarılı davet sayısı
   */
  async inviteFriends(
    roomId: string,
    friendIds: string[],
    invitedBy: string,
  ): Promise<{ successCount: number; failedCount: number }> {
    let successCount = 0;
    let failedCount = 0;

    for (const friendId of friendIds) {
      const result = await this.inviteUser(roomId, friendId, invitedBy);
      if (result.success) {
        successCount++;
      } else {
        failedCount++;
      }
    }

    return { successCount, failedCount };
  },
};
