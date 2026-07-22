/* ============================================ */
/* Seed des zones Dofus (territoires + donjons) */
/* Source : panneau "Anomalies" en jeu          */
/* ============================================ */
/*                                              */
/* Ce script ajoute les zones Dofus officielles */
/* sans ecraser ce qui existe (ON CONFLICT DO   */
/* NOTHING sur le nom). A re-runner apres mises */
/* a jour si on ajoute des screens.             */
/*                                              */
/* Cout pose = tranche de 20 superieure du      */
/* niveau (formule potion percepteur Dofus).    */
/* ============================================ */

/* ============================================ */
/* TERRITOIRES (type = 'zone')                  */
/* ============================================ */

INSERT INTO public.zones_perco (nom, type, niveau_zone, cout_pepites_pose, ordre) VALUES

    /* --- Lvl 10 --- */
    ('Rives iridescentes',                'zone',  10,  20, 1010),

    /* --- Lvl 15 --- */
    ('Cote d''Asse',                      'zone',  15,  20, 1015),
    ('Riviere Kawaii',                    'zone',  15,  20, 1015),
    ('Port de Madrestam',                 'zone',  15,  20, 1015),
    ('Campagne d''Amakna',                'zone',  15,  20, 1015),

    /* --- Lvl 20 --- */
    ('Foret d''Amakna',                   'zone',  20,  20, 1020),
    ('Clairiere de Brouce Boulgoure',     'zone',  20,  20, 1020),
    ('Coin des Boos',                     'zone',  20,  20, 1020),
    ('Coin des Bouftous',                 'zone',  20,  20, 1020),
    ('Milifutaie',                        'zone',  20,  20, 1020),

    /* --- Lvl 25 --- */
    ('Ile des naufrages',                 'zone',  25,  40, 1025),

    /* --- Lvl 30 --- */
    ('Champ des Ingalsse',                'zone',  30,  40, 1030),
    ('Cryptes du cimetiere',              'zone',  30,  40, 1030),
    ('Campement des Gobelins',            'zone',  30,  40, 1030),
    ('Cimetiere',                         'zone',  30,  40, 1030),
    ('Plaine des Scarafeuilles',          'zone',  30,  40, 1030),
    ('Bord de la foret malefique',        'zone',  30,  40, 1030),

    /* --- Lvl 40 --- */
    ('Cimetiere des Tortures',            'zone',  40,  40, 1040),
    ('Plage de la Tortue',                'zone',  40,  40, 1040),
    ('Plage de Corail',                   'zone',  40,  40, 1040),
    ('Passage vers Brakmar',              'zone',  40,  40, 1040),
    ('Territoire des Bandits',            'zone',  40,  40, 1040),
    ('Oree de la foret des Abraknydes',   'zone',  40,  40, 1040),
    ('Futaie enneigee',                   'zone',  40,  40, 1040),
    ('Montagne des Craqueleurs',          'zone',  40,  40, 1040),
    ('Mine des Dopeuls',                  'zone',  40,  40, 1040),
    ('Village des Bworks',                'zone',  40,  40, 1040),
    ('Marecages nauseabonds',             'zone',  40,  40, 1040),
    ('Rivage sufokien',                   'zone',  40,  40, 1040),
    ('Souterrains d''Albuera',            'zone',  40,  40, 1040),
    ('Ile de la Cawotte',                 'zone',  40,  40, 1040),
    ('Village des Dopeuls',               'zone',  40,  40, 1040),
    ('Cimetiere des Heros',               'zone',  40,  40, 1040),
    ('Plaine des Porkass',                'zone',  40,  40, 1040),
    ('Baie de Cania',                     'zone',  40,  40, 1040),
    ('Bordure de Brakmar',                'zone',  40,  40, 1040),
    ('Campement des Bworks',              'zone',  40,  40, 1040),

    /* --- Lvl 50 --- */
    ('Massif de Cania',                   'zone',  50,  60, 1050),
    ('Foret des Masques',                 'zone',  50,  60, 1050),
    ('Peninsule des gelees',              'zone',  50,  60, 1050),
    ('Ilot de la Couronne',               'zone',  50,  60, 1050),
    ('Cloaque d''Amakna',                 'zone',  50,  60, 1050),
    ('Ilot de Waldo',                     'zone',  50,  60, 1050),
    ('Champs de Cania',                   'zone',  50,  60, 1050),
    ('Montagne basse des Craqueleurs',    'zone',  50,  60, 1050),
    ('Ilot des Tombeaux',                 'zone',  50,  60, 1050),
    ('Lac de Cania',                      'zone',  50,  60, 1050),

    /* --- Lvl 60 --- */
    ('Desolation de Sidimote',            'zone',  60,  60, 1060),
    ('Presqu''ile des Dragoeufs',         'zone',  60,  60, 1060),
    ('Territoire des dragodindes sauvages','zone', 60,  60, 1060),
    ('Marecages sans fond',               'zone',  60,  60, 1060),
    ('Routes Rocailleuses',               'zone',  60,  60, 1060),
    ('Plaines Rocheuses',                 'zone',  60,  60, 1060),
    ('Bassin des Muldos',                 'zone',  60,  60, 1060),
    ('Arche d''Otomai',                   'zone',  60,  60, 1060),
    ('Marecages d''Amakna',               'zone',  60,  60, 1060),
    ('Haras de Brakmar',                  'zone',  60,  60, 1060),

    /* --- Lvl 70 --- */
    ('Foret de Kaliptus',                 'zone',  70,  80, 1070),
    ('Dunes des ossements',               'zone',  70,  80, 1070),

    /* --- Lvl 80 --- */
    ('Foret Sombre',                      'zone',  80,  80, 1080),
    ('Lacs enchantes',                    'zone',  80,  80, 1080),
    ('Pics de Cania',                     'zone',  80,  80, 1080),
    ('Bois des Arak-hai',                 'zone',  80,  80, 1080),
    ('Port de givre',                     'zone',  80,  80, 1080),
    ('La Bourgade',                       'zone',  80,  80, 1080),
    ('Route des Roulottes',               'zone',  80,  80, 1080),
    ('Canyon sauvage',                    'zone',  80,  80, 1080),
    ('Chemin du Crane',                   'zone',  80,  80, 1080),

    /* --- Lvl 90 --- */
    ('Souterrains des Dragoeufs',         'zone',  90, 100, 1090),
    ('Village des Dragoeufs',             'zone',  90, 100, 1090),
    ('Jungle Interdite',                  'zone',  90, 100, 1090),
    ('Territoire des Porcos',             'zone',  90, 100, 1090),
    ('Creuset des Fortunes',              'zone',  90, 100, 1090),
    ('Ile de Kartonpath',                 'zone',  90, 100, 1090),
    ('Labyrinthe du Dragon Cochon',       'zone',  90, 100, 1090),
    ('Hauts des Hurlements',              'zone',  90, 100, 1090),

    /* --- Lvl 100 --- */
    ('Entrailles de Brakmar',             'zone', 100, 100, 1100),
    ('Pierres de l''elevation',           'zone', 100, 100, 1100),
    ('Canaux mephitiques',                'zone', 100, 100, 1100),
    ('Plaines herbeuses',                 'zone', 100, 100, 1100),
    ('Tourbiere sans fond',               'zone', 100, 100, 1100),
    ('Penates du Corbac',                 'zone', 100, 100, 1100),
    ('Plantala',                          'zone', 100, 100, 1100),

    /* --- Lvl 110 --- */
    ('Labyrinthe du Minotoror',           'zone', 110, 120, 1110),
    ('Laboratoires abandonnes',           'zone', 110, 120, 1110),
    ('Champs de glace',                   'zone', 110, 120, 1110),
    ('Sanctuaire des Dragoeufs',          'zone', 110, 120, 1110),
    ('Bibliotheque du Maitre Corbac',     'zone', 110, 120, 1110),
    ('Ile du Minotoror',                  'zone', 110, 120, 1110),
    ('Bois de Litneg',                    'zone', 110, 120, 1110),
    ('Cimetiere primitif',                'zone', 110, 120, 1110),
    ('Galeries abandonnees',              'zone', 110, 120, 1110),
    ('Tourbiere nauseabonde',             'zone', 110, 120, 1110),
    ('Vallee de la Morh''Kitu',           'zone', 110, 120, 1110),
    ('Chemins d''hier',                   'zone', 110, 120, 1110),

    /* --- Lvl 120 --- */
    ('Village de la Canopee',             'zone', 120, 120, 1120),
    ('Territoire Cacterre',               'zone', 120, 120, 1120),
    ('Village des Zoths',                 'zone', 120, 120, 1120),
    ('Ruelles des Eaux-Suaires',          'zone', 120, 120, 1120),
    ('Terrdala',                          'zone', 120, 120, 1120),
    ('Akwadala',                          'zone', 120, 120, 1120),
    ('Cirque de Cania',                   'zone', 120, 120, 1120),

    /* --- Lvl 130 --- */
    ('Aerdala',                           'zone', 130, 140, 1130),
    ('Foret des pins perdus',             'zone', 130, 140, 1130),
    ('Feudala',                           'zone', 130, 140, 1130),
    ('Jungle obscure',                    'zone', 130, 140, 1130),
    ('Lac gele',                          'zone', 130, 140, 1130),

    /* --- Lvl 140 --- */
    ('Landes de Cania',                   'zone', 140, 140, 1140),
    ('Berceau d''Alma',                   'zone', 140, 140, 1140),
    ('Carriere Aurifere',                 'zone', 140, 140, 1140),
    ('Dedale du Dark Vlad',               'zone', 140, 140, 1140),

    /* --- Lvl 150 --- */
    ('Larmes d''Ouronigride',             'zone', 150, 160, 1150),
    ('Tronc de l''arbre Hakam',           'zone', 150, 160, 1150),
    ('Cimetiere de Grobe',                'zone', 150, 160, 1150),
    ('Village des Kanigs',                'zone', 150, 160, 1150),
    ('Dents de Pierre',                   'zone', 150, 160, 1150),
    ('Lande Poilue',                      'zone', 150, 160, 1150),
    ('Feuillage de l''arbre Hakam',       'zone', 150, 160, 1150),

    /* --- Lvl 160 --- */
    ('Cite Oubliee',                      'zone', 160, 160, 1160),
    ('Cavernes des Givrefoux',            'zone', 160, 160, 1160),
    ('Village enseveli',                  'zone', 160, 160, 1160),
    ('Jour present',                      'zone', 160, 160, 1160),
    ('Mont des Tombeaux',                 'zone', 160, 160, 1160),
    ('Gorge des Vents Hurlants',          'zone', 160, 160, 1160),
    ('Crevasse Perge',                    'zone', 160, 160, 1160),
    ('Toorbz Boorzzbz',                   'zone', 160, 160, 1160),

    /* --- Lvl 170 --- */
    ('Gisgoul',                           'zone', 170, 180, 1170),
    ('Catacombes',                        'zone', 170, 180, 1170),
    ('Caverne des Fungus',                'zone', 170, 180, 1170),
    ('Domaine des Fungus',                'zone', 170, 180, 1170),
    ('Foret petrifiee',                   'zone', 170, 180, 1170),

    /* --- Lvl 180 --- */
    ('Nimotopia',                         'zone', 180, 180, 1180),
    ('Crocs de verre',                    'zone', 180, 180, 1180),
    ('Dimension Obscure',                 'zone', 180, 180, 1180),
    ('Plaine de Sakai',                   'zone', 180, 180, 1180),
    ('Foret enneigee',                    'zone', 180, 180, 1180),
    ('Mont Torrideau',                    'zone', 180, 180, 1180),
    ('Ruche des Gloursons',               'zone', 180, 180, 1180),

    /* --- Lvl 190 --- */
    ('Tannerie Ecarlate',                 'zone', 190, 200, 1190),
    ('Remparts a vent',                   'zone', 190, 200, 1190),
    ('Galeries d''Ereboria',              'zone', 190, 200, 1190),
    ('Jardins d''Hiver',                  'zone', 190, 200, 1190),
    ('Bastion des froides legions',       'zone', 190, 200, 1190),

    /* --- Lvl 200 --- */
    ('Trefonds des Trithons',             'zone', 200, 200, 1200),
    ('Vestiges engloutis',                'zone', 200, 200, 1200),
    ('Tour de la Clepsydre',              'zone', 200, 200, 1200),
    ('Terres Desacrees',                  'zone', 200, 200, 1200),
    ('Salles des Embruns',                'zone', 200, 200, 1200),
    ('Salles des Courants',               'zone', 200, 200, 1200),
    ('Salles des Abimes',                 'zone', 200, 200, 1200),
    ('Temple de Kerubim',                 'zone', 200, 200, 1200),
    ('Abime de R''lyugluglu',             'zone', 200, 200, 1200),
    ('Royaume d''encre',                  'zone', 200, 200, 1200),
    ('Ancienne Sufokia',                  'zone', 200, 200, 1200),
    ('Blessures de Guerre',               'zone', 200, 200, 1200),
    ('Caserne du Jour sans fin',          'zone', 200, 200, 1200),
    ('Cauchemar des Ravageurs',           'zone', 200, 200, 1200),
    ('Crocuzko',                          'zone', 200, 200, 1200),
    ('Desert de Misere',                  'zone', 200, 200, 1200),
    ('Domaine des Trithons',              'zone', 200, 200, 1200),
    ('Epaves Silencieuses',               'zone', 200, 200, 1200),
    ('Ephedrya',                          'zone', 200, 200, 1200),
    ('Faille des Trithons',               'zone', 200, 200, 1200),
    ('Fort Thune',                        'zone', 200, 200, 1200),
    ('Fosse de R''lyugluglu',             'zone', 200, 200, 1200),
    ('Galere de Servitude',               'zone', 200, 200, 1200),
    ('Royaume des Martegel',              'zone', 200, 200, 1200),
    ('Hauts Tenebreux',                   'zone', 200, 200, 1200),
    ('Lendemains incertains',             'zone', 200, 200, 1200),
    ('Marches Magmatiques',               'zone', 200, 200, 1200),
    ('Osavane',                           'zone', 200, 200, 1200),
    ('Pandamonium',                       'zone', 200, 200, 1200),
    ('Plateau de R''lyugluglu',           'zone', 200, 200, 1200),
    ('Port des Ravageurs',                'zone', 200, 200, 1200),
    ('Pyramide Maudite',                  'zone', 200, 200, 1200),
    ('Quartier des Conquerants',          'zone', 200, 200, 1200),
    ('Reserve Touffue',                   'zone', 200, 200, 1200),
    ('Retraite des Eternels',             'zone', 200, 200, 1200),
    ('Roc des Salbatroces',               'zone', 200, 200, 1200),
    ('Royaume Corrompu',                  'zone', 200, 200, 1200),
    ('Royaume de papier',                 'zone', 200, 200, 1200),
    ('Village Rhoarim',                   'zone', 200, 200, 1200),
    ('Ville submergee',                   'zone', 200, 200, 1200)

    /* Liste des territoires complete (jusqu'au lvl 200). */
    /* Pour ajouter les donjons : voir section ci-dessous. */

ON CONFLICT (nom) DO NOTHING;


/* ============================================ */
/* DONJONS (type = 'dj')                        */
/* ============================================ */
/* Source : panneau Anomalies > dropdown Donjons */
/* Ordre commence a 2000 pour separer des zones. */
/* ============================================ */

INSERT INTO public.zones_perco (nom, type, niveau_zone, cout_pepites_pose, ordre) VALUES

    /* --- Lvl 40 --- */
    ('Akademie des Gobs',                 'dj',  40,  40, 2040),
    ('Donjon des Scarafeuilles',          'dj',  40,  40, 2040),
    ('Donjon des Squelettes',             'dj',  40,  40, 2040),
    ('Donjon des Tofus',                  'dj',  40,  40, 2040),
    ('Maison Fantome',                    'dj',  40,  40, 2040),

    /* --- Lvl 50 --- */
    ('Donjon des Bworks',                 'dj',  50,  60, 2050),
    ('Donjon des Forgerons',              'dj',  50,  60, 2050),
    ('Donjon des Larves',                 'dj',  50,  60, 2050),
    ('Nid du Kwakwa',                     'dj',  50,  60, 2050),
    ('Refuge sylvestre',                  'dj',  50,  60, 2050),
    ('Grotte Hesque',                     'dj',  50,  60, 2050),

    /* --- Lvl 60 --- */
    ('Clos des Blops',                    'dj',  60,  60, 2060),
    ('Chateau du Wa Wabbit',              'dj',  60,  60, 2060),
    ('Gelaxieme dimension',               'dj',  60,  60, 2060),
    ('Village Kanniboul',                 'dj',  60,  60, 2060),

    /* --- Lvl 65 --- */
    ('Cale de l''arche d''Otomai',        'dj',  65,  80, 2065),

    /* --- Lvl 70 --- */
    ('Pitons Rocheux des Craqueleurs',    'dj',  70,  80, 2070),
    ('Laboratoire de Brumen Tinctorias',  'dj',  70,  80, 2070),
    ('Epreuve de Draegnerys',             'dj',  70,  80, 2070),

    /* --- Lvl 80 --- */
    ('Cimetiere des Mastodontes',         'dj',  80,  80, 2080),
    ('Terrier du Wa Wabbit',              'dj',  80,  80, 2080),

    /* --- Lvl 90 --- */
    ('Chapiteau des Magik Riktus',        'dj',  90, 100, 2090),
    ('Bateau du Chouque',                 'dj',  90, 100, 2090),
    ('Domaine Ancestral',                 'dj',  90, 100, 2090),
    ('Antre de la Reine Nyee',            'dj',  90, 100, 2090),

    /* --- Lvl 100 --- */
    ('Theatre de Dramak',                 'dj', 100, 100, 2100),
    ('Taniere du Meulou',                 'dj', 100, 100, 2100),
    ('Fabrique de Mallefisk',             'dj', 100, 100, 2100),
    ('Antre du Dragon Cochon',            'dj', 100, 100, 2100),
    ('Arbre de Moon',                     'dj', 100, 100, 2100),
    ('Antre du Koulosse',                 'dj', 100, 100, 2100),
    ('Caverne du Koulosse',               'dj', 100, 100, 2100),
    ('Repaire du Kharnozor',              'dj', 100, 100, 2100),

    /* --- Lvl 110 --- */
    ('Sousouriciere du Rat Noir',         'dj', 110, 120, 2110),
    ('Goulet du Rasboul',                 'dj', 110, 120, 2110),
    ('Miausolee du Pounicheur',           'dj', 110, 120, 2110),
    ('Salle de lecture du Maitre Corbac', 'dj', 110, 120, 2110),
    ('Garde-manger du Rat Blanc',         'dj', 110, 120, 2110),
    ('Bambusaie de Damadrya',             'dj', 110, 120, 2110),

    /* --- Lvl 120 --- */
    ('Repaire de Skeunk',                 'dj', 120, 120, 2120),
    ('Centre du labyrinthe du Minotoror', 'dj', 120, 120, 2120),
    ('Tofulailler Royal',                 'dj', 120, 120, 2120),
    ('Antre de Crocabulia',               'dj', 120, 120, 2120),
    ('Serre du Royalmouth',               'dj', 120, 120, 2120),
    ('Antre du Blop Multicolore Royal',   'dj', 120, 120, 2120),
    ('Megalithe de Fraktale',             'dj', 120, 120, 2120),

    /* --- Lvl 130 --- */
    ('Voliere de la Haute Truche',        'dj', 130, 140, 2130),
    ('Atelier du Tanukoui San',           'dj', 130, 140, 2130),
    ('Vallee de la Dame des eaux',        'dj', 130, 140, 2130),
    ('Caverne d''El Piko',                'dj', 130, 140, 2130),
    ('Ring du Capitaine Ekarlatte',       'dj', 130, 140, 2130),

    /* --- Lvl 140 --- */
    ('Laboratoire du Tynril',             'dj', 140, 140, 2140),
    ('Excavation du Mansot Royal',        'dj', 140, 140, 2140),
    ('Clairiere du Chene Mou',            'dj', 140, 140, 2140),
    ('Dojo du Vent',                      'dj', 140, 140, 2140),
    ('Fabrique de foux d''artifice',      'dj', 140, 140, 2140),

    /* --- Lvl 150 --- */
    ('Epave du Grolandais violent',       'dj', 150, 160, 2150),
    ('Galerie du Phossile',               'dj', 150, 160, 2150),
    ('Tertre du long sommeil',            'dj', 150, 160, 2150),
    ('Repaire de Sphincter Cell',         'dj', 150, 160, 2150),

    /* --- Lvl 160 --- */
    ('Canopee du Kimbo',                  'dj', 160, 160, 2160),
    ('Tombe du Shogun Tofugawa',          'dj', 160, 160, 2160),
    ('Grotte de Kanigroula',              'dj', 160, 160, 2160),
    ('Plateau de Ush',                    'dj', 160, 160, 2160),
    ('Hypogee de l''Obsidiantre',         'dj', 160, 160, 2160),

    /* --- Lvl 170 --- */
    ('Poste de controle du Supervizoeuf', 'dj', 170, 180, 2170),
    ('Taniere Givrefoux',                 'dj', 170, 180, 2170),
    ('Demeure des Esprits',               'dj', 170, 180, 2170),
    ('Boyau du Pere Ver',                 'dj', 170, 180, 2170),
    ('Horologium de XLII',                'dj', 170, 180, 2170),

    /* --- Lvl 180 --- */
    ('Temple du Grand Ougah',             'dj', 180, 180, 2180),
    ('Antre du Kralamoure Geant',         'dj', 180, 180, 2180),
    ('Cave du Toxoliath',                 'dj', 180, 180, 2180),
    ('Antre du Korriandre',               'dj', 180, 180, 2180),
    ('Grotte du Bworker',                 'dj', 180, 180, 2180),

    /* --- Lvl 190 --- */
    ('Pyramide d''Ombre',                 'dj', 190, 200, 2190),
    ('Bastion des Marteaux-Aigris',       'dj', 190, 200, 2190),
    ('Antichambre des Gloursons',         'dj', 190, 200, 2190),
    ('Cavernes du Kolosso',               'dj', 190, 200, 2190),
    ('Camp du Comte Razof',               'dj', 190, 200, 2190),
    ('Mine abandonnee de Sakai',          'dj', 190, 200, 2190),

    /* --- Lvl 200 --- */
    ('Tour de Solar',                     'dj', 200, 200, 2200),
    ('Chambre de Tal Kasha',              'dj', 200, 200, 2200),
    ('Transporteur de Sylargh',           'dj', 200, 200, 2200),
    ('Trone de la Cour Sombre',           'dj', 200, 200, 2200),
    ('Trone de sang',                     'dj', 200, 200, 2200),
    ('Donjon du Comte Harebourg',         'dj', 200, 200, 2200),
    ('Vaisseau du Capitaine Meno',        'dj', 200, 200, 2200),
    ('Chambre des malefices',             'dj', 200, 200, 2200),
    ('Temple de Koutoulou',               'dj', 200, 200, 2200),
    ('Ventre de la Baleine',              'dj', 200, 200, 2200),
    ('Tempete de l''Eliocalypse',         'dj', 200, 200, 2200),
    ('Tour de Bethel',                    'dj', 200, 200, 2200),
    ('Manoir des Katrepat',               'dj', 200, 200, 2200),
    ('Sentence de la Balance',            'dj', 200, 200, 2200),
    ('Souvenir d''Imagiro',               'dj', 200, 200, 2200),
    ('Laboratoire de Nileza',             'dj', 200, 200, 2200),
    ('Memoire d''Orukam',                 'dj', 200, 200, 2200),
    ('Bataille de l''Aurore Pourpre',     'dj', 200, 200, 2200),
    ('Autel de la Dechireuse',            'dj', 200, 200, 2200),
    ('Oeil de Vortex',                    'dj', 200, 200, 2200),
    ('Defi du Chaloeil',                  'dj', 200, 200, 2200),
    ('Palais du roi Nidas',               'dj', 200, 200, 2200),
    ('Fers de la Tyrannie',               'dj', 200, 200, 2200),
    ('Belvedere d''Ilyzaelle',            'dj', 200, 200, 2200),
    ('Brasserie du roi Dazak',            'dj', 200, 200, 2200),
    ('Aquadome de Merkator',              'dj', 200, 200, 2200),
    ('Breuil du Venerable',               'dj', 200, 200, 2200),
    ('Rituel de Kabahal',                 'dj', 200, 200, 2200),
    ('Salons prives de Klime',            'dj', 200, 200, 2200),
    ('Sanctuaire de Torkelonia',          'dj', 200, 200, 2200),
    ('Forgefroide de Missiz Frizz',       'dj', 200, 200, 2200),
    ('Arbre de mort',                     'dj', 200, 200, 2200),
    ('Palais de Dantinea',                'dj', 200, 200, 2200)

ON CONFLICT (nom) DO NOTHING;

/* ============================================ */
/* RÉCAP                                        */
/* ============================================ */
/* Territoires : ~184 entrees (lvl 10 -> 200)   */
/* Donjons     : ~114 entrees (lvl 40 -> 200)   */
/* Total       : ~298 entrees                   */
/*                                              */
/* Noms sans accents pour eviter les soucis     */
/* d'encoding. Modifiables en BO si besoin.     */
/* ============================================ */
