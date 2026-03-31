-- ============================================
-- SopranoChat — Profil Boost & Giriş Efekti Migration
-- Stratejideki eksik gelir kanallarını tamamlar
-- ============================================

-- 1. Profil Boost sütunu (Keşfet'te öne çıkarma)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS profile_boost_expires_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Profil boost indeksi (sıralama performansı)
CREATE INDEX IF NOT EXISTS idx_profiles_boost
ON profiles (profile_boost_expires_at DESC NULLS LAST)
WHERE profile_boost_expires_at IS NOT NULL;

-- 3. Giriş efekti ürünlerini mağazaya ekle (henüz seed yapılmadıysa)
INSERT INTO store_items (id, name, description, type, price_coins, rarity, is_limited, is_active) VALUES
  ('effect_lightning', '⚡ Şimşek Girişi', 'Odaya girdiğinizde şimşek efekti ile dikkat çekin', 'entry_effect', 75, 'rare', false, true),
  ('effect_fire_walk', '🔥 Ateşli Giriş', 'Ateşten bir yürüyüşle odaya girin', 'entry_effect', 150, 'epic', false, true),
  ('effect_sparkle', '✨ Parıltılı Giriş', 'Yıldız parıltılarıyla göz alıcı bir giriş', 'entry_effect', 50, 'common', false, true),
  ('effect_smoke', '💨 Dumanlı Giriş', 'Gizemli bir duman bulutuyla belirin', 'entry_effect', 100, 'rare', false, true),
  ('effect_crown_drop', '👑 Kraliyet Girişi', 'Bir kral/kraliçe gibi taçla girin — efsanevi!', 'entry_effect', 300, 'legendary', true, true)
ON CONFLICT (id) DO NOTHING;

-- Not: Bu SQL'i Supabase SQL Editor'de çalıştırın.
