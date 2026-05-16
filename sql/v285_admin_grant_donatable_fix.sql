-- v285 (16 May 2026) — admin_grant_sp donatable_sp senkronu
-- ════════════════════════════════════════════════════════════
-- Bug: web admin SP yüklediğinde system_points artıyor ama donatable_sp
--   artmıyor. Oda içi hediye paneli (RoomGiftPanel + send_symbol_gift RPC)
--   donatable_sp okuyor → admin grant SP'si "bağışlanamıyor" gibi davranıyor.
-- Fix:
--   1. admin_grant_sp 4-arg overload: hem system_points hem donatable_sp bump
--   2. Mevcut iki test hesabı için targeted backfill (donatable_sp = system_points)
--
-- Welcome bonus exploit fix v92.15 hala sağlam:
--   welcome_bonus tipi grant_system_points sadece system_points'i bump eder
--   (admin_grant_sp ayrı path). Backfill sadece web admin tarafından hedeflenmiş
--   2 hesaba uygulanır.

-- ─── 1. RPC FIX ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_grant_sp(
  p_user_id text,
  p_amount integer,
  p_action text DEFAULT 'web_admin_grant'::text,
  p_external_ref text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_sp INTEGER;
BEGIN
  PERFORM set_config('app.sp_rpc_bypass', 'true', true);
  IF p_amount IS NULL OR p_amount = 0 THEN
    RAISE EXCEPTION 'Miktar sifir olamaz.';
  END IF;
  IF p_amount < 0 THEN
    SELECT COALESCE(system_points, 0) INTO current_sp FROM profiles WHERE id = p_user_id;
    IF current_sp + p_amount < 0 THEN
      RAISE EXCEPTION 'Yetersiz SP. Mevcut: %, Talep: %', current_sp, ABS(p_amount);
    END IF;
  END IF;
  UPDATE profiles
    SET system_points = GREATEST(COALESCE(system_points, 0) + p_amount, 0),
        donatable_sp  = GREATEST(COALESCE(donatable_sp, 0)  + p_amount, 0)
    WHERE id = p_user_id;
  INSERT INTO sp_transactions (user_id, amount, type, description)
  VALUES (p_user_id, p_amount, p_action, COALESCE('SP: ' || p_action, 'admin_grant'));
END;
$function$;

-- ─── 2. TARGETED BACKFILL (sadece 2 etkilenen hesap) ─────────
UPDATE profiles
   SET donatable_sp = system_points
 WHERE id IN ('dv9zOs9wgYUBVUnLeilzgpJNoZ53', '88lBzZWjt8QI7Q2zpF8z4YcRDhK2')
   AND donatable_sp < system_points;
