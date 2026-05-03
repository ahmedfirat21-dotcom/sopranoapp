-- ════════════════════════════════════════════════════════════
-- v107 (3 May 2026): Premium Mesaj Sanatı entegrasyonu
-- ════════════════════════════════════════════════════════════
-- Mağazadan satın alınan message_art ürünleri (Constellation, Or Ancien,
-- Inferno, Voltaire, Belle Époque) artık parlatma sisteminde "free unlock"
-- stili olarak kullanılır. Tek seferlik satın alma → sınırsız mesaj atma.
--
-- Sabit 6 stil (gold/heart/fire/neon/celebration/galaxy) eskisi gibi
-- pay-per-use kalır.
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.powerup_send_glow_message(
  p_room_id uuid,
  p_user_id text,
  p_content text,
  p_glow_style text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cost int;
  v_is_premium boolean := false;
  v_balance int;
  v_message_id uuid;
  v_room rooms%ROWTYPE;
  v_clean text;
BEGIN
  -- Sabit 6 stil (consumable, her mesajda SP düş)
  v_cost := CASE p_glow_style
    WHEN 'gold'        THEN 5
    WHEN 'heart'       THEN 8
    WHEN 'fire'        THEN 10
    WHEN 'neon'        THEN 12
    WHEN 'celebration' THEN 15
    WHEN 'galaxy'      THEN 20
    ELSE NULL
  END;

  -- Premium 5 stil (one-time-buy, envanterde varsa free)
  IF v_cost IS NULL THEN
    IF p_glow_style IN ('constellation','or-ancien','inferno','voltaire','belle-epoque') THEN
      v_is_premium := true;
      v_cost := 0;
      -- Envanter kontrolü
      IF NOT EXISTS (
        SELECT 1 FROM public.user_inventory
         WHERE user_id = p_user_id AND item_id = p_glow_style
      ) THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Bu stili önce mağazadan satın al',
          'requires_purchase', true,
          'item_id', p_glow_style
        );
      END IF;
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Geçersiz stil: ' || p_glow_style);
    END IF;
  END IF;

  -- İçerik kontrolü
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

  -- chat_mute kontrolü
  IF v_room.host_id IS DISTINCT FROM p_user_id THEN
    IF EXISTS (
      SELECT 1 FROM public.room_participants
       WHERE room_id = p_room_id AND user_id = p_user_id AND is_chat_muted = true
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Sohbet erişimin kapalı');
    END IF;
  END IF;

  -- Sadece consumable ise SP yeterlilik kontrolü ve düşüm
  IF v_cost > 0 THEN
    SELECT COALESCE(system_points, 0) INTO v_balance FROM public.profiles WHERE id = p_user_id;
    IF v_balance < v_cost THEN
      RETURN jsonb_build_object(
        'success', false, 'error', 'Yetersiz SP',
        'required', v_cost, 'balance', v_balance
      );
    END IF;
    PERFORM set_config('app.sp_rpc_bypass', 'true', true);
    UPDATE public.profiles SET system_points = system_points - v_cost WHERE id = p_user_id;
  ELSE
    -- Premium: SP düşmeyeceği için bakiyeyi sadece dönüş için oku
    SELECT COALESCE(system_points, 0) INTO v_balance FROM public.profiles WHERE id = p_user_id;
  END IF;

  -- Mesaj insert
  INSERT INTO public.messages (room_id, sender_id, content, metadata)
  VALUES (p_room_id, p_user_id, v_clean, jsonb_build_object('glow_style', p_glow_style))
  RETURNING id INTO v_message_id;

  -- sp_transactions log (sadece consumable'da)
  IF v_cost > 0 THEN
    INSERT INTO public.sp_transactions (user_id, amount, type, description, external_ref)
    VALUES (p_user_id, -v_cost, 'powerup_glow_message',
            'Mesaj parlat — ' || p_glow_style, v_message_id::text);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'cost', v_cost,
    'is_premium', v_is_premium,
    'glow_style', p_glow_style,
    'message_id', v_message_id,
    'new_balance', v_balance - v_cost
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.powerup_send_glow_message(uuid, text, text, text) TO anon, authenticated;
