-- ════════════════════════════════════════════════════════════
-- v92 (1 May 2026): Power-Ups — sarf güçlendiriciler
-- ════════════════════════════════════════════════════════════
--
-- SP kıymet döngüsü roadmap'inin son paketi. Kullanıcının "SP'm ne işime
-- yarayacak?" sorusuna anlık tüketim cevapları (mağaza yok prensibine
-- uyumlu — bu kalıcı edinim değil, anlık etki).
--
-- 4 power-up:
--   1. Süre Uzat (50 SP) — oda expires_at += 30 dk (Free host için)
--   2. Altın Davet (10 SP) — premium notification (sahneye gold invite)
--   3. Mesaj Parlat (25 SP) — sonraki 5 mesaj altın çerçeve  [planlandı]
--   4. Sahne Işığı (30 SP) — 10 dk avatar glow              [planlandı]
--
-- v92 sadece DB kolonları + 2 RPC (Süre Uzat + Altın Davet) içerir.
-- Render entegrasyonları (mesaj parlatma + avatar glow) post-launch.

-- ─── 0. Notifications type constraint — gold_invite ekle ───
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'like'::text, 'comment'::text, 'gift'::text, 'thank_you'::text,
    'follow'::text, 'reward'::text, 'follow_request'::text, 'follow_pending'::text,
    'follow_accepted'::text, 'follow_rejected'::text, 'missed_call'::text,
    'incoming_call'::text, 'room_live'::text, 'room_invite'::text,
    'room_invite_accepted'::text, 'room_invite_rejected'::text,
    'room_access_request'::text, 'event_reminder'::text, 'gold_invite'::text
  ]));

-- ─── 1. Süre Uzat RPC ───
-- Oda host'u SP harcayarak Free oda süresini 30 dk uzatabilir.
-- Plus/Pro odalarda zaten süre limiti yok → no-op.

CREATE OR REPLACE FUNCTION public.powerup_extend_room(
  p_room_id uuid,
  p_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cost int := 50;
  v_minutes int := 30;
  v_room rooms%ROWTYPE;
  v_balance int;
BEGIN
  -- Oda var mı, host kullanıcı mı?
  SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Oda bulunamadı');
  END IF;
  IF v_room.host_id IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sadece oda sahibi süreyi uzatabilir');
  END IF;
  IF NOT v_room.is_live THEN
    RETURN jsonb_build_object('success', false, 'error', 'Oda zaten kapalı');
  END IF;

  -- SP yeterli mi?
  SELECT COALESCE(system_points, 0) INTO v_balance FROM public.profiles WHERE id = p_user_id;
  IF v_balance < v_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Yetersiz SP', 'required', v_cost, 'balance', v_balance);
  END IF;

  -- SP düş + expires_at uzat (varsa onu, yoksa now() + 30dk)
  UPDATE public.profiles
    SET system_points = system_points - v_cost
    WHERE id = p_user_id;

  UPDATE public.rooms
    SET expires_at = COALESCE(expires_at, now()) + (v_minutes || ' minutes')::interval
    WHERE id = p_room_id;

  -- sp_transactions log
  INSERT INTO public.sp_transactions (user_id, amount, type, description, external_ref)
  VALUES (p_user_id, -v_cost, 'powerup_extend_room',
          'Süre uzatma — ' || v_minutes || ' dk', p_room_id::text);

  RETURN jsonb_build_object(
    'success', true,
    'cost', v_cost,
    'minutes_added', v_minutes,
    'new_expires_at', (SELECT expires_at FROM public.rooms WHERE id = p_room_id),
    'new_balance', v_balance - v_cost
  );
END;
$$;

-- ─── 2. Altın Davet RPC ───
-- Host bir dinleyiciyi sahneye altın bildirim ile çağırır (10 SP).
-- Notification tablosuna type='gold_invite' insert eder, alıcı premium ses+görsel ile uyarılır.

CREATE OR REPLACE FUNCTION public.powerup_gold_invite(
  p_room_id uuid,
  p_sender_id text,
  p_target_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cost int := 10;
  v_balance int;
  v_room rooms%ROWTYPE;
BEGIN
  IF p_sender_id = p_target_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kendine davet gönderemezsin');
  END IF;
  SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id;
  IF NOT FOUND OR NOT v_room.is_live THEN
    RETURN jsonb_build_object('success', false, 'error', 'Oda aktif değil');
  END IF;

  SELECT COALESCE(system_points, 0) INTO v_balance FROM public.profiles WHERE id = p_sender_id;
  IF v_balance < v_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Yetersiz SP', 'required', v_cost, 'balance', v_balance);
  END IF;

  UPDATE public.profiles
    SET system_points = system_points - v_cost
    WHERE id = p_sender_id;

  -- Notification — alıcı premium ses+görsel ile alır
  INSERT INTO public.notifications (user_id, sender_id, type, body, reference_id)
  VALUES (p_target_id, p_sender_id, 'gold_invite',
          'Sahneye altın davet aldın!', p_room_id::text);

  INSERT INTO public.sp_transactions (user_id, amount, type, description, counterparty_id, external_ref)
  VALUES (p_sender_id, -v_cost, 'powerup_gold_invite',
          'Altın davet', p_target_id, p_room_id::text);

  RETURN jsonb_build_object(
    'success', true,
    'cost', v_cost,
    'new_balance', v_balance - v_cost
  );
END;
$$;
