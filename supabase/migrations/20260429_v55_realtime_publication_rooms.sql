-- ═══════════════════════════════════════════════════════════════════
-- v55 — Realtime publication'a rooms + eksik tablolar ekle
-- Tarih: 2026-04-22
-- Amaç: Keşfet/Odalarım ekranlarında rooms INSERT/UPDATE/DELETE olayları
-- dinlenmiyor çünkü supabase_realtime publication'da değil (v9 kontrolleri
-- yorumluydu). Ek olarak REPLICA IDENTITY FULL set ediliyor ki DELETE
-- payload'ı old.* verisini içersin.
-- ═══════════════════════════════════════════════════════════════════

-- REPLICA IDENTITY FULL — DELETE events için gerekli
ALTER TABLE rooms REPLICA IDENTITY FULL;

-- Tabloları supabase_realtime publication'a ekle (idempotent)
DO $$
BEGIN
  -- rooms
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
  END IF;

  -- room_participants (v9'da zaten olabilir ama idempotent garanti)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'room_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE room_participants;
  END IF;

  -- messages (DM realtime için)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;

  -- message_requests (v54 eklendi)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'message_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE message_requests;
  END IF;
END $$;

-- Doğrulama:
-- SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' ORDER BY tablename;
