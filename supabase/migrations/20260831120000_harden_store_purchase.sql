-- Active cosmetics are purchasable by every authenticated user with SP.
-- Keep the existing signature for v163 compatibility while binding the requested
-- user id to the verified JWT subject and serializing balance/stock updates.
CREATE OR REPLACE FUNCTION public.store_purchase(p_user_id text, p_item_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_item public.cosmetic_items%ROWTYPE;
  v_caller text;
  v_balance integer;
  v_tier text;
  v_expires timestamptz;
  v_effective_tier text;
  v_tier_discount integer;
  v_deal_discount integer;
  v_total_discount integer;
  v_final_price integer;
BEGIN
  v_caller := public.app_uid();

  IF v_caller IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Oturum doğrulanamadı',
      'unauthorized', true
    );
  END IF;

  IF v_caller <> p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Yetkisiz işlem',
      'unauthorized', true
    );
  END IF;

  SELECT *
  INTO v_item
  FROM public.cosmetic_items
  WHERE id = p_item_id
    AND active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ürün bulunamadı');
  END IF;

  IF v_item.available_until IS NOT NULL AND v_item.available_until < now() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Bu ürünün satış süresi sona erdi',
      'expired', true
    );
  END IF;

  IF v_item.max_supply IS NOT NULL
     AND COALESCE(v_item.sold_count, 0) >= v_item.max_supply THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Bu ürün tükendi',
      'sold_out', true
    );
  END IF;

  IF v_item.per_message THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Bu ürün mesaj başına kullanılır, satın alınmaz'
    );
  END IF;

  SELECT
    COALESCE(system_points, 0),
    subscription_tier,
    subscription_expires_at
  INTO v_balance, v_tier, v_expires
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kullanıcı bulunamadı');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_inventory
    WHERE user_id = p_user_id
      AND item_id = p_item_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Bu ürün zaten sahipsin',
      'already_owned', true
    );
  END IF;

  v_effective_tier := CASE
    WHEN v_tier IN ('Plus', 'Pro', 'GodMaster')
      AND (v_expires IS NULL OR v_expires > now())
    THEN v_tier
    ELSE 'Free'
  END;

  -- Membership never blocks a cosmetic purchase; it can only provide a discount.
  v_tier_discount := CASE v_effective_tier
    WHEN 'Pro' THEN 20
    WHEN 'GodMaster' THEN 20
    WHEN 'Plus' THEN 10
    ELSE 0
  END;

  SELECT COALESCE(extra_discount_pct, 0)
  INTO v_deal_discount
  FROM public.daily_deals
  WHERE deal_date = CURRENT_DATE
    AND item_id = p_item_id;

  v_total_discount := LEAST(v_tier_discount + COALESCE(v_deal_discount, 0), 80);
  v_final_price := GREATEST(
    0,
    v_item.price_sp - (v_item.price_sp * v_total_discount / 100)
  );

  IF v_balance < v_final_price THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Yetersiz SP',
      'required', v_final_price,
      'balance', v_balance
    );
  END IF;

  PERFORM set_config('app.sp_rpc_bypass', 'true', true);

  UPDATE public.profiles
  SET system_points = COALESCE(system_points, 0) - v_final_price
  WHERE id = p_user_id;

  INSERT INTO public.user_inventory (user_id, item_id, acquired_via)
  VALUES (p_user_id, p_item_id, 'purchase');

  UPDATE public.cosmetic_items
  SET sold_count = COALESCE(sold_count, 0) + 1
  WHERE id = p_item_id;

  DELETE FROM public.user_wishlist
  WHERE user_id = p_user_id
    AND item_id = p_item_id;

  INSERT INTO public.sp_transactions (
    user_id, amount, type, description, external_ref
  )
  VALUES (
    p_user_id,
    -v_final_price,
    'store_purchase',
    v_item.name
      || CASE
           WHEN v_total_discount > 0 THEN ' (-%' || v_total_discount || ')'
           ELSE ''
         END,
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
      CASE
        WHEN v_item.max_supply IS NOT NULL
        THEN v_item.max_supply - (COALESCE(v_item.sold_count, 0) + 1)
      END
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.store_purchase(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.store_purchase(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.store_purchase(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.store_purchase(text, text) TO service_role;
