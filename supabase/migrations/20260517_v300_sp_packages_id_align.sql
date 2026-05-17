-- ═══════════════════════════════════════════════════════════════════════════
-- v300 — sp_packages ID alignment (Google Play product ID standardı)
--
-- ÖNCEsİ:
--   Aktif paketler `sp-bronze/silver/gold/platinum/diamond` ID'leriyle DB'de.
--   UI (sp-store.tsx) ve Google Play Console ise `soprano_sp_{amount}` ID'leri
--   kullanıyor. RevenueCat satın alma → `purchase_sp_grant(p_package_id=...)`
--   çağırılınca DB'de bu ID bulunamıyor → kullanıcı ÖDÜYOR ama SP gelmiyor.
--
-- SONRAsı:
--   Aktif kayıtların ID'leri Play Console product ID formatına dönüştürüldü.
--   Eski inaktif duplicate kayıtlar silindi (foreign key referansı YOK,
--   sp_transactions'ta da kullanılmamış — temiz silme).
--
-- Güvenlik kontrolü (pre-migration):
--   - SELECT FROM pg_constraint WHERE confrelid = 'sp_packages'::regclass → 0 FK
--   - SELECT COUNT(*) FROM sp_transactions WHERE description ILIKE '%sp-%' → 0
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Inaktif eski soprano_sp_* kayıtları sil (sp_amount uyumsuz, sort ID çakışması)
DELETE FROM sp_packages
WHERE id LIKE 'soprano_sp_%'
  AND is_active = false;

-- 2) Aktif sp-{tier} ID'lerini Play Console formatına rename et
UPDATE sp_packages SET id = 'soprano_sp_100'   WHERE id = 'sp-bronze';
UPDATE sp_packages SET id = 'soprano_sp_500'   WHERE id = 'sp-silver';
UPDATE sp_packages SET id = 'soprano_sp_1500'  WHERE id = 'sp-gold';
UPDATE sp_packages SET id = 'soprano_sp_5000'  WHERE id = 'sp-platinum';
UPDATE sp_packages SET id = 'soprano_sp_15000' WHERE id = 'sp-diamond';

-- 3) Doğrulama notu
DO $$
DECLARE
  active_count int;
  expected_ids text[] := ARRAY['soprano_sp_100','soprano_sp_500','soprano_sp_1500','soprano_sp_5000','soprano_sp_15000'];
BEGIN
  SELECT COUNT(*) INTO active_count FROM sp_packages WHERE id = ANY(expected_ids) AND is_active = true;
  IF active_count != 5 THEN
    RAISE EXCEPTION 'v300 migration FAIL: beklenen 5 aktif soprano_sp_* kayıt, bulunan: %', active_count;
  END IF;
  RAISE NOTICE 'v300: 5 SP paket Play Console ID formatına alındı (soprano_sp_*)';
END $$;
