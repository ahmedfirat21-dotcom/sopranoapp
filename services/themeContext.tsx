/**
 * ThemeContext — Kullanıcı active_theme_id'sine göre renk paleti
 * ════════════════════════════════════════════════════════════════════
 * v117 — Web admin "Temalar" editöründen gelen theme_config'i tüketir.
 * Eski Colors.* sabit kalır (geriye dönük uyumluluk); yeni component'ler
 * useThemedColors() ile dinamik palet alır.
 *
 * Kullanım:
 *   const c = useThemedColors();
 *   <Text style={{ color: c.text_primary }} />
 *
 * Tema yoksa default (Soprano Karanlık) palet döner.
 */
import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ensureThemeConfig, subscribeEditorConfigChange, type ThemeConfig } from './cosmeticEditorConfigs';
import { useAppTheme } from './appThemeConfig';

const DEFAULT_THEME: ThemeConfig = {
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
  gradient_danger_from: '#EF4444',
  gradient_danger_to: '#DC2626',
  radius_sm: 6, radius_md: 12, radius_lg: 18, radius_xl: 24, radius_pill: 999, spacing_unit: 4,
  transition_fast_ms: 150, transition_normal_ms: 300, transition_slow_ms: 500,
  easing_default: 'ease-in-out',
  mode: 'dark', light_inverse_enabled: false,
  light_surface_bg: '#FFFFFF', light_text_primary: '#0F172A',
  auto_match_system: false, is_premium_only: false, preview_in_settings: true, description: '',
};

const ThemeCtx = createContext<ThemeConfig>(DEFAULT_THEME);

export function ThemeProvider({ themeItemId, children }: { themeItemId?: string | null; children: ReactNode }) {
  // ★ v249 (13 May 2026): Sistem teması (admin tarafından ayarlanan) baz olarak alınır;
  //   varsa kullanıcı override theme'i üstüne uygulanır.
  const systemTheme = useAppTheme();
  const [userTheme, setUserTheme] = useState<Partial<ThemeConfig> | null>(null);

  useEffect(() => {
    if (!themeItemId) { setUserTheme(null); return; }
    let mounted = true;
    ensureThemeConfig(themeItemId).then((c) => {
      if (mounted && c) setUserTheme(c);
    });
    const unsub = subscribeEditorConfigChange((id) => {
      if (id !== themeItemId) return;
      ensureThemeConfig(themeItemId).then((c) => {
        if (mounted && c) setUserTheme(c);
      });
    });
    return () => { mounted = false; unsub(); };
  }, [themeItemId]);

  const merged = useMemo<ThemeConfig>(() => ({
    ...DEFAULT_THEME,
    ...(systemTheme as Partial<ThemeConfig>),
    ...(userTheme || {}),
  }), [systemTheme, userTheme]);

  return <ThemeCtx.Provider value={merged}>{children}</ThemeCtx.Provider>;
}

/** Hook — dinamik tema renkleri ve değerleri */
export function useThemedColors(): ThemeConfig {
  return useContext(ThemeCtx);
}

/** Marka gradient string yardımcısı */
export function useBrandGradient(): { colors: string[]; angle: number } {
  const t = useThemedColors();
  return { colors: [t.gradient_brand_from, t.gradient_brand_to], angle: t.gradient_brand_angle };
}
