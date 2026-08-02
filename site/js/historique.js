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
            /* Edition : admin sans limite ; l'auteur pendant 3h apres la declaration */
            var me = window.REN.currentProfile;
            var canEdit = isAdmin || (me && c.auteur_id === me.id && (Date.now() - new Date(c.created_at).getTime()) < 3 * 3600 * 1000);
            if (isAdmin) {
                html += '<button class="history-card__delete" data-id="' + c.id + '" title="Supprimer ce combat">&times;</button>';
            }
            if (canEdit) {
                html += '<button class="history-card__edit" data-id="' + c.id + '"' + (isAdmin ? '' : ' style="right:8px;"') + ' title="Modifier ce combat">&#9998;</button>';
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
            if (c.invites && c.invites.length) {
                html += '<br><span class="text-muted">Invités hors site : ' + c.invites.map(function (n) { return esc(n); }).join(', ') + '</span>';
            }
            if (c.commentaire) {
                html += '<br><span class="text-muted">&#128205; ' + esc(c.commentaire) + '</span>';
            }
            if (c.preuve_url_1 || c.preuve_url_2) {
                html += '<div class="history-card__preuves">';
                [c.preuve_url_1, c.preuve_url_2].forEach(function (u, idx) {
                    if (!u) return;
                    var su = window.REN.sanitizeUrl ? window.REN.sanitizeUrl(u) : u;
                    html += '<a class="history-card__preuve-thumb js-lightbox" href="' + esc(su) + '" target="_blank" rel="noopener" title="Screenshot ' + (idx + 1) + '">'
                        + '<img src="' + esc(su) + '" alt="Screenshot ' + (idx + 1) + '" loading="lazy">'
                        + '</a>';
                });
                html += '</div>';
            }
            html += '</div>';
            html += '<div class="history-card__footer">' + window.REN.formatDateFull(c.created_at) + '</div>';
            html += '</div>';
        });

        grid.innerHTML = html;

        /* Listeners : suppression (admin) + modification (admin ou auteur < 3h) */
        if (isAdmin) {
            grid.querySelectorAll('.history-card__delete').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var combatId = parseInt(btn.dataset.id);
                    deleteCombat(combatId);
                });
            });
        }
        grid.querySelectorAll('.history-card__edit').forEach(function (btn) {
            btn.addEventListener('click', function () {
                openEditModal(parseInt(btn.dataset.id));
            });
        });
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

    /* === MODIFICATION COMBAT (admin) === */
    var editingCombat = null;

    function ensureEditModal() {
        if (document.getElementById('history-edit-modal')) return;
        var overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'history-edit-modal';
        overlay.innerHTML =
            '<div class="modal" style="max-width:520px;">'
            + '<div class="modal__header">'
            +   '<h2 class="modal__title">Modifier le combat</h2>'
            +   '<button class="modal__close" id="history-edit-close">&times;</button>'
            + '</div>'
            + '<div class="form-row">'
            +   '<div class="form-group"><label class="form-label">Type</label>'
            +     '<select id="edit-combat-type" class="form-select"><option value="attaque">Attaque</option><option value="defense">Défense</option></select></div>'
            +   '<div class="form-group"><label class="form-label">Résultat</label>'
            +     '<select id="edit-combat-resultat" class="form-select"><option value="victoire">Victoire</option><option value="defaite">Défaite</option></select></div>'
            + '</div>'
            + '<div class="form-row">'
            +   '<div class="form-group"><label class="form-label">Alliés</label><select id="edit-combat-allies" class="form-select"></select></div>'
            +   '<div class="form-group"><label class="form-label">Ennemis</label><select id="edit-combat-ennemis" class="form-select"></select></div>'
            + '</div>'
            + '<div class="form-row">'
            +   '<div class="form-group"><label class="form-label">Butin (kamas)</label><input type="number" id="edit-combat-butin" class="form-input" min="0" step="1"></div>'
            +   '<div class="form-group"><label class="form-label">Zone / commentaire</label><input type="text" id="edit-combat-commentaire" class="form-input" maxlength="120"></div>'
            + '</div>'
            + '<p class="text-muted" style="font-size:0.78rem;margin:4px 0 14px;">Les points sont recalculés automatiquement selon le barème (butin remis à 0 en cas de défaite).</p>'
            + '<div style="display:flex;gap:10px;justify-content:flex-end;">'
            +   '<button class="btn btn--secondary" id="history-edit-cancel">Annuler</button>'
            +   '<button class="btn btn--primary" id="history-edit-save">Enregistrer</button>'
            + '</div>'
            + '</div>';
        document.body.appendChild(overlay);

        for (var n = 1; n <= 5; n++) {
            document.getElementById('edit-combat-allies').add(new Option(n, n));
            document.getElementById('edit-combat-ennemis').add(new Option(n, n));
        }

        document.getElementById('history-edit-close').addEventListener('click', closeEditModal);
        document.getElementById('history-edit-cancel').addEventListener('click', closeEditModal);
        overlay.addEventListener('click', function (e) { if (e.target === overlay) closeEditModal(); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeEditModal(); });
        document.getElementById('history-edit-save').addEventListener('click', saveEditCombat);
    }

    function openEditModal(combatId) {
        editingCombat = allCombats.find(function (c) { return c.id === combatId; });
        if (!editingCombat) return;
        ensureEditModal();
        document.getElementById('edit-combat-type').value = editingCombat.type;
        document.getElementById('edit-combat-resultat').value = editingCombat.resultat;
        document.getElementById('edit-combat-allies').value = editingCombat.nb_allies;
        document.getElementById('edit-combat-ennemis').value = editingCombat.nb_ennemis;
        document.getElementById('edit-combat-butin').value = editingCombat.butin_kamas || 0;
        document.getElementById('edit-combat-commentaire').value = editingCombat.commentaire || '';
        document.getElementById('history-edit-modal').classList.add('active');
    }

    function closeEditModal() {
        var overlay = document.getElementById('history-edit-modal');
        if (overlay) overlay.classList.remove('active');
        editingCombat = null;
    }

    async function saveEditCombat() {
        if (!editingCombat) return;
        var btn = document.getElementById('history-edit-save');
        var type = document.getElementById('edit-combat-type').value;
        var resultat = document.getElementById('edit-combat-resultat').value;
        var nbAllies = parseInt(document.getElementById('edit-combat-allies').value, 10);
        var nbEnnemis = parseInt(document.getElementById('edit-combat-ennemis').value, 10);
        var butin = resultat === 'defaite' ? 0 : (parseInt(document.getElementById('edit-combat-butin').value, 10) || 0);
        var commentaire = document.getElementById('edit-combat-commentaire').value.trim() || null;

        btn.disabled = true;
        btn.textContent = 'Enregistrement...';
        try {
            /* Recalcul des points selon le bareme (meme RPC que la declaration) */
            var pointsRes = await window.REN.supabase.rpc('calculer_points', {
                p_nb_allies: nbAllies,
                p_nb_ennemis: nbEnnemis,
                p_resultat: resultat,
                p_alliance_id: editingCombat.alliance_ennemie_id || null,
                p_type: type
            });
            if (pointsRes.error) throw pointsRes.error;
            var points = pointsRes.data || 0;

            var upd = await window.REN.supabase.from('combats').update({
                type: type,
                resultat: resultat,
                nb_allies: nbAllies,
                nb_ennemis: nbEnnemis,
                butin_kamas: butin,
                commentaire: commentaire,
                points_gagnes: points
            }).eq('id', editingCombat.id).select().single();
            if (upd.error) throw upd.error;

            /* Maj locale (on garde les jointures auteur/alliance/participants) puis re-render */
            var idx = allCombats.findIndex(function (c) { return c.id === editingCombat.id; });
            if (idx !== -1) allCombats[idx] = Object.assign({}, allCombats[idx], upd.data);
            closeEditModal();
            renderCombats();
            window.REN.toast('Combat modifié (' + (points > 0 ? '+' : '') + points + ' pts recalculés).', 'success');
        } catch (err) {
            console.error('[REN] Erreur modification combat:', err);
            window.REN.toast('Erreur : ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Enregistrer';
        }
    }
})();
