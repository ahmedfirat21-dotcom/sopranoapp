-- ============================================
-- SOPRANOCHAT PHASE 2 - STEP 6: REFERANS SİSTEMİ
-- ============================================

-- 1A) profiles tablosuna referral_code ekle
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- 1B) Referral kod üretme fonksiyonu (8 karakter büyük harf ve rakam, Max 5 deneme)
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT
AS $$
DECLARE
  v_new_code TEXT;
  v_exists BOOLEAN;
  v_attempts INTEGER := 0;
BEGIN
  LOOP
    -- 8 karakterlik upper-case alphanumeric random dize uretimi
    v_new_code := upper(substring(md5(random()::text) from 1 for 8));
    
    SELECT EXISTS(SELECT 1 FROM profiles WHERE referral_code = v_new_code) INTO v_exists;
    
    IF NOT v_exists THEN
      RETURN v_new_code;
    END IF;
    
    v_attempts := v_attempts + 1;
    IF v_attempts >= 5 THEN
      RAISE EXCEPTION 'Referans kodu üretimi başarısız oldu. Lütfen tekrar deneyin.';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 1C) Mevcut kullanıcılara otomatik kod ata
UPDATE profiles SET referral_code = generate_referral_code() WHERE referral_code IS NULL;

-- Yeniden tetiklememek ve güvenliği artırmak için NOT NULL constraint ekliyoruz
ALTER TABLE profiles ALTER COLUMN referral_code SET NOT NULL;

-- 1D) Yeni kayıt olanlara otomatik kod ataması için trigger yaz
CREATE OR REPLACE FUNCTION trg_assign_referral_code_fn()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_referral_code ON profiles;
CREATE TRIGGER trg_assign_referral_code
BEFORE INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION trg_assign_referral_code_fn();

-- 1E) referrals tablosu oluştur
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id TEXT NOT NULL,
  referred_id TEXT NOT NULL,
  CONSTRAINT referrals_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT referrals_referred_id_fkey FOREIGN KEY (referred_id) REFERENCES profiles(id) ON DELETE CASCADE,
  reward_given BOOLEAN DEFAULT FALSE,
  rewarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referred_id) -- Bir kullanıcı sadece bir kez davet edilmiş olabilir
);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own referrals" ON referrals;
CREATE POLICY "Users can view own referrals"
  ON referrals FOR SELECT
  USING (auth.uid()::text = referrer_id OR auth.uid()::text = referred_id);

-- 1F) Ödül dağıtma RPC fonksiyonu yaz
CREATE OR REPLACE FUNCTION process_referral_reward(
  p_referral_code TEXT,
  p_referred_id TEXT
)
RETURNS JSON AS $$
DECLARE
  v_referrer_id TEXT;
  v_is_referred BOOLEAN;
  v_birth_date DATE;
BEGIN
  -- 0. Güvenlik: Çağıran kullanıcı sadece kendi adına işlem yapabilir
  IF p_referred_id != auth.uid()::text THEN
    RAISE EXCEPTION 'Yetkisiz işlem: Sadece kendi hesabınız için davet kodu kullanabilirsiniz.';
  END IF;

  -- 1. Verilen kodla referrer_id'yi bul
  SELECT id INTO v_referrer_id FROM profiles WHERE referral_code = upper(p_referral_code);
  
  IF v_referrer_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Geçersiz davet kodu.');
  END IF;

  -- 2. Zaten davet edilmiş mi kontrolü
  SELECT EXISTS(SELECT 1 FROM referrals WHERE referred_id = p_referred_id) INTO v_is_referred;
  IF v_is_referred THEN
    RETURN json_build_object('success', false, 'message', 'Bu cihaz/hesap için zaten bir davet kodu kullanılmış.');
  END IF;

  -- 3. Kendi kendini davet edemez
  IF v_referrer_id = p_referred_id THEN
    RETURN json_build_object('success', false, 'message', 'Kendi davet kodunuzu kullanamazsınız.');
  END IF;

  -- 4. Davet edilenin onboarding'i (doğum tarihi seti) teyit ediliyor mu?
  SELECT birth_date INTO v_birth_date FROM profiles WHERE id = p_referred_id;
  IF v_birth_date IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Önce kaydınızı (doğum tarihi) tamamlamalısınız.');
  END IF;

  -- 5. İşlemler başlasın
  -- A) Referrals tablosuna kaydet
  INSERT INTO referrals (referrer_id, referred_id, reward_given, rewarded_at)
  VALUES (v_referrer_id, p_referred_id, TRUE, NOW());

  -- B) Davet edene 50 coin
  UPDATE profiles SET coins = coins + 50 WHERE id = v_referrer_id;
  INSERT INTO coin_transactions (user_id, amount, type, description) 
  VALUES (v_referrer_id, 50, 'reward', 'Davet ödülü kazandınız');

  -- C) Davet edilene 50 coin
  UPDATE profiles SET coins = coins + 50 WHERE id = p_referred_id;
  INSERT INTO coin_transactions (user_id, amount, type, description)
  VALUES (p_referred_id, 50, 'reward', 'Davet kodu ile katıldınız');

  -- D) Bildirimler
  INSERT INTO notifications (user_id, type, reference_id) 
  VALUES (v_referrer_id, 'reward', p_referred_id);

  RETURN json_build_object('success', true, 'message', 'Harika! 50 Coin hesabınıza tanımlandı.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
