/**
 * SopranoChat — Hediye İstatistikleri Servisi
 * ═══════════════════════════════════════════════════════════════════
 * v107 (4 May 2026) — room_live_gifts kayıtlarından profil vitrin'i,
 * gönderen/alan sayımları ve leaderboard verisini sağlar.
 *
 * Kayıt yapısı (room_live_gifts):
 *   id, room_id (nullable), sender_id, receiver_id, gift_id, amount, created_at
 *
 * Tüm sorgular son 30 gün ile sınırlı (TTL eşdeğeri performans).
 */

import { supabase } from '../constants/supabase';
import { i18n } from '../../services/i18n';

const WINDOW_DAYS = 30;
const cutoffISO = () => new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

export interface GiftAggregate {
  gift_id: string;
  count: number;
  total_amount: number;
  /** cosmetic_items.art_emoji */
  art_emoji?: string;
  /** cosmetic_items.art_color */
  art_color?: string;
  /** cosmetic_items.name */
  name?: string;
}

export interface TopGifter {
  user_id: string;
  display_name: string;
  avatar_url: string;
  active_frame: string | null;
  active_badge_id: string | null;
  subscription_tier: string;
  total_amount: number;
  count: number;
}

export const GiftStatsService = {
  /**
   * Bir kullanıcının ALDIĞI hediyeleri grupla — vitrin için.
   */
  async getReceivedGifts(userId: string, limit = 12): Promise<GiftAggregate[]> {
    if (!userId) return [];
    const { data, error } = await supabase
      .from('room_live_gifts')
      .select('gift_id, amount')
      .eq('receiver_id', userId)
      .gte('created_at', cutoffISO())
      .limit(500);
    if (error || !data) return [];
    return aggregateAndEnrich(data as any[], limit);
  },

  /**
   * Bir kullanıcının VERDİĞİ hediyeleri grupla — gönderen vitrin (cömertlik göstergesi).
   */
  async getSentGifts(userId: string, limit = 12): Promise<GiftAggregate[]> {
    if (!userId) return [];
    const { data, error } = await supabase
      .from('room_live_gifts')
      .select('gift_id, amount')
      .eq('sender_id', userId)
      .gte('created_at', cutoffISO())
      .limit(500);
    if (error || !data) return [];
    return aggregateAndEnrich(data as any[], limit);
  },

  /**
   * Top Gifter — toplam SP değeri (amount) bazlı sıralama. Lider tablosu için.
   */
  async getTopGifters(limit = 10): Promise<TopGifter[]> {
    const { data, error } = await supabase
      .from('room_live_gifts')
      .select('sender_id, amount')
      .gte('created_at', cutoffISO())
      .limit(2000);
    if (error || !data) return [];
    const map: Record<string, { total: number; count: number }> = {};
    for (const r of data as any[]) {
      if (!r.sender_id) continue;
      if (!map[r.sender_id]) map[r.sender_id] = { total: 0, count: 0 };
      map[r.sender_id].total += r.amount || 0;
      map[r.sender_id].count += 1;
    }
    const sorted = Object.entries(map)
      .sort(([, a], [, b]) => b.total - a.total)
      .slice(0, limit);
    if (sorted.length === 0) return [];
    const userIds = sorted.map(([uid]) => uid);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, active_frame, active_badge_id, subscription_tier')
      .in('id', userIds);
    const profMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    return sorted.map(([uid, agg]) => {
      const p: any = profMap.get(uid);
      return {
        user_id: uid,
        display_name: p?.display_name || i18n.t('auto.giftStats.001'),
        avatar_url: p?.avatar_url || '',
        active_frame: p?.active_frame || null,
        active_badge_id: p?.active_badge_id || null,
        subscription_tier: p?.subscription_tier || 'Free',
        total_amount: agg.total,
        count: agg.count,
      };
    });
  },

  /**
   * Toplam aldığı hediye SP değeri — kart üstündeki rozet için tek sayı.
   * ★ v110.5.5 (6 May 2026): room_live_gifts boş → sp_transactions'tan oku.
   *    Hediyeler ('gift_received') + bağışlar ('donation_received') birleşik.
   */
  async getReceivedTotal(userId: string): Promise<{ total_amount: number; count: number }> {
    if (!userId) return { total_amount: 0, count: 0 };
    const { data, error } = await supabase
      .from('sp_transactions')
      .select('amount')
      .eq('user_id', userId)
      .in('type', ['gift_received', 'donation_received']);
    if (error || !data) return { total_amount: 0, count: 0 };
    let total = 0;
    for (const r of data as any[]) total += Math.abs(r.amount || 0);
    return { total_amount: total, count: data.length };
  },

  /**
   * Toplam verdiği hediye SP değeri — profil stats için.
   * ★ v110.5.5: sp_transactions kaynaklı.
   */
  async getSentTotal(userId: string): Promise<{ total_amount: number; count: number }> {
    if (!userId) return { total_amount: 0, count: 0 };
    const { data, error } = await supabase
      .from('sp_transactions')
      .select('amount')
      .eq('user_id', userId)
      .in('type', ['gift_sent', 'donation_sent']);
    if (error || !data) return { total_amount: 0, count: 0 };
    let total = 0;
    for (const r of data as any[]) total += Math.abs(r.amount || 0);
    return { total_amount: total, count: data.length };
  },
};

// ─── helpers ────────────────────────────────────────────────────
async function aggregateAndEnrich(rows: { gift_id: string; amount: number }[], limit: number): Promise<GiftAggregate[]> {
  const map: Record<string, { count: number; total: number }> = {};
  for (const r of rows) {
    if (!r.gift_id) continue;
    if (!map[r.gift_id]) map[r.gift_id] = { count: 0, total: 0 };
    map[r.gift_id].count += 1;
    map[r.gift_id].total += r.amount || 0;
  }
  const sorted = Object.entries(map)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, limit);
  if (sorted.length === 0) return [];
  const giftIds = sorted.map(([id]) => id);
  const { data: items } = await supabase
    .from('cosmetic_items')
    .select('id, art_emoji, art_color, name')
    .in('id', giftIds);
  const itemMap = new Map((items || []).map((i: any) => [i.id, i]));
  return sorted.map(([id, agg]) => {
    const item: any = itemMap.get(id);
    return {
      gift_id: id,
      count: agg.count,
      total_amount: agg.total,
      art_emoji: item?.art_emoji || '✨',
      art_color: item?.art_color || '#FBBF24',
      name: item?.name || 'Hediye',
    };
  });
}
