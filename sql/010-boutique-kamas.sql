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
