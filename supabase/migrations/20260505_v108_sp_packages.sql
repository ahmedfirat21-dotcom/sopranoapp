-- ★ v108.21 (5 May 2026) — SP Paket kataloğu DB'ye taşındı.
--
-- Mevcut sp_packages tablosu (id, sp_amount, bonus_sp, price_try, is_active, popular)
-- vitrin için yetersiz; tier_name/tier_key/tier_color/sort_order eklendi.
--
-- store.tsx artık SP_PACKS hardcoded yerine bu tabloyu okur. sp-store.tsx hâlâ
-- hardcoded — IAP entegrasyonu yapıldığında o da DB'ye geçecek.

ALTER TABLE public.sp_packages
  ADD COLUMN IF NOT EXISTS tier_name  TEXT,
  ADD COLUMN IF NOT EXISTS tier_key   TEXT CHECK (tier_key IN ('bronze','silver','gold','platinum','diamond')),
  ADD COLUMN IF NOT EXISTS tier_color TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INT,
  ADD COLUMN IF NOT EXISTS bonus_pct  INT,
  ADD COLUMN IF NOT EXISTS fiat_label TEXT;

-- RLS — okuma açık (yazma sadece service role)
ALTER TABLE public.sp_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sp_packages_read_all" ON public.sp_packages;
CREATE POLICY "sp_packages_read_all"
  ON public.sp_packages FOR SELECT
  TO authenticated, anon
  USING (is_active = true);

-- Yeni 5 tier ID'si (store.tsx ile uyumlu). Eski ID'ler kapatılıyor (is_active=false)
UPDATE public.sp_packages SET is_active = false
WHERE id IN ('soprano_sp_250','soprano_sp_600','soprano_sp_1500','soprano_sp_4000','soprano_sp_10000');

INSERT INTO public.sp_packages
  (id, tier_name, tier_key, tier_color, sp_amount, bonus_sp, bonus_pct,
   price_try, fiat_label, popular, sort_order, is_active)
VALUES
  ('sp-bronze',   'Bronz · Atölye',  'bronze',   '#D4A574',   100,     0,  0,    9.99, '9,99 ₺',   false, 10, true),
  ('sp-silver',   'Gümüş · Salon',   'silver',   '#D1D5DB',   500,    50, 10,   39.99, '39,99 ₺', false, 20, true),
  ('sp-gold',     'Altın · Vitrin',  'gold',     '#FBBF24',  1500,   300, 20,   99.99, '99,99 ₺', true,  30, true),
  ('sp-platinum', 'Platin · Loca',   'platinum', '#C4B5FD',  5000,  1750, 35,  299.99, '299,99 ₺', false, 40, true),
  ('sp-diamond',  'Elmas · Maison',  'diamond',  '#F9A8D4', 15000,  7500, 50,  799.99, '799,99 ₺', false, 50, true)
ON CONFLICT (id) DO UPDATE SET
  tier_name  = EXCLUDED.tier_name,
  tier_key   = EXCLUDED.tier_key,
  tier_color = EXCLUDED.tier_color,
  sp_amount  = EXCLUDED.sp_amount,
  bonus_sp   = EXCLUDED.bonus_sp,
  bonus_pct  = EXCLUDED.bonus_pct,
  price_try  = EXCLUDED.price_try,
  fiat_label = EXCLUDED.fiat_label,
  popular    = EXCLUDED.popular,
  sort_order = EXCLUDED.sort_order,
  is_active  = true;
