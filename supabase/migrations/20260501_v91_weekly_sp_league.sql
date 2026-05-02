-- ════════════════════════════════════════════════════════════
-- v91 (1 May 2026): Haftalık SP Ligi — yarış motoru
-- ════════════════════════════════════════════════════════════
--
-- SP kıymet döngüsü roadmap'inin 4. paketi. Kullanıcının "daha çok SP
-- nasıl kazanırım?" sorusuna cevap: haftalık 3 kategoride lider tablosu
-- + top 3'e otomatik SP ödülü.
--
-- 3 kategori (UI'da tab olarak):
--   - Top Cömert: en çok bağış yapan (donation_sent SUM)
--   - Top Kazanan: en çok SP kazanan (positive amount SUM)
--   - Top Host: en aktif oda sahibi (host_id GROUP BY rooms)
--
-- Cron: pazartesi 06:00 UTC → önceki haftanın top 3 cömerti +
-- top 3 kazananı + top 3 host'u SP ödülü alır (100/50/25 tiers).
-- Toplamda 9 ödül dağıtılır, sp_transactions'a log düşer.
--
-- UI: leaderboard.tsx anlık RPC çağrılarıyla cari haftanın listesini
-- gösterir (cache'lenmez, haftada 1 kez sorgulanır).

-- ════════════════════════════════════════════════════════════
-- 1. RPC'ler — UI'nın anlık çağırdığı liste fonksiyonları
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.weekly_top_donors(p_limit int DEFAULT 10)
RETURNS TABLE(
  user_id text,
  total_sp bigint,
  display_name text,
  avatar_url text,
  subscription_tier text,
  rnk int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.user_id,
    SUM(ABS(s.amount))::bigint AS total_sp,
    p.display_name,
    p.avatar_url,
    p.subscription_tier,
    ROW_NUMBER() OVER (ORDER BY SUM(ABS(s.amount)) DESC)::int AS rnk
  FROM public.sp_transactions s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  WHERE s.type = 'donation_sent'
    AND s.created_at >= date_trunc('week', (now() AT TIME ZONE 'UTC'))
  GROUP BY s.user_id, p.display_name, p.avatar_url, p.subscription_tier
  ORDER BY total_sp DESC
  LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.weekly_top_earners(p_limit int DEFAULT 10)
RETURNS TABLE(
  user_id text,
  total_sp bigint,
  display_name text,
  avatar_url text,
  subscription_tier text,
  rnk int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.user_id,
    SUM(s.amount)::bigint AS total_sp,
    p.display_name,
    p.avatar_url,
    p.subscription_tier,
    ROW_NUMBER() OVER (ORDER BY SUM(s.amount) DESC)::int AS rnk
  FROM public.sp_transactions s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  WHERE s.amount > 0
    AND s.type NOT IN ('donation_received')  -- bağış alımları dışarıda; "kazanım" = aktif üretim
    AND s.created_at >= date_trunc('week', (now() AT TIME ZONE 'UTC'))
  GROUP BY s.user_id, p.display_name, p.avatar_url, p.subscription_tier
  ORDER BY total_sp DESC
  LIMIT p_limit;
$$;

-- ★ NOT: peak_listener_count kolonu yok; live `listener_count` kapanışta 0'a
--   sıfırlandığı için snapshot SUM güvenilmez. Bu yüzden host sıralaması
--   "kim hafta içinde daha çok oda açtı" baz alınır (room_count). Post-launch
--   peak_listener_count kolonu eklenince total_listeners metriğine dönüştürülecek.
CREATE OR REPLACE FUNCTION public.weekly_top_hosts(p_limit int DEFAULT 10)
RETURNS TABLE(
  user_id text,
  room_count bigint,
  display_name text,
  avatar_url text,
  subscription_tier text,
  rnk int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.host_id AS user_id,
    COUNT(*)::bigint AS room_count,
    p.display_name,
    p.avatar_url,
    p.subscription_tier,
    ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC)::int AS rnk
  FROM public.rooms r
  LEFT JOIN public.profiles p ON p.id = r.host_id
  WHERE r.created_at >= date_trunc('week', (now() AT TIME ZONE 'UTC'))
  GROUP BY r.host_id, p.display_name, p.avatar_url, p.subscription_tier
  ORDER BY room_count DESC
  LIMIT p_limit;
$$;

-- ════════════════════════════════════════════════════════════
-- 2. Cron — pazartesi sabah 06:00 UTC, önceki haftanın ödülleri
-- ════════════════════════════════════════════════════════════
-- Top 3 her kategoride: 100 / 50 / 25 SP

CREATE OR REPLACE FUNCTION public.distribute_weekly_sp_rewards()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rewards int[] := ARRAY[100, 50, 25];
  v_week_start timestamptz := date_trunc('week', (now() AT TIME ZONE 'UTC')) - interval '7 days';
  v_week_end   timestamptz := date_trunc('week', (now() AT TIME ZONE 'UTC'));
  rec record;
  granted int := 0;
BEGIN
  -- ── Top 3 cömert (donation_sent) ──
  FOR rec IN
    SELECT user_id, rnk
    FROM (
      SELECT s.user_id, ROW_NUMBER() OVER (ORDER BY SUM(ABS(s.amount)) DESC)::int AS rnk
      FROM public.sp_transactions s
      WHERE s.type = 'donation_sent'
        AND s.created_at >= v_week_start
        AND s.created_at <  v_week_end
      GROUP BY s.user_id
    ) t
    WHERE rnk <= 3
  LOOP
    UPDATE public.profiles
      SET system_points = COALESCE(system_points, 0) + v_rewards[rec.rnk]
      WHERE id = rec.user_id;
    INSERT INTO public.sp_transactions (user_id, amount, type, description)
    VALUES (rec.user_id, v_rewards[rec.rnk], 'weekly_league_donor',
            'Haftalık Cömert Ligi #' || rec.rnk);
    granted := granted + 1;
  END LOOP;

  -- ── Top 3 kazanan (positive earnings, bağış alımı hariç) ──
  FOR rec IN
    SELECT user_id, rnk
    FROM (
      SELECT s.user_id, ROW_NUMBER() OVER (ORDER BY SUM(s.amount) DESC)::int AS rnk
      FROM public.sp_transactions s
      WHERE s.amount > 0
        AND s.type NOT IN ('donation_received', 'weekly_league_donor', 'weekly_league_earner', 'weekly_league_host')
        AND s.created_at >= v_week_start
        AND s.created_at <  v_week_end
      GROUP BY s.user_id
    ) t
    WHERE rnk <= 3
  LOOP
    UPDATE public.profiles
      SET system_points = COALESCE(system_points, 0) + v_rewards[rec.rnk]
      WHERE id = rec.user_id;
    INSERT INTO public.sp_transactions (user_id, amount, type, description)
    VALUES (rec.user_id, v_rewards[rec.rnk], 'weekly_league_earner',
            'Haftalık Kazanım Ligi #' || rec.rnk);
    granted := granted + 1;
  END LOOP;

  -- ── Top 3 host (oda sayısı baz; peak listener kolonu post-launch) ──
  FOR rec IN
    SELECT user_id, rnk
    FROM (
      SELECT r.host_id AS user_id,
             ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC)::int AS rnk
      FROM public.rooms r
      WHERE r.created_at >= v_week_start
        AND r.created_at <  v_week_end
      GROUP BY r.host_id
    ) t
    WHERE rnk <= 3
  LOOP
    UPDATE public.profiles
      SET system_points = COALESCE(system_points, 0) + v_rewards[rec.rnk]
      WHERE id = rec.user_id;
    INSERT INTO public.sp_transactions (user_id, amount, type, description)
    VALUES (rec.user_id, v_rewards[rec.rnk], 'weekly_league_host',
            'Haftalık Host Ligi #' || rec.rnk);
    granted := granted + 1;
  END LOOP;

  RETURN granted;
END;
$$;

-- Cron: pazartesi sabah 06:00 UTC (Türkiye 09:00)
-- Eski versiyonu varsa unschedule, sonra yeniden schedule
DO $$
BEGIN
  PERFORM cron.unschedule('distribute-weekly-sp-rewards');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'distribute-weekly-sp-rewards',
  '0 6 * * 1',
  $cron$SELECT public.distribute_weekly_sp_rewards()$cron$
);
