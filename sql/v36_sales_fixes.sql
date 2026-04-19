-- ═══════════════════════════════════════════════════════════════════
-- v36: Satış akışı düzeltmeleri (2026-04-19)
-- ═══════════════════════════════════════════════════════════════════
-- 1. SP paket ID uyumsuzluğu (KRİTİK)
--    App: soprano_sp_1500/4000/10000
--    DB (v27): sp_1500/4000/10000
--    Sonuç: 1500+ SP paketleri claim_sp_package RPC'de
--    "Geçersiz paket ID" döner → büyük paketler hiç satılmıyor.
--    Fix: DB kayıtlarını app ile senkronize et.
--
-- 2. cleanup_expired_boosts() kolon adı hatası (ORTA)
--    v28 profiles bloğu "boost_expires_at" kullanıyor, oysa v11'de kolon
--    "profile_boost_expires_at" olarak tanımlı. undefined_column exception
--    silent-fail ile yakalanıyor → profil boost temizliği ÇALIŞMIYOR.
--    Fix: fonksiyonu doğru kolon adıyla yeniden yaz.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ═══ 1. SP Paket ID Senkronizasyonu ═══════════════════════════════════
-- v27 INSERT'ü zaten yapılmış, şimdi yanlış ID'leri doğru ID'lere çek.
-- Eğer soprano_sp_* versiyonu zaten yoksa UPDATE, yoksa (teorik durumda)
-- INSERT ON CONFLICT ile idempotent.

UPDATE sp_packages SET id = 'soprano_sp_1500'  WHERE id = 'sp_1500';
UPDATE sp_packages SET id = 'soprano_sp_4000'  WHERE id = 'sp_4000';
UPDATE sp_packages SET id = 'soprano_sp_10000' WHERE id = 'sp_10000';

-- Güvenlik: ID'ler eksikse (v27 hiç çalışmamışsa) ekle.
INSERT INTO sp_packages (id, sp_amount, bonus_sp, price_try, popular) VALUES
  ('soprano_sp_1500',  1500,  250,  199.99, false),
  ('soprano_sp_4000',  4000,  800,  449.99, false),
  ('soprano_sp_10000', 10000, 2500, 999.99, false)
ON CONFLICT (id) DO UPDATE SET
  sp_amount = EXCLUDED.sp_amount,
  bonus_sp = EXCLUDED.bonus_sp,
  price_try = EXCLUDED.price_try,
  popular = EXCLUDED.popular;


-- ═══ 2. cleanup_expired_boosts() Kolon Adı Fix ═══════════════════════
-- v28'deki fonksiyonu profiles için doğru kolonla (profile_boost_expires_at)
-- güncelle. Rooms kısmı zaten doğru (boost_expires_at), o dokunulmadı.

CREATE OR REPLACE FUNCTION cleanup_expired_boosts()
RETURNS JSON AS $$
DECLARE
  v_profile_cleaned INTEGER := 0;
  v_room_cleaned INTEGER := 0;
BEGIN
  -- Profil boost'ları — v11'de kolon adı "profile_boost_expires_at"
  BEGIN
    WITH expired AS (
      UPDATE profiles
        SET profile_boost_expires_at = NULL
        WHERE profile_boost_expires_at IS NOT NULL
          AND profile_boost_expires_at < now()
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_profile_cleaned FROM expired;
  EXCEPTION WHEN undefined_column THEN NULL;
  END;

  -- Oda boost'ları — v4'te kolon adı "boost_expires_at"
  BEGIN
    WITH expired AS (
      UPDATE rooms
        SET boost_expires_at = NULL
        WHERE boost_expires_at IS NOT NULL
          AND boost_expires_at < now()
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_room_cleaned FROM expired;
  EXCEPTION WHEN undefined_column THEN NULL;
  END;

  RETURN json_build_object(
    'profile_boosts_cleaned', v_profile_cleaned,
    'room_boosts_cleaned', v_room_cleaned
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Yetki
GRANT EXECUTE ON FUNCTION cleanup_expired_boosts() TO authenticated;

COMMIT;

-- ROLLBACK örneği:
-- BEGIN;
--   UPDATE sp_packages SET id = 'sp_1500'  WHERE id = 'soprano_sp_1500';
--   UPDATE sp_packages SET id = 'sp_4000'  WHERE id = 'soprano_sp_4000';
--   UPDATE sp_packages SET id = 'sp_10000' WHERE id = 'soprano_sp_10000';
-- COMMIT;
