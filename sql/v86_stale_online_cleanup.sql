-- ★ v86: Stale Online Cleanup
-- Sorun: App crash/kill'de setOnline(false) çağrılamıyor → is_online=true sonsuza kadar kalıyor.
-- Çözüm: Her 3 dakikada bir, last_seen > 5dk olan kullanıcıları offline yap.

-- 1. Cleanup fonksiyonu
CREATE OR REPLACE FUNCTION cleanup_stale_online()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET is_online = false
  WHERE is_online = true
    AND (
      last_seen IS NULL
      OR last_seen < NOW() - INTERVAL '5 minutes'
    );
END;
$$;

-- 2. Cron job: Her 3 dakikada bir çalıştır
SELECT cron.schedule(
  'cleanup-stale-online',
  '*/3 * * * *',
  $$SELECT cleanup_stale_online()$$
);

-- Doğrulama:
-- SELECT * FROM cron.job WHERE jobname = 'cleanup-stale-online';
