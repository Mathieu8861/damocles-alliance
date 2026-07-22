/* ============================================ */
/* Recyclages percepteurs - Suivi pepites        */
/* ============================================ */
(function () {
    'use strict';

    var userId = null;
    var zones = [];
    var zonesById = {};
    var currentType = 'zone'; /* 'zone' ou 'dj' — drive le filtrage de l'autocomplete */

    /* État de chargement des panels (lazy load) */
    var loaded = { saisir: false, 'mes-stats': false, alliance: false };

    /* Cache des recyclages chargés par historique (pour filtrer côté JS) */
    var historyCache = { moi: [], alliance: [] };

    /* Cache + état de tri des tables (côté JS, instantané) */
    var tableState = {
        classement: { data: [], sort: { col: 'total_alliance', dir: 'desc' } },
        zones:      { data: [], sort: { col: 'total_plus_value', dir: 'desc' } }
    };

    document.addEventListener('ren:ready', init);

    async function init() {
        if (!window.REN.supabase || !window.REN.currentProfile) return;
        userId = window.REN.currentProfile.id;

        await loadZones();
        bindForm();
        bindTypeToggle();
        bindPreuve();
        bindTabs();
        bindMiniGoto();

        /* Panel "Saisir" actif par défaut : on charge le mini bandeau et on focus le textarea */
        loaded.saisir = true;
        await loadMiniPerso();
        focusChatTextarea();
    }

    /* === ZONES === */
    async function loadZones() {
        try {
            var { data, error } = await window.REN.supabase
                .from('zones_perco')
                .select('*')
                .eq('actif', true)
                .order('ordre', { ascending: true })
                .order('nom', { ascending: true });
            if (error) throw error;
            zones = data || [];
            zonesById = {};
            zones.forEach(function (z) { zonesById[z.id] = z; });

            setupZoneAutocomplete();
        } catch (err) {
            console.error('[REN-RECYC] Erreur zones:', err);
            window.REN.toast('Erreur chargement zones', 'error');
        }
    }

    /* === AUTOCOMPLETE ZONE === */
    function setupZoneAutocomplete() {
        var input = document.getElementById('recyc-zone-search');
        var hidden = document.getElementById('recyc-zone');
        var dropdown = document.getElementById('recyc-zone-dropdown');
        if (!input || !hidden || !dropdown) return;

        var esc = window.REN.escapeHtml;

        function norm(s) {
            return (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        }

        function showDropdown(filter) {
            var query = norm(filter);
            /* Filtrer d'abord par type actif, puis par le texte tapé */
            var matches = zones.filter(function (z) {
                if ((z.type || 'zone') !== currentType) return false;
                if (!query) return true;
                return norm(z.nom).indexOf(query) !== -1
                    || String(z.niveau_zone).indexOf(query) !== -1;
            });

            if (!matches.length) {
                var msg = currentType === 'dj'
                    ? 'Aucun donjon trouvé — ajoute-le en admin'
                    : 'Aucune zone trouvée — ajoute-la en admin';
                dropdown.innerHTML = '<div class="ally-dropdown__empty">' + msg + '</div>';
                dropdown.classList.add('active');
                return;
            }

            var html = '';
            matches.forEach(function (z) {
                var label = z.nom + ' (Niv. ' + z.niveau_zone + ' — coût ' + z.cout_pepites_pose + ' p.)';
                html += '<div class="ally-dropdown__item" data-id="' + z.id + '" data-cout="' + z.cout_pepites_pose + '" data-label="' + esc(z.nom) + '">'
                    + esc(label)
                    + '</div>';
            });
            dropdown.innerHTML = html;
            dropdown.classList.add('active');

            dropdown.querySelectorAll('.ally-dropdown__item').forEach(function (item) {
                item.addEventListener('mousedown', function (e) {
                    e.preventDefault();
                    selectZone(item.getAttribute('data-id'), item.getAttribute('data-label'), parseInt(item.getAttribute('data-cout'), 10));
                });
            });
        }

        function selectZone(id, nom, cout) {
            input.value = nom;
            hidden.value = id;
            dropdown.classList.remove('active');
            var coutInput = document.getElementById('recyc-cout');
            var coutAuto = document.getElementById('recyc-cout-auto');
            if (coutAuto) coutAuto.textContent = '(auto: ' + cout + ')';
            if (coutInput && (!coutInput.value || coutInput.dataset.autoFilled === '1')) {
                coutInput.value = cout;
                coutInput.dataset.autoFilled = '1';
            }
            updateRecap();
        }

        input.addEventListener('focus', function () {
            showDropdown(input.value);
        });
        input.addEventListener('input', function () {
            hidden.value = '';
            showDropdown(input.value);
        });
        input.addEventListener('blur', function () {
            setTimeout(function () { dropdown.classList.remove('active'); }, 150);
        });
    }

    /* === TOGGLE ZONE / DONJON === */
    function bindTypeToggle() {
        var toggle = document.getElementById('recyc-type-toggle');
        if (!toggle) return;

        toggle.addEventListener('click', function (e) {
            var btn = e.target.closest('.recyc-toggle__btn');
            if (!btn) return;
            var newType = btn.getAttribute('data-type');
            if (newType === currentType) return;

            currentType = newType;

            /* Bascule visuelle des boutons */
            toggle.querySelectorAll('.recyc-toggle__btn').forEach(function (b) {
                var active = b.getAttribute('data-type') === currentType;
                b.classList.toggle('active', active);
                b.setAttribute('aria-selected', active ? 'true' : 'false');
            });

            /* Reset la sélection courante (l'utilisateur doit re-piocher dans la nouvelle liste) */
            var search = document.getElementById('recyc-zone-search');
            var hidden = document.getElementById('recyc-zone');
            var coutAuto = document.getElementById('recyc-cout-auto');
            if (search) {
                search.value = '';
                search.placeholder = currentType === 'dj'
                    ? 'Tape pour rechercher un donjon...'
                    : 'Tape pour rechercher une zone...';
                search.focus();
            }
            if (hidden) hidden.value = '';
            if (coutAuto) coutAuto.textContent = '';
            updateRecap();
        });
    }

    /* === PREUVE (paste / file upload) === */
    var PREUVE_BUCKET = 'preuves-recyclages';
    var MAX_PREUVE_BYTES = 5 * 1024 * 1024; /* 5 Mo */

    function bindPreuve() {
        var drop = document.getElementById('recyc-preuve-drop');
        var fileInput = document.getElementById('recyc-preuve-file');
        var removeBtn = document.getElementById('recyc-preuve-remove');
        if (!drop || !fileInput) return;

        /* Click sur la zone => ouvre le file picker */
        drop.addEventListener('click', function () { fileInput.click(); });
        fileInput.addEventListener('change', function () {
            if (fileInput.files && fileInput.files[0]) handlePreuveFile(fileInput.files[0]);
        });

        /* Paste image n'importe où sur la page recyclages */
        document.addEventListener('paste', function (e) {
            if (!isOnPanelSaisir()) return;
            var items = (e.clipboardData || window.clipboardData).items;
            if (!items) return;
            for (var i = 0; i < items.length; i++) {
                if (items[i].type && items[i].type.indexOf('image') === 0) {
                    var file = items[i].getAsFile();
                    if (file) handlePreuveFile(file);
                    e.preventDefault();
                    break;
                }
            }
        });

        /* Bouton retirer */
        if (removeBtn) {
            removeBtn.addEventListener('click', resetPreuve);
        }
    }

    function isOnPanelSaisir() {
        var p = document.getElementById('panel-saisir');
        return p && !p.hasAttribute('hidden');
    }

    async function handlePreuveFile(file) {
        if (!file) return;
        if (file.size > MAX_PREUVE_BYTES) {
            window.REN.toast('Image trop lourde (>5 Mo)', 'error');
            return;
        }
        if (file.type.indexOf('image/') !== 0) {
            window.REN.toast('Le fichier doit être une image', 'error');
            return;
        }

        /* Aperçu local immédiat */
        var reader = new FileReader();
        reader.onload = function (e) {
            var img = document.getElementById('recyc-preuve-preview');
            var wrap = document.getElementById('recyc-preuve-preview-wrap');
            var drop = document.getElementById('recyc-preuve-drop');
            var status = document.getElementById('recyc-preuve-status');
            if (img) img.src = e.target.result;
            if (wrap) wrap.style.display = 'block';
            if (drop) drop.style.display = 'none';
            if (status) {
                status.textContent = 'Upload en cours…';
                status.className = 'recyc-preuve__status recyc-preuve__status--loading';
            }
        };
        reader.readAsDataURL(file);

        /* Upload vers Supabase Storage */
        try {
            var ext = (file.name && file.name.split('.').pop()) || 'png';
            var path = userId + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
            var { error: upErr } = await window.REN.supabase.storage
                .from(PREUVE_BUCKET)
                .upload(path, file, { contentType: file.type, upsert: false });
            if (upErr) throw upErr;

            var { data: urlData } = window.REN.supabase.storage
                .from(PREUVE_BUCKET)
                .getPublicUrl(path);

            document.getElementById('recyc-preuve-url').value = urlData.publicUrl;
            var status = document.getElementById('recyc-preuve-status');
            if (status) {
                status.textContent = 'Prêt ✓';
                status.className = 'recyc-preuve__status recyc-preuve__status--ok';
            }
        } catch (err) {
            console.error('[REN-RECYC] Erreur upload preuve:', err);
            window.REN.toast('Erreur upload preuve : ' + (err.message || ''), 'error');
            resetPreuve();
        }
    }

    function resetPreuve() {
        document.getElementById('recyc-preuve-url').value = '';
        var wrap = document.getElementById('recyc-preuve-preview-wrap');
        var drop = document.getElementById('recyc-preuve-drop');
        var img = document.getElementById('recyc-preuve-preview');
        var fileInput = document.getElementById('recyc-preuve-file');
        if (wrap) wrap.style.display = 'none';
        if (drop) drop.style.display = '';
        if (img) img.src = '';
        if (fileInput) fileInput.value = '';
    }

    /* === TABS PRINCIPAUX === */
    function bindTabs() {
        var tabs = document.getElementById('recyc-tabs');
        if (!tabs) return;

        tabs.addEventListener('click', function (e) {
            var btn = e.target.closest('.tabs__btn');
            if (!btn) return;
            var panel = btn.getAttribute('data-panel');
            switchPanel(panel);
        });
    }

    function bindMiniGoto() {
        document.querySelectorAll('[data-goto-panel]').forEach(function (el) {
            el.addEventListener('click', function (e) {
                e.preventDefault();
                switchPanel(el.getAttribute('data-goto-panel'));
            });
        });
    }

    async function switchPanel(panel) {
        if (!panel) return;

        /* Bascule visuelle */
        document.querySelectorAll('#recyc-tabs .tabs__btn').forEach(function (b) {
            b.classList.toggle('active', b.getAttribute('data-panel') === panel);
        });
        document.querySelectorAll('.recyc-panel').forEach(function (p) {
            var id = p.id;
            var match = id === 'panel-' + panel;
            if (match) { p.removeAttribute('hidden'); }
            else { p.setAttribute('hidden', ''); }
        });

        /* Lazy load des données */
        if (panel === 'mes-stats' && !loaded['mes-stats']) {
            loaded['mes-stats'] = true;
            await Promise.all([loadMesStats(), loadHistoriqueMoi()]);
        } else if (panel === 'alliance' && !loaded.alliance) {
            loaded.alliance = true;
            await Promise.all([loadAllianceStats(), loadClassementMembres(), loadZonesStats(), loadHistoriqueAlliance()]);
        } else if (panel === 'saisir') {
            focusChatTextarea();
        }
    }

    function focusChatTextarea() {
        var ta = document.getElementById('recyc-chat');
        if (ta) setTimeout(function () { ta.focus(); }, 50);
    }

    /* === FORM === */
    function bindForm() {
        var form = document.getElementById('recyc-form');
        var chat = document.getElementById('recyc-chat');
        var perso = document.getElementById('recyc-perso');
        var alliance = document.getElementById('recyc-alliance');
        var cout = document.getElementById('recyc-cout');
        var coutAuto = document.getElementById('recyc-cout-auto');
        var zoneSearch = document.getElementById('recyc-zone-search');
        var zoneHidden = document.getElementById('recyc-zone');
        var reset = document.getElementById('recyc-reset');

        chat.addEventListener('input', function () {
            var parsed = parseChatMessage(chat.value);
            if (parsed) {
                perso.value = parsed.perso;
                alliance.value = parsed.alliance;
                updateRecap();
            }
        });

        cout.addEventListener('input', function () {
            cout.dataset.autoFilled = '0';
            updateRecap();
        });

        perso.addEventListener('input', updateRecap);
        alliance.addEventListener('input', updateRecap);

        reset.addEventListener('click', function () {
            form.reset();
            cout.dataset.autoFilled = '0';
            coutAuto.textContent = '';
            if (zoneSearch) zoneSearch.value = '';
            if (zoneHidden) zoneHidden.value = '';
            updateRecap();
        });

        form.addEventListener('submit', onSubmit);
    }

    function parseChatMessage(text) {
        if (!text) return null;
        var re = /obtenu\s+(\d+)\s*\[?P[ée]pite[s]?\]?\s+et\s+(\d+)\s+ont\s+(?:été|ete)\s+ajout/i;
        var m = text.match(re);
        if (!m) return null;
        return { perso: parseInt(m[1], 10), alliance: parseInt(m[2], 10) };
    }

    function updateRecap() {
        var perso = parseInt(document.getElementById('recyc-perso').value, 10) || 0;
        var alliance = parseInt(document.getElementById('recyc-alliance').value, 10) || 0;
        var cout = parseInt(document.getElementById('recyc-cout').value, 10) || 0;
        var pv = perso - cout;
        var tot = perso + alliance;

        var elPv = document.getElementById('recyc-recap-pv');
        var elTot = document.getElementById('recyc-recap-tot');

        elPv.textContent = (pv >= 0 ? '+' : '') + window.REN.formatNumber(pv) + ' p.';
        elPv.className = 'recyc-recap__value ' + (pv >= 0 ? 'recyc-recap__value--positive' : 'recyc-recap__value--negative');
        elTot.textContent = window.REN.formatNumber(tot) + ' p.';
    }

    async function onSubmit(e) {
        e.preventDefault();

        var perso = parseInt(document.getElementById('recyc-perso').value, 10);
        var alliance = parseInt(document.getElementById('recyc-alliance').value, 10);
        var zoneId = parseInt(document.getElementById('recyc-zone').value, 10);
        var cout = parseInt(document.getElementById('recyc-cout').value, 10);
        var brut = document.getElementById('recyc-chat').value.trim();
        var preuveUrl = document.getElementById('recyc-preuve-url').value.trim();

        if (!zoneId) { window.REN.toast('Sélectionne une zone', 'error'); return; }
        if (isNaN(perso) || perso < 0) { window.REN.toast('Pépites perso invalides', 'error'); return; }
        if (isNaN(alliance) || alliance < 0) { window.REN.toast('Pépites alliance invalides', 'error'); return; }
        if (isNaN(cout) || cout < 0) { window.REN.toast('Coût pose invalide', 'error'); return; }

        var btn = document.getElementById('recyc-submit');
        btn.disabled = true;
        btn.textContent = 'Enregistrement…';

        try {
            var { error } = await window.REN.supabase
                .from('recyclages')
                .insert({
                    user_id: userId,
                    zone_id: zoneId,
                    pepites_perso: perso,
                    pepites_alliance: alliance,
                    cout_pose: cout,
                    message_brut: brut || null,
                    preuve_url: preuveUrl || null
                });
            if (error) throw error;

            window.REN.toast('Recyclage enregistré (+' + (perso - cout) + ' p. plus-value)', 'success');
            document.getElementById('recyc-form').reset();
            document.getElementById('recyc-cout').dataset.autoFilled = '0';
            document.getElementById('recyc-cout-auto').textContent = '';
            document.getElementById('recyc-zone-search').value = '';
            document.getElementById('recyc-zone').value = '';
            resetPreuve();
            updateRecap();

            /* Refresh : mini bandeau toujours, autres panels invalidés (reload au prochain affichage) */
            await loadMiniPerso();
            loaded['mes-stats'] = false;
            loaded.alliance = false;
        } catch (err) {
            console.error('[REN-RECYC] Erreur submit:', err);
            window.REN.toast('Erreur enregistrement', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Enregistrer';
        }
    }

    /* === MINI BANDEAU PERSO (panel Saisir) === */
    async function loadMiniPerso() {
        try {
            var { data, error } = await window.REN.supabase
                .from('v_recyclages_par_user')
                .select('nb_recyclages, total_perso')
                .eq('user_id', userId)
                .maybeSingle();
            if (error && error.code !== 'PGRST116') throw error;
            var s = data || { nb_recyclages: 0, total_perso: 0 };
            setText('mini-perso-pepites', window.REN.formatNumber(s.total_perso || 0));
            setText('mini-perso-nb', window.REN.formatNumber(s.nb_recyclages || 0));
        } catch (err) {
            console.error('[REN-RECYC] Erreur mini perso:', err);
        }
    }

    /* === STATS PERSO (panel Mes stats) === */
    async function loadMesStats() {
        try {
            var { data, error } = await window.REN.supabase
                .from('v_recyclages_par_user')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();
            if (error && error.code !== 'PGRST116') throw error;
            var s = data || { nb_recyclages: 0, total_perso: 0, total_alliance: 0, total_plus_value: 0, moy_perso_par_tir: 0 };
            setKpi('kpi-mes-nb', s.nb_recyclages);
            setKpi('kpi-mes-perso', s.total_perso);
            setKpi('kpi-mes-alliance', s.total_alliance);
            setKpiSigned('kpi-mes-pv', s.total_plus_value);
            setKpi('kpi-mes-moy', s.moy_perso_par_tir);
        } catch (err) {
            console.error('[REN-RECYC] Erreur stats perso:', err);
        }
    }

    /* === STATS ALLIANCE (panel Alliance) === */
    async function loadAllianceStats() {
        try {
            var { data, error } = await window.REN.supabase
                .from('v_recyclages_global')
                .select('*')
                .maybeSingle();
            if (error && error.code !== 'PGRST116') throw error;
            var s = data || { nb_recyclages: 0, nb_recycleurs: 0, total_perso: 0, total_alliance: 0, total_plus_value: 0 };
            setKpi('kpi-alli-nb', s.nb_recyclages);
            setKpi('kpi-alli-users', s.nb_recycleurs);
            setKpi('kpi-alli-perso', s.total_perso);
            setKpi('kpi-alli-alliance', s.total_alliance);
            setKpiSigned('kpi-alli-pv', s.total_plus_value);
        } catch (err) {
            console.error('[REN-RECYC] Erreur stats alliance:', err);
        }
    }

    /* === CLASSEMENT MEMBRES (all time) === */
    async function loadClassementMembres() {
        var tbody = document.getElementById('classement-tbody');
        if (!tbody) return;
        try {
            var { data, error } = await window.REN.supabase
                .from('v_recyclages_par_user')
                .select('*');
            if (error) throw error;
            tableState.classement.data = data || [];
            bindTableSort('classement-table', 'classement', renderClassement);
            renderClassement();
        } catch (err) {
            console.error('[REN-RECYC] Erreur classement membres:', err);
            tbody.innerHTML = '<tr><td colspan="7" class="text-muted text-center">Erreur chargement.</td></tr>';
        }
    }

    function renderClassement() {
        var tbody = document.getElementById('classement-tbody');
        if (!tbody) return;
        var data = sortRows(tableState.classement.data, tableState.classement.sort);

        if (!data.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-muted text-center" style="padding:var(--spacing-lg);">Aucun recyclage enregistré pour le moment.</td></tr>';
            updateSortIndicators('classement-table', tableState.classement.sort);
            return;
        }

        var esc = window.REN.escapeHtml;
        var fmt = window.REN.formatNumber;
        var html = '';
        data.forEach(function (m, i) {
            var rank = i + 1;
            var pv = m.total_plus_value || 0;
            var pvCls = pv > 0 ? 'recyc-pv--positive' : (pv < 0 ? 'recyc-pv--negative' : 'recyc-pv--neutral');
            var pvText = (pv >= 0 ? '+' : '') + fmt(pv);
            var isMe = m.user_id === userId;
            html += '<tr' + (isMe ? ' style="background:rgba(219,41,41,0.06);"' : '') + '>'
                + '<td><strong>' + rank + '</strong></td>'
                + '<td><strong>' + esc(m.username || '?') + '</strong>' + (isMe ? ' <span class="text-muted" style="font-size:0.7rem;">(vous)</span>' : '') + '</td>'
                + '<td class="recyc-num">' + fmt(m.nb_recyclages || 0) + '</td>'
                + '<td class="recyc-num" style="color:var(--color-warning);font-weight:700;">' + fmt(m.total_alliance || 0) + '</td>'
                + '<td class="recyc-num" style="color:var(--color-success);">' + fmt(m.total_perso || 0) + '</td>'
                + '<td class="recyc-num ' + pvCls + '">' + pvText + '</td>'
                + '<td class="recyc-num">' + fmt(m.moy_perso_par_tir || 0) + '</td>'
                + '</tr>';
        });
        tbody.innerHTML = html;
        updateSortIndicators('classement-table', tableState.classement.sort);
    }

    /* === TRI GÉNÉRIQUE === */

    /* Compare 2 valeurs (numérique ou texte), null/undefined en dernier */
    function sortRows(rows, sortConfig) {
        var col = sortConfig.col;
        var dir = sortConfig.dir === 'asc' ? 1 : -1;
        var copy = rows.slice();
        copy.sort(function (a, b) {
            var va = a[col];
            var vb = b[col];
            /* null/undefined toujours en bas */
            if (va === null || va === undefined) return 1;
            if (vb === null || vb === undefined) return -1;
            if (typeof va === 'number' && typeof vb === 'number') {
                return (va - vb) * dir;
            }
            return String(va).localeCompare(String(vb), 'fr', { numeric: true }) * dir;
        });
        return copy;
    }

    /* Bind les clicks de tri sur les <th data-sort> d'une table */
    var sortBound = {};
    function bindTableSort(tableId, stateKey, renderFn) {
        if (sortBound[tableId]) return;
        sortBound[tableId] = true;
        var table = document.getElementById(tableId);
        if (!table) return;
        table.querySelectorAll('th[data-sort]').forEach(function (th) {
            /* Injecter un span indicateur inline (badge) si pas déjà présent */
            if (!th.querySelector('.recyc-th-sort__indicator')) {
                var span = document.createElement('span');
                span.className = 'recyc-th-sort__indicator';
                span.textContent = '↕'; /* ↕ */
                th.appendChild(span);
            }
            th.addEventListener('click', function () {
                var col = th.getAttribute('data-sort');
                var state = tableState[stateKey].sort;
                if (state.col === col) {
                    state.dir = state.dir === 'desc' ? 'asc' : 'desc';
                } else {
                    state.col = col;
                    /* Texte par défaut asc, numérique par défaut desc */
                    state.dir = (col === 'zone_nom' || col === 'username') ? 'asc' : 'desc';
                }
                renderFn();
            });
        });
    }

    /* Met à jour les indicateurs visuels ↑↓ sur les <th> */
    function updateSortIndicators(tableId, sort) {
        var table = document.getElementById(tableId);
        if (!table) return;
        table.querySelectorAll('th[data-sort]').forEach(function (th) {
            var col = th.getAttribute('data-sort');
            var isActive = (col === sort.col);
            th.classList.toggle('recyc-th-sort--active', isActive);
            var ind = th.querySelector('.recyc-th-sort__indicator');
            if (ind) {
                if (isActive) {
                    ind.textContent = sort.dir === 'asc' ? '↑' : '↓'; /* ↑ ↓ */
                } else {
                    ind.textContent = '↕'; /* ↕ */
                }
            }
        });
    }

    function setKpi(id, val) {
        var el = document.getElementById(id);
        if (el) el.textContent = window.REN.formatNumber(val || 0);
    }
    function setKpiSigned(id, val) {
        var el = document.getElementById(id);
        if (!el) return;
        var v = val || 0;
        el.textContent = (v >= 0 ? '+' : '') + window.REN.formatNumber(v);
        el.classList.remove('recyc-kpi__value--green', 'recyc-kpi__value--negative');
        el.classList.add(v >= 0 ? 'recyc-kpi__value--green' : 'recyc-kpi__value--negative');
    }
    function setText(id, val) {
        var el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    /* === STATS PAR ZONE (panel Alliance) ===                       */
    /* On masque les zones à 0 tir pour ne pas polluer le classement */
    async function loadZonesStats() {
        var tbody = document.getElementById('zones-tbody');
        try {
            var { data, error } = await window.REN.supabase
                .from('v_recyclages_par_zone')
                .select('*');
            if (error) throw error;
            tableState.zones.data = (data || []).filter(function (z) { return (z.nb_recyclages || 0) > 0; });
            bindTableSort('zones-table', 'zones', renderZones);
            renderZones();
        } catch (err) {
            console.error('[REN-RECYC] Erreur stats zones:', err);
            tbody.innerHTML = '<tr><td colspan="8" class="text-muted text-center">Erreur chargement.</td></tr>';
        }
    }

    function renderZones() {
        var tbody = document.getElementById('zones-tbody');
        if (!tbody) return;
        var data = sortRows(tableState.zones.data, tableState.zones.sort);

        if (!data.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-muted text-center" style="padding:var(--spacing-lg);">Aucun recyclage enregistré pour le moment.</td></tr>';
            updateSortIndicators('zones-table', tableState.zones.sort);
            return;
        }

        var fmt = window.REN.formatNumber;
        var esc = window.REN.escapeHtml;
        var html = '';
        data.forEach(function (z) {
            var pv = z.total_plus_value || 0;
            var pvCls = pv > 0 ? 'recyc-pv--positive' : (pv < 0 ? 'recyc-pv--negative' : 'recyc-pv--neutral');
            var pvText = (pv >= 0 ? '+' : '') + fmt(pv);
            html += '<tr>'
                + '<td><strong>' + esc(z.zone_nom) + '</strong></td>'
                + '<td class="recyc-num">' + z.niveau_zone + '</td>'
                + '<td class="recyc-num"><span class="recyc-pill">' + z.cout_pepites_pose + ' p.</span></td>'
                + '<td class="recyc-num">' + (z.nb_recyclages || 0) + '</td>'
                + '<td class="recyc-num">' + fmt(z.total_perso || 0) + '</td>'
                + '<td class="recyc-num">' + fmt(z.total_alliance || 0) + '</td>'
                + '<td class="recyc-num ' + pvCls + '">' + pvText + '</td>'
                + '<td class="recyc-num">' + fmt(z.moy_perso_par_tir || 0) + '</td>'
                + '</tr>';
        });
        tbody.innerHTML = html;
        updateSortIndicators('zones-table', tableState.zones.sort);
    }

    /* === HISTORIQUES === */
    async function loadHistoriqueMoi() {
        var container = document.getElementById('recyc-history-moi');
        if (!container) return;
        try {
            var { data, error } = await window.REN.supabase
                .from('recyclages')
                .select('id, user_id, zone_id, pepites_perso, pepites_alliance, cout_pose, plus_value, note, preuve_url, created_at, profiles:user_id(username, avatar_url), zones_perco:zone_id(nom, niveau_zone)')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(200);
            if (error) throw error;
            historyCache.moi = data || [];
            populateZoneFilter('moi');
            bindFilters('moi', true);
            applyFilters('moi');
        } catch (err) {
            console.error('[REN-RECYC] Erreur historique perso:', err);
            container.innerHTML = '<p class="text-muted">Erreur de chargement.</p>';
        }
    }

    async function loadHistoriqueAlliance() {
        var container = document.getElementById('recyc-history-alliance');
        if (!container) return;
        try {
            var { data, error } = await window.REN.supabase
                .from('recyclages')
                .select('id, user_id, zone_id, pepites_perso, pepites_alliance, cout_pose, plus_value, note, preuve_url, created_at, profiles:user_id(username, avatar_url), zones_perco:zone_id(nom, niveau_zone)')
                .order('created_at', { ascending: false })
                .limit(200);
            if (error) throw error;
            historyCache.alliance = data || [];
            populateZoneFilter('alliance');
            bindFilters('alliance', false);
            applyFilters('alliance');
        } catch (err) {
            console.error('[REN-RECYC] Erreur historique alliance:', err);
            container.innerHTML = '<p class="text-muted">Erreur de chargement.</p>';
        }
    }

    /* === FILTRES (zone + dates) === */

    /* Populate le select zone avec les zones effectivement utilisées dans l'historique */
    function populateZoneFilter(key) {
        var sel = document.getElementById('filter-zone-' + key);
        if (!sel) return;

        var current = sel.value; /* preserver la sélection si déjà active */
        var items = historyCache[key];
        var noms = {};
        items.forEach(function (r) {
            var nom = (r.zones_perco && r.zones_perco.nom) || '?';
            noms[nom] = true;
        });
        var sorted = Object.keys(noms).sort(function (a, b) { return a.localeCompare(b); });

        var html = '<option value="">Toutes</option>';
        sorted.forEach(function (n) {
            html += '<option value="' + window.REN.escapeHtml(n) + '">' + window.REN.escapeHtml(n) + '</option>';
        });
        sel.innerHTML = html;
        if (current) sel.value = current;
    }

    /* Bind les listeners des filtres (une seule fois par historique) */
    var filtersBound = { moi: false, alliance: false };
    function bindFilters(key, isMine) {
        if (filtersBound[key]) return;
        filtersBound[key] = true;

        var ids = ['filter-zone-', 'filter-date-from-', 'filter-date-to-'];
        ids.forEach(function (prefix) {
            var el = document.getElementById(prefix + key);
            if (el) el.addEventListener('change', function () { applyFilters(key); });
        });

        var reset = document.getElementById('filter-reset-' + key);
        if (reset) {
            reset.addEventListener('click', function () {
                document.getElementById('filter-zone-' + key).value = '';
                document.getElementById('filter-date-from-' + key).value = '';
                document.getElementById('filter-date-to-' + key).value = '';
                applyFilters(key);
            });
        }
    }

    function applyFilters(key) {
        var container = document.getElementById('recyc-history-' + key);
        var countEl = document.getElementById('filter-count-' + key);
        var items = historyCache[key] || [];
        var isMine = (key === 'moi');

        var zoneFilter = (document.getElementById('filter-zone-' + key) || {}).value || '';
        var dateFromRaw = (document.getElementById('filter-date-from-' + key) || {}).value || '';
        var dateToRaw = (document.getElementById('filter-date-to-' + key) || {}).value || '';

        /* Convertir en bornes ms (date "Au" = fin de journée locale 23:59:59) */
        var fromTs = dateFromRaw ? new Date(dateFromRaw + 'T00:00:00').getTime() : null;
        var toTs = dateToRaw ? new Date(dateToRaw + 'T23:59:59.999').getTime() : null;

        var filtered = items.filter(function (r) {
            if (zoneFilter) {
                var nom = (r.zones_perco && r.zones_perco.nom) || '';
                if (nom !== zoneFilter) return false;
            }
            if (fromTs !== null || toTs !== null) {
                var ts = new Date(r.created_at).getTime();
                if (fromTs !== null && ts < fromTs) return false;
                if (toTs !== null && ts > toTs) return false;
            }
            return true;
        });

        if (countEl) {
            countEl.textContent = filtered.length === items.length
                ? items.length + ' recyclage' + (items.length > 1 ? 's' : '')
                : filtered.length + ' / ' + items.length;
        }

        renderHistorique(container, filtered, isMine);
    }

    function renderHistorique(container, items, showDeleteForMine) {
        if (!items.length) {
            container.innerHTML = '<p class="text-muted text-center" style="padding:var(--spacing-lg);">Aucun recyclage pour le moment.</p>';
            return;
        }

        var html = '';
        items.forEach(function (r) {
            var prof = r.profiles || {};
            var zone = r.zones_perco || {};
            var pv = r.plus_value || 0;
            var pvCls = pv > 0 ? 'recyc-pv--positive' : (pv < 0 ? 'recyc-pv--negative' : 'recyc-pv--neutral');
            var isMine = r.user_id === userId;
            var deleteBtn = (showDeleteForMine && isMine)
                ? '<button class="recyc-history__del" data-id="' + r.id + '" title="Supprimer">'
                    + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>'
                    + '</button>'
                : '';

            var preuveBadge = r.preuve_url
                ? '<a class="recyc-history__preuve" href="' + window.REN.escapeHtml(r.preuve_url) + '" target="_blank" rel="noopener" title="Voir la preuve">'
                    + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
                    + 'Vérifié'
                  + '</a>'
                : '';

            html += '<div class="recyc-history__row">'
                + '<div class="recyc-history__user">'
                    + '<span class="recyc-history__username">' + window.REN.escapeHtml(prof.username || '?') + '</span>'
                    + '<span class="recyc-history__date">' + window.REN.formatDate(r.created_at) + '</span>'
                + '</div>'
                + '<div class="recyc-history__zone">'
                    + '<strong>' + window.REN.escapeHtml(zone.nom || '?') + '</strong>'
                    + '<small class="text-muted"> · Niv. ' + (zone.niveau_zone || '?') + '</small>'
                    + (preuveBadge ? ' ' + preuveBadge : '')
                + '</div>'
                + '<div class="recyc-history__stats">'
                    + '<span class="recyc-pill recyc-pill--green" title="Pépites perso">' + window.REN.formatNumber(r.pepites_perso) + '</span>'
                    + '<span class="recyc-pill recyc-pill--gold" title="Pépites alliance">' + window.REN.formatNumber(r.pepites_alliance) + '</span>'
                    + '<span class="recyc-pill" title="Coût pose">−' + window.REN.formatNumber(r.cout_pose) + '</span>'
                    + '<span class="recyc-pill ' + pvCls + '" title="Plus-value">' + (pv >= 0 ? '+' : '') + window.REN.formatNumber(pv) + '</span>'
                + '</div>'
                + (r.note ? '<div class="recyc-history__note">' + window.REN.escapeHtml(r.note) + '</div>' : '')
                + deleteBtn
                + '</div>';
        });
        container.innerHTML = html;

        container.querySelectorAll('.recyc-history__del').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var id = parseInt(btn.getAttribute('data-id'), 10);
                onDelete(id);
            });
        });
    }

    async function onDelete(id) {
        if (!id) return;
        if (!confirm('Supprimer ce recyclage ?')) return;
        try {
            var { error } = await window.REN.supabase
                .from('recyclages')
                .delete()
                .eq('id', id);
            if (error) throw error;
            window.REN.toast('Recyclage supprimé', 'success');

            /* Refresh mini bandeau + invalidate les autres panels */
            await loadMiniPerso();
            await loadMesStats();
            await loadHistoriqueMoi();
            loaded.alliance = false;
        } catch (err) {
            console.error('[REN-RECYC] Erreur delete:', err);
            window.REN.toast('Erreur suppression', 'error');
        }
    }
})();
