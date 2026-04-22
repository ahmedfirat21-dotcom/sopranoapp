-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v43 — Ban Atomic RPC (RLS bypass + JWT fallback)
--
-- Problem (2026-04-20):
--   v22 RLS ve v42 JWT fallback yamalarına rağmen room_bans INSERT'ler
--   hâlâ başarısız oluyor (room_bans table empty after multiple ban attempts).
--   Muhtemel sebep: client bazı durumlarda Firebase token header eksik/stale
--   geçiyor → hem auth.uid() hem auth.jwt() NULL → RLS reject.
--
--   Sonuç: Banlanan kullanıcı odadan çıkarılıyor (room_participants DELETE
--   çalışıyor) ama ban kaydı YAZILMIYOR → kullanıcı anında geri gelebiliyor.
--
-- Çözüm: promote_speaker_atomic pattern'ı — SECURITY DEFINER RPC.
--   İçinde auth kontrolü yapar (caller host/mod olmalı), ardından ban +
--   DELETE tek transaction'da yürütülür. Atomik, RLS'i atlatır, JWT fallback
--   dahili. Client artık sadece RPC çağırır, INSERT rejection riski yok.
-- ════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION ban_user_atomic(
  p_room_id UUID,
  p_user_id TEXT,
  p_ban_type TEXT DEFAULT 'temporary',  -- 'temporary' | 'permanent'
  p_duration_minutes INTEGER DEFAULT NULL,  -- NULL = permanent
  p_reason TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_caller TEXT;
  v_host_id TEXT;
  v_caller_role TEXT;
  v_expires_at TIMESTAMPTZ;
  v_target_role TEXT;
BEGIN
  -- Caller kimliği: auth.uid() → auth.jwt().sub fallback
  v_caller := auth.uid()::text;
  IF v_caller IS NULL THEN
    BEGIN v_caller := auth.jwt()->>'sub'; EXCEPTION WHEN OTHERS THEN v_caller := NULL; END;
  END IF;
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Kimlik doğrulama gereklidir.';
  END IF;

  -- Hedef self-ban olamaz
  IF v_caller = p_user_id THEN
    RAISE EXCEPTION 'Kendini banlayamazsın.';
  END IF;

  -- Oda var mı?
  SELECT host_id INTO v_host_id FROM rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Oda bulunamadı.'; END IF;

  -- Yetki: caller host veya room_participants'ta owner/moderator olmalı
  IF v_host_id IS DISTINCT FROM v_caller THEN
    SELECT role INTO v_caller_role FROM room_participants
      WHERE room_id = p_room_id AND user_id = v_caller;
    IF v_caller_role NOT IN ('owner', 'moderator') THEN
      RAISE EXCEPTION 'Yetkiniz yok: ban için owner/moderator gereklidir.';
    END IF;
  END IF;

  -- Host banlanamaz
  IF p_user_id = v_host_id THEN
    RAISE EXCEPTION 'Oda sahibi banlanamaz.';
  END IF;

  -- Süre hesapla
  IF p_ban_type = 'permanent' THEN
    v_expires_at := NULL;
  ELSE
    IF p_duration_minutes IS NULL OR p_duration_minutes <= 0 THEN
      RAISE EXCEPTION 'Geçici ban için süre (dakika) gerekli.';
    END IF;
    v_expires_at := NOW() + (p_duration_minutes || ' minutes')::INTERVAL;
  END IF;

  -- Hedefin rolünü oku (sonra listener_count adjust için)
  SELECT role INTO v_target_role FROM room_participants
    WHERE room_id = p_room_id AND user_id = p_user_id;

  -- Ban kaydı
  INSERT INTO room_bans (room_id, user_id, banned_by, ban_type, expires_at, reason)
    VALUES (p_room_id, p_user_id, v_caller, p_ban_type, v_expires_at, p_reason)
    ON CONFLICT (room_id, user_id) DO UPDATE
      SET ban_type = EXCLUDED.ban_type,
          expires_at = EXCLUDED.expires_at,
          reason = EXCLUDED.reason,
          banned_by = EXCLUDED.banned_by,
          created_at = NOW();

  -- Participant'ı odadan çıkar
  DELETE FROM room_participants
    WHERE room_id = p_room_id AND user_id = p_user_id;

  -- Listener count adjust (sadece listener/spectator için)
  IF v_target_role IN ('listener', 'spectator') THEN
    BEGIN
      UPDATE rooms SET listener_count = GREATEST(0, COALESCE(listener_count, 0) - 1)
        WHERE id = p_room_id;
    EXCEPTION WHEN OTHERS THEN NULL;  -- listener_count column'u yoksa sessiz geç
    END;
  END IF;

  RETURN json_build_object(
    'ok', true,
    'ban_type', p_ban_type,
    'expires_at', v_expires_at,
    'banned_user', p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMIT;

-- ═══ DONE ═══
-- Client entegrasyonu:
--   RoomService.banTemporary → supabase.rpc('ban_user_atomic', {
--     p_room_id, p_user_id, p_ban_type: 'temporary', p_duration_minutes: mins
--   })
--   RoomService.banPermanent → supabase.rpc('ban_user_atomic', {
--     p_room_id, p_user_id, p_ban_type: 'permanent'
--   })
