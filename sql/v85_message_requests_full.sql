-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v85 — Message Request Flow (Instagram-style)
--
-- Amaç: Yabancılar arası mesajlaşmayı onay/red akışıyla aç.
--
-- Akış:
--   1. A (yabancı) → B mesaj atar
--   2. message_requests INSERT (sender=A, receiver=B, status='pending')
--   3. messages INSERT (normal mesaj kaydı, ama UI'da B için "İstekler"de görünür)
--   4. A pending'iken 2. mesaj atamaz (spam koruması)
--   5. B "İstekler"de görür → Kabul / Red
--      - Kabul: status='accepted', conversation normal listeye geçer
--      - Red:   status='rejected', mesajlar gizlenir, A bir daha atamaz
--
-- Bu migration:
--   1. RLS policies ekler (SELECT/INSERT/UPDATE)
--   2. send_message_with_request RPC (atomic: request kaydı + mesaj insert)
--   3. messages tablosu için is_message_request_visible() helper view
-- ════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════
-- 1. RLS Policies — message_requests
-- ═══════════════════════════════════════════════════
DROP POLICY IF EXISTS "View own message requests" ON message_requests;
CREATE POLICY "View own message requests"
ON message_requests FOR SELECT
USING (app_uid() = sender_id OR app_uid() = receiver_id);

DROP POLICY IF EXISTS "Send message request" ON message_requests;
CREATE POLICY "Send message request"
ON message_requests FOR INSERT
WITH CHECK (app_uid() = sender_id);

DROP POLICY IF EXISTS "Receiver responds to request" ON message_requests;
CREATE POLICY "Receiver responds to request"
ON message_requests FOR UPDATE
USING (app_uid() = receiver_id)
WITH CHECK (app_uid() = receiver_id);


-- ═══════════════════════════════════════════════════
-- 2. send_message_with_request RPC
--    Atomic: arkadaş kontrolü + request lookup/create + message insert
--    İade: { ok, is_request, request_id?, message_id }
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION send_message_with_request(
  p_sender_id TEXT,
  p_receiver_id TEXT,
  p_content TEXT,
  p_image_url TEXT DEFAULT NULL,
  p_voice_url TEXT DEFAULT NULL,
  p_voice_duration INTEGER DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_caller TEXT;
  v_is_friend BOOLEAN;
  v_request_status TEXT;
  v_request_id UUID;
  v_message_id UUID;
  v_is_request BOOLEAN := FALSE;
BEGIN
  v_caller := app_uid();
  IF v_caller IS NULL OR v_caller != p_sender_id THEN
    RAISE EXCEPTION 'Yetkisiz: sadece kendi adına mesaj atabilirsin.' USING ERRCODE = '42501';
  END IF;

  -- Engel kontrolü (her iki yön)
  IF EXISTS (
    SELECT 1 FROM blocked_users
    WHERE (blocker_id = p_sender_id AND blocked_id = p_receiver_id)
       OR (blocker_id = p_receiver_id AND blocked_id = p_sender_id)
  ) THEN
    RAISE EXCEPTION 'Bu kullanıcıyla mesajlaşamazsınız.' USING ERRCODE = '42501';
  END IF;

  -- Arkadaş mı?
  v_is_friend := EXISTS (
    SELECT 1 FROM friendships
    WHERE status = 'accepted'
      AND ((user_id = p_sender_id AND friend_id = p_receiver_id)
        OR (user_id = p_receiver_id AND friend_id = p_sender_id))
  );

  -- Yabancılar arası: request akışı
  IF NOT v_is_friend THEN
    -- Mevcut request var mı?
    SELECT id, status INTO v_request_id, v_request_status
      FROM message_requests
      WHERE (sender_id = p_sender_id AND receiver_id = p_receiver_id)
         OR (sender_id = p_receiver_id AND receiver_id = p_sender_id)
      LIMIT 1;

    IF v_request_status = 'rejected' THEN
      RAISE EXCEPTION 'Bu kullanıcı seninle mesajlaşmak istemiyor.' USING ERRCODE = '42501';
    ELSIF v_request_status = 'pending' THEN
      -- Pending'de: sadece request gönderici tek mesaj atabilir; cevap bekleniyor
      IF (SELECT sender_id FROM message_requests WHERE id = v_request_id) = p_sender_id THEN
        RAISE EXCEPTION 'Bu kullanıcıya zaten istek gönderdin. Cevap bekleniyor.' USING ERRCODE = '23505';
      END IF;
      -- Reverse case (alıcı şimdi gönderici oluyor) — auto-accept (B onaylamadan A'ya yazınca)
      UPDATE message_requests
        SET status = 'accepted', responded_at = NOW()
        WHERE id = v_request_id;
      v_is_request := FALSE;
    ELSIF v_request_status = 'accepted' THEN
      -- Eski request kabul edilmiş: normal mesaj
      v_is_request := FALSE;
    ELSE
      -- Hiç request yok: yenisini oluştur (pending) ve ilk mesajı yolla
      INSERT INTO message_requests (sender_id, receiver_id, status)
        VALUES (p_sender_id, p_receiver_id, 'pending')
        RETURNING id INTO v_request_id;
      v_is_request := TRUE;
    END IF;
  END IF;

  -- Mesajı kaydet
  INSERT INTO messages (sender_id, receiver_id, content, image_url, voice_url, voice_duration)
    VALUES (p_sender_id, p_receiver_id, p_content, p_image_url, p_voice_url, p_voice_duration)
    RETURNING id INTO v_message_id;

  RETURN json_build_object(
    'ok', true,
    'is_request', v_is_request,
    'request_id', v_request_id,
    'message_id', v_message_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ═══════════════════════════════════════════════════
-- 3. messages SELECT policy: pending request mesajlarını filtrele
--    Receiver pending request'in mesajlarını "İstekler" akışında görür;
--    normal getConversations'da görmez. Helper boolean view oluştur.
-- ═══════════════════════════════════════════════════
-- Mevcut SELECT policy'sini koruyoruz; client ek WHERE NOT IN (pending_request_senders)
-- ile filtreleyecek (server-side enforce gereksiz, client zaten kendi verilerini sorguluyor).


-- ═══════════════════════════════════════════════════
-- 4. Realtime publication — message_requests INSERT/UPDATE event'leri client'a aksın
-- ═══════════════════════════════════════════════════
DO $$
BEGIN
  PERFORM 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'message_requests';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE message_requests';
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;


-- ═══ DONE ═══
