-- ════════════════════════════════════════════════════════════
-- v108.12 (4 May 2026): SP Ekonomi Tutarlılık Rebalance
-- ════════════════════════════════════════════════════════════
-- 1) Premium Glow fiyatları 10x artırıldı — Or Ancien 12 SP idi (1 mesaj
--    parlatma = 5 SP). Sonsuz kullanım hakkının fiyatı 2-3 mesaj kadardı,
--    ekonomi anlamsızdı. Yeni fiyatlar legendary hediye seviyesinde.
-- 2) Hediyelerde rarity-fiyat tutarsızlıkları düzeltildi (etiketler).
-- ════════════════════════════════════════════════════════════

-- ── 1) Premium Glow fiyatları (mağazada satılan, sonsuz kullanım) ──
UPDATE public.cosmetic_items SET price_sp = 120 WHERE id = 'or-ancien';
UPDATE public.cosmetic_items SET price_sp = 180 WHERE id = 'inferno';
UPDATE public.cosmetic_items SET price_sp = 220 WHERE id = 'voltaire';
UPDATE public.cosmetic_items SET price_sp = 280 WHERE id = 'belle-epoque';
UPDATE public.cosmetic_items SET price_sp = 400 WHERE id = 'constellation';

-- ── 2) Hediye rarity-etiket tutarlılığı ──
-- Şimşek 50 SP → "legendary" çok yüksek; bu fiyatta "rare" doğal
UPDATE public.cosmetic_items SET rarity = 'rare' WHERE id = 'gift-bolt';
-- Glacier Aura 110 SP → "rare" düşük; legendary mantıklı
UPDATE public.cosmetic_items SET rarity = 'legendary' WHERE id = 'glacier-aura';
-- Vesuvius 130 SP → "new" sadece yakın eklenmiş; legendary doğru
UPDATE public.cosmetic_items SET rarity = 'legendary' WHERE id = 'vesuvius';
-- Konfeti / Kutlama "new" — 5+ aylık ürünler, "rare" daha doğru
UPDATE public.cosmetic_items SET rarity = 'rare' WHERE id = 'gift-confetti';
UPDATE public.cosmetic_items SET rarity = 'rare' WHERE id = 'gift-celebrate';
-- Balon "new" — entry-level, "new" kalsın (yakın eklendi sayılır)
