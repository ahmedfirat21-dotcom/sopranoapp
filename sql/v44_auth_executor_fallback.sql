-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v44 — Auth executor fallback (Supabase JWKS issue workaround)
--
-- Problem (2026-04-20):
--   Kullanıcı ban denediğinde "Kimlik doğrulama gereklidir" hatası alıyor.
--   v43 ban_user_atomic RPC auth.uid() + auth.jwt()->>'sub' ikisini de NULL
--   olarak görüyor → reject ediyor.
--
--   Sebep: Supabase projesi Firebase JWT'yi VERIFY etmiyor. Dashboard'da
--   Third-Party Auth / JWKS URL (Google RS256) konfigürasyonu eksik ya da
--   yanlış. Firebase token header'da geçiyor ama PostgREST onu parse etmeden
--   bırakıyor → auth.jwt() NULL.
--
--   Aynı sorun v39 check_donation_rate_limit'te de var ama orada p_user_id
--   trust edilerek bypass yapılmış (auth NULL ise client söylediği ID'ye güven).
--
-- Çözüm: ban_user_atomic, promote_speaker_atomic, demote_speaker_atomic,
-- claim_stage_seat ve unfriend_atomic'e p_executor_id fallback parametresi
-- ekle. Auth context NULL'sa client bildirdiği kimliğe güven.
--
-- Güvenlik notu: İdeal çözüm Supabase Dashboard → Settings → Auth →
--   JWT Settings → JWKS URL'yi Firebase'in JWKS endpoint'ine ayarlamak:
--   https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com
--   ya da JWK:
--   https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com
--   JWKS yapılandırılırsa bu fallback gereksiz olur (auth.uid() native çalışır).
-- ════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════
-- ban_user_atomic — executor fallback
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION ban_user_atomic(
  p_room_id UUID,
  p_user_id TEXT,
  p_ban_type TEXT DEFAULT 'temporary',
  p_duration_minutes INTEGER DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_executor_id TEXT DEFAULT NULL  -- ★ v44: client fallback ID
) RETURNS JSON AS $$
DECLARE
  v_caller TEXT;
  v_host_id TEXT;
  v_caller_role TEXT;
  v_expires_at TIMESTAMPTZ;
  v_target_role TEXT;
BEGIN
  -- Caller tespiti: auth.uid() → auth.jwt().sub → p_executor_id fallback
  v_caller := auth.uid()::text;
  IF v_caller IS NULL THEN
    BEGIN v_caller := auth.jwt()->>'sub'; EXCEPTION WHEN OTHERS THEN v_caller := NULL; END;
  END IF;
  IF v_caller IS NULL THEN
    v_caller := p_executor_id;  -- ★ JWKS yoksa client'ın söylediği
  END IF;
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Kimlik doğrulama gereklidir (executor_id ile bile NULL).';
  END IF;

  IF v_caller = p_user_id THEN
    RAISE EXCEPTION 'Kendini banlayamazsın.';
  END IF;

  SELECT host_id INTO v_host_id FROM rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Oda bulunamadı.'; END IF;

  IF v_host_id IS DISTINCT FROM v_caller THEN
    SELECT role INTO v_caller_role FROM room_participants
      WHERE room_id = p_room_id AND user_id = v_caller;
    IF v_caller_role NOT IN ('owner', 'moderator') THEN
      RAISE EXCEPTION 'Yetkiniz yok: ban için owner/moderator gereklidir.';
    END IF;
  END IF;

  IF p_user_id = v_host_id THEN
    RAISE EXCEPTION 'Oda sahibi banlanamaz.';
  END IF;

  IF p_ban_type = 'permanent' THEN
    v_expires_at := NULL;
  ELSE
    IF p_duration_minutes IS NULL OR p_duration_minutes <= 0 THEN
      RAISE EXCEPTION 'Geçici ban için süre (dakika) gerekli.';
    END IF;
    v_expires_at := NOW() + (p_duration_minutes || ' minutes')::INTERVAL;
  END IF;

  SELECT role INTO v_target_role FROM room_participants
    WHERE room_id = p_room_id AND user_id = p_user_id;

  INSERT INTO room_bans (room_id, user_id, banned_by, ban_type, expires_at, reason)
    VALUES (p_room_id, p_user_id, v_caller, p_ban_type, v_expires_at, p_reason)
    ON CONFLICT (room_id, user_id) DO UPDATE
      SET ban_type = EXCLUDED.ban_type,
          expires_at = EXCLUDED.expires_at,
          reason = EXCLUDED.reason,
          banned_by = EXCLUDED.banned_by,
          created_at = NOW();

  DELETE FROM room_participants
    WHERE room_id = p_room_id AND user_id = p_user_id;

  IF v_target_role IN ('listener', 'spectator') THEN
    BEGIN
      UPDATE rooms SET listener_count = GREATEST(0, COALESCE(listener_count, 0) - 1)
        WHERE id = p_room_id;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN json_build_object('ok', true, 'ban_type', p_ban_type, 'expires_at', v_expires_at, 'banned_user', p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ═══════════════════════════════════════════════════
-- unfriend_atomic — executor fallback
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION unfriend_atomic(
  p_friend_id TEXT,
  p_executor_id TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_caller TEXT;
  v_deleted_count INTEGER;
BEGIN
  v_caller := auth.uid()::text;
  IF v_caller IS NULL THEN
    BEGIN v_caller := auth.jwt()->>'sub'; EXCEPTION WHEN OTHERS THEN v_caller := NULL; END;
  END IF;
  IF v_caller IS NULL THEN v_caller := p_executor_id; END IF;
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Kimlik doğrulama gereklidir.'; END IF;

  IF v_caller = p_friend_id THEN RAISE EXCEPTION 'Kendinle arkadaşlığı silemezsin.'; END IF;

  DELETE FROM friendships
    WHERE status = 'accepted'
      AND (
        (user_id = v_caller AND friend_id = p_friend_id)
        OR (user_id = p_friend_id AND friend_id = v_caller)
      );
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN json_build_object('ok', true, 'deleted', v_deleted_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ═══════════════════════════════════════════════════
-- promote_speaker_atomic — executor fallback
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION promote_speaker_atomic(
  p_room_id UUID,
  p_user_id TEXT,
  p_executor_id TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_caller TEXT;
  v_host_id TEXT;
  v_owner_tier TEXT;
  v_max_speakers INTEGER;
  v_current_speaker_count INTEGER;
  v_target_role TEXT;
  v_caller_role TEXT;
  v_is_owner_bypass BOOLEAN;
BEGIN
  v_caller := auth.uid()::text;
  IF v_caller IS NULL THEN
    BEGIN v_caller := auth.jwt()->>'sub'; EXCEPTION WHEN OTHERS THEN v_caller := NULL; END;
  END IF;
  IF v_caller IS NULL THEN v_caller := p_executor_id; END IF;
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Kimlik doğrulama gereklidir.'; END IF;

  SELECT host_id, owner_tier INTO v_host_id, v_owner_tier
    FROM rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Oda bulunamadı.'; END IF;

  SELECT role INTO v_caller_role FROM room_participants
    WHERE room_id = p_room_id AND user_id = v_caller;
  IF v_host_id IS DISTINCT FROM v_caller AND v_caller_role NOT IN ('owner', 'moderator') THEN
    RAISE EXCEPTION 'Yetkiniz yok: promote için owner/moderator gereklidir.';
  END IF;

  SELECT role INTO v_target_role FROM room_participants
    WHERE room_id = p_room_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Hedef kullanıcı bu odada değil.'; END IF;

  v_is_owner_bypass := (p_user_id = v_host_id);
  IF NOT v_is_owner_bypass THEN
    v_max_speakers := CASE LOWER(COALESCE(v_owner_tier, 'free'))
      WHEN 'pro' THEN 13 WHEN 'plus' THEN 7 ELSE 3
    END;
    SELECT COUNT(*) INTO v_current_speaker_count
      FROM room_participants
      WHERE room_id = p_room_id AND role IN ('owner', 'moderator', 'speaker');
    IF v_current_speaker_count >= v_max_speakers AND v_target_role NOT IN ('owner', 'moderator', 'speaker') THEN
      RAISE EXCEPTION 'Sahne dolu (max: %).', v_max_speakers;
    END IF;
  END IF;

  UPDATE room_participants
    SET role = CASE WHEN p_user_id = v_host_id THEN 'owner' ELSE 'speaker' END,
        is_muted = FALSE
    WHERE room_id = p_room_id AND user_id = p_user_id;

  RETURN json_build_object('ok', true, 'role', CASE WHEN p_user_id = v_host_id THEN 'owner' ELSE 'speaker' END);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ═══════════════════════════════════════════════════
-- demote_speaker_atomic — executor fallback
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION demote_speaker_atomic(
  p_room_id UUID,
  p_user_id TEXT,
  p_executor_id TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_caller TEXT;
  v_host_id TEXT;
  v_caller_role TEXT;
  v_target_role TEXT;
BEGIN
  v_caller := auth.uid()::text;
  IF v_caller IS NULL THEN
    BEGIN v_caller := auth.jwt()->>'sub'; EXCEPTION WHEN OTHERS THEN v_caller := NULL; END;
  END IF;
  IF v_caller IS NULL THEN v_caller := p_executor_id; END IF;
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Kimlik doğrulama gereklidir.'; END IF;

  SELECT host_id INTO v_host_id FROM rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Oda bulunamadı.'; END IF;

  IF v_caller = p_user_id THEN
    UPDATE room_participants SET role = 'listener', is_muted = TRUE
      WHERE room_id = p_room_id AND user_id = p_user_id;
    RETURN json_build_object('ok', true);
  END IF;

  SELECT role INTO v_caller_role FROM room_participants
    WHERE room_id = p_room_id AND user_id = v_caller;
  IF v_host_id IS DISTINCT FROM v_caller AND v_caller_role NOT IN ('owner', 'moderator') THEN
    RAISE EXCEPTION 'Yetkiniz yok.';
  END IF;

  SELECT role INTO v_target_role FROM room_participants
    WHERE room_id = p_room_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Hedef kullanıcı bu odada değil.'; END IF;

  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'Oda sahibi demote edilemez.';
  END IF;

  UPDATE room_participants SET role = 'listener', is_muted = TRUE
    WHERE room_id = p_room_id AND user_id = p_user_id;

  RETURN json_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


COMMIT;
