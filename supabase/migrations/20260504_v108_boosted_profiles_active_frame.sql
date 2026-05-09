-- ════════════════════════════════════════════════════════════
-- v108.16 (4 May 2026): get_boosted_profiles → active_frame ekle
-- ════════════════════════════════════════════════════════════
-- Home Keşfet sayfasında boost profillerin avatar'ında çerçeve render
-- olabilmesi için active_frame kolonu RETURNS TABLE'a eklendi.
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_boosted_profiles(max_count integer DEFAULT 10)
RETURNS TABLE(
  id text, display_name text, username text, avatar_url text,
  subscription_tier text, bio text, is_online boolean,
  profile_boost_expires_at timestamp with time zone,
  active_frame text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
    SELECT
      p.id, p.display_name, p.username, p.avatar_url,
      COALESCE(p.subscription_tier, p.tier, 'Free') AS subscription_tier,
      p.bio, p.is_online, p.profile_boost_expires_at,
      p.active_frame
    FROM profiles p
    WHERE p.profile_boost_expires_at > NOW()
    ORDER BY p.profile_boost_expires_at DESC
    LIMIT max_count;
END;
$$;
