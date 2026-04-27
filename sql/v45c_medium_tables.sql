-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v45c — Orta karmaşıklık tablo RLS migrate
--
-- 8 tablo, ~21 policy. Pattern: (auth.uid())::text → app_uid()
-- ════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── friendships ──────────────────────────────────────────
DROP POLICY IF EXISTS "Users can create friendships" ON public.friendships;
CREATE POLICY "Users can create friendships" ON public.friendships FOR INSERT
  WITH CHECK (app_uid() = user_id);

DROP POLICY IF EXISTS "Users can delete friendships" ON public.friendships;
CREATE POLICY "Users can delete friendships" ON public.friendships FOR DELETE
  USING ((app_uid() = user_id) OR (app_uid() = friend_id));

DROP POLICY IF EXISTS "Users can update friendships" ON public.friendships;
CREATE POLICY "Users can update friendships" ON public.friendships FOR UPDATE
  USING ((app_uid() = user_id) OR (app_uid() = friend_id));

-- ─── messages ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can delete own messages" ON public.messages;
CREATE POLICY "Users can delete own messages" ON public.messages FOR DELETE
  USING (app_uid() = sender_id);

DROP POLICY IF EXISTS "Users can read own messages" ON public.messages;
CREATE POLICY "Users can read own messages" ON public.messages FOR SELECT
  USING ((app_uid() = sender_id) OR (app_uid() = receiver_id) OR (room_id IS NOT NULL));

DROP POLICY IF EXISTS "Users can update own messages" ON public.messages;
CREATE POLICY "Users can update own messages" ON public.messages FOR UPDATE
  USING (app_uid() = sender_id);

DROP POLICY IF EXISTS "messages_insert_guarded_v31" ON public.messages;
CREATE POLICY "messages_insert_guarded_v31" ON public.messages FOR INSERT
  WITH CHECK (
    (app_uid() = sender_id) AND (
      ((room_id IS NULL) AND (receiver_id IS NOT NULL))
      OR ((room_id IS NOT NULL) AND (EXISTS (
        SELECT 1 FROM room_participants rp
        WHERE rp.room_id = messages.room_id
          AND rp.user_id = app_uid()
          AND COALESCE(rp.is_chat_muted, false) = false
      )))
    )
  );

-- ─── post_likes ───────────────────────────────────────────
DROP POLICY IF EXISTS "Users can like posts" ON public.post_likes;
CREATE POLICY "Users can like posts" ON public.post_likes FOR INSERT
  WITH CHECK (app_uid() = user_id);

DROP POLICY IF EXISTS "Users can unlike posts" ON public.post_likes;
CREATE POLICY "Users can unlike posts" ON public.post_likes FOR DELETE
  USING (app_uid() = user_id);

-- ─── posts ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can create posts" ON public.posts;
CREATE POLICY "Users can create posts" ON public.posts FOR INSERT
  WITH CHECK (app_uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own posts" ON public.posts;
CREATE POLICY "Users can delete own posts" ON public.posts FOR DELETE
  USING (app_uid() = user_id);

-- ─── profiles ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
CREATE POLICY "Users can delete own profile" ON public.profiles FOR DELETE
  USING (app_uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT
  WITH CHECK (app_uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE
  USING (app_uid() = id);

-- ─── reports ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can read reports" ON public.reports;
CREATE POLICY "Admins can read reports" ON public.reports FOR SELECT
  USING (
    (app_uid() = reporter_id)
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = app_uid() AND profiles.is_admin = true)
  );

DROP POLICY IF EXISTS "Admins can update reports" ON public.reports;
CREATE POLICY "Admins can update reports" ON public.reports FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = app_uid() AND profiles.is_admin = true));

DROP POLICY IF EXISTS "Users can create reports" ON public.reports;
CREATE POLICY "Users can create reports" ON public.reports FOR INSERT
  WITH CHECK (app_uid() = reporter_id);

-- ─── sp_packages ──────────────────────────────────────────
DROP POLICY IF EXISTS "sp_packages_admin_write" ON public.sp_packages;
CREATE POLICY "sp_packages_admin_write" ON public.sp_packages FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = app_uid() AND profiles.is_admin = true));

-- ─── voice_messages ───────────────────────────────────────
DROP POLICY IF EXISTS "voice_msg_listen_update" ON public.voice_messages;
CREATE POLICY "voice_msg_listen_update" ON public.voice_messages FOR UPDATE
  USING (app_uid() = receiver_id);

DROP POLICY IF EXISTS "voice_msg_participants_read" ON public.voice_messages;
CREATE POLICY "voice_msg_participants_read" ON public.voice_messages FOR SELECT
  USING ((app_uid() = sender_id) OR (app_uid() = receiver_id));

DROP POLICY IF EXISTS "voice_msg_self_send" ON public.voice_messages;
CREATE POLICY "voice_msg_self_send" ON public.voice_messages FOR INSERT
  WITH CHECK (app_uid() = sender_id);

COMMIT;
