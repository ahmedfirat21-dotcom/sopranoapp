-- ═══════════════════════════════════════════════════════════════════
-- v85e: Kalan tüm overload conflict'leri temizle
-- ═══════════════════════════════════════════════════════════════════
-- Sorun: Aynı RPC'nin eski (executor_id'siz) ve yeni (executor_id DEFAULT NULL'li)
--   sürümleri yan yana → PostgreSQL "could not choose the best candidate"
--   hatası → kullanıcı tıklar, RPC fail eder, sessizce listener kalır.
--
-- Çözüm: Eski (az arg) sürümleri DROP. Yeni sürümler default null ile
--   aynı imzayla çağrılabiliyor → client değişikliği gerekmez.
--
-- Tarama yöntemi:
--   SELECT proname, COUNT(*) FROM pg_proc WHERE pronamespace='public'::regnamespace
--   GROUP BY proname HAVING COUNT(*) > 1;
-- ═══════════════════════════════════════════════════════════════════

-- 1) ban_user_atomic — eski 5-arg, yeni 6-arg (executor)
DROP FUNCTION IF EXISTS public.ban_user_atomic(uuid, text, text, integer, text);

-- 2) transfer_host_atomic — eski 2-arg, yeni 3-arg (executor)
DROP FUNCTION IF EXISTS public.transfer_host_atomic(uuid, text);

-- 3) unfriend_atomic — eski 1-arg, yeni 2-arg (executor)
DROP FUNCTION IF EXISTS public.unfriend_atomic(text);

-- 4) toggle_conversation_archive — eski 1-arg, yeni 2-arg (executor)
DROP FUNCTION IF EXISTS public.toggle_conversation_archive(text);

-- 5) toggle_conversation_pin — eski 1-arg, yeni 2-arg (executor)
DROP FUNCTION IF EXISTS public.toggle_conversation_pin(text);
