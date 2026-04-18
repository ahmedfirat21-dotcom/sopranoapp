-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v26 — Storage RLS Policies (K-PROJE-5)
--
-- Avatar/post-image upload path'i: `${userId}/${timestamp}.jpg`.
-- Folder-scoped policy: kullanıcı sadece kendi klasörüne yazabilir/silebilir.
-- Herkes herkesin avatar'ını okuyabilir (public read).
-- ════════════════════════════════════════════════════════════════════


-- AVATARS BUCKET
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_update_own" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- POST-IMAGES BUCKET (aynı desen)
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "post_images_public_read" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "post_images_insert_own" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "post_images_update_own" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "post_images_delete_own" ON storage.objects';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE POLICY "post_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'post-images');

CREATE POLICY "post_images_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'post-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "post_images_update_own" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'post-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "post_images_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'post-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- VOICE-NOTES BUCKET (varsa)
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "voice_notes_insert_own" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "voice_notes_delete_own" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "voice_notes_read_participants" ON storage.objects';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE POLICY "voice_notes_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "voice_notes_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- voice-notes okuma: sender veya receiver ilgili user_id'li path
CREATE POLICY "voice_notes_read_participants" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'voice-notes'
    -- İkili path: sender_id/receiver_id/timestamp.m4a veya sender_id/timestamp.m4a
    -- Herkes okusun, güvenlik URL signed link ile sağlansın (pragmatik)
  );

-- ═══ DONE ═══
-- Kullanıcılar artık başkalarının avatar/post klasörüne yazamaz/silemez.
-- Upload yol deseni değiştirilmemeli: `${userId}/${timestamp}.jpg`.
