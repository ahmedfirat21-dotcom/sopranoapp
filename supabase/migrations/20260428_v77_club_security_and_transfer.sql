-- ════════════════════════════════════════════════════════════════════
-- v77 — Koro Güvenlik Sıkılaştırma + Sahiplik Devri (2026-04-28)
--
-- 1. attach_room_to_club RPC — owner/mod yetki kontrolü server-side
-- 2. detach_room_from_club RPC — owner/mod yetki kontrolü server-side
-- 3. transfer_club_ownership RPC — owner sahipliği başka üyeye devreder
--
-- ÖNCESİ:
--   services/clubs.ts attach/detach client-side yetki check yapıyordu.
--   Saldırgan REST API ile direkt INSERT/DELETE yapabiliyordu.
--   Owner sadece silebilirdi, devretme yoktu.
--
-- SONRASI:
--   3 RPC SECURITY DEFINER ile yetki check garantili.
--   Owner artık Koroyu kapatmadan başka üyeye devredebilir.
--
-- İdempotent — tekrar uygulanabilir.
-- ════════════════════════════════════════════════════════════════════

-- ─── 1) attach_room_to_club ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.attach_room_to_club(
  p_club_id UUID,
  p_room_id UUID,
  p_by_user_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_room_host TEXT;
BEGIN
  IF p_club_id IS NULL OR p_room_id IS NULL OR p_by_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid params';
  END IF;

  -- Yetki: çağıran owner veya moderatör mu
  SELECT role INTO v_role FROM public.club_members
  WHERE club_id = p_club_id AND user_id = p_by_user_id;

  IF v_role IS NULL OR v_role NOT IN ('owner', 'moderator') THEN
    RAISE EXCEPTION 'Yetki yok — sadece sahip ve moderatör oda bağlayabilir.';
  END IF;

  -- Ek güvenlik: bağlanan oda çağıranın kendi odası olmalı
  -- (Saldırgan başkasının odasını Korosuna ekleyemesin)
  SELECT host_id INTO v_room_host FROM public.rooms WHERE id = p_room_id;
  IF v_room_host IS NULL THEN
    RAISE EXCEPTION 'Oda bulunamadı.';
  END IF;
  IF v_room_host <> p_by_user_id THEN
    RAISE EXCEPTION 'Sadece kendi odanı bağlayabilirsin.';
  END IF;

  INSERT INTO public.club_rooms (club_id, room_id, created_at)
  VALUES (p_club_id, p_room_id, NOW())
  ON CONFLICT (club_id, room_id) DO NOTHING;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.attach_room_to_club TO authenticated;

-- ─── 2) detach_room_from_club ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.detach_room_from_club(
  p_club_id UUID,
  p_room_id UUID,
  p_by_user_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF p_club_id IS NULL OR p_room_id IS NULL OR p_by_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid params';
  END IF;

  SELECT role INTO v_role FROM public.club_members
  WHERE club_id = p_club_id AND user_id = p_by_user_id;

  IF v_role IS NULL OR v_role NOT IN ('owner', 'moderator') THEN
    RAISE EXCEPTION 'Yetki yok — sadece sahip ve moderatör oda bağlantısını kaldırabilir.';
  END IF;

  DELETE FROM public.club_rooms
  WHERE club_id = p_club_id AND room_id = p_room_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.detach_room_from_club TO authenticated;

-- ─── 3) transfer_club_ownership ────────────────────────────────────
-- Owner Koro sahipliğini başka bir üyeye devreder.
-- Eski owner otomatik 'moderator' rolüne düşer (Korodan ayrılmaz).
CREATE OR REPLACE FUNCTION public.transfer_club_ownership(
  p_club_id UUID,
  p_new_owner_id TEXT,
  p_by_user_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_owner TEXT;
  v_target_role TEXT;
BEGIN
  IF p_club_id IS NULL OR p_new_owner_id IS NULL OR p_by_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid params';
  END IF;

  IF p_new_owner_id = p_by_user_id THEN
    RAISE EXCEPTION 'Kendine devredemezsin.';
  END IF;

  -- Çağıran şu anki owner mı
  SELECT owner_id INTO v_current_owner FROM public.clubs WHERE id = p_club_id;
  IF v_current_owner IS NULL THEN
    RAISE EXCEPTION 'Koro bulunamadı.';
  END IF;
  IF v_current_owner <> p_by_user_id THEN
    RAISE EXCEPTION 'Yetki yok — sadece sahip devredebilir.';
  END IF;

  -- Hedef Koronun üyesi olmalı
  SELECT role INTO v_target_role FROM public.club_members
  WHERE club_id = p_club_id AND user_id = p_new_owner_id;
  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Yeni sahip Koronun üyesi olmalı.';
  END IF;

  -- Atomik devir: 3 satır UPDATE tek transaction'da
  -- a) clubs.owner_id güncelle
  UPDATE public.clubs SET owner_id = p_new_owner_id, updated_at = NOW()
  WHERE id = p_club_id;

  -- b) Eski owner → moderator
  UPDATE public.club_members SET role = 'moderator'
  WHERE club_id = p_club_id AND user_id = v_current_owner;

  -- c) Yeni owner → owner
  UPDATE public.club_members SET role = 'owner'
  WHERE club_id = p_club_id AND user_id = p_new_owner_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_club_ownership TO authenticated;

-- ─── 4) Bilgilendirme ─────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'v77: attach/detach/transfer RPC''leri kuruldu — Koro güvenliği sıkılaştırıldı.';
END $$;
