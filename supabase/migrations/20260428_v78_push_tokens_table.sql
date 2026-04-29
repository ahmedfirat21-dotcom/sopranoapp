-- ════════════════════════════════════════════════════════════════════
-- v78 — push_tokens ayrı tablo refactor
--
-- ÖNCESİ:
--   profiles.push_token → tek kolon, kullanıcı başına tek token.
--   Sorunlar:
--     1) Birden fazla cihaz desteklenmiyor (son token kazanır)
--     2) Token lifecycle (expire/stale temizlik) profiles tablosuna bağlı
--     3) Column-level GRANT ile korunuyor (v73) — karmaşık yetki yönetimi
--
-- SONRASI:
--   push_tokens tablosu:
--     - Bir kullanıcının N cihazına push gönderilebilir
--     - Stale token temizliği bağımsız cron ile yapılabilir (ileride)
--     - RLS ile korunuyor — column-level GRANT gerekmez
--     - send-push edge function tüm aktif cihazlara gönderir
--
-- İdempotent — tekrar uygulanabilir.
-- ════════════════════════════════════════════════════════════════════

-- ─── 1) push_tokens tablosu oluştur ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token      TEXT NOT NULL,
  platform   TEXT NOT NULL DEFAULT 'unknown',   -- 'android' | 'ios' | 'web'
  device_id  TEXT,                               -- cihaz tanımlayıcı (ileride)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Aynı kullanıcı + aynı token → tek kayıt (upsert için)
  CONSTRAINT push_tokens_user_token_unique UNIQUE (user_id, token)
);

-- Index: user_id'ye göre hızlı lookup (send-push edge function)
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens(user_id);

-- ─── 2) Mevcut verileri taşı ─────────────────────────────────────────
-- profiles.push_token'ı olan kayıtları yeni tabloya aktar.
-- ON CONFLICT ile idempotent — tekrar çalıştırılırsa duplicate oluşmaz.
INSERT INTO public.push_tokens (user_id, token, platform)
SELECT
  id,
  push_token,
  'unknown'   -- mevcut veride platform bilgisi yok
FROM public.profiles
WHERE push_token IS NOT NULL
  AND push_token != ''
ON CONFLICT (user_id, token) DO NOTHING;

DO $$
DECLARE
  migrated_count int;
BEGIN
  SELECT COUNT(*) INTO migrated_count FROM public.push_tokens;
  RAISE NOTICE 'v78: push_tokens tablosuna % adet token taşındı.', migrated_count;
END $$;

-- ─── 3) RLS etkinleştir + politikalar ─────────────────────────────────
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- 3a) Service role: tüm satırlara SELECT (send-push edge function)
--     Supabase service_role RLS'yi otomatik bypass eder, ancak explicit policy
--     olması best practice ve ileride olası restrict'ler için hazırlık.
DROP POLICY IF EXISTS "service_read_push_tokens" ON public.push_tokens;

-- 3b) Authenticated: Kendi token'larını INSERT/UPDATE/DELETE edebilir
DROP POLICY IF EXISTS "users_manage_own_tokens" ON public.push_tokens;
CREATE POLICY "users_manage_own_tokens" ON public.push_tokens
  FOR ALL
  USING (user_id = public.app_uid())
  WITH CHECK (user_id = public.app_uid());

-- 3c) Authenticated SELECT kendi token'larını görebilir (isteğe bağlı — device list)
-- Başkasının token'ını okuyamaz. Bu, v73'teki column-level GRANT'ın yerini alır.
-- ★ NOT: "users_manage_own_tokens" ALL policy zaten SELECT + INSERT + UPDATE + DELETE kapsıyor.

-- 3d) Anon erişim YOK (varsayılan — policy tanımlanmamış = deny)

-- ─── 4) updated_at otomatik güncelleme trigger ───────────────────────
CREATE OR REPLACE FUNCTION public.set_push_token_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_push_tokens_updated_at ON public.push_tokens;
CREATE TRIGGER trg_push_tokens_updated_at
  BEFORE UPDATE ON public.push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.set_push_token_updated_at();

-- ─── 5) profiles.push_token kolonunu HENÜZ SİLME ──────────────────────
-- Geçiş dönemi: Eski client versiyonları hâlâ profiles.push_token'a yazıyor olabilir.
-- ★ v79 veya sonrasında:
--   ALTER TABLE public.profiles DROP COLUMN push_token;
-- ★ Şimdilik: v73'teki column-level GRANT'lar olduğu gibi kalıyor (backward compat).

-- ─── 6) Realtime Publication ─────────────────────────────────────────
-- push_tokens tablosu Realtime'a ihtiyaç duymaz (sadece edge function okur).
-- Realtime publication'a EKLEME — gerek yok.

-- ─── 7) Doğrulama ─────────────────────────────────────────────────────
DO $$
DECLARE
  tbl_exists boolean;
  pol_count int;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'push_tokens'
  ) INTO tbl_exists;

  SELECT COUNT(*) INTO pol_count
  FROM pg_policies
  WHERE tablename = 'push_tokens' AND schemaname = 'public';

  RAISE NOTICE 'v78 SONUÇ: push_tokens tablosu var=%, politika sayısı=%', tbl_exists, pol_count;
END $$;
