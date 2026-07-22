/* ============================================ */
/* Damoclès     - Classement                   */
/* Rankings PvP : semaine, definitif, kamas    */
/* ============================================ */
(function () {
    'use strict';

    var currentTab = 'semaine';
    var pointsMap = {};

    document.addEventListener('ren:ready', init);

    async function init() {
        if (!window.REN.supabase || !window.REN.currentProfile) return;
        await loadPointsMap();
        setupTabs();
        loadTab(currentTab);
    }

    /* Charge les points PVP definitifs de chaque joueur pour afficher les badges tier */
    async function loadPointsMap() {
        try {
            var { data } = await window.REN.supabase.from('classement_pvp_definitif').select('*');
            if (data) {
                data.forEach(function (row) {
                    pointsMap[row.id] = row.points || 0;
                });
            }
        } catch (err) {
            console.warn('[REN] Points map non charge:', err);
        }
    }

    /* === TABS === */
    function setupTabs() {
        var container = document.getElementById('classement-tabs');
        if (!container) return;
        container.addEventListener('click', function (e) {
            var btn = e.target.closest('.tabs__btn');
            if (!btn) return;
            container.querySelectorAll('.tabs__btn').forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            currentTab = btn.getAttribute('data-tab');
            loadTab(currentTab);
        });
    }

    async function loadTab(tab) {
        var content = document.getElementById('classement-content');
        if (!content) return;
        content.innerHTML = '<div class="loading"><div class="spinner"></div> Chargement...</div>';

        try {
            switch (tab) {
                case 'semaine': await loadSemaine(content); break;
                case 'definitif': await loadDefinitif(content); break;
                case 'kamas': await loadKamas(content); break;
                case 'jetons': await loadJetons(content); break;
                case 'kamatrix': await loadKamatrix(content); break;
            }
        } catch (err) {
            console.error('[REN] Erreur classement:', err);
            content.innerHTML = '<p class="text-muted" style="padding:1rem;">Erreur de chargement.</p>';
        }
    }

    /* === PVP SEMAINE === */
    async function loadSemaine(container) {
        var { data, error } = await window.REN.supabase.from('classement_pvp_semaine').select('*');
        if (error) throw error;
        renderRanking(container, data || [], 'points', 'pts', 'Classement PvP - Semaine');
    }

    /* === PVP DEFINITIF === */
    async function loadDefinitif(container) {
        var { data, error } = await window.REN.supabase.from('classement_pvp_definitif').select('*');
        if (error) throw error;
        renderRanking(container, data || [], 'points', 'pts', 'Classement PvP - Definitif');
    }

    /* === KAMAS === */
    async function loadKamas(container) {
        var [joueurRes, allianceRes] = await Promise.all([
            window.REN.supabase.from('classement_kamas_joueur').select('*'),
            window.REN.supabase.from('classement_kamas_alliance').select('*')
        ]);

        var html = '<div class="ranking-split">';

        /* Kamas par joueur */
        html += '<div>';
        html += '<div class="ranking-split__title">Par Joueur</div>';
        html += buildRankingList(joueurRes.data || [], 'total_kamas', 'K', true);
        html += '</div>';

        /* Kamas par alliance */
        html += '<div>';
        html += '<div class="ranking-split__title">Par Alliance</div>';
        html += buildAllianceRankingList(allianceRes.data || []);
        html += '</div>';

        html += '</div>';
        container.innerHTML = html;
    }

    /* === JETONS === */
    async function loadJetons(container) {
        var { data, error } = await window.REN.supabase.from('classement_jetons').select('*');
        if (error) throw error;
        renderRanking(container, data || [], 'jetons', 'jetons', 'Classement Jetons');
    }

    /* === KAMATRIX === */
    async function loadKamatrix(container) {
        var { data, error } = await window.REN.supabase.from('profiles').select('id, username, jetons_slot').order('jetons_slot', { ascending: false });
        if (error) throw error;
        var filtered = (data || []).filter(function (r) { return r.jetons_slot > 0; });
        renderRanking(container, filtered, 'jetons_slot', 'kamatrix', 'Classement Kamatrix');
    }

    /* === RENDER === */
    function renderRanking(container, data, valueKey, suffix, title) {
        if (!data.length) {
            container.innerHTML = '<p class="text-muted" style="padding:1rem;">Aucune donnee pour le moment.</p>';
            return;
        }
        var html = '<div class="ranking-list">';
        data.forEach(function (row, i) {
            var rankClass = i === 0 ? ' ranking-item--gold' : i === 1 ? ' ranking-item--silver' : i === 2 ? ' ranking-item--bronze' : '';
            var medal = i === 0 ? '&#129351;' : i === 1 ? '&#129352;' : i === 2 ? '&#129353;' : '#' + (i + 1);
            var value = valueKey === 'total_kamas' ? window.REN.formatKamas(row[valueKey]) : row[valueKey];
            var totalPts = pointsMap[row.id] || 0;
            var tier = window.REN.getTierFromPoints(totalPts);
            html += '<div class="ranking-item' + rankClass + '">';
            html += '<div class="ranking-item__left">';
            html += '<span class="ranking-item__rank">' + medal + '</span>';
            html += '<span class="ranking-item__name">' + (row.username || 'Inconnu') + '</span>';
            html += '<span class="tier-badge tier-badge--' + tier.key + ' ranking-item__tier">' + tier.name + '</span>';
            html += '</div>';
            html += '<span class="ranking-item__value">' + value + ' ' + suffix + '</span>';
            html += '</div>';
        });
        html += '</div>';
        container.innerHTML = html;
    }

    function buildRankingList(data, valueKey, suffix, isKamas) {
        if (!data.length) return '<p class="text-muted" style="padding:0.5rem;">Aucune donnee.</p>';
        var html = '<div class="ranking-list">';
        data.forEach(function (row, i) {
            var rankClass = i === 0 ? ' ranking-item--gold' : i === 1 ? ' ranking-item--silver' : i === 2 ? ' ranking-item--bronze' : '';
            var medal = i === 0 ? '&#129351;' : i === 1 ? '&#129352;' : i === 2 ? '&#129353;' : '#' + (i + 1);
            var value = isKamas ? window.REN.formatKamas(row[valueKey]) : row[valueKey];
            var totalPts = pointsMap[row.id] || 0;
            var tier = window.REN.getTierFromPoints(totalPts);
            html += '<div class="ranking-item' + rankClass + '">';
            html += '<div class="ranking-item__left">';
            html += '<span class="ranking-item__rank">' + medal + '</span>';
            html += '<span class="ranking-item__name">' + (row.username || 'Inconnu') + '</span>';
            html += '<span class="tier-badge tier-badge--' + tier.key + ' ranking-item__tier">' + tier.name + '</span>';
            html += '</div>';
            html += '<span class="ranking-item__value">' + value + '</span>';
            html += '</div>';
        });
        html += '</div>';
        return html;
    }

    function buildAllianceRankingList(data) {
        if (!data.length) return '<p class="text-muted" style="padding:0.5rem;">Aucune donnee.</p>';
        var html = '<div class="ranking-list">';
        data.forEach(function (row, i) {
            var rankClass = i === 0 ? ' ranking-item--gold' : i === 1 ? ' ranking-item--silver' : i === 2 ? ' ranking-item--bronze' : '';
            var medal = i === 0 ? '&#129351;' : i === 1 ? '&#129352;' : i === 2 ? '&#129353;' : '#' + (i + 1);
            html += '<div class="ranking-item' + rankClass + '">';
            html += '<div class="ranking-item__left">';
            html += '<span class="ranking-item__rank">' + medal + '</span>';
            html += '<span class="ranking-item__name">' + (row.alliance_nom || row.alliance_ennemie_nom || 'Inconnu') + '</span>';
            html += '</div>';
            html += '<span class="ranking-item__value">' + window.REN.formatKamas(row.total_kamas) + '</span>';
            html += '</div>';
        });
        html += '</div>';
        return html;
    }
})();
