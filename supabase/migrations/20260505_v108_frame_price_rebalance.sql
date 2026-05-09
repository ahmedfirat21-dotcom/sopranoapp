-- ★ v108.21 (5 May 2026) — Çerçeve fiyat-rarity rebalance.
--
-- Tezatlıklar:
--   • Aurum Halka 800 SP "legendary" iken Lunaris 1000 SP "rare" → ucuz olan rare olmalı
--   • Spectrum Orbit 900 SP "new" → "new" bir tier değil, rarity ile çakışıyor
--   • Aurelius 1500 SP "legendary" — Lottie animasyonlu premium ama mythic Phoenix 1200'den pahalı
--   • Phoenix mythic 1200 ile Galaksi legendary 900 arasında sade fark; tier hiyerarşisi karışık
--
-- Yeni hiyerarşi (price_sp ascending):
--   600-900   → rare      (sade halkalar)
--   1100-1600 → legendary (Lottie animasyonlu, görsel zengin)
--   2000-2400 → mythic    (premium, sınırlı sayı/zaman)
--   3000+     → divine    (en üst seviye)

UPDATE public.cosmetic_items SET price_sp = 600,  rarity = 'rare'      WHERE id = 'glacier-ring';
UPDATE public.cosmetic_items SET price_sp = 700,  rarity = 'rare'      WHERE id = 'vesuvius-ring';
UPDATE public.cosmetic_items SET price_sp = 800,  rarity = 'rare'      WHERE id = 'aurum-ring';
UPDATE public.cosmetic_items SET price_sp = 900,  rarity = 'rare'      WHERE id = 'spectrum-orbit';
UPDATE public.cosmetic_items SET price_sp = 900,  rarity = 'rare'      WHERE id = 'galactique-ring';
UPDATE public.cosmetic_items SET price_sp = 1100, rarity = 'legendary' WHERE id = 'phoenix-ring';
UPDATE public.cosmetic_items SET price_sp = 1300, rarity = 'legendary' WHERE id = 'lunaris';
UPDATE public.cosmetic_items SET price_sp = 1600, rarity = 'legendary' WHERE id = 'aurelius';
UPDATE public.cosmetic_items SET price_sp = 2000, rarity = 'mythic'    WHERE id = 'rose-eternel';
UPDATE public.cosmetic_items SET price_sp = 2400, rarity = 'mythic'    WHERE id = 'cadence-soprano';
UPDATE public.cosmetic_items SET price_sp = 3000, rarity = 'divine'    WHERE id = 'lumiere-divine';

-- Bundle toplamları item fiyat değişimine göre güncellendi
-- Phoenix Seti: phoenix-ring (1100) + or-ancien (120) = 1220
-- Galactique Seti: galactique-ring (900) + constellation (400) = 1300 (aynı)
-- Aurelius Royale: aurelius (1600) + lumiere-divine (3000) + belle-epoque (280) = 4880
UPDATE public.cosmetic_bundles SET total_price_sp = 1220 WHERE id = 'bundle-phoenix-set';
UPDATE public.cosmetic_bundles SET total_price_sp = 4880 WHERE id = 'bundle-aurelius-royale';
