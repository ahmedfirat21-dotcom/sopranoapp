-- ════════════════════════════════════════════════════════════════════
-- v118: profiles tablosuna kullanıcı kozmetik tercih kolonları
-- ════════════════════════════════════════════════════════════════════
-- Mevcut `active_frame` (çerçeve) gibi yapı; 6 yeni kategori için
-- kullanıcının etkin ürün tercihini tutar. Mobile tarafı bu kolonları
-- okuyup ilgili Skia component'leri render eder.
--
-- Kullanım örneği (mobile):
--   const userProfile = ...;
--   <GlowMessageBubble glowItemId={userProfile.active_glow_id} />
--   <CosmeticBadge badgeItemId={userProfile.active_badge_id} />
--   <CosmeticBackground bgItemId={userProfile.active_bg_id} />
--   <CosmeticParticleEffect effectItemId={room.active_effect_id} />
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_glow_id   text REFERENCES public.cosmetic_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS active_badge_id  text REFERENCES public.cosmetic_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS active_bg_id     text REFERENCES public.cosmetic_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS active_theme_id  text REFERENCES public.cosmetic_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS active_emoji_id  text REFERENCES public.cosmetic_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS active_effect_id text REFERENCES public.cosmetic_items(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.active_glow_id   IS 'Etkin Parlak Mesaj ürün id (cosmetic_items.id, category=glow_message)';
COMMENT ON COLUMN public.profiles.active_badge_id  IS 'Etkin Rozet ürün id (cosmetic_items.id, category=badge)';
COMMENT ON COLUMN public.profiles.active_bg_id     IS 'Etkin Arkaplan ürün id (cosmetic_items.id, category=background)';
COMMENT ON COLUMN public.profiles.active_theme_id  IS 'Etkin Tema ürün id (cosmetic_items.id, category=theme)';
COMMENT ON COLUMN public.profiles.active_emoji_id  IS 'Etkin Emoji Seti ürün id (cosmetic_items.id, category=emoji)';
COMMENT ON COLUMN public.profiles.active_effect_id IS 'Etkin Efekt ürün id (cosmetic_items.id, category=effect)';

-- İndeks: hızlı join için (her biri opsiyonel ama eklendi)
CREATE INDEX IF NOT EXISTS idx_profiles_active_glow   ON public.profiles(active_glow_id)   WHERE active_glow_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_active_badge  ON public.profiles(active_badge_id)  WHERE active_badge_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_active_bg     ON public.profiles(active_bg_id)    WHERE active_bg_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_active_theme  ON public.profiles(active_theme_id) WHERE active_theme_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_active_emoji  ON public.profiles(active_emoji_id) WHERE active_emoji_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_active_effect ON public.profiles(active_effect_id) WHERE active_effect_id IS NOT NULL;
