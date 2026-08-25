/**
 * SopranoChat â Gamification Servisi (SP â Tek Ekonomi)
 * âââââââââââââââââââââââââââââââââââââââââââââââââââ
 * Sistem PuanlarÄ± (SP) kazanÄ±m ve harcama motoru.
 * Cooldown + DB-backed gÃ¼nlÃ¼k cap + atomik persist.
 *
 * â TÃ¼m SP akÄ±ÅlarÄ± bu servisten geÃ§er â tek giriÅ noktasÄ±.
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
import { i18n } from './i18n';

// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// Ä°Ã DURUM â Cooldown & GÃ¼nlÃ¼k Cap Takibi
// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

/** userId â action â { lastGrantedAt, todayTotal, todayDate, dbSynced } */
const _cooldownCache = new Map<string, Map<string, {
  lastGrantedAt: number;
  todayTotal: number;
  todayDate: string;
  dbSynced: boolean;  // â DB'den baÅlangÄ±Ã§ deÄeri yÃ¼klendi mi?
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

// â SEC-MEM: Periyodik cache temizliÄi â lazy init, modÃ¼l yÃ¼klendiÄinde deÄil ilk kullanÄ±mda baÅlar
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
 * â DB-backed gÃ¼nlÃ¼k cap kontrolÃ¼.
 * Ä°lk Ã§aÄrÄ±da sp_transactions'tan bugÃ¼nkÃ¼ toplam Ã§ekilir.
 * App restart olsa bile doÄru cap korunur.
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
    // DB hatasÄ±nda in-memory devam et (graceful degradation)
    cache.dbSynced = true;
  }
}

/**
 * Cooldown ve gÃ¼nlÃ¼k cap kontrolÃ¼.
 * @returns true = verilebilir, false = sÄ±nÄ±r aÅÄ±ldÄ±
 */
async function _canGrant(userId: string, action: string): Promise<boolean> {
  const config = SP_REWARDS[action];
  if (!config) return false;

  const cache = _getCache(userId, action);

  // â Ä°lk Ã§aÄrÄ±da DB'den gÃ¼nlÃ¼k toplamÄ± senkronize et
  await _syncDailyTotalFromDB(userId, action);

  // Cooldown kontrolÃ¼
  if (config.cooldownMs > 0) {
    const elapsed = Date.now() - cache.lastGrantedAt;
    if (elapsed < config.cooldownMs) return false;
  }

  // GÃ¼nlÃ¼k cap kontrolÃ¼
  if (config.dailyCap > 0 && cache.todayTotal >= config.dailyCap) {
    return false;
  }

  return true;
}

/** Grant sonrasÄ± cache'i gÃ¼ncelle */
function _markGranted(userId: string, action: string, amount: number) {
  const cache = _getCache(userId, action);
  cache.lastGrantedAt = Date.now();
  cache.todayTotal += amount;
}

// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// SP KAZANDIRMA â TEK GÄ°RÄ°Å NOKTASI
// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

/**
 * â Tier bazlÄ± SP Ã§arpanÄ± â Pro: 2Ã, Plus: 1.25Ã, Free: 1Ã
 * Sadece aktivite bazlÄ± kazanÄ±mlarda uygulanÄ±r (baÄÄ±Å, satÄ±n alma hariÃ§).
 */
const SP_TIER_MULTIPLIER: Record<string, number> = {
  Free: 1,
  Plus: 1.25,
  Pro: 2,
  // â v1.7.13.132: GodMaster kaldÄ±rÄ±ldÄ± â admin SP bypass spendSP iÃ§inde uygulanÄ±r
};

/** KullanÄ±cÄ±nÄ±n tier'Ä±nÄ± hÄ±zlÄ±ca Ã§ek (cache'li) */
const _tierCache = new Map<string, { tier: string; ts: number }>();
async function _getUserTier(userId: string): Promise<string> {
  const cached = _tierCache.get(userId);
  if (cached && Date.now() - cached.ts < 5 * 60_000) return cached.tier; // 5dk cache
  try {
    // â v1.7.13.142: expires_at kontrolÃ¼ â sÃ¼resi dolmuÅ abonelik Free dÃ¶ner
    const { data } = await supabase
      .from('profiles')
      .select('subscription_tier, subscription_expires_at, is_admin')
      .eq('id', userId)
      .single();
    // Admin her zaman Pro
    if (data?.is_admin) {
      _tierCache.set(userId, { tier: 'Pro', ts: Date.now() });
      return 'Pro';
    }
    // SÃ¼resi dolmuÅ abonelik â Free'e dÃ¼ÅÃ¼r
    if (data?.subscription_expires_at && new Date(data.subscription_expires_at) <= new Date()) {
      _tierCache.set(userId, { tier: 'Free', ts: Date.now() });
      return 'Free';
    }
    const tier = data?.subscription_tier || 'Free';
    _tierCache.set(userId, { tier, ts: Date.now() });
    return tier;
  } catch {
    return 'Free';
  }
}

/**
 * â Y3: Tier cache invalidate â subscription purchase/downgrade/webhook sonrasÄ±
 * Ã§aÄrÄ±lmalÄ±. ÃaÄrÄ±lmadÄ±ÄÄ±nda user 5 dakika premium feature'lara eriÅmeye devam
 * edebilir. userId verilmezse tÃ¼m cache temizlenir.
 */
export function invalidateTierCache(userId?: string) {
  if (userId) _tierCache.delete(userId);
  else _tierCache.clear();
}

/**
 * SP kazandÄ±r â cooldown ve cap kontrollÃ¼.
 * â Pro: 2Ã Ã§arpan, Plus: 1.25Ã Ã§arpan (aktivite bazlÄ± kazanÄ±mlarda).
 * BaÅarÄ±lÄ±ysa kazandÄ±rÄ±lan miktarÄ± dÃ¶ndÃ¼rÃ¼r, baÅarÄ±sÄ±zsa 0.
 */
async function grantSP(userId: string, action: string, overrideAmount?: number, externalRef?: string, counterpartyId?: string | null, descriptionOverride?: string): Promise<number> {
  const config = SP_REWARDS[action];
  if (!config && !overrideAmount) return 0;

  let amount = overrideAmount ?? config?.amount ?? 0;
  if (amount <= 0) return 0;

  _ensureCacheCleanup();
  // Cooldown/cap kontrolÃ¼ â idempotent Ã§aÄrÄ±larda (externalRef ile) atla:
  // RevenueCat satÄ±n almasÄ± / refund zaten unique key ile korunuyor.
  if (!externalRef) {
    if (config && !(await _canGrant(userId, action))) return 0;
    if (!config) {
      const cache = _getCache(userId, action);
      const elapsed = Date.now() - cache.lastGrantedAt;
      if (elapsed < 60_000) return 0;
    }
  }

  // â Tier bazlÄ± SP Ã§arpanÄ± â sadece aktivite kazanÄ±mlarÄ±nda (tip, store_purchase gibi transfer'lerde DEÄÄ°L)
  const EXCLUDED_FROM_MULTIPLIER = ['tip_received', 'tip_refund', 'store_purchase', 'subscription_purchase', 'entry_fee_share', 'sp_purchase'];
  if (!EXCLUDED_FROM_MULTIPLIER.includes(action)) {
    try {
      const userTier = await _getUserTier(userId);
      const multiplier = SP_TIER_MULTIPLIER[userTier] || 1;
      if (multiplier > 1) {
        amount = Math.floor(amount * multiplier);
      }
    } catch { /* tier alÄ±namazsa Ã§arpan uygulanmaz */ }
  }

  // DB'ye yaz (atomik + transaction kaydÄ±)
  const persisted = await _persistSP(userId, amount, action, externalRef, counterpartyId, descriptionOverride);
  if (persisted) {
    _markGranted(userId, action, amount);
    return amount;
  }
  return 0;
}

/**
 * SP'yi veritabanÄ±na kaydet.
 * â Atomik persist + zorunlu transaction kaydÄ±.
 * â externalRef: idempotency key (satÄ±n alma / retry dedup iÃ§in). v20 RPC kullanÄ±lÄ±r.
 */
async function _persistSP(userId: string, amount: number, action: string, externalRef?: string, counterpartyId?: string | null, descriptionOverride?: string): Promise<boolean> {
  try {
    // YÃ¶ntem 1: RPC (tercih edilen â atomic + idempotent).
    // v20 migrasyonu sonrasÄ± external_ref varsa Ã§ifte harcama/verme engellenir.
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
        // â D4: GÃ¼nlÃ¼k cap durumunda kullanÄ±cÄ±ya aÃ§Ä±k bildirim (sessiz fail yerine)
        if (status === 'daily_cap') {
          try {
            const { showToast } = require('../components/Toast');
            showToast({ title: i18n.t('auto.gamification.006'), message: i18n.t('auto.gamification.005'), type: 'warning', duration: 3000 });
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
      // â RPC zaten sp_transactions'a yazÄ±yor â _logTransaction Ã§aÄÄ±rma (Ã§ift kayÄ±t Ã¶nleme)
      return true;
    }

    // YÃ¶ntem 2: Optimistic lock ile fallback (race condition korumalÄ±)
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

    if (__DEV__) console.warn(`[SP] Persist baÅarÄ±sÄ±z (conflict): ${userId} +${amount} (${action})`);
    return false;
  } catch (e) {
    if (__DEV__) console.warn('[SP] Persist hatasÄ±:', e);
    return false;
  }
}

/**
 * â Transaction kaydÄ± â dashboard SP Ã¶zeti ve realtime sync iÃ§in zorunlu.
 * Fire-and-forget (baÅarÄ±sÄ±zlÄ±k SP verilmesini engellemez).
 * externalRef: v20 Ã¶ncesi fallback yollarÄ±nda idempotency key saklamak iÃ§in.
 */
function _logTransaction(userId: string, amount: number, action: string, externalRef?: string, counterpartyId?: string | null, descriptionOverride?: string) {
  const payload: any = {
    user_id: userId,
    amount,
    type: action,
    description: descriptionOverride || (amount > 0 ? i18n.t('auto.gamification.004', { 0: action }) : i18n.t('auto.gamification.003', { 0: action })),
  };
  if (externalRef) payload.external_ref = externalRef;
  if (counterpartyId) payload.counterparty_id = counterpartyId;
  Promise.resolve(supabase.from('sp_transactions').insert(payload)).catch(() => {});
}

/**
 * SP harca â negatif bakiye kontrolÃ¼ + atomik.
 * â Admin (is_admin) kullanÄ±cÄ±lar iÃ§in SP dÃ¼ÅÃ¼rÃ¼lmez â sÄ±nÄ±rsÄ±z.
 * â externalRef: idempotency key â Ã§ift tÄ±klama / retry'da Ã§ift dÃ¼Åmeyi engeller.
 */
async function spendSP(userId: string, amount: number, reason: string, externalRef?: string, counterpartyId?: string | null, descriptionOverride?: string): Promise<{ success: boolean; remaining?: number; error?: string; duplicate?: boolean }> {
  try {
    // â Admin bypass â sÄ±nÄ±rsÄ±z SP (â v1.7.13.132: GodMaster kaldÄ±rÄ±ldÄ±, sadece is_admin)
    const { data: adminCheck } = await supabase
      .from('profiles')
      .select('is_admin, system_points')
      .eq('id', userId)
      .single();
    if (adminCheck?.is_admin) {
      _logTransaction(userId, 0, `${reason} [ADMIN BYPASS]`, externalRef, counterpartyId, descriptionOverride);
      return { success: true, remaining: adminCheck.system_points || 999999 };
    }

    // YÃ¶ntem 1: v20 idempotent RPC (externalRef verildiyse)
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

    // YÃ¶ntem 2: Legacy RPC (atomic)
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
      // â RPC zaten sp_transactions'a yazÄ±yor â _logTransaction Ã§aÄÄ±rma (Ã§ift kayÄ±t Ã¶nleme)
      return { success: true, remaining };
    }

    // YÃ¶ntem 3: Optimistic lock fallback
    const MAX_RETRIES = 2;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('system_points')
        .eq('id', userId)
        .single();

      if (!profile) return { success: false, error: i18n.t('auto.gamification.002') };
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

    return { success: false, error: i18n.t('auto.gamification.001') };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// SP TETÄ°KLEYÄ°CÄ°LER (Public API)
// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

export const GamificationService = {
  // ââ Temel KazanÄ±m ââ

  /** GÃ¼nlÃ¼k giriÅ (24 saat cooldown) */
  async onDailyLogin(userId: string): Promise<number> {
    return grantSP(userId, 'daily_login');
  },

  /** Prime-time geri dÃ¶nÃ¼Å (19:00-22:00, 3 saat cooldown) */
  async onPrimeTimeReturn(userId: string): Promise<number> {
    if (!isPrimeTime()) return 0;
    return grantSP(userId, 'prime_time_return');
  },

  /** Sahnede 10 dakika geÃ§irme */
  async onStageTime(userId: string): Promise<number> {
    return grantSP(userId, 'stage_time');
  },

  /** Kamera 10 dakika aÃ§Ä±k */
  async onCameraTime(userId: string): Promise<number> {
    return grantSP(userId, 'camera_time');
  },

  /** Mesaj gÃ¶nderme (60 sn cooldown) */
  async onMessageSent(userId: string): Promise<number> {
    return grantSP(userId, 'message_sent');
  },

  /** Oda oluÅturma */
  async onRoomCreate(userId: string): Promise<number> {
    const sp = await grantSP(userId, 'room_create');
    // â Badge Engine: host_1 / host_10 / host_100 kontrol
    try { const { checkHostBadges } = require('./badgeEngine'); checkHostBadges(userId); } catch {}
    return sp;
  },

  // â 2026-04-26: onWallPost kaldÄ±rÄ±ldÄ± â oda duvarÄ±/post sistemi kullanÄ±cÄ± kararÄ±yla silindi.

  // ââ Yeni Tetikleyiciler ââ

  /** Yeni oda takipÃ§isi kazanma */
  async onFollowerGain(userId: string): Promise<number> {
    return grantSP(userId, 'follower_gain');
  },

  /**
   * CCU milestone kontrolÃ¼ (10/25/50 kiÅi).
   * Birden fazla milestone aynÄ± anda geÃ§ilebilir.
   * @returns Toplam kazanÄ±lan SP
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
   * Ãyelik satÄ±n alma SP bonusu â "karÅÄ±lama bonusu" pattern.
   * â v1.7.13.137 SECURITY FIX: externalRef ile lifetime tek-sefer.
   *   Ãnceki kod idempotency yoktu â kullanÄ±cÄ± al-iptal-al ile sÄ±nÄ±rsÄ±z bonus alÄ±rdÄ±
   *   (Plus 600 Ã 12/yÄ±l = 7200 SP istismar).
   *   Åimdi her tier iÃ§in kullanÄ±cÄ± bazlÄ± lifetime tek bonus (welcome pattern).
   *   Plus alÄ±r â 600 SP. Plus iptal â Plus tekrar â 0. Pro upgrade â 1500 SP.
   */
  async onSubscriptionPurchase(userId: string, tier: SubscriptionTier): Promise<number> {
    const bonus = SUBSCRIPTION_SP_BONUS[tier] || 0;
    if (bonus <= 0) return 0;
    const externalRef = `welcome_bonus:${tier}:${userId}`;
    return grantSP(userId, 'subscription_purchase', bonus, externalRef);
  },

  /** MaÄaza alÄ±ÅveriÅi SP bonusu (tutar Ã 1) */
  async onStorePurchase(userId: string, purchaseAmount: number): Promise<number> {
    const bonus = Math.floor(purchaseAmount); // â Eskiden Ã2 idi, Åimdi Ã1 (endÃ¼stri normu)
    if (bonus <= 0) return 0;
    return grantSP(userId, 'store_purchase', bonus);
  },

  /** Referral bonusu */
  async onReferral(userId: string): Promise<number> {
    return grantSP(userId, 'referral');
  },

  // ââ Oda Sahibi Bonus ââ

  /**
   * Oda sahibine saatlik bonus hesapla ve ver.
   * GÃ¼nlÃ¼k cap: 80 SP
   */
  async grantOwnerBonus(
    userId: string,
    followerCount: number,
    concurrentUsers: number,
    totalListenMinutes: number,
  ): Promise<number> {
    const bonus = calculateOwnerBonus(followerCount, concurrentUsers, totalListenMinutes);
    if (bonus <= 0) return 0;

    // GÃ¼nlÃ¼k cap kontrolÃ¼ (DB-backed)
    await _syncDailyTotalFromDB(userId, 'owner_bonus');
    const cache = _getCache(userId, 'owner_bonus');
    const remainingCap = OWNER_BONUS_DAILY_CAP - cache.todayTotal;
    if (remainingCap <= 0) return 0;

    const cappedBonus = Math.min(bonus, remainingCap);
    const granted = await grantSP(userId, 'owner_bonus', cappedBonus);
    if (granted > 0) _markGranted(userId, 'owner_bonus', granted);
    return granted;
  },

  // ââ SP Harcama ââ

  /** KeÅfet boost satÄ±n al (SP ile) â â Fiyat dÃ¼ÅÃ¼rÃ¼ldÃ¼: eriÅilebilirlik artÄ±rÄ±ldÄ± */
  async purchaseRoomBoost(userId: string, durationHours: 1 | 6): Promise<{ success: boolean; error?: string }> {
    const cost = durationHours === 1 ? 50 : 200; // â Eski: 100/400 â Yeni: 50/200
    return spendSP(userId, cost, 'room_boost');
  },

  /** ÃerÃ§eve kilit aÃ§ (SP ile) */
  async purchaseFrameUnlock(userId: string, cost: number): Promise<{ success: boolean; error?: string }> {
    return spendSP(userId, cost, 'frame_unlock');
  },

  /** Efekt kilit aÃ§ (SP ile) */
  async purchaseEffectUnlock(userId: string, cost: number): Promise<{ success: boolean; error?: string }> {
    return spendSP(userId, cost, 'effect_unlock');
  },

  /** Genel SP harcama */
  async spend(userId: string, amount: number, reason: string, externalRef?: string, counterpartyId?: string | null, descriptionOverride?: string): Promise<{ success: boolean; remaining?: number; error?: string; duplicate?: boolean }> {
    return spendSP(userId, amount, reason, externalRef, counterpartyId, descriptionOverride);
  },

  /**
   * Genel SP kazandÄ±rma (baÄÄ±Å alÄ±cÄ±sÄ±, Ã¶dÃ¼l, satÄ±n alma vb.).
   * externalRef: idempotency key â RevenueCat transactionId veya dahili UUID.
   * AynÄ± externalRef ile ikinci Ã§aÄrÄ± no-op dÃ¶ner (K5/K6 korumasÄ±).
   */
  async earn(userId: string, amount: number, reason: string, externalRef?: string, counterpartyId?: string | null, descriptionOverride?: string): Promise<number> {
    return grantSP(userId, reason, amount, externalRef, counterpartyId, descriptionOverride);
  },

  // ââ YardÄ±mcÄ±lar ââ

  /** KullanÄ±cÄ±nÄ±n gÃ¼ncel SP bakiyesi */
  async getBalance(userId: string): Promise<number> {
    const { data } = await supabase
      .from('profiles')
      .select('system_points')
      .eq('id', userId)
      .single();
    return data?.system_points || 0;
  },

  /** SP iÅlem geÃ§miÅi â counterparty profilini de ekle (kim gÃ¶nderdi/aldÄ± gÃ¶stermek iÃ§in) */
  async getTransactionHistory(userId: string, limit = 20) {
    // â Iki aÅamalÄ± sorgu â embedded select FK schema cache'e baÄlÄ± olduÄundan,
    //   counterparty join'i ayrÄ± query ile Ã§ekip manuel merge ediyoruz (resilient).
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
