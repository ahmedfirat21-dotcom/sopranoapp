-- ═══════════════════════════════════════════════════════════════
-- DEV/TEST: Burak DENİZ — Plus tier + 14 rozet
-- ═══════════════════════════════════════════════════════════════
-- Sadece test ortamı için. Production'da kullanıcı tier'ı genelde
-- RevenueCat purchase event'iyle güncellenir. Bu migration kalıcıdır
-- ama idempotent — birden fazla kez çalıştırılabilir.
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_user_id TEXT;
  v_badge_id TEXT;
  v_badge_ids TEXT[] := ARRAY[
    'early_adopter',
    'host_1', 'host_10', 'host_100',
    'social_butterfly', 'popular',
    'sp_donor', 'sp_whale',
    'stage_pro',
    'verified', 'staff', 'beta_tester',
    'streak_7', 'streak_30'
  ];
BEGIN
  -- ── Burak DENİZ'i bul ──
  SELECT id INTO v_user_id FROM public.profiles
  WHERE username = '44burakdeniz_dv9z'
     OR (display_name ILIKE 'Burak%DENİZ%' OR display_name ILIKE 'Burak%Deniz%')
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Burak DENİZ kullanıcısı bulunamadı (username=44burakdeniz_dv9z veya display_name LIKE Burak DENİZ).';
  END IF;

  RAISE NOTICE 'Burak DENİZ user_id: %', v_user_id;

  -- ── Subscription tier → Plus ──
  UPDATE public.profiles
  SET subscription_tier = 'Plus',
      updated_at = NOW()
  WHERE id = v_user_id;

  RAISE NOTICE '✓ subscription_tier = Plus';

  -- ── 14 rozeti hep birden ver (idempotent) ──
  FOREACH v_badge_id IN ARRAY v_badge_ids LOOP
    INSERT INTO public.user_badges (user_id, badge_id, awarded_at)
    VALUES (v_user_id, v_badge_id, NOW())
    ON CONFLICT (user_id, badge_id) DO NOTHING;
  END LOOP;

  RAISE NOTICE '✓ % rozet verildi (mevcut olanlar atlandı)', array_length(v_badge_ids, 1);
END $$;
