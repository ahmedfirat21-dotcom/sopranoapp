-- ════════════════════════════════════════════════════════════
-- v87 (1 May 2026): Oda kapandığında mesajları sil — Clubhouse paritesi
-- ════════════════════════════════════════════════════════════
--
-- Sorun: rooms.is_live=false olunca room_participants temizleniyor ama
--   public.messages tablosundaki oda mesajları sonsuza kadar kalıyordu.
--   Foreign key CASCADE var ama sadece rooms DELETE'inde tetikleniyor;
--   biz odayı silmiyoruz, sadece is_live=false yapıyoruz → cascade kaçıyor.
--
-- Çözüm: rooms.is_live true→false geçişinde TRIGGER ile o odanın tüm
--   mesajlarını DELETE et. Hangi yoldan kapanırsa kapansın yakalanır:
--     - manuel "Odayı kapat" (RoomService.closeRoom)
--     - 30 dk boş kalma (close_expired_free_rooms cron)
--     - expires_at süresi dolunca (close_expired_free_rooms cron)
--     - admin müdahalesi
--
-- Minimize: oda is_live=true kalır, trigger tetiklenmez ✓
-- Aktif odalar: dokunulmaz ✓

CREATE OR REPLACE FUNCTION public.delete_room_messages_on_close()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_live = TRUE AND NEW.is_live = FALSE THEN
    DELETE FROM public.messages WHERE room_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delete_room_messages_on_close ON public.rooms;

CREATE TRIGGER trg_delete_room_messages_on_close
AFTER UPDATE OF is_live ON public.rooms
FOR EACH ROW
WHEN (OLD.is_live IS DISTINCT FROM NEW.is_live AND NEW.is_live = FALSE)
EXECUTE FUNCTION public.delete_room_messages_on_close();

-- ─── Backfill: mevcut ölü odaların eski mesajlarını temizle ───
DELETE FROM public.messages
WHERE room_id IS NOT NULL
  AND room_id IN (SELECT id FROM public.rooms WHERE is_live = false);
