/**
 * SopranoChat — Oda Erişim Kontrol Servisi
 * ═══════════════════════════════════════════════════
 * Oda giriş kontrolü, hiyerarşik erişim isteği, davet sistemi.
 * Tier bazlı normalizasyon, deep link paylaşım.
 */
import { supabase } from '../constants/supabase';
import { ModerationService } from './moderation';
import { getRoomLimits, isTierAtLeast } from '../constants/tiers';
import * as Crypto from 'expo-crypto';
import type { Room, RoomSettings, SubscriptionTier, RoomLanguage, ParticipantRole } from '../types';
import { migrateLegacyTier } from '../types';

// ★ SEC-PWD: Oda şifre hash'leme yardımcıları
const PWD_SALT = 'soprano_room_v1_'; // Sabit salt — oda şifreleri düşük güvenlik gerektiren alan

/** Şifreyi SHA-256 ile hash'le — ★ Export: room.ts create() tarafından da kullanılır */
export async function hashPassword(password: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    PWD_SALT + password.trim()
  );
  return digest;
}

/** Hash karşılaştırması — geriye uyumluluk: plaintext de kontrol eder */
async function verifyPassword(entered: string, stored: string): Promise<boolean> {
  // 1. Hash karşılaştırması (yeni format)
  const enteredHash = await hashPassword(entered);
  if (enteredHash === stored) return true;
  // 2. Plaintext karşılaştırması (eski format — migration tamamlanana kadar)
  if (entered.trim() === stored) return true;
  return false;
}

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

    // ── 0. Host & Admin bypass — oda sahibi ve adminler her zaman girebilir ──
    const isHost = room.host_id === userId;
    const isOriginalHost = settings.original_host_id === userId;
    if (isHost || isOriginalHost) {
      return { allowed: true };
    }
    // Admin bypass ayrı kontrol edilir (profiles tablosunda is_admin)

    // ── 1. Ban kontrolü ──
    const isBanned = await ModerationService.isRoomBanned(roomId, userId);
    if (isBanned) {
      return { allowed: false, reason: 'Bu odadan yasaklanmışsınız.', action: 'banned' };
    }

    // ── 2. Oda kilidi kontrolü ──
    if (settings.is_locked) {
      return { allowed: false, reason: 'Oda şu anda kilitli. Yeni katılımcı kabul edilmiyor.', action: 'room_locked' };
    }

    // ── 3. Sadece arkadaşlar modu kontrolü (Pro+) ──
    // ★ 2026-04-18: friendship çift yönlü — (A,B) veya (B,A) accepted ise erişim verilir
    if (settings.followers_only) {
      const isFriend = await this._isFriendWithHost(userId, room.host_id!);
      if (!isFriend) {
        return {
          allowed: false,
          reason: 'Bu oda yalnızca oda sahibinin arkadaşlarına açık.',
          action: 'followers_only',
        };
      }
    }

    // ── 4. Yaş filtresi kontrolü (Plus+) ──
    // age_restricted boolean desteği: true ise age_filter_min yoksa 18 olarak kabul et
    const ageFilterMin = settings.age_filter_min || ((settings as any).age_restricted === true ? 18 : 0);
    if (ageFilterMin > 0) {
      if (!userAge || userAge < ageFilterMin) {
        return {
          allowed: false,
          reason: `Bu odaya katılmak için en az ${ageFilterMin} yaşında olmalısınız.`,
          action: 'age_restricted',
        };
      }
    }

    // ── 5. Dil filtresi kontrolü (Plus+) ──
    // ★ 2026-04-18 FIX: Fail-closed — userLanguage yoksa da bloklanır.
    // Öncesi: `userLanguage && !filter.includes(...)` → language null ise kontrol
    // komple atlanıyor ve filtre devre dışı kalıyordu.
    if (settings.language_filter && settings.language_filter.length > 0) {
      if (!userLanguage || !settings.language_filter.includes(userLanguage as RoomLanguage)) {
        return {
          allowed: false,
          reason: 'Bu odanın dil filtresi sizi engelledi.',
          action: 'language_restricted',
        };
      }
    }

    // ── 6. Oda tipi kontrolü ──
    const roomType = room.type || 'open';

    // ★ 2026-04-18 FIX: Password fallback — type ne olursa olsun (open/closed) şifre
    // varsa her zaman sor. Eski odalarda `type='open'` + `room_password` set edilmiş
    // vakalar vardı ve checkAccess 'open' branch'ine düşüp şifreyi atlıyordu. Güvenlik
    // açığı: artık şifre saklıysa MUTLAKA doğrulama istenir.
    //
    // ★ 2026-04-19: Davet kabul edilmişse (hasInvite=accepted) şifre bypass edilir.
    // Mantık: Davet = owner'ın güveni. Owner davet ederken kullanıcıya ekstra şifre
    // paylaşmak zorunda kalmasın. Davetsiz girişler hâlâ şifre gerektirir.
    const storedPassword = room.room_password || (settings as any).room_password;
    if (storedPassword && (roomType === 'open' || roomType === 'closed')) {
      // Önce davet kontrolü — kabul edilmişse şifre atlanır
      const hasAcceptedInvite = await this._hasInvite(roomId, userId);
      if (!hasAcceptedInvite) {
        if (!enteredPassword) {
          return { allowed: false, reason: 'Bu oda şifre korumalı.', action: 'password_required' };
        }
        const passwordMatch = await verifyPassword(enteredPassword, storedPassword);
        if (!passwordMatch) {
          return { allowed: false, reason: 'Yanlış şifre.' };
        }
      }
      // Şifre doğru veya davet geçerli → kapasite kontrolüne devam
      return this._checkCapacity(room, userId);
    }

    if (roomType === 'open') {
      // Herkese açık + şifresiz — dinleyici kapasitesini kontrol et
      return this._checkCapacity(room, userId);
    }

    if (roomType === 'closed') {
      // Şifre tanımlı değilse (edge case) giriş serbest — kapasiteye bak
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
   * ★ Broadcast + DB bildirim gönderir
   */
  async _sendAccessRequest(roomId: string, userId: string): Promise<void> {
    // ★ SEC-FLOOD: Access request rate limit — max 10 istek/saat
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('room_access_requests')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', oneHourAgo);
    if ((count || 0) >= 10) {
      throw new Error('Çok fazla katılma isteği gönderdiniz. Lütfen 1 saat sonra tekrar deneyin.');
    }

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

    // DB'ye istek yaz
    await supabase.from('room_access_requests').upsert({
      room_id: roomId,
      user_id: userId,
      status: 'pending',
      target_role: targetRole,
    }, { onConflict: 'room_id,user_id' });

    // ★ İstekçinin profil bilgisini çek
    const { data: requesterProfile } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', userId)
      .single();
    const requesterName = requesterProfile?.display_name || 'Birisi';

    // ★ Host ve moderatörlere inbox bildirimi gönder — tek seferde batch insert
    const notifyTargets = (authorizedUsers || [])
      .filter(u => u.role === 'owner' || u.role === 'moderator')
      .map(u => u.user_id);

    if (notifyTargets.length > 0) {
      const rows = notifyTargets.map(targetId => ({
        user_id: targetId,
        sender_id: userId,
        type: 'room_access_request',
        reference_id: roomId,
        body: `${requesterName} odaya katılmak istiyor`,
      }));
      try {
        await supabase.from('notifications').insert(rows);
      } catch { /* bildirim opsiyonel */ }
    }
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
        status: 'pending', // ★ Tekrar davet edildiğinde 'declined' → 'pending' sıfırla
      }, { onConflict: 'room_id,user_id' });
      if (error) throw error;

      // ★ Davet eden kişinin adını ve oda adını çek — bildirimde göster
      const [inviterRes, roomRes] = await Promise.all([
        supabase.from('profiles').select('display_name').eq('id', invitedBy).single(),
        supabase.from('rooms').select('name').eq('id', roomId).single(),
      ]);
      const inviterName = inviterRes.data?.display_name || 'Birisi';
      const roomName = roomRes.data?.name || 'bir oda';

      // Bildirim gönder (zile düşsün)
      try {
        const { error: notifError } = await supabase.from('notifications').insert({
          user_id: invitedUserId,
          sender_id: invitedBy,
          type: 'room_invite',
          reference_id: roomId,
          body: `${inviterName} seni "${roomName}" odasına davet etti`,
        });
        if (notifError) {
          console.warn('[InviteUser] ⚠️ Bildirim insert HATASI:', notifError.message, notifError.details, notifError.hint);
        } else {
          console.log('[InviteUser] ✅ Bildirim başarıyla eklendi:', invitedUserId);
        }
      } catch (notifErr: any) {
        console.warn('[InviteUser] ⚠️ Bildirim insert EXCEPTION:', notifErr?.message);
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  /** Kullanıcının bu odaya geçerli daveti var mı? (pending veya accepted) */
  async _hasInvite(roomId: string, userId: string): Promise<boolean> {
    const { data } = await supabase
      .from('room_invites')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .in('status', ['pending', 'accepted'])
      .maybeSingle();
    return !!data;
  },

  /**
   * ★ Daveti kabul et — room_invites status güncelle + host'a bildirim gönder
   * Kabul eden kişi otomatik olarak odaya yönlendirilir (frontend tarafında).
   */
  async acceptInvite(roomId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // ★ 2026-04-19: Oda hâlâ aktif mi kontrol et — kapalı veya silinmiş odaya gitme
      const { data: roomRow } = await supabase
        .from('rooms')
        .select('id, is_live')
        .eq('id', roomId)
        .maybeSingle();
      if (!roomRow) {
        return { success: false, error: 'Bu oda artık mevcut değil' };
      }
      if (roomRow.is_live === false) {
        return { success: false, error: 'Bu oda şu anda aktif değil' };
      }

      // room_invites kaydını bul ve güncelle
      const { data: invite, error: findErr } = await supabase
        .from('room_invites')
        .select('id, invited_by')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .eq('status', 'pending')
        .maybeSingle();
      if (findErr || !invite) return { success: false, error: 'Davet bulunamadı' };

      await supabase
        .from('room_invites')
        .update({ status: 'accepted' })
        .eq('id', invite.id);

      // ★ Kabul eden kişinin profilini çek — bildirimde isim göstermek için
      const { data: acceptorProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', userId)
        .single();
      const acceptorName = acceptorProfile?.display_name || 'Birisi';

      // ★ Host'a bildirim gönder — "X daveti kabul etti"
      if (invite.invited_by) {
        try {
          await supabase.from('notifications').insert({
            user_id: invite.invited_by,
            sender_id: userId,
            type: 'room_invite_accepted',
            reference_id: roomId,
            body: `${acceptorName} oda davetini kabul etti 🎉`,
          });
        } catch { /* bildirim opsiyonel */ }
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  /**
   * ★ Daveti reddet — room_invites status güncelle + host'a bildirim gönder
   */
  async rejectInvite(roomId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // room_invites kaydını bul ve güncelle
      const { data: invite, error: findErr } = await supabase
        .from('room_invites')
        .select('id, invited_by')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .eq('status', 'pending')
        .maybeSingle();
      if (findErr || !invite) return { success: false, error: 'Davet bulunamadı' };

      await supabase
        .from('room_invites')
        .update({ status: 'declined' })
        .eq('id', invite.id);

      // ★ Reddeden kişinin profilini çek
      const { data: rejectorProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', userId)
        .single();
      const rejectorName = rejectorProfile?.display_name || 'Birisi';

      // ★ Host'a bildirim gönder — "X daveti reddetti"
      if (invite.invited_by) {
        try {
          await supabase.from('notifications').insert({
            user_id: invite.invited_by,
            sender_id: userId,
            type: 'room_invite_rejected',
            reference_id: roomId,
            body: `${rejectorName} oda davetini reddetti`,
          });
        } catch { /* bildirim opsiyonel */ }
      }

      // ★ İlgili bildirimi de sil (zilde kalmasın)
      try {
        await supabase.from('notifications')
          .delete()
          .eq('user_id', userId)
          .eq('type', 'room_invite')
          .eq('reference_id', roomId);
      } catch { /* temizlik opsiyonel */ }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  // ════════════════════════════════════════════════════════════
  // YARDIMCI FONKSİYONLAR
  // ════════════════════════════════════════════════════════════

  /** Kullanıcı, oda sahibiyle arkadaş mı? (çift yönlü — Facebook tarzı friendship) */
  async _isFriendWithHost(userId: string, hostId: string): Promise<boolean> {
    if (userId === hostId) return true; // Sahibin kendi odası
    const { data } = await supabase
      .from('friendships')
      .select('id')
      .or(`and(user_id.eq.${userId},friend_id.eq.${hostId}),and(user_id.eq.${hostId},friend_id.eq.${userId})`)
      .eq('status', 'accepted')
      .limit(1);
    return !!(data && data.length > 0);
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
