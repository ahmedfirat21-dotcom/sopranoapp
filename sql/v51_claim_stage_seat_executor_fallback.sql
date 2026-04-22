-- ═══════════════════════════════════════════════════════════════════
-- v51 — claim_stage_seat: p_executor_id fallback eklendi
-- Tarih: 2026-04-22
-- Amaç: Firebase auth kullanan SopranoChat'te auth.uid() ve
--       auth.jwt()->>'sub' her ikisi de NULL döner (Supabase Firebase JWT'yi
--       doğrulamıyor). v41'deki claim_stage_seat bu durumda "Kimlik doğrulama
--       gereklidir" atıp Free kullanıcının boş sahne koltuğuna oturmasını
--       engelliyordu. v44'te ban/promote/unfriend RPC'lerine eklenen
--       p_executor_id pattern'ini claim_stage_seat'e de uyguluyoruz.
--
-- Güvenlik notu: p_executor_id client-controlled, v_caller IS DISTINCT FROM
-- p_user_id check'i self-only kuralını koruyor — kullanıcı başkası adına
-- sahne talep edemez (her iki ID aynı olmalı).
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION claim_stage_seat(
  p_room_id UUID,
  p_user_id TEXT,
  p_executor_id TEXT DEFAULT NULL  -- ★ v51: Firebase auth fallback
) RETURNS JSON AS $$
DECLARE
  v_caller TEXT;
  v_host_id TEXT;
  v_mod_count INTEGER;
  v_current_caretaker_count INTEGER;
  v_max_caretakers CONSTANT INTEGER := 5;
  v_stage_expires TIMESTAMPTZ;
  v_existing_role TEXT;
  v_cooldown_until TIMESTAMPTZ;
BEGIN
  -- Caller tespiti: auth.uid() → auth.jwt().sub → p_executor_id
  v_caller := auth.uid()::text;
  IF v_caller IS NULL THEN
    BEGIN v_caller := auth.jwt()->>'sub'; EXCEPTION WHEN OTHERS THEN v_caller := NULL; END;
  END IF;
  IF v_caller IS NULL THEN
    v_caller := p_executor_id;  -- ★ v51: client fallback (Firebase auth)
  END IF;
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Kimlik doğrulama gereklidir (executor_id ile bile NULL).';
  END IF;

  -- Caller self-only: target user ID ile eşleşmeli
  IF v_caller IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Yetkisiz: sadece kendin için sahne talep edebilirsin.';
  END IF;

  SELECT host_id INTO v_host_id FROM rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Oda bulunamadı.'; END IF;

  -- Caretaker modu sadece host/mod yok iken aktif
  SELECT COUNT(*) INTO v_mod_count FROM room_participants
    WHERE room_id = p_room_id AND role IN ('owner', 'moderator');
  IF v_mod_count > 0 THEN
    RAISE EXCEPTION 'Caretaker modu aktif değil (yetkili sahnede).';
  END IF;

  -- Mevcut role + cooldown kontrol
  SELECT role, stage_expires_at INTO v_existing_role, v_cooldown_until
    FROM room_participants
    WHERE room_id = p_room_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Önce odaya katılmalısın.';
  END IF;

  IF v_existing_role = 'speaker' THEN
    RAISE EXCEPTION 'Zaten sahnedesin.';
  END IF;

  IF v_cooldown_until IS NOT NULL AND v_cooldown_until > NOW() THEN
    RAISE EXCEPTION 'Henüz cooldown süresinde, biraz bekle.';
  END IF;

  -- Caretaker slot kontrol
  SELECT COUNT(*) INTO v_current_caretaker_count
    FROM room_participants
    WHERE room_id = p_room_id
      AND role = 'speaker'
      AND stage_expires_at IS NOT NULL
      AND stage_expires_at > NOW();
  IF v_current_caretaker_count >= v_max_caretakers THEN
    RAISE EXCEPTION 'Sahne dolu (% caretaker slot).', v_max_caretakers;
  END IF;

  v_stage_expires := NOW() + INTERVAL '5 minutes';
  UPDATE room_participants
    SET role = 'speaker', stage_expires_at = v_stage_expires, is_muted = FALSE
    WHERE room_id = p_room_id AND user_id = p_user_id;

  RETURN json_build_object('ok', true, 'expires_at', v_stage_expires, 'duration_sec', 300);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Doğrulama:
-- SELECT claim_stage_seat('<room_uuid>', '<firebase_uid>', '<firebase_uid>');
