-- ════════════════════════════════════════════════════════════
-- v108.3 (4 May 2026): Hediye modeli — TikTok/Bigo paritesi
-- ════════════════════════════════════════════════════════════
-- ESKİ: Sahip ol + sınırsız gönder (envanter check, sembolik)
-- YENİ: Tek seferlik ücret — her gönderim sender'dan SP düşer
--   • Sender: -price_sp (donatable_sp + system_points)
--   • Recipient: +price_sp/2 (sadece system_points; donatable_sp ARTMAZ —
--     para döngüsü/laundering önlemi: alıcı bu SP'yi başkasına gönderemez,
--     sadece mağaza alımında kullanabilir)
--   • %50 yanar (platform deflasyon)
--   • Leaderboard kaydı: amount = price_sp (gönderim değeri)
--
-- Envanter mantığı kaldırıldı — user_inventory'deki gift kayıtları sahibinde
-- kalır ama artık önemsiz; frame koleksiyonu için tablo kullanılmaya devam.
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.send_symbol_gift(
  p_sender_id text,
  p_recipient_id text,
  p_item_id text,
  p_room_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item cosmetic_items%ROWTYPE;
  v_sender_name text;
  v_recipient_name text;
  v_sender_donatable int;
  v_sender_total int;
  v_notif_id uuid;
  v_log_id uuid;
  v_msg_id uuid;
  v_recipient_gain int;
BEGIN
  -- Aynı kişiye gönderim engelle
  IF p_sender_id = p_recipient_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kendine hediye gönderemezsin');
  END IF;

  -- Item kontrolü
  SELECT * INTO v_item FROM public.cosmetic_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sembol bulunamadı');
  END IF;
  IF v_item.category <> 'gift' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bu ürün hediye olarak gönderilemez');
  END IF;
  IF v_item.active IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bu sembol artık satışta değil');
  END IF;

  -- Recipient kontrolü
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_recipient_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Alıcı bulunamadı');
  END IF;

  -- Sender SP yeterliliği
  SELECT COALESCE(donatable_sp, 0), COALESCE(system_points, 0)
    INTO v_sender_donatable, v_sender_total
    FROM public.profiles WHERE id = p_sender_id;
  IF v_sender_donatable < v_item.price_sp THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Yetersiz SP — bu hediyeyi göndermek için ' || v_item.price_sp || ' SP gerekli',
      'insufficient_sp', true,
      'required', v_item.price_sp,
      'available', v_sender_donatable
    );
  END IF;

  -- ── 1) SP düş (sender) — donatable + total
  UPDATE public.profiles
    SET donatable_sp = donatable_sp - v_item.price_sp,
        system_points = system_points - v_item.price_sp
  WHERE id = p_sender_id;

  -- ── 2) SP ekle (recipient) — sadece system_points, donatable_sp ARTMAZ
  v_recipient_gain := v_item.price_sp / 2;
  UPDATE public.profiles
    SET system_points = system_points + v_recipient_gain
  WHERE id = p_recipient_id;

  SELECT COALESCE(display_name, 'Birisi') INTO v_sender_name
    FROM public.profiles WHERE id = p_sender_id;
  SELECT COALESCE(display_name, 'Kullanıcı') INTO v_recipient_name
    FROM public.profiles WHERE id = p_recipient_id;

  -- ── 3) Notifications (bell)
  INSERT INTO public.notifications (
    user_id, type, body, sender_id, created_at
  ) VALUES (
    p_recipient_id,
    'symbol_gift',
    p_item_id || '|' || v_item.name || '|' || COALESCE(v_item.art_emoji, '✨'),
    p_sender_id,
    NOW()
  ) RETURNING id INTO v_notif_id;

  -- ── 4) room_live_gifts — leaderboard kaydı
  INSERT INTO public.room_live_gifts (
    room_id, sender_id, receiver_id, gift_id, amount, created_at
  ) VALUES (
    p_room_id, p_sender_id, p_recipient_id, p_item_id, v_item.price_sp, NOW()
  ) RETURNING id INTO v_log_id;

  -- ── 5) messages (oda sohbeti sistem mesajı)
  IF p_room_id IS NOT NULL THEN
    INSERT INTO public.messages (
      sender_id, receiver_id, room_id, type, content, metadata, created_at
    ) VALUES (
      p_sender_id,
      NULL,
      p_room_id,
      'gift_system',
      v_sender_name || ' → ' || v_recipient_name || ' • ' || v_item.name,
      jsonb_build_object(
        'gift_id',        p_item_id,
        'item_name',      v_item.name,
        'art_emoji',      COALESCE(v_item.art_emoji, '✨'),
        'art_color',      COALESCE(v_item.art_color, '#FBBF24'),
        'price_sp',       v_item.price_sp,
        'sender_id',      p_sender_id,
        'sender_name',    v_sender_name,
        'recipient_id',   p_recipient_id,
        'recipient_name', v_recipient_name
      ),
      NOW()
    ) RETURNING id INTO v_msg_id;
  END IF;

  RETURN jsonb_build_object(
    'success',         true,
    'notification_id', v_notif_id,
    'log_id',          v_log_id,
    'message_id',      v_msg_id,
    'item_id',         p_item_id,
    'item_name',       v_item.name,
    'art_emoji',       COALESCE(v_item.art_emoji, '✨'),
    'art_color',       COALESCE(v_item.art_color, '#FBBF24'),
    'price_sp',        v_item.price_sp,
    'recipient_gain',  v_recipient_gain,
    'sender_name',     v_sender_name,
    'recipient_name',  v_recipient_name,
    'in_room',         (p_room_id IS NOT NULL)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_symbol_gift(text, text, text, uuid) TO anon, authenticated;
