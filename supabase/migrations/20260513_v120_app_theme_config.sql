-- ════════════════════════════════════════════════════════════════════
-- v120: Uygulama Teması — sistem ayarı (tek row config)
-- ════════════════════════════════════════════════════════════════════
-- Tema artık mağaza ürünü değil, sistem genelinde tek aktif config.
-- room_layout_config pattern'ında: tek 'default' row + realtime sub.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.app_theme_config (
  id         text PRIMARY KEY,
  name       text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  config     jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Default theme (Soprano Karanlık)
INSERT INTO public.app_theme_config (id, name, config)
VALUES (
  'default',
  'Soprano Karanlık',
  jsonb_build_object(
    'color_primary', '#14B8A6',
    'color_primary_hover', '#0D9488',
    'color_secondary', '#A78BFA',
    'color_accent', '#FBBF24',
    'color_success', '#10B981',
    'color_warning', '#F59E0B',
    'color_danger', '#EF4444',
    'color_info', '#3B82F6',
    'surface_bg', '#0A0F1A',
    'surface_card', '#0F1926',
    'surface_elevated', '#1E293B',
    'surface_overlay', 'rgba(15,25,38,0.85)',
    'surface_modal', '#0F1926',
    'surface_border', 'rgba(255,255,255,0.08)',
    'surface_divider', 'rgba(255,255,255,0.04)',
    'text_primary', '#F1F5F9',
    'text_secondary', '#CBD5E1',
    'text_tertiary', '#94A3B8',
    'text_inverse', '#0F172A',
    'text_link', '#22D3EE',
    'text_muted', '#64748B',
    'gradient_brand_from', '#14B8A6',
    'gradient_brand_to', '#06B6D4',
    'gradient_brand_angle', 135,
    'gradient_premium_from', '#FBBF24',
    'gradient_premium_to', '#F472B6',
    'gradient_danger_from', '#EF4444',
    'gradient_danger_to', '#DC2626',
    'radius_sm', 6, 'radius_md', 12, 'radius_lg', 18, 'radius_xl', 24, 'radius_pill', 999, 'spacing_unit', 4,
    'transition_fast_ms', 150, 'transition_normal_ms', 300, 'transition_slow_ms', 500,
    'easing_default', 'cubic-bezier(0.4, 0, 0.2, 1)',
    'mode', 'dark',
    'light_inverse_enabled', false,
    'auto_match_system', false,
    'description', 'Maison Soprano varsayılan karanlık teması'
  )
)
ON CONFLICT (id) DO NOTHING;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_app_theme_config()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_touch_app_theme_config ON public.app_theme_config;
CREATE TRIGGER trg_touch_app_theme_config BEFORE UPDATE ON public.app_theme_config
  FOR EACH ROW EXECUTE FUNCTION public.touch_app_theme_config();

-- RLS — anon okuma, admin yazma
ALTER TABLE public.app_theme_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone_read_app_theme" ON public.app_theme_config;
CREATE POLICY "anyone_read_app_theme" ON public.app_theme_config FOR SELECT TO anon, authenticated USING (true);

-- Realtime publish
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_theme_config;
