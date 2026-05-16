-- ★ v280 (15 May 2026): Mevcut doğrulanmış kullanıcılara rozet ataması
-- is_verified=true olan ama active_badge_id NULL olan kullanıcıları düzelt.
-- İlk badge kategorisindeki aktif rozet ürününü ata.

UPDATE public.profiles
SET active_badge_id = (
  SELECT id FROM public.cosmetic_items
  WHERE category = 'badge' AND active = true
  ORDER BY created_at ASC
  LIMIT 1
)
WHERE is_verified = true
  AND active_badge_id IS NULL;
