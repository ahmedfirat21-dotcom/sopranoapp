/**
 * SopranoChat — Mağaza Servisi
 * ═══════════════════════════════════════════════════
 * SP mağazası, katalog, satın alma, equip/unequip.
 * database.ts monolitinden ayrıştırıldı.
 */
import { supabase } from '../constants/supabase';
import type { StoreItem, UserPurchase } from '../types';

// ── Hardcoded mağaza kataloğu (DB tablosu eklenince kaldırılacak) ──
const STORE_CATALOG: StoreItem[] = [
  { id: 'frame_neon_teal', name: 'Neon Teal Çerçeve', description: 'Parlak teal renkli profil çerçevesi', type: 'profile_frame', price: 500, image_url: '', rarity: 'rare', is_limited: false, is_active: true, created_at: '2026-01-01' },
  { id: 'frame_gold_crown', name: 'Altın Taç Çerçeve', description: 'Prestige altın taç efektli çerçeve', type: 'profile_frame', price: 1500, image_url: '', rarity: 'legendary', is_limited: true, is_active: true, created_at: '2026-01-01' },
  { id: 'frame_diamond_ring', name: 'Elmas Yüzük Çerçeve', description: 'Pırıl pırıl elmas efektli çerçeve', type: 'profile_frame', price: 2000, image_url: '', rarity: 'legendary', is_limited: false, is_active: true, created_at: '2026-01-01' },
  { id: 'frame_purple_aura', name: 'Mor Aura Çerçeve', description: 'Gizemli mor ışıltılı çerçeve', type: 'profile_frame', price: 800, image_url: '', rarity: 'epic', is_limited: false, is_active: true, created_at: '2026-01-01' },
  { id: 'chat_ocean_blue', name: 'Okyanus Mavisi', description: 'Sohbet balonlarına okyanus mavisi renk', type: 'chat_bubble', price: 300, image_url: '', rarity: 'common', is_limited: false, is_active: true, created_at: '2026-01-01' },
  { id: 'chat_sunset_orange', name: 'Gün Batımı', description: 'Sıcak turuncu sohbet rengi', type: 'chat_bubble', price: 300, image_url: '', rarity: 'common', is_limited: false, is_active: true, created_at: '2026-01-01' },
  { id: 'chat_galaxy_purple', name: 'Galaksi Moru', description: 'Uzay temalı mor sohbet rengi', type: 'chat_bubble', price: 600, image_url: '', rarity: 'rare', is_limited: false, is_active: true, created_at: '2026-01-01' },
  { id: 'entry_sparkle', name: 'Parıltı Girişi', description: 'Odaya girerken parıltılı efekt', type: 'entry_effect', price: 1000, image_url: '', rarity: 'epic', is_limited: false, is_active: true, created_at: '2026-01-01' },
  { id: 'entry_thunder', name: 'Şimşek Girişi', description: 'Güçlü şimşek efektiyle giriş', type: 'entry_effect', price: 1500, image_url: '', rarity: 'legendary', is_limited: false, is_active: true, created_at: '2026-01-01' },
  { id: 'theme_midnight', name: 'Gece Yarısı Teması', description: 'Koyu mor ve yıldızlı oda teması', type: 'room_theme', price: 800, image_url: '', rarity: 'epic', is_limited: false, is_active: true, created_at: '2026-01-01' },
];

// ============================================
// MAĞAZA İŞLEMLERİ (STORE & WALLET)
// ============================================
export const StoreService = {
  /** ★ Hybrid: DB'den çek, yoksa statik katalog (migration sonrası otomatik geçiş) */
  async getStoreItems(): Promise<StoreItem[]> {
    try {
      const { data, error } = await supabase
        .from('store_items')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });
      if (!error && data && data.length > 0) return data as StoreItem[];
    } catch { /* tablo yoksa sessiz fallback */ }
    return STORE_CATALOG;
  },

  async getUserPurchases(userId: string): Promise<UserPurchase[]> {
    const ids = await this.getUserPurchasedIds(userId);
    return ids.map(itemId => ({
      id: `${userId}_${itemId}`,
      user_id: userId,
      item_id: itemId,
      purchased_at: new Date().toISOString(),
    }));
  },

  async getUserPurchasedIds(userId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('purchased_items')
        .eq('id', userId)
        .single();
      if (error || !data) return [];
      return Array.isArray(data.purchased_items) ? data.purchased_items : [];
    } catch {
      return [];
    }
  },

  async hasUserPurchased(userId: string, itemId: string): Promise<boolean> {
    const ids = await StoreService.getUserPurchasedIds(userId);
    return ids.includes(itemId);
  },

  async purchaseItem(userId: string, itemId: string, _itemPrice?: number) {
    // ★ SEC-7 FIX: Fiyatı HER ZAMAN server-side'dan çek — client'a güvenme
    const catalog = await this.getStoreItems();
    const item = catalog.find(i => i.id === itemId);
    if (!item) throw new Error('Ürün bulunamadı');
    const price = item.price;
    if (price <= 0) throw new Error('Geçersiz ürün fiyatı');

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('system_points, purchased_items, is_admin')
      .eq('id', userId)
      .single();

    if (profileError || !profile) throw new Error('Profil bulunamadı');
    // ★ GodMaster bypass — admin kullanıcılar sınırsız SP
    const isAdmin = profile.is_admin === true;
    if (!isAdmin && profile.system_points < price) throw new Error('Yetersiz SP');

    const owned: string[] = Array.isArray(profile.purchased_items) ? profile.purchased_items : [];
    if (owned.includes(itemId)) throw new Error('Bu ürüne zaten sahipsin!');

    const newOwned = [...owned, itemId];
    // ★ SEC-7: Optimistic lock — concurrent satın alma koruması
    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({
        system_points: profile.system_points - price,
        purchased_items: newOwned,
      })
      .eq('id', userId)
      .eq('system_points', profile.system_points) // ★ SP değişmişse 0 row affected
      .select('id');

    if (updateError) throw new Error('Satın alma başarısız: ' + updateError.message);
    if (!updated || updated.length === 0) throw new Error('Eşzamanlı işlem çakışması. Lütfen tekrar deneyin.');

    // ★ SP transaction kaydı (opsiyonel)
    try {
      await supabase.from('sp_transactions').insert({
        user_id: userId,
        amount: -price,
        type: 'store_purchase',
        description: `Mağaza: ${item.name}`,
      });
    } catch { /* sp_transactions yoksa sessiz */ }

    return { success: true, remaining_sp: profile.system_points - price };
  },

  async equipItem(userId: string, itemId: string | null) {
    const updates: Record<string, any> = {};
    if (!itemId) {
      updates.active_frame = null;
      updates.active_chat_color = null;
      updates.active_entry_effect = null;
    } else if (itemId.startsWith('frame_')) {
      updates.active_frame = itemId;
    } else if (itemId.startsWith('chat_')) {
      updates.active_chat_color = itemId;
    } else if (itemId.startsWith('entry_')) {
      updates.active_entry_effect = itemId;
    } else if (itemId.startsWith('theme_')) {
      updates.active_room_theme = itemId;
    }
    if (Object.keys(updates).length === 0) return;
    const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
    if (error) throw error;
  },

  async unequipItem(userId: string, itemId: string) {
    const updates: Record<string, any> = {};
    if (itemId.startsWith('frame_')) updates.active_frame = null;
    else if (itemId.startsWith('chat_')) updates.active_chat_color = null;
    else if (itemId.startsWith('entry_')) updates.active_entry_effect = null;
    else if (itemId.startsWith('theme_')) updates.active_room_theme = null;
    if (Object.keys(updates).length === 0) return;
    const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
    if (error) throw error;
  }
};
