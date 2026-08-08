-- ============================================
-- 041 - Droit de réservation de zone par palier de points
-- Chaque palier du barème par points (recompenses_config) peut inclure
-- ou non un droit de réservation de zone (resa). L'éligibilité à la
-- zone réservée n'est plus un seuil codé en dur (75 pts) : c'est le
-- palier qui décide, réglable dans Admin > Barème Perco.
-- ============================================

ALTER TABLE public.recompenses_config
    ADD COLUMN IF NOT EXISTS resa INTEGER NOT NULL DEFAULT 0;

-- Barème demandé : Élite (80+ pts) = 3 percos + 1 résa
UPDATE public.recompenses_config
SET percepteurs_bonus = 3, resa = 1
WHERE seuil_min = 80;
