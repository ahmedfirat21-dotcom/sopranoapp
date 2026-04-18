-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v20 — SP Idempotency (K5 + K6)
--
-- İki kritik ekonomi bug'ı kapatır:
--
-- K5: RevenueCat satın alımı tekrar denenirse (network timeout → retry,
--     veya webhook + client aynı anda işlerse) SP iki kez verilir.
--
-- K6: Kullanıcı bağış/hediye butonuna hızlı çift tıklarsa veya network
--     hatası sonrası retry'da SP iki kez düşer.
--
-- Çözüm: sp_transactions'a external_ref (UNIQUE) kolonu. grant_system_points
-- RPC'si external_ref alırsa önce varlık kontrolü yapar — daha önce aynı
-- referansla işlem yapılmışsa no-op döner.
-- ════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════
-- 1. sp_transactions: external_ref kolonu
-- ═══════════════════════════════════════════════════
DO $$ BEGIN
  ALTER TABLE sp_transactions ADD COLUMN external_ref TEXT;
EXCEPTION WHEN duplicate_column THEN
  RAISE NOTICE 'sp_transactions.external_ref zaten var';
END $$;

-- Partial unique index: sadece NOT NULL referanslarda tekillik zorlanır.
-- Mevcut idempotent olmayan transaction kayıtları etkilenmez.
CREATE UNIQUE INDEX IF NOT EXISTS sp_transactions_external_ref_unique
  ON sp_transactions (external_ref)
  WHERE external_ref IS NOT NULL;


-- ═══════════════════════════════════════════════════
-- 2. grant_system_points — idempotent overload
-- ═══════════════════════════════════════════════════
-- v10'daki grant_system_points(TEXT, INTEGER, TEXT) korunuyor; bu 4-arg
-- versiyonu p_external_ref alır. Client eski çağrısını kullanabilir ama
-- kritik işlemler (satın alma, bağış) yeni versiyonu kullanmalı.
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
  -- ★ Idempotency kontrolü — aynı external_ref daha önce işlendiyse no-op
  IF p_external_ref IS NOT NULL THEN
    SELECT id INTO v_existing_tx
      FROM sp_transactions
      WHERE external_ref = p_external_ref
      LIMIT 1;
    IF FOUND THEN
      RETURN json_build_object('status', 'duplicate', 'amount', 0);
    END IF;
  END IF;

  -- ★ GÜVENLİK (v10'dan): kendi UID'sine SP verebilir, başkasına max 500
  IF auth.uid() IS NOT NULL AND auth.uid()::text != p_user_id THEN
    IF p_amount > 500 THEN
      RAISE EXCEPTION 'Tek seferde maksimum 500 SP işlemi yapılabilir';
    END IF;
  END IF;

  -- ★ NEGATİF BAKİYE KORUMASI
  IF p_amount < 0 THEN
    SELECT COALESCE(system_points, 0) INTO v_current_sp FROM profiles WHERE id = p_user_id;
    IF v_current_sp + p_amount < 0 THEN
      RAISE EXCEPTION 'Yetersiz SP bakiyesi. Mevcut: %, Gerekli: %', v_current_sp, ABS(p_amount);
    END IF;
  END IF;

  -- ★ GÜNLÜK KAZANIM LİMİTİ (sadece pozitif + external_ref olmayan kazanımlar için)
  -- Satın alma (external_ref != NULL) cap'ten MUAF — kullanıcı gerçek para ödedi.
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

  -- Atomik güncelleme
  UPDATE profiles
    SET system_points = GREATEST(COALESCE(system_points, 0) + p_amount, 0)
    WHERE id = p_user_id;

  -- Transaction kaydı — external_ref UNIQUE indeksi olası race'i yakalar
  BEGIN
    INSERT INTO sp_transactions (user_id, amount, type, description, external_ref)
    VALUES (p_user_id, p_amount, p_action, 'SP: ' || p_action, p_external_ref);
  EXCEPTION WHEN unique_violation THEN
    -- Eşzamanlı ikinci çağrı bu noktaya gelirse: ilk INSERT'ten sonra çift UPDATE
    -- olmaması için profili geri al (telafi)
    UPDATE profiles
      SET system_points = GREATEST(COALESCE(system_points, 0) - p_amount, 0)
      WHERE id = p_user_id;
    RETURN json_build_object('status', 'duplicate', 'amount', 0);
  END;

  RETURN json_build_object('status', 'ok', 'amount', p_amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══ DONE ═══
-- Client kullanımı:
--   supabase.rpc('grant_system_points', {
--     p_user_id, p_amount, p_action, p_external_ref: 'rvn:<transactionId>'
--   })
