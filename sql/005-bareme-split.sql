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
