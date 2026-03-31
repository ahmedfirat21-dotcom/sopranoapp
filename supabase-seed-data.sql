-- 1A) Örnek Profiller (10 adet sahte kullanıcı)
INSERT INTO profiles (id, display_name, username, bio, avatar_url, is_online, coins, is_plus, gender, birth_date, created_at)
VALUES
  ('bot_soprano_official', 'SopranoChat', 'sopranochat', '🎙️ Resmi SopranoChat hesabı. Hoş geldiniz!', 'avatar_m_10.png', true, 99999, true, 'unspecified', '2000-01-01', NOW()),
  ('bot_dj_eren', 'DJ Eren', 'djeren', '🎵 Müzik tutkunu, canlı yayıncı', 'avatar_m_2.png', true, 5000, true, 'male', '1995-03-15', NOW()),
  ('bot_ayse_k', 'Ayşe K.', 'aysek', '☕ Kahve ve sohbet aşığı', 'avatar_f_1.png', true, 1200, false, 'female', '1998-07-22', NOW()),
  ('bot_mehmet_y', 'Mehmet Y.', 'mehmety', '⚽ Spor, teknoloji, oyun', 'avatar_m_3.png', false, 800, false, 'male', '1996-11-08', NOW()),
  ('bot_zeynep_d', 'Zeynep D.', 'zeynepd', '🎨 Tasarımcı, hayalperest', 'avatar_f_2.png', true, 2500, true, 'female', '1999-02-14', NOW()),
  ('bot_can_b', 'Can B.', 'canb', '🎸 Müzisyen | Gitar & Vokal', 'avatar_m_4.png', false, 600, false, 'male', '1997-09-30', NOW()),
  ('bot_elif_s', 'Elif S.', 'elifs', '📚 Kitap kurdu, podcast dinleyici', 'avatar_f_3.png', true, 1800, false, 'female', '2000-05-12', NOW()),
  ('bot_ali_r', 'Ali R.', 'alir', '💻 Yazılımcı, startup meraklısı', 'avatar_m_5.png', true, 3000, true, 'male', '1994-12-25', NOW()),
  ('bot_selin_t', 'Selin T.', 'selint', '🌸 Yoga & meditasyon', 'avatar_f_4.png', false, 900, false, 'female', '2001-04-18', NOW()),
  ('bot_murat_k', 'Murat K.', 'muratk', '🎮 Gamer, e-spor takipçisi', 'avatar_m_6.png', true, 1500, false, 'male', '1998-08-05', NOW())
ON CONFLICT (id) DO UPDATE SET 
  avatar_url = EXCLUDED.avatar_url,
  display_name = EXCLUDED.display_name,
  bio = EXCLUDED.bio,
  gender = EXCLUDED.gender;

-- 1B) Örnek Odalar (6 adet canlı oda)
INSERT INTO rooms (id, name, description, host_id, category, type, is_live, listener_count, created_at)
VALUES
  (gen_random_uuid(), '☕ Sabah Kahvesi Sohbet', 'Güne güzel bir sohbetle başlayalım!', 'bot_soprano_official', 'chat', 'open', true, 12, NOW()),
  (gen_random_uuid(), '🎵 Chill Müzik & Takılmaca', 'Rahatlatıcı müzikler eşliğinde sohbet', 'bot_dj_eren', 'music', 'open', true, 28, NOW()),
  (gen_random_uuid(), '⚽ Süper Lig Tartışma', 'Haftanın maçlarını konuşuyoruz', 'bot_mehmet_y', 'chat', 'open', true, 15, NOW()),
  (gen_random_uuid(), '💻 Yazılımcılar Buluşması', 'Kodlama, kariyer, teknoloji', 'bot_ali_r', 'tech', 'open', true, 8, NOW()),
  (gen_random_uuid(), '🎮 Gece Oyun Muhabbeti', 'Valorant, CS2, LoL ve dahası', 'bot_murat_k', 'game', 'open', true, 19, NOW()),
  (gen_random_uuid(), '📚 Kitap Kulübü', 'Bu ayın kitabını tartışıyoruz', 'bot_elif_s', 'book', 'open', true, 6, NOW())
ON CONFLICT DO NOTHING;

-- 1C) Örnek Postlar (8 adet)
INSERT INTO posts (id, user_id, content, image_url, likes_count, comments_count, created_at)
VALUES
  (gen_random_uuid(), 'bot_soprano_official', '🎙️ SopranoChat''a hoş geldiniz! Sesinizi duyurun, gerçek bağlantılar kurun. İlk odanızı açmayı deneyin!', null, 24, 5, NOW() - INTERVAL '2 hours'),
  (gen_random_uuid(), 'bot_dj_eren', '🎵 Bu akşam saat 21:00''da canlı DJ set yapıyorum! Herkesi bekliyorum 🔥', null, 18, 3, NOW() - INTERVAL '4 hours'),
  (gen_random_uuid(), 'bot_ayse_k', 'Bugünkü kahve modum: Türk kahvesi + bir tutam tarçın ☕✨ Sizin favoriniz ne?', 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800', 31, 8, NOW() - INTERVAL '6 hours'),
  (gen_random_uuid(), 'bot_zeynep_d', 'Yeni profil çerçevemi gördünüz mü? Mağazadan "Neon Cyber" aldım, çok fena 💎', null, 15, 2, NOW() - INTERVAL '8 hours'),
  (gen_random_uuid(), 'bot_mehmet_y', 'Galatasaray - Fenerbahçe derbisi hakkında ne düşünüyorsunuz? Oda açtım gelin konuşalım ⚽🔥', null, 42, 12, NOW() - INTERVAL '10 hours'),
  (gen_random_uuid(), 'bot_can_b', 'Akustik gitar session yaptım, dinlemek isteyenler oda açsın beni davet etsin 🎸', null, 11, 1, NOW() - INTERVAL '1 day'),
  (gen_random_uuid(), 'bot_ali_r', 'React Native mi Flutter mı? Bu tartışma hiç bitmeyecek 😄 Yazılımcılar Buluşması odasında konuşalım', null, 27, 9, NOW() - INTERVAL '1 day'),
  (gen_random_uuid(), 'bot_selin_t', 'Sabah meditasyonu yapan var mı? Her gün 10 dakika bile fark yaratıyor 🧘‍♀️', 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800', 19, 4, NOW() - INTERVAL '2 days')
ON CONFLICT DO NOTHING;

-- 1D) Örnek Etkinlikler (3 adet gelecek tarihli)
INSERT INTO events (id, host_id, title, description, category, scheduled_at, duration_minutes, max_participants, created_at)
VALUES
  (gen_random_uuid(), 'bot_dj_eren', '🎵 Cuma Gecesi DJ Set', 'Her cuma saat 21:00 canlı müzik! Tüm türler, isteklerinizi alıyorum.', 'Müzik', NOW() + INTERVAL '2 days', 120, 50, NOW()),
  (gen_random_uuid(), 'bot_ali_r', '💻 Junior Dev Mentorluk Saati', 'Yazılıma yeni başlayanlar için soru-cevap. CV değerlendirmesi de yapılacak.', 'Eğitim', NOW() + INTERVAL '3 days', 90, 30, NOW()),
  (gen_random_uuid(), 'bot_soprano_official', '🎤 SopranoChat Açılış Partisi', 'Herkesi tanıyalım! Ödüllü quiz, hediye yağmuru ve sürprizler.', 'Sohbet', NOW() + INTERVAL '5 days', 180, 100, NOW())
ON CONFLICT DO NOTHING;

-- 1E) Odaların katılımcılarını ekle (odalar boş görünmesin)
CREATE OR REPLACE FUNCTION seed_room_participants()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  r RECORD;
  bot_ids TEXT[] := ARRAY['bot_ayse_k', 'bot_mehmet_y', 'bot_zeynep_d', 'bot_can_b', 'bot_elif_s', 'bot_selin_t', 'bot_murat_k'];
  i INTEGER;
BEGIN
  FOR r IN SELECT id, host_id FROM rooms WHERE host_id LIKE 'bot_%' LOOP
    -- Host'u ekle
    INSERT INTO room_participants (room_id, user_id, role, is_muted)
    VALUES (r.id, r.host_id, 'host', false)
    ON CONFLICT DO NOTHING;
    
    -- Rastgele 2-4 dinleyici ekle
    FOR i IN 1..LEAST(4, array_length(bot_ids, 1)) LOOP
      IF bot_ids[i] != r.host_id THEN
        INSERT INTO room_participants (room_id, user_id, role, is_muted)
        VALUES (r.id, bot_ids[i], 'listener', true)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

SELECT seed_room_participants();
DROP FUNCTION seed_room_participants();

-- 1F) Bot'lar arası takip (sosyal graf boş olmasın)
INSERT INTO friendships (user_id, friend_id, status) VALUES
  ('bot_ayse_k', 'bot_soprano_official', 'accepted'),
  ('bot_mehmet_y', 'bot_soprano_official', 'accepted'),
  ('bot_zeynep_d', 'bot_soprano_official', 'accepted'),
  ('bot_dj_eren', 'bot_soprano_official', 'accepted'),
  ('bot_can_b', 'bot_dj_eren', 'accepted'),
  ('bot_elif_s', 'bot_ayse_k', 'accepted'),
  ('bot_ali_r', 'bot_dj_eren', 'accepted'),
  ('bot_selin_t', 'bot_zeynep_d', 'accepted'),
  ('bot_murat_k', 'bot_mehmet_y', 'accepted'),
  ('bot_ayse_k', 'bot_elif_s', 'accepted')
ON CONFLICT DO NOTHING;
