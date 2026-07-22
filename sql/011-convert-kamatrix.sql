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
