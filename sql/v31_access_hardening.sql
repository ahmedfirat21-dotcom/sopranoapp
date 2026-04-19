-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v31 — Access Hardening (RLS + Trigger Sıkılaştırma)
--
-- Problem tespiti (2026-04-18):
--   1. room_participants INSERT → role field validasyonsuz. Client doğrudan
--      `{role:'owner'}` insert edebiliyordu. v19 trigger yalnızca UPDATE'te
--      çalışıyor, INSERT'i görmüyordu.
--   2. room_participants INSERT → ban check regression. v13'teki policy
--      `participants_insert_with_ban_check` vardı, v16 `Users can join rooms`
--      ile OR'landığı için user_id eşleştiğinde ban check bypass ediliyordu
--      (PG'de aynı command'teki policy'ler OR mantığıyla birleşir).
--   3. messages INSERT → room_id doğrulanmıyor. Client istediği oda ID'sine
--      mesaj atabiliyordu; chat_muted flag enforce edilmiyordu.
--
-- Çözüm: Tek bir kapsamlı INSERT policy (OR değil, AND ile birleşik):
--   room_participants:
--     - user_id = auth.uid()
--     - role whitelisted: listener/spectator/pending_speaker/guest
--       VEYA role='owner' AND rooms.host_id=auth.uid() (create-room flow korunur)
--     - banlı değil
--   messages:
--     - sender_id = auth.uid()
--     - room_id NULL (DM) VEYA katılımcı + chat_muted=false
-- ════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════
-- 1. room_participants INSERT — Tek kapsamlı policy
-- ═══════════════════════════════════════════════════
-- Mevcut tüm INSERT policy'lerini temizle (v13, v16 kalıntıları)
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

CREATE POLICY "participants_insert_guarded_v31" ON room_participants
  FOR INSERT WITH CHECK (
    -- Kimlik kontrolü: sadece kendi user_id'siyle insert yapabilir
    auth.uid()::text = user_id

    -- Rol whitelist: yeni katılımcı yalnızca alt-yetki rollerinden biri olabilir
    -- (speaker/moderator/owner RPC veya UPDATE ile atanır — INSERT üzerinden değil)
    AND (
      role IN ('listener', 'spectator', 'pending_speaker', 'guest')
      -- İstisna: Oda yaratma akışında host owner rolünde katılımcı olarak eklenir.
      -- Bu sadece rooms.host_id = auth.uid() ise mümkün; aksi halde reddedilir.
      OR (
        role = 'owner'
        AND EXISTS (
          SELECT 1 FROM rooms r
          WHERE r.id = room_participants.room_id
            AND r.host_id = auth.uid()::text
        )
      )
    )

    -- Ban kontrolü: geçerli bir ban varsa INSERT reddedilir
    AND NOT EXISTS (
      SELECT 1 FROM room_bans b
      WHERE b.room_id = room_participants.room_id
        AND b.user_id = room_participants.user_id
        AND (b.expires_at IS NULL OR b.expires_at > now())
    )
  );


-- ═══════════════════════════════════════════════════
-- 2. messages INSERT — room_id doğrulama + chat_muted
-- ═══════════════════════════════════════════════════
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'messages' AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON messages', pol.policyname);
  END LOOP;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE POLICY "messages_insert_guarded_v31" ON messages
  FOR INSERT WITH CHECK (
    auth.uid()::text = sender_id
    AND (
      -- DM mesajı: room_id NULL, receiver_id set. receiver_id bazlı kısıtlama yok
      -- (block kontrolü services/messages.ts'te yapılıyor).
      (room_id IS NULL AND receiver_id IS NOT NULL)
      OR
      -- Oda mesajı: gönderen o odada katılımcı olmalı ve chat_muted olmamalı
      (room_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM room_participants rp
        WHERE rp.room_id = messages.room_id
          AND rp.user_id = auth.uid()::text
          AND COALESCE(rp.is_chat_muted, false) = false
      ))
    )
  );


-- ═══════════════════════════════════════════════════
-- 3. BEFORE INSERT role escalation guard (trigger)
-- ═══════════════════════════════════════════════════
-- Policy yeterli olsa da defence-in-depth: SECURITY DEFINER RPC'ler bypass
-- edebildiği için tutarlılık adına trigger da INSERT'i dinlesin. Güvenli RPC'ler
-- (claim_host, transfer_host_atomic) set_config('app.role_change_authorized','true')
-- bayrağı ile geçiş yaparlar.
CREATE OR REPLACE FUNCTION prevent_role_insert_escalation()
RETURNS TRIGGER AS $$
DECLARE
  v_caller TEXT;
  v_authorized TEXT;
  v_host_id TEXT;
BEGIN
  v_caller := auth.uid()::text;
  -- Service-role veya RPC bypass
  IF v_caller IS NULL THEN RETURN NEW; END IF;

  BEGIN
    v_authorized := current_setting('app.role_change_authorized', true);
  EXCEPTION WHEN OTHERS THEN v_authorized := NULL;
  END;
  IF v_authorized = 'true' THEN RETURN NEW; END IF;

  -- Whitelist rolleri zaten politika ile geçiyor; burada sadece owner special case
  IF NEW.role IN ('listener', 'spectator', 'pending_speaker', 'guest') THEN
    RETURN NEW;
  END IF;

  -- owner: rooms.host_id eşleşmeli
  IF NEW.role = 'owner' THEN
    SELECT host_id INTO v_host_id FROM rooms WHERE id = NEW.room_id;
    IF v_host_id IS NOT DISTINCT FROM v_caller THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'Role INSERT reddedildi: % rolünde doğrudan katılım izni yok. Owner/moderator promote etmeli.',
    NEW.role USING ERRCODE = '42501';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_role_insert_escalation ON room_participants;
CREATE TRIGGER trg_prevent_role_insert_escalation
  BEFORE INSERT ON room_participants
  FOR EACH ROW
  EXECUTE FUNCTION prevent_role_insert_escalation();


-- ═══ DONE ═══
-- Regresyonu önleme: Bu migration sonrası kullanıcılar hiçbir şekilde kendilerini
-- owner/moderator/speaker olarak INSERT edemez. Speaker/mod promote UPDATE ile
-- v19 trigger'ından geçer. Owner INSERT yalnızca create-room flow'unda
-- (rooms.host_id zaten yazılmış) mümkündür.
