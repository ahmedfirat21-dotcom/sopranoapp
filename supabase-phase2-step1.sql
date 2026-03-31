-- ============================================
-- SopranoChat — Phase 2, Step 1: Follow/Unfollow & Profile
-- 1. Friendship triggers and constraints
-- ============================================

-- Create a function to automatically add a follow notification
CREATE OR REPLACE FUNCTION on_friendship_created()
RETURNS TRIGGER AS $$
BEGIN
  -- Follow (Arkadaş ekleme) durumunda bildirim at
  IF NEW.status = 'accepted' THEN
    -- Önce önceden yollanmış ve is_read=true/false olan aynı bildirimi sil
    -- Spami engellemek için (Sürekli unfollow/follow yapanları).
    DELETE FROM notifications 
    WHERE user_id = NEW.friend_id 
      AND sender_id = NEW.user_id 
      AND type = 'follow';

    -- Yeni bildirim yolla
    INSERT INTO notifications (user_id, sender_id, type, reference_id)
    VALUES (NEW.friend_id, NEW.user_id, 'follow', NEW.id); -- reference_id friendship tablosunun id'si
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'i oluştur
DROP TRIGGER IF EXISTS trigger_friendship_created ON friendships;
CREATE TRIGGER trigger_friendship_created
AFTER INSERT ON friendships
FOR EACH ROW
EXECUTE FUNCTION on_friendship_created();

-- Ayrıca Unfollow yapıldığında ilişkili bildirimi silelim (Eğer henüz okunmamışsa).
CREATE OR REPLACE FUNCTION on_friendship_deleted()
RETURNS TRIGGER AS $$
BEGIN
  -- Unfollow yapılmışsa follow bildirimini temizle (sadece silinmişse)
  DELETE FROM notifications 
  WHERE user_id = OLD.friend_id 
    AND sender_id = OLD.user_id 
    AND type = 'follow';

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_friendship_deleted ON friendships;
CREATE TRIGGER trigger_friendship_deleted
AFTER DELETE ON friendships
FOR EACH ROW
EXECUTE FUNCTION on_friendship_deleted();
