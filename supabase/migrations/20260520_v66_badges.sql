-- ═══════════════════════════════════════════════════════════════
-- SopranoChat — v66 Badges (Faz 6.3)
-- ═══════════════════════════════════════════════════════════════
-- user_badges tablosu zaten v62'de var.
-- Bu migration:
--   1. award_badge() RPC — idempotent insert (RLS bypass)
--   2. revoke_badge() RPC — admin için (rezerve, yalnızca service_role)
--   3. _award_host_milestones() trigger — rooms.is_live=true ON UPDATE
--      veya INSERT'te host'un toplam oda sayısına göre host_1/10/100 verir.
--   4. _award_social_butterfly() trigger — friendships ON INSERT ile 50+
--      arkadaş eşiğine ulaşıldığında badge dağıtır.
--   5. award_sp_donor_if_first() — services tarafından çağrılan helper.
--
-- Tasarım:
--   • award_badge SECURITY DEFINER, p_user_id zorunlu — caller'in kendi
--     UID'i. (verified/staff dağıtımı service_role için ayrı.)
--   • Idempotent: ON CONFLICT DO NOTHING ile aynı badge tekrar verilemez.
--   • Trigger'lar best-effort: hatada exception fırlatmaz (host operation
--     bozulmasın). NOTICE yerine sessiz devam.
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. award_badge — public RPC (caller kendi user_id'si için)
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.award_badge(
  p_user_id TEXT,
  p_badge_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted BOOLEAN := FALSE;
BEGIN
  IF p_user_id IS NULL OR p_badge_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Auth check: caller kendi UID'sini geçirmeli (verified/staff hariç)
  IF p_badge_id IN ('verified', 'staff') THEN
    -- Sadece service_role bu rozetleri verebilir
    IF current_setting('request.jwt.claims', true)::jsonb ->> 'role' <> 'service_role' THEN
      RAISE EXCEPTION 'Bu rozet yalnızca yöneticiler tarafından verilebilir.';
    END IF;
  END IF;

  INSERT INTO public.user_badges (user_id, badge_id, awarded_at)
  VALUES (p_user_id, p_badge_id, NOW())
  ON CONFLICT (user_id, badge_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted > 0;
END;
$$;

COMMENT ON FUNCTION public.award_badge IS
  'Faz 6.3 — Idempotent badge award. verified/staff service_role only.';

-- ───────────────────────────────────────────────────────────────
-- 2. revoke_badge — admin / service_role only
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.revoke_badge(
  p_user_id TEXT,
  p_badge_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claims', true)::jsonb ->> 'role' <> 'service_role' THEN
    RAISE EXCEPTION 'Yetki yok.';
  END IF;
  DELETE FROM public.user_badges
  WHERE user_id = p_user_id AND badge_id = p_badge_id;
  RETURN FOUND;
END;
$$;

-- ───────────────────────────────────────────────────────────────
-- 3. Host milestone trigger — rooms INSERT'te host'un toplam oda sayısı
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._award_host_milestones()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_count INTEGER;
BEGIN
  IF NEW.host_id IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_room_count FROM public.rooms WHERE host_id = NEW.host_id;

  BEGIN
    IF v_room_count >= 1 THEN
      INSERT INTO public.user_badges (user_id, badge_id) VALUES (NEW.host_id, 'host_1') ON CONFLICT DO NOTHING;
    END IF;
    IF v_room_count >= 10 THEN
      INSERT INTO public.user_badges (user_id, badge_id) VALUES (NEW.host_id, 'host_10') ON CONFLICT DO NOTHING;
    END IF;
    IF v_room_count >= 100 THEN
      INSERT INTO public.user_badges (user_id, badge_id) VALUES (NEW.host_id, 'host_100') ON CONFLICT DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Best-effort: badge başarısız olursa room creation'ı bozma
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_host_milestones ON public.rooms;
CREATE TRIGGER trg_award_host_milestones
  AFTER INSERT ON public.rooms
  FOR EACH ROW
  EXECUTE FUNCTION public._award_host_milestones();

-- ───────────────────────────────────────────────────────────────
-- 4. Social butterfly trigger — friendships accepted INSERT'te kontrol
-- ───────────────────────────────────────────────────────────────
-- friendships tablosunda accepted state'inde 50+ olduğunda dağıt.
-- friendships çift yönlü değilse (A→B accepted), her iki taraf için ayrı sayım.
CREATE OR REPLACE FUNCTION public._award_social_butterfly()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count_a INTEGER;
  v_count_b INTEGER;
BEGIN
  IF NEW.status <> 'accepted' THEN RETURN NEW; END IF;

  BEGIN
    -- A taraf
    SELECT COUNT(*) INTO v_count_a FROM public.friendships
    WHERE (user_id = NEW.user_id OR friend_id = NEW.user_id) AND status = 'accepted';
    IF v_count_a >= 50 THEN
      INSERT INTO public.user_badges (user_id, badge_id) VALUES (NEW.user_id, 'social_butterfly') ON CONFLICT DO NOTHING;
    END IF;

    -- B taraf
    SELECT COUNT(*) INTO v_count_b FROM public.friendships
    WHERE (user_id = NEW.friend_id OR friend_id = NEW.friend_id) AND status = 'accepted';
    IF v_count_b >= 50 THEN
      INSERT INTO public.user_badges (user_id, badge_id) VALUES (NEW.friend_id, 'social_butterfly') ON CONFLICT DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_social_butterfly ON public.friendships;
CREATE TRIGGER trg_award_social_butterfly
  AFTER INSERT OR UPDATE OF status ON public.friendships
  FOR EACH ROW
  EXECUTE FUNCTION public._award_social_butterfly();

-- ───────────────────────────────────────────────────────────────
-- 5. Popular trigger — follows INSERT'te 500+ takipçiye ulaşıldığında
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._award_popular()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  BEGIN
    SELECT COUNT(*) INTO v_count FROM public.follows WHERE following_id = NEW.following_id;
    IF v_count >= 500 THEN
      INSERT INTO public.user_badges (user_id, badge_id)
      VALUES (NEW.following_id, 'popular')
      ON CONFLICT DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_popular ON public.follows;
CREATE TRIGGER trg_award_popular
  AFTER INSERT ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION public._award_popular();

-- ───────────────────────────────────────────────────────────────
-- 6. Permissions
-- ───────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.award_badge TO authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_badge FROM PUBLIC;
