-- ★ v92.15 (1 May 2026): Welcome bonus exploit kapatma — "donatable_sp" ayrımı.
--
-- EXPLOIT (kullanıcı raporu):
--   1. Yeni Google/fake hesap aç → 250 SP welcome bonus al
--   2. Ana hesaba bağış yolla → ana hesabın bakiyesi şişer
--   3. Yeni hesabı sil → tekrar yeni hesap aç → tekrar bonus
--   Bu döngü ile sonsuz SP üretilir, mağaza alımını anlamsızlaştırır.
--
-- FİX:
--   profiles.donatable_sp kolonu — sadece "kazanılmış" SP burada birikir.
--   Bağış RPC bu sayacı kontrol eder; welcome_bonus donatable artırmaz.
--   Yani 250 SP welcome alan hesap, başka aktivite yapmadan bağış yapamaz.
--   Daily login + stage time + mağaza + bağış alma → donatable artar.

-- 1. Kolon ekle (idempotent)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS donatable_sp INTEGER DEFAULT 0;

-- 2. Backfill: launch öncesi MEVCUT kullanıcıların bakiyesi → donatable
--    (geriye uyumluluk; bu kullanıcılar exploit yapmadı, mevcut SP'lerini gönderebilsinler)
UPDATE profiles
SET donatable_sp = COALESCE(system_points, 0)
WHERE donatable_sp IS NULL OR donatable_sp = 0;

-- 3. Trigger fonksiyonu: sp_transactions INSERT → type'a göre donatable_sp sync
CREATE OR REPLACE FUNCTION sync_donatable_sp() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.amount IS NULL OR NEW.amount = 0 THEN
    RETURN NEW;
  END IF;

  -- ★ KRİTİK: welcome_bonus istisnası — donatable ARTMAZ.
  --   Bu sayede yeni hesap bonus'u bağışlayamaz.
  IF NEW.type = 'welcome_bonus' THEN
    RETURN NEW;
  END IF;

  -- Pozitif kazançlar (daily_login, donation_received, store_purchase, vs.)
  --   → donatable artar. donation_received'i de dahil ettik çünkü gerçek
  --   kullanım: A → B → C transfer zinciri legitim (Ayşe aldığı SP'yi
  --   teşekkür için Cem'e yollayabilir). Welcome zaten kapalı.
  IF NEW.amount > 0 THEN
    UPDATE profiles
    SET donatable_sp = COALESCE(donatable_sp, 0) + NEW.amount
    WHERE id = NEW.user_id;
  END IF;

  -- Negatif harcamalar (donation_sent, powerup_*, room_boost, vs.)
  --   → donatable düşer. GREATEST(0, ...) eksiye düşmesin.
  IF NEW.amount < 0 THEN
    UPDATE profiles
    SET donatable_sp = GREATEST(0, COALESCE(donatable_sp, 0) + NEW.amount)
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger'ı yeniden yarat
DROP TRIGGER IF EXISTS trg_sync_donatable_sp ON sp_transactions;
CREATE TRIGGER trg_sync_donatable_sp
  AFTER INSERT ON sp_transactions
  FOR EACH ROW EXECUTE FUNCTION sync_donatable_sp();

-- 5. Yardımcı view: kullanıcının bağış limit'i (UI için)
CREATE OR REPLACE FUNCTION can_user_donate(p_user_id UUID, p_amount INTEGER)
RETURNS JSONB AS $$
DECLARE
  v_donatable INTEGER;
BEGIN
  SELECT COALESCE(donatable_sp, 0) INTO v_donatable
  FROM profiles WHERE id = p_user_id;

  IF v_donatable < p_amount THEN
    RETURN jsonb_build_object(
      'ok', false,
      'donatable', v_donatable,
      'error', 'Bağışlanabilir SP yetersiz: ' || v_donatable ||
               ' SP. Hoşgeldin bonusu bağışlanamaz; günlük giriş, sahne süresi ve mağaza alımıyla kazanılan SP gönderilebilir.'
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'donatable', v_donatable);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
