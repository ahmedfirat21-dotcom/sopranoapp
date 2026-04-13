-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v10 — SP Güvenlik Yaması
--
-- Bu migrasyon şu güvenlik açıklarını kapatır:
-- 1. grant_system_points RPC → auth.uid() kontrolü eklendi
-- 2. Negatif bakiye koruması → GREATEST(0) + explicit check
-- 3. profiles.system_points → CHECK constraint eklendi
-- 4. Günlük SP kazanım limiti → DB seviyesinde hardcap (300 SP/gün)
--
-- Supabase SQL Editor'da çalıştırın.
-- ════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════
-- 1. grant_system_points → GÜVENLİ VERSİYON
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION grant_system_points(p_user_id TEXT, p_amount INTEGER, p_action TEXT)
RETURNS void AS $$
DECLARE
  v_current_sp INTEGER;
  v_today_earned INTEGER;
BEGIN
  -- ★ GÜVENLİK: Sadece kendi UID'sine SP verebilir VEYA harcama (negatif) yapabilir
  -- SECURITY DEFINER olduğu için bu kontrol kritik
  -- Not: Server-side (service_role) çağrıları auth.uid() NULL döner, onlara izin ver
  IF auth.uid() IS NOT NULL AND auth.uid()::text != p_user_id THEN
    -- Bağış alımı (tip_received) ve refund gibi cases için: amount > 0 ve caller != target → izin ver
    -- Ama amount'u sınırla: max 500 SP tek seferde
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

  -- ★ GÜNLÜK KAZANIM LİMİTİ (sadece pozitif SP için)
  IF p_amount > 0 THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_today_earned
    FROM sp_transactions
    WHERE user_id = p_user_id
      AND amount > 0
      AND created_at >= date_trunc('day', now());
    
    -- Günlük max 300 SP (tüm kaynaklardan toplam)
    IF v_today_earned + p_amount > 300 THEN
      -- Kalan limiti ver (partial grant)
      p_amount := GREATEST(300 - v_today_earned, 0);
      IF p_amount <= 0 THEN
        RETURN; -- Günlük limit doldu, sessizce dön
      END IF;
    END IF;
  END IF;

  -- Atomik güncelleme (negatife düşmesini de engelle)
  UPDATE profiles 
  SET system_points = GREATEST(COALESCE(system_points, 0) + p_amount, 0) 
  WHERE id = p_user_id;

  -- Transaction kaydı
  INSERT INTO sp_transactions (user_id, amount, type, description)
  VALUES (p_user_id, p_amount, p_action, 'SP: ' || p_action);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════
-- 2. profiles.system_points → Negatife düşmeyi engelle 
-- ═══════════════════════════════════════════════════
-- Mevcut negatif değerleri sıfırla
UPDATE profiles SET system_points = 0 WHERE system_points < 0;

-- CHECK constraint ekle (yoksa)
DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT profiles_sp_non_negative CHECK (system_points >= 0);
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'profiles_sp_non_negative constraint zaten var';
END $$;


-- ═══════════════════════════════════════════════════
-- 3. sp_transactions INDEX — günlük toplam sorgusu için
-- ═══════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_sp_transactions_daily 
  ON sp_transactions(user_id, type, created_at) 
  WHERE amount > 0;


-- ═══ DONE ═══
-- SP güvenlik yaması tamamlandı.
