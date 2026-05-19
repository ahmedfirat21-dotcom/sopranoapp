/**
 * SopranoChat — Badge Servisi (Faz 6.3)
 * ═══════════════════════════════════════════════════
 * user_badges tablosu okuma + award RPC wrapper.
 *
 * Tasarım:
 *   - getBadgesForUser → BadgeDef[] (catalog ile resolve edilir, bilinmeyenler atlanır)
 *   - awardBadge → award_badge RPC (idempotent, kendi UID'i için)
 *   - 60s per-user cache — profil sayfasında flicker engellenir
 */
import { supabase } from '../constants/supabase';
import { BADGES, resolveBadges, sortBadgesByRarity, type BadgeDef } from '../constants/badges';
import { i18n } from './i18n';

export interface BadgeWithStatus {
  badge: BadgeDef;
  earned: boolean;
  awardedAt?: string;
}

interface AwardedBadge {
  badge_id: string;
  awarded_at: string;
}

const _cache = new Map<string, { badges: BadgeDef[]; expires: number }>();
const CACHE_TTL_MS = 60_000;

export const BadgeService = {
  /**
   * Bir kullanıcının rozetleri. BadgeDef olarak döner (icon/color/rarity ile).
   * Sıralama: rarity DESC (legendary → common).
   */
  async getBadgesForUser(userId: string): Promise<BadgeDef[]> {
    if (!userId) return [];
    const cached = _cache.get(userId);
    if (cached && cached.expires > Date.now()) return cached.badges;

    const { data, error } = await supabase
      .from('user_badges')
      .select('badge_id, awarded_at')
      .eq('user_id', userId)
      .order('awarded_at', { ascending: false });
    if (error) {
      if (__DEV__) console.warn('[BadgeService] getBadgesForUser:', error.message);
      return [];
    }
    const ids = (data as AwardedBadge[] | null || []).map(r => r.badge_id);
    const resolved = sortBadgesByRarity(resolveBadges(ids));
    _cache.set(userId, { badges: resolved, expires: Date.now() + CACHE_TTL_MS });
    return resolved;
  },

  /**
   * Birden fazla kullanıcı için badge'leri toplu çek (leaderboard / search'te).
   * Returns: { userId: BadgeDef[] }
   */
  async getBadgesForUsers(userIds: string[]): Promise<Record<string, BadgeDef[]>> {
    if (userIds.length === 0) return {};
    const { data, error } = await supabase
      .from('user_badges')
      .select('user_id, badge_id, awarded_at')
      .in('user_id', userIds)
      .order('awarded_at', { ascending: false });
    if (error) return {};
    const map: Record<string, string[]> = {};
    for (const row of data || []) {
      const r = row as any;
      if (!map[r.user_id]) map[r.user_id] = [];
      map[r.user_id].push(r.badge_id);
    }
    const out: Record<string, BadgeDef[]> = {};
    for (const [uid, ids] of Object.entries(map)) {
      out[uid] = sortBadgesByRarity(resolveBadges(ids));
    }
    return out;
  },

  /**
   * Idempotent rozet ver.
   * ★ 2026-04-25 FIX: RPC tip uyumsuzluğu ("boolean > integer") nedeniyle
   *   doğrudan INSERT ON CONFLICT DO NOTHING kullanılır.
   *   unique(user_id, badge_id) constraint idempotent davranır.
   */
  async awardBadge(userId: string, badgeId: string): Promise<{ awarded: boolean; error?: string }> {
    if (!userId || !badgeId) return { awarded: false, error: i18n.t('auto.badges.001') };
    try {
      // Önce zaten var mı kontrol et — gereksiz INSERT önlenir
      const { data: existing } = await supabase
        .from('user_badges')
        .select('badge_id')
        .eq('user_id', userId)
        .eq('badge_id', badgeId)
        .maybeSingle();
      if (existing) {
        // Zaten verilmiş — idempotent no-op
        return { awarded: false };
      }

      // INSERT — unique constraint çakışması durumunda sessiz geç
      const { error } = await supabase
        .from('user_badges')
        .insert({
          user_id: userId,
          badge_id: badgeId,
          awarded_at: new Date().toISOString(),
        });

      if (error) {
        // Unique violation = zaten var → idempotent başarı
        if (error.code === '23505') return { awarded: false };
        if (__DEV__) console.warn('[BadgeService] awardBadge:', error.message);
        return { awarded: false, error: error.message };
      }

      _cache.delete(userId);
      return { awarded: true };
    } catch (e: any) {
      return { awarded: false, error: e?.message };
    }
  },

  invalidateCache(userId: string) { _cache.delete(userId); },

  /**
   * ★ v1.7.13.46 (19 May 2026): TÜM rozetleri "earned/locked" status ile döner.
   * Kullanıcı arayüzünde hem sahip olduğu rozetler hem kilitliler gösterilebilsin.
   * Sıralama: önce kazanılanlar (rarity DESC), sonra kilitliler (rarity DESC).
   */
  async getAllBadgesWithStatus(userId: string): Promise<BadgeWithStatus[]> {
    if (!userId) {
      // userId yoksa: hepsi locked olarak dön
      return sortBadgesByRarity(Object.values(BADGES)).map(b => ({ badge: b, earned: false }));
    }
    const { data, error } = await supabase
      .from('user_badges')
      .select('badge_id, awarded_at')
      .eq('user_id', userId);
    if (error) {
      if (__DEV__) console.warn('[BadgeService] getAllBadgesWithStatus:', error.message);
      return sortBadgesByRarity(Object.values(BADGES)).map(b => ({ badge: b, earned: false }));
    }
    const earnedMap = new Map<string, string>(
      ((data as AwardedBadge[] | null) || []).map(r => [r.badge_id, r.awarded_at])
    );
    const all = Object.values(BADGES);
    const earned = sortBadgesByRarity(all.filter(b => earnedMap.has(b.id)))
      .map(b => ({ badge: b, earned: true, awardedAt: earnedMap.get(b.id) }));
    const locked = sortBadgesByRarity(all.filter(b => !earnedMap.has(b.id)))
      .map(b => ({ badge: b, earned: false }));
    return [...earned, ...locked];
  },
};
