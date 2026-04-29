-- ═══════════════════════════════════════════════════════════════
-- SopranoChat — v71 Weekly Digest Cron Fix (anon-key auth)
-- ═══════════════════════════════════════════════════════════════
-- v70 cron'u service_role_key custom setting'e bağımlıydı (manuel
-- ALTER DATABASE gerektiriyordu). v71 anon key kullanır:
--   - Anon key public (uygulama bundle'ında zaten exposed)
--   - Edge function verify_jwt için anon yeterli (geçerli JWT)
--   - Function içinde SUPABASE_SERVICE_ROLE_KEY env auto-injected
-- ═══════════════════════════════════════════════════════════════

-- Önceki schedule'ı sil
DO $$
BEGIN
  PERFORM cron.unschedule('weekly-email-digest');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Yeni schedule — anon key inline (public-safe)
SELECT cron.schedule(
  'weekly-email-digest',
  '0 6 * * 1', -- Pazartesi 06:00 UTC = 09:00 Istanbul
  $cron$
    SELECT net.http_post(
      url := 'https://kpofiuczyjesjlqjxswh.supabase.co/functions/v1/send-email-digest',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtwb2ZpdWN6eWplc2pscWp4c3doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MzkxNjMsImV4cCI6MjA4ODAxNTE2M30.w3QMkePoTddmI6jdj_jJsdwV4LoxkOg6Nh4sIXrsAQA"}'::jsonb,
      body := '{}'::jsonb
    ) AS request_id;
  $cron$
);

DO $$ BEGIN
  RAISE NOTICE 'v71: Weekly digest cron yeniden kuruldu (anon-key). Pazartesi 06:00 UTC. Manuel setting gerekmez.';
END $$;
