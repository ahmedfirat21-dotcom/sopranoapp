-- ════════════════════════════════════════════════════════════════════
-- v117: 6 yeni kozmetik kategori için örnek ürünler
-- ════════════════════════════════════════════════════════════════════
-- Web admin'de detaylı editörlere ulaşabilmek için DB'ye 1'er örnek
-- ürün eklenir. Hepsi active=false (kullanıcılara satılmaz, sadece test).
-- ════════════════════════════════════════════════════════════════════

INSERT INTO public.cosmetic_items (id, name, category, price_sp, active, tagline, art_emoji, art_color)
VALUES
  ('glow-classic-teal', 'Klasik Turkuaz Glow', 'glow_message', 150, false,
   'Sohbet baloncuğu için yumuşak turkuaz parıltı', '💬', '#14B8A6'),
  ('badge-verified-blue', 'Mavi Doğrulama Tiki', 'badge', 500, false,
   'Profil isminin yanında mavi doğrulama rozeti', '✓', '#3B82F6'),
  ('bg-aurora-night', 'Aurora Gece', 'background', 300, false,
   'Animasyonlu kuzey ışıkları arka planı', '🌌', '#7C3AED'),
  ('theme-soprano-dark', 'Soprano Karanlık', 'theme', 0, false,
   'Varsayılan karanlık tema palet seti', '🎨', '#14B8A6'),
  ('emoji-soprano-classics', 'Soprano Klasikleri', 'emoji', 200, false,
   'Maison Soprano özel emoji seti', '😎', '#FBBF24'),
  ('effect-stage-sparkle', 'Sahne Pırıltısı', 'effect', 250, false,
   'Sahne çevresinde sürekli pırıltı partikülleri', '✨', '#F472B6')
ON CONFLICT (id) DO NOTHING;
