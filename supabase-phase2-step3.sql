-- ============================================
-- SOPRANOCHAT PHASE 2 - STEP 3: ROOM BOOST SYSTEM
-- ============================================

-- 1. YENİ SÜTUNLAR: Odalar tablosuna boost puanı ve süresi ekleniyor.
-- Daha önce tablo oluşturulmuşsa IF NOT EXISTS sütunlarda olmadığı için doğrudan ekliyoruz.
-- Eger sutunlar zaten varsa diye hata fırlatmamasi adina DO bloğu kullanıyoruz.
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rooms' AND column_name = 'boost_score') THEN
    ALTER TABLE rooms ADD COLUMN boost_score INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rooms' AND column_name = 'boost_expires_at') THEN
    ALTER TABLE rooms ADD COLUMN boost_expires_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

-- 2. BOOST KAYIT TABLOSU (Opsiyonel ama analitik için önemli)
CREATE TABLE IF NOT EXISTS room_boosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- Harcanan coin
  duration_minutes INTEGER DEFAULT 30, -- Verilen süre (her boost için)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. BOOST RPC FONKSİYONU
-- Kümülatif süre mantığı ile Atomik Bakiye Düşümü ve Süre Uzatımı
CREATE OR REPLACE FUNCTION boost_room(
  p_room_id UUID,
  p_user_id TEXT,
  p_amount INTEGER -- Örn: 50 Coin
)
RETURNS TABLE (
  success BOOLEAN,
  new_boost_score INTEGER,
  new_boost_expires_at TIMESTAMPTZ,
  user_remaining_coins INTEGER
)
AS $$
DECLARE
  v_sender_coins INTEGER;
  v_current_expires_at TIMESTAMPTZ;
  v_new_expires_at TIMESTAMPTZ;
  v_new_score INTEGER;
  v_user_boost_count INTEGER;
BEGIN
  -- 0. SPAM KONTROLÜ: Kullanıcı son 24 saatte bu odayı kaç kez öne çıkardı? Maksimum 5 hak.
  SELECT COUNT(*) INTO v_user_boost_count 
  FROM room_boosts 
  WHERE room_id = p_room_id 
    AND user_id = p_user_id 
    AND created_at > NOW() - INTERVAL '24 hours';

  IF v_user_boost_count >= 5 THEN
    RAISE EXCEPTION 'Günlük limit aşıldı! Bir odayı 24 saat içinde en fazla 5 kez öne çıkarabilirsiniz.';
  END IF;

  -- 1. Kullanıcının mevcut coin miktarını al
  SELECT coins INTO v_sender_coins FROM profiles WHERE id = p_user_id;

  -- Bakiye yetersizse baştan hata fırlat
  IF v_sender_coins < p_amount THEN
    RAISE EXCEPTION 'Yetersiz Coin bakiyesi. Mevcut: %, İstenen: %', v_sender_coins, p_amount;
  END IF;

  -- 2. Coin düşüşünü yap
  UPDATE profiles
  SET coins = coins - p_amount
  WHERE id = p_user_id
  RETURNING coins INTO v_sender_coins;

  -- 3. Odanın şu anki süresini al ve yeni süreyi KÜMÜLATİF (üzerine koyarak) hesapla
  SELECT boost_expires_at INTO v_current_expires_at FROM rooms WHERE id = p_room_id;

  IF v_current_expires_at IS NULL OR v_current_expires_at < NOW() THEN
    -- Önceden hiç boost atılmamış veya süresi dolmuşsa şimdiden itibaren 30 dk ekle
    v_new_expires_at := NOW() + INTERVAL '30 minutes';
  ELSE
    -- Hali hazırda varsa mevcut kalanın üzerine ekle (Örn: 50dk varsa 80dk olsun)
    v_new_expires_at := v_current_expires_at + INTERVAL '30 minutes';
  END IF;

  -- 4. Odayı Güncelle (+1 skor + süre)
  UPDATE rooms
  SET 
    boost_score = boost_score + 1,
    boost_expires_at = v_new_expires_at
  WHERE id = p_room_id
  RETURNING boost_score INTO v_new_score;

  -- 5. İşlemi Logla
  INSERT INTO room_boosts (room_id, user_id, amount, duration_minutes)
  VALUES (p_room_id, p_user_id, p_amount, 30);

  -- 6. Sonucu döndür
  RETURN QUERY SELECT true, v_new_score, v_new_expires_at, v_sender_coins;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
