-- Restore the ownerless-room caretaker flow without weakening normal rooms:
-- 1) the first listener can claim a completely empty stage through claim_stage_seat;
-- 2) while no owner/moderator is present, an existing speaker acts as stage delegate
--    and may approve the normal hand-raise queue.
-- 3) the role guard recognizes explicitly authorized atomic RPC updates before it
--    resolves the application user, and remains safe with an empty search_path.

CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  v_caller text;
  v_authorized text;
  v_orig_host_id text;
BEGIN
  IF OLD.role IS NOT DISTINCT FROM NEW.role THEN
    RETURN NEW;
  END IF;

  -- SECURITY DEFINER RPCs and explicitly authorized atomic role changes.
  IF current_user IS DISTINCT FROM session_user THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_authorized := current_setting('app.role_change_authorized', true);
  EXCEPTION WHEN OTHERS THEN
    v_authorized := NULL;
  END;
  IF v_authorized = 'true' THEN
    RETURN NEW;
  END IF;

  v_caller := public.app_uid();
  IF v_caller IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_caller = OLD.user_id THEN
    IF (OLD.role IN ('listener', 'spectator') AND NEW.role = 'pending_speaker')
       OR (OLD.role = 'pending_speaker' AND NEW.role IN ('listener', 'spectator'))
       OR (OLD.role = 'speaker' AND NEW.role = 'listener')
       OR (OLD.role = 'moderator' AND NEW.role = 'speaker')
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Role değişikliği reddedildi.' USING ERRCODE = '42501';
  END IF;

  IF NEW.role = 'owner' THEN
    SELECT room_settings->>'original_host_id'
    INTO v_orig_host_id
    FROM public.rooms
    WHERE id = NEW.room_id;

    IF v_orig_host_id IS NOT NULL AND v_orig_host_id IS DISTINCT FROM NEW.user_id THEN
      RAISE EXCEPTION 'Owner role rejected: only original host can be owner.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.rooms AS r
    WHERE r.id = NEW.room_id AND r.host_id = v_caller
  ) OR EXISTS (
    SELECT 1
    FROM public.room_participants AS rp
    WHERE rp.room_id = NEW.room_id
      AND rp.user_id = v_caller
      AND rp.role IN ('owner', 'moderator')
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Role değişikliği reddedildi: yetki gerekir.'
    USING ERRCODE = '42501';
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_stage_seat(
  p_room_id uuid,
  p_user_id text,
  p_executor_id text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_caller text;
  v_authority_count integer;
  v_current_caretaker_count integer;
  v_max_caretakers constant integer := 5;
  v_stage_expires timestamptz;
  v_existing_role text;
  v_cooldown_until timestamptz;
BEGIN
  v_caller := public.app_uid();
  IF v_caller IS NULL THEN
    v_caller := p_executor_id;
  END IF;
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Kimlik doğrulama gereklidir.';
  END IF;
  IF v_caller IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Yetkisiz: sadece kendin için sahne talep edebilirsin.';
  END IF;

  -- Serialize every claim/promotion in the same room before counting capacity.
  PERFORM 1 FROM public.rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oda bulunamadı.';
  END IF;

  SELECT count(*) INTO v_authority_count
  FROM public.room_participants
  WHERE room_id = p_room_id AND role IN ('owner', 'moderator');
  IF v_authority_count > 0 THEN
    RAISE EXCEPTION 'Caretaker modu aktif değil (yetkili sahnede).';
  END IF;

  SELECT role, stage_expires_at
  INTO v_existing_role, v_cooldown_until
  FROM public.room_participants
  WHERE room_id = p_room_id AND user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Önce odaya katılmalısın.';
  END IF;
  IF v_existing_role = 'speaker' THEN
    RAISE EXCEPTION 'Zaten sahnedesin.';
  END IF;
  IF v_cooldown_until IS NOT NULL AND v_cooldown_until > now() THEN
    RAISE EXCEPTION 'Henüz cooldown süresinde, biraz bekle.';
  END IF;

  SELECT count(*) INTO v_current_caretaker_count
  FROM public.room_participants
  WHERE room_id = p_room_id
    AND role = 'speaker'
    AND stage_expires_at IS NOT NULL
    AND stage_expires_at > now();
  IF v_current_caretaker_count >= v_max_caretakers THEN
    RAISE EXCEPTION 'Sahne dolu (% caretaker slot).', v_max_caretakers;
  END IF;

  v_stage_expires := now() + interval '5 minutes';
  PERFORM set_config('app.role_change_authorized', 'true', true);
  UPDATE public.room_participants
  SET role = 'speaker',
      stage_expires_at = v_stage_expires,
      is_muted = FALSE,
      last_seen_at = now()
  WHERE room_id = p_room_id AND user_id = p_user_id;

  RETURN json_build_object(
    'ok', TRUE,
    'role', 'speaker',
    'expires_at', v_stage_expires,
    'duration_sec', 300
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_stage_seat(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_stage_seat(uuid, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.promote_speaker_atomic(
  p_room_id uuid,
  p_user_id text,
  p_executor_id text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_caller text;
  v_caller_role text;
  v_target_role text;
  v_authority_count integer;
  v_stage_count integer;
  v_is_stage_delegate boolean;
BEGIN
  v_caller := public.app_uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Kimlik doğrulama gereklidir.';
  END IF;

  -- Serialize capacity checks with caretaker claims and parallel approvals.
  PERFORM 1 FROM public.rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oda bulunamadı.';
  END IF;

  SELECT role INTO v_caller_role
  FROM public.room_participants
  WHERE room_id = p_room_id AND user_id = v_caller;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sahneye alma yetkisi için odada bulunmalısın.';
  END IF;

  SELECT count(*) INTO v_authority_count
  FROM public.room_participants
  WHERE room_id = p_room_id AND role IN ('owner', 'moderator');
  v_is_stage_delegate := v_caller_role = 'speaker' AND v_authority_count = 0;

  IF v_caller_role NOT IN ('owner', 'moderator') AND NOT v_is_stage_delegate THEN
    RAISE EXCEPTION 'Sahneye alma yetkisi yalnızca oda sahibi, moderatör veya sahipsiz odadaki sahne delegesindedir.';
  END IF;

  SELECT role INTO v_target_role
  FROM public.room_participants
  WHERE room_id = p_room_id AND user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hedef kullanıcı bu odada değil.';
  END IF;

  SELECT count(*) INTO v_stage_count
  FROM public.room_participants
  WHERE room_id = p_room_id AND role IN ('owner', 'moderator', 'speaker');
  IF v_stage_count >= 20 AND v_target_role NOT IN ('owner', 'moderator', 'speaker') THEN
    RAISE EXCEPTION 'Sahne dolu (max: 20).';
  END IF;

  PERFORM set_config('app.role_change_authorized', 'true', true);
  UPDATE public.room_participants
  SET role = 'speaker',
      is_muted = FALSE,
      stage_expires_at = NULL,
      last_seen_at = now()
  WHERE room_id = p_room_id AND user_id = p_user_id;

  RETURN json_build_object(
    'ok', TRUE,
    'role', 'speaker',
    'max', 20,
    'stage_delegate', v_is_stage_delegate
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.promote_speaker_atomic(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_speaker_atomic(uuid, text, text) TO anon, authenticated;
