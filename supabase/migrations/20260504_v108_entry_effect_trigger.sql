-- ════════════════════════════════════════════════════════════
-- v108.14 (4 May 2026): Entry effect auto-copy trigger
-- ════════════════════════════════════════════════════════════
-- room_participants INSERT'te kullanıcının profiles.active_entry_effect'i
-- otomatik olarak room_participants.entry_effect'e kopyalanır. Eskiden bu
-- adım eksikti → realtime listener her zaman NULL alıyordu, giriş animasyonu
-- hiç tetiklenmiyordu.
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.copy_entry_effect_on_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.entry_effect IS NULL THEN
    SELECT active_entry_effect INTO NEW.entry_effect
      FROM public.profiles WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS copy_entry_effect_before_insert ON public.room_participants;

CREATE TRIGGER copy_entry_effect_before_insert
  BEFORE INSERT ON public.room_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.copy_entry_effect_on_join();
