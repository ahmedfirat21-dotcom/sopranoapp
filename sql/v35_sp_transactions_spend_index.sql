-- ═══════════════════════════════════════════════════════════════════
-- v35: sp_transactions — Harcama (spend) Index
-- ═══════════════════════════════════════════════════════════════════
-- Sorun: v10 idx_sp_transactions_daily `WHERE amount > 0` partial index
--   olduğu için donation_sent (amount < 0) satırlarını kapsamıyor.
--   v34 rate limit sorgusu (`type='donation_sent' AND created_at >= ...`)
--   her çağrıda full scan yapıyor. Bağış hacmi arttıkça her bağış RPC'si
--   O(N) yavaşlar.
--
-- Çözüm: Harcama satırları için ayrı bir partial index. Yalnızca
--   donation_sent gibi spend tipli satırları kapsar, kazanç satırlarını
--   dışarıda bırakır (v10 index orada kalmaya devam eder).
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE INDEX IF NOT EXISTS idx_sp_transactions_spend
  ON public.sp_transactions(user_id, type, created_at DESC)
  WHERE amount < 0;

COMMIT;

-- ROLLBACK:
-- BEGIN; DROP INDEX IF EXISTS public.idx_sp_transactions_spend; COMMIT;
