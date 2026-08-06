-- ============================================================
-- 037 : Infos par mule (classe + elements joues, multi-roles)
-- profiles.mules reste le tableau de NOMS (formulaires de combat
-- et recherches inchanges) ; mules_infos = { "NomMule": {
-- "classe": "Feca", "elements": ["Terre", "Multi"] } }
-- ============================================================

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS mules_infos JSONB NOT NULL DEFAULT '{}'::jsonb;
