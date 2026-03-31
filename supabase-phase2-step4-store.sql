-- ============================================
-- SOPRANOCHAT PHASE 2 - STEP 4: DIGITAL STORE & WALLET
-- ============================================

-- 1. ESKİ TABLOLARI VE TİP ÇAKIŞMALARINI TEMİZLE
DROP TABLE IF EXISTS user_purchases CASCADE;
DROP TABLE IF EXISTS store_items CASCADE;

-- 2. MAĞAZA EŞYALARI TABLOSU (Admin tarafından yönetilir)
CREATE TABLE IF NOT EXISTS store_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT CHECK (type IN ('profile_frame', 'room_theme', 'entry_effect', 'chat_bubble')),
  price_coins INTEGER NOT NULL,
  image_url TEXT,
  rarity TEXT CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')) DEFAULT 'common',
  is_limited BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (Sadece Okunabilir)
ALTER TABLE store_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Store items are publicly readable" ON store_items;
CREATE POLICY "Store items are publicly readable" ON store_items FOR SELECT USING (true);


-- 2. KULLANICI SATIN ALIMLARI (Envanter JOIN Tablosu)
CREATE TABLE IF NOT EXISTS user_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES store_items(id) ON DELETE CASCADE,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, item_id)
);

-- RLS (Kullanıcılar Sadece Kendi Envanterlerini Okur)
ALTER TABLE user_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own purchases" ON user_purchases;
CREATE POLICY "Users can view their own purchases" ON user_purchases FOR SELECT USING (auth.uid()::text = user_id);
-- Insert'ler sadece RPC ile backend'den yapılır!


-- 3. PROFIL TABLOSU - KOZMETİK KUŞANMA SÜTUNLARI (Foreign Key'ler item referansı)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'active_frame') THEN
    ALTER TABLE profiles ADD COLUMN active_frame TEXT REFERENCES store_items(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'active_chat_color') THEN
    ALTER TABLE profiles ADD COLUMN active_chat_color TEXT REFERENCES store_items(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'active_entry_effect') THEN
    ALTER TABLE profiles ADD COLUMN active_entry_effect TEXT REFERENCES store_items(id) ON DELETE SET NULL;
  END IF;
END $$;


-- 4. SATIN ALMA İŞLEMİ (Atomik Transaction & Row-Level Lock)
CREATE OR REPLACE FUNCTION purchase_store_item(
  p_user_id TEXT,
  p_item_id TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  new_balance INTEGER
) AS $$
DECLARE
  v_item_price INTEGER;
  v_user_balance INTEGER;
  v_is_active BOOLEAN;
  v_user_has_item BOOLEAN;
BEGIN
  -- Eşya durumunu al
  SELECT price_coins, is_active INTO v_item_price, v_is_active 
  FROM store_items 
  WHERE id = p_item_id;

  IF v_item_price IS NULL THEN
    RETURN QUERY SELECT false, 'Eşya bulunamadı!', 0;
    RETURN;
  END IF;

  IF NOT v_is_active THEN
    RETURN QUERY SELECT false, 'Bu eşya şu an satışta değil!', 0;
    RETURN;
  END IF;

  -- Zaten envanterde var mı kontrolü
  SELECT EXISTS (
    SELECT 1 FROM user_purchases WHERE user_id = p_user_id AND item_id = p_item_id
  ) INTO v_user_has_item;

  IF v_user_has_item THEN
    RETURN QUERY SELECT false, 'Bu eşyaya zaten sahipsiniz!', 0;
    RETURN;
  END IF;

  -- ROW-LEVEL LOCK: Bakiyeyi güvenle alıp kilitle
  SELECT coins INTO v_user_balance 
  FROM profiles 
  WHERE id = p_user_id 
  FOR UPDATE;

  -- Parası yetiyor mu?
  IF v_user_balance < v_item_price THEN
    RETURN QUERY SELECT false, 'Yetersiz Coin bakiyesi!', v_user_balance;
    RETURN;
  END IF;

  -- Atomik İşlem: Coin düşür + Envantere Ekle
  UPDATE profiles 
  SET coins = coins - v_item_price 
  WHERE id = p_user_id;

  INSERT INTO user_purchases (user_id, item_id)
  VALUES (p_user_id, p_item_id);

  -- Başarıyla döndür
  RETURN QUERY SELECT true, 'Satın alma başarılı!', (v_user_balance - v_item_price);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. KOZMETİK KUŞANMA İŞLEMİ (Eşyaya sahip olmadan giyilmesini engellemek için)
CREATE OR REPLACE FUNCTION equip_store_item(
  p_user_id TEXT,
  p_item_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_item_type TEXT;
  v_user_has_item BOOLEAN;
BEGIN
  -- Zaten envanterde var mı kontrolü (Ayrıca NULL ise "çıkar" işlemi yapar)
  IF p_item_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM user_purchases WHERE user_id = p_user_id AND item_id = p_item_id
    ) INTO v_user_has_item;

    IF NOT v_user_has_item THEN
      RAISE EXCEPTION 'Bu eşyaya sahip değilsiniz!';
    END IF;
  
    -- Eşyanın tipini bul
    SELECT type INTO v_item_type FROM store_items WHERE id = p_item_id;
  END IF;

  -- Kategorisine göre giydir. Eğer p_item_id NULL gönderildiyse o kategoriyi sıfırlar (çıkartır).
  -- Burada eğer silinme istendiyse türü parametre olarak bilmemiz gerekir ama basit tutuyoruz.
  -- Yalnız null desteği istiyorsak type parametresi vermeliyiz. Şimdilik sadece giyme.
  IF p_item_id IS NOT NULL THEN
    IF v_item_type = 'profile_frame' THEN
      UPDATE profiles SET active_frame = p_item_id WHERE id = p_user_id;
    ELSIF v_item_type = 'chat_bubble' THEN
      UPDATE profiles SET active_chat_color = p_item_id WHERE id = p_user_id;
    ELSIF v_item_type = 'entry_effect' THEN
      UPDATE profiles SET active_entry_effect = p_item_id WHERE id = p_user_id;
    END IF;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. BAŞLANGIÇ (SEED) ÜRÜNLERİ (Insert if not exists)
INSERT INTO store_items (id, name, description, type, price_coins, rarity, image_url) VALUES
('frame_rose_vines', 'Gül Sarmaşığı', 'Profiline zarif ve estetik bahar havası katar.', 'profile_frame', 50, 'common', ''),
('frame_fire_aura', 'Alev Aurası', 'Profilinin etrafında durmak bilmeyen bir alev dalgası.', 'profile_frame', 150, 'rare', ''),
('frame_neon_cyber', 'Neon Cyberpunk', 'Geleceğin parıltısını dijital bir yansıma ile göster.', 'profile_frame', 400, 'epic', ''),
('frame_gold_crown', 'Altın Kraliyet', 'Sadece en iyilerin taşıyabileceği altından asil bir sınır.', 'profile_frame', 1500, 'legendary', ''),

('chat_ocean_blue', 'Okyanus Mavisi', 'Derin ve sakinleştirici su damlası tonlarında mesajlar.', 'chat_bubble', 50, 'common', ''),
('chat_neon_green', 'Matrix Hacker', 'Sisteme sızmış gibi neon yeşil terminal mesajları.', 'chat_bubble', 180, 'rare', ''),
('chat_blood_red', 'Kan Kırmızısı', 'Kışkırtıcı ve dikkat çekici bordoya çalan kırmızı baloncular.', 'chat_bubble', 450, 'epic', ''),
('chat_mythic_gold', 'Efsanevi Altın', 'Altın simetrisine sahip kraliyet sarısı gradient yazılar.', 'chat_bubble', 2000, 'legendary', '')
ON CONFLICT (id) DO NOTHING;
