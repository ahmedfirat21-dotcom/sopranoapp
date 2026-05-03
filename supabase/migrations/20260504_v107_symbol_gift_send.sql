-- ════════════════════════════════════════════════════════════
-- v107 (4 May 2026): Sembol Hediye Gönderme
-- ════════════════════════════════════════════════════════════
-- Mağazadan satın alınmış gift kategorisindeki sembolleri (Şimşek, Kar
-- Tanesi, Vesuvius vb.) arkadaşa gönderme. Envanter düşmez (kalıcı sahip),
-- sadece bildirim ve ekran animasyonu — pure cosmetic publicity.
--
-- Receiver: notifications tablosuna 'symbol_gift' tip insert + GiftRT
-- realtime kanalı bunu yakalayıp ekrana floating animasyon getirir.
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.send_symbol_gift(
  p_sender_id text,
  p_recipient_id text,
  p_item_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item cosmetic_items%ROWTYPE;
  v_sender_name text;
  v_notif_id uuid;
BEGIN
  -- Aynı kişiye gönderim engelle
  IF p_sender_id = p_recipient_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kendine hediye gönderemezsin');
  END IF;

  -- Item'in gift kategorisinde olduğunu doğrula
  SELECT * INTO v_item FROM public.cosmetic_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sembol bulunamadı');
  END IF;
  IF v_item.category <> 'gift' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bu ürün hediye olarak gönderilemez');
  END IF;

  -- Sender envanterinde var mı kontrol
  IF NOT EXISTS (
    SELECT 1 FROM public.user_inventory
     WHERE user_id = p_sender_id AND item_id = p_item_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Bu sembolü önce mağazadan satın al',
      'requires_purchase', true,
      'item_id', p_item_id
    );
  END IF;

  -- Recipient profilinin var olduğunu doğrula
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_recipient_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Alıcı bulunamadı');
  END IF;

  -- Sender display_name al (notif body için)
  SELECT COALESCE(display_name, 'Birisi') INTO v_sender_name
    FROM public.profiles WHERE id = p_sender_id;

  -- Notification insert — receiver realtime ile yakalar
  INSERT INTO public.notifications (
    user_id, type, body, sender_id, created_at
  ) VALUES (
    p_recipient_id,
    'symbol_gift',
    -- Body format: "<item_id>|<item_name>|<art_emoji>" — receiver parse eder
    p_item_id || '|' || v_item.name || '|' || COALESCE(v_item.art_emoji, '✨'),
    p_sender_id,
    NOW()
  ) RETURNING id INTO v_notif_id;

  RETURN jsonb_build_object(
    'success', true,
    'notification_id', v_notif_id,
    'item_id', p_item_id,
    'item_name', v_item.name,
    'sender_name', v_sender_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_symbol_gift(text, text, text) TO anon, authenticated;
