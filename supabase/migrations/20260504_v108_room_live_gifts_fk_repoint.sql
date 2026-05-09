-- ════════════════════════════════════════════════════════════
-- v108.5 (4 May 2026): room_live_gifts FK → cosmetic_items
-- ════════════════════════════════════════════════════════════
-- Eski şemada room_live_gifts.gift_id → gifts_catalog(id) idi. Yeni hediye
-- sistemi cosmetic_items üzerinde çalışıyor; FK uyuşmazlığı INSERT'leri
-- bloke ediyordu. Constraint cosmetic_items'a yönlendirildi.
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.room_live_gifts
  DROP CONSTRAINT IF EXISTS room_live_gifts_gift_id_fkey;

ALTER TABLE public.room_live_gifts
  ADD CONSTRAINT room_live_gifts_gift_id_fkey
    FOREIGN KEY (gift_id) REFERENCES public.cosmetic_items(id) ON DELETE RESTRICT;
