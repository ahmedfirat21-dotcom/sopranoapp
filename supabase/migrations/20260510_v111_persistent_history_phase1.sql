-- ════════════════════════════════════════════════════════════
-- v111 (10 May 2026): Persistent Room History — Phase 1 (MVP)
-- ════════════════════════════════════════════════════════════
--
-- AMAÇ: Plus/Pro üyeler için kapanan persistent oda mesajlarını koru.
--   Plus: 7 gün retention (cron temizler)
--   Pro:  sınırsız (kapanmazsa hep kalır)
--   Free: ESKİ DAVRANIŞ AYNEN — anında DELETE
--
-- STRATEJİ: v87 trigger fonksiyonunun GÖVDESİ değişir; trigger
--   registration aynı kalır. Tüm caller'lar (closeRoom, _autoCloseIfEmpty,
--   close_expired_free_rooms cron, manuel) transparently yakalar.
--
-- FEATURE FLAG: app_config.persistent_history_v1 = OFF (default).
--   Migration deploy edilince hiçbir davranış değişmez — flag OFF
--   olduğu sürece eski (v87) DELETE davranışı aynen sürer.
--   Production'da smoke test sonrası elle açılır:
--     UPDATE app_config SET value='{"enabled":true}' WHERE key='persistent_history_v1';
--   Acil rollback:
--     UPDATE app_config SET value='{"enabled":false}' WHERE key='persistent_history_v1';
--
-- ROLLBACK: trigger fonksiyonunu v87 gövdesine geri çevir + cron unschedule.
--   SQL şu dosyada: 20260510_v111_persistent_history_phase1_revert.sql (manuel)

-- ─────────────────────────────────────────────────────────────
-- 1) Feature flag altyapısı (sistemde yoktu — minimum viable)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.app_config (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: client'lar bu tabloyu okumasın/değiştirmesin. Sadece SECURITY DEFINER
--   fonksiyonlar ve service_role erişebilir. Trigger SECURITY DEFINER olduğu
--   için içeride çağrılan feature_flag_enabled() bypass eder RLS'i.
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_config service only" ON public.app_config;
CREATE POLICY "app_config service only" ON public.app_config
  FOR ALL TO public USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.feature_flag_enabled(p_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (value->>'enabled')::boolean
       FROM public.app_config
      WHERE key = p_key),
    FALSE
  );
$$;

-- Flag default OFF — migration deploy edilince davranış aynı kalır
INSERT INTO public.app_config(key, value)
VALUES ('persistent_history_v1', jsonb_build_object('enabled', false))
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 2) Trigger fonksiyonunu yeniden tanımla — branching logic
-- ─────────────────────────────────────────────────────────────
-- v87 davranışı: is_live true→false → DELETE FROM messages WHERE room_id=NEW.id
-- v111 davranışı:
--   Flag OFF                              → DELETE (v87 aynen, regresyon yok)
--   Flag ON + is_persistent=false (Free)  → DELETE (Free regresyonu yok)
--   Flag ON + is_persistent=true          → metadata.archived_at damgasını bas

CREATE OR REPLACE FUNCTION public.delete_room_messages_on_close()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_live = TRUE AND NEW.is_live = FALSE THEN
    -- Feature flag OFF ise eski davranışı aynen koru (regresyon yok)
    IF NOT public.feature_flag_enabled('persistent_history_v1') THEN
      DELETE FROM public.messages WHERE room_id = NEW.id;
      RETURN NEW;
    END IF;

    -- Flag ON: persistent oda mı?
    IF COALESCE(NEW.is_persistent, FALSE) = TRUE THEN
      -- Persistent (Plus/Pro): mesajları koru, archived_at damgası bas.
      --   Overwrite mantığı: her freeze damgayı yeniler (7-gün clock fresh).
      --   Diğer metadata key'leri (glow, glow_style vb) korunur (jsonb || merge).
      UPDATE public.messages
         SET metadata = COALESCE(metadata, '{}'::jsonb)
                        || jsonb_build_object(
                             'archived_at',
                             to_char(now() AT TIME ZONE 'UTC',
                                     'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                           )
       WHERE room_id = NEW.id;
    ELSE
      -- Non-persistent (Free): eski davranış aynen
      DELETE FROM public.messages WHERE room_id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger registration aynı kalır (v87 ile bit-identical)
DROP TRIGGER IF EXISTS trg_delete_room_messages_on_close ON public.rooms;
CREATE TRIGGER trg_delete_room_messages_on_close
AFTER UPDATE OF is_live ON public.rooms
FOR EACH ROW
WHEN (OLD.is_live IS DISTINCT FROM NEW.is_live AND NEW.is_live = FALSE)
EXECUTE FUNCTION public.delete_room_messages_on_close();

-- ─────────────────────────────────────────────────────────────
-- 3) WakeUp helper — host odayı uyandırınca damgaları temizle
-- ─────────────────────────────────────────────────────────────
-- 7-gün retention saati her wakeUp'ta sıfırlanır. Eğer fail olursa
--   trigger her freeze'de damgayı overwrite ettiği için worst case
--   "biraz erken silinir" — veri kaybı yok.

CREATE OR REPLACE FUNCTION public.clear_archived_at(p_room_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.messages
     SET metadata = metadata - 'archived_at'
   WHERE room_id = p_room_id
     AND metadata ? 'archived_at';
END;
$$;

REVOKE ALL ON FUNCTION public.clear_archived_at(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_archived_at(UUID) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────
-- 4) Plus 7-gün cleanup cron RPC
-- ─────────────────────────────────────────────────────────────
-- Sadece owner_tier='Plus' rooms için — Pro filtre dışı (sınırsız retention).
-- Defansif: oda hala is_live=false ise sil (woke'lanmışsa stamp zaten temizlendi).

CREATE OR REPLACE FUNCTION public.purge_archived_room_messages()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  -- Flag OFF ise hiçbir şey silme
  IF NOT public.feature_flag_enabled('persistent_history_v1') THEN
    RETURN 0;
  END IF;

  WITH targets AS (
    SELECT m.id
      FROM public.messages m
      JOIN public.rooms r ON r.id = m.room_id
     WHERE (m.metadata->>'archived_at') IS NOT NULL
       AND (m.metadata->>'archived_at')::timestamptz < now() - interval '7 days'
       AND COALESCE(r.owner_tier, 'Free') = 'Plus'
       -- Defansif: oda hala frozen mı (woke'lanmadıysa sil)
       AND r.is_live = FALSE
  )
  DELETE FROM public.messages m
   USING targets t
   WHERE m.id = t.id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_archived_room_messages() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_archived_room_messages() TO postgres, service_role;

-- ─────────────────────────────────────────────────────────────
-- 5) Index — cron hot path için partial index (sadece stamped row'lar)
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_messages_archived_at
  ON public.messages ((metadata->>'archived_at'))
  WHERE (metadata->>'archived_at') IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 6) Cron schedule — her gün 04:00 UTC (düşük trafik penceresi)
-- ─────────────────────────────────────────────────────────────
-- pg_cron extension gerekiyor (zaten kurulu — close_expired_free_rooms cron var).
-- Job idempotent: zaten varsa yeniden kurar.

DO $$
BEGIN
  -- Eski varsa unschedule
  PERFORM cron.unschedule('purge-plus-archived-messages')
    WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'purge-plus-archived-messages'
    );
EXCEPTION WHEN OTHERS THEN
  -- pg_cron yoksa veya başka hata → sessizce geç
  NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'purge-plus-archived-messages',
    '0 4 * * *',
    'SELECT public.purge_archived_room_messages();'
  );
EXCEPTION WHEN OTHERS THEN
  -- pg_cron yoksa migration yine de geçsin
  RAISE NOTICE 'pg_cron schedule failed (extension missing?): %', SQLERRM;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 7) Doğrulama (manual smoke test için sorgular — yoruma alınmış)
-- ─────────────────────────────────────────────────────────────
-- Flag durumu kontrol:
--   SELECT * FROM app_config WHERE key = 'persistent_history_v1';
-- Flag açma:
--   UPDATE app_config SET value='{"enabled":true}', updated_at=now()
--    WHERE key='persistent_history_v1';
-- Flag kapama (acil rollback):
--   UPDATE app_config SET value='{"enabled":false}', updated_at=now()
--    WHERE key='persistent_history_v1';
-- Manuel cron çalıştır:
--   SELECT public.purge_archived_room_messages();
-- Belirli odanın damgalarını temizle:
--   SELECT public.clear_archived_at('<uuid>');
-- Damgalı mesaj sayısı:
--   SELECT count(*) FROM messages WHERE metadata ? 'archived_at';
