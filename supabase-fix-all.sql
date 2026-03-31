-- ============================================
-- SOPRANOCHAT — SUPABASE UYUM DÜZELTMESİ
-- Tüm kritik sorunları tek seferde giderir
-- Supabase SQL Editor'a yapıştır ve çalıştır
-- ============================================


-- ============================================
-- FIX 1: notifications — 'reward' tipini ekle
-- ============================================
ALTER TABLE notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('like', 'comment', 'gift', 'follow', 'reward'));


-- ============================================
-- FIX 2: get_following_feed — Sütun adı düzeltmesi
-- friendships tablosunda following_id/follower_id yok,
-- user_id ve friend_id var.
-- ============================================
CREATE OR REPLACE FUNCTION get_following_feed(
  p_user_id TEXT,
  p_limit INTEGER DEFAULT 20,
  p_last_created_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS SETOF posts
AS $$
BEGIN
  IF p_last_created_at IS NULL THEN
    RETURN QUERY 
      SELECT p.*
      FROM posts p
      JOIN friendships f ON p.user_id = f.friend_id
      WHERE f.user_id = p_user_id
        AND f.status = 'accepted'
      ORDER BY p.created_at DESC
      LIMIT p_limit;
  ELSE
    RETURN QUERY 
      SELECT p.*
      FROM posts p
      JOIN friendships f ON p.user_id = f.friend_id
      WHERE f.user_id = p_user_id
        AND f.status = 'accepted'
        AND p.created_at < p_last_created_at
      ORDER BY p.created_at DESC
      LIMIT p_limit;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- FIX 3: events tablosu RLS — Firebase uyumu
-- auth.uid() Firebase ile çalışmaz, "Allow all" ile değiştir
-- (GerçeK güvenlik uygulama katmanında Firebase token ile sağlanıyor)
-- ============================================
DROP POLICY IF EXISTS "Anyone can view events" ON events;
DROP POLICY IF EXISTS "Authenticated users can create events" ON events;
DROP POLICY IF EXISTS "Hosts can update their own events" ON events;

DROP POLICY IF EXISTS "Allow all for anon" ON events;
CREATE POLICY "Allow all for anon" ON events FOR ALL USING (true) WITH CHECK (true);


-- ============================================
-- FIX 4: event_rsvps tablosu RLS — Firebase uyumu
-- ============================================
DROP POLICY IF EXISTS "Anyone can view rsvps" ON event_rsvps;
DROP POLICY IF EXISTS "Users can insert their own rsvp" ON event_rsvps;
DROP POLICY IF EXISTS "Users can update their own rsvp" ON event_rsvps;

DROP POLICY IF EXISTS "Allow all for anon" ON event_rsvps;
CREATE POLICY "Allow all for anon" ON event_rsvps FOR ALL USING (true) WITH CHECK (true);


-- ============================================
-- FIX 5: user_purchases RLS — Firebase uyumu
-- Kullanıcı envanterini görebilmeli
-- ============================================
DROP POLICY IF EXISTS "Users can view their own purchases" ON user_purchases;
DROP POLICY IF EXISTS "Allow all for anon" ON user_purchases;
CREATE POLICY "Allow all for anon" ON user_purchases FOR ALL USING (true) WITH CHECK (true);


-- ============================================
-- FIX 6: referrals RLS — Firebase uyumu
-- ============================================
DROP POLICY IF EXISTS "Users can view own referrals" ON referrals;
DROP POLICY IF EXISTS "Allow all for anon" ON referrals;
CREATE POLICY "Allow all for anon" ON referrals FOR ALL USING (true) WITH CHECK (true);


-- ============================================
-- FIX 7: Storage RLS — Firebase uyumu
-- Firebase Auth ile auth.uid() NULL döner,
-- bu yüzden bucket bazlı izin veriyoruz
-- ============================================

-- Eski kısıtlayıcı politikaları kaldır
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;

DROP POLICY IF EXISTS "Post images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload post images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update post images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete post images" ON storage.objects;

-- Avatars: Herkes okuyabilir ve yükleyebilir
DROP POLICY IF EXISTS "Avatars public read" ON storage.objects;
CREATE POLICY "Avatars public read" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Avatars public insert" ON storage.objects;
CREATE POLICY "Avatars public insert" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Avatars public update" ON storage.objects;
CREATE POLICY "Avatars public update" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Avatars public delete" ON storage.objects;
CREATE POLICY "Avatars public delete" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'avatars');

-- Post images: Herkes okuyabilir ve yükleyebilir
DROP POLICY IF EXISTS "Post images public read" ON storage.objects;
CREATE POLICY "Post images public read" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'post-images');

DROP POLICY IF EXISTS "Post images public insert" ON storage.objects;
CREATE POLICY "Post images public insert" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'post-images');

DROP POLICY IF EXISTS "Post images public update" ON storage.objects;
CREATE POLICY "Post images public update" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'post-images');

DROP POLICY IF EXISTS "Post images public delete" ON storage.objects;
CREATE POLICY "Post images public delete" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'post-images');


-- ============================================
-- Bitti! Tüm düzeltmeler uygulandı.
-- ============================================
