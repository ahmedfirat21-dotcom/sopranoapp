-- ============================================
-- SopranoChat — Mağaza Genişletme + Algoritmalı Keşfet
-- Oda Temaları, Emoji Paketleri, Müzik DJ, Etkinlik Biletleme
-- ============================================

-- ==============================
-- 0. CHECK CONSTRAINT GÜNCELLEMESİ 
-- (Yeni mağaza ürün tiplerini kabul etmesi için)
-- ==============================
ALTER TABLE store_items DROP CONSTRAINT IF EXISTS store_items_type_check;
ALTER TABLE store_items DROP CONSTRAINT IF EXISTS item_type_check; -- Bazen bu isimde olabilir
ALTER TABLE store_items ADD CONSTRAINT store_items_type_check CHECK (type IN ('profile_frame', 'chat_bubble', 'entry_effect', 'room_theme', 'emoji_pack', 'gift'));

-- ==============================
-- 1. ODA TEMALARI (room_theme)
-- ==============================
INSERT INTO store_items (id, name, description, type, price_coins, rarity, is_limited, is_active) VALUES
  ('theme_neon_city',    '🌃 Neon City',       'Siber-punk neon ışıklı oda teması',          'room_theme', 100, 'rare',    false, true),
  ('theme_retro_sunset', '🌅 Retro Sunset',    '80ler retro gün batımı teması',              'room_theme', 80,  'common',  false, true),
  ('theme_deep_ocean',   '🌊 Derin Okyanus',   'Sakin mavi tonları, su altı ambiyansı',       'room_theme', 120, 'rare',    false, true),
  ('theme_sakura',       '🌸 Sakura Bahçesi',  'Japon kiraz çiçeği teması',                  'room_theme', 150, 'epic',    false, true),
  ('theme_dark_throne',  '🏰 Karanlık Taht',   'Gotik karanlık kale teması — efsanevi!',      'room_theme', 350, 'legendary', true, true),
  ('theme_space',        '🚀 Uzay İstasyonu',  'Galaksi ve yıldızlar arasında sohbet',        'room_theme', 200, 'epic',    false, true),
  ('theme_forest',       '🌿 Orman Sessizliği', 'Doğa sesleri ve yeşil tonlar',              'room_theme', 60,  'common',  false, true)
ON CONFLICT (id) DO NOTHING;


-- ==============================
-- 2. EMOJİ / STİCKER PAKETLERİ
-- ==============================
-- Yeni tür: 'emoji_pack' ekliyoruz (store_items type enum'ına)
-- Not: Eğer type sütunu enum ise önce yeni değeri eklememiz gerekir
-- ALTER TYPE item_type ADD VALUE IF NOT EXISTS 'emoji_pack';
-- Eğer text ise ek bir işlem gerekmez

INSERT INTO store_items (id, name, description, type, price_coins, rarity, is_limited, is_active) VALUES
  ('emoji_classic',   '😎 Klasik Paket',    '50 adet temel emoji ve ifade',             'emoji_pack', 20,  'common',  false, true),
  ('emoji_anime',     '🎌 Anime Paket',     'Kawaii anime sticker koleksiyonu (30 adet)', 'emoji_pack', 50,  'rare',    false, true),
  ('emoji_meme',      '😂 Meme Lords',      'Popüler internet memeleri sticker paketi',   'emoji_pack', 40,  'common',  false, true),
  ('emoji_love',      '💕 Aşk Paketi',      'Romantik kalpler ve sevgi ifadeleri',        'emoji_pack', 30,  'common',  false, true),
  ('emoji_soprano',   '🎤 Soprano Özel',    'SopranoChat\''a özel premium stickerlar',    'emoji_pack', 100, 'epic',    true,  true),
  ('emoji_seasonal',  '🎄 Sezon Paketi',    'Sınırlı üretim mevsimsel sticker paketi',   'emoji_pack', 75,  'legendary', true, true)
ON CONFLICT (id) DO NOTHING;


-- ==============================
-- 3. ETKİNLİK BİLETLEME
-- ==============================
-- Etkinliklere bilet bedeli ekleme
ALTER TABLE events
ADD COLUMN IF NOT EXISTS ticket_price_coins INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_attendees INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false;


-- ==============================
-- 4. ALGORİTMALI KEŞFET (Engagement-Based Sıralama)
-- ==============================
-- (Varsayılan olarak 'messages' tablosunda 'room_id' sütunu eklendiğinden emin olalım)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id) ON DELETE CASCADE;

-- Odalar için engagement skoru hesaplama view'ı
CREATE OR REPLACE VIEW room_engagement AS
SELECT
  r.id,
  r.name,
  r.host_id,
  r.category,
  r.listener_count,
  r.is_live,
  r.created_at,
  r.boost_expires_at,
  -- Engagement skoru: dinleyici + hediye + mesaj
  COALESCE(r.listener_count, 0) * 2
    + COALESCE(gift_counts.gift_count, 0) * 5
    + COALESCE(msg_counts.msg_count, 0) * 1
  AS engagement_score
FROM rooms r
LEFT JOIN (
  SELECT room_id, COUNT(*) as gift_count
  FROM room_live_gifts
  WHERE created_at > NOW() - INTERVAL '1 hour'
  GROUP BY room_id
) gift_counts ON r.id = gift_counts.room_id
LEFT JOIN (
  SELECT room_id, COUNT(*) as msg_count
  FROM messages
  WHERE created_at > NOW() - INTERVAL '1 hour'
  GROUP BY room_id
) msg_counts ON r.id = msg_counts.room_id
WHERE r.is_live = true;


-- ==============================
-- 5. MÜZİK DJ MODU İÇİN TABLO
-- ==============================
CREATE TABLE IF NOT EXISTS room_music_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  added_by TEXT REFERENCES profiles(id) NOT NULL,
  track_url TEXT NOT NULL,
  track_title TEXT NOT NULL,
  track_artist TEXT DEFAULT '',
  duration_seconds INT DEFAULT 0,
  position INT DEFAULT 0,
  is_playing BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- DJ modu için indeks
CREATE INDEX IF NOT EXISTS idx_music_queue_room ON room_music_queue(room_id, position);

-- RLS
ALTER TABLE room_music_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "room_music_select" ON room_music_queue
  FOR SELECT USING (true);

CREATE POLICY "room_music_insert" ON room_music_queue
  FOR INSERT WITH CHECK (auth.uid()::text = added_by::text);

CREATE POLICY "room_music_delete" ON room_music_queue
  FOR DELETE USING (
    auth.uid()::text = added_by::text
    OR auth.uid()::text = (SELECT host_id::text FROM rooms WHERE id = room_id)
  );


-- ==============================
-- 6. ODA KONUŞMACI ÖNCELİĞİ BİLGİSİ
-- ==============================
ALTER TABLE room_participants
ADD COLUMN IF NOT EXISTS hand_raised_at TIMESTAMPTZ DEFAULT NULL;


-- ==============================
-- store_items type enum güncelleme (eğer enum ise)
-- ==============================
-- Bu satırları sadece type sütunu enum türündeyse çalıştırın:
-- ALTER TYPE item_type ADD VALUE IF NOT EXISTS 'room_theme';
-- ALTER TYPE item_type ADD VALUE IF NOT EXISTS 'emoji_pack';

-- Not: Bu SQL'i Supabase SQL Editor'de çalıştırın.
