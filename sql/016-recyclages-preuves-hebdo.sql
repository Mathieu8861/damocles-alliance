/* ============================================ */
/* Recyclages : preuves + recap hebdo admin     */
/* ============================================ */

/* ---- Colonne preuve_url ---- */
/* URL vers la capture d'ecran stockee dans le bucket Supabase  */
/* preuves-recyclages. NULL = pas de preuve attachee.           */
ALTER TABLE public.recyclages
    ADD COLUMN IF NOT EXISTS preuve_url TEXT DEFAULT NULL;

/* ---- VUE : recap par user pour la semaine ISO en cours ---- */
/* Utilise DATE_TRUNC('week', ...) qui retourne le lundi 00:00 */
/* Fuseau Europe/Paris pour aligner avec le rythme alliance.   */
CREATE OR REPLACE VIEW public.v_recyclages_semaine_par_user AS
SELECT
    r.user_id,
    p.username,
    p.avatar_url,
    COUNT(r.id)                          AS nb_recyclages,
    COALESCE(SUM(r.pepites_alliance), 0) AS total_alliance,
    COALESCE(SUM(r.pepites_perso), 0)    AS total_perso,
    COALESCE(SUM(r.plus_value), 0)       AS total_plus_value,
    COUNT(r.preuve_url)                  AS nb_avec_preuve,
    MAX(r.created_at)                    AS dernier_recyclage
FROM public.recyclages r
JOIN public.profiles p ON p.id = r.user_id
WHERE r.created_at >= DATE_TRUNC('week', NOW() AT TIME ZONE 'Europe/Paris')
GROUP BY r.user_id, p.username, p.avatar_url;

/* ---- VUE : total global de la semaine en cours ---- */
CREATE OR REPLACE VIEW public.v_recyclages_semaine_global AS
SELECT
    COUNT(r.id)                              AS nb_recyclages,
    COUNT(DISTINCT r.user_id)                AS nb_recycleurs,
    COALESCE(SUM(r.pepites_alliance), 0)     AS total_alliance,
    COALESCE(SUM(r.pepites_perso), 0)        AS total_perso,
    COALESCE(SUM(r.plus_value), 0)           AS total_plus_value,
    COUNT(r.preuve_url)                      AS nb_avec_preuve,
    DATE_TRUNC('week', NOW() AT TIME ZONE 'Europe/Paris') AS debut_semaine
FROM public.recyclages r
WHERE r.created_at >= DATE_TRUNC('week', NOW() AT TIME ZONE 'Europe/Paris');

/* ============================================ */
/* STORAGE : policies pour preuves-recyclages   */
/* ============================================ */
/* PREREQUIS : creer le bucket "preuves-recyclages" en Public  */
/* via Supabase Dashboard > Storage > New bucket.              */

/* Membre valide peut uploader */
DROP POLICY IF EXISTS "preuves_recyclages_insert" ON storage.objects;
CREATE POLICY "preuves_recyclages_insert"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'preuves-recyclages'
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_validated = true)
    );

/* Lecture publique (URL directe accessible par tous) */
DROP POLICY IF EXISTS "preuves_recyclages_select" ON storage.objects;
CREATE POLICY "preuves_recyclages_select"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'preuves-recyclages');

/* Suppression : auteur de l'upload OU admin */
DROP POLICY IF EXISTS "preuves_recyclages_delete" ON storage.objects;
CREATE POLICY "preuves_recyclages_delete"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'preuves-recyclages'
        AND (
            owner = auth.uid()
            OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
        )
    );
