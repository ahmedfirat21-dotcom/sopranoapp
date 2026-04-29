-- ═══════════════════════════════════════════════════════════════════
-- v67 — Fix stale participant cleanup: sahneye çıkan kullanıcı düşme bug'ı
-- Tarih: 2026-04-26
--
-- Problem:
--   Ziyaretçi sahneye çıktıktan ~2dk sonra odadan siliniyor. Sebebi:
--   1. cleanup_stale_participants eşiği 45 saniye — çok agresif.
--      Heartbeat 20sn'de bir gönderiliyor ama JS thread LiveKit audio
--      processing ile meşgulken interval gecikiyor → heartbeat kaçırılıyor
--      → 45sn dolunca speaker siliniyor.
--   2. Sahne rolleri (speaker, moderator) korunmuyor — sadece owner korumalı.
--   3. promote_speaker_atomic last_seen_at'ı güncellemiyor → sahneye çıkış
--      anında last_seen_at eski kalıyor, bir sonraki cleanup'ta silinme riski.
--
-- Çözüm:
--   1. cleanup_stale_participants eşiğini 45sn → 120sn çıkar
--      (cleanup_room_zombies_atomic ile tutarlı)
--   2. Sahne rollerini (speaker, moderator) cleanup'tan koru
--   3. promote_speaker_atomic'e last_seen_at = NOW() ekle
-- ═══════════════════════════════════════════════════════════════════

-- 1. cleanup_stale_participants — eşik 120sn + sahne rollerini koru
CREATE OR REPLACE FUNCTION cleanup_stale_participants(
  p_room_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
  v_cutoff TIMESTAMPTZ := NOW() - INTERVAL '120 seconds';
BEGIN
  WITH deleted AS (
    DELETE FROM room_participants
    WHERE room_id = p_room_id
      AND last_seen_at < v_cutoff
      AND role NOT IN ('owner', 'speaker', 'moderator')
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


-- 2. promote_speaker_atomic — last_seen_at güncelle (sahneye çıkınca stale kalmasın)
CREATE OR REPLACE FUNCTION promote_speaker_atomic(
  p_room_id UUID,
  p_user_id TEXT,
  p_executor_id TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_caller TEXT;
  v_host_id TEXT;
  v_owner_tier TEXT;
  v_max_speakers INTEGER;
  v_current_speaker_count INTEGER;
  v_target_role TEXT;
  v_caller_role TEXT;
  v_is_owner_bypass BOOLEAN;
BEGIN
  v_caller := auth.uid()::text;
  IF v_caller IS NULL THEN
    BEGIN v_caller := auth.jwt()->>'sub'; EXCEPTION WHEN OTHERS THEN v_caller := NULL; END;
  END IF;
  IF v_caller IS NULL THEN v_caller := p_executor_id; END IF;
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Kimlik doğrulama gereklidir.'; END IF;

  SELECT host_id, owner_tier INTO v_host_id, v_owner_tier
    FROM rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Oda bulunamadı.'; END IF;

  SELECT role INTO v_caller_role FROM room_participants
    WHERE room_id = p_room_id AND user_id = v_caller;
  IF v_host_id IS DISTINCT FROM v_caller AND v_caller_role NOT IN ('owner', 'moderator') THEN
    RAISE EXCEPTION 'Yetkiniz yok: promote için owner/moderator gereklidir.';
  END IF;

  SELECT role INTO v_target_role FROM room_participants
    WHERE room_id = p_room_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Hedef kullanıcı bu odada değil.'; END IF;

  v_is_owner_bypass := (p_user_id = v_host_id);
  IF NOT v_is_owner_bypass THEN
    v_max_speakers := CASE LOWER(COALESCE(v_owner_tier, 'free'))
      WHEN 'pro' THEN 13 WHEN 'plus' THEN 7 WHEN 'godmaster' THEN 13 ELSE 3
    END;
    SELECT COUNT(*) INTO v_current_speaker_count
      FROM room_participants
      WHERE room_id = p_room_id AND role IN ('owner', 'moderator', 'speaker');
    IF v_current_speaker_count >= v_max_speakers AND v_target_role NOT IN ('owner', 'moderator', 'speaker') THEN
      RAISE EXCEPTION 'Sahne dolu (max: %).', v_max_speakers;
    END IF;
  END IF;

  -- ★ v67 FIX: last_seen_at da güncelle — sahneye çıkınca stale kalmasın
  UPDATE room_participants
    SET role = CASE WHEN p_user_id = v_host_id THEN 'owner' ELSE 'speaker' END,
        is_muted = FALSE,
        last_seen_at = NOW()
    WHERE room_id = p_room_id AND user_id = p_user_id;

  RETURN json_build_object('ok', true, 'role', CASE WHEN p_user_id = v_host_id THEN 'owner' ELSE 'speaker' END);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- Doğrulama:
-- SELECT cleanup_stale_participants('<room_uuid>');
-- SELECT promote_speaker_atomic('<room_uuid>', '<user_id>');
