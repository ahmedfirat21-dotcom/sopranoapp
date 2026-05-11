/**
 * SopranoChat — Cosmetic Config Cache
 * ════════════════════════════════════════════════════════════════════
 * v213 (9 May 2026) — cosmetic_items.meta'dan frame_config / entry_config
 * çeker, runtime'da Map'te tutar (5dk TTL). Web admin'den yapılan
 * değişiklikler app yeniden açılışında veya 5dk sonra cache miss'le güncellenir.
 *
 * Frame config: avatar boyutu, offset, glow, rotation hızı, lottie filters.
 * Entry config: avatar pozisyonu, animasyonlar (intro/loop/outro), text ayarları.
 */
import { supabase } from '../constants/supabase';

export interface FrameConfig {
  frame_scale?: number;
  frame_offset_x?: number;
  frame_offset_y?: number;
  frame_rotation?: number;
  frame_opacity?: number;
  avatar_ratio?: number;
  glow_enabled?: boolean;
  glow_color?: string;
  glow_intensity?: number;
  lottie_hue_rotate?: number;
  lottie_brightness?: number;
  lottie_saturation?: number;
  lottie_speed?: number;
}

export interface EntryConfig {
  has_avatar?: boolean;
  avatar_x?: number;
  avatar_y?: number;
  avatar_scale?: number;
  avatar_circular?: boolean;
  intro_anim?: string;
  intro_duration_ms?: number;
  intro_delay_ms?: number;
  loop_rotate_y?: boolean;
  loop_rotate_y_deg?: number;
  loop_rotate_y_speed?: number;
  loop_rotate_x?: boolean;
  loop_rotate_x_deg?: number;
  loop_rotate_z?: boolean;
  loop_rotate_z_speed?: number;
  loop_pulse?: boolean;
  loop_pulse_amount?: number;
  loop_pulse_speed?: number;
  loop_glow?: boolean;
  loop_glow_color?: string;
  loop_glow_intensity?: number;
  loop_blur_breathe?: boolean;
  loop_blur_max?: number;
  outro_anim?: string;
  outro_duration_ms?: number;
  text_visible?: boolean;
  text_x?: number;
  text_y?: number;
  text_color?: string;
  text_size?: number;
  text_intro_anim?: string;
  duration_ms?: number;
  lottie_speed?: number;
  lottie_scale?: number;
  lottie_offset_x?: number;
  lottie_offset_y?: number;
  lottie_rotation?: number;
  lottie_opacity?: number;
  lottie_play_start?: number;
  lottie_play_end?: number;
  lottie_loop_count?: number;
  lottie_hue_rotate?: number;
  lottie_brightness?: number;
  lottie_saturation?: number;
  lottie_invert?: boolean;
}

const TTL_MS = 5 * 60 * 1000; // 5 dakika

interface CacheEntry { config: any; ts: number; }
const frameCache = new Map<string, CacheEntry>();
const entryCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<any>>();

async function fetchMeta(itemId: string): Promise<any> {
  if (!itemId) return null;
  if (inflight.has(itemId)) return inflight.get(itemId)!;
  const p = (async () => {
    try {
      // ★ v213e: editor_config (JSONB) — web admin'den yapılandırılan ayarlar
      const { data } = await supabase
        .from('cosmetic_items')
        .select('editor_config')
        .eq('id', itemId)
        .maybeSingle();
      return (data as any)?.editor_config || null;
    } catch {
      return null;
    } finally {
      inflight.delete(itemId);
    }
  })();
  inflight.set(itemId, p);
  return p;
}

/** Frame config — sync getter (cache only). Async warmup için ensureFrameConfig kullan. */
export function getCachedFrameConfig(frameId: string | null | undefined): FrameConfig | null {
  if (!frameId) return null;
  const e = frameCache.get(frameId);
  if (!e || Date.now() - e.ts > TTL_MS) return null;
  return e.config;
}

export async function ensureFrameConfig(frameId: string | null | undefined): Promise<FrameConfig | null> {
  if (!frameId) return null;
  const cached = getCachedFrameConfig(frameId);
  if (cached) return cached;
  const meta = await fetchMeta(frameId);
  const cfg = meta?.frame_config || null;
  if (cfg) frameCache.set(frameId, { config: cfg, ts: Date.now() });
  return cfg;
}

export function getCachedEntryConfig(effectId: string | null | undefined): EntryConfig | null {
  if (!effectId) return null;
  const e = entryCache.get(effectId);
  if (!e || Date.now() - e.ts > TTL_MS) return null;
  return e.config;
}

export async function ensureEntryConfig(effectId: string | null | undefined): Promise<EntryConfig | null> {
  if (!effectId) return null;
  const cached = getCachedEntryConfig(effectId);
  if (cached) return cached;
  const meta = await fetchMeta(effectId);
  const cfg = meta?.entry_config || null;
  if (cfg) entryCache.set(effectId, { config: cfg, ts: Date.now() });
  return cfg;
}

/** ★ 2026-05-11: Listener pattern — invalidate sonrası mount edilmiş bileşenler
 *  state'lerini güncellesin diye. cache silmek yetmiyor çünkü bileşenler dynCfg'i
 *  state olarak tutar; bir sonraki render'da değişmedikçe yeni veriyi çekmez.
 *  AvatarFrame subscribeConfigChange ile dinler, kendi item id'si geldiğinde
 *  ensureFrameConfig çağırıp state'i günceller. */
type ConfigChangeListener = (itemId: string) => void;
const _listeners = new Set<ConfigChangeListener>();

export function subscribeConfigChange(fn: ConfigChangeListener): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

/** Manuel cache invalidate (admin değişiklik sonrası). Listener'lara da bildirir. */
export function invalidateConfig(itemId: string) {
  frameCache.delete(itemId);
  entryCache.delete(itemId);
  // Tüm subscriber'lara haber ver — sadece kendi itemId'sini eşleştirenler tepki verir
  _listeners.forEach(fn => {
    try { fn(itemId); } catch { /* listener crash'leri sessizce yut, diğerleri devam etsin */ }
  });
}

// ★ 2026-05-10: Web admin'den frame_config / entry_config güncellenince mobil
//   tarafta 5dk cache yüzünden değişiklik yansımıyordu. cosmetic_items realtime
//   publication'a eklendi (DB), burada UPDATE eventlerini dinleyip cache'i
//   invalidate ediyoruz — bir sonraki erişimde fresh DB okuması yapılır.
let _realtimeSub: any = null;
export function startCosmeticConfigSync() {
  if (_realtimeSub) return _realtimeSub;
  _realtimeSub = supabase
    .channel('cosmetic_config_sync')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'cosmetic_items' },
      (payload: any) => {
        const id = payload?.new?.id || payload?.old?.id;
        if (id) invalidateConfig(id);
      },
    )
    .subscribe();
  return _realtimeSub;
}
