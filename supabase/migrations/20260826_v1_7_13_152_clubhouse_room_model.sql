-- SopranoChat 1.7.13.152
-- Core room permissions follow a Clubhouse-style model:
-- every listener raises a hand, only owner/moderators promote, and paid tiers do
-- not buy speaking priority, extra stage time, or larger moderation authority.

UPDATE public.rooms
SET max_speakers = 20,
    max_listeners = 999,
    max_moderators = 20,
    expires_at = NULL,
    is_persistent = FALSE,
    room_settings = jsonb_set(
      COALESCE(room_settings, '{}'::jsonb),
      '{speaking_mode}',
      to_jsonb((CASE WHEN COALESCE(room_settings->>'speaking_mode', 'permission_only') = 'free_for_all'
                    THEN 'permission_only'
                    ELSE COALESCE(room_settings->>'speaking_mode', 'permission_only') END)::text),
      TRUE
    )
WHERE is_live = TRUE;

UPDATE public.room_participants SET stage_expires_at = NULL WHERE stage_expires_at IS NOT NULL;

DO $block$
BEGIN
  IF to_regclass('public.room_stage_cooldowns') IS NOT NULL THEN
    EXECUTE 'TRUNCATE TABLE public.room_stage_cooldowns';
  END IF;
END
$block$;

CREATE OR REPLACE FUNCTION public.enforce_room_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_count integer;
BEGIN
  IF NEW.role = 'listener' THEN
    SELECT count(*) INTO v_count
    FROM public.room_participants
    WHERE room_id = NEW.room_id AND role = 'listener' AND id IS DISTINCT FROM NEW.id;
    IF v_count >= 999 THEN RAISE EXCEPTION 'Oda dinleyici kapasitesi dolu.'; END IF;
  ELSIF NEW.role IN ('owner', 'moderator', 'speaker') THEN
    SELECT count(*) INTO v_count
    FROM public.room_participants
    WHERE room_id = NEW.room_id AND role IN ('owner', 'moderator', 'speaker')
      AND id IS DISTINCT FROM NEW.id;
    IF v_count >= 20 AND NEW.role <> 'owner' THEN RAISE EXCEPTION 'Sahne dolu (max: 20).'; END IF;
  END IF;
  RETURN NEW;
END
$func$;

DROP TRIGGER IF EXISTS trg_enforce_room_capacity ON public.room_participants;
CREATE TRIGGER trg_enforce_room_capacity
BEFORE INSERT OR UPDATE OF role ON public.room_participants
FOR EACH ROW EXECUTE FUNCTION public.enforce_room_capacity();

REVOKE ALL ON FUNCTION public.enforce_room_capacity() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.promote_speaker_atomic(
  p_room_id uuid,
  p_user_id text,
  p_executor_id text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_caller text;
  v_caller_role text;
  v_target_role text;
  v_count integer;
BEGIN
  v_caller := public.app_uid()::text;
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Kimlik doğrulama gereklidir.'; END IF;

  SELECT role INTO v_caller_role
  FROM public.room_participants
  WHERE room_id = p_room_id AND user_id = v_caller;
  IF v_caller_role NOT IN ('owner', 'moderator') THEN
    RAISE EXCEPTION 'Sahneye alma yetkisi yalnızca oda sahibi ve moderatörlerdedir.';
  END IF;

  SELECT role INTO v_target_role
  FROM public.room_participants
  WHERE room_id = p_room_id AND user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Hedef kullanıcı bu odada değil.'; END IF;

  SELECT count(*) INTO v_count
  FROM public.room_participants
  WHERE room_id = p_room_id AND role IN ('owner', 'moderator', 'speaker');
  IF v_count >= 20 AND v_target_role NOT IN ('owner', 'moderator', 'speaker') THEN
    RAISE EXCEPTION 'Sahne dolu (max: 20).';
  END IF;

  PERFORM set_config('app.role_change_authorized', 'true', true);
  UPDATE public.room_participants
  SET role = 'speaker', is_muted = FALSE, stage_expires_at = NULL, last_seen_at = now()
  WHERE room_id = p_room_id AND user_id = p_user_id;

  RETURN json_build_object('ok', TRUE, 'role', 'speaker', 'max', 20);
END
$func$;

REVOKE ALL ON FUNCTION public.promote_speaker_atomic(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_speaker_atomic(uuid, text, text) TO anon, authenticated;
