-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v25 — Admin SECURITY DEFINER RPCs (K-PROJE-1)
--
-- Sorun: Admin paneli doğrudan client'tan UPDATE/DELETE yapıyordu.
-- v16 RLS policy'leri bu işlemleri sessiz engelliyor (admin başkasının
-- profilini silemez, başkasının odasını silemez vb.). Sonuç: admin paneli
-- UI'da "silindi" toast'u gösteriyor ama DB'de hiçbir şey olmuyor.
--
-- Çözüm: Tüm admin mutation'ları SECURITY DEFINER RPC'lere taşınır.
-- Her RPC başında caller'ın gerçekten admin olduğu doğrulanır.
-- ════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════
-- Yardımcı: caller admin mi?
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION _is_caller_admin()
RETURNS BOOLEAN AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  SELECT COALESCE(is_admin, false) INTO v_is_admin
    FROM profiles WHERE id = auth.uid()::text;
  RETURN COALESCE(v_is_admin, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════
-- 1. admin_delete_user_cascade
-- ═══════════════════════════════════════════════════
-- Kullanıcıyı ve tüm bağlı verilerini kalıcı olarak siler.
-- Kendi hesabını silemez (güvenlik).
CREATE OR REPLACE FUNCTION admin_delete_user_cascade(p_user_id TEXT)
RETURNS JSON AS $$
DECLARE
  v_deleted_rooms INTEGER := 0;
BEGIN
  IF NOT _is_caller_admin() THEN
    RAISE EXCEPTION 'Yetkisiz: Bu işlem için admin yetkisi gereklidir.'
      USING ERRCODE = '42501';
  END IF;

  IF auth.uid()::text = p_user_id THEN
    RAISE EXCEPTION 'Kendi hesabını admin RPC ile silemezsin.'
      USING ERRCODE = '22023';
  END IF;

  -- Kullanıcının sahip olduğu odaları ve içeriklerini sil
  WITH owned AS (
    SELECT id FROM rooms WHERE host_id = p_user_id
  )
  DELETE FROM rooms WHERE id IN (SELECT id FROM owned);
  GET DIAGNOSTICS v_deleted_rooms = ROW_COUNT;

  -- Trigger/CASCADE olmayan bağlı tabloları temizle
  DELETE FROM room_participants WHERE user_id = p_user_id;
  DELETE FROM messages WHERE sender_id = p_user_id;
  DELETE FROM friendships WHERE user_id = p_user_id OR friend_id = p_user_id;
  DELETE FROM reports WHERE reporter_id = p_user_id OR reported_user_id = p_user_id;

  BEGIN DELETE FROM sp_transactions WHERE user_id = p_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM inbox WHERE user_id = p_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM posts WHERE user_id = p_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM room_bans WHERE user_id = p_user_id OR banned_by = p_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM room_mutes WHERE muted_user_id = p_user_id OR muted_by = p_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM notifications WHERE user_id = p_user_id OR actor_id = p_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM room_follows WHERE user_id = p_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Son: profili sil (V24 trigger admin'in silme yetkisini kısıtlamaz)
  DELETE FROM profiles WHERE id = p_user_id;

  RETURN json_build_object('deleted_rooms', v_deleted_rooms, 'user_id', p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════
-- 2. admin_toggle_admin
-- ═══════════════════════════════════════════════════
-- Admin yetkisi ver/al. V24 trigger'ı caller admin'liğini zaten kontrol
-- eder — bu RPC ek olarak self-demote kilidi koyar.
CREATE OR REPLACE FUNCTION admin_toggle_admin(p_user_id TEXT, p_make_admin BOOLEAN)
RETURNS JSON AS $$
BEGIN
  IF NOT _is_caller_admin() THEN
    RAISE EXCEPTION 'Yetkisiz: Bu işlem için admin yetkisi gereklidir.'
      USING ERRCODE = '42501';
  END IF;

  -- Self-demote → oda sahipsiz ve sistem adminsiz kalmasın diye blok
  IF auth.uid()::text = p_user_id AND p_make_admin = false THEN
    RAISE EXCEPTION 'Kendi adminliğini RPC üzerinden alamazsın. Başka bir admin yapmalı.'
      USING ERRCODE = '22023';
  END IF;

  -- Trigger'a izin bayrağı (is_admin değişikliği için)
  PERFORM set_config('app.is_admin_change_authorized', 'true', true);

  UPDATE profiles SET is_admin = p_make_admin WHERE id = p_user_id;

  RETURN json_build_object('user_id', p_user_id, 'is_admin', p_make_admin);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════
-- 3. admin_grant_sp
-- ═══════════════════════════════════════════════════
-- Admin başka kullanıcıya SP verir. grant_system_points RPC'sini kullanır
-- (daily cap'ten MUAF değil — admin hediyesi leaderboard'u bozmasın diye
-- tier çarpanı sp_transactions'a admin_grant etiketi ile düşer).
CREATE OR REPLACE FUNCTION admin_grant_sp(p_user_id TEXT, p_amount INTEGER, p_reason TEXT DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  v_ext_ref TEXT;
BEGIN
  IF NOT _is_caller_admin() THEN
    RAISE EXCEPTION 'Yetkisiz: Bu işlem için admin yetkisi gereklidir.'
      USING ERRCODE = '42501';
  END IF;

  IF p_amount <= 0 OR p_amount > 100000 THEN
    RAISE EXCEPTION 'Geçersiz SP miktarı (1-100000 arası).';
  END IF;

  -- Idempotency: aynı admin + target + amount + saat bazında tekil
  v_ext_ref := format('admin_grant:%s:%s:%s:%s',
    auth.uid()::text, p_user_id, p_amount, to_char(now(), 'YYYYMMDDHH24MI'));

  -- 4-arg grant_system_points (v20): external_ref ile double-issue engeli
  PERFORM grant_system_points(
    p_user_id,
    p_amount,
    COALESCE('admin_grant: ' || p_reason, 'admin_grant'),
    v_ext_ref
  );

  RETURN json_build_object('user_id', p_user_id, 'amount', p_amount, 'ref', v_ext_ref);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════
-- 4. admin_delete_room
-- ═══════════════════════════════════════════════════
-- Admin herhangi bir odayı silebilir (normal RLS owner-only).
CREATE OR REPLACE FUNCTION admin_delete_room(p_room_id UUID)
RETURNS JSON AS $$
BEGIN
  IF NOT _is_caller_admin() THEN
    RAISE EXCEPTION 'Yetkisiz: Bu işlem için admin yetkisi gereklidir.'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM room_participants WHERE room_id = p_room_id;
  DELETE FROM messages WHERE room_id = p_room_id;
  BEGIN DELETE FROM room_bans WHERE room_id = p_room_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM room_mutes WHERE room_id = p_room_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM room_follows WHERE room_id = p_room_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  DELETE FROM rooms WHERE id = p_room_id;

  RETURN json_build_object('room_id', p_room_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════
-- 5. admin_delete_post
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION admin_delete_post(p_post_id UUID)
RETURNS JSON AS $$
BEGIN
  IF NOT _is_caller_admin() THEN
    RAISE EXCEPTION 'Yetkisiz: Bu işlem için admin yetkisi gereklidir.'
      USING ERRCODE = '42501';
  END IF;

  BEGIN DELETE FROM post_likes WHERE post_id = p_post_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM post_comments WHERE post_id = p_post_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  DELETE FROM posts WHERE id = p_post_id;

  RETURN json_build_object('post_id', p_post_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══ DONE ═══
-- Client kullanımı:
--   supabase.rpc('admin_delete_user_cascade', { p_user_id })
--   supabase.rpc('admin_toggle_admin', { p_user_id, p_make_admin })
--   supabase.rpc('admin_grant_sp', { p_user_id, p_amount, p_reason })
--   supabase.rpc('admin_delete_room', { p_room_id })
--   supabase.rpc('admin_delete_post', { p_post_id })
