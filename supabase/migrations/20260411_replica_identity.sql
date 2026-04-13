-- ★ Realtime DELETE olaylarında payload.old verisi tam gelsin
-- Notifications tablosunda DELETE yapıldığında client-side filtering için gerekli
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- Friendships tablosunda da realtime düzgün çalışsın
ALTER TABLE friendships REPLICA IDENTITY FULL;

-- ★ KRİTİK: Tabloları Supabase Realtime Publication'a ekle
-- Bu olmadan postgres_changes olayları hiç tetiklenmez!
DO $$
BEGIN
  -- notifications tablosunu ekle (zaten varsa hata vermesin)
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  EXCEPTION WHEN duplicate_object THEN
    NULL; -- zaten ekliyse devam
  END;
  
  -- friendships tablosunu ekle
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE friendships;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;
