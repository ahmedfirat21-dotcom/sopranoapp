-- ═══════════════════════════════════════════════════════════
-- SopranoChat v11 — Profil Boost Altyapısı
-- Profiller için boost süresi kolonu ekleme
-- ═══════════════════════════════════════════════════════════

-- 1. Profil boost kolonu (yoksa ekle)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'profile_boost_expires_at') THEN
    ALTER TABLE profiles ADD COLUMN profile_boost_expires_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

-- 2. Boost süresi dolmamış profilleri hızlı sorgulamak için index
CREATE INDEX IF NOT EXISTS idx_profiles_boost_active 
  ON profiles (profile_boost_expires_at) 
  WHERE profile_boost_expires_at IS NOT NULL;

-- 3. Boost'lanmış profilleri getiren fonksiyon (RLS-safe)
CREATE OR REPLACE FUNCTION get_boosted_profiles(max_count INTEGER DEFAULT 10)
RETURNS TABLE (
  id TEXT,
  display_name TEXT,
  username TEXT,
  avatar_url TEXT,
  subscription_tier TEXT,
  bio TEXT,
  is_online BOOLEAN,
  profile_boost_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
    SELECT 
      p.id,
      p.display_name,
      p.username,
      p.avatar_url,
      COALESCE(p.subscription_tier, p.tier, 'Free') AS subscription_tier,
      p.bio,
      p.is_online,
      p.profile_boost_expires_at
    FROM profiles p
    WHERE p.profile_boost_expires_at > NOW()
    ORDER BY p.profile_boost_expires_at DESC
    LIMIT max_count;
END;
$$;
