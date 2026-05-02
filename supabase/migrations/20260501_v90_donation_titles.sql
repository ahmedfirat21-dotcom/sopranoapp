-- ════════════════════════════════════════════════════════════
-- v90 (1 May 2026): Bağış unvanları — kalıcı kazanım sistemi
-- ════════════════════════════════════════════════════════════
--
-- SP kıymet döngüsü roadmap'inin 3. paketi: kullanıcının yaptığı toplam
-- bağışı `profiles.lifetime_sp_donated` kolonunda biriktir, 4 eşik
-- üzerinde unvan kilidini aç.
--
-- Eşikler (UserTitleService bu kolonu okur):
--   100 SP   → Destekçi   (bronz #CD7F32)
--   500 SP   → Cömert Ruh (yeşil  #22C55E)  ← mevcut generous_soul, palet korunur
--   2000 SP  → Hami       (altın  #FBBF24)
--   10000 SP → Hayırsever (mor    #A78BFA)
--
-- Trigger: sp_transactions INSERT type='donation_sent' → ABS(amount) ekle.
-- Backfill: mevcut donation_sent kayıtları toplanıp lifetime_sp_donated'a yazılır.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS lifetime_sp_donated INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_profiles_lifetime_donated
  ON public.profiles(lifetime_sp_donated DESC)
  WHERE lifetime_sp_donated > 0;

CREATE OR REPLACE FUNCTION public.update_lifetime_donated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'donation_sent' THEN
    UPDATE public.profiles
      SET lifetime_sp_donated = COALESCE(lifetime_sp_donated, 0) + ABS(NEW.amount)
      WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Bağış işleminin başarısını engellemesin (best-effort)
  RAISE NOTICE 'lifetime_sp_donated update failed for user %: %', NEW.user_id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_lifetime_donated ON public.sp_transactions;

CREATE TRIGGER trg_update_lifetime_donated
AFTER INSERT ON public.sp_transactions
FOR EACH ROW
WHEN (NEW.type = 'donation_sent')
EXECUTE FUNCTION public.update_lifetime_donated();

-- ─── Backfill: mevcut bağış geçmişini topla ───
UPDATE public.profiles p
SET lifetime_sp_donated = COALESCE(s.total, 0)
FROM (
  SELECT user_id, SUM(ABS(amount))::int AS total
  FROM public.sp_transactions
  WHERE type = 'donation_sent'
  GROUP BY user_id
) s
WHERE p.id = s.user_id;
