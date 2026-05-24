-- ============================================================
-- v1.7.13.119d — Misafir RPC type mismatch fix
-- profiles.id text (Firebase UID UUID değil) → uuid yerine text kullan
-- 119 ana migrasyonda upsert_guest_profile + delete_my_guest_profile uuid declare etti, fail oluyordu
-- ============================================================

BEGIN;

DROP FUNCTION IF EXISTS public.upsert_guest_profile();
DROP FUNCTION IF EXISTS public.delete_my_guest_profile();

CREATE OR REPLACE FUNCTION public.upsert_guest_profile()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid text;
  short_id text;
BEGIN
  uid := app_uid();
  IF uid IS NULL OR uid = '' THEN
    RAISE EXCEPTION 'Misafir profili için kimlik yok';
  END IF;
  -- UID'nin son 4 karakteri (Firebase UID = 28 alfanumerik)
  short_id := upper(right(uid, 4));

  INSERT INTO profiles (
    id,
    display_name,
    avatar_url,
    bio,
    subscription_tier,
    system_points,
    is_online,
    interests,
    preferences,
    is_guest,
    created_at,
    updated_at
  )
  VALUES (
    uid,
    'Misafir-' || short_id,
    NULL,
    NULL,
    'Free',
    0,
    true,
    '{}',
    jsonb_build_object('onboarding_completed', true),
    true,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    updated_at = now(),
    is_online  = true
  WHERE profiles.is_guest = true; -- güvenlik: gerçek hesap üstüne yazma

  RETURN uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_guest_profile() TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.delete_my_guest_profile()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid text := app_uid();
BEGIN
  IF uid IS NULL OR uid = '' THEN
    RETURN false;
  END IF;
  DELETE FROM profiles WHERE id = uid AND is_guest = true;
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_my_guest_profile() TO authenticated, anon;

COMMIT;
