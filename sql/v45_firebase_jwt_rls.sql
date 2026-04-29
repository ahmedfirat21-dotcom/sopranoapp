-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v45 — Firebase JWT RLS Migration
--
-- Sorun (v44 yorumundan):
--   Supabase auth.uid() Firebase UID'i UUID cast etmeye çalışıyor → fail.
--   Mevcut: tüm policy'ler `auth.uid()::text` kullanıyor → token gönderilmiyor →
--   `auth.uid()` NULL → policy match olmuyor → "Allow all for anon"
--   permissive policy'leri sayesinde uygulama çalışıyor (security gap).
--
-- Çözüm (3 katmanlı):
--   1. `app_uid()` helper SQL function — JWT öncelikli, auth.uid() fallback.
--      Bu sayede hem mevcut Supabase auth hem Firebase JWT desteklenir.
--   2. Bu migration: tüm `auth.uid()::text` kullanan policy'leri DROP+CREATE
--      ile `app_uid()` çağrısına çevirir.
--   3. Client (services/auth.ts): Firebase getIdToken() → Supabase Authorization
--      header'a yazılır → server `auth.jwt()` parse eder → app_uid() doğru
--      Firebase UID döner → policy match olur → "Allow all for anon" drop edilebilir.
--
-- Bu migration GÜVENLİDİR (breaking change yok):
--   • JWKS dashboard'da configure edilmemişse `auth.jwt()` NULL → app_uid() fallback
--     auth.uid() döner → eski davranış aynı.
--   • Configure edildikten sonra `auth.jwt()` Firebase JWT döner → app_uid() Firebase
--     UID döner → policy'ler ENFORCE çalışır.
--
-- Sonraki adımlar (v46+):
--   • services/auth.ts — Firebase token Supabase header'a iletilsin (yeniden aktif)
--   • Supabase Dashboard → Authentication → JWT Settings → JWKS URL Firebase'e ayarlansın
--   • Test: gerçek Firebase user RLS'i tetikler → app_uid() doğru
--   • "Allow all for anon" policy'leri DROP — gerçek RLS aktif
-- ════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════
-- 1. app_uid() helper — JWT öncelikli, auth.uid() fallback
-- ═══════════════════════════════════════════════════
-- STABLE: aynı transaction içinde değer cache'lenir (performans)
-- SECURITY DEFINER yok: çağıran kullanıcının auth context'ini kullanır
CREATE OR REPLACE FUNCTION app_uid()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'sub')::text,  -- ★ Firebase JWT öncelikli (sub = Firebase UID)
    auth.uid()::text                -- ★ Fallback: Supabase native auth (UUID format)
  );
$$;

COMMENT ON FUNCTION app_uid() IS
  'Firebase Third-Party Auth uyumlu user ID döner. Firebase JWT varsa sub, yoksa auth.uid() fallback.';

-- ═══════════════════════════════════════════════════
-- 2. Tüm public schema policy'lerini tara, auth.uid()::text → app_uid() çevir
-- ═══════════════════════════════════════════════════
-- Strateji: pg_policy'den qual ve withcheck'i text olarak al, regex ile değiştir,
-- DROP + CREATE ile yeniden kur. polroles, polpermissive, polcmd korunur.

DO $$
DECLARE
  pol RECORD;
  new_qual TEXT;
  new_check TEXT;
  full_sql TEXT;
  cmd_text TEXT;
  role_list TEXT;
BEGIN
  FOR pol IN
    SELECT
      p.polname,
      c.relname AS tbl,
      n.nspname AS schema_name,
      p.polcmd,
      p.polpermissive,
      pg_get_expr(p.polqual, p.polrelid) AS qual,
      pg_get_expr(p.polwithcheck, p.polrelid) AS chck,
      p.polroles
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND (
        pg_get_expr(p.polqual, p.polrelid) LIKE '%auth.uid()%'
        OR pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%auth.uid()%'
      )
  LOOP
    -- ★ Replace patterns: (auth.uid())::text → app_uid() ve auth.uid()::text → app_uid()
    new_qual := pol.qual;
    IF new_qual IS NOT NULL THEN
      new_qual := REPLACE(new_qual, '(auth.uid())::text', 'app_uid()');
      new_qual := REPLACE(new_qual, 'auth.uid()::text', 'app_uid()');
    END IF;

    new_check := pol.chck;
    IF new_check IS NOT NULL THEN
      new_check := REPLACE(new_check, '(auth.uid())::text', 'app_uid()');
      new_check := REPLACE(new_check, 'auth.uid()::text', 'app_uid()');
    END IF;

    -- pg_policy.polcmd → SQL command keyword
    cmd_text := CASE pol.polcmd
      WHEN 'r' THEN 'SELECT'
      WHEN 'a' THEN 'INSERT'
      WHEN 'w' THEN 'UPDATE'
      WHEN 'd' THEN 'DELETE'
      WHEN '*' THEN 'ALL'
      ELSE 'ALL'
    END;

    -- Roles list — public (0) ise "TO public", aksi halde role isimleri
    IF pol.polroles = '{0}'::oid[] THEN
      role_list := 'TO public';
    ELSE
      SELECT 'TO ' || string_agg(quote_ident(rolname), ', ')
      INTO role_list
      FROM pg_roles WHERE oid = ANY(pol.polroles);
      IF role_list IS NULL THEN role_list := 'TO public'; END IF;
    END IF;

    -- Eski policy'yi düşür
    EXECUTE format('DROP POLICY %I ON public.%I', pol.polname, pol.tbl);

    -- Yeni policy'yi kur
    full_sql := format(
      'CREATE POLICY %I ON public.%I AS %s FOR %s %s',
      pol.polname,
      pol.tbl,
      CASE WHEN pol.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      cmd_text,
      role_list
    );

    IF new_qual IS NOT NULL AND new_qual <> '' THEN
      full_sql := full_sql || format(' USING (%s)', new_qual);
    END IF;

    IF new_check IS NOT NULL AND new_check <> '' THEN
      full_sql := full_sql || format(' WITH CHECK (%s)', new_check);
    END IF;

    RAISE NOTICE 'Migrated policy: %.% (%s)', pol.tbl, pol.polname, cmd_text;
    EXECUTE full_sql;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════
-- 3. Doğrulama: hâlâ auth.uid() kullanan policy var mı?
-- ═══════════════════════════════════════════════════
DO $$
DECLARE
  remaining INT;
BEGIN
  SELECT COUNT(*) INTO remaining
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND (
      pg_get_expr(p.polqual, p.polrelid) LIKE '%auth.uid()%'
      OR pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%auth.uid()%'
    );

  IF remaining > 0 THEN
    RAISE WARNING 'v45 migration: hâlâ auth.uid() kullanan % policy var. Manuel kontrol gerekli.', remaining;
  ELSE
    RAISE NOTICE 'v45 migration: tüm policy''ler app_uid() kullanıyor.';
  END IF;
END $$;

COMMIT;

-- ═══ DONE ═══
-- Sonraki adımlar:
-- 1. services/auth.ts: Firebase ID token Supabase header'a iletilsin (test gerekiyor)
-- 2. Supabase Dashboard → Authentication → JWT Settings → JWKS URL:
--    https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com
--    (Firebase issuer)
-- 3. Test: gerçek user ile DM/oda yarat → policy enforce ediyor mu
-- 4. v46: "Allow all for anon" permissive policy'lerini DROP et
