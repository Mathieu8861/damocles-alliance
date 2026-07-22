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
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

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
            grid.innerHTML = '<p class="text-muted" style="padding:1rem;">Aucun build trouve.</p>';
            return;
        }

        var html = '';
        builds.forEach(function (b) {
            html += '<div class="build-card">';
            if (b.image_url) {
                html += '<div class="build-card__image">';
                html += '<img src="' + b.image_url + '" alt="' + b.titre + '" loading="lazy">';
                html += '</div>';
            }
            html += '<div class="build-card__body">';
            /* Badges type + classe + kamas */
            if (b.type_build || b.classe || b.valeur_kamas) {
                html += '<div class="build-card__meta">';
                var badgesHtml = '';
                if (b.type_build) {
                    badgesHtml += '<span class="badge badge--' + b.type_build + '">' + b.type_build.toUpperCase() + '</span>';
                }
                if (b.classe) {
                    badgesHtml += '<span class="badge badge--classe">' + b.classe + '</span>';
                }
                html += '<div style="display:flex;gap:var(--spacing-xs);align-items:center;">' + badgesHtml + '</div>';
                if (b.valeur_kamas) {
                    html += '<span class="build-card__kamas"><span class="build-card__kamas-label">Estimation de prix :</span> ' + Number(b.valeur_kamas).toLocaleString('fr-FR') + ' M</span>';
                }
                html += '</div>';
            }
            html += '<div class="build-card__title">' + b.titre + '</div>';
            if (b.description) {
                html += '<div class="build-card__desc">' + b.description + '</div>';
            }
            if (b.lien_dofusbook) {
                html += '<a class="build-card__link" href="' + b.lien_dofusbook + '" target="_blank" rel="noopener noreferrer">';
                html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
                html += ' Voir sur Dofusbook';
                html += '</a>';
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
