-- ═══════════════════════════════════════════════════════════════════
-- v34: SP Bağış Rate Limit — Atomic RPC
-- ═══════════════════════════════════════════════════════════════════
-- Sorun: services/profile.ts donateToUser rate limit'i (saatte 10 bağış)
--   client-side count check ile yapılıyordu → eşzamanlı iki istek ikisi
--   de limit'i geçebilir (race condition).
--
-- Çözüm: PostgreSQL RPC'de FOR UPDATE lock ile atomic check+consume.
--   Aynı userId için eşzamanlı iki çağrıda biri beklet, diğeri limit'i
--   aşarsa reddet.
--
-- Limit: 10 bağış / saat / kullanıcı (profile.ts ile aynı)
-- ═══════════════════════════════════════════════════════════════════

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
BEGIN
  -- Caller self-only (SECURITY DEFINER bypass'ı engelle)
  IF auth.uid()::text IS DISTINCT FROM p_user_id THEN
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

-- ROLLBACK:
-- BEGIN; DROP FUNCTION IF EXISTS public.check_donation_rate_limit(TEXT); COMMIT;
