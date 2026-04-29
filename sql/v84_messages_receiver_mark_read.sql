-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v84 — Receivers can mark messages as read
--
-- Sorun: messages tablosunda mevcut UPDATE policy "Users can update
-- own messages" sadece sender_id = app_uid() durumunda izin veriyor.
-- Bu, alıcının `markAsRead` çağrısını silently blokluyor → is_read=false
-- kalıyor → realtime UPDATE yayılmıyor → konuşma listesi badge'i takılı.
--
-- Çözüm: Yeni permissive UPDATE policy ekle — receiver da kendi aldığı
-- mesajı update edebilir. Yan etki olarak teorik content edit riski var
-- ama client sadece is_read=true gönderiyor; ek güvenlik için BEFORE
-- UPDATE trigger ile receiver'ın is_read dışındaki kolonları
-- değiştirmesini blokluyoruz.
-- ════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════
-- 1. Receiver UPDATE policy
-- ═══════════════════════════════════════════════════
DROP POLICY IF EXISTS "Receivers can mark messages as read" ON messages;

CREATE POLICY "Receivers can mark messages as read"
ON messages
FOR UPDATE
USING (app_uid() = receiver_id)
WITH CHECK (app_uid() = receiver_id);


-- ═══════════════════════════════════════════════════
-- 2. Receiver field-level guard trigger
--    Receiver sadece is_read kolonunu değiştirebilir; content,
--    sender_id, created_at gibi kolonlara dokunamaz.
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION messages_receiver_field_guard()
RETURNS TRIGGER AS $$
DECLARE
  v_caller TEXT;
BEGIN
  v_caller := app_uid();

  -- Sender update'leri serbest (mevcut policy, eski davranış)
  IF v_caller = OLD.sender_id THEN
    RETURN NEW;
  END IF;

  -- Receiver update: sadece is_read değişebilir
  IF v_caller = OLD.receiver_id THEN
    IF NEW.content IS DISTINCT FROM OLD.content THEN
      RAISE EXCEPTION 'Alıcı mesaj içeriğini değiştiremez.' USING ERRCODE = '42501';
    END IF;
    IF NEW.sender_id IS DISTINCT FROM OLD.sender_id THEN
      RAISE EXCEPTION 'Alıcı sender_id değiştiremez.' USING ERRCODE = '42501';
    END IF;
    IF NEW.receiver_id IS DISTINCT FROM OLD.receiver_id THEN
      RAISE EXCEPTION 'Alıcı receiver_id değiştiremez.' USING ERRCODE = '42501';
    END IF;
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Alıcı created_at değiştiremez.' USING ERRCODE = '42501';
    END IF;
    -- is_read değişimi serbest
    RETURN NEW;
  END IF;

  -- Diğer durumlar — RLS policy zaten engeller, defense-in-depth
  RAISE EXCEPTION 'Bu mesajı güncelleme yetkin yok.' USING ERRCODE = '42501';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_messages_receiver_field_guard ON messages;
CREATE TRIGGER trg_messages_receiver_field_guard
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION messages_receiver_field_guard();


-- ═══ DONE ═══
-- Test:
--   1. A→B mesaj gönder
--   2. B olarak: UPDATE messages SET is_read=true WHERE receiver_id=B AND sender_id=A
--      → Başarılı olmalı (eskiden RLS blokluyordu)
--   3. B olarak: UPDATE messages SET content='hacked' WHERE id=...
--      → "Alıcı mesaj içeriğini değiştiremez" hatası
