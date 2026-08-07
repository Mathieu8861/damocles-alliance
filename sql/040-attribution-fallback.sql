-- ============================================
-- 040 - Attribution de zones : fallback catalogue + droits requis
-- Deux changements sur le draft du mode 'rang' :
-- 1. Plus besoin de classer des dizaines de zones : quelques préférences
--    suffisent (voire aucune). Si aucune préférence n'est disponible, le
--    joueur reçoit la première zone libre du catalogue, dans l'ordre
--    défini par l'admin (principales par ordre, puis secondaires).
-- 2. Seuls les joueurs dont le palier de rang donne des droits percos
--    (percos > 0 ou percos_150 > 0) reçoivent une zone.
-- ============================================

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
        /* Seuls les joueurs dont le palier donne des droits percos participent au draft */
        FOR v_joueur IN
            SELECT l.* FROM tmp_ladder l
            WHERE EXISTS (
                SELECT 1 FROM public.paliers_percos pal
                WHERE l.rang BETWEEN pal.rang_min AND pal.rang_max
                  AND (pal.percos > 0 OR pal.percos_150 > 0))
            ORDER BY l.rang
        LOOP
            /* 1. Sa préférence la mieux placée encore libre (zones BDA exclues) */
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

            /* 2. Fallback : première zone libre du catalogue (principales puis secondaires,
               dans l'ordre admin). Personne n'a besoin de classer tout le catalogue. */
            IF v_zone IS NULL THEN
                SELECT z.id INTO v_zone
                FROM public.zones_reservation z
                WHERE z.actif = TRUE
                  AND NOT EXISTS (
                      SELECT 1 FROM public.perco_reservations r
                      WHERE r.periode_debut = v_periode AND r.zone_id = z.id)
                  AND NOT EXISTS (
                      SELECT 1 FROM public.zones_bda b
                      WHERE lower(trim(b.nom_zone)) = lower(trim(z.nom)))
                ORDER BY CASE z.categorie WHEN 'principale' THEN 0 ELSE 1 END, z.ordre ASC
                LIMIT 1;
            END IF;

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
