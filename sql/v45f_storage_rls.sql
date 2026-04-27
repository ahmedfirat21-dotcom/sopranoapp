-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v45f — Storage RLS Hardening
--
-- Mevcut: avatars, post-images, voice-notes bucket'larında "herkes her şeyi
-- yapabilir" permissive policy'ler var. Saldırgan ANON key ile başkasının
-- avatarını silebilir, post-imagesa rastgele dosya atabilir.
--
-- Yeni: SELECT (read) public kalır — bunlar zaten public bucket, UI gösterimi
-- için anyone okuyabilmeli. Ama INSERT/UPDATE/DELETE sadece dosya sahibi
-- (path'ın ilk klasörü = app_uid()).
--
-- Path conventions (services/storage.ts'ten):
--   • avatars/{user_id}/{ts}_{token}.jpg
--   • post-images/{user_id}/{ts}_{token}.jpg
--   • post-images/chat/{user_id}/{ts}_{token}.jpg  (chat görseli)
--   • voice-notes/{user_id}/{ts}_{token}.m4a
--   • room-recordings/...  (server-side, LiveKit egress yazar; istemci yazmasın)
--
-- storage.foldername(name) path'i array döner. [1] = ilk klasör.
-- ════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════
-- AVATARS bucket
-- ═══════════════════════════════════════════════════
DROP POLICY IF EXISTS "Anyone can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Avatars public insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_public_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_public_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_public_delete" ON storage.objects;
DROP POLICY IF EXISTS "Avatars public read" ON storage.objects;
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;

-- Public read — UI'da herkes avatar görür
CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Owner-only insert: path'ın ilk klasörü = app_uid()
CREATE POLICY "avatars_owner_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND app_uid() IS NOT NULL
    AND (storage.foldername(name))[1] = app_uid()
  );

-- Owner-only update
CREATE POLICY "avatars_owner_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = app_uid()
  );

-- Owner-only delete
CREATE POLICY "avatars_owner_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = app_uid()
  );


-- ═══════════════════════════════════════════════════
-- POST-IMAGES bucket (post + chat görseli)
-- ═══════════════════════════════════════════════════
DROP POLICY IF EXISTS "Anyone can upload post-images" ON storage.objects;
DROP POLICY IF EXISTS "Post images public update" ON storage.objects;
DROP POLICY IF EXISTS "Public read post-images" ON storage.objects;
DROP POLICY IF EXISTS "post_images_public_insert" ON storage.objects;
DROP POLICY IF EXISTS "post_images_public_update" ON storage.objects;
DROP POLICY IF EXISTS "post_images_public_delete" ON storage.objects;
DROP POLICY IF EXISTS "post_images_public_read" ON storage.objects;

-- Public read — chat'te ve post'larda herkes görsel görüyor
CREATE POLICY "post_images_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'post-images');

-- Owner-only insert: hem normal post (userId/...) hem chat (chat/userId/...) path'i
CREATE POLICY "post_images_owner_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'post-images'
    AND app_uid() IS NOT NULL
    AND (
      (storage.foldername(name))[1] = app_uid()
      OR ((storage.foldername(name))[1] = 'chat' AND (storage.foldername(name))[2] = app_uid())
    )
  );

-- Owner-only update
CREATE POLICY "post_images_owner_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'post-images'
    AND (
      (storage.foldername(name))[1] = app_uid()
      OR ((storage.foldername(name))[1] = 'chat' AND (storage.foldername(name))[2] = app_uid())
    )
  );

-- Owner-only delete
CREATE POLICY "post_images_owner_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'post-images'
    AND (
      (storage.foldername(name))[1] = app_uid()
      OR ((storage.foldername(name))[1] = 'chat' AND (storage.foldername(name))[2] = app_uid())
    )
  );


-- ═══════════════════════════════════════════════════
-- VOICE-NOTES bucket
-- ═══════════════════════════════════════════════════
DROP POLICY IF EXISTS "voice_notes_public_insert" ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_public_read" ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_public_select" ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_public_delete" ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "voice_notes_upload" ON storage.objects;

-- Public read — alıcı sesli mesajı dinleyebilmeli
CREATE POLICY "voice_notes_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'voice-notes');

-- Owner-only insert
CREATE POLICY "voice_notes_owner_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'voice-notes'
    AND app_uid() IS NOT NULL
    AND (storage.foldername(name))[1] = app_uid()
  );

-- Owner-only delete
CREATE POLICY "voice_notes_owner_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[1] = app_uid()
  );


-- ═══════════════════════════════════════════════════
-- ROOM-RECORDINGS bucket
-- ═══════════════════════════════════════════════════
-- LiveKit egress server-side yazıyor (service_role key kullanır → RLS bypass).
-- Client tarafı yalnız OKUMA yapabilir. Yazma/silme istemciden YASAK.
DROP POLICY IF EXISTS "room_recordings_public_read" ON storage.objects;
DROP POLICY IF EXISTS "room_recordings_public_insert" ON storage.objects;
DROP POLICY IF EXISTS "room_recordings_public_update" ON storage.objects;
DROP POLICY IF EXISTS "room_recordings_public_delete" ON storage.objects;

-- Public read (kayıtları üyeler dinleyebilmeli — uygulama içi gating yapar)
CREATE POLICY "room_recordings_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'room-recordings');

-- Insert/update/delete: hiç policy yok → service_role dışında reddedilir.

COMMIT;

-- Doğrulama:
-- SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'storage.objects'::regclass ORDER BY polname;
-- 13 policy beklenir: 4 bucket × public_read + 3 bucket × (insert + update + delete) - 0 room-recordings write
-- = 4 read + 3*3 owner ops = 4 + 9 - 1 (voice-notes update yok zaten) = 12-13 policy
