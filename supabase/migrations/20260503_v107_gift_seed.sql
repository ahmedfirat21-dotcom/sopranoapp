-- ════════════════════════════════════════════════════════════
-- v107 (3 May 2026): Hediyeler kategorisi seed — 9 sembol ürünü
-- ════════════════════════════════════════════════════════════
--
-- Mevcut Atelier/Mesaj Sanatı 3D illustration'ları paylaşılır
-- (ILLUSTRATIONS map'inde alias var). Frame ve renkler aynı kalite.
-- Fiyatlar Atelier (1200+ SP) ve Mesaj Sanatı (12-35 SP) arasında —
-- arkadaşa anlık atılabilen küçük lüks.
-- ════════════════════════════════════════════════════════════

INSERT INTO public.cosmetic_items (
  id, category, rarity, name, meta, art_emoji, art_color,
  bg_gradient_start, bg_gradient_mid, bg_gradient_end,
  price_sp, per_message, is_featured
) VALUES
  ('gift-bolt',    'gift', 'legendary', 'Şimşek',         'ANLIK · ALTIN ÇARP',   '⚡',  '#FFE082', '#1A1500', '#5C4612', '#854F0B',  50, false, false),
  ('gift-snow',    'gift', 'rare',      'Kar Tanesi',     'BUZ · CYAN PARIL',     '❄️',  '#22D3EE', '#001A1F', '#0E4A52', '#155E75',  30, false, false),
  ('gift-volcano', 'gift', 'mythic',    'Vesuvius',       'VOLKAN · KOR',         '🌋',  '#DC2626', '#1F0500', '#5C1A0B', '#7C2D12',  75, false, false),
  ('gift-star',    'gift', 'rare',      'Or Ancien',      'YILDIZ · ALTIN',       '✦',  '#FFE082', '#1A1500', '#5C4612', '#854F0B',  25, false, false),
  ('gift-sparkle', 'gift', 'mythic',    'Constellation',  'TARLA · ALTIN',        '✨',  '#FBBF24', '#0A0518', '#1E1B4B', '#312E81', 100, false, true),
  ('gift-fire',    'gift', 'legendary', 'Inferno',        'ALEV · TURUNCU',       '🔥',  '#FB923C', '#1F0500', '#7F1D1D', '#B91C1C',  60, false, false),
  ('gift-heart',   'gift', 'rare',      'Belle Cœur',     'KALP · MAGENTA',       '💗',  '#F472B6', '#1A0518', '#831843', '#BE185D',  40, false, false),
  ('gift-rose',    'gift', 'legendary', 'Rose Noire',     'GÜL · KOYU',           '🌹',  '#F472B6', '#0A0218', '#500724', '#831843',  55, false, false),
  ('gift-anchor',  'gift', 'rare',      'Marina',         'ÇAPA · DENİZ',         '⚓',  '#60A5FA', '#001A2E', '#0C4A6E', '#075985',  65, false, false)
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
  is_featured       = EXCLUDED.is_featured;
