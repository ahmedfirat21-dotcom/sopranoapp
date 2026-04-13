-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v6 — RLS Güvenlik Politikaları (Faz 4)
-- 
-- USING(true) → gerçek güvenlik kurallarına yükseltir.
-- Her bölüm bağımsız — tablo yoksa o bölüm atlanır.
-- Supabase SQL Editor'da çalıştırın.
-- ════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════
-- 1. PROFILES
-- ═══════════════════════════════════════════════════
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
CREATE POLICY "Profiles are viewable by everyone" 
  ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" 
  ON profiles FOR UPDATE USING (auth.uid()::text = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" 
  ON profiles FOR INSERT WITH CHECK (auth.uid()::text = id);


-- ═══════════════════════════════════════════════════
-- 2. ROOMS
-- ═══════════════════════════════════════════════════
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Rooms are viewable by everyone" ON rooms;
CREATE POLICY "Rooms are viewable by everyone" 
  ON rooms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create rooms" ON rooms;
CREATE POLICY "Authenticated users can create rooms" 
  ON rooms FOR INSERT WITH CHECK (auth.uid()::text = host_id);

DROP POLICY IF EXISTS "Room owner can update room" ON rooms;
CREATE POLICY "Room owner can update room" 
  ON rooms FOR UPDATE USING (auth.uid()::text = host_id);

DROP POLICY IF EXISTS "Room owner can delete room" ON rooms;
CREATE POLICY "Room owner can delete room" 
  ON rooms FOR DELETE USING (auth.uid()::text = host_id);


-- ═══════════════════════════════════════════════════
-- 3. ROOM_PARTICIPANTS
-- ═══════════════════════════════════════════════════
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Room participants are viewable" ON room_participants;
CREATE POLICY "Room participants are viewable" 
  ON room_participants FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can join rooms" ON room_participants;
CREATE POLICY "Users can join rooms" 
  ON room_participants FOR INSERT WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Participants can be updated" ON room_participants;
CREATE POLICY "Participants can be updated" 
  ON room_participants FOR UPDATE USING (
    auth.uid()::text = user_id
    OR EXISTS (
      SELECT 1 FROM rooms WHERE rooms.id = room_participants.room_id 
        AND rooms.host_id = auth.uid()::text
    )
    OR EXISTS (
      SELECT 1 FROM room_participants rp2 
        WHERE rp2.room_id = room_participants.room_id 
        AND rp2.user_id = auth.uid()::text 
        AND rp2.role IN ('owner', 'moderator')
    )
  );

DROP POLICY IF EXISTS "Participants can leave or be removed" ON room_participants;
CREATE POLICY "Participants can leave or be removed" 
  ON room_participants FOR DELETE USING (
    auth.uid()::text = user_id
    OR EXISTS (
      SELECT 1 FROM rooms WHERE rooms.id = room_participants.room_id 
        AND rooms.host_id = auth.uid()::text
    )
    OR EXISTS (
      SELECT 1 FROM room_participants rp2 
        WHERE rp2.room_id = room_participants.room_id 
        AND rp2.user_id = auth.uid()::text 
        AND rp2.role IN ('owner', 'moderator')
    )
  );


-- ═══════════════════════════════════════════════════
-- 4. MESSAGES (DM + Oda mesajları aynı tabloda)
-- ═══════════════════════════════════════════════════
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own messages" ON messages;
CREATE POLICY "Users can read own messages" 
  ON messages FOR SELECT USING (
    auth.uid()::text = sender_id 
    OR auth.uid()::text = receiver_id
    OR room_id IS NOT NULL
  );

DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages" 
  ON messages FOR INSERT WITH CHECK (auth.uid()::text = sender_id);

DROP POLICY IF EXISTS "Users can update own messages" ON messages;
CREATE POLICY "Users can update own messages" 
  ON messages FOR UPDATE USING (auth.uid()::text = sender_id);


-- ═══════════════════════════════════════════════════
-- 5. FRIENDSHIPS
-- ═══════════════════════════════════════════════════
DO $$ BEGIN
  ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

  EXECUTE 'DROP POLICY IF EXISTS "Friendships are viewable" ON friendships';
  EXECUTE 'CREATE POLICY "Friendships are viewable" ON friendships FOR SELECT USING (true)';

  EXECUTE 'DROP POLICY IF EXISTS "Users can create friendships" ON friendships';
  EXECUTE 'CREATE POLICY "Users can create friendships" ON friendships FOR INSERT WITH CHECK (auth.uid()::text = user_id)';

  EXECUTE 'DROP POLICY IF EXISTS "Users can update friendships" ON friendships';
  EXECUTE 'CREATE POLICY "Users can update friendships" ON friendships FOR UPDATE USING (auth.uid()::text = user_id OR auth.uid()::text = friend_id)';

  EXECUTE 'DROP POLICY IF EXISTS "Users can delete friendships" ON friendships';
  EXECUTE 'CREATE POLICY "Users can delete friendships" ON friendships FOR DELETE USING (auth.uid()::text = user_id OR auth.uid()::text = friend_id)';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'friendships tablosu bulunamadı — atlanıyor';
END $$;


-- ═══════════════════════════════════════════════════
-- 6. REPORTS
-- ═══════════════════════════════════════════════════
DO $$ BEGIN
  ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

  EXECUTE 'DROP POLICY IF EXISTS "Users can create reports" ON reports';
  EXECUTE 'CREATE POLICY "Users can create reports" ON reports FOR INSERT WITH CHECK (auth.uid()::text = reporter_id)';

  EXECUTE 'DROP POLICY IF EXISTS "Admins can read reports" ON reports';
  EXECUTE 'CREATE POLICY "Admins can read reports" ON reports FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()::text AND profiles.is_admin = true)
  )';

  EXECUTE 'DROP POLICY IF EXISTS "Admins can update reports" ON reports';
  EXECUTE 'CREATE POLICY "Admins can update reports" ON reports FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()::text AND profiles.is_admin = true)
  )';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'reports tablosu bulunamadı — atlanıyor';
END $$;


-- ═══════════════════════════════════════════════════
-- 7. BLOCKED_USERS
-- ═══════════════════════════════════════════════════
DO $$ BEGIN
  ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

  EXECUTE 'DROP POLICY IF EXISTS "Users can read own blocks" ON blocked_users';
  EXECUTE 'CREATE POLICY "Users can read own blocks" ON blocked_users FOR SELECT USING (auth.uid()::text = blocker_id)';

  EXECUTE 'DROP POLICY IF EXISTS "Users can block others" ON blocked_users';
  EXECUTE 'CREATE POLICY "Users can block others" ON blocked_users FOR INSERT WITH CHECK (auth.uid()::text = blocker_id)';

  EXECUTE 'DROP POLICY IF EXISTS "Users can unblock others" ON blocked_users';
  EXECUTE 'CREATE POLICY "Users can unblock others" ON blocked_users FOR DELETE USING (auth.uid()::text = blocker_id)';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'blocked_users tablosu bulunamadı — atlanıyor';
END $$;


-- ═══════════════════════════════════════════════════
-- 8. ROOM_MUTES
-- ═══════════════════════════════════════════════════
DO $$ BEGIN
  ALTER TABLE room_mutes ENABLE ROW LEVEL SECURITY;

  EXECUTE 'DROP POLICY IF EXISTS "Room mutes readable" ON room_mutes';
  EXECUTE 'CREATE POLICY "Room mutes readable" ON room_mutes FOR SELECT USING (true)';

  EXECUTE 'DROP POLICY IF EXISTS "Mods can create mutes" ON room_mutes';
  EXECUTE 'CREATE POLICY "Mods can create mutes" ON room_mutes FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM room_participants rp 
        WHERE rp.room_id = room_mutes.room_id 
        AND rp.user_id = auth.uid()::text 
        AND rp.role IN (''owner'', ''moderator'')
    )
    OR EXISTS (
      SELECT 1 FROM rooms WHERE rooms.id = room_mutes.room_id 
        AND rooms.host_id = auth.uid()::text
    )
  )';

  EXECUTE 'DROP POLICY IF EXISTS "Mods can delete mutes" ON room_mutes';
  EXECUTE 'CREATE POLICY "Mods can delete mutes" ON room_mutes FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM room_participants rp 
        WHERE rp.room_id = room_mutes.room_id 
        AND rp.user_id = auth.uid()::text 
        AND rp.role IN (''owner'', ''moderator'')
    )
    OR EXISTS (
      SELECT 1 FROM rooms WHERE rooms.id = room_mutes.room_id 
        AND rooms.host_id = auth.uid()::text
    )
  )';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'room_mutes tablosu bulunamadı — atlanıyor';
END $$;


-- ═══════════════════════════════════════════════════
-- 9. ROOM_BANS (v4'te oluşturulmuş)
-- ═══════════════════════════════════════════════════
DROP POLICY IF EXISTS "Room bans readable" ON room_bans;
DROP POLICY IF EXISTS "Room bans insertable" ON room_bans;

CREATE POLICY "Room bans readable" 
  ON room_bans FOR SELECT USING (true);

CREATE POLICY "Room bans insertable" 
  ON room_bans FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM room_participants rp 
        WHERE rp.room_id = room_bans.room_id 
        AND rp.user_id = auth.uid()::text 
        AND rp.role IN ('owner', 'moderator')
    )
    OR EXISTS (
      SELECT 1 FROM rooms WHERE rooms.id = room_bans.room_id 
        AND rooms.host_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Room owner can remove bans" ON room_bans;
CREATE POLICY "Room owner can remove bans" 
  ON room_bans FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM rooms WHERE rooms.id = room_bans.room_id 
        AND rooms.host_id = auth.uid()::text
    )
  );


-- ═══════════════════════════════════════════════════
-- 10. USER_CATEGORY_PREFERENCES (v4'te oluşturulmuş)
-- ═══════════════════════════════════════════════════
DROP POLICY IF EXISTS "Users can read own preferences" ON user_category_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON user_category_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON user_category_preferences;

CREATE POLICY "Users can read own preferences" 
  ON user_category_preferences FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can insert own preferences" 
  ON user_category_preferences FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update own preferences" 
  ON user_category_preferences FOR UPDATE USING (auth.uid()::text = user_id);


-- ═══════════════════════════════════════════════════
-- 11. SP_TRANSACTIONS (v4'te oluşturulmuş)
-- ═══════════════════════════════════════════════════
DROP POLICY IF EXISTS "SP transactions readable" ON sp_transactions;
DROP POLICY IF EXISTS "SP transactions insertable" ON sp_transactions;

CREATE POLICY "SP transactions readable" 
  ON sp_transactions FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "SP transactions insertable" 
  ON sp_transactions FOR INSERT WITH CHECK (auth.uid()::text = user_id);


-- ═══════════════════════════════════════════════════
-- 12. ROOM_ACCESS_REQUESTS (v4'te oluşturulmuş)
-- ═══════════════════════════════════════════════════
DROP POLICY IF EXISTS "Access requests readable" ON room_access_requests;
DROP POLICY IF EXISTS "Access requests insertable" ON room_access_requests;
DROP POLICY IF EXISTS "Access requests updatable" ON room_access_requests;

CREATE POLICY "Access requests readable" 
  ON room_access_requests FOR SELECT USING (
    auth.uid()::text = user_id
    OR EXISTS (
      SELECT 1 FROM rooms WHERE rooms.id = room_access_requests.room_id 
        AND rooms.host_id = auth.uid()::text
    )
  );
CREATE POLICY "Access requests insertable" 
  ON room_access_requests FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Access requests updatable" 
  ON room_access_requests FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM rooms WHERE rooms.id = room_access_requests.room_id 
        AND rooms.host_id = auth.uid()::text
    )
  );


-- ═══════════════════════════════════════════════════
-- 13. ROOM_FOLLOWERS (v4'te oluşturulmuş)
-- ═══════════════════════════════════════════════════
DROP POLICY IF EXISTS "Users can manage own follows" ON room_followers;
DROP POLICY IF EXISTS "Room followers are public" ON room_followers;

CREATE POLICY "Room followers are public" 
  ON room_followers FOR SELECT USING (true);
CREATE POLICY "Users can follow rooms" 
  ON room_followers FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can unfollow rooms" 
  ON room_followers FOR DELETE USING (auth.uid()::text = user_id);


-- ═══════════════════════════════════════════════════
-- 14. ROOM_INVITES (v4'te oluşturulmuş)
-- ═══════════════════════════════════════════════════
DROP POLICY IF EXISTS "Users can read own invites" ON room_invites;
DROP POLICY IF EXISTS "Users can insert invites" ON room_invites;
DROP POLICY IF EXISTS "Users can update own invites" ON room_invites;

CREATE POLICY "Users can read own invites" 
  ON room_invites FOR SELECT USING (
    auth.uid()::text = user_id 
    OR auth.uid()::text = invited_by
    OR EXISTS (
      SELECT 1 FROM rooms WHERE rooms.id = room_invites.room_id 
        AND rooms.host_id = auth.uid()::text
    )
  );
CREATE POLICY "Users can send invites" 
  ON room_invites FOR INSERT WITH CHECK (auth.uid()::text = invited_by);
CREATE POLICY "Users can respond to invites" 
  ON room_invites FOR UPDATE USING (auth.uid()::text = user_id);


-- ═══════════════════════════════════════════════════
-- 15. DAILY_CHECKINS (v4'te oluşturulmuş)
-- ═══════════════════════════════════════════════════
DROP POLICY IF EXISTS "Users can manage own checkins" ON daily_checkins;

CREATE POLICY "Users can read own checkins" 
  ON daily_checkins FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can insert own checkins" 
  ON daily_checkins FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update own checkins" 
  ON daily_checkins FOR UPDATE USING (auth.uid()::text = user_id);


-- ═══════════════════════════════════════════════════
-- 16. INBOX (opsiyonel — yoksa atlanır)
-- ═══════════════════════════════════════════════════
DO $$ BEGIN
  ALTER TABLE inbox ENABLE ROW LEVEL SECURITY;

  EXECUTE 'DROP POLICY IF EXISTS "Users can read own inbox" ON inbox';
  EXECUTE 'CREATE POLICY "Users can read own inbox" ON inbox FOR SELECT USING (auth.uid()::text = user_id)';

  EXECUTE 'DROP POLICY IF EXISTS "Users can insert inbox" ON inbox';
  EXECUTE 'CREATE POLICY "Users can insert inbox" ON inbox FOR INSERT WITH CHECK (true)';

  EXECUTE 'DROP POLICY IF EXISTS "Users can update own inbox" ON inbox';
  EXECUTE 'CREATE POLICY "Users can update own inbox" ON inbox FOR UPDATE USING (auth.uid()::text = user_id)';

  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own inbox" ON inbox';
  EXECUTE 'CREATE POLICY "Users can delete own inbox" ON inbox FOR DELETE USING (auth.uid()::text = user_id)';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'inbox tablosu bulunamadı — atlanıyor';
END $$;


-- ═══════════════════════════════════════════════════
-- 17. USER_BADGES (opsiyonel — yoksa atlanır)
-- ═══════════════════════════════════════════════════
DO $$ BEGIN
  ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

  EXECUTE 'DROP POLICY IF EXISTS "Badges are viewable" ON user_badges';
  EXECUTE 'CREATE POLICY "Badges are viewable" ON user_badges FOR SELECT USING (true)';

  EXECUTE 'DROP POLICY IF EXISTS "Users can earn badges" ON user_badges';
  EXECUTE 'CREATE POLICY "Users can earn badges" ON user_badges FOR INSERT WITH CHECK (auth.uid()::text = user_id)';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'user_badges tablosu bulunamadı — atlanıyor';
END $$;


-- ═══ DONE ═══
-- v6 RLS güvenlik politikaları tamamlandı.
