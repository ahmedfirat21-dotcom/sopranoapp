-- ════════════════════════════════════════════════════════════
-- v111b (10 May 2026): Plus/Pro Host Mesaj Temizleme
-- ════════════════════════════════════════════════════════════
--
-- AMAÇ: Plus/Pro/GodMaster tier hostlar odasının tüm user mesajlarını
--   anlık silebilsin (moderasyon + gizlilik aracı).
-- Free tier kullanıcılar bu RPC'yi çağıramaz (defense in depth — UI'da
--   buton zaten görünmez ama backend'de de tier check var).
-- System mesajları (type='system') KORUNUR — oda akış logu kaybolmasın.
-- Realtime: messages DELETE event'i RoomChatService.subscribe (postgres_changes
--   DELETE handler) tarafından dinleniyor → tüm odadaki kullanıcıların chat
--   panel'i otomatik temizlenir (zero extra wiring).

CREATE OR REPLACE FUNCTION public.clear_room_messages(
  p_room_id UUID,
  p_user_id TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_host       TEXT;
  v_owner_tier      TEXT;
  v_deleted_count   INTEGER := 0;
BEGIN
  IF p_room_id IS NULL OR p_user_id IS NULL OR p_user_id = '' THEN
    RAISE EXCEPTION 'Geçersiz parametre.' USING ERRCODE = '22023';
  END IF;

  SELECT host_id, COALESCE(owner_tier, 'Free')
    INTO v_room_host, v_owner_tier
    FROM public.rooms
   WHERE id = p_room_id;

  IF v_room_host IS NULL THEN
    RAISE EXCEPTION 'Oda bulunamadı.' USING ERRCODE = 'P0002';
  END IF;

  IF v_room_host <> p_user_id THEN
    RAISE EXCEPTION 'Bu işlem için oda sahibi olmalısın.' USING ERRCODE = '42501';
  END IF;

  -- Tier guard: sadece Plus/Pro/GodMaster (Free reddedilir)
  IF v_owner_tier NOT IN ('Plus', 'Pro', 'GodMaster') THEN
    RAISE EXCEPTION 'Mesaj temizleme Plus üyelik ister.' USING ERRCODE = '42501';
  END IF;

  -- System mesajları KORU — sadece user mesajları sil
  DELETE FROM public.messages
   WHERE room_id = p_room_id
     AND COALESCE(type, 'user') <> 'system';
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_room_messages(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_room_messages(UUID, TEXT) TO authenticated, service_role;
