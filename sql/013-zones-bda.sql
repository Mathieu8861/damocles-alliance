/* ============================================ */
/* Zones réservées Banque d'Alliance (BDA)      */
/* ============================================ */

CREATE TABLE IF NOT EXISTS public.zones_bda (
    id          SERIAL PRIMARY KEY,
    nom_zone    TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at  TIMESTAMPTZ DEFAULT now()
);

/* RLS : tout le monde peut lire, seuls les admins écrivent */
ALTER TABLE public.zones_bda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "zones_bda_select" ON public.zones_bda
    FOR SELECT USING (true);

CREATE POLICY "zones_bda_admin_insert" ON public.zones_bda
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

CREATE POLICY "zones_bda_admin_update" ON public.zones_bda
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

CREATE POLICY "zones_bda_admin_delete" ON public.zones_bda
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );
