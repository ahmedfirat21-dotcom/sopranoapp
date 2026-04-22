-- v53: sp_transactions.counterparty_id → profiles(id) foreign key
--
-- v51'de counterparty_id TEXT olarak eklendi ama FK yoktu.
-- Supabase'in embedded select syntax'ı (profiles!counterparty_id) FK gerektirir.
-- FK olmadığı için getTransactionHistory() sessizce null dönüyor → işlem geçmişi boş görünüyor.
--
-- Gereksinim: invalid counterparty_id değerleri olmamalı (NULL OK).
-- Mevcut veri kontrolü: counterparty_id halihazırda yazılan yerlerde profil ID'leri.

BEGIN;

-- Geçersiz counterparty_id referanslarını temizle (defensive — henüz yoksa no-op)
UPDATE public.sp_transactions t
   SET counterparty_id = NULL
 WHERE counterparty_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = t.counterparty_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sp_transactions_counterparty_id_fkey'
      AND conrelid = 'public.sp_transactions'::regclass
  ) THEN
    ALTER TABLE public.sp_transactions
      ADD CONSTRAINT sp_transactions_counterparty_id_fkey
      FOREIGN KEY (counterparty_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END$$;

COMMIT;
