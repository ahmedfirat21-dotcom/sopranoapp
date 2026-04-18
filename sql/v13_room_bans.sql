-- ============================================
-- V13: room_bans tablosu + Banlı giriş engeli
-- ============================================

-- Eski tablo varsa temizle
DROP TABLE IF EXISTS room_bans CASCADE;

-- 1. Tablo
CREATE TABLE room_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  ban_type TEXT DEFAULT 'permanent',
  duration TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  banned_by TEXT,
  reason TEXT,
  UNIQUE(room_id, user_id)
);

-- 2. Indeks
CREATE INDEX idx_room_bans_lookup ON room_bans(room_id, user_id);

-- 3. RLS acik
ALTER TABLE room_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bans_select" ON room_bans FOR SELECT USING (true);
CREATE POLICY "bans_insert" ON room_bans FOR INSERT WITH CHECK (true);
CREATE POLICY "bans_update" ON room_bans FOR UPDATE USING (true);
CREATE POLICY "bans_delete" ON room_bans FOR DELETE USING (true);

-- 4. room_participants INSERT kontrolu
-- Banli kullanicilarin odaya katilmasini DB seviyesinde engelle
DROP POLICY IF EXISTS "room_participants_insert_ban_check" ON room_participants;
DROP POLICY IF EXISTS "room_participants_insert" ON room_participants;
DROP POLICY IF EXISTS "Users can join rooms" ON room_participants;
DROP POLICY IF EXISTS "participants_insert" ON room_participants;
DROP POLICY IF EXISTS "participants_all" ON room_participants;

-- Oncelikle mevcut INSERT policy varsa cikar
DO $$ 
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname FROM pg_policies 
    WHERE tablename = 'room_participants' AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON room_participants', pol.policyname);
  END LOOP;
END $$;

-- Yeni INSERT policy: banli kullanici giremez
CREATE POLICY "participants_insert_with_ban_check" ON room_participants
  FOR INSERT WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM room_bans
      WHERE room_bans.room_id = room_participants.room_id
        AND room_bans.user_id = room_participants.user_id
        AND (room_bans.expires_at IS NULL OR room_bans.expires_at > now())
    )
  );

-- Diger policy'ler (SELECT, UPDATE, DELETE) korunuyor
-- Eger yoksa ekle
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'room_participants' AND cmd = 'SELECT') THEN
    CREATE POLICY "participants_select" ON room_participants FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'room_participants' AND cmd = 'UPDATE') THEN
    CREATE POLICY "participants_update" ON room_participants FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'room_participants' AND cmd = 'DELETE') THEN
    CREATE POLICY "participants_delete" ON room_participants FOR DELETE USING (true);
  END IF;
END $$;
