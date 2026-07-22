/* ============================================ */
/* Forgemagie - Tracker de sessions FM          */
/* Screen avant -> achats -> screen apres ->    */
/* delta runes consommees + cout kamas          */
/* ============================================ */
(function () {
    'use strict';

    var userId = null;
    var isAdmin = false;
    var runes = [];          /* catalogue complet */
    var runesById = {};
    var runesByNorm = {};    /* nom normalise -> rune (matching extraction) */

    var currentSession = null;       /* session active affichée dans le panel Session */
    var sessionRunes = [];           /* fm_session_runes de la session courante */
    var achats = [];                 /* fm_session_achats de la session courante */
    var concassages = [];            /* fm_session_concassages de la session courante */
    var forceNewSession = false;     /* true = afficher le form nouvelle session même si une session est en cours */

    /* Dispo d'une ligne de session : départ + achats + ajustements concassage */
    function dispoOf(sr) {
        return sr.qty_avant + sr.qty_achetee + (sr.qty_ajustement || 0);
    }

    /* Icône de rune (catalogue DofusDB) — chaîne vide si pas d'image */
    function runeIconHtml(rune) {
        if (!rune || !rune.img_url) return '';
        return '<img class="fm-rune-icon" src="' + window.REN.escapeHtml(rune.img_url) + '" alt="" loading="lazy">';
    }

    /* ============================================ */
    /* POIDS (PUI) DE L'ITEM                        */
    /* ============================================ */
    /* Ratio pui/unité par catégorie de stat, dérivé du catalogue :
       poids/bonus de la rune BASIQUE de la famille (ex Vi: 1/5 = 0.2/pt). */
    var statCatMap = {};

    /* Normalisation qui PRÉSERVE le % (distingue "Res. Feu" et "% Res. Feu") */
    function normStat(s) {
        return (s || '').toString().toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9% ]/g, ' ')
            .replace(/\s+/g, ' ').trim();
    }

    function buildStatMaps() {
        statCatMap = {};
        runes.forEach(function (r) {
            if (r.tier !== 'basique') return;
            statCatMap[normStat(r.categorie)] = r.poids / (r.bonus || 1);
        });
    }

    /* Libellé de stat (vision Costumager) -> clé du catalogue */
    function statToCatKey(label) {
        var n = normStat(label);
        n = n.replace(/^[-+]?\d+([.,]\d+)?\s*/, ''); /* valeur résiduelle en tête */
        if (n.indexOf('renvoi') !== -1) return 'renvoi de dommages';
        if (n.indexOf('res critiques') !== -1 || n.indexOf('resistances critiques') !== -1) return 'res critiques';
        n = n.replace(/resistances?/g, 'res');
        if (n === 'invocations') n = 'invocation';
        if (n === '% critique') n = 'critique';
        return n;
    }

    /* item_stats (vision) -> { actuel, max, ignorees[] } ou null */
    function computeItemPui(itemStats) {
        if (!itemStats || !itemStats.length) return null;
        var actuel = 0, max = 0, hasMax = false, ignorees = [];
        itemStats.forEach(function (st) {
            var ratio = statCatMap[statToCatKey(st.stat)];
            if (ratio === undefined) { ignorees.push(st.stat); return; }
            actuel += (Number(st.actuel) || 0) * ratio;
            if (st.max !== null && st.max !== undefined && st.max !== '') {
                max += (Number(st.max) || 0) * ratio;
                hasMax = true;
            }
        });
        return {
            actuel: Math.round(actuel * 10) / 10,
            max: hasMax ? Math.round(max * 10) / 10 : null,
            ignorees: ignorees
        };
    }

    function renderPuiBanner(elId, pui) {
        var el = document.getElementById(elId);
        if (!el) return;
        if (!pui) { el.setAttribute('hidden', ''); el.innerHTML = ''; return; }
        var fmt = window.REN.formatNumber;
        var html = '⚖️ Poids de l\'item : <strong>' + fmt(pui.actuel) + ' pui</strong>';
        if (pui.max !== null) {
            var puits = Math.round((pui.max - pui.actuel) * 10) / 10;
            html += ' / max <strong>' + fmt(pui.max) + '</strong>'
                + ' → puits dispo <strong style="color:' + (puits >= 0 ? 'var(--color-success)' : 'var(--color-danger)') + ';">' + fmt(puits) + '</strong>';
        }
        if (pui.ignorees.length) {
            html += ' <span class="text-muted" style="font-size:0.75em;" title="' + window.REN.escapeHtml(pui.ignorees.join(', ')) + '">(' + pui.ignorees.length + ' stat(s) non comptée(s))</span>';
        }
        el.innerHTML = html;
        el.removeAttribute('hidden');
    }

    /* Grilles d'extraction en cours d'edition */
    var gridAvant = [];   /* [{runeId, qty}] */
    var gridApres = {};   /* runeId -> qty fin */

    var PREUVE_BUCKET = 'preuves-recyclages';
    var MAX_IMG_BYTES = 8 * 1024 * 1024;

    document.addEventListener('ren:ready', init);

    async function init() {
        if (!window.REN.supabase || !window.REN.currentProfile) return;
        userId = window.REN.currentProfile.id;
        isAdmin = !!window.REN.currentProfile.is_admin;

        await loadRunes();
        buildStatMaps();
        bindTabs();
        bindNewSession();
        bindAchats();
        bindConcassage();
        bindCloture();

        await loadCurrentSession();
        renderSessionPanel();

        /* Guide première session : replié si l'utilisateur a déjà FM */
        try {
            var { count } = await window.REN.supabase
                .from('fm_sessions')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId);
            if ((count || 0) > 0) {
                var guide = document.getElementById('fm-guide');
                if (guide) guide.removeAttribute('open');
            }
        } catch (e) { /* non bloquant */ }
    }

    /* ============================================ */
    /* CATALOGUE RUNES                              */
    /* ============================================ */
    function norm(s) {
        return (s || '').toString().toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9 ]/g, ' ')
            .replace(/\s+/g, ' ').trim();
    }

    async function loadRunes() {
        try {
            var { data, error } = await window.REN.supabase
                .from('runes')
                .select('*')
                .eq('actif', true)
                .order('ordre', { ascending: true });
            if (error) throw error;
            runes = data || [];
            runesById = {};
            runesByNorm = {};
            runes.forEach(function (r) {
                runesById[r.id] = r;
                runesByNorm[norm(r.nom)] = r;
            });
        } catch (err) {
            console.error('[REN-FM] Erreur runes:', err);
            window.REN.toast('Erreur chargement catalogue runes', 'error');
        }
    }

    function matchRune(nom) {
        var n = norm(nom);
        if (runesByNorm[n]) return runesByNorm[n];
        /* Tolerance : "rune" optionnel en prefixe */
        if (runesByNorm['rune ' + n]) return runesByNorm['rune ' + n];
        var stripped = n.replace(/^rune\s+/, '');
        if (runesByNorm['rune ' + stripped]) return runesByNorm['rune ' + stripped];
        return null;
    }

    /* ============================================ */
    /* TABS                                         */
    /* ============================================ */
    var loaded = { historique: false, alliance: false, runes: false };

    /* À appeler après toute action qui change les sessions (abandon,
       clôture, démarrage, reprise) : les onglets listes rechargeront
       leurs données au prochain affichage. */
    function invalidateSessionLists() {
        loaded.historique = false;
        loaded.alliance = false;
    }

    function bindTabs() {
        var tabs = document.getElementById('fm-tabs');
        if (!tabs) return;
        tabs.addEventListener('click', function (e) {
            var btn = e.target.closest('.tabs__btn');
            if (!btn) return;
            var panel = btn.getAttribute('data-panel');

            tabs.querySelectorAll('.tabs__btn').forEach(function (b) {
                b.classList.toggle('active', b === btn);
            });
            document.querySelectorAll('.fm-panel').forEach(function (p) {
                if (p.id === 'panel-' + panel) p.removeAttribute('hidden');
                else p.setAttribute('hidden', '');
            });

            if (panel === 'historique' && !loaded.historique) {
                loaded.historique = true;
                loadHistorique();
            } else if (panel === 'alliance' && !loaded.alliance) {
                loaded.alliance = true;
                loadAlliance();
            } else if (panel === 'runes' && !loaded.runes) {
                loaded.runes = true;
                renderRunesCatalogue();
            }
        });
    }

    /* ============================================ */
    /* EXTRACTION SCREEN (edge function vision)     */
    /* ============================================ */
    async function extractRunesFromImage(file) {
        var img = await fileToCompressedBase64(file);
        var { data, error } = await window.REN.supabase.functions.invoke('extract-runes', {
            body: { image: img.base64, media_type: img.mediaType }
        });
        if (error) {
            /* Tenter de récupérer le détail renvoyé par la fonction (FunctionsHttpError) */
            var detail = '';
            try {
                if (error.context && typeof error.context.json === 'function') {
                    var j = await error.context.json();
                    detail = j.error || '';
                    if (j.raw) console.warn('[REN-FM] Réponse vision brute:', j.raw);
                }
            } catch (e) { /* ignore */ }
            throw new Error(detail || error.message || 'Erreur edge function');
        }
        if (data && data.error) throw new Error(data.error);
        return data; /* {runes:[{nom, qty}], non_identifiees: n} */
    }

    /* Redimensionne (max 1920px de large) et compresse en JPEG avant envoi : */
    /* - reste sous la limite de taille de l'API vision (~5 Mo)               */
    /* - accélère l'upload et l'analyse                                       */
    function fileToCompressedBase64(file) {
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

    async function uploadScreen(file, suffix) {
        try {
            var ext = (file.name && file.name.split('.').pop()) || 'png';
            var path = 'fm/' + userId + '/' + Date.now() + '-' + suffix + '.' + ext;
            var { error } = await window.REN.supabase.storage
                .from(PREUVE_BUCKET)
                .upload(path, file, { contentType: file.type, upsert: false });
            if (error) throw error;
            var { data } = window.REN.supabase.storage.from(PREUVE_BUCKET).getPublicUrl(path);
            return data.publicUrl;
        } catch (err) {
            console.warn('[REN-FM] Upload screen optionnel echoue:', err);
            return null; /* non bloquant */
        }
    }

    /* Branche une drop-zone (paste/click) -> callback(file) */
    function bindImageZone(dropId, fileId, previewWrapId, previewId, statusId, removeId, onFile, onReset) {
        var drop = document.getElementById(dropId);
        var fileInput = document.getElementById(fileId);
        var removeBtn = document.getElementById(removeId);
        if (!drop || !fileInput) return;

        drop.addEventListener('click', function () { fileInput.click(); });
        fileInput.addEventListener('change', function () {
            if (fileInput.files && fileInput.files[0]) handle(fileInput.files[0]);
        });
        if (removeBtn) {
            removeBtn.addEventListener('click', function () {
                resetZone();
                if (onReset) onReset();
            });
        }

        function resetZone() {
            document.getElementById(previewWrapId).style.display = 'none';
            drop.style.display = '';
            document.getElementById(previewId).src = '';
            fileInput.value = '';
        }

        function setStatus(text, cls) {
            var st = document.getElementById(statusId);
            if (st) {
                st.textContent = text;
                st.className = 'recyc-preuve__status' + (cls ? ' ' + cls : '');
            }
        }

        function handle(file) {
            if (file.size > MAX_IMG_BYTES) { window.REN.toast('Image trop lourde (>8 Mo)', 'error'); return; }
            if (file.type.indexOf('image/') !== 0) { window.REN.toast('Le fichier doit être une image', 'error'); return; }

            var reader = new FileReader();
            reader.onload = function (e) {
                document.getElementById(previewId).src = e.target.result;
                document.getElementById(previewWrapId).style.display = 'block';
                drop.style.display = 'none';
                setStatus('Analyse en cours…', 'recyc-preuve__status--loading');
            };
            reader.readAsDataURL(file);

            onFile(file, setStatus);
        }

        /* expose le handler pour le paste global */
        drop.dataset.zoneBound = '1';
        zoneHandlers.push({ dropId: dropId, handle: handle, isVisible: function () {
            /* zone active si son panel parent est visible et la drop affichee */
            var panel = drop.closest('.fm-panel, section');
            return drop.offsetParent !== null || (panel && !panel.hasAttribute('hidden') && drop.style.display !== 'none');
        }});
    }

    var zoneHandlers = [];

    /* Paste global : route l'image vers la premiere zone visible */
    document.addEventListener('paste', function (e) {
        var items = (e.clipboardData || window.clipboardData).items;
        if (!items) return;
        for (var i = 0; i < items.length; i++) {
            if (items[i].type && items[i].type.indexOf('image') === 0) {
                var file = items[i].getAsFile();
                if (!file) return;
                for (var j = 0; j < zoneHandlers.length; j++) {
                    var z = zoneHandlers[j];
                    var dropEl = document.getElementById(z.dropId);
                    if (dropEl && dropEl.offsetParent !== null && dropEl.style.display !== 'none') {
                        z.handle(file);
                        e.preventDefault();
                        return;
                    }
                }
                return;
            }
        }
    });

    /* ============================================ */
    /* NOUVELLE SESSION                             */
    /* ============================================ */
    function bindNewSession() {
        bindImageZone(
            'fm-screen-avant-drop', 'fm-screen-avant-file',
            'fm-screen-avant-preview-wrap', 'fm-screen-avant-preview',
            'fm-screen-avant-status', 'fm-screen-avant-remove',
            async function (file, setStatus) {
                try {
                    var result = await extractRunesFromImage(file);
                    pendingAvantFile = file;
                    /* Poids de l'item depuis les stats du Costumager (si présentes) */
                    var pui = computeItemPui(result.item_stats);
                    if (pui) pendingItemPui = pui;
                    renderPuiBanner('fm-pui-avant', pendingItemPui);
                    fillGridAvant(result);
                    setStatus('Analysé ✓', 'recyc-preuve__status--ok');
                } catch (err) {
                    console.error('[REN-FM] Extraction avant:', err);
                    setStatus('Échec analyse', '');
                    window.REN.toast('Extraction impossible — saisis les runes manuellement', 'error');
                    gridAvant = [];
                    document.getElementById('fm-grid-avant-wrap').removeAttribute('hidden');
                    renderGridAvant();
                    updateStartButton();
                }
            },
            function () {
                pendingAvantFile = null;
                pendingItemPui = null;
                renderPuiBanner('fm-pui-avant', null);
                gridAvant = [];
                document.getElementById('fm-grid-avant-wrap').setAttribute('hidden', '');
                updateStartButton();
            }
        );

        document.getElementById('fm-grid-avant-add').addEventListener('click', function () {
            gridAvant.push({ runeId: '', qty: 0 });
            renderGridAvant();
        });

        document.getElementById('fm-start-session').addEventListener('click', startSession);
    }

    var pendingAvantFile = null;
    var pendingItemPui = null;    /* {actuel, max, ignorees} du screen de départ */
    var pendingApresPui = null;   /* idem pour le screen de clôture */

    /* Merge les runes extraites dans la grille existante :              */
    /* - rune deja presente -> sa qty est remplacee (le screen fait foi)  */
    /* - rune nouvelle -> ajoutee                                         */
    /* Permet de coller plusieurs screens si l'inventaire scroll.         */
    function fillGridAvant(result) {
        var unmatched = 0;
        (result.runes || []).forEach(function (r) {
            var rune = matchRune(r.nom);
            if (rune) {
                var qty = parseInt(r.qty, 10) || 0;
                var existing = gridAvant.find(function (g) { return g.runeId === rune.id; });
                if (existing) existing.qty = qty;
                else gridAvant.push({ runeId: rune.id, qty: qty });
            } else {
                unmatched++;
            }
        });
        var info = document.getElementById('fm-grid-avant-info');
        var bits = [];
        if (result.non_identifiees) bits.push(result.non_identifiees + ' cellule(s) non identifiée(s) par l\'IA');
        if (unmatched) bits.push(unmatched + ' rune(s) hors catalogue ignorée(s)');
        info.textContent = bits.length ? '(' + bits.join(' · ') + ')' : '';

        document.getElementById('fm-grid-avant-wrap').removeAttribute('hidden');
        renderGridAvant();
        updateStartButton();

        /* Re-afficher la drop zone pour permettre un screen supplementaire */
        var drop = document.getElementById('fm-screen-avant-drop');
        if (drop) {
            drop.style.display = '';
            var label = drop.querySelector('span');
            if (label) label.innerHTML = 'Inventaire sur plusieurs pages ? Colle le screen suivant (<kbd>Ctrl</kbd>+<kbd>V</kbd>) — les résultats fusionnent';
        }
    }

    /* Autocomplete rune : input recherche + dropdown filtrée (remplace le
       select à 104 options). Réutilise le style .ally-autocomplete. */
    function runeAutocompleteHtml(selectedId) {
        var esc = window.REN.escapeHtml;
        var rune = selectedId ? runesById[selectedId] : null;
        return '<div class="ally-autocomplete fm-rune-ac">'
            + '<input type="text" class="form-input ally-search fm-rune-ac__search" placeholder="Tape pour chercher une rune..." autocomplete="off" value="' + (rune ? esc(rune.nom) : '') + '">'
            + '<input type="hidden" class="fm-rune-ac__value" value="' + (selectedId || '') + '">'
            + '<div class="ally-dropdown"></div>'
            + '</div>';
    }

    /* Branche le comportement sur un wrap .fm-rune-ac.
       onChange(runeId|'') est appelé à la sélection ou l'invalidation. */
    function bindRuneAutocomplete(wrapEl, onChange) {
        var input = wrapEl.querySelector('.fm-rune-ac__search');
        var hidden = wrapEl.querySelector('.fm-rune-ac__value');
        var dropdown = wrapEl.querySelector('.ally-dropdown');
        var esc = window.REN.escapeHtml;

        function show(filter) {
            var q = norm(filter);
            var matches = runes.filter(function (r) {
                if (!q) return true;
                return norm(r.nom + ' ' + r.categorie).indexOf(q) !== -1;
            }).slice(0, 40);

            if (!matches.length) {
                dropdown.innerHTML = '<div class="ally-dropdown__empty">Aucune rune trouvée</div>';
                dropdown.classList.add('active');
                return;
            }
            var html = '';
            matches.forEach(function (r) {
                html += '<div class="ally-dropdown__item" data-id="' + r.id + '">'
                    + runeIconHtml(r)
                    + esc(r.nom)
                    + ' <span style="opacity:0.55;font-size:0.78em;">' + esc(r.categorie) + '</span>'
                    + '</div>';
            });
            dropdown.innerHTML = html;
            dropdown.classList.add('active');

            dropdown.querySelectorAll('.ally-dropdown__item').forEach(function (item) {
                item.addEventListener('mousedown', function (e) {
                    e.preventDefault();
                    var id = parseInt(item.getAttribute('data-id'), 10);
                    hidden.value = id;
                    input.value = (runesById[id] || {}).nom || '';
                    dropdown.classList.remove('active');
                    if (onChange) onChange(id);
                });
            });
        }

        input.addEventListener('focus', function () { show(input.value); });
        input.addEventListener('input', function () {
            hidden.value = '';
            if (onChange) onChange('');
            show(input.value);
        });
        input.addEventListener('blur', function () {
            setTimeout(function () { dropdown.classList.remove('active'); }, 150);
        });
    }

    function renderGridAvant() {
        var grid = document.getElementById('fm-grid-avant');
        var html = '';
        gridAvant.forEach(function (row, i) {
            html += '<div class="fm-grid__row" data-index="' + i + '">'
                + runeAutocompleteHtml(row.runeId)
                + '<input type="number" class="form-input fm-grid__qty" min="0" value="' + (row.qty || 0) + '" placeholder="Qté">'
                + '<button type="button" class="recyc-history__del fm-grid__del" title="Retirer">'
                    + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
                + '</button>'
                + '</div>';
        });
        if (!gridAvant.length) {
            html = '<p class="text-muted" style="font-size:0.8rem;padding:var(--spacing-sm);">Aucune rune — ajoute des lignes manuellement.</p>';
        }
        grid.innerHTML = html;

        grid.querySelectorAll('.fm-grid__row').forEach(function (rowEl) {
            var idx = parseInt(rowEl.getAttribute('data-index'), 10);
            bindRuneAutocomplete(rowEl.querySelector('.fm-rune-ac'), function (runeId) {
                gridAvant[idx].runeId = runeId || '';
                updateStartButton();
            });
            rowEl.querySelector('.fm-grid__qty').addEventListener('input', function () {
                gridAvant[idx].qty = parseInt(this.value, 10) || 0;
            });
            rowEl.querySelector('.fm-grid__del').addEventListener('click', function () {
                gridAvant.splice(idx, 1);
                renderGridAvant();
                updateStartButton();
            });
        });
    }

    function updateStartButton() {
        var valid = gridAvant.some(function (r) { return r.runeId; });
        document.getElementById('fm-start-session').disabled = !valid;
    }

    async function startSession() {
        var titre = document.getElementById('fm-titre').value.trim();
        if (!titre) { window.REN.toast('Indique l\'item travaillé', 'error'); return; }

        var rows = gridAvant.filter(function (r) { return r.runeId; });
        if (!rows.length) { window.REN.toast('Aucune rune dans le stock de départ', 'error'); return; }

        /* dedup par rune (somme des qty si doublon) */
        var byRune = {};
        rows.forEach(function (r) {
            byRune[r.runeId] = (byRune[r.runeId] || 0) + (r.qty || 0);
        });

        var btn = document.getElementById('fm-start-session');
        btn.disabled = true;
        btn.textContent = 'Création…';

        try {
            var screenUrl = pendingAvantFile ? await uploadScreen(pendingAvantFile, 'avant') : null;

            var { data: session, error } = await window.REN.supabase
                .from('fm_sessions')
                .insert({
                    user_id: userId,
                    titre: titre,
                    screenshot_avant_url: screenUrl,
                    item_pui_depart: pendingItemPui ? pendingItemPui.actuel : null,
                    item_pui_max: pendingItemPui ? pendingItemPui.max : null
                })
                .select()
                .single();
            if (error) throw error;

            var lignes = Object.keys(byRune).map(function (runeId) {
                return { session_id: session.id, rune_id: parseInt(runeId, 10), qty_avant: byRune[runeId] };
            });
            var { error: err2 } = await window.REN.supabase.from('fm_session_runes').insert(lignes);
            if (err2) throw err2;

            window.REN.toast('Session démarrée — bon FM !', 'success');
            invalidateSessionLists();
            forceNewSession = false;
            /* Reset du form pour la prochaine fois */
            document.getElementById('fm-titre').value = '';
            gridAvant = [];
            pendingAvantFile = null;
            document.getElementById('fm-grid-avant-wrap').setAttribute('hidden', '');
            await loadCurrentSession();
            renderSessionPanel();
        } catch (err) {
            console.error('[REN-FM] Erreur start session:', err);
            window.REN.toast('Erreur création session', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Démarrer la session';
        }
    }

    /* ============================================ */
    /* SESSION EN COURS                             */
    /* ============================================ */
    async function loadCurrentSession() {
        try {
            var { data, error } = await window.REN.supabase
                .from('fm_sessions')
                .select('*')
                .eq('user_id', userId)
                .eq('statut', 'en_cours')
                .order('last_active_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (error && error.code !== 'PGRST116') throw error;
            currentSession = data || null;

            if (currentSession) {
                var res = await Promise.all([
                    window.REN.supabase.from('fm_session_runes').select('*').eq('session_id', currentSession.id),
                    window.REN.supabase.from('fm_session_achats').select('*').eq('session_id', currentSession.id).order('created_at', { ascending: false }),
                    window.REN.supabase.from('fm_session_concassages').select('*').eq('session_id', currentSession.id).order('created_at', { ascending: false })
                ]);
                sessionRunes = res[0].data || [];
                achats = res[1].data || [];
                concassages = res[2].data || [];
            } else {
                sessionRunes = [];
                achats = [];
                concassages = [];
            }
        } catch (err) {
            console.error('[REN-FM] Erreur load session:', err);
        }
    }

    function renderSessionPanel() {
        var newS = document.getElementById('fm-new-session');
        var curS = document.getElementById('fm-current-session');
        var summary = document.getElementById('fm-summary');
        var backBtn = document.getElementById('fm-back-to-session');
        summary.setAttribute('hidden', '');

        if (currentSession && !forceNewSession) {
            newS.setAttribute('hidden', '');
            curS.removeAttribute('hidden');
            document.getElementById('fm-current-titre').textContent = currentSession.titre;
            var dateTxt = ' · démarrée ' + window.REN.formatDate(currentSession.started_at);
            if (currentSession.item_pui_depart !== null && currentSession.item_pui_depart !== undefined) {
                dateTxt += ' · ⚖️ ' + window.REN.formatNumber(currentSession.item_pui_depart) + ' pui';
                if (currentSession.item_pui_max !== null && currentSession.item_pui_max !== undefined) {
                    var puits = Math.round((currentSession.item_pui_max - currentSession.item_pui_depart) * 10) / 10;
                    dateTxt += ' / ' + window.REN.formatNumber(currentSession.item_pui_max) + ' max (puits ' + window.REN.formatNumber(puits) + ')';
                }
            }
            document.getElementById('fm-current-date').textContent = dateTxt;
            renderStock();
            renderAchats();
            renderConcassages();
        } else {
            curS.setAttribute('hidden', '');
            newS.removeAttribute('hidden');
            /* Bouton retour visible uniquement si on a mis une session de côté */
            if (backBtn) {
                if (currentSession && forceNewSession) backBtn.removeAttribute('hidden');
                else backBtn.setAttribute('hidden', '');
            }
        }
    }

    /* === CHANGER D'ITEM / RETOUR (délégation) === */
    document.addEventListener('click', function (e) {
        if (!e.target.closest) return;
        if (e.target.closest('#fm-switch-session')) {
            forceNewSession = true;
            renderSessionPanel();
            window.REN.toast('Session mise de côté — retrouve-la dans « Mes sessions »', 'info');
        } else if (e.target.closest('#fm-back-to-session')) {
            forceNewSession = false;
            renderSessionPanel();
        }
    });

    /* Reprendre une session depuis l'historique : devient la session active */
    async function reprendreSession(sessionId) {
        try {
            var { error } = await window.REN.supabase
                .from('fm_sessions')
                .update({ last_active_at: new Date().toISOString() })
                .eq('id', sessionId);
            if (error) throw error;

            invalidateSessionLists();
            forceNewSession = false;
            await loadCurrentSession();
            renderSessionPanel();

            /* Basculer sur l'onglet Session */
            var tabBtn = document.querySelector('#fm-tabs .tabs__btn[data-panel="session"]');
            if (tabBtn) tabBtn.click();

            window.REN.toast('Session reprise : ' + (currentSession ? currentSession.titre : ''), 'success');
        } catch (err) {
            console.error('[REN-FM] Erreur reprise session:', err);
            window.REN.toast('Erreur lors de la reprise', 'error');
        }
    }

    function renderStock() {
        var tbody = document.getElementById('fm-stock-tbody');
        if (!sessionRunes.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-muted text-center">Aucune rune.</td></tr>';
            return;
        }
        var fmt = window.REN.formatNumber;
        var esc = window.REN.escapeHtml;
        var html = '';
        sessionRunes
            .slice()
            .sort(function (a, b) {
                var ra = runesById[a.rune_id], rb = runesById[b.rune_id];
                return (ra ? ra.ordre : 0) - (rb ? rb.ordre : 0);
            })
            .forEach(function (sr) {
                var rune = runesById[sr.rune_id] || { nom: '?' };
                var adj = sr.qty_ajustement || 0;
                var adjText = adj === 0 ? '—'
                    : '<span style="color:' + (adj > 0 ? 'var(--color-success)' : 'var(--color-warning)') + ';">' + (adj > 0 ? '+' : '') + fmt(adj) + '</span>';
                html += '<tr>'
                    + '<td>' + runeIconHtml(rune) + '<strong>' + esc(rune.nom) + '</strong></td>'
                    + '<td class="recyc-num">' + fmt(sr.qty_avant) + '</td>'
                    + '<td class="recyc-num">' + (sr.qty_achetee ? '+' + fmt(sr.qty_achetee) : '—') + '</td>'
                    + '<td class="recyc-num">' + adjText + '</td>'
                    + '<td class="recyc-num" style="font-weight:700;">' + fmt(dispoOf(sr)) + '</td>'
                    + '</tr>';
            });
        tbody.innerHTML = html;
    }

    /* === ABANDON === */
    document.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('#fm-abandon-session')) {
            if (!currentSession) return;
            if (!confirm('Abandonner cette session ? Elle ne sera pas comptabilisée.')) return;
            window.REN.supabase
                .from('fm_sessions')
                .update({ statut: 'abandonnee', ended_at: new Date().toISOString() })
                .eq('id', currentSession.id)
                .then(async function (res) {
                    if (res.error) { window.REN.toast('Erreur', 'error'); return; }
                    window.REN.toast('Session abandonnée', 'success');
                    invalidateSessionLists();
                    /* Recharger : une autre session en_cours peut prendre le relais */
                    await loadCurrentSession();
                    renderSessionPanel();
                });
        }
    });

    /* ============================================ */
    /* ACHATS EN SESSION                            */
    /* ============================================ */
    var pendingAchats = [];

    function bindAchats() {
        var ta = document.getElementById('fm-achat-paste');
        if (!ta) return;
        ta.addEventListener('input', function () {
            pendingAchats = parseAchats(ta.value);
            renderPendingAchats();
        });
    }

    /* Parse le bloc collé : une ligne par achat. */
    function parseAchats(text) {
        if (!text || !text.trim()) return [];
        var results = [];
        text.split(/\r?\n/).forEach(function (line) {
            if (!line.trim()) return;
            var parsed = parseAchatLine(line);
            if (parsed) results.push(parsed);
        });
        return results;
    }

    /* Format HDV Dofus 3 : "[21:58] 10 x [Rune Pa Ret Pme] (40 513 kamas)" */
    /* Fallback : ancien format "Vous avez payé X kamas..." via parseAchat. */
    function parseAchatLine(text) {
        var m = text.match(/([\d][\d\s  ]*)\s*x\s*\[([^\]]+)\]\s*\(([\d\s  .,]+)\s*kamas\)/i);
        if (m) {
            var qty = parseInt(m[1].replace(/[^\d]/g, ''), 10) || 1;
            var nom = m[2].trim();
            var prix = parseInt(m[3].replace(/[^\d]/g, ''), 10) || 0;
            var rune = matchRune(nom);
            return { qty: qty, rune_id: rune ? rune.id : '', prix_total: prix, message_brut: text.trim() };
        }
        return parseAchat(text);
    }

    /* Parse une ligne du chat type :
       "[18:45] Vous avez payé 2 010 kamas pour acheter 100x Rune Fo."
       Tolérant sur le format : montant obligatoire, qty+rune si trouvables. */
    function parseAchat(text) {
        if (!text || !text.trim()) return null;
        var prix = null, qty = 1, runeNom = null;

        var mPrix = text.match(/pay[ée]\s+([\d\s  .,]+)\s*kamas/i);
        if (mPrix) prix = parseInt(mPrix[1].replace(/[^\d]/g, ''), 10);
        if (prix === null || isNaN(prix)) return null;

        var mQtyRune = text.match(/acheter\s+(\d+)\s*x?\s+([^\.\n\[]+)/i)
            || text.match(/(\d+)\s*x\s*\[?([^\]\.\n]+)\]?/i);
        if (mQtyRune) {
            qty = parseInt(mQtyRune[1], 10) || 1;
            runeNom = mQtyRune[2].trim();
        }

        var rune = runeNom ? matchRune(runeNom) : null;
        return {
            prix_total: prix,
            qty: qty,
            rune_id: rune ? rune.id : '',
            message_brut: text.trim()
        };
    }

    function renderPendingAchats() {
        var wrap = document.getElementById('fm-achat-pending');
        if (!pendingAchats.length) {
            wrap.setAttribute('hidden', '');
            wrap.innerHTML = '';
            return;
        }
        wrap.removeAttribute('hidden');

        var html = '';
        pendingAchats.forEach(function (a, i) {
            html += '<div class="fm-achat-row" data-index="' + i + '" style="margin-bottom:var(--spacing-xs);">'
                + runeAutocompleteHtml(a.rune_id)
                + '<input type="number" class="form-input fm-grid__qty fm-achat-qty" min="1" value="' + a.qty + '" placeholder="Qté">'
                + '<input type="number" class="form-input fm-grid__prix fm-achat-prix" min="0" value="' + a.prix_total + '" placeholder="Prix total">'
                + '<button type="button" class="recyc-history__del fm-achat-remove" title="Retirer cette ligne">'
                    + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
                + '</button>'
                + '</div>';
        });
        html += '<div class="recyc-form__actions" style="margin-top:var(--spacing-sm);">'
            + '<button type="button" class="btn btn--primary btn--small" id="fm-achats-validate">'
            + (pendingAchats.length > 1 ? 'Valider les ' + pendingAchats.length + ' achats' : 'Valider l\'achat')
            + '</button>'
            + '</div>';
        wrap.innerHTML = html;

        wrap.querySelectorAll('.fm-achat-row').forEach(function (rowEl) {
            var idx = parseInt(rowEl.getAttribute('data-index'), 10);
            bindRuneAutocomplete(rowEl.querySelector('.fm-rune-ac'), function (runeId) {
                pendingAchats[idx].rune_id = runeId || '';
            });
            rowEl.querySelector('.fm-achat-qty').addEventListener('input', function () {
                pendingAchats[idx].qty = parseInt(this.value, 10) || 1;
            });
            rowEl.querySelector('.fm-achat-prix').addEventListener('input', function () {
                pendingAchats[idx].prix_total = parseInt(this.value, 10) || 0;
            });
            rowEl.querySelector('.fm-achat-remove').addEventListener('click', function () {
                pendingAchats.splice(idx, 1);
                renderPendingAchats();
            });
        });

        var validateBtn = document.getElementById('fm-achats-validate');
        if (validateBtn) validateBtn.addEventListener('click', validateAchats);
    }

    async function validateAchats() {
        if (!currentSession || !pendingAchats.length) return;
        var missing = pendingAchats.filter(function (a) { return !a.rune_id; });
        if (missing.length) {
            window.REN.toast('Sélectionne la rune pour chaque ligne (' + missing.length + ' manquante(s))', 'error');
            return;
        }

        var btn = document.getElementById('fm-achats-validate');
        if (btn) { btn.disabled = true; btn.textContent = 'Enregistrement…'; }

        try {
            /* Insert en masse */
            var inserts = pendingAchats.map(function (a) {
                return {
                    session_id: currentSession.id,
                    rune_id: a.rune_id,
                    qty: a.qty,
                    prix_total: a.prix_total,
                    message_brut: a.message_brut
                };
            });
            var { error } = await window.REN.supabase.from('fm_session_achats').insert(inserts);
            if (error) throw error;

            /* Cumuler les qty par rune puis maj/insert fm_session_runes */
            var byRune = {};
            pendingAchats.forEach(function (a) {
                byRune[a.rune_id] = (byRune[a.rune_id] || 0) + a.qty;
            });

            var ops = Object.keys(byRune).map(function (runeIdStr) {
                var runeId = parseInt(runeIdStr, 10);
                var existing = sessionRunes.find(function (sr) { return sr.rune_id === runeId; });
                if (existing) {
                    return window.REN.supabase
                        .from('fm_session_runes')
                        .update({ qty_achetee: existing.qty_achetee + byRune[runeIdStr] })
                        .eq('id', existing.id);
                }
                return window.REN.supabase
                    .from('fm_session_runes')
                    .insert({
                        session_id: currentSession.id,
                        rune_id: runeId,
                        qty_avant: 0,
                        qty_achetee: byRune[runeIdStr]
                    });
            });
            var results = await Promise.all(ops);
            var errs = results.filter(function (r) { return r.error; });
            if (errs.length) throw errs[0].error;

            window.REN.toast(pendingAchats.length + ' achat(s) enregistré(s)', 'success');
            pendingAchats = [];
            document.getElementById('fm-achat-paste').value = '';
            renderPendingAchats();

            await loadCurrentSession();
            renderStock();
            renderAchats();
        } catch (err) {
            console.error('[REN-FM] Erreur achats:', err);
            window.REN.toast('Erreur enregistrement achats', 'error');
        } finally {
            if (btn) { btn.disabled = false; }
        }
    }

    function renderAchats() {
        var list = document.getElementById('fm-achats-list');
        if (!achats.length) {
            list.innerHTML = '<p class="text-muted" style="font-size:0.8rem;">Aucun achat pour le moment.</p>';
            return;
        }
        var fmt = window.REN.formatNumber;
        var esc = window.REN.escapeHtml;
        var html = '';
        achats.forEach(function (a) {
            var rune = a.rune_id ? (runesById[a.rune_id] || { nom: '?' }) : { nom: 'Non identifiée' };
            html += '<div class="recyc-history__row">'
                + '<div class="recyc-history__user">'
                    + '<span class="recyc-history__username">' + runeIconHtml(rune) + esc(rune.nom) + '</span>'
                    + '<span class="recyc-history__date">' + window.REN.formatDate(a.created_at) + '</span>'
                + '</div>'
                + '<div class="recyc-history__zone"><span class="text-muted" style="font-size:0.75rem;">' + esc((a.message_brut || '').substring(0, 80)) + '</span></div>'
                + '<div class="recyc-history__stats">'
                    + '<span class="recyc-pill recyc-pill--green">×' + fmt(a.qty) + '</span>'
                    + '<span class="recyc-pill recyc-pill--gold">' + fmt(a.prix_total) + ' K</span>'
                + '</div>'
                + '<button class="recyc-history__del fm-achat-del" data-id="' + a.id + '" title="Supprimer">'
                    + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>'
                + '</button>'
                + '</div>';
        });
        list.innerHTML = html;

        list.querySelectorAll('.fm-achat-del').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                var id = parseInt(btn.getAttribute('data-id'), 10);
                var achat = achats.find(function (a) { return a.id === id; });
                if (!achat) return;
                if (!confirm('Supprimer cet achat ?')) return;
                try {
                    var { error } = await window.REN.supabase.from('fm_session_achats').delete().eq('id', id);
                    if (error) throw error;
                    /* Decrement qty_achetee */
                    var sr = sessionRunes.find(function (s) { return s.rune_id === achat.rune_id; });
                    if (sr) {
                        await window.REN.supabase
                            .from('fm_session_runes')
                            .update({ qty_achetee: Math.max(0, sr.qty_achetee - achat.qty) })
                            .eq('id', sr.id);
                    }
                    await loadCurrentSession();
                    renderStock();
                    renderAchats();
                } catch (err) {
                    console.error('[REN-FM] Erreur delete achat:', err);
                    window.REN.toast('Erreur suppression', 'error');
                }
            });
        });
    }

    /* ============================================ */
    /* CONCASSAGES (fusion de runes)                */
    /* ============================================ */
    var concState = { sourceId: '', qtySource: 0, cibleId: '', qtyCible: 0 };

    /* Rune cible = même catégorie, tier supérieur (basique→pa, pa→ra) */
    function findCibleConcassage(sourceId) {
        var src = runesById[sourceId];
        if (!src) return null;
        var nextTier = src.tier === 'basique' ? 'pa' : (src.tier === 'pa' ? 'ra' : null);
        if (!nextTier) return null;
        return runes.find(function (r) {
            return r.categorie === src.categorie && r.tier === nextTier;
        }) || null;
    }

    function bindConcassage() {
        var wrap = document.getElementById('fm-conc-source-wrap');
        if (!wrap) return;
        wrap.innerHTML = runeAutocompleteHtml('');

        var qtySrcInput = document.getElementById('fm-conc-qty-source');
        var qtyCibleInput = document.getElementById('fm-conc-qty-cible');
        var cibleNom = document.getElementById('fm-conc-cible-nom');

        function refreshCible() {
            var cible = concState.sourceId ? findCibleConcassage(concState.sourceId) : null;
            concState.cibleId = cible ? cible.id : '';
            cibleNom.textContent = cible ? cible.nom : '—';
        }

        bindRuneAutocomplete(wrap.querySelector('.fm-rune-ac'), function (runeId) {
            concState.sourceId = runeId || '';
            refreshCible();
        });

        qtySrcInput.addEventListener('input', function () {
            concState.qtySource = parseInt(this.value, 10) || 0;
            /* ratio standard 3:1, éditable ensuite */
            concState.qtyCible = Math.floor(concState.qtySource / 3);
            qtyCibleInput.value = concState.qtyCible || '';
        });
        qtyCibleInput.addEventListener('input', function () {
            concState.qtyCible = parseInt(this.value, 10) || 0;
        });

        document.getElementById('fm-conc-validate').addEventListener('click', async function () {
            if (!currentSession) { window.REN.toast('Aucune session en cours', 'error'); return; }
            if (!concState.sourceId) { window.REN.toast('Sélectionne la rune fusionnée', 'error'); return; }
            if (!concState.cibleId) { window.REN.toast('Pas de tier supérieur pour cette rune', 'error'); return; }
            if (concState.qtySource <= 0 || concState.qtyCible <= 0) { window.REN.toast('Quantités invalides', 'error'); return; }

            var btn = this;
            btn.disabled = true;
            try {
                var { error } = await window.REN.supabase
                    .from('fm_session_concassages')
                    .insert({
                        session_id: currentSession.id,
                        rune_source_id: concState.sourceId,
                        qty_source: concState.qtySource,
                        rune_cible_id: concState.cibleId,
                        qty_cible: concState.qtyCible
                    });
                if (error) throw error;

                await applyAjustement(concState.sourceId, -concState.qtySource);
                await applyAjustement(concState.cibleId, concState.qtyCible);

                window.REN.toast('Concassage enregistré', 'success');

                /* Reset du formulaire */
                concState = { sourceId: '', qtySource: 0, cibleId: '', qtyCible: 0 };
                wrap.querySelector('.fm-rune-ac__search').value = '';
                wrap.querySelector('.fm-rune-ac__value').value = '';
                qtySrcInput.value = '';
                qtyCibleInput.value = '';
                cibleNom.textContent = '—';

                await loadCurrentSession();
                renderStock();
                renderConcassages();
                /* Si la grille de clôture est ouverte, refléter le nouveau dispo */
                if (!document.getElementById('fm-grid-apres-wrap').hasAttribute('hidden')) {
                    renderGridApres();
                }
            } catch (err) {
                console.error('[REN-FM] Erreur concassage:', err);
                window.REN.toast('Erreur enregistrement concassage', 'error');
            } finally {
                btn.disabled = false;
            }
        });
    }

    /* Applique un ajustement (+/-) sur la ligne de session d'une rune (upsert) */
    async function applyAjustement(runeId, delta) {
        var existing = sessionRunes.find(function (sr) { return sr.rune_id === runeId; });
        if (existing) {
            var { error } = await window.REN.supabase
                .from('fm_session_runes')
                .update({ qty_ajustement: (existing.qty_ajustement || 0) + delta })
                .eq('id', existing.id);
            if (error) throw error;
        } else {
            var { error: e2 } = await window.REN.supabase
                .from('fm_session_runes')
                .insert({
                    session_id: currentSession.id,
                    rune_id: runeId,
                    qty_avant: 0,
                    qty_achetee: 0,
                    qty_ajustement: delta
                });
            if (e2) throw e2;
        }
    }

    function renderConcassages() {
        var list = document.getElementById('fm-concassages-list');
        if (!list) return;
        if (!concassages.length) {
            list.innerHTML = '<p class="text-muted" style="font-size:0.8rem;">Aucun concassage déclaré.</p>';
            return;
        }
        var fmt = window.REN.formatNumber;
        var esc = window.REN.escapeHtml;
        var html = '';
        concassages.forEach(function (c) {
            var src = runesById[c.rune_source_id] || { nom: '?' };
            var cible = runesById[c.rune_cible_id] || { nom: '?' };
            html += '<div class="recyc-history__row">'
                + '<div class="recyc-history__user">'
                    + '<span class="recyc-history__username">' + runeIconHtml(src) + esc(src.nom) + ' → ' + runeIconHtml(cible) + esc(cible.nom) + '</span>'
                    + '<span class="recyc-history__date">' + window.REN.formatDate(c.created_at) + '</span>'
                + '</div>'
                + '<div class="recyc-history__zone"></div>'
                + '<div class="recyc-history__stats">'
                    + '<span class="recyc-pill" style="color:var(--color-warning);">−' + fmt(c.qty_source) + '</span>'
                    + '<span class="recyc-pill recyc-pill--green">+' + fmt(c.qty_cible) + '</span>'
                + '</div>'
                + '<button class="recyc-history__del fm-conc-del" data-id="' + c.id + '" title="Annuler ce concassage">'
                    + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>'
                + '</button>'
                + '</div>';
        });
        list.innerHTML = html;

        list.querySelectorAll('.fm-conc-del').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                var id = parseInt(btn.getAttribute('data-id'), 10);
                var c = concassages.find(function (x) { return x.id === id; });
                if (!c) return;
                if (!confirm('Annuler ce concassage ? Le stock sera rétabli.')) return;
                try {
                    var { error } = await window.REN.supabase
                        .from('fm_session_concassages')
                        .delete()
                        .eq('id', id);
                    if (error) throw error;
                    /* Reverse des ajustements */
                    await applyAjustement(c.rune_source_id, c.qty_source);
                    await applyAjustement(c.rune_cible_id, -c.qty_cible);
                    await loadCurrentSession();
                    renderStock();
                    renderConcassages();
                    if (!document.getElementById('fm-grid-apres-wrap').hasAttribute('hidden')) {
                        renderGridApres();
                    }
                } catch (err) {
                    console.error('[REN-FM] Erreur annulation concassage:', err);
                    window.REN.toast('Erreur annulation', 'error');
                }
            });
        });
    }

    /* ============================================ */
    /* CLOTURE                                      */
    /* ============================================ */
    var pendingApresFile = null;

    function bindCloture() {
        bindImageZone(
            'fm-screen-apres-drop', 'fm-screen-apres-file',
            'fm-screen-apres-preview-wrap', 'fm-screen-apres-preview',
            'fm-screen-apres-status', 'fm-screen-apres-remove',
            async function (file, setStatus) {
                try {
                    var result = await extractRunesFromImage(file);
                    pendingApresFile = file;
                    var pui = computeItemPui(result.item_stats);
                    if (pui) pendingApresPui = pui;
                    renderPuiBanner('fm-pui-apres', pendingApresPui);
                    fillGridApres(result);
                    setStatus('Analysé ✓', 'recyc-preuve__status--ok');
                } catch (err) {
                    console.error('[REN-FM] Extraction apres:', err);
                    setStatus('Échec analyse', '');
                    window.REN.toast('Extraction impossible — saisis les quantités manuellement', 'error');
                    gridApres = {};
                    document.getElementById('fm-grid-apres-wrap').removeAttribute('hidden');
                    renderGridApres();
                    document.getElementById('fm-close-session').disabled = false;
                }
            },
            function () {
                pendingApresFile = null;
                pendingApresPui = null;
                renderPuiBanner('fm-pui-apres', null);
                gridApres = {};
                document.getElementById('fm-grid-apres-wrap').setAttribute('hidden', '');
                document.getElementById('fm-close-session').disabled = true;
            }
        );

        document.getElementById('fm-close-session').addEventListener('click', closeSession);

        /* Ajout d'une rune absente des screens (ex: rune exo passee a la main) */
        var addBtn = document.getElementById('fm-apres-add');
        if (addBtn) addBtn.addEventListener('click', showExtraRuneRow);
    }

    /* Ligne d'ajout manuel a la cloture : rune + qty depart + qty fin.       */
    /* Insere la ligne dans fm_session_runes puis re-render la grille.        */
    function showExtraRuneRow() {
        var wrap = document.getElementById('fm-apres-extra');
        var row = document.getElementById('fm-apres-extra-row');
        if (!wrap || !row) return;
        wrap.removeAttribute('hidden');

        var extra = { runeId: '', avant: 0, fin: 0 };

        row.innerHTML = ''
            + runeAutocompleteHtml('')
            + '<input type="number" class="form-input fm-grid__qty" id="fm-extra-avant" min="0" value="0" placeholder="Qté départ" title="Quantité possédée au départ">'
            + '<input type="number" class="form-input fm-grid__qty" id="fm-extra-fin" min="0" value="0" placeholder="Qté fin" title="Quantité restante à la fin">'
            + '<button type="button" class="btn btn--primary btn--small" id="fm-extra-validate">Ajouter</button>';

        bindRuneAutocomplete(row.querySelector('.fm-rune-ac'), function (runeId) {
            extra.runeId = runeId || '';
        });
        document.getElementById('fm-extra-avant').addEventListener('input', function () {
            extra.avant = parseInt(this.value, 10) || 0;
        });
        document.getElementById('fm-extra-fin').addEventListener('input', function () {
            extra.fin = parseInt(this.value, 10) || 0;
        });

        document.getElementById('fm-extra-validate').addEventListener('click', async function () {
            if (!currentSession) return;
            if (!extra.runeId) { window.REN.toast('Sélectionne la rune', 'error'); return; }

            /* Si la rune est deja dans la session : corriger sa ligne plutot */
            var existing = sessionRunes.find(function (sr) { return sr.rune_id === extra.runeId; });
            if (existing) {
                window.REN.toast('Cette rune est déjà dans la session — corrige sa quantité de fin directement dans le tableau', 'error');
                return;
            }
            if (extra.avant <= 0) { window.REN.toast('Indique la quantité possédée au départ', 'error'); return; }

            var btn = this;
            btn.disabled = true;
            try {
                var { error } = await window.REN.supabase
                    .from('fm_session_runes')
                    .insert({
                        session_id: currentSession.id,
                        rune_id: extra.runeId,
                        qty_avant: extra.avant,
                        qty_achetee: 0
                    });
                if (error) throw error;

                gridApres[extra.runeId] = extra.fin;
                await loadCurrentSession();
                renderStock();
                renderGridApres();

                wrap.setAttribute('hidden', '');
                row.innerHTML = '';
                window.REN.toast('Rune ajoutée à la session', 'success');
            } catch (err) {
                console.error('[REN-FM] Erreur ajout rune cloture:', err);
                window.REN.toast('Erreur ajout rune', 'error');
            } finally {
                btn.disabled = false;
            }
        });
    }

    /* Merge (multi-screens supportes, comme la grille avant) */
    function fillGridApres(result) {
        (result.runes || []).forEach(function (r) {
            var rune = matchRune(r.nom);
            if (rune) gridApres[rune.id] = parseInt(r.qty, 10) || 0;
        });
        var info = document.getElementById('fm-grid-apres-info');
        info.textContent = result.non_identifiees ? '(' + result.non_identifiees + ' cellule(s) non identifiée(s))' : '';

        document.getElementById('fm-grid-apres-wrap').removeAttribute('hidden');
        renderGridApres();
        document.getElementById('fm-close-session').disabled = false;

        /* Re-afficher la drop zone pour un screen supplementaire */
        var drop = document.getElementById('fm-screen-apres-drop');
        if (drop) {
            drop.style.display = '';
            var label = drop.querySelector('span');
            if (label) label.innerHTML = 'Inventaire sur plusieurs pages ? Colle le screen suivant (<kbd>Ctrl</kbd>+<kbd>V</kbd>) — les résultats fusionnent';
        }
    }

    function renderGridApres() {
        var tbody = document.getElementById('fm-grid-apres');
        var fmt = window.REN.formatNumber;
        var esc = window.REN.escapeHtml;
        var html = '';

        sessionRunes
            .slice()
            .sort(function (a, b) {
                var ra = runesById[a.rune_id], rb = runesById[b.rune_id];
                return (ra ? ra.ordre : 0) - (rb ? rb.ordre : 0);
            })
            .forEach(function (sr) {
                var rune = runesById[sr.rune_id] || { nom: '?', prix_kamas: 0 };
                var dispo = dispoOf(sr);
                var fin = gridApres[sr.rune_id] !== undefined ? gridApres[sr.rune_id] : 0;
                html += '<tr data-rune="' + sr.rune_id + '">'
                    + '<td>' + runeIconHtml(rune) + '<strong>' + esc(rune.nom) + '</strong></td>'
                    + '<td class="recyc-num"><input type="number" class="form-input fm-grid__qty fm-apres-dispo" min="0" value="' + dispo + '" style="width:90px;" title="Départ + achats + concassages — corrigeable si le screen de départ était faux"></td>'
                    + '<td class="recyc-num"><input type="number" class="form-input fm-grid__qty fm-apres-qty" min="0" value="' + fin + '" style="width:90px;"></td>'
                    + '<td class="recyc-num fm-apres-conso">—</td>'
                    + '<td class="recyc-num fm-apres-cout">—</td>'
                    + '</tr>';
            });
        tbody.innerHTML = html;

        tbody.querySelectorAll('tr').forEach(function (tr) {
            var runeId = parseInt(tr.getAttribute('data-rune'), 10);
            tr.querySelector('.fm-apres-qty').addEventListener('input', function () {
                gridApres[runeId] = parseInt(this.value, 10) || 0;
                updateClotureTotals();
            });
            /* Correction du dispo : ajuste qty_avant (persiste en BDD au blur) */
            tr.querySelector('.fm-apres-dispo').addEventListener('change', async function () {
                var sr = sessionRunes.find(function (s) { return s.rune_id === runeId; });
                if (!sr) return;
                var newDispo = parseInt(this.value, 10) || 0;
                var newAvant = Math.max(0, newDispo - sr.qty_achetee - (sr.qty_ajustement || 0));
                sr.qty_avant = newAvant;
                updateClotureTotals();
                try {
                    await window.REN.supabase
                        .from('fm_session_runes')
                        .update({ qty_avant: newAvant })
                        .eq('id', sr.id);
                    renderStock();
                } catch (err) {
                    console.error('[REN-FM] Erreur maj dispo:', err);
                    window.REN.toast('Erreur sauvegarde du dispo', 'error');
                }
            });
        });
        updateClotureTotals();
    }

    function updateClotureTotals() {
        var tbody = document.getElementById('fm-grid-apres');
        var fmt = window.REN.formatNumber;
        var totalConso = 0, totalCout = 0;

        tbody.querySelectorAll('tr').forEach(function (tr) {
            var runeId = parseInt(tr.getAttribute('data-rune'), 10);
            var sr = sessionRunes.find(function (s) { return s.rune_id === runeId; });
            var rune = runesById[runeId] || { prix_kamas: 0 };
            if (!sr) return;
            var dispo = dispoOf(sr);
            var fin = gridApres[runeId] !== undefined ? gridApres[runeId] : 0;
            var conso = dispo - fin;
            var cout = conso > 0 ? conso * (rune.prix_kamas || 0) : 0;

            var consoEl = tr.querySelector('.fm-apres-conso');
            consoEl.textContent = (conso >= 0 ? fmt(conso) : '⚠ ' + fmt(conso));
            consoEl.style.color = conso < 0 ? 'var(--color-warning)' : '';
            consoEl.title = conso < 0
                ? 'Stock final supérieur au stock connu — achat non déclaré ou concassage (fusion de runes) non déclaré ?'
                : '';
            tr.querySelector('.fm-apres-cout').textContent = fmt(cout);

            if (conso > 0) { totalConso += conso; totalCout += cout; }
        });

        document.getElementById('fm-total-conso').textContent = fmt(totalConso);
        document.getElementById('fm-total-cout').textContent = fmt(totalCout) + ' K';
    }

    async function closeSession() {
        if (!currentSession) return;

        var btn = document.getElementById('fm-close-session');
        btn.disabled = true;
        btn.textContent = 'Clôture…';

        try {
            var screenUrl = pendingApresFile ? await uploadScreen(pendingApresFile, 'apres') : null;

            var totalConso = 0, totalCout = 0;
            var updates = sessionRunes.map(function (sr) {
                var rune = runesById[sr.rune_id] || { prix_kamas: 0 };
                var fin = gridApres[sr.rune_id] !== undefined ? gridApres[sr.rune_id] : 0;
                var conso = Math.max(0, dispoOf(sr) - fin);
                var cout = conso * (rune.prix_kamas || 0);
                totalConso += conso;
                totalCout += cout;
                return window.REN.supabase
                    .from('fm_session_runes')
                    .update({ qty_apres: fin, qty_consommee: conso, cout_kamas: cout })
                    .eq('id', sr.id);
            });
            var results = await Promise.all(updates);
            var errs = results.filter(function (r) { return r.error; });
            if (errs.length) throw errs[0].error;

            var { error } = await window.REN.supabase
                .from('fm_sessions')
                .update({
                    statut: 'terminee',
                    ended_at: new Date().toISOString(),
                    cout_total_kamas: totalCout,
                    nb_runes_consommees: totalConso,
                    screenshot_apres_url: screenUrl,
                    item_pui_final: pendingApresPui ? pendingApresPui.actuel : null
                })
                .eq('id', currentSession.id);
            if (error) throw error;

            invalidateSessionLists();
            showSummary(totalConso, totalCout);
        } catch (err) {
            console.error('[REN-FM] Erreur cloture:', err);
            window.REN.toast('Erreur lors de la clôture', 'error');
            btn.disabled = false;
            btn.textContent = 'Valider la clôture';
        }
    }

    function showSummary(totalConso, totalCout) {
        var fmt = window.REN.formatNumber;
        var esc = window.REN.escapeHtml;

        document.getElementById('fm-current-session').setAttribute('hidden', '');
        document.getElementById('fm-new-session').setAttribute('hidden', '');
        var summary = document.getElementById('fm-summary');
        summary.removeAttribute('hidden');

        document.getElementById('fm-summary-runes').textContent = fmt(totalConso);
        document.getElementById('fm-summary-cout').textContent = fmt(totalCout) + ' K';
        var totalAchats = achats.reduce(function (acc, a) { return acc + (a.prix_total || 0); }, 0);
        document.getElementById('fm-summary-achats').textContent = fmt(totalAchats) + ' K';

        /* Évolution du pui de l'item (si mesuré au départ et/ou à la fin) */
        var puiWrap = document.getElementById('fm-summary-pui-wrap');
        var depart = currentSession ? currentSession.item_pui_depart : null;
        var final_ = pendingApresPui ? pendingApresPui.actuel : null;
        if (puiWrap) {
            if (depart !== null && depart !== undefined && final_ !== null) {
                var delta = Math.round((final_ - depart) * 10) / 10;
                document.getElementById('fm-summary-pui').innerHTML =
                    fmt(depart) + ' → ' + fmt(final_)
                    + ' <span style="font-size:0.8em;color:' + (delta >= 0 ? 'var(--color-success)' : 'var(--color-danger)') + ';">(' + (delta >= 0 ? '+' : '') + fmt(delta) + ')</span>';
                puiWrap.removeAttribute('hidden');
            } else if (final_ !== null) {
                document.getElementById('fm-summary-pui').textContent = fmt(final_);
                puiWrap.removeAttribute('hidden');
            } else {
                puiWrap.setAttribute('hidden', '');
            }
        }

        var html = '<table class="recyc-table"><thead><tr>'
            + '<th>Rune</th><th class="recyc-num">Consommé</th><th class="recyc-num">Prix unit.</th><th class="recyc-num">Coût</th>'
            + '</tr></thead><tbody>';
        sessionRunes
            .slice()
            .sort(function (a, b) {
                var ca = (gridApres[a.rune_id] !== undefined) ? (dispoOf(a) - gridApres[a.rune_id]) : 0;
                var cb = (gridApres[b.rune_id] !== undefined) ? (dispoOf(b) - gridApres[b.rune_id]) : 0;
                return cb - ca;
            })
            .forEach(function (sr) {
                var rune = runesById[sr.rune_id] || { nom: '?', prix_kamas: 0 };
                var fin = gridApres[sr.rune_id] !== undefined ? gridApres[sr.rune_id] : 0;
                var conso = Math.max(0, dispoOf(sr) - fin);
                if (!conso) return;
                html += '<tr>'
                    + '<td>' + runeIconHtml(rune) + '<strong>' + esc(rune.nom) + '</strong></td>'
                    + '<td class="recyc-num">' + fmt(conso) + '</td>'
                    + '<td class="recyc-num">' + fmt(rune.prix_kamas || 0) + '</td>'
                    + '<td class="recyc-num" style="color:var(--color-warning);font-weight:700;">' + fmt(conso * (rune.prix_kamas || 0)) + '</td>'
                    + '</tr>';
            });
        html += '</tbody></table>';
        document.getElementById('fm-summary-detail').innerHTML = html;

        document.getElementById('fm-summary-new').onclick = function () {
            currentSession = null;
            sessionRunes = [];
            achats = [];
            concassages = [];
            gridAvant = [];
            gridApres = {};
            pendingAvantFile = null;
            pendingApresFile = null;
            document.getElementById('fm-titre').value = '';
            document.getElementById('fm-grid-avant-wrap').setAttribute('hidden', '');
            renderSessionPanel();
        };
    }

    /* ============================================ */
    /* HISTORIQUE (cards + modal détail)            */
    /* ============================================ */
    var sessionsCache = [];
    var sessionsSortBound = false;
    var modalBound = false;
    var modalSort = { col: 'cout_kamas', dir: 'desc' };
    var modalRunes = [];
    var modalSession = null;
    var modalAchats = [];

    async function loadHistorique() {
        var list = document.getElementById('fm-sessions-list');
        try {
            var res = await Promise.all([
                window.REN.supabase
                    .from('fm_sessions')
                    .select('*')
                    .eq('user_id', userId)
                    .in('statut', ['en_cours', 'terminee'])
                    .order('started_at', { ascending: false })
                    .limit(100),
                window.REN.supabase
                    .from('v_fm_par_user')
                    .select('*')
                    .eq('user_id', userId)
                    .maybeSingle()
            ]);
            sessionsCache = res[0].data || [];
            var stats = res[1].data || { nb_sessions: 0, total_kamas: 0, total_runes: 0 };

            var fmt = window.REN.formatNumber;
            document.getElementById('fm-kpi-sessions').textContent = fmt(stats.nb_sessions);
            document.getElementById('fm-kpi-runes').textContent = fmt(stats.total_runes);
            document.getElementById('fm-kpi-kamas').textContent = fmt(stats.total_kamas) + ' K';

            if (!sessionsSortBound) {
                sessionsSortBound = true;
                var sel = document.getElementById('fm-sessions-sort');
                if (sel) sel.addEventListener('change', renderSessionsGrid);
                bindModal();
            }

            renderSessionsGrid();
        } catch (err) {
            console.error('[REN-FM] Erreur historique:', err);
            list.innerHTML = '<p class="text-muted">Erreur de chargement.</p>';
        }
    }

    function renderSessionsGrid() {
        var list = document.getElementById('fm-sessions-list');
        var fmt = window.REN.formatNumber;
        var esc = window.REN.escapeHtml;

        if (!sessionsCache.length) {
            list.innerHTML = '<p class="text-muted text-center" style="padding:var(--spacing-lg);grid-column:1/-1;">Aucune session terminée.</p>';
            return;
        }

        var mode = (document.getElementById('fm-sessions-sort') || {}).value || 'recent';
        function sortFn(a, b) {
            switch (mode) {
                case 'cout-desc':  return (b.cout_total_kamas || 0) - (a.cout_total_kamas || 0);
                case 'cout-asc':   return (a.cout_total_kamas || 0) - (b.cout_total_kamas || 0);
                case 'runes-desc': return (b.nb_runes_consommees || 0) - (a.nb_runes_consommees || 0);
                default:           return new Date(b.ended_at || b.started_at) - new Date(a.ended_at || a.started_at);
            }
        }
        /* Sessions en cours toujours en tête, puis les terminées selon le tri */
        var enCours = sessionsCache.filter(function (s) { return s.statut === 'en_cours'; })
            .sort(function (a, b) { return new Date(b.last_active_at || b.started_at) - new Date(a.last_active_at || a.started_at); });
        var terminees = sessionsCache.filter(function (s) { return s.statut === 'terminee'; }).sort(sortFn);
        var sorted = enCours.concat(terminees);

        var html = '';
        sorted.forEach(function (s) {
            var isOngoing = s.statut === 'en_cours';
            var screenUrl = s.screenshot_apres_url || s.screenshot_avant_url;
            var imgHtml = screenUrl
                ? '<img src="' + esc(screenUrl) + '" alt="' + esc(s.titre) + '" loading="lazy">'
                : '<div class="fm-session-card__placeholder">'
                    + '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9"/><path d="m18 15 4-4"/><path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/></svg>'
                  + '</div>';

            var badge = isOngoing ? '<span class="fm-session-card__badge">EN COURS</span>' : '';
            var dateText = isOngoing
                ? 'démarrée ' + window.REN.formatDate(s.started_at)
                : window.REN.formatDateFull(s.ended_at);
            var puiVal = s.item_pui_final !== null && s.item_pui_final !== undefined ? s.item_pui_final : s.item_pui_depart;
            var puiPill = (puiVal !== null && puiVal !== undefined)
                ? '<span class="recyc-pill" title="Poids de l\'item">⚖ ' + fmt(puiVal) + ' pui</span>' : '';
            var statsHtml = isOngoing
                ? '<span class="recyc-pill recyc-pill--green">▶ Reprendre</span>' + puiPill
                : '<span class="recyc-pill">' + fmt(s.nb_runes_consommees || 0) + ' runes</span>'
                    + '<span class="recyc-pill recyc-pill--gold">' + fmt(s.cout_total_kamas || 0) + ' K</span>'
                    + puiPill;

            html += '<div class="fm-session-card' + (isOngoing ? ' fm-session-card--ongoing' : '') + '" data-id="' + s.id + '" data-statut="' + s.statut + '">'
                + badge
                + '<div class="fm-session-card__image">' + imgHtml + '</div>'
                + '<div class="fm-session-card__body">'
                    + '<div class="fm-session-card__title">' + esc(s.titre) + '</div>'
                    + '<div class="fm-session-card__date">' + dateText + '</div>'
                    + '<div class="fm-session-card__stats">' + statsHtml + '</div>'
                + '</div>'
                + '</div>';
        });
        list.innerHTML = html;

        list.querySelectorAll('.fm-session-card').forEach(function (card) {
            card.addEventListener('click', function () {
                var id = parseInt(card.getAttribute('data-id'), 10);
                if (card.getAttribute('data-statut') === 'en_cours') {
                    reprendreSession(id);
                } else {
                    openSessionDetail(id);
                }
            });
        });
    }

    /* === MODAL DÉTAIL === */
    function bindModal() {
        if (modalBound) return;
        modalBound = true;
        var modal = document.getElementById('fm-session-modal');
        var closeBtn = document.getElementById('fm-modal-close');
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (modal) {
            modal.addEventListener('click', function (e) {
                if (e.target === modal) closeModal();
            });
        }
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeModal();
        });
    }

    function closeModal() {
        var modal = document.getElementById('fm-session-modal');
        if (modal) modal.setAttribute('hidden', '');
        document.body.style.overflow = '';
    }

    async function openSessionDetail(sessionId) {
        var modal = document.getElementById('fm-session-modal');
        var content = document.getElementById('fm-modal-content');
        if (!modal || !content) return;

        modalSession = sessionsCache.find(function (s) { return s.id === sessionId; })
            || alliSessions.find(function (s) { return s.id === sessionId; });
        if (!modalSession) return;

        modal.removeAttribute('hidden');
        document.body.style.overflow = 'hidden';
        content.innerHTML = '<div class="loading"><div class="spinner"></div> Chargement...</div>';

        try {
            var res = await Promise.all([
                window.REN.supabase
                    .from('fm_session_runes')
                    .select('*')
                    .eq('session_id', sessionId)
                    .gt('qty_consommee', 0),
                window.REN.supabase
                    .from('fm_session_achats')
                    .select('*')
                    .eq('session_id', sessionId)
                    .order('created_at', { ascending: true })
            ]);
            modalRunes = (res[0].data || []).map(function (sr) {
                var rune = runesById[sr.rune_id] || { nom: '?', prix_kamas: 0 };
                return {
                    nom: rune.nom,
                    img_url: rune.img_url || null,
                    qty_consommee: sr.qty_consommee || 0,
                    prix_unitaire: rune.prix_kamas || 0,
                    cout_kamas: sr.cout_kamas || 0
                };
            });
            modalAchats = res[1].data || [];
            modalSort = { col: 'cout_kamas', dir: 'desc' };
            renderModalContent();
        } catch (err) {
            console.error('[REN-FM] Erreur detail session:', err);
            content.innerHTML = '<p class="text-muted">Erreur de chargement.</p>';
        }
    }

    function renderModalContent() {
        var content = document.getElementById('fm-modal-content');
        var fmt = window.REN.formatNumber;
        var esc = window.REN.escapeHtml;
        var s = modalSession;
        if (!s) return;

        /* Tri du détail */
        var dir = modalSort.dir === 'asc' ? 1 : -1;
        var col = modalSort.col;
        var sorted = modalRunes.slice().sort(function (a, b) {
            var va = a[col], vb = b[col];
            if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
            return String(va).localeCompare(String(vb), 'fr') * dir;
        });

        var totalAchats = modalAchats.reduce(function (acc, a) { return acc + (a.prix_total || 0); }, 0);

        var html = '';

        /* Header */
        var ownerName = (s.profiles && s.profiles.username) || (s.user_id === userId ? '' : '?');
        html += '<div class="fm-modal__header">'
            + '<div>'
                + (ownerName ? '<div class="fm-modal__owner">' + esc(ownerName) + (s.user_id === userId ? ' <span class="text-muted">(vous)</span>' : '') + '</div>' : '')
                + '<div class="fm-modal__title">' + esc(s.titre) + '</div>'
                + '<div class="fm-modal__date">' + window.REN.formatDateFull(s.ended_at) + '</div>'
            + '</div>'
            + '</div>';

        /* Screen de fin */
        if (s.screenshot_apres_url) {
            html += '<a href="' + esc(s.screenshot_apres_url) + '" target="_blank" rel="noopener" class="fm-modal__screen" title="Ouvrir en grand">'
                + '<img src="' + esc(s.screenshot_apres_url) + '" alt="Item final">'
                + '</a>';
        }

        /* KPIs */
        var puiKpi = '';
        if (s.item_pui_depart !== null && s.item_pui_depart !== undefined && s.item_pui_final !== null && s.item_pui_final !== undefined) {
            var d = Math.round((s.item_pui_final - s.item_pui_depart) * 10) / 10;
            puiKpi = '<div class="recyc-kpi"><span class="recyc-kpi__label">Pui de l\'item</span><span class="recyc-kpi__value">'
                + fmt(s.item_pui_depart) + ' → ' + fmt(s.item_pui_final)
                + ' <span style="font-size:0.7em;color:' + (d >= 0 ? 'var(--color-success)' : 'var(--color-danger)') + ';">(' + (d >= 0 ? '+' : '') + fmt(d) + ')</span>'
                + '</span></div>';
        } else if (s.item_pui_final !== null && s.item_pui_final !== undefined) {
            puiKpi = '<div class="recyc-kpi"><span class="recyc-kpi__label">Pui de l\'item</span><span class="recyc-kpi__value">' + fmt(s.item_pui_final) + '</span></div>';
        }
        html += '<div class="recyc-kpi-grid mb-lg" style="margin-top:var(--spacing-md);">'
            + '<div class="recyc-kpi"><span class="recyc-kpi__label">Runes consommées</span><span class="recyc-kpi__value">' + fmt(s.nb_runes_consommees || 0) + '</span></div>'
            + '<div class="recyc-kpi"><span class="recyc-kpi__label">Coût total</span><span class="recyc-kpi__value recyc-kpi__value--gold">' + fmt(s.cout_total_kamas || 0) + ' K</span></div>'
            + '<div class="recyc-kpi"><span class="recyc-kpi__label">Dont achats en session</span><span class="recyc-kpi__value">' + fmt(totalAchats) + ' K</span></div>'
            + puiKpi
            + '</div>';

        /* Tableau détail triable */
        if (!sorted.length) {
            html += '<p class="text-muted">Aucune rune consommée.</p>';
        } else {
            html += '<div class="recyc-table-wrap"><table class="recyc-table"><thead><tr>'
                + thSort('nom', 'Rune')
                + thSort('qty_consommee', 'Consommé')
                + thSort('prix_unitaire', 'Prix unit.')
                + thSort('cout_kamas', 'Coût (kamas)')
                + '</tr></thead><tbody>';
            sorted.forEach(function (r) {
                html += '<tr>'
                    + '<td>' + runeIconHtml(r) + '<strong>' + esc(r.nom) + '</strong></td>'
                    + '<td class="recyc-num">' + fmt(r.qty_consommee) + '</td>'
                    + '<td class="recyc-num">' + fmt(r.prix_unitaire) + '</td>'
                    + '<td class="recyc-num" style="color:var(--color-warning);font-weight:700;">' + fmt(r.cout_kamas) + '</td>'
                    + '</tr>';
            });
            html += '</tbody></table></div>';
        }

        content.innerHTML = html;

        /* Bind tri */
        content.querySelectorAll('th[data-sort]').forEach(function (th) {
            th.addEventListener('click', function () {
                var c = th.getAttribute('data-sort');
                if (modalSort.col === c) {
                    modalSort.dir = modalSort.dir === 'desc' ? 'asc' : 'desc';
                } else {
                    modalSort.col = c;
                    modalSort.dir = (c === 'nom') ? 'asc' : 'desc';
                }
                renderModalContent();
            });
        });
    }

    /* Génère un <th> triable avec indicateur (réutilise le style recyc-th-sort) */
    function thSort(col, label) {
        var active = modalSort.col === col;
        var arrow = active ? (modalSort.dir === 'asc' ? '↑' : '↓') : '↕';
        var cls = 'recyc-th-sort' + (active ? ' recyc-th-sort--active' : '') + (col !== 'nom' ? ' recyc-num' : '');
        return '<th class="' + cls + '" data-sort="' + col + '">' + label
            + '<span class="recyc-th-sort__indicator" style="display:' + (active ? 'inline-flex' : 'none') + ';">' + arrow + '</span>'
            + '</th>';
    }

    /* ============================================ */
    /* ALLIANCE (sessions de tous les membres)      */
    /* ============================================ */
    var alliSessions = [];
    var alliSortBound = false;

    async function loadAlliance() {
        var list = document.getElementById('fm-alli-list');
        try {
            var res = await Promise.all([
                window.REN.supabase
                    .from('fm_sessions')
                    .select('*, profiles:user_id(username)')
                    .in('statut', ['en_cours', 'terminee'])
                    .order('started_at', { ascending: false })
                    .limit(120),
                window.REN.supabase
                    .from('v_fm_par_user')
                    .select('*')
            ]);
            alliSessions = res[0].data || [];
            var parUser = res[1].data || [];

            var fmt = window.REN.formatNumber;
            var actifs = parUser.filter(function (u) { return (u.nb_sessions || 0) > 0; });
            var totSessions = 0, totRunes = 0, totKamas = 0;
            actifs.forEach(function (u) {
                totSessions += u.nb_sessions || 0;
                totRunes += u.total_runes || 0;
                totKamas += u.total_kamas || 0;
            });
            setAlliKpi('fm-alli-fmeurs', fmt(actifs.length));
            setAlliKpi('fm-alli-sessions', fmt(totSessions));
            setAlliKpi('fm-alli-runes', fmt(totRunes));
            setAlliKpi('fm-alli-kamas', fmt(totKamas) + ' K');

            if (!alliSortBound) {
                alliSortBound = true;
                var sel = document.getElementById('fm-alli-sort');
                if (sel) sel.addEventListener('change', renderAlliGrid);
            }
            renderAlliGrid();
        } catch (err) {
            console.error('[REN-FM] Erreur alliance:', err);
            list.innerHTML = '<p class="text-muted">Erreur de chargement.</p>';
        }
    }

    function setAlliKpi(id, val) {
        var el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    function renderAlliGrid() {
        var list = document.getElementById('fm-alli-list');
        var fmt = window.REN.formatNumber;
        var esc = window.REN.escapeHtml;

        if (!alliSessions.length) {
            list.innerHTML = '<p class="text-muted text-center" style="padding:var(--spacing-lg);grid-column:1/-1;">Aucune session dans l\'alliance pour le moment.</p>';
            return;
        }

        var mode = (document.getElementById('fm-alli-sort') || {}).value || 'recent';
        function sortFn(a, b) {
            switch (mode) {
                case 'cout-desc':  return (b.cout_total_kamas || 0) - (a.cout_total_kamas || 0);
                case 'cout-asc':   return (a.cout_total_kamas || 0) - (b.cout_total_kamas || 0);
                case 'runes-desc': return (b.nb_runes_consommees || 0) - (a.nb_runes_consommees || 0);
                default:           return new Date(b.ended_at || b.started_at) - new Date(a.ended_at || a.started_at);
            }
        }
        var enCours = alliSessions.filter(function (s) { return s.statut === 'en_cours'; })
            .sort(function (a, b) { return new Date(b.last_active_at || b.started_at) - new Date(a.last_active_at || a.started_at); });
        var terminees = alliSessions.filter(function (s) { return s.statut === 'terminee'; }).sort(sortFn);
        var sorted = enCours.concat(terminees);

        var html = '';
        sorted.forEach(function (s) {
            var isOngoing = s.statut === 'en_cours';
            var isMine = s.user_id === userId;
            var username = (s.profiles && s.profiles.username) || '?';
            var screenUrl = s.screenshot_apres_url || s.screenshot_avant_url;
            var imgHtml = screenUrl
                ? '<img src="' + esc(screenUrl) + '" alt="' + esc(s.titre) + '" loading="lazy">'
                : '<div class="fm-session-card__placeholder">'
                    + '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9"/><path d="m18 15 4-4"/><path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/></svg>'
                  + '</div>';

            var badge = isOngoing ? '<span class="fm-session-card__badge">EN COURS</span>' : '';
            var dateText = isOngoing
                ? 'démarrée ' + window.REN.formatDate(s.started_at)
                : window.REN.formatDateFull(s.ended_at);
            var puiVal = s.item_pui_final !== null && s.item_pui_final !== undefined ? s.item_pui_final : s.item_pui_depart;
            var puiPill = (puiVal !== null && puiVal !== undefined)
                ? '<span class="recyc-pill" title="Poids de l\'item">⚖ ' + fmt(puiVal) + ' pui</span>' : '';
            var statsHtml = isOngoing
                ? (isMine ? '<span class="recyc-pill recyc-pill--green">▶ Reprendre</span>' : '<span class="recyc-pill">⚒️ en plein FM…</span>') + puiPill
                : '<span class="recyc-pill">' + fmt(s.nb_runes_consommees || 0) + ' runes</span>'
                    + '<span class="recyc-pill recyc-pill--gold">' + fmt(s.cout_total_kamas || 0) + ' K</span>'
                    + puiPill;

            var clickable = !isOngoing || isMine;
            html += '<div class="fm-session-card' + (isOngoing ? ' fm-session-card--ongoing' : '') + '"'
                + ' data-id="' + s.id + '" data-statut="' + s.statut + '" data-mine="' + (isMine ? '1' : '0') + '"'
                + (clickable ? '' : ' style="cursor:default;"')
                + '>'
                + badge
                + '<div class="fm-session-card__image">' + imgHtml + '</div>'
                + '<div class="fm-session-card__body">'
                    + '<div class="fm-session-card__user">' + esc(username) + (isMine ? ' <span class="text-muted" style="font-weight:400;">(vous)</span>' : '') + '</div>'
                    + '<div class="fm-session-card__title">' + esc(s.titre) + '</div>'
                    + '<div class="fm-session-card__date">' + dateText + '</div>'
                    + '<div class="fm-session-card__stats">' + statsHtml + '</div>'
                + '</div>'
                + '</div>';
        });
        list.innerHTML = html;

        list.querySelectorAll('.fm-session-card').forEach(function (card) {
            card.addEventListener('click', function () {
                var id = parseInt(card.getAttribute('data-id'), 10);
                var statut = card.getAttribute('data-statut');
                var mine = card.getAttribute('data-mine') === '1';
                if (statut === 'en_cours') {
                    if (mine) reprendreSession(id);
                    /* en_cours d'un autre membre : pas d'action */
                } else {
                    openSessionDetail(id);
                }
            });
        });
    }

    /* ============================================ */
    /* CATALOGUE RUNES & PRIX                       */
    /* ============================================ */
    function renderRunesCatalogue() {
        var tbody = document.getElementById('fm-runes-tbody');
        var saveBtn = document.getElementById('fm-runes-save');
        var search = document.getElementById('fm-runes-search');
        var fmt = window.REN.formatNumber;
        var esc = window.REN.escapeHtml;

        if (isAdmin && saveBtn) saveBtn.style.display = '';

        function render(filter) {
            var q = norm(filter || '');
            var html = '';
            runes.forEach(function (r) {
                if (q && norm(r.nom + ' ' + r.categorie).indexOf(q) === -1) return;
                var prixCell = isAdmin
                    ? '<input type="number" class="form-input fm-prix-input" data-id="' + r.id + '" min="0" value="' + (r.prix_kamas || 0) + '" style="width:110px;">'
                    : fmt(r.prix_kamas || 0);
                html += '<tr>'
                    + '<td>' + runeIconHtml(r) + '<strong>' + esc(r.nom) + '</strong></td>'
                    + '<td>' + esc(r.categorie) + (r.tier !== 'basique' ? ' <span class="recyc-pill" style="font-size:0.6rem;">' + r.tier.toUpperCase() + '</span>' : '') + '</td>'
                    + '<td class="recyc-num">+' + r.bonus + '</td>'
                    + '<td class="recyc-num">' + r.poids + '</td>'
                    + '<td class="recyc-num">' + prixCell + '</td>'
                    + '</tr>';
            });
            tbody.innerHTML = html || '<tr><td colspan="5" class="text-muted text-center">Aucune rune.</td></tr>';
        }

        render('');
        if (search) {
            search.addEventListener('input', function () { render(search.value); });
        }

        if (isAdmin && saveBtn) {
            saveBtn.addEventListener('click', async function () {
                var inputs = tbody.querySelectorAll('.fm-prix-input');
                var updates = [];
                inputs.forEach(function (input) {
                    var id = parseInt(input.getAttribute('data-id'), 10);
                    var prix = parseInt(input.value, 10) || 0;
                    var rune = runesById[id];
                    if (rune && rune.prix_kamas !== prix) {
                        updates.push(
                            window.REN.supabase.from('runes')
                                .update({ prix_kamas: prix, updated_at: new Date().toISOString() })
                                .eq('id', id)
                        );
                        rune.prix_kamas = prix;
                    }
                });
                if (!updates.length) { window.REN.toast('Aucun prix modifié', 'info'); return; }
                var results = await Promise.all(updates);
                var errs = results.filter(function (r) { return r.error; });
                if (errs.length) {
                    window.REN.toast('Erreur sur ' + errs.length + ' prix', 'error');
                } else {
                    window.REN.toast(updates.length + ' prix sauvegardé(s) !', 'success');
                }
            });
        }
    }
})();
