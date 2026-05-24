-- ════════════════════════════════════════════════════════════════════
-- ★ v1.7.13.142 (22 May 2026): TIER GÜVENLİK YAMALARI
-- ════════════════════════════════════════════════════════════════════
-- 1) apply_subscription_tier — auth.uid() yetkilendirme kontrolü eklendi
--    Herhangi bir authenticated kullanıcı başka birinin tier'ını
--    değiştirememeli. Sadece kendisi veya admin/service_role yapabilir.
--
-- 2) expire_overdue_subscriptions() — süresi dolmuş abonelikleri
--    otomatik Free'ye düşürür. pg_cron ile 15dk arayla çağrılmalı.
--
-- 3) on_tier_downgrade_refresh_rooms() — tier düşüşünde canlı odaların
--    owner_tier + expires_at değerlerini yeni tier'a göre günceller.
-- ════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────
-- 1) apply_subscription_tier — SECURITY FIX: auth.uid() kontrolü
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_subscription_tier(
  p_user_id text,
  p_tier text,
  p_expires_at timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $func$
DECLARE
  v_normalized text;
BEGIN
  IF p_user_id IS NULL OR p_user_id = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_id gerekli');
  END IF;

  -- ★ v1.7.13.142 SECURITY FIX: Yetkilendirme kontrolü
  -- Sadece kendi tier'ını değiştirebilir, admin veya service_role hariç
  IF auth.uid()::text IS NOT NULL
     AND auth.uid()::text != p_user_id
     AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()::text AND is_admin = true)
  THEN
    RETURN jsonb_build_object('success', false, 'error', 'Yetkilendirme hatası');
  END IF;

  v_normalized := CASE
    WHEN p_tier IN ('Free','Plus','Pro') THEN p_tier
    WHEN p_tier = 'GodMaster' THEN 'Pro'
    ELSE 'Free'
  END;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'profil yok');
  END IF;
  PERFORM set_config('app.sp_rpc_bypass', 'true', true);
  UPDATE profiles
    SET subscription_tier = v_normalized,
        subscription_expires_at = p_expires_at
    WHERE id = p_user_id;
  PERFORM set_config('app.sp_rpc_bypass', 'false', true);
  RETURN jsonb_build_object('success', true, 'tier', v_normalized, 'expires_at', p_expires_at);
END;
$func$;

REVOKE ALL ON FUNCTION public.apply_subscription_tier(text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_subscription_tier(text, text, timestamptz) TO authenticated, service_role;

-- ──────────────────────────────────────────────────────────────────
-- 2) expire_overdue_subscriptions — süresi dolmuş abonelikleri Free'ye düşür
-- ──────────────────────────────────────────────────────────────────
-- pg_cron ile 15dk arayla çağrılmalı:
--   SELECT cron.schedule('expire-subs', '*/15 * * * *', 'SELECT expire_overdue_subscriptions()');
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.expire_overdue_subscriptions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  v_affected_count integer := 0;
  v_user_ids text[];
BEGIN
  -- ★ v1.7.13.142: Süresi dolmuş abonelikleri tespit et
  SELECT ARRAY(
    SELECT id FROM profiles
    WHERE subscription_tier != 'Free'
      AND subscription_expires_at IS NOT NULL
      AND subscription_expires_at <= now()
  ) INTO v_user_ids;

  IF array_length(v_user_ids, 1) IS NULL OR array_length(v_user_ids, 1) = 0 THEN
    RETURN 0;
  END IF;

  v_affected_count := array_length(v_user_ids, 1);

  -- Sensitive guard trigger'ını bypass et
  PERFORM set_config('app.sp_rpc_bypass', 'true', true);

  -- Profilleri Free'ye düşür
  UPDATE profiles
    SET subscription_tier = 'Free'
    WHERE id = ANY(v_user_ids);

  -- Etkilenen kullanıcıların canlı odalarını güncelle
  -- expires_at en geç 3 saat sonra olacak şekilde ayarla (Free süresi)
  UPDATE rooms
    SET owner_tier = 'Free',
        expires_at = LEAST(COALESCE(expires_at, 'infinity'::timestamptz), now() + interval '3 hours')
    WHERE host_id = ANY(v_user_ids)
      AND is_live = true;

  PERFORM set_config('app.sp_rpc_bypass', 'false', true);

  RETURN v_affected_count;
END;
$func$;

-- ──────────────────────────────────────────────────────────────────
-- 3) on_tier_downgrade_refresh_rooms — tier düşüşünde oda güncelle
-- ──────────────────────────────────────────────────────────────────
-- profiles.subscription_tier yüksek→düşük geçişinde canlı odaların
-- owner_tier ve expires_at değerlerini yeni tier'a göre yeniden hesapla.
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.on_tier_downgrade_refresh_rooms()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  v_old_rank int;
  v_new_rank int;
  v_new_expires interval;
BEGIN
  -- ★ v1.7.13.142: Tier sıralama — düşüş tespiti için
  v_old_rank := CASE OLD.subscription_tier
    WHEN 'Pro' THEN 3 WHEN 'GodMaster' THEN 3
    WHEN 'Plus' THEN 2
    ELSE 1
  END;
  v_new_rank := CASE NEW.subscription_tier
    WHEN 'Pro' THEN 3 WHEN 'GodMaster' THEN 3
    WHEN 'Plus' THEN 2
    ELSE 1
  END;

  -- Sadece düşüşte tetikle (yükselişte müdahale yok)
  IF v_new_rank >= v_old_rank THEN
    RETURN NEW;
  END IF;

  -- Yeni tier'a göre süre hesapla (Free=3h, Plus=8h, Pro=null yani sınırsız)
  v_new_expires := CASE NEW.subscription_tier
    WHEN 'Pro' THEN NULL
    WHEN 'Plus' THEN interval '8 hours'
    ELSE interval '3 hours'
  END;

  -- Etkilenen kullanıcının canlı odalarını güncelle
  UPDATE rooms
    SET owner_tier = NEW.subscription_tier,
        expires_at = CASE
          WHEN v_new_expires IS NULL THEN NULL
          -- ★ LEAST(NULL, x) = NULL olur — Pro'dan düşüşte expires_at NULL ise
          -- COALESCE ile far-future'a çevir ki LEAST doğru çalışsın
          ELSE LEAST(COALESCE(expires_at, 'infinity'::timestamptz), now() + v_new_expires)
        END
    WHERE host_id = NEW.id
      AND is_live = true;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_on_tier_downgrade_refresh_rooms ON public.profiles;
CREATE TRIGGER trg_on_tier_downgrade_refresh_rooms
  AFTER UPDATE OF subscription_tier ON public.profiles
  FOR EACH ROW
  WHEN (OLD.subscription_tier IS DISTINCT FROM NEW.subscription_tier)
  EXECUTE FUNCTION public.on_tier_downgrade_refresh_rooms();
