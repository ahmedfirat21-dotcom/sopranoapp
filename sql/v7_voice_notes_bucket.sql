-- =============================================
-- SopranoChat v7 — Voice Notes Storage Bucket
-- =============================================
-- Ses notları (voice notes) için ayrılmış Supabase Storage bucket.
-- Daha önce 'post-images' bucket'ına karışık yükleniyordu.
-- Bu migration ile kendi bucket'ına taşınır.

-- 1. Bucket oluştur
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-notes',
  'voice-notes',
  true,          -- Public erişim (ses notları paylaşılabilir)
  10485760,      -- 10 MB max dosya boyutu
  ARRAY['audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/m4a', 'audio/wav']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS Politikaları — Upload (authenticated users)
CREATE POLICY "voice_notes_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'voice-notes');

-- 3. RLS Politikaları — Public read (herkes okuyabilir)
CREATE POLICY "voice_notes_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'voice-notes');

-- 4. RLS Politikaları — Delete (sadece dosya sahibi silebilir)
CREATE POLICY "voice_notes_owner_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'voice-notes' AND auth.uid()::text = (storage.foldername(name))[1]);
