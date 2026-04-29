-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v83 — Self-Promote in free_for_all Mode
--
-- Sorun: v44 promote_speaker_atomic RPC, "caller != target ve caller
-- owner/moderator değilse" reddediyor. Bu, free_for_all modundaki
-- listener'ın kendini sahneye çıkarmasını engelliyor → "Role değişikliği
-- reddedildi" / "Yetkiniz yok" hatası.
--
-- Düzeltme: Self-promote durumunda (caller == target) ve oda
-- speaking_mode = 'free_for_all' ise yetki kontrolünü atla. Sahne
-- doluluk kontrolü ve diğer guards aynen kalır.
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION promote_speaker_atomic(
  p_room_id UUID,
  p_user_id TEXT,
  p_executor_id TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_caller TEXT;
  v_host_id TEXT;
  v_owner_tier TEXT;
  v_speaking_mode TEXT;
  v_max_speakers INTEGER;
  v_current_speaker_count INTEGER;
  v_target_role TEXT;
  v_caller_role TEXT;
  v_is_owner_bypass BOOLEAN;
  v_is_self_in_ffa BOOLEAN;
BEGIN
  -- Caller resolution (Firebase JWT third-party + executor fallback)
  v_caller := auth.uid()::text;
  IF v_caller IS NULL THEN
    BEGIN v_caller := auth.jwt()->>'sub'; EXCEPTION WHEN OTHERS THEN v_caller := NULL; END;
  END IF;
  IF v_caller IS NULL THEN v_caller := p_executor_id; END IF;
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Kimlik doğrulama gereklidir.'; END IF;

  -- Oda bilgisi (host + tier + speaking_mode)
  SELECT host_id, owner_tier, COALESCE(room_settings->>'speaking_mode', 'free_for_all')
    INTO v_host_id, v_owner_tier, v_speaking_mode
    FROM rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Oda bulunamadı.'; END IF;

  -- Caller'ın mevcut rolü
  SELECT role INTO v_caller_role FROM room_participants
    WHERE room_id = p_room_id AND user_id = v_caller;

  -- ★ v83: Self-promote in free_for_all izinli — listener/spectator kendi
  --   rolünü speaker'a yükseltebilir. Sahne doluluk + ban kontrolleri aşağıda.
  v_is_self_in_ffa := (v_caller = p_user_id) AND (v_speaking_mode = 'free_for_all');

  IF NOT v_is_self_in_ffa THEN
    -- Yetki kontrolü: host VEYA owner/moderator olmalı
    IF v_host_id IS DISTINCT FROM v_caller AND v_caller_role NOT IN ('owner', 'moderator') THEN
      RAISE EXCEPTION 'Yetkiniz yok: promote için owner/moderator gereklidir.';
    END IF;
  END IF;

  -- Hedef kullanıcı odada mı?
  SELECT role INTO v_target_role FROM room_participants
    WHERE room_id = p_room_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Hedef kullanıcı bu odada değil.'; END IF;

  -- Self-promote ise: ban + kötü rol kontrolü
  IF v_is_self_in_ffa THEN
    IF v_target_role IN ('banned', 'spectator') THEN
      RAISE EXCEPTION 'Bu rolde sahneye çıkamazsınız.';
    END IF;
  END IF;

  -- Sahne doluluk kontrolü (host bypass'ı korunur)
  v_is_owner_bypass := (p_user_id = v_host_id);
  IF NOT v_is_owner_bypass THEN
    v_max_speakers := CASE LOWER(COALESCE(v_owner_tier, 'free'))
      WHEN 'pro' THEN 13 WHEN 'plus' THEN 7 ELSE 3
    END;
    SELECT COUNT(*) INTO v_current_speaker_count
      FROM room_participants
      WHERE room_id = p_room_id AND role IN ('owner', 'moderator', 'speaker');
    IF v_current_speaker_count >= v_max_speakers AND v_target_role NOT IN ('owner', 'moderator', 'speaker') THEN
      RAISE EXCEPTION 'Sahne dolu (max: %).', v_max_speakers;
    END IF;
  END IF;

  -- v19/v31 trigger bypass — bu RPC yetkiyi kendi kontrol etti
  PERFORM set_config('app.role_change_authorized', 'true', true);

  UPDATE room_participants
    SET role = CASE WHEN p_user_id = v_host_id THEN 'owner' ELSE 'speaker' END,
        is_muted = FALSE,
        last_seen_at = NOW()
    WHERE room_id = p_room_id AND user_id = p_user_id;

  RETURN json_build_object('ok', true, 'role', CASE WHEN p_user_id = v_host_id THEN 'owner' ELSE 'speaker' END);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
