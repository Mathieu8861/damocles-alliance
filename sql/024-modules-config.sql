/* ============================================ */
/* Modules activables (feature flags)           */
/* ============================================ */
/* L'admin choisit quels modules du site sont   */
/* visibles. Un module desactive disparait de   */
/* la sidebar et ses pages redirigent vers      */
/* l'accueil. Reactivable a tout moment.        */
/* Tout est actif par defaut (aucun changement  */
/* pour le site existant).                      */
/* ============================================ */

CREATE TABLE IF NOT EXISTS public.modules_config (
    module      TEXT PRIMARY KEY,
    actif       BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.modules_config ENABLE ROW LEVEL SECURITY;

/* Lecture par tout le monde (la sidebar en a besoin des le chargement) */
DROP POLICY IF EXISTS "modules_select" ON public.modules_config;
CREATE POLICY "modules_select" ON public.modules_config
    FOR SELECT USING (true);

/* Ecriture admin uniquement */
DROP POLICY IF EXISTS "modules_admin_insert" ON public.modules_config;
CREATE POLICY "modules_admin_insert" ON public.modules_config
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

DROP POLICY IF EXISTS "modules_admin_update" ON public.modules_config;
CREATE POLICY "modules_admin_update" ON public.modules_config
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

DROP POLICY IF EXISTS "modules_admin_delete" ON public.modules_config;
CREATE POLICY "modules_admin_delete" ON public.modules_config
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

/* Seed : tous les modules actifs par defaut */
INSERT INTO public.modules_config (module, actif) VALUES
    ('attaque',    TRUE),
    ('defense',    TRUE),
    ('historique', TRUE),
    ('classement', TRUE),
    ('membres',    TRUE),
    ('builds',     TRUE),
    ('board',      TRUE),
    ('liens',      TRUE),
    ('boutique',   TRUE),
    ('recyclages', TRUE),
    ('fm',         TRUE),
    ('jeux',       TRUE)
ON CONFLICT (module) DO NOTHING;
