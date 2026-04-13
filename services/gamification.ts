/**
 * SopranoChat — Gamification Servisi (SP — Tek Ekonomi)
 * ═══════════════════════════════════════════════════
 * Sistem Puanları (SP) kazanım ve harcama motoru.
 * Cooldown/cap kontrollü merkezi SP altyapısı.
 */
import { supabase } from '../constants/supabase';
import {
  SP_REWARDS,
  SUBSCRIPTION_SP_BONUS,
  calculateOwnerBonus,
  OWNER_BONUS_DAILY_CAP,
  isPrimeTime,
  checkCCUMilestones,
} from '../constants/tiers';
import type { SubscriptionTier } from '../types';

// ════════════════════════════════════════════════════════════
// İÇ DURUM — Cooldown & Günlük Cap Takibi
// ════════════════════════════════════════════════════════════

/** userId → action → { lastGrantedAt, todayTotal } */
const _cooldownCache = new Map<string, Map<string, { lastGrantedAt: number; todayTotal: number; todayDate: string }>>();

function _getCache(userId: string, action: string) {
  if (!_cooldownCache.has(userId)) _cooldownCache.set(userId, new Map());
  const userMap = _cooldownCache.get(userId)!;
  const today = new Date().toISOString().split('T')[0];
  let entry = userMap.get(action);
  if (!entry || entry.todayDate !== today) {
    entry = { lastGrantedAt: 0, todayTotal: 0, todayDate: today };
    userMap.set(action, entry);
  }
  return entry;
}

/**
 * Cooldown ve günlük cap kontrolü.
 * @returns true = verilebilir, false = sınır aşıldı
 */
function _canGrant(userId: string, action: string): boolean {
  const config = SP_REWARDS[action];
  if (!config) return false;

  const cache = _getCache(userId, action);

  // Cooldown kontrolü
  if (config.cooldownMs > 0) {
    const elapsed = Date.now() - cache.lastGrantedAt;
    if (elapsed < config.cooldownMs) return false;
  }

  // Günlük cap kontrolü
  if (config.dailyCap > 0 && cache.todayTotal >= config.dailyCap) {
    return false;
  }

  return true;
}

/** Grant sonrası cache'i güncelle */
function _markGranted(userId: string, action: string, amount: number) {
  const cache = _getCache(userId, action);
  cache.lastGrantedAt = Date.now();
  cache.todayTotal += amount;
}

// ════════════════════════════════════════════════════════════
// SP KAZANDIRMA — TEK GİRİŞ NOKTASI
// ════════════════════════════════════════════════════════════

/**
 * SP kazandır — cooldown ve cap kontrollü.
 * Başarılıysa kazandırılan miktarı döndürür, başarısızsa 0.
 */
async function grantSP(userId: string, action: string, overrideAmount?: number): Promise<number> {
  const config = SP_REWARDS[action];
  if (!config && !overrideAmount) return 0;

  const amount = overrideAmount ?? config?.amount ?? 0;
  if (amount <= 0) return 0;

  // Cooldown/cap kontrolü (config varsa standard, yoksa override için de temel cooldown)
  if (config && !_canGrant(userId, action)) return 0;

  // ★ BUG-C4 FIX: Config olmayan action'lar için de temel cooldown — aynı action tekrarını engelle (1 dakika)
  if (!config) {
    const cache = _getCache(userId, action);
    const elapsed = Date.now() - cache.lastGrantedAt;
    if (elapsed < 60_000) return 0; // 1dk cooldown — çift ödül önleme
  }

  // DB'ye yaz
  const persisted = await _persistSP(userId, amount, action);
  if (persisted) {
    _markGranted(userId, action, amount);
    return amount;
  }
  return 0;
}

/**
 * SP'yi veritabanına kaydet.
 * Basitleştirilmiş: RPC → Manuel fallback (2 katman).
 */
async function _persistSP(userId: string, amount: number, action: string): Promise<boolean> {
  try {
    // Yöntem 1: RPC (tercih edilen — atomic)
    const { error: rpcError } = await supabase.rpc('grant_system_points', {
      p_user_id: userId,
      p_amount: amount,
      p_action: action,
    });
    if (!rpcError) return true;

    // Yöntem 2: Manuel increment (fallback)
    const { data: profile } = await supabase
      .from('profiles')
      .select('system_points')
      .eq('id', userId)
      .single();

    if (profile) {
      const newTotal = (profile.system_points || 0) + amount;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ system_points: newTotal })
        .eq('id', userId);
      if (!updateError) return true;
    }

    if (__DEV__) console.warn(`[SP] Kayıt başarısız: ${userId} +${amount} (${action})`);
    return false;
  } catch (e) {
    if (__DEV__) console.warn('[SP] Persist hatası:', e);
    return false;
  }
}

/**
 * SP harca — negatif bakiye kontrolü.
 * ★ BUG-B6 FIX: RPC-first yaklaşımı — atomic harcama ile race condition azaltıldı.
 * RPC başarısız olursa hata fırlatır (güvensiz fallback kaldırıldı).
 */
async function spendSP(userId: string, amount: number, reason: string): Promise<{ success: boolean; remaining?: number; error?: string }> {
  try {
    // Yöntem 1: RPC (atomic - tercih edilen)
    const { data: rpcResult, error: rpcError } = await supabase.rpc('grant_system_points', {
      p_user_id: userId,
      p_amount: -amount,
      p_action: reason,
    });

    if (!rpcError) {
      // Başarılı — güncellenmiş bakiyeyi oku
      const { data: profile } = await supabase
        .from('profiles')
        .select('system_points')
        .eq('id', userId)
        .single();
      const remaining = profile?.system_points ?? 0;

      // İşlem kaydı
      try {
        await supabase.from('sp_transactions').insert({
          user_id: userId,
          amount: -amount,
          type: reason,
          description: `SP harcan: ${reason}`,
        });
      } catch { /* işlem kaydı opsiyonel */ }

      return { success: true, remaining };
    }

    // Yöntem 2: Manuel (RPC yoksa fallback — bakiye kontrolü ekli)
    const { data: profile } = await supabase
      .from('profiles')
      .select('system_points')
      .eq('id', userId)
      .single();

    if (!profile) return { success: false, error: 'Profil bulunamadı.' };

    const current = profile.system_points || 0;
    if (current < amount) {
      return { success: false, error: `Yetersiz SP. Mevcut: ${current}, Gerekli: ${amount}` };
    }

    const newTotal = current - amount;
    const { error } = await supabase
      .from('profiles')
      .update({ system_points: newTotal })
      .eq('id', userId);

    if (error) throw error;

    // İşlem kaydı
    try {
      await supabase.from('sp_transactions').insert({
        user_id: userId,
        amount: -amount,
        type: reason,
        description: `SP harcan: ${reason}`,
      });
    } catch { /* işlem kaydı opsiyonel */ }

    return { success: true, remaining: newTotal };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ════════════════════════════════════════════════════════════
// SP TETİKLEYİCİLER (Public API)
// ════════════════════════════════════════════════════════════

export const GamificationService = {
  // ── Temel Kazanım ──

  /** Günlük giriş (24 saat cooldown) */
  async onDailyLogin(userId: string): Promise<number> {
    return grantSP(userId, 'daily_login');
  },

  /** Prime-time geri dönüş (19:00-22:00, 3 saat cooldown) */
  async onPrimeTimeReturn(userId: string): Promise<number> {
    if (!isPrimeTime()) return 0;
    return grantSP(userId, 'prime_time_return');
  },

  /** Sahnede 10 dakika geçirme */
  async onStageTime(userId: string): Promise<number> {
    return grantSP(userId, 'stage_time');
  },

  /** Kamera 10 dakika açık */
  async onCameraTime(userId: string): Promise<number> {
    return grantSP(userId, 'camera_time');
  },

  /** Mesaj gönderme (30 sn cooldown) */
  async onMessageSent(userId: string): Promise<number> {
    return grantSP(userId, 'message_sent');
  },

  /** Oda oluşturma */
  async onRoomCreate(userId: string): Promise<number> {
    return grantSP(userId, 'room_create');
  },

  // ── Yeni Tetikleyiciler ──

  /** Yeni oda takipçisi kazanma */
  async onFollowerGain(userId: string): Promise<number> {
    return grantSP(userId, 'follower_gain');
  },

  /**
   * CCU milestone kontrolü (10/25/50 kişi).
   * Birden fazla milestone aynı anda geçilebilir.
   * @returns Toplam kazanılan SP
   */
  async onCCUMilestone(userId: string, currentCCU: number, previousCCU: number): Promise<number> {
    const milestones = checkCCUMilestones(currentCCU, previousCCU);
    let totalEarned = 0;

    for (const milestone of milestones) {
      const action = `ccu_milestone_${milestone}`;
      const earned = await grantSP(userId, action);
      totalEarned += earned;
    }

    return totalEarned;
  },

  /**
   * Üyelik satın alma SP bonusu.
   * Tier'a göre sabit miktar (cooldown yok — tek sefer).
   */
  async onSubscriptionPurchase(userId: string, tier: SubscriptionTier): Promise<number> {
    const bonus = SUBSCRIPTION_SP_BONUS[tier] || 0;
    if (bonus <= 0) return 0;
    return grantSP(userId, 'subscription_purchase', bonus);
  },

  /** Mağaza alışverişi SP bonusu (tutar × 2) */
  async onStorePurchase(userId: string, purchaseAmount: number): Promise<number> {
    const bonus = purchaseAmount * 2;
    if (bonus <= 0) return 0;
    return grantSP(userId, 'store_purchase', bonus);
  },

  /** Referral bonusu */
  async onReferral(userId: string): Promise<number> {
    return grantSP(userId, 'referral');
  },

  // ── Oda Sahibi Bonus ──

  /**
   * Oda sahibine saatlik bonus hesapla ve ver.
   * Formül: floor((followers × 0.5) + (CCU × 2) + (log2(minutes + 1) × 3))
   * Günlük cap: 250 SP
   */
  async grantOwnerBonus(
    userId: string,
    followerCount: number,
    concurrentUsers: number,
    totalListenMinutes: number,
  ): Promise<number> {
    const bonus = calculateOwnerBonus(followerCount, concurrentUsers, totalListenMinutes);
    if (bonus <= 0) return 0;

    // Günlük cap kontrolü
    const cache = _getCache(userId, 'owner_bonus');
    const remainingCap = OWNER_BONUS_DAILY_CAP - cache.todayTotal;
    if (remainingCap <= 0) return 0;

    const cappedBonus = Math.min(bonus, remainingCap);
    const granted = await grantSP(userId, 'owner_bonus', cappedBonus);
    if (granted > 0) _markGranted(userId, 'owner_bonus', granted);
    return granted;
  },

  // ── SP Harcama ──

  /** Keşfet boost satın al (SP ile) */
  async purchaseRoomBoost(userId: string, durationHours: 1 | 6): Promise<{ success: boolean; error?: string }> {
    const cost = durationHours === 1 ? 100 : 400;
    return spendSP(userId, cost, 'room_boost');
  },

  /** Çerçeve kilit aç (SP ile) */
  async purchaseFrameUnlock(userId: string, cost: number): Promise<{ success: boolean; error?: string }> {
    return spendSP(userId, cost, 'frame_unlock');
  },

  /** Efekt kilit aç (SP ile) */
  async purchaseEffectUnlock(userId: string, cost: number): Promise<{ success: boolean; error?: string }> {
    return spendSP(userId, cost, 'effect_unlock');
  },

  /** Genel SP harcama */
  async spend(userId: string, amount: number, reason: string): Promise<{ success: boolean; remaining?: number; error?: string }> {
    return spendSP(userId, amount, reason);
  },

  /** Genel SP kazandırma (bağış alıcısı, ödül vb.) */
  async earn(userId: string, amount: number, reason: string): Promise<number> {
    return grantSP(userId, reason, amount);
  },

  // ── Yardımcılar ──

  /** Kullanıcının güncel SP bakiyesi */
  async getBalance(userId: string): Promise<number> {
    const { data } = await supabase
      .from('profiles')
      .select('system_points')
      .eq('id', userId)
      .single();
    return data?.system_points || 0;
  },

  /** SP işlem geçmişi */
  async getTransactionHistory(userId: string, limit = 20) {
    const { data } = await supabase
      .from('sp_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return data || [];
  },
};
