-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v39 — Donation Rate Limit Firebase Auth Uyumu
--
-- Problem (2026-04-20):
--   v34'teki check_donation_rate_limit RPC caller self-check'i
--     IF auth.uid()::text IS DISTINCT FROM p_user_id THEN
--   Firebase JWT ile auth.uid() bazen NULL döner (token yenilenme anı,
--   JWT claim parse, vs.). NULL IS DISTINCT FROM 'uid' = TRUE → reject.
--   Kullanıcı geçerli SP'ye sahip olsa da "Yetkisiz istek" hatası alıyor.
--
-- Çözüm: Diğer RPC'lerdeki pattern ile uyum — auth.uid() NULL ise trust
-- et (service_role veya bilinen JWT eksikliği). NULL DEĞİL ama farklı ise
-- reject et. auth.jwt()->>'sub' fallback olarak eklendi.
-- ════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.check_donation_rate_limit(p_user_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_limit CONSTANT INTEGER := 10;
  v_window_start TIMESTAMPTZ := NOW() - INTERVAL '1 hour';
  v_caller TEXT;
BEGIN
  -- ★ Caller kimliği: önce auth.uid(), yoksa JWT sub claim
  v_caller := auth.uid()::text;
  IF v_caller IS NULL THEN
    BEGIN
      v_caller := auth.jwt()->>'sub';
    EXCEPTION WHEN OTHERS THEN v_caller := NULL;
    END;
  END IF;

  -- Caller self-only — caller biliniyorsa ve farklıysa reddet.
  -- Caller NULL ise (service_role veya bilinmeyen context) trust et,
  -- diğer RPC pattern'iyle uyumlu.
  IF v_caller IS NOT NULL AND v_caller IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Yetkisiz istek'
    );
  END IF;

  -- Atomic count: sp_transactions üzerinde lock ile oku
  SELECT COUNT(*) INTO v_count
  FROM public.sp_transactions
  WHERE user_id = p_user_id
    AND type = 'donation_sent'
    AND created_at >= v_window_start
  FOR UPDATE;

  IF v_count >= v_limit THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Çok fazla bağış yaptınız. Lütfen 1 saat sonra tekrar deneyin.',
      'count', v_count,
      'limit', v_limit
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'count', v_count,
    'limit', v_limit,
    'remaining', v_limit - v_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_donation_rate_limit(TEXT) TO authenticated;

COMMIT;
