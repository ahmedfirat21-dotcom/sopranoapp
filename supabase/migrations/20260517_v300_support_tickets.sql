-- ═══════════════════════════════════════════════════════════════════════════
-- v300 — Destek Talepleri (Support Tickets)
--
-- AMAÇ:
--   Kullanıcılar uygulama içinden destek talebi gönderebilsin (hata bildirme,
--   öneri, şikayet, soru). Talepler DB'ye düşer, web admin paneline yansır,
--   opsiyonel olarak edge function ile sopranochat@gmail.com'a mail atar.
--
-- AKIŞ:
--   1. Kullanıcı Settings → Destek & İletişim → form doldur → Gönder
--   2. INSERT INTO support_tickets (RLS: kendi user_id ile)
--   3. AFTER INSERT trigger → pg_notify (web admin canlı liste için)
--   4. (opsiyonel) edge fn support-notify ile mail
--
-- GÜVENLİK:
--   - RLS: kullanıcı sadece kendi ticket'larını oluşturabilir/görebilir
--   - service_role tümünü görebilir/yönetebilir (web admin)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             text NOT NULL,                 -- Firebase UID
  user_display_name   text,                          -- snapshot (silinen kullanıcı için)
  user_email          text,                          -- snapshot, opsiyonel
  category            text NOT NULL CHECK (category IN ('bug','suggestion','complaint','question','other')),
  subject             text NOT NULL CHECK (length(subject) BETWEEN 3 AND 120),
  message             text NOT NULL CHECK (length(message) BETWEEN 10 AND 2000),
  app_version         text,
  platform            text,                          -- 'ios' | 'android' | 'web'
  status              text NOT NULL DEFAULT 'new' CHECK (status IN ('new','read','in_progress','resolved','closed')),
  admin_response      text,                          -- web admin tarafından yazılan yanıt (opsiyonel)
  admin_response_at   timestamptz,
  read_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON public.support_tickets(created_at DESC);

-- updated_at otomatik tetikleyici
CREATE OR REPLACE FUNCTION public.support_tickets_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.support_tickets_set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Kullanıcı kendi ticket'larını INSERT edebilir (app_uid Firebase JWT'den)
DROP POLICY IF EXISTS support_tickets_user_insert ON public.support_tickets;
CREATE POLICY support_tickets_user_insert ON public.support_tickets
  FOR INSERT TO authenticated, anon
  WITH CHECK (user_id = app_uid());

-- Kullanıcı kendi ticket'larını SELECT edebilir (geçmişini görmek için)
DROP POLICY IF EXISTS support_tickets_user_select_own ON public.support_tickets;
CREATE POLICY support_tickets_user_select_own ON public.support_tickets
  FOR SELECT TO authenticated, anon
  USING (user_id = app_uid());

-- service_role tümüne erişebilir (web admin)
DROP POLICY IF EXISTS support_tickets_service_all ON public.support_tickets;
CREATE POLICY support_tickets_service_all ON public.support_tickets
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── INSERT trigger — yeni ticket bildirimi (edge fn opsiyonel) ───────────────
-- Şimdilik pg_notify ile (web admin realtime için).
-- Email gönderimi için edge function support-notify ayrıca deploy edilebilir.
CREATE OR REPLACE FUNCTION public.support_tickets_notify_new()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('support_ticket_new', json_build_object(
    'id', NEW.id,
    'user_id', NEW.user_id,
    'category', NEW.category,
    'subject', NEW.subject,
    'created_at', NEW.created_at
  )::text);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_tickets_notify_new ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_notify_new
  AFTER INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.support_tickets_notify_new();

-- ── Realtime publication (web admin canlı liste için) ────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'support_tickets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
  END IF;
END $$;

COMMENT ON TABLE public.support_tickets IS 'Kullanıcı destek talepleri — APK form → web admin yönetim';
