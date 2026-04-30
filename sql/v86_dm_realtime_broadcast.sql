-- ═══════════════════════════════════════════════════════════════════
-- v86: DM Broadcast Notification System (mimari yeniden tasarım)
-- ═══════════════════════════════════════════════════════════════════
-- Sorun:
--   Two-client mimarisinde Realtime anon ile bağlanıyor; messages tablosu
--   RLS sender_id/receiver_id kontrolü yaptığı için DM postgres_changes
--   eventleri anon Realtime client'a hiç gelmiyor → DM bildirimleri kopuk:
--     - Receiver yeni mesajı görmüyor
--     - Inbox badge artmıyor
--     - Oda içi mektup ikonu tetiklenmiyor
--     - Mesaj İsteği akışı receiver'a ulaşmıyor
--
-- Çözüm:
--   `realtime.send()` ile server-side broadcast — RLS'e takılmaz, anon client
--   subscribe edebilir. Mesaj içeriği gönderilmez, sadece sinyal:
--     topic: "dm:user:{receiver_id}"
--     event: "dm_new" | "dm_accepted" | "dm_rejected"
--     payload: { sender_id, message_id, is_request, request_id }
--   Receiver client signal alıp DB'den fresh fetch eder (RLS'e tabi).
-- ═══════════════════════════════════════════════════════════════════

-- ── 1) send_message_with_request — broadcast eklendi ──
CREATE OR REPLACE FUNCTION public.send_message_with_request(
  p_sender_id text,
  p_receiver_id text,
  p_content text,
  p_image_url text DEFAULT NULL::text,
  p_voice_url text DEFAULT NULL::text,
  p_voice_duration integer DEFAULT NULL::integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- Engel kontrolü
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
    SELECT id, status INTO v_request_id, v_request_status
      FROM message_requests
      WHERE (sender_id = p_sender_id AND receiver_id = p_receiver_id)
         OR (sender_id = p_receiver_id AND receiver_id = p_sender_id)
      LIMIT 1;

    IF v_request_status = 'rejected' THEN
      RAISE EXCEPTION 'Bu kullanıcı seninle mesajlaşmak istemiyor.' USING ERRCODE = '42501';
    ELSIF v_request_status = 'pending' THEN
      IF (SELECT sender_id FROM message_requests WHERE id = v_request_id) = p_sender_id THEN
        RAISE EXCEPTION 'Bu kullanıcıya zaten istek gönderdin. Cevap bekleniyor.' USING ERRCODE = '23505';
      END IF;
      -- Reverse case: B onaylamadan A'ya yazınca auto-accept
      UPDATE message_requests
        SET status = 'accepted', responded_at = NOW()
        WHERE id = v_request_id;
      v_is_request := FALSE;
    ELSIF v_request_status = 'accepted' THEN
      v_is_request := FALSE;
    ELSE
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

  -- ★ v86: Server-side broadcast — receiver'a anlık sinyal
  --   private=false → anon client subscribe edebilir (mesaj içeriği yok, sadece sinyal)
  PERFORM realtime.send(
    jsonb_build_object(
      'sender_id', p_sender_id,
      'message_id', v_message_id,
      'is_request', v_is_request,
      'request_id', v_request_id
    ),
    'dm_new',
    'dm:user:' || p_receiver_id,
    false
  );

  RETURN json_build_object(
    'ok', true,
    'is_request', v_is_request,
    'request_id', v_request_id,
    'message_id', v_message_id
  );
END;
$function$;

-- ── 2) accept_message_request_atomic — yeni atomic RPC + broadcast ──
CREATE OR REPLACE FUNCTION public.accept_message_request_atomic(
  p_sender_id text,
  p_receiver_id text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller TEXT;
  v_request_id UUID;
BEGIN
  v_caller := app_uid();
  IF v_caller IS NULL OR v_caller != p_receiver_id THEN
    RAISE EXCEPTION 'Yetkisiz: sadece kendine gelen isteği kabul edebilirsin.' USING ERRCODE = '42501';
  END IF;

  UPDATE message_requests
    SET status = 'accepted', responded_at = NOW()
    WHERE sender_id = p_sender_id AND receiver_id = p_receiver_id AND status = 'pending'
    RETURNING id INTO v_request_id;

  IF v_request_id IS NULL THEN
    RAISE EXCEPTION 'Pending istek bulunamadı.';
  END IF;

  -- Sender'a accepted bildirimi
  PERFORM realtime.send(
    jsonb_build_object(
      'sender_id', p_sender_id,
      'receiver_id', p_receiver_id,
      'request_id', v_request_id
    ),
    'dm_accepted',
    'dm:user:' || p_sender_id,
    false
  );

  RETURN json_build_object('ok', true, 'request_id', v_request_id);
END;
$function$;

-- ── 3) reject_message_request_atomic — yeni atomic RPC + broadcast ──
CREATE OR REPLACE FUNCTION public.reject_message_request_atomic(
  p_sender_id text,
  p_receiver_id text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller TEXT;
  v_request_id UUID;
BEGIN
  v_caller := app_uid();
  IF v_caller IS NULL OR v_caller != p_receiver_id THEN
    RAISE EXCEPTION 'Yetkisiz: sadece kendine gelen isteği reddedebilirsin.' USING ERRCODE = '42501';
  END IF;

  UPDATE message_requests
    SET status = 'rejected', responded_at = NOW()
    WHERE sender_id = p_sender_id AND receiver_id = p_receiver_id AND status = 'pending'
    RETURNING id INTO v_request_id;

  IF v_request_id IS NULL THEN
    RAISE EXCEPTION 'Pending istek bulunamadı.';
  END IF;

  -- Eski request mesajlarını gizle (gönderene görünür kalsın, alıcıda yok)
  UPDATE messages
    SET is_deleted = TRUE
    WHERE sender_id = p_sender_id AND receiver_id = p_receiver_id;

  -- Sender'a rejected bildirimi
  PERFORM realtime.send(
    jsonb_build_object(
      'sender_id', p_sender_id,
      'receiver_id', p_receiver_id,
      'request_id', v_request_id
    ),
    'dm_rejected',
    'dm:user:' || p_sender_id,
    false
  );

  RETURN json_build_object('ok', true, 'request_id', v_request_id);
END;
$function$;
