-- ============================================================
-- 035 : Refonte droits perco : paliers par RANG + reservation
-- automatique des zones par ordre de preference (demande Mathieu
-- 03/08/2026).
--
-- - paliers_percos : rang_min..rang_max -> percos "resa" + percos
--   en zones niveau 150 et moins
-- - perco_preferences : liste ordonnee de zones par joueur
-- - perco_reservations : attribution FIGEE par periode (quinzaine) ;
--   le rang 1 recoit sa preference n1, le rang 2 sa preference la
--   mieux placee encore libre, etc. Multi-tours pret (config
--   site_config.perco_resa_tours = 1, passer a 2 plus tard).
-- - attribuer_percos_periode() : idempotente (verrou advisory),
--   declenchee par pg_cron le lundi + en secours a l'ouverture du
--   board. p_force = TRUE (admin) recalcule la periode courante.
-- - Au tout premier lancement (periode passee vide), l'attribution
--   se base sur le classement de la periode courante.
-- ============================================================

-- A. Paliers par rang (barème Mathieu du 03/08)
CREATE TABLE IF NOT EXISTS public.paliers_percos (
    id          SERIAL PRIMARY KEY,
    rang_min    INTEGER NOT NULL CHECK (rang_min >= 1),
    rang_max    INTEGER NOT NULL,
    percos      INTEGER NOT NULL DEFAULT 0 CHECK (percos >= 0),
    percos_150  INTEGER NOT NULL DEFAULT 0 CHECK (percos_150 >= 0),
    emoji       TEXT DEFAULT '',
    CHECK (rang_max >= rang_min)
);

ALTER TABLE public.paliers_percos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "paliers_percos_select" ON public.paliers_percos;
CREATE POLICY "paliers_percos_select" ON public.paliers_percos
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "paliers_percos_admin_all" ON public.paliers_percos;
CREATE POLICY "paliers_percos_admin_all" ON public.paliers_percos
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

INSERT INTO public.paliers_percos (rang_min, rang_max, percos, percos_150, emoji)
SELECT v.a, v.b, v.c, v.d, v.e
FROM (VALUES (1, 5, 2, 3, '🏆'), (6, 20, 2, 2, '🔥'), (21, 35, 1, 2, '⚔️'), (36, 60, 0, 1, '💥')) AS v(a, b, c, d, e)
WHERE NOT EXISTS (SELECT 1 FROM public.paliers_percos);

-- B. Preferences de zones (liste ordonnee par joueur)
CREATE TABLE IF NOT EXISTS public.perco_preferences (
    id       SERIAL PRIMARY KEY,
    user_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    zone_id  INTEGER NOT NULL REFERENCES public.zones_perco(id) ON DELETE CASCADE,
    ordre    INTEGER NOT NULL CHECK (ordre BETWEEN 1 AND 50),
    UNIQUE(user_id, zone_id)
);

CREATE INDEX IF NOT EXISTS idx_perco_pref_user ON public.perco_preferences(user_id, ordre);

ALTER TABLE public.perco_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "perco_pref_select_own" ON public.perco_preferences;
CREATE POLICY "perco_pref_select_own" ON public.perco_preferences
    FOR SELECT TO authenticated
    USING (user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

DROP POLICY IF EXISTS "perco_pref_write_own" ON public.perco_preferences;
CREATE POLICY "perco_pref_write_own" ON public.perco_preferences
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_validated = true));

-- C. Reservations figees par periode
CREATE TABLE IF NOT EXISTS public.perco_reservations (
    id             SERIAL PRIMARY KEY,
    periode_debut  TIMESTAMPTZ NOT NULL,
    tour           INTEGER NOT NULL DEFAULT 1,
    rang           INTEGER NOT NULL,
    user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    zone_id        INTEGER NOT NULL REFERENCES public.zones_perco(id),
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(periode_debut, tour, user_id),
    UNIQUE(periode_debut, zone_id)
);

CREATE INDEX IF NOT EXISTS idx_perco_resa_periode ON public.perco_reservations(periode_debut);

ALTER TABLE public.perco_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "perco_resa_select" ON public.perco_reservations;
CREATE POLICY "perco_resa_select" ON public.perco_reservations
    FOR SELECT TO authenticated USING (true);
-- Aucune ecriture directe : tout passe par attribuer_percos_periode() (SECURITY DEFINER)

-- D. Nombre de tours de reservation (1 aujourd'hui, 2 plus tard)
INSERT INTO public.site_config (cle, valeur)
VALUES ('perco_resa_tours', '1')
ON CONFLICT (cle) DO NOTHING;

-- E. Fonction d'attribution
CREATE OR REPLACE FUNCTION public.attribuer_percos_periode(p_force BOOLEAN DEFAULT FALSE)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_periode  TIMESTAMPTZ;
    v_tours    INTEGER;
    v_is_admin BOOLEAN;
    v_joueur   RECORD;
    v_zone     INTEGER;
    v_tour     INTEGER;
    v_count    INTEGER := 0;
    v_source   TEXT := 'passee';
BEGIN
    v_periode := public.debut_periode_pvp();

    IF p_force THEN
        SELECT COALESCE(is_admin, false) INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
        IF NOT COALESCE(v_is_admin, false) THEN
            RETURN jsonb_build_object('ok', false, 'message', 'Recalcul réservé aux admins');
        END IF;
        DELETE FROM public.perco_reservations WHERE periode_debut = v_periode;
    END IF;

    /* Verrou : une seule attribution a la fois (cron + visites simultanees) */
    PERFORM pg_advisory_xact_lock(hashtext('attribuer_percos_periode'));

    IF EXISTS (SELECT 1 FROM public.perco_reservations WHERE periode_debut = v_periode) THEN
        RETURN jsonb_build_object('ok', true, 'message', 'Attribution déjà calculée', 'nouvelles', 0);
    END IF;

    v_tours := COALESCE((SELECT valeur::INTEGER FROM public.site_config WHERE cle = 'perco_resa_tours'), 1);

    /* Ladder de reference : la periode ecoulee ; au lancement (vide), la courante */
    DROP TABLE IF EXISTS tmp_ladder;
    CREATE TEMP TABLE tmp_ladder ON COMMIT DROP AS
        SELECT id AS user_id, points,
               ROW_NUMBER() OVER (ORDER BY points DESC, username ASC) AS rang
        FROM public.classement_pvp_semaine_passee;

    IF NOT EXISTS (SELECT 1 FROM tmp_ladder) THEN
        v_source := 'courante';
        INSERT INTO tmp_ladder
            SELECT id, points,
                   ROW_NUMBER() OVER (ORDER BY points DESC, username ASC)
            FROM public.classement_pvp_semaine;
    END IF;

    FOR v_tour IN 1..v_tours LOOP
        FOR v_joueur IN SELECT * FROM tmp_ladder ORDER BY rang LOOP
            /* Sa preference la mieux placee encore libre (zones BDA exclues) */
            SELECT pp.zone_id INTO v_zone
            FROM public.perco_preferences pp
            JOIN public.zones_perco z ON z.id = pp.zone_id AND z.actif = TRUE
            WHERE pp.user_id = v_joueur.user_id
              AND NOT EXISTS (
                  SELECT 1 FROM public.perco_reservations r
                  WHERE r.periode_debut = v_periode AND r.zone_id = pp.zone_id)
              AND NOT EXISTS (
                  SELECT 1 FROM public.zones_bda b
                  WHERE lower(trim(b.nom_zone)) = lower(trim(z.nom)))
            ORDER BY pp.ordre ASC
            LIMIT 1;

            IF v_zone IS NOT NULL THEN
                INSERT INTO public.perco_reservations (periode_debut, tour, rang, user_id, zone_id)
                VALUES (v_periode, v_tour, v_joueur.rang, v_joueur.user_id, v_zone);
                v_count := v_count + 1;
            END IF;
        END LOOP;
    END LOOP;

    RETURN jsonb_build_object('ok', true, 'message', 'Attribution calculée',
        'nouvelles', v_count, 'source', v_source, 'tours', v_tours);
END;
$$;
