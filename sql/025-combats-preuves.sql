/* ============================================ */
/* Combats : 2 screenshots obligatoires         */
/* + rattrapage derive REN : perco_owner_id     */
/* ============================================ */

/* Colonne heritee de REN jamais migree :        */
/* proprietaire du percepteur defendu (defense)  */
ALTER TABLE public.combats
    ADD COLUMN IF NOT EXISTS perco_owner_id UUID REFERENCES public.profiles(id);

/* 2 preuves par combat (attaque ET defense) */
ALTER TABLE public.combats
    ADD COLUMN IF NOT EXISTS preuve_url_1 TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS preuve_url_2 TEXT DEFAULT NULL;

/* Verrou serveur : impossible d'inserer un combat sans les 2 screens.  */
/* NOT VALID = ne verifie que les nouvelles lignes (les anciennes       */
/* lignes sans preuves restent valides si la table n'etait pas vide).   */
ALTER TABLE public.combats DROP CONSTRAINT IF EXISTS combats_preuves_obligatoires;
ALTER TABLE public.combats ADD CONSTRAINT combats_preuves_obligatoires
    CHECK (preuve_url_1 IS NOT NULL AND preuve_url_2 IS NOT NULL) NOT VALID;
