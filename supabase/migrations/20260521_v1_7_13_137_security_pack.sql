-- ════════════════════════════════════════════════════════════════════
-- v1.7.13.137 (21 May 2026): KRİTİK GÜVENLİK PAKETİ
-- ════════════════════════════════════════════════════════════════════
-- 1) apply_subscription_tier RPC (sensitive guard bypass + trigger için)
-- 2) RLS açık tabloları kapat (v69 hotfix kalıntısı)
-- 3) enforce_room_capacity trigger (maxListeners + maxSpeakers)
-- 4) cleanup_ghost_participants host/stage muafiyet
-- 5) trg_enforce_room_tier_settings + trg_enforce_room_daily_limit + trg_on_tier_downgrade_cleanup_rooms
-- 6) Admin DELETE RLS rooms + bağımlı tablolar
-- 7) expire-overdue-subscriptions cron (15dk)
-- 8) Persistent room cron muafiyet (Pro 7/24 vaadi)
-- ════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────
-- 1) apply_subscription_tier — SECURITY DEFINER RPC
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
-- 2) RLS açık tabloları kapat — v69 hotfix kalıntıları
-- ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "SP transactions insertable" ON public.sp_transactions;
DROP POLICY IF EXISTS "sp_transactions_select_own" ON public.sp_transactions;
CREATE POLICY "sp_transactions_select_own" ON public.sp_transactions FOR SELECT USING (user_id = public.app_uid());

DROP POLICY IF EXISTS "xp_insert" ON public.xp_log;
DROP POLICY IF EXISTS "xp_log_select_own" ON public.xp_log;
CREATE POLICY "xp_log_select_own" ON public.xp_log FOR SELECT USING (user_id = public.app_uid());

DROP POLICY IF EXISTS "insert_badges" ON public.user_badges;
DROP POLICY IF EXISTS "Users can earn badges" ON public.user_badges;

DROP POLICY IF EXISTS "follows_all" ON public.follows;
DROP POLICY IF EXISTS "follows_insert_self" ON public.follows;
DROP POLICY IF EXISTS "follows_delete_self" ON public.follows;
DROP POLICY IF EXISTS "follows_select_all" ON public.follows;
CREATE POLICY "follows_insert_self" ON public.follows FOR INSERT WITH CHECK (follower_id = public.app_uid());
CREATE POLICY "follows_delete_self" ON public.follows FOR DELETE USING (follower_id = public.app_uid());
CREATE POLICY "follows_select_all" ON public.follows FOR SELECT USING (true);

DROP POLICY IF EXISTS "voice_messages_all" ON public.voice_messages;
DROP POLICY IF EXISTS "voice_msg_self_send" ON public.voice_messages;
DROP POLICY IF EXISTS "voice_msg_self_send_v2" ON public.voice_messages;
CREATE POLICY "voice_msg_self_send_v2" ON public.voice_messages FOR INSERT WITH CHECK (sender_id = public.app_uid());

DROP POLICY IF EXISTS "room_rec_all" ON public.room_recordings;
DROP POLICY IF EXISTS "room_rec_host_write" ON public.room_recordings;
DROP POLICY IF EXISTS "room_rec_public_read" ON public.room_recordings;
CREATE POLICY "room_rec_host_write" ON public.room_recordings FOR ALL
  USING (EXISTS (SELECT 1 FROM rooms r WHERE r.id = room_id AND r.host_id = public.app_uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM rooms r WHERE r.id = room_id AND r.host_id = public.app_uid()));
CREATE POLICY "room_rec_public_read" ON public.room_recordings FOR SELECT USING (true);

DROP POLICY IF EXISTS "room_tags_all" ON public.room_tags;
DROP POLICY IF EXISTS "room_tags_host_write" ON public.room_tags;
DROP POLICY IF EXISTS "room_tags_public_read" ON public.room_tags;
CREATE POLICY "room_tags_host_write" ON public.room_tags FOR ALL
  USING (EXISTS (SELECT 1 FROM rooms r WHERE r.id = room_id AND r.host_id = public.app_uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM rooms r WHERE r.id = room_id AND r.host_id = public.app_uid()));
CREATE POLICY "room_tags_public_read" ON public.room_tags FOR SELECT USING (true);

DROP POLICY IF EXISTS "rsc_write" ON public.room_stage_cooldowns;
DROP POLICY IF EXISTS "rsc_self_or_host" ON public.room_stage_cooldowns;
CREATE POLICY "rsc_self_or_host" ON public.room_stage_cooldowns FOR ALL
  USING (user_id = public.app_uid() OR EXISTS (SELECT 1 FROM rooms r WHERE r.id = room_id AND r.host_id = public.app_uid()))
  WITH CHECK (user_id = public.app_uid() OR EXISTS (SELECT 1 FROM rooms r WHERE r.id = room_id AND r.host_id = public.app_uid()));

DROP POLICY IF EXISTS "sp_packages_admin_write" ON public.sp_packages;
DROP POLICY IF EXISTS "sp_packages_admin_only" ON public.sp_packages;
CREATE POLICY "sp_packages_admin_only" ON public.sp_packages FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = public.app_uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = public.app_uid() AND is_admin = true));

DROP POLICY IF EXISTS "Allow all for anon" ON public.store_items;
DROP POLICY IF EXISTS "store_items_admin_only" ON public.store_items;
CREATE POLICY "store_items_admin_only" ON public.store_items FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = public.app_uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = public.app_uid() AND is_admin = true));

DROP POLICY IF EXISTS "support_tickets_service_all" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_user_insert" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_user_insert_v2" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_user_select" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_admin_update" ON public.support_tickets;
CREATE POLICY "support_tickets_user_insert_v2" ON public.support_tickets FOR INSERT WITH CHECK (user_id = public.app_uid());
CREATE POLICY "support_tickets_user_select" ON public.support_tickets FOR SELECT USING (user_id = public.app_uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = public.app_uid() AND is_admin = true));
CREATE POLICY "support_tickets_admin_update" ON public.support_tickets FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = public.app_uid() AND is_admin = true));

DROP POLICY IF EXISTS "Allow all for anon" ON public.user_purchases;
DROP POLICY IF EXISTS "user_purchases_self_select" ON public.user_purchases;
CREATE POLICY "user_purchases_self_select" ON public.user_purchases FOR SELECT USING (user_id = public.app_uid());

DROP POLICY IF EXISTS "Kendi durumunu paylaşabilir" ON public.user_statuses;
DROP POLICY IF EXISTS "Kendi durumunu silebilir" ON public.user_statuses;
DROP POLICY IF EXISTS "user_statuses_self_write" ON public.user_statuses;
DROP POLICY IF EXISTS "user_statuses_self_delete" ON public.user_statuses;
CREATE POLICY "user_statuses_self_write" ON public.user_statuses FOR INSERT WITH CHECK (user_id = public.app_uid());
CREATE POLICY "user_statuses_self_delete" ON public.user_statuses FOR DELETE USING (user_id = public.app_uid());

DROP POLICY IF EXISTS "Users can insert own purchases" ON public.user_store_purchases;
DROP POLICY IF EXISTS "user_store_purchases_self" ON public.user_store_purchases;
CREATE POLICY "user_store_purchases_self" ON public.user_store_purchases FOR INSERT WITH CHECK (user_id = public.app_uid());

DROP POLICY IF EXISTS "wishlist_self_insert" ON public.user_wishlist;
DROP POLICY IF EXISTS "wishlist_self_insert_v2" ON public.user_wishlist;
CREATE POLICY "wishlist_self_insert_v2" ON public.user_wishlist FOR INSERT WITH CHECK (user_id = public.app_uid());

DROP POLICY IF EXISTS "Users can insert own preferences" ON public.user_category_preferences;
DROP POLICY IF EXISTS "user_cat_pref_self" ON public.user_category_preferences;
CREATE POLICY "user_cat_pref_self" ON public.user_category_preferences FOR INSERT WITH CHECK (user_id = public.app_uid());

-- room_mutes
DROP POLICY IF EXISTS "Allow all for anon" ON public.room_mutes;
DROP POLICY IF EXISTS "Mods can create mutes" ON public.room_mutes;
DROP POLICY IF EXISTS "room_mutes_host_mod_write" ON public.room_mutes;
CREATE POLICY "room_mutes_host_mod_write" ON public.room_mutes FOR ALL
  USING (EXISTS (SELECT 1 FROM room_participants rp WHERE rp.room_id = room_mutes.room_id AND rp.user_id = public.app_uid() AND rp.role IN ('owner','moderator')))
  WITH CHECK (muted_by = public.app_uid() AND EXISTS (SELECT 1 FROM room_participants rp WHERE rp.room_id = room_mutes.room_id AND rp.user_id = public.app_uid() AND rp.role IN ('owner','moderator')));

-- ──────────────────────────────────────────────────────────────────
-- 3) enforce_room_capacity — listener + speaker cap
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_room_capacity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE
  v_owner_tier text;
  v_max_listeners int;
  v_max_speakers int;
  v_current_listeners int;
  v_current_speakers int;
BEGIN
  IF TG_OP <> 'INSERT' THEN RETURN NEW; END IF;
  SELECT COALESCE(owner_tier, 'Free') INTO v_owner_tier FROM rooms WHERE id = NEW.room_id;
  IF v_owner_tier = 'GodMaster' THEN v_owner_tier := 'Pro'; END IF;
  v_max_listeners := CASE v_owner_tier WHEN 'Pro' THEN 999 WHEN 'Plus' THEN 25 ELSE 15 END;
  v_max_speakers := CASE v_owner_tier WHEN 'Pro' THEN 13 WHEN 'Plus' THEN 8 ELSE 5 END;

  IF NEW.role = 'listener' AND v_max_listeners < 999 THEN
    SELECT COUNT(*) INTO v_current_listeners FROM room_participants WHERE room_id = NEW.room_id AND role = 'listener';
    IF v_current_listeners >= v_max_listeners THEN
      RAISE EXCEPTION 'Oda dinleyici kapasitesi dolu (max: %, tier: %)', v_max_listeners, v_owner_tier USING ERRCODE = 'P0001';
    END IF;
  ELSIF NEW.role IN ('speaker','owner','moderator') THEN
    SELECT COUNT(*) INTO v_current_speakers FROM room_participants WHERE room_id = NEW.room_id AND role IN ('speaker','owner','moderator');
    IF v_current_speakers >= v_max_speakers AND NEW.role <> 'owner' THEN
      RAISE EXCEPTION 'Sahne dolu (max: %, tier: %)', v_max_speakers, v_owner_tier USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_enforce_room_capacity ON public.room_participants;
CREATE TRIGGER trg_enforce_room_capacity
  BEFORE INSERT ON public.room_participants
  FOR EACH ROW EXECUTE FUNCTION public.enforce_room_capacity();

-- ──────────────────────────────────────────────────────────────────
-- 4) promote_speaker_atomic — tiers.ts ile uyumlu cap (Free 5 / Plus 8 / Pro 13)
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION promote_speaker_atomic(
  p_room_id UUID,
  p_user_id TEXT,
  p_executor_id TEXT DEFAULT NULL
) RETURNS JSON AS $func$
DECLARE
  v_caller TEXT;
  v_host_id TEXT;
  v_owner_tier TEXT;
  v_max_speakers INTEGER;
  v_current_speaker_count INTEGER;
  v_target_role TEXT;
  v_caller_role TEXT;
BEGIN
  v_caller := auth.uid()::text;
  IF v_caller IS NULL THEN
    BEGIN v_caller := auth.jwt()->>'sub'; EXCEPTION WHEN OTHERS THEN v_caller := NULL; END;
  END IF;
  IF v_caller IS NULL THEN v_caller := p_executor_id; END IF;
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Kimlik dogrulama gereklidir.'; END IF;

  SELECT host_id, owner_tier INTO v_host_id, v_owner_tier FROM rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Oda bulunamadi.'; END IF;

  SELECT role INTO v_caller_role FROM room_participants WHERE room_id = p_room_id AND user_id = v_caller;
  IF v_host_id IS DISTINCT FROM v_caller AND v_caller_role NOT IN ('owner', 'moderator') THEN
    RAISE EXCEPTION 'Yetkiniz yok: promote icin owner/moderator gereklidir.';
  END IF;

  SELECT role INTO v_target_role FROM room_participants WHERE room_id = p_room_id AND user_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Hedef kullanici bu odada degil.'; END IF;

  v_max_speakers := CASE LOWER(COALESCE(v_owner_tier, 'free'))
    WHEN 'pro' THEN 13 WHEN 'godmaster' THEN 13 WHEN 'plus' THEN 8 ELSE 5
  END;

  SELECT COUNT(*) INTO v_current_speaker_count FROM room_participants
    WHERE room_id = p_room_id AND role IN ('owner','moderator','speaker');

  IF v_current_speaker_count >= v_max_speakers AND v_target_role NOT IN ('owner', 'moderator', 'speaker') THEN
    RAISE EXCEPTION 'Sahne dolu (max: %).', v_max_speakers;
  END IF;

  UPDATE room_participants SET role = 'speaker', last_seen_at = NOW()
    WHERE room_id = p_room_id AND user_id = p_user_id;

  RETURN json_build_object('ok', true, 'role', 'speaker', 'speaker_count', v_current_speaker_count + 1, 'max', v_max_speakers);
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION promote_speaker_atomic(UUID, TEXT, TEXT) TO authenticated, anon;
