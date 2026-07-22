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
