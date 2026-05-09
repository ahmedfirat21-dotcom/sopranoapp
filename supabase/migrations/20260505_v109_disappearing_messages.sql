-- ★ v109 — Kaybolan Mesajlar (Disappearing Messages)
--
-- Snapchat/Telegram secret chat tarzı: kullanıcı sohbet için TTL seçer
-- (1 saat, 24 saat, 7 gün, 30 gün). messages.expires_at o anda hesaplanır.
-- Cron her saat süresi geçen mesajları "deleted_for_everyone" olarak işaretler.
--
-- Şema:
--   messages.expires_at TIMESTAMPTZ — null = hiç (sınırsız), aksi: bu zamanda kaybolur
--   conversation_state.disappearing_seconds INT — kullanıcının seçtiği TTL (saniye)
--   * conversation_state user-bazlı; iki taraf farklı TTL ayarlayabilir.
--     Mesaj gönderilince sender'ın TTL'i alınır (kendi seçimi geçer).

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_messages_expires_at
  ON public.messages(expires_at)
  WHERE expires_at IS NOT NULL AND deleted_for_everyone = false;

ALTER TABLE public.conversation_state
  ADD COLUMN IF NOT EXISTS disappearing_seconds INT DEFAULT 0;

-- ─── RPC: set_disappearing_timer ──────────────────────────────
CREATE OR REPLACE FUNCTION public.set_disappearing_timer(
  p_user_id TEXT,
  p_partner_id TEXT,
  p_seconds INT
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_seconds < 0 OR p_seconds > 60 * 60 * 24 * 30 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Geçersiz süre (0-30 gün)');
  END IF;

  INSERT INTO public.conversation_state (user_id, partner_id, disappearing_seconds)
  VALUES (p_user_id, p_partner_id, p_seconds)
  ON CONFLICT (user_id, partner_id) DO UPDATE SET
    disappearing_seconds = EXCLUDED.disappearing_seconds;

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- ─── Trigger: messages INSERT'te expires_at otomatik hesapla ──
CREATE OR REPLACE FUNCTION public.fn_apply_disappearing_timer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_secs INT;
BEGIN
  -- Yalnız 1-1 DM için (room_id NULL). Sender'ın conversation_state'inden TTL al.
  IF NEW.room_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.expires_at IS NOT NULL THEN
    -- Manuel set edilmişse dokunma
    RETURN NEW;
  END IF;
  SELECT disappearing_seconds INTO v_secs
  FROM public.conversation_state
  WHERE user_id = NEW.sender_id AND partner_id = NEW.receiver_id;
  IF v_secs IS NOT NULL AND v_secs > 0 THEN
    NEW.expires_at := now() + (v_secs || ' seconds')::interval;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_apply_disappearing_timer ON public.messages;
CREATE TRIGGER trg_apply_disappearing_timer
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_apply_disappearing_timer();

-- ─── Cron: süresi dolmuş mesajları herkes için sil ────────────
-- pg_cron kullanılıyorsa job'u oluştur; aksi halde manuel çalıştır.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('disappearing_msg_purge');
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'disappearing_msg_purge',
      '*/15 * * * *',  -- her 15 dakikada bir
      $cron$
        UPDATE public.messages
          SET deleted_for_everyone = true,
              content = '',
              voice_url = NULL,
              image_url = NULL
          WHERE expires_at IS NOT NULL
            AND expires_at < now()
            AND deleted_for_everyone = false;
      $cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
