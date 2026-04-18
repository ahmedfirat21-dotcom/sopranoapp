-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v19 — Role Escalation Guard + Atomic Claim Host
--
-- K4 FIX: room_participants UPDATE RLS policy her kullanıcıya kendi
-- satırını UPDATE etme hakkı veriyor (v16). Bu, listener'ın doğrudan
-- `update({ role: 'speaker' })` ile sahneye yükselmesine izin veriyordu.
--
-- Referans: Clubhouse/Discord Stages/Twitter Spaces'te listener kendini
-- speaker yapamaz — moderator/owner davet eder. Aynı kural burada.
--
-- Bu migration:
--   1. room_participants üzerinde BEFORE UPDATE trigger ekler — role
--      değişikliği için yetki kontrolü yapar (auth.uid() bazlı, JWT'den).
--   2. claim_host atomic RPC ekler — sahipsiz odada kullanıcı host olur.
--
-- Self-transitions (kullanıcının kendi rolü):
--   ✅ listener/spectator → pending_speaker (el kaldırma)
--   ✅ pending_speaker → listener (el indirme)
--   ✅ speaker → listener (sahneden inme)
--   ✅ moderator → speaker (moderatörlükten çekilme)
--   ❌ diğer her şey → owner/moderator aracılığıyla yapılmalı
--
-- Başkasının rolünü değiştirme:
--   ✅ sadece owner (rooms.host_id) veya moderator yapabilir
-- ════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════
-- 1. Role Escalation Trigger
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION prevent_role_escalation()
RETURNS TRIGGER AS $$
DECLARE
  v_caller TEXT;
  v_authorized TEXT;
BEGIN
  -- Role değişmediyse kontrol yok
  IF OLD.role IS NOT DISTINCT FROM NEW.role THEN
    RETURN NEW;
  END IF;

  v_caller := auth.uid()::text;

  -- auth.uid() yok (service-role / bypass) → güven
  IF v_caller IS NULL THEN
    RETURN NEW;
  END IF;

  -- SECURITY DEFINER RPC'ler tarafından set edilen işaret: geçir
  -- (ör. claim_host içinde set_config('app.role_change_authorized', 'true', true))
  BEGIN
    v_authorized := current_setting('app.role_change_authorized', true);
  EXCEPTION WHEN OTHERS THEN
    v_authorized := NULL;
  END;
  IF v_authorized = 'true' THEN
    RETURN NEW;
  END IF;

  -- Self-update: sadece izin verilen rol geçişleri
  IF v_caller = OLD.user_id THEN
    IF (OLD.role IN ('listener', 'spectator') AND NEW.role = 'pending_speaker')
       OR (OLD.role = 'pending_speaker' AND NEW.role IN ('listener', 'spectator'))
       OR (OLD.role = 'speaker' AND NEW.role = 'listener')
       OR (OLD.role = 'moderator' AND NEW.role = 'speaker')
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Role değişikliği reddedildi: bu geçişi kendiniz yapamazsınız (% → %). Owner/moderator yetkilendirmelidir.',
      OLD.role, NEW.role
      USING ERRCODE = '42501';
  END IF;

  -- Başkasının rolünü değiştirme: sadece owner (host_id) veya moderator
  IF EXISTS (
    SELECT 1 FROM rooms r
    WHERE r.id = NEW.room_id AND r.host_id = v_caller
  ) OR EXISTS (
    SELECT 1 FROM room_participants rp
    WHERE rp.room_id = NEW.room_id
      AND rp.user_id = v_caller
      AND rp.role IN ('owner', 'moderator')
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Role değişikliği reddedildi: başka kullanıcının rolünü değiştirmek için owner/moderator yetkisi gerekir.'
    USING ERRCODE = '42501';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON room_participants;
CREATE TRIGGER trg_prevent_role_escalation
  BEFORE UPDATE OF role ON room_participants
  FOR EACH ROW
  EXECUTE FUNCTION prevent_role_escalation();


-- ═══════════════════════════════════════════════════
-- 2. claim_host Atomic RPC
-- ═══════════════════════════════════════════════════
-- Sahipsiz odada kullanıcı kendini owner yapar (geri sayım UI'sı ardından).
-- Eski implementasyon: client doğrudan room_participants.update({role:'owner'})
-- çalıştırıyordu → v19 trigger bunu blok eder. Bu RPC set_config ile izin
-- bayrağı açar, yetki kontrolünü atomik yapar.
CREATE OR REPLACE FUNCTION claim_host(
  p_room_id UUID,
  p_user_id TEXT
) RETURNS VOID AS $$
DECLARE
  v_my_role TEXT;
  v_existing_owner TEXT;
BEGIN
  -- ★ GÜVENLİK: Sadece kendi adına claim yapabilir
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Kimlik doğrulama gereklidir.';
  END IF;
  IF auth.uid()::text != p_user_id THEN
    RAISE EXCEPTION 'Yetkiniz yok: Sadece kendiniz için host claim yapabilirsiniz.';
  END IF;

  -- Oda var mı? (satırı kilitle)
  PERFORM 1 FROM rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oda bulunamadı.';
  END IF;

  -- Katılımcı mı ve uygun rolde mi?
  SELECT role INTO v_my_role
    FROM room_participants
    WHERE room_id = p_room_id AND user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bu odada katılımcı değilsiniz.';
  END IF;
  IF v_my_role IN ('banned', 'spectator', 'guest') THEN
    RAISE EXCEPTION 'Bu rolde host olamazsınız.';
  END IF;

  -- Sahipsiz mi? (race'i önlemek için row lock)
  SELECT user_id INTO v_existing_owner
    FROM room_participants
    WHERE room_id = p_room_id AND role = 'owner'
    LIMIT 1
    FOR UPDATE;
  IF v_existing_owner IS NOT NULL THEN
    RAISE EXCEPTION 'Bu odanın zaten bir sahibi var.';
  END IF;

  -- Trigger'a: yetkili rol değişikliği
  PERFORM set_config('app.role_change_authorized', 'true', true);

  UPDATE room_participants
    SET role = 'owner'
    WHERE room_id = p_room_id AND user_id = p_user_id;

  UPDATE rooms
    SET host_id = p_user_id
    WHERE id = p_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════
-- 3. transfer_host_atomic — v18'de set_config eklenmesi
-- ═══════════════════════════════════════════════════
-- v18'de oluşturulan transfer_host_atomic RPC'si trigger'ı geçmek için
-- set_config çağırır. (v18 migrasyonundan önce v19 uygulanırsa çakışma
-- olmaması için burada da yeniden tanımlıyoruz — idempotent CREATE OR REPLACE.)
CREATE OR REPLACE FUNCTION transfer_host_atomic(
  p_room_id UUID,
  p_old_host_id TEXT
) RETURNS JSON AS $$
DECLARE
  v_new_host_id TEXT;
  v_room_host_id TEXT;
  v_owner_tier TEXT;
  v_is_persistent BOOLEAN;
  v_room_settings JSONB;
  v_keep_alive BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Kimlik doğrulama gereklidir.';
  END IF;
  IF auth.uid()::text != p_old_host_id THEN
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

  -- Trigger'a yetkilendirme bayrağı — rol değişiklikleri onaylı
  PERFORM set_config('app.role_change_authorized', 'true', true);

  IF v_room_host_id IS DISTINCT FROM p_old_host_id THEN
    DELETE FROM room_participants
      WHERE room_id = p_room_id AND user_id = p_old_host_id;
    RETURN json_build_object(
      'newHostId', v_room_host_id,
      'keepAlive', NULL,
      'noop', true
    );
  END IF;

  SELECT user_id INTO v_new_host_id
    FROM room_participants
    WHERE room_id = p_room_id AND role = 'moderator'
    ORDER BY joined_at ASC LIMIT 1 FOR UPDATE;

  IF v_new_host_id IS NULL THEN
    SELECT user_id INTO v_new_host_id
      FROM room_participants
      WHERE room_id = p_room_id AND role = 'speaker' AND user_id != p_old_host_id
      ORDER BY joined_at ASC LIMIT 1 FOR UPDATE;
  END IF;

  IF v_new_host_id IS NOT NULL THEN
    UPDATE room_participants
      SET role = 'owner'
      WHERE room_id = p_room_id AND user_id = v_new_host_id;

    UPDATE rooms
      SET host_id = v_new_host_id,
          room_settings = jsonb_set(
            COALESCE(v_room_settings, '{}'::jsonb),
            '{original_host_id}',
            to_jsonb(p_old_host_id),
            true
          )
      WHERE id = p_room_id;

    DELETE FROM room_participants
      WHERE room_id = p_room_id AND user_id = p_old_host_id;

    RETURN json_build_object('newHostId', v_new_host_id, 'keepAlive', false);
  END IF;

  v_keep_alive := COALESCE(v_is_persistent, false)
               OR v_owner_tier IN ('Plus', 'premium', 'Pro', 'pro');

  UPDATE rooms
    SET room_settings = jsonb_set(
          COALESCE(v_room_settings, '{}'::jsonb),
          '{original_host_id}',
          to_jsonb(p_old_host_id),
          true
        ),
        is_live = CASE WHEN v_keep_alive THEN is_live ELSE false END,
        listener_count = CASE WHEN v_keep_alive THEN listener_count ELSE 0 END
    WHERE id = p_room_id;

  IF v_keep_alive THEN
    DELETE FROM room_participants
      WHERE room_id = p_room_id AND user_id = p_old_host_id;
  ELSE
    DELETE FROM room_participants WHERE room_id = p_room_id;
  END IF;

  RETURN json_build_object('newHostId', NULL, 'keepAlive', v_keep_alive);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══ DONE ═══
-- UYGULAMA SIRASI: v18 → v19 (veya doğrudan v19 — transfer_host_atomic burada
-- yeniden tanımlanıyor ve trigger'lı versiyonu overwrite ediyor).
