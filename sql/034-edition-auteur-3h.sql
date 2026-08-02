-- ============================================================
-- 034 : L'auteur d'un combat peut le modifier pendant 3 heures
-- (les admins gardent la main sans limite, policy 032).
-- Verrou serveur : pour un non-admin, les champs sensibles sont
-- proteges et les points TOUJOURS recalcules via le bareme, meme
-- si la requete API est forgee a la main.
-- ============================================================

DROP POLICY IF EXISTS "combats_auteur_update_3h" ON public.combats;
CREATE POLICY "combats_auteur_update_3h" ON public.combats
    FOR UPDATE TO authenticated
    USING (auteur_id = auth.uid() AND created_at > NOW() - INTERVAL '3 hours')
    WITH CHECK (auteur_id = auth.uid());

CREATE OR REPLACE FUNCTION public.combat_update_guard()
RETURNS trigger AS $$
DECLARE
    is_adm BOOLEAN;
BEGIN
    SELECT is_admin INTO is_adm FROM public.profiles WHERE id = auth.uid();
    IF COALESCE(is_adm, false) THEN
        RETURN NEW;
    END IF;
    /* Non-admin (auteur dans sa fenetre de 3h, ou cle service) :
       identite et horodatage verrouilles, points imposes par le bareme */
    NEW.auteur_id := OLD.auteur_id;
    NEW.created_at := OLD.created_at;
    NEW.points_gagnes := public.calculer_points(
        p_nb_allies => NEW.nb_allies,
        p_nb_ennemis => NEW.nb_ennemis,
        p_resultat => NEW.resultat,
        p_alliance_id => NEW.alliance_ennemie_id,
        p_type => NEW.type
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

DROP TRIGGER IF EXISTS combat_update_guard ON public.combats;
CREATE TRIGGER combat_update_guard
    BEFORE UPDATE ON public.combats
    FOR EACH ROW EXECUTE FUNCTION public.combat_update_guard();
