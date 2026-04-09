/**
 * SopranoChat — Moderasyon Servis Katmanı
 * ═══════════════════════════════════════════════════
 * Raporlama, Engelleme, Oda Susturma, Ban, Ghost Mode, Disguise,
 * Slow Mode, Kick, Room Lock, Followers-Only, Age/Language Filters,
 * Stage Layout, Room Music, Edit Room Name/Welcome Message
 */
import { supabase } from '../constants/supabase';
import { filterBadWords, containsBadWords } from '../constants/badwords';
import type { RoomLanguage, StageLayout, RoomMusicConfig, RoomSettings } from '../types';

export type ReportReason =
  | 'spam' | 'harassment' | 'hate_speech' | 'inappropriate_content'
  | 'impersonation' | 'self_harm' | 'violence' | 'underage' | 'other';

export const ModerationService = {
  // ==========================================
  // RAPORLAMA
  // ==========================================

  /** Admin kullanıcıları DB'den çek (profiles.is_admin = true) */
  async _getAdminIds(): Promise<string[]> {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('is_admin', true);
    return (data || []).map(d => d.id);
  },

  async reportUser(reporterId: string, reportedUserId: string, reason: ReportReason, description?: string) {
    const { error } = await supabase.from('reports').insert({
      reporter_id: reporterId,
      reported_user_id: reportedUserId,
      reason,
      description: description || null,
      status: 'pending',
    });
    if (error) throw error;

    // Admin'e bildirim gönder
    this._notifyAdmins(reporterId, reason, 'user').catch(e => console.warn('Admin bildirim hatası:', e));
    return true;
  },

  async reportRoom(reporterId: string, roomId: string, reason: ReportReason, description?: string) {
    const { error } = await supabase.from('reports').insert({
      reporter_id: reporterId,
      reported_room_id: roomId,
      reason,
      description: description || null,
      status: 'pending',
    });
    if (error) throw error;

    this._notifyAdmins(reporterId, reason, 'room').catch(e => console.warn('Admin bildirim hatası:', e));
    return true;
  },

  async reportPost(reporterId: string, postId: string, reason: ReportReason, description?: string) {
    const { error } = await supabase.from('reports').insert({
      reporter_id: reporterId,
      reported_post_id: postId,
      reason,
      description: description || null,
      status: 'pending',
    });
    if (error) throw error;
    return true;
  },

  async reportMessage(reporterId: string, messageId: string, reason: ReportReason, description?: string) {
    const { error } = await supabase.from('reports').insert({
      reporter_id: reporterId,
      reported_message_id: messageId,
      reason,
      description: description || null,
      status: 'pending',
    });
    if (error) throw error;
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
        await supabase.from('inbox').insert({
          user_id: adminId,
          type: 'system',
          title: 'Yeni Şikayet',
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
    return true;
  },

  async unmuteInRoom(roomId: string, mutedUserId: string) {
    const { error } = await supabase
      .from('room_mutes')
      .delete()
      .eq('room_id', roomId)
      .eq('muted_user_id', mutedUserId);
    if (error) throw error;
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
          reason: reason || null,
          duration,
          expires_at: expiresAt,
        }, { onConflict: 'room_id,user_id' });
      if (error) throw error;

      // Katılımcı rolünü 'banned' yap
      await supabase
        .from('room_participants')
        .update({ role: 'banned' })
        .eq('room_id', roomId)
        .eq('user_id', targetUserId);

      // Katılımcıyı odadan sil
      await supabase
        .from('room_participants')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', targetUserId);

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  /** Oda banını kaldır */
  async unbanFromRoom(roomId: string, targetUserId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('room_bans')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', targetUserId);
      if (error) throw error;
      return { success: true };
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

  /** Odanın banlı kullanıcı listesi */
  async getRoomBans(roomId: string) {
    const { data, error } = await supabase
      .from('room_bans')
      .select('*, user:profiles!user_id(id, display_name, avatar_url)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false });
    if (error) return [];
    return data || [];
  },

  // ==========================================
  // GHOST MODE (Owner Görünmezlik — VIP)
  // ==========================================

  /**
   * Owner'ı odada görünmez yap / göster.
   * Ghost mode'da katılımcı listesinde gözükmez.
   */
  async setGhostMode(roomId: string, userId: string, enabled: boolean): Promise<void> {
    await supabase
      .from('room_participants')
      .update({ is_ghost: enabled })
      .eq('room_id', roomId)
      .eq('user_id', userId);
  },

  // ==========================================
  // DISGUISE (Kılık Değiştirme — VIP)
  // ==========================================

  /**
   * Hedef kullanıcının oda içi görüntüsünü geçici olarak değiştir.
   * Sadece owner tarafından uygulanabilir.
   */
  async disguiseUser(
    roomId: string,
    targetUserId: string,
    appliedBy: string,
    displayName: string,
    avatarUrl: string,
  ): Promise<void> {
    const disguise = {
      display_name: displayName,
      avatar_url: avatarUrl,
      applied_by: appliedBy,
      applied_at: new Date().toISOString(),
    };
    await supabase
      .from('room_participants')
      .update({ disguise })
      .eq('room_id', roomId)
      .eq('user_id', targetUserId);
  },

  /** Kılık değiştirmeyi kaldır */
  async removeDisguise(roomId: string, targetUserId: string): Promise<void> {
    await supabase
      .from('room_participants')
      .update({ disguise: null })
      .eq('room_id', roomId)
      .eq('user_id', targetUserId);
  },

  // ==========================================
  // SLOW MODE
  // ==========================================

  /** Slow mode aç/kapat — saniye cinsinden interval. 0 = kapalı */
  async setSlowMode(roomId: string, seconds: number): Promise<void> {
    const settings = await this._getRoomSettings(roomId);
    await this._updateRoomSettings(roomId, { ...settings, slow_mode_seconds: seconds });
  },

  // ==========================================
  // KICK (Odadan At)
  // ==========================================

  /** Kullanıcıyı odadan at (ban olmadan — tekrar katılabilir) */
  async kickFromRoom(roomId: string, targetUserId: string): Promise<void> {
    await supabase
      .from('room_participants')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', targetUserId);

    // Dinleyici sayısını azalt
    await supabase.rpc('decrement_listener_count', { room_id_input: roomId });
  },

  // ==========================================
  // ODA KİLİTLEME (Silver+)
  // ==========================================

  /** Odayı kilitle / aç — yeni katılımcı girişini engeller */
  async setRoomLock(roomId: string, locked: boolean): Promise<void> {
    const settings = await this._getRoomSettings(roomId);
    await this._updateRoomSettings(roomId, { ...settings, is_locked: locked });
  },

  // ==========================================
  // FOLLOWERS-ONLY MOD (Gold+)
  // ==========================================

  /** Yalnızca takipçilere açık modu aç/kapat */
  async setFollowersOnly(roomId: string, enabled: boolean): Promise<void> {
    const settings = await this._getRoomSettings(roomId);
    await this._updateRoomSettings(roomId, { ...settings, followers_only: enabled });
  },

  // ==========================================
  // YAŞ FİLTRESİ (Silver+)
  // ==========================================

  /** Minimum yaş filtresi uygula. 0 = kapalı */
  async setAgeFilter(roomId: string, minAge: number): Promise<void> {
    const settings = await this._getRoomSettings(roomId);
    await this._updateRoomSettings(roomId, { ...settings, age_filter_min: minAge });
  },

  // ==========================================
  // DİL FİLTRESİ (Silver+)
  // ==========================================

  /** Dil filtresi uygula. Boş dizi = filtre yok */
  async setLanguageFilter(roomId: string, languages: RoomLanguage[]): Promise<void> {
    const settings = await this._getRoomSettings(roomId);
    await this._updateRoomSettings(roomId, { ...settings, language_filter: languages });
  },

  // ==========================================
  // SAHNE DÜZENİ (Silver+)
  // ==========================================

  /** Sahne düzeni değiştir: grid / spotlight / theater */
  async setStageLayout(roomId: string, layout: StageLayout): Promise<void> {
    const settings = await this._getRoomSettings(roomId);
    await this._updateRoomSettings(roomId, { ...settings, stage_layout: layout });
  },

  // ==========================================
  // ODA MÜZİĞİ (Gold+)
  // ==========================================

  /** Oda müziği yapılandır */
  async setRoomMusic(roomId: string, config: RoomMusicConfig | null): Promise<void> {
    const settings = await this._getRoomSettings(roomId);
    await this._updateRoomSettings(roomId, { ...settings, room_music: config });
  },

  // ==========================================
  // ODA İSMİ DÜZENLEME
  // ==========================================

  /** Oda ismini düzenle */
  async editRoomName(roomId: string, newName: string): Promise<void> {
    await supabase
      .from('rooms')
      .update({ name: newName })
      .eq('id', roomId);
  },

  // ==========================================
  // HOŞ GELDİN MESAJI DÜZENLEME
  // ==========================================

  /** Hoş geldin mesajını düzenle */
  async editWelcomeMessage(roomId: string, message: string): Promise<void> {
    const settings = await this._getRoomSettings(roomId);
    await this._updateRoomSettings(roomId, { ...settings, welcome_message: message });
  },

  // ==========================================
  // YARDIMCI: room_settings JSONB işlemleri
  // ==========================================

  /** Oda settings JSONB'sini oku */
  async _getRoomSettings(roomId: string): Promise<RoomSettings> {
    const { data: room } = await supabase
      .from('rooms')
      .select('room_settings')
      .eq('id', roomId)
      .single();
    return (room?.room_settings || {}) as RoomSettings;
  },

  /** Oda settings JSONB'sini güncelle */
  async _updateRoomSettings(roomId: string, settings: RoomSettings): Promise<void> {
    await supabase
      .from('rooms')
      .update({ room_settings: settings })
      .eq('id', roomId);
  },
};
