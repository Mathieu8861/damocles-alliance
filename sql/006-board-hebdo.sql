-- ============================================
-- Alliance REN - Board Hebdomadaire
-- Archivage semaines + récompenses auto
-- A exécuter dans Supabase SQL Editor
-- ============================================

-- === TABLE: SEMAINES ===
-- Chaque semaine archivée
CREATE TABLE public.semaines (
    id SERIAL PRIMARY KEY,
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    archivee_par UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- === TABLE: SEMAINE_SNAPSHOTS ===
-- Points de chaque joueur pour chaque semaine archivée
CREATE TABLE public.semaine_snapshots (
    id SERIAL PRIMARY KEY,
    semaine_id INTEGER NOT NULL REFERENCES public.semaines(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    username TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 0,
    rang INTEGER NOT NULL DEFAULT 0,
    recompense_pepites INTEGER DEFAULT 0,
    recompense_percepteurs INTEGER DEFAULT 0,
    UNIQUE(semaine_id, user_id)
);

-- === TABLE: RECOMPENSES_CONFIG ===
-- Barème des récompenses hebdo (configurable par admin)
CREATE TABLE public.recompenses_config (
    id SERIAL PRIMARY KEY,
    label TEXT NOT NULL,
    emoji TEXT DEFAULT '',
    seuil_min INTEGER NOT NULL,
    seuil_max INTEGER DEFAULT NULL,
    percepteurs_bonus INTEGER DEFAULT 0,
    pepites INTEGER DEFAULT 0,
    ordre INTEGER DEFAULT 0
);

-- Barème par défaut (basé sur ton Discord)
INSERT INTO public.recompenses_config (label, emoji, seuil_min, seuil_max, percepteurs_bonus, pepites, ordre) VALUES
('Élite', '💎', 50, NULL, 3, 2000, 1),
('Vétéran', '💎', 30, 49, 2, 1200, 2),
('Actif', '🏆', 5, 29, 1, 800, 3),
('Participant', '⚙️', 1, 4, 0, 0, 4);

-- === INDEX ===
CREATE INDEX idx_semaines_dates ON public.semaines(date_debut DESC);
CREATE INDEX idx_snapshots_semaine ON public.semaine_snapshots(semaine_id);
CREATE INDEX idx_snapshots_user ON public.semaine_snapshots(user_id);

-- === RLS ===
ALTER TABLE public.semaines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semaine_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recompenses_config ENABLE ROW LEVEL SECURITY;

-- Lecture pour tous les utilisateurs authentifiés
CREATE POLICY "semaines_select" ON public.semaines FOR SELECT TO authenticated USING (true);
CREATE POLICY "snapshots_select" ON public.semaine_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "recompenses_select" ON public.recompenses_config FOR SELECT TO authenticated USING (true);

-- Écriture réservée aux admins
CREATE POLICY "semaines_insert" ON public.semaines FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "snapshots_insert" ON public.semaine_snapshots FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "recompenses_all" ON public.recompenses_config FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
