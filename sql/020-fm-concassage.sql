/* ============================================ */
/* FM : concassage (fusion de runes en session) */
/* ============================================ */
/* Le concasseur fusionne 3 runes basiques en   */
/* 1 rune Pa (ou 3 Pa en 1 Ra). Pendant une     */
/* session FM, ces transformations modifient    */
/* le stock sans etre de la consommation.       */
/*                                              */
/* qty_ajustement : entrees (+) / sorties (-)   */
/* hors achat et hors conso FM.                 */
/* dispo = qty_avant + qty_achetee + ajustement */
/* conso = dispo - qty_apres                    */
/* ============================================ */

ALTER TABLE public.fm_session_runes
    ADD COLUMN IF NOT EXISTS qty_ajustement INTEGER NOT NULL DEFAULT 0;

/* Trace des concassages declares (pour affichage + annulation) */
CREATE TABLE IF NOT EXISTS public.fm_session_concassages (
    id              SERIAL PRIMARY KEY,
    session_id      INTEGER NOT NULL REFERENCES public.fm_sessions(id) ON DELETE CASCADE,
    rune_source_id  INTEGER NOT NULL REFERENCES public.runes(id),
    qty_source      INTEGER NOT NULL CHECK (qty_source > 0),
    rune_cible_id   INTEGER NOT NULL REFERENCES public.runes(id),
    qty_cible       INTEGER NOT NULL CHECK (qty_cible > 0),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fm_concassages_session ON public.fm_session_concassages(session_id);

/* RLS : memes regles que les achats (suivent la session parente) */
ALTER TABLE public.fm_session_concassages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fm_concassages_select" ON public.fm_session_concassages;
CREATE POLICY "fm_concassages_select" ON public.fm_session_concassages
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_validated = true)
    );

DROP POLICY IF EXISTS "fm_concassages_all_owner" ON public.fm_session_concassages;
CREATE POLICY "fm_concassages_all_owner" ON public.fm_session_concassages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.fm_sessions s
            WHERE s.id = session_id
              AND (s.user_id = auth.uid()
                   OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
        )
    );
