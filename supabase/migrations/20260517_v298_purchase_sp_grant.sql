-- ★ v298 (17 May 2026): SP paket satın alma sonrası grant — sp_packages tablosundan
--   miktar/bonus okuyup user balance'a ekler + sp_transactions logger.
--
-- ★ GÜVENLİK NOTU (POST-LAUNCH): Bu RPC client'tan trust ediyor. Production'da
--   RevenueCat webhook ile server-side receipt validation yapılmalı, RPC'ye
--   sadece doğrulanmış purchase'lar gelmeli. Şimdilik soft-launch için yeterli.
--
-- Args:
--   p_user_id      uuid — alıcı
--   p_package_id   text — sp_packages.id (örn: 'soprano_sp_100')
--   p_transaction_id text — RevenueCat/Google Play transaction id (idempotency)
--
-- Returns: jsonb { success, sp_added, new_balance, error? }

CREATE OR REPLACE FUNCTION public.purchase_sp_grant(
  p_user_id text,
  p_package_id text,
  p_transaction_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pkg RECORD;
  v_sp_amount integer;
  v_bonus_pct integer;
  v_total_sp integer;
  v_user_tier text;
  v_tier_bonus_pct integer := 0;
  v_new_balance integer;
BEGIN
  -- Idempotency: aynı transaction_id daha önce işlendiyse skip
  IF EXISTS (
    SELECT 1 FROM sp_transactions
    WHERE user_id = p_user_id
      AND type = 'sp_purchase'
      AND external_ref = p_transaction_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_processed');
  END IF;

  -- Paket bilgisi
  SELECT id, sp_amount, COALESCE(bonus_pct, 0) AS bonus_pct
  INTO v_pkg
  FROM sp_packages
  WHERE id = p_package_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'package_not_found');
  END IF;

  v_sp_amount := v_pkg.sp_amount;
  v_bonus_pct := v_pkg.bonus_pct;

  -- Kullanıcı tier bonus (Plus +10%, Pro +20%) — gamification.ts ile uyumlu
  SELECT subscription_tier INTO v_user_tier FROM profiles WHERE id = p_user_id;
  IF v_user_tier = 'Pro' THEN v_tier_bonus_pct := 20;
  ELSIF v_user_tier = 'Plus' THEN v_tier_bonus_pct := 10;
  END IF;

  -- Toplam SP: base + paket bonus_pct + tier bonus_pct
  v_total_sp := v_sp_amount
    + (v_sp_amount * v_bonus_pct / 100)
    + (v_sp_amount * v_tier_bonus_pct / 100);

  -- Balance update + transaction log (atomic)
  UPDATE profiles
  SET system_points = system_points + v_total_sp,
      donatable_sp = donatable_sp + v_total_sp
  WHERE id = p_user_id
  RETURNING system_points INTO v_new_balance;

  INSERT INTO sp_transactions (user_id, amount, type, description, external_ref)
  VALUES (
    p_user_id,
    v_total_sp,
    'sp_purchase',
    'SP Paketi: ' || v_pkg.id || ' (+%' || v_bonus_pct || ' paket bonus, +%' || v_tier_bonus_pct || ' tier bonus)',
    p_transaction_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'sp_added', v_total_sp,
    'new_balance', v_new_balance,
    'base_sp', v_sp_amount,
    'package_bonus_pct', v_bonus_pct,
    'tier_bonus_pct', v_tier_bonus_pct
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_sp_grant(text, text, text) TO authenticated, anon;
