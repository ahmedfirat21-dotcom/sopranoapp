-- v108: Mağaza temizliği — tekrar eden/gereksiz ürünleri deaktive et + kategori güncelle
-- gift-star (Or Ancien) = or-ancien entry_effect ile aynı isim
-- gift-sparkle (Constellation) = constellation entry_effect ile aynı
-- gift-volcano (Vesuvius) = vesuvius frame ile aynı isim
-- gift-sparkles (Parıltı) = gift-sparkle ile emoji aynı (✨)
-- gift-kiss = gift-love ile çok benzer

UPDATE public.cosmetic_items SET active = false
WHERE id IN ('gift-star', 'gift-sparkle', 'gift-volcano', 'gift-sparkles', 'gift-kiss');

UPDATE public.cosmetic_items SET category = 'entry_effect', per_message = false WHERE category = 'message_art';

UPDATE public.cosmetic_items SET category = 'frames' WHERE category = 'atelier';
