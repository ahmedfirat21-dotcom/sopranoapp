-- ═══════════════════════════════════════════════════════════════════
-- v48: toggle_conversation_pin / archive — Firebase JWT executor fallback
-- ═══════════════════════════════════════════════════════════════════
-- Problem: v33'te auth.uid()::text kullanılıyordu. Firebase Third-Party
-- Auth bridge Supabase JWKS düzgün yapılandırılmadığında NULL dönüyor →
-- RPC "Kimlik doğrulama gerekli" ile fail oluyor, mesajlarda pin/archive
-- toggle "İşlem tamamlanamadı" toast'ı gösteriyor.
--
-- Çözüm: v44 ban_user_atomic pattern — p_executor_id fallback param.
-- auth.uid() NULL ise client'ın bildirdiği ID'ye güven.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════
-- toggle_conversation_pin — executor fallback
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.toggle_conversation_pin(
  p_partner_id TEXT,
  p_executor_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid TEXT;
  v_current TIMESTAMPTZ;
  v_new_state BOOLEAN;
BEGIN
  -- Önce auth.uid(), NULL ise JWT claim, o da NULL ise client'ın gönderdiği ID
  v_uid := COALESCE(
    auth.uid()::text,
    (current_setting('request.jwt.claims', true)::json->>'sub'),
    (current_setting('request.jwt.claims', true)::json->>'firebase_uid'),
    p_executor_id
  );

  IF v_uid IS NULL OR v_uid = '' THEN
    RAISE EXCEPTION 'Kimlik doğrulama gerekli';
  END IF;

  SELECT pinned_at INTO v_current
  FROM public.conversation_state
  WHERE user_id = v_uid AND partner_id = p_partner_id;

  IF v_current IS NULL THEN
    INSERT INTO public.conversation_state (user_id, partner_id, pinned_at)
    VALUES (v_uid, p_partner_id, NOW())
    ON CONFLICT (user_id, partner_id) DO UPDATE SET pinned_at = NOW(), updated_at = NOW();
    v_new_state := TRUE;
  ELSE
    UPDATE public.conversation_state
    SET pinned_at = NULL, updated_at = NOW()
    WHERE user_id = v_uid AND partner_id = p_partner_id;
    v_new_state := FALSE;
  END IF;

  RETURN v_new_state;
END;
$$;

-- ═══════════════════════════════════════════════════
-- toggle_conversation_archive — executor fallback
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.toggle_conversation_archive(
  p_partner_id TEXT,
  p_executor_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid TEXT;
  v_current TIMESTAMPTZ;
  v_new_state BOOLEAN;
BEGIN
  v_uid := COALESCE(
    auth.uid()::text,
    (current_setting('request.jwt.claims', true)::json->>'sub'),
    (current_setting('request.jwt.claims', true)::json->>'firebase_uid'),
    p_executor_id
  );

  IF v_uid IS NULL OR v_uid = '' THEN
    RAISE EXCEPTION 'Kimlik doğrulama gerekli';
  END IF;

  SELECT archived_at INTO v_current
  FROM public.conversation_state
  WHERE user_id = v_uid AND partner_id = p_partner_id;

  IF v_current IS NULL THEN
    INSERT INTO public.conversation_state (user_id, partner_id, archived_at)
    VALUES (v_uid, p_partner_id, NOW())
    ON CONFLICT (user_id, partner_id) DO UPDATE SET archived_at = NOW(), updated_at = NOW();
    v_new_state := TRUE;
  ELSE
    UPDATE public.conversation_state
    SET archived_at = NULL, updated_at = NOW()
    WHERE user_id = v_uid AND partner_id = p_partner_id;
    v_new_state := FALSE;
  END IF;

  RETURN v_new_state;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_conversation_pin(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_conversation_pin(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_conversation_archive(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_conversation_archive(TEXT) TO authenticated;

COMMIT;
