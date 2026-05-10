-- ════════════════════════════════════════════════════════════════════
-- v112: Storage RLS hardening — voice-notes/avatars/post-images
-- ════════════════════════════════════════════════════════════════════
-- Sorun: voice-notes, avatars, post-images bucket'larında PERMISSIVE
--   public_insert ve public_delete policy'leri vardı. Bu owner-only
--   policy'lerin yanında "anyone can write" anlamına geliyor → bir kullanıcı
--   başkasının klasörüne dosya yükleyebilir veya silebilir (vandal/spam).
--
-- Bu migration: write/delete public policy'lerini DROP eder, owner-only
--   politikalar bırakılır. READ policy'leri korunur (mevcut public URL'ler
--   kırılmasın). bucket.public=true olduğu için anon read zaten URL ile
--   erişiliyor — bu post-launch hardening'in büyük scope kısmı.
--
-- Mobile app etkisi YOK — mobile zaten kendi klasörüne yazıyor (app_uid()
--   path'i). Owner policy'leri korumalı.
-- ════════════════════════════════════════════════════════════════════

-- ── voice-notes: write/delete sıkılaştır ─────────────────────────────
DROP POLICY IF EXISTS "voice_notes_public_insert" ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_public_delete" ON storage.objects;
-- voice_notes_owner_insert + voice_notes_owner_delete kalır (mevcut)

-- ── avatars: write/delete sıkılaştır ─────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'avatars_public_insert' AND polrelid = 'storage.objects'::regclass) THEN
    EXECUTE 'DROP POLICY "avatars_public_insert" ON storage.objects';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'avatars_public_delete' AND polrelid = 'storage.objects'::regclass) THEN
    EXECUTE 'DROP POLICY "avatars_public_delete" ON storage.objects';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'avatars_public_update' AND polrelid = 'storage.objects'::regclass) THEN
    EXECUTE 'DROP POLICY "avatars_public_update" ON storage.objects';
  END IF;
END $$;

-- avatars için owner-only policy yoksa ekle (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'avatars_owner_insert' AND polrelid = 'storage.objects'::regclass) THEN
    CREATE POLICY "avatars_owner_insert" ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'avatars' AND app_uid() IS NOT NULL AND (storage.foldername(name))[1] = app_uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'avatars_owner_update' AND polrelid = 'storage.objects'::regclass) THEN
    CREATE POLICY "avatars_owner_update" ON storage.objects FOR UPDATE
      USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = app_uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'avatars_owner_delete' AND polrelid = 'storage.objects'::regclass) THEN
    CREATE POLICY "avatars_owner_delete" ON storage.objects FOR DELETE
      USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = app_uid());
  END IF;
END $$;

-- ── post-images: write/delete sıkılaştır ─────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'post_images_public_insert' AND polrelid = 'storage.objects'::regclass) THEN
    EXECUTE 'DROP POLICY "post_images_public_insert" ON storage.objects';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'post_images_public_delete' AND polrelid = 'storage.objects'::regclass) THEN
    EXECUTE 'DROP POLICY "post_images_public_delete" ON storage.objects';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'post_images_public_update' AND polrelid = 'storage.objects'::regclass) THEN
    EXECUTE 'DROP POLICY "post_images_public_update" ON storage.objects';
  END IF;
END $$;

-- post-images için owner-only policy yoksa ekle (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'post_images_owner_insert' AND polrelid = 'storage.objects'::regclass) THEN
    CREATE POLICY "post_images_owner_insert" ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'post-images' AND app_uid() IS NOT NULL AND (storage.foldername(name))[1] = app_uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'post_images_owner_delete' AND polrelid = 'storage.objects'::regclass) THEN
    CREATE POLICY "post_images_owner_delete" ON storage.objects FOR DELETE
      USING (bucket_id = 'post-images' AND (storage.foldername(name))[1] = app_uid());
  END IF;
END $$;

-- ── Doğrulama notu ───────────────────────────────────────────────────
-- READ policy'leri (public_read/public_select) DOKUNULMADI — bucket public:true
--   olduğu için URL'ler zaten erişilebilir. Read'i kapatmak büyük scope (mobile
--   signed URL'e geçiş gerektirir). Bu post-launch işidir.
--
-- Bu migration'dan sonra:
--   - Anon kullanıcılar dosya yükleyemez/silmez (write/delete artık owner-only)
--   - Mobile app etkilenmez (zaten kendi klasörüne yazıyor)
--   - Privacy gap: public read hâlâ açık (büyük scope, ayrı sprint)
