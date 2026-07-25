/* ================================================================ */
/* INSTALLATION COMPLETE - ALLIANCE DAMOCLES [DMO]                 */
/* ================================================================ */
/* Script unique : migrations REN 001 a 024 en ordre chronologique, */
/* rendu re-runnable (DROP avant chaque policy), + correctifs de    */
/* rejeu, + colonnes de derive de schema REN, + overrides Damocles. */
/* Prerequis : buckets Storage publics 'preuves-recyclages' et      */
/* 'builds' crees via Dashboard (voir INSTALLATION.md).             */
/* ================================================================ */



/* ################################################################ */
/* ### SOURCE : 001-schema.sql ################################### */
/* ################################################################ */

-- ============================================
-- Alliance REN - Schema Base de Donnees
-- A executer dans Supabase SQL Editor
-- ============================================

-- === TABLE: PROFILES ===
-- Extend Supabase auth.users avec les infos joueur
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    classe TEXT DEFAULT NULL,
    element TEXT DEFAULT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    is_validated BOOLEAN DEFAULT FALSE,
    jetons INTEGER DEFAULT 0,
    percepteurs INTEGER DEFAULT 0,
    referent_pvp TEXT DEFAULT NULL,
    disponibilite_pvp TEXT DEFAULT NULL,
    avatar_url TEXT DEFAULT NULL,
    dofusbook_url TEXT DEFAULT NULL,
    prefere_pepites BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- === TABLE: ALLIANCES ===
-- Alliances ennemies avec multiplicateur de points
CREATE TABLE public.alliances (
    id SERIAL PRIMARY KEY,
    nom TEXT NOT NULL,
    tag TEXT DEFAULT NULL,
    multiplicateur INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- === TABLE: COMBATS ===
-- Chaque attaque ou defense enregistree
CREATE TABLE public.combats (
    id SERIAL PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('attaque', 'defense')),
    auteur_id UUID NOT NULL REFERENCES public.profiles(id),
    alliance_ennemie_id INTEGER REFERENCES public.alliances(id),
    alliance_ennemie_nom TEXT DEFAULT NULL,
    nb_allies INTEGER NOT NULL CHECK (nb_allies BETWEEN 1 AND 5),
    nb_ennemis INTEGER NOT NULL CHECK (nb_ennemis BETWEEN 1 AND 5),
    resultat TEXT NOT NULL CHECK (resultat IN ('victoire', 'defaite')),
    butin_kamas BIGINT DEFAULT 0,
    points_gagnes INTEGER DEFAULT 0,
    commentaire TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- === TABLE: COMBAT_PARTICIPANTS ===
-- Qui a participe a chaque combat
CREATE TABLE public.combat_participants (
    id SERIAL PRIMARY KEY,
    combat_id INTEGER NOT NULL REFERENCES public.combats(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    UNIQUE(combat_id, user_id)
);

-- === TABLE: BAREME_POINTS ===
-- Grille 5x5 configurable par l'admin
CREATE TABLE public.bareme_points (
    id SERIAL PRIMARY KEY,
    nb_allies INTEGER NOT NULL CHECK (nb_allies BETWEEN 1 AND 5),
    nb_ennemis INTEGER NOT NULL CHECK (nb_ennemis BETWEEN 1 AND 5),
    points_victoire INTEGER NOT NULL DEFAULT 0,
    points_defaite INTEGER NOT NULL DEFAULT 0,
    UNIQUE(nb_allies, nb_ennemis)
);

-- Pre-remplir la grille 5x5 avec des valeurs par defaut (a configurer par l'admin)
INSERT INTO public.bareme_points (nb_allies, nb_ennemis, points_victoire, points_defaite) VALUES
(1, 1, 3, -1), (1, 2, 5, 0), (1, 3, 8, 0), (1, 4, 12, 0), (1, 5, 15, 0),
(2, 1, 2, -1), (2, 2, 3, -1), (2, 3, 5, 0), (2, 4, 8, 0), (2, 5, 12, 0),
(3, 1, 1, -2), (3, 2, 2, -1), (3, 3, 3, -1), (3, 4, 5, 0), (3, 5, 8, 0),
(4, 1, 1, -2), (4, 2, 1, -2), (4, 3, 2, -1), (4, 4, 3, -1), (4, 5, 5, 0),
(5, 1, 1, -3), (5, 2, 1, -2), (5, 3, 1, -2), (5, 4, 2, -1), (5, 5, 3, -1);

-- === TABLE: BUILDS ===
-- Builds Dofus geres par les admins
CREATE TABLE public.builds (
    id SERIAL PRIMARY KEY,
    titre TEXT NOT NULL,
    description TEXT DEFAULT '',
    lien_dofusbook TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- === TABLE: JEU_CONFIG ===
-- Configuration du jeu de cartes
CREATE TABLE public.jeu_config (
    id SERIAL PRIMARY KEY,
    prix_tirage INTEGER NOT NULL DEFAULT 12
);

INSERT INTO public.jeu_config (prix_tirage) VALUES (12);

-- === TABLE: JEU_LOTS ===
-- Lots disponibles dans le jeu de cartes
CREATE TABLE public.jeu_lots (
    id SERIAL PRIMARY KEY,
    nom TEXT NOT NULL,
    pourcentage NUMERIC(5,2) NOT NULL,
    gain_jetons INTEGER DEFAULT 0,
    gain_pepites INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- === TABLE: JEU_HISTORIQUE ===
-- Historique des tirages du jeu de cartes
CREATE TABLE public.jeu_historique (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    lot_id INTEGER NOT NULL REFERENCES public.jeu_lots(id),
    resultat TEXT NOT NULL CHECK (resultat IN ('normal', 'double', 'perdu')),
    donne BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- === INDEX ===
CREATE INDEX idx_combats_auteur ON public.combats(auteur_id);
CREATE INDEX idx_combats_created ON public.combats(created_at DESC);
CREATE INDEX idx_combats_type ON public.combats(type);
CREATE INDEX idx_combat_participants_combat ON public.combat_participants(combat_id);
CREATE INDEX idx_combat_participants_user ON public.combat_participants(user_id);
CREATE INDEX idx_jeu_historique_user ON public.jeu_historique(user_id);
CREATE INDEX idx_profiles_validated ON public.profiles(is_validated);


/* ################################################################ */
/* ### SOURCE : 002-triggers.sql ################################### */
/* ################################################################ */

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


/* ################################################################ */
/* ### SOURCE : 003-views.sql ################################### */
/* ################################################################ */

-- ============================================
-- Alliance REN - Views (Classements)
-- A executer apres 002-triggers.sql
-- ============================================

-- === VIEW: Classement PVP Semaine ===
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

-- === VIEW: Classement PVP Semaine Passée ===
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

-- === VIEW: Classement PVP Definitif ===
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

-- === VIEW: Classement Kamas Voles par Alliance ===
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

-- === VIEW: Classement Kamas Voles par Joueur ===
-- Divise le butin par le nombre d'allies pour attribuer la part individuelle
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

-- === VIEW: Classement Jetons (avec stats tirages) ===
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

-- === VIEW: Pépites gagnées au jeu — Semaine passée ===
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

-- === VIEW: Pépites gagnées au jeu — Semaine en cours ===
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


/* ################################################################ */
/* ### SOURCE : 004-rls.sql ################################### */
/* ################################################################ */

-- ============================================
-- Alliance REN - Row Level Security (RLS)
-- A executer apres 003-views.sql
-- ============================================

-- === PROFILES ===
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Tout utilisateur authentifie peut lire les profils
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
    FOR SELECT TO authenticated USING (true);

-- Un user peut modifier son propre profil (mais pas is_admin/is_validated)
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
CREATE POLICY "profiles_update_self" ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Un admin peut tout modifier sur les profils
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
CREATE POLICY "profiles_admin_update" ON public.profiles
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- Un admin peut supprimer un profil
DROP POLICY IF EXISTS "profiles_admin_delete" ON public.profiles;
CREATE POLICY "profiles_admin_delete" ON public.profiles
    FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- === ALLIANCES ===
ALTER TABLE public.alliances ENABLE ROW LEVEL SECURITY;

-- Tout user authentifie peut lire
DROP POLICY IF EXISTS "alliances_select" ON public.alliances;
CREATE POLICY "alliances_select" ON public.alliances
    FOR SELECT TO authenticated USING (true);

-- Seuls les admins peuvent gerer
DROP POLICY IF EXISTS "alliances_admin_insert" ON public.alliances;
CREATE POLICY "alliances_admin_insert" ON public.alliances
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

DROP POLICY IF EXISTS "alliances_admin_update" ON public.alliances;
CREATE POLICY "alliances_admin_update" ON public.alliances
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

DROP POLICY IF EXISTS "alliances_admin_delete" ON public.alliances;
CREATE POLICY "alliances_admin_delete" ON public.alliances
    FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- === COMBATS ===
ALTER TABLE public.combats ENABLE ROW LEVEL SECURITY;

-- Tout user authentifie peut lire
DROP POLICY IF EXISTS "combats_select" ON public.combats;
CREATE POLICY "combats_select" ON public.combats
    FOR SELECT TO authenticated USING (true);

-- Seuls les users valides peuvent inserer
DROP POLICY IF EXISTS "combats_insert" ON public.combats;
CREATE POLICY "combats_insert" ON public.combats
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_validated = true));

-- Un admin peut supprimer
DROP POLICY IF EXISTS "combats_admin_delete" ON public.combats;
CREATE POLICY "combats_admin_delete" ON public.combats
    FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- === COMBAT_PARTICIPANTS ===
ALTER TABLE public.combat_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "participants_select" ON public.combat_participants;
CREATE POLICY "participants_select" ON public.combat_participants
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "participants_insert" ON public.combat_participants;
CREATE POLICY "participants_insert" ON public.combat_participants
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_validated = true));

DROP POLICY IF EXISTS "participants_admin_delete" ON public.combat_participants;
CREATE POLICY "participants_admin_delete" ON public.combat_participants
    FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- === BAREME_POINTS ===
ALTER TABLE public.bareme_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bareme_select" ON public.bareme_points;
CREATE POLICY "bareme_select" ON public.bareme_points
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "bareme_admin_update" ON public.bareme_points;
CREATE POLICY "bareme_admin_update" ON public.bareme_points
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- === BUILDS ===
ALTER TABLE public.builds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "builds_select" ON public.builds;
CREATE POLICY "builds_select" ON public.builds
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "builds_admin_insert" ON public.builds;
CREATE POLICY "builds_admin_insert" ON public.builds
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

DROP POLICY IF EXISTS "builds_admin_update" ON public.builds;
CREATE POLICY "builds_admin_update" ON public.builds
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

DROP POLICY IF EXISTS "builds_admin_delete" ON public.builds;
CREATE POLICY "builds_admin_delete" ON public.builds
    FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- === JEU_CONFIG ===
ALTER TABLE public.jeu_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jeu_config_select" ON public.jeu_config;
CREATE POLICY "jeu_config_select" ON public.jeu_config
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "jeu_config_admin_update" ON public.jeu_config;
CREATE POLICY "jeu_config_admin_update" ON public.jeu_config
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- === JEU_LOTS ===
ALTER TABLE public.jeu_lots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jeu_lots_select" ON public.jeu_lots;
CREATE POLICY "jeu_lots_select" ON public.jeu_lots
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "jeu_lots_admin_all" ON public.jeu_lots;
CREATE POLICY "jeu_lots_admin_all" ON public.jeu_lots
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- === JEU_HISTORIQUE ===
ALTER TABLE public.jeu_historique ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jeu_historique_select" ON public.jeu_historique;
CREATE POLICY "jeu_historique_select" ON public.jeu_historique
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "jeu_historique_insert" ON public.jeu_historique;
CREATE POLICY "jeu_historique_insert" ON public.jeu_historique
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_validated = true));

DROP POLICY IF EXISTS "jeu_historique_admin_delete" ON public.jeu_historique;
CREATE POLICY "jeu_historique_admin_delete" ON public.jeu_historique
    FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));


/* ################################################################ */
/* ### SOURCE : 005-bareme-split.sql ################################### */
/* ################################################################ */

-- ============================================
-- Alliance REN - Migration: Bareme Attaque / Defense
-- Separe le bareme en 2 grilles (attaque + defense)
-- A executer dans Supabase SQL Editor
-- ============================================

-- 1) Ajouter colonne type au bareme
ALTER TABLE public.bareme_points
ADD COLUMN type TEXT NOT NULL DEFAULT 'attaque'
CHECK (type IN ('attaque', 'defense'));

-- 2) Supprimer l'ancienne contrainte unique
ALTER TABLE public.bareme_points
DROP CONSTRAINT bareme_points_nb_allies_nb_ennemis_key;

-- 3) Nouvelle contrainte unique incluant le type
ALTER TABLE public.bareme_points
ADD CONSTRAINT bareme_points_type_allies_ennemis_key UNIQUE(type, nb_allies, nb_ennemis);

-- 4) Dupliquer les lignes existantes pour la defense
INSERT INTO public.bareme_points (nb_allies, nb_ennemis, points_victoire, points_defaite, type)
SELECT nb_allies, nb_ennemis, points_victoire, points_defaite, 'defense'
FROM public.bareme_points
WHERE type = 'attaque';

-- 5) Mettre a jour la fonction calculer_points pour accepter le type
CREATE OR REPLACE FUNCTION public.calculer_points(
    p_nb_allies INTEGER,
    p_nb_ennemis INTEGER,
    p_resultat TEXT,
    p_alliance_id INTEGER DEFAULT NULL,
    p_type TEXT DEFAULT 'attaque'
)
RETURNS INTEGER AS $$
DECLARE
    base_points INTEGER;
    mult NUMERIC(3,1) := 1;
BEGIN
    -- Recuperer les points du bareme selon le type (attaque ou defense)
    SELECT
        CASE
            WHEN p_resultat = 'victoire' THEN b.points_victoire
            ELSE b.points_defaite
        END
    INTO base_points
    FROM public.bareme_points b
    WHERE b.nb_allies = p_nb_allies
      AND b.nb_ennemis = p_nb_ennemis
      AND b.type = p_type;

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
$$ LANGUAGE plpgsql SECURITY DEFINER;


/* ################################################################ */
/* ### SOURCE : 006-board-hebdo.sql ################################### */
/* ################################################################ */

-- ============================================
-- Alliance REN - Board Hebdomadaire
-- Archivage semaines + récompenses auto
-- A exécuter dans Supabase SQL Editor
-- ============================================

-- === TABLE: SEMAINES ===
-- Chaque semaine archivée
CREATE TABLE public.semaines (
    id SERIAL PRIMARY KEY,
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    archivee_par UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- === TABLE: SEMAINE_SNAPSHOTS ===
-- Points de chaque joueur pour chaque semaine archivée
CREATE TABLE public.semaine_snapshots (
    id SERIAL PRIMARY KEY,
    semaine_id INTEGER NOT NULL REFERENCES public.semaines(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    username TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 0,
    rang INTEGER NOT NULL DEFAULT 0,
    recompense_pepites INTEGER DEFAULT 0,
    recompense_percepteurs INTEGER DEFAULT 0,
    UNIQUE(semaine_id, user_id)
);

-- === TABLE: RECOMPENSES_CONFIG ===
-- Barème des récompenses hebdo (configurable par admin)
CREATE TABLE public.recompenses_config (
    id SERIAL PRIMARY KEY,
    label TEXT NOT NULL,
    emoji TEXT DEFAULT '',
    seuil_min INTEGER NOT NULL,
    seuil_max INTEGER DEFAULT NULL,
    percepteurs_bonus INTEGER DEFAULT 0,
    pepites INTEGER DEFAULT 0,
    ordre INTEGER DEFAULT 0
);

-- Barème par défaut (basé sur ton Discord)
INSERT INTO public.recompenses_config (label, emoji, seuil_min, seuil_max, percepteurs_bonus, pepites, ordre) VALUES
('Élite', '💎', 50, NULL, 3, 2000, 1),
('Vétéran', '💎', 30, 49, 2, 1200, 2),
('Actif', '🏆', 5, 29, 1, 800, 3),
('Participant', '⚙️', 1, 4, 0, 0, 4);

-- === INDEX ===
CREATE INDEX idx_semaines_dates ON public.semaines(date_debut DESC);
CREATE INDEX idx_snapshots_semaine ON public.semaine_snapshots(semaine_id);
CREATE INDEX idx_snapshots_user ON public.semaine_snapshots(user_id);

-- === RLS ===
ALTER TABLE public.semaines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semaine_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recompenses_config ENABLE ROW LEVEL SECURITY;

-- Lecture pour tous les utilisateurs authentifiés
DROP POLICY IF EXISTS "semaines_select" ON public.semaines;
CREATE POLICY "semaines_select" ON public.semaines FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "snapshots_select" ON public.semaine_snapshots;
CREATE POLICY "snapshots_select" ON public.semaine_snapshots FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "recompenses_select" ON public.recompenses_config;
CREATE POLICY "recompenses_select" ON public.recompenses_config FOR SELECT TO authenticated USING (true);

-- Écriture réservée aux admins
DROP POLICY IF EXISTS "semaines_insert" ON public.semaines;
CREATE POLICY "semaines_insert" ON public.semaines FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
DROP POLICY IF EXISTS "snapshots_insert" ON public.semaine_snapshots;
CREATE POLICY "snapshots_insert" ON public.semaine_snapshots FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
DROP POLICY IF EXISTS "recompenses_all" ON public.recompenses_config;
CREATE POLICY "recompenses_all" ON public.recompenses_config FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));


/* ################################################################ */
/* ### SOURCE : 007-boutique.sql ################################### */
/* ################################################################ */

-- =============================================
-- 007-boutique.sql
-- Boutique : articles, achats, demandes kamas
-- =============================================

-- === TABLE: Configuration boutique ===
CREATE TABLE IF NOT EXISTS public.boutique_config (
    id SERIAL PRIMARY KEY,
    taux_kamas_par_jeton INTEGER DEFAULT 5000
);
INSERT INTO public.boutique_config (taux_kamas_par_jeton) VALUES (5000)
ON CONFLICT DO NOTHING;

-- === TABLE: Articles en vente ===
CREATE TABLE IF NOT EXISTS public.boutique_items (
    id SERIAL PRIMARY KEY,
    nom TEXT NOT NULL,
    description TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    prix_jetons INTEGER NOT NULL DEFAULT 1,
    stock INTEGER DEFAULT -1,
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- === TABLE: Achats (jetons → ressource) ===
CREATE TABLE IF NOT EXISTS public.boutique_achats (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    item_id INTEGER NOT NULL REFERENCES public.boutique_items(id),
    item_nom TEXT NOT NULL DEFAULT '',
    prix_paye INTEGER NOT NULL,
    statut TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'distribue')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- === TABLE: Demandes achat jetons avec kamas ===
CREATE TABLE IF NOT EXISTS public.boutique_demandes_kamas (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    montant_kamas BIGINT NOT NULL,
    jetons_demandes INTEGER NOT NULL,
    statut TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'valide', 'refuse')),
    admin_note TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- === RLS: boutique_config ===
ALTER TABLE public.boutique_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "boutique_config_select" ON public.boutique_config;
CREATE POLICY "boutique_config_select" ON public.boutique_config
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "boutique_config_admin" ON public.boutique_config;
CREATE POLICY "boutique_config_admin" ON public.boutique_config
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- === RLS: boutique_items ===
ALTER TABLE public.boutique_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "boutique_items_select" ON public.boutique_items;
CREATE POLICY "boutique_items_select" ON public.boutique_items
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "boutique_items_admin" ON public.boutique_items;
CREATE POLICY "boutique_items_admin" ON public.boutique_items
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- === RLS: boutique_achats ===
ALTER TABLE public.boutique_achats ENABLE ROW LEVEL SECURITY;

-- Joueur peut voir ses propres achats
DROP POLICY IF EXISTS "boutique_achats_select_own" ON public.boutique_achats;
CREATE POLICY "boutique_achats_select_own" ON public.boutique_achats
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Joueur peut créer un achat pour lui-même
DROP POLICY IF EXISTS "boutique_achats_insert_own" ON public.boutique_achats;
CREATE POLICY "boutique_achats_insert_own" ON public.boutique_achats
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Joueur peut supprimer ses achats distribués
DROP POLICY IF EXISTS "boutique_achats_delete_own" ON public.boutique_achats;
CREATE POLICY "boutique_achats_delete_own" ON public.boutique_achats
    FOR DELETE TO authenticated
    USING (user_id = auth.uid() AND statut = 'distribue');

-- Admin peut tout voir et modifier
DROP POLICY IF EXISTS "boutique_achats_admin" ON public.boutique_achats;
CREATE POLICY "boutique_achats_admin" ON public.boutique_achats
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- === RLS: boutique_demandes_kamas ===
ALTER TABLE public.boutique_demandes_kamas ENABLE ROW LEVEL SECURITY;

-- Joueur peut voir ses propres demandes
DROP POLICY IF EXISTS "boutique_demandes_select_own" ON public.boutique_demandes_kamas;
CREATE POLICY "boutique_demandes_select_own" ON public.boutique_demandes_kamas
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Joueur peut créer une demande pour lui-même
DROP POLICY IF EXISTS "boutique_demandes_insert_own" ON public.boutique_demandes_kamas;
CREATE POLICY "boutique_demandes_insert_own" ON public.boutique_demandes_kamas
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Admin peut tout voir et modifier
DROP POLICY IF EXISTS "boutique_demandes_admin" ON public.boutique_demandes_kamas;
CREATE POLICY "boutique_demandes_admin" ON public.boutique_demandes_kamas
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- === RPC: Achat transactionnel ===
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
    -- Lire solde joueur
    SELECT jetons INTO v_jetons FROM public.profiles WHERE id = p_user_id;
    IF v_jetons IS NULL THEN
        RAISE EXCEPTION 'Joueur introuvable';
    END IF;

    -- Lire item
    SELECT prix_jetons, stock, nom INTO v_prix, v_stock, v_nom
        FROM public.boutique_items WHERE id = p_item_id AND actif = true;
    IF v_prix IS NULL THEN
        RAISE EXCEPTION 'Article introuvable ou inactif';
    END IF;

    -- Vérif solde
    IF v_jetons < v_prix THEN
        RAISE EXCEPTION 'Solde insuffisant';
    END IF;

    -- Vérif stock
    IF v_stock = 0 THEN
        RAISE EXCEPTION 'Rupture de stock';
    END IF;

    -- Débiter les jetons
    UPDATE public.profiles SET jetons = jetons - v_prix WHERE id = p_user_id;

    -- Insérer l'achat
    INSERT INTO public.boutique_achats (user_id, item_id, item_nom, prix_paye, statut)
        VALUES (p_user_id, p_item_id, v_nom, v_prix, 'en_attente');

    -- Décrémenter le stock si limité
    IF v_stock > 0 THEN
        UPDATE public.boutique_items SET stock = stock - 1 WHERE id = p_item_id;
    END IF;

    RETURN v_jetons - v_prix;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- === STORAGE: Bucket pour images boutique ===
-- INSERT INTO storage.buckets (id, name, public) VALUES ('boutique', 'boutique', true);
-- Note : exécuter séparément dans Supabase SQL Editor car storage.buckets
-- n'est pas accessible via les migrations classiques.
-- Policies Storage :
-- CREATE POLICY "boutique_images_select" ON storage.objects FOR SELECT USING (bucket_id = 'boutique');
-- CREATE POLICY "boutique_images_admin" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'boutique' AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
-- CREATE POLICY "boutique_images_admin_delete" ON storage.objects FOR DELETE USING (bucket_id = 'boutique' AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));


/* ################################################################ */
/* ### SOURCE : 005-securite.sql ################################### */
/* ################################################################ */

-- ============================================
-- Alliance REN - Renforcement Sécurité
-- A exécuter après 004-rls.sql
-- ============================================

-- =============================================================
-- CRITIQUE : Empêcher un user de modifier is_admin/is_validated
-- sur son propre profil (anti privilege escalation)
-- =============================================================
CREATE OR REPLACE FUNCTION public.protect_admin_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Si l'utilisateur n'est PAS admin, il ne peut pas modifier ces champs
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true) THEN
        NEW.is_admin := OLD.is_admin;
        NEW.is_validated := OLD.is_validated;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

DROP TRIGGER IF EXISTS trigger_protect_admin_fields ON public.profiles;
CREATE TRIGGER trigger_protect_admin_fields
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_admin_fields();

-- =============================================================
-- Empêcher un user de modifier les jetons lui-même
-- (seul un admin ou une RPC autorisée peut le faire)
-- =============================================================
CREATE OR REPLACE FUNCTION public.protect_jetons()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true) THEN
        -- Permet la modification uniquement via ajouter_jetons RPC (SECURITY DEFINER)
        IF NEW.jetons != OLD.jetons AND current_setting('request.jwt.claim.role', true) = 'authenticated' THEN
            NEW.jetons := OLD.jetons;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

DROP TRIGGER IF EXISTS trigger_protect_jetons ON public.profiles;
CREATE TRIGGER trigger_protect_jetons
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_jetons();

-- =============================================================
-- RLS sur tables manquantes
-- =============================================================

-- RECOMPENSES_CONFIG
ALTER TABLE public.recompenses_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recompenses_config_select" ON public.recompenses_config;
CREATE POLICY "recompenses_config_select" ON public.recompenses_config
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "recompenses_config_admin_all" ON public.recompenses_config;
CREATE POLICY "recompenses_config_admin_all" ON public.recompenses_config
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- SEMAINES
ALTER TABLE public.semaines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "semaines_select" ON public.semaines;
CREATE POLICY "semaines_select" ON public.semaines
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "semaines_admin_insert" ON public.semaines;
CREATE POLICY "semaines_admin_insert" ON public.semaines
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- SEMAINE_SNAPSHOTS
ALTER TABLE public.semaine_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "snapshots_select" ON public.semaine_snapshots;
CREATE POLICY "snapshots_select" ON public.semaine_snapshots
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "snapshots_admin_insert" ON public.semaine_snapshots;
CREATE POLICY "snapshots_admin_insert" ON public.semaine_snapshots
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- BOUTIQUE_ITEMS
ALTER TABLE public.boutique_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "boutique_items_select" ON public.boutique_items;
CREATE POLICY "boutique_items_select" ON public.boutique_items
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "boutique_items_admin_all" ON public.boutique_items;
CREATE POLICY "boutique_items_admin_all" ON public.boutique_items
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- BOUTIQUE_ACHATS
ALTER TABLE public.boutique_achats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "boutique_achats_select_own" ON public.boutique_achats;
CREATE POLICY "boutique_achats_select_own" ON public.boutique_achats
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

DROP POLICY IF EXISTS "boutique_achats_insert_own" ON public.boutique_achats;
CREATE POLICY "boutique_achats_insert_own" ON public.boutique_achats
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_validated = true));

DROP POLICY IF EXISTS "boutique_achats_admin_update" ON public.boutique_achats;
CREATE POLICY "boutique_achats_admin_update" ON public.boutique_achats
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- BOUTIQUE_CONFIG
ALTER TABLE public.boutique_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "boutique_config_select" ON public.boutique_config;
CREATE POLICY "boutique_config_select" ON public.boutique_config
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "boutique_config_admin_update" ON public.boutique_config;
CREATE POLICY "boutique_config_admin_update" ON public.boutique_config
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- BOUTIQUE_DEMANDES_KAMAS
ALTER TABLE public.boutique_demandes_kamas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "demandes_kamas_select_own" ON public.boutique_demandes_kamas;
CREATE POLICY "demandes_kamas_select_own" ON public.boutique_demandes_kamas
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

DROP POLICY IF EXISTS "demandes_kamas_insert_own" ON public.boutique_demandes_kamas;
CREATE POLICY "demandes_kamas_insert_own" ON public.boutique_demandes_kamas
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_validated = true));

DROP POLICY IF EXISTS "demandes_kamas_admin_update" ON public.boutique_demandes_kamas;
CREATE POLICY "demandes_kamas_admin_update" ON public.boutique_demandes_kamas
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- =============================================================
-- Validation de longueur des champs sensibles (trigger)
-- =============================================================
CREATE OR REPLACE FUNCTION public.validate_profile_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Pseudo : 2-30 caractères, pas de caractères dangereux
    IF NEW.username IS NOT NULL THEN
        IF length(NEW.username) < 2 OR length(NEW.username) > 30 THEN
            RAISE EXCEPTION 'Le pseudo doit faire entre 2 et 30 caractères';
        END IF;
        IF NEW.username ~ '[<>"''&;(){}]' THEN
            RAISE EXCEPTION 'Le pseudo contient des caractères non autorisés';
        END IF;
    END IF;

    -- Zone réservée : max 50 caractères
    IF NEW.zone_reservee IS NOT NULL AND length(NEW.zone_reservee) > 50 THEN
        RAISE EXCEPTION 'La zone réservée ne doit pas dépasser 50 caractères';
    END IF;

    -- Dofusbook URL : validation basique
    IF NEW.dofusbook_url IS NOT NULL AND NEW.dofusbook_url != '' THEN
        IF NOT (NEW.dofusbook_url ~* '^https?://') THEN
            RAISE EXCEPTION 'URL Dofusbook invalide';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_profile ON public.profiles;
CREATE TRIGGER trigger_validate_profile
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_profile_fields();

-- Validation commentaire combats
CREATE OR REPLACE FUNCTION public.validate_combat_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.commentaire IS NOT NULL AND length(NEW.commentaire) > 100 THEN
        RAISE EXCEPTION 'Le commentaire ne doit pas dépasser 100 caractères';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_combat ON public.combats;
CREATE TRIGGER trigger_validate_combat
    BEFORE INSERT OR UPDATE ON public.combats
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_combat_fields();


/* ################################################################ */
/* ### SOURCE : 008-securisation.sql ################################### */
/* ################################################################ */

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


/* ################################################################ */
/* ### SOURCE : 008-slot.sql ################################### */
/* ################################################################ */

-- =============================================
-- 008-slot.sql
-- Machine a Sous du Dieu Enutrof
-- Tables + RPC jouer_slot()
-- =============================================

-- === COLONNE: jetons_slot dans profiles ===
-- Jetons dedies a la machine a sous (separes des jetons globaux)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS jetons_slot INTEGER DEFAULT 0;

-- === TABLE: Symboles du slot ===
-- Chaque symbole a un poids (probabilite), une image, et des gains
CREATE TABLE IF NOT EXISTS public.slot_symboles (
    id SERIAL PRIMARY KEY,
    nom TEXT NOT NULL UNIQUE,
    image_url TEXT DEFAULT '',
    poids INTEGER DEFAULT 10,           -- plus le poids est eleve, plus le symbole apparait
    gain_triple INTEGER DEFAULT 5,      -- multiplicateur pour 3 identiques
    gain_paire INTEGER DEFAULT 0,       -- multiplicateur pour 2 identiques
    ordre INTEGER DEFAULT 0,            -- ordre d'affichage
    actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Symboles par defaut avec probabilites casino
-- Poids : commun (30) → rare (5). Total ~100
-- RTP cible ~93%
INSERT INTO public.slot_symboles (nom, image_url, poids, gain_triple, gain_paire, ordre) VALUES
    ('enutrof',  '', 5,   50, 5,  1),   -- Jackpot : tres rare, gros gain
    ('kamas',    '', 8,   25, 3,  2),   -- Rare
    ('coffre',   '', 12,  15, 2,  3),   -- Medium-rare
    ('pepite',   '', 18,  8,  1,  4),   -- Medium
    ('pelle',    '', 25,  4,  0,  5),   -- Commun
    ('jeton',    '', 32,  3,  0,  6)    -- Tres commun
ON CONFLICT (nom) DO NOTHING;

-- RLS
ALTER TABLE public.slot_symboles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "slot_symboles_select" ON public.slot_symboles;
CREATE POLICY "slot_symboles_select" ON public.slot_symboles
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "slot_symboles_admin" ON public.slot_symboles;
CREATE POLICY "slot_symboles_admin" ON public.slot_symboles
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- === TABLE: Historique des tirages slot ===
CREATE TABLE IF NOT EXISTS public.slot_historique (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    joueur_id UUID NOT NULL REFERENCES public.profiles(id),
    mise INTEGER NOT NULL,
    resultat TEXT[] NOT NULL,
    gain_jetons INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.slot_historique ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "slot_select_own" ON public.slot_historique;
CREATE POLICY "slot_select_own" ON public.slot_historique
    FOR SELECT TO authenticated
    USING (joueur_id = auth.uid());

DROP POLICY IF EXISTS "slot_insert_own" ON public.slot_historique;
CREATE POLICY "slot_insert_own" ON public.slot_historique
    FOR INSERT TO authenticated
    WITH CHECK (joueur_id = auth.uid());

DROP POLICY IF EXISTS "slot_admin" ON public.slot_historique;
CREATE POLICY "slot_admin" ON public.slot_historique
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- === RPC: jouer_slot(p_mise) ===
-- Utilise les poids des symboles pour le RNG
-- Calcule gain_triple ou gain_paire selon le resultat
CREATE OR REPLACE FUNCTION public.jouer_slot(p_mise INTEGER)
RETURNS JSONB AS $$
DECLARE
    v_joueur_id UUID;
    v_jetons INTEGER;
    v_symboles_config RECORD;
    v_pool TEXT[] := '{}';
    v_s1 TEXT;
    v_s2 TEXT;
    v_s3 TEXT;
    v_resultat TEXT[];
    v_gain INTEGER := 0;
    v_multiplicateur INTEGER := 0;
    v_nouveau_solde INTEGER;
    v_sym RECORD;
    v_matched TEXT;
    v_gain_triple INTEGER;
    v_gain_paire INTEGER;
BEGIN
    v_joueur_id := auth.uid();
    IF v_joueur_id IS NULL THEN
        RAISE EXCEPTION 'Non authentifie';
    END IF;

    -- Lire solde jetons SLOT (pas les jetons globaux)
    SELECT jetons_slot INTO v_jetons FROM public.profiles WHERE id = v_joueur_id;
    IF v_jetons IS NULL THEN
        RAISE EXCEPTION 'Joueur introuvable';
    END IF;

    -- Verifier la mise
    IF p_mise < 1 THEN
        RAISE EXCEPTION 'Mise invalide';
    END IF;
    IF v_jetons < p_mise THEN
        RAISE EXCEPTION 'Solde insuffisant';
    END IF;

    -- Construire le pool pondere de symboles
    -- Chaque symbole est repete (poids) fois dans le pool
    FOR v_sym IN SELECT nom, poids FROM public.slot_symboles WHERE actif = true ORDER BY ordre LOOP
        FOR i IN 1..v_sym.poids LOOP
            v_pool := array_append(v_pool, v_sym.nom);
        END LOOP;
    END LOOP;

    IF array_length(v_pool, 1) IS NULL OR array_length(v_pool, 1) = 0 THEN
        RAISE EXCEPTION 'Aucun symbole configure';
    END IF;

    -- Generer 3 symboles aleatoires depuis le pool pondere
    v_s1 := v_pool[1 + floor(random() * array_length(v_pool, 1))::int];
    v_s2 := v_pool[1 + floor(random() * array_length(v_pool, 1))::int];
    v_s3 := v_pool[1 + floor(random() * array_length(v_pool, 1))::int];
    v_resultat := ARRAY[v_s1, v_s2, v_s3];

    -- Calculer les gains
    IF v_s1 = v_s2 AND v_s2 = v_s3 THEN
        -- Triple identique
        SELECT gain_triple INTO v_gain_triple FROM public.slot_symboles WHERE nom = v_s1;
        v_multiplicateur := COALESCE(v_gain_triple, 5);
    ELSIF v_s1 = v_s2 OR v_s2 = v_s3 OR v_s1 = v_s3 THEN
        -- Paire : trouver quel symbole matche
        IF v_s1 = v_s2 THEN v_matched := v_s1;
        ELSIF v_s2 = v_s3 THEN v_matched := v_s2;
        ELSE v_matched := v_s1;
        END IF;
        SELECT gain_paire INTO v_gain_paire FROM public.slot_symboles WHERE nom = v_matched;
        v_multiplicateur := COALESCE(v_gain_paire, 0);
    END IF;

    v_gain := p_mise * v_multiplicateur;

    -- Mettre a jour les jetons SLOT
    v_nouveau_solde := v_jetons - p_mise + v_gain;
    UPDATE public.profiles SET jetons_slot = v_nouveau_solde WHERE id = v_joueur_id;

    -- Historique
    INSERT INTO public.slot_historique (joueur_id, mise, resultat, gain_jetons)
    VALUES (v_joueur_id, p_mise, v_resultat, v_gain);

    RETURN jsonb_build_object(
        'symboles', to_jsonb(v_resultat),
        'gain', v_gain,
        'multiplicateur', v_multiplicateur,
        'nouveau_solde', v_nouveau_solde
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- === RPC: Transferer jetons globaux → jetons slot ===
CREATE OR REPLACE FUNCTION public.transferer_jetons_slot(p_montant INTEGER)
RETURNS JSONB AS $$
DECLARE
    v_joueur_id UUID;
    v_jetons INTEGER;
    v_jetons_slot INTEGER;
BEGIN
    v_joueur_id := auth.uid();
    IF v_joueur_id IS NULL THEN RAISE EXCEPTION 'Non authentifie'; END IF;
    IF p_montant < 1 THEN RAISE EXCEPTION 'Montant invalide'; END IF;

    SELECT jetons, jetons_slot INTO v_jetons, v_jetons_slot
    FROM public.profiles WHERE id = v_joueur_id;

    IF v_jetons IS NULL THEN RAISE EXCEPTION 'Joueur introuvable'; END IF;
    IF v_jetons < p_montant THEN RAISE EXCEPTION 'Solde jetons insuffisant'; END IF;

    UPDATE public.profiles
    SET jetons = jetons - p_montant,
        jetons_slot = jetons_slot + p_montant
    WHERE id = v_joueur_id;

    RETURN jsonb_build_object(
        'jetons', v_jetons - p_montant,
        'jetons_slot', v_jetons_slot + p_montant
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- === RPC: Convertir jetons slot → kamas (demande) ===
-- Pour l'instant on stocke la demande, l'admin valide manuellement
CREATE TABLE IF NOT EXISTS public.slot_demandes_conversion (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    jetons_slot INTEGER NOT NULL,
    statut TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'valide', 'refuse')),
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.slot_demandes_conversion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "slot_conversion_select_own" ON public.slot_demandes_conversion;
CREATE POLICY "slot_conversion_select_own" ON public.slot_demandes_conversion
    FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "slot_conversion_insert_own" ON public.slot_demandes_conversion;
CREATE POLICY "slot_conversion_insert_own" ON public.slot_demandes_conversion
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "slot_conversion_admin" ON public.slot_demandes_conversion;
CREATE POLICY "slot_conversion_admin" ON public.slot_demandes_conversion
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE OR REPLACE FUNCTION public.demander_conversion_slot(p_montant INTEGER)
RETURNS JSONB AS $$
DECLARE
    v_joueur_id UUID;
    v_jetons_slot INTEGER;
BEGIN
    v_joueur_id := auth.uid();
    IF v_joueur_id IS NULL THEN RAISE EXCEPTION 'Non authentifie'; END IF;
    IF p_montant < 1 THEN RAISE EXCEPTION 'Montant invalide'; END IF;

    SELECT jetons_slot INTO v_jetons_slot FROM public.profiles WHERE id = v_joueur_id;
    IF v_jetons_slot IS NULL THEN RAISE EXCEPTION 'Joueur introuvable'; END IF;
    IF v_jetons_slot < p_montant THEN RAISE EXCEPTION 'Solde jetons slot insuffisant'; END IF;

    -- Debiter immediatement
    UPDATE public.profiles SET jetons_slot = jetons_slot - p_montant WHERE id = v_joueur_id;

    -- Creer la demande
    INSERT INTO public.slot_demandes_conversion (user_id, jetons_slot)
    VALUES (v_joueur_id, p_montant);

    RETURN jsonb_build_object(
        'jetons_slot', v_jetons_slot - p_montant,
        'demande', p_montant
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;


/* ################################################################ */
/* ### SOURCE : 009-slot-v2.sql ################################### */
/* ################################################################ */

/* Fix rejeu : 007/008 definissent acheter_boutique RETURNS INTEGER, */
/* la 009 la redefinit RETURNS JSONB. CREATE OR REPLACE ne peut pas  */
/* changer le type de retour : il faut dropper d'abord.              */
DROP FUNCTION IF EXISTS public.acheter_boutique(UUID, INTEGER);

-- =============================================
-- 009-slot-v2.sql
-- Nouveau systeme : mise en jetons classiques, gain en enutrosor
-- Plus de conversion entre les deux types
-- =============================================

-- === Modifier jouer_slot : mise en jetons classiques, gain en jetons_slot (enutrosor) ===
CREATE OR REPLACE FUNCTION public.jouer_slot(p_mise INTEGER)
RETURNS JSONB AS $$
DECLARE
    v_joueur_id UUID;
    v_jetons INTEGER;
    v_jetons_slot INTEGER;
    v_symboles_config RECORD;
    v_pool TEXT[] := '{}';
    v_s1 TEXT;
    v_s2 TEXT;
    v_s3 TEXT;
    v_resultat TEXT[];
    v_gain INTEGER := 0;
    v_multiplicateur INTEGER := 0;
    v_nouveau_solde_classique INTEGER;
    v_nouveau_solde_enutrosor INTEGER;
    v_sym RECORD;
    v_matched TEXT;
    v_gain_triple INTEGER;
    v_gain_paire INTEGER;
BEGIN
    v_joueur_id := auth.uid();
    IF v_joueur_id IS NULL THEN
        RAISE EXCEPTION 'Non authentifie';
    END IF;

    -- Lire solde jetons CLASSIQUES (pour la mise) et ENUTROSOR (pour les gains)
    SELECT jetons, jetons_slot INTO v_jetons, v_jetons_slot
    FROM public.profiles WHERE id = v_joueur_id;

    IF v_jetons IS NULL THEN
        RAISE EXCEPTION 'Joueur introuvable';
    END IF;

    IF p_mise < 1 THEN
        RAISE EXCEPTION 'Mise invalide';
    END IF;
    IF v_jetons < p_mise THEN
        RAISE EXCEPTION 'Solde insuffisant';
    END IF;

    -- Construire le pool pondere de symboles
    FOR v_sym IN SELECT nom, poids FROM public.slot_symboles WHERE actif = true ORDER BY ordre LOOP
        FOR i IN 1..v_sym.poids LOOP
            v_pool := array_append(v_pool, v_sym.nom);
        END LOOP;
    END LOOP;

    IF array_length(v_pool, 1) IS NULL OR array_length(v_pool, 1) = 0 THEN
        RAISE EXCEPTION 'Aucun symbole configure';
    END IF;

    -- Generer 3 symboles aleatoires depuis le pool pondere
    v_s1 := v_pool[1 + floor(random() * array_length(v_pool, 1))::int];
    v_s2 := v_pool[1 + floor(random() * array_length(v_pool, 1))::int];
    v_s3 := v_pool[1 + floor(random() * array_length(v_pool, 1))::int];
    v_resultat := ARRAY[v_s1, v_s2, v_s3];

    -- Calculer les gains
    IF v_s1 = v_s2 AND v_s2 = v_s3 THEN
        SELECT gain_triple INTO v_gain_triple FROM public.slot_symboles WHERE nom = v_s1;
        v_multiplicateur := COALESCE(v_gain_triple, 5);
    ELSIF v_s1 = v_s2 OR v_s2 = v_s3 OR v_s1 = v_s3 THEN
        IF v_s1 = v_s2 THEN v_matched := v_s1;
        ELSIF v_s2 = v_s3 THEN v_matched := v_s2;
        ELSE v_matched := v_s1;
        END IF;
        SELECT gain_paire INTO v_gain_paire FROM public.slot_symboles WHERE nom = v_matched;
        v_multiplicateur := COALESCE(v_gain_paire, 0);
    END IF;

    v_gain := p_mise * v_multiplicateur;

    -- Debiter les jetons CLASSIQUES (mise)
    v_nouveau_solde_classique := v_jetons - p_mise;
    -- Crediter les jetons ENUTROSOR (gains)
    v_nouveau_solde_enutrosor := v_jetons_slot + v_gain;

    UPDATE public.profiles
    SET jetons = v_nouveau_solde_classique,
        jetons_slot = v_nouveau_solde_enutrosor
    WHERE id = v_joueur_id;

    -- Historique
    INSERT INTO public.slot_historique (joueur_id, mise, resultat, gain_jetons)
    VALUES (v_joueur_id, p_mise, v_resultat, v_gain);

    RETURN jsonb_build_object(
        'symboles', to_jsonb(v_resultat),
        'gain', v_gain,
        'multiplicateur', v_multiplicateur,
        'nouveau_solde', v_nouveau_solde_classique,
        'nouveau_solde_enutrosor', v_nouveau_solde_enutrosor
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- === Ajouter colonne devise aux articles boutique ===
-- 'classique' = jetons classiques (defaut), 'enutrosor' = jetons enutrosor (kamatrix)
ALTER TABLE public.boutique_items ADD COLUMN IF NOT EXISTS devise TEXT DEFAULT 'classique'
    CHECK (devise IN ('classique', 'enutrosor'));

-- === Modifier acheter_boutique pour supporter les deux devises ===
CREATE OR REPLACE FUNCTION public.acheter_boutique(p_user_id UUID, p_item_id INTEGER)
RETURNS JSONB AS $$
DECLARE
    v_jetons INTEGER;
    v_jetons_slot INTEGER;
    v_prix INTEGER;
    v_stock INTEGER;
    v_nom TEXT;
    v_devise TEXT;
    v_nouveau_solde INTEGER;
BEGIN
    IF p_user_id != auth.uid() THEN
        RAISE EXCEPTION 'Non autorise';
    END IF;

    -- Lire les deux soldes
    SELECT jetons, jetons_slot INTO v_jetons, v_jetons_slot
    FROM public.profiles WHERE id = p_user_id;

    IF v_jetons IS NULL THEN
        RAISE EXCEPTION 'Joueur introuvable';
    END IF;

    -- Lire l'article
    SELECT prix_jetons, stock, nom, devise INTO v_prix, v_stock, v_nom, v_devise
    FROM public.boutique_items WHERE id = p_item_id AND actif = true;

    IF v_prix IS NULL THEN
        RAISE EXCEPTION 'Article introuvable ou inactif';
    END IF;

    IF v_stock IS NOT NULL AND v_stock <= 0 THEN
        RAISE EXCEPTION 'Stock epuise';
    END IF;

    -- Verifier et debiter selon la devise
    IF COALESCE(v_devise, 'classique') = 'enutrosor' THEN
        IF v_jetons_slot < v_prix THEN
            RAISE EXCEPTION 'Solde Enutrosor insuffisant';
        END IF;
        v_nouveau_solde := v_jetons_slot - v_prix;
        UPDATE public.profiles SET jetons_slot = v_nouveau_solde WHERE id = p_user_id;
    ELSE
        IF v_jetons < v_prix THEN
            RAISE EXCEPTION 'Solde insuffisant';
        END IF;
        v_nouveau_solde := v_jetons - v_prix;
        UPDATE public.profiles SET jetons = v_nouveau_solde WHERE id = p_user_id;
    END IF;

    -- Enregistrer l'achat
    INSERT INTO public.boutique_achats (user_id, item_id, item_nom, prix_paye, statut)
    VALUES (p_user_id, p_item_id, v_nom, v_prix, 'en_attente');

    -- Decrementer stock
    IF v_stock IS NOT NULL AND v_stock > 0 THEN
        UPDATE public.boutique_items SET stock = stock - 1 WHERE id = p_item_id;
    END IF;

    RETURN jsonb_build_object(
        'jetons', CASE WHEN COALESCE(v_devise, 'classique') = 'classique' THEN v_nouveau_solde ELSE v_jetons END,
        'jetons_slot', CASE WHEN COALESCE(v_devise, 'classique') = 'enutrosor' THEN v_nouveau_solde ELSE v_jetons_slot END,
        'item', v_nom,
        'devise', COALESCE(v_devise, 'classique')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Supprimer la fonction transferer_jetons_slot (plus utilisee)
DROP FUNCTION IF EXISTS public.transferer_jetons_slot(INTEGER);


/* ################################################################ */
/* ### SOURCE : 010-boutique-kamas.sql ################################### */
/* ################################################################ */

-- =============================================
-- 010-boutique-kamas.sql
-- Ajouter devise 'kamas' pour achat de jetons via kamas in-game
-- =============================================

-- Modifier la contrainte devise pour accepter 'kamas'
ALTER TABLE public.boutique_items DROP CONSTRAINT IF EXISTS boutique_items_devise_check;
ALTER TABLE public.boutique_items ADD CONSTRAINT boutique_items_devise_check
    CHECK (devise IN ('classique', 'enutrosor', 'kamas'));

-- Ajouter colonne jetons_reward : nb de jetons credites quand admin valide un achat kamas
ALTER TABLE public.boutique_items ADD COLUMN IF NOT EXISTS jetons_reward INTEGER DEFAULT 0;

-- Ajouter colonne jetons_credites dans boutique_achats pour tracker ce qui a ete credite
ALTER TABLE public.boutique_achats ADD COLUMN IF NOT EXISTS jetons_credites INTEGER DEFAULT 0;

-- Recréer acheter_boutique avec support kamas
DROP FUNCTION IF EXISTS public.acheter_boutique(UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.acheter_boutique(p_user_id UUID, p_item_id INTEGER)
RETURNS JSONB AS $$
DECLARE
    v_jetons INTEGER;
    v_jetons_slot INTEGER;
    v_prix INTEGER;
    v_stock INTEGER;
    v_nom TEXT;
    v_devise TEXT;
    v_jetons_reward INTEGER;
    v_nouveau_solde INTEGER;
BEGIN
    IF p_user_id != auth.uid() THEN
        RAISE EXCEPTION 'Non autorise';
    END IF;

    SELECT jetons, jetons_slot INTO v_jetons, v_jetons_slot
    FROM public.profiles WHERE id = p_user_id;

    IF v_jetons IS NULL THEN
        RAISE EXCEPTION 'Joueur introuvable';
    END IF;

    SELECT prix_jetons, stock, nom, devise, jetons_reward
    INTO v_prix, v_stock, v_nom, v_devise, v_jetons_reward
    FROM public.boutique_items WHERE id = p_item_id AND actif = true;

    IF v_prix IS NULL THEN
        RAISE EXCEPTION 'Article introuvable ou inactif';
    END IF;

    -- Stock check (stock = -1 = illimite)
    IF v_stock IS NOT NULL AND v_stock >= 0 AND v_stock <= 0 THEN
        RAISE EXCEPTION 'Stock epuise';
    END IF;

    -- Selon la devise
    IF COALESCE(v_devise, 'classique') = 'kamas' THEN
        -- Achat en kamas : pas de debit, juste creer la demande
        -- Le prix represente le montant en kamas que le joueur doit donner in-game
        INSERT INTO public.boutique_achats (user_id, item_id, item_nom, prix_paye, jetons_credites, statut)
        VALUES (p_user_id, p_item_id, v_nom, v_prix, COALESCE(v_jetons_reward, 0), 'en_attente');

        -- Decrementer stock
        IF v_stock IS NOT NULL AND v_stock > 0 THEN
            UPDATE public.boutique_items SET stock = stock - 1 WHERE id = p_item_id;
        END IF;

        RETURN jsonb_build_object(
            'jetons', v_jetons,
            'jetons_slot', v_jetons_slot,
            'item', v_nom,
            'devise', 'kamas',
            'kamas_a_payer', v_prix,
            'jetons_reward', COALESCE(v_jetons_reward, 0)
        );

    ELSIF COALESCE(v_devise, 'classique') = 'enutrosor' THEN
        IF v_jetons_slot < v_prix THEN
            RAISE EXCEPTION 'Solde Enutrosor insuffisant';
        END IF;
        v_nouveau_solde := v_jetons_slot - v_prix;
        UPDATE public.profiles SET jetons_slot = v_nouveau_solde WHERE id = p_user_id;

        INSERT INTO public.boutique_achats (user_id, item_id, item_nom, prix_paye, statut)
        VALUES (p_user_id, p_item_id, v_nom, v_prix, 'en_attente');

    ELSE
        IF v_jetons < v_prix THEN
            RAISE EXCEPTION 'Solde insuffisant';
        END IF;
        v_nouveau_solde := v_jetons - v_prix;
        UPDATE public.profiles SET jetons = v_nouveau_solde WHERE id = p_user_id;

        INSERT INTO public.boutique_achats (user_id, item_id, item_nom, prix_paye, statut)
        VALUES (p_user_id, p_item_id, v_nom, v_prix, 'en_attente');

    END IF;

    -- Decrementer stock
    IF v_stock IS NOT NULL AND v_stock > 0 THEN
        UPDATE public.boutique_items SET stock = stock - 1 WHERE id = p_item_id;
    END IF;

    RETURN jsonb_build_object(
        'jetons', CASE WHEN COALESCE(v_devise, 'classique') = 'classique' THEN v_nouveau_solde ELSE v_jetons END,
        'jetons_slot', CASE WHEN COALESCE(v_devise, 'classique') = 'enutrosor' THEN v_nouveau_solde ELSE v_jetons_slot END,
        'item', v_nom,
        'devise', COALESCE(v_devise, 'classique')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- RPC pour valider un achat kamas et crediter les jetons
CREATE OR REPLACE FUNCTION public.valider_achat_kamas(p_achat_id INTEGER)
RETURNS JSONB AS $$
DECLARE
    v_achat RECORD;
    v_nouveau_jetons INTEGER;
BEGIN
    -- Verifier admin
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true) THEN
        RAISE EXCEPTION 'Non autorise';
    END IF;

    -- Lire l'achat
    SELECT * INTO v_achat FROM public.boutique_achats WHERE id = p_achat_id AND statut = 'en_attente';
    IF v_achat IS NULL THEN
        RAISE EXCEPTION 'Achat introuvable ou deja traite';
    END IF;

    -- Crediter les jetons au joueur
    IF v_achat.jetons_credites > 0 THEN
        UPDATE public.profiles
        SET jetons = jetons + v_achat.jetons_credites
        WHERE id = v_achat.user_id
        RETURNING jetons INTO v_nouveau_jetons;
    END IF;

    -- Marquer comme distribue
    UPDATE public.boutique_achats SET statut = 'distribue' WHERE id = p_achat_id;

    RETURN jsonb_build_object(
        'success', true,
        'jetons_credites', COALESCE(v_achat.jetons_credites, 0),
        'user_id', v_achat.user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;


/* ################################################################ */
/* ### SOURCE : 011-convert-kamatrix.sql ################################### */
/* ################################################################ */

-- =============================================
-- 011-convert-kamatrix.sql
-- Convertir Kamatrix en jetons classiques (ratio 2:1)
-- =============================================

CREATE OR REPLACE FUNCTION public.convertir_kamatrix(p_montant_kamatrix INTEGER)
RETURNS JSONB AS $$
DECLARE
    v_joueur_id UUID;
    v_jetons INTEGER;
    v_jetons_slot INTEGER;
    v_jetons_recus INTEGER;
BEGIN
    v_joueur_id := auth.uid();
    IF v_joueur_id IS NULL THEN RAISE EXCEPTION 'Non authentifie'; END IF;
    IF p_montant_kamatrix < 2 THEN RAISE EXCEPTION 'Minimum 2 Kamatrix'; END IF;

    -- Ratio 2:1
    v_jetons_recus := floor(p_montant_kamatrix / 2);
    IF v_jetons_recus < 1 THEN RAISE EXCEPTION 'Montant trop faible'; END IF;

    -- Montant reel debite (arrondi pair)
    p_montant_kamatrix := v_jetons_recus * 2;

    SELECT jetons, jetons_slot INTO v_jetons, v_jetons_slot
    FROM public.profiles WHERE id = v_joueur_id;

    IF v_jetons_slot IS NULL THEN RAISE EXCEPTION 'Joueur introuvable'; END IF;
    IF v_jetons_slot < p_montant_kamatrix THEN RAISE EXCEPTION 'Pas assez de Kamatrix'; END IF;

    UPDATE public.profiles
    SET jetons_slot = jetons_slot - p_montant_kamatrix,
        jetons = jetons + v_jetons_recus
    WHERE id = v_joueur_id;

    RETURN jsonb_build_object(
        'jetons', v_jetons + v_jetons_recus,
        'jetons_slot', v_jetons_slot - p_montant_kamatrix,
        'kamatrix_depenses', p_montant_kamatrix,
        'jetons_recus', v_jetons_recus
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;


/* ################################################################ */
/* ### SOURCE : 012-remboursement.sql ################################### */
/* ################################################################ */

-- ============================================
-- 012 : Remboursement / annulation d'achat boutique
-- ============================================

CREATE OR REPLACE FUNCTION public.rembourser_achat(p_achat_id INTEGER)
RETURNS JSONB AS $$
DECLARE
    v_achat RECORD;
    v_devise TEXT;
    v_stock INTEGER;
BEGIN
    -- Verifier que l'appelant est admin
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true) THEN
        RAISE EXCEPTION 'Non autorise';
    END IF;

    -- Recuperer l'achat
    SELECT a.*, i.devise, i.stock
    INTO v_achat
    FROM public.boutique_achats a
    JOIN public.boutique_items i ON i.id = a.item_id
    WHERE a.id = p_achat_id;

    IF v_achat IS NULL THEN
        RAISE EXCEPTION 'Achat introuvable';
    END IF;

    v_devise := COALESCE(v_achat.devise, 'classique');
    v_stock := v_achat.stock;

    -- Rembourser selon la devise et le statut
    IF v_devise = 'kamas' THEN
        -- Kamas : pas de jetons debites a l'achat
        -- Mais si distribue ET jetons_credites > 0, retirer les jetons credites
        IF v_achat.statut = 'distribue' AND COALESCE(v_achat.jetons_credites, 0) > 0 THEN
            UPDATE public.profiles
            SET jetons = jetons - v_achat.jetons_credites
            WHERE id = v_achat.user_id;
        END IF;
    ELSIF v_devise = 'enutrosor' THEN
        -- Enutrosor / Kamatrix : redonner les jetons_slot
        UPDATE public.profiles
        SET jetons_slot = jetons_slot + v_achat.prix_paye
        WHERE id = v_achat.user_id;
    ELSE
        -- Classique : redonner les jetons
        UPDATE public.profiles
        SET jetons = jetons + v_achat.prix_paye
        WHERE id = v_achat.user_id;
    END IF;

    -- Remettre +1 au stock si stock > 0 (pas illimite)
    IF v_stock > 0 THEN
        UPDATE public.boutique_items
        SET stock = stock + 1
        WHERE id = v_achat.item_id;
    END IF;

    -- Supprimer l'achat
    DELETE FROM public.boutique_achats WHERE id = p_achat_id;

    RETURN jsonb_build_object(
        'success', true,
        'item', v_achat.item_nom,
        'prix', v_achat.prix_paye,
        'devise', v_devise
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;


/* ################################################################ */
/* ### SOURCE : 013-zones-bda.sql ################################### */
/* ################################################################ */

/* ============================================ */
/* Zones réservées Banque d'Alliance (BDA)      */
/* ============================================ */

CREATE TABLE IF NOT EXISTS public.zones_bda (
    id          SERIAL PRIMARY KEY,
    nom_zone    TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at  TIMESTAMPTZ DEFAULT now()
);

/* RLS : tout le monde peut lire, seuls les admins écrivent */
ALTER TABLE public.zones_bda ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "zones_bda_select" ON public.zones_bda;
CREATE POLICY "zones_bda_select" ON public.zones_bda
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "zones_bda_admin_insert" ON public.zones_bda;
CREATE POLICY "zones_bda_admin_insert" ON public.zones_bda
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

DROP POLICY IF EXISTS "zones_bda_admin_update" ON public.zones_bda;
CREATE POLICY "zones_bda_admin_update" ON public.zones_bda
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

DROP POLICY IF EXISTS "zones_bda_admin_delete" ON public.zones_bda;
CREATE POLICY "zones_bda_admin_delete" ON public.zones_bda
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );


/* ################################################################ */
/* ### SOURCE : 014-recyclages.sql ################################### */
/* ################################################################ */

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
DROP POLICY IF EXISTS "zones_perco_select" ON public.zones_perco;
CREATE POLICY "zones_perco_select" ON public.zones_perco
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_validated = true)
    );

DROP POLICY IF EXISTS "zones_perco_admin_insert" ON public.zones_perco;
DROP POLICY IF EXISTS "zones_perco_admin_insert" ON public.zones_perco;
CREATE POLICY "zones_perco_admin_insert" ON public.zones_perco
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

DROP POLICY IF EXISTS "zones_perco_admin_update" ON public.zones_perco;
DROP POLICY IF EXISTS "zones_perco_admin_update" ON public.zones_perco;
CREATE POLICY "zones_perco_admin_update" ON public.zones_perco
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

DROP POLICY IF EXISTS "zones_perco_admin_delete" ON public.zones_perco;
DROP POLICY IF EXISTS "zones_perco_admin_delete" ON public.zones_perco;
CREATE POLICY "zones_perco_admin_delete" ON public.zones_perco
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

/* Recyclages : chacun voit tout (stats alliance), chacun saisit pour lui,
   chacun edite/supprime ses propres recyclages, admin peut tout       */
DROP POLICY IF EXISTS "recyclages_select_validated" ON public.recyclages;
DROP POLICY IF EXISTS "recyclages_select_validated" ON public.recyclages;
CREATE POLICY "recyclages_select_validated" ON public.recyclages
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_validated = true)
    );

DROP POLICY IF EXISTS "recyclages_insert_self" ON public.recyclages;
DROP POLICY IF EXISTS "recyclages_insert_self" ON public.recyclages;
CREATE POLICY "recyclages_insert_self" ON public.recyclages
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_validated = true)
    );

DROP POLICY IF EXISTS "recyclages_update_self_or_admin" ON public.recyclages;
DROP POLICY IF EXISTS "recyclages_update_self_or_admin" ON public.recyclages;
CREATE POLICY "recyclages_update_self_or_admin" ON public.recyclages
    FOR UPDATE USING (
        auth.uid() = user_id
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

DROP POLICY IF EXISTS "recyclages_delete_self_or_admin" ON public.recyclages;
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


/* ################################################################ */
/* ### SOURCE : 015-zones-type-dj.sql ################################### */
/* ################################################################ */

/* ============================================ */
/* Recyclages : type zone/dj sur zones_perco     */
/* ============================================ */

/* Une zone peut etre une "zone" classique (monstres exterieurs) */
/* ou un "dj" (donjon de la meme zone, generalement +10 niveaux) */
/* Les entrees existantes sont marquees 'zone' par defaut.       */
/* L'admin cree les DJ comme entrees distinctes via le back-office. */

ALTER TABLE public.zones_perco
    ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'zone'
    CHECK (type IN ('zone', 'dj'));

/* Index pour filtrage rapide cote autocomplete */
CREATE INDEX IF NOT EXISTS idx_zones_perco_type ON public.zones_perco(type, actif);


/* ################################################################ */
/* ### SOURCE : 016-recyclages-preuves-hebdo.sql ################################### */
/* ################################################################ */

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


/* ################################################################ */
/* ### SOURCE : 017-zones-dofus-seed.sql ################################### */
/* ################################################################ */

/* ============================================ */
/* Seed des zones Dofus (territoires + donjons) */
/* Source : panneau "Anomalies" en jeu          */
/* ============================================ */
/*                                              */
/* Ce script ajoute les zones Dofus officielles */
/* sans ecraser ce qui existe (ON CONFLICT DO   */
/* NOTHING sur le nom). A re-runner apres mises */
/* a jour si on ajoute des screens.             */
/*                                              */
/* Cout pose = tranche de 20 superieure du      */
/* niveau (formule potion percepteur Dofus).    */
/* ============================================ */

/* ============================================ */
/* TERRITOIRES (type = 'zone')                  */
/* ============================================ */

INSERT INTO public.zones_perco (nom, type, niveau_zone, cout_pepites_pose, ordre) VALUES

    /* --- Lvl 10 --- */
    ('Rives iridescentes',                'zone',  10,  20, 1010),

    /* --- Lvl 15 --- */
    ('Cote d''Asse',                      'zone',  15,  20, 1015),
    ('Riviere Kawaii',                    'zone',  15,  20, 1015),
    ('Port de Madrestam',                 'zone',  15,  20, 1015),
    ('Campagne d''Amakna',                'zone',  15,  20, 1015),

    /* --- Lvl 20 --- */
    ('Foret d''Amakna',                   'zone',  20,  20, 1020),
    ('Clairiere de Brouce Boulgoure',     'zone',  20,  20, 1020),
    ('Coin des Boos',                     'zone',  20,  20, 1020),
    ('Coin des Bouftous',                 'zone',  20,  20, 1020),
    ('Milifutaie',                        'zone',  20,  20, 1020),

    /* --- Lvl 25 --- */
    ('Ile des naufrages',                 'zone',  25,  40, 1025),

    /* --- Lvl 30 --- */
    ('Champ des Ingalsse',                'zone',  30,  40, 1030),
    ('Cryptes du cimetiere',              'zone',  30,  40, 1030),
    ('Campement des Gobelins',            'zone',  30,  40, 1030),
    ('Cimetiere',                         'zone',  30,  40, 1030),
    ('Plaine des Scarafeuilles',          'zone',  30,  40, 1030),
    ('Bord de la foret malefique',        'zone',  30,  40, 1030),

    /* --- Lvl 40 --- */
    ('Cimetiere des Tortures',            'zone',  40,  40, 1040),
    ('Plage de la Tortue',                'zone',  40,  40, 1040),
    ('Plage de Corail',                   'zone',  40,  40, 1040),
    ('Passage vers Brakmar',              'zone',  40,  40, 1040),
    ('Territoire des Bandits',            'zone',  40,  40, 1040),
    ('Oree de la foret des Abraknydes',   'zone',  40,  40, 1040),
    ('Futaie enneigee',                   'zone',  40,  40, 1040),
    ('Montagne des Craqueleurs',          'zone',  40,  40, 1040),
    ('Mine des Dopeuls',                  'zone',  40,  40, 1040),
    ('Village des Bworks',                'zone',  40,  40, 1040),
    ('Marecages nauseabonds',             'zone',  40,  40, 1040),
    ('Rivage sufokien',                   'zone',  40,  40, 1040),
    ('Souterrains d''Albuera',            'zone',  40,  40, 1040),
    ('Ile de la Cawotte',                 'zone',  40,  40, 1040),
    ('Village des Dopeuls',               'zone',  40,  40, 1040),
    ('Cimetiere des Heros',               'zone',  40,  40, 1040),
    ('Plaine des Porkass',                'zone',  40,  40, 1040),
    ('Baie de Cania',                     'zone',  40,  40, 1040),
    ('Bordure de Brakmar',                'zone',  40,  40, 1040),
    ('Campement des Bworks',              'zone',  40,  40, 1040),

    /* --- Lvl 50 --- */
    ('Massif de Cania',                   'zone',  50,  60, 1050),
    ('Foret des Masques',                 'zone',  50,  60, 1050),
    ('Peninsule des gelees',              'zone',  50,  60, 1050),
    ('Ilot de la Couronne',               'zone',  50,  60, 1050),
    ('Cloaque d''Amakna',                 'zone',  50,  60, 1050),
    ('Ilot de Waldo',                     'zone',  50,  60, 1050),
    ('Champs de Cania',                   'zone',  50,  60, 1050),
    ('Montagne basse des Craqueleurs',    'zone',  50,  60, 1050),
    ('Ilot des Tombeaux',                 'zone',  50,  60, 1050),
    ('Lac de Cania',                      'zone',  50,  60, 1050),

    /* --- Lvl 60 --- */
    ('Desolation de Sidimote',            'zone',  60,  60, 1060),
    ('Presqu''ile des Dragoeufs',         'zone',  60,  60, 1060),
    ('Territoire des dragodindes sauvages','zone', 60,  60, 1060),
    ('Marecages sans fond',               'zone',  60,  60, 1060),
    ('Routes Rocailleuses',               'zone',  60,  60, 1060),
    ('Plaines Rocheuses',                 'zone',  60,  60, 1060),
    ('Bassin des Muldos',                 'zone',  60,  60, 1060),
    ('Arche d''Otomai',                   'zone',  60,  60, 1060),
    ('Marecages d''Amakna',               'zone',  60,  60, 1060),
    ('Haras de Brakmar',                  'zone',  60,  60, 1060),

    /* --- Lvl 70 --- */
    ('Foret de Kaliptus',                 'zone',  70,  80, 1070),
    ('Dunes des ossements',               'zone',  70,  80, 1070),

    /* --- Lvl 80 --- */
    ('Foret Sombre',                      'zone',  80,  80, 1080),
    ('Lacs enchantes',                    'zone',  80,  80, 1080),
    ('Pics de Cania',                     'zone',  80,  80, 1080),
    ('Bois des Arak-hai',                 'zone',  80,  80, 1080),
    ('Port de givre',                     'zone',  80,  80, 1080),
    ('La Bourgade',                       'zone',  80,  80, 1080),
    ('Route des Roulottes',               'zone',  80,  80, 1080),
    ('Canyon sauvage',                    'zone',  80,  80, 1080),
    ('Chemin du Crane',                   'zone',  80,  80, 1080),

    /* --- Lvl 90 --- */
    ('Souterrains des Dragoeufs',         'zone',  90, 100, 1090),
    ('Village des Dragoeufs',             'zone',  90, 100, 1090),
    ('Jungle Interdite',                  'zone',  90, 100, 1090),
    ('Territoire des Porcos',             'zone',  90, 100, 1090),
    ('Creuset des Fortunes',              'zone',  90, 100, 1090),
    ('Ile de Kartonpath',                 'zone',  90, 100, 1090),
    ('Labyrinthe du Dragon Cochon',       'zone',  90, 100, 1090),
    ('Hauts des Hurlements',              'zone',  90, 100, 1090),

    /* --- Lvl 100 --- */
    ('Entrailles de Brakmar',             'zone', 100, 100, 1100),
    ('Pierres de l''elevation',           'zone', 100, 100, 1100),
    ('Canaux mephitiques',                'zone', 100, 100, 1100),
    ('Plaines herbeuses',                 'zone', 100, 100, 1100),
    ('Tourbiere sans fond',               'zone', 100, 100, 1100),
    ('Penates du Corbac',                 'zone', 100, 100, 1100),
    ('Plantala',                          'zone', 100, 100, 1100),

    /* --- Lvl 110 --- */
    ('Labyrinthe du Minotoror',           'zone', 110, 120, 1110),
    ('Laboratoires abandonnes',           'zone', 110, 120, 1110),
    ('Champs de glace',                   'zone', 110, 120, 1110),
    ('Sanctuaire des Dragoeufs',          'zone', 110, 120, 1110),
    ('Bibliotheque du Maitre Corbac',     'zone', 110, 120, 1110),
    ('Ile du Minotoror',                  'zone', 110, 120, 1110),
    ('Bois de Litneg',                    'zone', 110, 120, 1110),
    ('Cimetiere primitif',                'zone', 110, 120, 1110),
    ('Galeries abandonnees',              'zone', 110, 120, 1110),
    ('Tourbiere nauseabonde',             'zone', 110, 120, 1110),
    ('Vallee de la Morh''Kitu',           'zone', 110, 120, 1110),
    ('Chemins d''hier',                   'zone', 110, 120, 1110),

    /* --- Lvl 120 --- */
    ('Village de la Canopee',             'zone', 120, 120, 1120),
    ('Territoire Cacterre',               'zone', 120, 120, 1120),
    ('Village des Zoths',                 'zone', 120, 120, 1120),
    ('Ruelles des Eaux-Suaires',          'zone', 120, 120, 1120),
    ('Terrdala',                          'zone', 120, 120, 1120),
    ('Akwadala',                          'zone', 120, 120, 1120),
    ('Cirque de Cania',                   'zone', 120, 120, 1120),

    /* --- Lvl 130 --- */
    ('Aerdala',                           'zone', 130, 140, 1130),
    ('Foret des pins perdus',             'zone', 130, 140, 1130),
    ('Feudala',                           'zone', 130, 140, 1130),
    ('Jungle obscure',                    'zone', 130, 140, 1130),
    ('Lac gele',                          'zone', 130, 140, 1130),

    /* --- Lvl 140 --- */
    ('Landes de Cania',                   'zone', 140, 140, 1140),
    ('Berceau d''Alma',                   'zone', 140, 140, 1140),
    ('Carriere Aurifere',                 'zone', 140, 140, 1140),
    ('Dedale du Dark Vlad',               'zone', 140, 140, 1140),

    /* --- Lvl 150 --- */
    ('Larmes d''Ouronigride',             'zone', 150, 160, 1150),
    ('Tronc de l''arbre Hakam',           'zone', 150, 160, 1150),
    ('Cimetiere de Grobe',                'zone', 150, 160, 1150),
    ('Village des Kanigs',                'zone', 150, 160, 1150),
    ('Dents de Pierre',                   'zone', 150, 160, 1150),
    ('Lande Poilue',                      'zone', 150, 160, 1150),
    ('Feuillage de l''arbre Hakam',       'zone', 150, 160, 1150),

    /* --- Lvl 160 --- */
    ('Cite Oubliee',                      'zone', 160, 160, 1160),
    ('Cavernes des Givrefoux',            'zone', 160, 160, 1160),
    ('Village enseveli',                  'zone', 160, 160, 1160),
    ('Jour present',                      'zone', 160, 160, 1160),
    ('Mont des Tombeaux',                 'zone', 160, 160, 1160),
    ('Gorge des Vents Hurlants',          'zone', 160, 160, 1160),
    ('Crevasse Perge',                    'zone', 160, 160, 1160),
    ('Toorbz Boorzzbz',                   'zone', 160, 160, 1160),

    /* --- Lvl 170 --- */
    ('Gisgoul',                           'zone', 170, 180, 1170),
    ('Catacombes',                        'zone', 170, 180, 1170),
    ('Caverne des Fungus',                'zone', 170, 180, 1170),
    ('Domaine des Fungus',                'zone', 170, 180, 1170),
    ('Foret petrifiee',                   'zone', 170, 180, 1170),

    /* --- Lvl 180 --- */
    ('Nimotopia',                         'zone', 180, 180, 1180),
    ('Crocs de verre',                    'zone', 180, 180, 1180),
    ('Dimension Obscure',                 'zone', 180, 180, 1180),
    ('Plaine de Sakai',                   'zone', 180, 180, 1180),
    ('Foret enneigee',                    'zone', 180, 180, 1180),
    ('Mont Torrideau',                    'zone', 180, 180, 1180),
    ('Ruche des Gloursons',               'zone', 180, 180, 1180),

    /* --- Lvl 190 --- */
    ('Tannerie Ecarlate',                 'zone', 190, 200, 1190),
    ('Remparts a vent',                   'zone', 190, 200, 1190),
    ('Galeries d''Ereboria',              'zone', 190, 200, 1190),
    ('Jardins d''Hiver',                  'zone', 190, 200, 1190),
    ('Bastion des froides legions',       'zone', 190, 200, 1190),

    /* --- Lvl 200 --- */
    ('Trefonds des Trithons',             'zone', 200, 200, 1200),
    ('Vestiges engloutis',                'zone', 200, 200, 1200),
    ('Tour de la Clepsydre',              'zone', 200, 200, 1200),
    ('Terres Desacrees',                  'zone', 200, 200, 1200),
    ('Salles des Embruns',                'zone', 200, 200, 1200),
    ('Salles des Courants',               'zone', 200, 200, 1200),
    ('Salles des Abimes',                 'zone', 200, 200, 1200),
    ('Temple de Kerubim',                 'zone', 200, 200, 1200),
    ('Abime de R''lyugluglu',             'zone', 200, 200, 1200),
    ('Royaume d''encre',                  'zone', 200, 200, 1200),
    ('Ancienne Sufokia',                  'zone', 200, 200, 1200),
    ('Blessures de Guerre',               'zone', 200, 200, 1200),
    ('Caserne du Jour sans fin',          'zone', 200, 200, 1200),
    ('Cauchemar des Ravageurs',           'zone', 200, 200, 1200),
    ('Crocuzko',                          'zone', 200, 200, 1200),
    ('Desert de Misere',                  'zone', 200, 200, 1200),
    ('Domaine des Trithons',              'zone', 200, 200, 1200),
    ('Epaves Silencieuses',               'zone', 200, 200, 1200),
    ('Ephedrya',                          'zone', 200, 200, 1200),
    ('Faille des Trithons',               'zone', 200, 200, 1200),
    ('Fort Thune',                        'zone', 200, 200, 1200),
    ('Fosse de R''lyugluglu',             'zone', 200, 200, 1200),
    ('Galere de Servitude',               'zone', 200, 200, 1200),
    ('Royaume des Martegel',              'zone', 200, 200, 1200),
    ('Hauts Tenebreux',                   'zone', 200, 200, 1200),
    ('Lendemains incertains',             'zone', 200, 200, 1200),
    ('Marches Magmatiques',               'zone', 200, 200, 1200),
    ('Osavane',                           'zone', 200, 200, 1200),
    ('Pandamonium',                       'zone', 200, 200, 1200),
    ('Plateau de R''lyugluglu',           'zone', 200, 200, 1200),
    ('Port des Ravageurs',                'zone', 200, 200, 1200),
    ('Pyramide Maudite',                  'zone', 200, 200, 1200),
    ('Quartier des Conquerants',          'zone', 200, 200, 1200),
    ('Reserve Touffue',                   'zone', 200, 200, 1200),
    ('Retraite des Eternels',             'zone', 200, 200, 1200),
    ('Roc des Salbatroces',               'zone', 200, 200, 1200),
    ('Royaume Corrompu',                  'zone', 200, 200, 1200),
    ('Royaume de papier',                 'zone', 200, 200, 1200),
    ('Village Rhoarim',                   'zone', 200, 200, 1200),
    ('Ville submergee',                   'zone', 200, 200, 1200)

    /* Liste des territoires complete (jusqu'au lvl 200). */
    /* Pour ajouter les donjons : voir section ci-dessous. */

ON CONFLICT (nom) DO NOTHING;


/* ============================================ */
/* DONJONS (type = 'dj')                        */
/* ============================================ */
/* Source : panneau Anomalies > dropdown Donjons */
/* Ordre commence a 2000 pour separer des zones. */
/* ============================================ */

INSERT INTO public.zones_perco (nom, type, niveau_zone, cout_pepites_pose, ordre) VALUES

    /* --- Lvl 40 --- */
    ('Akademie des Gobs',                 'dj',  40,  40, 2040),
    ('Donjon des Scarafeuilles',          'dj',  40,  40, 2040),
    ('Donjon des Squelettes',             'dj',  40,  40, 2040),
    ('Donjon des Tofus',                  'dj',  40,  40, 2040),
    ('Maison Fantome',                    'dj',  40,  40, 2040),

    /* --- Lvl 50 --- */
    ('Donjon des Bworks',                 'dj',  50,  60, 2050),
    ('Donjon des Forgerons',              'dj',  50,  60, 2050),
    ('Donjon des Larves',                 'dj',  50,  60, 2050),
    ('Nid du Kwakwa',                     'dj',  50,  60, 2050),
    ('Refuge sylvestre',                  'dj',  50,  60, 2050),
    ('Grotte Hesque',                     'dj',  50,  60, 2050),

    /* --- Lvl 60 --- */
    ('Clos des Blops',                    'dj',  60,  60, 2060),
    ('Chateau du Wa Wabbit',              'dj',  60,  60, 2060),
    ('Gelaxieme dimension',               'dj',  60,  60, 2060),
    ('Village Kanniboul',                 'dj',  60,  60, 2060),

    /* --- Lvl 65 --- */
    ('Cale de l''arche d''Otomai',        'dj',  65,  80, 2065),

    /* --- Lvl 70 --- */
    ('Pitons Rocheux des Craqueleurs',    'dj',  70,  80, 2070),
    ('Laboratoire de Brumen Tinctorias',  'dj',  70,  80, 2070),
    ('Epreuve de Draegnerys',             'dj',  70,  80, 2070),

    /* --- Lvl 80 --- */
    ('Cimetiere des Mastodontes',         'dj',  80,  80, 2080),
    ('Terrier du Wa Wabbit',              'dj',  80,  80, 2080),

    /* --- Lvl 90 --- */
    ('Chapiteau des Magik Riktus',        'dj',  90, 100, 2090),
    ('Bateau du Chouque',                 'dj',  90, 100, 2090),
    ('Domaine Ancestral',                 'dj',  90, 100, 2090),
    ('Antre de la Reine Nyee',            'dj',  90, 100, 2090),

    /* --- Lvl 100 --- */
    ('Theatre de Dramak',                 'dj', 100, 100, 2100),
    ('Taniere du Meulou',                 'dj', 100, 100, 2100),
    ('Fabrique de Mallefisk',             'dj', 100, 100, 2100),
    ('Antre du Dragon Cochon',            'dj', 100, 100, 2100),
    ('Arbre de Moon',                     'dj', 100, 100, 2100),
    ('Antre du Koulosse',                 'dj', 100, 100, 2100),
    ('Caverne du Koulosse',               'dj', 100, 100, 2100),
    ('Repaire du Kharnozor',              'dj', 100, 100, 2100),

    /* --- Lvl 110 --- */
    ('Sousouriciere du Rat Noir',         'dj', 110, 120, 2110),
    ('Goulet du Rasboul',                 'dj', 110, 120, 2110),
    ('Miausolee du Pounicheur',           'dj', 110, 120, 2110),
    ('Salle de lecture du Maitre Corbac', 'dj', 110, 120, 2110),
    ('Garde-manger du Rat Blanc',         'dj', 110, 120, 2110),
    ('Bambusaie de Damadrya',             'dj', 110, 120, 2110),

    /* --- Lvl 120 --- */
    ('Repaire de Skeunk',                 'dj', 120, 120, 2120),
    ('Centre du labyrinthe du Minotoror', 'dj', 120, 120, 2120),
    ('Tofulailler Royal',                 'dj', 120, 120, 2120),
    ('Antre de Crocabulia',               'dj', 120, 120, 2120),
    ('Serre du Royalmouth',               'dj', 120, 120, 2120),
    ('Antre du Blop Multicolore Royal',   'dj', 120, 120, 2120),
    ('Megalithe de Fraktale',             'dj', 120, 120, 2120),

    /* --- Lvl 130 --- */
    ('Voliere de la Haute Truche',        'dj', 130, 140, 2130),
    ('Atelier du Tanukoui San',           'dj', 130, 140, 2130),
    ('Vallee de la Dame des eaux',        'dj', 130, 140, 2130),
    ('Caverne d''El Piko',                'dj', 130, 140, 2130),
    ('Ring du Capitaine Ekarlatte',       'dj', 130, 140, 2130),

    /* --- Lvl 140 --- */
    ('Laboratoire du Tynril',             'dj', 140, 140, 2140),
    ('Excavation du Mansot Royal',        'dj', 140, 140, 2140),
    ('Clairiere du Chene Mou',            'dj', 140, 140, 2140),
    ('Dojo du Vent',                      'dj', 140, 140, 2140),
    ('Fabrique de foux d''artifice',      'dj', 140, 140, 2140),

    /* --- Lvl 150 --- */
    ('Epave du Grolandais violent',       'dj', 150, 160, 2150),
    ('Galerie du Phossile',               'dj', 150, 160, 2150),
    ('Tertre du long sommeil',            'dj', 150, 160, 2150),
    ('Repaire de Sphincter Cell',         'dj', 150, 160, 2150),

    /* --- Lvl 160 --- */
    ('Canopee du Kimbo',                  'dj', 160, 160, 2160),
    ('Tombe du Shogun Tofugawa',          'dj', 160, 160, 2160),
    ('Grotte de Kanigroula',              'dj', 160, 160, 2160),
    ('Plateau de Ush',                    'dj', 160, 160, 2160),
    ('Hypogee de l''Obsidiantre',         'dj', 160, 160, 2160),

    /* --- Lvl 170 --- */
    ('Poste de controle du Supervizoeuf', 'dj', 170, 180, 2170),
    ('Taniere Givrefoux',                 'dj', 170, 180, 2170),
    ('Demeure des Esprits',               'dj', 170, 180, 2170),
    ('Boyau du Pere Ver',                 'dj', 170, 180, 2170),
    ('Horologium de XLII',                'dj', 170, 180, 2170),

    /* --- Lvl 180 --- */
    ('Temple du Grand Ougah',             'dj', 180, 180, 2180),
    ('Antre du Kralamoure Geant',         'dj', 180, 180, 2180),
    ('Cave du Toxoliath',                 'dj', 180, 180, 2180),
    ('Antre du Korriandre',               'dj', 180, 180, 2180),
    ('Grotte du Bworker',                 'dj', 180, 180, 2180),

    /* --- Lvl 190 --- */
    ('Pyramide d''Ombre',                 'dj', 190, 200, 2190),
    ('Bastion des Marteaux-Aigris',       'dj', 190, 200, 2190),
    ('Antichambre des Gloursons',         'dj', 190, 200, 2190),
    ('Cavernes du Kolosso',               'dj', 190, 200, 2190),
    ('Camp du Comte Razof',               'dj', 190, 200, 2190),
    ('Mine abandonnee de Sakai',          'dj', 190, 200, 2190),

    /* --- Lvl 200 --- */
    ('Tour de Solar',                     'dj', 200, 200, 2200),
    ('Chambre de Tal Kasha',              'dj', 200, 200, 2200),
    ('Transporteur de Sylargh',           'dj', 200, 200, 2200),
    ('Trone de la Cour Sombre',           'dj', 200, 200, 2200),
    ('Trone de sang',                     'dj', 200, 200, 2200),
    ('Donjon du Comte Harebourg',         'dj', 200, 200, 2200),
    ('Vaisseau du Capitaine Meno',        'dj', 200, 200, 2200),
    ('Chambre des malefices',             'dj', 200, 200, 2200),
    ('Temple de Koutoulou',               'dj', 200, 200, 2200),
    ('Ventre de la Baleine',              'dj', 200, 200, 2200),
    ('Tempete de l''Eliocalypse',         'dj', 200, 200, 2200),
    ('Tour de Bethel',                    'dj', 200, 200, 2200),
    ('Manoir des Katrepat',               'dj', 200, 200, 2200),
    ('Sentence de la Balance',            'dj', 200, 200, 2200),
    ('Souvenir d''Imagiro',               'dj', 200, 200, 2200),
    ('Laboratoire de Nileza',             'dj', 200, 200, 2200),
    ('Memoire d''Orukam',                 'dj', 200, 200, 2200),
    ('Bataille de l''Aurore Pourpre',     'dj', 200, 200, 2200),
    ('Autel de la Dechireuse',            'dj', 200, 200, 2200),
    ('Oeil de Vortex',                    'dj', 200, 200, 2200),
    ('Defi du Chaloeil',                  'dj', 200, 200, 2200),
    ('Palais du roi Nidas',               'dj', 200, 200, 2200),
    ('Fers de la Tyrannie',               'dj', 200, 200, 2200),
    ('Belvedere d''Ilyzaelle',            'dj', 200, 200, 2200),
    ('Brasserie du roi Dazak',            'dj', 200, 200, 2200),
    ('Aquadome de Merkator',              'dj', 200, 200, 2200),
    ('Breuil du Venerable',               'dj', 200, 200, 2200),
    ('Rituel de Kabahal',                 'dj', 200, 200, 2200),
    ('Salons prives de Klime',            'dj', 200, 200, 2200),
    ('Sanctuaire de Torkelonia',          'dj', 200, 200, 2200),
    ('Forgefroide de Missiz Frizz',       'dj', 200, 200, 2200),
    ('Arbre de mort',                     'dj', 200, 200, 2200),
    ('Palais de Dantinea',                'dj', 200, 200, 2200)

ON CONFLICT (nom) DO NOTHING;

/* ============================================ */
/* RÉCAP                                        */
/* ============================================ */
/* Territoires : ~184 entrees (lvl 10 -> 200)   */
/* Donjons     : ~114 entrees (lvl 40 -> 200)   */
/* Total       : ~298 entrees                   */
/*                                              */
/* Noms sans accents pour eviter les soucis     */
/* d'encoding. Modifiables en BO si besoin.     */
/* ============================================ */


/* ################################################################ */
/* ### SOURCE : 018-forgemagie.sql ################################### */
/* ################################################################ */

/* ============================================ */
/* Forgemagie : runes + sessions de FM          */
/* ============================================ */

/* === TABLE : RUNES === */
/* Catalogue des runes avec leur poids (pui) et prix kamas.       */
/* Poids seed = valeurs standards Dofus, ajustables en admin.     */
/* Prix kamas renseignes par l'admin (prix HDV serveur partages). */
CREATE TABLE IF NOT EXISTS public.runes (
    id          SERIAL PRIMARY KEY,
    nom         TEXT NOT NULL UNIQUE,
    categorie   TEXT NOT NULL,              /* ex: Force, Vitalite, Dommages, PA... */
    tier        TEXT NOT NULL DEFAULT 'basique' CHECK (tier IN ('basique', 'pa', 'ra')),
    bonus       NUMERIC NOT NULL DEFAULT 1, /* valeur de stat apportee par la rune */
    poids       NUMERIC NOT NULL DEFAULT 1, /* pui total de la rune               */
    prix_kamas  INTEGER NOT NULL DEFAULT 0, /* prix unitaire HDV, renseigne admin */
    ordre       INTEGER DEFAULT 0,
    actif       BOOLEAN DEFAULT TRUE,
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_runes_actif ON public.runes(actif);

/* === TABLE : FM_SESSIONS === */
CREATE TABLE IF NOT EXISTS public.fm_sessions (
    id                    SERIAL PRIMARY KEY,
    user_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    titre                 TEXT NOT NULL,            /* item travaille, ex: "Coiffe du Comte" */
    statut                TEXT NOT NULL DEFAULT 'en_cours' CHECK (statut IN ('en_cours', 'terminee', 'abandonnee')),
    screenshot_avant_url  TEXT DEFAULT NULL,
    screenshot_apres_url  TEXT DEFAULT NULL,
    cout_total_kamas      BIGINT DEFAULT NULL,      /* fige a la cloture            */
    nb_runes_consommees   INTEGER DEFAULT NULL,     /* fige a la cloture            */
    note                  TEXT DEFAULT NULL,
    started_at            TIMESTAMPTZ DEFAULT NOW(),
    ended_at              TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_fm_sessions_user    ON public.fm_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_fm_sessions_statut  ON public.fm_sessions(statut);
CREATE INDEX IF NOT EXISTS idx_fm_sessions_started ON public.fm_sessions(started_at DESC);

/* === TABLE : FM_SESSION_RUNES === */
/* Une ligne par rune presente dans la session.                    */
/* qty_consommee et cout_kamas sont figes a la cloture :           */
/* qty_consommee = qty_avant + qty_achetee - qty_apres             */
CREATE TABLE IF NOT EXISTS public.fm_session_runes (
    id              SERIAL PRIMARY KEY,
    session_id      INTEGER NOT NULL REFERENCES public.fm_sessions(id) ON DELETE CASCADE,
    rune_id         INTEGER NOT NULL REFERENCES public.runes(id),
    qty_avant       INTEGER NOT NULL DEFAULT 0 CHECK (qty_avant >= 0),
    qty_achetee     INTEGER NOT NULL DEFAULT 0 CHECK (qty_achetee >= 0),
    qty_apres       INTEGER DEFAULT NULL CHECK (qty_apres IS NULL OR qty_apres >= 0),
    qty_consommee   INTEGER DEFAULT NULL,     /* fige a la cloture */
    cout_kamas      BIGINT DEFAULT NULL,      /* fige a la cloture (qty_consommee x prix du moment) */
    UNIQUE(session_id, rune_id)
);

CREATE INDEX IF NOT EXISTS idx_fm_session_runes_session ON public.fm_session_runes(session_id);

/* === TABLE : FM_SESSION_ACHATS === */
/* Achats de runes en cours de session (collees depuis le chat).   */
CREATE TABLE IF NOT EXISTS public.fm_session_achats (
    id              SERIAL PRIMARY KEY,
    session_id      INTEGER NOT NULL REFERENCES public.fm_sessions(id) ON DELETE CASCADE,
    rune_id         INTEGER REFERENCES public.runes(id),  /* NULL si non reconnu */
    qty             INTEGER NOT NULL DEFAULT 1 CHECK (qty > 0),
    prix_total      BIGINT NOT NULL DEFAULT 0 CHECK (prix_total >= 0),
    message_brut    TEXT DEFAULT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fm_session_achats_session ON public.fm_session_achats(session_id);

/* === VUE : stats FM par user === */
CREATE OR REPLACE VIEW public.v_fm_par_user AS
SELECT
    s.user_id,
    p.username,
    COUNT(*) FILTER (WHERE s.statut = 'terminee')          AS nb_sessions,
    COALESCE(SUM(s.cout_total_kamas) FILTER (WHERE s.statut = 'terminee'), 0) AS total_kamas,
    COALESCE(SUM(s.nb_runes_consommees) FILTER (WHERE s.statut = 'terminee'), 0) AS total_runes,
    MAX(s.ended_at)                                         AS derniere_session
FROM public.fm_sessions s
JOIN public.profiles p ON p.id = s.user_id
GROUP BY s.user_id, p.username;

/* === RLS === */
ALTER TABLE public.runes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fm_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fm_session_runes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fm_session_achats  ENABLE ROW LEVEL SECURITY;

/* Runes : lecture membres valides, ecriture admin */
DROP POLICY IF EXISTS "runes_select" ON public.runes;
DROP POLICY IF EXISTS "runes_select" ON public.runes;
CREATE POLICY "runes_select" ON public.runes
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_validated = true)
    );

DROP POLICY IF EXISTS "runes_admin_insert" ON public.runes;
DROP POLICY IF EXISTS "runes_admin_insert" ON public.runes;
CREATE POLICY "runes_admin_insert" ON public.runes
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

DROP POLICY IF EXISTS "runes_admin_update" ON public.runes;
DROP POLICY IF EXISTS "runes_admin_update" ON public.runes;
CREATE POLICY "runes_admin_update" ON public.runes
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

DROP POLICY IF EXISTS "runes_admin_delete" ON public.runes;
DROP POLICY IF EXISTS "runes_admin_delete" ON public.runes;
CREATE POLICY "runes_admin_delete" ON public.runes
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

/* FM sessions : chacun gere les siennes, lecture pour tous les valides */
DROP POLICY IF EXISTS "fm_sessions_select" ON public.fm_sessions;
DROP POLICY IF EXISTS "fm_sessions_select" ON public.fm_sessions;
CREATE POLICY "fm_sessions_select" ON public.fm_sessions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_validated = true)
    );

DROP POLICY IF EXISTS "fm_sessions_insert_self" ON public.fm_sessions;
DROP POLICY IF EXISTS "fm_sessions_insert_self" ON public.fm_sessions;
CREATE POLICY "fm_sessions_insert_self" ON public.fm_sessions
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_validated = true)
    );

DROP POLICY IF EXISTS "fm_sessions_update_self_or_admin" ON public.fm_sessions;
DROP POLICY IF EXISTS "fm_sessions_update_self_or_admin" ON public.fm_sessions;
CREATE POLICY "fm_sessions_update_self_or_admin" ON public.fm_sessions
    FOR UPDATE USING (
        auth.uid() = user_id
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

DROP POLICY IF EXISTS "fm_sessions_delete_self_or_admin" ON public.fm_sessions;
DROP POLICY IF EXISTS "fm_sessions_delete_self_or_admin" ON public.fm_sessions;
CREATE POLICY "fm_sessions_delete_self_or_admin" ON public.fm_sessions
    FOR DELETE USING (
        auth.uid() = user_id
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

/* FM session runes / achats : suivent la session parente */
DROP POLICY IF EXISTS "fm_session_runes_select" ON public.fm_session_runes;
DROP POLICY IF EXISTS "fm_session_runes_select" ON public.fm_session_runes;
CREATE POLICY "fm_session_runes_select" ON public.fm_session_runes
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_validated = true)
    );

DROP POLICY IF EXISTS "fm_session_runes_all_owner" ON public.fm_session_runes;
DROP POLICY IF EXISTS "fm_session_runes_all_owner" ON public.fm_session_runes;
CREATE POLICY "fm_session_runes_all_owner" ON public.fm_session_runes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.fm_sessions s
            WHERE s.id = session_id
              AND (s.user_id = auth.uid()
                   OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
        )
    );

DROP POLICY IF EXISTS "fm_session_achats_select" ON public.fm_session_achats;
DROP POLICY IF EXISTS "fm_session_achats_select" ON public.fm_session_achats;
CREATE POLICY "fm_session_achats_select" ON public.fm_session_achats
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_validated = true)
    );

DROP POLICY IF EXISTS "fm_session_achats_all_owner" ON public.fm_session_achats;
DROP POLICY IF EXISTS "fm_session_achats_all_owner" ON public.fm_session_achats;
CREATE POLICY "fm_session_achats_all_owner" ON public.fm_session_achats
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.fm_sessions s
            WHERE s.id = session_id
              AND (s.user_id = auth.uid()
                   OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
        )
    );

/* ============================================ */
/* SEED RUNES (poids standards Dofus)           */
/* Prix kamas a 0 : a renseigner en admin.      */
/* ============================================ */
INSERT INTO public.runes (nom, categorie, tier, bonus, poids, ordre) VALUES

    /* --- Stats elementaires (1/pt) --- */
    ('Rune Fo',        'Force',        'basique',  1,   1,   10),
    ('Rune Pa Fo',     'Force',        'pa',       3,   3,   11),
    ('Rune Ra Fo',     'Force',        'ra',      10,  10,   12),
    ('Rune Ine',       'Intelligence', 'basique',  1,   1,   20),
    ('Rune Pa Ine',    'Intelligence', 'pa',       3,   3,   21),
    ('Rune Ra Ine',    'Intelligence', 'ra',      10,  10,   22),
    ('Rune Cha',       'Chance',       'basique',  1,   1,   30),
    ('Rune Pa Cha',    'Chance',       'pa',       3,   3,   31),
    ('Rune Ra Cha',    'Chance',       'ra',      10,  10,   32),
    ('Rune Age',       'Agilite',      'basique',  1,   1,   40),
    ('Rune Pa Age',    'Agilite',      'pa',       3,   3,   41),
    ('Rune Ra Age',    'Agilite',      'ra',      10,  10,   42),

    /* --- Vitalite (0.2/pt) --- */
    ('Rune Vi',        'Vitalite',     'basique',  5,   1,   50),
    ('Rune Pa Vi',     'Vitalite',     'pa',      15,   3,   51),
    ('Rune Ra Vi',     'Vitalite',     'ra',      50,  10,   52),

    /* --- Sagesse (3/pt) --- */
    ('Rune Sa',        'Sagesse',      'basique',  1,   3,   60),
    ('Rune Pa Sa',     'Sagesse',      'pa',       3,   9,   61),
    ('Rune Ra Sa',     'Sagesse',      'ra',      10,  30,   62),

    /* --- Puissance (2/pt) --- */
    ('Rune Pui',       'Puissance',    'basique',  1,   2,   70),
    ('Rune Pa Pui',    'Puissance',    'pa',       3,   6,   71),
    ('Rune Ra Pui',    'Puissance',    'ra',      10,  20,   72),

    /* --- Initiative (0.1/pt) --- */
    ('Rune Ini',       'Initiative',   'basique', 10,   1,   80),
    ('Rune Pa Ini',    'Initiative',   'pa',      30,   3,   81),
    ('Rune Ra Ini',    'Initiative',   'ra',     100,  10,   82),

    /* --- Pods (0.25/pt) --- */
    ('Rune Pod',       'Pods',         'basique', 10, 2.5,   90),
    ('Rune Pa Pod',    'Pods',         'pa',      30, 7.5,   91),
    ('Rune Ra Pod',    'Pods',         'ra',     100,  25,   92),

    /* --- Prospection (3/pt) --- */
    ('Rune Prospe',    'Prospection',  'basique',  1,   3,  100),
    ('Rune Pa Prospe', 'Prospection',  'pa',       3,   9,  101),

    /* --- Dommages --- */
    ('Rune Do',        'Dommages',          'basique', 1, 20, 110),
    ('Rune Do Feu',    'Dommages Feu',      'basique', 1,  5, 111),
    ('Rune Do Eau',    'Dommages Eau',      'basique', 1,  5, 112),
    ('Rune Do Air',    'Dommages Air',      'basique', 1,  5, 113),
    ('Rune Do Terre',  'Dommages Terre',    'basique', 1,  5, 114),
    ('Rune Do Neutre', 'Dommages Neutre',   'basique', 1,  5, 115),
    ('Rune Do Pou',    'Dommages Poussee',  'basique', 1,  5, 116),
    ('Rune Do Cri',    'Dommages Critiques','basique', 1,  5, 117),
    ('Rune Do Ren',    'Renvoi de dommages','basique', 1, 10, 118),
    ('Rune Do Pi',     'Dommages Pieges',   'basique', 1,  5, 119),
    ('Rune Pi Pui',    'Puissance Pieges',  'basique', 1,  2, 120),

    /* --- Soins / Critique --- */
    ('Rune So',        'Soins',        'basique',  1,  10,  130),
    ('Rune Cri',       'Critique',     'basique',  1,  10,  131),

    /* --- Retraits / Esquives (7/pt) --- */
    ('Rune Ret PA',    'Retrait PA',   'basique',  1,   7,  140),
    ('Rune Ret PM',    'Retrait PM',   'basique',  1,   7,  141),
    ('Rune Esq PA',    'Esquive PA',   'basique',  1,   7,  142),
    ('Rune Esq PM',    'Esquive PM',   'basique',  1,   7,  143),

    /* --- Tacle / Fuite (4/pt) --- */
    ('Rune Tac',       'Tacle',        'basique',  1,   4,  150),
    ('Rune Fui',       'Fuite',        'basique',  1,   4,  151),

    /* --- Resistances fixes (2/pt) --- */
    ('Rune Re Feu',    'Res. Feu',     'basique',  1,   2,  160),
    ('Rune Re Eau',    'Res. Eau',     'basique',  1,   2,  161),
    ('Rune Re Air',    'Res. Air',     'basique',  1,   2,  162),
    ('Rune Re Terre',  'Res. Terre',   'basique',  1,   2,  163),
    ('Rune Re Neutre', 'Res. Neutre',  'basique',  1,   2,  164),
    ('Rune Re Pou',    'Res. Poussee', 'basique',  1,   2,  165),
    ('Rune Re Cri',    'Res. Critiques','basique', 1,   2,  166),

    /* --- Resistances % (6/pt) --- */
    ('Rune Re Per Feu',    'Res. % Feu',    'basique', 1, 6, 170),
    ('Rune Re Per Eau',    'Res. % Eau',    'basique', 1, 6, 171),
    ('Rune Re Per Air',    'Res. % Air',    'basique', 1, 6, 172),
    ('Rune Re Per Terre',  'Res. % Terre',  'basique', 1, 6, 173),
    ('Rune Re Per Neutre', 'Res. % Neutre', 'basique', 1, 6, 174),

    /* --- Exotiques --- */
    ('Rune Ga PA',     'PA',           'basique',  1, 100,  180),
    ('Rune Ga PME',    'PM',           'basique',  1,  90,  181),
    ('Rune Ga PO',     'Portee',       'basique',  1,  51,  182),
    ('Rune Ga Cre',    'Invocation',   'basique',  1,  30,  183),

    /* --- Chasse --- */
    ('Rune Cha Arme',  'Dommages Chasse', 'basique', 1, 5, 190)

ON CONFLICT (nom) DO NOTHING;


/* ################################################################ */
/* ### SOURCE : 019-runes-officielles.sql ################################### */
/* ################################################################ */

/* ============================================ */
/* Catalogue officiel des runes (HDV Dofus 3)   */
/* Remplace le seed approximatif du 018.        */
/*                                              */
/* Source noms + prix moyens : screens HDV      */
/* du 11/06/2026 fournis par Rorschach.         */
/* Poids (pui) : valeurs communautaires,        */
/* ajustables dans l'onglet Runes & prix.       */
/*                                              */
/* ⚠ Ce script VIDE et re-seed la table runes.  */
/* A ne PAS re-runner apres avoir cree des      */
/* sessions FM (FK fm_session_runes).           */
/* ============================================ */

DELETE FROM public.runes;

INSERT INTO public.runes (nom, categorie, tier, bonus, poids, prix_kamas, ordre) VALUES

    /* --- Force (1/pt) --- */
    ('Rune Fo',          'Force',         'basique',   1,    1,    51,   10),
    ('Rune Pa Fo',       'Force',         'pa',        3,    3,   208,   11),
    ('Rune Ra Fo',       'Force',         'ra',       10,   10,   560,   12),

    /* --- Intelligence --- */
    ('Rune Ine',         'Intelligence',  'basique',   1,    1,    45,   20),
    ('Rune Pa Ine',      'Intelligence',  'pa',        3,    3,   173,   21),
    ('Rune Ra Ine',      'Intelligence',  'ra',       10,   10,   491,   22),

    /* --- Chance --- */
    ('Rune Cha',         'Chance',        'basique',   1,    1,    82,   30),
    ('Rune Pa Cha',      'Chance',        'pa',        3,    3,   298,   31),
    ('Rune Ra Cha',      'Chance',        'ra',       10,   10,   970,   32),

    /* --- Agilite --- */
    ('Rune Age',         'Agilite',       'basique',   1,    1,    77,   40),
    ('Rune Pa Age',      'Agilite',       'pa',        3,    3,   291,   41),
    ('Rune Ra Age',      'Agilite',       'ra',       10,   10,   828,   42),

    /* --- Vitalite (0.2/pt) --- */
    ('Rune Vi',          'Vitalite',      'basique',   5,    1,   156,   50),
    ('Rune Pa Vi',       'Vitalite',      'pa',       15,    3,   518,   51),
    ('Rune Ra Vi',       'Vitalite',      'ra',       50,   10,  1592,   52),

    /* --- Sagesse (3/pt) --- */
    ('Rune Sa',          'Sagesse',       'basique',   1,    3,   168,   60),
    ('Rune Pa Sa',       'Sagesse',       'pa',        3,    9,   585,   61),
    ('Rune Ra Sa',       'Sagesse',       'ra',       10,   30,  1835,   62),

    /* --- Puissance (2/pt) --- */
    ('Rune Pui',         'Puissance',     'basique',   1,    2,   153,   70),
    ('Rune Pa Pui',      'Puissance',     'pa',        3,    6,   534,   71),
    ('Rune Ra Pui',      'Puissance',     'ra',       10,   20,  1764,   72),

    /* --- Initiative (0.1/pt) --- */
    ('Rune Ini',         'Initiative',    'basique',  10,    1,    50,   80),
    ('Rune Pa Ini',      'Initiative',    'pa',       30,    3,   222,   81),
    ('Rune Ra Ini',      'Initiative',    'ra',      100,   10,   620,   82),

    /* --- Pods (0.25/pt) --- */
    ('Rune Pod',         'Pods',          'basique',  10,  2.5,   318,   90),
    ('Rune Pa Pod',      'Pods',          'pa',       30,  7.5,   966,   91),
    ('Rune Ra Pod',      'Pods',          'ra',      100,   25,  4064,   92),

    /* --- Prospection (3/pt) --- */
    ('Rune Prospe',      'Prospection',   'basique',   1,    3,   293,  100),
    ('Rune Pa Prospe',   'Prospection',   'pa',        3,    9,   950,  101),

    /* --- Dommages (stat globale, 20/pt) --- */
    ('Rune Do',          'Dommages',      'basique',   1,   20,  1067,  110),

    /* --- Dommages elementaires (5/pt) --- */
    ('Rune Do Feu',      'Dommages Feu',    'basique', 1,    5,   877,  115),
    ('Rune Pa Do Feu',   'Dommages Feu',    'pa',      3,   15,  2621,  116),
    ('Rune Do Eau',      'Dommages Eau',    'basique', 1,    5,   947,  117),
    ('Rune Pa Do Eau',   'Dommages Eau',    'pa',      3,   15,  3182,  118),
    ('Rune Do Air',      'Dommages Air',    'basique', 1,    5,  1134,  119),
    ('Rune Pa Do Air',   'Dommages Air',    'pa',      3,   15,  3360,  120),
    ('Rune Do Terre',    'Dommages Terre',  'basique', 1,    5,   908,  121),
    ('Rune Pa Do Terre', 'Dommages Terre',  'pa',      3,   15,  2806,  122),
    ('Rune Do Neutre',   'Dommages Neutre', 'basique', 1,    5,   801,  123),
    ('Rune Pa Do Neutre','Dommages Neutre', 'pa',      3,   15,  2492,  124),

    /* --- Dommages speciaux --- */
    ('Rune Do Pou',      'Dommages Poussee',   'basique', 1,  5,   417,  130),
    ('Rune Pa Do Pou',   'Dommages Poussee',   'pa',      3, 15,  1490,  131),
    ('Rune Ra Do Pou',   'Dommages Poussee',   'ra',     10, 50,  3976,  132),
    ('Rune Do Cri',      'Dommages Critiques', 'basique', 1,  5,  1249,  133),
    ('Rune Pa Do Cri',   'Dommages Critiques', 'pa',      3, 15,  3749,  134),
    ('Rune Do Ren',      'Renvoi de dommages', 'basique', 1, 10,  1162,  135),
    ('Rune Pa Do Ren',   'Renvoi de dommages', 'pa',      3, 30,  3049,  136),
    ('Rune Do Pi',       'Dommages Pieges',    'basique', 1,  5,   507,  137),
    ('Rune Pa Do Pi',    'Dommages Pieges',    'pa',      3, 15,  1864,  138),

    /* --- Puissance pieges (2/pt) --- */
    ('Rune Per Pi',      'Puissance Pieges', 'basique',  1,  2,   118,  140),
    ('Rune Pa Per Pi',   'Puissance Pieges', 'pa',       3,  6,   964,  141),
    ('Rune Ra Per Pi',   'Puissance Pieges', 'ra',      10, 20,  4712,  142),

    /* --- % Dommages (15/pt) --- */
    ('Rune Do Per Ar',   '% Dommages d''armes',   'basique', 1, 15,  1621,  150),
    ('Rune Do Per Di',   '% Dommages distance',   'basique', 1, 15, 19869,  151),
    ('Rune Do Per Mé',   '% Dommages melee',      'basique', 1, 15, 16991,  152),
    ('Rune Do Per So',   '% Dommages aux sorts',  'basique', 1, 15, 22526,  153),

    /* --- Soins / Critique (10/pt) --- */
    ('Rune So',          'Soins',         'basique',   1,   10,   522,  160),
    ('Rune Pa So',       'Soins',         'pa',        3,   30,  1845,  161),
    ('Rune Cri',         'Critique',      'basique',   1,   10,  2047,  162),

    /* --- Retraits (7/pt) --- */
    ('Rune Ret Pa',      'Retrait PA',    'basique',   1,    7,   480,  170),
    ('Rune Pa Ret Pa',   'Retrait PA',    'pa',        3,   21,   948,  171),
    ('Rune Ret Pme',     'Retrait PM',    'basique',   1,    7,  1340,  172),
    ('Rune Pa Ret Pme',  'Retrait PM',    'pa',        3,   21,  4211,  173),

    /* --- Esquives (7/pt) --- */
    ('Rune Ré Pa',       'Esquive PA',    'basique',   1,    7,   702,  180),
    ('Rune Pa Ré Pa',    'Esquive PA',    'pa',        3,   21,  2040,  181),
    ('Rune Ré Pme',      'Esquive PM',    'basique',   1,    7,   746,  182),
    ('Rune Pa Ré Pme',   'Esquive PM',    'pa',        3,   21,  1679,  183),

    /* --- Tacle / Fuite (4/pt) --- */
    ('Rune Tac',         'Tacle',         'basique',   1,    4,   816,  190),
    ('Rune Pa Tac',      'Tacle',         'pa',        3,   12,  2689,  191),
    ('Rune Fui',         'Fuite',         'basique',   1,    4,   416,  192),
    ('Rune Pa Fui',      'Fuite',         'pa',        3,   12,  1366,  193),

    /* --- Resistances fixes (2/pt) --- */
    ('Rune Ré Feu',      'Res. Feu',      'basique',   1,    2,   110,  200),
    ('Rune Pa Ré Feu',   'Res. Feu',      'pa',        3,    6,   518,  201),
    ('Rune Ra Ré Feu',   'Res. Feu',      'ra',       10,   20,  1090,  202),
    ('Rune Ré Eau',      'Res. Eau',      'basique',   1,    2,    92,  203),
    ('Rune Pa Ré Eau',   'Res. Eau',      'pa',        3,    6,   433,  204),
    ('Rune Ra Ré Eau',   'Res. Eau',      'ra',       10,   20,  1145,  205),
    ('Rune Ré Air',      'Res. Air',      'basique',   1,    2,   256,  206),
    ('Rune Pa Ré Air',   'Res. Air',      'pa',        3,    6,   790,  207),
    ('Rune Ra Ré Air',   'Res. Air',      'ra',       10,   20,  1840,  208),
    ('Rune Ré Terre',    'Res. Terre',    'basique',   1,    2,   296,  209),
    ('Rune Pa Ré Terre', 'Res. Terre',    'pa',        3,    6,   858,  210),
    ('Rune Ra Ré Terre', 'Res. Terre',    'ra',       10,   20,  2214,  211),
    ('Rune Ré Neutre',   'Res. Neutre',   'basique',   1,    2,    66,  212),
    ('Rune Pa Ré Neutre','Res. Neutre',   'pa',        3,    6,   334,  213),
    ('Rune Ra Ré Neutre','Res. Neutre',   'ra',       10,   20,  1014,  214),
    ('Rune Ré Pou',      'Res. Poussee',  'basique',   1,    2,   176,  215),
    ('Rune Pa Ré Pou',   'Res. Poussee',  'pa',        3,    6,   602,  216),
    ('Rune Ra Ré Pou',   'Res. Poussee',  'ra',       10,   20,  2529,  217),
    ('Rune Ré Cri',      'Res. Critiques','basique',   1,    2,   182,  218),
    ('Rune Pa Ré Cri',   'Res. Critiques','pa',        3,    6,   599,  219),
    ('Rune Ra Ré Cri',   'Res. Critiques','ra',       10,   20,  1714,  220),

    /* --- Resistances % elementaires (6/pt) --- */
    ('Rune Ré Per Feu',    '% Res. Feu',    'basique', 1,    6,  1074,  230),
    ('Rune Ré Per Eau',    '% Res. Eau',    'basique', 1,    6,  1272,  231),
    ('Rune Ré Per Air',    '% Res. Air',    'basique', 1,    6,  1036,  232),
    ('Rune Ré Per Terre',  '% Res. Terre',  'basique', 1,    6,  1294,  233),
    ('Rune Ré Per Neutre', '% Res. Neutre', 'basique', 1,    6,  1199,  234),

    /* --- Resistances % melee / distance (15/pt) --- */
    ('Rune Ré Per Mé',   '% Res. melee',    'basique',  1,   15,  3401,  240),
    ('Rune Ré Per Di',   '% Res. distance', 'basique',  1,   15,  2259,  241),

    /* --- Exotiques --- */
    ('Rune Ga Pa',       'PA',            'basique',   1,  100, 22631,  250),
    ('Rune Ga Pme',      'PM',            'basique',   1,   90, 18828,  251),
    ('Rune Po',          'Portee',        'basique',   1,   51,  7014,  252),
    ('Rune Invo',        'Invocation',    'basique',   1,   30,  4379,  253),

    /* --- Speciales --- */
    ('Rune de chasse',   'Dommages Chasse', 'basique', 1,    5,  8597,  260),
    ('Rune de Signature','Speciale',        'basique', 1,    0,  1889,  261);


/* ################################################################ */
/* ### SOURCE : 020-fm-concassage.sql ################################### */
/* ################################################################ */

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
DROP POLICY IF EXISTS "fm_concassages_select" ON public.fm_session_concassages;
CREATE POLICY "fm_concassages_select" ON public.fm_session_concassages
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_validated = true)
    );

DROP POLICY IF EXISTS "fm_concassages_all_owner" ON public.fm_session_concassages;
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


/* ################################################################ */
/* ### SOURCE : 021-fm-multi-sessions.sql ################################### */
/* ################################################################ */

/* ============================================ */
/* FM : multi-sessions en parallele             */
/* ============================================ */
/* Plusieurs sessions peuvent etre 'en_cours'   */
/* simultanement (un item par session). Le      */
/* panel Session affiche la plus recemment      */
/* active ; on reprend les autres depuis        */
/* "Mes sessions" (maj de last_active_at).      */
/* ============================================ */

ALTER TABLE public.fm_sessions
    ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();

/* Initialiser les sessions existantes */
UPDATE public.fm_sessions
SET last_active_at = COALESCE(last_active_at, started_at);


/* ################################################################ */
/* ### SOURCE : 022-runes-icones.sql ################################### */
/* ################################################################ */

/* ============================================ */
/* Runes : icones officielles (assets locaux)   */
/* Source : api.dofusdb.fr, copiees dans        */
/* site/assets/images/runes/                    */
/* ============================================ */

ALTER TABLE public.runes
    ADD COLUMN IF NOT EXISTS img_url TEXT DEFAULT NULL;

UPDATE public.runes SET img_url = 'assets/images/runes/78043.png' WHERE nom = 'Rune Fo';
UPDATE public.runes SET img_url = 'assets/images/runes/78049.png' WHERE nom = 'Rune Sa';
UPDATE public.runes SET img_url = 'assets/images/runes/78037.png' WHERE nom = 'Rune Ine';
UPDATE public.runes SET img_url = 'assets/images/runes/78052.png' WHERE nom = 'Rune Vi';
UPDATE public.runes SET img_url = 'assets/images/runes/78046.png' WHERE nom = 'Rune Age';
UPDATE public.runes SET img_url = 'assets/images/runes/78040.png' WHERE nom = 'Rune Cha';
UPDATE public.runes SET img_url = 'assets/images/runes/78044.png' WHERE nom = 'Rune Pa Fo';
UPDATE public.runes SET img_url = 'assets/images/runes/78050.png' WHERE nom = 'Rune Pa Sa';
UPDATE public.runes SET img_url = 'assets/images/runes/78038.png' WHERE nom = 'Rune Pa Ine';
UPDATE public.runes SET img_url = 'assets/images/runes/78053.png' WHERE nom = 'Rune Pa Vi';
UPDATE public.runes SET img_url = 'assets/images/runes/78047.png' WHERE nom = 'Rune Pa Age';
UPDATE public.runes SET img_url = 'assets/images/runes/78041.png' WHERE nom = 'Rune Pa Cha';
UPDATE public.runes SET img_url = 'assets/images/runes/78045.png' WHERE nom = 'Rune Ra Fo';
UPDATE public.runes SET img_url = 'assets/images/runes/78051.png' WHERE nom = 'Rune Ra Sa';
UPDATE public.runes SET img_url = 'assets/images/runes/78039.png' WHERE nom = 'Rune Ra Ine';
UPDATE public.runes SET img_url = 'assets/images/runes/78054.png' WHERE nom = 'Rune Ra Vi';
UPDATE public.runes SET img_url = 'assets/images/runes/78048.png' WHERE nom = 'Rune Ra Age';
UPDATE public.runes SET img_url = 'assets/images/runes/78042.png' WHERE nom = 'Rune Ra Cha';
UPDATE public.runes SET img_url = 'assets/images/runes/78055.png' WHERE nom = 'Rune Ga Pa';
UPDATE public.runes SET img_url = 'assets/images/runes/78056.png' WHERE nom = 'Rune Ga Pme';
UPDATE public.runes SET img_url = 'assets/images/runes/78014.png' WHERE nom = 'Rune Cri';
UPDATE public.runes SET img_url = 'assets/images/runes/78013.png' WHERE nom = 'Rune So';
UPDATE public.runes SET img_url = 'assets/images/runes/78015.png' WHERE nom = 'Rune Do';
UPDATE public.runes SET img_url = 'assets/images/runes/78016.png' WHERE nom = 'Rune Pui';
UPDATE public.runes SET img_url = 'assets/images/runes/78017.png' WHERE nom = 'Rune Do Ren';
UPDATE public.runes SET img_url = 'assets/images/runes/78018.png' WHERE nom = 'Rune Po';
UPDATE public.runes SET img_url = 'assets/images/runes/78019.png' WHERE nom = 'Rune Invo';
UPDATE public.runes SET img_url = 'assets/images/runes/78020.png' WHERE nom = 'Rune Pod';
UPDATE public.runes SET img_url = 'assets/images/runes/78021.png' WHERE nom = 'Rune Pa Pod';
UPDATE public.runes SET img_url = 'assets/images/runes/78022.png' WHERE nom = 'Rune Ra Pod';
UPDATE public.runes SET img_url = 'assets/images/runes/78268.png' WHERE nom = 'Rune Do Pi';
UPDATE public.runes SET img_url = 'assets/images/runes/78024.png' WHERE nom = 'Rune Per Pi';
UPDATE public.runes SET img_url = 'assets/images/runes/78025.png' WHERE nom = 'Rune Ini';
UPDATE public.runes SET img_url = 'assets/images/runes/78026.png' WHERE nom = 'Rune Pa Ini';
UPDATE public.runes SET img_url = 'assets/images/runes/78027.png' WHERE nom = 'Rune Ra Ini';
UPDATE public.runes SET img_url = 'assets/images/runes/78036.png' WHERE nom = 'Rune Prospe';
UPDATE public.runes SET img_url = 'assets/images/runes/78028.png' WHERE nom = 'Rune Ré Feu';
UPDATE public.runes SET img_url = 'assets/images/runes/78032.png' WHERE nom = 'Rune Ré Air';
UPDATE public.runes SET img_url = 'assets/images/runes/78030.png' WHERE nom = 'Rune Ré Eau';
UPDATE public.runes SET img_url = 'assets/images/runes/78034.png' WHERE nom = 'Rune Ré Terre';
UPDATE public.runes SET img_url = 'assets/images/runes/78057.png' WHERE nom = 'Rune Ré Neutre';
UPDATE public.runes SET img_url = 'assets/images/runes/78029.png' WHERE nom = 'Rune Ré Per Feu';
UPDATE public.runes SET img_url = 'assets/images/runes/78033.png' WHERE nom = 'Rune Ré Per Air';
UPDATE public.runes SET img_url = 'assets/images/runes/78035.png' WHERE nom = 'Rune Ré Per Terre';
UPDATE public.runes SET img_url = 'assets/images/runes/78058.png' WHERE nom = 'Rune Ré Per Neutre';
UPDATE public.runes SET img_url = 'assets/images/runes/50037.png' WHERE nom = 'Rune de Signature';
UPDATE public.runes SET img_url = 'assets/images/runes/78031.png' WHERE nom = 'Rune Ré Per Eau';
UPDATE public.runes SET img_url = 'assets/images/runes/78059.png' WHERE nom = 'Rune de chasse';
UPDATE public.runes SET img_url = 'assets/images/runes/78023.png' WHERE nom = 'Rune Pa Do Pi';
UPDATE public.runes SET img_url = 'assets/images/runes/78266.png' WHERE nom = 'Rune Pa Per Pi';
UPDATE public.runes SET img_url = 'assets/images/runes/78267.png' WHERE nom = 'Rune Ra Per Pi';
UPDATE public.runes SET img_url = 'assets/images/runes/78269.png' WHERE nom = 'Rune Pa Pui';
UPDATE public.runes SET img_url = 'assets/images/runes/78270.png' WHERE nom = 'Rune Ra Pui';
UPDATE public.runes SET img_url = 'assets/images/runes/78271.png' WHERE nom = 'Rune Pa Prospe';
UPDATE public.runes SET img_url = 'assets/images/runes/78076.png' WHERE nom = 'Rune Fui';
UPDATE public.runes SET img_url = 'assets/images/runes/78075.png' WHERE nom = 'Rune Pa Fui';
UPDATE public.runes SET img_url = 'assets/images/runes/78077.png' WHERE nom = 'Rune Tac';
UPDATE public.runes SET img_url = 'assets/images/runes/78078.png' WHERE nom = 'Rune Pa Tac';
UPDATE public.runes SET img_url = 'assets/images/runes/78083.png' WHERE nom = 'Rune Ré Pa';
UPDATE public.runes SET img_url = 'assets/images/runes/78084.png' WHERE nom = 'Rune Pa Ré Pa';
UPDATE public.runes SET img_url = 'assets/images/runes/78085.png' WHERE nom = 'Rune Ré Pme';
UPDATE public.runes SET img_url = 'assets/images/runes/78086.png' WHERE nom = 'Rune Pa Ré Pme';
UPDATE public.runes SET img_url = 'assets/images/runes/78087.png' WHERE nom = 'Rune Ret Pa';
UPDATE public.runes SET img_url = 'assets/images/runes/78088.png' WHERE nom = 'Rune Pa Ret Pa';
UPDATE public.runes SET img_url = 'assets/images/runes/78089.png' WHERE nom = 'Rune Ret Pme';
UPDATE public.runes SET img_url = 'assets/images/runes/78090.png' WHERE nom = 'Rune Pa Ret Pme';
UPDATE public.runes SET img_url = 'assets/images/runes/78081.png' WHERE nom = 'Rune Do Pou';
UPDATE public.runes SET img_url = 'assets/images/runes/78082.png' WHERE nom = 'Rune Pa Do Pou';
UPDATE public.runes SET img_url = 'assets/images/runes/78079.png' WHERE nom = 'Rune Ré Pou';
UPDATE public.runes SET img_url = 'assets/images/runes/78080.png' WHERE nom = 'Rune Pa Ré Pou';
UPDATE public.runes SET img_url = 'assets/images/runes/78073.png' WHERE nom = 'Rune Do Cri';
UPDATE public.runes SET img_url = 'assets/images/runes/78074.png' WHERE nom = 'Rune Pa Do Cri';
UPDATE public.runes SET img_url = 'assets/images/runes/78071.png' WHERE nom = 'Rune Ré Cri';
UPDATE public.runes SET img_url = 'assets/images/runes/78072.png' WHERE nom = 'Rune Pa Ré Cri';
UPDATE public.runes SET img_url = 'assets/images/runes/78065.png' WHERE nom = 'Rune Do Terre';
UPDATE public.runes SET img_url = 'assets/images/runes/78066.png' WHERE nom = 'Rune Pa Do Terre';
UPDATE public.runes SET img_url = 'assets/images/runes/78063.png' WHERE nom = 'Rune Do Feu';
UPDATE public.runes SET img_url = 'assets/images/runes/78064.png' WHERE nom = 'Rune Pa Do Feu';
UPDATE public.runes SET img_url = 'assets/images/runes/78061.png' WHERE nom = 'Rune Do Eau';
UPDATE public.runes SET img_url = 'assets/images/runes/78062.png' WHERE nom = 'Rune Pa Do Eau';
UPDATE public.runes SET img_url = 'assets/images/runes/78067.png' WHERE nom = 'Rune Do Air';
UPDATE public.runes SET img_url = 'assets/images/runes/78068.png' WHERE nom = 'Rune Pa Do Air';
UPDATE public.runes SET img_url = 'assets/images/runes/78069.png' WHERE nom = 'Rune Do Neutre';
UPDATE public.runes SET img_url = 'assets/images/runes/78070.png' WHERE nom = 'Rune Pa Do Neutre';
UPDATE public.runes SET img_url = 'assets/images/runes/78092.png' WHERE nom = 'Rune Do Per Mé';
UPDATE public.runes SET img_url = 'assets/images/runes/78091.png' WHERE nom = 'Rune Do Per Di';
UPDATE public.runes SET img_url = 'assets/images/runes/78093.png' WHERE nom = 'Rune Do Per Ar';
UPDATE public.runes SET img_url = 'assets/images/runes/78094.png' WHERE nom = 'Rune Do Per So';
UPDATE public.runes SET img_url = 'assets/images/runes/78095.png' WHERE nom = 'Rune Ré Per Mé';
UPDATE public.runes SET img_url = 'assets/images/runes/78096.png' WHERE nom = 'Rune Ré Per Di';
UPDATE public.runes SET img_url = 'assets/images/runes/78099.png' WHERE nom = 'Rune Pa So';
UPDATE public.runes SET img_url = 'assets/images/runes/78100.png' WHERE nom = 'Rune Pa Ré Air';
UPDATE public.runes SET img_url = 'assets/images/runes/78101.png' WHERE nom = 'Rune Pa Ré Eau';
UPDATE public.runes SET img_url = 'assets/images/runes/78102.png' WHERE nom = 'Rune Pa Ré Feu';
UPDATE public.runes SET img_url = 'assets/images/runes/78103.png' WHERE nom = 'Rune Pa Ré Neutre';
UPDATE public.runes SET img_url = 'assets/images/runes/78104.png' WHERE nom = 'Rune Pa Ré Terre';
UPDATE public.runes SET img_url = 'assets/images/runes/78272.png' WHERE nom = 'Rune Ra Ré Pou';
UPDATE public.runes SET img_url = 'assets/images/runes/78273.png' WHERE nom = 'Rune Ra Do Pou';
UPDATE public.runes SET img_url = 'assets/images/runes/78294.png' WHERE nom = 'Rune Ra Ré Terre';
UPDATE public.runes SET img_url = 'assets/images/runes/78293.png' WHERE nom = 'Rune Ra Ré Neutre';
UPDATE public.runes SET img_url = 'assets/images/runes/78295.png' WHERE nom = 'Rune Ra Ré Feu';
UPDATE public.runes SET img_url = 'assets/images/runes/78296.png' WHERE nom = 'Rune Ra Ré Eau';
UPDATE public.runes SET img_url = 'assets/images/runes/78292.png' WHERE nom = 'Rune Ra Ré Cri';
UPDATE public.runes SET img_url = 'assets/images/runes/78297.png' WHERE nom = 'Rune Ra Ré Air';
UPDATE public.runes SET img_url = 'assets/images/runes/78017.png' WHERE nom = 'Rune Pa Do Ren';


/* ################################################################ */
/* ### SOURCE : 023-fm-item-pui.sql ################################### */
/* ################################################################ */

/* ============================================ */
/* FM : poids (pui) de l'item travaille         */
/* ============================================ */
/* Calcule depuis les stats visibles du         */
/* Costumager (valeur actuelle x poids/unite).  */
/* - depart : pui au lancement de la session    */
/* - max    : budget theorique (jets max)       */
/* - final  : pui a la cloture                  */
/* Puits disponible = max - actuel.             */
/* ============================================ */

ALTER TABLE public.fm_sessions
    ADD COLUMN IF NOT EXISTS item_pui_depart NUMERIC DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS item_pui_max    NUMERIC DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS item_pui_final  NUMERIC DEFAULT NULL;


/* ################################################################ */
/* ### SOURCE : 024-modules-config.sql ################################### */
/* ################################################################ */

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
DROP POLICY IF EXISTS "modules_select" ON public.modules_config;
CREATE POLICY "modules_select" ON public.modules_config
    FOR SELECT USING (true);

/* Ecriture admin uniquement */
DROP POLICY IF EXISTS "modules_admin_insert" ON public.modules_config;
DROP POLICY IF EXISTS "modules_admin_insert" ON public.modules_config;
CREATE POLICY "modules_admin_insert" ON public.modules_config
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

DROP POLICY IF EXISTS "modules_admin_update" ON public.modules_config;
DROP POLICY IF EXISTS "modules_admin_update" ON public.modules_config;
CREATE POLICY "modules_admin_update" ON public.modules_config
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

DROP POLICY IF EXISTS "modules_admin_delete" ON public.modules_config;
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


/* ################################################################ */
/* ### OVERRIDES DAMOCLES ######################################### */
/* ################################################################ */

/* --- Derive de schema REN : colonnes ajoutees a la main en prod   */
/* (hors migrations), confirmees par sondage REST le 23/07/2026 --- */
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS mules TEXT[] DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS zone_reservee TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS preference_recompense TEXT DEFAULT NULL;

ALTER TABLE public.builds
    ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS type_build TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS classe TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS valeur_kamas BIGINT DEFAULT 0;

/* --- Storage : policies du bucket 'builds' (images des builds).   */
/* Le bucket lui-meme se cree en Public via Dashboard > Storage --- */
DROP POLICY IF EXISTS "builds_images_select" ON storage.objects;
DROP POLICY IF EXISTS "builds_images_select" ON storage.objects;
CREATE POLICY "builds_images_select" ON storage.objects
    FOR SELECT USING (bucket_id = 'builds');

DROP POLICY IF EXISTS "builds_images_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "builds_images_admin_insert" ON storage.objects;
CREATE POLICY "builds_images_admin_insert" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'builds'
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

DROP POLICY IF EXISTS "builds_images_admin_delete" ON storage.objects;
DROP POLICY IF EXISTS "builds_images_admin_delete" ON storage.objects;
CREATE POLICY "builds_images_admin_delete" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'builds'
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

/* --- Modules desactives au lancement (Admin > Modules pour react.) --- */
UPDATE public.modules_config SET actif = FALSE, updated_at = NOW() WHERE module IN ('jeux', 'boutique');


/* ################################################################ */
/* ### SOURCE : 025-combats-preuves.sql ########################### */
/* ################################################################ */

/* ============================================ */
/* Combats : 2 screenshots obligatoires         */
/* + rattrapage derive REN : perco_owner_id     */
/* ============================================ */

/* Colonne heritee de REN jamais migree :        */
/* proprietaire du percepteur defendu (defense)  */
ALTER TABLE public.combats
    ADD COLUMN IF NOT EXISTS perco_owner_id UUID REFERENCES public.profiles(id);

/* 2 preuves par combat (attaque ET defense) */
ALTER TABLE public.combats
    ADD COLUMN IF NOT EXISTS preuve_url_1 TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS preuve_url_2 TEXT DEFAULT NULL;

/* Verrou serveur : impossible d'inserer un combat sans les 2 screens.  */
/* NOT VALID = ne verifie que les nouvelles lignes (les anciennes       */
/* lignes sans preuves restent valides si la table n'etait pas vide).   */
ALTER TABLE public.combats DROP CONSTRAINT IF EXISTS combats_preuves_obligatoires;
ALTER TABLE public.combats ADD CONSTRAINT combats_preuves_obligatoires
    CHECK (preuve_url_1 IS NOT NULL AND preuve_url_2 IS NOT NULL) NOT VALID;


/* ################################################################ */
/* ### SOURCE : 026-avatars-policies.sql ########################## */
/* ################################################################ */

/* ============================================ */
/* Storage : policies du bucket 'avatars'       */
/* ============================================ */
/* Photo de profil : fichier {userId}.{ext},    */
/* upsert au changement. Chaque membre ne peut  */
/* ecrire QUE son propre fichier. L'upload doit */
/* marcher DES l'inscription (avant validation) */
/* donc pas de check is_validated ici.          */

DROP POLICY IF EXISTS "avatars_select" ON storage.objects;
CREATE POLICY "avatars_select" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'avatars'
        AND name LIKE auth.uid()::text || '.%'
    );

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'avatars'
        AND name LIKE auth.uid()::text || '.%'
    );

DROP POLICY IF EXISTS "avatars_delete_own_or_admin" ON storage.objects;
CREATE POLICY "avatars_delete_own_or_admin" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'avatars'
        AND (
            name LIKE auth.uid()::text || '.%'
            OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
        )
    );
