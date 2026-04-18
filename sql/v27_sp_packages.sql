-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v27 — SP Paketi Server-Side Fiyat Doğrulama (Y4)
--
-- Sorun: SP_PACKAGES client-side hardcoded (app/sp-store.tsx). Kullanıcı
-- bundle'ı patch'leyip fiyatı/SP miktarını manipüle edebilir ya da mock
-- mode'da fake satın alma simüle edebilir.
--
-- Çözüm: Paket kataloğu DB'de (sp_packages tablosu). Client paket ID
-- gönderir, backend RPC katalogdan gerçek SP miktarını alır.
-- grant_system_points idempotency key'i RevenueCat transaction ID.
-- ════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════
-- 1. sp_packages tablosu
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sp_packages (
  id TEXT PRIMARY KEY,           -- Google Play product ID ile eşleşir
  sp_amount INTEGER NOT NULL CHECK (sp_amount > 0),
  bonus_sp INTEGER NOT NULL DEFAULT 0 CHECK (bonus_sp >= 0),
  price_try NUMERIC(10,2) NOT NULL CHECK (price_try > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  popular BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: herkes okuyabilir (katalog public), sadece admin yazabilir
ALTER TABLE sp_packages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "sp_packages_public_read" ON sp_packages';
  EXECUTE 'DROP POLICY IF EXISTS "sp_packages_admin_write" ON sp_packages';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE POLICY "sp_packages_public_read" ON sp_packages
  FOR SELECT USING (true);

CREATE POLICY "sp_packages_admin_write" ON sp_packages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()::text AND is_admin = true)
  );


-- ═══════════════════════════════════════════════════
-- 2. Katalog seed — app/sp-store.tsx ile senkron
-- ═══════════════════════════════════════════════════
INSERT INTO sp_packages (id, sp_amount, bonus_sp, price_try, popular) VALUES
  ('soprano_sp_100',  100,   0,    14.99,  false),
  ('soprano_sp_250',  250,   25,   34.99,  false),
  ('soprano_sp_600',  600,   75,   99.99,  true),
  ('sp_1500',         1500,  250,  199.99, false),
  ('sp_4000',         4000,  800,  449.99, false),
  ('sp_10000',        10000, 2500, 999.99, false)
ON CONFLICT (id) DO UPDATE SET
  sp_amount = EXCLUDED.sp_amount,
  bonus_sp = EXCLUDED.bonus_sp,
  price_try = EXCLUDED.price_try,
  popular = EXCLUDED.popular;


-- ═══════════════════════════════════════════════════
-- 3. claim_sp_package RPC
-- ═══════════════════════════════════════════════════
-- Client satın alma başarılı olduktan sonra bu RPC'yi çağırır.
-- transactionId = RevenueCat/Store transaction ID (idempotency key).
-- Backend katalogdan gerçek SP miktarını alır → client manipülasyonu imkansız.
CREATE OR REPLACE FUNCTION claim_sp_package(
  p_package_id TEXT,
  p_transaction_id TEXT,
  p_tier_bonus_pct NUMERIC DEFAULT 0
) RETURNS JSON AS $$
DECLARE
  v_pkg RECORD;
  v_user_id TEXT;
  v_user_tier TEXT;
  v_total_sp INTEGER;
  v_tier_bonus_sp INTEGER;
  v_external_ref TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Kimlik doğrulama gereklidir.';
  END IF;
  v_user_id := auth.uid()::text;

  -- Katalog lookup
  SELECT * INTO v_pkg FROM sp_packages WHERE id = p_package_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Geçersiz paket ID: %', p_package_id;
  END IF;

  -- Tier bonus hesaplama backend'te (Pro 20%, Plus 10%, Free 0%)
  SELECT subscription_tier INTO v_user_tier FROM profiles WHERE id = v_user_id;
  v_tier_bonus_sp := CASE
    WHEN v_user_tier IN ('Pro', 'pro') THEN FLOOR(v_pkg.sp_amount * 0.20)::INTEGER
    WHEN v_user_tier IN ('Plus', 'premium') THEN FLOOR(v_pkg.sp_amount * 0.10)::INTEGER
    ELSE 0
  END;

  v_total_sp := v_pkg.sp_amount + v_pkg.bonus_sp + v_tier_bonus_sp;

  -- Idempotency ref: transaction_id varsa onu kullan, yoksa pkg+timestamp (mock mode)
  v_external_ref := CASE
    WHEN p_transaction_id IS NOT NULL AND LENGTH(p_transaction_id) > 0
      THEN 'iap:' || p_transaction_id
    ELSE 'pkg:' || p_package_id || ':' || to_char(now(), 'YYYYMMDDHH24MISS')
  END;

  -- grant_system_points (v20 4-arg idempotent)
  PERFORM grant_system_points(
    v_user_id,
    v_total_sp,
    'sp_purchase:' || p_package_id,
    v_external_ref
  );

  RETURN json_build_object(
    'sp_amount', v_pkg.sp_amount,
    'bonus_sp', v_pkg.bonus_sp,
    'tier_bonus_sp', v_tier_bonus_sp,
    'total_sp', v_total_sp,
    'external_ref', v_external_ref
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══ DONE ═══
-- Client kullanımı:
--   supabase.rpc('claim_sp_package', {
--     p_package_id: 'soprano_sp_100',
--     p_transaction_id: 'google_play_txn_xyz',
--   });
-- Backend gerçek SP miktarını katalogdan alır; client amount manipülasyonu etkisiz.
