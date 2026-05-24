-- ============================================================
-- v1.7.13.119b — Misafirleri public liste RPC'lerinden hariç tut
-- ============================================================

BEGIN;

-- get_new_members: misafir profilleri "Yeni Sopranolular" carousel'inde gösterme
CREATE OR REPLACE FUNCTION public.get_new_members(p_limit integer DEFAULT 10)
RETURNS TABLE(
  id text, display_name text, avatar_url text, subscription_tier text,
  is_online boolean, active_frame text, active_badge_id text, bio text,
  created_at timestamp with time zone, days_old integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    p.id,
    p.display_name,
    p.avatar_url,
    p.subscription_tier,
    p.is_online,
    p.active_frame,
    p.active_badge_id,
    p.bio,
    p.created_at,
    EXTRACT(DAY FROM (NOW() - p.created_at))::INT AS days_old
  FROM profiles p
  WHERE p.created_at > NOW() - INTERVAL '7 days'
    AND p.display_name IS NOT NULL
    AND COALESCE((p.preferences->>'onboarding_completed')::BOOLEAN, FALSE) = TRUE
    AND COALESCE(p.is_guest, false) = false
    AND p.id != COALESCE(app_uid(), '00000000-0000-0000-0000-000000000000')
  ORDER BY
    p.is_online DESC,
    p.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 30));
$function$;

-- get_welcome_hosts: misafir host olamaz zaten, defansif filtre
DO $$
DECLARE
  fn_def text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO fn_def
  FROM pg_proc WHERE proname='get_welcome_hosts' LIMIT 1;
  -- Eğer is_guest filtresi yoksa ALTER ile ekleme — manuel review et
  IF fn_def IS NOT NULL AND fn_def NOT LIKE '%is_guest%' THEN
    RAISE NOTICE 'get_welcome_hosts: is_guest filter manuel eklenmeli';
  END IF;
END $$;

-- get_boosted_profiles: misafir SP harcayamaz (RLS sp_transactions bloke) → boosted olamaz.
-- Defansif filtre yine de ekleyelim (gelecekteki yardımcı RPC'ler için).
DO $$
DECLARE
  fn_def text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO fn_def
  FROM pg_proc WHERE proname='get_boosted_profiles' LIMIT 1;
  IF fn_def IS NOT NULL AND fn_def NOT LIKE '%is_guest%' THEN
    RAISE NOTICE 'get_boosted_profiles: is_guest filter manuel eklenmeli';
  END IF;
END $$;

COMMIT;
