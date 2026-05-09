-- ═══════════════════════════════════════════════════════════════════
-- v110.5 (6 May 2026) — Profil sayfası modern özellik paketi
-- ═══════════════════════════════════════════════════════════════════
-- Faz A — engelle/rapor + paylaş + davet + lastSeen + memberSince (kod)
-- Faz B — Voice Bio, Diller, İlgi alanları, Ortak odalar, Top destekçi, Featured badges
-- Faz C — Kişisel not, Davet eden, Doğrulama tiki, Sosyal linkler, Konuşma ritmi
--
-- ★ Tüm değişiklikler IF NOT EXISTS / IF EXISTS guard'lı — yeniden çalıştırılabilir.

-- ═══════════════════════════════════════════════════════════════════
-- profiles tablosu — yeni kolonlar
-- ═══════════════════════════════════════════════════════════════════

-- B.2: Diller (interests zaten v62'de eklenmişti)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS languages text[] DEFAULT '{}'::text[];
COMMENT ON COLUMN profiles.languages IS 'ISO 639-1 dil kodları (tr, en, ar, ku, de, fr, ru) — kullanıcının konuştuğu diller';

-- B.1: Sesli tanıtım (Voice Bio)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS voice_bio_url text,
  ADD COLUMN IF NOT EXISTS voice_bio_duration_ms integer;
COMMENT ON COLUMN profiles.voice_bio_url IS 'Supabase Storage voice-notes bucket içinde 15-30sn ses kaydı URL';
COMMENT ON COLUMN profiles.voice_bio_duration_ms IS 'Sesli tanıtım süresi (ms) — UI player progress bar için';

-- C.3: Doğrulama tiki
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false NOT NULL;
COMMENT ON COLUMN profiles.is_verified IS 'Manuel admin onaylı doğrulama (host/içerik üretici)';

-- C.4: Sosyal linkler
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '{}'::jsonb;
COMMENT ON COLUMN profiles.social_links IS '{instagram, twitter, website} keys — opt-in, opsiyonel';

-- ═══════════════════════════════════════════════════════════════════
-- B.5: Featured badges — user_badges.is_featured
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE user_badges
  ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;
COMMENT ON COLUMN user_badges.is_featured IS 'Profilde öne çıkarılan rozet (kullanıcı en fazla 3 seçebilir, app-side enforced)';

CREATE INDEX IF NOT EXISTS idx_user_badges_featured
  ON user_badges(user_id, is_featured)
  WHERE is_featured = true;

-- ═══════════════════════════════════════════════════════════════════
-- C.1: Kişisel notlar tablosu (private — sadece sahibi görür)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  target_id text NOT NULL,
  note text NOT NULL CHECK (length(note) <= 280),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, target_id)
);

CREATE INDEX IF NOT EXISTS idx_user_notes_owner ON user_notes(owner_id);

ALTER TABLE user_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_notes_owner_only ON user_notes;
CREATE POLICY user_notes_owner_only ON user_notes
  FOR ALL
  USING (owner_id = app_uid())
  WITH CHECK (owner_id = app_uid());

-- updated_at trigger
CREATE OR REPLACE FUNCTION user_notes_set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_notes_updated_at ON user_notes;
CREATE TRIGGER user_notes_updated_at
  BEFORE UPDATE ON user_notes
  FOR EACH ROW EXECUTE FUNCTION user_notes_set_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- B.4: Top 3 destekçi — RPC
-- ═══════════════════════════════════════════════════════════════════
-- Hedef kullanıcıya en çok SP gönderen 3 kişi (donation_received transaction'larından).
-- Profile select için public — RLS bypass değil, SECURITY DEFINER.
CREATE OR REPLACE FUNCTION get_top_supporters(p_target_user_id text, p_limit int DEFAULT 3)
RETURNS TABLE (
  supporter_id text,
  display_name text,
  avatar_url text,
  subscription_tier text,
  total_amount bigint,
  donation_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.counterparty_id AS supporter_id,
    p.display_name,
    p.avatar_url,
    COALESCE(p.subscription_tier, 'Free') AS subscription_tier,
    SUM(t.amount)::bigint AS total_amount,
    COUNT(*)::bigint AS donation_count
  FROM sp_transactions t
  JOIN profiles p ON p.id = t.counterparty_id
  WHERE t.user_id = p_target_user_id
    AND t.type = 'donation_received'
    AND t.counterparty_id IS NOT NULL
    AND t.amount > 0
  GROUP BY t.counterparty_id, p.display_name, p.avatar_url, p.subscription_tier
  ORDER BY total_amount DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_top_supporters(text, int) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- B.3: Ortak odalar — RPC
-- ═══════════════════════════════════════════════════════════════════
-- ★ Tarihçe table yok (room_messages TTL var) — pragmatik versiyon:
--    Kullanıcı A ve B'nin İKİSİNİN DE ŞU AN aktif olduğu odalar
--    (canlı veya persistent — sleeping rooms dahil).
--    Aynı odadaysak burada görünür → "X odasında birlikteydiniz" sinyali.
CREATE OR REPLACE FUNCTION get_mutual_rooms(p_user_a text, p_user_b text, p_limit int DEFAULT 5)
RETURNS TABLE (
  room_id uuid,
  room_name text,
  is_live boolean,
  is_persistent boolean,
  listener_count integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id AS room_id,
    r.name AS room_name,
    r.is_live,
    COALESCE(r.is_persistent, false) AS is_persistent,
    COALESCE(r.listener_count, 0) AS listener_count
  FROM rooms r
  WHERE r.id IN (
    SELECT rp.room_id
    FROM room_participants rp
    WHERE rp.user_id = p_user_a
    INTERSECT
    SELECT rp.room_id
    FROM room_participants rp
    WHERE rp.user_id = p_user_b
  )
  ORDER BY r.is_live DESC, COALESCE(r.listener_count, 0) DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_mutual_rooms(text, text, int) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- C.5: Konuşma ritmi — basit RPC
-- ═══════════════════════════════════════════════════════════════════
-- Son 30 günde kullanıcının sahne saatleri histogramı (24 saatlik bucket).
-- Kaynak: sp_transactions WHERE type='stage_time' (10dk sahne event'i tetikleyen).
-- "Genelde 21-23 arası canlı" gibi insight için.
CREATE OR REPLACE FUNCTION get_speaking_rhythm(p_user_id text)
RETURNS TABLE (
  hour_bucket int,
  event_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(HOUR FROM (t.created_at AT TIME ZONE 'Europe/Istanbul'))::int AS hour_bucket,
    COUNT(*)::bigint AS event_count
  FROM sp_transactions t
  WHERE t.user_id = p_user_id
    AND t.type = 'stage_time'
    AND t.created_at > now() - interval '30 days'
  GROUP BY hour_bucket
  ORDER BY hour_bucket;
$$;

GRANT EXECUTE ON FUNCTION get_speaking_rhythm(text) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- Index'ler — keşfet algoritması ve filtre performansı için
-- ═══════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_profiles_interests_gin ON profiles USING GIN (interests);
CREATE INDEX IF NOT EXISTS idx_profiles_languages_gin ON profiles USING GIN (languages);
CREATE INDEX IF NOT EXISTS idx_profiles_verified ON profiles(is_verified) WHERE is_verified = true;
