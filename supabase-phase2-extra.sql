-- ============================================
-- SopranoChat — Ek SQL (Phase 2 tamamlama)
-- increment_comment_count RPC + room_messages + referrals
-- ============================================

-- 1. YORUM SAYACI RPC
CREATE OR REPLACE FUNCTION increment_comment_count(p_post_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE posts SET comments_count = comments_count + 1 WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql;

-- 2. ODA İÇİ CANLI MESAJLAR
CREATE TABLE IF NOT EXISTS room_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_messages_room ON room_messages(room_id, created_at DESC);

ALTER TABLE room_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon" ON room_messages;
CREATE POLICY "Allow all for anon" ON room_messages FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE room_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. REFERANS (DAVET) SİSTEMİ
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  reward_claimed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referred_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon" ON referrals;
CREATE POLICY "Allow all for anon" ON referrals FOR ALL USING (true) WITH CHECK (true);

-- 4. REFERANS ÖDÜL FONKSİYONU (Her iki tarafa 50 coin)
CREATE OR REPLACE FUNCTION claim_referral_reward(
  p_referral_code TEXT,
  p_new_user_id TEXT
) RETURNS JSON AS $$
DECLARE
  v_referrer_id TEXT;
  v_referral_id UUID;
  v_reward INTEGER := 50;
BEGIN
  -- Referans kodunu bul
  SELECT referrer_id INTO v_referrer_id
  FROM referrals
  WHERE referral_code = p_referral_code AND referred_id IS NULL
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    -- Kod bulunamadi veya zaten kullanilmis, yeni referral kaydi olustur
    SELECT id INTO v_referrer_id FROM profiles WHERE id = (
      SELECT referrer_id FROM referrals WHERE referral_code = p_referral_code LIMIT 1
    );
    IF v_referrer_id IS NULL THEN
      RAISE EXCEPTION 'Gecersiz davet kodu';
    END IF;
  END IF;

  -- Kendine davet engeli
  IF v_referrer_id = p_new_user_id THEN
    RAISE EXCEPTION 'Kendinizi davet edemezsiniz';
  END IF;

  -- Zaten odul alinmis mi?
  IF EXISTS(SELECT 1 FROM referrals WHERE referred_id = p_new_user_id AND reward_claimed = TRUE) THEN
    RAISE EXCEPTION 'Bu kullanici icin odul zaten alinmis';
  END IF;

  -- Referral kaydini guncelle
  INSERT INTO referrals (referrer_id, referred_id, referral_code, reward_claimed)
  VALUES (v_referrer_id, p_new_user_id, p_referral_code, TRUE)
  ON CONFLICT (referred_id) DO UPDATE SET reward_claimed = TRUE
  RETURNING id INTO v_referral_id;

  -- Davet edene 50 coin
  UPDATE profiles SET coins = coins + v_reward WHERE id = v_referrer_id;
  INSERT INTO coin_transactions (user_id, amount, type, description)
  VALUES (v_referrer_id, v_reward, 'reward', 'Arkadas davet odulu');

  -- Davet edilene 50 coin
  UPDATE profiles SET coins = coins + v_reward WHERE id = p_new_user_id;
  INSERT INTO coin_transactions (user_id, amount, type, description)
  VALUES (p_new_user_id, v_reward, 'reward', 'Davet ile katilim odulu');

  RETURN json_build_object('success', true, 'referral_id', v_referral_id);
END;
$$ LANGUAGE plpgsql;

-- Profillere referans kodu alani ekle
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
