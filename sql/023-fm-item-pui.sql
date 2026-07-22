/* ============================================ */
/* FM : poids (pui) de l'item travaille         */
/* ============================================ */
/* Calcule depuis les stats visibles du         */
/* Costumager (valeur actuelle x poids/unite).  */
/* - depart : pui au lancement de la session    */
/* - max    : budget theorique (jets max)       */
/* - final  : pui a la cloture                  */
/* Puits disponible = max - actuel.             */
/* ============================================ */

ALTER TABLE public.fm_sessions
    ADD COLUMN IF NOT EXISTS item_pui_depart NUMERIC DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS item_pui_max    NUMERIC DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS item_pui_final  NUMERIC DEFAULT NULL;
