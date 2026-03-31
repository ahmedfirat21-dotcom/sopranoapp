-- =============================================
-- FIX 3: Atomik Coin Transaction RPC
-- =============================================

-- balance_after kolonu yoksa ekle
ALTER TABLE coin_transactions ADD COLUMN IF NOT EXISTS balance_after INTEGER;

-- Genel amaçlı atomik coin transaction fonksiyonu
-- Tüm coin işlemleri (hediye, boost HARİCİNDEKİLER) bu fonksiyonu kullanacak
CREATE OR REPLACE FUNCTION process_coin_transaction(
  p_user_id TEXT,
  p_amount INTEGER,        -- Pozitif = ekleme, Negatif = çıkarma
  p_type TEXT,             -- 'gift_sent', 'gift_received', 'boost', 'purchase', 'reward', 'referral' vs.
  p_description TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Kullanıcının mevcut bakiyesini kilitleyerek oku (FOR UPDATE = row lock)
  SELECT coins INTO v_current_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Kullanıcı bulunamadı');
  END IF;

  -- Çıkarma işlemiyse bakiye kontrolü yap
  IF p_amount < 0 AND v_current_balance < ABS(p_amount) THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Yetersiz bakiye. Mevcut: ' || v_current_balance || ', Gereken: ' || ABS(p_amount)
    );
  END IF;

  -- Bakiyeyi güncelle
  v_new_balance := v_current_balance + p_amount;
  
  UPDATE profiles SET coins = v_new_balance WHERE id = p_user_id;

  -- Transaction kaydını oluştur
  INSERT INTO coin_transactions (user_id, amount, type, description, balance_after)
  VALUES (p_user_id, p_amount, p_type, p_description, v_new_balance);

  RETURN json_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'message', 'İşlem başarılı'
  );
END;
$$;
