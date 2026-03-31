-- ============================================
-- SopranoChat — Push Bildirim Trigger'ları
-- DM, Hediye, Oda Daveti geldiğinde otomatik push gönderir
-- ============================================

-- 1. Yeni DM geldiğinde push bildirim gönder
CREATE OR REPLACE FUNCTION notify_new_dm()
RETURNS TRIGGER AS $$
DECLARE
  sender_name TEXT;
  receiver_token TEXT;
  msg_preview TEXT;
BEGIN
  -- Gönderenin adını al
  SELECT display_name INTO sender_name
  FROM profiles WHERE id = NEW.sender_id;

  -- Alıcının push token'ını al
  SELECT push_token INTO receiver_token
  FROM profiles WHERE id = NEW.receiver_id;

  -- Token yoksa çık
  IF receiver_token IS NULL OR receiver_token = '' THEN
    RETURN NEW;
  END IF;

  -- Mesaj önizlemesi (max 60 karakter)
  msg_preview := LEFT(NEW.content, 60);
  IF LENGTH(NEW.content) > 60 THEN
    msg_preview := msg_preview || '...';
  END IF;

  -- Expo Push API'ye HTTP istek at
  PERFORM net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Accept', 'application/json'
    ),
    body := jsonb_build_object(
      'to', receiver_token,
      'title', '💬 ' || COALESCE(sender_name, 'Birisi'),
      'body', msg_preview,
      'sound', 'default',
      'data', jsonb_build_object(
        'type', 'dm',
        'route', '/chat/' || NEW.sender_id
      )
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Push hatası uygulamayı engellemesin
  RAISE WARNING 'Push bildirim hatası (DM): %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_new_dm ON messages;
CREATE TRIGGER trg_notify_new_dm
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_dm();


-- 2. Hediye geldiğinde push bildirim gönder
CREATE OR REPLACE FUNCTION notify_gift_received()
RETURNS TRIGGER AS $$
DECLARE
  sender_name TEXT;
  receiver_token TEXT;
  gift_label TEXT;
BEGIN
  -- Gönderenin adını al
  SELECT display_name INTO sender_name
  FROM profiles WHERE id = NEW.sender_id;

  -- Alıcının push token'ını al
  SELECT push_token INTO receiver_token
  FROM profiles WHERE id = NEW.receiver_id;

  IF receiver_token IS NULL OR receiver_token = '' THEN
    RETURN NEW;
  END IF;

  -- Hediye ismi
  gift_label := COALESCE(NEW.gift_id, 'hediye');

  PERFORM net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Accept', 'application/json'
    ),
    body := jsonb_build_object(
      'to', receiver_token,
      'title', '🎁 Hediye Aldın!',
      'body', COALESCE(sender_name, 'Birisi') || ' sana ' || gift_label || ' gönderdi!',
      'sound', 'default',
      'data', jsonb_build_object(
        'type', 'gift',
        'route', '/notifications'
      )
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Push bildirim hatası (Gift): %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_gift ON room_live_gifts;
CREATE TRIGGER trg_notify_gift
  AFTER INSERT ON room_live_gifts
  FOR EACH ROW
  EXECUTE FUNCTION notify_gift_received();


-- 3. Takip isteği geldiğinde push bildirim gönder
CREATE OR REPLACE FUNCTION notify_follow_request()
RETURNS TRIGGER AS $$
DECLARE
  sender_name TEXT;
  receiver_token TEXT;
BEGIN
  -- Sadece yeni istek (pending) durumları için
  IF NEW.status != 'pending' AND NEW.status != 'accepted' THEN
    RETURN NEW;
  END IF;

  SELECT display_name INTO sender_name
  FROM profiles WHERE id = NEW.user_id;

  SELECT push_token INTO receiver_token
  FROM profiles WHERE id = NEW.friend_id;

  IF receiver_token IS NULL OR receiver_token = '' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Accept', 'application/json'
    ),
    body := jsonb_build_object(
      'to', receiver_token,
      'title', '🤝 Yeni Takipçi',
      'body', COALESCE(sender_name, 'Birisi') || ' seni takip etmeye başladı.',
      'sound', 'default',
      'data', jsonb_build_object(
        'type', 'follow',
        'route', '/user/' || NEW.user_id
      )
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Push bildirim hatası (Follow): %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_follow ON friendships;
CREATE TRIGGER trg_notify_follow
  AFTER INSERT ON friendships
  FOR EACH ROW
  EXECUTE FUNCTION notify_follow_request();


-- ============================================
-- NOT: Bu trigger'lar pg_net extension'ını kullanır.
-- Supabase'de pg_net zaten aktif olmalı. 
-- Kontrol: SELECT * FROM pg_extension WHERE extname = 'pg_net';
-- Yoksa: CREATE EXTENSION IF NOT EXISTS pg_net;
-- ============================================
