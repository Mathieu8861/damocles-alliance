-- ============================================
-- Alliance REN - Views (Classements)
-- A executer apres 002-triggers.sql
-- ============================================

-- === VIEW: Classement PVP Semaine ===
CREATE OR REPLACE VIEW public.classement_pvp_semaine
WITH (security_invoker = true) AS
SELECT
    p.id,
    p.username,
    COALESCE(SUM(c.points_gagnes), 0)::INTEGER AS points
FROM public.profiles p
LEFT JOIN public.combat_participants cp ON cp.user_id = p.id
LEFT JOIN public.combats c ON c.id = cp.combat_id
    AND c.created_at >= date_trunc('week', NOW() AT TIME ZONE 'Europe/Paris')
WHERE p.is_validated = TRUE
GROUP BY p.id, p.username
HAVING COALESCE(SUM(c.points_gagnes), 0) > 0
ORDER BY points DESC;

-- === VIEW: Classement PVP Semaine Passée ===
CREATE OR REPLACE VIEW public.classement_pvp_semaine_passee
WITH (security_invoker = true) AS
SELECT
    p.id,
    p.username,
    COALESCE(SUM(c.points_gagnes), 0)::INTEGER AS points
FROM public.profiles p
LEFT JOIN public.combat_participants cp ON cp.user_id = p.id
LEFT JOIN public.combats c ON c.id = cp.combat_id
    AND c.created_at >= (date_trunc('week', NOW() AT TIME ZONE 'Europe/Paris') - INTERVAL '7 days')
    AND c.created_at < date_trunc('week', NOW() AT TIME ZONE 'Europe/Paris')
WHERE p.is_validated = TRUE
GROUP BY p.id, p.username
HAVING COALESCE(SUM(c.points_gagnes), 0) > 0
ORDER BY points DESC;

-- === VIEW: Classement PVP Definitif ===
CREATE OR REPLACE VIEW public.classement_pvp_definitif
WITH (security_invoker = true) AS
SELECT
    p.id,
    p.username,
    COALESCE(SUM(c.points_gagnes), 0)::INTEGER AS points
FROM public.profiles p
LEFT JOIN public.combat_participants cp ON cp.user_id = p.id
LEFT JOIN public.combats c ON c.id = cp.combat_id
WHERE p.is_validated = TRUE
GROUP BY p.id, p.username
HAVING COALESCE(SUM(c.points_gagnes), 0) > 0
ORDER BY points DESC;

-- === VIEW: Classement Kamas Voles par Alliance ===
CREATE OR REPLACE VIEW public.classement_kamas_alliance
WITH (security_invoker = true) AS
SELECT
    COALESCE(a.nom, c.alliance_ennemie_nom, 'Inconnu') AS alliance_nom,
    SUM(c.butin_kamas)::BIGINT AS total_kamas
FROM public.combats c
LEFT JOIN public.alliances a ON a.id = c.alliance_ennemie_id
WHERE c.type = 'attaque' AND c.resultat = 'victoire' AND c.butin_kamas > 0
GROUP BY alliance_nom
ORDER BY total_kamas DESC;

-- === VIEW: Classement Kamas Voles par Joueur ===
-- Divise le butin par le nombre d'allies pour attribuer la part individuelle
CREATE OR REPLACE VIEW public.classement_kamas_joueur
WITH (security_invoker = true) AS
SELECT
    p.id,
    p.username,
    COALESCE(SUM(c.butin_kamas / GREATEST(c.nb_allies, 1)), 0)::BIGINT AS total_kamas
FROM public.profiles p
JOIN public.combat_participants cp ON cp.user_id = p.id
JOIN public.combats c ON c.id = cp.combat_id
WHERE c.type = 'attaque' AND c.resultat = 'victoire'
GROUP BY p.id, p.username
HAVING COALESCE(SUM(c.butin_kamas / GREATEST(c.nb_allies, 1)), 0) > 0
ORDER BY total_kamas DESC;

-- === VIEW: Classement Jetons (avec stats tirages) ===
CREATE OR REPLACE VIEW public.classement_jetons
WITH (security_invoker = true) AS
SELECT
    p.id,
    p.username,
    p.jetons,
    p.percepteurs,
    COALESCE(s.tirages, 0)::INTEGER AS tirages,
    COALESCE(s.pepites, 0)::INTEGER AS pepites
FROM public.profiles p
LEFT JOIN (
    SELECT
        jh.user_id,
        COUNT(*)::INTEGER AS tirages,
        SUM(
            CASE
                WHEN jh.resultat = 'double' THEN jl.gain_pepites * 2
                WHEN jh.resultat = 'perdu' THEN 0
                ELSE jl.gain_pepites
            END
        )::INTEGER AS pepites
    FROM public.jeu_historique jh
    JOIN public.jeu_lots jl ON jl.id = jh.lot_id
    GROUP BY jh.user_id
) s ON s.user_id = p.id
WHERE p.is_validated = TRUE AND p.jetons > 0
ORDER BY p.jetons DESC;

-- === VIEW: Pépites gagnées au jeu — Semaine passée ===
CREATE OR REPLACE VIEW public.pepites_semaine_passee
WITH (security_invoker = true) AS
SELECT
    p.id, p.username,
    COUNT(jh.id)::INTEGER AS tirages,
    SUM(
        CASE
            WHEN jh.resultat = 'double' THEN jl.gain_pepites * 2
            WHEN jh.resultat = 'perdu' THEN 0
            ELSE jl.gain_pepites
        END
    )::INTEGER AS pepites
FROM public.profiles p
JOIN public.jeu_historique jh ON jh.user_id = p.id
JOIN public.jeu_lots jl ON jl.id = jh.lot_id
WHERE jh.created_at >= (date_trunc('week', NOW() AT TIME ZONE 'Europe/Paris') - INTERVAL '7 days')
  AND jh.created_at < date_trunc('week', NOW() AT TIME ZONE 'Europe/Paris')
GROUP BY p.id, p.username
HAVING SUM(CASE WHEN jh.resultat = 'double' THEN jl.gain_pepites * 2
                WHEN jh.resultat = 'perdu' THEN 0
                ELSE jl.gain_pepites END) > 0
ORDER BY pepites DESC;

-- === VIEW: Pépites gagnées au jeu — Semaine en cours ===
CREATE OR REPLACE VIEW public.pepites_semaine_courante
WITH (security_invoker = true) AS
SELECT
    p.id, p.username,
    COUNT(jh.id)::INTEGER AS tirages,
    SUM(
        CASE
            WHEN jh.resultat = 'double' THEN jl.gain_pepites * 2
            WHEN jh.resultat = 'perdu' THEN 0
            ELSE jl.gain_pepites
        END
    )::INTEGER AS pepites
FROM public.profiles p
JOIN public.jeu_historique jh ON jh.user_id = p.id
JOIN public.jeu_lots jl ON jl.id = jh.lot_id
WHERE jh.created_at >= date_trunc('week', NOW() AT TIME ZONE 'Europe/Paris')
GROUP BY p.id, p.username
ORDER BY pepites DESC;
