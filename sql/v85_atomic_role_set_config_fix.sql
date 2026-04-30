-- ═══════════════════════════════════════════════════════════════════
-- v85: Atomic role-change RPC'lerine set_config trigger bypass ekle
-- ═══════════════════════════════════════════════════════════════════
-- Sorun: prevent_role_escalation trigger UPDATE'leri bloke ediyor.
--   v83'te 3-arg promote_speaker_atomic'e set_config eklendi, ama:
--     - 2-arg promote_speaker_atomic (eski v41) güncellenmedi
--     - 2-arg ve 3-arg demote_speaker_atomic'e hiç eklenmedi
--   Client RoomService.promoteSpeaker 2-arg sürümü çağırıyor →
--   trigger UPDATE'i sessizce blokluyor → ahmed sahneye alındığında DB'de
--   hâlâ listener kalıyor → 4 saniye sonra fetchParticipants stale state'i
--   geri yüklüyor → kullanıcı sahneden iniyor görüyor.
--
-- Çözüm: 3 fonksiyonun da UPDATE'inden hemen önce set_config çağrısı.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1) promote_speaker_atomic (2-arg, eski v41) ──
CREATE OR REPLACE FUNCTION public.promote_speaker_atomic(p_room_id uuid, p_user_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_caller := app_uid();
  IF v_caller IS NULL THEN
    BEGIN
      v_caller := auth.jwt()->>'sub';
    EXCEPTION WHEN OTHERS THEN v_caller := NULL;
    END;
  END IF;
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Kimlik doğrulama gereklidir.';
  END IF;

  SELECT host_id, owner_tier INTO v_host_id, v_owner_tier
    FROM rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Oda bulunamadı.'; END IF;

  SELECT role INTO v_caller_role
    FROM room_participants
    WHERE room_id = p_room_id AND user_id = v_caller;
  IF v_host_id IS DISTINCT FROM v_caller AND v_caller_role NOT IN ('owner', 'moderator') THEN
    RAISE EXCEPTION 'Yetkiniz yok: promote için owner/moderator gereklidir.';
  END IF;

  SELECT role INTO v_target_role
    FROM room_participants
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

  -- ★ v85: Trigger bypass — set_config UPDATE'ten hemen önce
  PERFORM set_config('app.role_change_authorized', 'true', true);

  UPDATE room_participants
    SET role = CASE WHEN p_user_id = v_host_id THEN 'owner' ELSE 'speaker' END,
        is_muted = FALSE,
        last_seen_at = NOW()
    WHERE room_id = p_room_id AND user_id = p_user_id;

  RETURN json_build_object('ok', true, 'role', CASE WHEN p_user_id = v_host_id THEN 'owner' ELSE 'speaker' END);
END;
$function$;

-- ── 2) demote_speaker_atomic (2-arg) ──
CREATE OR REPLACE FUNCTION public.demote_speaker_atomic(p_room_id uuid, p_user_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller TEXT;
  v_host_id TEXT;
  v_caller_role TEXT;
  v_target_role TEXT;
BEGIN
  v_caller := app_uid();
  IF v_caller IS NULL THEN
    BEGIN v_caller := auth.jwt()->>'sub'; EXCEPTION WHEN OTHERS THEN v_caller := NULL; END;
  END IF;
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Kimlik doğrulama gereklidir.'; END IF;

  SELECT host_id INTO v_host_id FROM rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Oda bulunamadı.'; END IF;

  -- Kendini demote: her zaman serbest
  IF v_caller = p_user_id THEN
    PERFORM set_config('app.role_change_authorized', 'true', true);
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

  PERFORM set_config('app.role_change_authorized', 'true', true);

  UPDATE room_participants SET role = 'listener', is_muted = TRUE
    WHERE room_id = p_room_id AND user_id = p_user_id;

  RETURN json_build_object('ok', true);
END;
$function$;

-- ── 3) demote_speaker_atomic (3-arg, p_executor_id ile) ──
CREATE OR REPLACE FUNCTION public.demote_speaker_atomic(p_room_id uuid, p_user_id text, p_executor_id text DEFAULT NULL::text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller TEXT;
  v_host_id TEXT;
  v_caller_role TEXT;
  v_target_role TEXT;
BEGIN
  v_caller := app_uid();
  IF v_caller IS NULL THEN
    BEGIN v_caller := auth.jwt()->>'sub'; EXCEPTION WHEN OTHERS THEN v_caller := NULL; END;
  END IF;
  IF v_caller IS NULL THEN v_caller := p_executor_id; END IF;
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Kimlik doğrulama gereklidir.'; END IF;

  SELECT host_id INTO v_host_id FROM rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Oda bulunamadı.'; END IF;

  IF v_caller = p_user_id THEN
    PERFORM set_config('app.role_change_authorized', 'true', true);
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

  PERFORM set_config('app.role_change_authorized', 'true', true);

  UPDATE room_participants SET role = 'listener', is_muted = TRUE
    WHERE room_id = p_room_id AND user_id = p_user_id;

  RETURN json_build_object('ok', true);
END;
$function$;
