-- ═══════════════════════════════════════════════════════════════════
-- v60 — transfer_host_atomic: p_executor_id fallback (Firebase auth NULL)
-- Tarih: 2026-04-22
-- Problem: Firebase JWT auth Supabase'e geçmiyor → auth.uid() NULL →
--   transfer_host_atomic RPC "Kimlik doğrulama gereklidir" hatası atıyor →
--   eski host satırı DELETE olmuyor → host odadan çıktı ama listede/sahnede
--   görünmeye devam ediyor.
-- Çözüm: v44 pattern'i (claim_stage_seat) ile aynı — p_executor_id default NULL
--   parametresi ekle, auth.uid() NULL ise bunu kullan (client self-only check).
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION transfer_host_atomic(
  p_room_id UUID,
  p_old_host_id TEXT,
  p_executor_id TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_caller TEXT;
  v_new_host_id TEXT;
  v_room_host_id TEXT;
  v_owner_tier TEXT;
  v_is_persistent BOOLEAN;
  v_room_settings JSONB;
  v_keep_alive BOOLEAN;
BEGIN
  -- Caller tespiti: auth.uid() → auth.jwt().sub → p_executor_id
  v_caller := auth.uid()::text;
  IF v_caller IS NULL THEN
    BEGIN v_caller := auth.jwt()->>'sub'; EXCEPTION WHEN OTHERS THEN v_caller := NULL; END;
  END IF;
  IF v_caller IS NULL THEN
    v_caller := p_executor_id;
  END IF;
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Kimlik doğrulama gereklidir (executor_id ile bile NULL).';
  END IF;

  -- Self-only: sadece kendi host devrini yapabilir
  IF v_caller IS DISTINCT FROM p_old_host_id THEN
    RAISE EXCEPTION 'Yetkiniz yok: Sadece kendi host devrinizi yapabilirsiniz.';
  END IF;

  SELECT host_id, owner_tier, is_persistent, room_settings
    INTO v_room_host_id, v_owner_tier, v_is_persistent, v_room_settings
    FROM rooms
    WHERE id = p_room_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oda bulunamadı.';
  END IF;

  -- Trigger'a yetkilendirme bayrağı
  PERFORM set_config('app.role_change_authorized', 'true', true);

  IF v_room_host_id IS DISTINCT FROM p_old_host_id THEN
    DELETE FROM room_participants
      WHERE room_id = p_room_id AND user_id = p_old_host_id;
    RETURN json_build_object('newHostId', NULL, 'keepAlive', false);
  END IF;

  -- Yeni host adayı bul: moderator → speaker → listener (tier'a göre keepAlive)
  SELECT user_id INTO v_new_host_id
    FROM room_participants
    WHERE room_id = p_room_id
      AND role = 'moderator'
      AND user_id != p_old_host_id
    ORDER BY joined_at ASC
    LIMIT 1;

  IF v_new_host_id IS NULL THEN
    SELECT user_id INTO v_new_host_id
      FROM room_participants
      WHERE room_id = p_room_id
        AND role = 'speaker'
        AND user_id != p_old_host_id
      ORDER BY joined_at ASC
      LIMIT 1;
  END IF;

  IF v_new_host_id IS NOT NULL THEN
    -- Yeni host'u owner yap
    UPDATE room_participants
      SET role = 'owner'
      WHERE room_id = p_room_id AND user_id = v_new_host_id;
    -- rooms.host_id güncelle, original_host_id'i room_settings'de koru
    UPDATE rooms
      SET
        host_id = v_new_host_id,
        room_settings = jsonb_set(
          COALESCE(v_room_settings, '{}'::jsonb),
          '{original_host_id}',
          to_jsonb(p_old_host_id),
          true
        )
      WHERE id = p_room_id;
    -- Eski host'u sil
    DELETE FROM room_participants
      WHERE room_id = p_room_id AND user_id = p_old_host_id;
    RETURN json_build_object('newHostId', v_new_host_id, 'keepAlive', false);
  END IF;

  -- Aday yok — Plus+ (persistent) ise oda açık kalır, Free ise kapanır
  v_keep_alive := v_is_persistent = true OR v_owner_tier IN ('Plus', 'Pro', 'GodMaster');

  IF v_keep_alive THEN
    UPDATE rooms
      SET room_settings = jsonb_set(
        COALESCE(v_room_settings, '{}'::jsonb),
        '{original_host_id}',
        to_jsonb(p_old_host_id),
        true
      )
      WHERE id = p_room_id;
    DELETE FROM room_participants
      WHERE room_id = p_room_id AND user_id = p_old_host_id;
    RETURN json_build_object('newHostId', NULL, 'keepAlive', true);
  END IF;

  -- Free + aday yok → oda kapatılmayacak (client handleHostLeave count-down başlatır).
  -- Eski host'u yine de sil (ayrıldı).
  DELETE FROM room_participants
    WHERE room_id = p_room_id AND user_id = p_old_host_id;

  RETURN json_build_object('newHostId', NULL, 'keepAlive', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
