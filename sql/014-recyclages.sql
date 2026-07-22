/* ============================================ */
/* Recyclages percepteurs - Suivi pepites        */
/* ============================================ */

/* === TABLE : ZONES_PERCO === */
/* Liste des zones ou un percepteur peut etre pose                */
/* niveau_zone = niveau reel de la zone (10, 20, ..., 200)        */
/* cout_pepites_pose = niveau de la potion arrondi a la tranche   */
/* de 20 superieure (20, 40, 60, ..., 200)                        */
CREATE TABLE IF NOT EXISTS public.zones_perco (
    id                  SERIAL PRIMARY KEY,
    nom                 TEXT NOT NULL UNIQUE,
    niveau_zone         INTEGER NOT NULL CHECK (niveau_zone BETWEEN 1 AND 200),
    cout_pepites_pose   INTEGER NOT NULL CHECK (cout_pepites_pose BETWEEN 20 AND 200),
    actif               BOOLEAN DEFAULT TRUE,
    ordre               INTEGER DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zones_perco_actif ON public.zones_perco(actif);

/* Helper SQL : tranche de 20 superieure d'un niveau de zone */
/* ex: 1->20, 20->20, 21->40, 40->40, 41->60, ... 200->200    */
CREATE OR REPLACE FUNCTION public.cout_potion_perco(niveau INTEGER)
RETURNS INTEGER LANGUAGE SQL IMMUTABLE AS $$
    SELECT LEAST(200, GREATEST(20, ((niveau + 19) / 20) * 20))
$$;

/* === TABLE : RECYCLAGES === */
/* Une ligne = un recyclage de percepteur                         */
/* pepites_perso / pepites_alliance = ce que le chat a affiche    */
/* cout_pose = ce que la pose a coute en pepites (snapshot zone)  */
/* plus_value = pepites_perso - cout_pose                         */
CREATE TABLE IF NOT EXISTS public.recyclages (
    id                  SERIAL PRIMARY KEY,
    user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    zone_id             INTEGER NOT NULL REFERENCES public.zones_perco(id),
    pepites_perso       INTEGER NOT NULL CHECK (pepites_perso >= 0),
    pepites_alliance    INTEGER NOT NULL CHECK (pepites_alliance >= 0),
    cout_pose           INTEGER NOT NULL CHECK (cout_pose >= 0),
    plus_value          INTEGER GENERATED ALWAYS AS (pepites_perso - cout_pose) STORED,
    message_brut        TEXT DEFAULT NULL,
    note                TEXT DEFAULT NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recyclages_user      ON public.recyclages(user_id);
CREATE INDEX IF NOT EXISTS idx_recyclages_zone      ON public.recyclages(zone_id);
CREATE INDEX IF NOT EXISTS idx_recyclages_created   ON public.recyclages(created_at DESC);

/* === VUES STATS === */

/* Total / utilisateur (perso, alliance, plus-value, nb tirs) */
CREATE OR REPLACE VIEW public.v_recyclages_par_user AS
SELECT
    r.user_id,
    p.username,
    COUNT(*)                          AS nb_recyclages,
    SUM(r.pepites_perso)              AS total_perso,
    SUM(r.pepites_alliance)           AS total_alliance,
    SUM(r.cout_pose)                  AS total_cout,
    SUM(r.plus_value)                 AS total_plus_value,
    ROUND(AVG(r.pepites_perso))::INT  AS moy_perso_par_tir,
    MAX(r.created_at)                 AS dernier_recyclage
FROM public.recyclages r
JOIN public.profiles p ON p.id = r.user_id
GROUP BY r.user_id, p.username;

/* Total / zone (toutes alliances confondues)                     */
/* Important : COUNT(r.id) et non COUNT(*) pour ne pas compter   */
/* les lignes LEFT JOIN sans recyclage comme un tir.             */
CREATE OR REPLACE VIEW public.v_recyclages_par_zone AS
SELECT
    z.id                              AS zone_id,
    z.nom                             AS zone_nom,
    z.niveau_zone,
    z.cout_pepites_pose,
    COUNT(r.id)                       AS nb_recyclages,
    COALESCE(SUM(r.pepites_perso), 0)    AS total_perso,
    COALESCE(SUM(r.pepites_alliance), 0) AS total_alliance,
    COALESCE(SUM(r.cout_pose), 0)        AS total_cout,
    COALESCE(SUM(r.plus_value), 0)       AS total_plus_value,
    COALESCE(ROUND(AVG(r.pepites_perso))::INT, 0) AS moy_perso_par_tir
FROM public.zones_perco z
LEFT JOIN public.recyclages r ON r.zone_id = z.id
GROUP BY z.id, z.nom, z.niveau_zone, z.cout_pepites_pose;

/* Totaux globaux alliance */
CREATE OR REPLACE VIEW public.v_recyclages_global AS
SELECT
    COUNT(*)                          AS nb_recyclages,
    COUNT(DISTINCT user_id)           AS nb_recycleurs,
    SUM(pepites_perso)                AS total_perso,
    SUM(pepites_alliance)             AS total_alliance,
    SUM(cout_pose)                    AS total_cout,
    SUM(plus_value)                   AS total_plus_value
FROM public.recyclages;

/* === RLS === */
ALTER TABLE public.zones_perco ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recyclages  ENABLE ROW LEVEL SECURITY;

/* Zones : tout valide lit, admin ecrit */
DROP POLICY IF EXISTS "zones_perco_select" ON public.zones_perco;
CREATE POLICY "zones_perco_select" ON public.zones_perco
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_validated = true)
    );

DROP POLICY IF EXISTS "zones_perco_admin_insert" ON public.zones_perco;
CREATE POLICY "zones_perco_admin_insert" ON public.zones_perco
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

DROP POLICY IF EXISTS "zones_perco_admin_update" ON public.zones_perco;
CREATE POLICY "zones_perco_admin_update" ON public.zones_perco
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

DROP POLICY IF EXISTS "zones_perco_admin_delete" ON public.zones_perco;
CREATE POLICY "zones_perco_admin_delete" ON public.zones_perco
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

/* Recyclages : chacun voit tout (stats alliance), chacun saisit pour lui,
   chacun edite/supprime ses propres recyclages, admin peut tout       */
DROP POLICY IF EXISTS "recyclages_select_validated" ON public.recyclages;
CREATE POLICY "recyclages_select_validated" ON public.recyclages
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_validated = true)
    );

DROP POLICY IF EXISTS "recyclages_insert_self" ON public.recyclages;
CREATE POLICY "recyclages_insert_self" ON public.recyclages
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_validated = true)
    );

DROP POLICY IF EXISTS "recyclages_update_self_or_admin" ON public.recyclages;
CREATE POLICY "recyclages_update_self_or_admin" ON public.recyclages
    FOR UPDATE USING (
        auth.uid() = user_id
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

DROP POLICY IF EXISTS "recyclages_delete_self_or_admin" ON public.recyclages;
CREATE POLICY "recyclages_delete_self_or_admin" ON public.recyclages
    FOR DELETE USING (
        auth.uid() = user_id
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

/* === SEED ZONES CONNUES (issues du JSON Mathieu) === */
/* Noms alignes sur ceux utilises dans les logs (sans accents     */
/* pour eviter les problemes d'encodage). Niveaux estimes : a     */
/* ajuster en back-office.                                        */
INSERT INTO public.zones_perco (nom, niveau_zone, cout_pepites_pose, ordre) VALUES
    ('Canopee',         120, 120, 10),
    ('Oto',             180, 180, 20),
    ('Berceau d''Alma', 180, 180, 30),
    ('Foret Malefique',  60,  60, 40),
    ('Mansot',          160, 160, 50),
    ('Dopeul',          100, 100, 60),
    ('Aerdala',         200, 200, 70),
    ('Srambad',         200, 200, 80),
    ('Moon',            150, 160, 90),
    ('Plaines de Cania', 40,  40, 100)
ON CONFLICT (nom) DO NOTHING;
