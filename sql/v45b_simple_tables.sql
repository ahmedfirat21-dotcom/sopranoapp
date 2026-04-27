-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v45b — Basit RLS migration (tek-yönlü user_id eşleşmesi)
--
-- 6 tablo, 12 policy. Hepsi pattern: (auth.uid())::text = X
-- app_uid() helper'ına çeviriyoruz. Davranış değişmez (JWKS henüz kurulmadı).
-- ════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── posts ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can update own posts" ON public.posts;
CREATE POLICY "Users can update own posts" ON public.posts FOR UPDATE
  USING (app_uid() = user_id);

-- ─── rate_limits ──────────────────────────────────────────
DROP POLICY IF EXISTS "rate_limits_self_read" ON public.rate_limits;
CREATE POLICY "rate_limits_self_read" ON public.rate_limits FOR SELECT
  USING (app_uid() = user_id);

-- ─── xp_log ───────────────────────────────────────────────
DROP POLICY IF EXISTS "xp_select" ON public.xp_log;
CREATE POLICY "xp_select" ON public.xp_log FOR SELECT
  USING (user_id = app_uid());

-- ─── user_badges ──────────────────────────────────────────
DROP POLICY IF EXISTS "Users can earn badges" ON public.user_badges;
CREATE POLICY "Users can earn badges" ON public.user_badges FOR INSERT
  WITH CHECK (app_uid() = user_id);

-- ─── user_category_preferences ────────────────────────────
DROP POLICY IF EXISTS "Users can insert own preferences" ON public.user_category_preferences;
CREATE POLICY "Users can insert own preferences" ON public.user_category_preferences FOR INSERT
  WITH CHECK (app_uid() = user_id);

DROP POLICY IF EXISTS "Users can read own preferences" ON public.user_category_preferences;
CREATE POLICY "Users can read own preferences" ON public.user_category_preferences FOR SELECT
  USING (app_uid() = user_id);

DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_category_preferences;
CREATE POLICY "Users can update own preferences" ON public.user_category_preferences FOR UPDATE
  USING (app_uid() = user_id);

-- ─── user_store_purchases ─────────────────────────────────
DROP POLICY IF EXISTS "Users can insert own purchases" ON public.user_store_purchases;
CREATE POLICY "Users can insert own purchases" ON public.user_store_purchases FOR INSERT
  WITH CHECK (app_uid() = user_id);

DROP POLICY IF EXISTS "Users can view own purchases" ON public.user_store_purchases;
CREATE POLICY "Users can view own purchases" ON public.user_store_purchases FOR SELECT
  USING (app_uid() = user_id);

-- ─── room_followers ───────────────────────────────────────
DROP POLICY IF EXISTS "Users can follow rooms" ON public.room_followers;
CREATE POLICY "Users can follow rooms" ON public.room_followers FOR INSERT
  WITH CHECK (app_uid() = user_id);

DROP POLICY IF EXISTS "Users can unfollow rooms" ON public.room_followers;
CREATE POLICY "Users can unfollow rooms" ON public.room_followers FOR DELETE
  USING (app_uid() = user_id);

DROP POLICY IF EXISTS "room_followers_delete" ON public.room_followers;
CREATE POLICY "room_followers_delete" ON public.room_followers FOR DELETE
  USING (app_uid() = user_id);

DROP POLICY IF EXISTS "room_followers_insert" ON public.room_followers;
CREATE POLICY "room_followers_insert" ON public.room_followers FOR INSERT
  WITH CHECK (app_uid() = user_id);

-- ─── sp_transactions ──────────────────────────────────────
DROP POLICY IF EXISTS "SP transactions insertable" ON public.sp_transactions;
CREATE POLICY "SP transactions insertable" ON public.sp_transactions FOR INSERT
  WITH CHECK (app_uid() = user_id);

DROP POLICY IF EXISTS "SP transactions readable" ON public.sp_transactions;
CREATE POLICY "SP transactions readable" ON public.sp_transactions FOR SELECT
  USING (app_uid() = user_id);

COMMIT;
