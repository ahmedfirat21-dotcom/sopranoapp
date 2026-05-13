/**
 * Cosmetic Editor Configs — 7 yeni kozmetik kategorisi için mobile fetch
 * ════════════════════════════════════════════════════════════════════
 * v117 (13 May 2026) — Web admin'deki detaylı editörlerden gelen
 * editor_config.<*>_config JSON'larını mobile'a çeker. useFrameConfig
 * pattern'ında: cache (5dk TTL) + realtime invalidate + hook.
 *
 * Kategoriler:
 *   - glow_message → glow_config (sohbet baloncuğu parıltı)
 *   - badge        → badge_config (profil rozeti)
 *   - background   → background_config (profil/oda arka planı)
 *   - theme        → theme_config (renk paleti)
 *   - emoji        → emoji_config (set + emoji listesi)
 *   - effect       → effect_config (partikül/sahne/aura)
 */
import { useEffect, useState } from 'react';
import { supabase } from '../constants/supabase';

const TTL_MS = 5 * 60 * 1000;
type CacheEntry = { config: any; ts: number };
const cache = new Map<string, CacheEntry>();
type Listener = (itemId: string) => void;
const listeners = new Set<Listener>();

/** Genel fetch — cosmetic_items.editor_config.<configKey> okur */
async function fetchEditorConfig(itemId: string, configKey: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('cosmetic_items')
      .select('editor_config')
      .eq('id', itemId)
      .maybeSingle();
    if (error || !data?.editor_config) return null;
    return (data.editor_config as any)[configKey] || null;
  } catch {
    return null;
  }
}

function makeCacheKey(category: string, itemId: string): string {
  return `${category}:${itemId}`;
}

/** Generic ensure — cache hit → fresh; miss → fetch */
async function ensureConfig(category: string, configKey: string, itemId: string | null | undefined): Promise<any | null> {
  if (!itemId) return null;
  const key = makeCacheKey(category, itemId);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts <= TTL_MS) return cached.config;
  const cfg = await fetchEditorConfig(itemId, configKey);
  if (cfg) cache.set(key, { config: cfg, ts: Date.now() });
  return cfg;
}

function getCached(category: string, itemId: string | null | undefined): any | null {
  if (!itemId) return null;
  const e = cache.get(makeCacheKey(category, itemId));
  if (!e || Date.now() - e.ts > TTL_MS) return null;
  return e.config;
}

/** Manuel invalidate — admin değişiklik sonrası */
export function invalidateEditorConfig(category: string, itemId: string) {
  cache.delete(makeCacheKey(category, itemId));
  listeners.forEach(fn => { try { fn(itemId); } catch {} });
}

export function subscribeEditorConfigChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Realtime sub — cosmetic_items UPDATE eventlerini dinler */
let _sub: any = null;
export function startEditorConfigSync() {
  if (_sub) return _sub;
  _sub = supabase
    .channel('cosmetic_editor_configs')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'cosmetic_items' },
      (payload: any) => {
        const id = payload?.new?.id;
        if (!id) return;
        // Tüm category cache'lerini temizle (bu itemId için)
        for (const k of cache.keys()) {
          if (k.endsWith(':' + id)) cache.delete(k);
        }
        listeners.forEach(fn => { try { fn(id); } catch {} });
      },
    )
    .subscribe();
  return _sub;
}

/* ═══════════════════════ Tip tanımları ═══════════════════════ */
export interface GlowMessageConfig {
  bubble_bg_color: string; bubble_bg_gradient_enabled: boolean;
  bubble_bg_gradient_top: string; bubble_bg_gradient_bottom: string;
  bubble_shape: 'rounded' | 'pill' | 'square' | 'speech';
  bubble_border_radius: number; bubble_padding_x: number; bubble_padding_y: number; bubble_opacity: number;
  glow_enabled: boolean; glow_color: string; glow_intensity: number; glow_blur: number; glow_spread: number; glow_inset: boolean;
  text_color: string; text_font_size: number; text_font_weight: string;
  text_shadow_enabled: boolean; text_shadow_color: string; text_shadow_offset_y: number; text_shadow_blur: number;
  text_stroke_enabled: boolean; text_stroke_color: string; text_stroke_width: number; text_letter_spacing: number;
  glow_animation: 'none' | 'pulse' | 'breathe' | 'shimmer' | 'rainbow';
  glow_anim_speed_ms: number; glow_anim_amplitude: number;
  text_animation: 'none' | 'fade-in' | 'typewriter' | 'glow-pulse' | 'shake';
  text_anim_speed_ms: number; bubble_pulse: boolean; bubble_pulse_scale: number; rainbow_speed_sec: number;
  border_enabled: boolean; border_color: string; border_width: number;
  border_style: 'solid' | 'dashed' | 'dotted' | 'double';
  border_gradient_enabled: boolean; border_gradient_from: string; border_gradient_to: string;
  visible_in_chat: boolean; visible_in_dm: boolean; visible_in_room: boolean; priority_above_normal: boolean;
}

export interface BadgeConfig {
  shape: 'circle' | 'rounded-square' | 'shield' | 'star' | 'diamond' | 'hexagon' | 'crown' | 'gem';
  size: number; border_radius: number;
  icon_type: 'verified' | 'crown' | 'star' | 'award' | 'diamond' | 'shield' | 'custom' | 'none';
  icon_color: string; icon_size_ratio: number;
  bg_color: string; bg_gradient_enabled: boolean; bg_gradient_from: string; bg_gradient_to: string;
  bg_gradient_angle: number; bg_opacity: number; custom_image_url: string;
  glow_enabled: boolean; glow_color: string; glow_intensity: number; glow_blur: number; glow_pulse: boolean;
  border_enabled: boolean; border_color: string; border_width: number;
  border_style: 'solid' | 'dashed' | 'dotted' | 'double';
  animation: 'none' | 'pulse' | 'spin' | 'shimmer' | 'bounce' | 'rainbow' | 'breathe';
  anim_speed_ms: number; anim_amplitude: number;
  position: 'topRight' | 'topLeft' | 'bottomRight' | 'bottomLeft' | 'inline';
  offset_x: number; offset_y: number; scale_on_avatar: number;
  visible_on_avatar: boolean; visible_on_profile: boolean; visible_inline_with_name: boolean;
  hover_tooltip_text: string; z_index: number;
}

export interface BackgroundConfig {
  bg_type: 'image' | 'gradient' | 'solid' | 'radial' | 'video' | 'lottie';
  image_url: string; image_fit: string; image_position_x: number; image_position_y: number;
  image_scale: number; image_opacity: number; image_tile_size: number;
  gradient_type: 'linear' | 'radial' | 'conic'; gradient_angle: number; gradient_stops: string[];
  solid_color: string; radial_color_in: string; radial_color_out: string; radial_size: number;
  brightness: number; contrast: number; saturation: number; hue_rotate: number; invert: boolean; sepia: number;
  blur_enabled: boolean; blur_amount: number;
  parallax_enabled: boolean; parallax_intensity: number; parallax_direction: string;
  animation: string; anim_speed_sec: number; anim_amplitude: number; ken_burns_zoom_to: number;
  overlay_enabled: boolean; overlay_color: string; overlay_opacity: number; overlay_blend_mode: string;
  vignette_enabled: boolean; vignette_color: string; vignette_intensity: number;
  applies_to_profile: boolean; applies_to_room: boolean; applies_to_chat: boolean;
  layer_z_index: number; fallback_color: string;
}

export interface ThemeConfig {
  color_primary: string; color_primary_hover: string; color_secondary: string; color_accent: string;
  color_success: string; color_warning: string; color_danger: string; color_info: string;
  surface_bg: string; surface_card: string; surface_elevated: string;
  surface_overlay: string; surface_modal: string; surface_border: string; surface_divider: string;
  text_primary: string; text_secondary: string; text_tertiary: string;
  text_inverse: string; text_link: string; text_muted: string;
  gradient_brand_from: string; gradient_brand_to: string; gradient_brand_angle: number;
  gradient_premium_from: string; gradient_premium_to: string;
  gradient_danger_from: string; gradient_danger_to: string;
  radius_sm: number; radius_md: number; radius_lg: number; radius_xl: number; radius_pill: number; spacing_unit: number;
  transition_fast_ms: number; transition_normal_ms: number; transition_slow_ms: number; easing_default: string;
  mode: 'dark' | 'light' | 'auto'; light_inverse_enabled: boolean;
  light_surface_bg: string; light_text_primary: string; auto_match_system: boolean;
  is_premium_only: boolean; preview_in_settings: boolean; description: string;
}

export interface EmojiConfig {
  set_name: string; set_short_name: string; set_color: string; set_icon: string;
  emojis: Array<{ id: string; shortcode: string; image_url: string; alt_text: string; is_animated: boolean }>;
  render_type: 'png' | 'gif' | 'webp' | 'lottie';
  display_size: number; inline_size: number; preserve_aspect: boolean; padding: number; hover_scale: number;
  animation: string; anim_speed_ms: number; anim_only_on_hover: boolean; loop_count: number;
  sort_mode: string; show_in_recents: boolean; show_in_favorites: boolean;
  display_category: string; is_featured: boolean; badge_text: string; badge_color: string;
  allowed_in_messages: boolean; allowed_in_reactions: boolean; allowed_in_status: boolean; allowed_in_bio: boolean;
  max_uses_per_day: number; cooldown_seconds: number;
  set_description: string; unlock_tier: string; preview_in_picker: boolean;
}

export interface EffectConfig {
  effect_type: string; effect_name: string;
  particle_type: string; particle_count: number; particle_lifetime_sec: number;
  particle_size_min: number; particle_size_max: number; particle_color_palette: string[];
  particle_emit_area: string; particle_velocity_min: number; particle_velocity_max: number;
  particle_gravity: number; particle_rotation_speed: number; particle_fade_out: boolean;
  particle_emit_rate_per_sec: number; particle_opacity: number;
  scene_overlay_color: string; scene_overlay_opacity: number; scene_overlay_blend: string;
  scene_vignette_enabled: boolean; scene_vignette_intensity: number;
  scene_light_streaks_enabled: boolean; scene_light_streaks_count: number; scene_light_streaks_color: string;
  scene_fog_enabled: boolean; scene_fog_color: string; scene_fog_intensity: number;
  primary_color: string; secondary_color: string; use_gradient: boolean; gradient_angle: number;
  filter_brightness: number; filter_saturation: number; filter_hue_rotate: number;
  animation_speed: number; animation_smoothing: string; loop_enabled: boolean; loop_count: number;
  trigger: string; trigger_event_name: string; trigger_min_tier: string;
  trigger_only_room_owner: boolean; trigger_cooldown_minutes: number;
  sound_enabled: boolean; sound_url: string; sound_volume: number; sound_loop: boolean;
  applies_to_profile: boolean; applies_to_room: boolean; applies_to_chat: boolean; applies_to_app_wide: boolean;
  layer_z_index: number; description: string;
}

/* ═══════════════════════ Hooks ═══════════════════════ */
function makeHook<T>(category: string, configKey: string) {
  return function useEditorConfig(itemId: string | null | undefined): T | null {
    const [cfg, setCfg] = useState<T | null>(() => getCached(category, itemId));

    useEffect(() => {
      if (!itemId) { setCfg(null); return; }
      let mounted = true;
      ensureConfig(category, configKey, itemId).then((c: any) => { if (mounted) setCfg(c); });
      const unsub = subscribeEditorConfigChange((id: string) => {
        if (id !== itemId) return;
        ensureConfig(category, configKey, itemId).then((c: any) => { if (mounted) setCfg(c); });
      });
      return () => { mounted = false; unsub(); };
    }, [itemId]);

    return cfg;
  };
}

export const useGlowMessageConfig = makeHook<GlowMessageConfig>('glow_message', 'glow_config');
export const useBadgeConfig = makeHook<BadgeConfig>('badge', 'badge_config');
export const useBackgroundConfig = makeHook<BackgroundConfig>('background', 'background_config');
export const useThemeConfig = makeHook<ThemeConfig>('theme', 'theme_config');
export const useEmojiConfig = makeHook<EmojiConfig>('emoji', 'emoji_config');
export const useEffectConfig = makeHook<EffectConfig>('effect', 'effect_config');

/* ═══════════════════════ Imperative getters ═══════════════════════ */
export const getCachedGlowMessageConfig = (id: string | null | undefined) => getCached('glow_message', id) as GlowMessageConfig | null;
export const getCachedBadgeConfig = (id: string | null | undefined) => getCached('badge', id) as BadgeConfig | null;
export const getCachedBackgroundConfig = (id: string | null | undefined) => getCached('background', id) as BackgroundConfig | null;
export const getCachedThemeConfig = (id: string | null | undefined) => getCached('theme', id) as ThemeConfig | null;
export const getCachedEmojiConfig = (id: string | null | undefined) => getCached('emoji', id) as EmojiConfig | null;
export const getCachedEffectConfig = (id: string | null | undefined) => getCached('effect', id) as EffectConfig | null;

export const ensureGlowMessageConfig = (id: string | null | undefined) => ensureConfig('glow_message', 'glow_config', id) as Promise<GlowMessageConfig | null>;
export const ensureBadgeConfig = (id: string | null | undefined) => ensureConfig('badge', 'badge_config', id) as Promise<BadgeConfig | null>;
export const ensureBackgroundConfig = (id: string | null | undefined) => ensureConfig('background', 'background_config', id) as Promise<BackgroundConfig | null>;
export const ensureThemeConfig = (id: string | null | undefined) => ensureConfig('theme', 'theme_config', id) as Promise<ThemeConfig | null>;
export const ensureEmojiConfig = (id: string | null | undefined) => ensureConfig('emoji', 'emoji_config', id) as Promise<EmojiConfig | null>;
export const ensureEffectConfig = (id: string | null | undefined) => ensureConfig('effect', 'effect_config', id) as Promise<EffectConfig | null>;
