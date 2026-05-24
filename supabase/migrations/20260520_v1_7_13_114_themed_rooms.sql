-- ★ v1.7.13.114 (20 May 2026): Tematik Sürekli Odalar (Sabah Kahvesi, Gece Kuşları)
-- Admin tarafından açılan kalıcı odalar "Sopranochat Resmi" rozet ile öne çıkar;
-- zaman bandına göre home banner'da carousel'de gösterilir.

-- 1) Kolonlar
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS is_official BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS theme_label TEXT,          -- "Sabah Kahvesi", "Gece Kuşları"
  ADD COLUMN IF NOT EXISTS theme_icon TEXT,           -- emoji: "☕", "🌙"
  ADD COLUMN IF NOT EXISTS theme_start_hour INT,      -- 6 → 06:00
  ADD COLUMN IF NOT EXISTS theme_end_hour INT,        -- 11 → 11:00 (gece için end < start: ör. 22→4 = 22:00-04:00 wrap)
  ADD COLUMN IF NOT EXISTS theme_gradient TEXT;       -- "amber" | "indigo" | "rose" | "emerald"

CREATE INDEX IF NOT EXISTS idx_rooms_official
  ON rooms (is_official) WHERE is_official = TRUE;

-- 2) RPC: get_official_themed_rooms — şu an aktif (saat bandına göre) tematik odalar
CREATE OR REPLACE FUNCTION public.get_official_themed_rooms()
RETURNS TABLE (
  id TEXT,
  name TEXT,
  description TEXT,
  category TEXT,
  is_live BOOLEAN,
  host_id TEXT,
  host_name TEXT,
  host_avatar TEXT,
  participant_count INT,
  theme_label TEXT,
  theme_icon TEXT,
  theme_gradient TEXT,
  is_active_now BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH now_h AS (
    SELECT EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'Europe/Istanbul'))::INT AS h
  )
  SELECT
    r.id,
    r.name,
    r.description,
    r.category,
    r.is_live,
    r.host_id,
    h.display_name AS host_name,
    h.avatar_url AS host_avatar,
    (SELECT COUNT(*) FROM room_participants WHERE room_id = r.id)::INT AS participant_count,
    r.theme_label,
    r.theme_icon,
    r.theme_gradient,
    CASE
      -- Wrap-around (örn. 22→04): saat >= start VEYA saat < end
      WHEN r.theme_end_hour < r.theme_start_hour THEN
        (SELECT h FROM now_h) >= r.theme_start_hour OR (SELECT h FROM now_h) < r.theme_end_hour
      -- Normal: start <= saat < end
      ELSE
        (SELECT h FROM now_h) >= r.theme_start_hour AND (SELECT h FROM now_h) < r.theme_end_hour
    END AS is_active_now
  FROM rooms r
  LEFT JOIN profiles h ON h.id = r.host_id
  WHERE r.is_official = TRUE
    AND r.theme_label IS NOT NULL
  ORDER BY
    is_active_now DESC,
    r.is_live DESC,
    r.theme_start_hour ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_official_themed_rooms() TO authenticated, anon;
