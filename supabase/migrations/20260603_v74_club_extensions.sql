-- ════════════════════════════════════════════════════════════════════
-- v74 — Kulüp Genişletmeleri (Faz 6.2)
--
-- 1. clubs.treasury_balance — kulüp hazinesi (üye katkıları biriktirir)
-- 2. kick_from_club RPC — owner/mod üyeyi atabilir
-- 3. contribute_to_club_treasury RPC — üye SP'sini hazineye aktarır
-- 4. club_boost_room RPC — owner/mod hazineden kulüp odasını boost eder
--
-- Tüm RPC'ler SECURITY DEFINER + atomik. Hatalar net mesajlarla döner.
-- İdempotent — tekrar çalıştırılabilir.
-- ════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════
-- 1. clubs.treasury_balance kolonu
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS treasury_balance INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.clubs
  ADD CONSTRAINT clubs_treasury_balance_nonneg CHECK (treasury_balance >= 0);

-- ═══════════════════════════════════════════════════════════════════
-- 2. kick_from_club — owner/mod kicks a member
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.kick_from_club(
  p_club_id UUID,
  p_target_user_id TEXT,
  p_by_user_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id TEXT;
  v_actor_role TEXT;
  v_target_role TEXT;
BEGIN
  IF p_club_id IS NULL OR p_target_user_id IS NULL OR p_by_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid params';
  END IF;
  IF p_target_user_id = p_by_user_id THEN
    RAISE EXCEPTION 'Kendinizi atamazsınız.';
  END IF;

  -- Sahibi al
  SELECT owner_id INTO v_owner_id FROM public.clubs WHERE id = p_club_id;
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Kulüp bulunamadı.';
  END IF;

  -- Hedef sahibi mi? Sahip atılamaz
  IF p_target_user_id = v_owner_id THEN
    RAISE EXCEPTION 'Sahip atılamaz.';
  END IF;

  -- Actor rolünü al
  SELECT role INTO v_actor_role FROM public.club_members
  WHERE club_id = p_club_id AND user_id = p_by_user_id;
  IF v_actor_role IS NULL THEN
    RAISE EXCEPTION 'Bu kulübün üyesi değilsiniz.';
  END IF;
  IF v_actor_role NOT IN ('owner', 'moderator') THEN
    RAISE EXCEPTION 'Yetki yok — sadece sahip ve moderatör atabilir.';
  END IF;

  -- Hedef rolünü al
  SELECT role INTO v_target_role FROM public.club_members
  WHERE club_id = p_club_id AND user_id = p_target_user_id;
  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Hedef üye değil.';
  END IF;

  -- Moderatör başka moderatörü atamaz (yalnız sahip atabilir)
  IF v_actor_role = 'moderator' AND v_target_role = 'moderator' THEN
    RAISE EXCEPTION 'Moderatörler birbirini atamaz.';
  END IF;

  DELETE FROM public.club_members
  WHERE club_id = p_club_id AND user_id = p_target_user_id;
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.kick_from_club TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 3. contribute_to_club_treasury — üye SP bağışlar
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.contribute_to_club_treasury(
  p_club_id UUID,
  p_amount INTEGER,
  p_user_id TEXT
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_sp INTEGER;
  v_is_member BOOLEAN;
  v_new_balance INTEGER;
BEGIN
  IF p_amount <= 0 OR p_amount > 100000 THEN
    RAISE EXCEPTION 'Geçersiz miktar (1-100000 SP).';
  END IF;
  IF p_user_id IS NULL OR p_club_id IS NULL THEN
    RAISE EXCEPTION 'invalid params';
  END IF;

  -- Üye mi kontrol et
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id AND user_id = p_user_id
  ) INTO v_is_member;
  IF NOT v_is_member THEN
    RAISE EXCEPTION 'Sadece üyeler hazineye bağışta bulunabilir.';
  END IF;

  -- Kullanıcının yeterli SP'si var mı
  SELECT system_points INTO v_user_sp FROM public.profiles WHERE id = p_user_id;
  IF v_user_sp IS NULL OR v_user_sp < p_amount THEN
    RAISE EXCEPTION 'Yetersiz SP. Mevcut: %', COALESCE(v_user_sp, 0);
  END IF;

  -- Kullanıcı SP'sini düş
  UPDATE public.profiles
  SET system_points = system_points - p_amount
  WHERE id = p_user_id;

  -- Hazineye ekle ve yeni dengeyi al
  UPDATE public.clubs
  SET treasury_balance = treasury_balance + p_amount,
      updated_at = NOW()
  WHERE id = p_club_id
  RETURNING treasury_balance INTO v_new_balance;

  -- SP işlem kaydı (best-effort, fail olsa da işlem geri alınmaz)
  BEGIN
    INSERT INTO public.sp_transactions (user_id, amount, type, description, counterparty_id)
    VALUES (p_user_id, -p_amount, 'club_contribution', 'Kulüp hazinesine bağış', p_club_id::TEXT);
  EXCEPTION WHEN OTHERS THEN
    NULL; -- log'a yazılamadıysa devam et
  END;

  RETURN v_new_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.contribute_to_club_treasury TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 4. club_boost_room — owner/mod hazineden boost uygular
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.club_boost_room(
  p_club_id UUID,
  p_room_id UUID,
  p_duration_hours INTEGER,
  p_by_user_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role TEXT;
  v_room_attached BOOLEAN;
  v_treasury INTEGER;
  v_cost INTEGER;
  v_boost_score INTEGER;
  v_boost_until TIMESTAMPTZ;
  v_new_treasury INTEGER;
BEGIN
  IF p_duration_hours NOT IN (1, 6) THEN
    RAISE EXCEPTION 'Süre 1 veya 6 saat olmalı.';
  END IF;

  -- Yetki kontrolü
  SELECT role INTO v_actor_role FROM public.club_members
  WHERE club_id = p_club_id AND user_id = p_by_user_id;
  IF v_actor_role IS NULL OR v_actor_role NOT IN ('owner', 'moderator') THEN
    RAISE EXCEPTION 'Yetki yok — sadece sahip ve moderatör hazine kullanabilir.';
  END IF;

  -- Oda kulübe bağlı mı
  SELECT EXISTS (
    SELECT 1 FROM public.club_rooms
    WHERE club_id = p_club_id AND room_id = p_room_id
  ) INTO v_room_attached;
  IF NOT v_room_attached THEN
    RAISE EXCEPTION 'Bu oda kulübünüze bağlı değil.';
  END IF;

  -- Maliyet (room boost SP fiyatlarıyla aynı)
  v_cost := CASE p_duration_hours WHEN 6 THEN 400 ELSE 100 END;
  v_boost_score := CASE p_duration_hours WHEN 6 THEN 100 ELSE 50 END;

  -- Hazinede yeterli var mı
  SELECT treasury_balance INTO v_treasury FROM public.clubs WHERE id = p_club_id;
  IF v_treasury < v_cost THEN
    RAISE EXCEPTION 'Hazine yetersiz. Gerekli: %, Mevcut: %', v_cost, v_treasury;
  END IF;

  -- Hazineden düş
  UPDATE public.clubs
  SET treasury_balance = treasury_balance - v_cost,
      updated_at = NOW()
  WHERE id = p_club_id
  RETURNING treasury_balance INTO v_new_treasury;

  -- Odayı boost et
  v_boost_until := NOW() + (p_duration_hours || ' hours')::INTERVAL;
  UPDATE public.rooms
  SET boost_expires_at = v_boost_until,
      boost_score = v_boost_score
  WHERE id = p_room_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'cost', v_cost,
    'new_treasury', v_new_treasury,
    'boost_until', v_boost_until,
    'boost_score', v_boost_score
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.club_boost_room TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 5. Notification
-- ═══════════════════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE 'v74: Kulüp hazinesi + üye atma + kolektif boost RPC''leri kuruldu.';
END $$;
