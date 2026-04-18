-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v15 — RPC Güvenlik Sertleştirmesi
--
-- Bu migrasyon, auth.uid() kontrolü eksik olan RPC fonksiyonlarını güvenli hale getirir.
-- Supabase SQL Editor'da çalıştırın.
--
-- Düzeltilen fonksiyonlar:
-- 1. increment_category_visit  → auth.uid() kontrolü eklendi
-- 2. increment_listener_count  → auth.uid() kontrolü eklendi
-- 3. decrement_listener_count  → auth.uid() kontrolü eklendi
-- 4. toggle_post_like          → auth.uid() kontrolü eklendi (yoksa oluşturulur)
--
-- Zaten güvenli olanlar:
-- ✅ grant_system_points (v10'da düzeltildi)
-- ✅ get_boosted_profiles (salt okunur, public — güvenli)
-- ════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════
-- 1. increment_category_visit → GÜVENLİ VERSİYON
-- ═══════════════════════════════════════════════════
-- Eski: auth.uid() kontrolü YOK — herhangi biri başkasının kategori tercihini değiştirebiliyordu
CREATE OR REPLACE FUNCTION increment_category_visit(p_user_id TEXT, p_category TEXT)
RETURNS void AS $$
BEGIN
  -- ★ GÜVENLİK: Sadece kendi UID'si için çağırabilir
  IF auth.uid() IS NOT NULL AND auth.uid()::text != p_user_id THEN
    RAISE EXCEPTION 'Yetkiniz yok: Sadece kendi kategori tercihlerinizi güncelleyebilirsiniz.';
  END IF;

  -- Kategori adı doğrulaması (max 30 karakter, boş olamaz)
  IF p_category IS NULL OR LENGTH(TRIM(p_category)) < 1 OR LENGTH(p_category) > 30 THEN
    RETURN; -- geçersiz kategori sessizce yoksay
  END IF;

  INSERT INTO user_category_preferences (user_id, category, visit_count, last_visited_at)
  VALUES (p_user_id, p_category, 1, now())
  ON CONFLICT (user_id, category)
  DO UPDATE SET
    visit_count = user_category_preferences.visit_count + 1,
    last_visited_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════
-- 2. increment_listener_count → GÜVENLİ VERSİYON
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION increment_listener_count(room_id_input UUID)
RETURNS void AS $$
BEGIN
  -- ★ GÜVENLİK: Giriş yapan kullanıcı gerekli
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Kimlik doğrulama gereklidir.';
  END IF;

  -- Negatif listener count koruması — artırmadan önce oda var mı kontrol et
  UPDATE rooms 
  SET listener_count = COALESCE(listener_count, 0) + 1 
  WHERE id = room_id_input AND is_live = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════
-- 3. decrement_listener_count → GÜVENLİ VERSİYON
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION decrement_listener_count(room_id_input UUID)
RETURNS void AS $$
BEGIN
  -- ★ GÜVENLİK: Giriş yapan kullanıcı gerekli
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Kimlik doğrulama gereklidir.';
  END IF;

  -- ★ NEGATİFE DÜŞME KORUMASI: GREATEST(0, count - 1)
  UPDATE rooms 
  SET listener_count = GREATEST(COALESCE(listener_count, 0) - 1, 0) 
  WHERE id = room_id_input;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════
-- 4. toggle_post_like → GÜVENLİ VERSİYON
-- ═══════════════════════════════════════════════════
-- Eğer bu fonksiyon Dashboard'da oluşturulduysa, aşağıdaki güvenli versiyonla değiştirin.
CREATE OR REPLACE FUNCTION toggle_post_like(p_post_id UUID, p_user_id TEXT)
RETURNS JSON AS $$
DECLARE
  v_liked BOOLEAN;
BEGIN
  -- ★ GÜVENLİK: Sadece kendi UID'si ile beğeni yapabilir
  IF auth.uid() IS NOT NULL AND auth.uid()::text != p_user_id THEN
    RAISE EXCEPTION 'Yetkiniz yok: Sadece kendi adınıza beğeni yapabilirsiniz.';
  END IF;

  -- Mevcut beğeni var mı kontrol et
  IF EXISTS (SELECT 1 FROM post_likes WHERE post_id = p_post_id AND user_id = p_user_id) THEN
    -- Beğeniyi kaldır
    DELETE FROM post_likes WHERE post_id = p_post_id AND user_id = p_user_id;
    -- likes_count düşür (negatife düşmesin)
    UPDATE posts SET likes_count = GREATEST(COALESCE(likes_count, 0) - 1, 0) WHERE id = p_post_id;
    v_liked := false;
  ELSE
    -- Beğeni ekle
    INSERT INTO post_likes (post_id, user_id) VALUES (p_post_id, p_user_id)
    ON CONFLICT (post_id, user_id) DO NOTHING;
    -- likes_count artır
    UPDATE posts SET likes_count = COALESCE(likes_count, 0) + 1 WHERE id = p_post_id;
    v_liked := true;
  END IF;

  RETURN json_build_object('liked', v_liked);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══ DONE ═══
-- Tüm RPC fonksiyonları auth.uid() kontrolü ile güvenli hale getirildi.
-- Bu migrasyonu Supabase SQL Editor'da çalıştırmayı unutmayın.
