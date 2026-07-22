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
