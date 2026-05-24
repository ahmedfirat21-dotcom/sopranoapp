-- ════════════════════════════════════════════════════════════════════
-- v1.7.13.133 (21 May 2026): Admin'e rooms DELETE yetkisi
-- ════════════════════════════════════════════════════════════════════
-- PROBLEM:
--   Web admin panelinde "oda sil" tıklanınca "admin yetkisi gerekli"
--   hatası alınıyor. RLS policy'de yalnızca "Room owner can delete room"
--   var → admin (is_admin=true) bile başkasının odasını silemiyor.
--
-- ÇÖZÜM:
--   profiles.is_admin=true olan kullanıcılara DELETE FROM rooms izni ver.
--   Bağımlı tablolar (room_participants vb.) zaten admin için açık olabilir
--   ama emin olmak için onlara da policy ekliyoruz.
-- ════════════════════════════════════════════════════════════════════

-- ── rooms tablosu ──
DROP POLICY IF EXISTS "Admins can delete any room" ON public.rooms;
CREATE POLICY "Admins can delete any room"
  ON public.rooms FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = public.app_uid() AND is_admin = true
    )
  );

-- ── room_participants ──
DROP POLICY IF EXISTS "Admins can delete any participant" ON public.room_participants;
CREATE POLICY "Admins can delete any participant"
  ON public.room_participants FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = public.app_uid() AND is_admin = true
    )
  );

-- ── Yan tablolar (varsa) ──
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'room_invites') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can delete any room_invite" ON public.room_invites';
    EXECUTE 'CREATE POLICY "Admins can delete any room_invite" ON public.room_invites FOR DELETE
             USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = public.app_uid() AND is_admin = true))';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'room_access_requests') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can delete any access_request" ON public.room_access_requests';
    EXECUTE 'CREATE POLICY "Admins can delete any access_request" ON public.room_access_requests FOR DELETE
             USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = public.app_uid() AND is_admin = true))';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'room_followers') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can delete any room_follower" ON public.room_followers';
    EXECUTE 'CREATE POLICY "Admins can delete any room_follower" ON public.room_followers FOR DELETE
             USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = public.app_uid() AND is_admin = true))';
  END IF;
END $$;
