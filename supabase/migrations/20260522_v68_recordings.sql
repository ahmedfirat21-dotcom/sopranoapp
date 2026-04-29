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
