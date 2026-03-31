-- ==========================================
-- AŞAMA 2 / ADIM 6: STORAGE (DEPOLAMA)
-- Avatar ve Post Resimleri İçin Bucket & RLS
-- ==========================================

-- 1. Avatars Bucket'ı Oluştur
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true) 
ON CONFLICT (id) DO NOTHING;

-- 2. Post Images Bucket'ı Oluştur
INSERT INTO storage.buckets (id, name, public) 
VALUES ('post-images', 'post-images', true) 
ON CONFLICT (id) DO NOTHING;

-- Eski poliçeleri olası bir çakışmayı önlemek için temizleyelim
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;

DROP POLICY IF EXISTS "Post images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload post images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update post images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete post images" ON storage.objects;


-- ==========================================
-- AVATARS KONTROL LİSTESİ (RLS)
-- ==========================================

-- Okuma: Herkese açık (public true olduğu için public objelere erişim vardır, ama garantileyelim)
CREATE POLICY "Avatar images are publicly accessible" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'avatars');

-- Yükleme: Sadece kendi ID'siyle yükleyebilir
CREATE POLICY "Users can upload their own avatars" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = owner::text
);

-- Güncelleme: Kendi avatarını güncelleyebilir
CREATE POLICY "Users can update their own avatars" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = owner::text
);

-- Silme: Kendi avatarını silebilir
CREATE POLICY "Users can delete their own avatars" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = owner::text
);


-- ==========================================
-- POST IMAGES KONTROL LİSTESİ (RLS)
-- ==========================================

-- Okuma: Herkese açık
CREATE POLICY "Post images are publicly accessible" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'post-images');

-- Yükleme: Kayıtlı her kullanıcı gönderebilir (Kendi sahipliğinde)
CREATE POLICY "Users can upload post images" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'post-images' 
  AND auth.uid()::text = owner::text
);

-- Güncelleme: Kendi resimlerini değiştirebilir
CREATE POLICY "Users can update post images" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'post-images' 
  AND auth.uid()::text = owner::text
);

-- Silme: Kendi resimlerini silebilir
CREATE POLICY "Users can delete post images" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'post-images' 
  AND auth.uid()::text = owner::text
);
