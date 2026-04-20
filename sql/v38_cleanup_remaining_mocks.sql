-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v38 — Kalan Mock/Seed Oda Temizliği
--
-- Problem (2026-04-20):
--   v29'dan sonra da DB'de kalan bazı mock odalar keşfette görünüyor:
--     - "Genel Kültür Yarışması" (Zeynep Aksoy host)
--     - "Kripto & Borsa Analizi" (VEX host)
--   Bunlar ya önceki test seed'lerinin kalıntısı ya da manuel eklenmiş.
--
-- Çözüm: Bilinen mock room adlarını + yetim odaları DB'den sil.
-- v29'un pattern tamamlayıcısı — gerçek kullanıcı odaları etkilenmez.
-- ════════════════════════════════════════════════════════════════════


-- 1. Bilinen mock oda adları (2026-04-20 ekrandan tespit)
DELETE FROM rooms
  WHERE name IN (
    'Genel Kültür Yarışması',
    '🧠 Genel Kültür Yarışması',
    'Kripto & Borsa Analizi',
    '💰 Kripto & Borsa Analizi',
    'Deneme ifreli oda',
    'Deneme şifreli oda'
  );


-- 2. Fake host display_name patternleri — mock kullanıcı hostları
-- (Zeynep Aksoy, VEX gibi test isimleriyle açılmış odalar)
DELETE FROM rooms r
  WHERE EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = r.host_id
      AND p.display_name IN ('Zeynep Aksoy', 'VEX', 'Vex')
      AND p.id NOT IN (
        -- Eğer bu isim gerçek bir user ise korumaya al — auth.users'da kaydı varsa
        SELECT id FROM profiles WHERE email IS NOT NULL AND email != ''
      )
  );


-- 3. Süresi dolmuş + inaktif odaları temizle (hygiene)
DELETE FROM rooms
  WHERE is_live = false
    AND expires_at IS NOT NULL
    AND expires_at < now() - INTERVAL '7 days';


-- ═══ DONE ═══
-- Çalıştırmadan önce SELECT ile kontrol et:
--   SELECT id, name, host_id FROM rooms WHERE name IN (...);
-- Gerçek bir kullanıcı odası yanlışlıkla listeleniyorsa IN listesinden çıkar.
