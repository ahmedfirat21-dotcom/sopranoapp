-- ★ v108.31: SopranoChat Teal Aurora Çerçeve — Mağaza ürün kaydı
-- Supabase SQL Editor'da çalıştırılmalı.
INSERT INTO cosmetic_items (
  id,
  category,
  rarity,
  name,
  meta,
  tagline,
  art_emoji,
  art_color,
  bg_gradient_start,
  bg_gradient_mid,
  bg_gradient_end,
  bg_radial,
  price_sp,
  per_message,
  is_featured,
  collection_id,
  display_order,
  active,
  available_until,
  max_supply,
  sold_count,
  launched_at
) VALUES (
  'soprano-aura',          -- id: frameLottieRegistry + FRAME_PALETTES key
  'frames',                -- category
  'legendary',             -- rarity
  'Soprano Aura',          -- name
  'SopranoChat premium teal aurora frame',  -- meta
  'Markanın ruhunu avatarında taşı',        -- tagline
  '🌊',                    -- art_emoji
  '#4CE0E2',               -- art_color (teal)
  '#0E7490',               -- bg_gradient_start (dark teal)
  '#1E848E',               -- bg_gradient_mid
  '#A5F3FC',               -- bg_gradient_end (light cyan)
  'rgba(76,224,226,0.35)', -- bg_radial
  2500,                    -- price_sp
  false,                   -- per_message
  true,                    -- is_featured (vitrin)
  NULL,                    -- collection_id
  10,                      -- display_order
  true,                    -- active
  NULL,                    -- available_until (süresiz)
  NULL,                    -- max_supply (sınırsız)
  0,                       -- sold_count
  NOW()                    -- launched_at
);
