// ★ v107 (3 May 2026): Maison Soprano mağaza servisi.
//
// Backend: cosmetic_items + collections + user_inventory + store_purchase RPC.
// Render verisi tamamen DB'den okunur.

import { supabase } from '../constants/supabase';
import { logger } from '../utils/logger';
import { i18n } from '../../services/i18n';

export type Rarity = 'divine' | 'mythic' | 'legendary' | 'rare' | 'new';

export interface CosmeticItem {
  id: string;
  category: string;
  rarity: Rarity | null;
  name: string;
  meta: string | null;
  tagline: string | null;
  art_emoji: string | null;
  art_color: string | null;
  bg_gradient_start: string | null;
  bg_gradient_mid: string | null;
  bg_gradient_end: string | null;
  bg_radial: string | null;
  price_sp: number;
  per_message: boolean;
  is_featured: boolean;
  collection_id: string | null;
  display_order: number;
  // ★ v108.21: Limited edition + FOMO
  available_until: string | null;
  max_supply: number | null;
  sold_count: number;
  launched_at: string | null;
  // ★ v109.2: Tier-lock — Free dışı tier zorunluluğu (divine = Plus min, vb.)
  min_tier?: 'Free' | 'Plus' | 'Pro' | 'GodMaster' | null;
}

export interface Collection {
  id: string;
  name: string;
  tag: string | null;
  art_emoji: string | null;
  art_color: string | null;
  bg_gradient_start: string | null;
  bg_gradient_end: string | null;
  display_order: number;
}

export interface CosmeticBundle {
  id: string;
  name: string;
  tagline: string | null;
  art_emoji: string | null;
  art_color: string | null;
  bg_gradient_start: string | null;
  bg_gradient_end: string | null;
  rarity: Rarity | null;
  total_price_sp: number;
  discount_pct: number;
  sort_order: number;
  item_ids: string[];
}

export interface BundlePurchaseResult {
  success: boolean;
  error?: string;
  cost?: number;
  list_price?: number;
  discount_pct?: number;
  tier?: string;
  bundle_name?: string;
  items_added?: number;
  items_skipped?: number;
  new_balance?: number;
  already_owned?: boolean;
  required?: number;
  balance?: number;
}

export interface DailyDeal {
  deal_date: string;
  item_id: string;
  extra_discount_pct: number;
  banner_text: string | null;
}

export interface SPPack {
  id: string;
  tier_name: string;
  tier_key: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  tier_color: string;
  sp_amount: number;
  bonus_sp: number;
  bonus_pct: number | null;
  price_try: number;
  fiat_label: string;
  popular: boolean;
  sort_order: number;
}

export interface PurchaseResult {
  success: boolean;
  error?: string;
  cost?: number;
  newBalance?: number;
  itemName?: string;
  alreadyOwned?: boolean;
  required?: number;
  balance?: number;
}

export const StoreService = {
  /** Tüm aktif ürünleri category bazında çeker */
  async getCatalog(): Promise<{ items: CosmeticItem[]; collections: Collection[] }> {
    try {
      const [itemsRes, colsRes] = await Promise.all([
        supabase.from('cosmetic_items')
          .select('*').eq('active', true).order('display_order', { ascending: true }),
        supabase.from('collections')
          .select('*').eq('active', true).order('display_order', { ascending: true }),
      ]);
      if (itemsRes.error) {
        if (__DEV__) logger.warn('[Store] catalog items hatası:', itemsRes.error.message);
      }
      if (colsRes.error) {
        if (__DEV__) logger.warn('[Store] catalog collections hatası:', colsRes.error.message);
      }
      return {
        items: (itemsRes.data || []) as CosmeticItem[],
        collections: (colsRes.data || []) as Collection[],
      };
    } catch (e: any) {
      if (__DEV__) logger.warn('[Store] catalog exception:', e?.message);
      return { items: [], collections: [] };
    }
  },

  /** SP paket kataloğu — sp_packages tablosundan (vitrin için) */
  async getSPPacks(): Promise<SPPack[]> {
    try {
      const { data, error } = await supabase
        .from('sp_packages')
        .select('id,tier_name,tier_key,tier_color,sp_amount,bonus_sp,bonus_pct,price_try,fiat_label,popular,sort_order,is_active')
        .eq('is_active', true)
        .not('tier_key', 'is', null)
        .order('sort_order', { ascending: true });
      if (error) {
        if (__DEV__) logger.warn('[Store] sp_packs hatası:', error.message);
        return [];
      }
      return (data || []).map((r: any) => ({
        id: r.id,
        tier_name: r.tier_name,
        tier_key: r.tier_key,
        tier_color: r.tier_color,
        sp_amount: r.sp_amount,
        bonus_sp: r.bonus_sp || 0,
        bonus_pct: r.bonus_pct,
        price_try: Number(r.price_try),
        fiat_label: r.fiat_label,
        popular: !!r.popular,
        sort_order: r.sort_order,
      })) as SPPack[];
    } catch (e: any) {
      if (__DEV__) logger.warn('[Store] sp_packs exception:', e?.message);
      return [];
    }
  },

  /** Bugünün daily deal'ı (CURRENT_DATE'e karşılık gelen) — yoksa null */
  async getDailyDeal(): Promise<DailyDeal | null> {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('daily_deals')
        .select('*')
        .eq('deal_date', today)
        .maybeSingle();
      if (error) {
        if (__DEV__) logger.warn('[Store] daily_deal hatası:', error.message);
        return null;
      }
      return (data as DailyDeal) || null;
    } catch (e: any) {
      if (__DEV__) logger.warn('[Store] daily_deal exception:', e?.message);
      return null;
    }
  },

  /** Kullanıcının wishlist'i (item_id Set) */
  async getWishlist(userId: string): Promise<Set<string>> {
    if (!userId) return new Set();
    try {
      const { data, error } = await supabase
        .from('user_wishlist')
        .select('item_id')
        .eq('user_id', userId);
      if (error) {
        if (__DEV__) logger.warn('[Store] wishlist hatası:', error.message);
        return new Set();
      }
      return new Set((data || []).map((r: any) => r.item_id));
    } catch (e: any) {
      if (__DEV__) logger.warn('[Store] wishlist exception:', e?.message);
      return new Set();
    }
  },

  /** Wishlist'e ekle (idempotent) */
  async addToWishlist(userId: string, itemId: string): Promise<boolean> {
    if (!userId || !itemId) return false;
    try {
      const { error } = await supabase
        .from('user_wishlist')
        .upsert({ user_id: userId, item_id: itemId }, { onConflict: 'user_id,item_id' });
      if (error) {
        if (__DEV__) logger.warn('[Store] addToWishlist hatası:', error.message);
        return false;
      }
      return true;
    } catch (e: any) {
      if (__DEV__) logger.warn('[Store] addToWishlist exception:', e?.message);
      return false;
    }
  },

  /** Wishlist'ten çıkar */
  async removeFromWishlist(userId: string, itemId: string): Promise<boolean> {
    if (!userId || !itemId) return false;
    try {
      const { error } = await supabase
        .from('user_wishlist')
        .delete()
        .eq('user_id', userId).eq('item_id', itemId);
      if (error) {
        if (__DEV__) logger.warn('[Store] removeFromWishlist hatası:', error.message);
        return false;
      }
      return true;
    } catch (e: any) {
      if (__DEV__) logger.warn('[Store] removeFromWishlist exception:', e?.message);
      return false;
    }
  },

  /** Bundle paketleri — kompozisyon item_ids ile birlikte */
  async getBundles(): Promise<CosmeticBundle[]> {
    try {
      const [bundlesRes, itemsRes] = await Promise.all([
        supabase.from('cosmetic_bundles')
          .select('*').eq('active', true).order('sort_order', { ascending: true }),
        supabase.from('cosmetic_bundle_items').select('bundle_id,item_id'),
      ]);
      if (bundlesRes.error) {
        if (__DEV__) logger.warn('[Store] bundles hatası:', bundlesRes.error.message);
        return [];
      }
      const itemMap = new Map<string, string[]>();
      (itemsRes.data || []).forEach((r: any) => {
        if (!itemMap.has(r.bundle_id)) itemMap.set(r.bundle_id, []);
        itemMap.get(r.bundle_id)!.push(r.item_id);
      });
      return (bundlesRes.data || []).map((b: any) => ({
        ...b,
        item_ids: itemMap.get(b.id) || [],
      })) as CosmeticBundle[];
    } catch (e: any) {
      if (__DEV__) logger.warn('[Store] bundles exception:', e?.message);
      return [];
    }
  },

  /** Bundle satın al — atomic SP düş + tüm parçalar envantere ekle */
  async purchaseBundle(userId: string, bundleId: string): Promise<BundlePurchaseResult> {
    if (!userId || !bundleId) return { success: false, error: 'Eksik parametre' };
    try {
      const { data, error } = await supabase.rpc('bundle_purchase', {
        p_user_id: userId,
        p_bundle_id: bundleId,
      });
      if (error) {
        if (__DEV__) logger.warn('[Store] bundle_purchase hatası:', error.message);
        return { success: false, error: error.message };
      }
      return data as BundlePurchaseResult;
    } catch (e: any) {
      if (__DEV__) logger.warn('[Store] bundle_purchase exception:', e?.message);
      return { success: false, error: e?.message || 'Bilinmeyen hata' };
    }
  },

  /** Kullanıcının sahip olduğu item id'leri (Set lookup için) */
  async getUserInventory(userId: string): Promise<Set<string>> {
    if (!userId) return new Set();
    try {
      const { data, error } = await supabase
        .from('user_inventory')
        .select('item_id')
        .eq('user_id', userId);
      if (error) {
        if (__DEV__) logger.warn('[Store] inventory hatası:', error.message);
        return new Set();
      }
      return new Set((data || []).map((r: any) => r.item_id));
    } catch (e: any) {
      if (__DEV__) logger.warn('[Store] inventory exception:', e?.message);
      return new Set();
    }
  },

  /** Item satın al — atomic SP düş + inventory ekle */
  async purchase(userId: string, itemId: string): Promise<PurchaseResult> {
    if (!userId || !itemId) return { success: false, error: 'Eksik parametre' };
    try {
      const { data, error } = await supabase.rpc('store_purchase', {
        p_user_id: userId,
        p_item_id: itemId,
      });
      if (error) {
        if (__DEV__) logger.warn('[Store] purchase RPC hatası:', error.message);
        return { success: false, error: error.message };
      }
      const r = data as any;
      return {
        success: !!r?.success,
        error: r?.error,
        cost: r?.cost,
        newBalance: r?.new_balance,
        itemName: r?.item_name,
        alreadyOwned: !!r?.already_owned,
        required: r?.required,
        balance: r?.balance,
      };
    } catch (e: any) {
      if (__DEV__) logger.warn('[Store] purchase exception:', e?.message);
      return { success: false, error: e?.message || i18n.t('auto.store.001') };
    }
  },
};
