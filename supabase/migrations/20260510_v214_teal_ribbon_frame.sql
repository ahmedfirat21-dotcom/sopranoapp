-- ════════════════════════════════════════════════════════════
-- v214 (10 May 2026): TealRibbon — Teal-Cyan Kurdaleli Çerçeve
-- ════════════════════════════════════════════════════════════
-- Toz parçacıkları + parlama animasyonlu, alt kısımda kurdale banner.
-- Kullanıcı adı kurdale üzerine Text overlay ile render edilir.
-- frameLottieRegistry.ts → 'teal-ribbon' entry bağlı.
-- ════════════════════════════════════════════════════════════

INSERT INTO public.cosmetic_items (
  id, category, rarity, name, meta, tagline, art_emoji, art_color,
  bg_gradient_start, bg_gradient_mid, bg_gradient_end,
  price_sp, per_message, is_featured, display_order, active
) VALUES
  ('teal-ribbon', 'frames', 'legendary', 'Teal Ribbon', 'KURDALE · ANIMÉ · PARLAK', 'İsmin parıldasın.', '🎀', '#14B8A6', '#001A1F', '#0D5F68', '#14B8A6', 1800, false, true, 95, true)
ON CONFLICT (id) DO UPDATE SET
  name              = EXCLUDED.name,
  meta              = EXCLUDED.meta,
  tagline           = EXCLUDED.tagline,
  rarity            = EXCLUDED.rarity,
  art_emoji         = EXCLUDED.art_emoji,
  art_color         = EXCLUDED.art_color,
  bg_gradient_start = EXCLUDED.bg_gradient_start,
  bg_gradient_mid   = EXCLUDED.bg_gradient_mid,
  bg_gradient_end   = EXCLUDED.bg_gradient_end,
  price_sp          = EXCLUDED.price_sp,
  is_featured       = EXCLUDED.is_featured,
  display_order     = EXCLUDED.display_order,
  active            = true;
