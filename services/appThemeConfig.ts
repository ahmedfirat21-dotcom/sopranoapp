/**
 * App Theme Config — Sistem teması (renk paleti) mobile fetch + realtime sync
 * ════════════════════════════════════════════════════════════════════
 * v120 (13 May 2026) — Web admin /yonet/tema-sistemi'nde yapılan tema
 * değişiklikleri mobile'a anında yansır. roomLayoutConfig pattern.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../constants/supabase';

export interface AppTheme {
  color_primary: string;
  color_primary_hover: string;
  color_secondary: string;
  color_accent: string;
  color_success: string;
  color_warning: string;
  color_danger: string;
  color_info: string;
  surface_bg: string;
  surface_card: string;
  surface_elevated: string;
  surface_overlay: string;
  surface_modal: string;
  surface_border: string;
  surface_divider: string;
  text_primary: string;
  text_secondary: string;
  text_tertiary: string;
  text_inverse: string;
  text_link: string;
  text_muted: string;
  gradient_brand_from: string;
  gradient_brand_to: string;
  gradient_brand_angle: number;
  gradient_premium_from: string;
  gradient_premium_to: string;
  radius_sm: number; radius_md: number; radius_lg: number; radius_xl: number; radius_pill: number;
  mode: 'dark' | 'light' | 'auto';
}

export const DEFAULT_APP_THEME: AppTheme = {
  color_primary: '#14B8A6',
  color_primary_hover: '#0D9488',
  color_secondary: '#A78BFA',
  color_accent: '#FBBF24',
  color_success: '#10B981',
  color_warning: '#F59E0B',
  color_danger: '#EF4444',
  color_info: '#3B82F6',
  surface_bg: '#0A0F1A',
  surface_card: '#0F1926',
  surface_elevated: '#1E293B',
  surface_overlay: 'rgba(15,25,38,0.85)',
  surface_modal: '#0F1926',
  surface_border: 'rgba(255,255,255,0.08)',
  surface_divider: 'rgba(255,255,255,0.04)',
  text_primary: '#F1F5F9',
  text_secondary: '#CBD5E1',
  text_tertiary: '#94A3B8',
  text_inverse: '#0F172A',
  text_link: '#22D3EE',
  text_muted: '#64748B',
  gradient_brand_from: '#14B8A6',
  gradient_brand_to: '#06B6D4',
  gradient_brand_angle: 135,
  gradient_premium_from: '#FBBF24',
  gradient_premium_to: '#F472B6',
  radius_sm: 6, radius_md: 12, radius_lg: 18, radius_xl: 24, radius_pill: 999,
  mode: 'dark',
};

const TTL_MS = 5 * 60 * 1000;
let _cache: { theme: AppTheme; ts: number } | null = null;
const _listeners = new Set<(t: AppTheme) => void>();

function mergeDefaults(raw: any): AppTheme {
  if (!raw || typeof raw !== 'object') return DEFAULT_APP_THEME;
  return { ...DEFAULT_APP_THEME, ...raw };
}

export function getCachedTheme(): AppTheme {
  if (_cache && Date.now() - _cache.ts <= TTL_MS) return _cache.theme;
  return DEFAULT_APP_THEME;
}

export async function fetchAppTheme(): Promise<AppTheme> {
  try {
    const { data, error } = await supabase
      .from('app_theme_config')
      .select('config')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (error || !data?.config) return DEFAULT_APP_THEME;
    const t = mergeDefaults(data.config);
    _cache = { theme: t, ts: Date.now() };
    return t;
  } catch {
    return DEFAULT_APP_THEME;
  }
}

export async function ensureAppTheme(): Promise<AppTheme> {
  if (_cache && Date.now() - _cache.ts <= TTL_MS) return _cache.theme;
  return fetchAppTheme();
}

export function invalidateAppTheme() {
  _cache = null;
  fetchAppTheme().then(t => _listeners.forEach(fn => { try { fn(t); } catch {} }));
}

let _sub: any = null;
export function startAppThemeSync() {
  if (_sub) return _sub;
  _sub = supabase
    .channel('app_theme_config_changes')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_theme_config' }, () => invalidateAppTheme())
    .subscribe();
  fetchAppTheme(); // first fetch
  return _sub;
}

/** React hook — tema değişimlerini dinler */
export function useAppTheme(): AppTheme {
  const [theme, setTheme] = useState<AppTheme>(() => getCachedTheme());

  useEffect(() => {
    let mounted = true;
    ensureAppTheme().then(t => { if (mounted) setTheme(t); });
    const listener = (t: AppTheme) => { if (mounted) setTheme(t); };
    _listeners.add(listener);
    return () => { mounted = false; _listeners.delete(listener); };
  }, []);

  return theme;
}
