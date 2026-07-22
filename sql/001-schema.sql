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
