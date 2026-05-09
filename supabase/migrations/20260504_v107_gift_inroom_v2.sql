-- ════════════════════════════════════════════════════════════
-- v107 hotfix (4 May 2026): Sembol Hediye — Oda İçi Akış v2
-- ════════════════════════════════════════════════════════════
-- Eski send_symbol_gift sadece DM bildirim atıyordu. Yeni sürüm:
--   1. notifications insert (bell — eski davranış korundu)
--   2. room_live_gifts insert (oda kaydı + leaderboard veri kaynağı)
--   3. messages insert type='gift_system' (oda sohbetinde sistem mesajı)
--      Realtime postgres_changes ile RoomChatDrawer otomatik render eder.
--   4. JSON response — client floating animasyon overlay'i için tüm veriyi döner
--
-- p_room_id NULL ise sadece DM bildirim (profil sayfasından gönderim akışı).
-- p_room_id varsa tüm 4 efekt birden tetiklenir.
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
  v_notif_id uuid;
  v_log_id uuid;
  v_msg_id uuid;
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

  -- Sender envanterinde var mı
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

  -- Recipient kontrolü
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_recipient_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Alıcı bulunamadı');
  END IF;

  SELECT COALESCE(display_name, 'Birisi') INTO v_sender_name
    FROM public.profiles WHERE id = p_sender_id;
  SELECT COALESCE(display_name, 'Kullanıcı') INTO v_recipient_name
    FROM public.profiles WHERE id = p_recipient_id;

  -- ── 1. Notifications (bell) — alıcı bildirimi
  INSERT INTO public.notifications (
    user_id, type, body, sender_id, created_at
  ) VALUES (
    p_recipient_id,
    'symbol_gift',
    p_item_id || '|' || v_item.name || '|' || COALESCE(v_item.art_emoji, '✨'),
    p_sender_id,
    NOW()
  ) RETURNING id INTO v_notif_id;

  -- ── 2. room_live_gifts — leaderboard + vitrin için kalıcı kayıt
  INSERT INTO public.room_live_gifts (
    room_id, sender_id, receiver_id, gift_id, amount, created_at
  ) VALUES (
    p_room_id,           -- NULL ise oda dışı (profil sayfası gönderimi)
    p_sender_id,
    p_recipient_id,
    p_item_id,
    v_item.price_sp,     -- amount = SP değeri (leaderboard topla için)
    NOW()
  ) RETURNING id INTO v_log_id;

  -- ── 3. messages (oda sohbeti sistem mesajı) — yalnız oda içiyse
  IF p_room_id IS NOT NULL THEN
    INSERT INTO public.messages (
      sender_id, receiver_id, room_id, type, content, metadata, created_at
    ) VALUES (
      p_sender_id,
      NULL,                    -- room broadcast (DM değil)
      p_room_id,
      'gift_system',
      v_sender_name || ' → ' || v_recipient_name || ' • ' || v_item.name,
      jsonb_build_object(
        'gift_id',      p_item_id,
        'item_name',    v_item.name,
        'art_emoji',    COALESCE(v_item.art_emoji, '✨'),
        'art_color',    COALESCE(v_item.art_color, '#FBBF24'),
        'price_sp',     v_item.price_sp,
        'sender_id',    p_sender_id,
        'sender_name',  v_sender_name,
        'recipient_id', p_recipient_id,
        'recipient_name', v_recipient_name
      ),
      NOW()
    ) RETURNING id INTO v_msg_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'notification_id', v_notif_id,
    'log_id', v_log_id,
    'message_id', v_msg_id,
    'item_id', p_item_id,
    'item_name', v_item.name,
    'art_emoji', COALESCE(v_item.art_emoji, '✨'),
    'art_color', COALESCE(v_item.art_color, '#FBBF24'),
    'price_sp', v_item.price_sp,
    'sender_name', v_sender_name,
    'recipient_name', v_recipient_name,
    'in_room', (p_room_id IS NOT NULL)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_symbol_gift(text, text, text, uuid) TO anon, authenticated;

-- Eski 3-arg versiyonunu DROP (overload temizliği — feedback_rpc_overload_audit)
DROP FUNCTION IF EXISTS public.send_symbol_gift(text, text, text);
