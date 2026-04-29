-- ═══════════════════════════════════════════════════════════════════
-- v56: Mesaj Reaksiyonları (Heart / Like)
-- ═══════════════════════════════════════════════════════════════════
-- Amaç: Oda sohbetindeki mesaj balonlarına ❤️ reaksiyonu.
--   Clubhouse/Discord pattern'ı — mesaja uzun basınca beğen.
--
-- Model: message_reactions (message_id, user_id, emoji) — composite PK
--   her kullanıcı her mesaja her emojiden bir kez reaksiyon bırakır.
--
-- NOT: profiles.id TEXT (Firebase UID). user_id TEXT olacak ve Firebase
--   kimliğini executor param olarak alan atomik RPC kullanılacak —
--   diğer v39+ pattern'larla uyumlu (auth.uid() NULL dönüyor Firebase'da).
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.message_reactions (
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL DEFAULT '❤️',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message
  ON public.message_reactions (message_id);

CREATE INDEX IF NOT EXISTS idx_message_reactions_user
  ON public.message_reactions (user_id);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- Read: herkes okur (oda içindeki mesaj reaksiyonları ortak görülür)
DROP POLICY IF EXISTS msg_reactions_read ON public.message_reactions;
CREATE POLICY msg_reactions_read ON public.message_reactions
  FOR SELECT USING (true);

-- Write (INSERT/DELETE) RPC üzerinden; RLS'i anon/authenticated için aç,
-- RPC SECURITY DEFINER olduğu için direct client yazımı da izinli kalsın
-- (v39 pattern — Firebase auth.uid() NULL, RPC atomik yazıyor).
DROP POLICY IF EXISTS msg_reactions_insert ON public.message_reactions;
CREATE POLICY msg_reactions_insert ON public.message_reactions
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS msg_reactions_delete ON public.message_reactions;
CREATE POLICY msg_reactions_delete ON public.message_reactions
  FOR DELETE USING (true);

-- ─── RPC: toggle ──────────────────────────────────────────────────
-- p_user_id TEXT (Firebase UID) — client'tan executor kimliği
-- p_message_id UUID — hedef mesaj
-- p_emoji TEXT (default '❤️') — reaction emoji
-- Dönüş: { liked: bool, count: int } — toggle sonrası durumu
DROP FUNCTION IF EXISTS public.toggle_message_reaction(UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.toggle_message_reaction(
  p_message_id UUID,
  p_user_id TEXT,
  p_emoji TEXT DEFAULT '❤️'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists BOOLEAN;
  v_count INT;
BEGIN
  IF p_user_id IS NULL OR length(p_user_id) = 0 THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.message_reactions
    WHERE message_id = p_message_id AND user_id = p_user_id AND emoji = p_emoji
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.message_reactions
    WHERE message_id = p_message_id AND user_id = p_user_id AND emoji = p_emoji;
  ELSE
    INSERT INTO public.message_reactions(message_id, user_id, emoji)
    VALUES (p_message_id, p_user_id, p_emoji)
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.message_reactions
  WHERE message_id = p_message_id AND emoji = p_emoji;

  RETURN jsonb_build_object(
    'liked', NOT v_exists,
    'count', v_count,
    'emoji', p_emoji
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_message_reaction(UUID, TEXT, TEXT) TO anon, authenticated;

-- ─── RPC: toplu okuma (oda açılınca son 50 mesajın reaksiyonlarını çek) ──
DROP FUNCTION IF EXISTS public.get_message_reactions(UUID[]);
CREATE OR REPLACE FUNCTION public.get_message_reactions(p_message_ids UUID[])
RETURNS TABLE(message_id UUID, emoji TEXT, count BIGINT, liked_by_users TEXT[])
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    mr.message_id,
    mr.emoji,
    COUNT(*)::BIGINT AS count,
    ARRAY_AGG(mr.user_id) AS liked_by_users
  FROM public.message_reactions mr
  WHERE mr.message_id = ANY(p_message_ids)
  GROUP BY mr.message_id, mr.emoji;
$$;

GRANT EXECUTE ON FUNCTION public.get_message_reactions(UUID[]) TO anon, authenticated;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- Realtime publication (reaksiyonlar canlı sync — başka kullanıcının
-- beğendiğini anında görelim)
-- ═══════════════════════════════════════════════════════════════════
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
