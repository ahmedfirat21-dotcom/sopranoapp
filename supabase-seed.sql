-- ============================================
-- SopranoChat — Örnek Veriler (Seed Data)
-- Supabase SQL Editor'a yapıştır ve çalıştır
-- ============================================

-- 1. ÖRNEK KULLANICILAR
INSERT INTO profiles (id, username, display_name, avatar_url, bio, tier, coins, is_plus, is_online) VALUES
  ('user_ayse', 'aysek', 'Ayşe K.', 'https://i.pravatar.cc/120?img=3', '🎵 Müzik tutkunu | Soprano''da sesini duyur!', 'VIP', 1250, true, true),
  ('user_emre', 'djemre', 'DJ Emre', 'https://i.pravatar.cc/120?img=7', '🎧 Lo-fi beats & chill vibes', 'Plat', 850, true, true),
  ('user_can', 'canb', 'Can B.', 'https://i.pravatar.cc/120?img=12', '📚 Kitap kurdu | Tech enthusiast', 'Silver', 320, false, false),
  ('user_merve', 'mervey', 'Merve Y.', 'https://i.pravatar.cc/120?img=44', '🔥 Club DJ | Gece sohbetleri', 'VIP', 2100, true, true),
  ('user_selin', 'selind', 'Selin D.', 'https://i.pravatar.cc/120?img=33', '☕ Sohbet odası host | İyi geceler', 'Plat', 670, true, false),
  ('user_burak', 'burakt', 'Burak T.', 'https://i.pravatar.cc/120?img=51', '🎤 Rap battle şampiyonu', 'Silver', 480, false, true),
  ('user_deniz', 'deniza', 'Deniz A.', 'https://i.pravatar.cc/120?img=16', '🍿 Film gecesi organizatörü', 'Plat', 560, false, false),
  ('user_kaan', 'kaans', 'Kaan S.', 'https://i.pravatar.cc/120?img=55', '🎮 Valorant & CS2 takım kaptanı', 'Silver', 200, false, true)
ON CONFLICT (id) DO NOTHING;

-- 2. ÖRNEK CANLI ODALAR
INSERT INTO rooms (id, name, description, category, type, host_id, is_live, listener_count) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Gece Sohbeti ☕', 'Gece yarısı samimi sohbetler, herkes davetli!', 'chat', 'open', 'user_selin', true, 47),
  ('00000000-0000-0000-0000-000000000002', 'Lo-Fi & Chill 🌙', 'Rahatlatıcı müzik ve chill vibes. Çalışırken açın!', 'music', 'open', 'user_emre', true, 82),
  ('00000000-0000-0000-0000-000000000003', 'Teknoloji & AI 💻', 'Yapay zeka, yeni teknolojiler ve startup sohbetleri', 'tech', 'open', 'user_can', true, 23),
  ('00000000-0000-0000-0000-000000000004', 'Film Gecesi 🍿', 'Bu hafta ne izleyelim? Film önerileri ve tartışmalar', 'film', 'open', 'user_deniz', true, 35),
  ('00000000-0000-0000-0000-000000000005', 'Rap Battle 🎤', 'Freestyle rap yarışması! Sahneye çık!', 'music', 'open', 'user_burak', true, 56),
  ('00000000-0000-0000-0000-000000000006', 'Valorant Takım 🎮', 'Ranked takım arıyoruz, gelin!', 'game', 'open', 'user_kaan', true, 12),
  ('00000000-0000-0000-0000-000000000007', 'Akustik Cuma 🎸', 'Canlı akustik performanslar ve müzik sohbeti', 'music', 'open', 'user_ayse', true, 94),
  ('00000000-0000-0000-0000-000000000008', 'Kitap Kulübü 📖', 'Bu ayın kitabı: Sabahattin Ali tartışması', 'book', 'open', 'user_can', true, 18)
ON CONFLICT (id) DO NOTHING;

-- 3. ÖRNEK ODA KATILIMCILARI
INSERT INTO room_participants (room_id, user_id, role, is_muted) VALUES
  -- Gece Sohbeti
  ('00000000-0000-0000-0000-000000000001', 'user_selin', 'host', false),
  ('00000000-0000-0000-0000-000000000001', 'user_ayse', 'speaker', false),
  ('00000000-0000-0000-0000-000000000001', 'user_can', 'speaker', false),
  ('00000000-0000-0000-0000-000000000001', 'user_emre', 'listener', true),
  ('00000000-0000-0000-0000-000000000001', 'user_merve', 'listener', true),
  -- Lo-Fi & Chill
  ('00000000-0000-0000-0000-000000000002', 'user_emre', 'host', false),
  ('00000000-0000-0000-0000-000000000002', 'user_merve', 'speaker', false),
  ('00000000-0000-0000-0000-000000000002', 'user_ayse', 'listener', true),
  -- Teknoloji & AI
  ('00000000-0000-0000-0000-000000000003', 'user_can', 'host', false),
  ('00000000-0000-0000-0000-000000000003', 'user_kaan', 'speaker', false),
  -- Rap Battle
  ('00000000-0000-0000-0000-000000000005', 'user_burak', 'host', false),
  ('00000000-0000-0000-0000-000000000005', 'user_deniz', 'listener', true)
ON CONFLICT (room_id, user_id) DO NOTHING;

-- 4. ÖRNEK MESAJLAR
INSERT INTO messages (sender_id, receiver_id, content, is_read) VALUES
  ('user_ayse', 'user_emre', 'Selam! Mix''i dinledim harika olmuş 🎧', true),
  ('user_emre', 'user_ayse', 'Teşekkürler! Akşam yeni bir tane daha paylaşacağım', true),
  ('user_ayse', 'user_emre', 'Akşam etkinliğe gelecek misin? 🎸', false),
  ('user_can', 'user_ayse', 'Kitap tartışmasının linkini atar mısın?', true),
  ('user_ayse', 'user_can', 'Tabii! Oda açık, gel katıl 📚', true),
  ('user_merve', 'user_ayse', 'Bu gece odada görüşürüz! 🔥', false),
  ('user_selin', 'user_emre', 'Sohbet odasını açtım, gelin 💬', true),
  ('user_burak', 'user_ayse', 'Rap battle sonuçları geldi 🏆', false),
  ('user_merve', 'user_emre', 'Yeni mix ne zaman geliyor?', true),
  ('user_emre', 'user_merve', 'Bu akşam yayınlıyorum! Stay tuned 🎵', false),
  ('user_kaan', 'user_burak', 'Valorant''a gelin, takım hazır', true),
  ('user_burak', 'user_kaan', 'Geliyorum! 5 dk', true)
ON CONFLICT DO NOTHING;

-- 5. ÖRNEK COIN İŞLEMLERİ
INSERT INTO coin_transactions (user_id, amount, type, description) VALUES
  ('user_ayse', 500, 'purchase', 'Coin satın aldın'),
  ('user_ayse', -20, 'gift_sent', 'DJ Emre''ye hediye gönderdin'),
  ('user_ayse', -10, 'room_boost', 'Akustik Cuma odasını boost ettin'),
  ('user_ayse', 15, 'gift_received', 'Merve Y.''den hediye aldın'),
  ('user_emre', 1000, 'purchase', 'Coin satın aldın'),
  ('user_emre', -50, 'gift_sent', 'Ayşe K.''ya hediye gönderdin'),
  ('user_emre', 25, 'reward', 'Haftalık ödül kazandın'),
  ('user_merve', 500, 'purchase', 'Coin satın aldın'),
  ('user_merve', -30, 'room_boost', 'Club set odasını boost ettin')
ON CONFLICT DO NOTHING;

-- 6. ÖRNEK ARKADAŞLIKLAR
INSERT INTO friendships (user_id, friend_id, status) VALUES
  ('user_ayse', 'user_emre', 'accepted'),
  ('user_ayse', 'user_can', 'accepted'),
  ('user_ayse', 'user_merve', 'accepted'),
  ('user_emre', 'user_merve', 'accepted'),
  ('user_emre', 'user_selin', 'accepted'),
  ('user_can', 'user_kaan', 'accepted'),
  ('user_burak', 'user_kaan', 'accepted'),
  ('user_burak', 'user_deniz', 'pending')
ON CONFLICT (user_id, friend_id) DO NOTHING;
