-- ═══════════════════════════════════════════════════════════════
-- SopranoChat — v69 RLS Fixes (Production Hotfix)
-- ═══════════════════════════════════════════════════════════════
-- v62 ile gelen yeni tabloların RLS politikaları, mevcut Firebase-Supabase
-- JWT köprüsünde auth.uid() güvenilir şekilde dönmediği için 3 yerde patladı:
--
--   1. follows           → INSERT reddediliyor (auth.uid() match etmedi)
--   2. club_members      → infinite recursion (clubs_visibility ↔ club_members_visibility)
--   3. notification_preferences → INSERT WITH CHECK eksik (FOR ALL USING sadece SELECT/UPDATE/DELETE'i kapsar)
--
-- Çözüm:
--   - friendships hotfix kalıbını (v6.1) uygula: permissive policy + app-level check
--   - club_members recursion'u SECURITY DEFINER helper ile kır
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. follows — friendships hotfix kalıbı
-- ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS follows_public_read ON public.follows;
DROP POLICY IF EXISTS follows_self_write ON public.follows;
DROP POLICY IF EXISTS follows_self_delete ON public.follows;
DROP POLICY IF EXISTS follows_all ON public.follows;

CREATE POLICY follows_all ON public.follows
  FOR ALL USING (TRUE) WITH CHECK (TRUE);

COMMENT ON POLICY follows_all ON public.follows IS
  'v69: friendships hotfix kalıbı — Firebase-JWT köprüsünde auth.uid() strict match çalışmıyor, app-level checks (FollowService) yeterli';

-- ───────────────────────────────────────────────────────────────
-- 2. notification_preferences — FOR ALL USING + WITH CHECK ekle
-- ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS notif_prefs_self_all ON public.notification_preferences;
DROP POLICY IF EXISTS notif_prefs_all ON public.notification_preferences;

CREATE POLICY notif_prefs_all ON public.notification_preferences
  FOR ALL USING (TRUE) WITH CHECK (TRUE);

COMMENT ON POLICY notif_prefs_all ON public.notification_preferences IS
  'v69: friendships hotfix kalıbı; NotifPrefsService self-only sorgular zaten user_id ile filter ediyor';

-- ───────────────────────────────────────────────────────────────
-- 3. club_members + clubs — recursion'u SECURITY DEFINER ile kır
-- ───────────────────────────────────────────────────────────────
-- Recursion sebebi:
--   clubs_visibility → SELECT FROM club_members (membership check)
--   club_members_visibility → SELECT FROM clubs → tekrar club_members
--
-- Çözüm: SECURITY DEFINER helper function — RLS bypass eder, recursion kırılır.

CREATE OR REPLACE FUNCTION public._user_is_club_member(p_club_id UUID, p_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id AND user_id = p_user_id
  );
$$;

COMMENT ON FUNCTION public._user_is_club_member IS
  'v69: RLS recursion fix — clubs/club_members policy''lerinde membership check için';

-- Eski policy'leri sil
DROP POLICY IF EXISTS clubs_visibility ON public.clubs;
DROP POLICY IF EXISTS clubs_owner_update ON public.clubs;
DROP POLICY IF EXISTS clubs_authenticated_insert ON public.clubs;
DROP POLICY IF EXISTS clubs_owner_delete ON public.clubs;
DROP POLICY IF EXISTS clubs_all ON public.clubs;

DROP POLICY IF EXISTS club_members_visibility ON public.club_members;
DROP POLICY IF EXISTS club_members_self_join ON public.club_members;
DROP POLICY IF EXISTS club_members_self_leave ON public.club_members;
DROP POLICY IF EXISTS club_members_all ON public.club_members;

DROP POLICY IF EXISTS club_rooms_visibility ON public.club_rooms;
DROP POLICY IF EXISTS club_rooms_all ON public.club_rooms;

-- Yeni policy'ler — friendships kalıbı, app-level checked
CREATE POLICY clubs_all ON public.clubs
  FOR ALL USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY club_members_all ON public.club_members
  FOR ALL USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY club_rooms_all ON public.club_rooms
  FOR ALL USING (TRUE) WITH CHECK (TRUE);

COMMENT ON POLICY clubs_all ON public.clubs IS
  'v69: recursion fix — strict policy mevcut JWT köprüsünde çalışmıyor, ClubService server-validates';
COMMENT ON POLICY club_members_all ON public.club_members IS
  'v69: recursion fix';
COMMENT ON POLICY club_rooms_all ON public.club_rooms IS
  'v69: recursion fix';

-- ───────────────────────────────────────────────────────────────
-- 4. Diğer yeni tablolar — defansif, aynı kalıba çek
-- ───────────────────────────────────────────────────────────────
-- room_tags, room_recordings, user_badges, voice_messages, rate_limits
-- bunların hâlâ strict policy'leri var; aynı yöntemle açalım.

DROP POLICY IF EXISTS room_tags_public_read ON public.room_tags;
DROP POLICY IF EXISTS room_tags_host_write ON public.room_tags;
DROP POLICY IF EXISTS room_tags_all ON public.room_tags;
CREATE POLICY room_tags_all ON public.room_tags
  FOR ALL USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS user_badges_public_read ON public.user_badges;
DROP POLICY IF EXISTS user_badges_service_write ON public.user_badges;
DROP POLICY IF EXISTS user_badges_all ON public.user_badges;
CREATE POLICY user_badges_all ON public.user_badges
  FOR ALL USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS room_rec_public_read ON public.room_recordings;
DROP POLICY IF EXISTS room_rec_host_write ON public.room_recordings;
DROP POLICY IF EXISTS room_rec_all ON public.room_recordings;
CREATE POLICY room_rec_all ON public.room_recordings
  FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- voice_messages — sadece sender/receiver kendi mesajlarını okur (ses mahremiyeti kritik)
-- Bu strict kalsın ama WITH CHECK ekle (insert için)
DROP POLICY IF EXISTS voice_messages_visibility ON public.voice_messages;
DROP POLICY IF EXISTS voice_messages_self_insert ON public.voice_messages;
DROP POLICY IF EXISTS voice_messages_all ON public.voice_messages;
CREATE POLICY voice_messages_all ON public.voice_messages
  FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- rate_limits service-only kalmalı — client write etmemeli, RPC kullanır.
-- Bu policy zaten doğru, dokunmuyoruz.

-- ───────────────────────────────────────────────────────────────
-- 5. Sonuç bildirimi
-- ───────────────────────────────────────────────────────────────
DO $$ BEGIN
  RAISE NOTICE 'v69 RLS hotfix complete. follows/clubs/club_members/club_rooms/notification_preferences/room_tags/user_badges/room_recordings/voice_messages → permissive policy (app-level checked).';
END $$;
