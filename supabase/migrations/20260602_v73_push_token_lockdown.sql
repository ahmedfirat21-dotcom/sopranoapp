-- ════════════════════════════════════════════════════════════════════
-- v73 — push_token column lockdown
--
-- ÖNCESİ:
--   profiles tablosunun RLS politikası `SELECT USING (true)` — yani
--   tüm authenticated kullanıcılar `select push_token from profiles ...`
--   ile başkasının token'ını okuyabiliyordu. Anon API key public olduğu
--   için drive-by abuse'e açıktı (sahte push gönderme, token toplama).
--
-- SONRASI:
--   - push_token kolonuna SELECT yetkisi sadece service_role'a
--   - anon ve authenticated rolleri o kolonu okuyamaz (`select *` bile fail eder)
--   - Kendi token'ını UPDATE etmek (login sırasında yazma) hâlâ çalışır
--     çünkü UPDATE column-level grant ayrı yönetilir
--   - Push gönderme akışı artık edge function `send-push` üzerinden
--     (service_role token okur, Expo'ya forward eder)
--
-- İdempotent — tekrar uygulanabilir.
-- ════════════════════════════════════════════════════════════════════

-- 1) push_token kolon-bazlı SELECT yetkisini geri al
REVOKE SELECT (push_token) ON public.profiles FROM anon;
REVOKE SELECT (push_token) ON public.profiles FROM authenticated;
REVOKE SELECT (push_token) ON public.profiles FROM PUBLIC;

-- 2) Service role'a açık kalsın (edge function bunu kullanır)
GRANT SELECT (push_token) ON public.profiles TO service_role;

-- 3) UPDATE yetkisi authenticated'e açık kalsın (kullanıcı kendi token'ını yazar).
--    RLS politikası zaten "user can update own profile" şeklinde — column grant
--    olmadan UPDATE çalışmaz, o yüzden explicit GRANT ediyoruz.
GRANT UPDATE (push_token) ON public.profiles TO authenticated;

-- 4) Doğrulama notu (manual test):
--    Authenticated client'tan: select push_token from profiles where id = '<other_user>';
--    → permission denied for column push_token (BEKLENİYOR)
--
--    Authenticated client'tan: update profiles set push_token = 'X' where id = auth.uid();
--    → 1 row updated (BEKLENİYOR)
--
--    Edge function (service_role) için unaffected.

-- 5) Mevcut policy'lerde push_token referansı varsa loglayalım
DO $$
DECLARE
  pol_count int;
BEGIN
  SELECT COUNT(*) INTO pol_count
  FROM pg_policies
  WHERE tablename = 'profiles' AND schemaname = 'public';

  RAISE NOTICE 'v73: profiles tablosunda % adet RLS politikası mevcut. push_token artık column-grant ile korunuyor.', pol_count;
END $$;
