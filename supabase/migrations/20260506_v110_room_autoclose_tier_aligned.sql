-- ════════════════════════════════════════════════════════════════════
-- v110 (6 May 2026): Oda otomatik kapanma — üyelik planları ile hizalandı
-- ════════════════════════════════════════════════════════════════════
-- PROBLEM:
--   Üyelik planları sayfasında (app/plus.tsx) Plus için "Oda Süresi: 12sa"
--   yazıyordu ama cron (v92.22) Plus/Pro tier'larını expires_at kontrolünden
--   muaf tutuyordu. Sonuç: UI ile gerçek davranış uyuşmuyordu — Plus odaları
--   12 saat sonra kapanmıyor, sınırsız açık kalıyordu.
--
-- KULLANICI İSTEĞİ:
--   - Free oda 24 saat sonra otomatik kapansın (kullanılsa da kullanılmasa da)
--   - Plus oda 12 saat sonra kapansın AMA 3 "Kalıcı oda" slotu olarak DONDURULSUN
--     (silinmesin → host sonra wakeUpRoom ile tekrar açabilsin)
--   - Pro sınırsız (zaten expires_at=null)
--
-- ÇÖZÜM:
--   1. expires_at <= now() kontrolü TÜM tier'lara uygulansın (muafiyet kalktı)
--   2. is_persistent=true odalar (Plus/Pro): dondurulsun
--      → is_live=false, listener_count=0, expires_at=null,
--        room_settings.frozen_at=now, room_settings.remaining_ms=0
--      → katılımcılar temizlensin
--      → oda kaydı korunur (wakeUpRoom için)
--   3. is_persistent=false odalar (Free): klasik kapatma
--      → is_live=false, listener_count=0, katılımcılar silinir
--   4. Boş 5dk kuralı (v92.22) korunur — herkes için tam kapatma
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

  -- ── 2. Boş oda — herkes için (v92.22 davranışı), 5dk threshold ─────
  FOR v_room_id IN
    SELECT r.id
    FROM rooms r
    WHERE r.is_live = true
      AND r.created_at < now() - interval '5 minutes'
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
