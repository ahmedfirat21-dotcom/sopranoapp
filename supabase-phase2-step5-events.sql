-- ============================================
-- SOPRANOCHAT PHASE 2 - STEP 5: EVENT PLANNING SYSTEM
-- ============================================

-- 1. ETKİNLİKLER TABLOSU
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('Sohbet', 'Müzik', 'Tartışma', 'Oyun', 'Eğitim', 'Diğer')) DEFAULT 'Sohbet',
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  max_participants INTEGER,
  cover_image_url TEXT,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  is_cancelled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Herkes görebilir, SADECE HOST kendi etkinliğini düzenleyebilir/silebilir
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view events" ON events;
CREATE POLICY "Anyone can view events" ON events FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create events" ON events;
CREATE POLICY "Authenticated users can create events" ON events FOR INSERT WITH CHECK (auth.uid()::text = host_id);

DROP POLICY IF EXISTS "Hosts can update their own events" ON events;
CREATE POLICY "Hosts can update their own events" ON events FOR UPDATE USING (auth.uid()::text = host_id);


-- 2. RSVP (KATILIM / LCV) TABLOSU
CREATE TABLE IF NOT EXISTS event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('going', 'interested', 'declined')) DEFAULT 'going',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- RLS: Herkes katılımcıları görebilir, herkes SADECE KENDİ katılımını yapabilir/güncelleyebilir
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view rsvps" ON event_rsvps;
CREATE POLICY "Anyone can view rsvps" ON event_rsvps FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own rsvp" ON event_rsvps;
CREATE POLICY "Users can insert their own rsvp" ON event_rsvps FOR INSERT WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update their own rsvp" ON event_rsvps;
CREATE POLICY "Users can update their own rsvp" ON event_rsvps FOR UPDATE USING (auth.uid()::text = user_id);


-- 3. BAŞLANGIÇ VERİLERİ (TEST ETKİNLİKLERİ)
-- Host_id olarak rastgele bir profil bağlanması gerekirdi ama FK hatası vermemesi için bunu seed kısmında JS ile yaparız.
-- Veya mevcut bir profilin UID'sini bulmak zorundayız. O yüzden doğrudan SQL üzerinden Insert etmiyoruz.
