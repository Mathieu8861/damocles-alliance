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

    document.addEventListener('ren:ready', init);

    async function init() {
        if (!window.REN.supabase || !window.REN.currentProfile) return;

        /* Secours : si l'attribution de la période n'existe pas encore, la calculer */
        try { await window.REN.supabase.rpc('attribuer_percos_periode'); } catch (e) { /* silencieux */ }

        await Promise.all([
            loadPaliers(), loadLadder(), loadReservations(),
            loadZonesBda(), loadZones(), loadMyPrefs()
        ]);

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
                + '<span class="board-bareme__label">' + esc(label) + '</span>'
                + '<span class="board-bareme__reward">' + esc(droits.join(' + ') || '—') + '</span>'
                + '</div>';
        });
        container.innerHTML = html || '<p class="text-muted">Aucun palier configuré.</p>';
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
    function renderPrefs() {
        var listEl = document.getElementById('board-prefs-list');
        var saveBtn = document.getElementById('board-prefs-save');
        if (!listEl) return;

        var esc = window.REN.escapeHtml;
        if (!myPrefs.length) {
            listEl.innerHTML = '<p class="text-muted" style="padding:var(--spacing-sm) 0;">Aucune zone dans ta liste. Ajoute tes zones préférées ci-dessous : au reset, tu recevras la mieux placée encore libre.</p>';
        } else {
            var html = '';
            myPrefs.forEach(function (p, i) {
                html += '<div class="pref-row">';
                html += '<span class="pref-row__ordre">' + (i + 1) + '</span>';
                html += '<span class="pref-row__nom notranslate">' + esc(p.nom)
                    + (p.sous_titre ? ' <span class="pref-row__lvl">' + esc(p.sous_titre) + '</span>' : '') + '</span>';
                html += '<span class="pref-row__actions">';
                html += '<button class="pref-row__btn" data-action="up" data-i="' + i + '" title="Monter"' + (i === 0 ? ' disabled' : '') + '>&#9650;</button>';
                html += '<button class="pref-row__btn" data-action="down" data-i="' + i + '" title="Descendre"' + (i === myPrefs.length - 1 ? ' disabled' : '') + '>&#9660;</button>';
                html += '<button class="pref-row__btn pref-row__btn--del" data-action="del" data-i="' + i + '" title="Retirer">&times;</button>';
                html += '</span>';
                html += '</div>';
            });
            listEl.innerHTML = html;
        }

        listEl.querySelectorAll('.pref-row__btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var i = parseInt(btn.dataset.i, 10);
                var action = btn.dataset.action;
                if (action === 'up' && i > 0) {
                    var tmp = myPrefs[i - 1]; myPrefs[i - 1] = myPrefs[i]; myPrefs[i] = tmp;
                } else if (action === 'down' && i < myPrefs.length - 1) {
                    var tmp2 = myPrefs[i + 1]; myPrefs[i + 1] = myPrefs[i]; myPrefs[i] = tmp2;
                } else if (action === 'del') {
                    myPrefs.splice(i, 1);
                }
                prefsDirty = true;
                renderPrefs();
            });
        });

        renderZoneSelect();
        if (saveBtn) saveBtn.hidden = !prefsDirty;
        bindPrefsControls();
    }

    function renderZoneSelect() {
        var select = document.getElementById('board-prefs-select');
        var filterInput = document.getElementById('board-prefs-filter');
        if (!select) return;

        var filter = (filterInput && filterInput.value || '').trim().toLowerCase();
        var taken = {};
        myPrefs.forEach(function (p) { taken[p.zone_id] = true; });

        var options = allZones.filter(function (z) {
            if (taken[z.id]) return false;
            if (filter && (z.nom + ' ' + z.sous_titre).toLowerCase().indexOf(filter) === -1) return false;
            return true;
        });

        var esc = window.REN.escapeHtml;
        function optHtml(z) {
            return '<option value="' + z.id + '">' + esc(z.nom)
                + (z.sous_titre ? ' • ' + esc(z.sous_titre) : '') + '</option>';
        }
        var principales = options.filter(function (z) { return z.categorie === 'principale'; });
        var secondaires = options.filter(function (z) { return z.categorie === 'secondaire'; });

        var html = '<option value="">Choisir une zone... (' + options.length + ')</option>';
        if (principales.length) html += '<optgroup label="Zones principales">' + principales.map(optHtml).join('') + '</optgroup>';
        if (secondaires.length) html += '<optgroup label="Zones secondaires">' + secondaires.map(optHtml).join('') + '</optgroup>';
        select.innerHTML = html;
    }

    var prefsControlsBound = false;
    function bindPrefsControls() {
        if (prefsControlsBound) return;
        prefsControlsBound = true;

        var filterInput = document.getElementById('board-prefs-filter');
        var addBtn = document.getElementById('board-prefs-add');
        var saveBtn = document.getElementById('board-prefs-save');

        if (filterInput) filterInput.addEventListener('input', renderZoneSelect);

        if (addBtn) {
            addBtn.addEventListener('click', function () {
                var select = document.getElementById('board-prefs-select');
                var zoneId = parseInt(select && select.value, 10);
                if (!zoneId) return;
                if (myPrefs.length >= 50) {
                    window.REN.toast('50 zones maximum dans la liste.', 'error');
                    return;
                }
                var zone = allZones.find(function (z) { return z.id === zoneId; });
                if (!zone) return;
                myPrefs.push({ zone_id: zone.id, nom: zone.nom, niveau_zone: zone.niveau_zone, type: zone.type });
                prefsDirty = true;
                renderPrefs();
            });
        }

        if (saveBtn) saveBtn.addEventListener('click', savePrefs);
    }

    async function savePrefs() {
        var saveBtn = document.getElementById('board-prefs-save');
        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Enregistrement...'; }
        try {
            var me = window.REN.currentProfile.id;
            var del = await window.REN.supabase.from('perco_preferences').delete().eq('user_id', me);
            if (del.error) throw del.error;

            if (myPrefs.length) {
                var rows = myPrefs.map(function (p, i) {
                    return { user_id: me, zone_id: p.zone_id, ordre: i + 1 };
                });
                var ins = await window.REN.supabase.from('perco_preferences').insert(rows);
                if (ins.error) throw ins.error;
            }

            prefsDirty = false;
            renderPrefs();
            window.REN.toast('Préférences enregistrées. Elles seront utilisées au prochain calcul d\'attribution.', 'success');
        } catch (err) {
            console.error('[REN-BOARD] Erreur sauvegarde préférences:', err);
            window.REN.toast('Erreur : ' + err.message, 'error');
        } finally {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Enregistrer mes préférences'; }
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
