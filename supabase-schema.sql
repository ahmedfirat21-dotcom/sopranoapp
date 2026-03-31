-- ============================================
-- SopranoChat — Veritabanı Şeması (Firebase Auth Uyumlu)
-- Supabase SQL Editor'a yapıştır ve çalıştır
-- ============================================

-- DİKKAT: ESKİ TABLOLARI VE TİP UYUMSUZLUKLARINI TEMİZLEME (RESET)
DROP TABLE IF EXISTS room_live_gifts CASCADE;
DROP TABLE IF EXISTS post_comments CASCADE;
DROP TABLE IF EXISTS post_likes CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS friendships CASCADE;
DROP TABLE IF EXISTS coin_transactions CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS room_participants CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS gifts_catalog CASCADE;

-- 1. KULLANICILAR (Firebase UID = TEXT)
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  display_name TEXT NOT NULL DEFAULT 'Kullanıcı',
  avatar_url TEXT DEFAULT 'https://i.pravatar.cc/120?img=3',
  bio TEXT DEFAULT '',
  gender TEXT CHECK (gender IN ('male', 'female', 'other', 'unspecified')) DEFAULT 'unspecified',
  birth_date DATE,
  tier TEXT DEFAULT 'Silver' CHECK (tier IN ('Silver', 'Plat', 'VIP')),
  coins INTEGER DEFAULT 0,
  is_plus BOOLEAN DEFAULT FALSE,
  is_online BOOLEAN DEFAULT FALSE,
  push_token TEXT DEFAULT NULL,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ODALAR
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'chat' CHECK (category IN ('chat', 'music', 'game', 'book', 'film', 'tech')),
  type TEXT DEFAULT 'open' CHECK (type IN ('open', 'closed', 'invite')),
  host_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  is_live BOOLEAN DEFAULT FALSE,
  listener_count INTEGER DEFAULT 0,
  max_speakers INTEGER DEFAULT 6,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ODA KATILIMCILARI
CREATE TABLE IF NOT EXISTS room_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'listener' CHECK (role IN ('host', 'speaker', 'listener')),
  is_muted BOOLEAN DEFAULT TRUE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- 4. MESAJLAR
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. SOPRANO COIN İŞLEMLERİ
CREATE TABLE IF NOT EXISTS coin_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'gift_sent', 'gift_received', 'room_boost', 'reward')),
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ARKADAŞLIKLAR
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- ============================================
-- İNDEXLER (performans)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rooms_live ON rooms(is_live) WHERE is_live = TRUE;
CREATE INDEX IF NOT EXISTS idx_room_participants_room ON room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_user ON coin_transactions(user_id);

-- ============================================
-- RPC FONKSİYONLARI
-- ============================================

-- Dinleyici sayısını artır
CREATE OR REPLACE FUNCTION increment_listener_count(room_id_input UUID)
RETURNS void AS $$
BEGIN
  UPDATE rooms
  SET listener_count = listener_count + 1
  WHERE id = room_id_input;
END;
$$ LANGUAGE plpgsql;

-- Dinleyici sayısını azalt
CREATE OR REPLACE FUNCTION decrement_listener_count(room_id_input UUID)
RETURNS void AS $$
BEGIN
  UPDATE rooms
  SET listener_count = GREATEST(0, listener_count - 1)
  WHERE id = room_id_input;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- Firebase Auth kullandığımız için basit politikalar
-- anon key ile erişim sağlanır
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE coin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- Tüm tablolara anon erişim (Firebase Auth ile koruma uygulama katmanında)
DROP POLICY IF EXISTS "Allow all for anon" ON profiles;
CREATE POLICY "Allow all for anon" ON profiles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for anon" ON rooms;
CREATE POLICY "Allow all for anon" ON rooms FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for anon" ON room_participants;
CREATE POLICY "Allow all for anon" ON room_participants FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for anon" ON messages;
CREATE POLICY "Allow all for anon" ON messages FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for anon" ON coin_transactions;
CREATE POLICY "Allow all for anon" ON coin_transactions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for anon" ON friendships;
CREATE POLICY "Allow all for anon" ON friendships FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- REALTIME — Mesajlar ve odalar için
-- (Zaten ekliyse hata vermez)
-- ============================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE room_participants;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- SOPRANO P2: SOSYAL Feed (Post)
-- ============================================
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SOPRANO P2: BİLDİRİMLER (Notifications)
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE, -- Bilgi gidecek kişi
  sender_id TEXT REFERENCES profiles(id) ON DELETE CASCADE, -- Eylemi yapan kişi
  type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'gift', 'follow')),
  reference_id UUID, -- post_id veya room_id
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SOPRANO P2: CANLI HEDİYELER (Gifts)
-- ============================================
CREATE TABLE IF NOT EXISTS gifts_catalog (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  animation_url TEXT NOT NULL,
  is_premium BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Temel Hediyeler (Gül, Kahve, Roket)
INSERT INTO gifts_catalog (id, name, price, animation_url)
VALUES 
  ('rose', 'Gül', 10, 'https://assets5.lottiefiles.com/packages/lf20_rose.json'),
  ('coffee', 'Kahve', 50, 'https://assets5.lottiefiles.com/packages/lf20_coffee.json'),
  ('rocket', 'Roket', 500, 'https://assets5.lottiefiles.com/packages/lf20_rocket.json')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS room_live_gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  sender_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  gift_id TEXT REFERENCES gifts_catalog(id) ON DELETE RESTRICT,
  amount INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Oda tablosuna boost alanı ekle
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS boost_expires_at TIMESTAMPTZ;

-- ============================================
-- INDEXLER
-- ============================================
CREATE INDEX IF NOT EXISTS idx_posts_userid ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_room_live_gifts_room ON room_live_gifts(room_id);

-- ============================================
-- RLS POLİTİKALARI (PHASE 2)
-- ============================================
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE gifts_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_live_gifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for anon" ON posts;
CREATE POLICY "Allow all for anon" ON posts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for anon" ON post_likes;
CREATE POLICY "Allow all for anon" ON post_likes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for anon" ON post_comments;
CREATE POLICY "Allow all for anon" ON post_comments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for anon" ON notifications;
CREATE POLICY "Allow all for anon" ON notifications FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for anon" ON gifts_catalog;
CREATE POLICY "Allow all for anon" ON gifts_catalog FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for anon" ON room_live_gifts;
CREATE POLICY "Allow all for anon" ON room_live_gifts FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- REALTIME YENİ TABLOLAR
-- ============================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE room_live_gifts;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- RPC: CANLI HEDİYE GÖNDERME İŞLEMİ (TRANSACTION)
-- Komisyon: %30 Sistem, %70 Alıcı
-- ============================================
CREATE OR REPLACE FUNCTION send_live_gift(
  p_room_id UUID,
  p_sender_id TEXT,
  p_receiver_id TEXT,
  p_gift_id TEXT
) RETURNS JSON AS $$
DECLARE
  v_gift_price INTEGER;
  v_sender_coins INTEGER;
  v_receiver_cut INTEGER;
  v_gift_record_id UUID;
BEGIN
  -- Hediyenin fiyatını al
  SELECT price INTO v_gift_price FROM gifts_catalog WHERE id = p_gift_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hediye bulunamadı';
  END IF;

  -- Gönderenin bakiyesini kontrol et
  SELECT coins INTO v_sender_coins FROM profiles WHERE id = p_sender_id;
  IF v_sender_coins < v_gift_price THEN
    RAISE EXCEPTION 'Yetersiz bakiye';
  END IF;

  -- 1. Gönderenden bakiyeyi düş
  UPDATE profiles SET coins = coins - v_gift_price WHERE id = p_sender_id;

  -- 2. Alıcıya %70'ini ekle
  v_receiver_cut := (v_gift_price * 0.70)::INTEGER;
  UPDATE profiles SET coins = coins + v_receiver_cut WHERE id = p_receiver_id;

  -- 3. Gönderen için Transaction kaydı
  INSERT INTO coin_transactions (user_id, amount, type, description)
  VALUES (p_sender_id, -v_gift_price, 'gift_sent', 'Hediye gönderimi: ' || p_gift_id);

  -- 4. Alıcı için Transaction kaydı
  INSERT INTO coin_transactions (user_id, amount, type, description)
  VALUES (p_receiver_id, v_receiver_cut, 'gift_received', 'Hediye alındı: ' || p_gift_id);

  -- 5. Realtime animasyonu tetiklemek için room_live_gifts tablosuna ekle
  INSERT INTO room_live_gifts (room_id, sender_id, receiver_id, gift_id)
  VALUES (p_room_id, p_sender_id, p_receiver_id, p_gift_id)
  RETURNING id INTO v_gift_record_id;

  -- 6. Alıcıya bildirim at
  INSERT INTO notifications (user_id, sender_id, type, reference_id)
  VALUES (p_receiver_id, p_sender_id, 'gift', v_gift_record_id);

  RETURN json_build_object('success', true, 'gift_record_id', v_gift_record_id, 'sender_remaining_coins', v_sender_coins - v_gift_price);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RPC: ODA BOOST İŞLEMİ
-- Bedeli: 50 Coin, Süre: 1 Saat
-- ============================================
CREATE OR REPLACE FUNCTION boost_room(
  p_room_id UUID,
  p_user_id TEXT
) RETURNS JSON AS $$
DECLARE
  v_user_coins INTEGER;
  v_boost_cost INTEGER := 50;
BEGIN
  -- Bakiye kontrol
  SELECT coins INTO v_user_coins FROM profiles WHERE id = p_user_id;
  IF v_user_coins < v_boost_cost THEN
    RAISE EXCEPTION 'Boost için yetersiz bakiye';
  END IF;

  -- Bakiyeyi düş
  UPDATE profiles SET coins = coins - v_boost_cost WHERE id = p_user_id;

  -- İşlem geçmişi
  INSERT INTO coin_transactions (user_id, amount, type, description)
  VALUES (p_user_id, -v_boost_cost, 'room_boost', 'Oda öne çıkarma (Boost)');

  -- Odayı boostla (Şu andan itibaren 1 hour = 60 minute olarak yazalım vs.)
  UPDATE rooms SET boost_expires_at = NOW() + INTERVAL '1 hour' WHERE id = p_room_id;

  RETURN json_build_object('success', true, 'remaining_coins', v_user_coins - v_boost_cost);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RPC: POST LIKE TOGGLE
-- ============================================
CREATE OR REPLACE FUNCTION toggle_post_like(
  p_post_id UUID,
  p_user_id TEXT
) RETURNS JSON AS $$
DECLARE
  v_exists BOOLEAN;
  v_post_owner_id TEXT;
BEGIN
  SELECT EXISTS(SELECT 1 FROM post_likes WHERE post_id = p_post_id AND user_id = p_user_id) INTO v_exists;
  
  IF v_exists THEN
    -- Like kaldır
    DELETE FROM post_likes WHERE post_id = p_post_id AND user_id = p_user_id;
    UPDATE posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = p_post_id;
    RETURN json_build_object('liked', false);
  ELSE
    -- Like at
    INSERT INTO post_likes (post_id, user_id) VALUES (p_post_id, p_user_id);
    UPDATE posts SET likes_count = likes_count + 1 WHERE id = p_post_id RETURNING user_id INTO v_post_owner_id;
    
    -- Bildirim at (Kendi kendine atmadıysa)
    IF v_post_owner_id != p_user_id THEN
      INSERT INTO notifications (user_id, sender_id, type, reference_id)
      VALUES (v_post_owner_id, p_user_id, 'like', p_post_id);
    END IF;
    
    RETURN json_build_object('liked', true);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. INBOX GET FONKSİYONU
-- N+1 sorgu problemini çözer, her partnerle olan son mesajı getirir.
-- ============================================
CREATE OR REPLACE FUNCTION get_user_inbox(p_user_id TEXT)
RETURNS TABLE (
  partner_id TEXT,
  partner_name TEXT,
  partner_avatar TEXT,
  partner_is_online BOOLEAN,
  last_message_content TEXT,
  last_message_time TIMESTAMPTZ,
  unread_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH ranked_messages AS (
    SELECT 
      m.id,
      m.content,
      m.created_at,
      m.is_read,
      CASE WHEN m.sender_id = p_user_id THEN m.receiver_id ELSE m.sender_id END as other_user_id,
      ROW_NUMBER() OVER(
        PARTITION BY CASE WHEN m.sender_id = p_user_id THEN m.receiver_id ELSE m.sender_id END 
        ORDER BY m.created_at DESC
      ) as rn
    FROM messages m
    WHERE m.sender_id = p_user_id OR m.receiver_id = p_user_id
  ),
  latest_messages AS (
    SELECT * FROM ranked_messages WHERE rn = 1
  ),
  unread_counts AS (
    SELECT 
      m.sender_id as other_user_id,
      COUNT(*) as count
    FROM messages m
    WHERE m.receiver_id = p_user_id AND m.is_read = FALSE
    GROUP BY m.sender_id
  )
  SELECT 
    lm.other_user_id,
    p.display_name,
    p.avatar_url,
    p.is_online,
    lm.content,
    lm.created_at,
    COALESCE(uc.count, 0) as unread_count
  FROM latest_messages lm
  JOIN profiles p ON p.id = lm.other_user_id
  LEFT JOIN unread_counts uc ON uc.other_user_id = lm.other_user_id
  ORDER BY lm.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
