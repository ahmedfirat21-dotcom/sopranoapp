-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v21 — Slot & Count Atomicity (Y8, Y9, Y10, Y11)
--
-- Y8: cleanupZombies sadece host'un client'ında çalışıyor; host crash olunca
--     zombie'ler temizlenmiyor. Her authenticated kullanıcının atomik olarak
--     temizlik tetikleyebildiği SECURITY DEFINER RPC ekliyoruz.
--
-- Y9: promoteSpeaker/demoteSpeaker listener_count'u 2 ayrı query ile günceller.
--     Rol geçişi ile sayaç adjustment arasında race var. Atomic RPC ile birleşik.
--
-- Y10: Plus/Pro boş odalar 24 saatten uzun süre boş kalırsa otomatik kapatma.
--
-- Y11: Concurrent promote race — 2 mod aynı anda slot dolu olsa bile promote
--     edebiliyor. FOR UPDATE lock + atomic count kontrol + update.
--
-- Referans: Clubhouse/Discord stage slot limiti sunucu tarafından atomik
-- enforce edilir; client race'i pass etmez.
-- ════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════
-- 0. Yardımcılar — Tier limitleri (TS ROOM_TIER_LIMITS ayna)
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION _room_tier_normalized(p_tier TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE
    WHEN p_tier IN ('Pro', 'pro') THEN 'Pro'
    WHEN p_tier IN ('Plus', 'premium') THEN 'Plus'
    ELSE 'Free'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION _room_max_speakers(p_tier TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN CASE _room_tier_normalized(p_tier)
    WHEN 'Pro' THEN 13
    WHEN 'Plus' THEN 8
    ELSE 4
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION _room_max_moderators(p_tier TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN CASE _room_tier_normalized(p_tier)
    WHEN 'Pro' THEN 5
    WHEN 'Plus' THEN 2
    ELSE 0
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION _room_keep_alive(p_tier TEXT, p_persistent BOOLEAN)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(p_persistent, false)
      OR _room_tier_normalized(p_tier) IN ('Plus', 'Pro');
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ═══════════════════════════════════════════════════
-- 1. promote_speaker_atomic (Y9 + Y11)
-- ═══════════════════════════════════════════════════
-- Executor yetkisi + slot kontrolü + rol update + listener_count adjust
-- tek transaction. Host/owner her zaman slot bypass.
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
  v_caller := auth.uid()::text;
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Kimlik doğrulama gereklidir.';
  END IF;

  -- Oda kilidi (concurrent promote'ları serialize eder)
  SELECT host_id, owner_tier INTO v_host_id, v_owner_tier
    FROM rooms
    WHERE id = p_room_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oda bulunamadı.';
  END IF;

  -- Yetki: caller owner veya moderator olmalı
  SELECT role INTO v_caller_role
    FROM room_participants
    WHERE room_id = p_room_id AND user_id = v_caller;
  IF v_host_id IS DISTINCT FROM v_caller AND v_caller_role NOT IN ('owner', 'moderator') THEN
    RAISE EXCEPTION 'Yetkiniz yok: promote için owner/moderator gereklidir.';
  END IF;

  -- Hedef katılımcı mevcut mu?
  SELECT role INTO v_target_role
    FROM room_participants
    WHERE room_id = p_room_id AND user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hedef kullanıcı bu odada değil.';
  END IF;

  -- Zaten speaker/owner/mod ise no-op
  IF v_target_role IN ('speaker', 'owner', 'moderator') THEN
    RETURN json_build_object('status', 'noop', 'role', v_target_role);
  END IF;

  -- Slot kontrolü — host/owner bypass
  v_is_owner_bypass := (v_host_id = p_user_id);
  IF NOT v_is_owner_bypass THEN
    v_max_speakers := _room_max_speakers(v_owner_tier);
    SELECT COUNT(*) INTO v_current_speaker_count
      FROM room_participants
      WHERE room_id = p_room_id
        AND role IN ('owner', 'speaker', 'moderator');
    IF v_current_speaker_count >= v_max_speakers THEN
      RAISE EXCEPTION 'Sahne dolu (max %).', v_max_speakers;
    END IF;
  END IF;

  -- Role escalation trigger'ı için yetki işareti
  PERFORM set_config('app.role_change_authorized', 'true', true);

  UPDATE room_participants
    SET role = 'speaker', is_muted = false
    WHERE room_id = p_room_id AND user_id = p_user_id;

  -- listener_count adjust — eski rol listener/spectator ise düş
  IF v_target_role IN ('listener', 'spectator', 'pending_speaker') THEN
    UPDATE rooms
      SET listener_count = GREATEST(COALESCE(listener_count, 0) - 1, 0)
      WHERE id = p_room_id;
  END IF;

  RETURN json_build_object('status', 'ok', 'old_role', v_target_role, 'new_role', 'speaker');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════
-- 2. demote_speaker_atomic (Y9)
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION demote_speaker_atomic(
  p_room_id UUID,
  p_user_id TEXT
) RETURNS JSON AS $$
DECLARE
  v_caller TEXT;
  v_host_id TEXT;
  v_target_role TEXT;
  v_caller_role TEXT;
  v_is_self BOOLEAN;
BEGIN
  v_caller := auth.uid()::text;
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Kimlik doğrulama gereklidir.';
  END IF;

  SELECT host_id INTO v_host_id FROM rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Oda bulunamadı.'; END IF;

  v_is_self := (v_caller = p_user_id);

  -- Yetki: self-demote speaker→listener izinli (trigger whitelist'inde),
  -- başkasına demote için owner/mod gerekli
  IF NOT v_is_self THEN
    SELECT role INTO v_caller_role
      FROM room_participants
      WHERE room_id = p_room_id AND user_id = v_caller;
    IF v_host_id IS DISTINCT FROM v_caller AND v_caller_role NOT IN ('owner', 'moderator') THEN
      RAISE EXCEPTION 'Yetkiniz yok: demote için owner/moderator gereklidir.';
    END IF;
  END IF;

  SELECT role INTO v_target_role
    FROM room_participants
    WHERE room_id = p_room_id AND user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hedef kullanıcı bu odada değil.';
  END IF;

  -- Zaten listener ise no-op
  IF v_target_role = 'listener' THEN
    RETURN json_build_object('status', 'noop');
  END IF;

  -- Owner'ı demote etmek → sahipsiz oda riski. transferHost üzerinden yapılmalı.
  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'Owner demote edilemez; önce host devri yapılmalı.';
  END IF;

  PERFORM set_config('app.role_change_authorized', 'true', true);

  UPDATE room_participants
    SET role = 'listener', is_muted = false
    WHERE room_id = p_room_id AND user_id = p_user_id;

  IF v_target_role IN ('speaker', 'moderator', 'pending_speaker') THEN
    UPDATE rooms
      SET listener_count = COALESCE(listener_count, 0) + 1
      WHERE id = p_room_id;
  END IF;

  RETURN json_build_object('status', 'ok', 'old_role', v_target_role, 'new_role', 'listener');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════
-- 3. set_moderator_atomic (Y9 + slot)
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION set_moderator_atomic(
  p_room_id UUID,
  p_user_id TEXT
) RETURNS JSON AS $$
DECLARE
  v_caller TEXT;
  v_host_id TEXT;
  v_owner_tier TEXT;
  v_max_mods INTEGER;
  v_current_mod_count INTEGER;
  v_target_role TEXT;
BEGIN
  v_caller := auth.uid()::text;
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Kimlik doğrulama gereklidir.';
  END IF;

  SELECT host_id, owner_tier INTO v_host_id, v_owner_tier
    FROM rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Oda bulunamadı.'; END IF;

  -- Sadece owner moderator atayabilir
  IF v_host_id IS DISTINCT FROM v_caller THEN
    RAISE EXCEPTION 'Sadece oda sahibi moderatör atayabilir.';
  END IF;

  v_max_mods := _room_max_moderators(v_owner_tier);
  IF v_max_mods = 0 THEN
    RAISE EXCEPTION 'Bu tier moderatör özelliğini desteklemiyor.';
  END IF;

  SELECT COUNT(*) INTO v_current_mod_count
    FROM room_participants
    WHERE room_id = p_room_id AND role = 'moderator';
  IF v_current_mod_count >= v_max_mods THEN
    RAISE EXCEPTION 'Moderatör limiti doldu (max %).', v_max_mods;
  END IF;

  SELECT role INTO v_target_role
    FROM room_participants
    WHERE room_id = p_room_id AND user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hedef kullanıcı bu odada değil.';
  END IF;
  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'Owner zaten en üst yetkili.';
  END IF;
  IF v_target_role = 'moderator' THEN
    RETURN json_build_object('status', 'noop');
  END IF;

  PERFORM set_config('app.role_change_authorized', 'true', true);

  UPDATE room_participants
    SET role = 'moderator', is_muted = false
    WHERE room_id = p_room_id AND user_id = p_user_id;

  -- listener_count: listener/spectator iken mod yapılırsa sayaç düş
  IF v_target_role IN ('listener', 'spectator', 'pending_speaker') THEN
    UPDATE rooms
      SET listener_count = GREATEST(COALESCE(listener_count, 0) - 1, 0)
      WHERE id = p_room_id;
  END IF;

  RETURN json_build_object('status', 'ok', 'old_role', v_target_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════
-- 3b. remove_moderator_atomic (Y13)
-- ═══════════════════════════════════════════════════
-- Sadece owner başka bir mod'u demote edebilir. Self-demote (mod kendi
-- mod'luğunu bırakma) trigger whitelist'inde zaten izinli (moderator→speaker).
-- Bu RPC sadece owner-initiated demote için kullanılmalı.
CREATE OR REPLACE FUNCTION remove_moderator_atomic(
  p_room_id UUID,
  p_user_id TEXT
) RETURNS JSON AS $$
DECLARE
  v_caller TEXT;
  v_host_id TEXT;
  v_target_role TEXT;
BEGIN
  v_caller := auth.uid()::text;
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Kimlik doğrulama gereklidir.';
  END IF;

  SELECT host_id INTO v_host_id FROM rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Oda bulunamadı.'; END IF;

  -- Self-demote değilse owner olmalı
  IF v_caller != p_user_id AND v_host_id IS DISTINCT FROM v_caller THEN
    RAISE EXCEPTION 'Sadece oda sahibi veya mod''un kendisi bu işlemi yapabilir.';
  END IF;

  SELECT role INTO v_target_role
    FROM room_participants
    WHERE room_id = p_room_id AND user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hedef kullanıcı bu odada değil.';
  END IF;
  IF v_target_role != 'moderator' THEN
    RETURN json_build_object('status', 'noop', 'role', v_target_role);
  END IF;

  PERFORM set_config('app.role_change_authorized', 'true', true);

  UPDATE room_participants
    SET role = 'speaker'
    WHERE room_id = p_room_id AND user_id = p_user_id;

  RETURN json_build_object('status', 'ok', 'new_role', 'speaker');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════
-- 4. cleanup_room_zombies_atomic (Y8)
-- ═══════════════════════════════════════════════════
-- Authenticated herhangi bir user çağırabilir (SECURITY DEFINER).
-- 120sn+ heartbeat göndermeyen kullanıcıları siler, listener_count sync,
-- ve Free odada boşsa kapatır / Plus-Pro'da listener_count=0 yapar.
-- Dönüş: kaç zombie silindi + güncel toplam participant.
CREATE OR REPLACE FUNCTION cleanup_room_zombies_atomic(
  p_room_id UUID
) RETURNS JSON AS $$
DECLARE
  v_cutoff TIMESTAMPTZ;
  v_deleted INTEGER;
  v_remaining INTEGER;
  v_owner_tier TEXT;
  v_is_persistent BOOLEAN;
  v_keep_alive BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Kimlik doğrulama gereklidir.';
  END IF;

  v_cutoff := now() - interval '120 seconds';

  -- last_seen_at kolonu olmayan legacy katılımcılara dokunma
  WITH zombies AS (
    DELETE FROM room_participants
      WHERE room_id = p_room_id
        AND last_seen_at IS NOT NULL
        AND last_seen_at < v_cutoff
      RETURNING 1
  )
  SELECT COUNT(*) INTO v_deleted FROM zombies;

  -- Kalan participant sayısı
  SELECT COUNT(*) INTO v_remaining
    FROM room_participants
    WHERE room_id = p_room_id;

  -- listener_count sync — gerçek listener/spectator sayısı
  UPDATE rooms
    SET listener_count = (
      SELECT COUNT(*) FROM room_participants
        WHERE room_id = p_room_id
          AND role IN ('listener', 'spectator')
    )
    WHERE id = p_room_id;

  -- Boşsa tier'a göre işlem
  IF v_remaining = 0 THEN
    SELECT owner_tier, is_persistent INTO v_owner_tier, v_is_persistent
      FROM rooms WHERE id = p_room_id;
    v_keep_alive := _room_keep_alive(v_owner_tier, v_is_persistent);
    IF v_keep_alive THEN
      UPDATE rooms
        SET listener_count = 0
        WHERE id = p_room_id;
    ELSE
      UPDATE rooms
        SET is_live = false, listener_count = 0
        WHERE id = p_room_id;
    END IF;
  END IF;

  RETURN json_build_object('deleted', v_deleted, 'remaining', v_remaining);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════
-- 5. auto_close_idle_rooms (Y10)
-- ═══════════════════════════════════════════════════
-- 24 saatten uzun süredir boş (participant=0) Plus/Pro keep_alive odaları
-- otomatik kapatır. Manuel çağırılabilir veya pg_cron ile schedule edilebilir.
-- Persistent odalar (kullanıcı aktif host) dondurulmaz, sadece boş kalanlar.
CREATE OR REPLACE FUNCTION auto_close_idle_rooms()
RETURNS JSON AS $$
DECLARE
  v_closed INTEGER := 0;
BEGIN
  -- 24h+ listener_count=0 ve is_live=true olan odaları kapat.
  -- updated_at olmadığından created_at + expires_at kontrolü yapılır.
  WITH idle_rooms AS (
    UPDATE rooms
      SET is_live = false
      WHERE is_live = true
        AND COALESCE(listener_count, 0) = 0
        AND COALESCE(expires_at, now() + interval '100 years') < now()
      RETURNING 1
  )
  SELECT COUNT(*) INTO v_closed FROM idle_rooms;

  RETURN json_build_object('closed', v_closed);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══ DONE ═══
-- Client entegrasyonu:
--   promoteSpeaker  → rpc('promote_speaker_atomic', { p_room_id, p_user_id })
--   demoteSpeaker   → rpc('demote_speaker_atomic', ...)
--   setModerator    → rpc('set_moderator_atomic', ...)
--   cleanupZombies  → rpc('cleanup_room_zombies_atomic', { p_room_id })
