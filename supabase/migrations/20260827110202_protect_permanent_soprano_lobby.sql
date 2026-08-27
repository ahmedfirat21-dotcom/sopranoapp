-- Keep the official Soprano Lobby available permanently.
-- The row guard blocks accidental cleanup/admin deletion and prevents close updates.

CREATE OR REPLACE FUNCTION public.protect_soprano_lobby()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN NULL;
  END IF;

  NEW.is_live := TRUE;
  NEW.is_persistent := TRUE;
  NEW.is_system_room := TRUE;
  NEW.is_official := TRUE;
  NEW.is_locked := FALSE;
  NEW.expires_at := NULL;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS aaa_protect_soprano_lobby ON public.rooms;
CREATE TRIGGER aaa_protect_soprano_lobby
BEFORE UPDATE OR DELETE ON public.rooms
FOR EACH ROW
WHEN (OLD.id = '10000000-0000-0000-0000-000000000001'::uuid)
EXECUTE FUNCTION public.protect_soprano_lobby();

INSERT INTO public.rooms (
  id, name, description, category, type, host_id, is_live, listener_count,
  max_speakers, expires_at, is_persistent, max_listeners, max_cameras,
  max_moderators, owner_tier, room_settings, language, mode, is_locked,
  max_spectators, is_system_room, ai_moderated, is_official
)
VALUES (
  '10000000-0000-0000-0000-000000000001'::uuid,
  'Soprano Lobi',
  'Müzik dinle, tanış, konuş',
  'music', 'open', NULL, TRUE, 0, 12, NULL, TRUE, 999, 0, 12,
  'Pro',
  '{"auto_mute_on_join":true,"allow_hand_raise":true,"speaking_mode":"permission_only"}'::jsonb,
  'tr', 'audio', FALSE, 999, TRUE, TRUE, TRUE
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    type = 'open',
    is_live = TRUE,
    expires_at = NULL,
    is_persistent = TRUE,
    is_locked = FALSE,
    is_system_room = TRUE,
    ai_moderated = TRUE,
    is_official = TRUE,
    room_settings = COALESCE(public.rooms.room_settings, '{}'::jsonb)
      || EXCLUDED.room_settings;
