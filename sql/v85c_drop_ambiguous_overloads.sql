-- ═══════════════════════════════════════════════════════════════════
-- v85c: Function overload ambiguity fix
-- ═══════════════════════════════════════════════════════════════════
-- Sorun: v85'te eski 2-arg ve yeni 3-arg sürümler beraber duruyor.
--   3-arg sürüm: (p_room_id uuid, p_user_id text, p_executor_id text DEFAULT NULL)
--   Client 2 parametre verince PostgreSQL hangisini seçeceğini bilemiyor:
--   "ERROR: could not choose the best candidate function" (42725)
--
-- Çözüm: 2-arg sürümleri DROP et. 3-arg sürüm DEFAULT NULL ile aynı
--   imzayla çağrılabilir → client değişikliği gerekmez.
-- ═══════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.promote_speaker_atomic(uuid, text);
DROP FUNCTION IF EXISTS public.demote_speaker_atomic(uuid, text);
