-- ════════════════════════════════════════════════════════════
-- v108 (4 May 2026): Giriş Efekti Sistemi + Çerçeve Kategorisi Genişletme
-- ════════════════════════════════════════════════════════════
--
-- 1. profiles.active_entry_effect — odaya girerken gösterilen Lottie animasyon
-- 2. equip_entry_effect RPC — entry efekt tak/çıkar
-- 3. equip_frame güncelleme — 'frames' kategorisini de destekler
-- 4. room_participants.entry_effect — katılımcının aktif giriş efekti (join anında kopyalanır)
-- ════════════════════════════════════════════════════════════

-- ── 1. Profil kolonları ──
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_entry_effect text DEFAULT NULL;

COMMENT ON COLUMN public.profiles.active_entry_effect IS 'Aktif giriş efekti cosmetic_items.id (message_art/entry_effect kategori)';

-- ── 2. room_participants'a entry_effect kolonu ──
ALTER TABLE public.room_participants
  ADD COLUMN IF NOT EXISTS entry_effect text DEFAULT NULL;

COMMENT ON COLUMN public.room_participants.entry_effect IS 'Katılımcının join anındaki giriş efekti (profiles.active_entry_effect kopyası)';

-- ── 3. equip_entry_effect RPC ──
CREATE OR REPLACE FUNCTION public.equip_entry_effect(
  p_user_id text,
  p_item_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item cosmetic_items%ROWTYPE;
BEGIN
  -- Çıkarma
  IF p_item_id IS NULL THEN
    UPDATE public.profiles SET active_entry_effect = NULL WHERE id = p_user_id;
    RETURN jsonb_build_object('success', true, 'active_entry_effect', NULL);
  END IF;

  -- Item validation
  SELECT * INTO v_item FROM public.cosmetic_items WHERE id = p_item_id AND active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Efekt bulunamadı');
  END IF;

  -- Kategori check: message_art VEYA entry_effect
  IF v_item.category NOT IN ('message_art', 'entry_effect') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bu ürün giriş efekti olarak kullanılamaz');
  END IF;

  -- Envanter check
  IF NOT EXISTS (
    SELECT 1 FROM public.user_inventory
     WHERE user_id = p_user_id AND item_id = p_item_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Bu efekti önce mağazadan satın al',
      'requires_purchase', true,
      'item_id', p_item_id
    );
  END IF;

  -- Equip
  UPDATE public.profiles SET active_entry_effect = p_item_id WHERE id = p_user_id;
  RETURN jsonb_build_object(
    'success', true,
    'active_entry_effect', p_item_id,
    'item_name', v_item.name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.equip_entry_effect(text, text) TO anon, authenticated;

-- ── 4. equip_frame — 'frames' kategorisini de destekle ──
CREATE OR REPLACE FUNCTION public.equip_frame(
  p_user_id text,
  p_item_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item cosmetic_items%ROWTYPE;
BEGIN
  -- Çıkarma
  IF p_item_id IS NULL THEN
    UPDATE public.profiles SET active_frame = NULL WHERE id = p_user_id;
    RETURN jsonb_build_object('success', true, 'active_frame', NULL);
  END IF;

  -- Item validation
  SELECT * INTO v_item FROM public.cosmetic_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Çerçeve bulunamadı');
  END IF;

  -- ★ v108: 'atelier' + 'frames' her ikisi de çerçeve olarak kabul edilir
  IF v_item.category NOT IN ('atelier', 'frames') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bu ürün çerçeve olarak kullanılamaz');
  END IF;

  -- Envanter check
  IF NOT EXISTS (
    SELECT 1 FROM public.user_inventory
     WHERE user_id = p_user_id AND item_id = p_item_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Bu çerçeveyi önce mağazadan satın al',
      'requires_purchase', true,
      'item_id', p_item_id
    );
  END IF;

  -- Equip
  UPDATE public.profiles SET active_frame = p_item_id WHERE id = p_user_id;
  RETURN jsonb_build_object(
    'success', true,
    'active_frame', p_item_id,
    'item_name', v_item.name
  );
END;
$$;

-- ── 5. Trigger: katılımcı odaya katılınca entry_effect kopyala ──
CREATE OR REPLACE FUNCTION public.copy_entry_effect_on_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Kullanıcının aktif giriş efektini room_participants'a kopyala
  NEW.entry_effect := (
    SELECT active_entry_effect
    FROM public.profiles
    WHERE id = NEW.user_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_copy_entry_effect ON public.room_participants;
CREATE TRIGGER trg_copy_entry_effect
  BEFORE INSERT ON public.room_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.copy_entry_effect_on_join();
