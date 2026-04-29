-- ════════════════════════════════════════════════════════════════════
-- v79 — KVKK Recording Cleanup Cron
-- ════════════════════════════════════════════════════════════════════
-- KVKK (6698 Sayılı Kanun) gereği:
--   - Ses kayıtları (room_recordings) belirli süre sonra otomatik silinmeli
--   - Silinen verilerin audit log'u tutulmalı (veri imha prosedürü)
--   - Storage bucket'taki fiziksel dosyalar da temizlenmeli
--
-- Bu migration:
--   1. recording_deletion_log — KVKK uyumlu silme günlüğü (denetim için)
--   2. cleanup_expired_recordings() — genişletilmiş: log + silme + storage URL listesi
--   3. pg_cron schedule — her 6 saatte bir otomatik çalışır
--
-- İdempotent — tekrar uygulanabilir.
-- ════════════════════════════════════════════════════════════════════

-- ─── 1) KVKK Silme Günlüğü Tablosu ─────────────────────────────────
-- Hangi kayıtlar ne zaman silindi, kimin odasıydı, ne kadardı.
-- KVKK madde 7: "İlgili kişinin talebi üzerine veya kanunda öngörülen
-- sürelerin sonunda kişisel veriler silinir, yok edilir veya anonim hale
-- getirilir." — Bu tablo o silme işleminin kanıtıdır.
CREATE TABLE IF NOT EXISTS public.recording_deletion_log (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recording_id UUID NOT NULL,
  room_id     UUID,
  audio_url   TEXT,                    -- Silinen dosyanın storage path'i
  duration_seconds INTEGER,
  host_id     TEXT,                    -- Kayıt sahibi (KVKK: veri sorumlusu)
  expired_at  TIMESTAMPTZ,            -- Orijinal expires_at değeri
  deleted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deletion_reason TEXT NOT NULL DEFAULT 'ttl_expired',  -- 'ttl_expired' | 'user_request' | 'admin'
  storage_cleaned BOOLEAN NOT NULL DEFAULT FALSE        -- Dosya da silindi mi?
);

-- Sadece admin/service okuyabilir — KVKK denetim verisi
ALTER TABLE public.recording_deletion_log ENABLE ROW LEVEL SECURITY;

-- RLS policy: service_role only (denetçi erişimi)
DROP POLICY IF EXISTS "deletion_log_service_only" ON public.recording_deletion_log;
-- No permissive policy for authenticated/anon = implicit deny.
-- Service role bypasses RLS.

CREATE INDEX IF NOT EXISTS idx_deletion_log_deleted_at
  ON public.recording_deletion_log (deleted_at DESC);

CREATE INDEX IF NOT EXISTS idx_deletion_log_host
  ON public.recording_deletion_log (host_id, deleted_at DESC);

COMMENT ON TABLE public.recording_deletion_log IS
  'KVKK uyumlu veri imha günlüğü. Silinen kayıtların kanıtı. Denetim için saklanır (5 yıl).';

-- ─── 2) Genişletilmiş Cleanup Fonksiyonu ─────────────────────────────
-- v68'deki basit DELETE yerine: önce log, sonra sil, storage URL'lerini döndür.
CREATE OR REPLACE FUNCTION public.cleanup_expired_recordings()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER := 0;
  v_storage_urls TEXT[] := '{}';
  v_rec RECORD;
BEGIN
  -- Süresi dolmuş kayıtları bul ve logla
  FOR v_rec IN
    SELECT
      rr.id AS recording_id,
      rr.room_id,
      rr.audio_url,
      rr.duration_seconds,
      rr.expires_at,
      r.host_id
    FROM public.room_recordings rr
    LEFT JOIN public.rooms r ON r.id = rr.room_id
    WHERE rr.expires_at < NOW()
  LOOP
    -- KVKK audit log'a yaz
    INSERT INTO public.recording_deletion_log (
      recording_id, room_id, audio_url, duration_seconds,
      host_id, expired_at, deletion_reason
    ) VALUES (
      v_rec.recording_id, v_rec.room_id, v_rec.audio_url,
      v_rec.duration_seconds, v_rec.host_id, v_rec.expires_at,
      'ttl_expired'
    );

    -- Storage URL'sini topla (edge function ile silinecek)
    IF v_rec.audio_url IS NOT NULL AND v_rec.audio_url != '' THEN
      v_storage_urls := array_append(v_storage_urls, v_rec.audio_url);
    END IF;

    v_deleted := v_deleted + 1;
  END LOOP;

  -- DB kayıtlarını sil
  DELETE FROM public.room_recordings
  WHERE expires_at < NOW();

  -- Sonuç: kaç kayıt silindi + temizlenecek storage URL'leri
  RETURN jsonb_build_object(
    'deleted_count', v_deleted,
    'storage_urls', to_jsonb(v_storage_urls),
    'cleaned_at', now()::text
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_recordings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_recordings() TO postgres;

COMMENT ON FUNCTION public.cleanup_expired_recordings IS
  'v79: KVKK uyumlu kayıt temizliği. Süresi dolan kayıtları loglar, siler, storage URL listesini döndürür.';

-- ─── 3) pg_cron Schedule ─────────────────────────────────────────────
-- Her 6 saatte bir çalışır (00:00, 06:00, 12:00, 18:00 UTC)
DO $$
BEGIN
  PERFORM cron.unschedule('kvkk-recording-cleanup')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'kvkk-recording-cleanup'
  );
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'kvkk-recording-cleanup',
  '0 */6 * * *',
  $$ SELECT public.cleanup_expired_recordings(); $$
);

-- ─── 4) Eski deletion log temizliği (5 yıl sonra) ───────────────────
-- KVKK gereği silme kayıtları da belirli süre sonra silinmeli.
-- 5 yıl = yasal saklama süresi (TTK + KVKK iç tutarlılık).
CREATE OR REPLACE FUNCTION public.cleanup_old_deletion_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purged INTEGER;
BEGIN
  DELETE FROM public.recording_deletion_log
  WHERE deleted_at < NOW() - INTERVAL '5 years';
  GET DIAGNOSTICS v_purged = ROW_COUNT;
  RETURN v_purged;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_deletion_logs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_old_deletion_logs() TO postgres;

-- Ayda bir çalıştır (her ayın 1'i 03:00 UTC)
DO $$
BEGIN
  PERFORM cron.unschedule('kvkk-deletion-log-purge')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'kvkk-deletion-log-purge'
  );
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'kvkk-deletion-log-purge',
  '0 3 1 * *',
  $$ SELECT public.cleanup_old_deletion_logs(); $$
);

-- ─── 5) Doğrulama ───────────────────────────────────────────────────
DO $$
DECLARE
  v_jobs INTEGER;
  v_log_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'recording_deletion_log'
  ) INTO v_log_exists;

  SELECT COUNT(*) INTO v_jobs
  FROM cron.job
  WHERE jobname IN ('kvkk-recording-cleanup', 'kvkk-deletion-log-purge');

  RAISE NOTICE 'v79 KVKK Cron: deletion_log tablosu=%, aktif cron job sayısı=%', v_log_exists, v_jobs;
END $$;
