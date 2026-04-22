-- ═══════════════════════════════════════════════════════════
-- v46 — GodMaster/Admin kullanıcıya Pro + sınırsız SP (test için)
-- Tarih: 2026-04-21
-- Çalıştır: Supabase SQL Editor → Run
-- ═══════════════════════════════════════════════════════════

-- 1) Hedef kullanıcı(lar)ı göster (çalıştırmadan önce kontrol)
SELECT id, display_name, username, subscription_tier, is_admin, system_points
FROM profiles
WHERE is_admin = true OR subscription_tier = 'GodMaster';

-- 2) Pro tier + bol SP ver (GodMaster zaten daha üst seviyede, ama subscription
--    bazlı feature'lar için subscription_tier='Pro' da set edilir).
--    system_points = 999,999,999 (~1 milyar SP — test için pratik sınırsız)
UPDATE profiles
SET
  subscription_tier = 'Pro',
  is_admin = true,
  system_points = 999999999,
  subscription_expires_at = NOW() + INTERVAL '10 years'
WHERE is_admin = true OR subscription_tier = 'GodMaster';

-- 3) SP transaction log'una da yaz (idempotency + audit trail)
INSERT INTO sp_transactions (user_id, amount, reason, metadata)
SELECT id, 999999999, 'admin_grant_test', '{"note":"v46 test grant"}'::jsonb
FROM profiles
WHERE is_admin = true OR subscription_tier = 'GodMaster'
ON CONFLICT DO NOTHING;

-- 4) Doğrula (bu grant sonrası durum)
SELECT id, display_name, subscription_tier, is_admin, system_points, subscription_expires_at
FROM profiles
WHERE is_admin = true OR subscription_tier = 'GodMaster';
