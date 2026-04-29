-- ════════════════════════════════════════════════════════════════════
-- v72 — Performance indexes (pre-launch query hot-path)
--
-- Beklenen ilk hafta yükü: 1k-10k user, 100-1000 oda eş zamanlı.
-- DM inbox / bildirim listesi / arkadaş lookup / SP geçmişi sıcak path'ler.
--
-- Tüm index'ler IF NOT EXISTS — idempotent, mevcut DB'de tekrar uygulanırsa no-op.
-- CONCURRENTLY kullanmıyoruz: pre-launch volume düşük, lock kısa sürer.
-- ════════════════════════════════════════════════════════════════════

-- 1) DM inbox lookup: messages.or(sender_id.eq.X, receiver_id.eq.X)
--    Mevcut: yok. Sıcak path (her DM açılışta + realtime listener).
CREATE INDEX IF NOT EXISTS idx_messages_sender_created
  ON public.messages (sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_receiver_created
  ON public.messages (receiver_id, created_at DESC);

-- 2) Bildirim feed: notifications WHERE user_id = X AND is_read = false ORDER BY created_at
--    Partial index — okunmamış kayıtlar genelde küçük, full scan'i önler.
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE is_read = false;

-- 3) Friendship lookup (mutual check, follow request sayısı)
CREATE INDEX IF NOT EXISTS idx_friendships_user_status
  ON public.friendships (user_id, status);

CREATE INDEX IF NOT EXISTS idx_friendships_friend_status
  ON public.friendships (friend_id, status);

-- 4) Room participants presence (room view + heartbeat update)
CREATE INDEX IF NOT EXISTS idx_room_participants_room_user
  ON public.room_participants (room_id, user_id);

-- 5) SP transactions ledger
--    Tablo şeması: user_id (etkilenen kullanıcı), counterparty_id (karşı taraf, v51'de eklendi).
--    Kullanıcı geçmişi sıcak path: WHERE user_id = X ORDER BY created_at DESC.
CREATE INDEX IF NOT EXISTS idx_sp_transactions_user_created
  ON public.sp_transactions (user_id, created_at DESC);

-- counterparty_id index v51'de zaten var (idx_sp_tx_counterparty), tekrar yaratmıyoruz.
