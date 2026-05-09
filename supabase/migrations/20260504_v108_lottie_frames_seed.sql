-- ════════════════════════════════════════════════════════════
-- v108 (4 May 2026): Lottie Animasyonlu Çerçeveler — 6 yeni
-- ════════════════════════════════════════════════════════════
-- assets/avatar_frames/*.json içindeki halka tarzı Lottie animasyonları
-- mağaza "Çerçeveler" bölümüne yeni avatar çerçevesi olarak eklenir.
-- frameLottieRegistry.ts (id → require) bu ID'lere bağlı.
--
-- Mevcut 5 LinearGradient çerçeve korunur (phoenix-diadem, galactique,
-- aurum-strike, glacier-aura, vesuvius); bunlar Lottie'siz kalır.
-- ════════════════════════════════════════════════════════════

INSERT INTO public.cosmetic_items (
  id, category, rarity, name, meta, tagline, art_emoji, art_color,
  bg_gradient_start, bg_gradient_mid, bg_gradient_end,
  price_sp, per_message, is_featured, display_order, active
) VALUES
  ('aurelius',         'frames', 'legendary', 'Aurelius',          'ALTIN HALKA · ANIMÉ',     'Saf altın, hep dönen.',           '◉', '#FFE082', '#1A1500', '#5C4612', '#854F0B', 1500, false, true,  60, true),
  ('lunaris',          'frames', 'rare',      'Lunaris',           'GÜMÜŞ HALKA · ANIMÉ',    'Ay parıltısı.',                    '◐', '#E2E8F0', '#0F172A', '#334155', '#475569', 1000, false, false, 70, true),
  ('rose-eternel',     'frames', 'mythic',    'Rose Éternel',      'GÜL HALKA · SONSUZ',     'Solmayan çiçek.',                  '❀', '#F472B6', '#1A0518', '#831843', '#BE185D', 1800, false, false, 75, true),
  ('cadence-soprano',  'frames', 'mythic',    'Cadence Soprano',   'PREMIUM · İMZA',         'Maison imzalı çerçeve.',           '✦', '#C4B5FD', '#0A0518', '#1E1B4B', '#312E81', 2200, false, true,  80, true),
  ('lumiere-divine',   'frames', 'divine',    'Lumière Divine',    'IŞIK HALKA · İLAHİ',     'Ne taç, ne çerçeve — ışık.',       '☼', '#FDE68A', '#1A1500', '#92400E', '#B45309', 2800, false, true,  85, true),
  ('spectrum-orbit',   'frames', 'new',       'Spectrum Orbit',    'YENİ · DÖNGÜ',           'Yörünge gibi sürekli hareket.',    '◌', '#22D3EE', '#001A1F', '#0E4A52', '#155E75',  900, false, false, 90, true)
ON CONFLICT (id) DO UPDATE SET
  name              = EXCLUDED.name,
  meta              = EXCLUDED.meta,
  tagline           = EXCLUDED.tagline,
  rarity            = EXCLUDED.rarity,
  art_emoji         = EXCLUDED.art_emoji,
  art_color         = EXCLUDED.art_color,
  bg_gradient_start = EXCLUDED.bg_gradient_start,
  bg_gradient_mid   = EXCLUDED.bg_gradient_mid,
  bg_gradient_end   = EXCLUDED.bg_gradient_end,
  price_sp          = EXCLUDED.price_sp,
  is_featured       = EXCLUDED.is_featured,
  display_order     = EXCLUDED.display_order,
  active            = true;
