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
import { useEffect, useState } from 'react';
import { supabase } from '../constants/supabase';

// ★ v1.3.54: Boyut anahtarları — web admin'deki MOBILE_SIZES ile senkron.
//   Her boyut için ayrı override yapılabilir. Avatar render edilirken px boyutuna
//   göre otomatik en yakın anahtar seçilir.
export type SizeKey = 'mini' | 'listener' | 'speaker' | 'stage_host' | 'profile';

export function pickSizeKey(px: number): SizeKey {
  if (px <= 70) return 'mini';
  if (px <= 100) return 'listener';
  if (px <= 140) return 'speaker';
  if (px <= 180) return 'stage_host';
  return 'profile';
}

export interface FrameConfig {
  // Frame Lottie/PNG ayarları
  frame_scale?: number;
  frame_offset_x?: number;
  frame_offset_y?: number;
  frame_rotation?: number;       // sürekli dönme hızı (sn) — 0 sabit
  frame_opacity?: number;
  // Avatar
  avatar_ratio?: number;
  // Glow
  glow_enabled?: boolean;
  glow_color?: string;
  glow_intensity?: number;
  glow_pulse?: boolean;
  // Lottie filter (RN'de Lottie filter yok — sessiz no-op, sadece tip tamlığı için)
  lottie_hue_rotate?: number;
  lottie_brightness?: number;
  lottie_saturation?: number;
  lottie_speed?: number;
  // Hareket & efekt animasyonları
  avatar_pulse?: boolean;
  avatar_pulse_speed?: number;
  avatar_float?: boolean;
  avatar_float_speed?: number;
  frame_breathe?: boolean;
  // Parçacık
  particle_type?: 'none' | 'sparkle' | 'stars' | 'hearts' | 'bubbles';
  particle_count?: number;
  particle_color?: string;
  // Renk döngüsü
  color_cycle?: boolean;
  color_cycle_speed?: number;
  // Kullanıcı adı — mobile'da SVG yok, render edilmez (v632fced); tip için tutuluyor
  name_enabled?: boolean;
  name_position?: 'top' | 'bottom' | 'left' | 'right';
  name_offset?: number;
  name_rotation?: number;
  name_curve_style?: 'flat' | 'arc-top' | 'arc-bottom' | 'circle';
  name_color?: string;
  name_size?: number;
  name_bold?: boolean;
  // Tier rozet — sade model: sadece aç/kapat + 8 nokta konum + ince ayar
  tier_badge_enabled?: boolean;
  tier_badge_position?: 'tl' | 'tc' | 'tr' | 'ml' | 'mr' | 'bl' | 'bc' | 'br';
  // ★ v1.3.70: İnce ayar — web admin slider'larından gelen % offset + boyut çarpanı.
  //   offset: % avatar boyutu (-50..+50), scale: 0.5..2.0
  tier_badge_offset_x?: number;
  tier_badge_offset_y?: number;
  tier_badge_scale?: number;
  // Ek animasyon paleti
  avatar_shake?: boolean;
  avatar_swing?: boolean;
  avatar_tilt?: boolean;
  frame_shimmer?: boolean;
  frame_wobble?: boolean;
  frame_pulse_ring?: boolean;
  // İsim animasyonları (mobile'da name overlay yok; tip için)
  name_glow?: boolean;
  name_wave?: boolean;
  name_shimmer?: boolean;
  name_color_cycle?: boolean;
  name_pulse?: boolean;
  name_pulse_speed?: number;
  name_float?: boolean;
  name_float_speed?: number;
  name_shake?: boolean;
  name_swing?: boolean;
  name_tilt?: boolean;
  name_breathe?: boolean;
  name_wobble?: boolean;
  name_rotation_continuous?: boolean;
  name_rotation_speed?: number;
  name_opacity?: number;
  name_glow_color?: string;
  name_glow_intensity?: number;
  name_glow_pulse?: boolean;
  // Avatar şekli
  avatar_shape?: 'circle' | 'rounded-square' | 'hexagon' | 'squircle' | 'star' | 'diamond';
  // Avatar border
  avatar_border_enabled?: boolean;
  avatar_border_color?: string;
  avatar_border_width?: number;
  avatar_border_style?: 'solid' | 'dashed' | 'dotted' | 'double';
  // Background halo
  bg_halo_enabled?: boolean;
  bg_halo_color?: string;
  bg_halo_size?: number;
  bg_halo_intensity?: number;
  // Avatar filtreleri (hue/saturation/blur RN'de yok — grayscale/sepia/brightness yaklaşımı)
  avatar_hue_rotate?: number;
  avatar_brightness?: number;
  avatar_saturation?: number;
  avatar_blur?: number;
  avatar_grayscale?: number;
  avatar_sepia?: number;
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

/** Frame config — sync getter (cache only). Async warmup için ensureFrameConfig kullan.
 *  v1.3.54: sizeKey opsiyonel — verilirse size_overrides[sizeKey] base config'e merge edilir.
 */
function applySizeOverrides(base: any, sizeKey?: SizeKey): any {
  if (!base || !sizeKey) return base;
  const overrides = base?.size_overrides?.[sizeKey];
  if (!overrides || typeof overrides !== 'object') return base;
  // Shallow merge — override sadece set edilen alanları değiştirir
  return { ...base, ...overrides };
}

export function getCachedFrameConfig(frameId: string | null | undefined, sizeKey?: SizeKey): FrameConfig | null {
  if (!frameId) return null;
  const e = frameCache.get(frameId);
  if (!e || Date.now() - e.ts > TTL_MS) return null;
  return applySizeOverrides(e.config, sizeKey);
}

export async function ensureFrameConfig(frameId: string | null | undefined, sizeKey?: SizeKey): Promise<FrameConfig | null> {
  if (!frameId) return null;
  // Cache hit kontrol (raw base, size override sonra uygulanır)
  const rawEntry = frameCache.get(frameId);
  if (rawEntry && Date.now() - rawEntry.ts <= TTL_MS) {
    return applySizeOverrides(rawEntry.config, sizeKey);
  }
  const meta = await fetchMeta(frameId);
  const cfg = meta?.frame_config || null;
  if (cfg) frameCache.set(frameId, { config: cfg, ts: Date.now() });
  return applySizeOverrides(cfg, sizeKey);
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

// ★ v1.3.54 (2026-05-11): React hook — frame config'i realtime takip et.
//   sizeKey opsiyonel — verilirse size_overrides[sizeKey] base config'e merge edilir.
//   parent ekranlar (profil, sahne) name_enabled gibi bilgilere bakmak için kullanır.
export function useFrameConfig(frameId: string | null | undefined, sizeKey?: SizeKey): FrameConfig | null {
  const [cfg, setCfg] = useState<FrameConfig | null>(() => getCachedFrameConfig(frameId, sizeKey));

  useEffect(() => {
    if (!frameId) { setCfg(null); return; }
    let mounted = true;
    ensureFrameConfig(frameId, sizeKey).then((c) => { if (mounted) setCfg(c); });
    const unsub = subscribeConfigChange((id) => {
      if (id !== frameId) return;
      ensureFrameConfig(frameId, sizeKey).then((c) => { if (mounted) setCfg(c); });
    });
    return () => { mounted = false; unsub(); };
  }, [frameId, sizeKey]);

  return cfg;
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
