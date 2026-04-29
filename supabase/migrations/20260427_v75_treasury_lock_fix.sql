-- ═══════════════════════════════════════════════════════════════════
-- v75 — contribute_to_club_treasury RACE CONDITION FIX (2026-04-27)
-- ═══════════════════════════════════════════════════════════════════
-- SORUN: v74'teki RPC'de SELECT ... FOR UPDATE yok. İki kullanıcı aynı anda
-- bağış yaparsa:
--   T1: 100 SP'si var, 100 bağışlamak istiyor → check geçer (100 ≥ 100)
--   T2: aynı anda 100 bağışlamak istiyor → eski snapshot okur (T1 commit etmedi) → check geçer
--   T1: UPDATE → SP=0
--   T2: UPDATE → SP=-100 (NEGATİF! veya yanlış treasury değeri)
--
-- ÇÖZÜM: 2 kat savunma:
--   1) SELECT system_points ... FOR UPDATE → satır kilidi, T2 bekler
--   2) UPDATE ... WHERE system_points >= p_amount → atomic conditional
--      (lock fail olsa bile DB kendisi negatif düşmeyi engeller)
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.contribute_to_club_treasury(
  p_club_id UUID,
  p_amount INTEGER,
  p_user_id TEXT
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_sp INTEGER;
  v_is_member BOOLEAN;
  v_new_balance INTEGER;
  v_rows_updated INTEGER;
BEGIN
  -- Input validation
  IF p_amount <= 0 OR p_amount > 100000 THEN
    RAISE EXCEPTION 'Geçersiz miktar (1-100000 SP).';
  END IF;
  IF p_user_id IS NULL OR p_club_id IS NULL THEN
    RAISE EXCEPTION 'invalid params';
  END IF;

  -- Üye mi kontrol et (lock gereksiz, sadece okuma)
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id AND user_id = p_user_id
  ) INTO v_is_member;
  IF NOT v_is_member THEN
    RAISE EXCEPTION 'Sadece üyeler hazineye bağışta bulunabilir.';
  END IF;

  -- ★ LOCK: profile satırını kilitle — concurrent bağış'da T2 burada bekler.
  --   Transaction commit/rollback olana kadar başka transaction bu satırı okuyamaz/yazamaz.
  SELECT system_points INTO v_user_sp
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_user_sp IS NULL OR v_user_sp < p_amount THEN
    RAISE EXCEPTION 'Yetersiz SP. Mevcut: %', COALESCE(v_user_sp, 0);
  END IF;

  -- ★ ATOMIC CONDITIONAL UPDATE — lock atlansa bile DB negatife düşmeyi engeller.
  UPDATE public.profiles
  SET system_points = system_points - p_amount
  WHERE id = p_user_id AND system_points >= p_amount;
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated = 0 THEN
    RAISE EXCEPTION 'Yetersiz SP (concurrent değişim). Tekrar dene.';
  END IF;

  -- Hazineye ekle (clubs satırı atomic UPDATE — PostgreSQL kendisi row lock yapar)
  UPDATE public.clubs
  SET treasury_balance = treasury_balance + p_amount,
      updated_at = NOW()
  WHERE id = p_club_id
  RETURNING treasury_balance INTO v_new_balance;

  -- SP işlem kaydı (best-effort)
  BEGIN
    INSERT INTO public.sp_transactions (user_id, amount, type, description, counterparty_id)
    VALUES (p_user_id, -p_amount, 'club_contribution', 'Kulüp hazinesine bağış', p_club_id::TEXT);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN v_new_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.contribute_to_club_treasury TO authenticated;

COMMENT ON FUNCTION public.contribute_to_club_treasury IS
  'v75 (2026-04-27): Race condition fix. SELECT FOR UPDATE + conditional UPDATE WHERE clause ile çift savunma.';
