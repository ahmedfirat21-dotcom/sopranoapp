-- ★ v108.21 (5 May 2026) — Wishlist + Daily Deal.
--
-- WISHLIST: Kullanıcı SP yetersizken "ileride alırım" listesi.
--   Şema: (user_id, item_id, added_at)
--   RLS: kullanıcı sadece kendi listesini görür/günceller.
--
-- DAILY DEAL: Her gün 1 ürün ek indirimli (toplam ~30-50%).
--   Şema: (deal_date PK, item_id, extra_discount_pct)
--   Bugünün dealı: SELECT * FROM daily_deals WHERE deal_date = CURRENT_DATE
--   store_purchase RPC'si bugünün deal'ı denk gelirse extra indirim uygular.

CREATE TABLE IF NOT EXISTS public.user_wishlist (
  user_id  TEXT NOT NULL,
  item_id  TEXT NOT NULL REFERENCES public.cosmetic_items(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_user_wishlist_user ON public.user_wishlist(user_id, added_at DESC);

ALTER TABLE public.user_wishlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wishlist_self_select" ON public.user_wishlist;
CREATE POLICY "wishlist_self_select"
  ON public.user_wishlist FOR SELECT
  TO authenticated
  USING (user_id = app_uid());

DROP POLICY IF EXISTS "wishlist_self_insert" ON public.user_wishlist;
CREATE POLICY "wishlist_self_insert"
  ON public.user_wishlist FOR INSERT
  TO authenticated
  WITH CHECK (user_id = app_uid());

DROP POLICY IF EXISTS "wishlist_self_delete" ON public.user_wishlist;
CREATE POLICY "wishlist_self_delete"
  ON public.user_wishlist FOR DELETE
  TO authenticated
  USING (user_id = app_uid());

-- ─── DAILY DEALS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_deals (
  deal_date           DATE PRIMARY KEY,
  item_id             TEXT NOT NULL REFERENCES public.cosmetic_items(id),
  extra_discount_pct  INT  NOT NULL CHECK (extra_discount_pct BETWEEN 5 AND 70),
  banner_text         TEXT,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE public.daily_deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_deals_read_all" ON public.daily_deals;
CREATE POLICY "daily_deals_read_all"
  ON public.daily_deals FOR SELECT
  TO authenticated, anon
  USING (true);

-- Seed: bugünün dealı (örnek olarak Aurum Halka %30 ek indirimli)
INSERT INTO public.daily_deals (deal_date, item_id, extra_discount_pct, banner_text)
VALUES (CURRENT_DATE, 'aurum-ring', 30, 'Bugün altın gibi parla — Aurum Halka %30 ek indirimde')
ON CONFLICT (deal_date) DO UPDATE SET
  item_id = EXCLUDED.item_id,
  extra_discount_pct = EXCLUDED.extra_discount_pct,
  banner_text = EXCLUDED.banner_text;

-- store_purchase RPC — daily deal extra indirim entegrasyonu
CREATE OR REPLACE FUNCTION public.store_purchase(p_user_id text, p_item_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_item public.cosmetic_items%ROWTYPE;
  v_balance int;
  v_tier text;
  v_expires timestamptz;
  v_effective_tier text;
  v_tier_discount int;
  v_deal_discount int;
  v_total_discount int;
  v_final_price int;
BEGIN
  SELECT * INTO v_item FROM public.cosmetic_items WHERE id = p_item_id AND active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ürün bulunamadı');
  END IF;

  IF v_item.available_until IS NOT NULL AND v_item.available_until < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bu ürünün satış süresi sona erdi', 'expired', true);
  END IF;

  IF v_item.max_supply IS NOT NULL AND v_item.sold_count >= v_item.max_supply THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bu ürün tükendi', 'sold_out', true);
  END IF;

  IF v_item.per_message THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bu ürün mesaj başına kullanılır, satın alınmaz');
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_inventory WHERE user_id = p_user_id AND item_id = p_item_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bu ürün zaten sahipsin', 'already_owned', true);
  END IF;

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

  -- Daily deal kontrolü
  SELECT COALESCE(extra_discount_pct, 0) INTO v_deal_discount
  FROM public.daily_deals
  WHERE deal_date = CURRENT_DATE AND item_id = p_item_id;

  -- Toplam indirim üst limiti %80
  v_total_discount := LEAST(v_tier_discount + COALESCE(v_deal_discount, 0), 80);
  v_final_price := v_item.price_sp - (v_item.price_sp * v_total_discount / 100);

  IF v_balance < v_final_price THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'Yetersiz SP',
      'required', v_final_price, 'balance', v_balance
    );
  END IF;

  PERFORM set_config('app.sp_rpc_bypass', 'true', true);
  UPDATE public.profiles SET system_points = system_points - v_final_price WHERE id = p_user_id;
  INSERT INTO public.user_inventory (user_id, item_id, acquired_via)
    VALUES (p_user_id, p_item_id, 'purchase');
  UPDATE public.cosmetic_items SET sold_count = sold_count + 1 WHERE id = p_item_id;
  -- Sahip olunca wishlist'ten otomatik düş
  DELETE FROM public.user_wishlist WHERE user_id = p_user_id AND item_id = p_item_id;
  INSERT INTO public.sp_transactions (user_id, amount, type, description, external_ref)
    VALUES (
      p_user_id, -v_final_price, 'store_purchase',
      v_item.name
        || CASE WHEN v_total_discount > 0 THEN ' (-%' || v_total_discount || ')' ELSE '' END,
      p_item_id
    );

  RETURN jsonb_build_object(
    'success', true,
    'cost', v_final_price,
    'list_price', v_item.price_sp,
    'discount_pct', v_total_discount,
    'tier_discount_pct', v_tier_discount,
    'deal_discount_pct', COALESCE(v_deal_discount, 0),
    'tier', v_effective_tier,
    'item_name', v_item.name,
    'new_balance', v_balance - v_final_price,
    'remaining_stock',
      CASE WHEN v_item.max_supply IS NOT NULL
        THEN v_item.max_supply - (v_item.sold_count + 1)
      END
  );
END;
$function$;
