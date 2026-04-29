-- ═══════════════════════════════════════════════════════════════
-- REVERT: Burak DENİZ test setup'ı geri al
-- ═══════════════════════════════════════════════════════════════
-- Bu DOSYA migration DEĞİL — yalnızca elle çalıştırma için.
-- Test bittikten ve gerçek production'a geçince çalıştır:
--   Supabase Dashboard → SQL Editor → bu dosyayı yapıştır → Run
--
-- Ne yapar:
--   1. Burak'ın subscription_tier'ını 'Free'ye çevirir (RevenueCat sync gerekir!)
--   2. dev test'inde verilen 14 rozeti siler
--
-- ⚠️ DİKKAT: RevenueCat'te Burak Plus iadesi yapılmadıysa tier inconsistency olur.
--     Sadece test bitince kullan, prod'da RC purchase aktifse SQL'i atlama.
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_user_id TEXT;
BEGIN
  SELECT id INTO v_user_id FROM public.profiles
  WHERE username = '44burakdeniz_dv9z'
     OR (display_name ILIKE 'Burak%DENİZ%' OR display_name ILIKE 'Burak%Deniz%')
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Burak DENİZ kullanıcısı bulunamadı.';
  END IF;

  -- 1. Subscription tier → Free (RevenueCat aktifse manuel iade gerek!)
  UPDATE public.profiles
  SET subscription_tier = 'Free',
      updated_at = NOW()
  WHERE id = v_user_id;

  -- 2. Test rozetlerini sil (sadece dev migration'ında verilenler)
  DELETE FROM public.user_badges
  WHERE user_id = v_user_id
    AND badge_id IN (
      'early_adopter', 'host_1', 'host_10', 'host_100',
      'social_butterfly', 'popular',
      'sp_donor', 'sp_whale',
      'stage_pro',
      'verified', 'staff', 'beta_tester',
      'streak_7', 'streak_30'
    );

  RAISE NOTICE '✓ Burak DENİZ test setup revert edildi: tier=Free, 14 rozet silindi.';
END $$;
