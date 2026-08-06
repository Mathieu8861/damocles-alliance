/* ============================================ */
/* Damoclès     - Historique                   */
/* Historique de tous les combats              */
/* ============================================ */
(function () {
    'use strict';

    var currentFilter = 'tous';
    var searchAlliance = '';
    var searchZone = '';
    var searchJoueur = '';
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
        var joueurInput = document.getElementById('history-search-joueur');
        if (joueurInput) {
            joueurInput.addEventListener('input', function () {
                searchJoueur = joueurInput.value.trim().toLowerCase();
                renderCombats();
            });
        }
    }

    async function loadCombats() {
        try {
            var { data, error } = await window.REN.supabase
                .from('combats')
                .select('*, auteur:profiles!auteur_id(username), alliance:alliances(nom, tag), participants:combat_participants(user:profiles(id, username))')
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
            /* Filtre joueur (auteur, participants ou invites hors site) */
            if (searchJoueur) {
                var noms = [];
                if (c.auteur && c.auteur.username) noms.push(c.auteur.username);
                (c.participants || []).forEach(function (p) {
                    if (p.user && p.user.username) noms.push(p.user.username);
                });
                (c.invites || []).forEach(function (n) { if (n) noms.push(n); });
                var joueurTrouve = noms.some(function (n) {
                    return n.toLowerCase().indexOf(searchJoueur) !== -1;
                });
                if (!joueurTrouve) return false;
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

    /* === MODIFICATION COMBAT (admin ou auteur < 3h) === */
    var editingCombat = null;
    var editingParticipants = [];
    var editAlliances = null;
    var editProfiles = null;

    async function ensureEditData() {
        if (editAlliances && editProfiles) return;
        var results = await Promise.all([
            window.REN.supabase.from('alliances').select('id, nom, tag').order('nom'),
            window.REN.supabase.from('profiles').select('id, username').eq('is_validated', true).order('username')
        ]);
        editAlliances = results[0].data || [];
        editProfiles = results[1].data || [];
    }

    function ensureEditModal() {
        if (document.getElementById('history-edit-modal')) return;
        var overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'history-edit-modal';
        overlay.innerHTML =
            '<div class="modal" style="max-width:560px;">'
            + '<div class="modal__header">'
            +   '<h2 class="modal__title">Modifier le combat</h2>'
            +   '<button class="modal__close" id="history-edit-close">&times;</button>'
            + '</div>'
            + '<div class="form-row">'
            +   '<div class="form-group"><label class="form-label">Type</label>'
            +     '<select id="edit-combat-type" class="form-select"><option value="attaque">Attaque</option><option value="defense">D\u00e9fense</option></select></div>'
            +   '<div class="form-group"><label class="form-label">R\u00e9sultat</label>'
            +     '<select id="edit-combat-resultat" class="form-select"><option value="victoire">Victoire</option><option value="defaite">D\u00e9faite</option></select></div>'
            + '</div>'
            + '<div class="form-row">'
            +   '<div class="form-group"><label class="form-label">Alli\u00e9s</label><select id="edit-combat-allies" class="form-select"></select></div>'
            +   '<div class="form-group"><label class="form-label">Ennemis</label><select id="edit-combat-ennemis" class="form-select"></select></div>'
            + '</div>'
            + '<div class="form-row">'
            +   '<div class="form-group"><label class="form-label">Alliance ennemie</label><select id="edit-combat-alliance" class="form-select"></select></div>'
            +   '<div class="form-group"><label class="form-label">Butin (kamas)</label><input type="number" id="edit-combat-butin" class="form-input" min="0" step="1"></div>'
            + '</div>'
            + '<div class="form-group" id="edit-combat-alliance-custom-wrap" hidden>'
            +   '<label class="form-label">Nom de l\'alliance (libre)</label>'
            +   '<input type="text" id="edit-combat-alliance-custom" class="form-input" maxlength="60" placeholder="Nom de l\'alliance...">'
            + '</div>'
            + '<div class="form-group"><label class="form-label">Zone / commentaire</label><input type="text" id="edit-combat-commentaire" class="form-input" maxlength="120"></div>'
            + '<div class="form-group">'
            +   '<label class="form-label">Participants</label>'
            +   '<div class="edit-participants" id="edit-combat-participants"></div>'
            +   '<div class="edit-participants__add">'
            +     '<select id="edit-combat-participant-select" class="form-select"></select>'
            +     '<button type="button" class="btn btn--secondary btn--small" id="edit-combat-participant-add">Ajouter</button>'
            +   '</div>'
            + '</div>'
            + '<div class="form-group">'
            +   '<label class="form-label">Invit\u00e9s hors site (s\u00e9par\u00e9s par des virgules)</label>'
            +   '<input type="text" id="edit-combat-invites" class="form-input" placeholder="Ex : pseudo1, pseudo2">'
            + '</div>'
            + '<p class="text-muted" style="font-size:0.78rem;margin:4px 0 14px;">Les points sont recalcul\u00e9s automatiquement selon le bar\u00e8me (butin remis \u00e0 0 en cas de d\u00e9faite).</p>'
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

        document.getElementById('edit-combat-alliance').addEventListener('change', function () {
            var wrap = document.getElementById('edit-combat-alliance-custom-wrap');
            if (wrap) wrap.hidden = this.value !== 'autre';
        });

        document.getElementById('edit-combat-participant-add').addEventListener('click', function () {
            var sel = document.getElementById('edit-combat-participant-select');
            var uid = sel && sel.value;
            if (!uid) return;
            var already = editingParticipants.some(function (p) { return p.id === uid; });
            if (already) return;
            var prof = editProfiles.find(function (p) { return p.id === uid; });
            if (prof) editingParticipants.push({ id: prof.id, username: prof.username });
            renderEditParticipants();
        });

        document.getElementById('edit-combat-participants').addEventListener('click', function (e) {
            var btn = e.target.closest('.edit-participant-chip__remove');
            if (!btn) return;
            var uid = btn.getAttribute('data-id');
            editingParticipants = editingParticipants.filter(function (p) { return p.id !== uid; });
            renderEditParticipants();
        });
    }

    function renderEditParticipants() {
        var wrap = document.getElementById('edit-combat-participants');
        var sel = document.getElementById('edit-combat-participant-select');
        if (!wrap) return;
        var esc = window.REN.escapeHtml;

        wrap.innerHTML = editingParticipants.length
            ? editingParticipants.map(function (p) {
                return '<span class="edit-participant-chip notranslate">' + esc(p.username)
                    + '<button type="button" class="edit-participant-chip__remove" data-id="' + p.id + '" title="Retirer">&times;</button></span>';
            }).join('')
            : '<span class="text-muted" style="font-size:0.8rem;">Aucun participant.</span>';

        if (sel) {
            var taken = {};
            editingParticipants.forEach(function (p) { taken[p.id] = true; });
            sel.innerHTML = '<option value="">Ajouter un membre...</option>'
                + editProfiles.filter(function (p) { return !taken[p.id]; })
                    .map(function (p) { return '<option value="' + p.id + '">' + esc(p.username) + '</option>'; }).join('');
        }
    }

    async function openEditModal(combatId) {
        editingCombat = allCombats.find(function (c) { return c.id === combatId; });
        if (!editingCombat) return;
        ensureEditModal();
        try { await ensureEditData(); } catch (e) { editAlliances = editAlliances || []; editProfiles = editProfiles || []; }

        document.getElementById('edit-combat-type').value = editingCombat.type;
        document.getElementById('edit-combat-resultat').value = editingCombat.resultat;
        document.getElementById('edit-combat-allies').value = editingCombat.nb_allies;
        document.getElementById('edit-combat-ennemis').value = editingCombat.nb_ennemis;
        document.getElementById('edit-combat-butin').value = editingCombat.butin_kamas || 0;
        document.getElementById('edit-combat-commentaire').value = editingCombat.commentaire || '';

        var esc = window.REN.escapeHtml;
        var allianceSel = document.getElementById('edit-combat-alliance');
        allianceSel.innerHTML = '<option value="">Aucune</option>'
            + editAlliances.map(function (a) {
                return '<option value="' + a.id + '">' + esc(a.nom) + (a.tag ? ' [' + esc(a.tag) + ']' : '') + '</option>';
            }).join('')
            + '<option value="autre">Autre (nom libre)</option>';
        var customWrap = document.getElementById('edit-combat-alliance-custom-wrap');
        var customInput = document.getElementById('edit-combat-alliance-custom');
        if (editingCombat.alliance_ennemie_id) {
            allianceSel.value = String(editingCombat.alliance_ennemie_id);
            customWrap.hidden = true;
            customInput.value = '';
        } else if (editingCombat.alliance_ennemie_nom) {
            allianceSel.value = 'autre';
            customWrap.hidden = false;
            customInput.value = editingCombat.alliance_ennemie_nom;
        } else {
            allianceSel.value = '';
            customWrap.hidden = true;
            customInput.value = '';
        }

        editingParticipants = (editingCombat.participants || [])
            .filter(function (p) { return p.user && p.user.id; })
            .map(function (p) { return { id: p.user.id, username: p.user.username }; });
        renderEditParticipants();

        document.getElementById('edit-combat-invites').value = (editingCombat.invites || []).join(', ');

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

        var allianceSel = document.getElementById('edit-combat-alliance');
        var allianceId = null;
        var allianceNom = null;
        if (allianceSel.value === 'autre') {
            allianceNom = document.getElementById('edit-combat-alliance-custom').value.trim() || null;
        } else if (allianceSel.value) {
            allianceId = parseInt(allianceSel.value, 10);
        }

        var invites = document.getElementById('edit-combat-invites').value
            .split(',')
            .map(function (s) { return s.trim(); })
            .filter(function (s) { return s.length >= 2 && s.length <= 30; });

        btn.disabled = true;
        btn.textContent = 'Enregistrement...';
        try {
            /* Recalcul des points selon le bareme (meme RPC que la declaration) */
            var pointsRes = await window.REN.supabase.rpc('calculer_points', {
                p_nb_allies: nbAllies,
                p_nb_ennemis: nbEnnemis,
                p_resultat: resultat,
                p_alliance_id: allianceId,
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
                alliance_ennemie_id: allianceId,
                alliance_ennemie_nom: allianceNom,
                invites: invites.length ? invites : null,
                points_gagnes: points
            }).eq('id', editingCombat.id).select().single();
            if (upd.error) throw upd.error;

            /* Synchronisation des participants (ajouts / retraits) */
            var beforeIds = (editingCombat.participants || [])
                .filter(function (p) { return p.user && p.user.id; })
                .map(function (p) { return p.user.id; });
            var afterIds = editingParticipants.map(function (p) { return p.id; });
            var toRemove = beforeIds.filter(function (id) { return afterIds.indexOf(id) === -1; });
            var toAdd = afterIds.filter(function (id) { return beforeIds.indexOf(id) === -1; });

            if (toRemove.length) {
                var delRes = await window.REN.supabase.from('combat_participants')
                    .delete().eq('combat_id', editingCombat.id).in('user_id', toRemove);
                if (delRes.error) throw delRes.error;
            }
            if (toAdd.length) {
                var insRes = await window.REN.supabase.from('combat_participants')
                    .insert(toAdd.map(function (uid) { return { combat_id: editingCombat.id, user_id: uid }; }));
                if (insRes.error) throw insRes.error;
            }

            /* Maj locale (jointures reconstruites) puis re-render */
            var idx = allCombats.findIndex(function (c) { return c.id === editingCombat.id; });
            if (idx !== -1) {
                var updated = Object.assign({}, allCombats[idx], upd.data);
                updated.participants = editingParticipants.map(function (p) {
                    return { user: { id: p.id, username: p.username } };
                });
                var allianceObj = null;
                if (allianceId) {
                    var al = editAlliances.find(function (x) { return x.id === allianceId; });
                    if (al) allianceObj = { nom: al.nom, tag: al.tag };
                }
                updated.alliance = allianceObj;
                allCombats[idx] = updated;
            }
            closeEditModal();
            renderCombats();
            window.REN.toast('Combat modifi\u00e9 (' + (points > 0 ? '+' : '') + points + ' pts recalcul\u00e9s).', 'success');
        } catch (err) {
            console.error('[REN] Erreur modification combat:', err);
            window.REN.toast('Erreur : ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Enregistrer';
        }
    }
})();
