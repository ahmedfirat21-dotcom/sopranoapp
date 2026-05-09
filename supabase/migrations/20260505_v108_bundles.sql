-- ★ v108.21 (5 May 2026) — Bundle paketleri.
--
-- Birden fazla kozmetik ürünü tek seferde indirimli alma. Kullanıcılar tema-bazlı
-- (Phoenix, Galactique, Aurelius) eksiksiz set kurmak isterler; bundle satın
-- aldıklarında tüm parçalar envantere eklenir, paketin toplam SP'sinden
-- discount_pct kadar düşülerek charge edilir.
--
-- Tier discount (Plus %10, Pro %20) bundle indirimine ek olarak uygulanır.

CREATE TABLE IF NOT EXISTS public.cosmetic_bundles (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  tagline       TEXT,
  art_emoji     TEXT,
  art_color     TEXT,
  bg_gradient_start TEXT,
  bg_gradient_end   TEXT,
  rarity        TEXT CHECK (rarity IN ('divine','mythic','legendary','rare','new')),
  total_price_sp INT NOT NULL CHECK (total_price_sp > 0),
  discount_pct  INT NOT NULL CHECK (discount_pct BETWEEN 0 AND 80),
  sort_order    INT NOT NULL DEFAULT 0,
  active        BOOLEAN DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cosmetic_bundle_items (
  bundle_id TEXT NOT NULL REFERENCES public.cosmetic_bundles(id) ON DELETE CASCADE,
  item_id   TEXT NOT NULL REFERENCES public.cosmetic_items(id),
  PRIMARY KEY (bundle_id, item_id)
);

ALTER TABLE public.cosmetic_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cosmetic_bundle_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bundles_read_all" ON public.cosmetic_bundles;
CREATE POLICY "bundles_read_all"
  ON public.cosmetic_bundles FOR SELECT
  TO authenticated, anon
  USING (active = true);

DROP POLICY IF EXISTS "bundle_items_read_all" ON public.cosmetic_bundle_items;
CREATE POLICY "bundle_items_read_all"
  ON public.cosmetic_bundle_items FOR SELECT
  TO authenticated, anon
  USING (true);

-- Seed bundle'lar
INSERT INTO public.cosmetic_bundles
  (id, name, tagline, art_emoji, art_color, bg_gradient_start, bg_gradient_end,
   rarity, total_price_sp, discount_pct, sort_order)
VALUES
  ('bundle-phoenix-set', 'Phoenix Seti',
   'Anka kuşunun yeniden doğuşu', '🔥', '#F472B6',
   '#831843', '#0A0F1A', 'legendary',
   1320, 20, 10),
  ('bundle-galactique-set', 'Galactique Seti',
   'Yıldızlar arasında dans', '✦', '#A78BFA',
   '#1E1B4B', '#0A0F1A', 'legendary',
   1300, 15, 20),
  ('bundle-aurelius-royale', 'Aurelius Royale',
   'Maison''un en üst zarafeti', '⚜', '#FBBF24',
   '#854F0B', '#0A0F1A', 'divine',
   4580, 25, 30)
ON CONFLICT (id) DO UPDATE SET
  name           = EXCLUDED.name,
  tagline        = EXCLUDED.tagline,
  art_emoji      = EXCLUDED.art_emoji,
  art_color      = EXCLUDED.art_color,
  bg_gradient_start = EXCLUDED.bg_gradient_start,
  bg_gradient_end   = EXCLUDED.bg_gradient_end,
  rarity         = EXCLUDED.rarity,
  total_price_sp = EXCLUDED.total_price_sp,
  discount_pct   = EXCLUDED.discount_pct,
  sort_order     = EXCLUDED.sort_order;

-- Bundle compositions
INSERT INTO public.cosmetic_bundle_items (bundle_id, item_id) VALUES
  ('bundle-phoenix-set',     'phoenix-ring'),
  ('bundle-phoenix-set',     'or-ancien'),

  ('bundle-galactique-set',  'galactique-ring'),
  ('bundle-galactique-set',  'constellation'),

  ('bundle-aurelius-royale', 'aurelius'),
  ('bundle-aurelius-royale', 'lumiere-divine'),
  ('bundle-aurelius-royale', 'belle-epoque')
ON CONFLICT DO NOTHING;

-- ─── RPC: bundle_purchase ──────────────────────────────────────────
-- Tüm parça item'larını envantere ekler. Eğer kullanıcı parçalardan birine
-- zaten sahipse o parça atlanır (envantere eklenmez) ama fiyat indirim
-- kapsamı için tam bundle ücreti üzerinden hesaplanır (bundle = paket
-- fırsatı, bireysel tek tek almaktan ucuz). Bütün parçalara sahipse zaten
-- satın alınamaz.
CREATE OR REPLACE FUNCTION public.bundle_purchase(p_user_id text, p_bundle_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bundle public.cosmetic_bundles%ROWTYPE;
  v_balance int;
  v_tier text;
  v_expires timestamptz;
  v_effective_tier text;
  v_tier_discount int;
  v_bundle_discount int;
  v_total_discount int;
  v_final_price int;
  v_added_count int;
  v_skipped_count int;
BEGIN
  SELECT * INTO v_bundle FROM public.cosmetic_bundles WHERE id = p_bundle_id AND active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paket bulunamadı');
  END IF;

  -- Kullanıcının paketin tüm parçalarına zaten sahip olup olmadığı
  IF NOT EXISTS (
    SELECT 1 FROM public.cosmetic_bundle_items bi
    WHERE bi.bundle_id = p_bundle_id
      AND NOT EXISTS (
        SELECT 1 FROM public.user_inventory ui
        WHERE ui.user_id = p_user_id AND ui.item_id = bi.item_id
      )
  ) THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'Bu paketin tüm parçalarına zaten sahipsin',
      'already_owned', true
    );
  END IF;

  -- Profil oku
  SELECT
    COALESCE(system_points, 0),
    subscription_tier,
    subscription_expires_at
  INTO v_balance, v_tier, v_expires
  FROM public.profiles WHERE id = p_user_id;

  v_effective_tier := CASE
    WHEN v_tier IN ('Plus','Pro','GodMaster')
      AND (v_expires IS NULL OR v_expires > now())
    THEN v_tier ELSE 'Free'
  END;

  v_tier_discount := CASE v_effective_tier
    WHEN 'Pro' THEN 20
    WHEN 'GodMaster' THEN 20
    WHEN 'Plus' THEN 10
    ELSE 0
  END;

  v_bundle_discount := v_bundle.discount_pct;
  -- Toplam indirim: bundle + tier (additive ama %80'i geçmez)
  v_total_discount := LEAST(v_bundle_discount + v_tier_discount, 80);
  v_final_price := v_bundle.total_price_sp - (v_bundle.total_price_sp * v_total_discount / 100);

  IF v_balance < v_final_price THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'Yetersiz SP',
      'required', v_final_price, 'balance', v_balance
    );
  END IF;

  PERFORM set_config('app.sp_rpc_bypass', 'true', true);
  UPDATE public.profiles SET system_points = system_points - v_final_price WHERE id = p_user_id;

  -- Sahip olunmayan parçaları envantere ekle
  WITH inserted AS (
    INSERT INTO public.user_inventory (user_id, item_id, acquired_via)
    SELECT p_user_id, bi.item_id, 'bundle'
    FROM public.cosmetic_bundle_items bi
    WHERE bi.bundle_id = p_bundle_id
      AND NOT EXISTS (
        SELECT 1 FROM public.user_inventory ui
        WHERE ui.user_id = p_user_id AND ui.item_id = bi.item_id
      )
    RETURNING 1
  )
  SELECT count(*) INTO v_added_count FROM inserted;

  SELECT count(*) - v_added_count INTO v_skipped_count
  FROM public.cosmetic_bundle_items WHERE bundle_id = p_bundle_id;

  INSERT INTO public.sp_transactions (user_id, amount, type, description, external_ref)
    VALUES (
      p_user_id, -v_final_price, 'bundle_purchase',
      v_bundle.name || ' (-%' || v_total_discount || ')',
      p_bundle_id
    );

  RETURN jsonb_build_object(
    'success', true,
    'cost', v_final_price,
    'list_price', v_bundle.total_price_sp,
    'discount_pct', v_total_discount,
    'tier', v_effective_tier,
    'bundle_name', v_bundle.name,
    'items_added', v_added_count,
    'items_skipped', v_skipped_count,
    'new_balance', v_balance - v_final_price
  );
END;
$function$;
