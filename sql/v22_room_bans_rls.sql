-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v22 — room_bans RLS Sıkılaştırma (Y14)
--
-- v13'te `USING(true)` olarak açılan room_bans politikaları:
--   - Herhangi bir kullanıcı başkasının ban'ını silebiliyor (kendi ban'ını da!)
--   - Herhangi bir kullanıcı başkasına ban ekleyebiliyor
--   - Herhangi bir kullanıcı ban'ları düzenleyebiliyor
--
-- Düzeltme:
--   - SELECT: herkese açık (kullanıcı kendi ban durumunu kontrol edebilmeli)
--   - INSERT/UPDATE/DELETE: sadece rooms.host_id veya room_participants
--     içindeki owner/moderator rolü olan kullanıcı
-- ════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "bans_select" ON room_bans';
  EXECUTE 'DROP POLICY IF EXISTS "bans_insert" ON room_bans';
  EXECUTE 'DROP POLICY IF EXISTS "bans_update" ON room_bans';
  EXECUTE 'DROP POLICY IF EXISTS "bans_delete" ON room_bans';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- SELECT: herkes okuyabilir (kendi ban durumunu öğrenmek için)
CREATE POLICY "bans_select_public" ON room_bans
  FOR SELECT USING (true);

-- INSERT: owner veya moderator
CREATE POLICY "bans_insert_mod_only" ON room_bans
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM rooms r
      WHERE r.id = room_bans.room_id AND r.host_id = auth.uid()::text
    )
    OR EXISTS (
      SELECT 1 FROM room_participants rp
      WHERE rp.room_id = room_bans.room_id
        AND rp.user_id = auth.uid()::text
        AND rp.role IN ('owner', 'moderator')
    )
  );

-- UPDATE: owner veya moderator
CREATE POLICY "bans_update_mod_only" ON room_bans
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM rooms r
      WHERE r.id = room_bans.room_id AND r.host_id = auth.uid()::text
    )
    OR EXISTS (
      SELECT 1 FROM room_participants rp
      WHERE rp.room_id = room_bans.room_id
        AND rp.user_id = auth.uid()::text
        AND rp.role IN ('owner', 'moderator')
    )
  );

-- DELETE (unban): owner veya moderator
CREATE POLICY "bans_delete_mod_only" ON room_bans
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM rooms r
      WHERE r.id = room_bans.room_id AND r.host_id = auth.uid()::text
    )
    OR EXISTS (
      SELECT 1 FROM room_participants rp
      WHERE rp.room_id = room_bans.room_id
        AND rp.user_id = auth.uid()::text
        AND rp.role IN ('owner', 'moderator')
    )
  );

-- ═══ DONE ═══
-- services/moderation.ts unbanFromRoom için host/mod kontrolü zaten var
-- (_requireRole), ama RLS güvenlik ağı olarak bunu DB'de de enforce ediyor.
