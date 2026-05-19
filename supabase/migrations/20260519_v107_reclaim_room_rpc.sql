-- ════════════════════════════════════════════════════════════════════
-- v107 (19 May 2026): Reclaim Room as Original Host
-- ════════════════════════════════════════════════════════════════════
-- Sorun: Geçici host transferi sonrası asıl sahip (original_host_id)
-- odasını uyandırmak istediğinde, host_id farklı kişide olduğu için
-- client-side UPDATE RLS tarafından reddediliyordu.
--
-- Senaryo: Burak DENİZ odayı açtı → ahmed ferhat geçici host oldu →
-- Burak çıktı → ahmed çıktı → oda is_live=false → Burak "Aktifleştir"
-- bastığında "yetkiniz yok" hatası alıyor çünkü host_id=ahmed, RLS
-- "host_id=auth.uid()" şartı geçmiyor.
--
-- Çözüm: SECURITY DEFINER RPC ile RLS bypass — sadece original_host_id
-- ile eşleşen çağıran user reclaim yapabilir, başkası yapamaz.
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.reclaim_room_as_original_host(
  p_room_id uuid,
  p_user_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orig_host text;
  v_current_host text;
  v_updated boolean := false;
BEGIN
  -- Odanın asıl sahibini ve mevcut host'unu çek
  SELECT
    (room_settings->>'original_host_id'),
    host_id
  INTO v_orig_host, v_current_host
  FROM rooms
  WHERE id = p_room_id;

  IF v_orig_host IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Bu odanin asil sahibi bilgisi eksik (eski legacy oda olabilir).'
    );
  END IF;

  -- Caller asıl sahip mi?
  IF v_orig_host <> p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Bu odanin asil sahibi degilsin. Reclaim yetkisi yok.'
    );
  END IF;

  -- Zaten host'sa no-op
  IF v_current_host = p_user_id THEN
    RETURN jsonb_build_object(
      'success', true,
      'noop', true,
      'message', 'Zaten host olarak kayitlisin.'
    );
  END IF;

  -- Reclaim: host_id'yi asıl sahibe geri çek
  UPDATE rooms
  SET host_id = p_user_id
  WHERE id = p_room_id
    AND (room_settings->>'original_host_id') = p_user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated THEN
    -- Audit trail (varsa room_audit_log tablosu)
    BEGIN
      INSERT INTO room_audit_log (room_id, user_id, action, details, created_at)
      VALUES (
        p_room_id,
        p_user_id,
        'host_reclaimed',
        jsonb_build_object(
          'previous_host', v_current_host,
          'reclaimed_by_original_host', true
        ),
        now()
      );
    EXCEPTION WHEN undefined_table THEN
      -- Tablo yoksa sessizce geç (audit opt-in)
      NULL;
    END;

    RETURN jsonb_build_object(
      'success', true,
      'previous_host', v_current_host,
      'new_host', p_user_id
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'UPDATE 0 satir etkiledi (beklenmedik durum).'
    );
  END IF;
END;
$$;

-- Permission: authenticated + anon (client'tan çağrılır)
GRANT EXECUTE ON FUNCTION public.reclaim_room_as_original_host(uuid, text) TO authenticated, anon;
