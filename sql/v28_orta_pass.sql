-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v28 — ORTA öncelik SQL passı
--   - Username unique constraint
--   - Realtime publication room_bans + sp_transactions ekle
--   - Boost auto-expire RPC (profile_boost_cleanup)
-- ════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════
-- 1. profiles.username UNIQUE constraint (ORTA-A)
-- ═══════════════════════════════════════════════════
-- Mevcut veride duplicate varsa hepsini bırak, sadece unique index ekle (partial)
-- NULL olanlar hariç tutulur (username henüz seçilmemiş kullanıcılar).
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique
  ON profiles (LOWER(username))
  WHERE username IS NOT NULL AND username <> '';


-- ═══════════════════════════════════════════════════
-- 2. Realtime publication (ORTA-N)
-- ═══════════════════════════════════════════════════
DO $$ BEGIN
  -- room_bans realtime'a eklensin (unban broadcast client'a ulaşsın)
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE room_bans';
  EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN
    RAISE NOTICE 'supabase_realtime publication yok, atlandı';
  END;

  -- sp_transactions realtime'a eklensin (leaderboard realtime dinliyor)
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE sp_transactions';
  EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
  END;
END $$;


-- ═══════════════════════════════════════════════════
-- 3. Boost auto-expire RPC (ORTA-O)
-- ═══════════════════════════════════════════════════
-- Süresi dolmuş profile ve room boost'larını temizler.
-- pg_cron veya manuel çağrı (_layout.tsx startup'ta günde 1x).
CREATE OR REPLACE FUNCTION cleanup_expired_boosts()
RETURNS JSON AS $$
DECLARE
  v_profile_cleaned INTEGER := 0;
  v_room_cleaned INTEGER := 0;
BEGIN
  -- Profil boost'ları
  BEGIN
    WITH expired AS (
      UPDATE profiles
        SET boost_expires_at = NULL
        WHERE boost_expires_at IS NOT NULL AND boost_expires_at < now()
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_profile_cleaned FROM expired;
  EXCEPTION WHEN undefined_column THEN NULL;
  END;

  -- Oda boost'ları
  BEGIN
    WITH expired AS (
      UPDATE rooms
        SET boost_expires_at = NULL
        WHERE boost_expires_at IS NOT NULL AND boost_expires_at < now()
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_room_cleaned FROM expired;
  EXCEPTION WHEN undefined_column THEN NULL;
  END;

  RETURN json_build_object(
    'profile_boosts_cleaned', v_profile_cleaned,
    'room_boosts_cleaned', v_room_cleaned
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════
-- 4. (ORTA-G) Block cooldown: block sonrası follow_rejected notification
-- ═══════════════════════════════════════════════════
-- Mevcut cooldown mekanizması follow_rejected notification'a bakıyor.
-- Block yapıldığında otomatik cooldown entry'si de ekle (24h re-request engeli).
-- Trigger: blocked_users INSERT → notifications ekle (cooldown için)
CREATE OR REPLACE FUNCTION _on_block_cooldown_entry()
RETURNS TRIGGER AS $$
BEGIN
  -- NEW.blocker_id blokladı NEW.blocked_id'yi. Yani blocked_id artık
  -- blocker_id'ye follow_rejected cooldown'ında olsun — re-request 24h.
  INSERT INTO notifications (user_id, sender_id, type, body, created_at)
  VALUES (NEW.blocked_id, NEW.blocker_id, 'follow_rejected', 'block cooldown', now())
  ON CONFLICT DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN undefined_table OR undefined_column THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_block_cooldown ON blocked_users;
  CREATE TRIGGER trg_block_cooldown
    AFTER INSERT ON blocked_users
    FOR EACH ROW
    EXECUTE FUNCTION _on_block_cooldown_entry();
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'blocked_users tablosu yok, trigger atlandı';
END $$;

-- ═══ DONE ═══
