-- ═══════════════════════════════════════════════════════════════
-- SopranoChat — v65 Birth Date Hardening (Faz 2.3)
-- ═══════════════════════════════════════════════════════════════
-- 18+ oda erişimi yaş tabanlı; client-side hesaplama bypass'lanabiliyordu.
-- Bu migration:
--   1. CHECK: birth_date geçerli aralıkta (1920-01-01 .. now() - 13y)
--   2. Trigger: birth_date bir kez set edildikten sonra UPDATE'le değişemez.
--   3. user_meets_age_requirement() — server-side yaş hesabı RPC.
--   4. user_age_at_now() — exact yaş hesabı (UI ipucu için, opsiyonel).
--
-- Tasarım:
--   • 13 yaş alt sınırı KVKK / Google Play uyumlu (Türkiye'de Çocuk Çevrimiçi
--     güvenliği). 18+ oda kontrolü için ayrıca min_age parametresi geçilir.
--   • Lock-in mantığı: NULL → değer izinli. Değer → değer (aynı) izinli.
--     Değer → farklı değer YASAK. Admin override yok (audit trail v66'da).
--   • DAY-precise hesap: yıl çıkarsa ama doğum günü gelmediyse 1 düş.
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. CHECK constraint — geçerli tarih aralığı
-- ───────────────────────────────────────────────────────────────
-- Mevcut row'lar arasında geçersiz olabilenler için NOT VALID ekle,
-- sonra VALIDATE → mevcut bozuk veriler exception fırlatmasın.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_birth_date_range'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_birth_date_range
      CHECK (
        birth_date IS NULL
        OR (birth_date >= DATE '1920-01-01' AND birth_date <= CURRENT_DATE - INTERVAL '13 years')
      ) NOT VALID;
  END IF;
END $$;

-- VALIDATE — eski satırlar için exception yutulur, yeni write'lar enforced.
-- Eğer mevcut satırlar bozuksa, validate atılır; o zaman manuel temizleme gerekir.
-- Şu anki durumda onboarding sadece >=13y yıl yazıyor, bozuk olmaması beklenir.
DO $$ BEGIN
  BEGIN
    ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_birth_date_range;
  EXCEPTION WHEN check_violation THEN
    RAISE WARNING 'profiles_birth_date_range — mevcut satırlarda ihlal var, sonra düzeltin.';
  END;
END $$;

-- ───────────────────────────────────────────────────────────────
-- 2. Lock-in trigger — birth_date sadece NULL→değer geçişine izin verir
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._enforce_birth_date_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Yeni row insert ediliyor — kontrol yok, CHECK constraint zaten validasyon yapıyor.
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- UPDATE: NULL → değer (ilk set) — izinli
  IF OLD.birth_date IS NULL AND NEW.birth_date IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- UPDATE: değer → aynı değer — izinli (no-op)
  IF OLD.birth_date IS NOT DISTINCT FROM NEW.birth_date THEN
    RETURN NEW;
  END IF;

  -- UPDATE: değer → farklı değer — YASAK
  RAISE EXCEPTION 'birth_date kilitlendi: yalnızca bir kez ayarlanabilir. Değişiklik için destek ekibine başvur.'
    USING HINT = 'BIRTH_DATE_LOCKED';
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_birth_date_lock ON public.profiles;
CREATE TRIGGER trg_enforce_birth_date_lock
  BEFORE INSERT OR UPDATE OF birth_date ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public._enforce_birth_date_lock();

COMMENT ON FUNCTION public._enforce_birth_date_lock IS
  'Faz 2.3 — birth_date NULL→değer geçişine izin, sonraki UPDATE''e yasak.';

-- ───────────────────────────────────────────────────────────────
-- 3. user_meets_age_requirement(user_id, min_age) — server-side yaş kontrolü
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.user_meets_age_requirement(
  p_user_id TEXT,
  p_min_age INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_birth DATE;
  v_threshold DATE;
BEGIN
  IF p_user_id IS NULL OR p_user_id = '' OR p_min_age IS NULL OR p_min_age <= 0 THEN
    RETURN FALSE;
  END IF;

  SELECT birth_date INTO v_birth FROM public.profiles WHERE id = p_user_id LIMIT 1;
  IF v_birth IS NULL THEN
    RETURN FALSE; -- birth_date yoksa yaş kontrolü geçemez (fail-closed)
  END IF;

  -- Day-precise: doğum tarihi (today - min_age yıl) tarihinden önce/aynı olmalı
  v_threshold := CURRENT_DATE - (p_min_age || ' years')::INTERVAL;
  RETURN v_birth <= v_threshold;
END;
$$;

COMMENT ON FUNCTION public.user_meets_age_requirement IS
  'Faz 2.3 — Day-precise server-side yaş kontrolü. 18+ oda erişimi için.';

-- ───────────────────────────────────────────────────────────────
-- 4. user_age_at_now(user_id) — yaşı hesaplar (UI için)
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.user_age_at_now(
  p_user_id TEXT
) RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_birth DATE;
  v_age INTEGER;
BEGIN
  SELECT birth_date INTO v_birth FROM public.profiles WHERE id = p_user_id LIMIT 1;
  IF v_birth IS NULL THEN RETURN NULL; END IF;
  v_age := EXTRACT(YEAR FROM age(CURRENT_DATE, v_birth))::INTEGER;
  RETURN v_age;
END;
$$;

COMMENT ON FUNCTION public.user_age_at_now IS
  'Faz 2.3 — Day-precise yaş hesaplama. age() fonksiyonu doğum gününü hesaba katar.';

-- ───────────────────────────────────────────────────────────────
-- 5. Permissions
-- ───────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.user_meets_age_requirement TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_age_at_now TO authenticated;
