-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v42 — room_bans / room_mutes RLS JWT fallback
--
-- Problem (2026-04-20):
--   v22 RLS politikaları auth.uid()::text ile host_id karşılaştırıyor.
--   Firebase JWT bazı cihazlarda/durumlarda auth.uid() NULL döndürüyor
--   (token refresh anı, JWT parse edge case). Sonuç: INSERT reject edilir
--   ama ServiceLayer error'u silent catch ediliyor → kullanıcıya hiçbir
--   feedback verilmiyor. Ban "başarılı" görünüyor ama DB'de kayıt yok.
--   HostAccessPanel > Banlılar sekmesi boş kalıyor.
--
-- Çözüm: v39'un check_donation_rate_limit pattern'ı — auth.uid() NULL ise
--   auth.jwt()->>'sub' fallback. Aynı RLS güvenlik seviyesi korunur;
--   Firebase identity her koşulda yakalanır.
-- ════════════════════════════════════════════════════════════════════

BEGIN;

-- ──────────────────────────────────────────────
-- room_bans INSERT / UPDATE / DELETE
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "bans_insert_mod_only" ON room_bans;
DROP POLICY IF EXISTS "bans_update_mod_only" ON room_bans;
DROP POLICY IF EXISTS "bans_delete_mod_only" ON room_bans;

CREATE POLICY "bans_insert_mod_only" ON room_bans
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM rooms r
      WHERE r.id = room_bans.room_id
        AND (
          r.host_id = auth.uid()::text
          OR r.host_id = (auth.jwt()->>'sub')
        )
    )
    OR EXISTS (
      SELECT 1 FROM room_participants rp
      WHERE rp.room_id = room_bans.room_id
        AND (
          rp.user_id = auth.uid()::text
          OR rp.user_id = (auth.jwt()->>'sub')
        )
        AND rp.role IN ('owner', 'moderator')
    )
  );

CREATE POLICY "bans_update_mod_only" ON room_bans
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM rooms r
      WHERE r.id = room_bans.room_id
        AND (
          r.host_id = auth.uid()::text
          OR r.host_id = (auth.jwt()->>'sub')
        )
    )
    OR EXISTS (
      SELECT 1 FROM room_participants rp
      WHERE rp.room_id = room_bans.room_id
        AND (
          rp.user_id = auth.uid()::text
          OR rp.user_id = (auth.jwt()->>'sub')
        )
        AND rp.role IN ('owner', 'moderator')
    )
  );

CREATE POLICY "bans_delete_mod_only" ON room_bans
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM rooms r
      WHERE r.id = room_bans.room_id
        AND (
          r.host_id = auth.uid()::text
          OR r.host_id = (auth.jwt()->>'sub')
        )
    )
    OR EXISTS (
      SELECT 1 FROM room_participants rp
      WHERE rp.room_id = room_bans.room_id
        AND (
          rp.user_id = auth.uid()::text
          OR rp.user_id = (auth.jwt()->>'sub')
        )
        AND rp.role IN ('owner', 'moderator')
    )
  );

COMMIT;

-- ═══ DONE ═══
-- Test: ban insert (ProfileCard > Geçici/Kalıcı Ban), sonra:
--   SELECT count(*) FROM room_bans; -- > 0 olmalı
--   HostAccessPanel > Banlılar -- kullanıcı görünmeli
