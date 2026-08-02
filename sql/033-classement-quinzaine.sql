-- ============================================================
-- 033 : Classement PvP et droits perco en QUINZAINE (2 semaines)
-- Demande Mathieu 03/08/2026 : le reset hebdo devient bi-hebdo.
-- Ancre : lundi 27/07/2026 00:00 Europe/Paris.
-- Prochains resets : 10/08, 24/08, 07/09...
-- Les vues gardent leur nom "semaine" (le client web en depend) ;
-- seule la fenetre temporelle change. L'eligibilite zone percos
-- (>= 75 pts sur periode courante OU passee) suit automatiquement.
-- ============================================================

CREATE OR REPLACE FUNCTION public.debut_periode_pvp()
RETURNS timestamptz
LANGUAGE sql STABLE
SET search_path = public
AS $$
    SELECT ((DATE '2026-07-27'
        + 14 * FLOOR(((NOW() AT TIME ZONE 'Europe/Paris')::date - DATE '2026-07-27') / 14.0)::int
    )::timestamp) AT TIME ZONE 'Europe/Paris';
$$;

CREATE OR REPLACE VIEW public.classement_pvp_semaine
WITH (security_invoker = true) AS
SELECT
    p.id,
    p.username,
    COALESCE(SUM(c.points_gagnes), 0)::INTEGER AS points
FROM public.profiles p
LEFT JOIN public.combat_participants cp ON cp.user_id = p.id
LEFT JOIN public.combats c ON c.id = cp.combat_id
    AND c.created_at >= public.debut_periode_pvp()
WHERE p.is_validated = TRUE
GROUP BY p.id, p.username
HAVING COALESCE(SUM(c.points_gagnes), 0) > 0
ORDER BY points DESC;

CREATE OR REPLACE VIEW public.classement_pvp_semaine_passee
WITH (security_invoker = true) AS
SELECT
    p.id,
    p.username,
    COALESCE(SUM(c.points_gagnes), 0)::INTEGER AS points
FROM public.profiles p
LEFT JOIN public.combat_participants cp ON cp.user_id = p.id
LEFT JOIN public.combats c ON c.id = cp.combat_id
    AND c.created_at >= (public.debut_periode_pvp() - INTERVAL '14 days')
    AND c.created_at < public.debut_periode_pvp()
WHERE p.is_validated = TRUE
GROUP BY p.id, p.username
HAVING COALESCE(SUM(c.points_gagnes), 0) > 0
ORDER BY points DESC;
