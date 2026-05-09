-- ★ v108.21 (5 May 2026) — Limited edition + countdown.
--
-- Bazı item'lar sınırlı süreli veya sınırlı sayıda satılır (FOMO etkisi):
--   available_until : ürün ne zaman çekilecek (countdown UI)
--   max_supply      : toplam üretim limiti (NULL = sınırsız)
--   sold_count      : bu üründen kaç adet satıldı (otomatik artar)
--   launched_at     : ürün çıkış tarihi ("YENİ" rozet için son 7 gün)
--
-- Kullanıcı satın aldığında store_purchase RPC:
--   1. available_until geçmişse "Süre doldu" hatası
--   2. max_supply set + sold_count >= max_supply → "Tükendi" hatası
--   3. Başarılıysa sold_count++ yapılır.

ALTER TABLE public.cosmetic_items
  ADD COLUMN IF NOT EXISTS available_until timestamptz,
  ADD COLUMN IF NOT EXISTS max_supply      INT CHECK (max_supply IS NULL OR max_supply > 0),
  ADD COLUMN IF NOT EXISTS sold_count      INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS launched_at     timestamptz;

-- Mevcut tüm aktif item'lar için launched_at = created_at (yeni rozet doğru hesaplansın)
UPDATE public.cosmetic_items SET launched_at = created_at WHERE launched_at IS NULL;

-- Seed: 2 limited item, 1 sınırlı sayıda + 1 sınırlı süreli
UPDATE public.cosmetic_items
SET available_until = now() + interval '14 days'
WHERE id = 'lumiere-divine';

UPDATE public.cosmetic_items
SET max_supply = 100
WHERE id = 'cadence-soprano';

-- store_purchase RPC — limited stock + tarih kontrolü eklendi
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

  -- Tarih limiti kontrolü
  IF v_item.available_until IS NOT NULL AND v_item.available_until < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bu ürünün satış süresi sona erdi', 'expired', true);
  END IF;

  -- Stok limiti kontrolü
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
  -- Stok sayacını artır (limited olmasa bile telemetri için faydalı)
  UPDATE public.cosmetic_items
    SET sold_count = sold_count + 1
    WHERE id = p_item_id;
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
    'new_balance', v_balance - v_final_price,
    'remaining_stock',
      CASE WHEN v_item.max_supply IS NOT NULL
        THEN v_item.max_supply - (v_item.sold_count + 1)
      END
  );
END;
$function$;
