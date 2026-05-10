-- ════════════════════════════════════════════════════════════════════
-- v114: cosmetic_items.asset_url + cosmetic-assets bucket
-- ════════════════════════════════════════════════════════════════════
-- Amaç: Eko-sistem dinamik senkron — web admin'den Lottie JSON yüklenebilsin,
--   mobile bunu render edebilsin (APK build gerekmeden).
--
-- Hibrit yaklaşım:
--   - Mevcut frame/entry effect'ler APK registry'sinde gömülü kalır (hızlı yüklenme)
--   - Yeni eklenen ürünlerde asset_url dolu olur → mobile lottie-react-native
--     ile uri'den çeker
--   - Cache: AsyncStorage (TTL 7 gün)
-- ════════════════════════════════════════════════════════════════════

-- ── 1. asset_url alanı ──────────────────────────────────────────────
ALTER TABLE public.cosmetic_items
  ADD COLUMN IF NOT EXISTS asset_url TEXT NULL;

COMMENT ON COLUMN public.cosmetic_items.asset_url IS
  'Lottie JSON dosyasının Storage URL''i. NULL ise mobile registry''sinden okur.';

-- ── 2. cosmetic-assets bucket ───────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cosmetic-assets',
  'cosmetic-assets',
  true, -- public read; sadece admin yazabilir (RLS aşağıda)
  5242880, -- 5MB max (Lottie JSON 50-500KB civarı genelde)
  ARRAY['application/json', 'text/plain', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- ── 3. RLS: SELECT herkes, INSERT/UPDATE/DELETE service_role only ───
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'cosmetic_assets_public_read' AND polrelid = 'storage.objects'::regclass) THEN
    CREATE POLICY "cosmetic_assets_public_read" ON storage.objects FOR SELECT
      USING (bucket_id = 'cosmetic-assets');
  END IF;
END $$;

-- INSERT/UPDATE/DELETE policy YOK → sadece service_role (admin paneli) yazabilir.
-- Mobile sadece okuyacak.

-- ── 4. Index — kategori bazlı sorgu hızı ────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cosmetic_items_category_active
  ON public.cosmetic_items(category, active) WHERE active = true;
