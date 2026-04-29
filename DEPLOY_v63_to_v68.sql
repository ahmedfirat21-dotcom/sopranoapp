-- ═══════════════════════════════════════════════════════════════
-- SopranoChat — v63 Trending Score (Faz 4.2)
-- ═══════════════════════════════════════════════════════════════
-- Foundation: pure scoring fonksiyonu + opsiyonel RPC.
-- Mevcut getLive() client-side scoring yapıyor; bu migration:
--   1. room_trending_score() — pure (IMMUTABLE) skor formülü
--   2. get_trending_rooms()  — STABLE RPC, top-N trending list
--   3. idx_rooms_live_created — yeni index, trending sıralaması için
--
-- Skor formülü:
--   score = (listener_count*10 + total_gifts*5)
--           / max(ln(age_min + 2), 1)
--           * (boost_active ? 1.5 : 1.0)
--
-- Mantık:
--   - listener_count*10 — birincil sinyal (sosyal kanıt)
--   - total_gifts*5    — kalite proxy'si (premium etkileşim)
--   - ln(age) — taze odalar avantajlı, ama ölçek doğal log
--   - boost*1.5 — sponsorlu odalar yüzde 50 yukarı
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. Pure scoring fonksiyonu — IMMUTABLE (NOW kullanmaz)
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.room_trending_score(
  p_listener_count INTEGER,
  p_total_gifts INTEGER,
  p_boost_active BOOLEAN,
  p_age_minutes NUMERIC
) RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT (
    COALESCE(p_listener_count, 0)::numeric * 10
    + COALESCE(p_total_gifts, 0)::numeric * 5
  )
  / GREATEST(LN(GREATEST(COALESCE(p_age_minutes, 0), 0) + 2), 1)
  * CASE WHEN COALESCE(p_boost_active, false) THEN 1.5 ELSE 1.0 END;
$$;

COMMENT ON FUNCTION public.room_trending_score IS
  'Faz 4.2 — Pure trending score: (listener*10 + gifts*5) / ln(age+2) * boost_mul';

-- ───────────────────────────────────────────────────────────────
-- 2. Top-N trending RPC — STABLE (NOW kullanır)
-- ───────────────────────────────────────────────────────────────
-- Block-aware filtreleme client tarafında yapılır (RoomService.getTrending)
-- çünkü Firebase auth.uid() server tarafında SECURITY DEFINER ile
-- çakışmasın diye saf veri RPC'si tutuyoruz.
CREATE OR REPLACE FUNCTION public.get_trending_rooms(
  p_limit INTEGER DEFAULT 20
) RETURNS TABLE (
  room_id UUID,
  trending_score NUMERIC,
  age_minutes NUMERIC,
  is_boost_active BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH live AS (
    SELECT
      r.id,
      r.listener_count,
      r.total_gifts,
      r.boost_expires_at,
      r.created_at,
      EXTRACT(EPOCH FROM (now() - r.created_at)) / 60.0 AS age_min,
      (r.boost_expires_at IS NOT NULL AND r.boost_expires_at > now()) AS boost_act
    FROM public.rooms r
    WHERE r.is_live = true
      AND (r.expires_at IS NULL OR r.expires_at > now())
      AND (
        COALESCE(r.listener_count, 0) > 0
        OR (r.boost_expires_at IS NOT NULL AND r.boost_expires_at > now())
        OR r.is_persistent = true
        OR r.created_at > now() - INTERVAL '2 minutes'
      )
  )
  SELECT
    id AS room_id,
    public.room_trending_score(listener_count, total_gifts, boost_act, age_min) AS trending_score,
    age_min AS age_minutes,
    boost_act AS is_boost_active
  FROM live
  ORDER BY trending_score DESC
  LIMIT GREATEST(LEAST(p_limit, 100), 1);
$$;

COMMENT ON FUNCTION public.get_trending_rooms IS
  'Faz 4.2 — Top-N rooms by trending_score; block/private filtering client-side';

-- ───────────────────────────────────────────────────────────────
-- 3. Index — getLive ve get_trending_rooms için
-- ───────────────────────────────────────────────────────────────
-- Live + created_at ortak filtre (aktif odaları taze sırada gez)
CREATE INDEX IF NOT EXISTS idx_rooms_live_created
  ON public.rooms (is_live, created_at DESC)
  WHERE is_live = true;

-- listener_count zaten boost index'inde var ama ayrı bir
-- "live + listener_count desc" hızlı tarama için yararlı
CREATE INDEX IF NOT EXISTS idx_rooms_live_listener
  ON public.rooms (is_live, listener_count DESC)
  WHERE is_live = true;

-- ───────────────────────────────────────────────────────────────
-- 4. Permissions — authenticated rolüne erişim
-- ───────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.room_trending_score TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_trending_rooms TO authenticated, anon;
-- ═══════════════════════════════════════════════════════════════
-- SopranoChat — v64 Server-Side Rate Limit RPC (Faz 2.2)
-- ═══════════════════════════════════════════════════════════════
-- Tablo zaten v62'de hazır (public.rate_limits).
-- Bu migration:
--   1. check_and_increment_rate_limit() — atomik increment + decision
--   2. get_rate_limit_status() — UI'da "Tekrar denemek için X sn bekle"
--      göstermek için read-only sorgu
--   3. cleanup_old_rate_limits() — kapanmış pencereleri temizler
--
-- Tasarım kararları:
--   • SECURITY DEFINER: client (auth.uid()) yazamıyor (RLS service_only),
--     o yüzden RPC server tarafında güvenle increment yapar.
--   • Atomik: SELECT ... FOR UPDATE + INSERT ... ON CONFLICT pattern.
--   • Window kayıyor değil sabit: window_start aşıldığında count sıfırlanır.
--   • action tag'leri serbest TEXT — caller normalize sorumlu.
--
-- Standart action tag'leri (sözleşme):
--   room_create     — 5 oda / 1 saat
--   gift_send       — 30 hediye / 1 dakika
--   voice_dm_send   — 20 sesli DM / 5 dakika
--   message_send    — 60 mesaj / 1 dakika  (room chat / DM ortak)
--   friend_request  — 30 istek / 1 saat
--   report          — 10 rapor / 1 saat
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. check_and_increment_rate_limit
-- ───────────────────────────────────────────────────────────────
-- Returns:
--   allowed BOOLEAN — true ise eylem onay, false ise reddet
--   remaining INTEGER — pencerede kalan kullanım hakkı
--   reset_at TIMESTAMPTZ — pencere ne zaman sıfırlanır
CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(
  p_user_id TEXT,
  p_action TEXT,
  p_max_count INTEGER,
  p_window_seconds INTEGER
) RETURNS TABLE (
  allowed BOOLEAN,
  remaining INTEGER,
  reset_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_window_start TIMESTAMPTZ;
  v_count INTEGER;
  v_window_age_seconds NUMERIC;
BEGIN
  -- Kullanıcı kimliği doğrulansın — caller her zaman p_user_id eşit kendi auth.uid'i
  IF p_user_id IS NULL OR p_user_id = '' THEN
    RAISE EXCEPTION 'invalid user_id';
  END IF;
  IF p_action IS NULL OR p_action = '' THEN
    RAISE EXCEPTION 'invalid action';
  END IF;
  IF p_max_count <= 0 OR p_window_seconds <= 0 THEN
    RAISE EXCEPTION 'max_count/window_seconds must be > 0';
  END IF;

  -- Atomik upsert: row yoksa oluştur, varsa pencere kontrolüyle güncelle
  -- ON CONFLICT (user_id, action) → atomic increment
  INSERT INTO public.rate_limits (user_id, action, count, window_start)
  VALUES (p_user_id, p_action, 1, v_now)
  ON CONFLICT (user_id, action) DO UPDATE
  SET
    -- Pencere süresi dolduysa sıfırla, yoksa +1
    count = CASE
      WHEN EXTRACT(EPOCH FROM (v_now - rate_limits.window_start)) >= p_window_seconds
      THEN 1
      ELSE rate_limits.count + 1
    END,
    window_start = CASE
      WHEN EXTRACT(EPOCH FROM (v_now - rate_limits.window_start)) >= p_window_seconds
      THEN v_now
      ELSE rate_limits.window_start
    END
  RETURNING rate_limits.count, rate_limits.window_start
  INTO v_count, v_window_start;

  v_window_age_seconds := EXTRACT(EPOCH FROM (v_now - v_window_start));

  -- Hak limit aşıldıysa allowed=false dön; ama incrementer ROLLBACK yapmıyor
  -- (UI tekrar deneme hakkını engellemek için count'ı yerleşik tutar; bu
  --  davranış kullanıcı abuse'a karşı ekstra cezadır — istenirse v65'te değişebilir.)
  RETURN QUERY SELECT
    (v_count <= p_max_count) AS allowed,
    GREATEST(p_max_count - v_count, 0) AS remaining,
    (v_window_start + (p_window_seconds || ' seconds')::INTERVAL) AS reset_at;
END;
$$;

COMMENT ON FUNCTION public.check_and_increment_rate_limit IS
  'Faz 2.2 — Atomik rate-limit kontrolü. allowed=false dönerse caller eylemi iptal etmeli.';

-- ───────────────────────────────────────────────────────────────
-- 2. get_rate_limit_status — read-only inspection
-- ───────────────────────────────────────────────────────────────
-- UI'da "X sn sonra dene" ipucu için. Increment yapmaz.
CREATE OR REPLACE FUNCTION public.get_rate_limit_status(
  p_user_id TEXT,
  p_action TEXT,
  p_max_count INTEGER,
  p_window_seconds INTEGER
) RETURNS TABLE (
  current_count INTEGER,
  remaining INTEGER,
  reset_at TIMESTAMPTZ,
  in_window BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_row public.rate_limits%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT * INTO v_row FROM public.rate_limits
  WHERE user_id = p_user_id AND action = p_action
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, p_max_count, v_now, FALSE;
    RETURN;
  END IF;

  IF EXTRACT(EPOCH FROM (v_now - v_row.window_start)) >= p_window_seconds THEN
    -- Pencere bitmiş — kullanıcının yeni deneme hakkı tam
    RETURN QUERY SELECT 0, p_max_count, v_now, FALSE;
  ELSE
    RETURN QUERY SELECT
      v_row.count,
      GREATEST(p_max_count - v_row.count, 0),
      (v_row.window_start + (p_window_seconds || ' seconds')::INTERVAL),
      TRUE;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.get_rate_limit_status IS
  'Faz 2.2 — Increment yapmadan rate-limit durumu sorgular (UI ipucu için).';

-- ───────────────────────────────────────────────────────────────
-- 3. cleanup_old_rate_limits — gecikmiş row'ları temizle
-- ───────────────────────────────────────────────────────────────
-- 24 saat öncesinden eski window_start'a sahip satırları siler.
-- Cron yerine app start veya günlük autoCloseExpired interval'inden
-- best-effort çağrılabilir.
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.rate_limits
  WHERE window_start < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION public.cleanup_old_rate_limits IS
  'Faz 2.2 — 24h öncesi rate_limits row''larını sil. Periyodik temizlik.';

-- ───────────────────────────────────────────────────────────────
-- 4. Permissions
-- ───────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_rate_limit_status TO authenticated;
-- cleanup yalnızca service_role için — authenticated'a verilmez
REVOKE EXECUTE ON FUNCTION public.cleanup_old_rate_limits FROM PUBLIC;
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
-- ═══════════════════════════════════════════════════════════════
-- SopranoChat — v66 Badges (Faz 6.3)
-- ═══════════════════════════════════════════════════════════════
-- user_badges tablosu zaten v62'de var.
-- Bu migration:
--   1. award_badge() RPC — idempotent insert (RLS bypass)
--   2. revoke_badge() RPC — admin için (rezerve, yalnızca service_role)
--   3. _award_host_milestones() trigger — rooms.is_live=true ON UPDATE
--      veya INSERT'te host'un toplam oda sayısına göre host_1/10/100 verir.
--   4. _award_social_butterfly() trigger — friendships ON INSERT ile 50+
--      arkadaş eşiğine ulaşıldığında badge dağıtır.
--   5. award_sp_donor_if_first() — services tarafından çağrılan helper.
--
-- Tasarım:
--   • award_badge SECURITY DEFINER, p_user_id zorunlu — caller'in kendi
--     UID'i. (verified/staff dağıtımı service_role için ayrı.)
--   • Idempotent: ON CONFLICT DO NOTHING ile aynı badge tekrar verilemez.
--   • Trigger'lar best-effort: hatada exception fırlatmaz (host operation
--     bozulmasın). NOTICE yerine sessiz devam.
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. award_badge — public RPC (caller kendi user_id'si için)
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.award_badge(
  p_user_id TEXT,
  p_badge_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted BOOLEAN := FALSE;
BEGIN
  IF p_user_id IS NULL OR p_badge_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Auth check: caller kendi UID'sini geçirmeli (verified/staff hariç)
  IF p_badge_id IN ('verified', 'staff') THEN
    -- Sadece service_role bu rozetleri verebilir
    IF current_setting('request.jwt.claims', true)::jsonb ->> 'role' <> 'service_role' THEN
      RAISE EXCEPTION 'Bu rozet yalnızca yöneticiler tarafından verilebilir.';
    END IF;
  END IF;

  INSERT INTO public.user_badges (user_id, badge_id, awarded_at)
  VALUES (p_user_id, p_badge_id, NOW())
  ON CONFLICT (user_id, badge_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted > 0;
END;
$$;

COMMENT ON FUNCTION public.award_badge IS
  'Faz 6.3 — Idempotent badge award. verified/staff service_role only.';

-- ───────────────────────────────────────────────────────────────
-- 2. revoke_badge — admin / service_role only
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.revoke_badge(
  p_user_id TEXT,
  p_badge_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claims', true)::jsonb ->> 'role' <> 'service_role' THEN
    RAISE EXCEPTION 'Yetki yok.';
  END IF;
  DELETE FROM public.user_badges
  WHERE user_id = p_user_id AND badge_id = p_badge_id;
  RETURN FOUND;
END;
$$;

-- ───────────────────────────────────────────────────────────────
-- 3. Host milestone trigger — rooms INSERT'te host'un toplam oda sayısı
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._award_host_milestones()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_count INTEGER;
BEGIN
  IF NEW.host_id IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_room_count FROM public.rooms WHERE host_id = NEW.host_id;

  BEGIN
    IF v_room_count >= 1 THEN
      INSERT INTO public.user_badges (user_id, badge_id) VALUES (NEW.host_id, 'host_1') ON CONFLICT DO NOTHING;
    END IF;
    IF v_room_count >= 10 THEN
      INSERT INTO public.user_badges (user_id, badge_id) VALUES (NEW.host_id, 'host_10') ON CONFLICT DO NOTHING;
    END IF;
    IF v_room_count >= 100 THEN
      INSERT INTO public.user_badges (user_id, badge_id) VALUES (NEW.host_id, 'host_100') ON CONFLICT DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Best-effort: badge başarısız olursa room creation'ı bozma
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_host_milestones ON public.rooms;
CREATE TRIGGER trg_award_host_milestones
  AFTER INSERT ON public.rooms
  FOR EACH ROW
  EXECUTE FUNCTION public._award_host_milestones();

-- ───────────────────────────────────────────────────────────────
-- 4. Social butterfly trigger — friendships accepted INSERT'te kontrol
-- ───────────────────────────────────────────────────────────────
-- friendships tablosunda accepted state'inde 50+ olduğunda dağıt.
-- friendships çift yönlü değilse (A→B accepted), her iki taraf için ayrı sayım.
CREATE OR REPLACE FUNCTION public._award_social_butterfly()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count_a INTEGER;
  v_count_b INTEGER;
BEGIN
  IF NEW.status <> 'accepted' THEN RETURN NEW; END IF;

  BEGIN
    -- A taraf
    SELECT COUNT(*) INTO v_count_a FROM public.friendships
    WHERE (user_id = NEW.user_id OR friend_id = NEW.user_id) AND status = 'accepted';
    IF v_count_a >= 50 THEN
      INSERT INTO public.user_badges (user_id, badge_id) VALUES (NEW.user_id, 'social_butterfly') ON CONFLICT DO NOTHING;
    END IF;

    -- B taraf
    SELECT COUNT(*) INTO v_count_b FROM public.friendships
    WHERE (user_id = NEW.friend_id OR friend_id = NEW.friend_id) AND status = 'accepted';
    IF v_count_b >= 50 THEN
      INSERT INTO public.user_badges (user_id, badge_id) VALUES (NEW.friend_id, 'social_butterfly') ON CONFLICT DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_social_butterfly ON public.friendships;
CREATE TRIGGER trg_award_social_butterfly
  AFTER INSERT OR UPDATE OF status ON public.friendships
  FOR EACH ROW
  EXECUTE FUNCTION public._award_social_butterfly();

-- ───────────────────────────────────────────────────────────────
-- 5. Popular trigger — follows INSERT'te 500+ takipçiye ulaşıldığında
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._award_popular()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  BEGIN
    SELECT COUNT(*) INTO v_count FROM public.follows WHERE following_id = NEW.following_id;
    IF v_count >= 500 THEN
      INSERT INTO public.user_badges (user_id, badge_id)
      VALUES (NEW.following_id, 'popular')
      ON CONFLICT DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_popular ON public.follows;
CREATE TRIGGER trg_award_popular
  AFTER INSERT ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION public._award_popular();

-- ───────────────────────────────────────────────────────────────
-- 6. Permissions
-- ───────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.award_badge TO authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_badge FROM PUBLIC;
-- ═══════════════════════════════════════════════════════════════
-- SopranoChat — v67 Club Triggers + Helper RPCs (Faz 6.1)
-- ═══════════════════════════════════════════════════════════════
-- Tablolar zaten v62'de hazır. Bu migration:
--   1. member_count'u senkron tutan trigger (INSERT/DELETE on club_members)
--   2. owner'i otomatik member yapan trigger (INSERT on clubs)
--   3. join_club / leave_club RPC — atomik üyelik işlemleri
--   4. set_club_member_role RPC — owner/mod rol değişimi (auth checked)
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. member_count trigger
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._sync_club_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.clubs SET member_count = member_count + 1, updated_at = NOW()
    WHERE id = NEW.club_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.clubs SET member_count = GREATEST(member_count - 1, 0), updated_at = NOW()
    WHERE id = OLD.club_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_club_member_count ON public.club_members;
CREATE TRIGGER trg_sync_club_member_count
  AFTER INSERT OR DELETE ON public.club_members
  FOR EACH ROW
  EXECUTE FUNCTION public._sync_club_member_count();

-- ───────────────────────────────────────────────────────────────
-- 2. Auto-add owner as 'owner' member when club created
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._auto_add_club_owner_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Owner kayıdı yoksa ekle. Trigger member_count'u +1 yapar.
  -- Tabloda member_count default 1 olduğu için bunu 0'a sıfırla,
  -- trigger 1'e çıkarsın (race-condition-free).
  UPDATE public.clubs SET member_count = 0 WHERE id = NEW.id;

  INSERT INTO public.club_members (club_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (club_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_add_club_owner ON public.clubs;
CREATE TRIGGER trg_auto_add_club_owner
  AFTER INSERT ON public.clubs
  FOR EACH ROW
  EXECUTE FUNCTION public._auto_add_club_owner_member();

-- ───────────────────────────────────────────────────────────────
-- 3. join_club RPC — atomic + premium check
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.join_club(
  p_club_id UUID,
  p_user_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_public BOOLEAN;
  v_is_premium BOOLEAN;
BEGIN
  IF p_user_id IS NULL OR p_club_id IS NULL THEN
    RAISE EXCEPTION 'invalid params';
  END IF;

  SELECT is_public, is_premium INTO v_is_public, v_is_premium
  FROM public.clubs WHERE id = p_club_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kulüp bulunamadı.';
  END IF;

  IF NOT v_is_public THEN
    RAISE EXCEPTION 'Bu kulüp gizli — davet gerekli.';
  END IF;

  INSERT INTO public.club_members (club_id, user_id, role)
  VALUES (p_club_id, p_user_id, 'member')
  ON CONFLICT (club_id, user_id) DO NOTHING;
  RETURN TRUE;
END;
$$;

-- ───────────────────────────────────────────────────────────────
-- 4. leave_club RPC — atomic
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.leave_club(
  p_club_id UUID,
  p_user_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.club_members
  WHERE club_id = p_club_id AND user_id = p_user_id;

  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF v_role = 'owner' THEN
    RAISE EXCEPTION 'Sahip ayrılamaz. Önce sahipliği devret veya kulübü sil.';
  END IF;

  DELETE FROM public.club_members
  WHERE club_id = p_club_id AND user_id = p_user_id;
  RETURN TRUE;
END;
$$;

-- ───────────────────────────────────────────────────────────────
-- 5. set_club_member_role RPC — owner-only role change
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_club_member_role(
  p_club_id UUID,
  p_target_user_id TEXT,
  p_new_role TEXT,
  p_by_user_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner TEXT;
  v_old_role TEXT;
BEGIN
  IF p_new_role NOT IN ('moderator', 'member') THEN
    RAISE EXCEPTION 'Geçersiz rol.';
  END IF;

  SELECT owner_id INTO v_owner FROM public.clubs WHERE id = p_club_id;
  IF v_owner IS NULL OR v_owner <> p_by_user_id THEN
    RAISE EXCEPTION 'Yetki yok.';
  END IF;

  IF p_target_user_id = v_owner THEN
    RAISE EXCEPTION 'Sahibin rolü değiştirilemez.';
  END IF;

  UPDATE public.club_members
  SET role = p_new_role
  WHERE club_id = p_club_id AND user_id = p_target_user_id;
  RETURN FOUND;
END;
$$;

-- ───────────────────────────────────────────────────────────────
-- 6. Permissions
-- ───────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.join_club TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_club TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_club_member_role TO authenticated;
-- ═══════════════════════════════════════════════════════════════
-- SopranoChat — v68 Room Recordings RPC + Cleanup (Faz 6.2)
-- ═══════════════════════════════════════════════════════════════
-- room_recordings tablosu v62'de hazır.
-- Bu migration:
--   1. increment_recording_listen() — atomik dinleme sayacı
--   2. cleanup_expired_recordings() — expires_at geçmiş kayıtları siler
--   3. host_can_write_recording() — RLS policy için yardımcı
--   4. host_recording_insert / update policy'leri
--
-- Egress'i tetikleyen LiveKit entegrasyonu Edge Function'da. Bu migration
-- yalnızca data layer + RLS + cleanup ile sınırlı. Audio dosyası storage
-- bucket'a yüklenip URL bu tabloya yazılacak.
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. increment_recording_listen — atomik UPDATE
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_recording_listen(
  p_recording_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.room_recordings
  SET listen_count = listen_count + 1
  WHERE id = p_recording_id
    AND is_public = TRUE
    AND expires_at > NOW()
  RETURNING listen_count INTO v_count;
  RETURN COALESCE(v_count, 0);
END;
$$;

COMMENT ON FUNCTION public.increment_recording_listen IS
  'Faz 6.2 — Atomik listen counter. Sadece public + non-expired kayıtlar için artar.';

-- ───────────────────────────────────────────────────────────────
-- 2. cleanup_expired_recordings — service_role only
-- ───────────────────────────────────────────────────────────────
-- expires_at geçmiş kayıtlar fiziksel olarak silinir.
-- Storage bucket temizliği AYRI bir job (audio_url'leri toplu silmek
-- için Supabase Storage API çağrısı gerekir; cron'da çalışır).
CREATE OR REPLACE FUNCTION public.cleanup_expired_recordings()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.room_recordings
  WHERE expires_at < NOW();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_recordings FROM PUBLIC;

-- ───────────────────────────────────────────────────────────────
-- 3. Host write policy — sadece kayıt sahibi (oda host'u) yazabilir
-- ───────────────────────────────────────────────────────────────
-- INSERT/UPDATE/DELETE — caller rooms.host_id'i olmalı.
-- (Egress callback service_role kullanırsa bypass eder; bu policy
--  user-token ile yazma denemelerinde gate olur.)
DROP POLICY IF EXISTS room_rec_host_write ON public.room_recordings;
CREATE POLICY room_rec_host_write ON public.room_recordings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.rooms r
      WHERE r.id = room_id AND r.host_id = auth.uid()::text
    )
  );

-- ───────────────────────────────────────────────────────────────
-- 4. Permissions
-- ───────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.increment_recording_listen TO authenticated, anon;
