-- ════════════════════════════════════════════════════════════
-- v107 hotfix (4 May 2026): notifications.type CHECK constraint'ine
-- 'symbol_gift' eklendi.
-- ════════════════════════════════════════════════════════════
-- send_symbol_gift RPC notifications tablosuna type='symbol_gift' insert ediyor
-- ama eski constraint bu tipi tanımıyordu → "Gönderilemedi" hatası.
-- Bu migration constraint'i drop edip 'symbol_gift' dahil yeniden create eder.
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
CHECK (type = ANY (ARRAY[
  'like'::text, 'comment'::text, 'gift'::text, 'symbol_gift'::text,
  'thank_you'::text, 'follow'::text, 'reward'::text,
  'follow_request'::text, 'follow_pending'::text, 'follow_accepted'::text, 'follow_rejected'::text,
  'missed_call'::text, 'incoming_call'::text,
  'room_live'::text, 'room_invite'::text, 'room_invite_accepted'::text, 'room_invite_rejected'::text,
  'room_access_request'::text,
  'event_reminder'::text, 'gold_invite'::text
]));
