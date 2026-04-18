-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v16 — Firebase RLS Aktivasyonu
--
-- Firebase Third-Party Auth aktif (sopranochat-5738e).
-- Firebase JWT'deki "sub" claim'i → auth.uid() olarak kullanılır.
-- v6.1_rls_hotfix.sql'deki USING(true) politikalarını GERİ ALIR.
-- Gerçek güvenlik politikalarını (v6_rls_security.sql tabanlı) aktive eder.
--
-- ★ GÜVENLİK NOTU: Bu migrasyon SADECE Supabase Dashboard'da
--   Firebase Third-Party Auth aktifleştirildikten VE
--   supabase.ts'de accessToken callback eklendikten SONRA çalıştırılmalıdır.
--
-- ★ GERİ ALMA: Sorun olursa v6.1_rls_hotfix.sql tekrar çalıştırılabilir.
-- ════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════
-- 1. PROFILES
-- ═══════════════════════════════════════════════════
DO $$ BEGIN
  -- Eski catch-all politikayı kaldır
  EXECUTE 'DROP POLICY IF EXISTS "profiles_all" ON profiles';
  
  -- Yeni güvenlik politikaları
  EXECUTE 'DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles';
  EXECUTE 'CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true)';
  
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own profile" ON profiles';
  EXECUTE 'CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid()::text = id)';
  
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own profile" ON profiles';
  EXECUTE 'CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid()::text = id)';
  
  -- ★ DELETE politikası — hesap silme (settings.tsx) için gerekli
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own profile" ON profiles';
  EXECUTE 'CREATE POLICY "Users can delete own profile" ON profiles FOR DELETE USING (auth.uid()::text = id)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════
-- 2. ROOMS
-- ═══════════════════════════════════════════════════
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "rooms_all" ON rooms';
  
  EXECUTE 'DROP POLICY IF EXISTS "Rooms are viewable by everyone" ON rooms';
  EXECUTE 'CREATE POLICY "Rooms are viewable by everyone" ON rooms FOR SELECT USING (true)';
  
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can create rooms" ON rooms';
  EXECUTE 'CREATE POLICY "Authenticated users can create rooms" ON rooms FOR INSERT WITH CHECK (auth.uid()::text = host_id)';
  
  EXECUTE 'DROP POLICY IF EXISTS "Room owner can update room" ON rooms';
  EXECUTE 'CREATE POLICY "Room owner can update room" ON rooms FOR UPDATE USING (auth.uid()::text = host_id)';
  
  EXECUTE 'DROP POLICY IF EXISTS "Room owner can delete room" ON rooms';
  EXECUTE 'CREATE POLICY "Room owner can delete room" ON rooms FOR DELETE USING (auth.uid()::text = host_id)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════
-- 3. ROOM_PARTICIPANTS
-- ═══════════════════════════════════════════════════
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "participants_all" ON room_participants';
  
  EXECUTE 'DROP POLICY IF EXISTS "Room participants are viewable" ON room_participants';
  EXECUTE 'CREATE POLICY "Room participants are viewable" ON room_participants FOR SELECT USING (true)';
  
  EXECUTE 'DROP POLICY IF EXISTS "Users can join rooms" ON room_participants';
  EXECUTE 'CREATE POLICY "Users can join rooms" ON room_participants FOR INSERT WITH CHECK (auth.uid()::text = user_id)';
  
  -- UPDATE: Kendi kaydını veya moderatör/host olarak başkalarını güncelleyebilir
  EXECUTE 'DROP POLICY IF EXISTS "Participants can be updated" ON room_participants';
  EXECUTE 'CREATE POLICY "Participants can be updated" ON room_participants FOR UPDATE USING (
    auth.uid()::text = user_id
    OR EXISTS (SELECT 1 FROM rooms WHERE rooms.id = room_participants.room_id AND rooms.host_id = auth.uid()::text)
    OR EXISTS (SELECT 1 FROM room_participants rp2 WHERE rp2.room_id = room_participants.room_id AND rp2.user_id = auth.uid()::text AND rp2.role IN (''owner'', ''moderator''))
  )';
  
  -- DELETE: Kendisi ayrılabilir veya host/mod atabilir
  EXECUTE 'DROP POLICY IF EXISTS "Participants can leave or be removed" ON room_participants';
  EXECUTE 'CREATE POLICY "Participants can leave or be removed" ON room_participants FOR DELETE USING (
    auth.uid()::text = user_id
    OR EXISTS (SELECT 1 FROM rooms WHERE rooms.id = room_participants.room_id AND rooms.host_id = auth.uid()::text)
    OR EXISTS (SELECT 1 FROM room_participants rp2 WHERE rp2.room_id = room_participants.room_id AND rp2.user_id = auth.uid()::text AND rp2.role IN (''owner'', ''moderator''))
  )';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════
-- 4. MESSAGES
-- ═══════════════════════════════════════════════════
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "messages_all" ON messages';
  
  EXECUTE 'DROP POLICY IF EXISTS "Users can read own messages" ON messages';
  EXECUTE 'CREATE POLICY "Users can read own messages" ON messages FOR SELECT USING (
    auth.uid()::text = sender_id 
    OR auth.uid()::text = receiver_id
    OR room_id IS NOT NULL
  )';
  
  EXECUTE 'DROP POLICY IF EXISTS "Users can send messages" ON messages';
  EXECUTE 'CREATE POLICY "Users can send messages" ON messages FOR INSERT WITH CHECK (auth.uid()::text = sender_id)';
  
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own messages" ON messages';
  EXECUTE 'CREATE POLICY "Users can update own messages" ON messages FOR UPDATE USING (auth.uid()::text = sender_id)';
  
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own messages" ON messages';
  EXECUTE 'CREATE POLICY "Users can delete own messages" ON messages FOR DELETE USING (auth.uid()::text = sender_id)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════
-- 5. FRIENDSHIPS
-- ═══════════════════════════════════════════════════
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "friendships_all" ON friendships';
  
  EXECUTE 'DROP POLICY IF EXISTS "Friendships are viewable" ON friendships';
  EXECUTE 'CREATE POLICY "Friendships are viewable" ON friendships FOR SELECT USING (true)';
  
  EXECUTE 'DROP POLICY IF EXISTS "Users can create friendships" ON friendships';
  EXECUTE 'CREATE POLICY "Users can create friendships" ON friendships FOR INSERT WITH CHECK (auth.uid()::text = user_id)';
  
  EXECUTE 'DROP POLICY IF EXISTS "Users can update friendships" ON friendships';
  EXECUTE 'CREATE POLICY "Users can update friendships" ON friendships FOR UPDATE USING (auth.uid()::text = user_id OR auth.uid()::text = friend_id)';
  
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete friendships" ON friendships';
  EXECUTE 'CREATE POLICY "Users can delete friendships" ON friendships FOR DELETE USING (auth.uid()::text = user_id OR auth.uid()::text = friend_id)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════
-- 6. REPORTS
-- ═══════════════════════════════════════════════════
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "reports_all" ON reports';
  
  EXECUTE 'DROP POLICY IF EXISTS "Users can create reports" ON reports';
  EXECUTE 'CREATE POLICY "Users can create reports" ON reports FOR INSERT WITH CHECK (auth.uid()::text = reporter_id)';
  
  -- Raporları admin görebilir, rapor eden de kendi raporunu görebilir
  EXECUTE 'DROP POLICY IF EXISTS "Admins can read reports" ON reports';
  EXECUTE 'CREATE POLICY "Admins can read reports" ON reports FOR SELECT USING (
    auth.uid()::text = reporter_id
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()::text AND profiles.is_admin = true)
  )';
  
  EXECUTE 'DROP POLICY IF EXISTS "Admins can update reports" ON reports';
  EXECUTE 'CREATE POLICY "Admins can update reports" ON reports FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()::text AND profiles.is_admin = true)
  )';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════
-- 7. BLOCKED_USERS
-- ═══════════════════════════════════════════════════
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "blocked_all" ON blocked_users';
  
  EXECUTE 'DROP POLICY IF EXISTS "Users can read own blocks" ON blocked_users';
  EXECUTE 'CREATE POLICY "Users can read own blocks" ON blocked_users FOR SELECT USING (auth.uid()::text = blocker_id OR auth.uid()::text = blocked_id)';
  
  EXECUTE 'DROP POLICY IF EXISTS "Users can block others" ON blocked_users';
  EXECUTE 'CREATE POLICY "Users can block others" ON blocked_users FOR INSERT WITH CHECK (auth.uid()::text = blocker_id)';
  
  EXECUTE 'DROP POLICY IF EXISTS "Users can unblock others" ON blocked_users';
  EXECUTE 'CREATE POLICY "Users can unblock others" ON blocked_users FOR DELETE USING (auth.uid()::text = blocker_id)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════
-- 8. ROOM_MUTES
-- ═══════════════════════════════════════════════════
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "mutes_all" ON room_mutes';
  
  EXECUTE 'DROP POLICY IF EXISTS "Room mutes readable" ON room_mutes';
  EXECUTE 'CREATE POLICY "Room mutes readable" ON room_mutes FOR SELECT USING (true)';
  
  EXECUTE 'DROP POLICY IF EXISTS "Mods can create mutes" ON room_mutes';
  EXECUTE 'CREATE POLICY "Mods can create mutes" ON room_mutes FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM room_participants rp WHERE rp.room_id = room_mutes.room_id AND rp.user_id = auth.uid()::text AND rp.role IN (''owner'', ''moderator''))
    OR EXISTS (SELECT 1 FROM rooms WHERE rooms.id = room_mutes.room_id AND rooms.host_id = auth.uid()::text)
  )';
  
  EXECUTE 'DROP POLICY IF EXISTS "Mods can delete mutes" ON room_mutes';
  EXECUTE 'CREATE POLICY "Mods can delete mutes" ON room_mutes FOR DELETE USING (
    EXISTS (SELECT 1 FROM room_participants rp WHERE rp.room_id = room_mutes.room_id AND rp.user_id = auth.uid()::text AND rp.role IN (''owner'', ''moderator''))
    OR EXISTS (SELECT 1 FROM rooms WHERE rooms.id = room_mutes.room_id AND rooms.host_id = auth.uid()::text)
  )';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════
-- 9. ROOM_BANS
-- ═══════════════════════════════════════════════════
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "bans_all" ON room_bans';
  
  EXECUTE 'DROP POLICY IF EXISTS "Room bans readable" ON room_bans';
  EXECUTE 'CREATE POLICY "Room bans readable" ON room_bans FOR SELECT USING (true)';
  
  EXECUTE 'DROP POLICY IF EXISTS "Room bans insertable" ON room_bans';
  EXECUTE 'CREATE POLICY "Room bans insertable" ON room_bans FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM room_participants rp WHERE rp.room_id = room_bans.room_id AND rp.user_id = auth.uid()::text AND rp.role IN (''owner'', ''moderator''))
    OR EXISTS (SELECT 1 FROM rooms WHERE rooms.id = room_bans.room_id AND rooms.host_id = auth.uid()::text)
  )';
  
  EXECUTE 'DROP POLICY IF EXISTS "Room owner can remove bans" ON room_bans';
  EXECUTE 'CREATE POLICY "Room owner can remove bans" ON room_bans FOR DELETE USING (
    EXISTS (SELECT 1 FROM rooms WHERE rooms.id = room_bans.room_id AND rooms.host_id = auth.uid()::text)
  )';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════
-- 10. USER_CATEGORY_PREFERENCES
-- ═══════════════════════════════════════════════════
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "prefs_all" ON user_category_preferences';
  
  EXECUTE 'DROP POLICY IF EXISTS "Users can read own preferences" ON user_category_preferences';
  EXECUTE 'CREATE POLICY "Users can read own preferences" ON user_category_preferences FOR SELECT USING (auth.uid()::text = user_id)';
  
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own preferences" ON user_category_preferences';
  EXECUTE 'CREATE POLICY "Users can insert own preferences" ON user_category_preferences FOR INSERT WITH CHECK (auth.uid()::text = user_id)';
  
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own preferences" ON user_category_preferences';
  EXECUTE 'CREATE POLICY "Users can update own preferences" ON user_category_preferences FOR UPDATE USING (auth.uid()::text = user_id)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════
-- 11. SP_TRANSACTIONS
-- ═══════════════════════════════════════════════════
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "sp_all" ON sp_transactions';
  
  EXECUTE 'DROP POLICY IF EXISTS "SP transactions readable" ON sp_transactions';
  EXECUTE 'CREATE POLICY "SP transactions readable" ON sp_transactions FOR SELECT USING (auth.uid()::text = user_id)';
  
  EXECUTE 'DROP POLICY IF EXISTS "SP transactions insertable" ON sp_transactions';
  EXECUTE 'CREATE POLICY "SP transactions insertable" ON sp_transactions FOR INSERT WITH CHECK (auth.uid()::text = user_id)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════
-- 12. ROOM_ACCESS_REQUESTS
-- ═══════════════════════════════════════════════════
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "access_all" ON room_access_requests';
  
  EXECUTE 'DROP POLICY IF EXISTS "Access requests readable" ON room_access_requests';
  EXECUTE 'CREATE POLICY "Access requests readable" ON room_access_requests FOR SELECT USING (
    auth.uid()::text = user_id
    OR EXISTS (SELECT 1 FROM rooms WHERE rooms.id = room_access_requests.room_id AND rooms.host_id = auth.uid()::text)
  )';
  
  EXECUTE 'DROP POLICY IF EXISTS "Access requests insertable" ON room_access_requests';
  EXECUTE 'CREATE POLICY "Access requests insertable" ON room_access_requests FOR INSERT WITH CHECK (auth.uid()::text = user_id)';
  
  EXECUTE 'DROP POLICY IF EXISTS "Access requests updatable" ON room_access_requests';
  EXECUTE 'CREATE POLICY "Access requests updatable" ON room_access_requests FOR UPDATE USING (
    EXISTS (SELECT 1 FROM rooms WHERE rooms.id = room_access_requests.room_id AND rooms.host_id = auth.uid()::text)
  )';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════
-- 13. ROOM_FOLLOWERS
-- ═══════════════════════════════════════════════════
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "followers_all" ON room_followers';
  
  EXECUTE 'DROP POLICY IF EXISTS "Room followers are public" ON room_followers';
  EXECUTE 'CREATE POLICY "Room followers are public" ON room_followers FOR SELECT USING (true)';
  
  EXECUTE 'DROP POLICY IF EXISTS "Users can follow rooms" ON room_followers';
  EXECUTE 'CREATE POLICY "Users can follow rooms" ON room_followers FOR INSERT WITH CHECK (auth.uid()::text = user_id)';
  
  EXECUTE 'DROP POLICY IF EXISTS "Users can unfollow rooms" ON room_followers';
  EXECUTE 'CREATE POLICY "Users can unfollow rooms" ON room_followers FOR DELETE USING (auth.uid()::text = user_id)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════
-- 14. ROOM_INVITES
-- ═══════════════════════════════════════════════════
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "invites_all" ON room_invites';
  
  EXECUTE 'DROP POLICY IF EXISTS "Users can read own invites" ON room_invites';
  EXECUTE 'CREATE POLICY "Users can read own invites" ON room_invites FOR SELECT USING (
    auth.uid()::text = user_id 
    OR auth.uid()::text = invited_by
    OR EXISTS (SELECT 1 FROM rooms WHERE rooms.id = room_invites.room_id AND rooms.host_id = auth.uid()::text)
  )';
  
  EXECUTE 'DROP POLICY IF EXISTS "Users can send invites" ON room_invites';
  EXECUTE 'CREATE POLICY "Users can send invites" ON room_invites FOR INSERT WITH CHECK (auth.uid()::text = invited_by)';
  
  EXECUTE 'DROP POLICY IF EXISTS "Users can respond to invites" ON room_invites';
  EXECUTE 'CREATE POLICY "Users can respond to invites" ON room_invites FOR UPDATE USING (auth.uid()::text = user_id)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════
-- 15. DAILY_CHECKINS
-- ═══════════════════════════════════════════════════
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "checkins_all" ON daily_checkins';
  
  EXECUTE 'DROP POLICY IF EXISTS "Users can read own checkins" ON daily_checkins';
  EXECUTE 'CREATE POLICY "Users can read own checkins" ON daily_checkins FOR SELECT USING (auth.uid()::text = user_id)';
  
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own checkins" ON daily_checkins';
  EXECUTE 'CREATE POLICY "Users can insert own checkins" ON daily_checkins FOR INSERT WITH CHECK (auth.uid()::text = user_id)';
  
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own checkins" ON daily_checkins';
  EXECUTE 'CREATE POLICY "Users can update own checkins" ON daily_checkins FOR UPDATE USING (auth.uid()::text = user_id)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════
-- 16. INBOX
-- ═══════════════════════════════════════════════════
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "inbox_all" ON inbox';
  
  EXECUTE 'DROP POLICY IF EXISTS "Users can read own inbox" ON inbox';
  EXECUTE 'CREATE POLICY "Users can read own inbox" ON inbox FOR SELECT USING (auth.uid()::text = user_id)';
  
  -- INSERT: DM sistemi herkes tarafından inbox kaydı oluşturabilir
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert inbox" ON inbox';
  EXECUTE 'CREATE POLICY "Users can insert inbox" ON inbox FOR INSERT WITH CHECK (true)';
  
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own inbox" ON inbox';
  EXECUTE 'CREATE POLICY "Users can update own inbox" ON inbox FOR UPDATE USING (auth.uid()::text = user_id)';
  
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own inbox" ON inbox';
  EXECUTE 'CREATE POLICY "Users can delete own inbox" ON inbox FOR DELETE USING (auth.uid()::text = user_id)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════
-- 17. USER_BADGES
-- ═══════════════════════════════════════════════════
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "badges_all" ON user_badges';
  
  EXECUTE 'DROP POLICY IF EXISTS "Badges are viewable" ON user_badges';
  EXECUTE 'CREATE POLICY "Badges are viewable" ON user_badges FOR SELECT USING (true)';
  
  EXECUTE 'DROP POLICY IF EXISTS "Users can earn badges" ON user_badges';
  EXECUTE 'CREATE POLICY "Users can earn badges" ON user_badges FOR INSERT WITH CHECK (auth.uid()::text = user_id)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════
-- 18. NOTIFICATIONS
-- ═══════════════════════════════════════════════════
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "notifications_all" ON notifications';
  
  -- Kullanıcı kendi bildirimlerini okuyabilir
  EXECUTE 'DROP POLICY IF EXISTS "Users can read own notifications" ON notifications';
  EXECUTE 'CREATE POLICY "Users can read own notifications" ON notifications FOR SELECT USING (auth.uid()::text = user_id)';
  
  -- Sistem (veya diğer kullanıcılar) bildirim oluşturabilir
  EXECUTE 'DROP POLICY IF EXISTS "Anyone can create notifications" ON notifications';
  EXECUTE 'CREATE POLICY "Anyone can create notifications" ON notifications FOR INSERT WITH CHECK (true)';
  
  -- Kullanıcı kendi bildirimlerini güncelleyebilir (okundu işaretleme)
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own notifications" ON notifications';
  EXECUTE 'CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid()::text = user_id)';
  
  -- Kullanıcı kendi bildirimlerini silebilir
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications';
  EXECUTE 'CREATE POLICY "Users can delete own notifications" ON notifications FOR DELETE USING (auth.uid()::text = user_id)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════
-- 19. POSTS (varsa)
-- ═══════════════════════════════════════════════════
DO $$ BEGIN
  ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
  
  EXECUTE 'DROP POLICY IF EXISTS "posts_all" ON posts';
  
  EXECUTE 'DROP POLICY IF EXISTS "Posts are viewable by everyone" ON posts';
  EXECUTE 'CREATE POLICY "Posts are viewable by everyone" ON posts FOR SELECT USING (true)';
  
  EXECUTE 'DROP POLICY IF EXISTS "Users can create posts" ON posts';
  EXECUTE 'CREATE POLICY "Users can create posts" ON posts FOR INSERT WITH CHECK (auth.uid()::text = user_id)';
  
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own posts" ON posts';
  EXECUTE 'CREATE POLICY "Users can update own posts" ON posts FOR UPDATE USING (auth.uid()::text = user_id)';
  
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own posts" ON posts';
  EXECUTE 'CREATE POLICY "Users can delete own posts" ON posts FOR DELETE USING (auth.uid()::text = user_id)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════
-- 20. POST_LIKES (varsa)
-- ═══════════════════════════════════════════════════
DO $$ BEGIN
  ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
  
  EXECUTE 'DROP POLICY IF EXISTS "post_likes_all" ON post_likes';
  
  EXECUTE 'DROP POLICY IF EXISTS "Post likes are viewable" ON post_likes';
  EXECUTE 'CREATE POLICY "Post likes are viewable" ON post_likes FOR SELECT USING (true)';
  
  EXECUTE 'DROP POLICY IF EXISTS "Users can like posts" ON post_likes';
  EXECUTE 'CREATE POLICY "Users can like posts" ON post_likes FOR INSERT WITH CHECK (auth.uid()::text = user_id)';
  
  EXECUTE 'DROP POLICY IF EXISTS "Users can unlike posts" ON post_likes';
  EXECUTE 'CREATE POLICY "Users can unlike posts" ON post_likes FOR DELETE USING (auth.uid()::text = user_id)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;


-- ═══ DONE ═══
-- v16 Firebase RLS aktivasyonu tamamlandı.
-- 20 tablo için güvenlik politikaları aktif.
-- auth.uid() → Firebase UID (JWT sub claim) döner.
