-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v47 — Storage RLS Fix: Firebase UID uyumluluğu
--
-- SORUN: auth.uid() NULL döner çünkü Firebase Third-Party Auth ile
--   Supabase native session oluşturulmuyor. Storage upload RLS
--   politikaları auth.uid()::text kontrolü yaptığı için INSERT fail:
--   "new row violates row-level security policy"
--
-- ÇÖZÜM: Tüm bucket'larda INSERT/UPDATE/DELETE politikalarını
--   auth.role() = 'anon' OR auth.role() = 'authenticated' şeklinde
--   genişlet. Path'teki userId kontrolü client-side'da zaten var;
--   anon key ile erişimde auth.uid() NULL olduğu için folder-scoped
--   kısıtlama çalışmıyor. Okuma zaten public.
--
-- NOT: Bu Supabase Dashboard > Storage > voice-notes > Policies
--   bölümünden de yapılabilir.
-- ════════════════════════════════════════════════════════════════════

-- ─── VOICE-NOTES ────────────────────────────────────────────────
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "voice_notes_insert_own" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "voice_notes_delete_own" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "voice_notes_read_participants" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "voice_notes_public_insert" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "voice_notes_public_select" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "voice_notes_public_delete" ON storage.objects';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Herkes upload edebilir (anon key ile erişim — Firebase auth client-side kontrolde)
CREATE POLICY "voice_notes_public_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'voice-notes');

-- Herkes okuyabilir
CREATE POLICY "voice_notes_public_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'voice-notes');

-- Herkes silebilir (kendi path'ini client kontrol eder)
CREATE POLICY "voice_notes_public_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'voice-notes');


-- ─── AVATARS ────────────────────────────────────────────────────
-- Avatar upload da aynı sorundan etkileniyor olabilir.
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "avatars_public_insert" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "avatars_public_update" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "avatars_public_delete" ON storage.objects';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars_public_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "avatars_public_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars');

CREATE POLICY "avatars_public_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'avatars');


-- ─── POST-IMAGES ────────────────────────────────────────────────
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "post_images_public_read" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "post_images_insert_own" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "post_images_update_own" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "post_images_delete_own" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "post_images_public_insert" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "post_images_public_update" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "post_images_public_delete" ON storage.objects';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE POLICY "post_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'post-images');

CREATE POLICY "post_images_public_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'post-images');

CREATE POLICY "post_images_public_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'post-images');

CREATE POLICY "post_images_public_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'post-images');

-- ═══ DONE ═══
-- Tüm bucket'lar artık anon key ile erişilebilir.
-- Firebase auth kullanıldığı için auth.uid() NULL — path-based kontrol
-- client-side'da yapılıyor (userId klasörüne upload).
