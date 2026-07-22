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

CREATE POLICY "slot_symboles_select" ON public.slot_symboles
    FOR SELECT TO authenticated USING (true);

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

CREATE POLICY "slot_select_own" ON public.slot_historique
    FOR SELECT TO authenticated
    USING (joueur_id = auth.uid());

CREATE POLICY "slot_insert_own" ON public.slot_historique
    FOR INSERT TO authenticated
    WITH CHECK (joueur_id = auth.uid());

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

CREATE POLICY "slot_conversion_select_own" ON public.slot_demandes_conversion
    FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "slot_conversion_insert_own" ON public.slot_demandes_conversion
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

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
