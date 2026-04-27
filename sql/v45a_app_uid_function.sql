-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v45a — app_uid() helper function ONLY
--
-- Bu migration HİÇBİR policy'ye dokunmuyor. Sadece yeni bir helper SQL function
-- ekliyor. Function kullanılana kadar hiçbir davranış değişmez.
--
-- Sonraki adımlar (v45b, v45c...) tablolar bazında policy'leri tek tek bu
-- function'a geçirecek.
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION app_uid()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'sub')::text,  -- Firebase JWT öncelikli (sub = Firebase UID)
    auth.uid()::text                -- Fallback: Supabase native auth
  );
$$;

COMMENT ON FUNCTION app_uid() IS
  'Firebase Third-Party Auth uyumlu user ID döner. Firebase JWT varsa sub, yoksa auth.uid() fallback.';
