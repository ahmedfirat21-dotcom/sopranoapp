-- ═══ ADIM 1: profiles tablosuna referral_code kolonu ekle ═══
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code TEXT;

-- ═══ ADIM 2: Referrals (Davet Sistemi) Tablosu ═══
-- NOT: profiles.id TEXT tipinde, bu yüzden referrer_id/referred_id de TEXT
CREATE TABLE IF NOT EXISTS referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Her kullanıcı sadece 1 kez davet kodu kullanabilir
  CONSTRAINT unique_referred UNIQUE (referred_id)
);

-- ═══ ADIM 3: İndeksler ═══
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code) WHERE referral_code IS NOT NULL;
