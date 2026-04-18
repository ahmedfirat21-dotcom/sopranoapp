-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v18 — Atomic Host Transfer
--
-- Owner odadan çıkarken host devrini tek transaction içinde yapar.
-- Önceki implementasyon (services/room.ts:transferHost) 3 ayrı UPDATE/DELETE
-- çalıştırıyordu — arada hata/bağlantı kopması → oda sahipsiz veya çift-owner.
--
-- Clubhouse/Discord Stages referansı: owner çıkınca otomatik olarak en eski
-- moderatör (yoksa en eski speaker) host'a yükselir; kimse yoksa oda kapanır
-- (Free) veya açık kalır (keep_alive planlar).
-- ════════════════════════════════════════════════════════════════════

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
  -- ★ GÜVENLİK: Sadece kendi host kaydını devredebilir
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Kimlik doğrulama gereklidir.';
  END IF;
  IF auth.uid()::text != p_old_host_id THEN
    RAISE EXCEPTION 'Yetkiniz yok: Sadece kendi host devrinizi yapabilirsiniz.';
  END IF;

  -- Oda satırını kilitle — aynı anda ikinci bir leave tetiklenirse burada bekler
  SELECT host_id, owner_tier, is_persistent, room_settings
    INTO v_room_host_id, v_owner_tier, v_is_persistent, v_room_settings
    FROM rooms
    WHERE id = p_room_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oda bulunamadı.';
  END IF;

  -- Caller gerçekten mevcut host mu? (defansif: çift leave'de ikincisi no-op)
  IF v_room_host_id IS DISTINCT FROM p_old_host_id THEN
    -- Host zaten başkasına geçmiş — eski host katılımcı kaydını temizle ve dön
    DELETE FROM room_participants
      WHERE room_id = p_room_id AND user_id = p_old_host_id;
    RETURN json_build_object(
      'newHostId', v_room_host_id,
      'keepAlive', NULL,
      'noop', true
    );
  END IF;

  -- ── Aday 1: En eski moderatör ──
  SELECT user_id INTO v_new_host_id
    FROM room_participants
    WHERE room_id = p_room_id
      AND role = 'moderator'
    ORDER BY joined_at ASC
    LIMIT 1
    FOR UPDATE;

  -- ── Aday 2: Moderatör yok, en eski speaker ──
  IF v_new_host_id IS NULL THEN
    SELECT user_id INTO v_new_host_id
      FROM room_participants
      WHERE room_id = p_room_id
        AND role = 'speaker'
        AND user_id != p_old_host_id
      ORDER BY joined_at ASC
      LIMIT 1
      FOR UPDATE;
  END IF;

  -- ── Aday bulundu: owner'lığı atomik devret ──
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

    RETURN json_build_object(
      'newHostId', v_new_host_id,
      'keepAlive', false
    );
  END IF;

  -- ── Aday yok: tier'a göre keep_alive veya close ──
  -- Plus/Pro (premium/pro legacy dahil) keep_alive; diğerleri close
  v_keep_alive := COALESCE(v_is_persistent, false)
               OR v_owner_tier IN ('Plus', 'premium', 'Pro', 'pro');

  -- ★ host_id'yi DEĞİŞTİRME — eski owner claim için referans olarak kalsın.
  -- Bunun yerine room_settings.original_host_id'ye yaz.
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

  -- keep_alive: sadece host katılımcı silinir. close: tüm participantlar silinir.
  IF v_keep_alive THEN
    DELETE FROM room_participants
      WHERE room_id = p_room_id AND user_id = p_old_host_id;
  ELSE
    DELETE FROM room_participants WHERE room_id = p_room_id;
  END IF;

  RETURN json_build_object(
    'newHostId', NULL,
    'keepAlive', v_keep_alive
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══ DONE ═══
-- Client:
--   const { data } = await supabase.rpc('transfer_host_atomic', {
--     p_room_id: roomId, p_old_host_id: oldHostId
--   });
--   → data = { newHostId, keepAlive, noop? }
