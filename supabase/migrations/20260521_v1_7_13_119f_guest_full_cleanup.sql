-- ============================================================
-- v1.7.13.119f (21 May 2026) — Misafir DB altyapısını TAM askıya al
-- Eski test sessionlardan kalan is_guest=true satırlar gerçek user'lara
-- RESTRICTIVE policy uyguluyordu. Tüm policy'leri DROP + satırları is_guest=false yap.
-- ============================================================

BEGIN;

-- 1. Eski misafir satırlarını is_guest=false yap (DELETE değil, çünkü room_participants vs. FK'ları var)
UPDATE profiles SET is_guest = false WHERE is_guest = true;

-- 2. RESTRICTIVE policy'leri DROP
DROP POLICY IF EXISTS no_guest_write_rooms ON rooms;
DROP POLICY IF EXISTS no_guest_write_messages ON messages;
DROP POLICY IF EXISTS no_guest_write_message_reactions ON message_reactions;
DROP POLICY IF EXISTS no_guest_write_message_requests ON message_requests;
DROP POLICY IF EXISTS no_guest_write_follows ON follows;
DROP POLICY IF EXISTS no_guest_write_friendships ON friendships;
DROP POLICY IF EXISTS no_guest_write_room_follows ON room_follows;
DROP POLICY IF EXISTS no_guest_write_room_followers ON room_followers;
DROP POLICY IF EXISTS no_guest_write_room_access_requests ON room_access_requests;
DROP POLICY IF EXISTS no_guest_write_room_invites ON room_invites;
DROP POLICY IF EXISTS no_guest_write_room_recordings ON room_recordings;
DROP POLICY IF EXISTS no_guest_write_room_live_gifts ON room_live_gifts;
DROP POLICY IF EXISTS no_guest_write_sp_transactions ON sp_transactions;
DROP POLICY IF EXISTS no_guest_write_coin_transactions ON coin_transactions;
DROP POLICY IF EXISTS no_guest_write_diamond_transactions ON diamond_transactions;
DROP POLICY IF EXISTS no_guest_write_event_rsvps ON event_rsvps;
DROP POLICY IF EXISTS no_guest_write_cashout_requests ON cashout_requests;
DROP POLICY IF EXISTS no_guest_write_club_members ON club_members;
DROP POLICY IF EXISTS no_guest_write_broadcast_join_requests ON broadcast_join_requests;
DROP POLICY IF EXISTS no_guest_write_blocked_users ON blocked_users;
DROP POLICY IF EXISTS guest_participants_listener_only ON room_participants;
DROP POLICY IF EXISTS guest_participants_no_self_update ON room_participants;
DROP POLICY IF EXISTS guest_participants_listener_only_update ON room_participants;
DROP POLICY IF EXISTS no_guest_update_profile ON profiles;

-- 3. Cron job'ı durdur
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-guests') THEN
    PERFORM cron.unschedule('cleanup-expired-guests');
  END IF;
END $$;

-- 4. RPC'ler kalsın ama harmless (kimse çağırmıyor zaten)
-- is_guest_user(), upsert_guest_profile(), delete_my_guest_profile(), cleanup_expired_guests()

-- 5. is_guest kolonu kalsın (default false, kimse true yapmayacak çünkü RPC çağırılmıyor)

COMMIT;
