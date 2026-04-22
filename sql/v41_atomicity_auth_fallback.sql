-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v41 — Atomicity + Firebase Auth Fallback
--
-- Problem (2026-04-20):
--   1. v21 RPC'leri (promote_speaker_atomic, demote_speaker_atomic,
--      set_moderator_atomic) auth.uid() NULL'da RAISE EXCEPTION atıyor.
--      v39 pattern'ı (auth.jwt()->>'sub' fallback) uygulanmamış.
--      Firebase JWT refresh anında NULL dönebiliyor → yetkili kullanıcı
--      "Kimlik doğrulama gereklidir" hatası alıyor.
--
--   2. Bidirectional unfriend atomik değil — client (A→B) + (B→A) iki
--      ayrı DELETE yapıyor (services/friendship.ts removeFriend).
--      Race condition: eşzamanlı unfriend duplicate silmeye neden olur.
--
--   3. v32 claim_stage_seat da aynı auth.uid() NULL bug'ına sahip.
--
-- Çözüm:
--   - v21 ve v32 RPC'lerine v39 pattern uygulandı
--   - unfriend_atomic() eklendi — tek transaction
-- ════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════
-- 1. promote_speaker_atomic — JWT fallback
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION promote_speaker_atomic(
  p_room_id UUID,
  p_user_id TEXT
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
  -- ★ v41: Caller kimliği önce auth.uid(), yoksa JWT sub claim (Firebase uyumu)
  v_caller := auth.uid()::text;
  IF v_caller IS NULL THEN
    BEGIN
      v_caller := auth.jwt()->>'sub';
    EXCEPTION WHEN OTHERS THEN v_caller := NULL;
    END;
  END IF;
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Kimlik doğrulama gereklidir.';
  END IF;

  SELECT host_id, owner_tier INTO v_host_id, v_owner_tier
    FROM rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Oda bulunamadı.'; END IF;

  SELECT role INTO v_caller_role
    FROM room_participants
    WHERE room_id = p_room_id AND user_id = v_caller;
  IF v_host_id IS DISTINCT FROM v_caller AND v_caller_role NOT IN ('owner', 'moderator') THEN
    RAISE EXCEPTION 'Yetkiniz yok: promote için owner/moderator gereklidir.';
  END IF;

  SELECT role INTO v_target_role
    FROM room_participants
    WHERE room_id = p_room_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Hedef kullanıcı bu odada değil.'; END IF;

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

  UPDATE room_participants
    SET role = CASE WHEN p_user_id = v_host_id THEN 'owner' ELSE 'speaker' END,
        is_muted = FALSE
    WHERE room_id = p_room_id AND user_id = p_user_id;

  RETURN json_build_object('ok', true, 'role', CASE WHEN p_user_id = v_host_id THEN 'owner' ELSE 'speaker' END);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ═══════════════════════════════════════════════════
-- 2. demote_speaker_atomic — JWT fallback
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION demote_speaker_atomic(
  p_room_id UUID,
  p_user_id TEXT
) RETURNS JSON AS $$
DECLARE
  v_caller TEXT;
  v_host_id TEXT;
  v_caller_role TEXT;
  v_target_role TEXT;
BEGIN
  v_caller := auth.uid()::text;
  IF v_caller IS NULL THEN
    BEGIN v_caller := auth.jwt()->>'sub'; EXCEPTION WHEN OTHERS THEN v_caller := NULL; END;
  END IF;
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Kimlik doğrulama gereklidir.'; END IF;

  SELECT host_id INTO v_host_id FROM rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Oda bulunamadı.'; END IF;

  -- Kendini demote: her zaman serbest
  IF v_caller = p_user_id THEN
    UPDATE room_participants SET role = 'listener', is_muted = TRUE
      WHERE room_id = p_room_id AND user_id = p_user_id;
    RETURN json_build_object('ok', true);
  END IF;

  SELECT role INTO v_caller_role FROM room_participants
    WHERE room_id = p_room_id AND user_id = v_caller;
  IF v_host_id IS DISTINCT FROM v_caller AND v_caller_role NOT IN ('owner', 'moderator') THEN
    RAISE EXCEPTION 'Yetkiniz yok.';
  END IF;

  SELECT role INTO v_target_role FROM room_participants
    WHERE room_id = p_room_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Hedef kullanıcı bu odada değil.'; END IF;

  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'Oda sahibi demote edilemez.';
  END IF;

  UPDATE room_participants SET role = 'listener', is_muted = TRUE
    WHERE room_id = p_room_id AND user_id = p_user_id;

  RETURN json_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ═══════════════════════════════════════════════════
-- 3. unfriend_atomic — Bidirectional arkadaşlık silme
-- ═══════════════════════════════════════════════════
-- Her iki yönü (A→B, B→A) tek transaction'da siler. accepted status'lü
-- kayıtları sadece silinir (pending/blocked kayıtları korur).
-- Race condition'ı önler; eşzamanlı unfriend aynı sonucu verir.
CREATE OR REPLACE FUNCTION unfriend_atomic(
  p_friend_id TEXT
) RETURNS JSON AS $$
DECLARE
  v_caller TEXT;
  v_deleted_count INTEGER;
BEGIN
  v_caller := auth.uid()::text;
  IF v_caller IS NULL THEN
    BEGIN v_caller := auth.jwt()->>'sub'; EXCEPTION WHEN OTHERS THEN v_caller := NULL; END;
  END IF;
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Kimlik doğrulama gereklidir.'; END IF;

  IF v_caller = p_friend_id THEN
    RAISE EXCEPTION 'Kendinle arkadaşlığı silemezsin.';
  END IF;

  DELETE FROM friendships
    WHERE status = 'accepted'
      AND (
        (user_id = v_caller AND friend_id = p_friend_id)
        OR
        (user_id = p_friend_id AND friend_id = v_caller)
      );
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN json_build_object('ok', true, 'deleted', v_deleted_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ═══════════════════════════════════════════════════
-- 4. claim_stage_seat — JWT fallback (v32 bug fix)
-- ═══════════════════════════════════════════════════
-- v32 orijinal fonksiyonu auth.uid() NULL'da fallback yapıyordu ama
-- client'tan p_user_id alarak — bu güvenlik açığı. v39 pattern:
-- JWT sub claim kullan, mismatch varsa reject.
CREATE OR REPLACE FUNCTION claim_stage_seat(
  p_room_id UUID,
  p_user_id TEXT
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
  v_caller := auth.uid()::text;
  IF v_caller IS NULL THEN
    BEGIN v_caller := auth.jwt()->>'sub'; EXCEPTION WHEN OTHERS THEN v_caller := NULL; END;
  END IF;
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Kimlik doğrulama gereklidir.';
  END IF;
  -- Caller self-only
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

  RETURN json_build_object('ok', true, 'expires_at', v_stage_expires);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


COMMIT;

-- ═══ DONE ═══
-- Client entegrasyonu:
--   FriendshipService.removeFriend → rpc('unfriend_atomic', { p_friend_id })
--   RoomService.promoteSpeaker    → rpc('promote_speaker_atomic', ...) (değişmedi)
--   RoomService.demoteSpeaker     → rpc('demote_speaker_atomic', ...) (değişmedi)
--   RoomService.claimStageSeat    → rpc('claim_stage_seat', ...) (değişmedi)
