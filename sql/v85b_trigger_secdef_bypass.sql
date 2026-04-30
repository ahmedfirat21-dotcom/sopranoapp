-- ═══════════════════════════════════════════════════════════════════
-- v85b: prevent_role_escalation trigger — SECURITY DEFINER bypass
-- ═══════════════════════════════════════════════════════════════════
-- Sorun: v85'te atomic RPC'lere set_config eklendi ama trigger hâlâ UPDATE'leri
--   bloke ediyor (DB'de role: listener kalıyor — sahneye alma çalışmıyor).
--
-- Sebep: PostgREST üzerinden gelen RPC çağrılarında SECURITY DEFINER fonksiyon
--   içinde set_config transaction-scope ediyor olsa da, trigger tetiklendiğinde
--   GUC'un görünür olması her zaman garanti değil (Supabase Pooler / connection
--   reuse senaryolarında subtle davranış).
--
-- Çözüm: Trigger'a "current_user != session_user" check'i ekle.
--   - SECURITY DEFINER RPC içinden çağrı → current_user = postgres (function owner)
--   - Direct REST UPDATE → current_user = session_user (anon/authenticated)
--   Yani RPC üzerinden gelen UPDATE'ler doğrudan bypass olur (RPC zaten kendi
--   yetki kontrolünü yapıyor); direct UPDATE'ler trigger tarafından korunmaya
--   devam eder.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_caller TEXT;
  v_authorized TEXT;
BEGIN
  -- Role değişmediyse hiçbir şey yapma
  IF OLD.role IS NOT DISTINCT FROM NEW.role THEN
    RETURN NEW;
  END IF;

  -- ★ v85b: SECURITY DEFINER fonksiyon (atomic RPC'ler) içinden gelen UPDATE'leri bypass.
  --   Atomic RPC'ler kendi yetki kontrolünü yapıyor; trigger'ın tekrar kontrol etmesi
  --   gereksiz + Pooler GUC propagasyonu güvenilmez.
  IF current_user IS DISTINCT FROM session_user THEN
    RETURN NEW;
  END IF;

  v_caller := app_uid();

  -- Anonim/auth context yoksa → izin (servis hesabı, migration vs.)
  IF v_caller IS NULL THEN
    RETURN NEW;
  END IF;

  -- Eski set_config bayrağı kontrolü (geriye uyumlu)
  BEGIN
    v_authorized := current_setting('app.role_change_authorized', true);
  EXCEPTION WHEN OTHERS THEN
    v_authorized := NULL;
  END;
  IF v_authorized = 'true' THEN
    RETURN NEW;
  END IF;

  -- Self-role-change izinli geçişler
  IF v_caller = OLD.user_id THEN
    IF (OLD.role IN ('listener', 'spectator') AND NEW.role = 'pending_speaker')
       OR (OLD.role = 'pending_speaker' AND NEW.role IN ('listener', 'spectator'))
       OR (OLD.role = 'speaker' AND NEW.role = 'listener')
       OR (OLD.role = 'moderator' AND NEW.role = 'speaker')
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Role değişikliği reddedildi.' USING ERRCODE = '42501';
  END IF;

  -- Host veya moderator yapabilir
  IF EXISTS (
    SELECT 1 FROM rooms r
    WHERE r.id = NEW.room_id AND r.host_id = v_caller
  ) OR EXISTS (
    SELECT 1 FROM room_participants rp
    WHERE rp.room_id = NEW.room_id
      AND rp.user_id = v_caller
      AND rp.role IN ('owner', 'moderator')
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Role değişikliği reddedildi: yetki gerekir.'
    USING ERRCODE = '42501';
END;
$function$;
