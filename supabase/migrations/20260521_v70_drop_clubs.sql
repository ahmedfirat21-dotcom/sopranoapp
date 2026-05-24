-- ═══════════════════════════════════════════════════════════════════
-- v70 — Club Feature Tam Kaldırma
-- Tarih: 2026-05-21
-- ═══════════════════════════════════════════════════════════════════
-- Club feature uygulama kodundan kaldırıldı ancak DB'de tablolar,
-- fonksiyonlar, trigger'lar ve açık RLS politikaları kalmıştı.
--
-- v69'da bu 3 tablo USING(TRUE) WITH CHECK(TRUE) ile açılmıştı →
-- herkes herhangi bir kulübe yazabilirdi. Güvenlik riski.
--
-- Bu migration tüm club DB objelerini temizler.
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 1. TRIGGER'LAR — tabloları drop etmeden önce trigger'lar düşsün
-- ─────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_sync_club_member_count ON public.club_members;
DROP TRIGGER IF EXISTS trg_auto_add_club_owner ON public.clubs;
DROP TRIGGER IF EXISTS trg_club_member_count ON public.club_members;
DROP TRIGGER IF EXISTS trg_clubs_updated ON public.clubs;

-- ─────────────────────────────────────────────────────────────────
-- 2. RLS POLİTİKALARI — v69 ile açılmış olan permissive policy'ler
-- ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS clubs_all ON public.clubs;
DROP POLICY IF EXISTS clubs_visibility ON public.clubs;
DROP POLICY IF EXISTS clubs_owner_update ON public.clubs;
DROP POLICY IF EXISTS clubs_authenticated_insert ON public.clubs;
DROP POLICY IF EXISTS clubs_owner_delete ON public.clubs;

DROP POLICY IF EXISTS club_members_all ON public.club_members;
DROP POLICY IF EXISTS club_members_visibility ON public.club_members;
DROP POLICY IF EXISTS club_members_self_join ON public.club_members;
DROP POLICY IF EXISTS club_members_self_leave ON public.club_members;

DROP POLICY IF EXISTS club_rooms_all ON public.club_rooms;
DROP POLICY IF EXISTS club_rooms_visibility ON public.club_rooms;

-- ─────────────────────────────────────────────────────────────────
-- 3. FONKSİYONLAR — RPC'ler ve helper'lar
-- ─────────────────────────────────────────────────────────────────
-- v67: Temel club işlemleri
DROP FUNCTION IF EXISTS public.join_club(UUID, TEXT);
DROP FUNCTION IF EXISTS public.leave_club(UUID, TEXT);
DROP FUNCTION IF EXISTS public.set_club_member_role(UUID, TEXT, TEXT, TEXT);

-- v74: Genişletilmiş club işlemleri
DROP FUNCTION IF EXISTS public.kick_from_club(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.contribute_to_club_treasury(UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.club_boost_room(UUID, UUID, TEXT, INTEGER);

-- v76: Davet kodu
DROP FUNCTION IF EXISTS public._gen_club_invite_code();
DROP FUNCTION IF EXISTS public.rotate_club_invite_code(UUID, TEXT);
DROP FUNCTION IF EXISTS public.join_club_by_invite_code(TEXT, TEXT);

-- v77: Oda bağlama / sahiplik devri
DROP FUNCTION IF EXISTS public.attach_room_to_club(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.detach_room_from_club(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.transfer_club_ownership(UUID, TEXT, TEXT);

-- v67: Trigger fonksiyonları
DROP FUNCTION IF EXISTS public._sync_club_member_count();
DROP FUNCTION IF EXISTS public._auto_add_club_owner_member();
DROP FUNCTION IF EXISTS public.update_club_member_count();

-- v69: RLS recursion fix helper
DROP FUNCTION IF EXISTS public._user_is_club_member(UUID, TEXT);

-- ─────────────────────────────────────────────────────────────────
-- 4. INDEX'LER (CASCADE ile otomatik düşer ama explicit olsun)
-- ─────────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS public.idx_clubs_owner;
DROP INDEX IF EXISTS public.idx_clubs_public;
DROP INDEX IF EXISTS public.idx_club_members_user;
DROP INDEX IF EXISTS public.idx_club_rooms_room;

-- ─────────────────────────────────────────────────────────────────
-- 5. TABLOLAR — CASCADE ile FK bağımlılıkları otomatik temizlenir
-- ─────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.club_rooms CASCADE;
DROP TABLE IF EXISTS public.club_members CASCADE;
DROP TABLE IF EXISTS public.clubs CASCADE;

-- ─────────────────────────────────────────────────────────────────
-- 6. DOĞRULAMA
-- ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  -- Tabloların gerçekten silindiğini doğrula
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clubs') THEN
    RAISE EXCEPTION 'clubs tablosu hâlâ mevcut — migration başarısız!';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'club_members') THEN
    RAISE EXCEPTION 'club_members tablosu hâlâ mevcut — migration başarısız!';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'club_rooms') THEN
    RAISE EXCEPTION 'club_rooms tablosu hâlâ mevcut — migration başarısız!';
  END IF;

  RAISE NOTICE '✅ v70: Club feature tamamen kaldırıldı — 3 tablo, 13 fonksiyon, 4 trigger, 11 policy, 4 index silindi.';
END $$;
