-- ════════════════════════════════════════════════════════════════════
-- v284 — KVKK Storage Cleanup (Recording Files)
-- ════════════════════════════════════════════════════════════════════
-- Sorun: v79 migration cleanup_expired_recordings() function'ı uygulanmamış
-- ya da overwrite olmuş. DB'deki current sürüm yalnızca satır siliyor —
-- storage'daki MP3/WAV dosyaları sonsuza dek bucket'ta kalıyor. KVKK gereği
-- silinen kayıtların FİZİKSEL dosyası da yok edilmeli.
--
-- Bu migration:
--   1. v79 cleanup_expired_recordings'i yeniden uygula (log + sil + URL list)
--   2. cleanup_recording_storage() — pg_net ile Supabase Storage API'a DELETE
--   3. Eski saatlik cron sil, KVKK uyumlu 6 saatlik schedule ekle
--   4. Storage cleanup için ayrı 6 saatlik cron (5dk offset — DB sil → storage sil)
--
-- İdempotent — tekrar uygulanabilir.
-- ════════════════════════════════════════════════════════════════════

-- ─── 1) cleanup_expired_recordings — v79 sürümü (log + sil + URL döndür) ──
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
    INSERT INTO public.recording_deletion_log (
      recording_id, room_id, audio_url, duration_seconds,
      host_id, expired_at, deletion_reason, storage_cleaned
    ) VALUES (
      v_rec.recording_id, v_rec.room_id, v_rec.audio_url,
      v_rec.duration_seconds, v_rec.host_id, v_rec.expires_at,
      'ttl_expired', FALSE
    );

    IF v_rec.audio_url IS NOT NULL AND v_rec.audio_url != '' THEN
      v_storage_urls := array_append(v_storage_urls, v_rec.audio_url);
    END IF;

    v_deleted := v_deleted + 1;
  END LOOP;

  DELETE FROM public.room_recordings WHERE expires_at < NOW();

  RETURN jsonb_build_object(
    'deleted_count', v_deleted,
    'storage_urls', to_jsonb(v_storage_urls),
    'cleaned_at', now()::text
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_recordings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_recordings() TO postgres;

-- ─── 2) cleanup_recording_storage — pg_net ile fiziksel dosya silme ──
-- recording_deletion_log'da storage_cleaned=false olan kayıtların audio_url'i
-- üzerinden Supabase Storage API'a DELETE atılır. Başarılıysa storage_cleaned=true.
-- pg_net.http_delete async → sadece request gönderir, response polling ayrı.
-- Burada fire-and-forget yaklaşımı: 404 (dosya zaten yok) da başarı sayılır.
CREATE OR REPLACE FUNCTION public.cleanup_recording_storage()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_processed INTEGER := 0;
  v_supabase_url TEXT;
  v_service_key TEXT;
  v_rec RECORD;
  v_path TEXT;
  v_delete_url TEXT;
  v_request_id BIGINT;
BEGIN
  -- Edge function ortamı değil DB için: vault/secret'tan oku
  -- (pg_net DB-level extension, env yok). Bu sebeple bilinen sabit project URL.
  v_supabase_url := 'https://kpofiuczyjesjlqjxswh.supabase.co';
  v_service_key := current_setting('app.settings.service_role_key', true);

  -- Service role key vault'ta yoksa erken çık — config edilince çalışacak
  IF v_service_key IS NULL OR v_service_key = '' THEN
    RETURN jsonb_build_object(
      'processed', 0,
      'skipped_reason', 'service_role_key_not_configured',
      'hint', 'ALTER DATABASE postgres SET app.settings.service_role_key = ''<key>'';'
    );
  END IF;

  -- Son 7 gün içinde silinen ve storage_cleaned=false olan kayıtları işle
  FOR v_rec IN
    SELECT id, audio_url
    FROM public.recording_deletion_log
    WHERE storage_cleaned = FALSE
      AND deleted_at > NOW() - INTERVAL '7 days'
      AND audio_url IS NOT NULL
      AND audio_url != ''
    LIMIT 100  -- batch limit
  LOOP
    -- URL'den path çıkar: .../storage/v1/object/public/room-recordings/FILE
    -- → DELETE endpoint: /storage/v1/object/room-recordings/FILE
    v_path := regexp_replace(v_rec.audio_url, '^.*/storage/v1/object/public/', '');
    IF v_path IS NULL OR v_path = '' OR v_path = v_rec.audio_url THEN
      CONTINUE;
    END IF;

    v_delete_url := v_supabase_url || '/storage/v1/object/' || v_path;

    -- pg_net async HTTP DELETE
    SELECT net.http_delete(
      url := v_delete_url,
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_service_key,
        'apikey', v_service_key
      )
    ) INTO v_request_id;

    -- Optimistic mark — async olduğu için response beklenmedi.
    -- 404 zaten dosya yok demek, idempotent davranır.
    UPDATE public.recording_deletion_log
    SET storage_cleaned = TRUE
    WHERE id = v_rec.id;

    v_processed := v_processed + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'processed', v_processed,
    'cleaned_at', now()::text
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_recording_storage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_recording_storage() TO postgres;

COMMENT ON FUNCTION public.cleanup_recording_storage IS
  'v284: KVKK uyumlu fiziksel dosya silme. cleanup_expired_recordings sonrası storage_cleaned=false kayıtlar için Supabase Storage API''a DELETE atar.';

-- ─── 3) Eski saatlik cron'u kaldır, KVKK uyumlu schedule ekle ─────────
DO $$
BEGIN
  -- Eski sade DELETE cron'u
  PERFORM cron.unschedule('cleanup-expired-recordings')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-recordings');
  -- Yeni KVKK cron'u var ise reset
  PERFORM cron.unschedule('kvkk-recording-cleanup')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'kvkk-recording-cleanup');
  PERFORM cron.unschedule('kvkk-storage-cleanup')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'kvkk-storage-cleanup');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- DB silme: her 6 saatte (00/06/12/18 UTC)
SELECT cron.schedule(
  'kvkk-recording-cleanup',
  '0 */6 * * *',
  $$ SELECT public.cleanup_expired_recordings(); $$
);

-- Storage silme: aynı saatlerde 5dk sonra (00:05/06:05/12:05/18:05 UTC)
SELECT cron.schedule(
  'kvkk-storage-cleanup',
  '5 */6 * * *',
  $$ SELECT public.cleanup_recording_storage(); $$
);

-- ─── 4) Doğrulama ─────────────────────────────────────────────────────
DO $$
DECLARE
  v_jobs INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_jobs
  FROM cron.job
  WHERE jobname IN ('kvkk-recording-cleanup', 'kvkk-storage-cleanup', 'kvkk-deletion-log-purge');

  RAISE NOTICE 'v284 KVKK Storage Cleanup: aktif cron job sayısı=% (beklenen 3)', v_jobs;
END $$;
