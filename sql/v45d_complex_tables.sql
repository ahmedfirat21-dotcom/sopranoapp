-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v45d — Kompleks oda yönetim RLS migrate
--
-- Son batch. Tüm kalan auth.uid()::text → app_uid() çevriliyor.
-- room_bans'in v44 çift OR pattern'i (auth.jwt + auth.uid) tek app_uid()'e
-- sadeleşiyor (app_uid zaten ikisini COALESCE ile bekliyor).
-- ════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── daily_checkins ───────────────────────────────────────
DROP POLICY IF EXISTS "Users can read own checkins" ON public.daily_checkins;
CREATE POLICY "Users can read own checkins" ON public.daily_checkins FOR SELECT
  USING (app_uid() = user_id);

DROP POLICY IF EXISTS "Users can update own checkins" ON public.daily_checkins;
CREATE POLICY "Users can update own checkins" ON public.daily_checkins FOR UPDATE
  USING (app_uid() = user_id);

-- ─── diamond_transactions ─────────────────────────────────
DROP POLICY IF EXISTS "dt_select" ON public.diamond_transactions;
CREATE POLICY "dt_select" ON public.diamond_transactions FOR SELECT
  USING (user_id = app_uid());

-- ─── room_access_requests ─────────────────────────────────
DROP POLICY IF EXISTS "Access requests insertable" ON public.room_access_requests;
CREATE POLICY "Access requests insertable" ON public.room_access_requests FOR INSERT
  WITH CHECK (app_uid() = user_id);

DROP POLICY IF EXISTS "Access requests readable" ON public.room_access_requests;
CREATE POLICY "Access requests readable" ON public.room_access_requests FOR SELECT
  USING (
    (app_uid() = user_id)
    OR EXISTS (SELECT 1 FROM rooms WHERE rooms.id = room_access_requests.room_id AND rooms.host_id = app_uid())
  );

DROP POLICY IF EXISTS "Access requests updatable" ON public.room_access_requests;
CREATE POLICY "Access requests updatable" ON public.room_access_requests FOR UPDATE
  USING (EXISTS (SELECT 1 FROM rooms WHERE rooms.id = room_access_requests.room_id AND rooms.host_id = app_uid()));

-- ─── room_bans ────────────────────────────────────────────
DROP POLICY IF EXISTS "Room bans insertable" ON public.room_bans;
CREATE POLICY "Room bans insertable" ON public.room_bans FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM room_participants rp
      WHERE rp.room_id = room_bans.room_id
        AND rp.user_id = app_uid()
        AND rp.role = ANY (ARRAY['owner'::text, 'moderator'::text]))
    OR EXISTS (SELECT 1 FROM rooms WHERE rooms.id = room_bans.room_id AND rooms.host_id = app_uid())
  );

DROP POLICY IF EXISTS "Room owner can remove bans" ON public.room_bans;
CREATE POLICY "Room owner can remove bans" ON public.room_bans FOR DELETE
  USING (EXISTS (SELECT 1 FROM rooms WHERE rooms.id = room_bans.room_id AND rooms.host_id = app_uid()));

-- v44 çift OR pattern (auth.uid + auth.jwt) sadeleşiyor — app_uid() ikisini de kapsıyor
DROP POLICY IF EXISTS "bans_delete_mod_only" ON public.room_bans;
CREATE POLICY "bans_delete_mod_only" ON public.room_bans FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM rooms r WHERE r.id = room_bans.room_id AND r.host_id = app_uid())
    OR EXISTS (SELECT 1 FROM room_participants rp
      WHERE rp.room_id = room_bans.room_id
        AND rp.user_id = app_uid()
        AND rp.role = ANY (ARRAY['owner'::text, 'moderator'::text]))
  );

DROP POLICY IF EXISTS "bans_insert_mod_only" ON public.room_bans;
CREATE POLICY "bans_insert_mod_only" ON public.room_bans FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM rooms r WHERE r.id = room_bans.room_id AND r.host_id = app_uid())
    OR EXISTS (SELECT 1 FROM room_participants rp
      WHERE rp.room_id = room_bans.room_id
        AND rp.user_id = app_uid()
        AND rp.role = ANY (ARRAY['owner'::text, 'moderator'::text]))
  );

DROP POLICY IF EXISTS "bans_update_mod_only" ON public.room_bans;
CREATE POLICY "bans_update_mod_only" ON public.room_bans FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM rooms r WHERE r.id = room_bans.room_id AND r.host_id = app_uid())
    OR EXISTS (SELECT 1 FROM room_participants rp
      WHERE rp.room_id = room_bans.room_id
        AND rp.user_id = app_uid()
        AND rp.role = ANY (ARRAY['owner'::text, 'moderator'::text]))
  );

-- ─── room_music_queue ─────────────────────────────────────
DROP POLICY IF EXISTS "room_music_delete" ON public.room_music_queue;
CREATE POLICY "room_music_delete" ON public.room_music_queue FOR DELETE
  USING (
    (app_uid() = added_by)
    OR (app_uid() = (SELECT rooms.host_id FROM rooms WHERE rooms.id = room_music_queue.room_id))
  );

DROP POLICY IF EXISTS "room_music_insert" ON public.room_music_queue;
CREATE POLICY "room_music_insert" ON public.room_music_queue FOR INSERT
  WITH CHECK (app_uid() = added_by);

-- ─── room_mutes ───────────────────────────────────────────
DROP POLICY IF EXISTS "Mods can create mutes" ON public.room_mutes;
CREATE POLICY "Mods can create mutes" ON public.room_mutes FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM room_participants rp
      WHERE rp.room_id = room_mutes.room_id
        AND rp.user_id = app_uid()
        AND rp.role = ANY (ARRAY['owner'::text, 'moderator'::text]))
    OR EXISTS (SELECT 1 FROM rooms WHERE rooms.id = room_mutes.room_id AND rooms.host_id = app_uid())
  );

DROP POLICY IF EXISTS "Mods can delete mutes" ON public.room_mutes;
CREATE POLICY "Mods can delete mutes" ON public.room_mutes FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM room_participants rp
      WHERE rp.room_id = room_mutes.room_id
        AND rp.user_id = app_uid()
        AND rp.role = ANY (ARRAY['owner'::text, 'moderator'::text]))
    OR EXISTS (SELECT 1 FROM rooms WHERE rooms.id = room_mutes.room_id AND rooms.host_id = app_uid())
  );

-- ─── room_participants ────────────────────────────────────
DROP POLICY IF EXISTS "Participants can be updated" ON public.room_participants;
CREATE POLICY "Participants can be updated" ON public.room_participants FOR UPDATE
  USING (
    (app_uid() = user_id)
    OR EXISTS (SELECT 1 FROM rooms WHERE rooms.id = room_participants.room_id AND rooms.host_id = app_uid())
    OR EXISTS (SELECT 1 FROM room_participants rp2
      WHERE rp2.room_id = room_participants.room_id
        AND rp2.user_id = app_uid()
        AND rp2.role = ANY (ARRAY['owner'::text, 'moderator'::text]))
  );

DROP POLICY IF EXISTS "Participants can leave or be removed" ON public.room_participants;
CREATE POLICY "Participants can leave or be removed" ON public.room_participants FOR DELETE
  USING (
    (app_uid() = user_id)
    OR EXISTS (SELECT 1 FROM rooms WHERE rooms.id = room_participants.room_id AND rooms.host_id = app_uid())
    OR EXISTS (SELECT 1 FROM room_participants rp2
      WHERE rp2.room_id = room_participants.room_id
        AND rp2.user_id = app_uid()
        AND rp2.role = ANY (ARRAY['owner'::text, 'moderator'::text]))
  );

DROP POLICY IF EXISTS "participants_insert_guarded_v37" ON public.room_participants;
CREATE POLICY "participants_insert_guarded_v37" ON public.room_participants FOR INSERT
  WITH CHECK (
    (app_uid() = user_id)
    AND (
      role = ANY (ARRAY['listener'::text, 'spectator'::text, 'pending_speaker'::text, 'guest'::text])
      OR (role = 'owner'::text AND EXISTS (
        SELECT 1 FROM rooms r WHERE r.id = room_participants.room_id AND r.host_id = app_uid()
      ))
    )
    AND NOT EXISTS (
      SELECT 1 FROM room_bans b
      WHERE b.room_id = room_participants.room_id
        AND b.user_id = room_participants.user_id
        AND (b.expires_at IS NULL OR b.expires_at > now())
    )
    AND (
      NOT EXISTS (
        SELECT 1 FROM rooms r
        WHERE r.id = room_participants.room_id
          AND COALESCE((r.room_settings ->> 'followers_only')::boolean, false) = true
          AND r.host_id <> app_uid()
      )
      OR EXISTS (
        SELECT 1 FROM rooms r
        JOIN friendships f ON (
          (f.user_id = app_uid() AND f.friend_id = r.host_id)
          OR (f.user_id = r.host_id AND f.friend_id = app_uid())
        )
        WHERE r.id = room_participants.room_id AND f.status = 'accepted'
      )
    )
  );

-- ─── rooms ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can create rooms" ON public.rooms;
CREATE POLICY "Authenticated users can create rooms" ON public.rooms FOR INSERT
  WITH CHECK (app_uid() = host_id);

DROP POLICY IF EXISTS "Room owner can delete room" ON public.rooms;
CREATE POLICY "Room owner can delete room" ON public.rooms FOR DELETE
  USING (app_uid() = host_id);

DROP POLICY IF EXISTS "Room owner can update room" ON public.rooms;
CREATE POLICY "Room owner can update room" ON public.rooms FOR UPDATE
  USING (app_uid() = host_id);

COMMIT;
