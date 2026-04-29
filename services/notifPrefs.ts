/**
 * SopranoChat — Notification Preferences (Faz 5.1)
 * ═══════════════════════════════════════════════════
 * notification_preferences (v62) tablosunun servis katmanı.
 * PushService send'leri burada gate'lenir.
 *
 * Tablo: public.notification_preferences
 *   - dnd_start_hour, dnd_end_hour (0-23) — Do Not Disturb zaman penceresi
 *   - friends_only (BOOLEAN) — sadece arkadaşlardan bildirim al
 *   - room_invites, dm_messages, stage_invites, sp_received, friend_online (BOOLEAN)
 *   - email_enabled, email_weekly_digest (BOOLEAN)
 *   - timezone (TEXT, default 'Europe/Istanbul')
 *
 * Tasarım:
 *   - Default davranış: tüm kategoriler ON, DND OFF.
 *     Tablo'da row yoksa default'lara düşer (kullanıcı hiç ayar açmamış).
 *   - DND penceresi: dnd_start_hour..dnd_end_hour. Wraparound destekli
 *     (örn. 22→07 gece boyu sessiz).
 *   - incoming_call zamanlama-kritik — DND ve friends_only bypass eder.
 *   - friends_only kontrolü: senderId verilmişse friendships sorgusu.
 *
 * Önbellek: per-user 30sn in-memory cache; her push gönderiminde DB
 * sorgusu yapılmaması için.
 */
import { supabase } from '../constants/supabase';

export type NotificationCategory =
  | 'room_invite'
  | 'dm'
  | 'stage_invite'
  | 'sp_received'
  | 'friend_online'
  // Aşağıdakiler her zaman gönderilir (kritik):
  | 'incoming_call'
  | 'follow'           // Arkadaşlık isteği
  | 'follow_accepted'
  | 'follow_rejected'
  | 'message_request';

export interface NotificationPreferences {
  user_id: string;
  dnd_start_hour: number | null;
  dnd_end_hour: number | null;
  friends_only: boolean;
  room_invites: boolean;
  dm_messages: boolean;
  stage_invites: boolean;
  sp_received: boolean;
  friend_online: boolean;
  email_enabled: boolean;
  email_weekly_digest: boolean;
  timezone: string;
}

export const DEFAULT_PREFERENCES: Omit<NotificationPreferences, 'user_id'> = {
  dnd_start_hour: null,
  dnd_end_hour: null,
  friends_only: false,
  room_invites: true,
  dm_messages: true,
  stage_invites: true,
  sp_received: true,
  friend_online: true,
  email_enabled: true,
  email_weekly_digest: false,
  timezone: 'Europe/Istanbul',
};

// ── Cache (per-user, 30s) ────────────────────────────────────────
const _cache = new Map<string, { prefs: NotificationPreferences; expires: number }>();
const CACHE_TTL_MS = 30_000;

function _cacheKey(userId: string) { return userId; }

function _invalidate(userId: string) {
  _cache.delete(_cacheKey(userId));
}

// ── Helpers ──────────────────────────────────────────────────────

/** Saatin DND penceresi içinde olup olmadığını kontrol eder. Wraparound destekli. */
export function isHourInDndWindow(hour: number, start: number | null, end: number | null): boolean {
  if (start == null || end == null) return false;
  if (start === end) return false; // 0-süre pencere → kapalı kabul
  if (start < end) {
    // Aynı gün: 09..17 → saat 9-16:59 dahil
    return hour >= start && hour < end;
  }
  // Wraparound: 22..07 → 22-23 OR 0-6
  return hour >= start || hour < end;
}

/** Kategori → preferences boolean alanı eşlemesi. Bilinmeyen kategori → her zaman göndererek opt-out önler. */
function _resolveCategoryEnabled(cat: NotificationCategory, prefs: NotificationPreferences): boolean {
  switch (cat) {
    case 'room_invite':   return prefs.room_invites;
    case 'dm':            return prefs.dm_messages;
    case 'stage_invite':  return prefs.stage_invites;
    case 'sp_received':   return prefs.sp_received;
    case 'friend_online': return prefs.friend_online;
    // Bypass kategorileri — kullanıcı kapatamaz
    case 'incoming_call':
    case 'follow':
    case 'follow_accepted':
    case 'follow_rejected':
    case 'message_request':
      return true;
    default:
      return true;
  }
}

/** Bypass kategorileri DND ve friends_only'i atlar. */
function _isBypassCategory(cat: NotificationCategory): boolean {
  return cat === 'incoming_call'
    || cat === 'follow'
    || cat === 'follow_accepted'
    || cat === 'follow_rejected'
    || cat === 'message_request';
}

// ── Service ──────────────────────────────────────────────────────
export const NotifPrefsService = {
  /** Tercihleri getir; row yoksa DEFAULT_PREFERENCES dön. */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    if (!userId) return { ...DEFAULT_PREFERENCES, user_id: '' };

    const cached = _cache.get(_cacheKey(userId));
    if (cached && cached.expires > Date.now()) return cached.prefs;

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    let prefs: NotificationPreferences;
    if (error || !data) {
      prefs = { ...DEFAULT_PREFERENCES, user_id: userId };
    } else {
      prefs = { ...DEFAULT_PREFERENCES, ...(data as any), user_id: userId };
    }
    _cache.set(_cacheKey(userId), { prefs, expires: Date.now() + CACHE_TTL_MS });
    return prefs;
  },

  /** Upsert — partial alanlar verilebilir, default'lar korunur. */
  async updatePreferences(
    userId: string,
    partial: Partial<Omit<NotificationPreferences, 'user_id'>>
  ): Promise<{ success: boolean; error?: string }> {
    if (!userId) return { success: false, error: 'Geçersiz kullanıcı.' };

    const payload = {
      user_id: userId,
      ...partial,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('notification_preferences')
      .upsert(payload, { onConflict: 'user_id' });

    if (error) {
      if (__DEV__) console.warn('[NotifPrefs] update:', error.message);
      return { success: false, error: error.message };
    }
    _invalidate(userId);
    return { success: true };
  },

  /**
   * Bu push gönderilmeli mi? Sıralı kontrol:
   *   1. Bypass kategoriler her zaman geçer (incoming_call vs.)
   *   2. Kullanıcı kategoriyi kapatmışsa: HAYIR
   *   3. friends_only ON ise senderId arkadaş değilse: HAYIR
   *   4. DND penceresindeyse: HAYIR
   *   5. Aksi halde: EVET
   *
   * Fail-open: prefs okuma hatasında `true` döner — kullanıcı bildirim
   * almaya devam eder (sessiz failure tercih edilmez).
   */
  async shouldSendPush(
    targetUserId: string,
    category: NotificationCategory,
    senderUserId?: string,
  ): Promise<boolean> {
    if (!targetUserId) return false;

    // Bypass — DND + friends_only ile kesilmez
    if (_isBypassCategory(category)) return true;

    let prefs: NotificationPreferences;
    try {
      prefs = await this.getPreferences(targetUserId);
    } catch {
      return true; // fail-open
    }

    // Kategori toggle
    if (!_resolveCategoryEnabled(category, prefs)) return false;

    // friends_only — sadece arkadaşlardan
    if (prefs.friends_only && senderUserId && senderUserId !== targetUserId) {
      try {
        const { data } = await supabase
          .from('friendships')
          .select('status')
          .or(
            `and(user_id.eq.${targetUserId},friend_id.eq.${senderUserId}),and(user_id.eq.${senderUserId},friend_id.eq.${targetUserId})`
          )
          .eq('status', 'accepted')
          .limit(1)
          .maybeSingle();
        if (!data) return false;
      } catch { /* friendship sorgusu başarısızsa fail-open: gönder */ }
    }

    // DND penceresi (kullanıcının yerel saatini hesaba katmak için timezone)
    if (prefs.dnd_start_hour != null && prefs.dnd_end_hour != null) {
      const tz = prefs.timezone || 'Europe/Istanbul';
      const hour = _hourInTimezone(new Date(), tz);
      if (isHourInDndWindow(hour, prefs.dnd_start_hour, prefs.dnd_end_hour)) {
        return false;
      }
    }

    return true;
  },

  /** Cache invalidation — settings ekranı save sonrası. */
  invalidateCache(userId: string) { _invalidate(userId); },
};

/** TZ-aware saat (Intl.DateTimeFormat ile). RN Hermes Intl support varsayılır. */
function _hourInTimezone(d: Date, tz: string): number {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz });
    const parts = fmt.formatToParts(d);
    const h = parts.find(p => p.type === 'hour')?.value;
    if (h != null) return Math.min(23, Math.max(0, parseInt(h, 10) % 24));
  } catch { /* RN bazı sürümlerde TZ desteği eksik */ }
  return d.getHours();
}
