-- ============================================================
-- 036 : Catalogue dedie des zones de RESERVATION perco
-- (listes de Mathieu du 03/08 : 100 principales ordonnees + 66
-- secondaires ; distinct du catalogue recyclages zones_perco).
-- Les FK preferences/reservations basculent dessus, la fonction
-- d'attribution aussi. Pas de niveau : le "150-" du bareme
-- concerne les droits de pose, pas la zone reservee.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.zones_reservation (
    id          SERIAL PRIMARY KEY,
    nom         TEXT NOT NULL,
    sous_titre  TEXT NOT NULL DEFAULT '',
    categorie   TEXT NOT NULL DEFAULT 'secondaire' CHECK (categorie IN ('principale', 'secondaire')),
    ordre       INTEGER NOT NULL DEFAULT 0,
    actif       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(nom, sous_titre)
);

CREATE INDEX IF NOT EXISTS idx_zones_resa_cat ON public.zones_reservation(categorie, ordre);

ALTER TABLE public.zones_reservation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "zones_resa_select" ON public.zones_reservation;
CREATE POLICY "zones_resa_select" ON public.zones_reservation
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "zones_resa_admin_all" ON public.zones_reservation;
CREATE POLICY "zones_resa_admin_all" ON public.zones_reservation
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

INSERT INTO public.zones_reservation (nom, sous_titre, categorie, ordre)
SELECT v.nom, v.sous_titre, v.categorie, v.ordre
FROM (VALUES
('KORRI', 'Forêt pétrifiée', 'principale', 1),
('NIDAS', 'Enutrosor', 'principale', 2),
('MANSOT', 'Lac gelé', 'principale', 3),
('CHALOEIL', 'Temple de Kerubim', 'principale', 4),
('GROLLUM', 'Sakai', 'principale', 5),
('DANTINÉA', 'Domaine des Trithons', 'principale', 6),
('BREUIL DU VÉNÉRABLE', 'Osavora', 'principale', 7),
('TORKÉLONIA', 'Crocuzko', 'principale', 8),
('CAUCHEMAR', 'Aurore Pourpre', 'principale', 9),
('BEN le ripat', 'Berceau d''alma', 'principale', 10),
('KLIME', 'Tannerie écarlate', 'principale', 11),
('TYNRIL', 'Jungle Obscure', 'principale', 12),
('NILEZA', 'Jardin d''Hivers', 'principale', 13),
('FRAKTAL', 'Xelorium', 'principale', 14),
('VILLAGE CANOPE', 'Village de la canaopée', 'principale', 15),
('FORET DES PINS PERDU', '', 'principale', 16),
('MENO', 'Ville submergée', 'principale', 17),
('KOLOSSO', 'Croc de verre', 'principale', 18),
('KIMBO', 'Feuillage de l''arbre Hakam', 'principale', 19),
('KOUTOULOU', 'Plateau de R''lyugluglu', 'principale', 20),
('BWORKER', 'Gisgoul', 'principale', 21),
('Reine des Voleurs', 'Hautes ténébreux', 'principale', 22),
('Quatre cavalier', 'Eliocalypse', 'principale', 23),
('ZONE BWORKS', '', 'principale', 24),
('DÉCHIREUSE', 'Ozavara', 'principale', 25),
('SYLARGH', 'Rempart à vent', 'principale', 26),
('GIVREFOUX', 'Creuvasse Perge', 'principale', 27),
('POUNICHEUR', 'Pierre de l''élévation', 'principale', 28),
('EL PIKO', 'Saharach', 'principale', 29),
('MULDO', 'Bassin des muldos', 'principale', 30),
('OUGAH', 'Caverne des Fungus', 'principale', 31),
('Horologium XLII', 'Xelorium', 'principale', 32),
('VOLKORNE', 'Haras de Brakmar', 'principale', 33),
('GLOURS', 'Ruche des glourson', 'principale', 34),
('CHENE MOU', 'Foret sombre', 'principale', 35),
('TAL KASHA', 'Pyramide Maudite', 'principale', 36),
('SUPERVIZOEUF', 'Osavora', 'principale', 37),
('Belladone', 'Ephedrya', 'principale', 38),
('ILYZAEL', 'Caserne du jour sans fin', 'principale', 39),
('MANTISCROC', 'Saharach', 'principale', 40),
('MOON', 'Jungle Interdite', 'principale', 41),
('DRAMAK', 'Kartonpathe', 'principale', 42),
('Dame des eaux', 'Akwadala', 'principale', 43),
('DRAGODINDE', 'Territoire des dragodindes sauvages', 'principale', 44),
('RASBOUL', 'Plaines herbeuses', 'principale', 45),
('HELL MINA', 'Dédale du dark Vlad', 'principale', 46),
('BETHEL', 'Epave silencieuses', 'principale', 47),
('USH', 'Lande Poilue', 'principale', 48),
('SOLAR', 'Marche Magmatique', 'principale', 49),
('MINOTOR', 'Ile du Minotoror', 'principale', 50),
('CORBAC', 'Pénate du corbac', 'principale', 51),
('MERKATOR', 'Base Abyssale', 'principale', 52),
('RING EKARLATTE', 'Ruelles des eaux suaires', 'principale', 53),
('KANIGROULA', 'Dent de Pierre', 'principale', 54),
('Kralamour', 'Tourbière sans fond', 'principale', 55),
('Nid du Kwakwa (Amakna)', '', 'principale', 56),
('VILLAGE ENSEVELI', 'VILLAGE ENSEVELI', 'principale', 57),
('DAZAK', 'Royaume des Martegel', 'principale', 58),
('PER VER', 'Saharach', 'principale', 59),
('OMBRE', 'Dimension Obscure', 'principale', 60),
('Royal Mouth', 'Champ de glace', 'principale', 61),
('Tanoukoui San', 'TERRDALA', 'principale', 62),
('DEMEURE DES ESPRITS', 'Mont des tombeaux', 'principale', 63),
('Royaume de papier', 'Wukin et Wukang', 'principale', 64),
('HAUTE RUCHE', 'Cirque de Cania', 'principale', 65),
('SHOGUN', 'Cimetière de grobe', 'principale', 66),
('Fabrique de Foux d''artifice', 'Feudala', 'principale', 67),
('SKEUNK', 'Vallée de la Morkitu', 'principale', 68),
('TOXOLIATH', 'Catacombres', 'principale', 69),
('KOULOSSE', 'Canyon Sauvage', 'principale', 70),
('Royaume d''encre', 'Wukin et Wukang', 'principale', 71),
('BRUMEN', 'Désolation de sidimote', 'principale', 72),
('Grotte hesque', 'PLAGE DE CORAIL', 'principale', 73),
('Barbéril', 'Galerie d''Ereboria', 'principale', 74),
('Anerice', 'TERRE DÉSACRÉ', 'principale', 75),
('CROCABULIA', 'Sanctuaire des dragoeufs', 'principale', 76),
('Dojo du vent', 'aerdala', 'principale', 77),
('Hypogée del ''obsidiandre', 'Larme d''ouronigride', 'principale', 78),
('GELEE', 'Dimension gelée', 'principale', 79),
('Tofulailler Royal', '', 'principale', 80),
('BOIS LITNEG', '', 'principale', 81),
('MENO ZONE 3', 'Vestige englouti', 'principale', 82),
('Forgerons (Territoire des Bandits)', '', 'principale', 83),
('BLOP MULTI', 'Lac de Cania', 'principale', 84),
('KHARNOOZORE', 'Presqu''île des dragoeuf', 'principale', 85),
('Montagne basse des Craqueleurs (Amakna)', '', 'principale', 86),
('PHOSSILE', 'Enutrosor', 'principale', 87),
('MEULOU', 'Landes de sidimote', 'principale', 88),
('DJ REINE NYE', 'Bois des arak-aï', 'principale', 89),
('Dragon cochon / DC', 'Territoire des porcos', 'principale', 90),
('Squelettes (Amakna, Cimetière)', '', 'principale', 91),
('RIKTUS', 'Route des roulottes', 'principale', 92),
('GLIGLI', 'Landes de cania', 'principale', 93),
('KABHAL', 'Atoll des possédés', 'principale', 94),
('Lacs enchantés (Montagne des Koalaks)', '', 'principale', 95),
('MARÉCAGE AMAKNA', '', 'principale', 96),
('LABORATOIRE CAWOT', 'Laboratoire abandonné', 'principale', 97),
('Fôret de Kaliptus (Montagne des Koalaks)', '', 'principale', 98),
('MASSIF DE CANIA', '', 'principale', 99),
('DRAGNEYRYS', 'Presqu''île des dragoeuf', 'principale', 100),
('KOUTOU ZONE 3', 'Abîme R''lyugluglu', 'secondaire', 1),
('DANTI ZONE 3', 'Tréfonds des trithons', 'secondaire', 2),
('RAZOF', 'Nimotopia', 'secondaire', 3),
('DOPEUL', 'Village des dopeul', 'secondaire', 4),
('CIMETIERE KOALAK', 'Cimetière primitif', 'secondaire', 5),
('VILLAGE KANIG', '', 'secondaire', 6),
('PIC DE CANIA', '', 'secondaire', 7),
('ILOT DE LA CAWOTTE', 'Wabbit', 'secondaire', 8),
('LAC ENCHANTER', '', 'secondaire', 9),
('GALERIE ABANDONNER', 'Wabbit', 'secondaire', 10),
('RAT BLANC', 'Brakmar', 'secondaire', 11),
('RAT NOIR', 'Bonta', 'secondaire', 12),
('SPHINTER CELL', 'Souterrain d''astrub', 'secondaire', 13),
('Campagne d''amakna', '', 'secondaire', 14),
('Route rocailleuse', '', 'secondaire', 15),
('Port de givre (Île de Frigost)', '', 'secondaire', 16),
('La Bourgade (Île de Frigost)', '', 'secondaire', 17),
('Plage de la Tortue (Île de Moon)', '', 'secondaire', 18),
('Village Kanniboul (Île de Moon)', '', 'secondaire', 19),
('Bateau du Chouque (Île de Moon)', '', 'secondaire', 20),
('Bord de la forêt maléfique (Amakna)', '', 'secondaire', 21),
('Souterrains des Dragoeufs (Amakna)', '', 'secondaire', 22),
('Orée enchantée (Forêt Maléfique)', '', 'secondaire', 23),
('Scarafeuilles (Plaine des Scarafeuilles)', '', 'secondaire', 24),
('Forêt d''Amakna', '', 'secondaire', 25),
('Rivage sufokien (Baie de Sufokia)', '', 'secondaire', 26),
('Clairière de Brouce Boulgoure (Amakna)', '', 'secondaire', 27),
('Coin des Boos (Amakna)', '', 'secondaire', 28),
('Tofus (Champ des Ingalsse)', '', 'secondaire', 29),
('Milifutaie (Amakna)', '', 'secondaire', 30),
('Coin des Bouftous (Amakna)', '', 'secondaire', 31),
('Campement des Bworks', '', 'secondaire', 32),
('Gobs, Campement des Gobelins', '', 'secondaire', 33),
('Village d''Amakna', '', 'secondaire', 34),
('Rivière Kawaii', '', 'secondaire', 35),
('Côte d''Asse', '', 'secondaire', 36),
('Port de Madrestam (Amakna)', '', 'secondaire', 37),
('Cloaque d''Amakna', '', 'secondaire', 38),
('Château d''Amakna', '', 'secondaire', 39),
('Pitons Rocheux des Craqueleurs (Amakna)', '', 'secondaire', 40),
('Larves (Amakna)', '', 'secondaire', 41),
('Orée de la Forêt des Abraknydes', '', 'secondaire', 42),
('Domaine Ancestral', '', 'secondaire', 43),
('Champs de Cania', '', 'secondaire', 44),
('Baie de Cania', '', 'secondaire', 45),
('Cimetière des Tortures (Brakmar)', '', 'secondaire', 46),
('Bordure de Brakmar', '', 'secondaire', 47),
('Plaine des Porkass (Cania)', '', 'secondaire', 48),
('Bambusaie de Damadrya (Plantana)', '', 'secondaire', 49),
('Maison Fantôme (Foire du Trool)', '', 'secondaire', 50),
('Route des Roulottes (Riktus)', '', 'secondaire', 51),
('Rives iridescentes (Bonta)', '', 'secondaire', 52),
('Cimetière des Héros (Bonta)', '', 'secondaire', 53),
('Plaines Rocheuses (Cania)', '', 'secondaire', 54),
('Îlot des Tombeaux', '', 'secondaire', 55),
('Château du Wa Wabbit', '', 'secondaire', 56),
('Port de Sarakech (Saharach)', '', 'secondaire', 57),
('Refuge Sylvestre (Valonia)', '', 'secondaire', 58),
('Cœur immaculé (Bonta)', '', 'secondaire', 59),
('Havres d''ivoire (Bonta)', '', 'secondaire', 60),
('Promontoire des cieux (Bonta)', '', 'secondaire', 61),
('Faubourgs des artisans (Bonta)', '', 'secondaire', 62),
('La Cuirasse (Brakmar)', '', 'secondaire', 63),
('La Marmite (Brakmar)', '', 'secondaire', 64),
('L''Ancre (Brakmar)', '', 'secondaire', 65),
('L''Enclume (Brakmar)', '', 'secondaire', 66)
) AS v(nom, sous_titre, categorie, ordre)
WHERE NOT EXISTS (SELECT 1 FROM public.zones_reservation);

-- Bascule des FK (tables vides a ce stade)
ALTER TABLE public.perco_preferences DROP CONSTRAINT IF EXISTS perco_preferences_zone_id_fkey;
ALTER TABLE public.perco_preferences
    ADD CONSTRAINT perco_preferences_zone_id_fkey
    FOREIGN KEY (zone_id) REFERENCES public.zones_reservation(id) ON DELETE CASCADE;

ALTER TABLE public.perco_reservations DROP CONSTRAINT IF EXISTS perco_reservations_zone_id_fkey;
ALTER TABLE public.perco_reservations
    ADD CONSTRAINT perco_reservations_zone_id_fkey
    FOREIGN KEY (zone_id) REFERENCES public.zones_reservation(id);

-- Fonction d'attribution : jointure sur zones_reservation
CREATE OR REPLACE FUNCTION public.attribuer_percos_periode(p_force BOOLEAN DEFAULT FALSE)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_periode  TIMESTAMPTZ;
    v_tours    INTEGER;
    v_is_admin BOOLEAN;
    v_joueur   RECORD;
    v_zone     INTEGER;
    v_tour     INTEGER;
    v_count    INTEGER := 0;
    v_source   TEXT := 'passee';
BEGIN
    v_periode := public.debut_periode_pvp();

    IF p_force THEN
        SELECT COALESCE(is_admin, false) INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
        IF NOT COALESCE(v_is_admin, false) THEN
            RETURN jsonb_build_object('ok', false, 'message', 'Recalcul réservé aux admins');
        END IF;
        DELETE FROM public.perco_reservations WHERE periode_debut = v_periode;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('attribuer_percos_periode'));

    IF EXISTS (SELECT 1 FROM public.perco_reservations WHERE periode_debut = v_periode) THEN
        RETURN jsonb_build_object('ok', true, 'message', 'Attribution déjà calculée', 'nouvelles', 0);
    END IF;

    v_tours := COALESCE((SELECT valeur::INTEGER FROM public.site_config WHERE cle = 'perco_resa_tours'), 1);

    DROP TABLE IF EXISTS tmp_ladder;
    CREATE TEMP TABLE tmp_ladder ON COMMIT DROP AS
        SELECT id AS user_id, points,
               ROW_NUMBER() OVER (ORDER BY points DESC, username ASC) AS rang
        FROM public.classement_pvp_semaine_passee;

    IF NOT EXISTS (SELECT 1 FROM tmp_ladder) THEN
        v_source := 'courante';
        INSERT INTO tmp_ladder
            SELECT id, points,
                   ROW_NUMBER() OVER (ORDER BY points DESC, username ASC)
            FROM public.classement_pvp_semaine;
    END IF;

    FOR v_tour IN 1..v_tours LOOP
        FOR v_joueur IN SELECT * FROM tmp_ladder ORDER BY rang LOOP
            SELECT pp.zone_id INTO v_zone
            FROM public.perco_preferences pp
            JOIN public.zones_reservation z ON z.id = pp.zone_id AND z.actif = TRUE
            WHERE pp.user_id = v_joueur.user_id
              AND NOT EXISTS (
                  SELECT 1 FROM public.perco_reservations r
                  WHERE r.periode_debut = v_periode AND r.zone_id = pp.zone_id)
              AND NOT EXISTS (
                  SELECT 1 FROM public.zones_bda b
                  WHERE lower(trim(b.nom_zone)) = lower(trim(z.nom)))
            ORDER BY pp.ordre ASC
            LIMIT 1;

            IF v_zone IS NOT NULL THEN
                INSERT INTO public.perco_reservations (periode_debut, tour, rang, user_id, zone_id)
                VALUES (v_periode, v_tour, v_joueur.rang, v_joueur.user_id, v_zone);
                v_count := v_count + 1;
            END IF;
        END LOOP;
    END LOOP;

    RETURN jsonb_build_object('ok', true, 'message', 'Attribution calculée',
        'nouvelles', v_count, 'source', v_source, 'tours', v_tours);
END;
$fn$;
