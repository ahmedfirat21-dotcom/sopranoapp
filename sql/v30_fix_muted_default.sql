-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v30 — Owner self-mute bug fix
--
-- Bug: services/room.ts join() INSERT'te her role'de is_muted=true hardcoded
-- yazıyordu. Owner/mod/speaker yeniden katılınca (zombie cleanup sonrası
-- rejoin, oda minimize+geri dönüş vb.) DB'de is_muted=true olarak geliyordu.
-- SpeakerSection UI:
--   mic = rawMic && !(is_muted && role !== 'listener')
-- Bu nedenle owner'ın mikrofonu her zaman kapalı görünüyordu.
--
-- Fix: mevcut yanlış yazılmış is_muted=true kayıtlarını owner/mod/speaker
-- için false'a çek. Moderator tarafından mod_action 'mute' ile set edilenler
-- room_mutes tablosunda ayrıca izlendiği için etkilenmez (v19 Y19).
-- ════════════════════════════════════════════════════════════════════

UPDATE room_participants
  SET is_muted = false
  WHERE is_muted = true
    AND role IN ('owner', 'moderator', 'speaker')
    -- Gerçekten mod tarafından susturulan'ları koru: room_mutes'ta entry varsa dokunma
    AND NOT EXISTS (
      SELECT 1 FROM room_mutes rm
      WHERE rm.room_id = room_participants.room_id
        AND rm.muted_user_id = room_participants.user_id
        AND (rm.expires_at IS NULL OR rm.expires_at > now())
    );

-- ═══ DONE ═══
-- Mevcut owner/mod/speaker is_muted flag'leri normalize edildi.
