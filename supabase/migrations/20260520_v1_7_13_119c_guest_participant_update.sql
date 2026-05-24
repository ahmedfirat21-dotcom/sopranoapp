-- ============================================================
-- v1.7.13.119c — Misafir room_participants UPDATE düzeltmesi
-- Misafir heartbeat last_seen_at update edebilmeli (ghost cleanup'a kaybolmasın)
-- AMA role'unu değiştiremesin (self-promote attack koruması)
-- ============================================================

BEGIN;

-- Eski politikayı kaldır (tüm UPDATE'leri bloke ediyordu)
DROP POLICY IF EXISTS guest_participants_no_self_update ON room_participants;

-- Yeni politika: misafir UPDATE yapabilir AMA new.role yalnızca listener/spectator olmalı
-- USING tüm row'lara izin vermez gibi görünür ama: USING + WITH CHECK kombinasyonu —
-- USING "hangi satırlar güncellenebilir" (kim güncelleyebilir), WITH CHECK "yeni hâl ne olabilir"
CREATE POLICY guest_participants_listener_only_update ON room_participants
  AS RESTRICTIVE
  FOR UPDATE TO public
  USING (
    NOT is_guest_user()
    OR user_id = app_uid()  -- misafir sadece kendi row'unu update edebilir
  )
  WITH CHECK (
    NOT is_guest_user()
    OR role IN ('listener', 'spectator')  -- yeni role yalnızca listener/spectator
  );

COMMIT;
