-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v23 — SP Cross-User Transfer Cap Düzeltmesi (Y20)
--
-- v10'da grant_system_points RPC, auth.uid() != p_user_id iken tek seferde
-- max 500 SP'ye izin veriyordu. Client tarafı ise bağışta 1000 SP'ye kadar
-- kabul ediyor (services/profile.ts donateToUser). Bu uyumsuzluk 501-1000 SP
-- arası bağışların RPC'de reddedilmesine, refund döngüsüne ve son kullanıcı
-- deneyiminde "bağış başarısız" hatasına yol açıyor.
--
-- Çözüm: Cross-user cap 1000 SP'ye yükseltilir. Hem 3-arg hem 4-arg varyantı
-- güncellenir.
-- ════════════════════════════════════════════════════════════════════

-- 3-arg varyant (v10 tarafından tanımlanan)
CREATE OR REPLACE FUNCTION grant_system_points(p_user_id TEXT, p_amount INTEGER, p_action TEXT)
RETURNS void AS $$
DECLARE
  v_current_sp INTEGER;
  v_today_earned INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid()::text != p_user_id THEN
    IF p_amount > 1000 THEN
      RAISE EXCEPTION 'Tek seferde maksimum 1000 SP işlemi yapılabilir';
    END IF;
  END IF;

  IF p_amount < 0 THEN
    SELECT COALESCE(system_points, 0) INTO v_current_sp FROM profiles WHERE id = p_user_id;
    IF v_current_sp + p_amount < 0 THEN
      RAISE EXCEPTION 'Yetersiz SP bakiyesi. Mevcut: %, Gerekli: %', v_current_sp, ABS(p_amount);
    END IF;
  END IF;

  IF p_amount > 0 THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_today_earned
    FROM sp_transactions
    WHERE user_id = p_user_id
      AND amount > 0
      AND created_at >= date_trunc('day', now());
    IF v_today_earned + p_amount > 300 THEN
      p_amount := GREATEST(300 - v_today_earned, 0);
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4-arg varyant (v20 idempotent)
CREATE OR REPLACE FUNCTION grant_system_points(
  p_user_id TEXT,
  p_amount INTEGER,
  p_action TEXT,
  p_external_ref TEXT
) RETURNS JSON AS $$
DECLARE
  v_current_sp INTEGER;
  v_today_earned INTEGER;
  v_existing_tx INTEGER;
BEGIN
  IF p_external_ref IS NOT NULL THEN
    SELECT id INTO v_existing_tx
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
    SELECT COALESCE(system_points, 0) INTO v_current_sp FROM profiles WHERE id = p_user_id;
    IF v_current_sp + p_amount < 0 THEN
      RAISE EXCEPTION 'Yetersiz SP bakiyesi. Mevcut: %, Gerekli: %', v_current_sp, ABS(p_amount);
    END IF;
  END IF;

  IF p_amount > 0 AND p_external_ref IS NULL THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_today_earned
    FROM sp_transactions
    WHERE user_id = p_user_id
      AND amount > 0
      AND external_ref IS NULL
      AND created_at >= date_trunc('day', now());
    IF v_today_earned + p_amount > 300 THEN
      p_amount := GREATEST(300 - v_today_earned, 0);
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══ DONE ═══
-- Cross-user SP transfer limiti 1000 SP'ye yükseltildi.
