/* ============================================ */
/* Damoclès     - Droits Percepteurs            */
/* Points semaine passée → droits semaine       */
/* ============================================ */
(function () {
    'use strict';

    var recompensesConfig = [];
    var semaines = [];
    var preferencesMap = {};
    var zonesMap = {};
    var zoneEligibleMap = {};
    var kamatrixMap = {};
    var zonesBda = [];
    var currentSelection = 'last';

    document.addEventListener('ren:ready', init);

    async function init() {
        if (!window.REN.supabase || !window.REN.currentProfile) return;
        await loadRecompensesConfig();
        await loadPreferences();
        await loadZoneEligibility();
        await loadKamatrix();
        await loadSemaines();
        await loadZonesBda();
        setupWeekSelect();
        setupBdaModal();
        renderBareme();
        loadBoard(currentSelection);
    }

    /* === CHARGER CONFIG RÉCOMPENSES === */
    async function loadRecompensesConfig() {
        try {
            var { data } = await window.REN.supabase
                .from('recompenses_config')
                .select('*')
                .order('ordre', { ascending: true });
            recompensesConfig = data || [];
        } catch (err) {
            console.error('[REN-BOARD] Erreur config:', err);
        }
    }

    /* === CHARGER PRÉFÉRENCES JOUEURS (percos vs pépites vs jetons) === */
    async function loadPreferences() {
        try {
            var { data } = await window.REN.supabase
                .from('profiles')
                .select('id, preference_recompense, zone_reservee')
                .eq('is_validated', true);
            preferencesMap = {};
            zonesMap = {};
            (data || []).forEach(function (p) {
                preferencesMap[p.id] = p.preference_recompense || 'percos';
                if (p.zone_reservee) zonesMap[p.id] = p.zone_reservee;
            });
        } catch (err) {
            console.error('[REN-BOARD] Erreur preferences:', err);
        }
    }

    /* === CALCULER ÉLIGIBILITÉ ZONE (>=75 pts sur l'une des 2 semaines live) === */
    async function loadZoneEligibility() {
        zoneEligibleMap = {};
        try {
            var [lastRes, currentRes] = await Promise.all([
                window.REN.supabase.from('classement_pvp_semaine_passee').select('id, points'),
                window.REN.supabase.from('classement_pvp_semaine').select('id, points')
            ]);
            (lastRes.data || []).forEach(function (p) {
                if (p.points >= 75) zoneEligibleMap[p.id] = true;
            });
            (currentRes.data || []).forEach(function (p) {
                if (p.points >= 75) zoneEligibleMap[p.id] = true;
            });
        } catch (err) {
            console.error('[REN-BOARD] Erreur zone eligibility:', err);
        }
    }

    /* === CHARGER KAMATRIX GAGNÉS SUR LA SEMAINE === */
    async function loadKamatrix() {
        kamatrixMap = {};
        try {
            /* Lundi de la semaine en cours */
            var now = new Date();
            var day = now.getDay();
            var diff = day === 0 ? 6 : day - 1;
            var monday = new Date(now);
            monday.setDate(now.getDate() - diff);
            monday.setHours(0, 0, 0, 0);

            var { data } = await window.REN.supabase
                .from('kamatrix_semaine')
                .select('id, kamatrix');

            (data || []).forEach(function (row) {
                kamatrixMap[row.id] = row.kamatrix || 0;
            });
        } catch (err) {
            console.error('[REN-BOARD] Erreur chargement kamatrix:', err);
        }
    }

    /* === CHARGER LISTE DES SEMAINES ARCHIVÉES === */
    async function loadSemaines() {
        try {
            var { data } = await window.REN.supabase
                .from('semaines')
                .select('*')
                .order('date_debut', { ascending: false });
            semaines = data || [];
        } catch (err) {
            console.error('[REN-BOARD] Erreur semaines:', err);
        }
    }

    /* === SETUP SELECT SEMAINES === */
    function setupWeekSelect() {
        var select = document.getElementById('board-week-select');
        if (!select) return;

        semaines.forEach(function (s) {
            var opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = formatWeekLabel(s.date_debut, s.date_fin);
            select.appendChild(opt);
        });

        select.addEventListener('change', function () {
            currentSelection = select.value;
            loadBoard(currentSelection);
        });
    }

    /* === RENDER BARÈME (légende des paliers) === */
    function renderBareme() {
        var container = document.getElementById('board-bareme');
        if (!container || !recompensesConfig.length) {
            if (container) container.innerHTML = '';
            return;
        }

        var html = '<p class="text-muted" style="font-size:0.8rem;margin-bottom:var(--spacing-sm);text-align:center;">Choisissez votre récompense préférée dans votre <strong style="color:var(--color-text-primary);">Espace Profil</strong></p>';
        html += '<div class="board-bareme__grid">';
        recompensesConfig.forEach(function (r) {
            var range = r.seuil_min + (r.seuil_max ? '-' + r.seuil_max : '+') + ' pts';

            html += '<div class="board-bareme__item">';
            html += '<span class="board-bareme__emoji">' + r.emoji + '</span>';
            html += '<div class="board-bareme__info">';
            html += '<span class="board-bareme__label">' + r.label + '</span>';
            html += '<span class="board-bareme__range">' + range + '</span>';
            html += '</div>';
            html += '<div class="board-bareme__rewards">';
            if (r.percepteurs_bonus > 0) html += '<span class="board-bareme__perco">' + r.percepteurs_bonus + ' <img class="icon-inline icon-inline--perco" src="assets/images/percepteur.png" alt="percos"></span>';
            if (r.pepites > 0) html += '<span class="board-bareme__pepites">' + formatNumber(r.pepites) + ' <img class="icon-inline" src="assets/images/pepite.png" alt="pépites"></span>';
            if ((r.jetons_reward || 0) > 0) html += '<span class="board-bareme__jetons">' + r.jetons_reward + ' <img class="icon-inline" src="assets/images/jeton.png" alt="jetons"></span>';
            html += '</div>';
            html += '</div>';
        });
        html += '</div>';

        container.innerHTML = html;
    }

    /* === CHARGER LE BOARD === */
    async function loadBoard(selection) {
        var tableWrap = document.getElementById('board-table-wrap');
        var periodEl = document.getElementById('board-period');
        if (!tableWrap) return;

        tableWrap.innerHTML = '<div class="loading"><div class="spinner"></div> Chargement...</div>';

        var players = [];
        var periodText = '';

        if (selection === 'last') {
            players = await loadLastWeek();
            /* Dates de la quinzaine passée (points) et de la quinzaine en cours (droits) */
            var debut = debutPeriodePvp();
            var lastStart = addDays(debut, -14);
            var lastEnd = addDays(debut, -1);
            var curEnd = addDays(debut, 13);
            periodText = 'Points du ' + formatDate(lastStart) + ' au ' + formatDate(lastEnd) + ' — Droits du ' + formatDate(debut) + ' au ' + formatDate(curEnd);
        } else if (selection === 'current') {
            players = await loadCurrentWeek();
            /* Dates de la quinzaine en cours (points) et de la suivante (droits) */
            var debutCur = debutPeriodePvp();
            var curFin = addDays(debutCur, 13);
            var nextStart = addDays(debutCur, 14);
            var nextEnd = addDays(debutCur, 27);
            periodText = 'Points du ' + formatDate(debutCur) + ' au ' + formatDate(curFin) + ' — Droits du ' + formatDate(nextStart) + ' au ' + formatDate(nextEnd);
        } else {
            var sem = semaines.find(function (s) { return s.id === parseInt(selection); });
            players = await loadArchivedWeek(parseInt(selection));
            if (sem) {
                var nextMonday = new Date(sem.date_fin);
                nextMonday.setDate(nextMonday.getDate() + 1);
                var nextSunday = new Date(nextMonday);
                nextSunday.setDate(nextMonday.getDate() + 6);
                periodText = 'Points du ' + formatDate(new Date(sem.date_debut)) + ' au ' + formatDate(new Date(sem.date_fin)) + ' — Droits du ' + formatDate(nextMonday) + ' au ' + formatDate(nextSunday);
            }
        }

        if (periodEl) periodEl.textContent = periodText;

        renderTable(players, tableWrap);
    }

    /* === QUINZAINE : debut de la periode PvP en cours === */
    /* Ancre : lundi 27/07/2026, periodes de 14 jours (miroir de debut_periode_pvp() en SQL) */
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

    /* === PÉRIODE PASSÉE === */
    async function loadLastWeek() {
        try {
            var [pvpRes, pepitesRes] = await Promise.all([
                window.REN.supabase.from('classement_pvp_semaine_passee').select('id, username, points'),
                window.REN.supabase.from('pepites_semaine_passee').select('id, pepites')
            ]);
            var data = pvpRes.data || [];
            var pepitesMap = {};
            (pepitesRes.data || []).forEach(function (p) { pepitesMap[p.id] = p.pepites; });

            data.sort(function (a, b) { return b.points - a.points; });

            return data.map(function (p, i) {
                var reward = getReward(p.points);
                return {
                    user_id: p.id,
                    username: p.username,
                    points: p.points,
                    rang: i + 1,
                    recompense_pepites: reward.pepites,
                    recompense_percepteurs: reward.percepteurs_bonus,
                    jetons_reward: reward.jetons_reward || 0,
                    tier_label: reward.label,
                    tier_emoji: reward.emoji,
                    pepites_jeu: pepitesMap[p.id] || 0,
                    kamatrix: kamatrixMap[p.id] || 0,
                    preference_recompense: preferencesMap[p.id] || 'percos',
                    zone_reservee: zonesMap[p.id] || null,
                    is_live: true
                };
            });
        } catch (err) {
            console.error('[REN-BOARD] Erreur semaine passée:', err);
            return [];
        }
    }

    /* === SEMAINE EN COURS === */
    async function loadCurrentWeek() {
        try {
            var [pvpRes, pepitesRes] = await Promise.all([
                window.REN.supabase.from('classement_pvp_semaine').select('id, username, points'),
                window.REN.supabase.from('pepites_semaine_courante').select('id, pepites')
            ]);
            var data = pvpRes.data || [];
            var pepitesMap = {};
            (pepitesRes.data || []).forEach(function (p) { pepitesMap[p.id] = p.pepites; });

            data.sort(function (a, b) { return b.points - a.points; });

            return data.map(function (p, i) {
                var reward = getReward(p.points);
                return {
                    user_id: p.id,
                    username: p.username,
                    points: p.points,
                    rang: i + 1,
                    recompense_pepites: reward.pepites,
                    recompense_percepteurs: reward.percepteurs_bonus,
                    jetons_reward: reward.jetons_reward || 0,
                    tier_label: reward.label,
                    tier_emoji: reward.emoji,
                    pepites_jeu: pepitesMap[p.id] || 0,
                    kamatrix: kamatrixMap[p.id] || 0,
                    preference_recompense: preferencesMap[p.id] || 'percos',
                    zone_reservee: zonesMap[p.id] || null,
                    is_live: true
                };
            });
        } catch (err) {
            console.error('[REN-BOARD] Erreur semaine en cours:', err);
            return [];
        }
    }

    /* === SEMAINE ARCHIVÉE === */
    async function loadArchivedWeek(semaineId) {
        try {
            var { data } = await window.REN.supabase
                .from('semaine_snapshots')
                .select('*')
                .eq('semaine_id', semaineId)
                .order('rang', { ascending: true });
            if (!data) return [];

            return data.map(function (p) {
                var reward = getReward(p.points);
                return {
                    user_id: p.user_id,
                    username: p.username,
                    points: p.points,
                    rang: p.rang,
                    recompense_pepites: p.recompense_pepites,
                    recompense_percepteurs: p.recompense_percepteurs,
                    tier_label: reward.label,
                    tier_emoji: reward.emoji,
                    pepites_jeu: 0,
                    kamatrix: 0,
                    prefere_pepites: preferencesMap[p.user_id] || false,
                    is_live: false
                };
            });
        } catch (err) {
            console.error('[REN-BOARD] Erreur semaine archivée:', err);
            return [];
        }
    }

    /* === TROUVER LA RÉCOMPENSE SELON LES POINTS === */
    function getReward(points) {
        for (var i = 0; i < recompensesConfig.length; i++) {
            var r = recompensesConfig[i];
            var min = r.seuil_min;
            var max = r.seuil_max !== null ? r.seuil_max : 999999;
            if (points >= min && points <= max) {
                return r;
            }
        }
        return { pepites: 0, percepteurs_bonus: 0, label: 'Aucun', emoji: '' };
    }

    /* === RENDER TABLEAU === */
    function renderTable(players, container) {
        if (!players.length) {
            container.innerHTML = '<p class="text-muted text-center" style="padding:2rem;">Aucune donnée pour cette semaine.</p>';
            return;
        }

        var html = '<table class="board-table">';
        html += '<thead><tr>';
        html += '<th class="board-table__th board-table__th--rank">#</th>';
        html += '<th class="board-table__th board-table__th--name">Joueur</th>';
        html += '<th class="board-table__th board-table__th--points">Points</th>';
        html += '<th class="board-table__th board-table__th--tier">Palier</th>';
        html += '<th class="board-table__th board-table__th--zone">Zone r\u00e9serv\u00e9e</th>';
        html += '<th class="board-table__th board-table__th--reward">R\u00e9compense PVP</th>';
        html += '<th class="board-table__th board-table__th--pepjeu">Pépites jeu</th>';
        html += '<th class="board-table__th board-table__th--kamatrix">Kamatrix</th>';
        html += '</tr></thead>';
        html += '<tbody>';

        var esc = window.REN.escapeHtml;
        players.forEach(function (p) {
            /* Récompense PVP : affiche le choix du joueur (percos, pépites ou jetons) */
            var rewardPvp = '\u2014';
            var pref = p.preference_recompense || 'percos';
            if (pref === 'pepites' && p.recompense_pepites > 0) {
                rewardPvp = formatNumber(p.recompense_pepites) + ' <img class="icon-inline" src="assets/images/pepite.png" alt="">';
            } else if (pref === 'jetons' && (p.jetons_reward || 0) > 0) {
                rewardPvp = '+' + p.jetons_reward + ' <img class="icon-inline" src="assets/images/jeton.png" alt="">';
            } else if (p.recompense_percepteurs > 0) {
                rewardPvp = '+' + p.recompense_percepteurs + ' <img class="icon-inline icon-inline--perco" src="assets/images/percepteur.png" alt="">';
            } else if (p.recompense_pepites > 0) {
                rewardPvp = formatNumber(p.recompense_pepites) + ' <img class="icon-inline" src="assets/images/pepite.png" alt="">';
            }

            var pepJeuText = p.pepites_jeu > 0 ? formatNumber(p.pepites_jeu) + ' <img class="icon-inline" src="assets/images/pepite.png" alt="">' : '—';
            var kamatrixText = p.kamatrix > 0 ? formatNumber(p.kamatrix) + ' <img class="icon-inline" src="assets/images/kamatrix.png" alt="">' : '—';

            html += '<tr class="board-table__row">';
            html += '<td class="board-table__td board-table__td--rank">' + p.rang + '</td>';
            html += '<td class="board-table__td board-table__td--name">' + esc(p.username) + '</td>';
            html += '<td class="board-table__td board-table__td--points">' + p.points + '</td>';
            html += '<td class="board-table__td board-table__td--tier">' + esc(p.tier_emoji) + ' ' + esc(p.tier_label) + '</td>';
            var showZone = p.zone_reservee && (p.is_live ? zoneEligibleMap[p.user_id] : p.points >= 75);
            html += '<td class="board-table__td board-table__td--zone">' + (showZone ? esc(p.zone_reservee) : '—') + '</td>';
            html += '<td class="board-table__td board-table__td--reward">' + rewardPvp + '</td>';
            html += '<td class="board-table__td board-table__td--pepjeu" style="color:var(--color-warning);">' + pepJeuText + '</td>';
            html += '<td class="board-table__td board-table__td--kamatrix" style="color:var(--color-warning);">' + kamatrixText + '</td>';
            html += '</tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    }

    /* === ZONES BDA === */
    async function loadZonesBda() {
        try {
            var { data } = await window.REN.supabase
                .from('zones_bda')
                .select('*')
                .order('created_at', { ascending: true });
            zonesBda = data || [];
        } catch (err) {
            console.error('[REN-BOARD] Erreur zones BDA:', err);
        }
    }

    function setupBdaModal() {
        var btn = document.getElementById('btn-zones-bda');
        var overlay = document.getElementById('modal-zones-bda');
        var closeBtn = document.getElementById('modal-bda-close');
        var listEl = document.getElementById('zones-bda-list');
        if (!btn || !overlay) return;

        /* Badge count on button */
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

    /* === UTILS === */
    function formatNumber(n) {
        return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    }

    function formatWeekLabel(debut, fin) {
        var d = new Date(debut);
        var f = new Date(fin);
        var mois = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];
        return d.getDate() + ' ' + mois[d.getMonth()] + ' — ' + f.getDate() + ' ' + mois[f.getMonth()] + ' ' + f.getFullYear();
    }

    function formatDate(date) {
        var mois = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
        return date.getDate() + ' ' + mois[date.getMonth()];
    }

})();
