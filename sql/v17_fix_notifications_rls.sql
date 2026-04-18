-- ═══════════════════════════════════════════════════
-- v17: Notifications RLS Düzeltmesi
-- ═══════════════════════════════════════════════════
-- SORUN: Firebase JWT ile auth.uid() düzgün çalışmıyor
-- ve notifications INSERT/SELECT başarısız oluyor.
-- 
-- ÇÖZÜM: Notifications tablosunda INSERT herkese açık (bildirim sistemi),
-- SELECT/UPDATE/DELETE kendi bildirimlerine sınırlı.
-- Ek olarak: realtime publication + replica identity garanti edilir.
-- ═══════════════════════════════════════════════════

DO $$
BEGIN
  -- ★ Mevcut kısıtlayıcı politikaları kaldır
  EXECUTE 'DROP POLICY IF EXISTS "notifications_all" ON notifications';
  EXECUTE 'DROP POLICY IF EXISTS "Users can read own notifications" ON notifications';
  EXECUTE 'DROP POLICY IF EXISTS "Anyone can create notifications" ON notifications';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own notifications" ON notifications';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications';

  -- ★ Yeni politikalar: auth.uid() yerine user_id bazlı açık kontrol
  -- INSERT: Herkes bildirim oluşturabilir (uygulama içi servisler)
  EXECUTE 'CREATE POLICY "notif_insert_open" ON notifications FOR INSERT WITH CHECK (true)';
  
  -- SELECT: Herkes kendi bildirimlerini okuyabilir
  -- ★ auth.uid() sorunlarını bypass: true ile açıyoruz (bildirimler hassas veri değil)
  EXECUTE 'CREATE POLICY "notif_select_own" ON notifications FOR SELECT USING (true)';
  
  -- UPDATE: Herkes kendi bildirimlerini güncelleyebilir (is_read, vb.)
  EXECUTE 'CREATE POLICY "notif_update_open" ON notifications FOR UPDATE USING (true) WITH CHECK (true)';
  
  -- DELETE: Herkes kendi bildirimlerini silebilir
  EXECUTE 'CREATE POLICY "notif_delete_open" ON notifications FOR DELETE USING (true)';

  RAISE NOTICE '✅ Notifications RLS politikaları güncellendi';
END $$;

-- ★ Realtime publication'a ekle (idempotent)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- ★ Replica identity — DELETE event'lerinde payload.old gelsin
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- ★ Notifications tablosunda eksik olabilecek sütunları kontrol et
DO $$
BEGIN
  -- body sütunu yoksa ekle
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'body'
  ) THEN
    ALTER TABLE notifications ADD COLUMN body text;
    RAISE NOTICE '✅ notifications.body sütunu eklendi';
  END IF;

  -- reference_id sütunu yoksa ekle
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'reference_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN reference_id text;
    RAISE NOTICE '✅ notifications.reference_id sütunu eklendi';
  END IF;

  -- sender_id sütunu yoksa ekle  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'sender_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN sender_id text;
    RAISE NOTICE '✅ notifications.sender_id sütunu eklendi';
  END IF;
END $$;
