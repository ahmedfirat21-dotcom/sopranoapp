-- ════════════════════════════════════════════════════════════════════
-- v107.11 (2 May 2026): Welcome bonus exploit kapatma — EMAIL-BAZLI LOG
-- ════════════════════════════════════════════════════════════════════
--
-- ÖNCEKİ DURUM (v92.15):
--   "donatable_sp" ayrımı ile welcome bonus bağışlanamıyordu. Exploit kapalıydı
--   ama UX sorunluydu: kullanıcı 50 SP welcome alsa bile "bağışlanabilir SP
--   yetersiz" hatası alıyordu — kullanıcı şikayetçi.
--
-- YENİ ÇÖZÜM (kullanıcı talebi):
--   Email-bazlı persistent log. Hesap silinip aynı email ile yeniden açılırsa
--   welcome bonus VERİLMEZ. Bu sayede:
--     1. Exploit kapalı (5 hesap × 50 SP toplama yok)
--     2. donatable_sp ayrımına gerek yok → tüm SP bağışlanabilir
--     3. UX temiz — kullanıcı welcome bonus dahil bakiyesini gönderebilir
--
-- DEĞİŞİKLİKLER:
--   1. welcome_bonus_grants tablosu (email PK, hesap silinse bile korunur)
--   2. grant_welcome_bonus_email_check RPC (atomic, email check + grant)
--   3. Eski auto-trigger DROP (frontend signup sonrası RPC çağırır)
--   4. sync_donatable_sp trigger'ından welcome_bonus istisnası KALDIR
--   5. Backfill: mevcut kullanıcıların donatable'ı = system_points
-- ════════════════════════════════════════════════════════════════════

-- 1. Email log tablosu — hesap silinse bile silinmez (PK email_lower)
CREATE TABLE IF NOT EXISTS public.welcome_bonus_grants (
  email_lower TEXT PRIMARY KEY,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  user_id_at_grant TEXT
);

-- RLS: client erişemez (sadece SECURITY DEFINER RPC üzerinden)
ALTER TABLE public.welcome_bonus_grants ENABLE ROW LEVEL SECURITY;

-- Hiçbir kullanıcı SELECT/INSERT/UPDATE/DELETE yapamaz — sadece service_role
-- (RLS aktif + policy yok = default deny)

-- 2. Eski auto-trigger DROP — artık frontend explicit çağırır
DROP TRIGGER IF EXISTS trg_welcome_bonus_on_signup ON public.profiles;

-- 3. Yeni RPC: email kontrolü + atomic grant
CREATE OR REPLACE FUNCTION public.grant_welcome_bonus_email_check(
  p_user_id TEXT,
  p_email TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email_lower TEXT;
  v_existing_uid TEXT;
BEGIN
  v_email_lower := LOWER(TRIM(COALESCE(p_email, '')));

  IF v_email_lower = '' THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'no_email');
  END IF;

  -- Bu email daha önce welcome aldı mı?
  SELECT user_id_at_grant INTO v_existing_uid
  FROM welcome_bonus_grants WHERE email_lower = v_email_lower;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'granted', false,
      'reason', 'already_granted',
      'previous_user_id', v_existing_uid
    );
  END IF;

  -- Atomic: log'a ekle (UNIQUE constraint race condition'ı engeller)
  INSERT INTO welcome_bonus_grants (email_lower, user_id_at_grant)
  VALUES (v_email_lower, p_user_id);

  -- SP grant (system_points + donatable_sp ikisi de artar — artık ayrım yok)
  UPDATE profiles
  SET system_points = COALESCE(system_points, 0) + 50,
      donatable_sp  = COALESCE(donatable_sp, 0) + 50
  WHERE id = p_user_id;

  -- Audit: SP geçmişine yazılır (kullanıcı SPHistorySheet'te görür)
  INSERT INTO sp_transactions (user_id, amount, type, description)
  VALUES (p_user_id, 50, 'welcome_bonus', 'Hoş geldin hediyesi');

  RETURN jsonb_build_object('granted', true, 'amount', 50);

EXCEPTION
  WHEN unique_violation THEN
    -- Race condition: aynı anda 2 grant denemesi → ikincisi sessizce reddedilir
    RETURN jsonb_build_object('granted', false, 'reason', 'race_condition');
  WHEN OTHERS THEN
    RAISE NOTICE 'grant_welcome_bonus_email_check failed: %', SQLERRM;
    RETURN jsonb_build_object('granted', false, 'reason', 'error', 'message', SQLERRM);
END;
$$;

-- 4. sync_donatable_sp trigger güncelle — welcome_bonus istisnası KALDIRILDI
--    (artık tek bonus verildiği için exploit yok, donatable da artmalı)
CREATE OR REPLACE FUNCTION public.sync_donatable_sp() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.amount IS NULL OR NEW.amount = 0 THEN
    RETURN NEW;
  END IF;

  -- ★ v107.11: welcome_bonus İSTİSNASI KALDIRILDI
  --   Email-bazlı grant kontrolü (welcome_bonus_grants tablosu) exploit'i
  --   kapatıyor. Bonus tek seferlik olduğu için donatable da artırılmalı.

  IF NEW.amount > 0 THEN
    UPDATE profiles
    SET donatable_sp = COALESCE(donatable_sp, 0) + NEW.amount
    WHERE id = NEW.user_id;
  END IF;

  IF NEW.amount < 0 THEN
    UPDATE profiles
    SET donatable_sp = GREATEST(0, COALESCE(donatable_sp, 0) + NEW.amount)
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

-- 5. BACKFILL: Mevcut kullanıcıların donatable'ı = system_points
--    (welcome_bonus_grants tablosu boş, mevcut kullanıcılar exploit yapmadı,
--     bakiyelerini bağışlayabilmeli)
UPDATE profiles
SET donatable_sp = COALESCE(system_points, 0)
WHERE COALESCE(donatable_sp, 0) < COALESCE(system_points, 0);

-- ════════════════════════════════════════════════════════════════════
-- NOT (post-launch):
--   Bu migration sonra `donatable_sp` kolonu KALDIRILABİLİR — artık ayrım yok,
--   donateToUser sadece system_points kontrol eder. Şimdilik kalıyor (rollback
--   için), v110 civarı temizlenir.
-- ════════════════════════════════════════════════════════════════════
