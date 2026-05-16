/**
 * SopranoChat — Server-Side Rate Limit Servisi (Faz 2.2)
 * ═══════════════════════════════════════════════════
 * v64 RPC'lerinin TS wrapper'ı. Client tarafında kullanım:
 *   const r = await RateLimitService.checkAndIncrement('room_create', userId);
 *   if (!r.allowed) { showToast('Çok hızlısın'); return; }
 *
 * Standart action sözleşmesi (ACTIONS sabiti) — magic string yasak.
 *
 * Tasarım:
 *   - SECURITY DEFINER RPC, RLS bypass eder ama caller user_id'yi
 *     kendi auth uid'i olarak geçirir (firebase-supabase köprüsü zaten
 *     auth.uid()::text = profile.id varsayar).
 *   - Network başarısızsa (offline / RPC yok) FAIL-OPEN davran:
 *     yani limit kontrolü yapamadıysak eylem geçer. Bu, prod'da
 *     RPC silinirse uygulamanın komple çökmemesi için.
 *     (Strict isteyen action'larda caller fail-closed yapabilir.)
 */
import { supabase } from '../constants/supabase';
import { i18n } from '../../services/i18n';

export type RateLimitAction =
  | 'room_create'
  | 'gift_send'
  | 'voice_dm_send'
  | 'message_send'
  | 'friend_request'
  | 'report';

/** Action başına limit + pencere — server tarafında bağlayıcı değil; caller geçirir. */
export const RATE_LIMIT_CONFIG: Record<RateLimitAction, { maxCount: number; windowSeconds: number; userMessage: string }> = {
  room_create:    { maxCount: 5,  windowSeconds: 3600, userMessage: i18n.t('auto.rateLimit.007') },
  gift_send:      { maxCount: 30, windowSeconds: 60,   userMessage: i18n.t('auto.rateLimit.006') },
  voice_dm_send:  { maxCount: 20, windowSeconds: 300,  userMessage: i18n.t('auto.rateLimit.005') },
  message_send:   { maxCount: 60, windowSeconds: 60,   userMessage: i18n.t('auto.rateLimit.004') },
  friend_request: { maxCount: 30, windowSeconds: 3600, userMessage: i18n.t('auto.rateLimit.003') },
  report:         { maxCount: 10, windowSeconds: 3600, userMessage: i18n.t('auto.rateLimit.002') },
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date | null;
  /** Server hatası varsa fail-open: allowed=true ama serverError=true. */
  serverError?: boolean;
  /** UI için Türkçe mesaj — RATE_LIMIT_CONFIG'den. */
  message?: string;
}

export const RateLimitService = {
  /**
   * Atomik: increment + decision. Limit aşıldıysa allowed=false.
   * userId genelde firebaseUser.uid; eşleşme: auth.uid()::text = profile.id.
   */
  async checkAndIncrement(
    action: RateLimitAction,
    userId: string,
    overrides?: { maxCount?: number; windowSeconds?: number }
  ): Promise<RateLimitResult> {
    if (!userId) {
      return { allowed: false, remaining: 0, resetAt: null, message: i18n.t('auto.rateLimit.001') };
    }
    const cfg = RATE_LIMIT_CONFIG[action];
    const maxCount = overrides?.maxCount ?? cfg.maxCount;
    const windowSeconds = overrides?.windowSeconds ?? cfg.windowSeconds;

    try {
      const { data, error } = await supabase.rpc('check_and_increment_rate_limit', {
        p_user_id: userId,
        p_action: action,
        p_max_count: maxCount,
        p_window_seconds: windowSeconds,
      });
      if (error) {
        if (__DEV__) console.warn('[RateLimit] RPC error:', error.message);
        // Fail-open: server'a ulaşamadıysa eyleme izin ver
        return { allowed: true, remaining: maxCount, resetAt: null, serverError: true };
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        return { allowed: true, remaining: maxCount, resetAt: null, serverError: true };
      }
      return {
        allowed: !!row.allowed,
        remaining: Number(row.remaining || 0),
        resetAt: row.reset_at ? new Date(row.reset_at) : null,
        message: row.allowed ? undefined : cfg.userMessage,
      };
    } catch (e: any) {
      if (__DEV__) console.warn('[RateLimit] catch:', e?.message);
      return { allowed: true, remaining: maxCount, resetAt: null, serverError: true };
    }
  },

  /** Sadece okur, increment yapmaz. UI ipucu için. */
  async getStatus(
    action: RateLimitAction,
    userId: string,
  ): Promise<{ remaining: number; resetAt: Date | null; inWindow: boolean }> {
    if (!userId) return { remaining: 0, resetAt: null, inWindow: false };
    const cfg = RATE_LIMIT_CONFIG[action];
    try {
      const { data, error } = await supabase.rpc('get_rate_limit_status', {
        p_user_id: userId,
        p_action: action,
        p_max_count: cfg.maxCount,
        p_window_seconds: cfg.windowSeconds,
      });
      if (error) return { remaining: cfg.maxCount, resetAt: null, inWindow: false };
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return { remaining: cfg.maxCount, resetAt: null, inWindow: false };
      return {
        remaining: Number(row.remaining || 0),
        resetAt: row.reset_at ? new Date(row.reset_at) : null,
        inWindow: !!row.in_window,
      };
    } catch {
      return { remaining: cfg.maxCount, resetAt: null, inWindow: false };
    }
  },
};
