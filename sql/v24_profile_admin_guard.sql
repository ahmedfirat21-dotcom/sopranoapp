-- ════════════════════════════════════════════════════════════════════
-- SopranoChat v24 — profiles.is_admin Escalation Guard (O7)
--
-- v16 RLS: profiles UPDATE USING(auth.uid()::text = id) — kullanıcı kendi
-- satırındaki HER KOLONU güncelleyebilir, is_admin dahil. Client doğrudan:
--   supabase.from('profiles').update({ is_admin: true }).eq('id', myUid)
-- çağırarak kendini admin yapabiliyordu. Aynı risk: system_points (direkt para)
-- ve subscription_tier (premium bypass) için de geçerli.
--
-- Çözüm: BEFORE UPDATE trigger — hassas kolonlar sadece mevcut admin veya
-- service_role (auth.uid() NULL) tarafından değiştirilebilir.
--
-- Korunan kolonlar:
--   - is_admin        → admin escalation
--   - system_points   → para basma (RPC dışında)
--   - subscription_tier → premium bypass
--   - sp              → legacy SP alanı
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION _profile_sensitive_columns_guard()
RETURNS TRIGGER AS $$
DECLARE
  v_caller TEXT;
  v_caller_is_admin BOOLEAN;
BEGIN
  v_caller := auth.uid()::text;

  -- Service-role / bypass (auth.uid() NULL) → güven
  IF v_caller IS NULL THEN
    RETURN NEW;
  END IF;

  -- Caller admin mi?
  SELECT COALESCE(is_admin, false) INTO v_caller_is_admin
    FROM profiles WHERE id = v_caller;

  -- is_admin değişikliği sadece admin
  IF COALESCE(OLD.is_admin, false) IS DISTINCT FROM COALESCE(NEW.is_admin, false) THEN
    IF NOT COALESCE(v_caller_is_admin, false) THEN
      RAISE EXCEPTION 'profiles.is_admin yalnızca mevcut admin tarafından değiştirilebilir.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- system_points sadece RPC (service_role) üzerinden
  -- Kullanıcı kendi UI'sından diğer kolonları güncellerken bu tetiklenmemeli →
  -- sadece değer değişiyorsa blok
  IF COALESCE(OLD.system_points, 0) IS DISTINCT FROM COALESCE(NEW.system_points, 0) THEN
    -- Admin'e izin ver (manuel düzeltme için)
    IF NOT COALESCE(v_caller_is_admin, false) THEN
      RAISE EXCEPTION 'profiles.system_points doğrudan UPDATE ile değiştirilemez — grant_system_points RPC kullanın.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- subscription_tier sadece admin veya service_role (RevenueCat webhook)
  IF COALESCE(OLD.subscription_tier, '') IS DISTINCT FROM COALESCE(NEW.subscription_tier, '') THEN
    IF NOT COALESCE(v_caller_is_admin, false) THEN
      RAISE EXCEPTION 'profiles.subscription_tier kullanıcı tarafından değiştirilemez.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Legacy sp kolonu (varsa) de korunur
  BEGIN
    IF COALESCE(OLD.sp, 0) IS DISTINCT FROM COALESCE(NEW.sp, 0) THEN
      IF NOT COALESCE(v_caller_is_admin, false) THEN
        RAISE EXCEPTION 'profiles.sp doğrudan değiştirilemez.'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  EXCEPTION WHEN undefined_column THEN
    -- sp kolonu yoksa sorun değil
    NULL;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_profile_sensitive_guard ON profiles;
CREATE TRIGGER trg_profile_sensitive_guard
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION _profile_sensitive_columns_guard();

-- ═══ DONE ═══
-- Hassas kolonlar: is_admin, system_points, subscription_tier (+ legacy sp)
-- Artık sadece mevcut admin veya SECURITY DEFINER RPC üzerinden değiştirilebilir.
