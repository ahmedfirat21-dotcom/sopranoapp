-- ★ v109 hotfix — forward_message COALESCE tip hatası
--
-- Sorun: forwarded_from_id UUID, sender_id TEXT (Firebase UID).
-- COALESCE iki farklı tip arasında çalışmıyor → "COALESCE types uuid and text".
-- Çözüm: forwarded_from_id'yi TEXT'e çevir (Firebase UID zaten string).

ALTER TABLE public.messages
  ALTER COLUMN forwarded_from_id TYPE TEXT USING forwarded_from_id::TEXT;

CREATE OR REPLACE FUNCTION public.forward_message(
  p_user_id TEXT,
  p_source_message_id UUID,
  p_target_partner_id TEXT
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_src public.messages%ROWTYPE;
  v_new_id UUID;
BEGIN
  SELECT * INTO v_src FROM public.messages WHERE id = p_source_message_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kaynak mesaj bulunamadı');
  END IF;
  IF v_src.deleted_for_everyone OR v_src.is_deleted THEN
    RETURN jsonb_build_object('success', false, 'error', 'Silinmiş mesaj iletilemez');
  END IF;
  IF v_src.sender_id <> p_user_id AND v_src.receiver_id <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bu mesajı iletme yetkin yok');
  END IF;

  INSERT INTO public.messages (
    sender_id, receiver_id, content, voice_url, voice_duration, image_url,
    forwarded_from_id, type, created_at
  ) VALUES (
    p_user_id, p_target_partner_id, v_src.content, v_src.voice_url, v_src.voice_duration, v_src.image_url,
    COALESCE(v_src.forwarded_from_id, v_src.sender_id),
    v_src.type, now()
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('success', true, 'new_message_id', v_new_id);
END;
$function$;
