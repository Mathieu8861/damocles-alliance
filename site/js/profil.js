/* ============================================ */
/* Damoclès     - Profil                       */
/* Edition profil, stats perso, mot de passe   */
/* ============================================ */
(function () {
    'use strict';

    var selectedAvatarFile = null;

    document.addEventListener('ren:ready', init);

    async function init() {
        if (!window.REN.supabase || !window.REN.currentProfile) return;
        populateForm();
        populateInfos();
        populateMules();
        setupAvatarUpload();
        setupProfileForm();
        setupMulesForm();
        setupPasswordForm();
        await loadStats();
        await loadDroitsHebdo();
        await Promise.all([loadAchatsBoutique(), loadDemandesKamas()]);
    }

    /* === PRE-REMPLIR LE FORMULAIRE === */
    function populateForm() {
        var profile = window.REN.currentProfile;

        /* Classe */
        var classeSelect = document.getElementById('profil-classe');
        if (classeSelect && profile.classe) {
            classeSelect.value = profile.classe;
        }

        /* Element */
        var elementSelect = document.getElementById('profil-element');
        if (elementSelect && profile.element) {
            elementSelect.value = profile.element;
        }

        /* Dofusbook */
        var dofusbookInput = document.getElementById('profil-dofusbook');
        if (dofusbookInput && profile.dofusbook_url) {
            dofusbookInput.value = profile.dofusbook_url;
        }
    }

    /* === INFOS JOUEUR (colonne droite) === */
    function populateInfos() {
        var container = document.getElementById('profil-infos');
        if (!container) return;

        var profile = window.REN.currentProfile;
        var html = '';

        html += buildInfoItem('Pseudo', profile.username || '--');
        html += buildInfoItem('Classe', profile.classe || 'Non définie');
        html += buildInfoItem('\u00c9l\u00e9ment', profile.element || 'Non d\u00e9fini');
        html += buildInfoItem('Statut', profile.is_validated ? '<span style="color:var(--color-success)">Valide</span>' : '<span style="color:var(--color-danger)">En attente</span>');
        html += buildInfoItem('Role', profile.is_admin ? '<span style="color:var(--color-accent-light)">Admin</span>' : 'Membre');
        html += buildInfoItem('Inscription', window.REN.formatDate(profile.created_at));

        if (profile.dofusbook_url) {
            html += buildInfoItem('Dofusbook', '<a href="' + profile.dofusbook_url + '" target="_blank" style="color:var(--color-accent-light)">Voir le build</a>');
        }

        /* Mules */
        var mules = profile.mules || [];
        if (mules.length > 0) {
            html += buildInfoItem('Mules', '<span style="color:var(--color-text-secondary)">' + mules.join(', ') + '</span>');
        } else {
            html += buildInfoItem('Mules', '<span style="color:var(--color-text-muted)">Aucune</span>');
        }

        container.innerHTML = html;
    }

    function buildInfoItem(label, value) {
        return '<div class="profil-info-item">' +
            '<span class="profil-info-item__label">' + label + '</span>' +
            '<span class="profil-info-item__value">' + value + '</span>' +
            '</div>';
    }

    /* === MULES === */
    function populateMules() {
        var container = document.getElementById('profil-mules-list');
        if (!container) return;

        var mules = window.REN.currentProfile.mules || [];

        if (!mules.length) {
            container.innerHTML = '<p class="text-muted" style="font-size:0.8125rem; padding: var(--spacing-sm) 0;">Aucune mule ajoutee.</p>';
            return;
        }

        var html = '';
        mules.forEach(function (mule, index) {
            html += '<div class="profil-mule-item">';
            html += '<span class="profil-mule-item__name">' + mule + '</span>';
            html += '<button type="button" class="profil-mule-item__remove" data-index="' + index + '" title="Supprimer">&times;</button>';
            html += '</div>';
        });

        container.innerHTML = html;
    }

    function setupMulesForm() {
        var input = document.getElementById('profil-mule-input');
        var addBtn = document.getElementById('profil-mule-add-btn');
        var listEl = document.getElementById('profil-mules-list');
        if (!input || !addBtn || !listEl) return;

        /* Ajouter une mule */
        addBtn.addEventListener('click', function () {
            addMule();
        });

        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                addMule();
            }
        });

        /* Supprimer une mule (delegation) */
        listEl.addEventListener('click', function (e) {
            var removeBtn = e.target.closest('.profil-mule-item__remove');
            if (!removeBtn) return;
            var index = parseInt(removeBtn.getAttribute('data-index'));
            removeMule(index);
        });
    }

    async function addMule() {
        var input = document.getElementById('profil-mule-input');
        var name = input.value.trim();
        if (!name) {
            window.REN.toast('Entrez un nom de mule.', 'error');
            return;
        }

        var mules = window.REN.currentProfile.mules || [];

        /* Verifier doublon */
        var exists = mules.some(function (m) { return m.toLowerCase() === name.toLowerCase(); });
        if (exists) {
            window.REN.toast('Cette mule existe deja.', 'error');
            return;
        }

        mules.push(name);

        try {
            var { error } = await window.REN.supabase
                .from('profiles')
                .update({ mules: mules })
                .eq('id', window.REN.currentUser.id);

            if (error) throw error;

            window.REN.currentProfile.mules = mules;
            input.value = '';
            populateMules();
            populateInfos();
            window.REN.toast('Mule "' + name + '" ajoutee !', 'success');
        } catch (err) {
            console.error('[REN] Erreur ajout mule:', err);
            mules.pop();
            window.REN.toast('Erreur lors de l\'ajout.', 'error');
        }
    }

    async function removeMule(index) {
        var mules = (window.REN.currentProfile.mules || []).slice();
        var removed = mules.splice(index, 1)[0];

        try {
            var { error } = await window.REN.supabase
                .from('profiles')
                .update({ mules: mules })
                .eq('id', window.REN.currentUser.id);

            if (error) throw error;

            window.REN.currentProfile.mules = mules;
            populateMules();
            populateInfos();
            window.REN.toast('Mule "' + removed + '" supprimee.', 'success');
        } catch (err) {
            console.error('[REN] Erreur suppression mule:', err);
            window.REN.toast('Erreur lors de la suppression.', 'error');
        }
    }

    /* === AVATAR UPLOAD === */
    function setupAvatarUpload() {
        var avatarInput = document.getElementById('profil-avatar-input');
        if (!avatarInput) return;

        avatarInput.addEventListener('change', async function () {
            var file = avatarInput.files[0];
            if (!file) return;

            if (!file.type.startsWith('image/')) {
                window.REN.toast('Veuillez choisir une image (PNG, JPG, WEBP...)', 'error');
                return;
            }
            if (file.size > 2 * 1024 * 1024) {
                window.REN.toast('L\'image ne doit pas depasser 2 Mo.', 'error');
                return;
            }

            /* Preview immediate dans le cadre */
            var frameImg = document.querySelector('#profil-rank .avatar-frame__img');
            if (frameImg) {
                var reader = new FileReader();
                reader.onload = function (e) {
                    frameImg.innerHTML = '<img src="' + e.target.result + '" alt="Avatar">';
                };
                reader.readAsDataURL(file);
            }

            /* Upload immediat */
            try {
                window.REN.toast('Upload en cours...', 'info');
                await uploadAvatar(window.REN.currentUser.id, file);
                window.REN.toast('Photo de profil mise a jour !', 'success');
            } catch (err) {
                console.error('[REN] Erreur upload avatar:', err);
                window.REN.toast('Erreur lors de l\'upload : ' + (err.message || err), 'error');
            }
        });
    }

    /* === SAUVEGARDE PROFIL === */
    function setupProfileForm() {
        var form = document.getElementById('profil-form');
        if (!form) return;

        form.addEventListener('submit', async function (e) {
            e.preventDefault();
            var btn = document.getElementById('profil-save-btn');
            btn.disabled = true;
            btn.textContent = 'Sauvegarde...';

            try {
                var userId = window.REN.currentUser.id;

                /* Update champs profil */
                var updates = {
                    classe: document.getElementById('profil-classe').value || null,
                    element: document.getElementById('profil-element').value || null,
                    dofusbook_url: document.getElementById('profil-dofusbook').value.trim() || null
                };

                var { error } = await window.REN.supabase
                    .from('profiles')
                    .update(updates)
                    .eq('id', userId);

                if (error) throw error;

                /* Mettre a jour en memoire */
                Object.assign(window.REN.currentProfile, updates);

                window.REN.toast('Profil mis a jour !', 'success');
            } catch (err) {
                console.error('[REN] Erreur sauvegarde profil:', err);
                window.REN.toast('Erreur lors de la sauvegarde.', 'error');
            }

            btn.disabled = false;
            btn.textContent = 'Sauvegarder';
        });
    }

    /* === UPLOAD AVATAR === */
    async function uploadAvatar(userId, file) {
        var ext = file.name.split('.').pop().toLowerCase();
        var filePath = userId + '.' + ext;

        var { error: uploadError } = await window.REN.supabase.storage
            .from('avatars')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true
            });

        if (uploadError) {
            console.error('[REN] Erreur upload avatar:', uploadError);
            return;
        }

        var { data: urlData } = window.REN.supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

        if (urlData && urlData.publicUrl) {
            var publicUrl = urlData.publicUrl + '?t=' + Date.now();
            await window.REN.supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', userId);

            window.REN.currentProfile.avatar_url = publicUrl;
        }
    }

    /* === CHANGEMENT MOT DE PASSE === */
    function setupPasswordForm() {
        var form = document.getElementById('password-form');
        if (!form) return;

        form.addEventListener('submit', async function (e) {
            e.preventDefault();
            var newPassword = document.getElementById('profil-new-password').value;
            var confirmPassword = document.getElementById('profil-confirm-password').value;
            var msgEl = document.getElementById('password-message');

            if (msgEl) { msgEl.className = 'auth-message'; msgEl.textContent = ''; }

            if (!newPassword || newPassword.length < 6) {
                showMsg(msgEl, 'Le mot de passe doit faire au moins 6 caracteres.', 'error');
                return;
            }
            if (newPassword !== confirmPassword) {
                showMsg(msgEl, 'Les mots de passe ne correspondent pas.', 'error');
                return;
            }

            var btn = document.getElementById('password-save-btn');
            btn.disabled = true;
            btn.textContent = 'Modification...';

            try {
                var { error } = await window.REN.supabase.auth.updateUser({
                    password: newPassword
                });

                if (error) throw error;

                window.REN.toast('Mot de passe modifie !', 'success');
                form.reset();
                if (msgEl) { msgEl.className = 'auth-message'; msgEl.textContent = ''; }
            } catch (err) {
                console.error('[REN] Erreur changement mdp:', err);
                showMsg(msgEl, err.message || 'Impossible de modifier le mot de passe.', 'error');
            }

            btn.disabled = false;
            btn.textContent = 'Modifier le mot de passe';
        });
    }

    function showMsg(el, text, type) {
        if (!el) return;
        el.textContent = text;
        el.className = 'auth-message auth-message--' + type;
    }

    /* === STATISTIQUES PERSO === */
    async function loadStats() {
        var container = document.getElementById('profil-stats');
        if (!container) return;

        try {
            var { data, error } = await window.REN.supabase.rpc('get_member_stats');
            if (error) throw error;

            var userId = window.REN.currentUser.id;
            var myStats = null;
            (data || []).forEach(function (m) {
                if (m.user_id === userId) myStats = m;
            });

            if (!myStats) {
                container.innerHTML = '<p class="text-muted">Aucune statistique disponible.</p>';
                return;
            }

            var totalAtk = myStats.total_attaques || 0;
            var winAtk = myStats.victoires_attaque || 0;
            var totalDef = myStats.total_defenses || 0;
            var winDef = myStats.victoires_defense || 0;
            var totalCombats = totalAtk + totalDef;
            var totalVictoires = winAtk + winDef;
            var totalDefaites = totalCombats - totalVictoires;
            /* Winrate : combats équilibrés uniquement (1v1, 2v2...), fallback sur les totaux si la migration 031 n'est pas passée */
            var eqAtk = myStats.eq_attaques != null ? (myStats.eq_attaques || 0) : totalAtk;
            var eqWinAtk = myStats.eq_attaques != null ? (myStats.eq_victoires_attaque || 0) : winAtk;
            var eqDef = myStats.eq_attaques != null ? (myStats.eq_defenses || 0) : totalDef;
            var eqWinDef = myStats.eq_attaques != null ? (myStats.eq_victoires_defense || 0) : winDef;
            var winrateGlobal = (eqAtk + eqDef) > 0 ? Math.round((eqWinAtk + eqWinDef) / (eqAtk + eqDef) * 100) : 0;
            var winrateAtk = eqAtk > 0 ? Math.round(eqWinAtk / eqAtk * 100) : 0;
            var winrateDef = eqDef > 0 ? Math.round(eqWinDef / eqDef * 100) : 0;

            var totalPts = myStats.total_points || 0;
            var tier = window.REN.getTierFromPoints(totalPts);
            var avatarUrl = window.REN.currentProfile.avatar_url || '';

            /* === BLOC 1 : Rang + Progression (dans #profil-rank) === */
            var rankContainer = document.getElementById('profil-rank');
            if (rankContainer) {
                var rankHtml = '';
                rankHtml += '<div class="profil-avatar-section">';
                rankHtml += '<div class="profil-avatar-section__frame" id="profil-avatar-clickable">';
                rankHtml += window.REN.buildAvatarFrame(avatarUrl, totalPts);
                rankHtml += '<div class="profil-avatar-section__overlay"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></div>';
                rankHtml += '</div>';
                rankHtml += '<span class="tier-badge tier-badge--' + tier.key + '">' + tier.name + '</span>';
                rankHtml += '<span style="font-weight: 600; font-size: 0.85rem; color: var(--color-text-primary);">' + tier.title + '</span>';
                rankHtml += '<span class="text-muted" style="font-size: 0.75rem;">' + totalPts + ' points PVP</span>';
                rankHtml += '</div>';
                rankHtml += buildProgressionSection(totalPts, tier);
                rankContainer.innerHTML = rankHtml;
            }

            /* === BLOC 2 : Stats combats (dans #profil-stats) === */
            var html = '';

            html += '<div class="profil-stats-section">';
            html += '<h3 class="profil-stats-section__title">Combats</h3>';
            html += '<div class="profil-stats-row">';
            html += buildStatItem('Total', totalCombats);
            html += buildStatItem('Victoires', totalVictoires, 'success');
            html += buildStatItem('Defaites', totalDefaites, 'danger');
            html += buildStatItem('Winrate', winrateGlobal + '%', winrateGlobal >= 50 ? 'success' : 'danger');
            html += '</div>';
            html += '</div>';

            html += '<div class="profil-stats-section">';
            html += '<h3 class="profil-stats-section__title">Attaque</h3>';
            html += '<div class="profil-stats-row">';
            html += buildStatItem('Combats', totalAtk);
            html += buildStatItem('Victoires', winAtk, 'success');
            html += buildStatItem('Defaites', totalAtk - winAtk, 'danger');
            html += buildStatItem('Winrate', winrateAtk + '%', winrateAtk >= 50 ? 'success' : 'danger');
            html += '</div>';
            html += '</div>';

            html += '<div class="profil-stats-section">';
            html += '<h3 class="profil-stats-section__title">Defense</h3>';
            html += '<div class="profil-stats-row">';
            html += buildStatItem('Combats', totalDef);
            html += buildStatItem('Victoires', winDef, 'success');
            html += buildStatItem('Defaites', totalDef - winDef, 'danger');
            html += buildStatItem('Winrate', winrateDef + '%', winrateDef >= 50 ? 'success' : 'danger');
            html += '</div>';
            html += '</div>';

            html += '<div class="profil-stats-section">';
            html += '<h3 class="profil-stats-section__title">Recompenses</h3>';
            html += '<div class="profil-stats-row">';
            html += buildStatItem('Points', myStats.total_points || 0, 'accent');
            html += buildStatItem('Jetons', (myStats.jetons || 0) + ' <img class="icon-inline" src="assets/images/jeton.png" alt="">');
            html += buildStatItem('Kamas', window.REN.formatKamas(myStats.total_kamas || 0), 'warning');
            html += buildStatItem('Winrate', winrateGlobal + '%', winrateGlobal >= 50 ? 'success' : 'danger');
            html += '</div>';
            html += '</div>';

            container.innerHTML = html;

            /* Rendre le cadre avatar cliquable */
            var avatarClickable = document.getElementById('profil-avatar-clickable');
            var avatarInput = document.getElementById('profil-avatar-input');
            if (avatarClickable && avatarInput) {
                avatarClickable.addEventListener('click', function () {
                    avatarInput.click();
                });
            }

            /* Claim automatique des recompenses de palier */
            var rewardResult = await window.REN.claimTierRewards(totalPts);
            if (rewardResult) {
                showTierRewardPopup(rewardResult);
            }

        } catch (err) {
            console.error('[REN] Erreur stats profil:', err);
            container.innerHTML = '<p class="text-muted">Erreur de chargement des statistiques.</p>';
        }
    }

    function buildStatItem(label, value, color) {
        var valueClass = 'profil-stat-item__value';
        if (color) valueClass += ' profil-stat-item__value--' + color;
        var html = '<div class="profil-stat-item">';
        html += '<span class="profil-stat-item__label">' + label + '</span>';
        html += '<span class="' + valueClass + '">' + value + '</span>';
        html += '</div>';
        return html;
    }

    /* === SECTION PROGRESSION TIERS === */
    function buildProgressionSection(totalPts, currentTier) {
        var TIERS = window.REN.TIERS_ASC;

        var currentIndex = -1;
        for (var i = 0; i < TIERS.length; i++) {
            if (TIERS[i].key === currentTier.key) { currentIndex = i; break; }
        }

        var nextTier = (currentIndex < TIERS.length - 1) ? TIERS[currentIndex + 1] : null;

        var html = '<div class="profil-progression">';
        html += '<h3 class="profil-stats-section__title">Progression</h3>';

        if (nextTier) {
            var ptsInTier = totalPts - TIERS[currentIndex].min;
            var ptsNeeded = nextTier.min - TIERS[currentIndex].min;
            var pct = Math.min(100, Math.round(ptsInTier / ptsNeeded * 100));
            var ptsRestants = nextTier.min - totalPts;

            /* Bloc compact : mini cadre + infos + barre */
            html += '<div class="profil-progression__compact">';
            html += '<div class="profil-progression__compact-frame">';
            html += window.REN.buildAvatarFrame(null, nextTier.min, 40);
            html += '</div>';
            html += '<div class="profil-progression__compact-body">';
            html += '<div class="profil-progression__compact-header">';
            html += '<span class="tier-badge tier-badge--' + nextTier.key + '">' + nextTier.name + '</span>';
            html += '<span class="profil-progression__compact-title">' + nextTier.title + '</span>';
            if (nextTier.reward > 0) {
                html += '<span class="profil-progression__reward-hint">&#127942; +' + nextTier.reward + ' jetons bonus</span>';
            }
            html += '</div>';
            html += '<div class="profil-progression__bar">';
            html += '<div class="profil-progression__bar-fill profil-progression__bar-fill--' + nextTier.key + '" style="width:' + pct + '%;"></div>';
            html += '</div>';
            html += '<div class="profil-progression__compact-footer">';
            html += '<span>' + totalPts + ' / ' + nextTier.min + ' pts</span>';
            html += '<span>' + ptsRestants + ' restants</span>';
            html += '</div>';
            html += '</div>';
            html += '</div>';

            /* Teaser paliers restants */
            var remaining = TIERS.length - 1 - (currentIndex + 1);
            if (remaining > 0) {
                html += '<div class="profil-progression__mystery">';
                html += '<span>&#128274; ' + remaining + ' palier' + (remaining > 1 ? 's' : '') + ' superieur' + (remaining > 1 ? 's' : '') + ' a debloquer</span>';
                html += '</div>';
            }
        } else {
            html += '<div class="profil-progression__max">&#11088; Palier maximum atteint !</div>';
        }

        html += '</div>';
        return html;
    }

    /* === DROITS HEBDOMADAIRES === */
    async function loadDroitsHebdo() {
        var container = document.getElementById('profil-droits');
        if (!container) return;

        try {
            var userId = window.REN.currentUser.id;
            var profile = window.REN.currentProfile;
            var prefRecompense = profile.preference_recompense || 'percos';

            /* Charger config + data semaine passee + semaine en cours en parallele */
            var results = await Promise.all([
                window.REN.supabase
                    .from('recompenses_config')
                    .select('*')
                    .order('ordre', { ascending: true }),
                window.REN.supabase
                    .from('classement_pvp_semaine_passee')
                    .select('id, username, points')
                    .eq('id', userId),
                window.REN.supabase
                    .from('pepites_semaine_passee')
                    .select('id, pepites')
                    .eq('id', userId),
                window.REN.supabase
                    .from('classement_pvp_semaine')
                    .select('id, username, points')
                    .eq('id', userId),
                window.REN.supabase
                    .from('pepites_semaine_courante')
                    .select('id, pepites')
                    .eq('id', userId)
            ]);

            var recompensesConfig = results[0].data || [];

            /* Semaine passee */
            var pvpLast = (results[1].data && results[1].data[0]) ? results[1].data[0] : null;
            var pepJeuLast = (results[2].data && results[2].data[0]) ? results[2].data[0].pepites : 0;
            var pointsLast = pvpLast ? pvpLast.points : 0;
            var rewardLast = findReward(recompensesConfig, pointsLast);

            /* Semaine en cours */
            var pvpCurrent = (results[3].data && results[3].data[0]) ? results[3].data[0] : null;
            var pepJeuCurrent = (results[4].data && results[4].data[0]) ? results[4].data[0].pepites : 0;
            var pointsCurrent = pvpCurrent ? pvpCurrent.points : 0;
            var rewardCurrent = findReward(recompensesConfig, pointsCurrent);

            /* Construire le HTML */
            var html = '';

            /* --- Semaine passee = droits actuels --- */
            html += '<div class="profil-droits__section-label">Semaine pass\u00e9e \u2192 droits actuels</div>';
            html += buildWeekBlock(pointsLast, rewardLast, pepJeuLast, prefRecompense);

            /* Separateur entre les 2 semaines */
            html += '<div class="profil-droits__separator"></div>';

            /* --- Semaine en cours = droits prochains --- */
            html += '<div class="profil-droits__section-label profil-droits__section-label--muted">Semaine en cours \u2192 droits prochains</div>';
            html += buildWeekBlock(pointsCurrent, rewardCurrent, pepJeuCurrent, prefRecompense);

            /* Separateur */
            html += '<div class="profil-droits__separator"></div>';

            /* Sélecteur préférence récompense */
            html += '<div class="profil-droits__pref-section">';
            html += '<div class="profil-droits__pref-label">Pour mes r\u00e9compenses PvP de fin de semaine, je souhaite recevoir :</div>';
            html += '<div class="profil-droits__pref-group" id="pref-recompense-group">';
            html += '<button class="profil-droits__pref-btn' + (prefRecompense === 'percos' ? ' profil-droits__pref-btn--active' : '') + '" data-pref="percos">';
            html += '<img class="icon-inline icon-inline--lg" src="assets/images/percepteur.png" alt=""> Percepteurs';
            html += '</button>';
            html += '<button class="profil-droits__pref-btn' + (prefRecompense === 'pepites' ? ' profil-droits__pref-btn--active' : '') + '" data-pref="pepites">';
            html += '<img class="icon-inline" src="assets/images/pepite.png" alt=""> P\u00e9pites';
            html += '</button>';
            html += '<button class="profil-droits__pref-btn' + (prefRecompense === 'jetons' ? ' profil-droits__pref-btn--active' : '') + '" data-pref="jetons">';
            html += '<img class="icon-inline" src="assets/images/jeton.png" alt=""> Jetons';
            html += '</button>';
            html += '</div>';
            html += '</div>';

            /* Zone réservée (75+ pts semaine en cours OU semaine passée) */
            html += '<div class="profil-droits__separator"></div>';
            if (pointsCurrent >= 75 || pointsLast >= 75) {
                var currentZone = window.REN.currentProfile.zone_reservee || '';
                html += '<div class="profil-droits__zone">';
                html += '<label class="profil-droits__toggle-label">Zone r\u00e9serv\u00e9e</label>';
                html += '<div class="profil-droits__zone-row">';
                html += '<input type="text" class="form-input" id="profil-zone" placeholder="Ex: Bonta centre" value="' + currentZone + '">';
                html += '<button class="profil-droits__zone-btn" id="btn-save-zone">OK</button>';
                html += '</div>';
                html += '</div>';
            } else {
                html += '<div class="profil-droits__zone profil-droits__zone--locked">';
                html += '<span class="text-muted" style="font-size:0.8125rem;">Zone r\u00e9serv\u00e9e — disponible \u00e0 partir de 75 pts/semaine</span>';
                html += '</div>';
            }

            container.innerHTML = html;
            setupPreferenceToggle();
            setupZoneReservee();

        } catch (err) {
            console.error('[REN] Erreur droits hebdo:', err);
            container.innerHTML = '<p class="text-muted">Erreur de chargement.</p>';
        }
    }

    function findReward(config, points) {
        for (var i = 0; i < config.length; i++) {
            var r = config[i];
            var min = r.seuil_min;
            var max = r.seuil_max !== null ? r.seuil_max : 999999;
            if (points >= min && points <= max) return r;
        }
        return { pepites: 0, percepteurs_bonus: 0, label: 'Aucun', emoji: '' };
    }

    function buildWeekBlock(points, reward, pepJeu, prefRecompense) {
        var html = '';

        /* Ligne 1 : points + palier */
        html += '<div class="profil-droits__summary">';
        html += '<div class="profil-droits__stat">';
        html += '<span class="profil-droits__stat-label">Points PVP</span>';
        html += '<span class="profil-droits__stat-value profil-droits__stat-value--accent">' + points + '</span>';
        html += '</div>';
        html += '<div class="profil-droits__stat">';
        html += '<span class="profil-droits__stat-label">Palier</span>';
        html += '<span class="profil-droits__stat-value">' + reward.emoji + ' ' + reward.label + '</span>';
        html += '</div>';
        html += '</div>';

        /* Ligne 2 : récompense choisie + pépites jeu */
        html += '<div class="profil-droits__summary">';

        /* Bloc récompense PVP (selon préférence) */
        html += '<div class="profil-droits__stat">';
        if (points > 0 && prefRecompense === 'pepites' && reward.pepites > 0) {
            html += '<span class="profil-droits__stat-label">R\u00e9compense PVP</span>';
            html += '<span class="profil-droits__stat-value profil-droits__stat-value--accent">' + window.REN.formatNumber(reward.pepites) + ' <img class="icon-inline" src="assets/images/pepite.png" alt=""></span>';
        } else if (points > 0 && prefRecompense === 'jetons' && (reward.jetons_reward || 0) > 0) {
            html += '<span class="profil-droits__stat-label">R\u00e9compense PVP</span>';
            html += '<span class="profil-droits__stat-value profil-droits__stat-value--accent">+' + reward.jetons_reward + ' <img class="icon-inline" src="assets/images/jeton.png" alt=""></span>';
        } else if (points > 0 && reward.percepteurs_bonus > 0) {
            html += '<span class="profil-droits__stat-label">R\u00e9compense PVP</span>';
            html += '<span class="profil-droits__stat-value profil-droits__stat-value--accent">+' + reward.percepteurs_bonus + ' <img class="icon-inline icon-inline--lg" src="assets/images/percepteur.png" alt=""></span>';
        } else {
            html += '<span class="profil-droits__stat-label">R\u00e9compense PVP</span>';
            html += '<span class="profil-droits__stat-value text-muted">Aucune</span>';
        }
        html += '</div>';

        /* Bloc pépites jeu (semaine) */
        html += '<div class="profil-droits__stat">';
        html += '<span class="profil-droits__stat-label">P\u00e9pites jeu</span>';
        if (pepJeu > 0) {
            html += '<span class="profil-droits__stat-value profil-droits__stat-value--accent">' + window.REN.formatNumber(pepJeu) + ' <img class="icon-inline" src="assets/images/pepite.png" alt=""></span>';
        } else {
            html += '<span class="profil-droits__stat-value text-muted">0</span>';
        }
        html += '</div>';

        html += '</div>';

        return html;
    }

    function setupPreferenceToggle() {
        var group = document.getElementById('pref-recompense-group');
        if (!group) return;

        var btns = group.querySelectorAll('.profil-droits__pref-btn');
        btns.forEach(function (btn) {
            btn.addEventListener('click', async function () {
                var newValue = btn.getAttribute('data-pref');
                if (newValue === window.REN.currentProfile.preference_recompense) return;

                try {
                    var resp = await window.REN.supabase
                        .from('profiles')
                        .update({ preference_recompense: newValue })
                        .eq('id', window.REN.currentUser.id);

                    if (resp.error) throw resp.error;

                    window.REN.currentProfile.preference_recompense = newValue;
                    var labels = { percos: 'Percepteurs', pepites: 'P\u00e9pites', jetons: 'Jetons' };
                    window.REN.toast('Pr\u00e9f\u00e9rence : ' + labels[newValue], 'success');

                    /* Rafraichir le bloc pour refléter le choix */
                    await loadDroitsHebdo();

                } catch (err) {
                    console.error('[REN] Erreur sauvegarde preference:', err);
                    window.REN.toast('Erreur lors de la sauvegarde.', 'error');
                }
            });
        });
    }

    function setupZoneReservee() {
        var btn = document.getElementById('btn-save-zone');
        var input = document.getElementById('profil-zone');
        if (!btn || !input) return;

        btn.addEventListener('click', async function () {
            var zone = input.value.trim() || null;
            btn.disabled = true;
            btn.textContent = '...';
            try {
                var { error } = await window.REN.supabase
                    .from('profiles')
                    .update({ zone_reservee: zone })
                    .eq('id', window.REN.currentUser.id);
                if (error) throw error;
                window.REN.currentProfile.zone_reservee = zone;
                window.REN.toast(zone ? 'Zone enregistr\u00e9e : ' + zone : 'Zone retir\u00e9e', 'success');
            } catch (err) {
                console.error('[REN] Erreur zone reservee:', err);
                window.REN.toast('Erreur : ' + err.message, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'OK';
            }
        });
    }

    /* === POPUP RECOMPENSE PALIER === */
    function showTierRewardPopup(result) {
        var TIERS = window.REN.TIERS_ASC;
        var lastKey = result.newClaims[result.newClaims.length - 1];
        var lastTier = null;
        for (var i = 0; i < TIERS.length; i++) {
            if (TIERS[i].key === lastKey) { lastTier = TIERS[i]; break; }
        }
        if (!lastTier) return;

        var avatarUrl = window.REN.currentProfile.avatar_url || '';

        var overlay = document.createElement('div');
        overlay.className = 'tier-reward-overlay';

        var popup = document.createElement('div');
        popup.className = 'tier-reward-popup';
        popup.setAttribute('data-tier', lastTier.key);

        popup.innerHTML =
            /* Sparkles decoratifs */
            '<div class="tier-reward-sparkles" id="tier-sparkles"></div>' +
            /* Icone */
            '<div class="tier-reward-popup__icon">&#127942;</div>' +
            /* Titre */
            '<h3 class="tier-reward-popup__title">Nouveau palier</h3>' +
            /* Avatar avec rayons lumineux */
            '<div class="tier-reward-popup__frame">' +
                '<div class="tier-reward-rays"></div>' +
                window.REN.buildAvatarFrame(avatarUrl, lastTier.min, 90) +
            '</div>' +
            /* Badge palier */
            '<div class="tier-reward-popup__tier-name">' +
                '<span class="tier-badge tier-badge--' + lastTier.key + '">' + lastTier.name + '</span>' +
            '</div>' +
            /* Titre du palier */
            '<p class="tier-reward-popup__subtitle">' + lastTier.title + '</p>' +
            /* Separateur */
            '<div class="tier-reward-popup__divider"></div>' +
            /* Recompense */
            '<div class="tier-reward-popup__reward">+' + result.totalBonus + '</div>' +
            '<div class="tier-reward-popup__reward-label">jetons gagn\u00e9s</div>' +
            /* Bouton */
            '<button class="btn btn--primary tier-reward-popup__btn">Merci !</button>';

        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        /* Generer les sparkles */
        spawnSparkles(popup);

        /* Animation entree */
        requestAnimationFrame(function () {
            overlay.classList.add('tier-reward-overlay--visible');
        });

        /* Fermeture */
        overlay.querySelector('.tier-reward-popup__btn').addEventListener('click', function () {
            overlay.classList.remove('tier-reward-overlay--visible');
            setTimeout(function () { overlay.remove(); }, 400);
        });
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) {
                overlay.classList.remove('tier-reward-overlay--visible');
                setTimeout(function () { overlay.remove(); }, 400);
            }
        });
    }

    /* Generer des particules etincelles autour de la popup */
    function spawnSparkles(popup) {
        var container = popup.querySelector('#tier-sparkles');
        if (!container) return;

        var count = 20;
        for (var i = 0; i < count; i++) {
            (function (index) {
                setTimeout(function () {
                    var sparkle = document.createElement('div');
                    sparkle.className = 'tier-reward-sparkle';
                    sparkle.style.left = (Math.random() * 100) + '%';
                    sparkle.style.top = (Math.random() * 100) + '%';
                    sparkle.style.width = (2 + Math.random() * 4) + 'px';
                    sparkle.style.height = sparkle.style.width;
                    sparkle.style.animationDuration = (1.5 + Math.random() * 1.5) + 's';
                    sparkle.style.animationDelay = (Math.random() * 0.3) + 's';
                    container.appendChild(sparkle);
                    setTimeout(function () { sparkle.remove(); }, 3500);
                }, index * 100);
            })(i);
        }
    }

    /* ============================================ */
    /* ACHATS BOUTIQUE                              */
    /* ============================================ */
    async function loadAchatsBoutique() {
        var container = document.getElementById('profil-achats-boutique');
        if (!container) return;

        try {
            var { data: achats, error } = await window.REN.supabase
                .from('boutique_achats')
                .select('*, boutique_items:item_id(image_url)')
                .eq('user_id', window.REN.currentProfile.id)
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;
            if (!achats || achats.length === 0) {
                container.innerHTML = '';
                updateBoutiqueEmpty();
                return;
            }

            var html = '<h3 class="profil-boutique__subtitle">Achats</h3>';
            html += '<div class="profil-achats-list">';
            achats.forEach(function (a) {
                var imageUrl = (a.boutique_items && a.boutique_items.image_url) ? a.boutique_items.image_url : '';
                var date = new Date(a.created_at).toLocaleDateString('fr-FR');
                var isEnAttente = a.statut === 'en_attente';
                var badgeClass = 'badge-statut badge-statut--' + a.statut;
                var badgeText = isEnAttente ? 'En attente' : 'Distribu\u00e9';

                html += '<div class="profil-achats-item' + (isEnAttente ? ' profil-achats-item--pending' : '') + '">';
                html += '<div class="profil-achats-item__image">';
                if (imageUrl) {
                    html += '<img src="' + imageUrl + '" alt="' + a.item_nom + '">';
                } else {
                    html += '<span class="text-muted">?</span>';
                }
                html += '</div>';
                html += '<div class="profil-achats-item__info">';
                html += '<span class="profil-achats-item__nom">' + a.item_nom + '</span>';
                html += '<span class="profil-achats-item__detail">' + a.prix_paye + ' <img class="icon-inline" src="assets/images/jeton.png" alt="jetons"> \u00b7 ' + date + '</span>';
                html += '</div>';
                html += '<span class="' + badgeClass + '">' + badgeText + '</span>';
                if (!isEnAttente) {
                    html += '<button class="profil-achats-item__dismiss" data-id="' + a.id + '" title="Supprimer">&times;</button>';
                }
                html += '</div>';
            });
            html += '</div>';

            container.innerHTML = html;
            updateBoutiqueEmpty();

            /* Listeners suppression */
            container.querySelectorAll('.profil-achats-item__dismiss').forEach(function (btn) {
                btn.addEventListener('click', async function () {
                    var achatId = parseInt(btn.dataset.id);
                    await window.REN.supabase.from('boutique_achats').delete().eq('id', achatId);
                    await loadAchatsBoutique();
                });
            });

        } catch (err) {
            console.error('[REN-PROFIL] Erreur achats boutique:', err);
        }
    }

    /* ============================================ */
    /* DEMANDES KAMAS (jetons)                      */
    /* ============================================ */
    async function loadDemandesKamas() {
        var container = document.getElementById('profil-demandes-kamas');
        if (!container) return;

        try {
            var { data: demandes, error } = await window.REN.supabase
                .from('boutique_demandes_kamas')
                .select('*')
                .eq('user_id', window.REN.currentProfile.id)
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;
            if (!demandes || demandes.length === 0) {
                container.innerHTML = '';
                updateBoutiqueEmpty();
                return;
            }

            var html = '<h3 class="profil-boutique__subtitle">Demandes de jetons</h3>';
            html += '<div class="profil-achats-list">';
            demandes.forEach(function (d) {
                var date = new Date(d.created_at).toLocaleDateString('fr-FR');
                var isEnAttente = d.statut === 'en_attente';
                var badgeClass = 'badge-statut badge-statut--' + d.statut;
                var badgeText = isEnAttente ? 'En attente' : d.statut === 'valide' ? 'Valid\u00e9' : 'Refus\u00e9';

                html += '<div class="profil-achats-item' + (isEnAttente ? ' profil-achats-item--pending' : '') + '">';
                html += '<div class="profil-achats-item__image">';
                html += '<img src="assets/images/jeton.png" alt="jetons">';
                html += '</div>';
                html += '<div class="profil-achats-item__info">';
                html += '<span class="profil-achats-item__nom">' + d.jetons_demandes + ' jetons</span>';
                html += '<span class="profil-achats-item__detail">' + window.REN.formatKamas(d.montant_kamas) + ' kamas \u00b7 ' + date + '</span>';
                html += '</div>';
                html += '<span class="' + badgeClass + '">' + badgeText + '</span>';
                if (!isEnAttente) {
                    html += '<button class="profil-achats-item__dismiss" data-id="' + d.id + '" title="Supprimer">&times;</button>';
                }
                html += '</div>';
            });
            html += '</div>';

            container.innerHTML = html;
            updateBoutiqueEmpty();

            /* Listeners suppression */
            container.querySelectorAll('.profil-achats-item__dismiss').forEach(function (btn) {
                btn.addEventListener('click', async function () {
                    var demandeId = parseInt(btn.dataset.id);
                    await window.REN.supabase.from('boutique_demandes_kamas').delete().eq('id', demandeId);
                    await loadDemandesKamas();
                });
            });

        } catch (err) {
            console.error('[REN-PROFIL] Erreur demandes kamas:', err);
        }
    }

    /* === Etat vide boutique === */
    function updateBoutiqueEmpty() {
        var emptyDiv = document.getElementById('profil-boutique-empty');
        var achatsDiv = document.getElementById('profil-achats-boutique');
        var demandesDiv = document.getElementById('profil-demandes-kamas');
        if (!emptyDiv) return;

        var hasContent = (achatsDiv && achatsDiv.innerHTML.trim()) || (demandesDiv && demandesDiv.innerHTML.trim());
        if (hasContent) {
            emptyDiv.innerHTML = '';
        } else {
            emptyDiv.innerHTML = '<div class="profil-boutique-empty">' +
                '<img class="profil-boutique-empty__icon" src="assets/images/jeton.png" alt="">' +
                '<div class="profil-boutique-empty__body">' +
                '<span class="profil-boutique-empty__text">Aucun achat ni demande en cours. D\u00e9pense tes jetons ou \u00e9change des kamas !</span>' +
                '<a href="boutique.html" class="btn btn--primary btn--small">Voir la boutique</a>' +
                '</div>' +
                '</div>';
        }
    }

})();
