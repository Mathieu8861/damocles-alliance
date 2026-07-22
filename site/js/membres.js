/* ============================================ */
/* Damoclès     - Membres                      */
/* Liste des membres avec stats                */
/* ============================================ */
(function () {
    'use strict';

    var allMembers = [];

    document.addEventListener('ren:ready', init);

    async function init() {
        if (!window.REN.supabase || !window.REN.currentProfile) return;
        setupSearch();
        await loadMembers();
    }

    function setupSearch() {
        var input = document.getElementById('search-members');
        if (!input) return;
        input.addEventListener('input', function () {
            var query = input.value.toLowerCase().trim();
            renderMembers(query);
        });
    }

    async function loadMembers() {
        var grid = document.getElementById('member-grid');
        if (!grid) return;

        try {
            var { data, error } = await window.REN.supabase.rpc('get_member_stats');
            if (error) throw error;
            allMembers = data || [];
            renderMembers('');
        } catch (err) {
            console.error('[REN] Erreur membres:', err);
            grid.innerHTML = '<p class="text-muted" style="padding:1rem;">Erreur de chargement.</p>';
        }
    }

    function renderMembers(query) {
        var grid = document.getElementById('member-grid');
        if (!grid) return;

        var filtered = allMembers;
        if (query) {
            filtered = allMembers.filter(function (m) {
                return m.username.toLowerCase().includes(query) ||
                    (m.classe && m.classe.toLowerCase().includes(query)) ||
                    (m.mules && m.mules.some(function (mule) { return mule.toLowerCase().includes(query); }));
            });
        }

        if (!filtered.length) {
            grid.innerHTML = '<p class="text-muted" style="padding:1rem;">Aucun membre trouve.</p>';
            return;
        }

        var esc = window.REN.escapeHtml;
        var html = '';
        filtered.forEach(function (m) {
            var totalCombats = (m.total_attaques || 0) + (m.total_defenses || 0);
            var totalVictoires = (m.victoires_attaque || 0) + (m.victoires_defense || 0);
            var winrate = totalCombats > 0 ? Math.round(totalVictoires / totalCombats * 100) : 0;

            var tier = window.REN.getTierFromPoints(m.total_points);
            var wrClass = winrate >= 50 ? ' member-card__stat-value--success' : ' member-card__stat-value--danger';

            html += '<div class="member-card">';

            /* Header : avatar + identite */
            html += '<div class="member-card__header">';
            html += '<div class="member-card__avatar">';
            html += window.REN.buildAvatarFrame(m.avatar_url, m.total_points);
            html += '</div>';
            html += '<div class="member-card__identity">';
            html += '<div class="member-card__name">' + esc(m.username) + '</div>';
            html += '<div class="member-card__class">' + esc(m.classe || '?') + ' &bull; ' + esc(m.element || '?') + '</div>';
            html += '<span class="tier-badge tier-badge--' + esc(tier.key) + '">' + esc(tier.name) + '</span>';
            html += '</div>';
            html += '</div>';

            if (m.mules && m.mules.length > 0) {
                html += '<div class="member-card__mules">Mules : ' + m.mules.map(esc).join(', ') + '</div>';
            }

            /* Stats 4 colonnes */
            html += '<div class="member-card__stats">';
            html += '<div class="member-card__stat"><span class="member-card__stat-label">ATK</span><span class="member-card__stat-value">' + (m.total_attaques || 0) + '</span></div>';
            html += '<div class="member-card__stat"><span class="member-card__stat-label">DEF</span><span class="member-card__stat-value">' + (m.total_defenses || 0) + '</span></div>';
            html += '<div class="member-card__stat"><span class="member-card__stat-label">Winrate</span><span class="member-card__stat-value' + wrClass + '">' + winrate + '%</span></div>';
            html += '<div class="member-card__stat"><span class="member-card__stat-label">Points</span><span class="member-card__stat-value member-card__stat-value--accent">' + (m.total_points || 0) + '</span></div>';
            html += '</div>';

            /* Infos secondaires */
            html += '<div class="member-card__info">';
            html += '<div class="member-card__info-item"><span class="member-card__info-label">Jetons</span><span class="member-card__info-value">' + (m.jetons || 0) + '</span></div>';
            if (m.total_kamas > 0) {
                html += '<div class="member-card__info-item"><span class="member-card__info-label">Kamas</span><span class="member-card__info-value text-warning">' + window.REN.formatKamas(m.total_kamas) + '</span></div>';
            }
            html += '</div>';

            /* Lien Dofusbook */
            var safeUrl = window.REN.sanitizeUrl(m.dofusbook_url);
            if (safeUrl) {
                html += '<a href="' + esc(safeUrl) + '" target="_blank" rel="noopener" class="member-card__dofusbook">';
                html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
                html += ' Dofusbook';
                html += '</a>';
            }

            html += '</div>';
        });

        grid.innerHTML = html;
    }
})();
