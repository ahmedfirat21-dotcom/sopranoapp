/**
 * SopranoChat — Gamification Servisi (SP — Tek Ekonomi)
 * ═══════════════════════════════════════════════════
 * Sistem Puanları (SP) kazanım ve harcama motoru.
 * Cooldown + DB-backed günlük cap + atomik persist.
 *
 * ★ Tüm SP akışları bu servisten geçer — tek giriş noktası.
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

/** userId → action → { lastGrantedAt, todayTotal, todayDate, dbSynced } */
const _cooldownCache = new Map<string, Map<string, {
  lastGrantedAt: number;
  todayTotal: number;
  todayDate: string;
  dbSynced: boolean;  // ★ DB'den başlangıç değeri yüklendi mi?
}>>();

function _getCache(userId: string, action: string) {
  if (!_cooldownCache.has(userId)) _cooldownCache.set(userId, new Map());
  const userMap = _cooldownCache.get(userId)!;
  const today = new Date().toISOString().split('T')[0];
  let entry = userMap.get(action);
  if (!entry || entry.todayDate !== today) {
    entry = { lastGrantedAt: 0, todayTotal: 0, todayDate: today, dbSynced: false };
    userMap.set(action, entry);
  }
  return entry;
}

// ★ SEC-MEM: Periyodik cache temizliği — lazy init, modül yüklendiğinde değil ilk kullanımda başlar
let _cacheCleanupId: ReturnType<typeof setInterval> | null = null;
function _ensureCacheCleanup() {
  if (_cacheCleanupId !== null) return;
  _cacheCleanupId = setInterval(() => {
    const stale = Date.now() - 30 * 60_000;
    for (const [userId, actions] of _cooldownCache) {
      for (const [action, entry] of actions) {
        if (entry.lastGrantedAt > 0 && entry.lastGrantedAt < stale) actions.delete(action);
      }
      if (actions.size === 0) _cooldownCache.delete(userId);
    }
  }, 10 * 60_000);
}

/**
 * ★ DB-backed günlük cap kontrolü.
 * İlk çağrıda sp_transactions'tan bugünkü toplam çekilir.
 * App restart olsa bile doğru cap korunur.
 */
async function _syncDailyTotalFromDB(userId: string, action: string): Promise<void> {
  const cache = _getCache(userId, action);
  if (cache.dbSynced) return; // Zaten senkron

  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('sp_transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('type', action)
      .gte('created_at', todayStart.toISOString())
      .gt('amount', 0);

    const dbTotal = (data || []).reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
    cache.todayTotal = Math.max(cache.todayTotal, dbTotal);
    cache.dbSynced = true;
  } catch {
    // DB hatasında in-memory devam et (graceful degradation)
    cache.dbSynced = true;
  }
}

/**
 * Cooldown ve günlük cap kontrolü.
 * @returns true = verilebilir, false = sınır aşıldı
 */
async function _canGrant(userId: string, action: string): Promise<boolean> {
  const config = SP_REWARDS[action];
  if (!config) return false;

  const cache = _getCache(userId, action);

  // ★ İlk çağrıda DB'den günlük toplamı senkronize et
  await _syncDailyTotalFromDB(userId, action);

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
 * ★ Tier bazlı SP çarpanı — Pro: 2×, Plus: 1.25×, Free: 1×
 * Sadece aktivite bazlı kazanımlarda uygulanır (bağış, satın alma hariç).
 */
const SP_TIER_MULTIPLIER: Record<string, number> = {
  Free: 1,
  Plus: 1.25,
  Pro: 2,
  GodMaster: 10,
};

/** Kullanıcının tier'ını hızlıca çek (cache'li) */
const _tierCache = new Map<string, { tier: string; ts: number }>();
async function _getUserTier(userId: string): Promise<string> {
  const cached = _tierCache.get(userId);
  if (cached && Date.now() - cached.ts < 5 * 60_000) return cached.tier; // 5dk cache
  try {
    const { data } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .single();
    const tier = data?.subscription_tier || 'Free';
    _tierCache.set(userId, { tier, ts: Date.now() });
    return tier;
  } catch {
    return 'Free';
  }
}

/**
 * ★ Y3: Tier cache invalidate — subscription purchase/downgrade/webhook sonrası
 * çağrılmalı. Çağrılmadığında user 5 dakika premium feature'lara erişmeye devam
 * edebilir. userId verilmezse tüm cache temizlenir.
 */
export function invalidateTierCache(userId?: string) {
  if (userId) _tierCache.delete(userId);
  else _tierCache.clear();
}

/**
 * SP kazandır — cooldown ve cap kontrollü.
 * ★ Pro: 2× çarpan, Plus: 1.25× çarpan (aktivite bazlı kazanımlarda).
 * Başarılıysa kazandırılan miktarı döndürür, başarısızsa 0.
 */
async function grantSP(userId: string, action: string, overrideAmount?: number, externalRef?: string, counterpartyId?: string | null, descriptionOverride?: string): Promise<number> {
  const config = SP_REWARDS[action];
  if (!config && !overrideAmount) return 0;

  let amount = overrideAmount ?? config?.amount ?? 0;
  if (amount <= 0) return 0;

  _ensureCacheCleanup();
  // Cooldown/cap kontrolü — idempotent çağrılarda (externalRef ile) atla:
  // RevenueCat satın alması / refund zaten unique key ile korunuyor.
  if (!externalRef) {
    if (config && !(await _canGrant(userId, action))) return 0;
    if (!config) {
      const cache = _getCache(userId, action);
      const elapsed = Date.now() - cache.lastGrantedAt;
      if (elapsed < 60_000) return 0;
    }
  }

  // ★ Tier bazlı SP çarpanı — sadece aktivite kazanımlarında (tip, store_purchase gibi transfer'lerde DEĞİL)
  const EXCLUDED_FROM_MULTIPLIER = ['tip_received', 'tip_refund', 'store_purchase', 'subscription_purchase', 'entry_fee_share', 'sp_purchase'];
  if (!EXCLUDED_FROM_MULTIPLIER.includes(action)) {
    try {
      const userTier = await _getUserTier(userId);
      const multiplier = SP_TIER_MULTIPLIER[userTier] || 1;
      if (multiplier > 1) {
        amount = Math.floor(amount * multiplier);
      }
    } catch { /* tier alınamazsa çarpan uygulanmaz */ }
  }

  // DB'ye yaz (atomik + transaction kaydı)
  const persisted = await _persistSP(userId, amount, action, externalRef, counterpartyId, descriptionOverride);
  if (persisted) {
    _markGranted(userId, action, amount);
    return amount;
  }
  return 0;
}

/**
 * SP'yi veritabanına kaydet.
 * ★ Atomik persist + zorunlu transaction kaydı.
 * ★ externalRef: idempotency key (satın alma / retry dedup için). v20 RPC kullanılır.
 */
async function _persistSP(userId: string, amount: number, action: string, externalRef?: string, counterpartyId?: string | null, descriptionOverride?: string): Promise<boolean> {
  try {
    // Yöntem 1: RPC (tercih edilen — atomic + idempotent).
    // v20 migrasyonu sonrası external_ref varsa çifte harcama/verme engellenir.
    if (externalRef) {
      const { data, error: rpcError } = await supabase.rpc('grant_system_points', {
        p_user_id: userId,
        p_amount: amount,
        p_action: action,
        p_external_ref: externalRef,
      });
      if (!rpcError) {
        const status = (data as any)?.status;
        if (status === 'duplicate') {
          if (__DEV__) console.log(`[SP] Idempotent skip — aynı external_ref daha önce işlendi: ${externalRef}`);
          return false;
        }
        // ★ D4: Günlük cap durumunda kullanıcıya açık bildirim (sessiz fail yerine)
        if (status === 'daily_cap') {
          try {
            const { showToast } = require('../components/Toast');
            showToast({ title: 'Günlük Limit', message: 'Bugün 300 SP kazanım limitine ulaştın. Yarın tekrar dene.', type: 'warning', duration: 3000 });
          } catch { /* toast yoksa sessiz */ }
          return false;
        }
        return true;
      }
      if (__DEV__) console.warn('[SP] v20 RPC yok, legacy RPC fallback:', rpcError?.message);
    }

    const { error: legacyRpcError } = await supabase.rpc('grant_system_points', {
      p_user_id: userId,
      p_amount: amount,
      p_action: action,
    });
    if (!legacyRpcError) {
      _logTransaction(userId, amount, action, externalRef, counterpartyId, descriptionOverride);
      return true;
    }

    // Yöntem 2: Optimistic lock ile fallback (race condition korumalı)
    const MAX_RETRIES = 2;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('system_points')
        .eq('id', userId)
        .single();

      if (!profile) return false;
      const oldSP = profile.system_points || 0;
      const newTotal = oldSP + amount;

      if (newTotal < 0) return false;

      const { data, error: lockErr } = await supabase
        .from('profiles')
        .update({ system_points: newTotal })
        .eq('id', userId)
        .eq('system_points', oldSP)
        .select('id');

      if (!lockErr && data && data.length > 0) {
        _logTransaction(userId, amount, action, externalRef, counterpartyId, descriptionOverride);
        return true;
      }
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, 100 * (attempt + 1)));
      }
    }

    if (__DEV__) console.warn(`[SP] Persist başarısız (conflict): ${userId} +${amount} (${action})`);
    return false;
  } catch (e) {
    if (__DEV__) console.warn('[SP] Persist hatası:', e);
    return false;
  }
}

/**
 * ★ Transaction kaydı — dashboard SP özeti ve realtime sync için zorunlu.
 * Fire-and-forget (başarısızlık SP verilmesini engellemez).
 * externalRef: v20 öncesi fallback yollarında idempotency key saklamak için.
 */
function _logTransaction(userId: string, amount: number, action: string, externalRef?: string, counterpartyId?: string | null, descriptionOverride?: string) {
  const payload: any = {
    user_id: userId,
    amount,
    type: action,
    description: descriptionOverride || (amount > 0 ? `SP kazanıldı: ${action}` : `SP harcandı: ${action}`),
  };
  if (externalRef) payload.external_ref = externalRef;
  if (counterpartyId) payload.counterparty_id = counterpartyId;
  Promise.resolve(supabase.from('sp_transactions').insert(payload)).catch(() => {});
}

/**
 * SP harca — negatif bakiye kontrolü + atomik.
 * ★ GodMaster (is_admin) kullanıcılar için SP düşürülmez — sınırsız.
 * ★ externalRef: idempotency key — çift tıklama / retry'da çift düşmeyi engeller.
 */
async function spendSP(userId: string, amount: number, reason: string, externalRef?: string, counterpartyId?: string | null, descriptionOverride?: string): Promise<{ success: boolean; remaining?: number; error?: string; duplicate?: boolean }> {
  try {
    // ★ GodMaster bypass — admin kullanıcılar sınırsız SP'ye sahip
    const { data: adminCheck } = await supabase
      .from('profiles')
      .select('is_admin, system_points')
      .eq('id', userId)
      .single();
    if (adminCheck?.is_admin) {
      _logTransaction(userId, 0, `${reason} [ADMIN BYPASS]`, externalRef, counterpartyId, descriptionOverride);
      return { success: true, remaining: adminCheck.system_points || 999999 };
    }

    // Yöntem 1: v20 idempotent RPC (externalRef verildiyse)
    if (externalRef) {
      const { data, error: rpcError } = await supabase.rpc('grant_system_points', {
        p_user_id: userId,
        p_amount: -amount,
        p_action: reason,
        p_external_ref: externalRef,
      });
      if (!rpcError) {
        const status = (data as any)?.status;
        const { data: profile } = await supabase
          .from('profiles')
          .select('system_points')
          .eq('id', userId)
          .single();
        const remaining = profile?.system_points ?? 0;
        if (status === 'duplicate') {
          return { success: true, remaining, duplicate: true };
        }
        return { success: true, remaining };
      }
      if (__DEV__) console.warn('[SP spend] v20 RPC yok, legacy RPC fallback:', rpcError?.message);
    }

    // Yöntem 2: Legacy RPC (atomic)
    const { error: rpcError } = await supabase.rpc('grant_system_points', {
      p_user_id: userId,
      p_amount: -amount,
      p_action: reason,
    });

    if (!rpcError) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('system_points')
        .eq('id', userId)
        .single();
      const remaining = profile?.system_points ?? 0;
      _logTransaction(userId, -amount, reason, externalRef, counterpartyId, descriptionOverride);
      return { success: true, remaining };
    }

    // Yöntem 3: Optimistic lock fallback
    const MAX_RETRIES = 2;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
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
      const { data, error } = await supabase
        .from('profiles')
        .update({ system_points: newTotal })
        .eq('id', userId)
        .eq('system_points', current)
        .select('id');

      if (!error && data && data.length > 0) {
        _logTransaction(userId, -amount, reason, externalRef, counterpartyId, descriptionOverride);
        return { success: true, remaining: newTotal };
      }
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    return { success: false, error: 'SP güncelleme başarısız (eşzamanlı işlem çakışması)' };
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

  /** Mesaj gönderme (60 sn cooldown) */
  async onMessageSent(userId: string): Promise<number> {
    return grantSP(userId, 'message_sent');
  },

  /** Oda oluşturma */
  async onRoomCreate(userId: string): Promise<number> {
    return grantSP(userId, 'room_create');
  },

  /** Duvar postu oluşturma */
  async onWallPost(userId: string): Promise<number> {
    return grantSP(userId, 'wall_post');
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

  /** Mağaza alışverişi SP bonusu (tutar × 1) */
  async onStorePurchase(userId: string, purchaseAmount: number): Promise<number> {
    const bonus = Math.floor(purchaseAmount); // ★ Eskiden ×2 idi, şimdi ×1 (endüstri normu)
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
   * Günlük cap: 80 SP
   */
  async grantOwnerBonus(
    userId: string,
    followerCount: number,
    concurrentUsers: number,
    totalListenMinutes: number,
  ): Promise<number> {
    const bonus = calculateOwnerBonus(followerCount, concurrentUsers, totalListenMinutes);
    if (bonus <= 0) return 0;

    // Günlük cap kontrolü (DB-backed)
    await _syncDailyTotalFromDB(userId, 'owner_bonus');
    const cache = _getCache(userId, 'owner_bonus');
    const remainingCap = OWNER_BONUS_DAILY_CAP - cache.todayTotal;
    if (remainingCap <= 0) return 0;

    const cappedBonus = Math.min(bonus, remainingCap);
    const granted = await grantSP(userId, 'owner_bonus', cappedBonus);
    if (granted > 0) _markGranted(userId, 'owner_bonus', granted);
    return granted;
  },

  // ── SP Harcama ──

  /** Keşfet boost satın al (SP ile) — ★ Fiyat düşürüldü: erişilebilirlik artırıldı */
  async purchaseRoomBoost(userId: string, durationHours: 1 | 6): Promise<{ success: boolean; error?: string }> {
    const cost = durationHours === 1 ? 50 : 200; // ★ Eski: 100/400 → Yeni: 50/200
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
  async spend(userId: string, amount: number, reason: string, externalRef?: string, counterpartyId?: string | null, descriptionOverride?: string): Promise<{ success: boolean; remaining?: number; error?: string; duplicate?: boolean }> {
    return spendSP(userId, amount, reason, externalRef, counterpartyId, descriptionOverride);
  },

  /**
   * Genel SP kazandırma (bağış alıcısı, ödül, satın alma vb.).
   * externalRef: idempotency key — RevenueCat transactionId veya dahili UUID.
   * Aynı externalRef ile ikinci çağrı no-op döner (K5/K6 koruması).
   */
  async earn(userId: string, amount: number, reason: string, externalRef?: string, counterpartyId?: string | null, descriptionOverride?: string): Promise<number> {
    return grantSP(userId, reason, amount, externalRef, counterpartyId, descriptionOverride);
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

  /** SP işlem geçmişi — counterparty profilini de ekle (kim gönderdi/aldı göstermek için) */
  async getTransactionHistory(userId: string, limit = 20) {
    // ★ Iki aşamalı sorgu — embedded select FK schema cache'e bağlı olduğundan,
    //   counterparty join'i ayrı query ile çekip manuel merge ediyoruz (resilient).
    const { data: txData, error } = await supabase
      .from('sp_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !txData) return [];

    // Benzersiz counterparty ID'lerini topla
    const cpIds = Array.from(
      new Set(txData.map((t: any) => t.counterparty_id).filter(Boolean))
    );
    let cpMap: Record<string, { display_name: string; avatar_url: string }> = {};
    if (cpIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', cpIds);
      (profiles || []).forEach((p: any) => {
        cpMap[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url };
      });
    }

    return txData.map((tx: any) => ({
      ...tx,
      counterparty_name: tx.counterparty_id ? cpMap[tx.counterparty_id]?.display_name || null : null,
      counterparty_avatar: tx.counterparty_id ? cpMap[tx.counterparty_id]?.avatar_url || null : null,
    }));
  },
};
