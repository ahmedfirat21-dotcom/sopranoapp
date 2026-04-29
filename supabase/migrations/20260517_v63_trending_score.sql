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
