-- ============================================
-- SOPRANOCHAT PHASE 2 - STEP 5: ROOM LIVE CHAT
-- ============================================

-- 1. YENİ SÜTUNLAR: `messages` tablosuna `room_id` ve `type` (kategorizasyon) ekleniyor.
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'room_id') THEN
    ALTER TABLE messages ADD COLUMN room_id UUID REFERENCES rooms(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'type') THEN
    ALTER TABLE messages ADD COLUMN type TEXT DEFAULT 'user' CHECK (type IN ('user', 'system'));
  END IF;
END $$;

-- 'receiver_id' oda mesajlarında boştur (NULL destekliyor mu diye emin olmak için setliyoruz):
-- Zaten "CREATE TABLE IF NOT EXISTS messages" scriptinde receiver_id'de NOT NULL yok.
-- Ek olarak oda mesajı sorgulamasını hızlı halletmek için index:
CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id);

-- 2. SİSTEM MESAJI THROTLLING (KATILMA İÇİN)
-- Bir kullanıcı odaya gir-çık spam yaparsa her seferinde "katıldı" mesajı basmamak için
CREATE OR REPLACE FUNCTION record_room_join_system_message(
  p_room_id UUID,
  p_user_id TEXT
)
RETURNS void
AS $$
DECLARE
  v_recent_message_count INTEGER;
BEGIN
  -- Bu kullanicinin son 5 dakikada bu odada "odaya katıldı" type='system' mesaji var mi?
  SELECT COUNT(*) INTO v_recent_message_count 
  FROM messages
  WHERE room_id = p_room_id 
    AND type = 'system' 
    AND sender_id = p_user_id
    AND content = 'odaya katıldı'
    AND created_at > NOW() - INTERVAL '5 minutes';

  -- Yoksa yeni bir sistem mesaji olustur
  IF v_recent_message_count = 0 THEN
    INSERT INTO messages (room_id, sender_id, type, content)
    VALUES (p_room_id, p_user_id, 'system', 'odaya katıldı');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. HEDİYE SİSTEM MESAJI KAYDI
-- Hediyeler her zaman sistem mesaji atar
CREATE OR REPLACE FUNCTION record_gift_system_message(
  p_room_id UUID,
  p_sender_id TEXT,
  p_gift_name TEXT
)
RETURNS void
AS $$
BEGIN
  INSERT INTO messages (room_id, sender_id, type, content)
  VALUES (p_room_id, p_sender_id, 'system', p_gift_name || ' hediye etti');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
