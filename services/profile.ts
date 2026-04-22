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
  /**
   * Profili getir.
   * - Profile YOK (PGRST116 / no rows) → null döner (onboarding akışı için)
   * - Network / RLS / geçici hata → throw eder (caller retry/fallback yapabilir)
   *
   * ★ 2026-04-18 FIX: Önceki versiyon tüm error'ları null'a eşitliyordu. Reload
   * sırasında kısa network kesintisinde sistem kullanıcıyı "kayıtsız" sanıp
   * onboarding'e yolluyordu. Şimdi "yok" vs "hata" ayrıştırılıyor.
   */
  async get(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      // PostgREST "no rows" hatası genelde maybeSingle ile gelmez — güvenlik için check
      const code = (error as any).code;
      if (code === 'PGRST116') return null; // gerçekten yok
      throw error; // network / RLS / diğer
    }
    if (!data) return null; // gerçekten yok
    // Legacy tier normalizasyonu
    if (data.tier && !data.subscription_tier) {
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
    // ★ ORTA-I: Privacy — show_online_status kapalıysa is_online=false + last_seen NULL.
    // Kullanıcı görünmez modda "yaklaşık son aktiflik" sızdırmasın.
    let settings: any = null;
    try {
      const { SettingsService } = require('./settings');
      settings = await SettingsService.getForUser?.(userId) ?? await SettingsService.get?.();
    } catch {}
    const privacyOn = settings?.show_online_status === false;
    await supabase
      .from('profiles')
      .update({
        is_online: privacyOn ? false : isOnline,
        last_seen: privacyOn ? null : new Date().toISOString(),
      })
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

  /** Profili öne çıkar (Boost) — süre bazlı fiyatlandırma — ★ SEC-BOOST: Tier kontrolü eklendi */
  async boostProfile(userId: string, spCost: number = 25, durationHours: number = 1) {
    // ★ SEC-BOOST: Backend tier kontrolü — Free kullanıcılar boost yapamaz
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .single();
    const { isTierAtLeast } = require('../constants/tiers');
    const { migrateLegacyTier } = require('../types');
    const userTier = migrateLegacyTier(userProfile?.subscription_tier || 'Free');
    if (!isTierAtLeast(userTier, 'Plus')) {
      throw new Error('Profil boost özelliği Plus ve üzeri üyeliklerde kullanılabilir.');
    }

    // ★ GamificationService üzerinden harca — tek kaynak
    const { GamificationService } = require('./gamification');
    const spResult = await GamificationService.spend(userId, spCost, 'profile_boost');
    if (!spResult.success) {
      throw new Error(spResult.error || 'Yetersiz SP');
    }

    const boostUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ profile_boost_expires_at: boostUntil })
      .eq('id', userId);
    if (updateErr) throw updateErr;

    return { success: true, boost_expires_at: boostUntil };
  },

  /** ★ Keşfet'te öne çıkan (boost aktif) profilleri getir */
  async getBoostedProfiles(limit = 10): Promise<{
    id: string; display_name: string; username: string | null;
    avatar_url: string; subscription_tier: string; bio: string | null;
    is_online: boolean;
  }[]> {
    try {
      // RPC fonksiyonu varsa kullan, yoksa doğrudan sorgu
      const { data: rpcData } = await supabase.rpc('get_boosted_profiles', { max_count: limit });
      if (rpcData && rpcData.length > 0) return rpcData;

      // Fallback: doğrudan sorgu
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url, subscription_tier, bio, is_online, profile_boost_expires_at')
        .gt('profile_boost_expires_at', new Date().toISOString())
        .order('profile_boost_expires_at', { ascending: false })
        .limit(limit);
      if (error || !data) return [];
      return data as any[];
    } catch {
      return [];
    }
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
  async getRecentRooms(userId: string, limit = 10) {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('id, name, created_at, listener_count, category, is_live, type, is_persistent, max_speakers, theme_id, room_settings')
        .eq('host_id', userId)
        .order('is_live', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) return [];
      return (data || []) as any[];
    } catch {
      return [];
    }
  },

  /** ★ Pro gelir istatistikleri — SP giriş ücreti + bağış gelirleri */
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
   * GamificationService üzerinden geçer — atomik, cap kontrollü, transaction kayıtlı.
   * ★ K6: Her bağış denemesine unique externalRef verilir. Network retry'da çift harcamayı engeller.
   */
  async donateToUser(fromUserId: string, toUserId: string, amount: number): Promise<{ success: boolean; error?: string }> {
    // Validasyon
    if (fromUserId === toUserId) return { success: false, error: 'Kendinize SP gönderemezsiniz' };
    if (!Number.isInteger(amount) || amount < 1) return { success: false, error: 'Geçersiz miktar' };
    if (amount > 1000) return { success: false, error: 'Tek seferde en fazla 1000 SP gönderilebilir' };

    // ★ B4: Atomic rate limit — v34 RPC `FOR UPDATE` lock ile race condition'ı engeller.
    // Client-side count check eşzamanlı isteklerde bypass edilebiliyordu.
    try {
      const { data: rl, error: rlErr } = await supabase.rpc('check_donation_rate_limit', {
        p_user_id: fromUserId,
      });
      if (rlErr) {
        if (__DEV__) console.warn('[Donation] Rate limit RPC error:', rlErr.message);
      } else if (rl && (rl as any).ok === false) {
        return { success: false, error: (rl as any).error || 'Çok fazla bağış yaptınız. Lütfen 1 saat sonra tekrar deneyin.' };
      }
    } catch (e) {
      if (__DEV__) console.warn('[Donation] Rate limit exception:', e);
    }

    // ★ Idempotency key: aynı kaynak→hedef→miktar için bu turda unique.
    // Transaction çifti aynı kök'ü paylaşır — debit/credit/refund hep eşleşir.
    const donationId = `${fromUserId}:${toUserId}:${amount}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

    // ★ GamificationService üzerinden harca
    // ★ 2026-04-21: counterparty_id ile — SP history'de "kime gönderdin" / "kimden aldın" görünsün
    const { GamificationService } = require('./gamification');
    // Taraf isimlerini önceden çek — description için
    let fromName = '', toName = '';
    try {
      const { data: profiles } = await supabase
        .from('profiles').select('id, display_name')
        .in('id', [fromUserId, toUserId]);
      profiles?.forEach((p: any) => {
        if (p.id === fromUserId) fromName = p.display_name || '';
        if (p.id === toUserId) toName = p.display_name || '';
      });
    } catch {}
    const spendDesc = toName ? `${toName} adlı kişiye gönderdin` : undefined;
    const earnDesc = fromName ? `${fromName} adlı kişiden aldın` : undefined;

    const spResult = await GamificationService.spend(fromUserId, amount, 'donation_sent', `donation_send:${donationId}`, toUserId, spendDesc);
    if (!spResult.success) {
      return { success: false, error: spResult.error || 'Yetersiz SP' };
    }
    if (spResult.duplicate) {
      return { success: true };
    }

    // ★ Alıcıya ver — fail olursa refund (Y20: çift-katmanlı retry)
    try {
      await GamificationService.earn(toUserId, amount, 'donation_received', `donation_recv:${donationId}`, fromUserId, earnDesc);
      // ★ NEW: In-app notification row — receiver popup ve NotificationDrawer için
      try {
        const { error: notifErr } = await supabase.from('notifications').insert({
          user_id: toUserId,
          sender_id: fromUserId,
          type: 'gift',
          body: `${amount} SP gönderdi`,
          reference_id: null,
        });
        if (notifErr && __DEV__) {
          console.warn('[Donation] Notification insert error:', notifErr.message, notifErr.code, notifErr.details);
        } else if (__DEV__) {
          console.log('[Donation] Notification inserted for', toUserId, amount, 'SP');
        }
      } catch (e) {
        if (__DEV__) console.warn('[Donation] Notification catch:', e);
      }
      // ★ D6: Offline alıcı için push notification — in-app animasyon görünmeyebilir,
      // push her koşulda bağış haberini ulaştırır. Fire-and-forget.
      try {
        const { PushService } = require('./push');
        const { data: senderProfile } = await supabase
          .from('profiles').select('display_name').eq('id', fromUserId).single();
        const senderName = senderProfile?.display_name || 'Biri';
        PushService.sendToUser(
          toUserId,
          '💎 Bağış Aldın!',
          `${senderName} sana ${amount} SP gönderdi`,
          { type: 'donation' as any, route: '/sp-store' },
        );
      } catch { /* push başarısız olsa da bağış tamamlandı, sessiz geç */ }
    } catch (recvErr: any) {
      // Alıcıya verilemedi — göndericiye iade dene (2 deneme)
      let refunded = 0;
      for (let attempt = 0; attempt < 2 && refunded <= 0; attempt++) {
        try {
          refunded = await GamificationService.earn(
            fromUserId, amount, 'donation_refund', `donation_refund:${donationId}`,
          );
          if (refunded > 0) break;
        } catch { /* yeniden dene */ }
        if (attempt === 0) await new Promise(r => setTimeout(r, 300));
      }
      if (refunded > 0) {
        return { success: false, error: 'Alıcıya ulaşılamadı — SP iade edildi.' };
      }
      // Refund da başarısız — manuel destek için log bırak
      try {
        await supabase.from('sp_transactions').insert({
          user_id: fromUserId,
          amount: 0,
          type: 'donation_stuck',
          description: `DONATION STUCK to=${toUserId} amount=${amount} donation_id=${donationId} recv_err=${recvErr?.message || 'unknown'}`,
          external_ref: `donation_stuck:${donationId}`,
        });
      } catch { /* log da başarısızsa sessiz */ }
      return {
        success: false,
        error: 'Bağış işlemi tamamlanamadı. Destek kaydı oluşturuldu; SP iadesi için lütfen destek ile iletişime geçin.',
      };
    }

    return { success: true };
  },
};
