/* ============================================ */
/* Combats : invites hors site                  */
/* ============================================ */
/* Joueurs presents au combat mais pas inscrits */
/* sur le site (pas encore inscrits, ou autres  */
/* alliances). Stockes en simple liste de noms  */
/* sur le combat : ils comptent dans l'effectif */
/* mais ne recoivent ni points ni jetons.       */

ALTER TABLE public.combats
    ADD COLUMN IF NOT EXISTS invites TEXT[] DEFAULT NULL;
