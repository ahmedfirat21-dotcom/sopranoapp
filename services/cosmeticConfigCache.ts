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
  // ★ v283 (16 May 2026): tier_badge_* alanları kaldırıldı — rozet ayarları artık
  //   cosmetic_items.editor_config.badge_config (Mağaza → Rozetler) içinde.
  //   Eski DB kayıtlarında bu field'lar duruyor olabilir; APK okumuyor.
  // Ek animasyon paleti
  avatar_shake?: boolean;
  avatar_swing?: boolean;
  avatar_tilt?: boolean;
  frame_shimmer?: boolean;
  // ★ v269 (14 May 2026): Shimmer sub-field'lar — audit raporundan interface'e eklendi.
  //   Runtime'da JS dynamic access ile çalışıyordu (AvatarFrame L:2010-2016), TypeScript
  //   tip güvenliği için artık explicit tanımlı. Frame Shimmer Overlay tüm 7 parametreyi
  //   kullanıyor (Skia Reanimated GPU shimmer).
  frame_shimmer_scale?: number;
  frame_shimmer_speed?: number;
  frame_shimmer_opacity?: number;
  frame_shimmer_angle?: number;
  frame_shimmer_band?: number;
  frame_shimmer_reverse?: boolean;
  frame_shimmer_layer?: 'above' | 'below';
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
  // ★ v117 (13 May 2026): Yeni paket — partikül + sahne efektleri + aura/halo + ses + trigger
  particles_enabled?: boolean;
  particles_type?: string;
  particles_count?: number;
  particles_lifetime_ms?: number;
  particles_speed?: number;
  particles_spread_deg?: number;
  particles_gravity?: number;
  particles_size_min?: number;
  particles_size_max?: number;
  particles_color_palette?: string[];
  particles_emit_x?: number;
  particles_emit_y?: number;
  particles_burst?: boolean;
  particles_emit_rate?: number;
  particles_fade_out?: boolean;
  particles_rotation_speed?: number;
  scene_flash_enabled?: boolean;
  scene_flash_color?: string;
  scene_flash_intensity?: number;
  scene_flash_duration_ms?: number;
  scene_shake_enabled?: boolean;
  scene_shake_intensity?: number;
  scene_shake_duration_ms?: number;
  scene_vignette_enabled?: boolean;
  scene_vignette_color?: string;
  scene_vignette_pulse?: boolean;
  scene_vignette_size?: number;
  scene_bg_blur_enabled?: boolean;
  scene_bg_blur_max?: number;
  scene_bg_blur_duration_ms?: number;
  scene_color_tint_enabled?: boolean;
  scene_color_tint_color?: string;
  scene_color_tint_intensity?: number;
  scene_zoom_in_enabled?: boolean;
  scene_zoom_in_scale?: number;
  scene_zoom_in_duration_ms?: number;
  aura_enabled?: boolean;
  aura_color?: string;
  aura_size?: number;
  aura_pulse?: boolean;
  aura_pulse_speed?: number;
  aura_intensity?: number;
  aura_layers?: number;
  trail_enabled?: boolean;
  trail_color?: string;
  trail_length?: number;
  trail_decay_ms?: number;
  trail_thickness?: number;
  halo_ring_enabled?: boolean;
  halo_ring_color?: string;
  halo_ring_thickness?: number;
  halo_ring_spin_speed?: number;
  halo_ring_dashed?: boolean;
  sound_enabled?: boolean;
  sound_id?: string;
  sound_volume?: number;
  sound_delay_ms?: number;
  trigger_first_join_only?: boolean;
  trigger_min_tier?: string;
  trigger_owner_only?: boolean;
  trigger_cooldown_minutes?: number;
  trigger_birthday_only?: boolean;
  trigger_milestone?: string;
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
      // ★ v263 (13 May 2026): Web admin editor_config içinde `frame_config` wrapper
      //   altında ayarları saklıyor: { frame_config: { size_overrides, tier_badge_*, ... } }
      //   Mobile direkt editor_config okurken size_overrides bulamıyordu → hiçbir
      //   listener/profile/stage_host ayarı yansımıyordu. Wrapper'ı unwrap et.
      const { data } = await supabase
        .from('cosmetic_items')
        .select('editor_config')
        .eq('id', itemId)
        .maybeSingle();
      const ec = (data as any)?.editor_config;
      if (!ec) return null;
      // Yeni yapı: editor_config.frame_config.X → unwrap
      // Eski yapı (geriye dönük): editor_config.X → olduğu gibi
      return ec.frame_config && typeof ec.frame_config === 'object' ? ec.frame_config : ec;
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
  // ★ v266 (13 May 2026) CRITICAL FIX: fetchMeta ZATEN editor_config.frame_config'i
  //   unwrap ediyor (v264'te eklendi). Burada bir kez daha .frame_config aramak
  //   ÇİFT UNWRAP yapıyor ve cfg her zaman null dönüyordu → 3 GÜNDÜR HİÇBİR FRAME
  //   AYARI APK'YA YANSIMAMASININ KAYNAĞI. Direkt meta = cfg.
  const meta = await fetchMeta(frameId);
  const cfg = meta || null;
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

// ★ v299 (17 May 2026): Dev hot reload'da her reload yeni channel açıyordu, eski
//   ASLA kapanmıyordu (singleton ref kalıyordu). Production'da app lifecycle'da
//   bir kez çağrıldığı için sorun değil, ama hot reload sırasında duplicate
//   subscription birikiyor. Cleanup fonksiyonu export edilince root layout veya
//   HMR boundary'de çağrılabilir.
export function stopCosmeticConfigSync() {
  if (!_realtimeSub) return;
  try { supabase.removeChannel(_realtimeSub); } catch {}
  _realtimeSub = null;
}
