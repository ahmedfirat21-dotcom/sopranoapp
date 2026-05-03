-- ════════════════════════════════════════════════════════════
-- v107 (3 May 2026): Mesaj Parlat — 6 stilli atomic gönderim
-- ════════════════════════════════════════════════════════════
--
-- Eski sistem (v92): "Mesaj Parlat" 25 SP karşılığı sonraki 5 mesaja altın
-- glow ekliyordu (consume_message_glow counter). Tek tip görsel.
--
-- Yeni sistem (v107): Her mesaj kendi stilini bağımsız seçer. 6 stil:
--   gold(5) | heart(8) | fire(10) | neon(12) | celebration(15) | galaxy(20)
--
-- Anlık tüketim — birikim yok. SP düş + mesaj insert tek atomic transaction.
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.powerup_send_glow_message(
  p_room_id uuid,
  p_user_id text,
  p_content text,
  p_glow_style text  -- 'gold'|'heart'|'neon'|'fire'|'celebration'|'galaxy'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cost int;
  v_balance int;
  v_message_id uuid;
  v_room rooms%ROWTYPE;
  v_clean text;
BEGIN
  -- Stil → cost mapping (frontend GLOW_STYLES ile birebir)
  v_cost := CASE p_glow_style
    WHEN 'gold'        THEN 5
    WHEN 'heart'       THEN 8
    WHEN 'fire'        THEN 10
    WHEN 'neon'        THEN 12
    WHEN 'celebration' THEN 15
    WHEN 'galaxy'      THEN 20
    ELSE NULL
  END;
  IF v_cost IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Geçersiz stil: ' || p_glow_style);
  END IF;

  -- İçerik kontrolü — boş mesaj engelle, 500 char limit
  v_clean := trim(coalesce(p_content, ''));
  IF length(v_clean) < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Boş mesaj gönderilemez');
  END IF;
  IF length(v_clean) > 500 THEN
    v_clean := substring(v_clean, 1, 500);
  END IF;

  -- Oda kontrolü
  SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Oda bulunamadı');
  END IF;
  IF NOT v_room.is_live THEN
    RETURN jsonb_build_object('success', false, 'error', 'Oda kapalı');
  END IF;

  -- chat_mute kontrolü — moderatör tarafından susturulan kullanıcı parlatılı mesaj da gönderemez
  IF v_room.host_id IS DISTINCT FROM p_user_id THEN
    IF EXISTS (
      SELECT 1 FROM public.room_participants
       WHERE room_id = p_room_id AND user_id = p_user_id AND is_chat_muted = true
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Sohbet erişimin kapalı');
    END IF;
  END IF;

  -- SP yeterlilik
  SELECT COALESCE(system_points, 0) INTO v_balance FROM public.profiles WHERE id = p_user_id;
  IF v_balance < v_cost THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'Yetersiz SP',
      'required', v_cost, 'balance', v_balance
    );
  END IF;

  -- SP düş — trg_profile_sensitive_guard'ı bypass eden session var (atomic SP RPC pattern)
  PERFORM set_config('app.sp_rpc_bypass', 'true', true);
  UPDATE public.profiles
    SET system_points = system_points - v_cost
    WHERE id = p_user_id;

  -- Mesaj insert — metadata.glow_style ile
  INSERT INTO public.messages (room_id, sender_id, content, metadata)
  VALUES (p_room_id, p_user_id, v_clean, jsonb_build_object('glow_style', p_glow_style))
  RETURNING id INTO v_message_id;

  -- sp_transactions log
  INSERT INTO public.sp_transactions (user_id, amount, type, description, external_ref)
  VALUES (p_user_id, -v_cost, 'powerup_glow_message',
          'Mesaj parlat — ' || p_glow_style, v_message_id::text);

  RETURN jsonb_build_object(
    'success', true,
    'cost', v_cost,
    'glow_style', p_glow_style,
    'message_id', v_message_id,
    'new_balance', v_balance - v_cost
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.powerup_send_glow_message(uuid, text, text, text) TO anon, authenticated;

-- ─── Eski powerup_message_glow (5-mesaj birikim) deprecate notu ───
-- Eski PowerUpsSheet'teki "Mesaj Parlat" butonu deprecate. UI'da kaldırılacak.
-- Backwards-compat: messages.metadata.glow=true olan eski kayıtlar render'da 'gold' fallback.
