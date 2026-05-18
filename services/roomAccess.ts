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
import { i18n } from './i18n';

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
  action?: 'password_required' | 'request_sent' | 'invite_required' | 'upsell' | 'age_restricted' | 'language_restricted' | 'language_mismatch' | 'followers_only' | 'banned' | 'room_locked' | 'room_full';
  /** ★ 2026-04-20: language_mismatch soft warning için oda ve kullanıcı dili */
  roomLanguage?: string;
  userLanguage?: string;
  /** ★ v1.7.13: Geçici ban — kalan süre UI'da countdown olarak gösterilir. Kalıcı ban → null. */
  banExpiresAt?: string | null;
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
    /** ★ 2026-04-20: Kullanıcı dil uyarısını "Katıl" ile geçtiyse dil kontrolü atlanır */
    skipLanguageCheck?: boolean,
  ): Promise<AccessCheckResult> {
    const roomId = room.id!;
    const settings = (room.room_settings || {}) as RoomSettings;

    // ── 0. Host & Admin bypass — oda sahibi ve adminler her zaman girebilir ──
    const isHost = room.host_id === userId;
    const isOriginalHost = settings.original_host_id === userId;
    if (isHost || isOriginalHost) {
      return { allowed: true };
    }

    // ★ GodMaster bypass — sistemin tanrısı tüm odaları geçer
    // Ban, kilit, şifre, kapasite, dil/yaş filtresi — hiçbiri GodMaster'ı durduramaz.
    const { isGodMaster: _isGM } = require('../constants/tiers');
    if (_isGM(userTier)) {
      return { allowed: true };
    }
    // Admin bypass ayrı kontrol edilir (profiles tablosunda is_admin)

    // ── 1. Ban kontrolü ──
    // ★ v1.7.13: getBanStatus expires_at döndürüyor — UI countdown için.
    const banStatus = await ModerationService.getBanStatus(roomId, userId);
    if (banStatus.banned) {
      return {
        allowed: false,
        reason: i18n.t('auto.roomAccess.022'),
        action: 'banned',
        banExpiresAt: banStatus.expiresAt,
      };
    }

    // ── 2. Oda kilidi kontrolü ──
    if (settings.is_locked) {
      return { allowed: false, reason: i18n.t('auto.roomAccess.021'), action: 'room_locked' };
    }

    // ── 3. Sadece arkadaşlar modu kontrolü (Plus+) ──
    // ★ 2026-04-18: friendship çift yönlü — (A,B) veya (B,A) accepted ise erişim verilir
    if (settings.followers_only) {
      const isFriend = await this._isFriendWithHost(userId, room.host_id!);
      if (!isFriend) {
        return {
          allowed: false,
          reason: i18n.t('auto.roomAccess.020'),
          action: 'followers_only',
        };
      }
    }

    // ── 4. Yaş filtresi kontrolü (Plus+) ──
    // age_restricted boolean desteği: true ise age_filter_min yoksa 18 olarak kabul et
    const ageFilterMin = settings.age_filter_min || ((settings as any).age_restricted === true ? 18 : 0);
    if (ageFilterMin > 0) {
      // ★ Faz 2.3 — Server-side day-precise yaş kontrolü.
      //   Önceki client-side hesap (userAge prop) bypass'lanabilir; RPC
      //   profiles.birth_date'i SECURITY DEFINER ile direkt sorar.
      let serverAllowed: boolean | null = null;
      try {
        const { data, error } = await supabase.rpc('user_meets_age_requirement', {
          p_user_id: userId,
          p_min_age: ageFilterMin,
        });
        if (!error) serverAllowed = !!data;
      } catch { /* RPC yoksa client-side fallback */ }

      if (serverAllowed === false) {
        return {
          allowed: false,
          reason: i18n.t('auto.roomAccess.019', { 0: ageFilterMin }),
          action: 'age_restricted',
        };
      }
      // RPC yoksa veya sunucuya ulaşılamadıysa — client-side fallback (mevcut davranış)
      if (serverAllowed === null) {
        if (!userAge || userAge < ageFilterMin) {
          return {
            allowed: false,
            reason: i18n.t('auto.roomAccess.018', { 0: ageFilterMin }),
            action: 'age_restricted',
          };
        }
      }
    }

    // ── 5. Dil uyuşmazlığı kontrolü — SOFT warning (Opsiyon E) ──
    // ★ 2026-04-20: Hard block yerine soft warning.
    //   room_language (single) vs userLanguage karşılaştırılır; uyuşmuyorsa
    //   'language_mismatch' aksiyonu döner — UI kullanıcıya onay modal'ı gösterir,
    //   kullanıcı yine de katılabilir.
    //   Eski language_filter (array, UI hiç set etmiyordu) kaldırıldı.
    const roomLang = settings.room_language;
    if (!skipLanguageCheck && roomLang && userLanguage && roomLang !== userLanguage) {
      return {
        allowed: false,
        reason: i18n.t('auto.roomAccess.017'),
        action: 'language_mismatch',
        roomLanguage: roomLang,
        userLanguage,
      };
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
    //
    // ★ 2026-04-27 FIX: Audience 'password' DEĞİLSE şifreyi yoksay.
    //   Eski rooms.room_password column'unda hash kalmış olabilir; sahibi UI'dan
    //   "Şifreli" modunu kapatınca şifresiz oda olmalı. Daha önce column öncelikli
    //   okunuyordu → +18 yaş filtresi koyan kullanıcı şifre soruyor görüyordu.
    //   Şimdi: settings.room_password explicit null ise column'u yoksay.
    const settingsPwd = (settings as any).room_password;
    const settingsHasExplicitNull = settingsPwd === null || settingsPwd === '';
    const storedPassword = settingsHasExplicitNull ? null : (settingsPwd || room.room_password);
    if (storedPassword && (roomType === 'open' || roomType === 'closed')) {
      // Önce davet kontrolü — kabul edilmişse şifre atlanır
      const hasAcceptedInvite = await this._hasInvite(roomId, userId);
      if (!hasAcceptedInvite) {
        if (!enteredPassword) {
          return { allowed: false, reason: i18n.t('auto.roomAccess.016'), action: 'password_required' };
        }
        const passwordMatch = await verifyPassword(enteredPassword, storedPassword);
        if (!passwordMatch) {
          return { allowed: false, reason: i18n.t('auto.roomAccess.015') };
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
      // Davetli oda
      const hasInvite = await this._hasInvite(roomId, userId);
      if (hasInvite) {
        return this._checkCapacity(room, userId);
      }
      // ★ 2026-04-20 FIX: Önceden checkAccess içinden otomatik _sendAccessRequest
      //   çağrılıyordu → kullanıcı yanlışlıkla bastığında istek DB'ye düşüyordu.
      //   Şimdi sadece 'invite_required' döneriz; UI kullanıcıdan onay alır, sonra
      //   sendAccessRequest() açıkça çağrılır.
      return { allowed: false, reason: i18n.t('auto.roomAccess.014'), action: 'invite_required' };
    }

    // Bilinmeyen tip → izin ver
    return { allowed: true };
  },

  /**
   * ★ 2026-04-26: Tüm "hard-block"ları (geçilemez engelleri) topla.
   *   checkAccess sadece ilk fail eden engeli döner; UI multi-reason göstermek için
   *   bu yardımcı kullanır. Soft-block'lar (password/invite) — kullanıcı geçebilir,
   *   bunları topu içermez.
   *
   *   Hard-block'lar: banned, room_locked, age_restricted, followers_only.
   */
  async getHardBlockers(
    room: Partial<Room>,
    userId: string,
    userTier: SubscriptionTier = 'Free',
    userAge?: number | null,
  ): Promise<{ action: string; reason: string }[]> {
    const blockers: { action: string; reason: string }[] = [];
    const settings = (room.room_settings || {}) as RoomSettings;

    // Host/admin/GodMaster bypass — engel yok
    if (room.host_id === userId || (settings as any).original_host_id === userId) return [];
    const { isGodMaster: _isGM } = require('../constants/tiers');
    if (_isGM(userTier)) return [];

    // Banned
    try {
      const isBanned = await ModerationService.isRoomBanned(room.id!, userId);
      if (isBanned) blockers.push({ action: 'banned', reason: i18n.t('auto.roomAccess.013') });
    } catch {}

    // Locked
    if (settings.is_locked) {
      blockers.push({ action: 'room_locked', reason: i18n.t('auto.roomAccess.012') });
    }

    // Followers-only
    if (settings.followers_only && room.host_id) {
      try {
        const isFriend = await this._isFriendWithHost(userId, room.host_id);
        if (!isFriend) blockers.push({ action: 'followers_only', reason: i18n.t('auto.roomAccess.011') });
      } catch {}
    }

    // Age
    const ageFilterMin = settings.age_filter_min || ((settings as any).age_restricted === true ? 18 : 0);
    if (ageFilterMin > 0) {
      let serverAllowed: boolean | null = null;
      try {
        const { data, error } = await supabase.rpc('user_meets_age_requirement', {
          p_user_id: userId,
          p_min_age: ageFilterMin,
        });
        if (!error) serverAllowed = !!data;
      } catch {}
      const allowed = serverAllowed !== null ? serverAllowed : (userAge != null && userAge >= ageFilterMin);
      if (!allowed) blockers.push({ action: 'age_restricted', reason: i18n.t('auto.roomAccess.010', { 0: ageFilterMin }) });
    }

    return blockers;
  },

  // ════════════════════════════════════════════════════════════
  // ERİŞİM İSTEĞİ ZİNCİRİ
  // ════════════════════════════════════════════════════════════

  /**
   * Public wrapper — UI onay modal'ından sonra çağrılır.
   * Kullanıcı "istek gönder"i onaylarsa bu çalışır.
   */
  async sendAccessRequest(roomId: string, userId: string): Promise<void> {
    return this._sendAccessRequest(roomId, userId);
  },

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
      throw new Error(i18n.t('auto.roomAccess.009'));
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

    // ★ v92.16 (1 May 2026): Önceden upsert({onConflict: 'room_id,user_id'}) kullanılıyordu
    //   ama tabloda o composite UNIQUE constraint yoktu → hata: "there is no unique or
    //   exclusion constraint matching the ON CONFLICT specification". Constraint v92.16
    //   migration ile eklendi, ama PostgREST schema cache geç güncellendiği için
    //   yine de DELETE+INSERT pattern'ine geçtik — schema cache'e bağlı değil.
    await supabase
      .from('room_access_requests')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', userId);

    const { error: insertError } = await supabase
      .from('room_access_requests')
      .insert({
        room_id: roomId,
        user_id: userId,
        status: 'pending',
        target_role: targetRole,
      });

    if (insertError) {
      throw new Error(i18n.t('auto.roomAccess.008') + (insertError.message || 'bilinmeyen hata') + (insertError.code ? ` (${insertError.code})` : ''));
    }

    // ★ İstekçinin profil bilgisini çek
    const { data: requesterProfile } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', userId)
      .single();
    const requesterName = requesterProfile?.display_name || 'Birisi';

    // ★ v92.12 (1 May 2026): notifications.insert KALDIRILDI (kullanıcı talebi).
    //   Zil bildirimi + toast yerine PlusMenu içindeki "Katılım İstekleri" accordion
    //   bu isteği room_access_requests tablosundan otomatik çeker. Tab bar + button
    //   badge'i sayıyı gösterir. Sade, spam yok.
    //   requesterName değişkeni kullanılmıyor artık ama upsert öncesinde profile
    //   sorgusu future-proof — gelecekte broadcast event'i için lazım olabilir.
    void requesterName;
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
  async getPendingRequests(roomId: string, callerId?: string) {
    // ★ v92.20 (1 May 2026): SECURITY DEFINER RPC kullanılıyor — RLS app_uid()
    //   Firebase JWT'sinden host_id eşleşmesi sağlayamıyordu, host "Bekleyen istek yok"
    //   görüyor ama DB'de pending kayıt vardı. RPC içinde server-side host/mod kontrolü.
    if (callerId) {
      const { data, error } = await supabase.rpc('get_pending_access_requests', {
        p_room_id: roomId,
        p_caller_id: callerId,
      });
      if (error) {
        if (__DEV__) console.warn('[Access] RPC error:', error.message);
        return [];
      }
      // RPC dönüşünü mevcut shape'e adapte: user_display_name → user.display_name
      return (data || []).map((row: any) => ({
        id: row.id,
        room_id: row.room_id,
        user_id: row.user_id,
        status: row.status,
        target_role: row.target_role,
        created_at: row.created_at,
        user: {
          id: row.user_id,
          display_name: row.user_display_name,
          avatar_url: row.user_avatar_url,
        },
      }));
    }
    // Backward compat (callerId yoksa eski yol)
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

  /**
   * Kullanıcıyı odaya davet et.
   * @param _cache — Opsiyonel: Toplu davet sırasında her çağrıda profil/oda adı
   *   tekrar DB'den çekmemek için dışarıdan verilir. İlk çağrıda fetch edilip
   *   sonraki çağrılara geçirilir. ★ PERF FIX: 5 kişi × 2 sorgu = 10 gereksiz
   *   DB round-trip eliminasyonu.
   */
  async inviteUser(
    roomId: string,
    invitedUserId: string,
    invitedBy: string,
    _cache?: { inviterName?: string; roomName?: string },
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.from('room_invites').upsert({
        room_id: roomId,
        user_id: invitedUserId,
        invited_by: invitedBy,
        status: 'pending', // ★ Tekrar davet edildiğinde 'declined' → 'pending' sıfırla
      }, { onConflict: 'room_id,user_id' });
      if (error) throw error;

      // ★ PERF FIX: Cache varsa DB sorgusu atla — toplu davette dramatik hız kazanımı
      let inviterName = _cache?.inviterName;
      let roomName = _cache?.roomName;
      if (!inviterName || !roomName) {
        const [inviterRes, roomRes] = await Promise.all([
          !inviterName ? supabase.from('profiles').select('display_name').eq('id', invitedBy).single() : null,
          !roomName ? supabase.from('rooms').select('name').eq('id', roomId).single() : null,
        ]);
        if (!inviterName) inviterName = inviterRes?.data?.display_name || 'Birisi';
        if (!roomName) roomName = roomRes?.data?.name || 'bir oda';
      }

      // Bildirim gönder (zile düşsün)
      try {
        const { error: notifError } = await supabase.from('notifications').insert({
          user_id: invitedUserId,
          sender_id: invitedBy,
          type: 'room_invite',
          reference_id: roomId,
          body: i18n.t('auto.roomAccess.007', { 0: inviterName, 1: roomName }),
        });
        if (notifError && __DEV__) {
          console.warn('[InviteUser] Bildirim insert hatası:', notifError.message, notifError.details);
        }
      } catch (notifErr: any) {
        if (__DEV__) console.warn('[InviteUser] Bildirim insert exception:', notifErr?.message);
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
        return { success: false, error: i18n.t('auto.roomAccess.006') };
      }
      if (roomRow.is_live === false) {
        return { success: false, error: i18n.t('auto.roomAccess.005') };
      }

      // room_invites kaydını bul ve güncelle
      const { data: invite, error: findErr } = await supabase
        .from('room_invites')
        .select('id, invited_by')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .eq('status', 'pending')
        .maybeSingle();
      if (findErr || !invite) return { success: false, error: i18n.t('auto.roomAccess.004') };

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
      if (findErr || !invite) return { success: false, error: i18n.t('auto.roomAccess.003') };

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
        reason: i18n.t('auto.roomAccess.002'),
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
    const shareText = i18n.t('auto.roomAccess.001', { 0: name, 1: webLink });
    return { deepLink, webLink, shareText };
  },

  /**
   * Arkadaş listesinden toplu davet gönder.
   * ★ PERF FIX: Sıralı → paralel, profil/oda adı cache ile tek seferlik fetch.
   * @param friendIds - Davet edilecek kullanıcı ID'leri
   * @returns Başarılı davet sayısı
   */
  async inviteFriends(
    roomId: string,
    friendIds: string[],
    invitedBy: string,
  ): Promise<{ successCount: number; failedCount: number }> {
    // Önce inviter adı ve oda adını tek seferde çek — tüm çağrılara cache olarak geçir
    const [inviterRes, roomRes] = await Promise.all([
      supabase.from('profiles').select('display_name').eq('id', invitedBy).single(),
      supabase.from('rooms').select('name').eq('id', roomId).single(),
    ]);
    const cache = {
      inviterName: inviterRes.data?.display_name || 'Birisi',
      roomName: roomRes.data?.name || 'bir oda',
    };

    const results = await Promise.allSettled(
      friendIds.map(friendId => this.inviteUser(roomId, friendId, invitedBy, cache))
    );

    let successCount = 0;
    let failedCount = 0;
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.success) successCount++;
      else failedCount++;
    }

    return { successCount, failedCount };
  },
};
