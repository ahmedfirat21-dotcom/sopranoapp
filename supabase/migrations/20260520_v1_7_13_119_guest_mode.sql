-- ============================================================
-- v1.7.13.119 — Misafir (Guest) modu sertleştirme
-- Firebase anonymous user → gerçek profiles satırı (is_guest=true)
-- Misafir SADECE odaya dinleyici olarak girebilir; chat/gift/follow/DM/oda-aç YASAK
-- 15 dakika sonra cron ile temizlenir (10dk limit + 5dk buffer)
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. profiles.is_guest kolonu
-- ────────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_guest BOOLEAN DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_is_guest
  ON profiles (created_at)
  WHERE is_guest = true;

-- ────────────────────────────────────────────────────────────
-- 2. Helper: çağıran kullanıcı misafir mi?
--    STABLE + SECURITY DEFINER → RLS bypass + cached per-statement
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_guest_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_guest FROM profiles WHERE id = app_uid() LIMIT 1),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_guest_user() TO anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- 3. Cleanup: 15dk geçmiş guest profilleri ve bağımlı row'ları sil
--    SECURITY DEFINER → triggers FK CASCADE ile room_participants vs.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_expired_guests()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH del AS (
    DELETE FROM profiles
    WHERE is_guest = true
      AND created_at < (now() - interval '15 minutes')
    RETURNING id
  )
  SELECT count(*) INTO deleted_count FROM del;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_guests() TO service_role;

-- Cron job — her 5 dakikada bir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-guests') THEN
    PERFORM cron.unschedule('cleanup-expired-guests');
  END IF;
  PERFORM cron.schedule(
    'cleanup-expired-guests',
    '*/5 * * * *',
    $cron$ SELECT public.cleanup_expired_guests(); $cron$
  );
END $$;

-- ────────────────────────────────────────────────────────────
-- 4. SECURITY DEFINER RPC — guest profile satırını oluştur
--    Client signInAnonymously sonrası bu RPC'yi çağırır.
--    is_guest=true mühürlü; client doğrudan profiles INSERT yapsa
--    bile is_guest=false default'unu yiyemez (UPDATE de RESTRICTIVE policy ile blok)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_guest_profile()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  short_id text;
BEGIN
  uid := app_uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Misafir profili için kimlik yok';
  END IF;
  -- UID'nin son 4 hex karakteri
  short_id := upper(substr(replace(uid::text, '-', ''), -4));

  INSERT INTO profiles (
    id,
    display_name,
    avatar_url,
    bio,
    subscription_tier,
    system_points,
    is_online,
    interests,
    preferences,
    is_guest,
    created_at,
    updated_at
  )
  VALUES (
    uid,
    'Misafir-' || short_id,
    NULL,
    NULL,
    'Free',
    0,
    true,
    '{}',
    jsonb_build_object('onboarding_completed', true),
    true,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    updated_at = now(),
    is_online  = true
  WHERE profiles.is_guest = true; -- güvenlik: gerçek hesap üstüne yazma

  RETURN uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_guest_profile() TO authenticated, anon;

-- ────────────────────────────────────────────────────────────
-- 5. RESTRICTIVE policies — misafir yazma engelleri
--    Mevcut PERMISSIVE policies değişmez; tek RESTRICTIVE policy ekleyerek AND koşulu ekliyoruz.
--    Misafirin yapamadığı: oda aç, chat gönder, mesaj reaksiyonu, mesaj okundu işaretle,
--    arkadaş ekle, friendship, oda takip et, oda erişim isteği, oda davet, sembol/SP hediye,
--    SP transaction, event RSVP, cashout, club üyelik.
-- ────────────────────────────────────────────────────────────

-- rooms (oda oluşturma)
DROP POLICY IF EXISTS no_guest_write_rooms ON rooms;
CREATE POLICY no_guest_write_rooms ON rooms
  AS RESTRICTIVE
  FOR ALL TO public
  USING (NOT is_guest_user())
  WITH CHECK (NOT is_guest_user());

-- messages (DM + oda chat + reaksiyon + okundu)
DROP POLICY IF EXISTS no_guest_write_messages ON messages;
CREATE POLICY no_guest_write_messages ON messages
  AS RESTRICTIVE
  FOR ALL TO public
  USING (NOT is_guest_user())
  WITH CHECK (NOT is_guest_user());

DROP POLICY IF EXISTS no_guest_write_message_reactions ON message_reactions;
CREATE POLICY no_guest_write_message_reactions ON message_reactions
  AS RESTRICTIVE
  FOR ALL TO public
  USING (NOT is_guest_user())
  WITH CHECK (NOT is_guest_user());

DROP POLICY IF EXISTS no_guest_write_message_requests ON message_requests;
CREATE POLICY no_guest_write_message_requests ON message_requests
  AS RESTRICTIVE
  FOR ALL TO public
  USING (NOT is_guest_user())
  WITH CHECK (NOT is_guest_user());

-- follows / friendships
DROP POLICY IF EXISTS no_guest_write_follows ON follows;
CREATE POLICY no_guest_write_follows ON follows
  AS RESTRICTIVE
  FOR ALL TO public
  USING (NOT is_guest_user())
  WITH CHECK (NOT is_guest_user());

DROP POLICY IF EXISTS no_guest_write_friendships ON friendships;
CREATE POLICY no_guest_write_friendships ON friendships
  AS RESTRICTIVE
  FOR ALL TO public
  USING (NOT is_guest_user())
  WITH CHECK (NOT is_guest_user());

-- room follow + access + invites
DROP POLICY IF EXISTS no_guest_write_room_follows ON room_follows;
CREATE POLICY no_guest_write_room_follows ON room_follows
  AS RESTRICTIVE
  FOR ALL TO public
  USING (NOT is_guest_user())
  WITH CHECK (NOT is_guest_user());

DROP POLICY IF EXISTS no_guest_write_room_followers ON room_followers;
CREATE POLICY no_guest_write_room_followers ON room_followers
  AS RESTRICTIVE
  FOR ALL TO public
  USING (NOT is_guest_user())
  WITH CHECK (NOT is_guest_user());

DROP POLICY IF EXISTS no_guest_write_room_access_requests ON room_access_requests;
CREATE POLICY no_guest_write_room_access_requests ON room_access_requests
  AS RESTRICTIVE
  FOR ALL TO public
  USING (NOT is_guest_user())
  WITH CHECK (NOT is_guest_user());

DROP POLICY IF EXISTS no_guest_write_room_invites ON room_invites;
CREATE POLICY no_guest_write_room_invites ON room_invites
  AS RESTRICTIVE
  FOR ALL TO public
  USING (NOT is_guest_user())
  WITH CHECK (NOT is_guest_user());

-- room_recordings + room_live_gifts
DROP POLICY IF EXISTS no_guest_write_room_recordings ON room_recordings;
CREATE POLICY no_guest_write_room_recordings ON room_recordings
  AS RESTRICTIVE
  FOR ALL TO public
  USING (NOT is_guest_user())
  WITH CHECK (NOT is_guest_user());

DROP POLICY IF EXISTS no_guest_write_room_live_gifts ON room_live_gifts;
CREATE POLICY no_guest_write_room_live_gifts ON room_live_gifts
  AS RESTRICTIVE
  FOR ALL TO public
  USING (NOT is_guest_user())
  WITH CHECK (NOT is_guest_user());

-- SP / coin / diamond transactions (direkt INSERT)
DROP POLICY IF EXISTS no_guest_write_sp_transactions ON sp_transactions;
CREATE POLICY no_guest_write_sp_transactions ON sp_transactions
  AS RESTRICTIVE
  FOR ALL TO public
  USING (NOT is_guest_user())
  WITH CHECK (NOT is_guest_user());

DROP POLICY IF EXISTS no_guest_write_coin_transactions ON coin_transactions;
CREATE POLICY no_guest_write_coin_transactions ON coin_transactions
  AS RESTRICTIVE
  FOR ALL TO public
  USING (NOT is_guest_user())
  WITH CHECK (NOT is_guest_user());

DROP POLICY IF EXISTS no_guest_write_diamond_transactions ON diamond_transactions;
CREATE POLICY no_guest_write_diamond_transactions ON diamond_transactions
  AS RESTRICTIVE
  FOR ALL TO public
  USING (NOT is_guest_user())
  WITH CHECK (NOT is_guest_user());

-- event RSVP + cashout + club üyelik + broadcast join
DROP POLICY IF EXISTS no_guest_write_event_rsvps ON event_rsvps;
CREATE POLICY no_guest_write_event_rsvps ON event_rsvps
  AS RESTRICTIVE
  FOR ALL TO public
  USING (NOT is_guest_user())
  WITH CHECK (NOT is_guest_user());

DROP POLICY IF EXISTS no_guest_write_cashout_requests ON cashout_requests;
CREATE POLICY no_guest_write_cashout_requests ON cashout_requests
  AS RESTRICTIVE
  FOR ALL TO public
  USING (NOT is_guest_user())
  WITH CHECK (NOT is_guest_user());

DROP POLICY IF EXISTS no_guest_write_club_members ON club_members;
CREATE POLICY no_guest_write_club_members ON club_members
  AS RESTRICTIVE
  FOR ALL TO public
  USING (NOT is_guest_user())
  WITH CHECK (NOT is_guest_user());

DROP POLICY IF EXISTS no_guest_write_broadcast_join_requests ON broadcast_join_requests;
CREATE POLICY no_guest_write_broadcast_join_requests ON broadcast_join_requests
  AS RESTRICTIVE
  FOR ALL TO public
  USING (NOT is_guest_user())
  WITH CHECK (NOT is_guest_user());

-- blocked_users — misafir engelleyemez
DROP POLICY IF EXISTS no_guest_write_blocked_users ON blocked_users;
CREATE POLICY no_guest_write_blocked_users ON blocked_users
  AS RESTRICTIVE
  FOR ALL TO public
  USING (NOT is_guest_user())
  WITH CHECK (NOT is_guest_user());

-- ────────────────────────────────────────────────────────────
-- 6. room_participants — misafir SADECE listener/spectator olabilir
--    Mevcut participants_insert_guarded_v37 zaten listener/spectator/pending_speaker/guest
--    rollerine izin veriyor. Burada misafiri SADECE 'listener' veya 'spectator' rolüne kısıtla.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS guest_participants_listener_only ON room_participants;
CREATE POLICY guest_participants_listener_only ON room_participants
  AS RESTRICTIVE
  FOR INSERT TO public
  WITH CHECK (
    NOT is_guest_user()
    OR role IN ('listener', 'spectator')
  );

-- Misafir kendi participant row'unu UPDATE edemez (rol yükseltme attack koruması)
DROP POLICY IF EXISTS guest_participants_no_self_update ON room_participants;
CREATE POLICY guest_participants_no_self_update ON room_participants
  AS RESTRICTIVE
  FOR UPDATE TO public
  USING (NOT is_guest_user())
  WITH CHECK (NOT is_guest_user());

-- ────────────────────────────────────────────────────────────
-- 7. profiles UPDATE — misafir kendi profilini DEĞİŞTİREMEZ
--    is_guest=true olan satırlara client UPDATE yasak (sadece SECURITY DEFINER RPC ile)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS no_guest_update_profile ON profiles;
CREATE POLICY no_guest_update_profile ON profiles
  AS RESTRICTIVE
  FOR UPDATE TO public
  USING (NOT is_guest_user())
  WITH CHECK (NOT is_guest_user());

-- ────────────────────────────────────────────────────────────
-- 8. Logout cleanup RPC — kullanıcı tarafından çağrılabilir (kendi guest row'unu siler)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_my_guest_profile()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := app_uid();
BEGIN
  IF uid IS NULL THEN
    RETURN false;
  END IF;
  DELETE FROM profiles WHERE id = uid AND is_guest = true;
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_my_guest_profile() TO authenticated, anon;

COMMIT;

-- ============================================================
-- ROLLBACK (gerekirse):
-- BEGIN;
-- DROP POLICY IF EXISTS guest_participants_listener_only ON room_participants;
-- DROP POLICY IF EXISTS guest_participants_no_self_update ON room_participants;
-- DROP POLICY IF EXISTS no_guest_update_profile ON profiles;
-- -- ... all no_guest_write_* policies
-- SELECT cron.unschedule('cleanup-expired-guests');
-- DROP FUNCTION IF EXISTS public.cleanup_expired_guests();
-- DROP FUNCTION IF EXISTS public.upsert_guest_profile();
-- DROP FUNCTION IF EXISTS public.delete_my_guest_profile();
-- DROP FUNCTION IF EXISTS public.is_guest_user();
-- ALTER TABLE profiles DROP COLUMN IF EXISTS is_guest;
-- COMMIT;
-- ============================================================
