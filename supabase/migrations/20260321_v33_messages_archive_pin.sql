-- ═══════════════════════════════════════════════════════════════════
-- v33: Mesajlar — Arşiv ve Sabitleme (Archive & Pin)
-- ═══════════════════════════════════════════════════════════════════
-- Amaç: Mesajlar sayfasındaki iki önemli UX gap'i kapatmak:
--   1. Arşiv ≠ Silme: Arşivlenmiş konuşmalar yeni mesaj gelince otomatik
--      geri çıkar. Silme farklı bir soft-delete akışı (mevcut hidden
--      map local-only; senkron değil).
--   2. Pinli konuşmalar: Annemle/eşimle sohbet en üstte sabit kalsın.
--
-- Model: conversation_state tablosu — (user_id, partner_id) çifti için
--   user bazlı state tutar. Aynı konuşma iki kullanıcıda farklı
--   state'te olabilir (Ayşe pinli, Burcu pinli değil).
--
-- NOT: profiles.id TEXT (Firebase UID), UUID değil. Bu yüzden tüm
--   foreign key'ler TEXT. auth.uid()::text kullanarak RLS kuruluyor.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.conversation_state (
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  partner_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Pinli (en üstte sabit)
  pinned_at TIMESTAMPTZ,
  -- Arşivlenmiş (gizli, ama yeni mesaj gelince geri çıkar)
  archived_at TIMESTAMPTZ,
  -- Susturulmuş (bildirim gelmesin)
  muted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, partner_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_state_user_pinned
  ON public.conversation_state (user_id, pinned_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_conv_state_user_archived
  ON public.conversation_state (user_id) WHERE archived_at IS NOT NULL;

-- RLS: Sadece kendi satırlarına erişim (auth.uid() UUID → ::text ile profiles.id'ye eşleşir)
ALTER TABLE public.conversation_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conv_state_read ON public.conversation_state;
CREATE POLICY conv_state_read ON public.conversation_state
  FOR SELECT USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS conv_state_write ON public.conversation_state;
CREATE POLICY conv_state_write ON public.conversation_state
  FOR ALL USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);

-- Yardımcı RPC: Pin/Unpin toggle
CREATE OR REPLACE FUNCTION public.toggle_conversation_pin(p_partner_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid TEXT := auth.uid()::text;
  v_current TIMESTAMPTZ;
  v_new_state BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Kimlik doğrulama gerekli';
  END IF;

  SELECT pinned_at INTO v_current
  FROM public.conversation_state
  WHERE user_id = v_uid AND partner_id = p_partner_id;

  IF v_current IS NULL THEN
    -- Pinle
    INSERT INTO public.conversation_state (user_id, partner_id, pinned_at)
    VALUES (v_uid, p_partner_id, NOW())
    ON CONFLICT (user_id, partner_id) DO UPDATE SET pinned_at = NOW(), updated_at = NOW();
    v_new_state := TRUE;
  ELSE
    -- Unpinle
    UPDATE public.conversation_state
    SET pinned_at = NULL, updated_at = NOW()
    WHERE user_id = v_uid AND partner_id = p_partner_id;
    v_new_state := FALSE;
  END IF;

  RETURN v_new_state;
END;
$$;

-- Yardımcı RPC: Arşivle / Arşivden çıkar
CREATE OR REPLACE FUNCTION public.toggle_conversation_archive(p_partner_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid TEXT := auth.uid()::text;
  v_current TIMESTAMPTZ;
  v_new_state BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
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

-- Auto-unarchive trigger: Yeni mesaj gelince alıcının arşivden çıksın
-- (WhatsApp davranışı — arşivden yeni mesaj alınca liste üstüne çıkar)
CREATE OR REPLACE FUNCTION public.auto_unarchive_on_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversation_state
  SET archived_at = NULL, updated_at = NOW()
  WHERE user_id = NEW.receiver_id
    AND partner_id = NEW.sender_id
    AND archived_at IS NOT NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_unarchive_on_new_message ON public.messages;
CREATE TRIGGER trg_auto_unarchive_on_new_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.auto_unarchive_on_new_message();

-- RPC'leri authenticated kullanıcılara aç
GRANT EXECUTE ON FUNCTION public.toggle_conversation_pin(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_conversation_archive(TEXT) TO authenticated;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- ROLLBACK (gerektiğinde):
-- BEGIN;
--   DROP TRIGGER IF EXISTS trg_auto_unarchive_on_new_message ON public.messages;
--   DROP FUNCTION IF EXISTS public.auto_unarchive_on_new_message();
--   DROP FUNCTION IF EXISTS public.toggle_conversation_archive(TEXT);
--   DROP FUNCTION IF EXISTS public.toggle_conversation_pin(TEXT);
--   DROP TABLE IF EXISTS public.conversation_state;
-- COMMIT;
-- ═══════════════════════════════════════════════════════════════════
