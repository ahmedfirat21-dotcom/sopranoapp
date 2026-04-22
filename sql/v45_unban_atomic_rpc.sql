-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v45 — Unban Atomic RPC
--
-- Problem (2026-04-20):
--   Client unbanFromRoom() → direct DELETE on room_bans. RLS policy
--   auth.uid()/auth.jwt() bazlı; Supabase'in UUID cast bug'ı nedeniyle
--   accessToken factory devre dışı, auth.uid() NULL. auth.jwt() de
--   header override yöntemiyle validate edilmemiş.
--   Sonuç: DELETE silent fail → ban kaydı kalır → kullanıcı girememeye
--   devam eder rağmen "unban'landım" sanır.
--
-- Çözüm: SECURITY DEFINER unban_user_atomic RPC + executor_id fallback.
-- ════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION unban_user_atomic(
  p_room_id UUID,
  p_user_id TEXT,
  p_executor_id TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_caller TEXT;
  v_host_id TEXT;
  v_caller_role TEXT;
  v_deleted_count INTEGER;
BEGIN
  -- Caller tespiti: auth.uid() → auth.jwt().sub → p_executor_id
  v_caller := auth.uid()::text;
  IF v_caller IS NULL THEN
    BEGIN v_caller := auth.jwt()->>'sub'; EXCEPTION WHEN OTHERS THEN v_caller := NULL; END;
  END IF;
  IF v_caller IS NULL THEN v_caller := p_executor_id; END IF;
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Kimlik doğrulama gereklidir.';
  END IF;

  -- Oda var mı?
  SELECT host_id INTO v_host_id FROM rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Oda bulunamadı.'; END IF;

  -- Yetki: host veya owner/moderator
  IF v_host_id IS DISTINCT FROM v_caller THEN
    SELECT role INTO v_caller_role FROM room_participants
      WHERE room_id = p_room_id AND user_id = v_caller;
    IF v_caller_role NOT IN ('owner', 'moderator') THEN
      RAISE EXCEPTION 'Yetkiniz yok: unban için owner/moderator gereklidir.';
    END IF;
  END IF;

  DELETE FROM room_bans
    WHERE room_id = p_room_id AND user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN json_build_object('ok', true, 'deleted', v_deleted_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMIT;
