-- ═══════════════════════════════════════════════════════════════════
-- v49: Atomic delete_user_cascade RPC
-- ═══════════════════════════════════════════════════════════════════
-- Önceden settings.tsx'te 9 ayrı DELETE query vardı (non-atomic) — adım 5'te
-- fail olursa adım 1-4 commit edilmiş kalır, partial deletion + veri kalıntısı.
--
-- Bu RPC tüm cascade'i tek TRANSACTION'da yapar. Herhangi bir adım fail'se
-- RAISE EXCEPTION → tüm transaction rollback.
--
-- Storage cleanup + Firebase auth delete client'ta kalır (SQL'de yapılamaz).
--
-- Executor fallback pattern (v44 gibi): auth.uid() NULL ise p_executor_id'ye güven.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.delete_user_cascade(
  p_executor_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid TEXT;
  v_owned_room_ids UUID[];
  v_stats JSONB := '{}'::jsonb;
  v_deleted_count INTEGER;
BEGIN
  -- Kimlik çözümle (v44 pattern): auth.uid() → JWT claim → client executor
  v_uid := COALESCE(
    auth.uid()::text,
    (current_setting('request.jwt.claims', true)::json->>'sub'),
    (current_setting('request.jwt.claims', true)::json->>'firebase_uid'),
    p_executor_id
  );

  IF v_uid IS NULL OR v_uid = '' THEN
    RAISE EXCEPTION 'Kimlik doğrulama gerekli';
  END IF;

  -- ═══════════════════════════════════════════════════
  -- 1. Owned odalar + katılımcıları (foreign key ordering)
  -- ═══════════════════════════════════════════════════
  SELECT COALESCE(array_agg(id), ARRAY[]::UUID[])
    INTO v_owned_room_ids
  FROM public.rooms WHERE host_id = v_uid;

  IF array_length(v_owned_room_ids, 1) > 0 THEN
    DELETE FROM public.room_participants WHERE room_id = ANY(v_owned_room_ids);
    DELETE FROM public.rooms WHERE id = ANY(v_owned_room_ids);
    v_stats := v_stats || jsonb_build_object('owned_rooms', array_length(v_owned_room_ids, 1));
  END IF;

  -- ═══════════════════════════════════════════════════
  -- 2. Katılımcı olunan odalardan çık
  -- ═══════════════════════════════════════════════════
  DELETE FROM public.room_participants WHERE user_id = v_uid;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_stats := v_stats || jsonb_build_object('left_rooms', v_deleted_count);

  -- ═══════════════════════════════════════════════════
  -- 3. Arkadaşlıklar + banlar + bloklar
  -- ═══════════════════════════════════════════════════
  DELETE FROM public.friendships WHERE user_id = v_uid OR friend_id = v_uid;

  -- room_bans var mı kontrol et (tablo opsiyonel olabilir)
  BEGIN
    DELETE FROM public.room_bans WHERE user_id = v_uid;
  EXCEPTION WHEN undefined_table THEN
    -- tablo yoksa geç
    NULL;
  END;

  BEGIN
    DELETE FROM public.blocked_users WHERE blocker_id = v_uid OR blocked_id = v_uid;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  -- ═══════════════════════════════════════════════════
  -- 4. Mesajlar (hem gönderdikleri hem aldıkları)
  -- ═══════════════════════════════════════════════════
  DELETE FROM public.messages WHERE sender_id = v_uid OR receiver_id = v_uid;

  -- ═══════════════════════════════════════════════════
  -- 5. SP transaction geçmişi
  -- ═══════════════════════════════════════════════════
  BEGIN
    DELETE FROM public.sp_transactions WHERE user_id = v_uid;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  -- ═══════════════════════════════════════════════════
  -- 6. Raporlar (kullanıcının açtığı)
  -- ═══════════════════════════════════════════════════
  BEGIN
    DELETE FROM public.reports WHERE reporter_id = v_uid;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  -- ═══════════════════════════════════════════════════
  -- 7. Bildirimler (aldığı + gönderdiği)
  -- ═══════════════════════════════════════════════════
  BEGIN
    DELETE FROM public.notifications WHERE user_id = v_uid OR sender_id = v_uid;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  -- ═══════════════════════════════════════════════════
  -- 8. Aux tablolar (opsiyonel ama tercih edilen)
  -- ═══════════════════════════════════════════════════
  BEGIN
    DELETE FROM public.room_follows WHERE user_id = v_uid;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  BEGIN
    DELETE FROM public.room_chat_messages WHERE user_id = v_uid;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  BEGIN
    DELETE FROM public.user_badges WHERE user_id = v_uid;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  BEGIN
    DELETE FROM public.referral_codes WHERE owner_id = v_uid;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  BEGIN
    DELETE FROM public.conversation_state WHERE user_id = v_uid OR partner_id = v_uid;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  BEGIN
    DELETE FROM public.calls WHERE caller_id = v_uid OR receiver_id = v_uid;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  -- ═══════════════════════════════════════════════════
  -- 9. Son olarak profil silinir
  -- ═══════════════════════════════════════════════════
  DELETE FROM public.profiles WHERE id = v_uid;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  IF v_deleted_count = 0 THEN
    RAISE EXCEPTION 'Profil bulunamadı veya zaten silinmiş: %', v_uid;
  END IF;

  v_stats := v_stats || jsonb_build_object('profile_deleted', true, 'user_id', v_uid);
  RETURN v_stats;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user_cascade(TEXT) TO authenticated;

COMMIT;

COMMENT ON FUNCTION public.delete_user_cascade IS 'Atomic cascade delete for user account. Removes all user data in single transaction. Storage + Firebase auth handled by client.';
