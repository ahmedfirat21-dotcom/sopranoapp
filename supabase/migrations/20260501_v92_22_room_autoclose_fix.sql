-- ★ v92.22 (1 May 2026): Hayalet oda bug'ı + cron silent fail fix.
--
-- BUG: Keşfet'te kullanıcı boş odaları "CANLI" olarak görüyordu.
--      Aranan'in Odası 4+ saat boş, Ramazan'in Odası 12+ saat boş, hala is_live=true.
--
-- KÖK SEBEPLER:
--   1. v_room_id `text` declare edilmişti, rooms.id UUID → "operator does not exist:
--      uuid = text" hatası → cron her seferinde silent fail → temizlik hiç çalışmadı.
--   2. 30 dakika threshold çok uzun (kullanıcı zaten gerçek zamanlı keşfediyor).
--   3. Plus/Pro muafiyeti — premium kullanıcının boş odası da hayalet, muaf olamaz.
--
-- FİX:
--   - v_room_id → uuid
--   - 30 dk → 5 dk
--   - Boş oda kuralında premium muafiyeti kaldırıldı (sadece expires_at ile sınırlı kaldı)

CREATE OR REPLACE FUNCTION public.close_expired_free_rooms()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  closed_count integer := 0;
  v_room_id uuid;
BEGIN
  -- 1. expires_at süresi dolmuş Free odalar (Plus/Pro hala muaf — premium feature)
  FOR v_room_id IN
    SELECT id FROM rooms
    WHERE is_live = true
      AND expires_at IS NOT NULL
      AND expires_at <= now()
      AND COALESCE(owner_tier, 'Free') NOT IN ('Plus', 'Pro', 'GodMaster')
  LOOP
    UPDATE rooms SET is_live = false, listener_count = 0 WHERE id = v_room_id;
    DELETE FROM room_participants WHERE room_id = v_room_id;
    closed_count := closed_count + 1;
  END LOOP;

  -- 2. Boş oda — herkes için (premium dahil), 5 dk threshold
  FOR v_room_id IN
    SELECT r.id
    FROM rooms r
    WHERE r.is_live = true
      AND r.created_at < now() - interval '5 minutes'
      AND NOT EXISTS (SELECT 1 FROM room_participants p WHERE p.room_id = r.id)
  LOOP
    UPDATE rooms SET is_live = false, listener_count = 0 WHERE id = v_room_id;
    DELETE FROM room_participants WHERE room_id = v_room_id;
    closed_count := closed_count + 1;
  END LOOP;

  RETURN closed_count;
END;
$func$;
