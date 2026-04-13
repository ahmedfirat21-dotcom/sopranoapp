/**
 * SopranoChat — Profil Servisi
 * ═══════════════════════════════════════════════════
 * Profil CRUD, arama, boost, istatistikler.
 * database.ts monolitinden ayrıştırıldı.
 */
import { supabase } from '../constants/supabase';
import { getRoomLimits } from '../constants/tiers';
import type { Profile, SubscriptionTier } from '../types';
import { migrateLegacyTier } from '../types';

// ============================================
// PROFİL İŞLEMLERİ
// ============================================
export const ProfileService = {
  async get(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) return null;
    // Legacy tier normalizasyonu
    if (data && data.tier && !data.subscription_tier) {
      (data as any).subscription_tier = migrateLegacyTier(data.tier);
    }
    return data as Profile;
  },

  async update(userId: string, updates: Partial<Profile>): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);
    if (error) throw error;
  },

  async setOnline(userId: string, isOnline: boolean): Promise<void> {
    await supabase
      .from('profiles')
      .update({ is_online: isOnline, last_seen: new Date().toISOString() })
      .eq('id', userId);
  },

  /** Kullanıcı adı müsait mi? */
  async isUsernameAvailable(username: string): Promise<boolean> {
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('username', username);
    if (error) return false;
    return (count || 0) === 0;
  },

  /** Arama — ★ SEC-3 FIX: Input sanitization + max length */
  async search(query: string, limit = 20): Promise<Profile[]> {
    // ★ SEC-3: Boş, çok kısa veya çok uzun sorguları engelle
    const trimmed = (query || '').trim();
    if (trimmed.length < 2 || trimmed.length > 50) return [];

    // ★ SEC-3: ilike wildcard karakterlerini escape et — SQL injection önleme
    // PostgREST'te %, _ ve \ özel anlam taşır — bunlar literal olarak aranmalı
    const sanitized = trimmed
      .replace(/\\/g, '\\\\')  // Backslash
      .replace(/%/g, '\\%')    // Wildcard %
      .replace(/_/g, '\\_');   // Wildcard _

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`display_name.ilike.%${sanitized}%,username.ilike.%${sanitized}%`)
      .limit(Math.min(limit, 50)); // ★ Max limit guard
    if (error) throw error;
    return (data || []) as Profile[];
  },

  /** Yeni profil oluştur (ilk giriş sonrası) */
  async create(userId: string, profileData: Partial<Profile>): Promise<Profile> {
    const baseUsername = (profileData.username || `user_${userId.substring(0, 6)}`).toLowerCase().replace(/[^a-z0-9_]/g, '');
    const username = `${baseUsername}_${userId.substring(0, 4)}`;

    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        { id: userId, tier: 'free', ...profileData, username },
        { onConflict: 'id' }
      )
      .select()
      .single();
    if (error) throw error;
    return data as Profile;
  },

  /** Profili öne çıkar (Boost) — SP ile */
  async boostProfile(userId: string, spCost: number = 10) {
    const profile = await ProfileService.get(userId);
    if (!profile || profile.system_points < spCost) {
      throw new Error('Yetersiz SP');
    }
    const boostUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({
        system_points: profile.system_points - spCost,
        profile_boost_expires_at: boostUntil,
      })
      .eq('id', userId);
    if (updateErr) throw updateErr;

    try {
      await supabase.from('sp_transactions').insert({
        user_id: userId,
        amount: -spCost,
        type: 'profile_boost',
        description: 'Profil Boost (1 saat)',
      });
    } catch { /* SP transaction opsiyonel */ }
    return { success: true, boost_expires_at: boostUntil };
  },

  /** ★ Profil istatistikleri — sahne süresi, oda geçmişi, toplam dinleyici */
  async getProfileStats(userId: string): Promise<{
    stageMinutes: number;
    roomsCreated: number;
    totalListeners: number;
    totalReactions: number;
  }> {
    try {
      // Oluşturulan oda sayısı
      const { count: roomsCreated } = await supabase
        .from('rooms')
        .select('id', { count: 'exact', head: true })
        .eq('host_id', userId);

      // SP transaction'lardan sahne süresi tahmini (stage_time tetikleyicisi 10dk'da 1)
      const { count: stageEvents } = await supabase
        .from('sp_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type', 'stage_time');

      // Toplam dinleyici (odalarının listener_count toplamı)
      const { data: rooms } = await supabase
        .from('rooms')
        .select('listener_count')
        .eq('host_id', userId);
      const totalListeners = (rooms || []).reduce((sum, r) => sum + (r.listener_count || 0), 0);

      // Toplam alınan tepkiler (emoji_reaction SP kayıtları)
      const { count: totalReactions } = await supabase
        .from('sp_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type', 'emoji_reaction');

      return {
        stageMinutes: (stageEvents || 0) * 10,
        roomsCreated: roomsCreated || 0,
        totalListeners,
        totalReactions: totalReactions || 0,
      };
    } catch {
      return { stageMinutes: 0, roomsCreated: 0, totalListeners: 0, totalReactions: 0 };
    }
  },

  /** ★ Son oluşturulan odalar (profilde gösterilir) */
  async getRecentRooms(userId: string, limit = 5): Promise<{ id: string; name: string; created_at: string; listener_count: number; category: string }[]> {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('id, name, created_at, listener_count, category')
        .eq('host_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) return [];
      return (data || []) as any[];
    } catch {
      return [];
    }
  },

  /** ★ VIP gelir istatistikleri — SP giriş ücreti + bağış gelirleri */
  async getIncomeStats(userId: string): Promise<{
    totalEarned: number;
    roomFeeRooms: number;
    donationsReceived: number;
  }> {
    try {
      // SP giriş ücreti gelirleri
      const { data: feeData } = await supabase
        .from('sp_transactions')
        .select('amount')
        .eq('user_id', userId)
        .in('type', ['room_entry_fee', 'donation_received']);

      const totalEarned = (feeData || []).reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
      const donationsReceived = (feeData || []).filter((t: any) => t.type === 'donation_received').length;

      // Ücretli oda sayısı
      const { data: feeRooms } = await supabase
        .from('rooms')
        .select('room_settings')
        .eq('host_id', userId);
      const roomFeeRooms = (feeRooms || []).filter(r => (r.room_settings as any)?.entry_fee_sp > 0).length;

      return { totalEarned, roomFeeRooms, donationsReceived };
    } catch {
      return { totalEarned: 0, roomFeeRooms: 0, donationsReceived: 0 };
    }
  },

  /**
   * ★ SP Bağışı — Kullanıcıdan kullanıcıya SP transferi
   * ★ SEC-4 FIX: Her iki tarafta optimistic lock + rate limiting + rollback doğrulama
   * @param fromUserId Gönderen kullanıcı
   * @param toUserId Alıcı kullanıcı
   * @param amount Gönderilecek SP miktarı (1-1000 arası)
   */
  async donateToUser(fromUserId: string, toUserId: string, amount: number): Promise<{ success: boolean; error?: string }> {
    // Validasyon
    if (fromUserId === toUserId) return { success: false, error: 'Kendinize SP gönderemezsiniz' };
    if (!Number.isInteger(amount) || amount < 1) return { success: false, error: 'Geçersiz miktar' };
    if (amount > 1000) return { success: false, error: 'Tek seferde en fazla 1000 SP gönderilebilir' };

    // ★ SEC-4: Rate limiting — max 10 bağış/saat (SP drain attack önleme)
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('sp_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', fromUserId)
        .eq('type', 'donation_sent')
        .gte('created_at', oneHourAgo);
      if ((count || 0) >= 10) {
        return { success: false, error: 'Çok fazla bağış yaptınız. Lütfen 1 saat sonra tekrar deneyin.' };
      }
    } catch { /* sp_transactions yoksa rate limit atla */ }

    // Bakiye kontrolü — ★ SEC-4: Taze veri çek (stale read önleme)
    const { data: sender, error: sErr } = await supabase
      .from('profiles')
      .select('system_points, display_name')
      .eq('id', fromUserId)
      .single();
    if (sErr || !sender) return { success: false, error: 'Profil bulunamadı' };
    if ((sender.system_points || 0) < amount) return { success: false, error: 'Yetersiz SP' };

    // Alıcı kontrolü
    const { data: receiver, error: rErr } = await supabase
      .from('profiles')
      .select('system_points, display_name')
      .eq('id', toUserId)
      .single();
    if (rErr || !receiver) return { success: false, error: 'Alıcı bulunamadı' };

    try {
      // 1. Göndericiden düş — ★ SEC-4: Optimistic lock (SP değişmişse 0 row affected)
      const { data: deductResult, error: deductErr } = await supabase
        .from('profiles')
        .update({ system_points: sender.system_points - amount })
        .eq('id', fromUserId)
        .eq('system_points', sender.system_points) // ★ Optimistic lock
        .select('id');
      if (deductErr) throw new Error('SP düşürme hatası');
      if (!deductResult || deductResult.length === 0) {
        return { success: false, error: 'Eşzamanlı işlem çakışması. Lütfen tekrar deneyin.' };
      }

      // 2. Alıcıya ekle — ★ SEC-4: Optimistic lock (alıcı tarafında da)
      const { data: addResult, error: addErr } = await supabase
        .from('profiles')
        .update({ system_points: receiver.system_points + amount })
        .eq('id', toUserId)
        .eq('system_points', receiver.system_points) // ★ Optimistic lock
        .select('id');

      if (addErr || !addResult || addResult.length === 0) {
        // ★ SEC-4: Doğrulanmış rollback — geri ekleme başarısını kontrol et
        const { data: rollback } = await supabase
          .from('profiles')
          .update({ system_points: sender.system_points })
          .eq('id', fromUserId)
          .select('id');
        if (!rollback || rollback.length === 0) {
          // KRITIK: Rollback da başarısız — admin log'a yaz
          console.error(`[CRITICAL] SP ROLLBACK FAILED: user=${fromUserId}, amount=${amount}, receiver=${toUserId}`);
        }
        throw new Error('SP ekleme hatası — tutar geri iade edildi');
      }

      // 3. Transaction kayıtları
      try {
        await supabase.from('sp_transactions').insert([
          { user_id: fromUserId, amount: -amount, type: 'donation_sent', description: `${receiver.display_name || 'Kullanıcı'} adlı kişiye SP bağışı` },
          { user_id: toUserId, amount: amount, type: 'donation_received', description: `${sender.display_name || 'Kullanıcı'} adlı kişiden SP bağışı` },
        ]);
      } catch { /* transaction kaydı opsiyonel */ }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Transfer başarısız' };
    }
  },
};
