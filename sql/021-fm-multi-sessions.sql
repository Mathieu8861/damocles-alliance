/* ============================================ */
/* FM : multi-sessions en parallele             */
/* ============================================ */
/* Plusieurs sessions peuvent etre 'en_cours'   */
/* simultanement (un item par session). Le      */
/* panel Session affiche la plus recemment      */
/* active ; on reprend les autres depuis        */
/* "Mes sessions" (maj de last_active_at).      */
/* ============================================ */

ALTER TABLE public.fm_sessions
    ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();

/* Initialiser les sessions existantes */
UPDATE public.fm_sessions
SET last_active_at = COALESCE(last_active_at, started_at);
