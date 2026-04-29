-- ═══════════════════════════════════════════════════════════════
-- SopranoChat — v70 Weekly Email Digest Cron Schedule (Faz 5.2)
-- ═══════════════════════════════════════════════════════════════
-- send-email-digest edge function'ını haftalık otomatik tetikler.
-- Pazartesi sabah 09:00 Istanbul (06:00 UTC) çalışır.
--
-- Önkoşullar:
--   1. pg_cron extension Dashboard'dan etkinleştirilmiş olmalı (Database → Extensions)
--   2. pg_net extension etkin olmalı (HTTP isteği için)
--   3. RESEND_API_KEY + EMAIL_FROM secrets set edilmiş
--   4. send-email-digest function deploy edilmiş (v68)
--
-- Tek seferlik kurulum sonrası kendiliğinden çalışır.
-- Schedule değiştirmek/durdurmak için: SELECT cron.unschedule('weekly-email-digest');
-- ═══════════════════════════════════════════════════════════════

-- pg_cron + pg_net extension'ları (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Eski schedule varsa sil (idempotent re-run için)
DO $$
BEGIN
  PERFORM cron.unschedule('weekly-email-digest');
EXCEPTION WHEN OTHERS THEN
  NULL; -- yoksa sessiz devam
END $$;

-- ───────────────────────────────────────────────────────────────
-- Weekly digest schedule — Pazartesi 06:00 UTC (09:00 Istanbul)
-- ───────────────────────────────────────────────────────────────
-- Format: "minute hour day month dow"
--   '0 6 * * 1' = Her Pazartesi saat 06:00 UTC
SELECT cron.schedule(
  'weekly-email-digest',
  '0 6 * * 1',
  $cron$
    SELECT net.http_post(
      url := 'https://kpofiuczyjesjlqjxswh.supabase.co/functions/v1/send-email-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $cron$
);

-- ───────────────────────────────────────────────────────────────
-- Manuel test için (dashboard'da bir kez çalıştır):
-- ───────────────────────────────────────────────────────────────
-- SELECT cron.schedule('test-digest-once', '* * * * *', $$ ... $$);
-- (Yukarıdaki ile aynı body, dakikada bir tetikler — test sonrası unschedule)

-- ───────────────────────────────────────────────────────────────
-- Schedule durumunu kontrol et:
-- ───────────────────────────────────────────────────────────────
-- SELECT * FROM cron.job WHERE jobname = 'weekly-email-digest';
-- SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'weekly-email-digest') ORDER BY start_time DESC LIMIT 5;

-- ───────────────────────────────────────────────────────────────
-- NOT: app.settings.service_role_key
-- ───────────────────────────────────────────────────────────────
-- Bu setting Supabase tarafından otomatik enjekte edilmez. Manuel set:
-- ALTER DATABASE postgres SET app.settings.service_role_key = '<service_role_key>';
-- (Dashboard → Database → Custom Settings, ya da SQL Editor'de bir kez)
-- Olmadan net.http_post 401 alır → digest gönderilmez.

DO $$ BEGIN
  RAISE NOTICE 'v70: Weekly email digest cron scheduled. Pazartesi 06:00 UTC. Service role key''i app.settings.service_role_key olarak set et (yoksa 401).';
END $$;
