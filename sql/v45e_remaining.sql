-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v45e — Kalan policy'ler (5 tablo, 9 policy)
-- ════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── blocked_users ────────────────────────────────────────
DROP POLICY IF EXISTS "Users can read own blocks" ON public.blocked_users;
CREATE POLICY "Users can read own blocks" ON public.blocked_users FOR SELECT
  USING (app_uid() = blocker_id);

DROP POLICY IF EXISTS "Users can block others" ON public.blocked_users;
CREATE POLICY "Users can block others" ON public.blocked_users FOR INSERT
  WITH CHECK (app_uid() = blocker_id);

DROP POLICY IF EXISTS "Users can unblock others" ON public.blocked_users;
CREATE POLICY "Users can unblock others" ON public.blocked_users FOR DELETE
  USING (app_uid() = blocker_id);

-- ─── cashout_requests ─────────────────────────────────────
DROP POLICY IF EXISTS "co_select" ON public.cashout_requests;
CREATE POLICY "co_select" ON public.cashout_requests FOR SELECT
  USING (user_id = app_uid());

DROP POLICY IF EXISTS "co_insert" ON public.cashout_requests;
CREATE POLICY "co_insert" ON public.cashout_requests FOR INSERT
  WITH CHECK (user_id = app_uid());

-- ─── conversation_state ───────────────────────────────────
DROP POLICY IF EXISTS "conv_state_read" ON public.conversation_state;
CREATE POLICY "conv_state_read" ON public.conversation_state FOR SELECT
  USING (user_id = app_uid());

DROP POLICY IF EXISTS "conv_state_write" ON public.conversation_state;
CREATE POLICY "conv_state_write" ON public.conversation_state FOR ALL
  USING (user_id = app_uid())
  WITH CHECK (user_id = app_uid());

-- ─── creator_earnings (host_id, not user_id) ─────────────
DROP POLICY IF EXISTS "earnings_self_read" ON public.creator_earnings;
CREATE POLICY "earnings_self_read" ON public.creator_earnings FOR SELECT
  USING (host_id = app_uid());

-- ─── daily_checkins (insert) ──────────────────────────────
DROP POLICY IF EXISTS "Users can insert own checkins" ON public.daily_checkins;
CREATE POLICY "Users can insert own checkins" ON public.daily_checkins FOR INSERT
  WITH CHECK (app_uid() = user_id);

COMMIT;
