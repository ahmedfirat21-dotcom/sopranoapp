-- ════════════════════════════════════════════════════════════════════
-- v1.7.13.132 (21 May 2026): Persistent odaları boş kuralından muaf tut
-- ════════════════════════════════════════════════════════════════════
-- PROBLEM:
--   v110 cron, persistent (Plus/Pro/GodMaster) odaları boş kalsa
--   5dk sonra is_live=false yapıyordu. Pro'nun "7/24 açık" vaadi
--   ile çelişiyordu. UI "7/24" diyor, cron 5dk sonra kapatıyor.
--
-- ÇÖZÜM:
--   Boş 5dk kuralı SADECE non-persistent (Free) odalara uygulansın.
--   Persistent odalar (is_persistent=true → Plus/Pro/GM):
--     - expires_at süresi varsa dolunca dondurulur (mevcut blok 1)
--     - expires_at=null ise (Pro/GM) hiç dondurulmaz
--     - Boş olsa bile is_live=true kalır → kullanıcı dönünce devam eder
--
-- DAVRANIŞ TABLOSU:
--   Free     (is_persistent=false, expires_at=24sa) → süre dolunca KAPAT, boş 5dk → KAPAT
--   Plus     (is_persistent=true,  expires_at=8sa)  → süre dolunca DONDUR,   boş 5dk → KALSIN
--   Pro/GM   (is_persistent=true,  expires_at=null) → hiç dondurma,           boş 5dk → KALSIN
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.close_expired_free_rooms()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  closed_count integer := 0;
  v_room_id uuid;
  v_is_persistent boolean;
  v_settings jsonb;
BEGIN
  -- ── 1. expires_at süresi dolmuş odalar (TÜM tier'lar) ──────────────
  FOR v_room_id, v_is_persistent IN
    SELECT id, COALESCE(is_persistent, false)
    FROM rooms
    WHERE is_live = true
      AND expires_at IS NOT NULL
      AND expires_at <= now()
  LOOP
    IF v_is_persistent THEN
      -- Plus persistent oda → dondur (silme, wakeUp için kalsın)
      SELECT COALESCE(room_settings, '{}'::jsonb) INTO v_settings
        FROM rooms WHERE id = v_room_id;
      v_settings := v_settings
                   || jsonb_build_object(
                        'frozen_at', to_char(now() AT TIME ZONE 'UTC',
                                             'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                        'remaining_ms', 0
                      );
      UPDATE rooms
        SET is_live = false,
            listener_count = 0,
            expires_at = null,
            room_settings = v_settings
        WHERE id = v_room_id;
    ELSE
      -- Free non-persistent oda → klasik kapat
      UPDATE rooms
        SET is_live = false, listener_count = 0
        WHERE id = v_room_id;
    END IF;
    DELETE FROM room_participants WHERE room_id = v_room_id;
    closed_count := closed_count + 1;
  END LOOP;

  -- ── 2. Boş oda — SADECE non-persistent (Free) için, 5dk threshold ──
  -- ★ v1.7.13.132: Persistent odalar (Plus/Pro/GM) boş kalsa bile
  --   açık kalır — Pro "7/24" vaadi ve Plus "wake-up edilebilir" semantiği korunur.
  FOR v_room_id IN
    SELECT r.id
    FROM rooms r
    WHERE r.is_live = true
      AND r.created_at < now() - interval '5 minutes'
      AND COALESCE(r.is_persistent, false) = false
      AND NOT EXISTS (SELECT 1 FROM room_participants p WHERE p.room_id = r.id)
  LOOP
    UPDATE rooms
      SET is_live = false, listener_count = 0
      WHERE id = v_room_id;
    DELETE FROM room_participants WHERE room_id = v_room_id;
    closed_count := closed_count + 1;
  END LOOP;

  RETURN closed_count;
END;
$func$;

REVOKE ALL ON FUNCTION public.close_expired_free_rooms() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_expired_free_rooms() TO postgres;

