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
