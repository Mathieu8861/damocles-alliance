-- ============================================
-- 039 - Mode de droits perco commutable
-- 'points' = paliers par points (simple, sans réservations de zones)
-- 'rang'   = paliers par classement + réservations automatiques (chantier 035/036)
-- Le choix se fait dans Admin > Barème Perco ; les deux systèmes cohabitent en base.
-- ============================================

-- A. Clé de configuration (défaut : points, le système simple)
INSERT INTO public.site_config (cle, valeur)
VALUES ('perco_mode', 'points')
ON CONFLICT (cle) DO NOTHING;

-- B. Garde sur l'attribution automatique : le cron du lundi, le déclencheur de
-- secours du board et le recalcul admin ne font rien tant que le mode 'rang'
-- n'est pas actif (clé absente = 'points').
CREATE OR REPLACE FUNCTION public.attribuer_percos_periode(p_force boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    /* Mode simple (paliers de points) actif : pas d'attribution de zones */
    IF COALESCE((SELECT valeur FROM public.site_config WHERE cle = 'perco_mode'), 'points') <> 'rang' THEN
        RETURN jsonb_build_object('ok', true, 'message', 'Mode paliers de points actif : attribution désactivée',
            'nouvelles', 0, 'source', 'aucune');
    END IF;

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
$function$;
