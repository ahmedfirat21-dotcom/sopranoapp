/**
 * SopranoChat — Kozmetik Ekipman Servisi
 * ═══════════════════════════════════════════════════════════════════
 * v108 (4 May 2026) — Avatar çerçeve + giriş efekti equip/unequip.
 *
 * RPC'ler:
 *   equip_frame(user_id, item_id)        → profiles.active_frame
 *   equip_entry_effect(user_id, item_id) → profiles.active_entry_effect
 */

import { supabase } from '../constants/supabase';
import { logger } from '../utils/logger';

export interface EquipResult {
  success: boolean;
  error?: string;
  requiresPurchase?: boolean;
  itemId?: string;
  itemName?: string;
}

export const CosmeticService = {
  /** Avatar çerçevesi tak/çıkar */
  async equipFrame(userId: string, itemId: string | null): Promise<EquipResult> {
    try {
      const { data, error } = await supabase.rpc('equip_frame', {
        p_user_id: userId,
        p_item_id: itemId,
      });
      if (error) {
        if (__DEV__) logger.warn('[Cosmetic] equip_frame RPC:', error.message);
        return { success: false, error: error.message };
      }
      const r = data as any;
      return {
        success: !!r?.success,
        error: r?.error,
        requiresPurchase: !!r?.requires_purchase,
        itemId: r?.item_id,
        itemName: r?.item_name,
      };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Bağlantı hatası' };
    }
  },

  /** Giriş efekti tak/çıkar */
  async equipEntryEffect(userId: string, itemId: string | null): Promise<EquipResult> {
    try {
      const { data, error } = await supabase.rpc('equip_entry_effect', {
        p_user_id: userId,
        p_item_id: itemId,
      });
      if (error) {
        if (__DEV__) logger.warn('[Cosmetic] equip_entry_effect RPC:', error.message);
        return { success: false, error: error.message };
      }
      const r = data as any;
      return {
        success: !!r?.success,
        error: r?.error,
        requiresPurchase: !!r?.requires_purchase,
        itemId: r?.item_id,
        itemName: r?.item_name,
      };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Bağlantı hatası' };
    }
  },

  /** Kullanıcının aktif çerçevesini al */
  async getActiveFrame(userId: string): Promise<string | null> {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('active_frame')
        .eq('id', userId)
        .single();
      return (data as any)?.active_frame || null;
    } catch {
      return null;
    }
  },

  /** Kullanıcının aktif giriş efektini al */
  async getActiveEntryEffect(userId: string): Promise<string | null> {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('active_entry_effect')
        .eq('id', userId)
        .single();
      return (data as any)?.active_entry_effect || null;
    } catch {
      return null;
    }
  },

  /** Kullanıcının sahip olduğu belirli kategorideki ürünleri getir */
  async getOwnedByCategory(userId: string, categories: string[]): Promise<any[]> {
    try {
      const { data: inventory } = await supabase
        .from('user_inventory')
        .select('item_id')
        .eq('user_id', userId);
      if (!inventory?.length) return [];

      const itemIds = inventory.map((r: any) => r.item_id);
      const { data: items } = await supabase
        .from('cosmetic_items')
        .select('*')
        .in('id', itemIds)
        .in('category', categories)
        .eq('active', true)
        .order('display_order');
      return items || [];
    } catch {
      return [];
    }
  },
};
