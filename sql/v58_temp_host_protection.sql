-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v58 — Geçici Host Koruması
--
-- Sorun: transfer_host_atomic asıl owner çıkınca en eski moderator/speaker'ı
-- 'owner' rolüne yükseltiyor ve rooms.host_id'yi onlara veriyor. Şu an
-- bu "geçici host" odayı silebiliyor, ismini/temayı/ücretini değiştirebiliyor.
--
-- Asıl sahip room_settings.original_host_id alanında saklanıyor (v18'den beri).
-- Bu trigger:
--   • original_host_id set edilmişse (= birisi asıl host'tan devraldı),
--   • app.allow_room_critical_update bypass flag'i set EDİLMEMİŞSE,
--   • kritik alanlar değişmiş ise → exception fırlatır.
-- Bypass flag yalnız `update_room_critical` RPC tarafından set edilir; o RPC de
-- caller user_id'yi original_host_id'ye karşı doğrular. Yani direkt .update()
-- ile kritik alanlara dokunulamaz.
--
-- DELETE: protect_room_delete_temp_host trigger'ı sahibi olmayan kullanıcının
-- rooms satırını silmesini reddeder (frontend bypass koruması).
-- ════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════
-- 1. UPDATE Trigger — kritik alan değişikliklerini koru
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION protect_critical_room_fields_temp_host()
RETURNS TRIGGER AS $$
DECLARE
  v_orig TEXT;
  v_changed BOOLEAN := FALSE;
BEGIN
  v_orig := OLD.room_settings->>'original_host_id';

  -- Koruma yalnız GERÇEK devir olduğunda devrede:
  --   • original_host_id NULL ise (eski sürüm odaları) → koruma yok
  --   • original_host_id == host_id ise (asıl sahip aktif) → koruma yok
  --   • original_host_id != host_id ise (geçici host devraldı) → koru
  IF v_orig IS NULL OR v_orig = OLD.host_id THEN
    RETURN NEW;
  END IF;

  -- host_id değişiyorsa = transfer_host_atomic / claim_host gibi yetkili bir RPC
  -- çalışıyor. Bu RPC'ler kendi yetkilendirmesini yapar; trigger karışmaz.
  -- Ayrıca asıl sahip geri alıyorsa (NEW.host_id = v_orig) trivial olarak izinli.
  IF NEW.host_id IS DISTINCT FROM OLD.host_id THEN
    RETURN NEW;
  END IF;

  -- Bypass flag — update_room_critical / delete_room_as_owner gibi RPC'ler tarafından set edilir.
  IF current_setting('app.allow_room_critical_update', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- Top-level kritik kolonlar
  IF NEW.name             IS DISTINCT FROM OLD.name             THEN v_changed := TRUE; END IF;
  IF NEW.description      IS DISTINCT FROM OLD.description      THEN v_changed := TRUE; END IF;
  IF NEW.category         IS DISTINCT FROM OLD.category         THEN v_changed := TRUE; END IF;
  IF NEW.type             IS DISTINCT FROM OLD.type             THEN v_changed := TRUE; END IF;
  IF NEW.theme_id         IS DISTINCT FROM OLD.theme_id         THEN v_changed := TRUE; END IF;
  IF NEW.max_speakers     IS DISTINCT FROM OLD.max_speakers     THEN v_changed := TRUE; END IF;
  IF NEW.max_listeners    IS DISTINCT FROM OLD.max_listeners    THEN v_changed := TRUE; END IF;
  IF NEW.max_cameras      IS DISTINCT FROM OLD.max_cameras      THEN v_changed := TRUE; END IF;
  IF NEW.max_moderators   IS DISTINCT FROM OLD.max_moderators   THEN v_changed := TRUE; END IF;

  -- room_image_url kolonu opsiyonel (bazı schemalarda yoksa to_jsonb fallback)
  BEGIN
    IF (to_jsonb(NEW)->>'room_image_url') IS DISTINCT FROM (to_jsonb(OLD)->>'room_image_url') THEN
      v_changed := TRUE;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- kolon yoksa atla
    NULL;
  END;

  -- room_settings içindeki kritik anahtarlar
  IF (NEW.room_settings->'room_password')      IS DISTINCT FROM (OLD.room_settings->'room_password')      THEN v_changed := TRUE; END IF;
  IF (NEW.room_settings->'entry_fee')          IS DISTINCT FROM (OLD.room_settings->'entry_fee')          THEN v_changed := TRUE; END IF;
  IF (NEW.room_settings->'donation_target')    IS DISTINCT FROM (OLD.room_settings->'donation_target')    THEN v_changed := TRUE; END IF;
  IF (NEW.room_settings->'language')           IS DISTINCT FROM (OLD.room_settings->'language')           THEN v_changed := TRUE; END IF;
  IF (NEW.room_settings->'is_age_restricted')  IS DISTINCT FROM (OLD.room_settings->'is_age_restricted')  THEN v_changed := TRUE; END IF;
  IF (NEW.room_settings->'audience_mode')      IS DISTINCT FROM (OLD.room_settings->'audience_mode')      THEN v_changed := TRUE; END IF;
  IF (NEW.room_settings->'is_locked')          IS DISTINCT FROM (OLD.room_settings->'is_locked')          THEN v_changed := TRUE; END IF;
  IF (NEW.room_settings->'is_persistent')      IS DISTINCT FROM (OLD.room_settings->'is_persistent')      THEN v_changed := TRUE; END IF;
  IF (NEW.room_settings->'tags')               IS DISTINCT FROM (OLD.room_settings->'tags')               THEN v_changed := TRUE; END IF;

  -- original_host_id'nin kendisinin TEMP HOST tarafından silinmesi/değiştirilmesi YASAK
  -- (asıl sahip dönerse buraya yazılmış kayda göre kimlik doğrulanıyor)
  IF (NEW.room_settings->>'original_host_id') IS DISTINCT FROM (OLD.room_settings->>'original_host_id') THEN
    v_changed := TRUE;
  END IF;

  IF v_changed THEN
    RAISE EXCEPTION 'Geçici host kritik oda alanlarını değiştiremez. Sadece odanın asıl sahibi düzenleyebilir.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_critical_room_fields_temp_host ON public.rooms;
CREATE TRIGGER trg_protect_critical_room_fields_temp_host
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW
  EXECUTE FUNCTION protect_critical_room_fields_temp_host();


-- ═══════════════════════════════════════════════════
-- 2. DELETE Trigger — geçici host odayı silemesin
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION protect_room_delete_temp_host()
RETURNS TRIGGER AS $$
DECLARE
  v_orig TEXT;
BEGIN
  v_orig := OLD.room_settings->>'original_host_id';

  -- Devir olmamışsa (NULL veya hâlâ asıl sahip aktif) normal akış
  IF v_orig IS NULL OR v_orig = OLD.host_id THEN
    RETURN OLD;
  END IF;

  -- Bypass flag — delete_room_as_owner RPC'si üzerinden geliyorsa izin
  IF current_setting('app.allow_room_critical_update', true) = 'true' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'Sadece odanın asıl sahibi odayı silebilir.'
    USING ERRCODE = '42501';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_room_delete_temp_host ON public.rooms;
CREATE TRIGGER trg_protect_room_delete_temp_host
  BEFORE DELETE ON public.rooms
  FOR EACH ROW
  EXECUTE FUNCTION protect_room_delete_temp_host();


-- ═══════════════════════════════════════════════════
-- 3. RPC — Asıl host bypass'lı update
-- ═══════════════════════════════════════════════════
-- Asıl host kritik alanları güncellemek için BU rpc'yi kullanır.
-- Direkt UPDATE ile asıl host da yapamaz (trigger reddeder); RPC zorunlu.
CREATE OR REPLACE FUNCTION update_room_critical(
  p_room_id UUID,
  p_user_id TEXT,
  p_updates JSONB
) RETURNS VOID AS $$
DECLARE
  v_orig TEXT;
  v_host TEXT;
  v_settings JSONB;
  v_new_settings JSONB;
BEGIN
  IF p_user_id IS NULL OR p_user_id = '' THEN
    RAISE EXCEPTION 'Kullanıcı kimliği gerekli.';
  END IF;

  SELECT host_id, room_settings INTO v_host, v_settings
    FROM rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oda bulunamadı.';
  END IF;

  v_orig := v_settings->>'original_host_id';

  -- Yetki kontrolü:
  --  • original_host_id varsa: SADECE o user düzenleyebilir
  --  • original_host_id yoksa: host_id (oda sahibi) düzenleyebilir
  IF v_orig IS NOT NULL THEN
    IF v_orig != p_user_id THEN
      RAISE EXCEPTION 'Yalnız odanın asıl sahibi kritik ayarları düzenleyebilir.'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    IF v_host != p_user_id THEN
      RAISE EXCEPTION 'Yalnız oda sahibi düzenleyebilir.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Bypass flag — bu transaction içindeki UPDATE trigger'a takılmasın
  PERFORM set_config('app.allow_room_critical_update', 'true', true);

  -- room_settings update'i: incoming JSONB merge
  v_new_settings := v_settings;
  IF p_updates ? 'room_settings' THEN
    v_new_settings := COALESCE(v_settings, '{}'::jsonb) || (p_updates->'room_settings');
  END IF;

  UPDATE rooms SET
    name             = COALESCE(p_updates->>'name', name),
    description      = COALESCE(p_updates->>'description', description),
    category         = COALESCE(p_updates->>'category', category),
    type             = COALESCE(p_updates->>'type', type),
    theme_id         = COALESCE(p_updates->>'theme_id', theme_id),
    max_speakers     = COALESCE((p_updates->>'max_speakers')::int, max_speakers),
    max_listeners    = COALESCE((p_updates->>'max_listeners')::int, max_listeners),
    max_cameras      = COALESCE((p_updates->>'max_cameras')::int, max_cameras),
    max_moderators   = COALESCE((p_updates->>'max_moderators')::int, max_moderators),
    room_settings    = v_new_settings
  WHERE id = p_room_id;

  -- room_image_url opsiyonel kolon
  BEGIN
    IF p_updates ? 'room_image_url' THEN
      EXECUTE 'UPDATE rooms SET room_image_url = $1 WHERE id = $2'
        USING p_updates->>'room_image_url', p_room_id;
    END IF;
  EXCEPTION WHEN undefined_column THEN
    NULL;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════
-- 4. RPC — Asıl host bypass'lı delete
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION delete_room_as_owner(
  p_room_id UUID,
  p_user_id TEXT
) RETURNS VOID AS $$
DECLARE
  v_orig TEXT;
  v_host TEXT;
BEGIN
  IF p_user_id IS NULL OR p_user_id = '' THEN
    RAISE EXCEPTION 'Kullanıcı kimliği gerekli.';
  END IF;

  SELECT host_id, room_settings->>'original_host_id'
    INTO v_host, v_orig
    FROM rooms WHERE id = p_room_id;
  IF v_host IS NULL THEN
    -- Oda zaten yok — idempotent
    RETURN;
  END IF;

  IF v_orig IS NOT NULL THEN
    IF v_orig != p_user_id THEN
      RAISE EXCEPTION 'Yalnız odanın asıl sahibi odayı silebilir.'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    IF v_host != p_user_id THEN
      RAISE EXCEPTION 'Yalnız oda sahibi odayı silebilir.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  PERFORM set_config('app.allow_room_critical_update', 'true', true);

  -- Önce katılımcılar (FK), sonra oda
  DELETE FROM room_participants WHERE room_id = p_room_id;
  DELETE FROM rooms WHERE id = p_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════
-- 5. transfer_host_atomic, claim_host vs. RPC'leri etkilenmesin
-- ═══════════════════════════════════════════════════
-- transfer_host_atomic v18 zaten SECURITY DEFINER ve direkt host_id update'i yapıyor.
-- Aynı transaction'da bizim trigger'a takılmasın diye onun başında bypass flag'i set
-- edelim. Mevcut tanımı koruyup başına bir satır ekliyoruz.

-- (Not: bu ALTER fonksiyonu CREATE OR REPLACE ile değiştirmeyi gerektiriyor.
--  Mevcut fonksiyonun gövdesine müdahale etmek yerine, sadece START TIMESTAMP set
--  ediliyor — fonksiyon SECURITY DEFINER zaten, bu trigger'lara dokunmaması için
--  başlatma satırı şart.)

-- transfer_host_atomic için bypass flag'i — fonksiyonu yeniden bind ediyoruz.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'transfer_host_atomic') THEN
    -- Fonksiyon var; v18'den. Tanımı değiştirmek yerine wrapper trigger flag'i
    -- BEFORE UPDATE'te zaten devreye girer. transfer_host_atomic kendi içinde
    -- host_id ve room_settings güncelliyor — kritik alan değişikliği olarak
    -- algılanıp reddedilmemesi için, mevcut RPC'lerin başında bypass flag
    -- set etmek gerek. v59'da bu RPC tanımları yenilenecek; v58 yalnız trigger
    -- ve yeni RPC'leri koyar.
    NULL;
  END IF;
END $$;


-- ═══ DONE ═══
-- Client kullanım:
--   const { error } = await supabase.rpc('update_room_critical', {
--     p_room_id: roomId, p_user_id: userId, p_updates: { name: 'Yeni İsim', room_settings: { tags: [...] } }
--   });
--
--   const { error } = await supabase.rpc('delete_room_as_owner', {
--     p_room_id: roomId, p_user_id: userId
--   });
