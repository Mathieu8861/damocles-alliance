/* ============================================ */
/* Interrupteur jetons + fonction ajouter_jetons */
/* ============================================ */
/* 1. Table site_config : reglages generaux du   */
/*    site (cle/valeur), ecriture admin.         */
/* 2. jetons_actifs : quand 'false', plus aucun  */
/*    jeton distribue sur les combats. Les       */
/*    jetons deja gagnes sont CONSERVES (on ne   */
/*    supprime jamais, on arrete de generer).    */
/* 3. ajouter_jetons : fonction creee a la main  */
/*    sur REN, jamais migree (manquante sur      */
/*    Damocles). Recreee ici avec le respect de  */
/*    l'interrupteur + garde anti-abus.          */
/* ============================================ */

CREATE TABLE IF NOT EXISTS public.site_config (
    cle         TEXT PRIMARY KEY,
    valeur      TEXT NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_config_select" ON public.site_config;
CREATE POLICY "site_config_select" ON public.site_config
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "site_config_admin_insert" ON public.site_config;
CREATE POLICY "site_config_admin_insert" ON public.site_config
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

DROP POLICY IF EXISTS "site_config_admin_update" ON public.site_config;
CREATE POLICY "site_config_admin_update" ON public.site_config
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

DROP POLICY IF EXISTS "site_config_admin_delete" ON public.site_config;
CREATE POLICY "site_config_admin_delete" ON public.site_config
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

INSERT INTO public.site_config (cle, valeur) VALUES ('jetons_actifs', 'true')
ON CONFLICT (cle) DO NOTHING;

/* Fonction de credit des jetons (1 point = 1 jeton) :               */
/* - refuse les montants aberrants (garde anti-abus, plafond 200)    */
/* - refuse si l'appelant n'est pas un membre valide                 */
/* - ne fait RIEN si jetons_actifs = 'false' (l'interrupteur)        */
/* - neutralise le trigger protect_jetons le temps de la maj legit.  */
CREATE OR REPLACE FUNCTION public.ajouter_jetons(p_user_id UUID, p_points INTEGER)
RETURNS VOID AS $$
DECLARE
    v_valeur TEXT;
BEGIN
    IF p_user_id IS NULL OR p_points IS NULL OR p_points < 1 OR p_points > 200 THEN
        RETURN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_validated = true) THEN
        RETURN;
    END IF;

    SELECT valeur INTO v_valeur FROM public.site_config WHERE cle = 'jetons_actifs';
    IF COALESCE(v_valeur, 'true') <> 'true' THEN
        RETURN; /* distribution coupee : on ne genere plus, on ne retire rien */
    END IF;

    PERFORM set_config('request.jwt.claim.role', 'rpc_jetons', true);
    UPDATE public.profiles
    SET jetons = COALESCE(jetons, 0) + p_points
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
