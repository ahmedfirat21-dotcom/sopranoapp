-- ★ v1.7.13.140 (21 May 2026): Pro 7/24 vs Boş-Oda Cron çelişkisi fix.
--
-- SORUN:
--   constants/tiers.ts Pro `durationHours: 0` (7/24 açık) diyor.
--   Ama close_expired_free_rooms() cron'unun #2 kuralı (boş oda 5dk → kapat)
--   tüm odaları kapsıyordu — Pro user 5 dakika yalnız kalsa odası kapanırdı.
--   → "Ne diye Pro aldım?" şikayeti garanti.
--
-- ÇÖZÜM:
--   "Boş oda" kuralından `is_persistent=true` odaları MUAF tut.
--   Plus/Pro user kasıtlı olarak persistent oda açtıysa (services/room.ts:992
--   `is_persistent: limits.persistent`), cron dokunmaz.
--   Free user kalıcı oda açamadığı için bu kural sadece premium'a fayda sağlar.
--
-- HAYALET ODA RİSKİ?
--   Yok. is_persistent=true bir tier özelliği (Plus/Pro satın aldı). Free
--   kullanıcılar hâlâ 5dk boş kalan odalarda otomatik kapatılır. Hayalet
--   risk sadece "premium kullanıcı kasıtlı oda açmış" durumda var ki bu
--   "hayalet" değil "premium özelliği".

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

  -- 2. Boş oda — 5dk threshold, AMA is_persistent=true (Plus/Pro premium) odaları MUAF.
  --    ★ v1.7.13.140: Pro 7/24 vaadiyle çelişen muafiyet eklendi.
  FOR v_room_id IN
    SELECT r.id
    FROM rooms r
    WHERE r.is_live = true
      AND r.created_at < now() - interval '5 minutes'
      AND COALESCE(r.is_persistent, false) = false
      AND NOT EXISTS (SELECT 1 FROM room_participants p WHERE p.room_id = r.id)
  LOOP
    UPDATE rooms SET is_live = false, listener_count = 0 WHERE id = v_room_id;
    DELETE FROM room_participants WHERE room_id = v_room_id;
    closed_count := closed_count + 1;
  END LOOP;

  RETURN closed_count;
END;
$func$;
