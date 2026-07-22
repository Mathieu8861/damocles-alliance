/* ============================================ */
/* Forgemagie : runes + sessions de FM          */
/* ============================================ */

/* === TABLE : RUNES === */
/* Catalogue des runes avec leur poids (pui) et prix kamas.       */
/* Poids seed = valeurs standards Dofus, ajustables en admin.     */
/* Prix kamas renseignes par l'admin (prix HDV serveur partages). */
CREATE TABLE IF NOT EXISTS public.runes (
    id          SERIAL PRIMARY KEY,
    nom         TEXT NOT NULL UNIQUE,
    categorie   TEXT NOT NULL,              /* ex: Force, Vitalite, Dommages, PA... */
    tier        TEXT NOT NULL DEFAULT 'basique' CHECK (tier IN ('basique', 'pa', 'ra')),
    bonus       NUMERIC NOT NULL DEFAULT 1, /* valeur de stat apportee par la rune */
    poids       NUMERIC NOT NULL DEFAULT 1, /* pui total de la rune               */
    prix_kamas  INTEGER NOT NULL DEFAULT 0, /* prix unitaire HDV, renseigne admin */
    ordre       INTEGER DEFAULT 0,
    actif       BOOLEAN DEFAULT TRUE,
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_runes_actif ON public.runes(actif);

/* === TABLE : FM_SESSIONS === */
CREATE TABLE IF NOT EXISTS public.fm_sessions (
    id                    SERIAL PRIMARY KEY,
    user_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    titre                 TEXT NOT NULL,            /* item travaille, ex: "Coiffe du Comte" */
    statut                TEXT NOT NULL DEFAULT 'en_cours' CHECK (statut IN ('en_cours', 'terminee', 'abandonnee')),
    screenshot_avant_url  TEXT DEFAULT NULL,
    screenshot_apres_url  TEXT DEFAULT NULL,
    cout_total_kamas      BIGINT DEFAULT NULL,      /* fige a la cloture            */
    nb_runes_consommees   INTEGER DEFAULT NULL,     /* fige a la cloture            */
    note                  TEXT DEFAULT NULL,
    started_at            TIMESTAMPTZ DEFAULT NOW(),
    ended_at              TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_fm_sessions_user    ON public.fm_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_fm_sessions_statut  ON public.fm_sessions(statut);
CREATE INDEX IF NOT EXISTS idx_fm_sessions_started ON public.fm_sessions(started_at DESC);

/* === TABLE : FM_SESSION_RUNES === */
/* Une ligne par rune presente dans la session.                    */
/* qty_consommee et cout_kamas sont figes a la cloture :           */
/* qty_consommee = qty_avant + qty_achetee - qty_apres             */
CREATE TABLE IF NOT EXISTS public.fm_session_runes (
    id              SERIAL PRIMARY KEY,
    session_id      INTEGER NOT NULL REFERENCES public.fm_sessions(id) ON DELETE CASCADE,
    rune_id         INTEGER NOT NULL REFERENCES public.runes(id),
    qty_avant       INTEGER NOT NULL DEFAULT 0 CHECK (qty_avant >= 0),
    qty_achetee     INTEGER NOT NULL DEFAULT 0 CHECK (qty_achetee >= 0),
    qty_apres       INTEGER DEFAULT NULL CHECK (qty_apres IS NULL OR qty_apres >= 0),
    qty_consommee   INTEGER DEFAULT NULL,     /* fige a la cloture */
    cout_kamas      BIGINT DEFAULT NULL,      /* fige a la cloture (qty_consommee x prix du moment) */
    UNIQUE(session_id, rune_id)
);

CREATE INDEX IF NOT EXISTS idx_fm_session_runes_session ON public.fm_session_runes(session_id);

/* === TABLE : FM_SESSION_ACHATS === */
/* Achats de runes en cours de session (collees depuis le chat).   */
CREATE TABLE IF NOT EXISTS public.fm_session_achats (
    id              SERIAL PRIMARY KEY,
    session_id      INTEGER NOT NULL REFERENCES public.fm_sessions(id) ON DELETE CASCADE,
    rune_id         INTEGER REFERENCES public.runes(id),  /* NULL si non reconnu */
    qty             INTEGER NOT NULL DEFAULT 1 CHECK (qty > 0),
    prix_total      BIGINT NOT NULL DEFAULT 0 CHECK (prix_total >= 0),
    message_brut    TEXT DEFAULT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fm_session_achats_session ON public.fm_session_achats(session_id);

/* === VUE : stats FM par user === */
CREATE OR REPLACE VIEW public.v_fm_par_user AS
SELECT
    s.user_id,
    p.username,
    COUNT(*) FILTER (WHERE s.statut = 'terminee')          AS nb_sessions,
    COALESCE(SUM(s.cout_total_kamas) FILTER (WHERE s.statut = 'terminee'), 0) AS total_kamas,
    COALESCE(SUM(s.nb_runes_consommees) FILTER (WHERE s.statut = 'terminee'), 0) AS total_runes,
    MAX(s.ended_at)                                         AS derniere_session
FROM public.fm_sessions s
JOIN public.profiles p ON p.id = s.user_id
GROUP BY s.user_id, p.username;

/* === RLS === */
ALTER TABLE public.runes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fm_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fm_session_runes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fm_session_achats  ENABLE ROW LEVEL SECURITY;

/* Runes : lecture membres valides, ecriture admin */
DROP POLICY IF EXISTS "runes_select" ON public.runes;
CREATE POLICY "runes_select" ON public.runes
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_validated = true)
    );

DROP POLICY IF EXISTS "runes_admin_insert" ON public.runes;
CREATE POLICY "runes_admin_insert" ON public.runes
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

DROP POLICY IF EXISTS "runes_admin_update" ON public.runes;
CREATE POLICY "runes_admin_update" ON public.runes
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

DROP POLICY IF EXISTS "runes_admin_delete" ON public.runes;
CREATE POLICY "runes_admin_delete" ON public.runes
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

/* FM sessions : chacun gere les siennes, lecture pour tous les valides */
DROP POLICY IF EXISTS "fm_sessions_select" ON public.fm_sessions;
CREATE POLICY "fm_sessions_select" ON public.fm_sessions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_validated = true)
    );

DROP POLICY IF EXISTS "fm_sessions_insert_self" ON public.fm_sessions;
CREATE POLICY "fm_sessions_insert_self" ON public.fm_sessions
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_validated = true)
    );

DROP POLICY IF EXISTS "fm_sessions_update_self_or_admin" ON public.fm_sessions;
CREATE POLICY "fm_sessions_update_self_or_admin" ON public.fm_sessions
    FOR UPDATE USING (
        auth.uid() = user_id
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

DROP POLICY IF EXISTS "fm_sessions_delete_self_or_admin" ON public.fm_sessions;
CREATE POLICY "fm_sessions_delete_self_or_admin" ON public.fm_sessions
    FOR DELETE USING (
        auth.uid() = user_id
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

/* FM session runes / achats : suivent la session parente */
DROP POLICY IF EXISTS "fm_session_runes_select" ON public.fm_session_runes;
CREATE POLICY "fm_session_runes_select" ON public.fm_session_runes
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_validated = true)
    );

DROP POLICY IF EXISTS "fm_session_runes_all_owner" ON public.fm_session_runes;
CREATE POLICY "fm_session_runes_all_owner" ON public.fm_session_runes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.fm_sessions s
            WHERE s.id = session_id
              AND (s.user_id = auth.uid()
                   OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
        )
    );

DROP POLICY IF EXISTS "fm_session_achats_select" ON public.fm_session_achats;
CREATE POLICY "fm_session_achats_select" ON public.fm_session_achats
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_validated = true)
    );

DROP POLICY IF EXISTS "fm_session_achats_all_owner" ON public.fm_session_achats;
CREATE POLICY "fm_session_achats_all_owner" ON public.fm_session_achats
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.fm_sessions s
            WHERE s.id = session_id
              AND (s.user_id = auth.uid()
                   OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
        )
    );

/* ============================================ */
/* SEED RUNES (poids standards Dofus)           */
/* Prix kamas a 0 : a renseigner en admin.      */
/* ============================================ */
INSERT INTO public.runes (nom, categorie, tier, bonus, poids, ordre) VALUES

    /* --- Stats elementaires (1/pt) --- */
    ('Rune Fo',        'Force',        'basique',  1,   1,   10),
    ('Rune Pa Fo',     'Force',        'pa',       3,   3,   11),
    ('Rune Ra Fo',     'Force',        'ra',      10,  10,   12),
    ('Rune Ine',       'Intelligence', 'basique',  1,   1,   20),
    ('Rune Pa Ine',    'Intelligence', 'pa',       3,   3,   21),
    ('Rune Ra Ine',    'Intelligence', 'ra',      10,  10,   22),
    ('Rune Cha',       'Chance',       'basique',  1,   1,   30),
    ('Rune Pa Cha',    'Chance',       'pa',       3,   3,   31),
    ('Rune Ra Cha',    'Chance',       'ra',      10,  10,   32),
    ('Rune Age',       'Agilite',      'basique',  1,   1,   40),
    ('Rune Pa Age',    'Agilite',      'pa',       3,   3,   41),
    ('Rune Ra Age',    'Agilite',      'ra',      10,  10,   42),

    /* --- Vitalite (0.2/pt) --- */
    ('Rune Vi',        'Vitalite',     'basique',  5,   1,   50),
    ('Rune Pa Vi',     'Vitalite',     'pa',      15,   3,   51),
    ('Rune Ra Vi',     'Vitalite',     'ra',      50,  10,   52),

    /* --- Sagesse (3/pt) --- */
    ('Rune Sa',        'Sagesse',      'basique',  1,   3,   60),
    ('Rune Pa Sa',     'Sagesse',      'pa',       3,   9,   61),
    ('Rune Ra Sa',     'Sagesse',      'ra',      10,  30,   62),

    /* --- Puissance (2/pt) --- */
    ('Rune Pui',       'Puissance',    'basique',  1,   2,   70),
    ('Rune Pa Pui',    'Puissance',    'pa',       3,   6,   71),
    ('Rune Ra Pui',    'Puissance',    'ra',      10,  20,   72),

    /* --- Initiative (0.1/pt) --- */
    ('Rune Ini',       'Initiative',   'basique', 10,   1,   80),
    ('Rune Pa Ini',    'Initiative',   'pa',      30,   3,   81),
    ('Rune Ra Ini',    'Initiative',   'ra',     100,  10,   82),

    /* --- Pods (0.25/pt) --- */
    ('Rune Pod',       'Pods',         'basique', 10, 2.5,   90),
    ('Rune Pa Pod',    'Pods',         'pa',      30, 7.5,   91),
    ('Rune Ra Pod',    'Pods',         'ra',     100,  25,   92),

    /* --- Prospection (3/pt) --- */
    ('Rune Prospe',    'Prospection',  'basique',  1,   3,  100),
    ('Rune Pa Prospe', 'Prospection',  'pa',       3,   9,  101),

    /* --- Dommages --- */
    ('Rune Do',        'Dommages',          'basique', 1, 20, 110),
    ('Rune Do Feu',    'Dommages Feu',      'basique', 1,  5, 111),
    ('Rune Do Eau',    'Dommages Eau',      'basique', 1,  5, 112),
    ('Rune Do Air',    'Dommages Air',      'basique', 1,  5, 113),
    ('Rune Do Terre',  'Dommages Terre',    'basique', 1,  5, 114),
    ('Rune Do Neutre', 'Dommages Neutre',   'basique', 1,  5, 115),
    ('Rune Do Pou',    'Dommages Poussee',  'basique', 1,  5, 116),
    ('Rune Do Cri',    'Dommages Critiques','basique', 1,  5, 117),
    ('Rune Do Ren',    'Renvoi de dommages','basique', 1, 10, 118),
    ('Rune Do Pi',     'Dommages Pieges',   'basique', 1,  5, 119),
    ('Rune Pi Pui',    'Puissance Pieges',  'basique', 1,  2, 120),

    /* --- Soins / Critique --- */
    ('Rune So',        'Soins',        'basique',  1,  10,  130),
    ('Rune Cri',       'Critique',     'basique',  1,  10,  131),

    /* --- Retraits / Esquives (7/pt) --- */
    ('Rune Ret PA',    'Retrait PA',   'basique',  1,   7,  140),
    ('Rune Ret PM',    'Retrait PM',   'basique',  1,   7,  141),
    ('Rune Esq PA',    'Esquive PA',   'basique',  1,   7,  142),
    ('Rune Esq PM',    'Esquive PM',   'basique',  1,   7,  143),

    /* --- Tacle / Fuite (4/pt) --- */
    ('Rune Tac',       'Tacle',        'basique',  1,   4,  150),
    ('Rune Fui',       'Fuite',        'basique',  1,   4,  151),

    /* --- Resistances fixes (2/pt) --- */
    ('Rune Re Feu',    'Res. Feu',     'basique',  1,   2,  160),
    ('Rune Re Eau',    'Res. Eau',     'basique',  1,   2,  161),
    ('Rune Re Air',    'Res. Air',     'basique',  1,   2,  162),
    ('Rune Re Terre',  'Res. Terre',   'basique',  1,   2,  163),
    ('Rune Re Neutre', 'Res. Neutre',  'basique',  1,   2,  164),
    ('Rune Re Pou',    'Res. Poussee', 'basique',  1,   2,  165),
    ('Rune Re Cri',    'Res. Critiques','basique', 1,   2,  166),

    /* --- Resistances % (6/pt) --- */
    ('Rune Re Per Feu',    'Res. % Feu',    'basique', 1, 6, 170),
    ('Rune Re Per Eau',    'Res. % Eau',    'basique', 1, 6, 171),
    ('Rune Re Per Air',    'Res. % Air',    'basique', 1, 6, 172),
    ('Rune Re Per Terre',  'Res. % Terre',  'basique', 1, 6, 173),
    ('Rune Re Per Neutre', 'Res. % Neutre', 'basique', 1, 6, 174),

    /* --- Exotiques --- */
    ('Rune Ga PA',     'PA',           'basique',  1, 100,  180),
    ('Rune Ga PME',    'PM',           'basique',  1,  90,  181),
    ('Rune Ga PO',     'Portee',       'basique',  1,  51,  182),
    ('Rune Ga Cre',    'Invocation',   'basique',  1,  30,  183),

    /* --- Chasse --- */
    ('Rune Cha Arme',  'Dommages Chasse', 'basique', 1, 5, 190)

ON CONFLICT (nom) DO NOTHING;
