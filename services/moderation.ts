/**
 * SopranoChat — Moderasyon Servis Katmanı
 * ═══════════════════════════════════════════════════
 * Raporlama, Engelleme, Oda Susturma, Ban,
 * Oda İsmi/Hoş Geldin Düzenleme.
 * Ghost Mode, Lock, Filters vb. RoomService’e taşındı.
 */
import { logger } from '../utils/logger';
import { supabase } from '../constants/supabase';
import { filterBadWords, containsBadWords } from '../constants/badwords';

export type ReportReason =
  | 'spam' | 'harassment' | 'hate_speech' | 'inappropriate_content'
  | 'impersonation' | 'self_harm' | 'violence' | 'underage' | 'other';

export const ModerationService = {
  // ==========================================
  // RAPORLAMA
  // ==========================================

  /**
   * ★ SEC-5: Rate limiting — kullanıcı başına max 5 rapor/saat
   * Report flooding ve admin spam'i önler.
   */
  async _checkReportRateLimit(reporterId: string): Promise<void> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .eq('reporter_id', reporterId)
      .gte('created_at', oneHourAgo);
    if ((count || 0) >= 5) {
      throw new Error('Çok fazla şikayet gönderdiniz. Lütfen 1 saat sonra tekrar deneyin.');
    }
  },

  /** Admin kullanıcıları DB'den çek (profiles.is_admin = true) */
  async _getAdminIds(): Promise<string[]> {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('is_admin', true);
    return (data || []).map(d => d.id);
  },

  async reportUser(reporterId: string, reportedUserId: string, reason: ReportReason, description?: string) {
    await this._checkReportRateLimit(reporterId); // ★ SEC-5
    const { error } = await supabase.from('reports').insert({
      reporter_id: reporterId,
      reported_user_id: reportedUserId,
      reason,
      description: (description || '').slice(0, 500) || null, // ★ SEC-8: Max 500 char
      status: 'pending',
    });
    if (error) throw error;

    // Admin'e bildirim gönder
    this._notifyAdmins(reporterId, reason, 'user').catch(e => logger.warn('Admin bildirim hatası:', e));
    return true;
  },

  async reportRoom(reporterId: string, roomId: string, reason: ReportReason, description?: string) {
    await this._checkReportRateLimit(reporterId); // ★ SEC-5
    const { error } = await supabase.from('reports').insert({
      reporter_id: reporterId,
      reported_room_id: roomId,
      reason,
      description: (description || '').slice(0, 500) || null, // ★ SEC-8: Max 500 char
      status: 'pending',
    });
    if (error) throw error;

    this._notifyAdmins(reporterId, reason, 'room').catch(e => logger.warn('Admin bildirim hatası:', e));
    return true;
  },

  async reportPost(reporterId: string, postId: string, reason: ReportReason, description?: string) {
    await this._checkReportRateLimit(reporterId); // ★ SEC-5
    const { error } = await supabase.from('reports').insert({
      reporter_id: reporterId,
      reported_post_id: postId,
      reason,
      description: (description || '').slice(0, 500) || null, // ★ SEC-8
      status: 'pending',
    });
    if (error) throw error;

    // ★ BUG-C3 FIX: Admin bildirimi eklendi
    this._notifyAdmins(reporterId, reason, 'post').catch(e => logger.warn('Admin bildirim hatası:', e));
    return true;
  },

  async reportMessage(reporterId: string, messageId: string, reason: ReportReason, description?: string) {
    await this._checkReportRateLimit(reporterId); // ★ SEC-5
    const { error } = await supabase.from('reports').insert({
      reporter_id: reporterId,
      reported_message_id: messageId,
      reason,
      description: (description || '').slice(0, 500) || null, // ★ SEC-8
      status: 'pending',
    });
    if (error) throw error;

    // ★ BUG-C3 FIX: Admin bildirimi eklendi
    this._notifyAdmins(reporterId, reason, 'message').catch(e => logger.warn('Admin bildirim hatası:', e));
    return true;
  },

  // ==========================================
  // ADMİN ŞİKAYET YÖNETİMİ
  // ==========================================

  /** Bekleyen şikayetleri getir (admin panel / Supabase dashboard) */
  async getPendingReports(limit = 50) {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  /** Şikayeti çözümle (dismissed / warned / banned) */
  async resolveReport(reportId: string, action: 'dismissed' | 'warned' | 'banned') {
    const { error } = await supabase
      .from('reports')
      .update({ status: action, resolved_at: new Date().toISOString() })
      .eq('id', reportId);
    if (error) throw error;
    return true;
  },

  /** Toplam bekleyen şikayet sayısı */
  async getPendingCount(): Promise<number> {
    const { count, error } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    if (error) return 0;
    return count || 0;
  },

  /** Admin'lere inbox bildirimi gönder */
  async _notifyAdmins(reporterId: string, reason: string, type: string) {
    const adminIds = await this._getAdminIds();
    if (adminIds.length === 0) return;

    const { data: reporter } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', reporterId)
      .single();

    const REASON_TR: Record<string, string> = {
      spam: 'Spam',
      harassment: 'Taciz',
      hate_speech: 'Nefret Söylemi',
      inappropriate_content: 'Uygunsuz İçerik',
      impersonation: 'Kimliğe Bürünme',
      self_harm: 'Kendine Zarar',
      violence: 'Şiddet',
      underage: 'Reşit Olmayan',
      other: 'Diğer',
    };

    const targetText = type === 'user' ? 'kullanıcıyı' : type === 'room' ? 'odayı' : 'gönderiyi';
    const body = `${reporter?.display_name || 'Bir kullanıcı'} bir ${targetText} "${REASON_TR[reason] || reason}" nedeniyle şikayet etti.`;

    for (const adminId of adminIds) {
      try {
        // ★ SEC-ADMIN: notifications tablosunu kullan (inbox değil — uygulama notifications'dan okuyor)
        await supabase.from('notifications').insert({
          user_id: adminId,
          sender_id: reporterId,
          type: 'admin_report',
          body,
        });
      } catch { /* admin bildirim hatası sessizce yoksay */ }
    }
  },

  // ==========================================
  // ENGELLEME
  // ==========================================

  async blockUser(blockerId: string, blockedId: string) {
    const { error } = await supabase
      .from('blocked_users')
      .upsert({ blocker_id: blockerId, blocked_id: blockedId }, { onConflict: 'blocker_id,blocked_id' });
    if (error) throw error;
    return true;
  },

  async unblockUser(blockerId: string, blockedId: string) {
    const { error } = await supabase
      .from('blocked_users')
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedId);
    if (error) throw error;
    return true;
  },

  async getBlockedUsers(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('blocked_users')
      .select('blocked_id')
      .eq('blocker_id', userId);
    if (error) throw error;
    return (data || []).map(d => d.blocked_id);
  },

  async isBlocked(userId: string, targetId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('blocked_users')
      .select('id')
      .eq('blocker_id', userId)
      .eq('blocked_id', targetId)
      .maybeSingle();
    if (error) return false;
    return !!data;
  },

  // ==========================================
  // ODA SUSTURMA
  // ==========================================

  async muteInRoom(roomId: string, mutedUserId: string, mutedBy: string, reason?: string, durationMinutes?: number) {
    const expiresAt = durationMinutes
      ? new Date(Date.now() + durationMinutes * 60 * 1000).toISOString()
      : null;

    const { error } = await supabase
      .from('room_mutes')
      .upsert({
        room_id: roomId,
        muted_user_id: mutedUserId,
        muted_by: mutedBy,
        reason: reason || null,
        expires_at: expiresAt,
      }, { onConflict: 'room_id,muted_user_id' });
    if (error) throw error;

    // ★ Y19 FIX: room_participants.is_muted'i de sync et — reconnect / broadcast kayıp
    // durumlarında bile listener_grid doğru mute badge'i göstersin, target's join flow
    // mic'i default kapalı başlatsın.
    try {
      await supabase
        .from('room_participants')
        .update({ is_muted: true })
        .eq('room_id', roomId)
        .eq('user_id', mutedUserId);
    } catch { /* row yoksa / RLS engel sessiz */ }

    return true;
  },

  async unmuteInRoom(roomId: string, mutedUserId: string) {
    const { error } = await supabase
      .from('room_mutes')
      .delete()
      .eq('room_id', roomId)
      .eq('muted_user_id', mutedUserId);
    if (error) throw error;

    // ★ Y19 FIX: room_participants.is_muted'i de sıfırla
    try {
      await supabase
        .from('room_participants')
        .update({ is_muted: false })
        .eq('room_id', roomId)
        .eq('user_id', mutedUserId);
    } catch { /* sessiz */ }

    return true;
  },

  async isRoomMuted(roomId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('room_mutes')
      .select('id, expires_at')
      .eq('room_id', roomId)
      .eq('muted_user_id', userId)
      .maybeSingle();

    if (error || !data) return false;

    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      await this.unmuteInRoom(roomId, userId);
      return false;
    }
    return true;
  },

  // ==========================================
  // KELİME FİLTRESİ (Re-export)
  // ==========================================
  filterBadWords,
  containsBadWords,

  // ==========================================
  // ODA BAN SİSTEMİ
  // ==========================================

  /**
   * Kullanıcıyı odadan banla.
   * duration: '15m' | '1h' | '24h' | 'permanent'
   */
  async banFromRoom(
    roomId: string,
    targetUserId: string,
    bannedBy: string,
    duration: '15m' | '1h' | '24h' | 'permanent' = 'permanent',
    reason?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Süre hesapla
      const DURATION_MS: Record<string, number> = {
        '15m': 15 * 60 * 1000,
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
      };
      const expiresAt = duration === 'permanent'
        ? null
        : new Date(Date.now() + DURATION_MS[duration]).toISOString();

      // room_bans tablosuna kaydet
      const { error } = await supabase
        .from('room_bans')
        .upsert({
          room_id: roomId,
          user_id: targetUserId,
          banned_by: bannedBy,
          ban_type: duration === 'permanent' ? 'permanent' : 'temporary',
          reason: reason || null,
          duration,
          expires_at: expiresAt,
        }, { onConflict: 'room_id,user_id' });
      if (error) throw error;

      // Banneden önce rolü oku — sadece listener/spectator ise sayacı azalt
      const { data: partData } = await supabase
        .from('room_participants')
        .select('role')
        .eq('room_id', roomId)
        .eq('user_id', targetUserId)
        .maybeSingle();

      // Katılımcıyı odadan sil
      await supabase
        .from('room_participants')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', targetUserId);

      // Listener count sadece listener/spectator rolleri için azalt
      if (partData?.role === 'listener' || partData?.role === 'spectator') {
        const { error: rpcErr } = await supabase.rpc('decrement_listener_count', { room_id_input: roomId });
        if (rpcErr && __DEV__) console.warn('[Moderation] decrement_listener_count hatası:', rpcErr.message);
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  /** Oda banını kaldır */
  async unbanFromRoom(roomId: string, targetUserId: string, executorId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      // ★ v45 (2026-04-20): Atomic RPC — DELETE RLS auth'a bağlı, header override
      //   yeterli değil. RPC SECURITY DEFINER + executor_id fallback ile çalışır.
      const { error } = await supabase.rpc('unban_user_atomic', {
        p_room_id: roomId,
        p_user_id: targetUserId,
        p_executor_id: executorId || null,
      });
      if (!error) return { success: true };
      // RPC yoksa legacy fallback
      if (/function .* does not exist|42883/i.test(error.message || '')) {
        const { error: delErr } = await supabase
          .from('room_bans')
          .delete()
          .eq('room_id', roomId)
          .eq('user_id', targetUserId);
        if (delErr) throw delErr;
        return { success: true };
      }
      return { success: false, error: error.message };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  /** Kullanıcı bu odada banlı mı? (süresi dolmuşsa otomatik temizler) */
  async isRoomBanned(roomId: string, userId: string): Promise<boolean> {
    const { data } = await supabase
      .from('room_bans')
      .select('id, expires_at')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!data) return false;

    // Süresi dolduysa otomatik kaldır
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      await this.unbanFromRoom(roomId, userId);
      return false;
    }
    return true;
  },

  /** Odanın banlı kullanıcı listesi — banlanan kullanıcı + banı atan kişi */
  async getRoomBans(roomId: string) {
    const { data, error } = await supabase
      .from('room_bans')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false });
    if (error || !data || data.length === 0) return [];

    // ★ 2026-04-20: Banlanan + banı atan profilleri birlikte çek — UI'da "X tarafından"
    const allIds = [
      ...new Set([
        ...data.map((b: any) => b.user_id),
        ...data.map((b: any) => b.banned_by).filter(Boolean),
      ]),
    ];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', allIds);
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

    return data.map((ban: any) => ({
      ...ban,
      user: profileMap.get(ban.user_id) || { id: ban.user_id, display_name: 'Kullanıcı', avatar_url: null },
      banned_by_user: ban.banned_by ? profileMap.get(ban.banned_by) || { id: ban.banned_by, display_name: 'Yetkili', avatar_url: null } : null,
    }));
  },

  /** Odanın susturulan kullanıcı listesi */
  async getRoomMutes(roomId: string) {
    const { data, error } = await supabase
      .from('room_mutes')
      .select('*, user:profiles!muted_user_id(id, display_name, avatar_url)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false });
    if (error) return [];
    // Süresi dolmuşları filtrele
    const now = new Date();
    return (data || []).filter((m: any) => {
      if (m.expires_at && new Date(m.expires_at) < now) return false;
      return true;
    });
  },


  // ==========================================
  // ★ KALDIRILDI: Aşağıdaki fonksiyonlar RoomService'e taşındı.
  // Ghost Mode      → RoomService.setGhostMode()
  // Disguise        → RoomService.setDisguise()
  // Slow Mode       → RoomService.updateSettings() ile room_settings
  // Room Lock       → RoomService.setRoomLock()
  // Followers Only  → RoomService.updateSettings() ile room_settings
  // Age/Lang Filter → RoomService.updateSettings() ile room_settings
  // Stage Layout    → RoomService.updateSettings() ile room_settings
  // Room Music      → RoomService.updateSettings() ile room_settings
  // Edit Room Name  → ModerationService.editRoomName (aşağıda korunuyor)
  // Edit Welcome    → ModerationService.editWelcomeMessage (aşağıda korunuyor)
  // ==========================================

  // ==========================================
  // ODA İSMİ DÜZENLEME (korunuyor — moderation yetki kapsamında)
  // ==========================================

  /** Oda ismini düzenle — ★ SEC-8: Input validation + ★ Y5 FIX: Yetki kontrolü */
  async editRoomName(roomId: string, newName: string, executorId?: string): Promise<void> {
    // ★ Y5 FIX: Yetki kontrolü — sadece host veya moderatör değiştirebilir
    if (executorId) {
      const { data: room } = await supabase.from('rooms').select('host_id').eq('id', roomId).single();
      if (!room || room.host_id !== executorId) {
        const { data: part } = await supabase.from('room_participants').select('role').eq('room_id', roomId).eq('user_id', executorId).maybeSingle();
        if (!part || !['owner', 'moderator'].includes(part.role)) {
          throw new Error('Bu işlem için yetkiniz yok.');
        }
      }
    }
    // ★ SEC-8: Max 60 karakter, HTML/script tag strip
    const sanitized = (newName || '').trim().replace(/<[^>]*>/g, '').slice(0, 60);
    if (sanitized.length < 1) throw new Error('Oda ismi boş olamaz');
    await supabase
      .from('rooms')
      .update({ name: sanitized })
      .eq('id', roomId);
  },

  // ==========================================
  // HOŞ GELDİN MESAJI DÜZENLEME (korunuyor — moderation yetki kapsamında)
  // ==========================================

  /** Hoş geldin mesajını düzenle — ★ SEC-8: Input validation + ★ Y5 FIX: Yetki kontrolü */
  async editWelcomeMessage(roomId: string, message: string, executorId?: string): Promise<void> {
    // ★ SEC-8: Max 500 karakter, HTML/script tag strip
    const sanitized = (message || '').trim().replace(/<[^>]*>/g, '').slice(0, 500);
    const { data: room } = await supabase
      .from('rooms')
      .select('room_settings, host_id')
      .eq('id', roomId)
      .single();
    // ★ Y5 FIX: Yetki kontrolü — sadece host veya moderatör değiştirebilir
    if (executorId && room && room.host_id !== executorId) {
      const { data: part } = await supabase.from('room_participants').select('role').eq('room_id', roomId).eq('user_id', executorId).maybeSingle();
      if (!part || !['owner', 'moderator'].includes(part.role)) {
        throw new Error('Bu işlem için yetkiniz yok.');
      }
    }
    const settings = (room?.room_settings || {}) as any;
    await supabase
      .from('rooms')
      .update({ room_settings: { ...settings, welcome_message: sanitized } })
      .eq('id', roomId);
  },
};
