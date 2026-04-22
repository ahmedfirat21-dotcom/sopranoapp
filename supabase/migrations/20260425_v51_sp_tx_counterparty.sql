-- v51: sp_transactions.counterparty_id — kim kime SP gönderdi/aldı
--
-- Önceden sp_transactions yalnızca user_id (kim değişti) + type (neden) + description tutuyordu.
-- donation_received / donation_sent türleri için "kim gönderdi/aldı" bilgisi kayıp.
-- Kullanıcı geçmişinde "5 SP aldın" görüyor ama kimden belli değil.
--
-- counterparty_id: Karşı taraf profil ID'si. NULL olabilir (system reward'lar için).
-- Backward compat: Mevcut satırlar NULL kalır, yeni insert'ler dolduracak.

BEGIN;

ALTER TABLE public.sp_transactions
  ADD COLUMN IF NOT EXISTS counterparty_id TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_sp_tx_counterparty
  ON public.sp_transactions (counterparty_id)
  WHERE counterparty_id IS NOT NULL;

COMMIT;
