-- ============================================
-- SOPRANOCHAT PHASE 2 - STEP 4: POST / FEED SYSTEM
-- ============================================

-- 1. LIKE TOGGLE (Atomik Like/Unlike ve Sayac Guncelleme p_post_id, p_user_id ile)
CREATE OR REPLACE FUNCTION toggle_post_like(
  p_post_id UUID,
  p_user_id TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  liked BOOLEAN,
  new_likes_count INTEGER
)
AS $$
DECLARE
  v_exists BOOLEAN;
  v_new_count INTEGER;
BEGIN
  -- 1. Kullanicinin bu postu onceden begenip begenmedigini kontrol et
  SELECT EXISTS (
    SELECT 1 FROM post_likes 
    WHERE post_id = p_post_id AND user_id = p_user_id
  ) INTO v_exists;

  IF v_exists THEN
    -- A) Zaten begenmisse: BEGENIYI KALDIR (Unlike)
    DELETE FROM post_likes 
    WHERE post_id = p_post_id AND user_id = p_user_id;

    UPDATE posts 
    SET likes_count = GREATEST(0, likes_count - 1) 
    WHERE id = p_post_id 
    RETURNING likes_count INTO v_new_count;

    -- Bildirimi de temizleyebiliriz (opsiyonel ama sistemi temiz tutar)
    DELETE FROM notifications 
    WHERE type = 'like' AND reference_id = p_post_id AND sender_id = p_user_id;

    RETURN QUERY SELECT true, false, v_new_count;
  ELSE
    -- B) Begenmemisse: BEGENI EKLE (Like)
    INSERT INTO post_likes (post_id, user_id) 
    VALUES (p_post_id, p_user_id);

    UPDATE posts 
    SET likes_count = likes_count + 1 
    WHERE id = p_post_id 
    RETURNING likes_count INTO v_new_count;
    
    -- Bildirim Olustur
    -- Post sahibine bildirim gitsin
    INSERT INTO notifications (user_id, sender_id, type, reference_id)
    SELECT user_id, p_user_id, 'like', p_post_id
    FROM posts 
    WHERE id = p_post_id AND user_id != p_user_id;

    RETURN QUERY SELECT true, true, v_new_count;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. YORUM EKLEME SONRASI SAYAÇ GÜNCELLEME (Frontend'den cagrilacak)
CREATE OR REPLACE FUNCTION increment_comment_count(
  p_post_id UUID
)
RETURNS void
AS $$
BEGIN
  UPDATE posts
  SET comments_count = comments_count + 1
  WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. TAKİP ETTİKLERİMİN POSTLARI (Following Feed - Cursor Pagination ile daha hizli fetch)
-- Normal fetch PostgREST uzerinden yapilir (services/social.ts), ancak inner-join karmasasini
-- engellemek adina Supabase function olarak da cagirabiliriz:
CREATE OR REPLACE FUNCTION get_following_feed(
  p_user_id TEXT,
  p_limit INTEGER DEFAULT 20,
  p_last_created_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS SETOF posts
AS $$
BEGIN
  -- Zaman imgesi (Cursor) yoksa tumpostları alir
  IF p_last_created_at IS NULL THEN
    RETURN QUERY 
      SELECT p.*
      FROM posts p
      JOIN friendships f ON p.user_id = f.following_id
      WHERE f.follower_id = p_user_id
      ORDER BY p.created_at DESC
      LIMIT p_limit;
  ELSE
    -- Infinity scroll cursor varsa ondan sonrakileri getirir
    RETURN QUERY 
      SELECT p.*
      FROM posts p
      JOIN friendships f ON p.user_id = f.following_id
      WHERE f.follower_id = p_user_id
        AND p.created_at < p_last_created_at
      ORDER BY p.created_at DESC
      LIMIT p_limit;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
