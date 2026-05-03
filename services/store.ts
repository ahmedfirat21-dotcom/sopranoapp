// ★ v107 (3 May 2026): Maison Soprano mağaza servisi.
//
// Backend: cosmetic_items + collections + user_inventory + store_purchase RPC.
// Render verisi tamamen DB'den okunur.

import { supabase } from '../constants/supabase';
import { logger } from '../utils/logger';

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
      return { success: false, error: e?.message || 'Bağlantı hatası' };
    }
  },
};
