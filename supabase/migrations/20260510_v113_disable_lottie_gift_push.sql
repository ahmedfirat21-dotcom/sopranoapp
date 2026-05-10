-- ════════════════════════════════════════════════════════════════════
-- v113: Lottie hediye push + zil bildirimini kapat
-- ════════════════════════════════════════════════════════════════════
-- Sorun: Oda içinde gönderilen Lottie hediyeleri (gift kategorisi —
--   gift-rose, gift-crown vb.) hem push notification atıyor hem de
--   "notifications" tablosuna kayıt giriyor (zil drawer'ında görünüyor).
--   Kullanıcı talebi: bunlar oda içinde animasyon olarak görünüyor zaten,
--   bildirim ziline veya push'a yansımasınlar.
--
-- Düzeltme:
--   1. trg_notify_gift trigger'ı DROP — Lottie hediyede push GÖNDERİLMESİN
--   2. send_symbol_gift RPC'den notifications insert kaldır — zilde
--      gözükmesin
--
-- Not: SP/para transferleri ayrı bir akış, bu trigger sadece
--   room_live_gifts (Lottie hediye) tetikliyordu.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Push trigger'ı kaldır ────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_notify_gift ON public.room_live_gifts;
DROP FUNCTION IF EXISTS public.notify_gift_received();

-- ── 2. send_symbol_gift RPC'sini güncelle (notifications insert kaldır) ──
CREATE OR REPLACE FUNCTION public.send_symbol_gift(
  p_sender_id text,
  p_recipient_id text,
  p_item_id text,
  p_room_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_item cosmetic_items%ROWTYPE;
  v_sender_name text;
  v_recipient_name text;
  v_sender_donatable int;
  v_log_id uuid;
  v_msg_id uuid;
  v_recipient_gain int;
BEGIN
  -- Trigger bypass — bu RPC'nin kontrollü UPDATE yapmasına izin ver
  PERFORM set_config('app.sp_rpc_bypass', 'true', true);

  IF p_sender_id = p_recipient_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kendine hediye gönderemezsin');
  END IF;

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

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_recipient_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Alıcı bulunamadı');
  END IF;

  SELECT COALESCE(donatable_sp, 0) INTO v_sender_donatable
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

  v_recipient_gain := v_item.price_sp / 2;

  -- Sender düşümü
  UPDATE public.profiles
    SET donatable_sp  = GREATEST(COALESCE(donatable_sp, 0) - v_item.price_sp, 0),
        system_points = GREATEST(COALESCE(system_points, 0) - v_item.price_sp, 0)
  WHERE id = p_sender_id;

  -- Recipient kazancı
  UPDATE public.profiles
    SET system_points = GREATEST(COALESCE(system_points, 0) + v_recipient_gain, 0)
  WHERE id = p_recipient_id;

  -- Tx log
  INSERT INTO public.sp_transactions (user_id, amount, type, description)
  VALUES
    (p_sender_id, -v_item.price_sp, 'gift_sent',     'Hediye gönderildi: ' || v_item.name),
    (p_recipient_id, v_recipient_gain, 'gift_received', 'Hediye alındı: ' || v_item.name);

  SELECT COALESCE(display_name, 'Birisi') INTO v_sender_name
    FROM public.profiles WHERE id = p_sender_id;
  SELECT COALESCE(display_name, 'Kullanıcı') INTO v_recipient_name
    FROM public.profiles WHERE id = p_recipient_id;

  -- ★ v113: notifications insert KALDIRILDI — Lottie hediyeler ziline düşmesin
  -- (Oda içinde animasyon ve gift_system mesajı zaten gösteriliyor)

  -- Log + room broadcast — bunlar oda içi UI için, bildirim değil
  INSERT INTO public.room_live_gifts (room_id, sender_id, receiver_id, gift_id, amount, created_at)
  VALUES (p_room_id, p_sender_id, p_recipient_id, p_item_id, v_item.price_sp, NOW())
  RETURNING id INTO v_log_id;

  IF p_room_id IS NOT NULL THEN
    INSERT INTO public.messages (
      sender_id, receiver_id, room_id, type, content, metadata, created_at
    ) VALUES (
      p_sender_id, NULL, p_room_id, 'gift_system',
      v_sender_name || ' → ' || v_recipient_name || ' • ' || v_item.name,
      jsonb_build_object(
        'gift_id', p_item_id, 'item_name', v_item.name,
        'art_emoji', COALESCE(v_item.art_emoji, '✨'),
        'art_color', COALESCE(v_item.art_color, '#FBBF24'),
        'price_sp', v_item.price_sp,
        'sender_id', p_sender_id, 'sender_name', v_sender_name,
        'recipient_id', p_recipient_id, 'recipient_name', v_recipient_name
      ),
      NOW()
    ) RETURNING id INTO v_msg_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'log_id', v_log_id, 'message_id', v_msg_id,
    'item_id', p_item_id, 'item_name', v_item.name,
    'art_emoji', COALESCE(v_item.art_emoji, '✨'),
    'art_color', COALESCE(v_item.art_color, '#FBBF24'),
    'price_sp', v_item.price_sp, 'recipient_gain', v_recipient_gain,
    'sender_name', v_sender_name, 'recipient_name', v_recipient_name,
    'in_room', (p_room_id IS NOT NULL)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.send_symbol_gift(text, text, text, uuid) TO anon, authenticated;
