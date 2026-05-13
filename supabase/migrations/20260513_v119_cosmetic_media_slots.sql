-- ════════════════════════════════════════════════════════════════════
-- v119: cosmetic_items'a çoklu görsel slot kolonları
-- ════════════════════════════════════════════════════════════════════
-- Mevcut `asset_url` Lottie/PNG ana animasyon için. Ek 3 görsel slotu:
--   - thumb_url    : Mağaza listesi küçük resim (60×60 px)
--   - hero_url     : Mağaza detay/banner büyük (800×400)
--   - preview_url  : Picker/inline gösterim (160×160)
--
-- Hepsi opsiyonel; doluysa mobile o görseli kullanır, boşsa fallback
-- (art_emoji + art_color veya asset_url).
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.cosmetic_items
  ADD COLUMN IF NOT EXISTS thumb_url   text,
  ADD COLUMN IF NOT EXISTS hero_url    text,
  ADD COLUMN IF NOT EXISTS preview_url text;

COMMENT ON COLUMN public.cosmetic_items.thumb_url   IS 'Mağaza listesi küçük resim (60×60). PNG/JPG/WebP.';
COMMENT ON COLUMN public.cosmetic_items.hero_url    IS 'Mağaza detay/banner büyük (800×400). PNG/JPG.';
COMMENT ON COLUMN public.cosmetic_items.preview_url IS 'Picker/inline gösterim (160×160). PNG/WebP.';
