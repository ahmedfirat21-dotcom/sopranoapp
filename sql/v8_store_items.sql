-- =============================================
-- SopranoChat v8 — Store Items Tablosu
-- =============================================
-- Mağaza kataloğunu hardcoded diziden DB'ye taşır.
-- Bu migration çalıştırıldığında StoreService.getStoreItems()
-- otomatik olarak DB'den okumaya geçer (hybrid fallback).

-- 1. Tablo oluştur
CREATE TABLE IF NOT EXISTS store_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL CHECK (type IN ('profile_frame', 'chat_bubble', 'entry_effect', 'room_theme')),
  price INTEGER NOT NULL DEFAULT 0,
  image_url TEXT NOT NULL DEFAULT '',
  rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  is_limited BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. RLS — açık (v6.1 hotfix ile uyumlu)
ALTER TABLE store_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store_items_all" ON store_items FOR ALL USING (true) WITH CHECK (true);

-- 3. Seed data — mevcut hardcoded katalog
INSERT INTO store_items (id, name, description, type, price, image_url, rarity, is_limited, is_active) VALUES
  ('frame_neon_teal',   'Neon Teal Çerçeve',     'Parlak teal renkli profil çerçevesi',         'profile_frame', 500,  '', 'rare',      false, true),
  ('frame_gold_crown',  'Altın Taç Çerçeve',     'Prestige altın taç efektli çerçeve',          'profile_frame', 1500, '', 'legendary', true,  true),
  ('frame_diamond_ring','Elmas Yüzük Çerçeve',   'Pırıl pırıl elmas efektli çerçeve',           'profile_frame', 2000, '', 'legendary', false, true),
  ('frame_purple_aura', 'Mor Aura Çerçeve',      'Gizemli mor ışıltılı çerçeve',                'profile_frame', 800,  '', 'epic',      false, true),
  ('chat_ocean_blue',   'Okyanus Mavisi',        'Sohbet balonlarına okyanus mavisi renk',      'chat_bubble',   300,  '', 'common',    false, true),
  ('chat_sunset_orange','Gün Batımı',            'Sıcak turuncu sohbet rengi',                  'chat_bubble',   300,  '', 'common',    false, true),
  ('chat_galaxy_purple','Galaksi Moru',          'Uzay temalı mor sohbet rengi',                'chat_bubble',   600,  '', 'rare',      false, true),
  ('entry_sparkle',     'Parıltı Girişi',        'Odaya girerken parıltılı efekt',              'entry_effect',  1000, '', 'epic',      false, true),
  ('entry_thunder',     'Şimşek Girişi',         'Güçlü şimşek efektiyle giriş',               'entry_effect',  1500, '', 'legendary', false, true),
  ('theme_midnight',    'Gece Yarısı Teması',    'Koyu mor ve yıldızlı oda teması',             'room_theme',    800,  '', 'epic',      false, true)
ON CONFLICT (id) DO NOTHING;
