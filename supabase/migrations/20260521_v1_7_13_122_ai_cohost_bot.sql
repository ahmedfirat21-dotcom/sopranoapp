-- ============================================================
-- v1.7.13.122 (21 May 2026) — AI Co-host bot profili
-- Sabit ID ile profiles tablosuna AI bot satırı; chat mesajları bu uid altında görünür.
-- ============================================================

BEGIN;

INSERT INTO profiles (
  id, display_name, avatar_url, tier, subscription_tier,
  system_points, is_online, bio, is_admin, is_verified, is_guest,
  preferences, created_at, updated_at
)
VALUES (
  'ai_cohost_bot',
  '🤖 SopranoChat AI',
  NULL,
  'Free', 'Free',
  0, true,
  'Sopranochat AI yardımcısı — odanda sohbet başlatır, soru sorar, konu önerir.',
  false, true, false,
  '{"onboarding_completed": true}'::jsonb,
  now(), now()
)
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  bio = EXCLUDED.bio,
  is_online = true,
  is_verified = true,
  updated_at = now();

COMMIT;
