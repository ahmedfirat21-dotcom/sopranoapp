-- ═══════════════════════════════════════════════════════════════════
-- v47: Calls history table
-- ═══════════════════════════════════════════════════════════════════
-- Arama geçmişi için dedicated tablo. Önceden sadece `notifications` table'ında
-- missed call kayıtları tutuluyordu. Şimdi:
--   - Her arama (outgoing / incoming / missed / declined) kaydedilir
--   - Süre, durum, arayanın ID'si track edilir
--   - Chat ekranında full history gösterimi mümkün olur
--
-- Uyumluluk: notifications tablosu ile paralel çalışır, missed call notif'leri de ayrıca
-- oluşturulmaya devam eder (UI zaten onları kullanıyor).
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.calls (
    id              uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    caller_id       text            NOT NULL,
    receiver_id     text            NOT NULL,
    call_type       text            NOT NULL CHECK (call_type IN ('audio', 'video')),
    status          text            NOT NULL CHECK (status IN (
                                       'initiated',   -- Arama başlatıldı
                                       'ringing',     -- Zil çalıyor
                                       'accepted',    -- Cevaplandı
                                       'declined',    -- Reddedildi
                                       'missed',      -- Cevapsız (timeout)
                                       'ended',       -- Normal bitiş
                                       'failed',      -- Bağlantı hatası
                                       'busy'         -- Karşı taraf meşgul
                                    )),
    duration_seconds integer        NOT NULL DEFAULT 0,
    started_at      timestamptz     NOT NULL DEFAULT now(),
    ended_at        timestamptz     NULL,
    created_at      timestamptz     NOT NULL DEFAULT now(),
    -- Opsiyonel: LiveKit room ID — yeniden bağlanma / debug için
    livekit_room_id text            NULL
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_calls_caller_id    ON public.calls (caller_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_receiver_id  ON public.calls (receiver_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_status       ON public.calls (status) WHERE status = 'missed';

-- RLS: Sadece katılımcılar (caller veya receiver) kendi aramalarını görebilir
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- SELECT policy: caller veya receiver iseniz görürsünüz
DROP POLICY IF EXISTS "calls_select_participants" ON public.calls;
CREATE POLICY "calls_select_participants" ON public.calls
    FOR SELECT
    USING (
        caller_id = COALESCE(
            (current_setting('request.jwt.claims', true)::json->>'sub'),
            (current_setting('request.jwt.claims', true)::json->>'firebase_uid')
        )
        OR receiver_id = COALESCE(
            (current_setting('request.jwt.claims', true)::json->>'sub'),
            (current_setting('request.jwt.claims', true)::json->>'firebase_uid')
        )
    );

-- INSERT policy: sadece caller kendi arama kaydını oluşturabilir
DROP POLICY IF EXISTS "calls_insert_self_caller" ON public.calls;
CREATE POLICY "calls_insert_self_caller" ON public.calls
    FOR INSERT
    WITH CHECK (
        caller_id = COALESCE(
            (current_setting('request.jwt.claims', true)::json->>'sub'),
            (current_setting('request.jwt.claims', true)::json->>'firebase_uid')
        )
    );

-- UPDATE policy: katılımcılar status ve duration güncelleyebilir
DROP POLICY IF EXISTS "calls_update_participants" ON public.calls;
CREATE POLICY "calls_update_participants" ON public.calls
    FOR UPDATE
    USING (
        caller_id = COALESCE(
            (current_setting('request.jwt.claims', true)::json->>'sub'),
            (current_setting('request.jwt.claims', true)::json->>'firebase_uid')
        )
        OR receiver_id = COALESCE(
            (current_setting('request.jwt.claims', true)::json->>'sub'),
            (current_setting('request.jwt.claims', true)::json->>'firebase_uid')
        )
    );

-- Comment
COMMENT ON TABLE public.calls IS 'DM arama geçmişi — outgoing/incoming/missed/ended durumları ve süreler. notifications tablosundaki missed_call kayıtları ile paralel çalışır.';
