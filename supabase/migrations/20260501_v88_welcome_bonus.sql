-- ════════════════════════════════════════════════════════════
-- v88 (1 May 2026): Welcome bonus — yeni kullanıcı +50 SP
-- ════════════════════════════════════════════════════════════
--
-- Sorun: Yeni kayıt = 0 SP. Quick Boost (25 SP) için ~5 gün, herhangi
--   bir bağış için 1+ gün biriktirme gerekiyor → "SP nedir, ne işime
--   yarar?" hissi geç oluşuyor (day-1 deneyimi zayıf).
--
-- Çözüm: profiles INSERT trigger'ı ile yeni hesap +50 SP. İlk gün
--   Quick Boost yapabilir, profil boost'unu deneyebilir → SP'nin işe
--   yaradığını anında hisseder.
--
-- Notlar:
--   - SECURITY DEFINER → profiles.system_points sensitive column guard
--     bypass (guard sadece end-user UPDATE'ini engelliyor; trigger
--     postgres role ile çalıştığı için izinli).
--   - sp_transactions log entry → "Hoş geldin hediyesi" olarak SP geçmişine
--     yazılır (kullanıcı SPHistorySheet'te görür).
--   - Sadece YENİ profile INSERT'te tetiklenir. Onboarding upsert
--     mevcut user'a UPDATE düşerse trigger çalışmaz → bonus tek sefer.
--   - Mevcut kullanıcılara backfill YOK (sadece yeni signup'lar).

CREATE OR REPLACE FUNCTION public.grant_welcome_bonus_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 50 SP hoş geldin hediyesi
  UPDATE public.profiles
    SET system_points = COALESCE(system_points, 0) + 50
    WHERE id = NEW.id;

  -- Audit log — kullanıcı SP geçmişinde görür
  INSERT INTO public.sp_transactions (user_id, amount, type, description)
  VALUES (NEW.id, 50, 'welcome_bonus', 'Hoş geldin hediyesi');

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Bonus failure profili oluşturmayı engellemesin (best-effort)
  RAISE NOTICE 'welcome bonus grant failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_welcome_bonus_on_signup ON public.profiles;

CREATE TRIGGER trg_welcome_bonus_on_signup
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.grant_welcome_bonus_on_signup();
