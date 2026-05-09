-- ════════════════════════════════════════════════════════════
-- v108 (4 May 2026): Clubhouse Tarzı Hediye Koleksiyonu — 18 yeni sembol
-- ════════════════════════════════════════════════════════════
-- Lottie animasyonları + PNG ikonları indirildi:
--   assets/avatar_frames/*.json  (Lottie → RoomGiftAnimationOverlay)
--   assets/store/items/gift-*.png (PNG → mağaza grid)
--
-- Fiyat piramidi:
--   10-50 SP  : Gündelik hediyeler (confetti, balloon, love letter)
--   50-150 SP : Orta seviye (butterfly, guitar, teddy, sunglasses)
--   150-500 SP: Premium (crown, castle, airplane, unicorn)
--   500+ SP   : Ultra premium (gem, money rain)
-- ════════════════════════════════════════════════════════════

INSERT INTO public.cosmetic_items (
  id, category, rarity, name, meta, art_emoji, art_color,
  bg_gradient_start, bg_gradient_mid, bg_gradient_end,
  price_sp, per_message, is_featured, display_order, active
) VALUES
  -- ── Gündelik Hediyeler (10-50 SP) ──
  ('gift-confetti',   'gift', 'new',       'Konfeti',        'PARTİ · RENGARENK',   '🎊', '#FB923C', '#1A1500', '#5C4612', '#854F0B',    15, false, false, 200, true),
  ('gift-balloon',    'gift', 'new',       'Balon',          'UÇAN · RENKLİ',       '🎈', '#F472B6', '#1A0518', '#500724', '#831843',    20, false, false, 201, true),
  ('gift-love',       'gift', 'rare',      'Aşk Mektubu',   'MEKTUP · KALP',       '💌', '#F472B6', '#1A0518', '#831843', '#BE185D',    25, false, false, 202, true),
  ('gift-celebrate',  'gift', 'new',       'Kutlama',        'ŞENLİK · IŞIK',       '🥳', '#FBBF24', '#1A1500', '#5C4612', '#854F0B',   30, false, false, 203, true),
  ('gift-kiss',       'gift', 'rare',      'Öpücük',         'DUDAK · PEMBE',       '💋', '#F472B6', '#2A0A1F', '#500724', '#831843',    35, false, false, 204, true),
  ('gift-sparkles',   'gift', 'new',       'Parıltı',        'IŞILTI · MAVİ',       '✨', '#60A5FA', '#001A2E', '#0C4A6E', '#1E3A8A',   20, false, false, 205, true),
  ('gift-shooting',   'gift', 'rare',      'Kayan Yıldız',   'YILDIZ · ALTIN',      '🌠', '#FBBF24', '#0A0518', '#1E1B4B', '#312E81',   40, false, false, 206, true),

  -- ── Orta Seviye (50-150 SP) ──
  ('gift-teddy',      'gift', 'rare',      'Oyuncak Ayı',    'SEVİMLİ · YUMUŞAK',   '🧸', '#D4A574', '#1A0F00', '#5C3A12', '#854F0B',   65, false, false, 210, true),
  ('gift-butterfly',  'gift', 'legendary', 'Kelebek',        'SİHİRLİ · MOR',       '🦋', '#A855F7', '#1A0A2E', '#4A2D7A', '#6D28D9',   80, false, false, 211, true),
  ('gift-guitar',     'gift', 'legendary', 'Gitar',          'MÜZİK · NEON',        '🎸', '#EF4444', '#1F0500', '#5C1A0B', '#7F1D1D',   90, false, false, 212, true),
  ('gift-sunglasses', 'gift', 'rare',      'Güneş Gözlüğü', 'COOL · VIP',          '🕶️', '#FBBF24', '#1A1330', '#5C4612', '#854F0B',   75, false, false, 213, true),
  ('gift-lion',       'gift', 'legendary', 'Aslan',          'GÜÇLÜ · KRAL',        '🦁', '#F59E0B', '#1A0F00', '#5C3A12', '#854F0B',  120, false, false, 214, true),

  -- ── Premium (150-500 SP) ──
  ('gift-crown',      'gift', 'divine',    'Taç',            'KRAL · ALTIN',        '👑', '#FBBF24', '#1A1500', '#5C4612', '#854F0B',  300, false, true,  220, true),
  ('gift-unicorn',    'gift', 'mythic',    'Unicorn',        'SİHİR · GÖKKUŞAĞI',  '🦄', '#C4B5FD', '#1A0A2E', '#4A2D7A', '#6D28D9',  250, false, false, 221, true),
  ('gift-airplane',   'gift', 'mythic',    'Özel Jet',       'UÇAK · LÜKS',        '✈️', '#60A5FA', '#001A2E', '#0C4A6E', '#1E3A8A',  350, false, false, 222, true),
  ('gift-castle',     'gift', 'divine',    'Şato',           'MASAL · PARILTILI',   '🏰', '#C4B5FD', '#1A0A2E', '#312E81', '#4338CA',  400, false, true,  223, true),

  -- ── Ultra Premium (500+ SP) ──
  ('gift-gem',        'gift', 'divine',    'Mücevher',       'PIRLANTA · MOR',      '💜', '#A855F7', '#0A0518', '#1E1B4B', '#312E81',  750, false, false, 230, true),
  ('gift-money',      'gift', 'mythic',    'Para Yağmuru',   'ZENGİNLİK · ALTIN',   '💰', '#FBBF24', '#1A1500', '#5C4612', '#854F0B',  600, false, true,  231, true)
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
