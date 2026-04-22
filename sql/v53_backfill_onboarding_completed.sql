-- ═══════════════════════════════════════════════════════════════════
-- v53 — preferences.onboarding_completed backfill
-- Tarih: 2026-04-22
-- Amaç: v50 preferences kolonu eklenmeden önce finalizeOnboarding() UPDATE
--       sessizce fail ediyordu. Bu sırada onboarding'i fiilen tamamlamış olan
--       kullanıcıların preferences'ı '{}' kaldı → AuthGuard onları yeniden
--       onboarding'e yolluyor.
--
-- Kural: profil tamamsa (display_name + birth_date + interests) kullanıcı
-- onboarding'i bitirmiş sayılır. Bu kullanıcılarda preferences'a
-- onboarding_completed:true yaz.
-- ═══════════════════════════════════════════════════════════════════

UPDATE profiles
SET preferences = jsonb_set(
  COALESCE(preferences, '{}'::jsonb),
  '{onboarding_completed}',
  'true'::jsonb
) || jsonb_build_object('onboarding_date', COALESCE(preferences->>'onboarding_date', NOW()::text))
WHERE
  display_name IS NOT NULL AND display_name <> ''
  AND birth_date IS NOT NULL
  AND interests IS NOT NULL AND array_length(interests, 1) > 0
  AND (preferences->>'onboarding_completed' IS DISTINCT FROM 'true');

-- Doğrulama: kaç kullanıcı backfill edildi görmek için
-- SELECT COUNT(*) AS backfilled FROM profiles
--   WHERE preferences->>'onboarding_completed' = 'true';
