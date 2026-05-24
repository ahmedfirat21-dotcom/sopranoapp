-- ★ v1.7.13.70 (20 May 2026): Hayalet katılımcı temizlik cron'u
--
-- cleanup_ghost_participants() fonksiyonu zaten DB'de mevcut.
-- Bu migration onu her 2 dakikada bir çalıştıracak şekilde planlar.
--
-- Davranış:
--   - last_heartbeat_at < NOW() - 5 minutes olan room_participants kayıtlarını siler
--   - Etkilenen odaların listener_count'unu yeniden hesaplar
--   - Profiles/rooms tablolarına dokunmaz, sadece geçici katılımcı kayıtları
--
-- Geri alma:
--   SELECT cron.unschedule('cleanup-ghost-participants');

SELECT cron.schedule(
  'cleanup-ghost-participants',
  '*/2 * * * *',
  'SELECT cleanup_ghost_participants();'
);
