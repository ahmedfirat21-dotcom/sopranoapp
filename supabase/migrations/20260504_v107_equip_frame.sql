-- ════════════════════════════════════════════════════════════
-- v107 (4 May 2026): Çerçeve takma/çıkarma RPC
-- ════════════════════════════════════════════════════════════
-- Atelier kategorisindeki ürünler (Phoenix Diadem, Galactique, Aurum Strike,
-- Glacier Aura, Vesuvius) profilde avatar çerçevesi olarak kullanılır.
-- profiles.active_frame zaten kolon olarak var (text, item_id ya da NULL).
--
-- equip_frame(user_id, item_id):
--   - item_id NULL → çıkarma (active_frame=NULL)
--   - item_id verili → envanter check + atelier kategori check + UPDATE
-- ════════════════════════════════════════════════════════════

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
  IF v_item.category <> 'atelier' THEN
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

GRANT EXECUTE ON FUNCTION public.equip_frame(text, text) TO anon, authenticated;
