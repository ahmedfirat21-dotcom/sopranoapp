-- ════════════════════════════════════════════════════════════
-- v107 (3 May 2026): Maison Soprano mağaza — DB schema + seed
-- ════════════════════════════════════════════════════════════
--
-- HTML mockup birebir: sopranochat_luxury_store_redesign.html
-- Tablolar:
--   collections      — sezon koleksiyonları (La Rose Noir, Marina Royale vb)
--   cosmetic_items   — tüm satılık ürünler (showcase, gallery, profile, vb)
--   user_inventory   — kullanıcının sahip olduğu ürünler (M:N)
--
-- Render verisi tamamen DB'den okunur — store.tsx mock data'sı sonraki fazda kaldırılır.
-- ════════════════════════════════════════════════════════════

-- ─── collections ───
CREATE TABLE IF NOT EXISTS public.collections (
  id text PRIMARY KEY,
  name text NOT NULL,
  tag text,                       -- "12 PARÇA" / "SINIRLI" / "8 PARÇA" / "15 PARÇA"
  art_emoji text,
  art_color text,
  bg_gradient_start text,
  bg_gradient_end text,
  active bool DEFAULT true,
  display_order int DEFAULT 100,
  created_at timestamptz DEFAULT now()
);

-- ─── cosmetic_items ───
-- HTML mockup'taki tüm ürünler. category sütunu UI section'a maps eder:
--   atelier         → Atelier · Vitrin (showcase row)
--   message_art     → Galeri · Mesaj Sanatı (gallery grid)
--   profile         → Profil avatar/çerçeve
--   gift            → Hediyeler
--   room            → Salonlar (oda süslemeleri)
--   title           → Ünvanlar
--   boost           → Boost
CREATE TABLE IF NOT EXISTS public.cosmetic_items (
  id text PRIMARY KEY,                 -- slug (phoenix-diadem)
  category text NOT NULL,
  rarity text,                         -- divine / mythic / legendary / rare / new
  name text NOT NULL,                  -- "Phoenix Diadem"
  meta text,                           -- "Çerçeve · Animasyonlu"
  tagline text,                        -- featured items için
  art_emoji text,
  art_color text,
  bg_gradient_start text,
  bg_gradient_mid text,
  bg_gradient_end text,
  bg_radial text,                      -- "rgba(244,114,182,0.4)"
  price_sp int NOT NULL,
  per_message bool DEFAULT false,      -- mesaj sanatı (anlık tüketim, satın alma değil)
  is_featured bool DEFAULT false,      -- gallery featured kart (geniş, 2-col span)
  collection_id text REFERENCES public.collections(id),
  active bool DEFAULT true,
  display_order int DEFAULT 100,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cosmetic_items_category ON public.cosmetic_items (category, display_order);
CREATE INDEX IF NOT EXISTS idx_cosmetic_items_collection ON public.cosmetic_items (collection_id);

-- ─── user_inventory ───
CREATE TABLE IF NOT EXISTS public.user_inventory (
  user_id text NOT NULL,
  item_id text NOT NULL REFERENCES public.cosmetic_items(id) ON DELETE CASCADE,
  acquired_at timestamptz DEFAULT now(),
  acquired_via text DEFAULT 'purchase',  -- purchase / gift / reward / promo
  PRIMARY KEY (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_user_inventory_user ON public.user_inventory (user_id);

-- ─── RLS ───
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cosmetic_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "collections read" ON public.collections;
CREATE POLICY "collections read" ON public.collections FOR SELECT USING (true);

DROP POLICY IF EXISTS "cosmetic_items read" ON public.cosmetic_items;
CREATE POLICY "cosmetic_items read" ON public.cosmetic_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "user_inventory own read" ON public.user_inventory;
CREATE POLICY "user_inventory own read" ON public.user_inventory
  FOR SELECT USING (user_id = app_uid());

-- ─── store_purchase RPC ───
CREATE OR REPLACE FUNCTION public.store_purchase(
  p_user_id text,
  p_item_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.cosmetic_items%ROWTYPE;
  v_balance int;
BEGIN
  SELECT * INTO v_item FROM public.cosmetic_items WHERE id = p_item_id AND active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ürün bulunamadı');
  END IF;

  IF v_item.per_message THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bu ürün mesaj başına kullanılır, satın alınmaz');
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_inventory WHERE user_id = p_user_id AND item_id = p_item_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bu ürün zaten sahipsin', 'already_owned', true);
  END IF;

  SELECT COALESCE(system_points, 0) INTO v_balance FROM public.profiles WHERE id = p_user_id;
  IF v_balance < v_item.price_sp THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'Yetersiz SP',
      'required', v_item.price_sp, 'balance', v_balance
    );
  END IF;

  PERFORM set_config('app.sp_rpc_bypass', 'true', true);
  UPDATE public.profiles SET system_points = system_points - v_item.price_sp WHERE id = p_user_id;
  INSERT INTO public.user_inventory (user_id, item_id, acquired_via) VALUES (p_user_id, p_item_id, 'purchase');
  INSERT INTO public.sp_transactions (user_id, amount, type, description, external_ref)
    VALUES (p_user_id, -v_item.price_sp, 'store_purchase', v_item.name, p_item_id);

  RETURN jsonb_build_object(
    'success', true,
    'cost', v_item.price_sp,
    'item_name', v_item.name,
    'new_balance', v_balance - v_item.price_sp
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.store_purchase(text, text) TO anon, authenticated;

-- ════════════════════════════════════════════════════════════
-- SEED DATA — HTML mockup birebir
-- ════════════════════════════════════════════════════════════

-- Collections (4 sezon koleksiyonu)
INSERT INTO public.collections (id, name, tag, art_emoji, art_color, bg_gradient_start, bg_gradient_end, display_order)
VALUES
  ('la-rose-noir',  'La Rose Noir',       '12 PARÇA', '🌹', '#F472B6', '#1A0A1F', '#500724', 10),
  ('marina-royale', 'Marina Royale',      '8 PARÇA',  '⚓', '#60A5FA', '#0A1A2A', '#1E3A8A', 20),
  ('versailles',    'Versailles Édition', 'SINIRLI',  '⚜', '#FBBF24', '#1A1A0A', '#5C4612', 30),
  ('emeraude',      'Émeraude Forêt',     '15 PARÇA', '🦚', '#5EEAD4', '#0A1A1A', '#134E4A', 40)
ON CONFLICT (id) DO NOTHING;

-- Atelier · Vitrin (5 showcase ürünü)
INSERT INTO public.cosmetic_items
  (id, category, rarity, name, meta, art_emoji, art_color, bg_gradient_start, bg_gradient_mid, bg_gradient_end, bg_radial, price_sp, display_order)
VALUES
  ('phoenix-diadem', 'atelier', 'divine',    'Phoenix Diadem', 'Çerçeve · Animasyonlu',
   '👑', '#F472B6', '#1A0A1F', '#500724', '#831843', 'rgba(244,114,182,0.4)', 2500, 10),
  ('galactique',     'atelier', 'mythic',    'Galactique',     'Galaksi Çerçevesi',
   '🪐', '#C4B5FD', '#1A1330', '#4A2D7A', '#2D1B4E', 'rgba(255,215,0,0.4)',   1800, 20),
  ('aurum-strike',   'atelier', 'legendary', 'Aurum Strike',   'Giriş Efekti',
   '⚡', '#FBBF24', '#2A1E0D', '#854F0B', '#FBBF24', 'rgba(251,191,36,0.4)',  1200, 30),
  ('glacier-aura',   'atelier', 'rare',      'Glacier Aura',   'Buz Halesi',
   '❄️', '#22D3EE', '#0F1729', '#155E75', '#0E7490', 'rgba(34,211,238,0.3)',   800, 40),
  ('vesuvius',       'atelier', 'new',       'Vesuvius',       'Magma Çerçevesi',
   '🌋', '#FB923C', '#1A0A0A', '#7F1D1D', '#DC2626', 'rgba(220,38,38,0.4)',    950, 50)
ON CONFLICT (id) DO NOTHING;

-- Galeri · Mesaj Sanatı (5 ürün, biri featured)
-- per_message=true → satın alma değil, mesaj başına tüketim (powerup_send_glow_message tarzı)
INSERT INTO public.cosmetic_items
  (id, category, rarity, name, tagline, art_emoji, art_color, bg_gradient_start, bg_gradient_end, bg_radial, price_sp, per_message, is_featured, display_order)
VALUES
  ('constellation', 'message_art', 'divine',    'Constellation', 'Kelimeleriniz yıldızlar gibi parlasın',
   '✦', '#FBBF24', '#0F0A1A', '#1A0A0A', 'rgba(251,191,36,0.4)', 35, true, true, 10),
  ('or-ancien',     'message_art', 'legendary', 'Or Ancien',     NULL,
   '✨', '#FBBF24', '#1A1330', '#2D1B4E', 'rgba(251,191,36,0.3)', 12, true, false, 20),
  ('inferno',       'message_art', 'rare',      'Inferno',       NULL,
   '🔥', '#DC2626', '#0F0A0A', '#4A1818', 'rgba(220,38,38,0.3)',  18, true, false, 30),
  ('voltaire',      'message_art', 'rare',      'Voltaire',      NULL,
   '⚡', '#22D3EE', '#0F1729', '#1E3A5F', 'rgba(34,211,238,0.25)', 22, true, false, 40),
  ('belle-epoque',  'message_art', 'divine',    'Belle Époque',  NULL,
   '💗', '#F472B6', '#2A0A1F', '#500724', 'rgba(244,114,182,0.3)', 28, true, false, 50)
ON CONFLICT (id) DO NOTHING;
