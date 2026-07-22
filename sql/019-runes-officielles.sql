/* ============================================ */
/* Catalogue officiel des runes (HDV Dofus 3)   */
/* Remplace le seed approximatif du 018.        */
/*                                              */
/* Source noms + prix moyens : screens HDV      */
/* du 11/06/2026 fournis par Rorschach.         */
/* Poids (pui) : valeurs communautaires,        */
/* ajustables dans l'onglet Runes & prix.       */
/*                                              */
/* ⚠ Ce script VIDE et re-seed la table runes.  */
/* A ne PAS re-runner apres avoir cree des      */
/* sessions FM (FK fm_session_runes).           */
/* ============================================ */

DELETE FROM public.runes;

INSERT INTO public.runes (nom, categorie, tier, bonus, poids, prix_kamas, ordre) VALUES

    /* --- Force (1/pt) --- */
    ('Rune Fo',          'Force',         'basique',   1,    1,    51,   10),
    ('Rune Pa Fo',       'Force',         'pa',        3,    3,   208,   11),
    ('Rune Ra Fo',       'Force',         'ra',       10,   10,   560,   12),

    /* --- Intelligence --- */
    ('Rune Ine',         'Intelligence',  'basique',   1,    1,    45,   20),
    ('Rune Pa Ine',      'Intelligence',  'pa',        3,    3,   173,   21),
    ('Rune Ra Ine',      'Intelligence',  'ra',       10,   10,   491,   22),

    /* --- Chance --- */
    ('Rune Cha',         'Chance',        'basique',   1,    1,    82,   30),
    ('Rune Pa Cha',      'Chance',        'pa',        3,    3,   298,   31),
    ('Rune Ra Cha',      'Chance',        'ra',       10,   10,   970,   32),

    /* --- Agilite --- */
    ('Rune Age',         'Agilite',       'basique',   1,    1,    77,   40),
    ('Rune Pa Age',      'Agilite',       'pa',        3,    3,   291,   41),
    ('Rune Ra Age',      'Agilite',       'ra',       10,   10,   828,   42),

    /* --- Vitalite (0.2/pt) --- */
    ('Rune Vi',          'Vitalite',      'basique',   5,    1,   156,   50),
    ('Rune Pa Vi',       'Vitalite',      'pa',       15,    3,   518,   51),
    ('Rune Ra Vi',       'Vitalite',      'ra',       50,   10,  1592,   52),

    /* --- Sagesse (3/pt) --- */
    ('Rune Sa',          'Sagesse',       'basique',   1,    3,   168,   60),
    ('Rune Pa Sa',       'Sagesse',       'pa',        3,    9,   585,   61),
    ('Rune Ra Sa',       'Sagesse',       'ra',       10,   30,  1835,   62),

    /* --- Puissance (2/pt) --- */
    ('Rune Pui',         'Puissance',     'basique',   1,    2,   153,   70),
    ('Rune Pa Pui',      'Puissance',     'pa',        3,    6,   534,   71),
    ('Rune Ra Pui',      'Puissance',     'ra',       10,   20,  1764,   72),

    /* --- Initiative (0.1/pt) --- */
    ('Rune Ini',         'Initiative',    'basique',  10,    1,    50,   80),
    ('Rune Pa Ini',      'Initiative',    'pa',       30,    3,   222,   81),
    ('Rune Ra Ini',      'Initiative',    'ra',      100,   10,   620,   82),

    /* --- Pods (0.25/pt) --- */
    ('Rune Pod',         'Pods',          'basique',  10,  2.5,   318,   90),
    ('Rune Pa Pod',      'Pods',          'pa',       30,  7.5,   966,   91),
    ('Rune Ra Pod',      'Pods',          'ra',      100,   25,  4064,   92),

    /* --- Prospection (3/pt) --- */
    ('Rune Prospe',      'Prospection',   'basique',   1,    3,   293,  100),
    ('Rune Pa Prospe',   'Prospection',   'pa',        3,    9,   950,  101),

    /* --- Dommages (stat globale, 20/pt) --- */
    ('Rune Do',          'Dommages',      'basique',   1,   20,  1067,  110),

    /* --- Dommages elementaires (5/pt) --- */
    ('Rune Do Feu',      'Dommages Feu',    'basique', 1,    5,   877,  115),
    ('Rune Pa Do Feu',   'Dommages Feu',    'pa',      3,   15,  2621,  116),
    ('Rune Do Eau',      'Dommages Eau',    'basique', 1,    5,   947,  117),
    ('Rune Pa Do Eau',   'Dommages Eau',    'pa',      3,   15,  3182,  118),
    ('Rune Do Air',      'Dommages Air',    'basique', 1,    5,  1134,  119),
    ('Rune Pa Do Air',   'Dommages Air',    'pa',      3,   15,  3360,  120),
    ('Rune Do Terre',    'Dommages Terre',  'basique', 1,    5,   908,  121),
    ('Rune Pa Do Terre', 'Dommages Terre',  'pa',      3,   15,  2806,  122),
    ('Rune Do Neutre',   'Dommages Neutre', 'basique', 1,    5,   801,  123),
    ('Rune Pa Do Neutre','Dommages Neutre', 'pa',      3,   15,  2492,  124),

    /* --- Dommages speciaux --- */
    ('Rune Do Pou',      'Dommages Poussee',   'basique', 1,  5,   417,  130),
    ('Rune Pa Do Pou',   'Dommages Poussee',   'pa',      3, 15,  1490,  131),
    ('Rune Ra Do Pou',   'Dommages Poussee',   'ra',     10, 50,  3976,  132),
    ('Rune Do Cri',      'Dommages Critiques', 'basique', 1,  5,  1249,  133),
    ('Rune Pa Do Cri',   'Dommages Critiques', 'pa',      3, 15,  3749,  134),
    ('Rune Do Ren',      'Renvoi de dommages', 'basique', 1, 10,  1162,  135),
    ('Rune Pa Do Ren',   'Renvoi de dommages', 'pa',      3, 30,  3049,  136),
    ('Rune Do Pi',       'Dommages Pieges',    'basique', 1,  5,   507,  137),
    ('Rune Pa Do Pi',    'Dommages Pieges',    'pa',      3, 15,  1864,  138),

    /* --- Puissance pieges (2/pt) --- */
    ('Rune Per Pi',      'Puissance Pieges', 'basique',  1,  2,   118,  140),
    ('Rune Pa Per Pi',   'Puissance Pieges', 'pa',       3,  6,   964,  141),
    ('Rune Ra Per Pi',   'Puissance Pieges', 'ra',      10, 20,  4712,  142),

    /* --- % Dommages (15/pt) --- */
    ('Rune Do Per Ar',   '% Dommages d''armes',   'basique', 1, 15,  1621,  150),
    ('Rune Do Per Di',   '% Dommages distance',   'basique', 1, 15, 19869,  151),
    ('Rune Do Per Mé',   '% Dommages melee',      'basique', 1, 15, 16991,  152),
    ('Rune Do Per So',   '% Dommages aux sorts',  'basique', 1, 15, 22526,  153),

    /* --- Soins / Critique (10/pt) --- */
    ('Rune So',          'Soins',         'basique',   1,   10,   522,  160),
    ('Rune Pa So',       'Soins',         'pa',        3,   30,  1845,  161),
    ('Rune Cri',         'Critique',      'basique',   1,   10,  2047,  162),

    /* --- Retraits (7/pt) --- */
    ('Rune Ret Pa',      'Retrait PA',    'basique',   1,    7,   480,  170),
    ('Rune Pa Ret Pa',   'Retrait PA',    'pa',        3,   21,   948,  171),
    ('Rune Ret Pme',     'Retrait PM',    'basique',   1,    7,  1340,  172),
    ('Rune Pa Ret Pme',  'Retrait PM',    'pa',        3,   21,  4211,  173),

    /* --- Esquives (7/pt) --- */
    ('Rune Ré Pa',       'Esquive PA',    'basique',   1,    7,   702,  180),
    ('Rune Pa Ré Pa',    'Esquive PA',    'pa',        3,   21,  2040,  181),
    ('Rune Ré Pme',      'Esquive PM',    'basique',   1,    7,   746,  182),
    ('Rune Pa Ré Pme',   'Esquive PM',    'pa',        3,   21,  1679,  183),

    /* --- Tacle / Fuite (4/pt) --- */
    ('Rune Tac',         'Tacle',         'basique',   1,    4,   816,  190),
    ('Rune Pa Tac',      'Tacle',         'pa',        3,   12,  2689,  191),
    ('Rune Fui',         'Fuite',         'basique',   1,    4,   416,  192),
    ('Rune Pa Fui',      'Fuite',         'pa',        3,   12,  1366,  193),

    /* --- Resistances fixes (2/pt) --- */
    ('Rune Ré Feu',      'Res. Feu',      'basique',   1,    2,   110,  200),
    ('Rune Pa Ré Feu',   'Res. Feu',      'pa',        3,    6,   518,  201),
    ('Rune Ra Ré Feu',   'Res. Feu',      'ra',       10,   20,  1090,  202),
    ('Rune Ré Eau',      'Res. Eau',      'basique',   1,    2,    92,  203),
    ('Rune Pa Ré Eau',   'Res. Eau',      'pa',        3,    6,   433,  204),
    ('Rune Ra Ré Eau',   'Res. Eau',      'ra',       10,   20,  1145,  205),
    ('Rune Ré Air',      'Res. Air',      'basique',   1,    2,   256,  206),
    ('Rune Pa Ré Air',   'Res. Air',      'pa',        3,    6,   790,  207),
    ('Rune Ra Ré Air',   'Res. Air',      'ra',       10,   20,  1840,  208),
    ('Rune Ré Terre',    'Res. Terre',    'basique',   1,    2,   296,  209),
    ('Rune Pa Ré Terre', 'Res. Terre',    'pa',        3,    6,   858,  210),
    ('Rune Ra Ré Terre', 'Res. Terre',    'ra',       10,   20,  2214,  211),
    ('Rune Ré Neutre',   'Res. Neutre',   'basique',   1,    2,    66,  212),
    ('Rune Pa Ré Neutre','Res. Neutre',   'pa',        3,    6,   334,  213),
    ('Rune Ra Ré Neutre','Res. Neutre',   'ra',       10,   20,  1014,  214),
    ('Rune Ré Pou',      'Res. Poussee',  'basique',   1,    2,   176,  215),
    ('Rune Pa Ré Pou',   'Res. Poussee',  'pa',        3,    6,   602,  216),
    ('Rune Ra Ré Pou',   'Res. Poussee',  'ra',       10,   20,  2529,  217),
    ('Rune Ré Cri',      'Res. Critiques','basique',   1,    2,   182,  218),
    ('Rune Pa Ré Cri',   'Res. Critiques','pa',        3,    6,   599,  219),
    ('Rune Ra Ré Cri',   'Res. Critiques','ra',       10,   20,  1714,  220),

    /* --- Resistances % elementaires (6/pt) --- */
    ('Rune Ré Per Feu',    '% Res. Feu',    'basique', 1,    6,  1074,  230),
    ('Rune Ré Per Eau',    '% Res. Eau',    'basique', 1,    6,  1272,  231),
    ('Rune Ré Per Air',    '% Res. Air',    'basique', 1,    6,  1036,  232),
    ('Rune Ré Per Terre',  '% Res. Terre',  'basique', 1,    6,  1294,  233),
    ('Rune Ré Per Neutre', '% Res. Neutre', 'basique', 1,    6,  1199,  234),

    /* --- Resistances % melee / distance (15/pt) --- */
    ('Rune Ré Per Mé',   '% Res. melee',    'basique',  1,   15,  3401,  240),
    ('Rune Ré Per Di',   '% Res. distance', 'basique',  1,   15,  2259,  241),

    /* --- Exotiques --- */
    ('Rune Ga Pa',       'PA',            'basique',   1,  100, 22631,  250),
    ('Rune Ga Pme',      'PM',            'basique',   1,   90, 18828,  251),
    ('Rune Po',          'Portee',        'basique',   1,   51,  7014,  252),
    ('Rune Invo',        'Invocation',    'basique',   1,   30,  4379,  253),

    /* --- Speciales --- */
    ('Rune de chasse',   'Dommages Chasse', 'basique', 1,    5,  8597,  260),
    ('Rune de Signature','Speciale',        'basique', 1,    0,  1889,  261);
