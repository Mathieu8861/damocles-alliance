-- ============================================
-- Alliance REN - Sécurisation (Security Advisor fixes)
-- Exécuter dans Supabase SQL Editor
-- ============================================

-- =============================================================
-- PARTIE 1 : Fix 8 erreurs "Security Definer View"
-- Ajouter security_invoker = true à toutes les vues
-- =============================================================

CREATE OR REPLACE VIEW public.classement_pvp_semaine
WITH (security_invoker = true) AS
SELECT
    p.id,
    p.username,
    COALESCE(SUM(c.points_gagnes), 0)::INTEGER AS points
FROM public.profiles p
LEFT JOIN public.combat_participants cp ON cp.user_id = p.id
LEFT JOIN public.combats c ON c.id = cp.combat_id
    AND c.created_at >= date_trunc('week', NOW() AT TIME ZONE 'Europe/Paris')
WHERE p.is_validated = TRUE
GROUP BY p.id, p.username
HAVING COALESCE(SUM(c.points_gagnes), 0) > 0
ORDER BY points DESC;

CREATE OR REPLACE VIEW public.classement_pvp_semaine_passee
WITH (security_invoker = true) AS
SELECT
    p.id,
    p.username,
    COALESCE(SUM(c.points_gagnes), 0)::INTEGER AS points
FROM public.profiles p
LEFT JOIN public.combat_participants cp ON cp.user_id = p.id
LEFT JOIN public.combats c ON c.id = cp.combat_id
    AND c.created_at >= (date_trunc('week', NOW() AT TIME ZONE 'Europe/Paris') - INTERVAL '7 days')
    AND c.created_at < date_trunc('week', NOW() AT TIME ZONE 'Europe/Paris')
WHERE p.is_validated = TRUE
GROUP BY p.id, p.username
HAVING COALESCE(SUM(c.points_gagnes), 0) > 0
ORDER BY points DESC;

CREATE OR REPLACE VIEW public.classement_pvp_definitif
WITH (security_invoker = true) AS
SELECT
    p.id,
    p.username,
    COALESCE(SUM(c.points_gagnes), 0)::INTEGER AS points
FROM public.profiles p
LEFT JOIN public.combat_participants cp ON cp.user_id = p.id
LEFT JOIN public.combats c ON c.id = cp.combat_id
WHERE p.is_validated = TRUE
GROUP BY p.id, p.username
HAVING COALESCE(SUM(c.points_gagnes), 0) > 0
ORDER BY points DESC;

CREATE OR REPLACE VIEW public.classement_kamas_alliance
WITH (security_invoker = true) AS
SELECT
    COALESCE(a.nom, c.alliance_ennemie_nom, 'Inconnu') AS alliance_nom,
    SUM(c.butin_kamas)::BIGINT AS total_kamas
FROM public.combats c
LEFT JOIN public.alliances a ON a.id = c.alliance_ennemie_id
WHERE c.type = 'attaque' AND c.resultat = 'victoire' AND c.butin_kamas > 0
GROUP BY alliance_nom
ORDER BY total_kamas DESC;

CREATE OR REPLACE VIEW public.classement_kamas_joueur
WITH (security_invoker = true) AS
SELECT
    p.id,
    p.username,
    COALESCE(SUM(c.butin_kamas / GREATEST(c.nb_allies, 1)), 0)::BIGINT AS total_kamas
FROM public.profiles p
JOIN public.combat_participants cp ON cp.user_id = p.id
JOIN public.combats c ON c.id = cp.combat_id
WHERE c.type = 'attaque' AND c.resultat = 'victoire'
GROUP BY p.id, p.username
HAVING COALESCE(SUM(c.butin_kamas / GREATEST(c.nb_allies, 1)), 0) > 0
ORDER BY total_kamas DESC;

CREATE OR REPLACE VIEW public.classement_jetons
WITH (security_invoker = true) AS
SELECT
    p.id,
    p.username,
    p.jetons,
    p.percepteurs,
    COALESCE(s.tirages, 0)::INTEGER AS tirages,
    COALESCE(s.pepites, 0)::INTEGER AS pepites
FROM public.profiles p
LEFT JOIN (
    SELECT
        jh.user_id,
        COUNT(*)::INTEGER AS tirages,
        SUM(
            CASE
                WHEN jh.resultat = 'double' THEN jl.gain_pepites * 2
                WHEN jh.resultat = 'perdu' THEN 0
                ELSE jl.gain_pepites
            END
        )::INTEGER AS pepites
    FROM public.jeu_historique jh
    JOIN public.jeu_lots jl ON jl.id = jh.lot_id
    GROUP BY jh.user_id
) s ON s.user_id = p.id
WHERE p.is_validated = TRUE AND p.jetons > 0
ORDER BY p.jetons DESC;

CREATE OR REPLACE VIEW public.pepites_semaine_passee
WITH (security_invoker = true) AS
SELECT
    p.id, p.username,
    COUNT(jh.id)::INTEGER AS tirages,
    SUM(
        CASE
            WHEN jh.resultat = 'double' THEN jl.gain_pepites * 2
            WHEN jh.resultat = 'perdu' THEN 0
            ELSE jl.gain_pepites
        END
    )::INTEGER AS pepites
FROM public.profiles p
JOIN public.jeu_historique jh ON jh.user_id = p.id
JOIN public.jeu_lots jl ON jl.id = jh.lot_id
WHERE jh.created_at >= (date_trunc('week', NOW() AT TIME ZONE 'Europe/Paris') - INTERVAL '7 days')
  AND jh.created_at < date_trunc('week', NOW() AT TIME ZONE 'Europe/Paris')
GROUP BY p.id, p.username
HAVING SUM(CASE WHEN jh.resultat = 'double' THEN jl.gain_pepites * 2
                WHEN jh.resultat = 'perdu' THEN 0
                ELSE jl.gain_pepites END) > 0
ORDER BY pepites DESC;

CREATE OR REPLACE VIEW public.pepites_semaine_courante
WITH (security_invoker = true) AS
SELECT
    p.id, p.username,
    COUNT(jh.id)::INTEGER AS tirages,
    SUM(
        CASE
            WHEN jh.resultat = 'double' THEN jl.gain_pepites * 2
            WHEN jh.resultat = 'perdu' THEN 0
            ELSE jl.gain_pepites
        END
    )::INTEGER AS pepites
FROM public.profiles p
JOIN public.jeu_historique jh ON jh.user_id = p.id
JOIN public.jeu_lots jl ON jl.id = jh.lot_id
WHERE jh.created_at >= date_trunc('week', NOW() AT TIME ZONE 'Europe/Paris')
GROUP BY p.id, p.username
ORDER BY pepites DESC;

-- =============================================================
-- PARTIE 2 : Fix 7 warnings "Function Search Path Mutable"
-- Ajouter SET search_path = public à toutes les fonctions
-- =============================================================

-- handle_new_user
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

-- calculer_points
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

-- get_dashboard_stats
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

-- get_member_stats
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

-- protect_admin_fields
CREATE OR REPLACE FUNCTION public.protect_admin_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true) THEN
        NEW.is_admin := OLD.is_admin;
        NEW.is_validated := OLD.is_validated;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- protect_jetons
CREATE OR REPLACE FUNCTION public.protect_jetons()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true) THEN
        IF NEW.jetons != OLD.jetons AND current_setting('request.jwt.claim.role', true) = 'authenticated' THEN
            NEW.jetons := OLD.jetons;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- acheter_boutique
CREATE OR REPLACE FUNCTION public.acheter_boutique(
    p_user_id UUID,
    p_item_id INTEGER
) RETURNS INTEGER AS $$
DECLARE
    v_jetons INTEGER;
    v_prix INTEGER;
    v_stock INTEGER;
    v_nom TEXT;
BEGIN
    SELECT jetons INTO v_jetons FROM public.profiles WHERE id = p_user_id;
    IF v_jetons IS NULL THEN
        RAISE EXCEPTION 'Joueur introuvable';
    END IF;

    SELECT prix_jetons, stock, nom INTO v_prix, v_stock, v_nom
        FROM public.boutique_items WHERE id = p_item_id AND actif = true;
    IF v_prix IS NULL THEN
        RAISE EXCEPTION 'Article introuvable ou inactif';
    END IF;

    IF v_jetons < v_prix THEN
        RAISE EXCEPTION 'Solde insuffisant';
    END IF;

    IF v_stock = 0 THEN
        RAISE EXCEPTION 'Rupture de stock';
    END IF;

    UPDATE public.profiles SET jetons = jetons - v_prix WHERE id = p_user_id;

    INSERT INTO public.boutique_achats (user_id, item_id, item_nom, prix_paye, statut)
        VALUES (p_user_id, p_item_id, v_nom, v_prix, 'en_attente');

    IF v_stock > 0 THEN
        UPDATE public.boutique_items SET stock = stock - 1 WHERE id = p_item_id;
    END IF;

    RETURN v_jetons - v_prix;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- =============================================================
-- NOTE : La fonction ajouter_jetons existe en DB mais pas dans
-- les fichiers SQL locaux. Vérifier sa définition dans Supabase
-- et y ajouter SET search_path = public si nécessaire.
-- =============================================================
