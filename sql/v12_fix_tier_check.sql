-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v12 — profiles_tier_check Constraint Düzeltmesi
-- 
-- SORUN: Eski 'tier' kolonu eski enum değerleri bekliyor (ör. 'free', 'silver', 'gold', 'diamond')
-- Yeni sistem 'Free', 'Plus', 'Pro' kullanıyor → constraint violation.
--
-- ÇÖZÜM: Eski constraint'i kaldır ve yeni değerlerle yeniden oluştur.
-- Ayrıca eski tier değerlerini yeni formata migrate et.
-- ════════════════════════════════════════════════════════════════════

-- 1. Eski constraint'i kaldır
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_tier_check;

-- 2. Eski tier değerlerini yeni formata migrate et
UPDATE profiles SET tier = 'Free' WHERE tier IS NULL OR tier = '' OR tier = 'free';
UPDATE profiles SET tier = 'Plus' WHERE tier IN ('silver', 'plus');
UPDATE profiles SET tier = 'Pro' WHERE tier IN ('gold', 'diamond', 'pro');

-- 3. Yeni constraint ekle — yeni 3-tier sistemiyle uyumlu
-- NULL'a da izin ver (tier kolonu opsiyonel, subscription_tier ana kolon)
ALTER TABLE profiles ADD CONSTRAINT profiles_tier_check 
  CHECK (tier IS NULL OR tier IN ('Free', 'Plus', 'Pro', 'free', 'plus', 'pro'));

-- 4. subscription_tier kolonu da aynı şekilde güncelle (güvenlik için)
UPDATE profiles SET subscription_tier = 'Free' 
  WHERE subscription_tier IS NULL OR subscription_tier = '' OR subscription_tier NOT IN ('Free', 'Plus', 'Pro');

-- ═══ DONE ═══
