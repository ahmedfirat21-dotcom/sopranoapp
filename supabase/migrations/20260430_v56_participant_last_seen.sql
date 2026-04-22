-- ═══════════════════════════════════════════════════════════════════
-- v56 — room_participants last_seen heartbeat + stale cleanup
-- Tarih: 2026-04-22
-- Amaç: App force-close edilen kullanıcılar odada "zombi" olarak kalıyordu
--   (React Native unmount cleanup process killed'da çalışmaz). Çözüm:
--   - last_seen_at kolonu: client her 20sn günceller
--   - cleanup_stale_participants: 45sn'den eski olanları siler (owner hariç)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE room_participants
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_participants_last_seen
  ON room_participants(room_id, last_seen_at);

-- Heartbeat: tek participant son görülme tarihini günceller
CREATE OR REPLACE FUNCTION update_participant_last_seen(
  p_room_id UUID,
  p_user_id TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE room_participants
    SET last_seen_at = NOW()
    WHERE room_id = p_room_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Stale cleanup: 45sn'den uzun süredir heartbeat göndermeyen
-- (owner hariç — transferHost mantığıyla özel işlenir) participant'ları sil.
CREATE OR REPLACE FUNCTION cleanup_stale_participants(
  p_room_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
  v_cutoff TIMESTAMPTZ := NOW() - INTERVAL '45 seconds';
BEGIN
  WITH deleted AS (
    DELETE FROM room_participants
    WHERE room_id = p_room_id
      AND last_seen_at < v_cutoff
      AND role != 'owner'
    RETURNING *
  )
  SELECT COUNT(*) INTO v_deleted FROM deleted;

  -- rooms.listener_count senkronize et (sayaç sapmasını önle)
  UPDATE rooms
    SET listener_count = (
      SELECT COUNT(*) FROM room_participants WHERE room_id = p_room_id
    )
    WHERE id = p_room_id;

  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Doğrulama:
-- SELECT update_participant_last_seen('<room_uuid>', '<user_id>');
-- SELECT cleanup_stale_participants('<room_uuid>');
