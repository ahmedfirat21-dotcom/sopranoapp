-- ★ v1.7.13.112 (20 May 2026): Karşılama Pilotları (Welcome Hosts)
-- Yeni kullanıcı (created_at < 24h) home'da "Karşılama Pilotları" carousel'i görür.
-- is_welcome_host = true olan kullanıcılar gönüllü mentordur; admin manuel atar.

-- 1) Kolon ekle (profiles.preferences JSON'a koyabilirdik ama sorgu için flat tercih)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_welcome_host BOOLEAN DEFAULT FALSE;

-- 2) Index — get_welcome_hosts() çağrıları için
CREATE INDEX IF NOT EXISTS idx_profiles_welcome_host
  ON profiles (is_welcome_host) WHERE is_welcome_host = TRUE;

-- 3) RPC: get_welcome_hosts — top 5 en aktif welcome host
CREATE OR REPLACE FUNCTION public.get_welcome_hosts(p_limit INT DEFAULT 5)
RETURNS TABLE (
  id TEXT,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  system_points INT,
  subscription_tier TEXT,
  active_frame TEXT,
  active_badge_id TEXT,
  is_online BOOLEAN,
  streak_days INT
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
    p.bio,
    p.system_points,
    p.subscription_tier,
    p.active_frame,
    p.active_badge_id,
    p.is_online,
    COALESCE(p.streak_days, 0) AS streak_days
  FROM profiles p
  WHERE p.is_welcome_host = TRUE
    AND p.id != COALESCE(app_uid(), '00000000-0000-0000-0000-000000000000')
  ORDER BY
    p.is_online DESC,
    COALESCE(p.streak_days, 0) DESC,
    p.system_points DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(p_limit, 20));
$$;

GRANT EXECUTE ON FUNCTION public.get_welcome_hosts(INT) TO authenticated, anon;

-- 4) RPC: is_new_user — current user 24 saat içinde mi kayıtlı?
CREATE OR REPLACE FUNCTION public.is_new_user()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT (NOW() - created_at) < INTERVAL '24 hours'
     FROM profiles WHERE id = app_uid()),
    FALSE
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_new_user() TO authenticated;

-- 5) İlk 2 mevcut host'u welcome host yap (seed) — DEV/test için
-- Sopranochat ekibi production'da elle ayarlayacak
UPDATE profiles
SET is_welcome_host = TRUE
WHERE id IN (
  SELECT id FROM profiles
  WHERE subscription_tier IN ('Pro', 'GodMaster')
    OR is_admin = TRUE
  ORDER BY system_points DESC NULLS LAST
  LIMIT 3
)
AND is_welcome_host IS NOT TRUE;
