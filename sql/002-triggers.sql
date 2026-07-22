-- ============================================
-- Alliance REN - Triggers & Functions
-- A executer apres 001-schema.sql
-- ============================================

-- === TRIGGER: Auto-create profile on signup ===
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, classe, element, dofusbook_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || LEFT(NEW.id::text, 8)),
        NEW.raw_user_meta_data->>'classe',
        NEW.raw_user_meta_data->>'element',
        NEW.raw_user_meta_data->>'dofusbook_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- === FUNCTION: Calculer les points d'un combat ===
CREATE OR REPLACE FUNCTION public.calculer_points(
    p_nb_allies INTEGER,
    p_nb_ennemis INTEGER,
    p_resultat TEXT,
    p_alliance_id INTEGER DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    base_points INTEGER;
    mult NUMERIC(3,1) := 1;
BEGIN
    -- Recuperer les points du bareme
    SELECT
        CASE
            WHEN p_resultat = 'victoire' THEN b.points_victoire
            ELSE b.points_defaite
        END
    INTO base_points
    FROM public.bareme_points b
    WHERE b.nb_allies = p_nb_allies AND b.nb_ennemis = p_nb_ennemis;

    IF base_points IS NULL THEN
        base_points := 0;
    END IF;

    -- Appliquer le multiplicateur de l'alliance (seulement en victoire)
    IF p_alliance_id IS NOT NULL AND p_resultat = 'victoire' THEN
        SELECT a.multiplicateur INTO mult
        FROM public.alliances a
        WHERE a.id = p_alliance_id;

        IF mult IS NULL THEN
            mult := 1;
        END IF;
    END IF;

    RETURN ROUND(base_points * mult);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- === FUNCTION: Stats du dashboard ===
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
            FROM public.combats WHERE type = 'attaque'
        ), 0),
        'winrate_defense', COALESCE((
            SELECT ROUND(
                COUNT(*) FILTER (WHERE resultat = 'victoire')::numeric /
                NULLIF(COUNT(*)::numeric, 0) * 100, 1
            )
            FROM public.combats WHERE type = 'defense'
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

-- === FUNCTION: Stats par membre ===
CREATE OR REPLACE FUNCTION public.get_member_stats()
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
        COALESCE(stats.kamas, 0)::NUMERIC AS total_kamas,
        COALESCE(stats.points, 0)::NUMERIC AS total_points
    FROM public.profiles p
    LEFT JOIN LATERAL (
        SELECT
            COUNT(*) FILTER (WHERE c.type = 'attaque') AS total_atk,
            COUNT(*) FILTER (WHERE c.type = 'attaque' AND c.resultat = 'victoire') AS win_atk,
            COUNT(*) FILTER (WHERE c.type = 'defense') AS total_def,
            COUNT(*) FILTER (WHERE c.type = 'defense' AND c.resultat = 'victoire') AS win_def,
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
