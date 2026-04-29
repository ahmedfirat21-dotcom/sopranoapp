-- ═══════════════════════════════════════════════════════════════
-- SopranoChat — v67 Club Triggers + Helper RPCs (Faz 6.1)
-- ═══════════════════════════════════════════════════════════════
-- Tablolar zaten v62'de hazır. Bu migration:
--   1. member_count'u senkron tutan trigger (INSERT/DELETE on club_members)
--   2. owner'i otomatik member yapan trigger (INSERT on clubs)
--   3. join_club / leave_club RPC — atomik üyelik işlemleri
--   4. set_club_member_role RPC — owner/mod rol değişimi (auth checked)
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. member_count trigger
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._sync_club_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.clubs SET member_count = member_count + 1, updated_at = NOW()
    WHERE id = NEW.club_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.clubs SET member_count = GREATEST(member_count - 1, 0), updated_at = NOW()
    WHERE id = OLD.club_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_club_member_count ON public.club_members;
CREATE TRIGGER trg_sync_club_member_count
  AFTER INSERT OR DELETE ON public.club_members
  FOR EACH ROW
  EXECUTE FUNCTION public._sync_club_member_count();

-- ───────────────────────────────────────────────────────────────
-- 2. Auto-add owner as 'owner' member when club created
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._auto_add_club_owner_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Owner kayıdı yoksa ekle. Trigger member_count'u +1 yapar.
  -- Tabloda member_count default 1 olduğu için bunu 0'a sıfırla,
  -- trigger 1'e çıkarsın (race-condition-free).
  UPDATE public.clubs SET member_count = 0 WHERE id = NEW.id;

  INSERT INTO public.club_members (club_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (club_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_add_club_owner ON public.clubs;
CREATE TRIGGER trg_auto_add_club_owner
  AFTER INSERT ON public.clubs
  FOR EACH ROW
  EXECUTE FUNCTION public._auto_add_club_owner_member();

-- ───────────────────────────────────────────────────────────────
-- 3. join_club RPC — atomic + premium check
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.join_club(
  p_club_id UUID,
  p_user_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_public BOOLEAN;
  v_is_premium BOOLEAN;
BEGIN
  IF p_user_id IS NULL OR p_club_id IS NULL THEN
    RAISE EXCEPTION 'invalid params';
  END IF;

  SELECT is_public, is_premium INTO v_is_public, v_is_premium
  FROM public.clubs WHERE id = p_club_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kulüp bulunamadı.';
  END IF;

  IF NOT v_is_public THEN
    RAISE EXCEPTION 'Bu kulüp gizli — davet gerekli.';
  END IF;

  INSERT INTO public.club_members (club_id, user_id, role)
  VALUES (p_club_id, p_user_id, 'member')
  ON CONFLICT (club_id, user_id) DO NOTHING;
  RETURN TRUE;
END;
$$;

-- ───────────────────────────────────────────────────────────────
-- 4. leave_club RPC — atomic
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.leave_club(
  p_club_id UUID,
  p_user_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.club_members
  WHERE club_id = p_club_id AND user_id = p_user_id;

  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF v_role = 'owner' THEN
    RAISE EXCEPTION 'Sahip ayrılamaz. Önce sahipliği devret veya kulübü sil.';
  END IF;

  DELETE FROM public.club_members
  WHERE club_id = p_club_id AND user_id = p_user_id;
  RETURN TRUE;
END;
$$;

-- ───────────────────────────────────────────────────────────────
-- 5. set_club_member_role RPC — owner-only role change
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_club_member_role(
  p_club_id UUID,
  p_target_user_id TEXT,
  p_new_role TEXT,
  p_by_user_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner TEXT;
  v_old_role TEXT;
BEGIN
  IF p_new_role NOT IN ('moderator', 'member') THEN
    RAISE EXCEPTION 'Geçersiz rol.';
  END IF;

  SELECT owner_id INTO v_owner FROM public.clubs WHERE id = p_club_id;
  IF v_owner IS NULL OR v_owner <> p_by_user_id THEN
    RAISE EXCEPTION 'Yetki yok.';
  END IF;

  IF p_target_user_id = v_owner THEN
    RAISE EXCEPTION 'Sahibin rolü değiştirilemez.';
  END IF;

  UPDATE public.club_members
  SET role = p_new_role
  WHERE club_id = p_club_id AND user_id = p_target_user_id;
  RETURN FOUND;
END;
$$;

-- ───────────────────────────────────────────────────────────────
-- 6. Permissions
-- ───────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.join_club TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_club TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_club_member_role TO authenticated;
