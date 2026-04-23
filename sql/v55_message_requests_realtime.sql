-- ═══════════════════════════════════════════════════════════════════
-- v55 — message_requests tablosunu realtime publication'a ekle
-- Tarih: 2026-04-24
-- Amaç: Accept/reject işlemleri karşı tarafın ekranında anında
--   görünsün (sayfa yenilemeden). postgres_changes listener'ı
--   supabase_realtime publication'a ihtiyaç duyar.
-- ═══════════════════════════════════════════════════════════════════

-- Tablo zaten publication'da olabilir → hata yutulur.
ALTER PUBLICATION supabase_realtime ADD TABLE message_requests;

-- Doğrulama:
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'message_requests';
