-- ════════════════════════════════════════════════════════════════════
-- v40 FIXED — SP Guard Bypass (değişken adları yenilendi, parse sorunu giderildi)
-- Tarih: 2026-04-21
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION _profile_sensitive_columns_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid_caller TEXT;
  is_admin_flag BOOLEAN;
  bypass_flag TEXT;
BEGIN
  -- RPC bypass kontrolü
  bypass_flag := COALESCE(current_setting('app.sp_rpc_bypass', true), '');
  IF bypass_flag = 'true' THEN
    RETURN NEW;
  END IF;

  uid_caller := auth.uid()::text;

  -- Service-role (auth.uid() NULL) → güven
  IF uid_caller IS NULL THEN
    RETURN NEW;
  END IF;

  -- Caller admin mi? — EXISTS pattern (SELECT INTO ambiguity önler)
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = uid_caller AND is_admin = true)
    INTO is_admin_flag;

  -- is_admin değişikliği sadece admin
  IF COALESCE(OLD.is_admin, false) IS DISTINCT FROM COALESCE(NEW.is_admin, false) THEN
    IF NOT COALESCE(is_admin_flag, false) THEN
      RAISE EXCEPTION 'profiles.is_admin yalnızca mevcut admin tarafından değiştirilebilir.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- system_points sadece RPC veya admin
  IF COALESCE(OLD.system_points, 0) IS DISTINCT FROM COALESCE(NEW.system_points, 0) THEN
    IF NOT COALESCE(is_admin_flag, false) THEN
      RAISE EXCEPTION 'profiles.system_points doğrudan UPDATE ile değiştirilemez — grant_system_points RPC kullanın.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- subscription_tier sadece admin veya service_role
  IF COALESCE(OLD.subscription_tier, '') IS DISTINCT FROM COALESCE(NEW.subscription_tier, '') THEN
    IF NOT COALESCE(is_admin_flag, false) THEN
      RAISE EXCEPTION 'profiles.subscription_tier kullanıcı tarafından değiştirilemez.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_sensitive_guard ON profiles;
CREATE TRIGGER trg_profile_sensitive_guard
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION _profile_sensitive_columns_guard();


-- ═══ grant_system_points 3-arg ═══
CREATE OR REPLACE FUNCTION grant_system_points(p_user_id TEXT, p_amount INTEGER, p_action TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_sp INTEGER;
  today_earned INTEGER;
BEGIN
  PERFORM set_config('app.sp_rpc_bypass', 'true', true);

  IF auth.uid() IS NOT NULL AND auth.uid()::text != p_user_id THEN
    IF p_amount > 1000 THEN
      RAISE EXCEPTION 'Tek seferde maksimum 1000 SP işlemi yapılabilir';
    END IF;
  END IF;

  IF p_amount < 0 THEN
    SELECT COALESCE(system_points, 0) INTO current_sp FROM profiles WHERE id = p_user_id;
    IF current_sp + p_amount < 0 THEN
      RAISE EXCEPTION 'Yetersiz SP bakiyesi. Mevcut: %, Gerekli: %', current_sp, ABS(p_amount);
    END IF;
  END IF;

  IF p_amount > 0 THEN
    SELECT COALESCE(SUM(amount), 0) INTO today_earned
    FROM sp_transactions
    WHERE user_id = p_user_id
      AND amount > 0
      AND created_at >= date_trunc('day', now());
    IF today_earned + p_amount > 300 THEN
      p_amount := GREATEST(300 - today_earned, 0);
      IF p_amount <= 0 THEN
        RETURN;
      END IF;
    END IF;
  END IF;

  UPDATE profiles
    SET system_points = GREATEST(COALESCE(system_points, 0) + p_amount, 0)
    WHERE id = p_user_id;

  INSERT INTO sp_transactions (user_id, amount, type, description)
  VALUES (p_user_id, p_amount, p_action, 'SP: ' || p_action);
END;
$$;


-- ═══ grant_system_points 4-arg (idempotent) ═══
CREATE OR REPLACE FUNCTION grant_system_points(
  p_user_id TEXT,
  p_amount INTEGER,
  p_action TEXT,
  p_external_ref TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_sp INTEGER;
  today_earned INTEGER;
  existing_tx INTEGER;
BEGIN
  PERFORM set_config('app.sp_rpc_bypass', 'true', true);

  IF p_external_ref IS NOT NULL THEN
    SELECT id INTO existing_tx
      FROM sp_transactions
      WHERE external_ref = p_external_ref
      LIMIT 1;
    IF FOUND THEN
      RETURN json_build_object('status', 'duplicate', 'amount', 0);
    END IF;
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid()::text != p_user_id THEN
    IF p_amount > 1000 THEN
      RAISE EXCEPTION 'Tek seferde maksimum 1000 SP işlemi yapılabilir';
    END IF;
  END IF;

  IF p_amount < 0 THEN
    SELECT COALESCE(system_points, 0) INTO current_sp FROM profiles WHERE id = p_user_id;
    IF current_sp + p_amount < 0 THEN
      RAISE EXCEPTION 'Yetersiz SP bakiyesi. Mevcut: %, Gerekli: %', current_sp, ABS(p_amount);
    END IF;
  END IF;

  IF p_amount > 0 AND p_external_ref IS NULL THEN
    SELECT COALESCE(SUM(amount), 0) INTO today_earned
    FROM sp_transactions
    WHERE user_id = p_user_id
      AND amount > 0
      AND external_ref IS NULL
      AND created_at >= date_trunc('day', now());
    IF today_earned + p_amount > 300 THEN
      p_amount := GREATEST(300 - today_earned, 0);
      IF p_amount <= 0 THEN
        RETURN json_build_object('status', 'daily_cap', 'amount', 0);
      END IF;
    END IF;
  END IF;

  UPDATE profiles
    SET system_points = GREATEST(COALESCE(system_points, 0) + p_amount, 0)
    WHERE id = p_user_id;

  BEGIN
    INSERT INTO sp_transactions (user_id, amount, type, description, external_ref)
    VALUES (p_user_id, p_amount, p_action, 'SP: ' || p_action, p_external_ref);
  EXCEPTION WHEN unique_violation THEN
    UPDATE profiles
      SET system_points = GREATEST(COALESCE(system_points, 0) - p_amount, 0)
      WHERE id = p_user_id;
    RETURN json_build_object('status', 'duplicate', 'amount', 0);
  END;

  RETURN json_build_object('status', 'ok', 'amount', p_amount);
END;
$$;
