BEGIN;

CREATE OR REPLACE FUNCTION public.award_referral_bonus_atomic(
  p_owner_id TEXT,
  p_referred_id TEXT,
  p_sp_amount INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_new_balance INTEGER;
  v_referred_new_balance INTEGER;
BEGIN
  IF p_owner_id IS NULL OR p_owner_id = '' THEN
    RAISE EXCEPTION 'Davet eden ID bos olamaz';
  END IF;
  IF p_referred_id IS NULL OR p_referred_id = '' THEN
    RAISE EXCEPTION 'Davet edilen ID bos olamaz';
  END IF;
  IF p_owner_id = p_referred_id THEN
    RAISE EXCEPTION 'Davet eden ve edilen ayni olamaz';
  END IF;
  IF p_sp_amount <= 0 THEN
    RAISE EXCEPTION 'SP miktari pozitif olmali';
  END IF;

  UPDATE public.profiles
    SET system_points = COALESCE(system_points, 0) + p_sp_amount
    WHERE id = p_owner_id
    RETURNING system_points INTO v_owner_new_balance;

  IF v_owner_new_balance IS NULL THEN
    RAISE EXCEPTION 'Davet eden profil bulunamadi: %', p_owner_id;
  END IF;

  UPDATE public.profiles
    SET system_points = COALESCE(system_points, 0) + p_sp_amount
    WHERE id = p_referred_id
    RETURNING system_points INTO v_referred_new_balance;

  IF v_referred_new_balance IS NULL THEN
    RAISE EXCEPTION 'Davet edilen profil bulunamadi: %', p_referred_id;
  END IF;

  BEGIN
    INSERT INTO public.sp_transactions (user_id, amount, reason, created_at)
    VALUES (p_owner_id, p_sp_amount, 'referral_bonus_owner', NOW());
    INSERT INTO public.sp_transactions (user_id, amount, reason, created_at)
    VALUES (p_referred_id, p_sp_amount, 'referral_bonus_referred', NOW());
  EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_column THEN NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'owner_balance', v_owner_new_balance,
    'referred_balance', v_referred_new_balance,
    'sp_amount', p_sp_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_referral_bonus_atomic(TEXT, TEXT, INTEGER) TO authenticated;

COMMIT;
