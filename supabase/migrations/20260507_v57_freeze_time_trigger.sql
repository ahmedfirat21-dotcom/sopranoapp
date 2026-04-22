-- ═══════════════════════════════════════════════════════════════════
-- v57 — Oda pasife geçerken sayacı otomatik dondur
-- Tarih: 2026-04-22
-- Amaç: is_live=true → false geçişinde kalan süreyi room_settings.remaining_ms
-- olarak JSONB'ye yaz + expires_at=null. Her hangi yol (close, transferHost,
-- scheduled expire) otomatik olarak sayacı dondurur. wakeUpRoom okuyup geri verir.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION _freeze_room_time_on_pause()
RETURNS TRIGGER AS $$
DECLARE
  remain_ms BIGINT;
BEGIN
  -- Sadece true→false geçişinde çalış
  IF OLD.is_live = true AND NEW.is_live = false AND OLD.expires_at IS NOT NULL THEN
    remain_ms := GREATEST(0, (EXTRACT(EPOCH FROM (OLD.expires_at - NOW())) * 1000)::BIGINT);
    -- remaining_ms'i settings'e yaz (wakeUpRoom okuyup kullanacak)
    NEW.room_settings := jsonb_set(
      COALESCE(NEW.room_settings, '{}'::jsonb),
      '{remaining_ms}',
      to_jsonb(remain_ms)
    );
    -- expires_at'i null yap — saat akmasın
    NEW.expires_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS freeze_room_time_on_pause ON rooms;
CREATE TRIGGER freeze_room_time_on_pause
  BEFORE UPDATE ON rooms
  FOR EACH ROW
  WHEN (NEW.is_live IS DISTINCT FROM OLD.is_live)
  EXECUTE FUNCTION _freeze_room_time_on_pause();

-- Mevcut (backward) pasif odaları migrate et:
-- is_live=false && expires_at!=null && remaining_ms yok → remaining_ms yaz, expires_at null
UPDATE rooms
SET
  room_settings = jsonb_set(
    COALESCE(room_settings, '{}'::jsonb),
    '{remaining_ms}',
    to_jsonb(GREATEST(0, (EXTRACT(EPOCH FROM (expires_at - NOW())) * 1000)::BIGINT))
  ),
  expires_at = NULL
WHERE is_live = false
  AND expires_at IS NOT NULL
  AND (room_settings->>'remaining_ms') IS NULL;
