-- ★ v110.12 (8 May 2026): 5 Yeni Premium El Yapımı Çerçeve — Mağaza ürün kaydı
-- Supabase SQL Editor'da çalıştırılmalı.
--
-- Fiyatlandırma referansı:
--   soprano-aura  → legendary  → 2500 SP (marka çerçevesi, premium)
--   aurelius      → legendary  → 3000 SP (kanatlı VIP)
--   lunaris       → rare       → 1500 SP
--
-- Yeni çerçeveler SopranoAura tarzı (halka + shimmer + sparkle):
--   midnight-amethyst → mythic     → 3500 SP (en premium, ametist tema)
--   sunrise-gold      → legendary  → 2800 SP (çift halka, altın lüks)
--   neon-pulse        → legendary  → 2500 SP (neon cyberpunk, soprano-aura eşdeğeri)
--   ruby-flame        → rare       → 1800 SP (ateş halka, erişilebilir premium)
--   ocean-pearl       → rare       → 1500 SP (okyanus, giriş seviyesi)

-- ────────────────────────────────────────────────────────────────
-- 1. Midnight Amethyst — Mor/ametist dönen halka + elmas parıltıları
-- ────────────────────────────────────────────────────────────────
INSERT INTO cosmetic_items (
  id, category, rarity, name, meta, tagline,
  art_emoji, art_color,
  bg_gradient_start, bg_gradient_mid, bg_gradient_end, bg_radial,
  price_sp, per_message, is_featured, collection_id,
  display_order, active, available_until, max_supply, sold_count, launched_at
) VALUES (
  'midnight-amethyst',
  'frames',
  'mythic',
  'Midnight Amethyst',
  'Premium ametist aurora çerçeve — dönen mor gradient halka + elmas sparkle',
  'Gecenin derinliğinde parlayan ametist ışığını avatarında hisset',
  '💎',
  '#C48BF5',
  '#2D0A4F',
  '#7B22B8',
  '#E0B0FF',
  'rgba(196,139,245,0.35)',
  3500,
  false,
  true,
  NULL,
  11,
  true,
  NULL,
  NULL,
  0,
  NOW()
);

-- ────────────────────────────────────────────────────────────────
-- 2. Sunrise Gold — Altın çift halka + yıldız patlamaları
-- ────────────────────────────────────────────────────────────────
INSERT INTO cosmetic_items (
  id, category, rarity, name, meta, tagline,
  art_emoji, art_color,
  bg_gradient_start, bg_gradient_mid, bg_gradient_end, bg_radial,
  price_sp, per_message, is_featured, collection_id,
  display_order, active, available_until, max_supply, sold_count, launched_at
) VALUES (
  'sunrise-gold',
  'frames',
  'legendary',
  'Sunrise Gold',
  'Premium altın çift halka çerçeve — ters dönen halkalar + yıldız burst',
  'Şafağın altın ışıltısıyla sahneye çık',
  '✨',
  '#FBBF24',
  '#3D1F00',
  '#854F0B',
  '#FFE082',
  'rgba(251,191,36,0.35)',
  2800,
  false,
  false,
  NULL,
  12,
  true,
  NULL,
  NULL,
  0,
  NOW()
);

-- ────────────────────────────────────────────────────────────────
-- 3. Neon Pulse — Pembe-cyan çift halka + pulse efekti
-- ────────────────────────────────────────────────────────────────
INSERT INTO cosmetic_items (
  id, category, rarity, name, meta, tagline,
  art_emoji, art_color,
  bg_gradient_start, bg_gradient_mid, bg_gradient_end, bg_radial,
  price_sp, per_message, is_featured, collection_id,
  display_order, active, available_until, max_supply, sold_count, launched_at
) VALUES (
  'neon-pulse',
  'frames',
  'legendary',
  'Neon Pulse',
  'Premium neon çerçeve — pembe-cyan çift halka + pulse breathing efekti',
  'Neon ışıklarla nabzını hissettir',
  '💗',
  '#F46BB7',
  '#330A24',
  '#831853',
  '#F9A8D4',
  'rgba(244,107,183,0.35)',
  2500,
  false,
  false,
  NULL,
  13,
  true,
  NULL,
  NULL,
  0,
  NOW()
);

-- ────────────────────────────────────────────────────────────────
-- 4. Ruby Flame — Kırmızı/turuncu ateş halka + ember parıltıları
-- ────────────────────────────────────────────────────────────────
INSERT INTO cosmetic_items (
  id, category, rarity, name, meta, tagline,
  art_emoji, art_color,
  bg_gradient_start, bg_gradient_mid, bg_gradient_end, bg_radial,
  price_sp, per_message, is_featured, collection_id,
  display_order, active, available_until, max_supply, sold_count, launched_at
) VALUES (
  'ruby-flame',
  'frames',
  'rare',
  'Ruby Flame',
  'Premium ateş çerçeve — kırmızı-turuncu gradient halka + 6 ember sparkle',
  'İçindeki ateşi avatarına yansıt',
  '🔥',
  '#DC2626',
  '#1F0500',
  '#7F1D1D',
  '#FCA5A5',
  'rgba(220,38,38,0.35)',
  1800,
  false,
  false,
  NULL,
  14,
  true,
  NULL,
  NULL,
  0,
  NOW()
);

-- ────────────────────────────────────────────────────────────────
-- 5. Ocean Pearl — Okyanus teal halka + kabarcık efekti
-- ────────────────────────────────────────────────────────────────
INSERT INTO cosmetic_items (
  id, category, rarity, name, meta, tagline,
  art_emoji, art_color,
  bg_gradient_start, bg_gradient_mid, bg_gradient_end, bg_radial,
  price_sp, per_message, is_featured, collection_id,
  display_order, active, available_until, max_supply, sold_count, launched_at
) VALUES (
  'ocean-pearl',
  'frames',
  'rare',
  'Ocean Pearl',
  'Premium okyanus çerçeve — teal gradient halka + kabarcık parçacıkları',
  'Derin sulardaki huzuru avatarında taşı',
  '🌊',
  '#22D3EE',
  '#001A1F',
  '#0E7490',
  '#A5F3FC',
  'rgba(34,211,238,0.35)',
  1500,
  false,
  false,
  NULL,
  15,
  true,
  NULL,
  NULL,
  0,
  NOW()
);
