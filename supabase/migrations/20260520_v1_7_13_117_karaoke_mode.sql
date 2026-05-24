-- ★ v1.7.13.117 (20 May 2026): Karaoke modu — oda kategorisi + room_settings flag
-- Karaoke odasında host şarkı adı + söz yapıştırır; herkes görür; sıra mic queue ile.

-- 1) "karaoke" kategorisini ekle (constraint genişlet)
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
    'tsm'::text,
    'arabesk'::text,
    'halk'::text,
    'pop'::text,
    'magazin'::text,
    'spor'::text,
    'edebiyat'::text,
    'tarih'::text,
    'yemek'::text,
    'sanat'::text,
    'seyahat'::text,
    -- ★ v1.7.13.117 yeni
    'karaoke'::text,
    'mafia'::text       -- Sprint 5 hazırlık
  ])
);

-- room_settings JSON içine karaoke_mode + karaoke_song + karaoke_lyrics eklenir
-- (JSON olduğu için ALTER TABLE gerekmez)
