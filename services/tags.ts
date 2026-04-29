/**
 * SopranoChat — Tag Servisi (Faz 4.3)
 * ═══════════════════════════════════════════════════
 * Oda başına 3 etiket. Kategori yerine geçmez, AUGMENT eder.
 * - Kategori: 7 sabit chip (sohbet/müzik/oyun/...)
 * - Tag: serbest, kullanıcı yazılı (#oyun, #anime, #standup, ...)
 *
 * Tablo: public.room_tags (v62)
 *   - room_id (UUID), tag (TEXT), created_at
 *   - composite PK, RLS: public read + host-only write
 *
 * Tag normalize kuralı:
 *   - lowercase
 *   - "#" prefix temizlenir
 *   - boşluk → tek "-"
 *   - sadece harf/rakam/tire/Türkçe karakter
 *   - 2-30 karakter
 */
import { supabase } from '../constants/supabase';

export const MAX_TAGS_PER_ROOM = 3;

/** Tag string'ini DB için temizle. Boş string → null sonucu. */
export function normalizeTag(raw: string): string | null {
  if (!raw) return null;
  let t = raw.trim().toLowerCase();
  // # prefix temizle
  t = t.replace(/^#+/, '');
  // Boşlukları tireye çevir
  t = t.replace(/\s+/g, '-');
  // Türkçe destekli alfasayısal + tire dışını sil
  // \p{L} unicode kategorisi RN regex engine'de var (es2018+ flag).
  t = t.replace(/[^a-z0-9çğıöşü\-]/g, '');
  // Birden fazla tireyi tek yap
  t = t.replace(/-+/g, '-');
  // Baş/son tire
  t = t.replace(/^-+|-+$/g, '');
  if (t.length < 2 || t.length > 30) return null;
  return t;
}

/** Sık kullanılan başlangıç önerileri — UI'da chip suggestion olarak gösterilir. */
export const SUGGESTED_TAGS: ReadonlyArray<string> = [
  'oyun', 'anime', 'müzik', 'standup', 'sohbet',
  'kitap', 'film', 'dizi', 'futbol', 'gündem',
  'felsefe', 'teknoloji', 'tarih', 'spor', 'eğlence',
];

export const TagService = {
  /** Oda etiketlerini getir. */
  async getRoomTags(roomId: string): Promise<string[]> {
    if (!roomId) return [];
    const { data, error } = await supabase
      .from('room_tags')
      .select('tag')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });
    if (error) {
      if (__DEV__) console.warn('[TagService] getRoomTags:', error.message);
      return [];
    }
    return (data || []).map((r: any) => r.tag);
  },

  /**
   * Oda etiketlerini topluca ayarla.
   * Mantık: önce mevcutları sil, sonra yenilerini insert.
   * Atomik değil ama eşzamanlı düzenleme nadir; transaction RPC v64'te.
   */
  async setRoomTags(roomId: string, tags: string[]): Promise<{ success: boolean; error?: string; saved: string[] }> {
    if (!roomId) return { success: false, error: 'Geçersiz oda.', saved: [] };

    // Normalize + tekille
    const cleaned = Array.from(new Set(
      tags.map(normalizeTag).filter((t): t is string => !!t)
    )).slice(0, MAX_TAGS_PER_ROOM);

    // Önce mevcutları sil
    const { error: delErr } = await supabase
      .from('room_tags')
      .delete()
      .eq('room_id', roomId);
    if (delErr) {
      if (__DEV__) console.warn('[TagService] setRoomTags delete:', delErr.message);
      return { success: false, error: delErr.message, saved: [] };
    }

    if (cleaned.length === 0) return { success: true, saved: [] };

    const rows = cleaned.map(tag => ({ room_id: roomId, tag }));
    const { error: insErr } = await supabase.from('room_tags').insert(rows);
    if (insErr) {
      if (__DEV__) console.warn('[TagService] setRoomTags insert:', insErr.message);
      return { success: false, error: insErr.message, saved: [] };
    }
    return { success: true, saved: cleaned };
  },

  /**
   * Belirli bir etikete sahip canlı odaları getir (keşfet için).
   * Block/private filtreleme RoomService.getLive ile aynı pattern'e bağlanır.
   */
  async getRoomsByTag(tag: string, limit = 30): Promise<string[]> {
    const norm = normalizeTag(tag);
    if (!norm) return [];
    const { data, error } = await supabase
      .from('room_tags')
      .select('room_id, created_at')
      .eq('tag', norm)
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 100));
    if (error) {
      if (__DEV__) console.warn('[TagService] getRoomsByTag:', error.message);
      return [];
    }
    return (data || []).map((r: any) => r.room_id);
  },

  /**
   * Birden fazla oda için tag map — discovery liste sayfalarında bir Promise.all
   * yerine tek sorgu. { roomId: ['tag1', 'tag2'] }
   */
  async getTagsForRooms(roomIds: string[]): Promise<Record<string, string[]>> {
    if (roomIds.length === 0) return {};
    const { data, error } = await supabase
      .from('room_tags')
      .select('room_id, tag, created_at')
      .in('room_id', roomIds)
      .order('created_at', { ascending: true });
    if (error) {
      if (__DEV__) console.warn('[TagService] getTagsForRooms:', error.message);
      return {};
    }
    const out: Record<string, string[]> = {};
    for (const row of data || []) {
      const r = row as any;
      if (!out[r.room_id]) out[r.room_id] = [];
      if (out[r.room_id].length < MAX_TAGS_PER_ROOM) out[r.room_id].push(r.tag);
    }
    return out;
  },

  /**
   * Popüler etiketleri getir — son N gündeki canlı odalardan, count desc.
   * Discovery sayfasında "🔥 Popüler etiketler" carousel'i için.
   * NOT: Bu client-side aggregate — tag sayısı az iken (binlerce satır altı) yeterli.
   *      Tablo büyürse v64'te materialized view'a taşınmalı.
   */
  async getPopularTags(limit = 12, days = 7): Promise<{ tag: string; count: number }[]> {
    const since = new Date(Date.now() - days * 86400_000).toISOString();
    const { data, error } = await supabase
      .from('room_tags')
      .select('tag')
      .gte('created_at', since)
      .limit(2000); // Üst limit
    if (error) {
      if (__DEV__) console.warn('[TagService] getPopularTags:', error.message);
      return [];
    }
    const counts = new Map<string, number>();
    for (const row of data || []) {
      const t = (row as any).tag;
      counts.set(t, (counts.get(t) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, Math.min(limit, 50));
  },
};
