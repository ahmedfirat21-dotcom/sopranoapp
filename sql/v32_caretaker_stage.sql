-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v32 — Caretaker Stage (Sahipsiz Oda Süreli Sahne)
--
-- Amaç (SpeakyChat nostaljisi):
--   Owner + moderator olmadığında listener'lar süreli olarak sahneye çıkabilsin.
--   5 dakika sahnede kalır, sonra otomatik listener'a iner. Cooldown 60 saniye.
--   Owner/moderator dönünce "caretaker" speaker'lar kalıcı speaker'a normalize olur
--   (expires_at NULL) — owner toplu indirmek isterse mevcut moderasyon akışıyla.
--
-- Değişiklikler:
--   1. room_participants.stage_expires_at TIMESTAMPTZ kolonu
--   2. claim_stage_seat(room_id, user_id) — atomic promote + cooldown kontrolü
--   3. release_expired_caretakers() — cleanup job (scheduled veya on-demand)
--   4. trg_normalize_caretakers_on_auth_join — owner/mod gelince expires_at'i sil
-- ════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════
-- 1. Kolon ekle
-- ═══════════════════════════════════════════════════
ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS stage_expires_at TIMESTAMPTZ;

-- İndeks: cleanup job için süresi dolmuş caretaker'ları hızlı bulsun
CREATE INDEX IF NOT EXISTS idx_room_participants_stage_expires
  ON room_participants(stage_expires_at)
  WHERE stage_expires_at IS NOT NULL;


-- ═══════════════════════════════════════════════════
-- 2. claim_stage_seat — Sahneye çıkma RPC
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION claim_stage_seat(
  p_room_id UUID,
  p_user_id TEXT
) RETURNS JSON AS $$
DECLARE
  v_caller TEXT;
  v_max_speakers INT;
  v_my_role TEXT;
  v_my_expires TIMESTAMPTZ;
  v_owner_count INT;
  v_mod_count INT;
  v_stage_count INT;
  v_cooldown_remaining INT;
  v_duration_sec INT := 300;  -- ★ 5 dakika sahne süresi
  v_cooldown_sec INT := 60;   -- ★ 60 saniye cooldown
  v_new_expires TIMESTAMPTZ;
BEGIN
  -- Kimlik doğrulama — Firebase third-party auth context'inde auth.uid() bazen NULL
  -- dönüyor (Supabase quirk). Client-side zaten authenticated; p_user_id'yi
  -- fallback olarak kullan. Mevcut claim_host ve diğer RPC'lerle aynı pattern.
  v_caller := auth.uid()::text;
  IF v_caller IS NULL THEN
    v_caller := p_user_id;
  END IF;
  IF v_caller != p_user_id THEN
    RAISE EXCEPTION 'Sadece kendi adınıza sahneye çıkabilirsiniz.' USING ERRCODE = '42501';
  END IF;

  -- Oda bilgisi
  SELECT max_speakers INTO v_max_speakers FROM rooms WHERE id = p_room_id FOR UPDATE;
  IF v_max_speakers IS NULL THEN
    RAISE EXCEPTION 'Oda bulunamadı.';
  END IF;

  -- Kendi participant satırı (lock)
  SELECT role, stage_expires_at INTO v_my_role, v_my_expires
    FROM room_participants
    WHERE room_id = p_room_id AND user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bu odada katılımcı değilsiniz.';
  END IF;
  IF v_my_role != 'listener' THEN
    RAISE EXCEPTION 'Zaten sahnedesiniz veya başka bir roldesiniz.';
  END IF;

  -- Cooldown kontrolü — son sahne bitiminden itibaren 60sn geçmeli
  IF v_my_expires IS NOT NULL AND v_my_expires + (v_cooldown_sec || ' seconds')::interval > now() THEN
    v_cooldown_remaining := EXTRACT(EPOCH FROM (v_my_expires + (v_cooldown_sec || ' seconds')::interval - now()))::INT;
    RAISE EXCEPTION 'Bekleme süresi: % saniye', v_cooldown_remaining USING ERRCODE = 'P0001';
  END IF;

  -- Caretaker modu aktif mi? (owner + moderator YOK olmalı)
  SELECT COUNT(*) INTO v_owner_count
    FROM room_participants
    WHERE room_id = p_room_id AND role = 'owner';
  SELECT COUNT(*) INTO v_mod_count
    FROM room_participants
    WHERE room_id = p_room_id AND role = 'moderator';

  IF v_owner_count > 0 OR v_mod_count > 0 THEN
    RAISE EXCEPTION 'Bu odada yetkili var; sahneye çıkmak için davet bekleyin.' USING ERRCODE = '42501';
  END IF;

  -- Slot kontrolü — tier max_speakers aşılmasın
  SELECT COUNT(*) INTO v_stage_count
    FROM room_participants
    WHERE room_id = p_room_id AND role IN ('owner', 'moderator', 'speaker');

  IF v_stage_count >= v_max_speakers THEN
    RAISE EXCEPTION 'Sahne dolu (%/%)', v_stage_count, v_max_speakers USING ERRCODE = 'P0002';
  END IF;

  -- Promote et
  v_new_expires := now() + (v_duration_sec || ' seconds')::interval;

  -- v19/v31 role escalation trigger'larını bypass
  PERFORM set_config('app.role_change_authorized', 'true', true);

  UPDATE room_participants
    SET role = 'speaker',
        stage_expires_at = v_new_expires,
        is_muted = false
    WHERE room_id = p_room_id AND user_id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'expires_at', v_new_expires,
    'duration_sec', v_duration_sec
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════
-- 3. release_expired_caretakers — Cleanup RPC
-- ═══════════════════════════════════════════════════
-- Süresi dolmuş caretaker'ları listener'a indirir. İki yerden çağrılır:
--   a) Cron job (periyodik)
--   b) Client timer fallback (user kapatırsa server cleanup yapsın)
CREATE OR REPLACE FUNCTION release_expired_caretakers()
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  -- Trigger'ları bypass et (role change authorized)
  PERFORM set_config('app.role_change_authorized', 'true', true);

  WITH expired AS (
    UPDATE room_participants
      SET role = 'listener',
          is_muted = false
      -- stage_expires_at korunur → cooldown hesaplaması için
      WHERE role = 'speaker'
        AND stage_expires_at IS NOT NULL
        AND stage_expires_at < now()
      RETURNING user_id
  )
  SELECT COUNT(*) INTO v_count FROM expired;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════
-- 4. Trigger — Owner/mod gelince caretaker'ları normalize et
-- ═══════════════════════════════════════════════════
-- Owner veya moderator rolünde biri odaya katılınca (INSERT) veya terfi edince
-- (UPDATE role → owner/moderator), mevcut caretaker speaker'lar artık "kalıcı"
-- speaker olur — stage_expires_at NULL olur. Owner istemezse mevcut moderasyon
-- akışıyla tek tek indirir.
CREATE OR REPLACE FUNCTION normalize_caretakers_on_auth_join()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IN ('owner', 'moderator') THEN
    UPDATE room_participants
      SET stage_expires_at = NULL
      WHERE room_id = NEW.room_id
        AND role = 'speaker'
        AND stage_expires_at IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_caretakers_on_auth_join ON room_participants;
CREATE TRIGGER trg_normalize_caretakers_on_auth_join
  AFTER INSERT OR UPDATE OF role ON room_participants
  FOR EACH ROW
  WHEN (NEW.role IN ('owner', 'moderator'))
  EXECUTE FUNCTION normalize_caretakers_on_auth_join();


-- ═══ DONE ═══
-- Uygulama akışı:
--   1. Client: oda sahipsiz (owner+mod yok) → "Sahneye Çık" butonu göster
--   2. Basınca: RoomService.claimStageSeat() → RPC çağırır
--   3. Client timer: stage_expires_at'e göre UI'da kalan süre göster
--   4. Süre dolduğunda: server tarafı release_expired_caretakers() otomatik iner,
--      client tarafı broadcast dinler ve kendi state'ini günceller
