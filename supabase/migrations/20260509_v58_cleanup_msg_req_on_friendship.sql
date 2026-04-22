-- ═══════════════════════════════════════════════════════════════════
-- v58 — Arkadaşlık accepted olunca message_requests temizle
-- 2026-04-22
-- Amaç: İki kullanıcı eski DM isteğini reject etti → sonra arkadaş oldular →
--   rejected flag hâlâ duruyor, send() mesajı bloke ediyor. Arkadaşlık kurulunca
--   eski request kayıtlarını DELETE et → kullanıcı serbestçe mesaj atabilir.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION _cleanup_message_requests_on_friendship_accept()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' THEN
    DELETE FROM message_requests
    WHERE (sender_id = NEW.user_id AND receiver_id = NEW.friend_id)
       OR (sender_id = NEW.friend_id AND receiver_id = NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS friendship_accept_cleanup_msg_req ON friendships;
CREATE TRIGGER friendship_accept_cleanup_msg_req
  AFTER INSERT OR UPDATE ON friendships
  FOR EACH ROW
  WHEN (NEW.status = 'accepted')
  EXECUTE FUNCTION _cleanup_message_requests_on_friendship_accept();

-- Mevcut durum için backfill: şu an arkadaş olanlar arasındaki stale request'leri sil
DELETE FROM message_requests mr
WHERE EXISTS (
  SELECT 1 FROM friendships f
  WHERE f.status = 'accepted'
    AND ((f.user_id = mr.sender_id AND f.friend_id = mr.receiver_id)
      OR (f.user_id = mr.receiver_id AND f.friend_id = mr.sender_id))
);
