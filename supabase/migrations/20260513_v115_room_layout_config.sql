-- ════════════════════════════════════════════════════════════════════
-- v115: Oda Düzen Konfigürasyonu (Room Layout Config)
-- ════════════════════════════════════════════════════════════════════
-- Web admin'de oda layout'unu ince ayarlayabilmek için tek global
-- konfigürasyon tablosu. Frame editor mimarisi gibi: web admin slider'ları
-- DB'yi günceller, mobile app fetch+cache eder.
--
-- Tek satır, id='default' — şimdilik tek aktif config. İleride preset
-- sistemi için id='preset_xxx' satırları eklenebilir + active_id pointer.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.room_layout_config (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  is_active   boolean NOT NULL DEFAULT false,
  config      jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Tek satır insert — default preset, mevcut "Clubhouse pattern" değerleri
INSERT INTO public.room_layout_config (id, name, is_active, config)
VALUES (
  'default',
  'Klasik',
  true,
  jsonb_build_object(
    'host', jsonb_build_object(
      'avatarShape',     'circle',          -- circle | square | rounded | hex
      'avatarSize',      96,                -- px (mobile dp olarak okur)
      'borderRadius',    48,                -- shape rounded ise corner radius
      'ringWidth',       3,
      'ringColor',       '#FBBF24',
      'ringStyle',       'solid',           -- solid | dashed | dotted | none
      'namePosition',    'below',           -- below | above | inside | hidden
      'nameFontSize',    14,
      'nameFontWeight',  '700',
      'nameColor',       '#FFFFFF',
      'badgePosition',   'topRight',        -- topRight | topLeft | bottomRight | bottomLeft | hidden
      'haloEnabled',     true,
      'haloColor',       '#FBBF24',
      'haloOpacity',     0.45,
      'haloBlur',        24,
      'containerPadding', 12
    ),
    'speakers', jsonb_build_object(
      'avatarShape',     'circle',
      'borderRadius',    50,
      'maxCols',         4,
      'colGap',          14,
      'rowGap',          16,
      'ringWidth',       2,
      'ringColor',       '#14B8A6',
      'speakingRingColor', '#10B981',
      'namePosition',    'below',
      'nameFontSize',    12,
      'nameMaxChars',    10,
      'showMicIcon',     true,
      'muteOpacity',     0.55,
      'sizePresets',     jsonb_build_object(
        'small',   84,
        'medium',  100,
        'large',   110
      )
    ),
    'listeners', jsonb_build_object(
      'avatarShape',     'circle',
      'borderRadius',    50,
      'maxCols',         6,
      'colGap',          10,
      'rowGap',          12,
      'showName',        true,
      'nameFontSize',    10,
      'nameMaxChars',    8,
      'ringWidth',       0,
      'ringColor',       'transparent',
      'ownerCrownEnabled', true,
      'ownerScale',      1.10,
      'sizePresets',     jsonb_build_object(
        'small',  42,
        'medium', 50,
        'large',  60
      )
    ),
    'stage', jsonb_build_object(
      'backgroundColor', 'rgba(15,25,38,0.0)',
      'borderRadius',    0,
      'padding',         16,
      'dividerStyle',    'none',            -- none | line | gradient
      'dividerColor',    'rgba(255,255,255,0.08)',
      'gapBetweenSpeakersAndListeners', 20
    ),
    'global', jsonb_build_object(
      'background',      'gradient',        -- solid | gradient | image | none
      'bgColor',         '#0A0F1A',
      'bgGradient',      jsonb_build_array('#0F1926', '#0A0F1A'),
      'bgImageUrl',      null,
      'safePaddingTop',  12,
      'safePaddingBottom', 12,
      'horizontalPadding', 16
    )
  )
);

-- Updated_at otomatik bump trigger
CREATE OR REPLACE FUNCTION public.touch_room_layout_config()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_room_layout_config ON public.room_layout_config;
CREATE TRIGGER trg_touch_room_layout_config
  BEFORE UPDATE ON public.room_layout_config
  FOR EACH ROW EXECUTE FUNCTION public.touch_room_layout_config();

-- RLS — okuma herkese, yazma sadece admin (service_role)
ALTER TABLE public.room_layout_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_read_room_layout" ON public.room_layout_config;
CREATE POLICY "anyone_read_room_layout"
  ON public.room_layout_config
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Realtime publish — web admin'de değişiklik yapıldığında mobile anında uygular
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_layout_config;
