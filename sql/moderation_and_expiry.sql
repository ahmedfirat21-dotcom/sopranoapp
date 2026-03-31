-- ============================================
-- ODA SÜRESİ & ŞİKAYET YÖNETİMİ MİGRASYONU
-- ============================================

-- 1) rooms tablosuna expires_at sütunu ekle (free userlar için 3 saat)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NULL;

-- 2) reports tablosuna status ve resolved_at sütunları ekle
ALTER TABLE reports ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ DEFAULT NULL;

-- 3) reports tablosu yoksa oluştur
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id TEXT NOT NULL,
  reported_user_id TEXT,
  reported_room_id UUID,
  reported_post_id UUID,
  reported_message_id UUID,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',  -- pending, dismissed, warned, banned
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4) blocked_users tablosu yoksa oluştur  
CREATE TABLE IF NOT EXISTS blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id TEXT NOT NULL,
  blocked_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

-- 5) room_mutes tablosu yoksa oluştur
CREATE TABLE IF NOT EXISTS room_mutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  muted_user_id TEXT NOT NULL,
  muted_by TEXT NOT NULL,
  reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, muted_user_id)
);

-- 5b) room_participants tablosuna is_chat_muted sütunu ekle (metin susturma)
ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS is_chat_muted BOOLEAN DEFAULT false;

-- 6) profiles tablosuna is_admin ve is_banned sütunları ekle
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;

-- 7) Kendini admin yap (İLK KAYITLI KULLANICI)
-- Aşağıdaki komutu çalıştırdıktan sonra kendi kullanıcı adınızla günceleyin:
-- UPDATE profiles SET is_admin = true WHERE username = 'SENİN_KULLANICI_ADIN';
-- VEYA Supabase Dashboard → profiles tablosu → kendi satırınız → is_admin = true

-- 8) İndeksler
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_rooms_expires_at ON rooms(expires_at) WHERE is_live = true;
CREATE INDEX IF NOT EXISTS idx_room_mutes_expires ON room_mutes(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_admin ON profiles(is_admin) WHERE is_admin = true;
