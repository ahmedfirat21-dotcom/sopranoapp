-- ★ v109 (5 May 2026) — Mesajlaşma feature paketi.
--
-- Yeni kolonlar:
--   reply_to_id          UUID NULL — bir mesaja "alıntılayarak yanıt"
--   edited_at            TIMESTAMPTZ NULL — düzenleme zamanı (mesaj yanına "düzenlendi" rozeti)
--   deleted_for_everyone BOOLEAN DEFAULT FALSE — WhatsApp pattern: "Bu mesaj silindi" placeholder
--   forwarded_from_id    UUID NULL — orijinal sender_id (forward chain göstermez)
--   link_preview         JSONB NULL — { title, description, image, url } cache
--
-- Tablo: message_drafts (kullanıcının yarım yazdığı mesajları kaydet)
-- Tablo: saved_messages (kullanıcının kaydettiği / yıldızladığı mesajlar)

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_id          UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edited_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_for_everyone BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS forwarded_from_id    UUID,
  ADD COLUMN IF NOT EXISTS link_preview         JSONB;

CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON public.messages(reply_to_id) WHERE reply_to_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_deleted_everyone ON public.messages(deleted_for_everyone) WHERE deleted_for_everyone = true;

-- ─── Taslaklar ─────────────────────────────────────────────────
-- Kullanıcı sohbette yazıp göndermeden çıkarsa, bir sonraki açılışta
-- text alanı dolu gelir. Inbox'ta da "Taslak: ..." görünür.
CREATE TABLE IF NOT EXISTS public.message_drafts (
  user_id    TEXT NOT NULL,
  partner_id TEXT NOT NULL,
  content    TEXT NOT NULL,
  reply_to_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, partner_id)
);

ALTER TABLE public.message_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "drafts_self_all" ON public.message_drafts;
CREATE POLICY "drafts_self_all"
  ON public.message_drafts FOR ALL
  TO authenticated
  USING (user_id = app_uid())
  WITH CHECK (user_id = app_uid());

-- ─── Kayıtlı mesajlar ──────────────────────────────────────────
-- Telegram tarzı Saved Messages. Kullanıcı bir mesajı yıldızlar,
-- profilinden /saved sayfasında listeler.
CREATE TABLE IF NOT EXISTS public.saved_messages (
  user_id    TEXT NOT NULL,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  saved_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, message_id)
);

ALTER TABLE public.saved_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_messages_self_all" ON public.saved_messages;
CREATE POLICY "saved_messages_self_all"
  ON public.saved_messages FOR ALL
  TO authenticated
  USING (user_id = app_uid())
  WITH CHECK (user_id = app_uid());

-- ─── RPC: edit_message ─────────────────────────────────────────
-- Sadece kendi mesajını + 24 saat içinde + silinmemiş + sesli/görsel olmayan
-- (sesli/görselin metni edit edilemez).
CREATE OR REPLACE FUNCTION public.edit_message(
  p_user_id TEXT,
  p_message_id UUID,
  p_new_content TEXT
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_msg public.messages%ROWTYPE;
BEGIN
  SELECT * INTO v_msg FROM public.messages WHERE id = p_message_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mesaj bulunamadı');
  END IF;
  IF v_msg.sender_id <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sadece kendi mesajını düzenleyebilirsin');
  END IF;
  IF v_msg.is_deleted OR v_msg.deleted_for_everyone THEN
    RETURN jsonb_build_object('success', false, 'error', 'Silinmiş mesaj düzenlenemez');
  END IF;
  IF v_msg.voice_url IS NOT NULL OR v_msg.image_url IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sesli veya görselli mesaj düzenlenemez');
  END IF;
  IF now() - v_msg.created_at > interval '24 hours' THEN
    RETURN jsonb_build_object('success', false, 'error', '24 saatten eski mesajlar düzenlenemez');
  END IF;
  IF length(p_new_content) = 0 OR length(p_new_content) > 4000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mesaj içeriği geçersiz');
  END IF;

  UPDATE public.messages
    SET content = p_new_content, edited_at = now()
    WHERE id = p_message_id;

  RETURN jsonb_build_object('success', true, 'edited_at', now());
END;
$function$;

-- ─── RPC: delete_for_everyone ──────────────────────────────────
-- Sadece kendi mesajını + 1 saat içinde silinebilir (WhatsApp pattern).
CREATE OR REPLACE FUNCTION public.delete_message_for_everyone(
  p_user_id TEXT,
  p_message_id UUID
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_msg public.messages%ROWTYPE;
BEGIN
  SELECT * INTO v_msg FROM public.messages WHERE id = p_message_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mesaj bulunamadı');
  END IF;
  IF v_msg.sender_id <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sadece kendi mesajını herkes için silebilirsin');
  END IF;
  IF now() - v_msg.created_at > interval '1 hour' THEN
    RETURN jsonb_build_object('success', false, 'error', '1 saatten eski mesajlar herkes için silinemez');
  END IF;

  UPDATE public.messages
    SET deleted_for_everyone = true,
        content = '',
        voice_url = NULL,
        image_url = NULL
    WHERE id = p_message_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- ─── RPC: forward_message ──────────────────────────────────────
-- Bir mesajı başka bir kullanıcıya iletme. forwarded_from_id orijinal sender'ı saklar.
-- DM olduğu için her forward yeni bir messages satırı yaratır.
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
  -- Forward yetki: kullanıcı bu mesajı görmüş olmalı (sender veya receiver)
  IF v_src.sender_id <> p_user_id AND v_src.receiver_id <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bu mesajı iletme yetkin yok');
  END IF;

  INSERT INTO public.messages (
    sender_id, receiver_id, content, voice_url, voice_duration, image_url,
    forwarded_from_id, type, created_at
  ) VALUES (
    p_user_id, p_target_partner_id, v_src.content, v_src.voice_url, v_src.voice_duration, v_src.image_url,
    COALESCE(v_src.forwarded_from_id, v_src.sender_id), v_src.type, now()
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('success', true, 'new_message_id', v_new_id);
END;
$function$;

-- ─── RPC: save_draft + clear_draft ─────────────────────────────
CREATE OR REPLACE FUNCTION public.save_draft(
  p_user_id TEXT,
  p_partner_id TEXT,
  p_content TEXT,
  p_reply_to_id UUID DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF length(coalesce(p_content, '')) = 0 THEN
    DELETE FROM public.message_drafts WHERE user_id = p_user_id AND partner_id = p_partner_id;
    RETURN;
  END IF;
  INSERT INTO public.message_drafts (user_id, partner_id, content, reply_to_id, updated_at)
  VALUES (p_user_id, p_partner_id, p_content, p_reply_to_id, now())
  ON CONFLICT (user_id, partner_id) DO UPDATE SET
    content = EXCLUDED.content,
    reply_to_id = EXCLUDED.reply_to_id,
    updated_at = now();
END;
$function$;
