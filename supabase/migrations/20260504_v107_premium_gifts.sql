-- ════════════════════════════════════════════════════════════
-- v107 (4 May 2026): Premium Lottie Hediyeler
-- ════════════════════════════════════════════════════════════
-- assets/avatar_frames/*.json içindeki zengin Lottie animasyonları
-- yeni premium hediye olarak eklenir. Bigo/TikTok seviyesinde "wow" efekt.
--
-- Mevcut 9 hediye = klasik (25-100 SP)
-- Yeni 7 hediye = premium (150-1000 SP) — pahalı + animasyon dolu
-- ════════════════════════════════════════════════════════════

INSERT INTO public.cosmetic_items (
  id, category, rarity, name, meta, art_emoji, art_color,
  bg_gradient_start, bg_gradient_mid, bg_gradient_end,
  price_sp, per_message, is_featured, display_order, active
) VALUES
  ('gift-cake',    'gift', 'rare',      'Pasta',       'KUTLAMA · 3D',          '🎂',  '#FCA5A5', '#1F0500', '#7F1D1D', '#DC2626',  35, false, false, 35, true),
  ('gift-trophy',  'gift', 'legendary', 'Kupa',        'ZAFER · ALTIN',         '🏆',  '#FBBF24', '#1A1500', '#5C4612', '#854F0B', 150, false, false, 100, true),
  ('gift-diamond', 'gift', 'mythic',    'Elmas',       'PIRLANTA · KIRMIZI',    '💎',  '#F87171', '#1A0000', '#5C0B0B', '#7F1D1D', 200, false, false, 110, true),
  ('gift-perfume', 'gift', 'legendary', 'Parfüm',      'ŞIK · ALTIN',           '🪔',  '#FBBF24', '#1A1330', '#2D1B4E', '#4A2D7A', 180, false, false, 105, true),
  ('gift-dragon',  'gift', 'divine',    'Ejderha',     'EFSANE · ATEŞ',         '🐉',  '#DC2626', '#1F0500', '#7F1D1D', '#B91C1C', 500, false, true,  120, true),
  ('gift-rocket',  'gift', 'legendary', 'Roket',       'FÜZE · MAVİ',           '🚀',  '#60A5FA', '#001A2E', '#0C4A6E', '#1E3A8A', 250, false, false, 115, true),
  ('gift-car',     'gift', 'mythic',    'Spor Araba',  'LÜKS · KIRMIZI',        '🏎️',  '#EF4444', '#1F0500', '#5C1A0B', '#7F1D1D', 1000, false, true,  130, true)
ON CONFLICT (id) DO UPDATE SET
  name              = EXCLUDED.name,
  meta              = EXCLUDED.meta,
  rarity            = EXCLUDED.rarity,
  art_emoji         = EXCLUDED.art_emoji,
  art_color         = EXCLUDED.art_color,
  bg_gradient_start = EXCLUDED.bg_gradient_start,
  bg_gradient_mid   = EXCLUDED.bg_gradient_mid,
  bg_gradient_end   = EXCLUDED.bg_gradient_end,
  price_sp          = EXCLUDED.price_sp,
  display_order     = EXCLUDED.display_order,
  is_featured       = EXCLUDED.is_featured,
  active            = true;

-- gift-rose'u da geri etkinleştir (Rose1.json çok güzel animasyon, deactive olmasın)
UPDATE public.cosmetic_items SET active = true WHERE id = 'gift-rose';
