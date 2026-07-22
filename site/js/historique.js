/* ============================================ */
/* Damoclès     - Historique                   */
/* Historique de tous les combats              */
/* ============================================ */
(function () {
    'use strict';

    var currentFilter = 'tous';
    var searchAlliance = '';
    var searchZone = '';
    var allCombats = [];

    document.addEventListener('ren:ready', init);

    async function init() {
        if (!window.REN.supabase || !window.REN.currentProfile) return;
        setupTabs();
        setupSearchFilters();
        await loadCombats();
    }

    function setupTabs() {
        var container = document.getElementById('history-tabs');
        if (!container) return;
        container.addEventListener('click', function (e) {
            var btn = e.target.closest('.tabs__btn');
            if (!btn) return;
            container.querySelectorAll('.tabs__btn').forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            currentFilter = btn.getAttribute('data-tab');
            renderCombats();
        });
    }

    function setupSearchFilters() {
        var allianceInput = document.getElementById('history-search-alliance');
        var zoneInput = document.getElementById('history-search-zone');

        if (allianceInput) {
            allianceInput.addEventListener('input', function () {
                searchAlliance = allianceInput.value.trim().toLowerCase();
                renderCombats();
            });
        }
        if (zoneInput) {
            zoneInput.addEventListener('input', function () {
                searchZone = zoneInput.value.trim().toLowerCase();
                renderCombats();
            });
        }
    }

    async function loadCombats() {
        try {
            var { data, error } = await window.REN.supabase
                .from('combats')
                .select('*, auteur:profiles!auteur_id(username), alliance:alliances(nom, tag), participants:combat_participants(user:profiles(username))')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;
            allCombats = data || [];
            renderCombats();
        } catch (err) {
            console.error('[REN] Erreur historique:', err);
            var grid = document.getElementById('history-grid');
            if (grid) grid.innerHTML = '<p class="text-muted" style="padding:1rem;">Erreur de chargement.</p>';
        }
    }

    function renderCombats() {
        var grid = document.getElementById('history-grid');
        if (!grid) return;

        var isAdmin = window.REN.currentProfile && window.REN.currentProfile.is_admin;

        var filtered = allCombats.filter(function (c) {
            /* Filtre type/resultat */
            switch (currentFilter) {
                case 'attaques': if (c.type !== 'attaque') return false; break;
                case 'defenses': if (c.type !== 'defense') return false; break;
                case 'victoires': if (c.resultat !== 'victoire') return false; break;
                case 'defaites': if (c.resultat !== 'defaite') return false; break;
            }
            /* Filtre alliance */
            if (searchAlliance) {
                var allianceName = c.alliance ? c.alliance.nom : (c.alliance_ennemie_nom || '');
                var allianceTag = c.alliance && c.alliance.tag ? c.alliance.tag : '';
                if (allianceName.toLowerCase().indexOf(searchAlliance) === -1 && allianceTag.toLowerCase().indexOf(searchAlliance) === -1) return false;
            }
            /* Filtre zone (dans commentaire) */
            if (searchZone) {
                var comment = (c.commentaire || '').toLowerCase();
                if (comment.indexOf(searchZone) === -1) return false;
            }
            return true;
        });

        if (!filtered.length) {
            grid.innerHTML = '<p class="text-muted" style="padding:1rem;">Aucun combat trouve.</p>';
            return;
        }

        var html = '';
        var esc = window.REN.escapeHtml;
        filtered.forEach(function (c) {
            var safeType = esc(c.type);
            var safeResultat = esc(c.resultat);
            var badgeType = '<span class="badge badge--' + safeType + '">' + safeType.toUpperCase() + '</span>';
            var badgeResult = '<span class="badge badge--' + safeResultat + '">' + safeResultat.toUpperCase() + '</span>';
            var auteur = c.auteur ? esc(c.auteur.username) : 'Inconnu';
            var alliance = c.alliance ? esc(c.alliance.nom) + (c.alliance.tag ? ' [' + esc(c.alliance.tag) + ']' : '') : esc(c.alliance_ennemie_nom || 'N/A');

            var participants = [];
            if (c.participants) {
                c.participants.forEach(function (p) {
                    if (p.user) participants.push(esc(p.user.username));
                });
            }

            html += '<div class="history-card">';
            if (isAdmin) {
                html += '<button class="history-card__delete" data-id="' + c.id + '" title="Supprimer ce combat">&times;</button>';
            }
            html += '<div class="history-card__header">' + badgeType + ' ' + badgeResult + '</div>';
            html += '<div class="history-card__body">';
            html += '<strong>' + auteur + '</strong> vs <strong>' + alliance + '</strong><br>';
            html += c.nb_allies + 'v' + c.nb_ennemis;
            if (c.butin_kamas > 0) html += ' &mdash; Butin: <span class="text-warning">' + window.REN.formatKamas(c.butin_kamas) + '</span>';
            if (c.points_gagnes !== 0) html += ' &mdash; <span class="' + (c.points_gagnes > 0 ? 'text-success' : 'text-danger') + '">' + (c.points_gagnes > 0 ? '+' : '') + c.points_gagnes + ' pts</span>';
            if (participants.length > 1) {
                html += '<br><span class="text-muted">Avec: ' + participants.filter(function(p) { return p !== auteur; }).join(', ') + '</span>';
            }
            if (c.commentaire) {
                html += '<br><span class="text-muted">&#128205; ' + esc(c.commentaire) + '</span>';
            }
            html += '</div>';
            html += '<div class="history-card__footer">' + window.REN.formatDateFull(c.created_at) + '</div>';
            html += '</div>';
        });

        grid.innerHTML = html;

        /* Admin : listeners suppression */
        if (isAdmin) {
            grid.querySelectorAll('.history-card__delete').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var combatId = parseInt(btn.dataset.id);
                    deleteCombat(combatId);
                });
            });
        }
    }

    /* === SUPPRESSION COMBAT (admin) === */
    async function deleteCombat(combatId) {
        if (!confirm('Supprimer ce combat ? Les stats seront recalculees.')) return;
        try {
            var { error } = await window.REN.supabase
                .from('combats')
                .delete()
                .eq('id', combatId);
            if (error) throw error;

            allCombats = allCombats.filter(function (c) { return c.id !== combatId; });
            renderCombats();
            window.REN.toast('Combat supprime.', 'success');
        } catch (err) {
            console.error('[REN] Erreur suppression combat:', err);
            window.REN.toast('Erreur : ' + err.message, 'error');
        }
    }
})();
