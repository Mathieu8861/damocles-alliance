/* ============================================ */
/* Recyclages : type zone/dj sur zones_perco     */
/* ============================================ */

/* Une zone peut etre une "zone" classique (monstres exterieurs) */
/* ou un "dj" (donjon de la meme zone, generalement +10 niveaux) */
/* Les entrees existantes sont marquees 'zone' par defaut.       */
/* L'admin cree les DJ comme entrees distinctes via le back-office. */

ALTER TABLE public.zones_perco
    ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'zone'
    CHECK (type IN ('zone', 'dj'));

/* Index pour filtrage rapide cote autocomplete */
CREATE INDEX IF NOT EXISTS idx_zones_perco_type ON public.zones_perco(type, actif);
