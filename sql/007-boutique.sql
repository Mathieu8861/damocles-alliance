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

CREATE POLICY "boutique_config_select" ON public.boutique_config
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "boutique_config_admin" ON public.boutique_config
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- === RLS: boutique_items ===
ALTER TABLE public.boutique_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boutique_items_select" ON public.boutique_items
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "boutique_items_admin" ON public.boutique_items
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- === RLS: boutique_achats ===
ALTER TABLE public.boutique_achats ENABLE ROW LEVEL SECURITY;

-- Joueur peut voir ses propres achats
CREATE POLICY "boutique_achats_select_own" ON public.boutique_achats
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Joueur peut créer un achat pour lui-même
CREATE POLICY "boutique_achats_insert_own" ON public.boutique_achats
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Joueur peut supprimer ses achats distribués
CREATE POLICY "boutique_achats_delete_own" ON public.boutique_achats
    FOR DELETE TO authenticated
    USING (user_id = auth.uid() AND statut = 'distribue');

-- Admin peut tout voir et modifier
CREATE POLICY "boutique_achats_admin" ON public.boutique_achats
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- === RLS: boutique_demandes_kamas ===
ALTER TABLE public.boutique_demandes_kamas ENABLE ROW LEVEL SECURITY;

-- Joueur peut voir ses propres demandes
CREATE POLICY "boutique_demandes_select_own" ON public.boutique_demandes_kamas
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Joueur peut créer une demande pour lui-même
CREATE POLICY "boutique_demandes_insert_own" ON public.boutique_demandes_kamas
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Admin peut tout voir et modifier
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
