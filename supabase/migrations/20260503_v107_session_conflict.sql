-- ════════════════════════════════════════════════════════════
-- v107 (3 May 2026): Çift oturum uyarısı — last_active_device_id takibi
-- ════════════════════════════════════════════════════════════
--
-- LiveKit identity collision tanısından sonraki UX iyileştirmesi:
-- Kullanıcı aynı hesabı iki cihazdan açtığında, daha sonra giren cihaz
-- aktif olur ve önceki cihaz "hesabın başka cihazda açıldı" modal'ı alır.
--
-- profiles tablosuna 2 kolon eklenir:
--   last_active_device_id text — istemcinin AsyncStorage'da tuttuğu UUID
--   last_active_at timestamptz — son aktivite zamanı (foreground/login anı)
--
-- Frontend her foreground/login'de bu kolonları update eder; realtime ile
-- diğer cihazlar değişikliği duyar ve self-eviction modal'ı tetikler.
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_active_device_id text,
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

-- Index — realtime + birden fazla son-aktif sorgusu için (admin paneli vs).
CREATE INDEX IF NOT EXISTS idx_profiles_last_active_at ON public.profiles (last_active_at DESC);

-- Trigger guard'ı bypass eden mark_active RPC — client-side UPDATE engellenmiş;
-- bu kolon kullanıcı kendi profili için değiştirilebilir, ama çift güvence için RPC.
CREATE OR REPLACE FUNCTION public.mark_session_active(
  p_user_id text,
  p_device_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev_device text;
BEGIN
  IF p_user_id IS NULL OR p_device_id IS NULL OR length(trim(p_device_id)) < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Eksik parametre');
  END IF;

  -- Önceki device id'yi al — değişmişse caller bilsin
  SELECT last_active_device_id INTO v_prev_device
  FROM public.profiles WHERE id = p_user_id;

  -- Bypass session var (varsa profil sensitive guard tetiklenmesin)
  PERFORM set_config('app.sp_rpc_bypass', 'true', true);

  UPDATE public.profiles
    SET last_active_device_id = p_device_id,
        last_active_at = now()
    WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'previous_device_id', v_prev_device,
    'is_takeover', v_prev_device IS NOT NULL AND v_prev_device <> p_device_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_session_active(text, text) TO anon, authenticated;
