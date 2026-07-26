/* ============================================ */
/* Damoclès     - Builds                       */
/* Builds recommandes par l'alliance           */
/* ============================================ */
(function () {
    'use strict';

    var allBuilds = [];
    var currentType = 'tous';
    var currentClasse = '';
    var currentSort = 'recent';

    document.addEventListener('ren:ready', init);

    async function init() {
        if (!window.REN.supabase || !window.REN.currentProfile) return;
        await loadBuilds();
        setupFilters();
        setupSubmitForm();
    }

    /* === FILTERS SETUP === */
    function setupFilters() {
        /* Tabs type (Tous / PVP / PVM) */
        var tabsContainer = document.getElementById('builds-type-tabs');
        if (tabsContainer) {
            tabsContainer.addEventListener('click', function (e) {
                var btn = e.target.closest('.tabs__btn');
                if (!btn) return;
                tabsContainer.querySelectorAll('.tabs__btn').forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                currentType = btn.getAttribute('data-tab');
                applyFilters();
            });
        }

        /* Select classe */
        var classeSelect = document.getElementById('builds-filter-classe');
        if (classeSelect) {
            classeSelect.addEventListener('change', function () {
                currentClasse = this.value;
                applyFilters();
            });
        }

        /* Select tri */
        var sortSelect = document.getElementById('builds-filter-sort');
        if (sortSelect) {
            sortSelect.addEventListener('change', function () {
                currentSort = this.value;
                applyFilters();
            });
        }

        /* Barre de recherche */
        var searchInput = document.getElementById('builds-search');
        if (searchInput) {
            searchInput.addEventListener('input', function () {
                applyFilters();
            });
        }
    }

    /* === APPLY ALL FILTERS + SORT === */
    function applyFilters() {
        var searchInput = document.getElementById('builds-search');
        var query = searchInput ? searchInput.value.toLowerCase().trim() : '';

        var filtered = allBuilds.filter(function (b) {
            /* Filtre type */
            if (currentType !== 'tous') {
                if ((b.type_build || '').toLowerCase() !== currentType) return false;
            }

            /* Filtre classe */
            if (currentClasse) {
                if ((b.classe || '') !== currentClasse) return false;
            }

            /* Filtre recherche texte */
            if (query) {
                var titre = (b.titre || '').toLowerCase();
                var desc = (b.description || '').toLowerCase();
                var type = (b.type_build || '').toLowerCase();
                var classe = (b.classe || '').toLowerCase();
                if (titre.indexOf(query) === -1 && desc.indexOf(query) === -1 && type.indexOf(query) === -1 && classe.indexOf(query) === -1) return false;
            }

            return true;
        });

        /* Tri */
        switch (currentSort) {
            case 'prix-asc':
                filtered.sort(function (a, b) {
                    return (a.valeur_kamas || 0) - (b.valeur_kamas || 0);
                });
                break;
            case 'prix-desc':
                filtered.sort(function (a, b) {
                    return (b.valeur_kamas || 0) - (a.valeur_kamas || 0);
                });
                break;
            default: /* recent - deja trie par created_at desc depuis Supabase */
                break;
        }

        renderBuilds(filtered);
    }

    /* === LOAD === */
    async function loadBuilds() {
        var grid = document.getElementById('builds-grid');
        if (!grid) return;

        try {
            var { data, error } = await window.REN.supabase
                .from('builds')
                .select('*, auteur:profiles!auteur_id(username)')
                .order('created_at', { ascending: false });

            /* Fallback si la migration 029 (colonne auteur_id) n'est pas passée */
            if (error) {
                var retry = await window.REN.supabase
                    .from('builds')
                    .select('*')
                    .order('created_at', { ascending: false });
                if (retry.error) throw retry.error;
                data = retry.data;
            }

            allBuilds = data || [];
            renderBuilds(allBuilds);
        } catch (err) {
            console.error('[REN] Erreur builds:', err);
            grid.innerHTML = '<p class="text-muted" style="padding:1rem;">Erreur de chargement.</p>';
        }
    }

    /* === RENDER === */
    function renderBuilds(builds) {
        var grid = document.getElementById('builds-grid');
        if (!grid) return;

        if (!builds || !builds.length) {
            grid.innerHTML = '<p class="text-muted" style="padding:1rem;">Aucun build trouve. Sois le premier à en proposer un !</p>';
            return;
        }

        var esc = window.REN.escapeHtml;
        var sane = window.REN.sanitizeUrl || function (u) { return u; };
        var me = window.REN.currentProfile || {};

        var html = '';
        builds.forEach(function (b) {
            var canManage = me.is_admin || (b.auteur_id && b.auteur_id === me.id);
            html += '<div class="build-card">';
            if (canManage) {
                html += '<button class="build-card__delete" data-id="' + b.id + '" title="Supprimer ce build">&times;</button>';
            }
            if (b.image_url) {
                html += '<div class="build-card__image">';
                html += '<img src="' + esc(sane(b.image_url)) + '" alt="' + esc(b.titre) + '" loading="lazy">';
                html += '</div>';
            }
            html += '<div class="build-card__body">';
            /* Badges type + classe + kamas */
            if (b.type_build || b.classe || b.valeur_kamas) {
                html += '<div class="build-card__meta">';
                var badgesHtml = '';
                if (b.type_build === 'pvp' || b.type_build === 'pvm') {
                    badgesHtml += '<span class="badge badge--' + b.type_build + '">' + b.type_build.toUpperCase() + '</span>';
                }
                if (b.classe) {
                    badgesHtml += '<span class="badge badge--classe">' + esc(b.classe) + '</span>';
                }
                html += '<div style="display:flex;gap:var(--spacing-xs);align-items:center;">' + badgesHtml + '</div>';
                if (b.valeur_kamas) {
                    html += '<span class="build-card__kamas"><span class="build-card__kamas-label">Estimation de prix :</span> ' + Number(b.valeur_kamas).toLocaleString('fr-FR') + ' M</span>';
                }
                html += '</div>';
            }
            html += '<div class="build-card__title">' + esc(b.titre) + '</div>';
            if (b.description) {
                html += '<div class="build-card__desc">' + esc(b.description) + '</div>';
            }
            if (b.lien_dofusbook) {
                html += '<a class="build-card__link" href="' + esc(sane(b.lien_dofusbook)) + '" target="_blank" rel="noopener noreferrer">';
                html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
                html += ' Voir sur Dofusbook';
                html += '</a>';
            }
            if (b.auteur && b.auteur.username) {
                html += '<div class="build-card__author notranslate">par ' + esc(b.auteur.username) + '</div>';
            }
            html += '</div>';
            html += '</div>';
        });

        grid.innerHTML = html;

        /* Click sur image -> lightbox */
        grid.querySelectorAll('.build-card__image img').forEach(function (img) {
            img.addEventListener('click', function () {
                openLightbox(img.src, img.alt || '');
            });
        });

        /* Suppression (auteur ou admin) */
        grid.querySelectorAll('.build-card__delete').forEach(function (btn) {
            btn.addEventListener('click', function () {
                deleteBuild(parseInt(btn.getAttribute('data-id'), 10));
            });
        });
    }

    /* === SUPPRESSION (auteur du build ou admin) === */
    async function deleteBuild(id) {
        var b = null;
        for (var i = 0; i < allBuilds.length; i++) {
            if (allBuilds[i].id === id) { b = allBuilds[i]; break; }
        }
        if (!b) return;
        if (!confirm('Supprimer le build "' + b.titre + '" ?')) return;

        try {
            var { error } = await window.REN.supabase.from('builds').delete().eq('id', id);
            if (error) throw error;

            /* Best effort : retirer aussi l'image du storage */
            if (b.image_url && b.image_url.indexOf('/builds/') !== -1) {
                var path = decodeURIComponent(b.image_url.split('/builds/').pop().split('?')[0]);
                window.REN.supabase.storage.from('builds').remove([path]);
            }

            allBuilds = allBuilds.filter(function (x) { return x.id !== id; });
            applyFilters();
            window.REN.toast('Build supprimé.', 'success');
        } catch (err) {
            console.error('[REN] Erreur suppression build:', err);
            window.REN.toast('Erreur : ' + (err.message || ''), 'error');
        }
    }

    /* === PROPOSER UN BUILD (membres validés) === */
    var bsFile = null;

    function bsCompress(file) {
        return new Promise(function (resolve) {
            var url = URL.createObjectURL(file);
            var img = new Image();
            img.onload = function () {
                try {
                    var MAX_W = 1600;
                    var scale = img.width > MAX_W ? MAX_W / img.width : 1;
                    var canvas = document.createElement('canvas');
                    canvas.width = Math.round(img.width * scale);
                    canvas.height = Math.round(img.height * scale);
                    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                    URL.revokeObjectURL(url);
                    canvas.toBlob(function (blob) { resolve(blob || file); }, 'image/jpeg', 0.85);
                } catch (e) {
                    URL.revokeObjectURL(url);
                    resolve(file);
                }
            };
            img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
            img.src = url;
        });
    }

    function bsSetFile(file) {
        if (!file || file.type.indexOf('image/') !== 0) return;
        bsFile = file;
        var reader = new FileReader();
        reader.onload = function (e) {
            document.getElementById('bs-preview').src = e.target.result;
            document.getElementById('bs-preview-wrap').style.display = 'block';
            document.getElementById('bs-drop').style.display = 'none';
        };
        reader.readAsDataURL(file);
    }

    function bsResetFile() {
        bsFile = null;
        document.getElementById('bs-preview').src = '';
        document.getElementById('bs-preview-wrap').style.display = 'none';
        document.getElementById('bs-drop').style.display = '';
        document.getElementById('bs-file').value = '';
    }

    function setupSubmitForm() {
        var panel = document.getElementById('build-submit-panel');
        var btnOpen = document.getElementById('btn-build-proposer');
        if (!panel || !btnOpen) return;

        btnOpen.addEventListener('click', function () {
            panel.hidden = !panel.hidden;
            if (!panel.hidden) document.getElementById('bs-titre').focus();
        });
        document.getElementById('bs-annuler').addEventListener('click', function () {
            panel.hidden = true;
        });

        var drop = document.getElementById('bs-drop');
        var fileInput = document.getElementById('bs-file');
        drop.addEventListener('click', function () { fileInput.click(); });
        fileInput.addEventListener('change', function () {
            if (fileInput.files && fileInput.files[0]) bsSetFile(fileInput.files[0]);
        });
        document.getElementById('bs-remove').addEventListener('click', bsResetFile);

        /* Coller une image quand le formulaire est ouvert */
        document.addEventListener('paste', function (e) {
            if (panel.hidden) return;
            var items = (e.clipboardData || window.clipboardData).items;
            if (!items) return;
            for (var i = 0; i < items.length; i++) {
                if (items[i].type && items[i].type.indexOf('image') === 0) {
                    var f = items[i].getAsFile();
                    if (f) { bsSetFile(f); e.preventDefault(); }
                    break;
                }
            }
        });

        document.getElementById('bs-publier').addEventListener('click', async function () {
            var btn = this;
            var titre = document.getElementById('bs-titre').value.trim();
            if (!titre) {
                window.REN.toast('Donne un titre à ton build.', 'error');
                return;
            }
            var lien = document.getElementById('bs-lien').value.trim();
            if (lien && !/^https?:\/\//i.test(lien)) {
                window.REN.toast('Le lien Dofusbook doit commencer par http(s)://', 'error');
                return;
            }

            btn.disabled = true;
            btn.textContent = 'Publication…';
            try {
                var imageUrl = '';
                if (bsFile) {
                    var blob = await bsCompress(bsFile);
                    var path = window.REN.currentProfile.id + '-' + Date.now() + '.jpg';
                    var up = await window.REN.supabase.storage
                        .from('builds')
                        .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
                    if (up.error) throw up.error;
                    imageUrl = window.REN.supabase.storage.from('builds').getPublicUrl(path).data.publicUrl;
                }

                var kamas = parseInt(document.getElementById('bs-kamas').value, 10) || 0;
                var ins = await window.REN.supabase.from('builds').insert({
                    titre: titre,
                    description: document.getElementById('bs-desc').value.trim(),
                    lien_dofusbook: lien,
                    image_url: imageUrl,
                    type_build: document.getElementById('bs-type').value || '',
                    classe: document.getElementById('bs-classe').value || '',
                    valeur_kamas: kamas,
                    auteur_id: window.REN.currentProfile.id
                });
                if (ins.error) throw ins.error;

                window.REN.toast('Build publié, merci !', 'success');
                panel.hidden = true;
                document.getElementById('bs-titre').value = '';
                document.getElementById('bs-desc').value = '';
                document.getElementById('bs-lien').value = '';
                document.getElementById('bs-kamas').value = '';
                document.getElementById('bs-type').value = '';
                document.getElementById('bs-classe').value = '';
                bsResetFile();
                await loadBuilds();
            } catch (err) {
                console.error('[REN] Erreur publication build:', err);
                var hint = (err.message || '').indexOf('row-level security') !== -1
                    ? 'Droits insuffisants : la migration sql/029 est-elle passée ?'
                    : (err.message || '');
                window.REN.toast('Publication échouée : ' + hint, 'error');
            }
            btn.disabled = false;
            btn.textContent = 'Publier';
        });
    }

    /* === LIGHTBOX (agrandissement image build) === */
    function openLightbox(src, alt) {
        /* Cleanup au cas où */
        var existing = document.getElementById('build-lightbox');
        if (existing) existing.remove();

        var div = document.createElement('div');
        div.id = 'build-lightbox';
        div.className = 'build-lightbox';
        div.innerHTML = '<div class="build-lightbox__inner">'
            + '<button class="build-lightbox__close" type="button" aria-label="Fermer">'
                + '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
            + '</button>'
            + '<img src="' + src + '" alt="' + (window.REN.escapeHtml(alt) || '') + '">'
            + '</div>';
        document.body.appendChild(div);
        document.body.style.overflow = 'hidden';

        function close() {
            div.classList.remove('build-lightbox--visible');
            document.body.style.overflow = '';
            setTimeout(function () { if (div.parentNode) div.remove(); }, 200);
            document.removeEventListener('keydown', onEsc);
        }
        function onEsc(e) { if (e.key === 'Escape') close(); }

        div.addEventListener('click', function (e) {
            if (e.target === div || e.target.closest('.build-lightbox__close')) close();
        });
        document.addEventListener('keydown', onEsc);

        /* Trigger fade-in */
        requestAnimationFrame(function () {
            div.classList.add('build-lightbox--visible');
        });
    }
})();
