/* ============================================ */
/* Builds communautaires                        */
/* ============================================ */
/* Tout membre VALIDE peut proposer un build    */
/* depuis la page Builds. L'auteur peut         */
/* supprimer/modifier le sien, l'admin peut     */
/* tout gerer.                                  */

ALTER TABLE public.builds
    ADD COLUMN IF NOT EXISTS auteur_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

/* INSERT : membre valide, auteur = soi (NULL tolere pour l'admin/l'existant) */
DROP POLICY IF EXISTS "builds_admin_insert" ON public.builds;
DROP POLICY IF EXISTS "builds_insert_validated" ON public.builds;
CREATE POLICY "builds_insert_validated" ON public.builds
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_validated = true)
        AND (auteur_id IS NULL OR auteur_id = auth.uid())
    );

/* UPDATE / DELETE : auteur du build OU admin */
DROP POLICY IF EXISTS "builds_admin_update" ON public.builds;
DROP POLICY IF EXISTS "builds_update_own_or_admin" ON public.builds;
CREATE POLICY "builds_update_own_or_admin" ON public.builds
    FOR UPDATE TO authenticated
    USING (
        auteur_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

DROP POLICY IF EXISTS "builds_admin_delete" ON public.builds;
DROP POLICY IF EXISTS "builds_delete_own_or_admin" ON public.builds;
CREATE POLICY "builds_delete_own_or_admin" ON public.builds
    FOR DELETE TO authenticated
    USING (
        auteur_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

/* Storage 'builds' : upload ouvert aux membres valides (avant : admin only) */
DROP POLICY IF EXISTS "builds_images_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "builds_images_insert_validated" ON storage.objects;
CREATE POLICY "builds_images_insert_validated" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'builds'
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_validated = true)
    );

DROP POLICY IF EXISTS "builds_images_admin_delete" ON storage.objects;
DROP POLICY IF EXISTS "builds_images_delete_own_or_admin" ON storage.objects;
CREATE POLICY "builds_images_delete_own_or_admin" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'builds'
        AND (
            owner = auth.uid()
            OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
        )
    );
