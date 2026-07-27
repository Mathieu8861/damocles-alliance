/* ============================================ */
/* Winrate : combats equilibres uniquement      */
/* ============================================ */
/* Un 2v5 perdu ou un 4v1 gagne ne dit rien du  */
/* niveau : le winrate ne compte plus que les   */
/* combats a effectifs egaux (1v1, 2v2 ... 5v5).*/
/* Les compteurs totaux de combats restent      */
/* inchanges partout.                           */

/* --- Dashboard : winrates globaux --- */
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_kamas', COALESCE((
            SELECT SUM(butin_kamas) FROM public.combats
            WHERE type = 'attaque' AND resultat = 'victoire'
        ), 0),
        'nb_attaques', (
            SELECT COUNT(*) FROM public.combats WHERE type = 'attaque'
        ),
        'nb_defenses', (
            SELECT COUNT(*) FROM public.combats WHERE type = 'defense'
        ),
        'winrate_attaque', COALESCE((
            SELECT ROUND(
                COUNT(*) FILTER (WHERE resultat = 'victoire')::numeric /
                NULLIF(COUNT(*)::numeric, 0) * 100, 1
            )
            FROM public.combats
            WHERE type = 'attaque' AND nb_allies = nb_ennemis
        ), 0),
        'winrate_defense', COALESCE((
            SELECT ROUND(
                COUNT(*) FILTER (WHERE resultat = 'victoire')::numeric /
                NULLIF(COUNT(*)::numeric, 0) * 100, 1
            )
            FROM public.combats
            WHERE type = 'defense' AND nb_allies = nb_ennemis
        ), 0),
        'menace_nom', COALESCE((
            SELECT COALESCE(a.nom, c.alliance_ennemie_nom)
            FROM public.combats c
            LEFT JOIN public.alliances a ON a.id = c.alliance_ennemie_id
            WHERE c.alliance_ennemie_id IS NOT NULL OR c.alliance_ennemie_nom IS NOT NULL
            GROUP BY COALESCE(a.nom, c.alliance_ennemie_nom)
            ORDER BY COUNT(*) DESC
            LIMIT 1
        ), 'Aucune')
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

/* --- Stats par membre : ajout des compteurs equilibres --- */
/* Le type de retour change : DROP obligatoire avant CREATE. */
DROP FUNCTION IF EXISTS public.get_member_stats();

CREATE FUNCTION public.get_member_stats()
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    classe TEXT,
    element TEXT,
    jetons INTEGER,
    percepteurs INTEGER,
    referent_pvp TEXT,
    disponibilite_pvp TEXT,
    avatar_url TEXT,
    dofusbook_url TEXT,
    mules TEXT[],
    total_attaques BIGINT,
    victoires_attaque BIGINT,
    total_defenses BIGINT,
    victoires_defense BIGINT,
    eq_attaques BIGINT,
    eq_victoires_attaque BIGINT,
    eq_defenses BIGINT,
    eq_victoires_defense BIGINT,
    total_kamas NUMERIC,
    total_points NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id AS user_id,
        p.username,
        p.classe,
        p.element,
        p.jetons,
        p.percepteurs,
        p.referent_pvp,
        p.disponibilite_pvp,
        p.avatar_url,
        p.dofusbook_url,
        p.mules,
        COALESCE(stats.total_atk, 0)::BIGINT AS total_attaques,
        COALESCE(stats.win_atk, 0)::BIGINT AS victoires_attaque,
        COALESCE(stats.total_def, 0)::BIGINT AS total_defenses,
        COALESCE(stats.win_def, 0)::BIGINT AS victoires_defense,
        COALESCE(stats.eq_atk, 0)::BIGINT AS eq_attaques,
        COALESCE(stats.eq_win_atk, 0)::BIGINT AS eq_victoires_attaque,
        COALESCE(stats.eq_def, 0)::BIGINT AS eq_defenses,
        COALESCE(stats.eq_win_def, 0)::BIGINT AS eq_victoires_defense,
        COALESCE(stats.kamas, 0)::NUMERIC AS total_kamas,
        COALESCE(stats.points, 0)::NUMERIC AS total_points
    FROM public.profiles p
    LEFT JOIN LATERAL (
        SELECT
            COUNT(*) FILTER (WHERE c.type = 'attaque') AS total_atk,
            COUNT(*) FILTER (WHERE c.type = 'attaque' AND c.resultat = 'victoire') AS win_atk,
            COUNT(*) FILTER (WHERE c.type = 'defense') AS total_def,
            COUNT(*) FILTER (WHERE c.type = 'defense' AND c.resultat = 'victoire') AS win_def,
            COUNT(*) FILTER (WHERE c.type = 'attaque' AND c.nb_allies = c.nb_ennemis) AS eq_atk,
            COUNT(*) FILTER (WHERE c.type = 'attaque' AND c.resultat = 'victoire' AND c.nb_allies = c.nb_ennemis) AS eq_win_atk,
            COUNT(*) FILTER (WHERE c.type = 'defense' AND c.nb_allies = c.nb_ennemis) AS eq_def,
            COUNT(*) FILTER (WHERE c.type = 'defense' AND c.resultat = 'victoire' AND c.nb_allies = c.nb_ennemis) AS eq_win_def,
            SUM(CASE WHEN c.type = 'attaque' AND c.resultat = 'victoire' THEN c.butin_kamas / GREATEST(c.nb_allies, 1) ELSE 0 END) AS kamas,
            SUM(c.points_gagnes) AS points
        FROM public.combat_participants cp
        JOIN public.combats c ON c.id = cp.combat_id
        WHERE cp.user_id = p.id
    ) stats ON TRUE
    WHERE p.is_validated = TRUE
    ORDER BY p.username;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;
