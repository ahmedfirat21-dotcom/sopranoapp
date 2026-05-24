-- ★ v1.7.13.113 (20 May 2026): AI Konuşma Başlatıcı (icebreaker prototype)
-- Host odasında "🪄 Konuşma Başlatıcı" → random TR/EN sorulardan biri chat'e
-- AI co-host'un MVP versiyonu: tam LLM entegrasyonu yerine küratörlü preset.

CREATE TABLE IF NOT EXISTS ai_icebreakers (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL DEFAULT 'general',
  question_tr TEXT NOT NULL,
  question_en TEXT NOT NULL,
  weight INT NOT NULL DEFAULT 10, -- yüksek = daha sık seçilir
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_icebreakers_lookup
  ON ai_icebreakers (category, active);

-- RLS: Read-only herkese, INSERT/UPDATE/DELETE sadece admin
ALTER TABLE ai_icebreakers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_ice_read_all ON ai_icebreakers;
CREATE POLICY ai_ice_read_all ON ai_icebreakers FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS ai_ice_admin_write ON ai_icebreakers;
CREATE POLICY ai_ice_admin_write ON ai_icebreakers FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = app_uid() AND is_admin = TRUE))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = app_uid() AND is_admin = TRUE));

-- RPC: kategoriye göre rastgele 3 soru getir
CREATE OR REPLACE FUNCTION public.get_ai_icebreakers(p_category TEXT DEFAULT 'general', p_count INT DEFAULT 3)
RETURNS TABLE (
  id BIGINT,
  question_tr TEXT,
  question_en TEXT,
  category TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH pool AS (
    SELECT i.id, i.question_tr, i.question_en, i.category, i.weight
    FROM ai_icebreakers i
    WHERE i.active = TRUE
      AND (i.category = p_category OR i.category = 'general')
  )
  SELECT id, question_tr, question_en, category
  FROM pool
  ORDER BY random() * (weight::FLOAT / 10) DESC
  LIMIT GREATEST(1, LEAST(p_count, 10));
$$;

GRANT EXECUTE ON FUNCTION public.get_ai_icebreakers(TEXT, INT) TO authenticated;

-- Seed: 40 Türkçe icebreaker (5 kategori × 8 = 40)
INSERT INTO ai_icebreakers (category, question_tr, question_en, weight) VALUES
  -- General (genel)
  ('general', 'Bugün seni en çok ne mutlu etti?', 'What made you happiest today?', 12),
  ('general', 'Çocukken büyüyünce ne olmak istiyordun?', 'What did you want to be when you grew up?', 11),
  ('general', 'Hayatta hiç tekrarlamak istediğin bir an var mı?', 'Is there a moment in life you would relive?', 10),
  ('general', 'Eğer bir gün boyunca süper güç sahibi olsaydın ne seçerdin?', 'If you had a superpower for a day, what would it be?', 10),
  ('general', 'En son hangi şarkıyı sürekli dinledin?', 'What song have you been playing on repeat lately?', 11),
  ('general', 'Komik bir komşu anınız var mı?', 'Do you have a funny neighbor story?', 9),
  ('general', 'Hayatın en lezzetli yemeği neydi?', 'What was the tastiest meal of your life?', 10),
  ('general', 'Eğer bir kitap yazsaydın konusu ne olurdu?', 'If you wrote a book, what would it be about?', 9),

  -- Müzik
  ('music', 'Sahnede kiminle düet yapmak isterdin?', 'Who would you do a duet with on stage?', 12),
  ('music', 'Hangi şarkıyı her duyduğunda dansa kalkıyorsun?', 'Which song makes you dance every time?', 11),
  ('music', 'Konsere gidip de hayatın değiştiğini hissettiğin oldu mu?', 'Has a concert ever changed your life?', 10),
  ('music', 'Annenden/Babandan miras kalan favori şarkın hangisi?', 'Which song did you inherit from a parent?', 10),
  ('music', 'En çok dinlediğin Türkçe sanatçı kim?', 'Which Turkish artist do you listen to most?', 11),
  ('music', 'Yeni keşfettiğin müzisyenden bahseder misin?', 'Who is a musician you recently discovered?', 9),
  ('music', 'Vokal mi, enstrüman mı ön planda olmalı?', 'Vocals or instruments — which matters more?', 8),
  ('music', 'Karaoke moduna geçince mikrofonu en çok kapan kim?', 'Who grabs the mic first in karaoke mode?', 9),

  -- Sohbet / Hayat
  ('chat', 'Pazartesi sabahları seni motive eden ne?', 'What motivates you on Monday mornings?', 11),
  ('chat', 'En çok dinlenmek istediğin sosyal medya alışkanlığı?', 'Which social media habit you wish you could quit?', 9),
  ('chat', 'Gerçek bir arkadaşı diğerlerinden ayıran tek şey nedir sence?', 'What single thing makes a real friend?', 10),
  ('chat', 'Yetişkinliğin en büyük sürprizi ne oldu?', 'What''s adulthood''s biggest surprise?', 9),
  ('chat', 'Sabaha karşı 3''te uyanıp kahvaltı yaptığın oldu mu?', 'Ever had breakfast at 3 AM?', 8),
  ('chat', 'Hayatta vazgeçemediğin bir küçük lüksün?', 'What''s a small luxury you can''t give up?', 10),
  ('chat', 'Gençken kendine söylemek istediğin tek şey ne?', 'One thing you''d tell your younger self?', 11),
  ('chat', 'En çok hangi hayvana benziyorsun sence?', 'Which animal do you most resemble?', 8),

  -- Eğlence / Pop kültür
  ('fun', 'En son hangi diziye/filme ağladın?', 'Which show/movie made you cry recently?', 11),
  ('fun', 'Sevdiğin bir karakterin asla yapmayacağı bir şey?', 'What would your favorite character never do?', 9),
  ('fun', 'Sosyal medya akışında en çok ne sinir bozucu?', 'What annoys you most in social feeds?', 10),
  ('fun', 'Hangi meme/trend seni hâlâ güldürüyor?', 'Which meme/trend still makes you laugh?', 10),
  ('fun', 'En son güldüğün lakaba bahseder misin?', 'Share the funniest nickname you''ve seen.', 9),
  ('fun', 'Eğer kendine bir tema şarkısı seçseydin ne olurdu?', 'What would your personal theme song be?', 11),
  ('fun', 'Hangi reality show''da yarışmak isterdin?', 'Which reality show would you compete on?', 9),
  ('fun', 'Türkçe sözlü en sevdiğin meme cümlesi?', 'Favorite Turkish meme phrase?', 10),

  -- Derin
  ('deep', 'Üç kişilik yemeğe kimleri davet ederdin?', 'Who would you invite to a 3-person dinner?', 11),
  ('deep', 'Senin için "ev" demek ne demek?', 'What does "home" mean to you?', 12),
  ('deep', 'Yarın bambaşka bir hayata uyanacağını bilsen ne hissedersin?', 'How would you feel waking into another life tomorrow?', 9),
  ('deep', 'Hayattaki en büyük öğretmenin kim?', 'Who has been your greatest teacher in life?', 10),
  ('deep', 'Hiç pişmanlık duymadığın bir cesaret hareketin?', 'A brave move you''ve never regretted?', 10),
  ('deep', 'Hayata dair fikir değiştirdiğin bir konu nedir?', 'On what topic have you changed your mind?', 10),
  ('deep', 'Yalnız kaldığında en çok kimi düşünüyorsun?', 'Whom do you think about most when alone?', 9),
  ('deep', 'Kendinde bir günlük değiştirmek istediğin tek şey?', 'One thing you''d change about yourself for a day?', 10)
ON CONFLICT DO NOTHING;
