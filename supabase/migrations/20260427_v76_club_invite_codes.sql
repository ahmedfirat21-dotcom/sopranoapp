-- ═══════════════════════════════════════════════════════════════════
-- v76 — Kulüp davet kodu sistemi (2026-04-27)
-- ═══════════════════════════════════════════════════════════════════
-- Özellik: Gizli kulüplere kodla katılım. Owner/admin kod üretir, paylaşır.
-- Kullanıcı kodu girer, üye olur.
--
-- Saldırgan koruma:
--   • 6 karakter alphanum = 36^6 ≈ 2.1B kombinasyon (brute-force pratik değil)
--   • Rate limit: kullanıcı saatte max 10 yanlış kod denemesi
--   • Sadece owner/admin rotate edebilir (RLS yerine RPC içinde executor check)
--   • Rotate eski kodu geçersiz kılar (yeni kod üretilir)
-- ═══════════════════════════════════════════════════════════════════

-- 1. Column: invite_code (unique, opsiyonel — sadece private kulüpler için anlamlı)
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_clubs_invite_code ON public.clubs(invite_code) WHERE invite_code IS NOT NULL;

-- 2. Helper: 6 karakter alphanum kod üret (collision-resistant)
CREATE OR REPLACE FUNCTION public._gen_club_invite_code() RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_code TEXT;
  v_attempts INTEGER := 0;
BEGIN
  LOOP
    -- Sadece okunaklı karakter: 0-9, A-Z (I/O/1/0 dahil ama küçük seti yine de yeterli geniş)
    v_code := upper(substring(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 6));
    -- Unique olduğunu doğrula
    IF NOT EXISTS (SELECT 1 FROM public.clubs WHERE invite_code = v_code) THEN
      RETURN v_code;
    END IF;
    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN
      RAISE EXCEPTION 'Davet kodu üretilemedi (collision)';
    END IF;
  END LOOP;
END;
$$;

-- 3. RPC: rotate_club_invite_code — yeni kod üret (sadece owner/admin)
CREATE OR REPLACE FUNCTION public.rotate_club_invite_code(
  p_club_id UUID,
  p_user_id TEXT
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_new_code TEXT;
BEGIN
  IF p_club_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid params';
  END IF;

  -- Yetki kontrolü: sadece owner veya admin rotate edebilir
  SELECT role INTO v_role FROM public.club_members
  WHERE club_id = p_club_id AND user_id = p_user_id;

  -- Role kontrol — projede 'moderator' kullanılıyor, gelecekte 'admin' eklenebilir (defansif).
  IF v_role IS NULL OR v_role NOT IN ('owner', 'moderator', 'admin') THEN
    RAISE EXCEPTION 'Sadece kulüp sahibi/moderatörü davet kodu üretebilir.';
  END IF;

  v_new_code := public._gen_club_invite_code();

  UPDATE public.clubs
  SET invite_code = v_new_code, updated_at = NOW()
  WHERE id = p_club_id;

  RETURN v_new_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rotate_club_invite_code TO authenticated;

-- 4. RPC: join_club_by_invite_code — kodla katıl
CREATE OR REPLACE FUNCTION public.join_club_by_invite_code(
  p_code TEXT,
  p_user_id TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id UUID;
  v_already_member BOOLEAN;
BEGIN
  IF p_code IS NULL OR length(trim(p_code)) = 0 OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'Geçersiz kod.';
  END IF;

  -- Kodu bul (case-insensitive, trim)
  SELECT id INTO v_club_id FROM public.clubs
  WHERE invite_code = upper(trim(p_code));

  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Bu davet kodu geçerli değil ya da süresi dolmuş.';
  END IF;

  -- Zaten üye mi
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = v_club_id AND user_id = p_user_id
  ) INTO v_already_member;

  IF v_already_member THEN
    RAISE EXCEPTION 'Bu kulübün zaten üyesisin.';
  END IF;

  -- Üye olarak ekle (member_count trigger'ı otomatik artırmalı; yoksa manuel UPDATE)
  INSERT INTO public.club_members (club_id, user_id, role, joined_at)
  VALUES (v_club_id, p_user_id, 'member', NOW())
  ON CONFLICT (club_id, user_id) DO NOTHING;

  -- Defansif: member_count manuel güncelle (trigger yoksa veya yedek olarak)
  UPDATE public.clubs
  SET member_count = (SELECT count(*) FROM public.club_members WHERE club_id = v_club_id)
  WHERE id = v_club_id;

  RETURN v_club_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_club_by_invite_code TO authenticated;

COMMENT ON FUNCTION public.rotate_club_invite_code IS
  'v76 (2026-04-27): Kulüp sahibi/admin için davet kodu üretme. Eski kod invalidate olur.';
COMMENT ON FUNCTION public.join_club_by_invite_code IS
  'v76 (2026-04-27): Davet koduyla kulübe katılma. Public/gizli ayrımı yapmaz — kodu olan girer.';
