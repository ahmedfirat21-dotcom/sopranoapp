-- ★ v1.7.13.116 (20 May 2026): TR kültür paketi — oda kategorisi constraint genişletildi
-- Türk Sanat Müziği, Arabesk, Halk Müziği, Magazin, Spor, Edebiyat, Yemek, Tarih için.
-- Eski kategoriler korunuyor.

ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_category_check;

ALTER TABLE rooms ADD CONSTRAINT rooms_category_check CHECK (
  category = ANY (ARRAY[
    'chat'::text,
    'music'::text,
    'game'::text,
    'book'::text,
    'film'::text,
    'tech'::text,
    'other'::text,
    -- ★ v1.7.13.116 TR kültür eklemeleri
    'tsm'::text,         -- Türk Sanat Müziği
    'arabesk'::text,     -- Arabesk
    'halk'::text,        -- Halk Müziği
    'pop'::text,         -- Pop & Rap
    'magazin'::text,
    'spor'::text,
    'edebiyat'::text,
    'tarih'::text,
    'yemek'::text,
    'sanat'::text,
    'seyahat'::text
  ])
);
