-- ═══ Realtime DELETE desteği için REPLICA IDENTITY ═══
-- Supabase Realtime DELETE olaylarında payload.old verisini göndermek için
-- REPLICA IDENTITY FULL gerekir. Varsayılan (DEFAULT) sadece PK gönderir.
-- Bu migration, room_participants ve sp_transactions tablolarını
-- Realtime DELETE callback'lerinde user_id erişilebilir hale getirir.

ALTER TABLE room_participants REPLICA IDENTITY FULL;
ALTER TABLE sp_transactions REPLICA IDENTITY FULL;

-- ═══ Realtime Publication kontrolü ═══
-- Supabase Dashboard'da bu tablolar zaten realtime publication'a ekliyse
-- aşağıdaki komut hata verebilir — güvenle yok sayılabilir.
-- ALTER PUBLICATION supabase_realtime ADD TABLE room_participants;
-- ALTER PUBLICATION supabase_realtime ADD TABLE sp_transactions;
