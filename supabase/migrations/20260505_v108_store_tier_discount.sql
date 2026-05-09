-- ★ v108.21 (5 May 2026) — Mağaza tier indirimi.
--
-- Plus üyeleri kozmetik fiyatlarda %10 indirim, Pro üyeleri %20 indirim alır.
-- store_purchase RPC içinde subscription_tier okunur ve fiyat o anda hesaplanır.
-- Süresi geçmiş abonelikler (subscription_expires_at < now()) Free sayılır.
--
-- Client UI tarafında aynı oranlar gösterilir; ancak nihai SP düşüşü RPC tarafında
-- otoriter şekilde hesaplanır (manipülasyona kapalı).

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
  v_discount_pct int;
  v_final_price int;
BEGIN
  SELECT * INTO v_item FROM public.cosmetic_items WHERE id = p_item_id AND active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ürün bulunamadı');
  END IF;

  IF v_item.per_message THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bu ürün mesaj başına kullanılır, satın alınmaz');
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_inventory WHERE user_id = p_user_id AND item_id = p_item_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bu ürün zaten sahipsin', 'already_owned', true);
  END IF;

  -- Profili tek seferde oku (balance + tier)
  SELECT
    COALESCE(system_points, 0),
    subscription_tier,
    subscription_expires_at
  INTO v_balance, v_tier, v_expires
  FROM public.profiles WHERE id = p_user_id;

  -- Süresi geçen abonelik Free'ye düşer
  v_effective_tier := CASE
    WHEN v_tier IN ('Plus','Pro','GodMaster')
      AND (v_expires IS NULL OR v_expires > now())
    THEN v_tier
    ELSE 'Free'
  END;

  -- Tier indirimi: Plus %10, Pro/GodMaster %20
  v_discount_pct := CASE v_effective_tier
    WHEN 'Pro' THEN 20
    WHEN 'GodMaster' THEN 20
    WHEN 'Plus' THEN 10
    ELSE 0
  END;

  v_final_price := v_item.price_sp - (v_item.price_sp * v_discount_pct / 100);

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
  INSERT INTO public.sp_transactions (user_id, amount, type, description, external_ref)
    VALUES (
      p_user_id, -v_final_price, 'store_purchase',
      v_item.name || CASE WHEN v_discount_pct > 0
        THEN ' (' || v_effective_tier || ' -%' || v_discount_pct || ')'
        ELSE '' END,
      p_item_id
    );

  RETURN jsonb_build_object(
    'success', true,
    'cost', v_final_price,
    'list_price', v_item.price_sp,
    'discount_pct', v_discount_pct,
    'tier', v_effective_tier,
    'item_name', v_item.name,
    'new_balance', v_balance - v_final_price
  );
END;
$function$;
