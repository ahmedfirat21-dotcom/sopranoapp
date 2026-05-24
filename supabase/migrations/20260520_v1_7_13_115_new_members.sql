-- ★ v1.7.13.115 (20 May 2026): Yeni Üyeler RPC — son 7 gün kayıt olan kullanıcılar.
-- Home'da "Yeni Sopranolular" carousel için. Onboarding tamamlanmış olmalı.

CREATE OR REPLACE FUNCTION public.get_new_members(p_limit INT DEFAULT 10)
RETURNS TABLE (
  id TEXT,
  display_name TEXT,
  avatar_url TEXT,
  subscription_tier TEXT,
  is_online BOOLEAN,
  active_frame TEXT,
  active_badge_id TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ,
  days_old INT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
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
    AND p.id != COALESCE(app_uid(), '00000000-0000-0000-0000-000000000000')
  ORDER BY
    p.is_online DESC,
    p.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 30));
$$;

GRANT EXECUTE ON FUNCTION public.get_new_members(INT) TO authenticated;
