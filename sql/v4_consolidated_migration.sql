-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v4 — Konsolide Migrasyon (Tüm Fazlar: 1-7)
-- 
-- Bu dosya, v4 mimarisinin tüm SQL değişikliklerini tek bir yerde toplar.
-- Supabase SQL Editor'da çalıştırılmalıdır.
-- Tüm komutlar "IF NOT EXISTS" ile güvenlidir — birden fazla çalıştırılabilir.
--
-- Faz 1: Rooms + SP + Access Requests
-- Faz 3: Gizlilik + RPC'ler
-- Faz 5: Ghost/Disguise + Bans
-- Faz 6: Room Followers + Invites
-- Faz 7: Role Constraint (host → owner)
-- ════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════
-- FAZ 1: ROOMS — Eksik Kolonlar
-- ═══════════════════════════════════════════════════
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'tr';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'audio';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS owner_tier TEXT DEFAULT 'Free';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_persistent BOOLEAN DEFAULT false;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS max_cameras INTEGER DEFAULT 0;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS max_moderators INTEGER DEFAULT 0;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS room_password TEXT DEFAULT NULL;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS boost_score INTEGER DEFAULT 0;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS total_gifts INTEGER DEFAULT 0;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS boost_expires_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;

-- ═══ ROOM_PARTICIPANTS — Heartbeat + Ghost + Disguise ═══
ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS is_chat_muted BOOLEAN DEFAULT false;
ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS is_ghost BOOLEAN DEFAULT false;
ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS disguise JSONB DEFAULT NULL;

-- ═══ PROFILES — Subscription + SP + Gizlilik ═══
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'Free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS system_points INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;

-- ═══════════════════════════════════════════════════
-- FAZ 1: Yeni Tablolar
-- ═══════════════════════════════════════════════════

-- ═══ USER_CATEGORY_PREFERENCES — Keşfet algoritması ═══
CREATE TABLE IF NOT EXISTS user_category_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL,
  follow_score INTEGER DEFAULT 0,
  visit_count INTEGER DEFAULT 0,
  last_visited_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, category)
);

-- ═══ ROOM_ACCESS_REQUESTS — Davetli oda giriş istekleri ═══
CREATE TABLE IF NOT EXISTS room_access_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  target_role TEXT DEFAULT 'owner',
  handled_by TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══ SP_TRANSACTIONS — Sistem puanı logları ═══
CREATE TABLE IF NOT EXISTS sp_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════
-- FAZ 5: ROOM_BANS — Ban kayıtları
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS room_bans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  ban_type TEXT DEFAULT 'temporary' CHECK (ban_type IN ('temporary', 'permanent')),
  banned_by TEXT DEFAULT NULL,
  reason TEXT DEFAULT NULL,
  expires_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════
-- FAZ 6: Oda Takip + Davet Sistemi
-- ═══════════════════════════════════════════════════

-- Oda Takipçileri
CREATE TABLE IF NOT EXISTS room_followers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  followed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(room_id, user_id)
);

-- Oda Davetleri
CREATE TABLE IF NOT EXISTS room_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  invited_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(room_id, user_id)
);

-- ═══════════════════════════════════════════════════
-- İNDEXLER
-- ═══════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_ucp_user_id ON user_category_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_rooms_boost ON rooms(boost_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_rooms_is_live ON rooms(is_live) WHERE is_live = true;
CREATE INDEX IF NOT EXISTS idx_rp_last_seen ON room_participants(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_rar_room ON room_access_requests(room_id, status);
CREATE INDEX IF NOT EXISTS idx_sp_user ON sp_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_rb_room_user ON room_bans(room_id, user_id);
CREATE INDEX IF NOT EXISTS idx_room_followers_room ON room_followers(room_id);
CREATE INDEX IF NOT EXISTS idx_room_followers_user ON room_followers(user_id);
CREATE INDEX IF NOT EXISTS idx_room_invites_user ON room_invites(user_id);

-- ═══════════════════════════════════════════════════
-- RLS POLİTİKALARI
-- ═══════════════════════════════════════════════════

-- user_category_preferences
ALTER TABLE user_category_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own preferences" ON user_category_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON user_category_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON user_category_preferences;
CREATE POLICY "Users can read own preferences" ON user_category_preferences FOR SELECT USING (true);
CREATE POLICY "Users can insert own preferences" ON user_category_preferences FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own preferences" ON user_category_preferences FOR UPDATE USING (true);

-- room_access_requests
ALTER TABLE room_access_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Access requests readable" ON room_access_requests;
DROP POLICY IF EXISTS "Access requests insertable" ON room_access_requests;
DROP POLICY IF EXISTS "Access requests updatable" ON room_access_requests;
CREATE POLICY "Access requests readable" ON room_access_requests FOR SELECT USING (true);
CREATE POLICY "Access requests insertable" ON room_access_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Access requests updatable" ON room_access_requests FOR UPDATE USING (true);

-- sp_transactions
ALTER TABLE sp_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "SP transactions readable" ON sp_transactions;
DROP POLICY IF EXISTS "SP transactions insertable" ON sp_transactions;
CREATE POLICY "SP transactions readable" ON sp_transactions FOR SELECT USING (true);
CREATE POLICY "SP transactions insertable" ON sp_transactions FOR INSERT WITH CHECK (true);

-- room_bans
ALTER TABLE room_bans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Room bans readable" ON room_bans;
DROP POLICY IF EXISTS "Room bans insertable" ON room_bans;
CREATE POLICY "Room bans readable" ON room_bans FOR SELECT USING (true);
CREATE POLICY "Room bans insertable" ON room_bans FOR INSERT WITH CHECK (true);

-- room_followers
ALTER TABLE room_followers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own follows" ON room_followers;
DROP POLICY IF EXISTS "Room followers are public" ON room_followers;
CREATE POLICY "Users can manage own follows" ON room_followers FOR ALL USING (true);
CREATE POLICY "Room followers are public" ON room_followers FOR SELECT USING (true);

-- room_invites
ALTER TABLE room_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own invites" ON room_invites;
DROP POLICY IF EXISTS "Users can insert invites" ON room_invites;
DROP POLICY IF EXISTS "Users can update own invites" ON room_invites;
CREATE POLICY "Users can read own invites" ON room_invites FOR SELECT USING (true);
CREATE POLICY "Users can insert invites" ON room_invites FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own invites" ON room_invites FOR UPDATE USING (true);

-- ═══════════════════════════════════════════════════
-- FAZ 3: RPC FONKSİYONLARI
-- ═══════════════════════════════════════════════════

-- Kategori ziyaret sayacı (atomic increment)
CREATE OR REPLACE FUNCTION increment_category_visit(p_user_id TEXT, p_category TEXT)
RETURNS void AS $$
BEGIN
  INSERT INTO user_category_preferences (user_id, category, visit_count, last_visited_at)
  VALUES (p_user_id, p_category, 1, now())
  ON CONFLICT (user_id, category)
  DO UPDATE SET
    visit_count = user_category_preferences.visit_count + 1,
    last_visited_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- SP kazandırma (atomic)
CREATE OR REPLACE FUNCTION grant_system_points(p_user_id TEXT, p_amount INTEGER, p_action TEXT)
RETURNS void AS $$
BEGIN
  UPDATE profiles SET system_points = COALESCE(system_points, 0) + p_amount WHERE id = p_user_id;
  INSERT INTO sp_transactions (user_id, amount, type, description)
  VALUES (p_user_id, p_amount, p_action, 'SP kazanıldı: ' || p_action);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════
-- FAZ 7: ROL CONSTRAINT DÜZELTMESİ
-- ═══════════════════════════════════════════════════

-- Eski constraint'i kaldır
ALTER TABLE room_participants DROP CONSTRAINT IF EXISTS room_participants_role_check;

-- v4 rolleri ile yeni constraint ('host' artık kabul edilmiyor)
ALTER TABLE room_participants ADD CONSTRAINT room_participants_role_check 
  CHECK (role IN ('owner', 'moderator', 'speaker', 'listener', 'spectator', 'guest', 'banned', 'pending_speaker'));

-- Eski 'host' rollerini 'owner' ile değiştir (varsa)
UPDATE room_participants SET role = 'owner' WHERE role = 'host';

-- ═══════════════════════════════════════════════════
-- v5: YENİ KOLONLAR — Seyirci Kapasitesi + Gizlilik
-- ═══════════════════════════════════════════════════

-- Rooms: Seyirci kapasitesi (tier bazlı)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS max_spectators INTEGER DEFAULT 999;
-- Rooms: Dinleyici grid kapasitesi
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS max_listeners INTEGER DEFAULT 20;
-- Rooms: Renk teması (Silver+)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS room_color_theme JSONB DEFAULT NULL;
-- Rooms: Kart resmi (Gold+)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS room_image_url TEXT DEFAULT NULL;
-- Rooms: Sistem odası mı?
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_system_room BOOLEAN DEFAULT false;
-- Rooms: AI moderasyonlu mu?
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS ai_moderated BOOLEAN DEFAULT false;

-- Profiles: Sahip olduğu odaları gizle
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hide_owned_rooms BOOLEAN DEFAULT false;
-- Profiles: Gizlilik modu (public/followers_only/private)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS privacy_mode TEXT DEFAULT 'public';

-- ═══ v5 İNDEXLER ═══
CREATE INDEX IF NOT EXISTS idx_rooms_system ON rooms(is_system_room) WHERE is_system_room = true;
CREATE INDEX IF NOT EXISTS idx_profiles_privacy ON profiles(hide_owned_rooms) WHERE hide_owned_rooms = true;

-- ═══ DAILY_CHECKINS — Günlük giriş streak + SP kazanımı ═══
CREATE TABLE IF NOT EXISTS daily_checkins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  check_date DATE NOT NULL,
  streak INTEGER DEFAULT 1,
  sp_earned INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, check_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_checkins_user ON daily_checkins(user_id);

-- RLS — daily_checkins
ALTER TABLE daily_checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own checkins" ON daily_checkins;
CREATE POLICY "Users can manage own checkins" ON daily_checkins FOR ALL USING (true);

-- ═══ DONE ═══
-- Tüm v4+v5 migrasyonları tamamlandı.
