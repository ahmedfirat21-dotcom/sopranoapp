-- ════════════════════════════════════════════════════════════
-- v107 hotfix (4 May 2026): Inferno geri etkinleştir
-- ════════════════════════════════════════════════════════════
-- Önce manuel SVG illustration'ın görsel kalitesi yetersizdi → deactivate.
-- Şimdi PNG asset (assets/store/items/inferno.png) ile aynı kalite seviyesinde,
-- mağazaya ve premium glow listesine geri ekleniyor.
--
-- Etkilenen ürünler:
--   - inferno       (message_art) → mağazada görünür + premium glow seçilebilir
--   - gift-fire     (gift)         → inferno alias'lı hediye
-- ════════════════════════════════════════════════════════════

UPDATE public.cosmetic_items
SET active = true
WHERE id IN ('inferno', 'gift-fire');
