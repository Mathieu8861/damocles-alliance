/* ============================================ */
/* Damoclès     - Admin Panel                  */
/* Gestion complete de l'alliance              */
/* ============================================ */
(function () {
    'use strict';

    var currentTab = 'validation';

    document.addEventListener('ren:ready', init);

    function init() {
        if (!window.REN.supabase || !window.REN.currentProfile) return;
        if (!window.REN.currentProfile.is_admin) {
            window.location.href = 'index.html';
            return;
        }
        setupTabs();
        setupLogout();
        loadTab(currentTab);
    }

    function setupLogout() {
        var btn = document.getElementById('btn-logout');
        if (!btn) return;
        btn.addEventListener('click', async function () {
            await window.REN.supabase.auth.signOut();
            window.location.href = 'connexion.html';
        });
    }

    /* === SIDEBAR TABS === */
    function setupTabs() {
        var sidebar = document.getElementById('admin-sidebar');
        var overlay = document.getElementById('admin-sidebar-overlay');
        var toggle = document.getElementById('admin-sidebar-toggle');
        if (!sidebar) return;

        /* Navigation onglets */
        sidebar.addEventListener('click', function (e) {
            var btn = e.target.closest('.admin-sidebar__btn');
            if (!btn) return;
            sidebar.querySelectorAll('.admin-sidebar__btn').forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            currentTab = btn.getAttribute('data-tab');
            loadTab(currentTab);

            /* Fermer sidebar sur mobile */
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('active');
                if (overlay) overlay.classList.remove('active');
            }
        });

        /* Toggle mobile */
        if (toggle) {
            toggle.addEventListener('click', function () {
                sidebar.classList.toggle('active');
                if (overlay) overlay.classList.toggle('active');
            });
        }

        /* Fermer via overlay */
        if (overlay) {
            overlay.addEventListener('click', function () {
                sidebar.classList.remove('active');
                overlay.classList.remove('active');
            });
        }
    }

    async function loadTab(tab) {
        var content = document.getElementById('admin-content');
        if (!content) return;
        content.innerHTML = '<div class="loading"><div class="spinner"></div> Chargement...</div>';

        try {
            switch (tab) {
                case 'validation': await tabValidation(content); break;
                case 'utilisateurs': await tabUtilisateurs(content); break;
                case 'alliances': await tabAlliances(content); break;
                case 'modules': await tabModules(content); break;
                case 'bareme': await tabBareme(content); break;
                case 'builds': await tabBuilds(content); break;
                case 'jeu-config': await tabJeuConfig(content); break;
                case 'jeu-lots': await tabJeuLots(content); break;
                case 'jeu-historique': await tabJeuHistorique(content); break;
                case 'cadres': tabCadres(content); break;
                case 'board': await tabBoard(content); break;
                case 'bareme-perco': await tabBaremePerco(content); break;
                case 'recyclages-hebdo': await tabRecyclagesHebdo(content); break;
                case 'zones-perco': await tabZonesPerco(content); break;
                case 'runes-prix': await tabRunesPrix(content); break;
                case 'boutique': await tabBoutique(content); break;
                case 'demandes-kamas': await tabDemandesKamas(content); break;
                case 'slot': await tabSlot(content); break;
                default: content.innerHTML = '<p class="text-muted">Onglet inconnu.</p>';
            }
        } catch (err) {
            console.error('[REN] Erreur admin tab:', err);
            content.innerHTML = '<p class="text-muted" style="padding:1rem;">Erreur: ' + err.message + '</p>';
        }
    }

    /* === TAB: VALIDATION === */
    async function tabValidation(container) {
        var { data: pending } = await window.REN.supabase
            .from('profiles').select('*').eq('is_validated', false).order('created_at');

        var html = '<div class="admin-panel__title">Validations en attente</div>';

        if (!pending || !pending.length) {
            html += '<p class="text-muted text-center">Aucune inscription en attente.</p>';
            container.innerHTML = html;
            return;
        }

        html += '<div class="table-wrapper"><table class="table">';
        html += '<thead><tr><th>Pseudo</th><th>Classe</th><th>Element</th><th>Date</th><th>Actions</th></tr></thead><tbody>';

        var esc = window.REN.escapeHtml;
        pending.forEach(function (p) {
            html += '<tr>';
            html += '<td>' + esc(p.username) + '</td>';
            html += '<td>' + esc(p.classe || '-') + '</td>';
            html += '<td>' + esc(p.element || '-') + '</td>';
            html += '<td>' + window.REN.formatDateFull(p.created_at) + '</td>';
            html += '<td>';
            html += '<button class="btn btn--primary btn--small admin-validate" data-id="' + p.id + '">Valider</button> ';
            html += '<button class="btn btn--danger btn--small admin-reject" data-id="' + p.id + '">Refuser</button>';
            html += '</td>';
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

        /* Event listeners */
        container.querySelectorAll('.admin-validate').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                await window.REN.supabase.from('profiles').update({ is_validated: true }).eq('id', btn.dataset.id);
                window.REN.toast('Utilisateur valide !', 'success');
                loadTab('validation');
            });
        });

        container.querySelectorAll('.admin-reject').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                if (!confirm('Refuser et supprimer cet utilisateur ?')) return;
                var uid = btn.dataset.id;
                /* Supprimer le profil d'abord, puis le compte auth */
                await window.REN.supabase.from('profiles').delete().eq('id', uid);
                await window.REN.supabase.rpc('admin_delete_user', { p_user_id: uid }).catch(function () {});
                window.REN.toast('Utilisateur refuse et supprime.', 'info');
                loadTab('validation');
            });
        });
    }

    /* === TAB: UTILISATEURS === */
    async function tabUtilisateurs(container) {
        var { data: users } = await window.REN.supabase
            .from('profiles').select('*').order('username');

        var activeUsers = (users || []).filter(function (u) { return u.is_validated; });
        var blockedUsers = (users || []).filter(function (u) { return !u.is_validated; });

        var html = '<div class="admin-panel__title">Gestion des Utilisateurs</div>';

        /* Membres actifs */
        html += '<h3 style="font-family:var(--font-title);font-size:1rem;color:var(--color-success);margin-bottom:var(--spacing-sm);">Membres actifs (' + activeUsers.length + ')</h3>';
        html += '<div class="table-wrapper"><table class="table">';
        html += '<thead><tr><th>Pseudo</th><th>Classe</th><th>Element</th><th>Jetons</th><th>Admin</th><th>Actions</th></tr></thead><tbody>';

        var esc = window.REN.escapeHtml;
        activeUsers.forEach(function (u) {
            html += '<tr>';
            html += '<td>' + esc(u.username) + '</td>';
            html += '<td>' + esc(u.classe || '-') + '</td>';
            html += '<td>' + esc(u.element || '-') + '</td>';
            html += '<td>' + (u.jetons || 0) + '</td>';
            html += '<td>' + (u.is_admin ? '<span class="text-accent">OUI</span>' : 'Non') + '</td>';
            html += '<td>';
            html += '<button class="btn btn--secondary btn--small admin-toggle-admin" data-id="' + u.id + '" data-admin="' + u.is_admin + '">' + (u.is_admin ? 'Retirer admin' : 'Rendre admin') + '</button> ';
            html += '<input type="number" class="bareme-grid__input admin-jetons-input" data-id="' + u.id + '" value="' + (u.jetons || 0) + '" style="width:70px;"> ';
            html += '<button class="btn btn--primary btn--small admin-save-jetons" data-id="' + u.id + '">Sauver jetons</button> ';
            html += '<button class="btn btn--small admin-block-user" data-id="' + u.id + '" data-username="' + esc(u.username) + '" style="background:var(--color-danger);color:#fff;">Bloquer</button>';
            html += '</td>';
            html += '</tr>';
        });
        html += '</tbody></table></div>';

        /* Membres bloqués */
        if (blockedUsers.length > 0) {
            html += '<h3 style="font-family:var(--font-title);font-size:1rem;color:var(--color-danger);margin:var(--spacing-lg) 0 var(--spacing-sm);">Membres bloques (' + blockedUsers.length + ')</h3>';
            html += '<div class="table-wrapper"><table class="table">';
            html += '<thead><tr><th>Pseudo</th><th>Classe</th><th>Element</th><th>Actions</th></tr></thead><tbody>';
            blockedUsers.forEach(function (u) {
                html += '<tr style="opacity:0.6;">';
                html += '<td>' + esc(u.username) + '</td>';
                html += '<td>' + esc(u.classe || '-') + '</td>';
                html += '<td>' + esc(u.element || '-') + '</td>';
                html += '<td>';
                html += '<button class="btn btn--small admin-unblock-user" data-id="' + u.id + '" data-username="' + esc(u.username) + '" style="background:var(--color-success);color:#fff;">Debloquer</button>';
                html += '</td>';
                html += '</tr>';
            });
            html += '</tbody></table></div>';
        }

        container.innerHTML = html;

        /* Toggle admin */
        container.querySelectorAll('.admin-toggle-admin').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                var newAdmin = btn.dataset.admin === 'true' ? false : true;
                await window.REN.supabase.from('profiles').update({ is_admin: newAdmin }).eq('id', btn.dataset.id);
                window.REN.toast('Role admin mis a jour.', 'success');
                loadTab('utilisateurs');
            });
        });

        /* Save jetons */
        container.querySelectorAll('.admin-save-jetons').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                var input = container.querySelector('.admin-jetons-input[data-id="' + btn.dataset.id + '"]');
                if (!input) return;
                await window.REN.supabase.from('profiles').update({ jetons: parseInt(input.value) || 0 }).eq('id', btn.dataset.id);
                window.REN.toast('Jetons mis a jour.', 'success');
            });
        });

        /* Bloquer utilisateur */
        container.querySelectorAll('.admin-block-user').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                var username = btn.dataset.username;
                if (!confirm('Bloquer ' + username + ' ?\nCette personne ne pourra plus acceder au site.')) return;
                var { error } = await window.REN.supabase.from('profiles').update({ is_validated: false }).eq('id', btn.dataset.id);
                if (error) { window.REN.toast('Erreur : ' + error.message, 'error'); return; }
                window.REN.toast(username + ' a ete bloque.', 'success');
                loadTab('utilisateurs');
            });
        });

        /* Débloquer utilisateur */
        container.querySelectorAll('.admin-unblock-user').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                var username = btn.dataset.username;
                if (!confirm('Debloquer ' + username + ' ?\nCette personne pourra a nouveau acceder au site.')) return;
                var { error } = await window.REN.supabase.from('profiles').update({ is_validated: true }).eq('id', btn.dataset.id);
                if (error) { window.REN.toast('Erreur : ' + error.message, 'error'); return; }
                window.REN.toast(username + ' a ete debloque.', 'success');
                loadTab('utilisateurs');
            });
        });
    }

    /* === TAB: ALLIANCES === */
    async function tabAlliances(container) {
        var { data: alliances } = await window.REN.supabase.from('alliances').select('*').order('nom');

        var html = '<div class="admin-panel__title">Gestion des Alliances</div>';

        /* Formulaire ajout */
        html += '<div style="display:flex;gap:var(--spacing-sm);margin-bottom:var(--spacing-lg);flex-wrap:wrap;">';
        html += '<input class="form-input" id="add-alliance-nom" placeholder="Nom de l\'alliance" style="flex:2;min-width:150px;">';
        html += '<input class="form-input" id="add-alliance-tag" placeholder="Tag" style="flex:1;min-width:80px;">';
        html += '<input class="form-input" id="add-alliance-mult" type="number" placeholder="Multiplicateur" value="1" min="0.5" step="0.5" style="flex:1;min-width:80px;">';
        html += '<button class="btn btn--primary btn--small" id="btn-add-alliance">Ajouter</button>';
        html += '</div>';

        /* Liste */
        html += '<div class="table-wrapper"><table class="table">';
        html += '<thead><tr><th>Nom</th><th>Tag</th><th>Mult.</th><th>Actions</th></tr></thead><tbody>';

        (alliances || []).forEach(function (a) {
            html += '<tr data-row-id="' + a.id + '">';
            /* Mode affichage */
            var escNom = window.REN.escapeHtml(a.nom);
            var escTag = window.REN.escapeHtml(a.tag || '');
            html += '<td class="cell-display" data-field="nom">' + escNom + '</td>';
            html += '<td class="cell-display" data-field="tag">' + (escTag || '-') + '</td>';
            html += '<td class="cell-display" data-field="mult">x' + a.multiplicateur + '</td>';
            /* Mode edition (masque par defaut) */
            html += '<td class="cell-edit" data-field="nom" style="display:none;"><input class="form-input edit-alliance-nom" value="' + escNom + '" style="width:100%;"></td>';
            html += '<td class="cell-edit" data-field="tag" style="display:none;"><input class="form-input edit-alliance-tag" value="' + escTag + '" style="width:100%;"></td>';
            html += '<td class="cell-edit" data-field="mult" style="display:none;"><input class="form-input edit-alliance-mult" type="number" value="' + a.multiplicateur + '" min="0.5" step="0.5" style="width:80px;"></td>';
            /* Boutons */
            html += '<td>';
            html += '<span class="actions-display">';
            html += '<button class="table__action admin-edit-alliance" data-id="' + a.id + '">Modifier</button> ';
            html += '<button class="table__action table__action--danger admin-delete-alliance" data-id="' + a.id + '">Supprimer</button>';
            html += '</span>';
            html += '<span class="actions-edit" style="display:none;">';
            html += '<button class="btn btn--primary btn--small admin-save-alliance" data-id="' + a.id + '">Sauver</button> ';
            html += '<button class="btn btn--secondary btn--small admin-cancel-alliance" data-id="' + a.id + '">Annuler</button>';
            html += '</span>';
            html += '</td>';
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

        /* Ajouter */
        document.getElementById('btn-add-alliance').addEventListener('click', async function () {
            var nom = document.getElementById('add-alliance-nom').value.trim();
            var tag = document.getElementById('add-alliance-tag').value.trim();
            var mult = parseFloat(document.getElementById('add-alliance-mult').value) || 1;
            if (!nom) { window.REN.toast('Entrez un nom.', 'error'); return; }
            await window.REN.supabase.from('alliances').insert({ nom: nom, tag: tag || null, multiplicateur: mult });
            window.REN.toast('Alliance ajoutee !', 'success');
            loadTab('alliances');
        });

        /* Modifier - passer en mode edition */
        container.querySelectorAll('.admin-edit-alliance').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var row = container.querySelector('tr[data-row-id="' + btn.dataset.id + '"]');
                if (!row) return;
                row.querySelectorAll('.cell-display').forEach(function (td) { td.style.display = 'none'; });
                row.querySelectorAll('.cell-edit').forEach(function (td) { td.style.display = ''; });
                row.querySelector('.actions-display').style.display = 'none';
                row.querySelector('.actions-edit').style.display = '';
            });
        });

        /* Annuler - revenir en mode affichage */
        container.querySelectorAll('.admin-cancel-alliance').forEach(function (btn) {
            btn.addEventListener('click', function () {
                loadTab('alliances');
            });
        });

        /* Sauver */
        container.querySelectorAll('.admin-save-alliance').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                var row = container.querySelector('tr[data-row-id="' + btn.dataset.id + '"]');
                if (!row) return;
                var nom = row.querySelector('.edit-alliance-nom').value.trim();
                var tag = row.querySelector('.edit-alliance-tag').value.trim();
                var mult = parseFloat(row.querySelector('.edit-alliance-mult').value) || 1;
                if (!nom) { window.REN.toast('Le nom ne peut pas etre vide.', 'error'); return; }
                var { error } = await window.REN.supabase.from('alliances').update({ nom: nom, tag: tag || null, multiplicateur: mult }).eq('id', btn.dataset.id);
                if (error) { window.REN.toast('Erreur: ' + error.message, 'error'); return; }
                window.REN.toast('Alliance modifiee !', 'success');
                loadTab('alliances');
            });
        });

        /* Supprimer */
        container.querySelectorAll('.admin-delete-alliance').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                if (!confirm('Supprimer cette alliance ?')) return;
                await window.REN.supabase.from('alliances').delete().eq('id', btn.dataset.id);
                window.REN.toast('Alliance supprimee.', 'info');
                loadTab('alliances');
            });
        });
    }

    /* === TAB: BAREME === */
    var baremeMode = 'attaque'; /* attaque ou defense */

    async function tabBareme(container) {
        var { data: bareme } = await window.REN.supabase
            .from('bareme_points').select('*').order('nb_allies').order('nb_ennemis');

        var html = '<div class="admin-panel__title">Bareme de Points</div>';
        html += '<div class="admin-panel__desc">Configurez les points gagnes/perdus en fonction du nombre d\'allies et d\'ennemis.<br>Chaque cellule : <span style="color:var(--color-success);">victoire</span> / <span style="color:var(--color-danger);">defaite</span></div>';

        /* Sous-tabs attaque / defense */
        html += '<div style="display:flex;gap:var(--spacing-sm);margin-bottom:var(--spacing-lg);">';
        html += '<button class="btn btn--small bareme-type-btn' + (baremeMode === 'attaque' ? ' btn--primary' : ' btn--secondary') + '" data-bareme-type="attaque">Bareme Attaque</button>';
        html += '<button class="btn btn--small bareme-type-btn' + (baremeMode === 'defense' ? ' btn--primary' : ' btn--secondary') + '" data-bareme-type="defense">Bareme Defense</button>';
        html += '</div>';

        /* Filtrer par type */
        var filtered = (bareme || []).filter(function (b) { return b.type === baremeMode; });

        html += '<div class="bareme-grid"><table class="table">';

        /* Header */
        html += '<thead><tr><th>Allies \\ Ennemis</th>';
        for (var e = 1; e <= 5; e++) html += '<th>' + e + ' enn.</th>';
        html += '</tr></thead><tbody>';

        /* Lignes */
        for (var a = 1; a <= 5; a++) {
            html += '<tr><th>' + a + ' allie' + (a > 1 ? 's' : '') + '</th>';
            for (var ee = 1; ee <= 5; ee++) {
                var cell = filtered.find(function (b) { return b.nb_allies === a && b.nb_ennemis === ee; });
                var pv = cell ? cell.points_victoire : 0;
                var pd = cell ? cell.points_defaite : 0;
                html += '<td>';
                html += '<input class="bareme-grid__input bareme-grid__input--victoire bareme-input" data-allies="' + a + '" data-ennemis="' + ee + '" data-field="victoire" value="' + pv + '" title="Victoire">';
                html += ' / ';
                html += '<input class="bareme-grid__input bareme-grid__input--defaite bareme-input" data-allies="' + a + '" data-ennemis="' + ee + '" data-field="defaite" value="' + pd + '" title="Defaite">';
                html += '</td>';
            }
            html += '</tr>';
        }

        html += '</tbody></table></div>';
        html += '<div class="text-center mt-lg"><button class="btn btn--primary" id="btn-save-bareme">Sauvegarder le bareme ' + baremeMode + '</button></div>';
        container.innerHTML = html;

        /* Switch attaque / defense */
        container.querySelectorAll('.bareme-type-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                baremeMode = btn.dataset.baremeType;
                tabBareme(container);
            });
        });

        /* Save */
        document.getElementById('btn-save-bareme').addEventListener('click', async function () {
            var inputs = container.querySelectorAll('.bareme-input');
            var updates = {};

            inputs.forEach(function (input) {
                var key = input.dataset.allies + '-' + input.dataset.ennemis;
                if (!updates[key]) updates[key] = { nb_allies: parseInt(input.dataset.allies), nb_ennemis: parseInt(input.dataset.ennemis) };
                if (input.dataset.field === 'victoire') updates[key].points_victoire = parseInt(input.value) || 0;
                else updates[key].points_defaite = parseInt(input.value) || 0;
            });

            try {
                for (var key in updates) {
                    var u = updates[key];
                    await window.REN.supabase.from('bareme_points')
                        .update({ points_victoire: u.points_victoire, points_defaite: u.points_defaite })
                        .eq('nb_allies', u.nb_allies).eq('nb_ennemis', u.nb_ennemis).eq('type', baremeMode);
                }
                window.REN.toast('Bareme ' + baremeMode + ' sauvegarde !', 'success');
            } catch (err) {
                window.REN.toast('Erreur: ' + err.message, 'error');
            }
        });
    }

    /* === TAB: BUILDS === */
    async function tabBuilds(container) {
        var { data: builds } = await window.REN.supabase.from('builds').select('*').order('created_at', { ascending: false });

        var html = '<div class="admin-panel__title">Gestion des Builds</div>';

        /* Formulaire */
        html += '<div style="margin-bottom:var(--spacing-lg);">';
        html += '<div class="form-group"><input class="form-input" id="add-build-titre" placeholder="Titre du build"></div>';
        html += '<div class="form-group"><textarea class="form-input" id="add-build-desc" placeholder="Description..." rows="3" style="resize:vertical;"></textarea></div>';
        html += '<div class="form-group"><input class="form-input" id="add-build-lien" placeholder="Lien Dofusbook (optionnel)"></div>';
        html += '<div style="display:flex;gap:var(--spacing-sm);margin-bottom:var(--spacing-sm);flex-wrap:wrap;">';
        html += '<div class="form-group" style="flex:1;margin-bottom:0;min-width:120px;"><select class="form-input" id="add-build-type"><option value="">Type (optionnel)</option><option value="pvp">PVP</option><option value="pvm">PVM</option></select></div>';
        html += '<div class="form-group" style="flex:1;margin-bottom:0;min-width:120px;"><select class="form-input" id="add-build-classe"><option value="">Classe (optionnel)</option>';
        html += '<option value="Cra">Cra</option><option value="Ecaflip">Ecaflip</option><option value="Eliotrope">Eliotrope</option><option value="Eniripsa">Eniripsa</option>';
        html += '<option value="Enutrof">Enutrof</option><option value="Feca">Feca</option><option value="Forge">Forge</option><option value="Huppermage">Huppermage</option>';
        html += '<option value="Iop">Iop</option><option value="Osamodas">Osamodas</option><option value="Ouginak">Ouginak</option><option value="Pandawa">Pandawa</option>';
        html += '<option value="Roublard">Roublard</option><option value="Sacrieur">Sacrieur</option><option value="Sadida">Sadida</option><option value="Sram">Sram</option>';
        html += '<option value="Steamer">Steamer</option><option value="Xelor">Xelor</option><option value="Zobal">Zobal</option>';
        html += '</select></div>';
        html += '<div class="form-group" style="flex:1;margin-bottom:0;min-width:120px;"><input class="form-input" id="add-build-kamas" type="number" min="0" placeholder="Valeur estimee en kamas (optionnel)"></div>';
        html += '</div>';
        html += '<div class="form-group"><label class="form-label">Capture d\'ecran (optionnel)</label><input type="file" class="form-input" id="add-build-image" accept="image/*"></div>';
        html += '<button class="btn btn--primary btn--small" id="btn-add-build">Ajouter le build</button>';
        html += '</div>';

        /* Liste */
        if (builds && builds.length) {
            html += '<div class="table-wrapper"><table class="table">';
            html += '<thead><tr><th>Image</th><th>Titre</th><th>Type</th><th>Classe</th><th>Kamas</th><th>Lien</th><th>Actions</th></tr></thead><tbody>';
            var esc = window.REN.escapeHtml;
            builds.forEach(function (b) {
                var safeImageUrl = window.REN.sanitizeUrl(b.image_url);
                html += '<tr data-id="' + b.id + '" data-image="' + esc(b.image_url || '') + '">';
                /* Image */
                html += '<td>';
                if (safeImageUrl) {
                    html += '<img src="' + esc(safeImageUrl) + '" alt="" style="width:60px;height:40px;object-fit:cover;border-radius:4px;">';
                } else {
                    html += '<span class="text-muted">-</span>';
                }
                html += '</td>';
                /* Titre : display / edit */
                html += '<td class="cell-display" data-field="titre">' + esc(b.titre) + '</td>';
                html += '<td class="cell-edit" data-field="titre" style="display:none;"><input class="form-input edit-build-titre" value="' + esc(b.titre || '') + '" style="width:100%;"></td>';
                /* Type : display / edit */
                html += '<td class="cell-display" data-field="type">' + (b.type_build ? '<span class="badge badge--' + esc(b.type_build) + '">' + esc(b.type_build).toUpperCase() + '</span>' : '-') + '</td>';
                html += '<td class="cell-edit" data-field="type" style="display:none;"><select class="form-input edit-build-type" style="width:100%;"><option value="">-</option><option value="pvp"' + (b.type_build === 'pvp' ? ' selected' : '') + '>PVP</option><option value="pvm"' + (b.type_build === 'pvm' ? ' selected' : '') + '>PVM</option></select></td>';
                /* Classe : display / edit */
                html += '<td class="cell-display" data-field="classe">' + (b.classe ? '<span class="badge badge--classe">' + esc(b.classe) + '</span>' : '-') + '</td>';
                html += '<td class="cell-edit" data-field="classe" style="display:none;"><select class="form-input edit-build-classe" style="width:100%;"><option value="">-</option>';
                html += '<option value="Cra"' + (b.classe === 'Cra' ? ' selected' : '') + '>Cra</option>';
                html += '<option value="Ecaflip"' + (b.classe === 'Ecaflip' ? ' selected' : '') + '>Ecaflip</option>';
                html += '<option value="Eliotrope"' + (b.classe === 'Eliotrope' ? ' selected' : '') + '>Eliotrope</option>';
                html += '<option value="Eniripsa"' + (b.classe === 'Eniripsa' ? ' selected' : '') + '>Eniripsa</option>';
                html += '<option value="Enutrof"' + (b.classe === 'Enutrof' ? ' selected' : '') + '>Enutrof</option>';
                html += '<option value="Feca"' + (b.classe === 'Feca' ? ' selected' : '') + '>Feca</option>';
                html += '<option value="Forge"' + (b.classe === 'Forge' ? ' selected' : '') + '>Forge</option>';
                html += '<option value="Huppermage"' + (b.classe === 'Huppermage' ? ' selected' : '') + '>Huppermage</option>';
                html += '<option value="Iop"' + (b.classe === 'Iop' ? ' selected' : '') + '>Iop</option>';
                html += '<option value="Osamodas"' + (b.classe === 'Osamodas' ? ' selected' : '') + '>Osamodas</option>';
                html += '<option value="Ouginak"' + (b.classe === 'Ouginak' ? ' selected' : '') + '>Ouginak</option>';
                html += '<option value="Pandawa"' + (b.classe === 'Pandawa' ? ' selected' : '') + '>Pandawa</option>';
                html += '<option value="Roublard"' + (b.classe === 'Roublard' ? ' selected' : '') + '>Roublard</option>';
                html += '<option value="Sacrieur"' + (b.classe === 'Sacrieur' ? ' selected' : '') + '>Sacrieur</option>';
                html += '<option value="Sadida"' + (b.classe === 'Sadida' ? ' selected' : '') + '>Sadida</option>';
                html += '<option value="Sram"' + (b.classe === 'Sram' ? ' selected' : '') + '>Sram</option>';
                html += '<option value="Steamer"' + (b.classe === 'Steamer' ? ' selected' : '') + '>Steamer</option>';
                html += '<option value="Xelor"' + (b.classe === 'Xelor' ? ' selected' : '') + '>Xelor</option>';
                html += '<option value="Zobal"' + (b.classe === 'Zobal' ? ' selected' : '') + '>Zobal</option>';
                html += '</select></td>';
                /* Kamas : display / edit */
                html += '<td class="cell-display" data-field="kamas">' + (b.valeur_kamas ? Number(b.valeur_kamas).toLocaleString('fr-FR') + ' M' : '-') + '</td>';
                html += '<td class="cell-edit" data-field="kamas" style="display:none;"><input class="form-input edit-build-kamas" type="number" min="0" value="' + (b.valeur_kamas || 0) + '" style="width:100px;"></td>';
                /* Lien : display / edit */
                var safeLien = window.REN.sanitizeUrl(b.lien_dofusbook);
                html += '<td class="cell-display" data-field="lien">' + (safeLien ? '<a href="' + esc(safeLien) + '" target="_blank" class="text-accent">Lien</a>' : '-') + '</td>';
                html += '<td class="cell-edit" data-field="lien" style="display:none;"><input class="form-input edit-build-lien" value="' + esc(b.lien_dofusbook || '') + '" style="width:100%;"></td>';
                /* Actions : display / edit */
                html += '<td class="cell-display" data-field="actions">';
                html += '<button class="table__action admin-edit-build" data-id="' + b.id + '">Modifier</button> ';
                html += '<button class="table__action table__action--danger admin-delete-build" data-id="' + b.id + '">Supprimer</button>';
                html += '</td>';
                html += '<td class="cell-edit" data-field="actions" style="display:none;">';
                html += '<button class="table__action table__action--success admin-save-build" data-id="' + b.id + '">Sauver</button> ';
                html += '<button class="table__action admin-cancel-build">Annuler</button>';
                html += '</td>';
                html += '</tr>';
            });
            html += '</tbody></table></div>';
        }

        container.innerHTML = html;

        /* === AJOUTER un build === */
        document.getElementById('btn-add-build').addEventListener('click', async function () {
            var titre = document.getElementById('add-build-titre').value.trim();
            if (!titre) { window.REN.toast('Entrez un titre.', 'error'); return; }
            var desc = document.getElementById('add-build-desc').value.trim();
            var lien = document.getElementById('add-build-lien').value.trim();
            var typeBuild = document.getElementById('add-build-type').value;
            var classeBuild = document.getElementById('add-build-classe').value;
            var valeurKamas = document.getElementById('add-build-kamas').value;

            /* Upload image si presente */
            var fileInput = document.getElementById('add-build-image');
            var imageUrl = '';
            if (fileInput && fileInput.files.length > 0) {
                var file = fileInput.files[0];
                var fileName = Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '');
                var { error: uploadError } = await window.REN.supabase.storage
                    .from('builds')
                    .upload(fileName, file);
                if (uploadError) {
                    console.error('[REN] Upload error:', uploadError);
                    window.REN.toast('Erreur upload image: ' + uploadError.message, 'error');
                    return;
                }
                var { data: urlData } = window.REN.supabase.storage.from('builds').getPublicUrl(fileName);
                imageUrl = urlData.publicUrl;
            }

            await window.REN.supabase.from('builds').insert({
                titre: titre, description: desc, lien_dofusbook: lien || '', image_url: imageUrl,
                type_build: typeBuild || '', classe: classeBuild || '', valeur_kamas: valeurKamas ? parseInt(valeurKamas) : 0
            });
            window.REN.toast('Build ajoute !', 'success');
            loadTab('builds');
        });

        /* === MODIFIER un build (inline edit) === */
        container.querySelectorAll('.admin-edit-build').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var row = btn.closest('tr');
                row.querySelectorAll('.cell-display').forEach(function (td) { td.style.display = 'none'; });
                row.querySelectorAll('.cell-edit').forEach(function (td) { td.style.display = ''; });
            });
        });

        /* === ANNULER l'edition === */
        container.querySelectorAll('.admin-cancel-build').forEach(function (btn) {
            btn.addEventListener('click', function () { loadTab('builds'); });
        });

        /* === SAUVER un build === */
        container.querySelectorAll('.admin-save-build').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                var row = btn.closest('tr');
                var id = btn.dataset.id;
                var newTitre = row.querySelector('.edit-build-titre').value.trim();
                if (!newTitre) { window.REN.toast('Le titre est obligatoire.', 'error'); return; }
                var newType = row.querySelector('.edit-build-type').value;
                var newClasse = row.querySelector('.edit-build-classe').value;
                var newKamas = row.querySelector('.edit-build-kamas').value;
                var newLien = row.querySelector('.edit-build-lien').value.trim();

                var { error: updateError } = await window.REN.supabase.from('builds').update({
                    titre: newTitre,
                    type_build: newType || '',
                    classe: newClasse || '',
                    valeur_kamas: newKamas ? parseInt(newKamas) : 0,
                    lien_dofusbook: newLien || ''
                }).eq('id', id);

                if (updateError) {
                    console.error('[REN] Update build error:', updateError);
                    window.REN.toast('Erreur: ' + updateError.message, 'error');
                    return;
                }
                window.REN.toast('Build modifie !', 'success');
                loadTab('builds');
            });
        });

        /* === SUPPRIMER un build === */
        container.querySelectorAll('.admin-delete-build').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                if (!confirm('Supprimer ce build ?')) return;

                /* Supprimer l'image du storage si elle existe */
                var row = btn.closest('tr');
                var imageUrl = row ? row.dataset.image : '';
                if (imageUrl) {
                    var parts = imageUrl.split('/builds/');
                    if (parts.length > 1) {
                        var filePath = parts[parts.length - 1];
                        await window.REN.supabase.storage.from('builds').remove([filePath]);
                    }
                }

                await window.REN.supabase.from('builds').delete().eq('id', btn.dataset.id);
                window.REN.toast('Build supprime.', 'info');
                loadTab('builds');
            });
        });
    }

    /* === TAB: JEU CONFIG === */
    async function tabJeuConfig(container) {
        var { data: config } = await window.REN.supabase.from('jeu_config').select('*').single();

        var html = '<div class="admin-panel__title">Configuration du Jeu</div>';
        html += '<div class="form-group">';
        html += '<label class="form-label">Prix d\'un tirage (jetons)</label>';
        html += '<input class="form-input" id="jeu-prix" type="number" value="' + (config ? config.prix_tirage : 12) + '" min="1">';
        html += '</div>';
        html += '<button class="btn btn--primary" id="btn-save-jeu-config">Sauvegarder</button>';
        container.innerHTML = html;

        document.getElementById('btn-save-jeu-config').addEventListener('click', async function () {
            var prix = parseInt(document.getElementById('jeu-prix').value) || 12;
            await window.REN.supabase.from('jeu_config').update({ prix_tirage: prix }).eq('id', config.id);
            window.REN.toast('Config sauvegardee !', 'success');
        });
    }

    /* === TAB: JEU LOTS === */
    async function tabJeuLots(container) {
        var { data: lots } = await window.REN.supabase.from('jeu_lots').select('*').order('pourcentage', { ascending: false });

        var html = '<div class="admin-panel__title">Gestion des Lots</div>';
        html += '<div class="admin-panel__desc">Ajoutez ou modifiez les lots. La somme des pourcentages doit faire 100%.</div>';

        /* Formulaire ajout */
        html += '<div style="display:flex;gap:var(--spacing-sm);margin-bottom:var(--spacing-lg);flex-wrap:wrap;">';
        html += '<input class="form-input" id="add-lot-nom" placeholder="Nom du lot" style="flex:2;min-width:150px;">';
        html += '<input class="form-input" id="add-lot-pourcent" type="number" placeholder="%" min="0" max="100" step="0.01" style="flex:1;min-width:80px;">';
        html += '<input class="form-input" id="add-lot-jetons" type="number" placeholder="Gain jetons" min="0" value="0" style="flex:1;min-width:80px;">';
        html += '<button class="btn btn--primary btn--small" id="btn-add-lot">Ajouter</button>';
        html += '</div>';

        /* Liste avec inline-edit */
        if (lots && lots.length) {
            html += '<div class="table-wrapper"><table class="table">';
            html += '<thead><tr><th>Lot</th><th>%</th><th>Gain jetons</th><th>Actions</th></tr></thead><tbody>';

            lots.forEach(function (l) {
                html += '<tr data-row-id="' + l.id + '">';
                /* Mode affichage */
                var escLotNom = window.REN.escapeHtml(l.nom);
                html += '<td class="cell-display" data-field="nom">' + escLotNom + '</td>';
                html += '<td class="cell-display" data-field="pourcentage">' + l.pourcentage + '%</td>';
                html += '<td class="cell-display" data-field="gain_jetons">' + (l.gain_jetons || 0) + '</td>';
                /* Mode edition (masque par defaut) */
                html += '<td class="cell-edit" data-field="nom" style="display:none;"><input class="form-input edit-lot-nom" value="' + escLotNom + '" style="width:100%;"></td>';
                html += '<td class="cell-edit" data-field="pourcentage" style="display:none;"><input class="form-input edit-lot-pourcent" type="number" value="' + l.pourcentage + '" step="0.01" min="0" max="100" style="width:80px;"></td>';
                html += '<td class="cell-edit" data-field="gain_jetons" style="display:none;"><input class="form-input edit-lot-jetons" type="number" value="' + (l.gain_jetons || 0) + '" min="0" style="width:80px;"></td>';
                /* Boutons */
                html += '<td>';
                html += '<span class="actions-display">';
                html += '<button class="table__action admin-edit-lot" data-id="' + l.id + '">Modifier</button> ';
                html += '<button class="table__action table__action--danger admin-delete-lot" data-id="' + l.id + '">Supprimer</button>';
                html += '</span>';
                html += '<span class="actions-edit" style="display:none;">';
                html += '<button class="btn btn--primary btn--small admin-save-lot" data-id="' + l.id + '">Sauver</button> ';
                html += '<button class="btn btn--secondary btn--small admin-cancel-lot" data-id="' + l.id + '">Annuler</button>';
                html += '</span>';
                html += '</td>';
                html += '</tr>';
            });

            html += '</tbody></table></div>';
        }

        /* Somme des probabilites */
        var sommePourcentages = (lots || []).reduce(function (sum, l) {
            return sum + parseFloat(l.pourcentage || 0);
        }, 0);
        var sommeOk = Math.abs(sommePourcentages - 100) < 0.01;
        var sommeColor = sommeOk ? 'var(--color-success)' : 'var(--color-danger)';
        var sommeWarning = !sommeOk ? '<br><span style="color:var(--color-warning);font-size:0.75rem;">La somme devrait etre 100%</span>' : '';

        html += '<div style="text-align:center;margin-top:var(--spacing-lg);padding:var(--spacing-md);background:var(--color-bg-tertiary);border-radius:var(--radius-sm);">';
        html += '<span style="font-family:var(--font-title);font-weight:600;color:' + sommeColor + ';">';
        html += 'Somme des probabilites : ' + sommePourcentages.toFixed(2) + '%';
        html += '</span>';
        html += sommeWarning;
        html += '</div>';

        container.innerHTML = html;

        /* Ajouter */
        document.getElementById('btn-add-lot').addEventListener('click', async function () {
            var nom = document.getElementById('add-lot-nom').value.trim();
            var pourcent = parseFloat(document.getElementById('add-lot-pourcent').value);
            var jetons = parseInt(document.getElementById('add-lot-jetons').value) || 0;
            if (!nom || isNaN(pourcent)) { window.REN.toast('Remplissez nom et pourcentage.', 'error'); return; }
            await window.REN.supabase.from('jeu_lots').insert({ nom: nom, pourcentage: pourcent, gain_jetons: jetons });
            window.REN.toast('Lot ajoute !', 'success');
            loadTab('jeu-lots');
        });

        /* Modifier - passer en mode edition */
        container.querySelectorAll('.admin-edit-lot').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var row = container.querySelector('tr[data-row-id="' + btn.dataset.id + '"]');
                if (!row) return;
                row.querySelectorAll('.cell-display').forEach(function (td) { td.style.display = 'none'; });
                row.querySelectorAll('.cell-edit').forEach(function (td) { td.style.display = ''; });
                row.querySelector('.actions-display').style.display = 'none';
                row.querySelector('.actions-edit').style.display = '';
            });
        });

        /* Annuler */
        container.querySelectorAll('.admin-cancel-lot').forEach(function (btn) {
            btn.addEventListener('click', function () {
                loadTab('jeu-lots');
            });
        });

        /* Sauver */
        container.querySelectorAll('.admin-save-lot').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                var row = container.querySelector('tr[data-row-id="' + btn.dataset.id + '"]');
                if (!row) return;
                var nom = row.querySelector('.edit-lot-nom').value.trim();
                var pourcent = parseFloat(row.querySelector('.edit-lot-pourcent').value);
                var jetons = parseInt(row.querySelector('.edit-lot-jetons').value) || 0;
                if (!nom || isNaN(pourcent)) { window.REN.toast('Remplissez nom et pourcentage.', 'error'); return; }
                var { error } = await window.REN.supabase.from('jeu_lots').update({ nom: nom, pourcentage: pourcent, gain_jetons: jetons }).eq('id', btn.dataset.id);
                if (error) { window.REN.toast('Erreur: ' + error.message, 'error'); return; }
                window.REN.toast('Lot modifie !', 'success');
                loadTab('jeu-lots');
            });
        });

        /* Supprimer */
        container.querySelectorAll('.admin-delete-lot').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                if (!confirm('Supprimer ce lot ?')) return;
                await window.REN.supabase.from('jeu_lots').delete().eq('id', btn.dataset.id);
                window.REN.toast('Lot supprime.', 'info');
                loadTab('jeu-lots');
            });
        });
    }

    /* === TAB: JEU HISTORIQUE === */
    /* Helper : ISO du lundi courant (début de semaine) */
    function getMondayISO() {
        var now = new Date();
        var day = now.getDay();
        var diff = (day === 0 ? -6 : 1) - day;
        var monday = new Date(now);
        monday.setDate(now.getDate() + diff);
        monday.setHours(0, 0, 0, 0);
        return monday.toISOString();
    }

    async function tabJeuHistorique(container) {
        var lundiISO = getMondayISO();

        /* Charger les 3 sources en parallèle */
        var [lastWeekRes, currentWeekRes, historiqueRes] = await Promise.all([
            window.REN.supabase.from('pepites_semaine_passee').select('id, username, tirages, pepites'),
            window.REN.supabase.from('pepites_semaine_courante').select('id, username, tirages, pepites'),
            window.REN.supabase.from('jeu_historique')
                .select('*, user:profiles(username), lot:jeu_lots(nom)')
                .gte('created_at', lundiISO)
                .order('created_at', { ascending: false })
        ]);

        var lastWeek = lastWeekRes.data || [];
        var currentWeek = currentWeekRes.data || [];
        var historique = historiqueRes.data || [];

        var html = '<div class="admin-panel__title">Historique des Tirages & Distribution</div>';

        /* ==============================
           SECTION 1 : Distribution — Semaine passée
           ============================== */
        html += '<div style="background:var(--color-bg-tertiary);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--spacing-lg);margin-bottom:var(--spacing-lg);">';
        html += '<h3 style="font-family:var(--font-title);font-size:1rem;font-weight:700;margin-bottom:var(--spacing-sm);">📋 Distribution pépites — Semaine passée</h3>';

        if (lastWeek.length > 0) {
            var totalPepites = 0;
            html += '<div style="max-height:250px;overflow-y:auto;margin-bottom:var(--spacing-md);">';
            html += '<table class="admin-table"><thead><tr><th>Joueur</th><th style="text-align:center;">Tirages</th><th style="text-align:right;">Pépites</th></tr></thead><tbody>';
            lastWeek.forEach(function (p) {
                totalPepites += p.pepites;
                html += '<tr>';
                html += '<td style="font-weight:600;">' + window.REN.escapeHtml(p.username) + '</td>';
                html += '<td style="text-align:center;">' + p.tirages + '</td>';
                html += '<td style="text-align:right;color:var(--color-warning);font-weight:600;">' + p.pepites.toLocaleString('fr-FR') + '</td>';
                html += '</tr>';
            });
            html += '</tbody></table>';
            html += '</div>';
            html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--spacing-md);">';
            html += '<span style="font-size:0.875rem;color:var(--color-text-secondary);">Total : <strong style="color:var(--color-warning);">' + totalPepites.toLocaleString('fr-FR') + ' pépites</strong> pour ' + lastWeek.length + ' joueur' + (lastWeek.length > 1 ? 's' : '') + '</span>';
            html += '<button class="btn btn--primary" id="btn-distribute-purge">Distribuer & Purger</button>';
            html += '</div>';
        } else {
            html += '<p class="text-muted" style="font-size:0.8125rem;">Aucune pépite à distribuer (semaine passée vide ou déjà purgée).</p>';
        }
        html += '</div>';

        /* ==============================
           SECTION 2 : Semaine en cours (info)
           ============================== */
        html += '<div style="background:var(--color-bg-tertiary);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--spacing-lg);margin-bottom:var(--spacing-lg);">';
        html += '<h3 style="font-family:var(--font-title);font-size:1rem;font-weight:700;margin-bottom:var(--spacing-sm);">📊 Semaine en cours</h3>';

        if (currentWeek.length > 0) {
            var totalCurrent = 0;
            html += '<div style="max-height:200px;overflow-y:auto;">';
            html += '<table class="admin-table"><thead><tr><th>Joueur</th><th style="text-align:center;">Tirages</th><th style="text-align:right;">Pépites</th></tr></thead><tbody>';
            currentWeek.forEach(function (p) {
                totalCurrent += p.pepites;
                html += '<tr>';
                html += '<td>' + window.REN.escapeHtml(p.username) + '</td>';
                html += '<td style="text-align:center;">' + p.tirages + '</td>';
                html += '<td style="text-align:right;color:var(--color-warning);">' + p.pepites.toLocaleString('fr-FR') + '</td>';
                html += '</tr>';
            });
            html += '</tbody></table>';
            html += '</div>';
            html += '<p class="text-muted" style="font-size:0.75rem;margin-top:var(--spacing-xs);">Total en cours : ' + totalCurrent.toLocaleString('fr-FR') + ' pépites — ' + currentWeek.length + ' joueur' + (currentWeek.length > 1 ? 's' : '') + '</p>';
        } else {
            html += '<p class="text-muted" style="font-size:0.8125rem;">Aucun tirage cette semaine.</p>';
        }
        html += '</div>';

        /* ==============================
           SECTION 3 : Historique détaillé (semaine en cours)
           ============================== */
        html += '<h3 style="font-family:var(--font-title);font-size:1rem;font-weight:700;margin-bottom:var(--spacing-sm);">📝 Historique détaillé (semaine en cours)</h3>';

        if (historique.length > 0) {
            html += '<div class="table-wrapper"><table class="table">';
            html += '<thead><tr><th>Joueur</th><th>Lot</th><th>Résultat</th><th>Donné</th><th>Date</th><th>Actions</th></tr></thead><tbody>';

            historique.forEach(function (h) {
                html += '<tr>';
                html += '<td>' + window.REN.escapeHtml(h.user ? h.user.username : '?') + '</td>';
                html += '<td>' + window.REN.escapeHtml(h.lot ? h.lot.nom : '?') + '</td>';
                html += '<td>' + window.REN.escapeHtml(h.resultat) + '</td>';
                html += '<td>' + (h.donne ? '<span class="text-success">Oui</span>' : '<span class="text-danger">Non</span>') + '</td>';
                html += '<td>' + window.REN.formatDateFull(h.created_at) + '</td>';
                html += '<td style="display:flex;gap:4px;flex-wrap:wrap;">';
                if (!h.donne) {
                    html += '<button class="btn btn--primary btn--small admin-mark-given" data-id="' + h.id + '">Marquer donné</button>';
                }
                html += '<button class="btn btn--danger btn--small admin-delete-hist" data-id="' + h.id + '">Supprimer</button>';
                html += '</td>';
                html += '</tr>';
            });

            html += '</tbody></table></div>';
        } else {
            html += '<p class="text-muted text-center">Aucun tirage cette semaine.</p>';
        }

        container.innerHTML = html;

        /* ==============================
           EVENT LISTENERS
           ============================== */

        /* Distribuer & Purger */
        var distBtn = document.getElementById('btn-distribute-purge');
        if (distBtn) {
            distBtn.addEventListener('click', async function () {
                var totalP = lastWeek.reduce(function (s, p) { return s + p.pepites; }, 0);
                var recap = lastWeek.map(function (p) { return p.username + ' : ' + p.pepites.toLocaleString('fr-FR'); }).join('\n');
                if (!confirm('Distribuer & purger les pépites de la semaine passée ?\n\n' + recap + '\n\nTotal : ' + totalP.toLocaleString('fr-FR') + ' pépites\n\nLes tirages de la semaine passée seront supprimés.')) return;

                distBtn.disabled = true;
                distBtn.textContent = 'Purge en cours...';

                try {
                    var { error } = await window.REN.supabase
                        .from('jeu_historique')
                        .delete()
                        .lt('created_at', lundiISO);

                    if (error) throw error;
                    window.REN.toast('Pépites distribuées, historique purgé !', 'success');
                    loadTab('jeu-historique');
                } catch (err) {
                    console.error('[REN-ADMIN] Erreur purge:', err);
                    window.REN.toast('Erreur : ' + err.message, 'error');
                    distBtn.disabled = false;
                    distBtn.textContent = 'Distribuer & Purger';
                }
            });
        }

        /* Marquer comme donné */
        container.querySelectorAll('.admin-mark-given').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                await window.REN.supabase.from('jeu_historique').update({ donne: true }).eq('id', btn.dataset.id);
                window.REN.toast('Lot marqué comme donné.', 'success');
                loadTab('jeu-historique');
            });
        });

        /* Supprimer une ligne */
        container.querySelectorAll('.admin-delete-hist').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                if (!confirm('Supprimer ce tirage ?')) return;
                await window.REN.supabase.from('jeu_historique').delete().eq('id', btn.dataset.id);
                window.REN.toast('Tirage supprimé.', 'success');
                loadTab('jeu-historique');
            });
        });
    }
    /* === TAB: CADRES === */
    function tabCadres(content) {
        var tiers = [
            { key: 'initie', name: 'Initie', min: 0, max: 49, title: 'Joueur Lambda', desc: 'Bordure grise', reward: 0 },
            { key: 'bronze', name: 'Bronze', min: 50, max: 149, title: 'Guerrier de Base', desc: 'Bordure bronze + lueur', reward: 10 },
            { key: 'argent', name: 'Argent', min: 150, max: 299, title: 'Combattant Confirme', desc: 'Bordure argent + lueur', reward: 20 },
            { key: 'or', name: 'Or', min: 300, max: 499, title: 'Elite PVP', desc: 'Bordure doree + glow pulsante', reward: 40 },
            { key: 'saphir', name: 'Saphir', min: 500, max: 999, title: 'Veteran des Arenes', desc: 'Ring bleu rotatif + glow', reward: 50 },
            { key: 'emeraude', name: 'Emeraude', min: 1000, max: 1499, title: 'Seigneur de Guerre', desc: 'Ring vert rotatif + glow intense', reward: 70 },
            { key: 'rubis', name: 'Rubis', min: 1500, max: 2499, title: 'Machine de Guerre', desc: 'Ring rouge rotatif + glow intense', reward: 80 },
            { key: 'diamant', name: 'Diamant', min: 2500, max: 3999, title: 'Faucheuse des Champs', desc: 'Ring irise rotatif + glow prismatique', reward: 100 },
            { key: 'legendaire', name: 'Legendaire', min: 4000, max: null, title: 'Dieu du PVP', desc: 'Ring rouge/or + braises + mega glow', reward: 200 }
        ];

        var userSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

        var html = '<div style="padding: var(--spacing-lg);">';
        html += '<h2 style="font-family: var(--font-title); font-size: 1.3rem; font-weight: 700; margin-bottom: var(--spacing-xs);">Cadres de Profil</h2>';
        html += '<p class="text-muted" style="font-size: 0.8125rem; margin-bottom: var(--spacing-xl);">Les cadres s\'appliquent automatiquement en fonction des points PVP definitifs cumules.</p>';

        html += '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--spacing-xl);">';

        tiers.forEach(function (t) {
            var flames = '';
            if (t.key === 'legendaire') {
                flames = '<div class="frame-flames">';
                for (var i = 0; i < 8; i++) flames += '<div class="frame-flame"></div>';
                flames += '</div>';
            }

            html += '<div style="background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: var(--spacing-lg); display: flex; flex-direction: column; align-items: center; gap: var(--spacing-md);">';
            html += '<div class="avatar-frame avatar-frame--' + t.key + '">';
            html += '<div class="avatar-frame__img">' + userSvg + '</div>';
            html += flames;
            html += '</div>';
            html += '<span class="tier-badge tier-badge--' + t.key + '">' + t.name + '</span>';
            html += '<span class="text-muted" style="font-size: 0.75rem;">' + t.min + (t.max ? ' - ' + t.max : '+') + ' pts</span>';
            html += '<span style="font-weight: 600; font-size: 0.9rem;">' + t.title + '</span>';
            html += '<span class="text-muted" style="font-size: 0.7rem;">' + t.desc + '</span>';
            if (t.reward > 0) {
                html += '<span style="font-weight: 700; font-size: 0.8rem; color: #f0ad4e;">+' + t.reward + ' jetons</span>';
            }
            html += '</div>';
        });

        html += '</div>';

        /* Tableau recapitulatif */
        html += '<h3 style="font-family: var(--font-title); font-size: 1.1rem; font-weight: 700; margin-top: var(--spacing-xl); margin-bottom: var(--spacing-md);">Recapitulatif des paliers</h3>';
        html += '<div style="overflow-x: auto;">';
        html += '<table class="admin-table" style="width: 100%;">';
        html += '<thead><tr>';
        html += '<th>Palier</th><th>Points requis</th><th>Titre</th><th>Recompense</th><th>Style du cadre</th>';
        html += '</tr></thead>';
        html += '<tbody>';
        tiers.forEach(function (t) {
            html += '<tr>';
            html += '<td><span class="tier-badge tier-badge--' + t.key + '">' + t.name + '</span></td>';
            html += '<td>' + t.min + (t.max ? ' - ' + t.max : '+') + '</td>';
            html += '<td>' + t.title + '</td>';
            html += '<td style="font-weight:700; color:#f0ad4e;">' + (t.reward > 0 ? '+' + t.reward + ' jetons' : '-') + '</td>';
            html += '<td class="text-muted" style="font-size:0.8rem;">' + t.desc + '</td>';
            html += '</tr>';
        });
        html += '</tbody></table>';
        html += '</div>';

        html += '</div>';
        content.innerHTML = html;
    }

    /* === TAB: BOARD HEBDO (archivage semaines) === */
    async function tabBoard(content) {
        /* Charger semaines archivées + config récompenses + classement semaine en cours */
        var [semainesRes, configRes, liveRes] = await Promise.all([
            window.REN.supabase.from('semaines').select('*').order('date_debut', { ascending: false }),
            window.REN.supabase.from('recompenses_config').select('*').order('ordre'),
            window.REN.supabase.from('classement_pvp_semaine').select('id, username, points')
        ]);

        var semaines = semainesRes.data || [];
        var config = configRes.data || [];
        var livePlayers = liveRes.data || [];

        /* Charger zones BDA */
        var bdaRes = await window.REN.supabase.from('zones_bda').select('*').order('created_at', { ascending: true });
        var zonesBda = bdaRes.data || [];

        var html = '<div class="admin-panel__title">Board Hebdomadaire</div>';

        /* Section Zones BDA */
        html += '<div style="background:var(--color-bg-tertiary);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--spacing-lg);margin-bottom:var(--spacing-lg);">';
        html += '<h3 style="font-family:var(--font-title);font-size:1rem;font-weight:700;margin-bottom:var(--spacing-sm);">Zones réservées BDA <span class="text-muted" style="font-weight:400;font-size:0.8125rem;">(' + zonesBda.length + '/4)</span></h3>';
        html += '<p class="text-muted" style="font-size:0.8125rem;margin-bottom:var(--spacing-md);">Zones où la Banque d\'Alliance pose des percepteurs pour financer les récompenses.</p>';

        if (zonesBda.length > 0) {
            zonesBda.forEach(function (z) {
                html += '<div style="display:flex;align-items:center;gap:var(--spacing-sm);padding:var(--spacing-xs) 0;border-bottom:1px solid var(--color-border);">';
                html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
                html += '<span style="flex:1;font-weight:600;">' + window.REN.escapeHtml(z.nom_zone) + '</span>';
                if (z.description) html += '<span class="text-muted" style="font-size:0.75rem;flex:1;">' + window.REN.escapeHtml(z.description) + '</span>';
                html += '<button class="btn btn--small btn-delete-bda" data-id="' + z.id + '" data-nom="' + window.REN.escapeHtml(z.nom_zone) + '" style="background:var(--color-danger);color:#fff;font-size:0.7rem;">Supprimer</button>';
                html += '</div>';
            });
        } else {
            html += '<p class="text-muted text-center" style="padding:var(--spacing-sm);">Aucune zone réservée.</p>';
        }

        html += '<div style="display:flex;gap:var(--spacing-sm);margin-top:var(--spacing-md);align-items:flex-end;">';
        html += '<div style="flex:1;"><label class="text-muted" style="font-size:0.75rem;display:block;margin-bottom:4px;">Nom de la zone</label><input class="form-input" id="bda-zone-nom" placeholder="Ex: Plaines de Cania" style="width:100%;"></div>';
        html += '<div style="flex:1;"><label class="text-muted" style="font-size:0.75rem;display:block;margin-bottom:4px;">Description (optionnel)</label><input class="form-input" id="bda-zone-desc" placeholder="Ex: ~150k/h" style="width:100%;"></div>';
        html += '<button class="btn btn--primary btn--small" id="btn-add-bda" ' + (zonesBda.length >= 4 ? 'disabled title="Maximum 4 zones"' : '') + '>Ajouter</button>';
        html += '</div>';
        html += '</div>';

        /* Section archivage */
        html += '<div style="background:var(--color-bg-tertiary);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--spacing-lg);margin-bottom:var(--spacing-lg);">';
        html += '<h3 style="font-family:var(--font-title);font-size:1rem;font-weight:700;margin-bottom:var(--spacing-sm);">Archiver la semaine en cours</h3>';
        html += '<p class="text-muted" style="font-size:0.8125rem;margin-bottom:var(--spacing-md);">' + livePlayers.length + ' joueurs actifs cette semaine</p>';

        if (livePlayers.length > 0) {
            /* Afficher un aperçu */
            html += '<div style="margin-bottom:var(--spacing-md);max-height:200px;overflow-y:auto;">';
            livePlayers.forEach(function (p, i) {
                var reward = findReward(config, p.points);
                html += '<div style="display:flex;align-items:center;gap:var(--spacing-sm);padding:4px 0;font-size:0.8125rem;">';
                html += '<span style="min-width:24px;color:var(--color-text-muted);">' + (i + 1) + '.</span>';
                html += '<span style="flex:1;">' + window.REN.escapeHtml(p.username) + '</span>';
                html += '<span style="color:var(--color-warning);font-weight:600;">' + p.points + ' pts</span>';
                html += '<span style="color:var(--color-success);font-size:0.75rem;">' + (reward ? reward.emoji + ' ' + reward.label : '') + '</span>';
                html += '</div>';
            });
            html += '</div>';
            html += '<button class="btn btn--primary" id="btn-archive-week">Archiver cette semaine</button>';
        } else {
            html += '<p class="text-muted">Aucun joueur actif cette semaine.</p>';
        }
        html += '</div>';

        /* Historique des semaines archivées */
        html += '<h3 style="font-family:var(--font-title);font-size:1rem;font-weight:700;margin-bottom:var(--spacing-sm);">Semaines archivées (' + semaines.length + ')</h3>';

        if (semaines.length) {
            html += '<table class="admin-table"><thead><tr>';
            html += '<th>Période</th><th>Joueurs</th><th>Date d\'archivage</th>';
            html += '</tr></thead><tbody>';

            for (var i = 0; i < semaines.length; i++) {
                var s = semaines[i];
                var { count } = await window.REN.supabase.from('semaine_snapshots').select('id', { count: 'exact', head: true }).eq('semaine_id', s.id);
                html += '<tr>';
                html += '<td style="font-weight:600;">' + formatDate(s.date_debut) + ' — ' + formatDate(s.date_fin) + '</td>';
                html += '<td>' + (count || 0) + ' joueurs</td>';
                html += '<td class="text-muted">' + new Date(s.created_at).toLocaleDateString('fr-FR') + '</td>';
                html += '</tr>';
            }
            html += '</tbody></table>';
        } else {
            html += '<p class="text-muted text-center">Aucune semaine archivée.</p>';
        }

        content.innerHTML = html;

        /* Event archivage */
        var archiveBtn = document.getElementById('btn-archive-week');
        if (archiveBtn) {
            archiveBtn.addEventListener('click', async function () {
                if (!confirm('Archiver la semaine en cours ? Les données seront sauvegardées.')) return;

                archiveBtn.disabled = true;
                archiveBtn.textContent = 'Archivage...';

                try {
                    /* Calculer dates de la semaine en cours (lundi à dimanche) */
                    var now = new Date();
                    var day = now.getDay();
                    var diffToMonday = (day === 0 ? -6 : 1) - day;
                    var monday = new Date(now);
                    monday.setDate(now.getDate() + diffToMonday);
                    var sunday = new Date(monday);
                    sunday.setDate(monday.getDate() + 6);

                    var dateDebut = monday.toISOString().split('T')[0];
                    var dateFin = sunday.toISOString().split('T')[0];

                    /* Vérifier si la semaine n'est pas déjà archivée */
                    var { data: existing } = await window.REN.supabase
                        .from('semaines')
                        .select('id')
                        .eq('date_debut', dateDebut)
                        .eq('date_fin', dateFin);

                    if (existing && existing.length > 0) {
                        window.REN.toast('Cette semaine a déjà été archivée !', 'error');
                        archiveBtn.disabled = false;
                        archiveBtn.textContent = 'Archiver cette semaine';
                        return;
                    }

                    /* Créer la semaine */
                    var { data: semaine, error: semErr } = await window.REN.supabase
                        .from('semaines')
                        .insert({ date_debut: dateDebut, date_fin: dateFin, archivee_par: window.REN.currentProfile.id })
                        .select()
                        .single();

                    if (semErr) throw semErr;

                    /* Snapshot de chaque joueur */
                    var snapshots = livePlayers.map(function (p, idx) {
                        var reward = findReward(config, p.points);
                        return {
                            semaine_id: semaine.id,
                            user_id: p.id,
                            username: p.username,
                            points: p.points,
                            rang: idx + 1,
                            recompense_pepites: reward ? reward.pepites : 0,
                            recompense_percepteurs: reward ? reward.percepteurs_bonus : 0
                        };
                    });

                    if (snapshots.length > 0) {
                        var { error: snapErr } = await window.REN.supabase.from('semaine_snapshots').insert(snapshots);
                        if (snapErr) throw snapErr;
                    }

                    window.REN.toast('Semaine archivée avec succès !', 'success');
                    loadTab('board');
                } catch (err) {
                    console.error('[REN] Erreur archivage:', err);
                    window.REN.toast('Erreur : ' + err.message, 'error');
                    archiveBtn.disabled = false;
                    archiveBtn.textContent = 'Archiver cette semaine';
                }
            });
        }

        /* Events zones BDA */
        var addBdaBtn = document.getElementById('btn-add-bda');
        if (addBdaBtn) {
            addBdaBtn.addEventListener('click', async function () {
                var nom = document.getElementById('bda-zone-nom').value.trim();
                if (!nom) { window.REN.toast('Nom de zone requis', 'error'); return; }
                var desc = document.getElementById('bda-zone-desc').value.trim();
                var { error } = await window.REN.supabase.from('zones_bda').insert({ nom_zone: nom, description: desc || '' });
                if (error) { window.REN.toast('Erreur : ' + error.message, 'error'); return; }
                window.REN.toast('Zone BDA ajoutée !', 'success');
                loadTab('board');
            });
        }

        content.querySelectorAll('.btn-delete-bda').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                var id = parseInt(btn.dataset.id);
                var nom = btn.dataset.nom;
                if (!confirm('Supprimer la zone "' + nom + '" de la BDA ?')) return;
                var { error } = await window.REN.supabase.from('zones_bda').delete().eq('id', id);
                if (error) { window.REN.toast('Erreur : ' + error.message, 'error'); return; }
                window.REN.toast('Zone supprimée !', 'success');
                loadTab('board');
            });
        });
    }

    function findReward(config, points) {
        for (var i = 0; i < config.length; i++) {
            var r = config[i];
            var max = r.seuil_max !== null ? r.seuil_max : 999999;
            if (points >= r.seuil_min && points <= max) return r;
        }
        return null;
    }

    function formatDate(dateStr) {
        var d = new Date(dateStr);
        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    }

    /* === TAB: BARÈME PERCO (config récompenses) === */
    async function tabBaremePerco(content) {
        var { data: config } = await window.REN.supabase
            .from('recompenses_config')
            .select('*')
            .order('ordre');

        var rows = config || [];

        var html = '<div class="admin-panel__title">Barème Percepteurs & Récompenses</div>';
        html += '<p class="text-muted" style="font-size:0.8125rem;margin-bottom:var(--spacing-lg);">Définir les paliers de récompenses en fonction des points hebdomadaires</p>';

        html += '<table class="admin-table" style="width:100%;"><thead><tr>';
        html += '<th style="text-align:center;">Palier</th><th style="text-align:center;">Emoji</th><th style="text-align:center;">Pts min</th><th style="text-align:center;">Pts max</th><th style="text-align:center;">Percos</th><th style="text-align:center;">Pépites</th><th style="text-align:center;">Jetons</th><th style="text-align:center;">Actions</th>';
        html += '</tr></thead><tbody>';

        rows.forEach(function (r) {
            html += '<tr data-id="' + r.id + '">';
            html += '<td style="text-align:center;"><input class="form-input" style="width:90px;text-align:center;" value="' + r.label + '" data-field="label"></td>';
            html += '<td style="text-align:center;"><input class="form-input" style="width:45px;text-align:center;" value="' + (r.emoji || '') + '" data-field="emoji"></td>';
            html += '<td style="text-align:center;"><input class="form-input" style="width:65px;text-align:center;" type="number" value="' + r.seuil_min + '" data-field="seuil_min"></td>';
            html += '<td style="text-align:center;"><input class="form-input" style="width:65px;text-align:center;" type="number" value="' + (r.seuil_max !== null ? r.seuil_max : '') + '" placeholder="∞" data-field="seuil_max"></td>';
            html += '<td style="text-align:center;"><input class="form-input" style="width:65px;text-align:center;" type="number" value="' + r.percepteurs_bonus + '" data-field="percepteurs_bonus"></td>';
            html += '<td style="text-align:center;"><input class="form-input" style="width:70px;text-align:center;" type="number" value="' + r.pepites + '" data-field="pepites"></td>';
            html += '<td style="text-align:center;"><input class="form-input" style="width:65px;text-align:center;" type="number" value="' + (r.jetons_reward || 0) + '" data-field="jetons_reward"></td>';
            html += '<td style="text-align:center;"><button class="btn btn--danger btn--small btn-delete-tier" data-id="' + r.id + '">✕</button></td>';
            html += '</tr>';
        });

        html += '</tbody></table>';

        html += '<div style="display:flex;gap:var(--spacing-sm);margin-top:var(--spacing-md);">';
        html += '<button class="btn btn--primary" id="btn-save-bareme">Sauvegarder</button>';
        html += '<button class="btn btn--secondary" id="btn-add-tier">+ Ajouter un palier</button>';
        html += '</div>';

        content.innerHTML = html;

        /* Save */
        document.getElementById('btn-save-bareme').addEventListener('click', async function () {
            var tableRows = content.querySelectorAll('tbody tr');
            var updates = [];

            tableRows.forEach(function (tr) {
                var id = parseInt(tr.getAttribute('data-id'));
                if (!id) return;
                var inputs = tr.querySelectorAll('input');
                var label = inputs[0].value.trim();
                var emoji = inputs[1].value.trim();
                var seuil_min = parseInt(inputs[2].value) || 0;
                var seuil_max = inputs[3].value.trim() === '' ? null : parseInt(inputs[3].value);
                var percepteurs_bonus = parseInt(inputs[4].value) || 0;
                var pepites = parseInt(inputs[5].value) || 0;
                var jetons_reward = parseInt(inputs[6].value) || 0;

                updates.push(
                    window.REN.supabase.from('recompenses_config').update({
                        label: label, emoji: emoji, seuil_min: seuil_min, seuil_max: seuil_max,
                        percepteurs_bonus: percepteurs_bonus, pepites: pepites, jetons_reward: jetons_reward
                    }).eq('id', id)
                );
            });

            await Promise.all(updates);
            window.REN.toast('Barème sauvegardé !', 'success');
        });

        /* Add tier */
        document.getElementById('btn-add-tier').addEventListener('click', async function () {
            var maxOrdre = rows.length ? Math.max.apply(null, rows.map(function (r) { return r.ordre; })) : 0;
            var { error } = await window.REN.supabase.from('recompenses_config').insert({
                label: 'Nouveau', emoji: '🏅', seuil_min: 0, seuil_max: null,
                percepteurs_bonus: 0, pepites: 0, jetons_reward: 0, ordre: maxOrdre + 1
            });
            if (error) {
                console.error('[REN-ADMIN] Erreur ajout palier:', error);
                window.REN.toast('Erreur : ' + error.message, 'error');
                return;
            }
            window.REN.toast('Palier ajouté !', 'success');
            loadTab('bareme-perco');
        });

        /* Delete tier */
        content.querySelectorAll('.btn-delete-tier').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                if (!confirm('Supprimer ce palier ?')) return;
                await window.REN.supabase.from('recompenses_config').delete().eq('id', parseInt(btn.getAttribute('data-id')));
                loadTab('bareme-perco');
            });
        });
    }

    /* ============================================ */
    /* ONGLET BOUTIQUE (gestion catalogue + achats) */
    /* ============================================ */
    async function tabBoutique(container) {
        var results = await Promise.all([
            window.REN.supabase.from('boutique_items').select('*').order('created_at', { ascending: false }),
            window.REN.supabase.from('boutique_achats').select('*, profiles:user_id(username), boutique_items:item_id(image_url)').eq('statut', 'en_attente').order('created_at', { ascending: false }),
            window.REN.supabase.from('boutique_config').select('*').single(),
            window.REN.supabase.from('boutique_achats').select('*, profiles:user_id(username), boutique_items:item_id(image_url)').eq('statut', 'distribue').order('created_at', { ascending: false }).limit(30)
        ]);

        var items = (results[0].data || []);
        var achatsEnAttente = (results[1].data || []);
        var config = results[2].data;
        var achatsDistribues = (results[3].data || []);
        var taux = config ? config.taux_kamas_par_jeton : 5000;

        var html = '<div class="admin-panel__title">Gestion Boutique</div>';

        /* Config taux */
        html += '<div style="margin-bottom:var(--spacing-lg);padding:var(--spacing-md);background:var(--color-bg-primary);border-radius:var(--radius-md);border:1px solid var(--color-border);">';
        html += '<label class="form-label">Taux kamas par jeton</label>';
        html += '<div style="display:flex;gap:var(--spacing-sm);align-items:center;">';
        html += '<input class="form-input" id="boutique-taux" type="number" value="' + taux + '" min="1" style="width:120px;">';
        html += '<span class="text-muted">kamas = 1 jeton</span>';
        html += '<button class="btn btn--primary btn--small" id="btn-save-taux">Sauver</button>';
        html += '</div></div>';

        /* Achats à distribuer */
        var esc2 = window.REN.escapeHtml;
        html += '<h3 style="font-family:var(--font-title);font-size:1rem;font-weight:700;margin-bottom:var(--spacing-sm);color:var(--color-warning);">Achats \u00e0 distribuer (' + achatsEnAttente.length + ')</h3>';
        if (achatsEnAttente.length > 0) {
            html += '<div class="admin-achats-list" style="margin-bottom:var(--spacing-lg);">';
            achatsEnAttente.forEach(function (a) {
                var username = a.profiles ? esc2(a.profiles.username) : 'Inconnu';
                var imageUrl = (a.boutique_items && a.boutique_items.image_url) ? window.REN.sanitizeUrl(a.boutique_items.image_url) : '';
                var date = new Date(a.created_at).toLocaleDateString('fr-FR');
                html += '<div class="admin-achat-card">';
                html += '<div class="admin-achat-card__image">';
                if (imageUrl) {
                    html += '<img src="' + esc2(imageUrl) + '" alt="' + esc2(a.item_nom) + '">';
                } else {
                    html += '<span class="text-muted" style="font-size:1.25rem;">?</span>';
                }
                html += '</div>';
                html += '<div class="admin-achat-card__info">';
                html += '<span class="admin-achat-card__article">' + esc2(a.item_nom) + '</span>';
                html += '<span class="admin-achat-card__detail">Achet\u00e9 par <strong>' + username + '</strong> \u00b7 ' + a.prix_paye + ' <img class="icon-inline" src="assets/images/jeton.png" alt="jetons"> \u00b7 ' + date + '</span>';
                html += '</div>';
                html += '<div style="display:flex;gap:var(--spacing-xs);align-items:center;">';
                html += '<button class="btn btn--primary btn--small btn-distribue" data-id="' + a.id + '" data-reward="' + (a.jetons_credites || 0) + '">' + ((a.jetons_credites > 0) ? 'Valider (+' + a.jetons_credites + ' jetons) \u2713' : 'Distribu\u00e9 \u2713') + '</button>';
                html += '<button class="btn btn--small btn-annuler-achat" data-id="' + a.id + '" data-nom="' + esc2(a.item_nom) + '" style="background:var(--color-danger);color:#fff;">Annuler</button>';
                html += '</div>';
                html += '</div>';
            });
            html += '</div>';
        } else {
            html += '<p class="text-muted" style="margin-bottom:var(--spacing-lg);">Aucun achat en attente.</p>';
        }

        /* Historique distribués */
        html += '<details style="margin-bottom:var(--spacing-lg);">';
        html += '<summary style="cursor:pointer;font-family:var(--font-title);font-size:0.9rem;font-weight:700;color:var(--color-text-muted);margin-bottom:var(--spacing-sm);">Historique distribu\u00e9s (' + achatsDistribues.length + ')</summary>';
        if (achatsDistribues.length > 0) {
            html += '<div class="admin-achats-list" style="margin-top:var(--spacing-sm);">';
            achatsDistribues.forEach(function (a) {
                var username = a.profiles ? esc2(a.profiles.username) : 'Inconnu';
                var imageUrl = (a.boutique_items && a.boutique_items.image_url) ? window.REN.sanitizeUrl(a.boutique_items.image_url) : '';
                var date = new Date(a.created_at).toLocaleDateString('fr-FR');
                html += '<div class="admin-achat-card" style="opacity:0.7;">';
                html += '<div class="admin-achat-card__image">';
                if (imageUrl) {
                    html += '<img src="' + imageUrl + '" alt="' + esc2(a.item_nom) + '" loading="lazy">';
                } else {
                    html += '<span class="text-muted" style="font-size:1.25rem;">?</span>';
                }
                html += '</div>';
                html += '<div class="admin-achat-card__info">';
                html += '<span class="admin-achat-card__article">' + esc2(a.item_nom) + '</span>';
                html += '<span class="admin-achat-card__detail">' + username + ' \u00b7 ' + a.prix_paye + ' <img class="icon-inline" src="assets/images/jeton.png" alt="jetons"> \u00b7 ' + date + '</span>';
                html += '</div>';
                html += '<div style="display:flex;gap:var(--spacing-xs);align-items:center;">';
                html += '<span class="badge-statut badge-statut--distribue">Distribu\u00e9</span>';
                html += '<button class="btn btn--small btn-rembourser-achat" data-id="' + a.id + '" data-nom="' + esc2(a.item_nom) + '" style="background:var(--color-danger);color:#fff;font-size:0.7rem;">Rembourser</button>';
                html += '</div>';
                html += '</div>';
            });
            html += '</div>';
        } else {
            html += '<p class="text-muted" style="margin-top:var(--spacing-sm);">Aucun achat distribu\u00e9.</p>';
        }
        html += '</details>';

        /* Ajouter un article */
        html += '<h3 style="font-family:var(--font-title);font-size:1rem;font-weight:700;margin-bottom:var(--spacing-sm);">Ajouter un article</h3>';
        html += '<div style="display:flex;gap:var(--spacing-sm);flex-wrap:wrap;margin-bottom:var(--spacing-sm);align-items:flex-end;">';
        html += '<div><label class="form-label">Nom</label><input class="form-input" id="add-item-nom" placeholder="Bl\u00e9 x100" style="width:160px;"></div>';
        html += '<div><label class="form-label">Description</label><input class="form-input" id="add-item-desc" placeholder="Optionnel" style="width:180px;"></div>';
        html += '<div><label class="form-label">Prix</label><input class="form-input" id="add-item-prix" type="number" min="1" value="1" style="width:90px;"></div>';
        html += '<div><label class="form-label">Devise</label><select class="form-select" id="add-item-devise" style="width:130px;"><option value="classique">Classique</option><option value="enutrosor">Enutrosor</option><option value="kamas">Kamas</option></select></div>';
        html += '<div><label class="form-label">Jetons offerts</label><input class="form-input" id="add-item-reward" type="number" min="0" value="0" style="width:90px;" title="Nb de jetons credites au joueur (pour packs kamas)"></div>';
        html += '<div><label class="form-label">Stock (-1=illimit\u00e9)</label><input class="form-input" id="add-item-stock" type="number" value="-1" style="width:90px;"></div>';
        html += '</div>';

        /* Image : ID DofusDB */
        html += '<div style="display:flex;gap:var(--spacing-sm);flex-wrap:wrap;margin-bottom:var(--spacing-sm);align-items:flex-end;">';
        html += '<div><label class="form-label">Image - ID DofusDB</label><div style="display:flex;gap:var(--spacing-xs);align-items:center;"><input class="form-input" id="add-item-dofusdb" placeholder="Ex: 28203" style="width:120px;"><button class="btn btn--secondary btn--small" id="btn-preview-dofusdb" type="button">Importer</button></div>';
        html += '<span class="text-muted" style="font-size:0.75rem;">dofusdb.fr/database/object/<strong>28203</strong></span></div>';
        html += '</div>';
        html += '<div id="add-item-preview" style="margin-bottom:var(--spacing-sm);"></div>';

        html += '<button class="btn btn--primary" id="btn-add-item" style="margin-bottom:var(--spacing-lg);">Ajouter</button>';

        /* Liste des articles */
        html += '<h3 style="font-family:var(--font-title);font-size:1rem;font-weight:700;margin-bottom:var(--spacing-sm);">Catalogue (' + items.length + ' articles)</h3>';
        if (items.length > 0) {
            html += '<table class="admin-table"><thead><tr><th>Image</th><th>Nom</th><th>Description</th><th>Prix</th><th>Devise</th><th>Stock</th><th>Actif</th><th>Actions</th></tr></thead><tbody>';
            var escI = window.REN.escapeHtml;
            items.forEach(function (item) {
                var safeImgUrl = window.REN.sanitizeUrl(item.image_url);
                var imgHtml = safeImgUrl
                    ? '<img src="' + escI(safeImgUrl) + '" style="width:40px;height:40px;object-fit:cover;border-radius:4px;">'
                    : '<span class="text-muted">-</span>';

                html += '<tr data-row-id="' + item.id + '">';
                html += '<td>' + imgHtml + '</td>';

                /* Display */
                html += '<td class="cell-display" data-field="nom">' + escI(item.nom) + '</td>';
                html += '<td class="cell-display" data-field="desc">' + escI(item.description || '') + '</td>';
                var deviseLabel = (item.devise === 'enutrosor') ? '<img class="icon-inline" src="assets/images/kamatrix.png" alt="enutrosor">' : (item.devise === 'kamas') ? '<img class="icon-inline" src="assets/images/Kama.webp" alt="kamas">' : '<img class="icon-inline" src="assets/images/jeton.png" alt="jetons">';
                html += '<td class="cell-display" data-field="prix">' + item.prix_jetons + '</td>';
                html += '<td class="cell-display" data-field="devise">' + deviseLabel + '</td>';
                html += '<td class="cell-display" data-field="stock">' + (item.stock === -1 ? '\u221e' : item.stock) + '</td>';
                html += '<td class="cell-display" data-field="actif">' + (item.actif ? '\u2705' : '\u274c') + '</td>';

                /* Edit */
                html += '<td class="cell-edit" data-field="nom" style="display:none;"><input class="form-input edit-nom" value="' + escI(item.nom) + '" style="width:120px;"></td>';
                html += '<td class="cell-edit" data-field="desc" style="display:none;"><input class="form-input edit-desc" value="' + escI(item.description || '') + '" style="width:140px;"></td>';
                html += '<td class="cell-edit" data-field="prix" style="display:none;"><input class="form-input edit-prix" type="number" value="' + item.prix_jetons + '" style="width:70px;"></td>';
                html += '<td class="cell-edit" data-field="devise" style="display:none;"><select class="form-select edit-devise"><option value="classique"' + ((item.devise || 'classique') === 'classique' ? ' selected' : '') + '>Classique</option><option value="enutrosor"' + (item.devise === 'enutrosor' ? ' selected' : '') + '>Enutrosor</option></select></td>';
                html += '<td class="cell-edit" data-field="stock" style="display:none;"><input class="form-input edit-stock" type="number" value="' + item.stock + '" style="width:70px;"></td>';
                html += '<td class="cell-edit" data-field="actif" style="display:none;"><select class="form-select edit-actif"><option value="true"' + (item.actif ? ' selected' : '') + '>Oui</option><option value="false"' + (!item.actif ? ' selected' : '') + '>Non</option></select></td>';

                /* Actions */
                html += '<td>';
                html += '<span class="actions-display">';
                html += '<button class="table__action admin-edit-item" data-id="' + item.id + '">Modifier</button> ';
                html += '<button class="table__action table__action--danger admin-delete-item" data-id="' + item.id + '">Supprimer</button>';
                html += '</span>';
                html += '<span class="actions-edit" style="display:none;">';
                html += '<button class="btn btn--primary btn--small admin-save-item" data-id="' + item.id + '">Sauver</button> ';
                html += '<button class="btn btn--secondary btn--small admin-cancel-item" data-id="' + item.id + '">Annuler</button>';
                html += '</span>';
                html += '</td>';

                html += '</tr>';
            });
            html += '</tbody></table>';
        } else {
            html += '<p class="text-muted">Aucun article.</p>';
        }

        container.innerHTML = html;

        /* === EVENT LISTENERS === */

        /* Save taux */
        document.getElementById('btn-save-taux').addEventListener('click', async function () {
            var newTaux = parseInt(document.getElementById('boutique-taux').value) || 5000;
            if (config && config.id) {
                await window.REN.supabase.from('boutique_config').update({ taux_kamas_par_jeton: newTaux }).eq('id', config.id);
            }
            window.REN.toast('Taux sauvegard\u00e9 !', 'success');
        });

        /* Distribué */
        container.querySelectorAll('.btn-distribue').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                var achatId = parseInt(btn.dataset.id);
                var jetonsReward = parseInt(btn.dataset.reward || '0');
                if (jetonsReward > 0) {
                    if (!confirm('Confirmer que les kamas ont ete recus en jeu ?\n' + jetonsReward + ' jetons seront credites au joueur.')) return;
                    var resp = await window.REN.supabase.rpc('valider_achat_kamas', { p_achat_id: achatId });
                    if (resp.error) { window.REN.toast('Erreur : ' + resp.error.message, 'error'); return; }
                    window.REN.toast('Achat valide ! ' + jetonsReward + ' jetons credites.', 'success');
                } else {
                    if (!confirm('Confirmer que la ressource a ete donnee en jeu ?')) return;
                    await window.REN.supabase.from('boutique_achats').update({ statut: 'distribue' }).eq('id', achatId);
                    window.REN.toast('Achat marque comme distribue.', 'success');
                }
                loadTab('boutique');
            });
        });

        /* Annuler / Rembourser un achat */
        container.querySelectorAll('.btn-annuler-achat, .btn-rembourser-achat').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                var achatId = parseInt(btn.dataset.id);
                var nomItem = btn.dataset.nom || '';
                var isRemboursement = btn.classList.contains('btn-rembourser-achat');
                var msg = isRemboursement
                    ? 'Rembourser l\'achat "' + nomItem + '" et recrediter les jetons au joueur ?'
                    : 'Annuler l\'achat "' + nomItem + '" et recrediter les jetons au joueur ?';
                if (!confirm(msg)) return;
                var resp = await window.REN.supabase.rpc('rembourser_achat', { p_achat_id: achatId });
                if (resp.error) {
                    window.REN.toast('Erreur : ' + resp.error.message, 'error');
                    return;
                }
                window.REN.toast('Achat annul\u00e9 et jetons recr\u00e9dit\u00e9s !', 'success');
                loadTab('boutique');
            });
        });

        /* Fonction utilitaire : fetch DofusDB */
        async function fetchDofusDB(dofusId) {
            var resp = await fetch('https://api.dofusdb.fr/items/' + encodeURIComponent(dofusId));
            if (!resp.ok) throw new Error('ID introuvable');
            return await resp.json();
        }

        /* Importer depuis DofusDB */
        document.getElementById('btn-preview-dofusdb').addEventListener('click', async function () {
            var dofusId = document.getElementById('add-item-dofusdb').value.trim();
            var previewDiv = document.getElementById('add-item-preview');
            if (!dofusId) { window.REN.toast('Entre un ID DofusDB.', 'error'); return; }
            previewDiv.innerHTML = '<span class="text-muted">Chargement...</span>';
            try {
                var data = await fetchDofusDB(dofusId);
                if (data.img) {
                    previewDiv.innerHTML = '<div style="display:flex;align-items:center;gap:var(--spacing-sm);"><img src="' + data.img + '" style="width:64px;height:64px;object-fit:contain;border-radius:4px;border:1px solid var(--color-border);background:var(--color-bg-primary);"><span style="color:var(--color-success);">\u2713 Import\u00e9</span></div>';
                    previewDiv.dataset.resolvedUrl = data.img;
                    /* Auto-remplir le nom si vide */
                    if (data.name && data.name.fr && !document.getElementById('add-item-nom').value.trim()) {
                        document.getElementById('add-item-nom').value = data.name.fr;
                    }
                } else {
                    previewDiv.innerHTML = '<span class="text-muted">Pas d\'image trouv\u00e9e.</span>';
                }
            } catch (err) {
                previewDiv.innerHTML = '<span style="color:var(--color-danger);">Erreur : ' + err.message + '</span>';
            }
        });

        /* Add item */
        document.getElementById('btn-add-item').addEventListener('click', async function () {
            var nom = document.getElementById('add-item-nom').value.trim();
            var desc = document.getElementById('add-item-desc').value.trim();
            var prix = parseInt(document.getElementById('add-item-prix').value) || 1;
            var stock = parseInt(document.getElementById('add-item-stock').value);
            var previewDiv = document.getElementById('add-item-preview');
            var dofusId = document.getElementById('add-item-dofusdb').value.trim();
            var imageUrl = previewDiv.dataset.resolvedUrl || '';

            /* Si ID DofusDB rempli mais pas encore importé, le faire auto */
            if (!imageUrl && dofusId) {
                try {
                    var data = await fetchDofusDB(dofusId);
                    if (data.img) imageUrl = data.img;
                    if (data.name && data.name.fr && !nom) nom = data.name.fr;
                } catch (err) {
                    window.REN.toast('Erreur DofusDB : ' + err.message, 'error');
                    return;
                }
            }

            if (!nom) { window.REN.toast('Le nom est obligatoire.', 'error'); return; }

            var devise = document.getElementById('add-item-devise').value || 'classique';
            var reward = parseInt(document.getElementById('add-item-reward').value) || 0;
            await window.REN.supabase.from('boutique_items').insert({
                nom: nom,
                description: desc,
                prix_jetons: prix,
                stock: isNaN(stock) ? -1 : stock,
                image_url: imageUrl,
                actif: true,
                devise: devise,
                jetons_reward: reward
            });
            window.REN.toast('Article ajout\u00e9 !', 'success');
            loadTab('boutique');
        });

        /* Edit item */
        container.querySelectorAll('.admin-edit-item').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var row = container.querySelector('tr[data-row-id="' + btn.dataset.id + '"]');
                if (!row) return;
                row.querySelectorAll('.cell-display').forEach(function (td) { td.style.display = 'none'; });
                row.querySelectorAll('.cell-edit').forEach(function (td) { td.style.display = ''; });
                row.querySelector('.actions-display').style.display = 'none';
                row.querySelector('.actions-edit').style.display = '';
            });
        });

        /* Save item */
        container.querySelectorAll('.admin-save-item').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                var row = container.querySelector('tr[data-row-id="' + btn.dataset.id + '"]');
                if (!row) return;
                var updateData = {
                    nom: row.querySelector('.edit-nom').value.trim(),
                    description: row.querySelector('.edit-desc').value.trim(),
                    prix_jetons: parseInt(row.querySelector('.edit-prix').value) || 1,
                    stock: parseInt(row.querySelector('.edit-stock').value),
                    actif: row.querySelector('.edit-actif').value === 'true',
                    devise: row.querySelector('.edit-devise') ? row.querySelector('.edit-devise').value : 'classique'
                };
                if (!updateData.nom) { window.REN.toast('Le nom est obligatoire.', 'error'); return; }
                await window.REN.supabase.from('boutique_items').update(updateData).eq('id', parseInt(btn.dataset.id));
                window.REN.toast('Article modifi\u00e9 !', 'success');
                loadTab('boutique');
            });
        });

        /* Cancel edit */
        container.querySelectorAll('.admin-cancel-item').forEach(function (btn) {
            btn.addEventListener('click', function () { loadTab('boutique'); });
        });

        /* Delete item */
        container.querySelectorAll('.admin-delete-item').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                if (!confirm('Supprimer cet article ?')) return;
                await window.REN.supabase.from('boutique_items').delete().eq('id', parseInt(btn.dataset.id));
                window.REN.toast('Article supprim\u00e9.', 'info');
                loadTab('boutique');
            });
        });
    }

    /* ============================================ */
    /* ONGLET DEMANDES KAMAS                        */
    /* ============================================ */
    async function tabDemandesKamas(container) {
        var { data, error } = await window.REN.supabase
            .from('boutique_demandes_kamas')
            .select('*, profiles:user_id(username)')
            .order('created_at', { ascending: false });

        var demandes = data || [];
        var enAttente = demandes.filter(function (d) { return d.statut === 'en_attente'; });
        var traitees = demandes.filter(function (d) { return d.statut !== 'en_attente'; });

        var html = '<div class="admin-panel__title">Demandes d\'achat de jetons (kamas)</div>';

        /* En attente */
        html += '<h3 style="font-family:var(--font-title);font-size:1rem;font-weight:700;margin-bottom:var(--spacing-sm);color:var(--color-warning);">En attente (' + enAttente.length + ')</h3>';
        if (enAttente.length > 0) {
            html += '<table class="admin-table" style="margin-bottom:var(--spacing-lg);"><thead><tr><th>Joueur</th><th>Kamas</th><th>Jetons demand\u00e9s</th><th>Date</th><th>Actions</th></tr></thead><tbody>';
            enAttente.forEach(function (d) {
                var username = d.profiles ? window.REN.escapeHtml(d.profiles.username) : 'Inconnu';
                var date = new Date(d.created_at).toLocaleDateString('fr-FR');
                html += '<tr>';
                html += '<td><strong>' + username + '</strong></td>';
                html += '<td>' + window.REN.formatKamas(d.montant_kamas) + '</td>';
                html += '<td style="color:var(--color-warning);font-weight:700;">' + d.jetons_demandes + ' jetons</td>';
                html += '<td>' + date + '</td>';
                html += '<td>';
                html += '<button class="btn btn--primary btn--small btn-valider-kamas" data-id="' + d.id + '" data-user="' + d.user_id + '" data-jetons="' + d.jetons_demandes + '">Valider \u2713</button> ';
                html += '<button class="btn btn--secondary btn--small btn-refuser-kamas" data-id="' + d.id + '">Refuser</button>';
                html += '</td>';
                html += '</tr>';
            });
            html += '</tbody></table>';
        } else {
            html += '<p class="text-muted" style="margin-bottom:var(--spacing-lg);">Aucune demande en attente.</p>';
        }

        /* Historique traité */
        if (traitees.length > 0) {
            html += '<h3 style="font-family:var(--font-title);font-size:1rem;font-weight:700;margin-bottom:var(--spacing-sm);">Historique</h3>';
            html += '<table class="admin-table"><thead><tr><th>Joueur</th><th>Kamas</th><th>Jetons</th><th>Date</th><th>Statut</th></tr></thead><tbody>';
            traitees.forEach(function (d) {
                var username = d.profiles ? window.REN.escapeHtml(d.profiles.username) : 'Inconnu';
                var date = new Date(d.created_at).toLocaleDateString('fr-FR');
                var badgeClass = 'badge-statut badge-statut--' + window.REN.escapeHtml(d.statut);
                var statutText = d.statut === 'valide' ? 'Valid\u00e9' : 'Refus\u00e9';
                html += '<tr>';
                html += '<td>' + username + '</td>';
                html += '<td>' + window.REN.formatKamas(d.montant_kamas) + '</td>';
                html += '<td>' + d.jetons_demandes + '</td>';
                html += '<td>' + date + '</td>';
                html += '<td><span class="' + badgeClass + '">' + statutText + '</span></td>';
                html += '</tr>';
            });
            html += '</tbody></table>';
        }

        container.innerHTML = html;

        /* === EVENT LISTENERS === */

        /* Valider : crédite les jetons au joueur */
        container.querySelectorAll('.btn-valider-kamas').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                var demandeId = parseInt(btn.dataset.id);
                var targetUserId = btn.dataset.user;
                var jetons = parseInt(btn.dataset.jetons);

                if (!confirm('Valider cette demande et cr\u00e9diter ' + jetons + ' jetons au joueur ?')) return;

                try {
                    /* Créditer les jetons */
                    await window.REN.supabase.rpc('ajouter_jetons', {
                        p_user_id: targetUserId,
                        p_points: jetons
                    });

                    /* Marquer comme validé */
                    await window.REN.supabase.from('boutique_demandes_kamas')
                        .update({ statut: 'valide' })
                        .eq('id', demandeId);

                    window.REN.toast('Demande valid\u00e9e, ' + jetons + ' jetons cr\u00e9dit\u00e9s !', 'success');
                    loadTab('demandes-kamas');
                } catch (err) {
                    window.REN.toast('Erreur : ' + err.message, 'error');
                }
            });
        });

        /* Refuser */
        container.querySelectorAll('.btn-refuser-kamas').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                if (!confirm('Refuser cette demande ?')) return;
                await window.REN.supabase.from('boutique_demandes_kamas')
                    .update({ statut: 'refuse' })
                    .eq('id', parseInt(btn.dataset.id));
                window.REN.toast('Demande refus\u00e9e.', 'info');
                loadTab('demandes-kamas');
            });
        });
    }

    /* ============================================ */
    /* ONGLET SLOT MACHINE                          */
    /* ============================================ */
    async function tabSlot(container) {
        var esc = window.REN.escapeHtml;
        var results = await Promise.all([
            window.REN.supabase.from('slot_symboles').select('*').order('ordre', { ascending: true }),
            window.REN.supabase.from('slot_historique').select('*, profiles:joueur_id(username)').order('created_at', { ascending: false }).limit(30)
        ]);

        var symboles = results[0].data || [];
        var historique = results[1].data || [];

        var html = '<div class="admin-panel__title">Machine a Sous - Symboles</div>';

        /* === Calculer RTP theorique === */
        var totalPoids = symboles.reduce(function (sum, s) { return sum + (s.actif ? s.poids : 0); }, 0);
        var rtp = 0;
        if (totalPoids > 0) {
            symboles.forEach(function (s) {
                if (!s.actif) return;
                var prob = s.poids / totalPoids;
                /* Triple */
                rtp += Math.pow(prob, 3) * s.gain_triple;
                /* Paire : 3 * p^2 * (1-p) */
                rtp += 3 * Math.pow(prob, 2) * (1 - prob) * (s.gain_paire || 0);
            });
        }
        var rtpPercent = (rtp * 100).toFixed(1);

        html += '<div style="margin-bottom:var(--spacing-lg);padding:var(--spacing-md);background:var(--color-bg-primary);border-radius:var(--radius-md);border:1px solid var(--color-border);">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--spacing-sm);">';
        html += '<div>';
        html += '<span class="form-label" style="margin-bottom:2px;">RTP Theorique</span>';
        html += '<div style="font-family:var(--font-title);font-size:1.5rem;font-weight:700;color:' + (rtp < 0.85 ? 'var(--color-danger)' : rtp > 1 ? 'var(--color-danger)' : 'var(--color-success)') + ';">' + rtpPercent + '%</div>';
        html += '<span class="text-muted" style="font-size:0.7rem;">Cible casino : 90-95%</span>';
        html += '</div>';
        html += '<div>';
        html += '<span class="form-label" style="margin-bottom:2px;">Poids Total</span>';
        html += '<div style="font-family:var(--font-title);font-size:1.25rem;font-weight:700;color:var(--color-text-primary);">' + totalPoids + '</div>';
        html += '</div>';
        html += '</div></div>';

        /* === Liste des symboles === */
        html += '<div class="admin-achats-list" style="margin-bottom:var(--spacing-lg);">';
        symboles.forEach(function (s) {
            var prob = totalPoids > 0 ? ((s.poids / totalPoids) * 100).toFixed(1) : '0';
            var imgHtml = s.image_url ? '<img src="' + esc(s.image_url) + '" alt="' + esc(s.nom) + '" style="width:40px;height:40px;object-fit:contain;">' : '<span class="text-muted" style="font-size:1.5rem;">?</span>';

            html += '<div class="admin-achat-card" style="' + (s.actif ? '' : 'opacity:0.4;') + 'flex-wrap:wrap;">';
            html += '<div style="display:flex;align-items:center;gap:var(--spacing-sm);width:100%;">';
            html += '<div style="width:50px;height:50px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--color-bg-primary);border-radius:var(--radius-sm);">' + imgHtml + '</div>';
            html += '<div style="flex:1;min-width:0;">';
            html += '<div style="font-family:var(--font-title);font-weight:700;font-size:0.9375rem;">' + esc(s.nom) + '</div>';
            html += '<div class="text-muted" style="font-size:0.8rem;">Poids : <strong style="color:var(--color-text-primary);">' + s.poids + '</strong> (' + prob + '%) · Triple : <strong style="color:var(--color-warning);">x' + s.gain_triple + '</strong> · Paire : <strong style="color:var(--color-text-primary);">x' + (s.gain_paire || 0) + '</strong></div>';
            html += '</div>';
            html += '<div style="display:flex;gap:4px;flex-shrink:0;">';
            html += '<button class="btn btn--primary btn--small btn-edit-sym" data-id="' + s.id + '">Editer</button>';
            html += '<button class="btn btn--secondary btn--small btn-toggle-sym" data-id="' + s.id + '" data-actif="' + s.actif + '">' + (s.actif ? 'Desactiver' : 'Activer') + '</button>';
            html += '</div>';
            html += '</div>';
            html += '</div>';
        });
        html += '</div>';

        /* === Ajouter un symbole === */
        html += '<h3 style="font-family:var(--font-title);font-size:1rem;font-weight:700;margin-bottom:var(--spacing-sm);">Ajouter un symbole</h3>';
        html += '<div style="display:flex;gap:var(--spacing-sm);flex-wrap:wrap;margin-bottom:var(--spacing-sm);align-items:flex-end;">';
        html += '<div><label class="form-label">Nom</label><input class="form-input" id="slot-add-nom" placeholder="aubergine" style="width:120px;"></div>';
        html += '<div><label class="form-label">ID DofusDB</label><div style="display:flex;gap:4px;"><input class="form-input" id="slot-add-dofusid" placeholder="Ex: 28203" style="width:100px;"><button class="btn btn--secondary btn--small" id="slot-add-fetch" type="button">Importer</button></div></div>';
        html += '<div style="flex:1;min-width:150px;"><label class="form-label">Image URL</label><input class="form-input" id="slot-add-img" placeholder="Auto via ID DofusDB" style="width:100%;"></div>';
        html += '<div id="slot-add-preview" style="width:40px;height:40px;"></div>';
        html += '<div><label class="form-label">Poids</label><input class="form-input" id="slot-add-poids" type="number" min="1" value="10" style="width:70px;"></div>';
        html += '<div><label class="form-label">Triple (x)</label><input class="form-input" id="slot-add-triple" type="number" min="0" value="5" style="width:70px;"></div>';
        html += '<div><label class="form-label">Paire (x)</label><input class="form-input" id="slot-add-paire" type="number" min="0" value="0" style="width:70px;"></div>';
        html += '<button class="btn btn--primary btn--small" id="slot-add-btn">Ajouter</button>';
        html += '</div>';

        /* === Historique recent === */
        html += '<details style="margin-top:var(--spacing-lg);">';
        html += '<summary style="cursor:pointer;font-family:var(--font-title);font-size:0.9rem;font-weight:700;color:var(--color-text-muted);margin-bottom:var(--spacing-sm);">Historique tirages (' + historique.length + ')</summary>';
        if (historique.length > 0) {
            html += '<div style="max-height:300px;overflow-y:auto;margin-top:var(--spacing-sm);">';
            html += '<table class="admin-table"><thead><tr><th>Joueur</th><th>Mise</th><th>Resultat</th><th>Gain</th><th>Date</th></tr></thead><tbody>';
            historique.forEach(function (h) {
                var username = h.profiles ? esc(h.profiles.username) : 'Inconnu';
                var date = new Date(h.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                var resultat = (h.resultat || []).join(' | ');
                var gainClass = h.gain_jetons > 0 ? 'color:var(--color-warning);font-weight:700;' : 'color:var(--color-text-muted);';
                html += '<tr>';
                html += '<td>' + username + '</td>';
                html += '<td>' + h.mise + '</td>';
                html += '<td>' + esc(resultat) + '</td>';
                html += '<td style="' + gainClass + '">' + (h.gain_jetons > 0 ? '+' : '') + h.gain_jetons + '</td>';
                html += '<td class="text-muted">' + date + '</td>';
                html += '</tr>';
            });
            html += '</tbody></table></div>';
        } else {
            html += '<p class="text-muted" style="margin-top:var(--spacing-sm);">Aucun tirage.</p>';
        }
        html += '</details>';

        container.innerHTML = html;

        /* === EVENT LISTENERS === */

        /* Fetch image DofusDB pour ajout */
        var fetchAddBtn = document.getElementById('slot-add-fetch');
        if (fetchAddBtn) fetchAddBtn.addEventListener('click', async function () {
            var dofusId = document.getElementById('slot-add-dofusid').value.trim();
            if (!dofusId) { window.REN.toast('Entre un ID DofusDB', 'error'); return; }
            try {
                var resp = await fetch('https://api.dofusdb.fr/items/' + encodeURIComponent(dofusId));
                if (!resp.ok) throw new Error('ID introuvable');
                var data = await resp.json();
                if (data.img) {
                    document.getElementById('slot-add-img').value = data.img;
                    document.getElementById('slot-add-preview').innerHTML = '<img src="' + data.img + '" style="width:40px;height:40px;object-fit:contain;">';
                    if (data.name && data.name.fr && !document.getElementById('slot-add-nom').value.trim()) {
                        document.getElementById('slot-add-nom').value = data.name.fr.toLowerCase();
                    }
                    window.REN.toast('Image importee !', 'success');
                } else {
                    window.REN.toast('Pas d\'image trouvee', 'error');
                }
            } catch (err) {
                window.REN.toast('Erreur : ' + err.message, 'error');
            }
        });

        /* Ajouter symbole */
        var addBtn = document.getElementById('slot-add-btn');
        if (addBtn) addBtn.addEventListener('click', async function () {
            var nom = (document.getElementById('slot-add-nom').value || '').trim().toLowerCase();
            var img = (document.getElementById('slot-add-img').value || '').trim();
            var poids = parseInt(document.getElementById('slot-add-poids').value) || 10;
            var triple = parseInt(document.getElementById('slot-add-triple').value) || 5;
            var paire = parseInt(document.getElementById('slot-add-paire').value) || 0;
            if (!nom) { window.REN.toast('Nom requis', 'error'); return; }
            var maxOrdre = symboles.length > 0 ? Math.max.apply(null, symboles.map(function (s) { return s.ordre; })) : 0;
            var { error } = await window.REN.supabase.from('slot_symboles').insert({
                nom: nom, image_url: img, poids: poids, gain_triple: triple, gain_paire: paire, ordre: maxOrdre + 1
            });
            if (error) { window.REN.toast('Erreur : ' + error.message, 'error'); return; }
            window.REN.toast('Symbole ajoute !', 'success');
            loadTab('slot');
        });

        /* Toggle actif/inactif */
        container.querySelectorAll('.btn-toggle-sym').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                var id = parseInt(btn.getAttribute('data-id'));
                var actif = btn.getAttribute('data-actif') === 'true';
                await window.REN.supabase.from('slot_symboles').update({ actif: !actif }).eq('id', id);
                window.REN.toast(actif ? 'Symbole desactive' : 'Symbole active', 'info');
                loadTab('slot');
            });
        });

        /* Editer symbole — modal inline */
        container.querySelectorAll('.btn-edit-sym').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var id = parseInt(btn.getAttribute('data-id'));
                var sym = symboles.find(function (s) { return s.id === id; });
                if (!sym) return;

                var card = btn.closest('.admin-achat-card');
                if (!card) return;

                /* Check if already editing */
                if (card.querySelector('.slot-edit-form')) return;

                var form = document.createElement('div');
                form.className = 'slot-edit-form';
                form.style.cssText = 'display:flex;gap:var(--spacing-sm);flex-wrap:wrap;align-items:flex-end;margin-top:var(--spacing-sm);padding-top:var(--spacing-sm);border-top:1px solid var(--color-border);width:100%;';
                form.innerHTML = ''
                    + '<div><label class="form-label" style="font-size:0.75rem;">Nom</label><input class="form-input" id="edit-nom-' + id + '" value="' + esc(sym.nom) + '" style="width:110px;font-size:0.8rem;"></div>'
                    + '<div><label class="form-label" style="font-size:0.75rem;">ID DofusDB</label><div style="display:flex;gap:4px;"><input class="form-input" id="edit-dofusid-' + id + '" placeholder="Ex: 28203" style="width:90px;font-size:0.8rem;"><button class="btn btn--secondary btn--small" id="fetch-img-' + id + '">Importer</button></div></div>'
                    + '<div style="flex:1;min-width:150px;"><label class="form-label" style="font-size:0.75rem;">Image URL</label><input class="form-input" id="edit-img-' + id + '" value="' + esc(sym.image_url || '') + '" style="font-size:0.8rem;width:100%;"></div>'
                    + '<div id="edit-preview-' + id + '" style="width:40px;height:40px;flex-shrink:0;">' + (sym.image_url ? '<img src="' + esc(sym.image_url) + '" style="width:40px;height:40px;object-fit:contain;">' : '') + '</div>'
                    + '<div><label class="form-label" style="font-size:0.75rem;">Poids</label><input class="form-input" id="edit-poids-' + id + '" type="number" min="1" value="' + sym.poids + '" style="width:65px;font-size:0.8rem;"></div>'
                    + '<div><label class="form-label" style="font-size:0.75rem;">Triple (x)</label><input class="form-input" id="edit-triple-' + id + '" type="number" min="0" value="' + sym.gain_triple + '" style="width:65px;font-size:0.8rem;"></div>'
                    + '<div><label class="form-label" style="font-size:0.75rem;">Paire (x)</label><input class="form-input" id="edit-paire-' + id + '" type="number" min="0" value="' + (sym.gain_paire || 0) + '" style="width:65px;font-size:0.8rem;"></div>'
                    + '<div style="display:flex;gap:4px;"><button class="btn btn--primary btn--small" id="save-sym-' + id + '">Sauver</button>'
                    + '<button class="btn btn--secondary btn--small" id="cancel-sym-' + id + '">Annuler</button></div>';

                card.appendChild(form);

                document.getElementById('fetch-img-' + id).addEventListener('click', async function () {
                    var dofusId = document.getElementById('edit-dofusid-' + id).value.trim();
                    if (!dofusId) { window.REN.toast('Entre un ID DofusDB', 'error'); return; }
                    try {
                        var resp = await fetch('https://api.dofusdb.fr/items/' + encodeURIComponent(dofusId));
                        if (!resp.ok) throw new Error('ID introuvable');
                        var data = await resp.json();
                        if (data.img) {
                            document.getElementById('edit-img-' + id).value = data.img;
                            document.getElementById('edit-preview-' + id).innerHTML = '<img src="' + data.img + '" style="width:40px;height:40px;object-fit:contain;">';
                            window.REN.toast('Image importee !', 'success');
                        } else {
                            window.REN.toast('Pas d\'image trouvee', 'error');
                        }
                    } catch (err) {
                        window.REN.toast('Erreur : ' + err.message, 'error');
                    }
                });

                document.getElementById('save-sym-' + id).addEventListener('click', async function () {
                    var nomVal = (document.getElementById('edit-nom-' + id).value || '').trim().toLowerCase();
                    var imgVal = document.getElementById('edit-img-' + id).value.trim();
                    var poidsVal = parseInt(document.getElementById('edit-poids-' + id).value) || 1;
                    var tripleVal = parseInt(document.getElementById('edit-triple-' + id).value) || 0;
                    var paireVal = parseInt(document.getElementById('edit-paire-' + id).value) || 0;
                    if (!nomVal) { window.REN.toast('Nom requis', 'error'); return; }
                    var { error } = await window.REN.supabase.from('slot_symboles').update({
                        nom: nomVal, image_url: imgVal, poids: poidsVal, gain_triple: tripleVal, gain_paire: paireVal
                    }).eq('id', id);
                    if (error) { window.REN.toast('Erreur: ' + error.message, 'error'); console.error('[SLOT ADMIN]', error); return; }
                    window.REN.toast('Symbole mis a jour !', 'success');
                    loadTab('slot');
                });

                document.getElementById('cancel-sym-' + id).addEventListener('click', function () {
                    form.remove();
                });
            });
        });
    }

    /* ============================================ */
    /* ONGLET MODULES (feature flags)               */
    /* ============================================ */
    var MODULES_DEF = [
        { key: 'attaque',    label: 'Attaque',        desc: 'Saisie des combats d\'attaque' },
        { key: 'defense',    label: 'Défense',        desc: 'Saisie des combats de défense' },
        { key: 'historique', label: 'Historique',     desc: 'Historique de tous les combats' },
        { key: 'classement', label: 'Classement',     desc: 'Classement PvP des membres' },
        { key: 'membres',    label: 'Membres',        desc: 'Annuaire des membres de l\'alliance' },
        { key: 'builds',     label: 'Builds',         desc: 'Builds recommandés par l\'alliance' },
        { key: 'board',      label: 'Droits Perco',   desc: 'Board hebdomadaire et récompenses percepteurs' },
        { key: 'liens',      label: 'Liens utiles',   desc: 'Outils Dofus + accès mules + sorts communs' },
        { key: 'boutique',   label: 'Boutique',       desc: 'Boutique jetons / kamas interne' },
        { key: 'recyclages', label: 'Recyclages',     desc: 'Suivi des recyclages percepteurs (pépites)' },
        { key: 'fm',         label: 'Forgemagie',     desc: 'Tracker de sessions FM (runes, coûts, pui)' },
        { key: 'jeux',       label: 'Jeux',           desc: 'Jeux de cartes + slot machine (inclut la page Slot)' }
    ];

    /* ============================================ */
    /* RUNES & PRIX                                 */
    /* Maj des prix du catalogue pour tout le monde */
    /* + lecture des prix depuis des screens HDV    */
    /* via l'edge function (mode hdv_prices).       */
    /* ============================================ */
    var rpPasteBound = false;

    function rpNorm(s) {
        return (s || '').toString().toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9% ]/g, ' ')
            .replace(/\s+/g, ' ').trim();
    }

    function rpCompress(file) {
        return new Promise(function (resolve, reject) {
            var url = URL.createObjectURL(file);
            var img = new Image();
            img.onload = function () {
                try {
                    var MAX_W = 1920;
                    var scale = img.width > MAX_W ? MAX_W / img.width : 1;
                    var w = Math.round(img.width * scale);
                    var h = Math.round(img.height * scale);
                    var canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                    URL.revokeObjectURL(url);
                    resolve({
                        base64: dataUrl.substring(dataUrl.indexOf(',') + 1),
                        mediaType: 'image/jpeg'
                    });
                } catch (e) {
                    URL.revokeObjectURL(url);
                    reject(e);
                }
            };
            img.onerror = function () {
                URL.revokeObjectURL(url);
                reject(new Error('Image illisible'));
            };
            img.src = url;
        });
    }

    async function tabRunesPrix(content) {
        var { data: runes, error } = await window.REN.supabase
            .from('runes')
            .select('*')
            .order('ordre');

        if (error) {
            content.innerHTML = '<div class="admin-panel__title">Runes & prix</div>'
                + '<p class="text-muted" style="padding:1rem;">Erreur de chargement du catalogue : ' + window.REN.escapeHtml(error.message) + '</p>';
            return;
        }

        var esc = window.REN.escapeHtml;
        var fmt = window.REN.formatNumber;

        var html = '<div class="admin-panel__title">Runes & prix</div>'
            + '<p class="text-muted" style="font-size:0.8125rem; margin-bottom: var(--spacing-md);">'
            + 'Colle un ou plusieurs screenshots de l\'HDV runes (<kbd>Ctrl</kbd>+<kbd>V</kbd>) : l\'IA lit les prix et préremplit la colonne "Nouveau prix". '
            + 'Vérifie, ajuste à la main si besoin, puis <strong>Appliquer</strong> met à jour le catalogue pour toute l\'alliance. La saisie 100% manuelle marche aussi.</p>'
            + '<div class="recyc-preuve__drop" id="rp-drop" style="margin-bottom:10px;">'
            + '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>'
            + '<span>Colle un screenshot HDV (<kbd>Ctrl</kbd>+<kbd>V</kbd>) ou clique pour parcourir (multi-fichiers OK)</span>'
            + '<input type="file" id="rp-file" accept="image/*" multiple style="display:none;">'
            + '</div>'
            + '<div id="rp-status" class="text-muted" style="font-size:0.8rem; min-height:18px; margin-bottom:10px;"></div>'
            + '<div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin-bottom:12px;">'
            + '<input class="form-input" id="rp-search" placeholder="Filtrer les runes..." style="max-width:240px;">'
            + '<button class="btn btn--primary" id="rp-apply">Appliquer les nouveaux prix</button>'
            + '<span id="rp-count" class="text-muted" style="font-size:0.8rem;"></span>'
            + '</div>'
            + '<div class="table-wrapper"><table class="table">'
            + '<thead><tr><th>Rune</th><th>Catégorie</th><th>Prix actuel</th><th>Nouveau prix</th></tr></thead>'
            + '<tbody id="rp-tbody"></tbody>'
            + '</table></div>';
        content.innerHTML = html;

        var byNorm = {};
        runes.forEach(function (r) { byNorm[rpNorm(r.nom)] = r; });

        function updateCount() {
            var n = runes.filter(function (r) { return r._nouveau != null && r._nouveau !== (r.prix_kamas || 0); }).length;
            document.getElementById('rp-count').textContent = n ? n + ' prix à mettre à jour' : '';
        }

        function renderRows(filter) {
            var q = rpNorm(filter || '');
            var rows = '';
            runes.forEach(function (r) {
                if (q && rpNorm(r.nom + ' ' + r.categorie).indexOf(q) === -1) return;
                var icon = r.img_url ? '<img src="' + esc(r.img_url) + '" alt="" style="width:22px; height:22px; vertical-align:middle; margin-right:6px;">' : '';
                var changed = r._nouveau != null && r._nouveau !== (r.prix_kamas || 0);
                rows += '<tr data-id="' + r.id + '"' + (changed ? ' style="background: rgba(var(--color-accent-rgb), 0.07);"' : '') + '>'
                    + '<td>' + icon + '<strong class="notranslate">' + esc(r.nom) + '</strong></td>'
                    + '<td>' + esc(r.categorie) + '</td>'
                    + '<td>' + fmt(r.prix_kamas || 0) + '</td>'
                    + '<td><input type="number" class="form-input rp-new" data-id="' + r.id + '" min="0" placeholder="—" style="width:110px; padding:5px 8px;" value="' + (r._nouveau != null ? r._nouveau : '') + '"></td>'
                    + '</tr>';
            });
            document.getElementById('rp-tbody').innerHTML = rows || '<tr><td colspan="4" class="text-muted">Aucune rune.</td></tr>';

            document.querySelectorAll('.rp-new').forEach(function (inp) {
                inp.addEventListener('input', function () {
                    var id = parseInt(inp.getAttribute('data-id'), 10);
                    var r = null;
                    for (var i = 0; i < runes.length; i++) { if (runes[i].id === id) { r = runes[i]; break; } }
                    if (r) r._nouveau = inp.value === '' ? null : (parseInt(inp.value, 10) || 0);
                    updateCount();
                });
            });
            updateCount();
        }

        async function handleScreens(files) {
            var status = document.getElementById('rp-status');
            for (var i = 0; i < files.length; i++) {
                if (!status || !document.getElementById('rp-drop')) return; /* onglet quitté */
                status.textContent = 'Analyse du screenshot' + (files.length > 1 ? ' ' + (i + 1) + '/' + files.length : '') + ' en cours… (quelques secondes)';
                try {
                    var img = await rpCompress(files[i]);
                    var res = await window.REN.supabase.functions.invoke('extract-runes', {
                        body: { image: img.base64, media_type: img.mediaType, mode: 'hdv_prices' }
                    });
                    if (res.error) {
                        var detail = '';
                        try {
                            if (res.error.context && typeof res.error.context.json === 'function') {
                                var j = await res.error.context.json();
                                detail = j.error || '';
                            }
                        } catch (e) { /* ignore */ }
                        throw new Error(detail || res.error.message || 'Erreur edge function');
                    }
                    var found = (res.data && res.data.runes) || [];
                    var matched = 0;
                    var unknown = [];
                    found.forEach(function (f) {
                        var r = byNorm[rpNorm(f.nom)];
                        if (r && f.prix != null) {
                            r._nouveau = parseInt(f.prix, 10) || 0;
                            matched++;
                        } else if (f.nom) {
                            unknown.push(f.nom);
                        }
                    });
                    renderRows(document.getElementById('rp-search').value);
                    var msg = matched + ' prix détectés et préremplis';
                    if (unknown.length) msg += ' · non reconnues : ' + unknown.join(', ');
                    if (res.data && res.data.non_identifiees) msg += ' · ' + res.data.non_identifiees + ' illisibles';
                    if (!matched && !unknown.length) msg = 'Aucun prix détecté sur ce screen. La fonction extract-runes a-t-elle été redéployée avec le mode HDV ?';
                    status.textContent = msg;
                } catch (err) {
                    console.error('[REN-ADMIN] Erreur analyse HDV:', err);
                    if (status) status.textContent = '';
                    window.REN.toast('Analyse échouée : ' + (err.message || ''), 'error');
                }
            }
        }

        var drop = document.getElementById('rp-drop');
        var fileInput = document.getElementById('rp-file');
        drop.addEventListener('click', function () { fileInput.click(); });
        fileInput.addEventListener('change', function () {
            if (fileInput.files && fileInput.files.length) {
                handleScreens(Array.prototype.slice.call(fileInput.files));
            }
            fileInput.value = '';
        });

        /* Paste global : lié une seule fois, inactif si l'onglet est fermé */
        if (!rpPasteBound) {
            rpPasteBound = true;
            document.addEventListener('paste', function (e) {
                if (!document.getElementById('rp-drop')) return;
                var items = (e.clipboardData || window.clipboardData).items;
                if (!items) return;
                var files = [];
                for (var i = 0; i < items.length; i++) {
                    if (items[i].type && items[i].type.indexOf('image') === 0) {
                        var f = items[i].getAsFile();
                        if (f) files.push(f);
                    }
                }
                if (files.length) {
                    e.preventDefault();
                    handleScreens(files);
                }
            });
        }

        document.getElementById('rp-search').addEventListener('input', function () {
            renderRows(this.value);
        });

        document.getElementById('rp-apply').addEventListener('click', async function () {
            var btn = this;
            var changes = runes.filter(function (r) { return r._nouveau != null && r._nouveau !== (r.prix_kamas || 0); });
            if (!changes.length) {
                window.REN.toast('Aucun nouveau prix à appliquer', 'info');
                return;
            }
            btn.disabled = true;
            btn.textContent = 'Application… (' + changes.length + ')';
            var okCount = 0;
            var koCount = 0;
            for (var i = 0; i < changes.length; i++) {
                var r = changes[i];
                var res = await window.REN.supabase.from('runes')
                    .update({ prix_kamas: r._nouveau, updated_at: new Date().toISOString() })
                    .eq('id', r.id);
                if (res.error) {
                    koCount++;
                    console.error('[REN-ADMIN] Erreur maj prix', r.nom, res.error);
                } else {
                    r.prix_kamas = r._nouveau;
                    r._nouveau = null;
                    okCount++;
                }
            }
            btn.disabled = false;
            btn.textContent = 'Appliquer les nouveaux prix';
            renderRows(document.getElementById('rp-search').value);
            window.REN.toast(okCount + ' prix mis à jour pour toute l\'alliance' + (koCount ? ' · ' + koCount + ' erreurs' : ''), koCount ? 'error' : 'success');
        });

        renderRows('');
    }

    async function tabModules(content) {
        var { data, error } = await window.REN.supabase
            .from('modules_config')
            .select('*');

        if (error) {
            content.innerHTML = '<div class="admin-panel__title">Modules</div>'
                + '<p class="text-muted" style="padding:1rem;">Table modules_config absente — exécute la migration <code>sql/024-modules-config.sql</code> dans Supabase.</p>';
            return;
        }

        var state = {};
        (data || []).forEach(function (m) { state[m.module] = m.actif; });

        var html = '<div class="admin-panel__title">Modules du site</div>';
        html += '<p class="text-muted" style="font-size:0.8125rem;margin-bottom:var(--spacing-lg);">Décoche un module pour le masquer de la navigation et bloquer l\'accès à ses pages. Réactivable à tout moment — aucune donnée n\'est supprimée. Les membres voient le changement au prochain chargement de page.</p>';

        html += '<table class="admin-table" style="width:100%;"><thead><tr>';
        html += '<th style="text-align:center;width:70px;">Actif</th><th>Module</th><th>Description</th>';
        html += '</tr></thead><tbody>';
        MODULES_DEF.forEach(function (m) {
            var actif = state[m.key] !== false; /* absent = actif */
            html += '<tr>'
                + '<td style="text-align:center;"><input type="checkbox" class="module-toggle" data-module="' + m.key + '"' + (actif ? ' checked' : '') + '></td>'
                + '<td><strong>' + m.label + '</strong></td>'
                + '<td class="text-muted" style="font-size:0.8125rem;">' + m.desc + '</td>'
                + '</tr>';
        });
        html += '</tbody></table>';

        html += '<div style="display:flex;gap:var(--spacing-sm);margin-top:var(--spacing-md);">';
        html += '<button class="btn btn--primary" id="btn-save-modules">Sauvegarder</button>';
        html += '</div>';

        content.innerHTML = html;

        document.getElementById('btn-save-modules').addEventListener('click', async function () {
            var rows = [];
            content.querySelectorAll('.module-toggle').forEach(function (cb) {
                rows.push({
                    module: cb.getAttribute('data-module'),
                    actif: cb.checked,
                    updated_at: new Date().toISOString()
                });
            });
            var { error: err } = await window.REN.supabase
                .from('modules_config')
                .upsert(rows, { onConflict: 'module' });
            if (err) {
                console.error('[REN-ADMIN] Erreur modules:', err);
                window.REN.toast('Erreur sauvegarde : ' + err.message, 'error');
                return;
            }
            /* Rafraîchir le cache local pour voir l'effet immédiatement */
            try {
                var map = {};
                rows.forEach(function (r) { map[r.module] = r.actif; });
                localStorage.setItem('ren_modules', JSON.stringify(map));
            } catch (e) { /* ignore */ }
            window.REN.toast('Modules sauvegardés !', 'success');
        });
    }

    /* ============================================ */
    /* ONGLET RECYCLAGES HEBDO                      */
    /* ============================================ */
    async function tabRecyclagesHebdo(content) {
        var esc = window.REN.escapeHtml;
        var fmt = window.REN.formatNumber;

        /* Charge global + par user + détails */
        var [globalRes, parUserRes, detailsRes] = await Promise.all([
            window.REN.supabase.from('v_recyclages_semaine_global').select('*').maybeSingle(),
            window.REN.supabase.from('v_recyclages_semaine_par_user').select('*').order('total_alliance', { ascending: false }),
            window.REN.supabase
                .from('recyclages')
                .select('id, user_id, pepites_perso, pepites_alliance, cout_pose, plus_value, note, preuve_url, created_at, profiles:user_id(username, avatar_url), zones_perco:zone_id(nom, niveau_zone, type)')
                .gte('created_at', startOfIsoWeek())
                .order('created_at', { ascending: false })
        ]);

        var g = globalRes.data || { nb_recyclages: 0, nb_recycleurs: 0, total_alliance: 0, total_perso: 0, total_plus_value: 0, nb_avec_preuve: 0, debut_semaine: null };
        var membres = parUserRes.data || [];
        var details = detailsRes.data || [];

        var startStr = g.debut_semaine ? new Date(g.debut_semaine).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : '—';

        var html = '<div class="admin-panel__title">Recyclages — Semaine en cours</div>';
        html += '<p class="text-muted" style="font-size:0.8125rem;margin-bottom:var(--spacing-lg);">Depuis le ' + startStr + ' (lundi). Bilan des pépites générées pour l\'alliance par chaque membre cette semaine.</p>';

        /* KPI banner */
        html += '<div class="recyc-kpi-grid mb-lg">';
        html += '<div class="recyc-kpi"><span class="recyc-kpi__label">Total alliance</span><span class="recyc-kpi__value recyc-kpi__value--gold">' + fmt(g.total_alliance) + '</span></div>';
        html += '<div class="recyc-kpi"><span class="recyc-kpi__label">Recyclages</span><span class="recyc-kpi__value">' + fmt(g.nb_recyclages) + '</span></div>';
        html += '<div class="recyc-kpi"><span class="recyc-kpi__label">Recycleurs actifs</span><span class="recyc-kpi__value">' + fmt(g.nb_recycleurs) + '</span></div>';
        html += '<div class="recyc-kpi"><span class="recyc-kpi__label">Avec preuve</span><span class="recyc-kpi__value">' + fmt(g.nb_avec_preuve) + ' / ' + fmt(g.nb_recyclages) + '</span></div>';
        html += '</div>';

        /* Classement membres */
        html += '<h3 style="font-family:var(--font-title);font-size:1rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;margin:0 0 var(--spacing-md) 0;">Classement membres (par pépites alliance générées)</h3>';

        if (!membres.length) {
            html += '<p class="text-muted" style="padding:var(--spacing-md);">Aucun recyclage cette semaine.</p>';
        } else {
            html += '<div class="recyc-table-wrap mb-lg"><table class="recyc-table"><thead><tr>';
            html += '<th>#</th>'
                + '<th>Membre</th>'
                + '<th class="recyc-num">Recyclages</th>'
                + '<th class="recyc-num">Pépites alliance</th>'
                + '<th class="recyc-num">Pépites perso</th>'
                + '<th class="recyc-num">Plus-value</th>'
                + '<th class="recyc-num">Avec preuve</th>';
            html += '</tr></thead><tbody>';
            membres.forEach(function (m, i) {
                var rank = i + 1;
                var pv = m.total_plus_value || 0;
                var pvCls = pv > 0 ? 'recyc-pv--positive' : (pv < 0 ? 'recyc-pv--negative' : 'recyc-pv--neutral');
                html += '<tr>'
                    + '<td><strong>' + rank + '</strong></td>'
                    + '<td><strong>' + esc(m.username || '?') + '</strong></td>'
                    + '<td class="recyc-num">' + fmt(m.nb_recyclages) + '</td>'
                    + '<td class="recyc-num" style="color:var(--color-warning);font-weight:700;">' + fmt(m.total_alliance) + '</td>'
                    + '<td class="recyc-num">' + fmt(m.total_perso) + '</td>'
                    + '<td class="recyc-num ' + pvCls + '">' + (pv >= 0 ? '+' : '') + fmt(pv) + '</td>'
                    + '<td class="recyc-num">' + fmt(m.nb_avec_preuve) + ' / ' + fmt(m.nb_recyclages) + '</td>'
                    + '</tr>';
            });
            html += '</tbody></table></div>';
        }

        /* Détail des recyclages */
        html += '<h3 style="font-family:var(--font-title);font-size:1rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;margin:var(--spacing-lg) 0 var(--spacing-md) 0;">Détails (' + details.length + ' recyclages)</h3>';

        if (!details.length) {
            html += '<p class="text-muted" style="padding:var(--spacing-md);">Aucun recyclage à afficher.</p>';
        } else {
            html += '<div class="recyc-history">';
            details.forEach(function (r) {
                var prof = r.profiles || {};
                var zone = r.zones_perco || {};
                var pv = r.plus_value || 0;
                var pvCls = pv > 0 ? 'recyc-pv--positive' : (pv < 0 ? 'recyc-pv--negative' : 'recyc-pv--neutral');
                var preuveBadge = r.preuve_url
                    ? '<a class="recyc-history__preuve" href="' + esc(r.preuve_url) + '" target="_blank" rel="noopener" title="Voir la preuve">'
                        + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Vérifié'
                      + '</a>'
                    : '<span class="recyc-pill" style="opacity:0.6;font-size:0.65rem;">sans preuve</span>';
                var typeTag = zone.type === 'dj' ? '<span class="recyc-pill" style="font-size:0.65rem;background:rgba(243,156,18,0.12);color:var(--color-warning);">DJ</span>' : '';

                html += '<div class="recyc-history__row">'
                    + '<div class="recyc-history__user">'
                        + '<span class="recyc-history__username">' + esc(prof.username || '?') + '</span>'
                        + '<span class="recyc-history__date">' + window.REN.formatDate(r.created_at) + '</span>'
                    + '</div>'
                    + '<div class="recyc-history__zone">'
                        + '<strong>' + esc(zone.nom || '?') + '</strong>'
                        + '<small class="text-muted"> · Niv. ' + (zone.niveau_zone || '?') + '</small>'
                        + ' ' + typeTag
                        + ' ' + preuveBadge
                    + '</div>'
                    + '<div class="recyc-history__stats">'
                        + '<span class="recyc-pill recyc-pill--green" title="Pépites perso">' + fmt(r.pepites_perso) + '</span>'
                        + '<span class="recyc-pill recyc-pill--gold" title="Pépites alliance">' + fmt(r.pepites_alliance) + '</span>'
                        + '<span class="recyc-pill ' + pvCls + '" title="Plus-value">' + (pv >= 0 ? '+' : '') + fmt(pv) + '</span>'
                    + '</div>'
                    + (r.note ? '<div class="recyc-history__note">' + esc(r.note) + '</div>' : '')
                    + '</div>';
            });
            html += '</div>';
        }

        content.innerHTML = html;
    }

    /* Helper : date ISO du lundi 00:00 (semaine en cours, fuseau local) */
    function startOfIsoWeek() {
        var d = new Date();
        var day = d.getDay(); /* 0 = dim, 1 = lun, ... */
        var diff = (day === 0 ? -6 : 1 - day);
        d.setDate(d.getDate() + diff);
        d.setHours(0, 0, 0, 0);
        return d.toISOString();
    }

    /* ============================================ */
    /* ONGLET ZONES PERCO (recyclage)               */
    /* ============================================ */
    function coutPotion(niveau) {
        var n = parseInt(niveau, 10) || 0;
        if (n <= 0) return 20;
        return Math.min(200, Math.max(20, Math.ceil(n / 20) * 20));
    }

    async function tabZonesPerco(content) {
        var { data: zones, error } = await window.REN.supabase
            .from('zones_perco')
            .select('*')
            .order('ordre', { ascending: true })
            .order('nom', { ascending: true });

        if (error) {
            content.innerHTML = '<p class="text-muted" style="padding:1rem;">Erreur: ' + error.message + '</p>';
            return;
        }

        var rows = zones || [];
        var esc = window.REN.escapeHtml;

        var html = '<div class="admin-panel__title">Zones de recyclage</div>';
        html += '<p class="text-muted" style="font-size:0.8125rem;margin-bottom:var(--spacing-lg);">Configurer les zones disponibles pour le suivi des recyclages de percepteurs. Le coût de pose est calculé automatiquement (tranche de 20 supérieure du niveau de zone) mais peut être surchargé.</p>';

        html += '<table class="admin-table" style="width:100%;"><thead><tr>';
        html += '<th>Nom</th>';
        html += '<th style="text-align:center;">Type</th>';
        html += '<th style="text-align:center;">Niv. zone</th>';
        html += '<th style="text-align:center;">Coût pose</th>';
        html += '<th style="text-align:center;">Ordre</th>';
        html += '<th style="text-align:center;">Actif</th>';
        html += '<th style="text-align:center;">Actions</th>';
        html += '</tr></thead><tbody>';

        function typeSelectHtml(currentType, fieldName) {
            var t = currentType || 'zone';
            var attr = fieldName ? (' data-field="' + fieldName + '"') : '';
            return '<select class="form-input" style="width:85px;"' + attr + '>'
                + '<option value="zone"' + (t === 'zone' ? ' selected' : '') + '>Zone</option>'
                + '<option value="dj"' + (t === 'dj' ? ' selected' : '') + '>Donjon</option>'
                + '</select>';
        }

        rows.forEach(function (z) {
            html += '<tr data-id="' + z.id + '">';
            html += '<td><input class="form-input" value="' + esc(z.nom) + '" data-field="nom"></td>';
            html += '<td style="text-align:center;">' + typeSelectHtml(z.type, 'type') + '</td>';
            html += '<td style="text-align:center;"><input class="form-input" style="width:80px;text-align:center;" type="number" min="1" max="200" value="' + z.niveau_zone + '" data-field="niveau_zone"></td>';
            html += '<td style="text-align:center;"><input class="form-input" style="width:80px;text-align:center;" type="number" min="20" max="200" step="20" value="' + z.cout_pepites_pose + '" data-field="cout_pepites_pose"></td>';
            html += '<td style="text-align:center;"><input class="form-input" style="width:65px;text-align:center;" type="number" value="' + (z.ordre || 0) + '" data-field="ordre"></td>';
            html += '<td style="text-align:center;"><input type="checkbox" data-field="actif"' + (z.actif ? ' checked' : '') + '></td>';
            html += '<td style="text-align:center;"><button class="btn btn--danger btn--small btn-delete-zone" data-id="' + z.id + '">✕</button></td>';
            html += '</tr>';
        });

        /* Ligne d'ajout */
        html += '<tr id="new-zone-row" style="background:rgba(0,200,0,0.04);">';
        html += '<td><input class="form-input" id="new-zone-nom" placeholder="Nom de la zone ou du donjon"></td>';
        html += '<td style="text-align:center;"><select class="form-input" style="width:85px;" id="new-zone-type"><option value="zone">Zone</option><option value="dj">Donjon</option></select></td>';
        html += '<td style="text-align:center;"><input class="form-input" style="width:80px;text-align:center;" type="number" min="1" max="200" id="new-zone-niveau" placeholder="40"></td>';
        html += '<td style="text-align:center;"><input class="form-input" style="width:80px;text-align:center;" type="number" min="20" max="200" step="20" id="new-zone-cout" placeholder="auto"></td>';
        html += '<td style="text-align:center;"><input class="form-input" style="width:65px;text-align:center;" type="number" id="new-zone-ordre" value="999"></td>';
        html += '<td style="text-align:center;"><input type="checkbox" id="new-zone-actif" checked></td>';
        html += '<td style="text-align:center;"><button class="btn btn--primary btn--small" id="btn-add-zone">+ Ajouter</button></td>';
        html += '</tr>';

        html += '</tbody></table>';

        html += '<div style="display:flex;gap:var(--spacing-sm);margin-top:var(--spacing-md);">';
        html += '<button class="btn btn--primary" id="btn-save-zones">Sauvegarder les modifications</button>';
        html += '</div>';

        content.innerHTML = html;

        /* Auto-calcul cout pose quand niveau change (ligne existante) */
        content.querySelectorAll('tbody tr[data-id]').forEach(function (tr) {
            var niveauInput = tr.querySelector('[data-field="niveau_zone"]');
            var coutInput = tr.querySelector('[data-field="cout_pepites_pose"]');
            niveauInput.addEventListener('change', function () {
                coutInput.value = coutPotion(niveauInput.value);
            });
        });

        /* Auto-calcul ligne d'ajout */
        var newNiveau = document.getElementById('new-zone-niveau');
        var newCout = document.getElementById('new-zone-cout');
        newNiveau.addEventListener('change', function () {
            if (!newCout.value) newCout.value = coutPotion(newNiveau.value);
        });

        /* Save existant */
        document.getElementById('btn-save-zones').addEventListener('click', async function () {
            var trs = content.querySelectorAll('tbody tr[data-id]');
            var updates = [];
            trs.forEach(function (tr) {
                var id = parseInt(tr.getAttribute('data-id'), 10);
                if (!id) return;
                var nom = tr.querySelector('[data-field="nom"]').value.trim();
                var type = tr.querySelector('[data-field="type"]').value;
                var niveau_zone = parseInt(tr.querySelector('[data-field="niveau_zone"]').value, 10) || 1;
                var cout_pepites_pose = parseInt(tr.querySelector('[data-field="cout_pepites_pose"]').value, 10) || coutPotion(niveau_zone);
                var ordre = parseInt(tr.querySelector('[data-field="ordre"]').value, 10) || 0;
                var actif = tr.querySelector('[data-field="actif"]').checked;
                updates.push(
                    window.REN.supabase.from('zones_perco').update({
                        nom: nom, type: type, niveau_zone: niveau_zone, cout_pepites_pose: cout_pepites_pose,
                        ordre: ordre, actif: actif
                    }).eq('id', id)
                );
            });
            var results = await Promise.all(updates);
            var errs = results.filter(function (r) { return r.error; });
            if (errs.length) {
                console.error('[REN-ADMIN] Erreurs zones:', errs);
                window.REN.toast('Erreur sur ' + errs.length + ' zone(s)', 'error');
            } else {
                window.REN.toast('Zones sauvegardées !', 'success');
            }
        });

        /* Ajout zone */
        document.getElementById('btn-add-zone').addEventListener('click', async function () {
            var nom = document.getElementById('new-zone-nom').value.trim();
            var type = document.getElementById('new-zone-type').value;
            var niveau = parseInt(document.getElementById('new-zone-niveau').value, 10);
            var cout = parseInt(document.getElementById('new-zone-cout').value, 10);
            var ordre = parseInt(document.getElementById('new-zone-ordre').value, 10) || 999;
            var actif = document.getElementById('new-zone-actif').checked;

            if (!nom) { window.REN.toast('Nom requis', 'error'); return; }
            if (!niveau || niveau < 1 || niveau > 200) { window.REN.toast('Niveau 1-200', 'error'); return; }
            if (!cout) cout = coutPotion(niveau);

            var { error } = await window.REN.supabase.from('zones_perco').insert({
                nom: nom, type: type, niveau_zone: niveau, cout_pepites_pose: cout, ordre: ordre, actif: actif
            });
            if (error) {
                console.error('[REN-ADMIN] Erreur ajout zone:', error);
                window.REN.toast('Erreur : ' + error.message, 'error');
                return;
            }
            window.REN.toast('Zone ajoutée !', 'success');
            loadTab('zones-perco');
        });

        /* Delete zone */
        content.querySelectorAll('.btn-delete-zone').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                if (!confirm('Supprimer cette zone ? Tous les recyclages liés seront aussi affectés.')) return;
                var { error } = await window.REN.supabase
                    .from('zones_perco')
                    .delete()
                    .eq('id', parseInt(btn.getAttribute('data-id'), 10));
                if (error) {
                    window.REN.toast('Erreur (zone utilisée par des recyclages ?)', 'error');
                    return;
                }
                window.REN.toast('Zone supprimée', 'success');
                loadTab('zones-perco');
            });
        });
    }

})();
