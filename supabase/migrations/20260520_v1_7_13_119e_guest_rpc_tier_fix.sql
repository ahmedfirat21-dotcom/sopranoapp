-- ============================================================
-- v1.7.13.119e — Misafir RPC tier default fix
-- profiles tablosunda 'tier' kolonu DEFAULT 'Silver' ama tier_check Free/Plus/Pro istiyor
-- Legacy şema çakışması — INSERT'te tier'ı açıkça 'Free' set edelim
-- ============================================================

BEGIN;

DROP FUNCTION IF EXISTS public.upsert_guest_profile();

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
  short_id := upper(right(uid, 4));

  INSERT INTO profiles (
    id,
    display_name,
    avatar_url,
    bio,
    tier,
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
  WHERE profiles.is_guest = true;

  RETURN uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_guest_profile() TO authenticated, anon;

COMMIT;
