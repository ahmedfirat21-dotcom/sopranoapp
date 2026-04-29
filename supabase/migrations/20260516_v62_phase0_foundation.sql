-- ════════════════════════════════════════════════════════════════
-- SopranoChat — v62 FAZ 0 Temel Altyapı
-- ════════════════════════════════════════════════════════════════
-- Tüm gelecek fazların ihtiyaç duyacağı tabloları + sütunları tek
-- migration'da hazırla.
--
-- ÖNEMLİ TIP NOTU:
--   profiles.id → TEXT (Firebase UID, UUID değil)
--   rooms.id    → UUID
--   auth.uid()  → UUID (cast::text gerekli profiles ile karşılaştırırken)
--
-- Kapsam:
--   Faz 1.5: profiles.user_xp sütunu
--   Faz 2.2: rate_limits tablosu
--   Faz 3.1: voice_messages tablosu
--   Faz 4.1: follows tablosu
--   Faz 4.3: room_tags tablosu
--   Faz 5.1: notification_preferences tablosu
--   Faz 6.1: clubs + club_members + club_rooms
--   Faz 6.2: room_recordings tablosu
--   Faz 6.3: user_badges tablosu
--   Faz 7.2: creator_earnings tablosu
-- ════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════
-- FAZ 1.5: USER XP — aktivite bazlı seviye
-- ════════════════════════════════════════════════════════════════
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_xp INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_profiles_user_xp
  ON public.profiles (user_xp DESC) WHERE user_xp > 0;

COMMENT ON COLUMN public.profiles.user_xp IS
  'Aktivite bazlı XP — sahne dakikası, dinleyici saati, oda sayısı. SP''den ayrı, level hesaplama bunu kullanır.';

-- ════════════════════════════════════════════════════════════════
-- FAZ 2.2: RATE LIMITS — abuse prevention
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.rate_limits (
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, action)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window
  ON public.rate_limits (window_start);

COMMENT ON TABLE public.rate_limits IS
  'Action başına cooldown. action: room_create, dm_send, friend_req, report, vs.';

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rate_limits_self_read ON public.rate_limits;
CREATE POLICY rate_limits_self_read ON public.rate_limits
  FOR SELECT USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS rate_limits_service_write ON public.rate_limits;
CREATE POLICY rate_limits_service_write ON public.rate_limits
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ════════════════════════════════════════════════════════════════
-- FAZ 3.1: VOICE MESSAGES — sesli DM
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.voice_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  audio_url TEXT NOT NULL,
  duration_ms INTEGER NOT NULL CHECK (duration_ms > 0 AND duration_ms <= 60000),
  is_one_shot BOOLEAN NOT NULL DEFAULT FALSE,
  listened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT no_self_voice CHECK (sender_id <> receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_voice_msg_inbox
  ON public.voice_messages (receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_msg_outbox
  ON public.voice_messages (sender_id, created_at DESC);

COMMENT ON TABLE public.voice_messages IS
  'WhatsApp-tarzı sesli DM. Max 60 sn. is_one_shot=true ise listened_at set olunca audio_url silinir (Pro feature).';

ALTER TABLE public.voice_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS voice_msg_participants_read ON public.voice_messages;
CREATE POLICY voice_msg_participants_read ON public.voice_messages
  FOR SELECT USING (auth.uid()::text = sender_id OR auth.uid()::text = receiver_id);

DROP POLICY IF EXISTS voice_msg_self_send ON public.voice_messages;
CREATE POLICY voice_msg_self_send ON public.voice_messages
  FOR INSERT WITH CHECK (auth.uid()::text = sender_id);

DROP POLICY IF EXISTS voice_msg_listen_update ON public.voice_messages;
CREATE POLICY voice_msg_listen_update ON public.voice_messages
  FOR UPDATE USING (auth.uid()::text = receiver_id);

-- ════════════════════════════════════════════════════════════════
-- FAZ 4.1: FOLLOWS — tek yönlü takip
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT no_self_follow CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_following
  ON public.follows (following_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follows_follower
  ON public.follows (follower_id, created_at DESC);

COMMENT ON TABLE public.follows IS
  'Twitter-tarzı tek yönlü takip. friendships''ten ayrı. Public.';

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS follows_public_read ON public.follows;
CREATE POLICY follows_public_read ON public.follows
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS follows_self_write ON public.follows;
CREATE POLICY follows_self_write ON public.follows
  FOR INSERT WITH CHECK (auth.uid()::text = follower_id);

DROP POLICY IF EXISTS follows_self_delete ON public.follows;
CREATE POLICY follows_self_delete ON public.follows
  FOR DELETE USING (auth.uid()::text = follower_id);

-- ════════════════════════════════════════════════════════════════
-- FAZ 4.3: ROOM TAGS — etiket sistemi (rooms.id UUID)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.room_tags (
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  tag TEXT NOT NULL CHECK (length(tag) BETWEEN 2 AND 30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_room_tags_tag
  ON public.room_tags (tag, created_at DESC);

COMMENT ON TABLE public.room_tags IS
  'Oda başına 3 etiket. tag normalize: lowercase, # prefix YOK, ASCII + Türkçe.';

ALTER TABLE public.room_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS room_tags_public_read ON public.room_tags;
CREATE POLICY room_tags_public_read ON public.room_tags
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS room_tags_host_write ON public.room_tags;
CREATE POLICY room_tags_host_write ON public.room_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.rooms r
      WHERE r.id = room_id AND r.host_id = auth.uid()::text
    )
  );

-- ════════════════════════════════════════════════════════════════
-- FAZ 5.1: NOTIFICATION PREFERENCES
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id TEXT PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  dnd_start_hour SMALLINT CHECK (dnd_start_hour BETWEEN 0 AND 23),
  dnd_end_hour SMALLINT CHECK (dnd_end_hour BETWEEN 0 AND 23),
  friends_only BOOLEAN NOT NULL DEFAULT FALSE,
  room_invites BOOLEAN NOT NULL DEFAULT TRUE,
  dm_messages BOOLEAN NOT NULL DEFAULT TRUE,
  stage_invites BOOLEAN NOT NULL DEFAULT TRUE,
  sp_received BOOLEAN NOT NULL DEFAULT TRUE,
  friend_online BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_weekly_digest BOOLEAN NOT NULL DEFAULT FALSE,
  timezone TEXT DEFAULT 'Europe/Istanbul',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.notification_preferences IS
  'Bildirim ince-ayar. Server bildirim göndermeden önce check.';

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notif_prefs_self_all ON public.notification_preferences;
CREATE POLICY notif_prefs_self_all ON public.notification_preferences
  FOR ALL USING (auth.uid()::text = user_id);

-- ════════════════════════════════════════════════════════════════
-- FAZ 6.1: CLUBS — 3 tablo birden yarat, sonra TÜM policy'ler
-- (cross-table policy'lerin forward reference yapması için)
-- ════════════════════════════════════════════════════════════════

-- ─── CLUBS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9_-]{3,30}$'),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 50),
  description TEXT CHECK (length(description) <= 500),
  avatar_url TEXT,
  banner_url TEXT,
  owner_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  member_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clubs_owner ON public.clubs (owner_id);
CREATE INDEX IF NOT EXISTS idx_clubs_public ON public.clubs (is_public, member_count DESC) WHERE is_public = TRUE;

COMMENT ON TABLE public.clubs IS
  'Discord-tarzı sürekli topluluk. Owner > Moderator > Member rol hiyerarşisi club_members''ta.';

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

-- ─── CLUB MEMBERS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.club_members (
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'moderator', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (club_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_club_members_user ON public.club_members (user_id);

ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

-- ─── CLUB ROOMS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.club_rooms (
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (club_id, room_id)
);

CREATE INDEX IF NOT EXISTS idx_club_rooms_room ON public.club_rooms (room_id);

ALTER TABLE public.club_rooms ENABLE ROW LEVEL SECURITY;

-- ─── POLICIES (3 tablo da yaratıldı, forward ref güvenli) ──────
DROP POLICY IF EXISTS clubs_visibility ON public.clubs;
CREATE POLICY clubs_visibility ON public.clubs
  FOR SELECT USING (
    is_public = TRUE
    OR auth.uid()::text = owner_id
    OR EXISTS (SELECT 1 FROM public.club_members cm WHERE cm.club_id = id AND cm.user_id = auth.uid()::text)
  );

DROP POLICY IF EXISTS clubs_owner_update ON public.clubs;
CREATE POLICY clubs_owner_update ON public.clubs
  FOR UPDATE USING (auth.uid()::text = owner_id);

DROP POLICY IF EXISTS clubs_authenticated_insert ON public.clubs;
CREATE POLICY clubs_authenticated_insert ON public.clubs
  FOR INSERT WITH CHECK (auth.uid()::text = owner_id);

DROP POLICY IF EXISTS clubs_owner_delete ON public.clubs;
CREATE POLICY clubs_owner_delete ON public.clubs
  FOR DELETE USING (auth.uid()::text = owner_id);

DROP POLICY IF EXISTS club_members_visibility ON public.club_members;
CREATE POLICY club_members_visibility ON public.club_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_id
      AND (c.is_public = TRUE OR c.owner_id = auth.uid()::text
           OR EXISTS (SELECT 1 FROM public.club_members cm2 WHERE cm2.club_id = c.id AND cm2.user_id = auth.uid()::text))
    )
  );

DROP POLICY IF EXISTS club_members_self_join ON public.club_members;
CREATE POLICY club_members_self_join ON public.club_members
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS club_members_self_leave ON public.club_members;
CREATE POLICY club_members_self_leave ON public.club_members
  FOR DELETE USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS club_rooms_visibility ON public.club_rooms;
CREATE POLICY club_rooms_visibility ON public.club_rooms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_id AND c.is_public = TRUE
    )
  );

-- ════════════════════════════════════════════════════════════════
-- FAZ 6.2: ROOM RECORDINGS — replay
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.room_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  audio_url TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  listen_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ★ NOW() IMMUTABLE değil → partial index olamaz. Full index yeter.
CREATE INDEX IF NOT EXISTS idx_room_rec_expires
  ON public.room_recordings (expires_at);
CREATE INDEX IF NOT EXISTS idx_room_rec_room
  ON public.room_recordings (room_id, created_at DESC);

COMMENT ON TABLE public.room_recordings IS
  'Oda kaydı / replay. expires_at geçince cron job audio_url temizler. KVKK: konuşmacı consent şart.';

ALTER TABLE public.room_recordings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS room_rec_public_read ON public.room_recordings;
CREATE POLICY room_rec_public_read ON public.room_recordings
  FOR SELECT USING (
    is_public = TRUE
    AND expires_at > NOW()
  );

-- ════════════════════════════════════════════════════════════════
-- FAZ 6.3: USER BADGES — rozet sistemi
-- ★ Legacy tablo v6'dan kalma olabilir. Defensive: sütun yoksa ekle.
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.user_badges (
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_id)
);

-- Legacy tablo varsa eksik sütunları ekle
ALTER TABLE public.user_badges
  ADD COLUMN IF NOT EXISTS awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.user_badges
  ADD COLUMN IF NOT EXISTS badge_id TEXT;

CREATE INDEX IF NOT EXISTS idx_user_badges_awarded
  ON public.user_badges (awarded_at DESC);

COMMENT ON TABLE public.user_badges IS
  'Kullanıcı rozetleri. Server-side cron / trigger ile dağıtılır. Client tarafı sadece okur.';

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_badges_public_read ON public.user_badges;
CREATE POLICY user_badges_public_read ON public.user_badges
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS user_badges_service_write ON public.user_badges;
CREATE POLICY user_badges_service_write ON public.user_badges
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ════════════════════════════════════════════════════════════════
-- FAZ 7.2: CREATOR EARNINGS
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.creator_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  sp_received_gross BIGINT NOT NULL DEFAULT 0,
  sp_net BIGINT NOT NULL DEFAULT 0,
  payout_amount_try NUMERIC(10, 2),
  payout_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payout_status IN ('pending', 'eligible', 'requested', 'paid', 'failed', 'rejected')),
  payout_requested_at TIMESTAMPTZ,
  payout_paid_at TIMESTAMPTZ,
  payout_method TEXT,
  payout_account_encrypted TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (host_id, period)
);

CREATE INDEX IF NOT EXISTS idx_earnings_host ON public.creator_earnings (host_id, period DESC);
CREATE INDEX IF NOT EXISTS idx_earnings_status ON public.creator_earnings (payout_status, created_at);

COMMENT ON TABLE public.creator_earnings IS
  'Host''lara gelen SP''nin %70''i net hesaplanır. payout_amount: 100K SP = 100 TL.';

ALTER TABLE public.creator_earnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS earnings_self_read ON public.creator_earnings;
CREATE POLICY earnings_self_read ON public.creator_earnings
  FOR SELECT USING (auth.uid()::text = host_id);

DROP POLICY IF EXISTS earnings_service_write ON public.creator_earnings;
CREATE POLICY earnings_service_write ON public.creator_earnings
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ════════════════════════════════════════════════════════════════
-- TRIGGERS — updated_at otomatik
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clubs_updated ON public.clubs;
CREATE TRIGGER trg_clubs_updated BEFORE UPDATE ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_notif_prefs_updated ON public.notification_preferences;
CREATE TRIGGER trg_notif_prefs_updated BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_earnings_updated ON public.creator_earnings;
CREATE TRIGGER trg_earnings_updated BEFORE UPDATE ON public.creator_earnings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ════════════════════════════════════════════════════════════════
-- CLUB MEMBER COUNT TRIGGER — clubs.member_count otomatik
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.update_club_member_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.clubs SET member_count = member_count + 1 WHERE id = NEW.club_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.clubs SET member_count = GREATEST(0, member_count - 1) WHERE id = OLD.club_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_club_member_count ON public.club_members;
CREATE TRIGGER trg_club_member_count
  AFTER INSERT OR DELETE ON public.club_members
  FOR EACH ROW EXECUTE FUNCTION public.update_club_member_count();

-- ════════════════════════════════════════════════════════════════
-- BACKFILL: notification_preferences — mevcut kullanıcılara default kayıt
-- ════════════════════════════════════════════════════════════════
INSERT INTO public.notification_preferences (user_id)
SELECT id FROM public.profiles
WHERE id NOT IN (SELECT user_id FROM public.notification_preferences)
ON CONFLICT (user_id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════
-- VERIFY
-- ════════════════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE 'v62 Phase 0 Foundation — migration complete.';
  RAISE NOTICE 'New tables: voice_messages, follows, room_tags, notification_preferences, clubs, club_members, club_rooms, room_recordings, user_badges, creator_earnings, rate_limits.';
  RAISE NOTICE 'New columns: profiles.user_xp.';
END $$;
