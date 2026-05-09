-- ════════════════════════════════════════════════════════════
-- v108.2 (4 May 2026): Frame → Gift swap + halka çerçeve seed
-- ════════════════════════════════════════════════════════════
-- Eski 5 frame (phoenix-diadem, galactique, aurum-strike, glacier-aura,
-- vesuvius) hediye kategorisine alınır — kullanıcı talebi: bu görseller
-- "ürün" olarak hediye gönderilebilsin, frame slotu yeni halka tasarımlara
-- bırakılsın. Yeni 5 halka çerçeve aynı tema renkleriyle seed edilir.
-- ════════════════════════════════════════════════════════════

-- ── 1) Eski 5 frame → category='gift', uygun hediye fiyatları ──
UPDATE public.cosmetic_items
SET category      = 'gift',
    price_sp      = CASE id
      WHEN 'phoenix-diadem' THEN 250
      WHEN 'galactique'     THEN 180
      WHEN 'aurum-strike'   THEN 150
      WHEN 'glacier-aura'   THEN 110
      WHEN 'vesuvius'       THEN 130
    END,
    is_featured   = false,
    display_order = CASE id
      WHEN 'phoenix-diadem' THEN 145
      WHEN 'galactique'     THEN 140
      WHEN 'aurum-strike'   THEN 135
      WHEN 'glacier-aura'   THEN 125
      WHEN 'vesuvius'       THEN 130
    END
WHERE id IN ('phoenix-diadem','galactique','aurum-strike','glacier-aura','vesuvius');

-- ── 2) Yeni 5 halka çerçeve seed (eski tema renkleri, sade halka) ──
INSERT INTO public.cosmetic_items (
  id, category, rarity, name, meta, tagline, art_emoji, art_color,
  bg_gradient_start, bg_gradient_mid, bg_gradient_end,
  price_sp, per_message, is_featured, display_order, active
) VALUES
  ('phoenix-ring',    'frames', 'mythic',    'Phoenix Halkası', 'PEMBE-ALTIN HALKA',  'Phoenix temalı sade halka.',     '◯', '#F472B6', '#1A0518', '#831843', '#BE185D', 1200, false, false, 50, true),
  ('galactique-ring', 'frames', 'legendary', 'Galaksi Halkası', 'MOR HALKA · KOZMOS', 'Galaktik mor halka.',            '◯', '#A78BFA', '#0A0518', '#1E1B4B', '#312E81',  900, false, false, 55, true),
  ('aurum-ring',      'frames', 'legendary', 'Aurum Halka',     'ALTIN HALKA',         'Saf altın halka.',               '◯', '#FBBF24', '#1A1500', '#5C4612', '#854F0B',  800, false, false, 65, true),
  ('vesuvius-ring',   'frames', 'rare',      'Volkan Halkası',  'KOR TURUNCU HALKA',   'Vesuvius temalı turuncu halka.', '◯', '#FB923C', '#1F0500', '#7F1D1D', '#B91C1C',  700, false, false, 95, true),
  ('glacier-ring',    'frames', 'rare',      'Buz Halkası',     'BUZ MAVİ HALKA',      'Glacier temalı mavi halka.',     '◯', '#22D3EE', '#001A1F', '#0E4A52', '#155E75',  600, false, false, 100, true)
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
  display_order     = EXCLUDED.display_order,
  active            = true;
