-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v37 — followers_only RLS enforcement
--
-- Problem tespiti (2026-04-20):
--   room_settings.followers_only = true olan odalar için client-side
--   kontrolü (services/roomAccess.ts) mevcut ama RLS seviyesinde
--   doğrulama yoktu. Malicious client doğrudan room_participants INSERT
--   çağrısıyla arkadaş olmadan odaya girebilirdi.
--
-- Çözüm: v31 INSERT policy'sine followers_only clause'u eklenir. Eğer
-- oda followers_only=true ise, caller ya host'un kendisi olmalı ya da
-- host ile bidirectional 'accepted' friendship kaydı bulunmalıdır.
-- ════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════
-- 1. room_participants INSERT — followers_only clause
-- ═══════════════════════════════════════════════════
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'room_participants' AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON room_participants', pol.policyname);
  END LOOP;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE POLICY "participants_insert_guarded_v37" ON room_participants
  FOR INSERT WITH CHECK (
    -- Kimlik kontrolü
    auth.uid()::text = user_id

    -- Rol whitelist (v31 ile aynı)
    AND (
      role IN ('listener', 'spectator', 'pending_speaker', 'guest')
      OR (
        role = 'owner'
        AND EXISTS (
          SELECT 1 FROM rooms r
          WHERE r.id = room_participants.room_id
            AND r.host_id = auth.uid()::text
        )
      )
    )

    -- Ban kontrolü (v31 ile aynı)
    AND NOT EXISTS (
      SELECT 1 FROM room_bans b
      WHERE b.room_id = room_participants.room_id
        AND b.user_id = room_participants.user_id
        AND (b.expires_at IS NULL OR b.expires_at > now())
    )

    -- ★ YENİ: followers_only kontrolü
    -- Oda followers_only modundaysa, caller host olmalı ya da host ile
    -- herhangi bir yönde accepted friendship kaydı olmalı.
    AND (
      NOT EXISTS (
        SELECT 1 FROM rooms r
        WHERE r.id = room_participants.room_id
          AND COALESCE((r.room_settings->>'followers_only')::boolean, false) = true
          AND r.host_id != auth.uid()::text
      )
      OR EXISTS (
        SELECT 1 FROM rooms r
        JOIN friendships f ON (
          (f.user_id = auth.uid()::text AND f.friend_id = r.host_id)
          OR (f.user_id = r.host_id AND f.friend_id = auth.uid()::text)
        )
        WHERE r.id = room_participants.room_id
          AND f.status = 'accepted'
      )
    )
  );


-- ═══ DONE ═══
-- Test: followers_only=true olan odaya arkadaş olmayan kullanıcı
-- doğrudan INSERT atmaya çalışırsa 42501 (insufficient_privilege) dönmeli.
