-- ============================================
-- SOPRANOCHAT — MODERASYON SİSTEMİ
-- Raporlama + Engelleme + Oda Susturma
-- ============================================

-- 1. RAPORLAR TABLOSU
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  reported_room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  reported_post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  reported_message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN (
    'spam', 'harassment', 'hate_speech', 'inappropriate_content',
    'impersonation', 'self_harm', 'violence', 'underage', 'other'
  )),
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ENGELLENMIŞ KULLANICILAR TABLOSU
CREATE TABLE IF NOT EXISTS blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

-- 3. ODA İÇİ SUSTURMA TABLOSU
CREATE TABLE IF NOT EXISTS room_mutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  muted_user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  muted_by TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, muted_user_id)
);

-- İndexler
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON blocked_users(blocked_id);
CREATE INDEX IF NOT EXISTS idx_room_mutes_room ON room_mutes(room_id);

-- RLS (Firebase Auth uyumlu — "Allow all for anon" yaklaşımı)
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_mutes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for anon" ON reports;
CREATE POLICY "Allow all for anon" ON reports FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for anon" ON blocked_users;
CREATE POLICY "Allow all for anon" ON blocked_users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for anon" ON room_mutes;
CREATE POLICY "Allow all for anon" ON room_mutes FOR ALL USING (true) WITH CHECK (true);
