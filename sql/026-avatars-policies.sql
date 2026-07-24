/* ============================================ */
/* Storage : policies du bucket 'avatars'       */
/* ============================================ */
/* Photo de profil : fichier {userId}.{ext},    */
/* upsert au changement. Chaque membre ne peut  */
/* ecrire QUE son propre fichier. L'upload doit */
/* marcher DES l'inscription (avant validation) */
/* donc pas de check is_validated ici.          */

DROP POLICY IF EXISTS "avatars_select" ON storage.objects;
CREATE POLICY "avatars_select" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'avatars'
        AND name LIKE auth.uid()::text || '.%'
    );

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'avatars'
        AND name LIKE auth.uid()::text || '.%'
    );

DROP POLICY IF EXISTS "avatars_delete_own_or_admin" ON storage.objects;
CREATE POLICY "avatars_delete_own_or_admin" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'avatars'
        AND (
            name LIKE auth.uid()::text || '.%'
            OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
        )
    );
