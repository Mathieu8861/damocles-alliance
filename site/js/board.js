/* ============================================ */
/* Damoclès - Droits Percepteurs                */
/* Paliers par RANG + réservations automatiques */
/* de zones par ordre de préférence             */
/* ============================================ */
(function () {
    'use strict';

    var paliers = [];
    var ladder = [];            /* classement de référence (période écoulée, ou courante au lancement) */
    var ladderSource = 'passee';
    var reservations = [];      /* attribution figée de la période courante */
    var zonesBda = [];
    var allZones = [];          /* zones actives (hors BDA) pour le sélecteur */
    var myPrefs = [];           /* ma liste ordonnée [{zone_id, nom, niveau_zone, type}] */
    var prefsDirty = false;
    var percoMode = 'points';   /* 'points' (simple) ou 'rang' (reservations) - site_config.perco_mode */
    var pointsConfig = [];      /* paliers par points (recompenses_config), mode simple */
    var prefRecompenseMap = {}; /* user_id -> preference (percos / pepites / jetons) */
    var zoneReserveeMap = {};   /* user_id -> zone_reservee (saisie libre au profil, modele points) */
    var pointsQuinzaines = {};  /* user_id -> {passee, courante} pour l'eligibilite resa */
    var myList = [];            /* liste complete des zones dans MON ordre (drag & drop) */

    document.addEventListener('ren:ready', init);

    async function init() {
        if (!window.REN.supabase || !window.REN.currentProfile) return;

        await loadPercoMode();

        /* Mode simple : paliers par points, sans reservations de zones */
        if (percoMode === 'points') {
            var tabsEl = document.getElementById('board-tabs');
            /* .tabs a un display:flex en CSS qui ecrase l'attribut hidden */
            if (tabsEl) tabsEl.style.display = 'none';
            var tabPrefsEl = document.getElementById('board-tab-preferences');
            if (tabPrefsEl) tabPrefsEl.hidden = true;
            var tabDroitsEl = document.getElementById('board-tab-droits');
            if (tabDroitsEl) tabDroitsEl.hidden = false;

            await Promise.all([loadPointsConfig(), loadLadder(), loadZonesBda(), loadPrefRecompense(), loadPointsQuinzaines()]);
            renderPeriodePoints();
            renderBaremePoints();
            renderResaPoints();
            renderTablePoints();
            setupBdaModal();
            return;
        }

        /* Secours : si l'attribution de la période n'existe pas encore, la calculer */
        try { await window.REN.supabase.rpc('attribuer_percos_periode'); } catch (e) { /* silencieux */ }

        await Promise.all([
            loadPaliers(), loadLadder(), loadReservations(),
            loadZonesBda(), loadMyPrefs()
        ]);
        await loadZones(); /* apres les BDA : elles sont exclues du catalogue */
        buildMyList();

        renderPeriode();
        renderBareme();
        renderTable();
        renderPrefs();
        setupBdaModal();
        setupTabs();
    }

    /* === ONGLETS === */
    function setupTabs() {
        var btns = document.querySelectorAll('#board-tabs .tabs__btn');
        btns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                btns.forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                var tab = btn.getAttribute('data-tab');
                var tabDroits = document.getElementById('board-tab-droits');
                var tabPrefs = document.getElementById('board-tab-preferences');
                if (tabDroits) tabDroits.hidden = tab !== 'droits';
                if (tabPrefs) tabPrefs.hidden = tab !== 'preferences';
            });
        });
    }

    /* === MODE SIMPLE (paliers par points) === */
    async function loadPercoMode() {
        try {
            var { data } = await window.REN.supabase
                .from('site_config').select('valeur').eq('cle', 'perco_mode').maybeSingle();
            percoMode = data && data.valeur === 'rang' ? 'rang' : 'points';
        } catch (e) { percoMode = 'points'; }
    }

    async function loadPointsConfig() {
        try {
            var { data } = await window.REN.supabase
                .from('recompenses_config').select('*').order('ordre');
            pointsConfig = data || [];
        } catch (err) {
            console.error('[REN-BOARD] Erreur config points:', err);
        }
    }

    async function loadPrefRecompense() {
        try {
            var { data } = await window.REN.supabase
                .from('profiles').select('id, preference_recompense, zone_reservee').eq('is_validated', true);
            prefRecompenseMap = {};
            zoneReserveeMap = {};
            (data || []).forEach(function (p) {
                prefRecompenseMap[p.id] = p.preference_recompense || 'percos';
                if (p.zone_reservee) zoneReserveeMap[p.id] = p.zone_reservee;
            });
        } catch (err) {
            console.error('[REN-BOARD] Erreur preferences recompense:', err);
        }
    }

    async function loadPointsQuinzaines() {
        pointsQuinzaines = {};
        try {
            var res = await Promise.all([
                window.REN.supabase.from('classement_pvp_semaine_passee').select('id, points'),
                window.REN.supabase.from('classement_pvp_semaine').select('id, points')
            ]);
            (res[0].data || []).forEach(function (p) {
                pointsQuinzaines[p.id] = pointsQuinzaines[p.id] || {};
                pointsQuinzaines[p.id].passee = p.points;
            });
            (res[1].data || []).forEach(function (p) {
                pointsQuinzaines[p.id] = pointsQuinzaines[p.id] || {};
                pointsQuinzaines[p.id].courante = p.points;
            });
        } catch (err) {
            console.error('[REN-BOARD] Erreur points quinzaines:', err);
        }
    }

    /* Droit de reserver une zone : le palier de points atteint (quinzaine
       passee OU en cours) doit inclure au moins 1 resa (colonne du bareme) */
    function canResaPoints(userId) {
        var pts = pointsQuinzaines[userId];
        if (!pts) return false;
        var rPassee = pts.passee !== undefined ? rewardForPoints(pts.passee) : null;
        var rCourante = pts.courante !== undefined ? rewardForPoints(pts.courante) : null;
        return !!((rPassee && (rPassee.resa || 0) > 0) || (rCourante && (rCourante.resa || 0) > 0));
    }

    function rewardForPoints(points) {
        for (var i = 0; i < pointsConfig.length; i++) {
            var r = pointsConfig[i];
            var max = r.seuil_max !== null ? r.seuil_max : 999999;
            if (points >= r.seuil_min && points <= max) return r;
        }
        return null;
    }

    function renderPeriodePoints() {
        var el = document.getElementById('board-period');
        if (!el) return;
        var debut = debutPeriodePvp();
        var fin = addDays(debut, 13);
        var txt = 'Droits du ' + formatDate(debut) + ' au ' + formatDate(fin);
        txt += ladderSource === 'courante'
            ? ' — période de lancement : points de la quinzaine en cours'
            : ' — selon les points de la quinzaine précédente';
        el.textContent = txt;
    }

    function formatNumber(n) {
        return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    }

    function renderBaremePoints() {
        var container = document.getElementById('board-bareme');
        if (!container) return;
        var esc = window.REN.escapeHtml;
        var html = '';
        pointsConfig.forEach(function (r) {
            var range = r.seuil_max !== null ? r.seuil_min + '-' + r.seuil_max + ' pts' : r.seuil_min + '+ pts';
            html += '<div class="board-bareme__item">'
                + '<span class="board-bareme__emoji">' + esc(r.emoji || '') + '</span>'
                + '<div class="board-bareme__info">'
                    + '<span class="board-bareme__label">' + esc(r.label) + '</span>'
                    + '<span class="board-bareme__range">' + esc(range) + '</span>'
                + '</div>'
                + '<div class="board-bareme__rewards">';
            var hasReward = false;
            if (r.percepteurs_bonus > 0) { hasReward = true; html += '<span class="board-bareme__perco">' + r.percepteurs_bonus + ' perco' + (r.percepteurs_bonus > 1 ? 's' : '') + '</span>'; }
            if ((r.resa || 0) > 0) { hasReward = true; html += '<span class="board-bareme__resa">+ ' + r.resa + ' résa de zone</span>'; }
            if (r.pepites > 0) { hasReward = true; html += '<span class="board-bareme__pepites">' + formatNumber(r.pepites) + ' pépites</span>'; }
            if ((r.jetons_reward || 0) > 0) { hasReward = true; html += '<span class="board-bareme__pepites">' + r.jetons_reward + ' jetons</span>'; }
            if (!hasReward) html += '<span class="text-muted">—</span>';
            html += '</div></div>';
        });
        container.innerHTML = html ? '<div class="board-bareme__grid">' + html + '</div>' : '<p class="text-muted">Aucun palier configuré.</p>';
    }

    /* Encart de reservation de zone sur le board (mode points) : le joueur
       eligible reserve directement ici, sans passer par son profil */
    function renderResaPoints() {
        var box = document.getElementById('board-resa-points');
        if (!box) return;
        var me = window.REN.currentProfile.id;
        if (!canResaPoints(me)) {
            box.setAttribute('hidden', '');
            box.innerHTML = '';
            return;
        }
        box.removeAttribute('hidden');
        var esc = window.REN.escapeHtml;
        var current = window.REN.currentProfile.zone_reservee || '';
        box.innerHTML = '<div class="board-resa">'
            + '<div class="board-resa__label">&#128205; Ton palier te donne droit à une réservation de zone</div>'
            + '<div class="board-resa__row">'
            + '<input type="text" class="form-input" id="board-resa-input" maxlength="80" placeholder="Ex: Bonta centre" value="' + esc(current) + '">'
            + '<button type="button" class="btn btn--primary" id="board-resa-save">' + (current ? 'Modifier' : 'Réserver') + '</button>'
            + '</div>'
            + '</div>';

        document.getElementById('board-resa-save').addEventListener('click', async function () {
            var input = document.getElementById('board-resa-input');
            var zone = input.value.trim() || null;
            var btn = this;
            btn.disabled = true;
            try {
                var { error } = await window.REN.supabase.from('profiles')
                    .update({ zone_reservee: zone }).eq('id', me);
                if (error) throw error;
                window.REN.currentProfile.zone_reservee = zone;
                if (zone) zoneReserveeMap[me] = zone; else delete zoneReserveeMap[me];
                renderTablePoints();
                window.REN.toast(zone ? 'Zone réservée : ' + zone : 'Zone retirée', 'success');
            } catch (err) {
                window.REN.toast('Erreur : ' + err.message, 'error');
            } finally {
                btn.disabled = false;
            }
        });
    }

    function renderTablePoints() {
        var container = document.getElementById('board-table-wrap');
        if (!container) return;

        if (!ladder.length) {
            container.innerHTML = '<p class="text-muted text-center" style="padding:2rem;">Aucun combat sur la période de référence.</p>';
            return;
        }

        var esc = window.REN.escapeHtml;
        var myId = window.REN.currentProfile.id;
        var html = '<table class="board-table">';
        html += '<thead><tr>';
        html += '<th class="board-table__th board-table__th--rank">#</th>';
        html += '<th class="board-table__th board-table__th--name">Joueur</th>';
        html += '<th class="board-table__th board-table__th--points">Points</th>';
        html += '<th class="board-table__th board-table__th--tier">Palier</th>';
        html += '<th class="board-table__th board-table__th--reward">Droits percos</th>';
        html += '<th class="board-table__th board-table__th--zone">Zone réservée</th>';
        html += '</tr></thead><tbody>';

        ladder.forEach(function (p) {
            var r = rewardForPoints(p.points);
            var palierTxt = r ? ((r.emoji ? esc(r.emoji) + ' ' : '') + esc(r.label)) : '—';
            var reward = '—';
            if (r) {
                var pref = prefRecompenseMap[p.user_id] || 'percos';
                if (pref === 'pepites' && r.pepites > 0) {
                    reward = formatNumber(r.pepites) + ' <img class="icon-inline" src="assets/images/pepite.png" alt="pépites">';
                } else if (pref === 'jetons' && (r.jetons_reward || 0) > 0) {
                    reward = '+' + r.jetons_reward + ' <img class="icon-inline" src="assets/images/jeton.png" alt="jetons">';
                } else if (r.percepteurs_bonus > 0) {
                    reward = '<strong>' + r.percepteurs_bonus + '</strong> <img class="icon-inline icon-inline--perco" src="assets/images/percepteur.png" alt="perco">';
                } else if (r.pepites > 0) {
                    reward = formatNumber(r.pepites) + ' <img class="icon-inline" src="assets/images/pepite.png" alt="pépites">';
                }
            }

            html += '<tr class="board-table__row' + (p.user_id === myId ? ' board-table__row--me' : '') + '">';
            html += '<td class="board-table__td board-table__td--rank">' + p.rang + '</td>';
            html += '<td class="board-table__td board-table__td--name notranslate">' + esc(p.username) + '</td>';
            html += '<td class="board-table__td board-table__td--points">' + p.points + '</td>';
            html += '<td class="board-table__td board-table__td--tier">' + palierTxt + '</td>';
            html += '<td class="board-table__td board-table__td--reward">' + reward + '</td>';
            var zoneTxt = (zoneReserveeMap[p.user_id] && canResaPoints(p.user_id))
                ? '<strong>' + esc(zoneReserveeMap[p.user_id]) + '</strong>'
                : '—';
            html += '<td class="board-table__td board-table__td--zone">' + zoneTxt + '</td>';
            html += '</tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    }

    /* === QUINZAINE (miroir de debut_periode_pvp() en SQL) === */
    function debutPeriodePvp() {
        var anchor = new Date(2026, 6, 27);
        anchor.setHours(0, 0, 0, 0);
        var days = Math.floor((Date.now() - anchor.getTime()) / 86400000);
        var start = new Date(anchor.getTime());
        start.setDate(anchor.getDate() + Math.floor(days / 14) * 14);
        return start;
    }

    function addDays(d, n) {
        var r = new Date(d.getTime());
        r.setDate(r.getDate() + n);
        return r;
    }

    function formatDate(date) {
        var mois = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
        return date.getDate() + ' ' + mois[date.getMonth()];
    }

    /* === CHARGEMENTS === */
    async function loadPaliers() {
        try {
            var { data } = await window.REN.supabase
                .from('paliers_percos').select('*').order('rang_min');
            paliers = data || [];
        } catch (err) {
            console.error('[REN-BOARD] Erreur paliers:', err);
        }
    }

    async function loadLadder() {
        try {
            var res = await window.REN.supabase.from('classement_pvp_semaine_passee').select('id, username, points');
            var rows = res.data || [];
            if (!rows.length) {
                ladderSource = 'courante';
                res = await window.REN.supabase.from('classement_pvp_semaine').select('id, username, points');
                rows = res.data || [];
            }
            /* Même ordre déterministe que l'attribution SQL : points desc, pseudo asc */
            rows.sort(function (a, b) { return b.points - a.points || a.username.localeCompare(b.username); });
            ladder = rows.map(function (r, i) {
                return { user_id: r.id, username: r.username, points: r.points, rang: i + 1 };
            });
        } catch (err) {
            console.error('[REN-BOARD] Erreur classement:', err);
        }
    }

    async function loadReservations() {
        try {
            var { data } = await window.REN.supabase
                .from('perco_reservations')
                .select('*, zone:zones_reservation!zone_id(nom, sous_titre)')
                .order('periode_debut', { ascending: false })
                .order('tour', { ascending: true })
                .order('rang', { ascending: true });
            var rows = data || [];
            if (!rows.length) { reservations = []; return; }
            /* Ne garder que la période la plus récente (comparaison timezone-proof) */
            var latest = rows[0].periode_debut;
            reservations = rows.filter(function (r) { return r.periode_debut === latest; });
        } catch (err) {
            console.error('[REN-BOARD] Erreur réservations:', err);
        }
    }

    async function loadZonesBda() {
        try {
            var { data } = await window.REN.supabase
                .from('zones_bda').select('*').order('created_at', { ascending: true });
            zonesBda = data || [];
        } catch (err) {
            console.error('[REN-BOARD] Erreur zones BDA:', err);
        }
    }

    async function loadZones() {
        try {
            /* Catalogue dédié réservations : 1 entrée = le couple donjon + zone associée */
            var { data } = await window.REN.supabase
                .from('zones_reservation')
                .select('id, nom, sous_titre, categorie, ordre')
                .eq('actif', true)
                .order('categorie')
                .order('ordre');
            var bdaNames = {};
            zonesBda.forEach(function (z) { bdaNames[z.nom_zone.trim().toLowerCase()] = true; });
            allZones = (data || []).filter(function (z) {
                return !bdaNames[z.nom.trim().toLowerCase()];
            });
        } catch (err) {
            console.error('[REN-BOARD] Erreur zones:', err);
        }
    }

    /* Construit MA liste complete : mes preferences sauvegardees d'abord
       (dans leur ordre), puis le reste du catalogue dans l'ordre par defaut */
    function buildMyList() {
        var byId = {};
        allZones.forEach(function (z) { byId[z.id] = z; });
        var seen = {};
        myList = [];
        myPrefs.forEach(function (p) {
            var z = byId[p.zone_id];
            if (z && !seen[z.id]) { myList.push(z); seen[z.id] = true; }
        });
        allZones.forEach(function (z) {
            if (!seen[z.id]) { myList.push(z); seen[z.id] = true; }
        });
    }

    async function loadMyPrefs() {
        try {
            var { data } = await window.REN.supabase
                .from('perco_preferences')
                .select('zone_id, ordre, zone:zones_reservation!zone_id(nom, sous_titre)')
                .eq('user_id', window.REN.currentProfile.id)
                .order('ordre');
            myPrefs = (data || []).map(function (p) {
                return {
                    zone_id: p.zone_id,
                    nom: p.zone ? p.zone.nom : '?',
                    sous_titre: p.zone ? (p.zone.sous_titre || '') : ''
                };
            });
        } catch (err) {
            console.error('[REN-BOARD] Erreur préférences:', err);
        }
    }

    /* === PÉRIODE === */
    function renderPeriode() {
        var el = document.getElementById('board-period');
        if (!el) return;
        var debut = debutPeriodePvp();
        var fin = addDays(debut, 13);
        var txt = 'Droits du ' + formatDate(debut) + ' au ' + formatDate(fin);
        txt += ladderSource === 'courante'
            ? ' — période de lancement : classement en cours'
            : ' — attribution calculée sur le classement de la quinzaine précédente';
        el.textContent = txt;
    }

    /* === BARÈME (paliers par rang) === */
    function renderBareme() {
        var container = document.getElementById('board-bareme');
        if (!container) return;
        var esc = window.REN.escapeHtml;
        var html = '';
        paliers.forEach(function (p) {
            var label = p.rang_min === p.rang_max ? 'Top ' + p.rang_min : 'Top ' + p.rang_min + '-' + p.rang_max;
            var droits = [];
            if (p.percos > 0) droits.push(p.percos + ' perco' + (p.percos > 1 ? 's' : ''));
            if (p.percos_150 > 0) droits.push(p.percos_150 + ' perco' + (p.percos_150 > 1 ? 's' : '') + ' niv 150-');
            html += '<div class="board-bareme__item">'
                + '<span class="board-bareme__emoji">' + esc(p.emoji || '') + '</span>'
                + '<div class="board-bareme__info">'
                    + '<span class="board-bareme__label">' + esc(label) + '</span>'
                + '</div>'
                + '<div class="board-bareme__rewards">'
                    + '<span class="board-bareme__perco">' + esc(droits.join(' + ') || '—') + '</span>'
                + '</div>'
                + '</div>';
        });
        container.innerHTML = html ? '<div class="board-bareme__grid">' + html + '</div>' : '<p class="text-muted">Aucun palier configuré.</p>';
    }

    function palierFor(rang) {
        for (var i = 0; i < paliers.length; i++) {
            if (rang >= paliers[i].rang_min && rang <= paliers[i].rang_max) return paliers[i];
        }
        return null;
    }

    /* === TABLEAU === */
    function renderTable() {
        var container = document.getElementById('board-table-wrap');
        if (!container) return;

        if (!ladder.length) {
            container.innerHTML = '<p class="text-muted text-center" style="padding:2rem;">Aucun combat sur la période de référence.</p>';
            return;
        }

        /* Réservations par joueur (tours dans l'ordre) */
        var resaByUser = {};
        reservations.forEach(function (r) {
            if (!resaByUser[r.user_id]) resaByUser[r.user_id] = [];
            resaByUser[r.user_id].push(r);
        });

        var esc = window.REN.escapeHtml;
        var myId = window.REN.currentProfile.id;
        var html = '<table class="board-table">';
        html += '<thead><tr>';
        html += '<th class="board-table__th board-table__th--rank">#</th>';
        html += '<th class="board-table__th board-table__th--name">Joueur</th>';
        html += '<th class="board-table__th board-table__th--points">Points</th>';
        html += '<th class="board-table__th board-table__th--tier">Droits percos</th>';
        html += '<th class="board-table__th board-table__th--zone">Zone réservée</th>';
        html += '</tr></thead><tbody>';

        ladder.forEach(function (p) {
            var palier = palierFor(p.rang);
            var droits = '—';
            if (palier) {
                var parts = [];
                if (palier.percos > 0) parts.push('<strong>' + palier.percos + '</strong> <img class="icon-inline icon-inline--perco" src="assets/images/percepteur.png" alt="perco">');
                if (palier.percos_150 > 0) parts.push('<strong>' + palier.percos_150 + '</strong> <img class="icon-inline icon-inline--perco" src="assets/images/percepteur.png" alt="perco"> <span class="board-table__lvl">niv 150-</span>');
                droits = (palier.emoji ? esc(palier.emoji) + ' ' : '') + (parts.join(' + ') || '—');
            }

            var resas = resaByUser[p.user_id] || [];
            var zoneTxt = resas.length
                ? resas.map(function (r) {
                    var nom = r.zone ? r.zone.nom : '?';
                    var sub = r.zone && r.zone.sous_titre ? ' <span class="board-table__lvl">' + esc(r.zone.sous_titre) + '</span>' : '';
                    return '<strong>' + esc(nom) + '</strong>' + sub;
                }).join(' <span class="text-muted">·</span> ')
                : '—';

            html += '<tr class="board-table__row' + (p.user_id === myId ? ' board-table__row--me' : '') + '">';
            html += '<td class="board-table__td board-table__td--rank">' + p.rang + '</td>';
            html += '<td class="board-table__td board-table__td--name notranslate">' + esc(p.username) + '</td>';
            html += '<td class="board-table__td board-table__td--points">' + p.points + '</td>';
            html += '<td class="board-table__td board-table__td--tier">' + droits + '</td>';
            html += '<td class="board-table__td board-table__td--zone">' + zoneTxt + '</td>';
            html += '</tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    }

    /* === MES PRÉFÉRENCES === */
    /* === MES PRÉFÉRENCES (liste complète, réordonnable par drag & drop) === */
    function renderPrefs() {
        var listEl = document.getElementById('board-prefs-list');
        var mineEl = document.getElementById('board-prefs-mine');
        var saveBtn = document.getElementById('board-prefs-save');
        if (!listEl) return;

        var esc = window.REN.escapeHtml;

        /* Position de chaque zone dans l'ordre de base de l'alliance (repere fixe) */
        var baseOrderMap = {};
        allZones.forEach(function (z, i) { baseOrderMap[z.id] = i + 1; });

        /* Encart : ma zone attribuée pour la quinzaine en cours */
        var myResas = reservations.filter(function (r) { return r.user_id === window.REN.currentProfile.id; });
        var mineHtml;
        if (myResas.length) {
            mineHtml = '<div class="board-prefs__mine">Ta zone attribuée pour cette quinzaine : '
                + myResas.map(function (r) {
                    var nom = r.zone ? r.zone.nom : '?';
                    var sub = r.zone && r.zone.sous_titre ? ' <span class="pref-row__lvl">' + esc(r.zone.sous_titre) + '</span>' : '';
                    return '<strong>' + esc(nom) + '</strong>' + sub;
                }).join(' <span class="text-muted">&middot;</span> ') + '</div>';
        } else {
            mineHtml = '<div class="board-prefs__mine board-prefs__mine--none">Aucune zone attribuée pour l\'instant sur cette quinzaine. Le tirage se fait automatiquement au reset (un admin peut le recalculer).</div>';
        }
        if (mineEl) mineEl.innerHTML = mineHtml;

        var html = '';
        myList.forEach(function (z, i) {
            html += '<div class="pref-row pref-row--drag" draggable="true" data-zone-id="' + z.id + '">';
            html += '<span class="pref-row__grip" title="Glisser pour déplacer"><svg width="12" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.8"/><circle cx="15" cy="5" r="1.8"/><circle cx="9" cy="12" r="1.8"/><circle cx="15" cy="12" r="1.8"/><circle cx="9" cy="19" r="1.8"/><circle cx="15" cy="19" r="1.8"/></svg></span>';
            html += '<span class="pref-row__ordre">' + (i + 1) + '</span>';
            html += '<span class="pref-row__nom notranslate">' + esc(z.nom)
                + (z.sous_titre ? ' <span class="pref-row__lvl">' + esc(z.sous_titre) + '</span>' : '')
                + (z.categorie === 'secondaire' ? ' <span class="pref-row__cat">2nd</span>' : '')
                + '</span>';
            html += '<span class="pref-row__base" title="Position dans l\'ordre de base de l\'alliance">base n°' + (baseOrderMap[z.id] || '?') + '</span>';
            html += '<span class="pref-row__actions">';
            html += '<button class="pref-row__btn" data-action="up" data-i="' + i + '" title="Monter"' + (i === 0 ? ' disabled' : '') + '>&#9650;</button>';
            html += '<button class="pref-row__btn" data-action="down" data-i="' + i + '" title="Descendre"' + (i === myList.length - 1 ? ' disabled' : '') + '>&#9660;</button>';
            html += '</span>';
            html += '</div>';
        });
        listEl.innerHTML = html;

        if (saveBtn) saveBtn.hidden = !prefsDirty;
        bindPrefsControls();
    }

    var prefsControlsBound = false;
    function bindPrefsControls() {
        if (prefsControlsBound) return;
        prefsControlsBound = true;

        var listEl = document.getElementById('board-prefs-list');
        var filterInput = document.getElementById('board-prefs-filter');
        var saveBtn = document.getElementById('board-prefs-save');
        var resetBtn = document.getElementById('board-prefs-reset');

        if (saveBtn) saveBtn.addEventListener('click', savePrefs);
        if (resetBtn) resetBtn.addEventListener('click', resetPrefs);

        /* Recherche : scrolle jusqu'à la première zone qui matche et la surligne */
        if (filterInput && listEl) {
            filterInput.addEventListener('input', function () {
                var q = filterInput.value.trim().toLowerCase();
                listEl.querySelectorAll('.pref-row--hit').forEach(function (r) { r.classList.remove('pref-row--hit'); });
                if (q.length < 2) return;
                var rows = listEl.querySelectorAll('.pref-row');
                for (var i = 0; i < rows.length; i++) {
                    if (rows[i].textContent.toLowerCase().indexOf(q) !== -1) {
                        rows[i].classList.add('pref-row--hit');
                        rows[i].scrollIntoView({ block: 'center', behavior: 'smooth' });
                        break;
                    }
                }
            });
        }

        if (!listEl) return;

        /* Flèches monter/descendre (délégation, la liste est re-rendue à chaque fois) */
        listEl.addEventListener('click', function (e) {
            var btn = e.target.closest('.pref-row__btn');
            if (!btn || btn.disabled) return;
            var i = parseInt(btn.dataset.i, 10);
            var action = btn.dataset.action;
            if (action === 'up' && i > 0) {
                var tmp = myList[i - 1]; myList[i - 1] = myList[i]; myList[i] = tmp;
            } else if (action === 'down' && i < myList.length - 1) {
                var tmp2 = myList[i + 1]; myList[i + 1] = myList[i]; myList[i] = tmp2;
            } else {
                return;
            }
            prefsDirty = true;
            renderPrefs();
        });

        /* Drag & drop : on déplace la ligne dans le DOM pendant le survol,
           puis on relit l'ordre du DOM au lâcher */
        listEl.addEventListener('dragstart', function (e) {
            var row = e.target.closest('.pref-row');
            if (!row) return;
            row.classList.add('pref-row--dragging');
            try { e.dataTransfer.setData('text/plain', row.dataset.zoneId); } catch (err) { /* vieux navigateurs */ }
            e.dataTransfer.effectAllowed = 'move';
        });

        listEl.addEventListener('dragover', function (e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            var dragging = listEl.querySelector('.pref-row--dragging');
            var target = e.target.closest('.pref-row');
            if (!dragging || !target || target === dragging) return;
            var rect = target.getBoundingClientRect();
            var after = (e.clientY - rect.top) > rect.height / 2;
            listEl.insertBefore(dragging, after ? target.nextSibling : target);
        });

        listEl.addEventListener('drop', function (e) { e.preventDefault(); });

        listEl.addEventListener('dragend', function () {
            var dragging = listEl.querySelector('.pref-row--dragging');
            if (dragging) dragging.classList.remove('pref-row--dragging');
            syncListFromDom(listEl);
        });
    }

    /* Relit l'ordre du DOM après un drag et met à jour la liste */
    function syncListFromDom(listEl) {
        var byId = {};
        myList.forEach(function (z) { byId[z.id] = z; });
        var newList = [];
        listEl.querySelectorAll('.pref-row').forEach(function (row) {
            var z = byId[parseInt(row.dataset.zoneId, 10)];
            if (z) newList.push(z);
        });
        if (newList.length !== myList.length) return;
        var changed = false;
        for (var i = 0; i < myList.length; i++) {
            if (myList[i].id !== newList[i].id) { changed = true; break; }
        }
        if (!changed) return;
        myList = newList;
        prefsDirty = true;
        renderPrefs();
    }

    async function savePrefs() {
        var saveBtn = document.getElementById('board-prefs-save');
        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Enregistrement...'; }
        try {
            var me = window.REN.currentProfile.id;
            var del = await window.REN.supabase.from('perco_preferences').delete().eq('user_id', me);
            if (del.error) throw del.error;

            /* Ordre identique au catalogue : rien à stocker, l'ordre par défaut s'applique */
            var isDefault = myList.length === allZones.length && myList.every(function (z, i) { return allZones[i] && z.id === allZones[i].id; });
            if (!isDefault && myList.length) {
                var rows = myList.map(function (z, i) {
                    return { user_id: me, zone_id: z.id, ordre: i + 1 };
                });
                var ins = await window.REN.supabase.from('perco_preferences').insert(rows);
                if (ins.error) throw ins.error;
            }

            prefsDirty = false;
            renderPrefs();
            window.REN.toast('Ton ordre de préférence est enregistré. Il sera utilisé au prochain calcul d\'attribution.', 'success');
        } catch (err) {
            console.error('[REN-BOARD] Erreur sauvegarde préférences:', err);
            window.REN.toast('Erreur : ' + err.message, 'error');
        } finally {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Enregistrer mes préférences'; }
        }
    }

    async function resetPrefs() {
        if (!confirm('Revenir à l\'ordre par défaut de l\'alliance ? Ton classement personnalisé sera supprimé.')) return;
        try {
            var del = await window.REN.supabase.from('perco_preferences').delete().eq('user_id', window.REN.currentProfile.id);
            if (del.error) throw del.error;
            myPrefs = [];
            myList = allZones.slice();
            prefsDirty = false;
            renderPrefs();
            window.REN.toast('Ordre par défaut rétabli.', 'success');
        } catch (err) {
            window.REN.toast('Erreur : ' + err.message, 'error');
        }
    }

    /* === ZONES BDA === */
    function setupBdaModal() {
        var btn = document.getElementById('btn-zones-bda');
        var overlay = document.getElementById('modal-zones-bda');
        var closeBtn = document.getElementById('modal-bda-close');
        var listEl = document.getElementById('zones-bda-list');
        if (!btn || !overlay) return;

        if (zonesBda.length > 0) {
            btn.innerHTML += ' <span class="bda-badge">' + zonesBda.length + '</span>';
        }

        btn.addEventListener('click', function () {
            renderBdaZones(listEl);
            overlay.classList.add('active');
        });

        closeBtn.addEventListener('click', function () {
            overlay.classList.remove('active');
        });

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) overlay.classList.remove('active');
        });
    }

    function renderBdaZones(container) {
        if (!zonesBda.length) {
            container.innerHTML = '<p class="text-muted text-center" style="padding:var(--spacing-lg);">Aucune zone réservée pour le moment.</p>';
            return;
        }

        var html = '<div class="bda-zones-grid">';
        zonesBda.forEach(function (z) {
            html += '<div class="bda-zone-card">';
            html += '<div class="bda-zone-card__icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>';
            html += '<div class="bda-zone-card__info">';
            html += '<span class="bda-zone-card__name">' + window.REN.escapeHtml(z.nom_zone) + '</span>';
            if (z.description) html += '<span class="bda-zone-card__desc">' + window.REN.escapeHtml(z.description) + '</span>';
            html += '</div>';
            html += '</div>';
        });
        html += '</div>';
        container.innerHTML = html;
    }

})();
