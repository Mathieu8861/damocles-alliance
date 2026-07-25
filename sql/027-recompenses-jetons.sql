/* ============================================ */
/* Derive REN : recompenses_config.jetons_reward */
/* ============================================ */
/* Colonne "Jetons" du bareme perco (recompense */
/* hebdo en jetons), ajoutee a la main sur REN, */
/* jamais migree. Derniere derive detectee par  */
/* le balayage complet du 25/07/2026 (80 paires */
/* table:colonne sondees, 1 manquante).         */

ALTER TABLE public.recompenses_config
    ADD COLUMN IF NOT EXISTS jetons_reward INTEGER DEFAULT 0;
