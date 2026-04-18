-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v29 — Mock/Seed Veri Temizliği
--
-- Eski v13_seed_rich_rooms.sql çalıştırılmış olabilir. O script:
--   - Tüm rooms tablosunu DELETE FROM ediyor (tehlikeli!)
--   - Jazz / Bitcoin / Geyik / Valorant sahte odaları insert ediyor
-- Bu migration yalnızca o sahte odaları + sistem odalarını temizler.
-- Gerçek kullanıcı odalarına dokunmaz.
-- ════════════════════════════════════════════════════════════════════


-- 1. v13_seed sahte odaları — title pattern match (tam eşleşme)
DELETE FROM rooms
  WHERE name IN (
    '🔥 Gece Jazz & Muhabbet 🎷',
    'Bitcoin Yine Ne Olacak? 📉',
    'Geyik, Sohbet, Goygoy ☕',
    'Valorant Rank Kasıyoruz 🎮'
  );


-- 2. Kod seviyesi SHOWCASE_ROOMS — system_ prefix'li ID'ler
-- services/showcaseRooms.ts bu ID'leri kullanıyordu (system_genel vs.).
-- Artık SHOWCASE_ROOMS = [] olacak, DB'de kalıntı varsa sil.
DELETE FROM rooms WHERE id::text LIKE 'system\_%' ESCAPE '\';


-- 3. is_system_room flag'i varsa (kolon var ise) → hepsini sil
DO $$ BEGIN
  DELETE FROM rooms WHERE is_system_room = true;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;


-- 4. Sahte host_id'ye bağlı yetim kayıtlar (seed'in sahte profilleri varsa)
-- profiles tablosu user auth'a bağlı olduğu için auto cascade var;
-- ama silinmiş user'a bağlı rooms kalmış olabilir.
DELETE FROM rooms
  WHERE host_id NOT IN (SELECT id FROM profiles);


-- ═══ DONE ═══
-- Gerçek kullanıcı odaları etkilenmez. Eğer başlık eşleşen gerçek oda
-- varsa (çok düşük ihtimal) o da silinir — üretimde önce SELECT'le doğrula.
