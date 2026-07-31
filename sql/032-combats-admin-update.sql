-- ============================================================
-- 032 : Les admins peuvent MODIFIER un combat depuis l'historique
-- (correction d'erreurs de declaration : type, resultat, effectifs,
--  butin, zone ; les points sont recalcules cote client via le bareme)
-- ============================================================

DROP POLICY IF EXISTS "combats_admin_update" ON public.combats;
CREATE POLICY "combats_admin_update" ON public.combats
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
