-- v52: notifications.type CHECK constraint genişletme
--
-- Mevcut constraint sadece: like, comment, gift, follow, reward, follow_request,
-- follow_accepted, missed_call izin veriyor.
-- Kodda kullanılan diğer tipler (thank_you, room_*, incoming_call, follow_pending,
-- follow_rejected, event_reminder) INSERT'te sessizce başarısız oluyordu.
--
-- thank_you: SPReceivedModal'daki ücretsiz teşekkür butonları bu tip insert ediyor.
-- Constraint violation nedeniyle teşekkür gönderilemiyordu.

BEGIN;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (
    type = ANY (ARRAY[
      'like'::text,
      'comment'::text,
      'gift'::text,
      'thank_you'::text,
      'follow'::text,
      'reward'::text,
      'follow_request'::text,
      'follow_pending'::text,
      'follow_accepted'::text,
      'follow_rejected'::text,
      'missed_call'::text,
      'incoming_call'::text,
      'room_live'::text,
      'room_invite'::text,
      'room_invite_accepted'::text,
      'room_invite_rejected'::text,
      'room_access_request'::text,
      'event_reminder'::text
    ])
  );

COMMIT;
