-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v6.1 — RLS Hotfix (tüm policy adları temizlenmiş)
--
-- Supabase anon key + Firebase UID → auth.uid() NULL döner.
-- Tüm v6 politikalarını geri alır (USING(true)).
-- Firebase JWT entegrasyonu yapıldığında v6_rls_security.sql tekrar çalıştırılır.
-- ════════════════════════════════════════════════════════════════════

-- ★ Tüm mevcut politikaları temizle (hem v6 hem eski adlarla)

-- 1. PROFILES
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "profiles_all" ON profiles';
  EXECUTE 'DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own profile" ON profiles';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own profile" ON profiles';
  EXECUTE 'CREATE POLICY "profiles_all" ON profiles FOR ALL USING (true) WITH CHECK (true)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 2. ROOMS
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "rooms_all" ON rooms';
  EXECUTE 'DROP POLICY IF EXISTS "Rooms are viewable by everyone" ON rooms';
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can create rooms" ON rooms';
  EXECUTE 'DROP POLICY IF EXISTS "Room owner can update room" ON rooms';
  EXECUTE 'DROP POLICY IF EXISTS "Room owner can delete room" ON rooms';
  EXECUTE 'CREATE POLICY "rooms_all" ON rooms FOR ALL USING (true) WITH CHECK (true)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 3. ROOM_PARTICIPANTS
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "participants_all" ON room_participants';
  EXECUTE 'DROP POLICY IF EXISTS "Room participants are viewable" ON room_participants';
  EXECUTE 'DROP POLICY IF EXISTS "Users can join rooms" ON room_participants';
  EXECUTE 'DROP POLICY IF EXISTS "Participants can be updated" ON room_participants';
  EXECUTE 'DROP POLICY IF EXISTS "Participants can leave or be removed" ON room_participants';
  EXECUTE 'CREATE POLICY "participants_all" ON room_participants FOR ALL USING (true) WITH CHECK (true)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 4. MESSAGES
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "messages_all" ON messages';
  EXECUTE 'DROP POLICY IF EXISTS "Users can read own messages" ON messages';
  EXECUTE 'DROP POLICY IF EXISTS "Users can send messages" ON messages';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own messages" ON messages';
  EXECUTE 'CREATE POLICY "messages_all" ON messages FOR ALL USING (true) WITH CHECK (true)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 5. FRIENDSHIPS
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "friendships_all" ON friendships';
  EXECUTE 'DROP POLICY IF EXISTS "Friendships are viewable" ON friendships';
  EXECUTE 'DROP POLICY IF EXISTS "Users can create friendships" ON friendships';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update friendships" ON friendships';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete friendships" ON friendships';
  EXECUTE 'CREATE POLICY "friendships_all" ON friendships FOR ALL USING (true) WITH CHECK (true)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 6. REPORTS
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "reports_all" ON reports';
  EXECUTE 'DROP POLICY IF EXISTS "Users can create reports" ON reports';
  EXECUTE 'DROP POLICY IF EXISTS "Admins can read reports" ON reports';
  EXECUTE 'DROP POLICY IF EXISTS "Admins can update reports" ON reports';
  EXECUTE 'CREATE POLICY "reports_all" ON reports FOR ALL USING (true) WITH CHECK (true)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 7. BLOCKED_USERS
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "blocked_all" ON blocked_users';
  EXECUTE 'DROP POLICY IF EXISTS "Users can read own blocks" ON blocked_users';
  EXECUTE 'DROP POLICY IF EXISTS "Users can block others" ON blocked_users';
  EXECUTE 'DROP POLICY IF EXISTS "Users can unblock others" ON blocked_users';
  EXECUTE 'CREATE POLICY "blocked_all" ON blocked_users FOR ALL USING (true) WITH CHECK (true)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 8. ROOM_MUTES
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "mutes_all" ON room_mutes';
  EXECUTE 'DROP POLICY IF EXISTS "Room mutes readable" ON room_mutes';
  EXECUTE 'DROP POLICY IF EXISTS "Mods can create mutes" ON room_mutes';
  EXECUTE 'DROP POLICY IF EXISTS "Mods can delete mutes" ON room_mutes';
  EXECUTE 'CREATE POLICY "mutes_all" ON room_mutes FOR ALL USING (true) WITH CHECK (true)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 9. ROOM_BANS
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "bans_all" ON room_bans';
  EXECUTE 'DROP POLICY IF EXISTS "Room bans readable" ON room_bans';
  EXECUTE 'DROP POLICY IF EXISTS "Room bans insertable" ON room_bans';
  EXECUTE 'DROP POLICY IF EXISTS "Room owner can remove bans" ON room_bans';
  EXECUTE 'CREATE POLICY "bans_all" ON room_bans FOR ALL USING (true) WITH CHECK (true)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 10. USER_CATEGORY_PREFERENCES
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "prefs_all" ON user_category_preferences';
  EXECUTE 'DROP POLICY IF EXISTS "Users can read own preferences" ON user_category_preferences';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own preferences" ON user_category_preferences';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own preferences" ON user_category_preferences';
  EXECUTE 'CREATE POLICY "prefs_all" ON user_category_preferences FOR ALL USING (true) WITH CHECK (true)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 11. SP_TRANSACTIONS
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "sp_all" ON sp_transactions';
  EXECUTE 'DROP POLICY IF EXISTS "SP transactions readable" ON sp_transactions';
  EXECUTE 'DROP POLICY IF EXISTS "SP transactions insertable" ON sp_transactions';
  EXECUTE 'CREATE POLICY "sp_all" ON sp_transactions FOR ALL USING (true) WITH CHECK (true)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 12. ROOM_ACCESS_REQUESTS
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "access_all" ON room_access_requests';
  EXECUTE 'DROP POLICY IF EXISTS "Access requests readable" ON room_access_requests';
  EXECUTE 'DROP POLICY IF EXISTS "Access requests insertable" ON room_access_requests';
  EXECUTE 'DROP POLICY IF EXISTS "Access requests updatable" ON room_access_requests';
  EXECUTE 'CREATE POLICY "access_all" ON room_access_requests FOR ALL USING (true) WITH CHECK (true)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 13. ROOM_FOLLOWERS
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "followers_all" ON room_followers';
  EXECUTE 'DROP POLICY IF EXISTS "Room followers are public" ON room_followers';
  EXECUTE 'DROP POLICY IF EXISTS "Users can follow rooms" ON room_followers';
  EXECUTE 'DROP POLICY IF EXISTS "Users can unfollow rooms" ON room_followers';
  EXECUTE 'DROP POLICY IF EXISTS "Users can manage own follows" ON room_followers';
  EXECUTE 'CREATE POLICY "followers_all" ON room_followers FOR ALL USING (true) WITH CHECK (true)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 14. ROOM_INVITES
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "invites_all" ON room_invites';
  EXECUTE 'DROP POLICY IF EXISTS "Users can read own invites" ON room_invites';
  EXECUTE 'DROP POLICY IF EXISTS "Users can send invites" ON room_invites';
  EXECUTE 'DROP POLICY IF EXISTS "Users can respond to invites" ON room_invites';
  EXECUTE 'CREATE POLICY "invites_all" ON room_invites FOR ALL USING (true) WITH CHECK (true)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 15. DAILY_CHECKINS
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "checkins_all" ON daily_checkins';
  EXECUTE 'DROP POLICY IF EXISTS "Users can manage own checkins" ON daily_checkins';
  EXECUTE 'DROP POLICY IF EXISTS "Users can read own checkins" ON daily_checkins';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own checkins" ON daily_checkins';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own checkins" ON daily_checkins';
  EXECUTE 'CREATE POLICY "checkins_all" ON daily_checkins FOR ALL USING (true) WITH CHECK (true)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 16. INBOX
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "inbox_all" ON inbox';
  EXECUTE 'DROP POLICY IF EXISTS "Users can read own inbox" ON inbox';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert inbox" ON inbox';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own inbox" ON inbox';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own inbox" ON inbox';
  EXECUTE 'CREATE POLICY "inbox_all" ON inbox FOR ALL USING (true) WITH CHECK (true)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 17. USER_BADGES
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "badges_all" ON user_badges';
  EXECUTE 'DROP POLICY IF EXISTS "Badges are viewable" ON user_badges';
  EXECUTE 'DROP POLICY IF EXISTS "Users can earn badges" ON user_badges';
  EXECUTE 'CREATE POLICY "badges_all" ON user_badges FOR ALL USING (true) WITH CHECK (true)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 18. NOTIFICATIONS (BUG-R13)
DO $$ BEGIN
  ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
  EXECUTE 'DROP POLICY IF EXISTS "notifications_all" ON notifications';
  EXECUTE 'CREATE POLICY "notifications_all" ON notifications FOR ALL USING (true) WITH CHECK (true)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ═══ DONE ═══
