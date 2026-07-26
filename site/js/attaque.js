/* ============================================ */
/* Damoclès     - Attaque                      */
/* Formulaire de declaration d'attaque PvP     */
/* ============================================ */
(function () {
    'use strict';

    var combatType = 'attaque';
    var nbAllies = 1;
    var nbEnnemis = 1;
    var selectedAllies = [];
    var selectedInvites = [];
    var resultat = null;
    var allProfiles = [];
    var allAlliances = [];

    document.addEventListener('ren:ready', init);

    async function init() {
        if (!window.REN.supabase || !window.REN.currentProfile) return;
        await loadData();
        setupCountButtons();
        setupAllianceSelect();
        setupResultButtons();
        setupSubmit();
        renderAlliesList();
        /* Autocomplete zones+donjons sur le champ "Zone" */
        var zoneInput = document.getElementById('input-commentaire');
        if (zoneInput && window.REN.attachZoneAutocomplete) {
            zoneInput.setAttribute('placeholder', 'Tape pour rechercher une zone ou un donjon...');
            window.REN.attachZoneAutocomplete(zoneInput);
        }
    }

    /* === LOAD DATA === */
    async function loadData() {
        try {
            var [profilesRes, alliancesRes] = await Promise.all([
                window.REN.supabase.from('profiles').select('id, username, mules').eq('is_validated', true).order('username'),
                window.REN.supabase.from('alliances').select('*').order('nom')
            ]);
            allProfiles = profilesRes.data || [];
            allAlliances = alliancesRes.data || [];
        } catch (err) {
            console.error('[REN] Erreur chargement donnees:', err);
        }
    }

    /* === COUNT BUTTONS === */
    function setupCountButtons() {
        setupCountGroup('count-allies', function (val) {
            nbAllies = val;
            renderAlliesList();
        });
        setupCountGroup('count-ennemis', function (val) {
            nbEnnemis = val;
        });
    }

    function setupCountGroup(containerId, callback) {
        var container = document.getElementById(containerId);
        if (!container) return;
        var btns = container.querySelectorAll('.count-btn');
        btns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                btns.forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                callback(parseInt(btn.getAttribute('data-value')));
            });
        });
    }

    /* === ALLIES LIST (autocomplete) === */
    function renderAlliesList() {
        var container = document.getElementById('allies-list');
        if (!container) return;

        selectedAllies = [window.REN.currentProfile.id];

        var esc = window.REN.escapeHtml;
        var html = '';
        var selfText = esc(window.REN.currentProfile.username);
        var myMules = window.REN.currentProfile.mules || [];
        if (myMules.length > 0) {
            selfText += ' <span class="combat-form__ally-sep">/</span> ' + myMules.map(esc).join(' <span class="combat-form__ally-sep">/</span> ');
        }
        html += '<div class="combat-form__ally-self">' + selfText + ' <span>(vous)</span></div>';

        for (var i = 1; i < nbAllies; i++) {
            html += '<div class="ally-autocomplete" data-index="' + i + '">';
            html += '<input type="text" class="form-input ally-search" placeholder="Rechercher allié ' + (i + 1) + '..." autocomplete="off">';
            html += '<input type="hidden" class="ally-value">';
            html += '<input type="hidden" class="ally-invite">';
            html += '<div class="ally-dropdown"></div>';
            html += '</div>';
        }

        container.innerHTML = html;

        container.querySelectorAll('.ally-autocomplete').forEach(function (wrap) {
            setupAllyAutocomplete(wrap);
        });
        updateSelectedAllies();
    }

    function setupAllyAutocomplete(wrap) {
        var input = wrap.querySelector('.ally-search');
        var hidden = wrap.querySelector('.ally-value');
        var inviteHidden = wrap.querySelector('.ally-invite');
        var dropdown = wrap.querySelector('.ally-dropdown');
        var esc = window.REN.escapeHtml;

        /* Construire la liste des options (profils + mules) */
        var options = [];
        allProfiles.forEach(function (p) {
            if (p.id !== window.REN.currentProfile.id) {
                options.push({ id: p.id, label: p.username, isMule: false });
                if (p.mules && p.mules.length > 0) {
                    p.mules.forEach(function (mule) {
                        options.push({ id: p.id, label: '\u21B3 ' + mule, isMule: true });
                    });
                }
            }
        });

        function showDropdown(filter) {
            var query = (filter || '').toLowerCase();
            var matches = options.filter(function (o) {
                return o.label.toLowerCase().indexOf(query) !== -1;
            });

            var raw = (filter || '').trim();
            var exact = options.some(function (o) {
                return o.label.replace('↳ ', '').toLowerCase() === query.trim();
            });

            var html = '';
            matches.forEach(function (o) {
                html += '<div class="ally-dropdown__item' + (o.isMule ? ' ally-dropdown__item--mule' : '') + '" data-id="' + o.id + '" data-label="' + esc(o.label) + '">' + esc(o.label) + '</div>';
            });
            /* Joueur non inscrit sur le site : proposable comme invité */
            if (raw.length >= 2 && raw.length <= 30 && !exact) {
                html += '<div class="ally-dropdown__item ally-dropdown__item--invite" data-invite="' + esc(raw) + '">&#10133; Ajouter &laquo; ' + esc(raw) + ' &raquo; (invité hors site)</div>';
            }
            if (!html) {
                dropdown.innerHTML = '<div class="ally-dropdown__empty">Aucun résultat</div>';
                dropdown.classList.add('active');
                return;
            }
            dropdown.innerHTML = html;
            dropdown.classList.add('active');

            dropdown.querySelectorAll('.ally-dropdown__item').forEach(function (item) {
                item.addEventListener('mousedown', function (e) {
                    e.preventDefault();
                    var inviteName = item.getAttribute('data-invite');
                    if (inviteName) {
                        input.value = inviteName;
                        hidden.value = '';
                        inviteHidden.value = inviteName;
                        wrap.classList.add('ally-autocomplete--invite');
                    } else {
                        input.value = item.getAttribute('data-label');
                        hidden.value = item.getAttribute('data-id');
                        inviteHidden.value = '';
                        wrap.classList.remove('ally-autocomplete--invite');
                    }
                    dropdown.classList.remove('active');
                    updateSelectedAllies();
                });
            });
        }

        input.addEventListener('focus', function () {
            showDropdown(input.value);
        });

        input.addEventListener('input', function () {
            hidden.value = '';
            inviteHidden.value = '';
            wrap.classList.remove('ally-autocomplete--invite');
            updateSelectedAllies();
            showDropdown(input.value);
        });

        input.addEventListener('blur', function () {
            setTimeout(function () { dropdown.classList.remove('active'); }, 150);
        });
    }

    function updateSelectedAllies() {
        selectedAllies = [window.REN.currentProfile.id];
        document.querySelectorAll('.ally-value').forEach(function (h) {
            if (h.value) selectedAllies.push(h.value);
        });
        selectedInvites = [];
        document.querySelectorAll('.ally-invite').forEach(function (h) {
            if (h.value) selectedInvites.push(h.value);
        });
    }

    /* === ALLIANCE SELECT === */
    function setupAllianceSelect() {
        var select = document.getElementById('select-alliance');
        var customInput = document.getElementById('input-alliance-custom');
        if (!select) return;

        allAlliances.forEach(function (a) {
            var opt = document.createElement('option');
            opt.value = a.id;
            opt.textContent = a.nom + (a.tag ? ' [' + a.tag + ']' : '');
            select.appendChild(opt);
        });

        /* Option "Autre" */
        var optAutre = document.createElement('option');
        optAutre.value = 'autre';
        optAutre.textContent = 'Autre / Pas d\'alliance';
        select.appendChild(optAutre);

        select.addEventListener('change', function () {
            if (customInput) {
                customInput.style.display = select.value === 'autre' ? '' : 'none';
            }
        });
    }

    /* === RESULT BUTTONS === */
    function setupResultButtons() {
        var btnV = document.getElementById('btn-victoire');
        var btnD = document.getElementById('btn-defaite');
        var sectionDetails = document.getElementById('section-attaque-details');
        var sectionButin = document.getElementById('section-butin');

        if (btnV) {
            btnV.addEventListener('click', function () {
                resultat = 'victoire';
                btnV.classList.add('active');
                if (btnD) btnD.classList.remove('active');
                if (sectionDetails) sectionDetails.style.display = '';
                if (sectionButin) sectionButin.style.display = '';
            });
        }

        if (btnD) {
            btnD.addEventListener('click', function () {
                resultat = 'defaite';
                btnD.classList.add('active');
                if (btnV) btnV.classList.remove('active');
                if (sectionDetails) sectionDetails.style.display = '';
                if (sectionButin) sectionButin.style.display = 'none';
            });
        }
    }

    /* === SUBMIT === */
    function setupSubmit() {
        var btn = document.getElementById('btn-submit-combat');
        if (!btn) return;

        btn.addEventListener('click', async function () {
            if (!resultat) {
                window.REN.toast('Selectionnez victoire ou defaite.', 'error');
                return;
            }

            /* 2 screenshots obligatoires */
            if (window.REN.combatPreuves) {
                if (window.REN.combatPreuves.isUploading()) {
                    window.REN.toast('Attends la fin de l\'upload des screens.', 'info');
                    return;
                }
                if (!window.REN.combatPreuves.isComplete()) {
                    window.REN.toast('Les 2 screenshots du combat sont obligatoires.', 'error');
                    return;
                }
            }

            var selectAlliance = document.getElementById('select-alliance');
            var customInput = document.getElementById('input-alliance-custom');
            var inputButin = document.getElementById('input-butin');

            var allianceId = null;
            var allianceNom = null;

            if (selectAlliance && selectAlliance.value && selectAlliance.value !== 'autre') {
                allianceId = parseInt(selectAlliance.value);
            } else if (customInput && customInput.value.trim()) {
                allianceNom = customInput.value.trim();
            }

            var butin = 0;
            if (resultat === 'victoire' && inputButin && inputButin.value) {
                butin = parseInt(inputButin.value) || 0;
            }

            var inputCommentaire = document.getElementById('input-commentaire');
            var commentaire = inputCommentaire && inputCommentaire.value.trim() ? inputCommentaire.value.trim() : null;

            btn.disabled = true;
            btn.textContent = 'Envoi...';

            try {
                /* Calculer les points via RPC */
                var pointsRes = await window.REN.supabase.rpc('calculer_points', {
                    p_nb_allies: nbAllies,
                    p_nb_ennemis: nbEnnemis,
                    p_resultat: resultat,
                    p_alliance_id: allianceId,
                    p_type: combatType
                });

                var points = pointsRes.data || 0;

                /* Inserer le combat */
                var preuves = window.REN.combatPreuves ? window.REN.combatPreuves.getUrls() : [null, null];
                var combatRes = await window.REN.supabase.from('combats').insert({
                    type: combatType,
                    auteur_id: window.REN.currentProfile.id,
                    alliance_ennemie_id: allianceId,
                    alliance_ennemie_nom: allianceNom,
                    nb_allies: nbAllies,
                    nb_ennemis: nbEnnemis,
                    resultat: resultat,
                    butin_kamas: butin,
                    points_gagnes: points,
                    commentaire: commentaire,
                    invites: selectedInvites.length ? selectedInvites : null,
                    preuve_url_1: preuves[0],
                    preuve_url_2: preuves[1]
                }).select().single();

                if (combatRes.error) throw combatRes.error;

                /* Inserer les participants */
                var participants = selectedAllies.map(function (uid) {
                    return { combat_id: combatRes.data.id, user_id: uid };
                });

                if (participants.length > 0) {
                    await window.REN.supabase.from('combat_participants').insert(participants);
                }

                /* Distribution des jetons (désactivable dans Admin > Modules > Économie) */
                var jetonsActifs = true;
                try {
                    var cfgJetons = await window.REN.supabase.from('site_config').select('valeur').eq('cle', 'jetons_actifs').maybeSingle();
                    if (cfgJetons.data && cfgJetons.data.valeur === 'false') jetonsActifs = false;
                } catch (e) { /* table absente : jetons actifs par défaut */ }

                if (points > 0 && jetonsActifs) {
                    for (var pi = 0; pi < selectedAllies.length; pi++) {
                        await window.REN.supabase.rpc('ajouter_jetons', { p_user_id: selectedAllies[pi], p_points: points });
                    }
                    window.REN.currentProfile.jetons = (window.REN.currentProfile.jetons || 0) + points;
                }

                var msg = resultat === 'victoire'
                    ? 'Victoire enregistrée ! +' + points + ' points' + (jetonsActifs && points > 0 ? ' (+' + points + ' jetons)' : '')
                    : 'Défaite enregistrée. ' + points + ' points';

                window.REN.toast(msg, resultat === 'victoire' ? 'success' : 'info');

                /* Reset form */
                setTimeout(function () { window.location.reload(); }, 1500);

            } catch (err) {
                console.error('[REN] Erreur enregistrement combat:', err);
                window.REN.toast('Erreur: ' + (err.message || 'Impossible d\'enregistrer le combat'), 'error');
            }

            btn.disabled = false;
            btn.textContent = 'Enregistrer l\'attaque';
        });
    }
})();
