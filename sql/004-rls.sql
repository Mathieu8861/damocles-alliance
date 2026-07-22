-- ============================================
-- Alliance REN - Row Level Security (RLS)
-- A executer apres 003-views.sql
-- ============================================

-- === PROFILES ===
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Tout utilisateur authentifie peut lire les profils
CREATE POLICY "profiles_select" ON public.profiles
    FOR SELECT TO authenticated USING (true);

-- Un user peut modifier son propre profil (mais pas is_admin/is_validated)
CREATE POLICY "profiles_update_self" ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Un admin peut tout modifier sur les profils
CREATE POLICY "profiles_admin_update" ON public.profiles
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- Un admin peut supprimer un profil
CREATE POLICY "profiles_admin_delete" ON public.profiles
    FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- === ALLIANCES ===
ALTER TABLE public.alliances ENABLE ROW LEVEL SECURITY;

-- Tout user authentifie peut lire
CREATE POLICY "alliances_select" ON public.alliances
    FOR SELECT TO authenticated USING (true);

-- Seuls les admins peuvent gerer
CREATE POLICY "alliances_admin_insert" ON public.alliances
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "alliances_admin_update" ON public.alliances
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "alliances_admin_delete" ON public.alliances
    FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- === COMBATS ===
ALTER TABLE public.combats ENABLE ROW LEVEL SECURITY;

-- Tout user authentifie peut lire
CREATE POLICY "combats_select" ON public.combats
    FOR SELECT TO authenticated USING (true);

-- Seuls les users valides peuvent inserer
CREATE POLICY "combats_insert" ON public.combats
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_validated = true));

-- Un admin peut supprimer
CREATE POLICY "combats_admin_delete" ON public.combats
    FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- === COMBAT_PARTICIPANTS ===
ALTER TABLE public.combat_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants_select" ON public.combat_participants
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "participants_insert" ON public.combat_participants
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_validated = true));

CREATE POLICY "participants_admin_delete" ON public.combat_participants
    FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- === BAREME_POINTS ===
ALTER TABLE public.bareme_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bareme_select" ON public.bareme_points
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "bareme_admin_update" ON public.bareme_points
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- === BUILDS ===
ALTER TABLE public.builds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "builds_select" ON public.builds
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "builds_admin_insert" ON public.builds
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "builds_admin_update" ON public.builds
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "builds_admin_delete" ON public.builds
    FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- === JEU_CONFIG ===
ALTER TABLE public.jeu_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jeu_config_select" ON public.jeu_config
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "jeu_config_admin_update" ON public.jeu_config
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- === JEU_LOTS ===
ALTER TABLE public.jeu_lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jeu_lots_select" ON public.jeu_lots
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "jeu_lots_admin_all" ON public.jeu_lots
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- === JEU_HISTORIQUE ===
ALTER TABLE public.jeu_historique ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jeu_historique_select" ON public.jeu_historique
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "jeu_historique_insert" ON public.jeu_historique
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_validated = true));

CREATE POLICY "jeu_historique_admin_delete" ON public.jeu_historique
    FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
