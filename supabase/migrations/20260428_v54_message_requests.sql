-- ═══════════════════════════════════════════════════════════════════
-- v54 — message_requests tablosu (Instagram-style DM request flow)
-- Tarih: 2026-04-22
-- Amaç: Arkadaş olmayanlar arasında mesaj isteği akışı. Gönderen
--   1 "request" mesajı atabilir, receiver accept edene kadar ekstra
--   mesaj gönderemez. Accept sonrası normal chat açılır.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS message_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  UNIQUE(sender_id, receiver_id)
);

-- Pending istekleri hızlı çekmek için
CREATE INDEX IF NOT EXISTS idx_message_requests_receiver_pending
  ON message_requests(receiver_id, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_message_requests_sender
  ON message_requests(sender_id, status);

ALTER TABLE message_requests ENABLE ROW LEVEL SECURITY;

-- ★ Firebase auth pattern (diğer tablolarla tutarlı): permissive RLS, uygulama
--   tarafı kontrolü yapar. auth.uid() Firebase JWT ile NULL döndüğü için
--   katı policy'ler bozuyor (v52_room_invites_rls_permissive.sql pattern'ı).
DROP POLICY IF EXISTS message_requests_all ON message_requests;
CREATE POLICY message_requests_all ON message_requests
  FOR ALL USING (true) WITH CHECK (true);

-- Doğrulama:
-- SELECT * FROM message_requests LIMIT 1;
-- INSERT INTO message_requests (sender_id, receiver_id) VALUES ('uid_a', 'uid_b');
