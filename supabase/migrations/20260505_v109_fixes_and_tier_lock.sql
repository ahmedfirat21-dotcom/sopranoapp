-- ★ v109.2 (5 May 2026) — 3 sorun bir migration:
--
-- 1) Wishlist UPDATE policy eksikti → upsert UPDATE'e düşünce RLS bloklayıp
--    "İstek listesi güncellenemedi" hatası veriyordu. Self-update policy eklendi.
--
-- 2) sp_transactions.external_ref GLOBAL unique idi → bir kullanıcı bir item
--    satın alınca external_ref=item_id yazılıyor, başka kullanıcı aynı item'ı
--    satın aldığında "duplicate key" hatası. Compound unique (user_id, type,
--    external_ref) olarak değiştirildi — idempotency korunuyor ama farklı
--    kullanıcılar aynı external_ref'i kullanabilir.
--
-- 3) Divine rarity ürünler Plus-only — kullanıcı önerisi doğrultusunda. Free
--    kullanıcılar 80%+ kataloğa erişir; divine "elite koleksiyon" hissi için
--    Plus minimum kilitli. cosmetic_items.min_tier eklendi, RPC kontrol eder.

-- ─── 1) Wishlist UPDATE policy ────────────────────────────────────
DROP POLICY IF EXISTS "wishlist_self_update" ON public.user_wishlist;
CREATE POLICY "wishlist_self_update"
  ON public.user_wishlist FOR UPDATE
  TO authenticated
  USING (user_id = app_uid())
  WITH CHECK (user_id = app_uid());

-- ─── 2) sp_transactions external_ref → compound unique ─────────────
DROP INDEX IF EXISTS public.sp_transactions_external_ref_unique;
CREATE UNIQUE INDEX IF NOT EXISTS sp_transactions_user_ref_unique
  ON public.sp_transactions (user_id, type, external_ref)
  WHERE external_ref IS NOT NULL;

-- ─── 3) Divine tier-lock ───────────────────────────────────────────
ALTER TABLE public.cosmetic_items
  ADD COLUMN IF NOT EXISTS min_tier TEXT
  CHECK (min_tier IN ('Free','Plus','Pro','GodMaster') OR min_tier IS NULL);

-- Mevcut divine ürünleri Plus-only yap
UPDATE public.cosmetic_items
  SET min_tier = 'Plus'
  WHERE active = true AND rarity = 'divine' AND min_tier IS NULL;

-- store_purchase RPC — min_tier kontrolü eklendi
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

  -- ★ v109.2: Tier-lock kontrolü
  IF v_item.min_tier IS NOT NULL AND v_item.min_tier <> 'Free' THEN
    IF v_effective_tier = 'Free' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', v_item.min_tier || ' üyelik gerekiyor',
        'required_tier', v_item.min_tier,
        'tier_locked', true
      );
    END IF;
    -- Pro > Plus > Free hiyerarşisi
    IF v_item.min_tier = 'Pro' AND v_effective_tier = 'Plus' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Pro üyelik gerekiyor',
        'required_tier', 'Pro',
        'tier_locked', true
      );
    END IF;
  END IF;

  v_tier_discount := CASE v_effective_tier
    WHEN 'Pro' THEN 20
    WHEN 'GodMaster' THEN 20
    WHEN 'Plus' THEN 10
    ELSE 0
  END;

  SELECT COALESCE(extra_discount_pct, 0) INTO v_deal_discount
  FROM public.daily_deals
  WHERE deal_date = CURRENT_DATE AND item_id = p_item_id;

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
