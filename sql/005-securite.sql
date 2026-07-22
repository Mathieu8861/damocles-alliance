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

CREATE POLICY "recompenses_config_select" ON public.recompenses_config
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "recompenses_config_admin_all" ON public.recompenses_config
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- SEMAINES
ALTER TABLE public.semaines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "semaines_select" ON public.semaines
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "semaines_admin_insert" ON public.semaines
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- SEMAINE_SNAPSHOTS
ALTER TABLE public.semaine_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "snapshots_select" ON public.semaine_snapshots
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "snapshots_admin_insert" ON public.semaine_snapshots
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- BOUTIQUE_ITEMS
ALTER TABLE public.boutique_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boutique_items_select" ON public.boutique_items
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "boutique_items_admin_all" ON public.boutique_items
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- BOUTIQUE_ACHATS
ALTER TABLE public.boutique_achats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boutique_achats_select_own" ON public.boutique_achats
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "boutique_achats_insert_own" ON public.boutique_achats
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_validated = true));

CREATE POLICY "boutique_achats_admin_update" ON public.boutique_achats
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- BOUTIQUE_CONFIG
ALTER TABLE public.boutique_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boutique_config_select" ON public.boutique_config
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "boutique_config_admin_update" ON public.boutique_config
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- BOUTIQUE_DEMANDES_KAMAS
ALTER TABLE public.boutique_demandes_kamas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demandes_kamas_select_own" ON public.boutique_demandes_kamas
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "demandes_kamas_insert_own" ON public.boutique_demandes_kamas
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_validated = true));

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
