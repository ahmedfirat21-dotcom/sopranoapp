/**
 * SopranoChat — Kozmetik Asset Cache
 * ═══════════════════════════════════════════════════════════════════
 * v110.7 (6 May 2026) — Web admin panelinden eklenen Lottie/PNG ürünlerin
 *   runtime'da fetch edilip mobile'da render edilmesi için cache servisi.
 *
 * Mobile'da `frameLottieRegistry.ts`'de hardcoded require()'lar var (5 frame).
 * Bu cache onu tamamlar: registry'de yoksa cosmetic_items.meta'dan asset_url
 * çekip Lottie source veya Image uri olarak kullanılabilir hale getirir.
 *
 * Stratejisi:
 *   1. Bellek cache: Map<itemId, AssetMeta> — uygulama açık kaldığı sürece
 *   2. Promise dedup: aynı itemId için paralel fetch'i tek isteğe indirger
 *   3. Negatif cache: meta'sı olmayan item'ları da kaydet (tekrar sorma)
 *   4. Hata durumunda 60 sn sonra retry (geçici DB sorununa karşı)
 */

import { supabase } from '../constants/supabase';

export type AssetMeta = {
  url: string | null;
  type: 'lottie' | 'image' | null;
};

type CacheEntry = {
  meta: AssetMeta;
  timestamp: number;
};

const TTL_MS = 5 * 60 * 1000; // 5 dakika — DB'den taze çek
const ERROR_TTL_MS = 60 * 1000; // 1 dakika hata sonrası retry

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<AssetMeta>>();

/** itemId için meta'yı çek (cache + dedup ile). */
export async function getCosmeticAsset(itemId: string): Promise<AssetMeta> {
  if (!itemId) return { url: null, type: null };

  // Cache hit
  const cached = cache.get(itemId);
  if (cached && Date.now() - cached.timestamp < TTL_MS) {
    return cached.meta;
  }

  // In-flight dedup
  const existing = inFlight.get(itemId);
  if (existing) return existing;

  const fetchPromise = (async (): Promise<AssetMeta> => {
    try {
      // ★ 2026-05-10 v114: asset_url top-level column eklendi.
      //   Önce ona bak, yoksa eski meta JSON'dan oku (backward compat).
      const { data, error } = await supabase
        .from('cosmetic_items')
        .select('asset_url, meta')
        .eq('id', itemId)
        .maybeSingle();

      if (error || !data) {
        const meta: AssetMeta = { url: null, type: null };
        cache.set(itemId, { meta, timestamp: Date.now() - TTL_MS + ERROR_TTL_MS });
        return meta;
      }

      let parsed: AssetMeta = { url: null, type: null };

      // Birinci kaynak: asset_url column (yeni)
      const directUrl = (data as any).asset_url;
      if (typeof directUrl === 'string' && directUrl.length > 0) {
        const isJson = directUrl.toLowerCase().endsWith('.json');
        parsed = { url: directUrl, type: isJson ? 'lottie' : 'image' };
      } else if (data.meta) {
        // Fallback: legacy meta JSON
        const metaRaw: any = typeof data.meta === 'string' ? data.meta : null;
        if (metaRaw) {
          try {
            const obj = JSON.parse(metaRaw);
            if (obj && typeof obj === 'object') {
              parsed = {
                url: typeof obj.asset_url === 'string' ? obj.asset_url : null,
                type: obj.asset_type === 'lottie' || obj.asset_type === 'image' ? obj.asset_type : null,
              };
            }
          } catch {
            // meta JSON parse edilemedi
          }
        }
      }

      cache.set(itemId, { meta: parsed, timestamp: Date.now() });
      return parsed;
    } catch {
      const meta: AssetMeta = { url: null, type: null };
      cache.set(itemId, { meta, timestamp: Date.now() - TTL_MS + ERROR_TTL_MS });
      return meta;
    } finally {
      inFlight.delete(itemId);
    }
  })();

  inFlight.set(itemId, fetchPromise);
  return fetchPromise;
}

/** Senkron cache okuma — sadece daha önce fetch edilmiş itemId için */
export function getCachedCosmeticAsset(itemId: string): AssetMeta | null {
  const cached = cache.get(itemId);
  if (!cached) return null;
  if (Date.now() - cached.timestamp >= TTL_MS) return null;
  return cached.meta;
}

/** Cache'i tamamen temizle (test/login değişikliği için) */
export function clearCosmeticAssetCache() {
  cache.clear();
  inFlight.clear();
}
