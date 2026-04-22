-- ═══════════════════════════════════════════════════════════════════
-- v50 — profiles.preferences JSONB kolonu
-- Tarih: 2026-04-22
-- Amaç: onboarding_completed flag'i ve diğer kullanıcı preference'ları
--       JSON olarak saklanacak.
--
-- KRİTİK HATA: Mevcut migration'larda bu kolon YOKTU. Onboarding akışı
-- (app/(auth)/onboarding.tsx finalizeOnboarding + handleSaveInterests)
-- `preferences` kolonuna UPDATE yazıyordu ama kolon olmadığı için
-- sessizce fail ediyordu. Sonuç: `onboarding_completed` flag'i DB'ye
-- hiç yazılmıyordu → kullanıcı uygulamayı her açtığında AuthGuard
-- onboarding'e geri yolluyordu.
--
-- AuthGuard okur: app/_layout.tsx satır 414-420:
--   const onboardingDone = profilePrefs?.onboarding_completed === true;
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

-- Hızlı filtreleme için kısmi index — yalnızca tamamlamış kullanıcılar indekslenir
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_completed
  ON profiles ((preferences->>'onboarding_completed'))
  WHERE preferences->>'onboarding_completed' = 'true';

-- Doğrulama sorgusu (manuel):
-- SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'profiles' AND column_name = 'preferences';
