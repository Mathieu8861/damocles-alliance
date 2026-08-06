-- ============================================================
-- 038 : Edition complete d'un combat depuis l'historique :
-- policy DELETE sur combat_participants (admins, ou auteur du
-- combat dans sa fenetre de 3h) pour permettre la modification
-- de la liste des participants.
-- ============================================================

DROP POLICY IF EXISTS "participants_delete" ON public.combat_participants;
CREATE POLICY "participants_delete" ON public.combat_participants
    FOR DELETE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
        OR EXISTS (SELECT 1 FROM public.combats c
                   WHERE c.id = combat_id
                     AND c.auteur_id = auth.uid()
                     AND c.created_at > NOW() - INTERVAL '3 hours')
    );
