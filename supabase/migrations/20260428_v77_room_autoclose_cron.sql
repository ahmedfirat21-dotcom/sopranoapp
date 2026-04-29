-- ════════════════════════════════════════════════════════════════════
-- v77: Free oda otomatik kapatma — sunucu tarafı pg_cron
-- ════════════════════════════════════════════════════════════════════
-- Problem: services/room.ts autoCloseExpired SADECE biri Keşfet tab'ında
--   açıkken her 2dk tetikleniyordu (cron yok). Düşük trafik saatlerinde
--   süresi dolan/30dk boş Free odalar saatlerce "is_live=true" görünüyordu
--   (sahte canlı oda). Erişim engelliydi (server-side check var) ama
--   keşfet listesinde göründüğü için kullanıcı deneyimi bozuluyordu.
--
-- Çözüm: pg_cron ile her 2 dakikada bir SQL fonksiyonu çalışır.
--   Kullanıcıdan bağımsız, 7/24 sunucu tarafı.
--
-- Mantık (TypeScript autoCloseExpired ile birebir):
--   1. Free + expires_at <= now() → kapan
--   2. Free + 30+ dakika boş (created_at < now-30min, participant=0) → kapan
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Otomatik kapatma fonksiyonu ──────────────────────────────────
CREATE OR REPLACE FUNCTION close_expired_free_rooms()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  closed_count integer := 0;
  v_room_id text;
BEGIN
  -- ═══ 1. Free tier: expires_at süresi dolmuş odaları kapat ═══
  -- migrateLegacyTier mantığı: owner_tier NULL veya bilinmeyenler 'Free' kabul edilir.
  -- Plus/Pro/GodMaster muaf (mevcut TypeScript davranışıyla uyumlu).
  FOR v_room_id IN
    SELECT id FROM rooms
    WHERE is_live = true
      AND expires_at IS NOT NULL
      AND expires_at <= now()
      AND COALESCE(owner_tier, 'Free') NOT IN ('Plus', 'Pro', 'GodMaster')
  LOOP
    UPDATE rooms
      SET is_live = false, listener_count = 0
      WHERE id = v_room_id;
    DELETE FROM room_participants WHERE room_id = v_room_id;
    closed_count := closed_count + 1;
  END LOOP;

  -- ═══ 2. Free tier: 30+ dakika boş kalan odaları kapat ═══
  FOR v_room_id IN
    SELECT r.id
    FROM rooms r
    WHERE r.is_live = true
      AND r.created_at < now() - interval '30 minutes'
      AND COALESCE(r.owner_tier, 'Free') NOT IN ('Plus', 'Pro', 'GodMaster')
      AND NOT EXISTS (
        SELECT 1 FROM room_participants p WHERE p.room_id = r.id
      )
  LOOP
    UPDATE rooms
      SET is_live = false, listener_count = 0
      WHERE id = v_room_id;
    DELETE FROM room_participants WHERE room_id = v_room_id;
    closed_count := closed_count + 1;
  END LOOP;

  RETURN closed_count;
END;
$$;

-- ── 2. pg_cron schedule ─────────────────────────────────────────────
-- Mevcut bir schedule varsa önce sil (idempotent migration)
DO $$
BEGIN
  PERFORM cron.unschedule('auto-close-free-rooms')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'auto-close-free-rooms'
  );
EXCEPTION
  WHEN OTHERS THEN NULL; -- yoksa hata atma
END $$;

-- Her 2 dakikada bir çalıştır (mevcut TypeScript interval ile aynı sıklık)
SELECT cron.schedule(
  'auto-close-free-rooms',
  '*/2 * * * *',
  $$ SELECT close_expired_free_rooms(); $$
);

-- ── 3. Yetki ────────────────────────────────────────────────────────
-- Anon/authenticated rolünün bu fonksiyonu çağırmasına gerek yok
-- (sadece pg_cron sistem kullanıcısı çağırır). RLS bypass için
-- SECURITY DEFINER yeterli.
REVOKE ALL ON FUNCTION close_expired_free_rooms() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION close_expired_free_rooms() TO postgres;
