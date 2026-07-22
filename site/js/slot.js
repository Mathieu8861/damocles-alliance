/* ============================================ */
/* Damoclès     - Machine a Sous 2D            */
/* Theme : Dieu Enutrof                        */
/* Symboles depuis DB + GSAP animations        */
/* ============================================ */
(function () {
    'use strict';

    console.log('[REN-SLOT] Module charge');

    var MISES = [5, 10, 25, 50, 100];
    var miseIndex = 0;
    var isSpinning = false;

    /* Symboles charges depuis Supabase */
    var symboles = [];      /* [{ nom, image_url, poids, gain_triple, gain_paire }] */
    var symboleMap = {};     /* nom -> { image_url, ... } */

    var SYMBOL_HEIGHT = 140; /* matches CSS .slotm__reel-symbol height */
    var STRIP_COPIES = 8;    /* repetitions pour scroll fluide */

    document.addEventListener('ren:ready', init);

    async function init() {
        console.log('[REN-SLOT] init()');
        if (!window.REN.supabase || !window.REN.currentProfile) return;

        await loadSymboles();
        if (symboles.length === 0) {
            console.warn('[REN-SLOT] Aucun symbole configure');
            return;
        }

        updateSoldeDisplay();
        updateMiseDisplay();
        setupControls();
        setupRulesModal();
        buildReelStrips();
        loadHistory();
    }

    /* ============================================ */
    /* LOAD SYMBOLES FROM DB                        */
    /* ============================================ */
    async function loadSymboles() {
        try {
            var { data, error } = await window.REN.supabase
                .from('slot_symboles')
                .select('*')
                .eq('actif', true)
                .order('ordre', { ascending: true });
            if (error) throw error;
            symboles = data || [];
            symboleMap = {};
            symboles.forEach(function (s) {
                symboleMap[s.nom] = s;
            });
            console.log('[REN-SLOT] Symboles charges:', symboles.length);
        } catch (err) {
            console.error('[REN-SLOT] Erreur chargement symboles:', err);
            /* Fallback */
            symboles = [
                { nom: 'enutrof', image_url: 'assets/images/Dieu_enutrof.webp' },
                { nom: 'kamas', image_url: 'assets/images/pile_de_kamas.png' },
                { nom: 'pelle', image_url: 'assets/images/jeton.png' },
                { nom: 'coffre', image_url: 'assets/images/pepite.png' },
                { nom: 'pepite', image_url: 'assets/images/pepite.png' },
                { nom: 'jeton', image_url: 'assets/images/jeton.png' }
            ];
            symboles.forEach(function (s) { symboleMap[s.nom] = s; });
        }
    }

    function getSymImage(nom) {
        var s = symboleMap[nom];
        if (s && s.image_url) return s.image_url;
        return 'assets/images/jeton.png';
    }

    /* ============================================ */
    /* BUILD REEL STRIPS                            */
    /* ============================================ */
    function buildReelStrips() {
        for (var r = 0; r < 3; r++) {
            var reel = document.getElementById('reel-' + r);
            if (!reel) continue;
            reel.innerHTML = '';

            for (var c = 0; c < STRIP_COPIES; c++) {
                for (var s = 0; s < symboles.length; s++) {
                    var div = document.createElement('div');
                    div.className = 'slotm__reel-symbol';
                    div.setAttribute('data-symbol', symboles[s].nom);
                    var img = document.createElement('img');
                    img.src = getSymImage(symboles[s].nom);
                    img.alt = symboles[s].nom;
                    div.appendChild(img);
                    reel.appendChild(div);
                }
            }

            /* Position initiale aleatoire */
            var startIndex = Math.floor(Math.random() * symboles.length);
            reel.style.transform = 'translateY(-' + (startIndex * SYMBOL_HEIGHT) + 'px)';
        }
    }

    /* ============================================ */
    /* SPIN                                         */
    /* ============================================ */
    async function doSpin() {
        if (isSpinning) return;

        var mise = MISES[miseIndex];
        var jetons = window.REN.currentProfile.jetons || 0;

        if (jetons < mise) {
            window.REN.toast('Pas assez de jetons classiques ! (' + jetons + '/' + mise + ')', 'error');
            return;
        }

        isSpinning = true;
        var spinBtn = document.getElementById('btn-spin');
        if (spinBtn) spinBtn.classList.add('spinning');

        /* Hide previous result */
        var resultEl = document.getElementById('slot-result');
        if (resultEl) resultEl.style.display = 'none';

        /* Pull lever animation */
        var lever = document.getElementById('slot-lever');
        if (lever) {
            lever.classList.add('pulled');
            setTimeout(function () { lever.classList.remove('pulled'); }, 800);
        }

        /* Small delay for lever animation before spin starts */
        await sleep(300);

        /* RPC call */
        var spinResult;
        try {
            var resp = await window.REN.supabase.rpc('jouer_slot', { p_mise: mise });
            if (resp.error) throw resp.error;
            spinResult = resp.data;
        } catch (err) {
            console.error('[REN-SLOT] Erreur RPC:', err);
            window.REN.toast('Erreur : ' + (err.message || 'Impossible de jouer'), 'error');
            isSpinning = false;
            if (spinBtn) spinBtn.classList.remove('spinning');
            return;
        }

        /* Update both balances */
        window.REN.currentProfile.jetons = spinResult.nouveau_solde;
        window.REN.currentProfile.jetons_slot = spinResult.nouveau_solde_enutrosor;
        updateSoldeDisplay();

        /* Animate reels with suspense */
        await animateReels(spinResult.symboles);

        /* Show result */
        showResult(spinResult);
        addHistoryItem(spinResult, mise);

        /* Win effects */
        if (spinResult.multiplicateur >= 10) {
            showJackpotModal(spinResult);
            launchConfetti();
        } else if (spinResult.multiplicateur > 0) {
            flashMachine();
        }

        isSpinning = false;
        if (spinBtn) spinBtn.classList.remove('spinning');
    }

    /* ============================================ */
    /* REEL ANIMATION - Casino style                */
    /* Rouleau 1 s'arrete en premier, puis 2, puis 3 */
    /* Chaque rouleau ralentit progressivement      */
    /* ============================================ */
    function animateReels(targetSymbols) {
        return new Promise(function (resolve) {
            var numSymboles = symboles.length;

            targetSymbols.forEach(function (targetSym, ri) {
                var reel = document.getElementById('reel-' + ri);
                if (!reel) return;

                var targetIndex = symboles.findIndex(function (s) { return s.nom === targetSym; });
                if (targetIndex === -1) targetIndex = 0;

                /* Reset position */
                gsap.set(reel, { y: 0 });

                /* More spins for each subsequent reel = more suspense */
                var baseCycles = 3;
                var extraCycles = ri * 2;         /* reel 0: +0, reel 1: +2, reel 2: +4 */
                var totalCycles = baseCycles + extraCycles;
                var targetPos = (totalCycles * numSymboles + targetIndex) * SYMBOL_HEIGHT;

                /* Timing : chaque rouleau tourne plus longtemps */
                var duration = 1.5 + ri * 1.0;   /* 1.5s, 2.5s, 3.5s */
                var delay = ri * 0.15;            /* leger decalage au demarrage */

                /* Phase 1 : demarrage rapide (30% du temps) */
                /* Phase 2 : vitesse constante (40% du temps) */
                /* Phase 3 : ralentissement dramatique (30% du temps) */
                gsap.to(reel, {
                    y: -targetPos,
                    duration: duration,
                    delay: delay,
                    ease: 'power4.out',  /* ralentissement tres prononce sur la fin */
                    onComplete: function () {
                        /* Flash sur le symbole qui vient de s'arreter */
                        if (spinResult_multiplicateur > 0) {
                            flashReelWindow(ri);
                        }
                    }
                });
            });

            /* Variable pour savoir si c'est un gain (capturee dans closure) */
            var spinResult_multiplicateur = 0;
            /* On ne peut pas acceder au resultat ici, on flash dans tous les cas pour le dernier */

            /* Resolve quand le dernier rouleau a fini */
            var lastDuration = 1.5 + 2 * 1.0 + 0.15 * 2;  /* ~3.8s */
            setTimeout(resolve, lastDuration * 1000 + 400);
        });
    }

    function flashReelWindow(reelIndex) {
        var windows = document.querySelectorAll('.slotm__reel-window');
        if (windows[reelIndex]) {
            gsap.fromTo(windows[reelIndex], {
                boxShadow: '0 0 20px rgba(255, 215, 0, 0.8), inset 0 0 10px rgba(255, 215, 0, 0.3)'
            }, {
                boxShadow: 'inset 0 4px 10px rgba(0, 0, 0, 0.12), inset 0 -4px 10px rgba(0, 0, 0, 0.08)',
                duration: 0.8,
                delay: 0.2
            });
        }
    }

    /* ============================================ */
    /* EFFECTS                                      */
    /* ============================================ */
    function flashMachine() {
        var body = document.querySelector('.slotm__body');
        if (!body) return;
        gsap.fromTo(body, {
            boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 80px rgba(255, 215, 0, 0.5)'
        }, {
            boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 80px rgba(212, 160, 23, 0.15)',
            duration: 0.4,
            repeat: 3,
            yoyo: true
        });
    }

    function showResult(result) {
        var resultEl = document.getElementById('slot-result');
        var gainEl = document.getElementById('slot-result-gain');
        if (!resultEl || !gainEl) return;

        if (result.gain > 0) {
            var cls = result.multiplicateur >= 10 ? 'slot-result__gain--jackpot' : 'slot-result__gain--win';
            gainEl.className = 'slot-result__gain ' + cls;
            gainEl.textContent = '+' + result.gain + ' jetons (x' + result.multiplicateur + ')';
        } else {
            gainEl.className = 'slot-result__gain slot-result__gain--lose';
            gainEl.textContent = 'Pas de gain';
        }
        resultEl.style.display = 'block';
    }

    /* ============================================ */
    /* JACKPOT MODAL                                */
    /* ============================================ */
    function showJackpotModal(result) {
        var overlay = document.getElementById('modal-jackpot');
        var title = document.getElementById('jackpot-title');
        var body = document.getElementById('jackpot-body');
        if (!overlay || !body) return;

        if (title) title.textContent = result.multiplicateur >= 50 ? 'JACKPOT !!!' : 'GROS GAIN !';

        var html = '<div class="jackpot-symbols">';
        result.symboles.forEach(function (s) {
            html += '<img src="' + getSymImage(s) + '" alt="' + s + '">';
        });
        html += '</div>';
        html += '<div class="jackpot-amount">+' + result.gain + ' jetons</div>';
        html += '<p class="text-muted">Multiplicateur x' + result.multiplicateur + '</p>';
        body.innerHTML = html;
        overlay.classList.add('active');

        setTimeout(function () { overlay.classList.remove('active'); }, 5000);
        var closeBtn = document.getElementById('jackpot-close');
        if (closeBtn) closeBtn.onclick = function () { overlay.classList.remove('active'); };
        overlay.onclick = function (e) { if (e.target === overlay) overlay.classList.remove('active'); };
    }

    /* ============================================ */
    /* CONFETTI                                     */
    /* ============================================ */
    function launchConfetti() {
        var container = document.getElementById('confetti-container');
        if (!container) return;
        var colors = ['#d4a017', '#ffd700', '#7d5ff7', '#9678ff', '#fff', '#f39c12'];
        for (var i = 0; i < 50; i++) {
            var c = document.createElement('div');
            c.className = 'confetti';
            c.style.left = Math.random() * 100 + '%';
            c.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            c.style.animationDelay = (Math.random() * 0.8) + 's';
            c.style.animationDuration = (2 + Math.random() * 1.5) + 's';
            c.style.width = (6 + Math.random() * 6) + 'px';
            c.style.height = (6 + Math.random() * 6) + 'px';
            container.appendChild(c);
        }
        setTimeout(function () { container.innerHTML = ''; }, 5000);
    }

    /* ============================================ */
    /* CONTROLS                                     */
    /* ============================================ */
    function setupRulesModal() {
        var btn = document.getElementById('btn-slot-rules');
        var overlay = document.getElementById('modal-slot-rules');
        var closeBtn = document.getElementById('rules-close');
        if (!btn || !overlay) return;

        btn.addEventListener('click', function () {
            /* Remplir la table des gains dynamiquement */
            var tableContainer = document.getElementById('slot-rules-table');
            if (tableContainer && symboles.length) {
                var sorted = symboles.slice().sort(function (a, b) { return (a.poids || 0) - (b.poids || 0); });
                var html = '<table class="slot-rules-table">';
                html += '<thead><tr><th>Symbole</th><th>Rarete</th><th>Triple (x3)</th><th>Paire (x2)</th></tr></thead><tbody>';
                var totalPoids = sorted.reduce(function (s, sym) { return s + (sym.poids || 0); }, 0);
                sorted.forEach(function (sym) {
                    var pct = totalPoids > 0 ? ((sym.poids / totalPoids) * 100).toFixed(1) : '?';
                    var imgTag = sym.image_url ? '<img src="' + sym.image_url + '"> ' : '';
                    html += '<tr>';
                    html += '<td>' + imgTag + '<strong>' + sym.nom + '</strong></td>';
                    html += '<td>' + pct + '%</td>';
                    html += '<td style="color:var(--color-warning);font-weight:700;">x' + (sym.gain_triple || 0) + '</td>';
                    html += '<td>' + (sym.gain_paire > 0 ? 'x' + sym.gain_paire : '-') + '</td>';
                    html += '</tr>';
                });
                html += '</tbody></table>';
                tableContainer.innerHTML = html;
            }

            /* RTP */
            var rtpEl = document.getElementById('slot-rules-rtp');
            if (rtpEl && symboles.length) {
                var total = symboles.reduce(function (s, sym) { return s + (sym.poids || 0); }, 0);
                var rtp = 0;
                symboles.forEach(function (sym) {
                    var p = (sym.poids || 0) / total;
                    rtp += Math.pow(p, 3) * (sym.gain_triple || 0);
                    rtp += 3 * Math.pow(p, 2) * (1 - p) * (sym.gain_paire || 0);
                });
                rtpEl.textContent = (rtp * 100).toFixed(1) + '%';
            }

            overlay.classList.add('active');
        });

        if (closeBtn) closeBtn.addEventListener('click', function () { overlay.classList.remove('active'); });
        overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.classList.remove('active'); });
    }

    function setupControls() {
        var spinBtn = document.getElementById('btn-spin');
        var lever = document.getElementById('slot-lever');
        var btnUp = document.getElementById('mise-up');
        var btnDown = document.getElementById('mise-down');
        if (spinBtn) spinBtn.addEventListener('click', doSpin);
        if (lever) lever.addEventListener('click', doSpin);
        if (btnUp) btnUp.addEventListener('click', function () { if (miseIndex < MISES.length - 1) { miseIndex++; updateMiseDisplay(); } });
        if (btnDown) btnDown.addEventListener('click', function () { if (miseIndex > 0) { miseIndex--; updateMiseDisplay(); } });

        /* Preview conversion kamatrix → jetons (ratio 75%) */
        var convertInput = document.getElementById('convert-amount');
        var convertPreview = document.getElementById('convert-preview');
        if (convertInput && convertPreview) {
            convertInput.addEventListener('input', function () {
                var val = parseInt(convertInput.value) || 0;
                convertPreview.textContent = Math.floor(val * 0.75);
            });
        }

        /* Bouton convertir */
        var btnConvert = document.getElementById('btn-convert-kamatrix');
        if (btnConvert) btnConvert.addEventListener('click', async function () {
            var amount = parseInt(convertInput ? convertInput.value : 0);
            if (!amount || amount < 1) { window.REN.toast('Minimum 1 Kamatrix', 'error'); return; }
            try {
                var resp = await window.REN.supabase.rpc('convertir_kamatrix', { p_montant_kamatrix: amount });
                if (resp.error) throw resp.error;
                window.REN.currentProfile.jetons = resp.data.jetons;
                window.REN.currentProfile.jetons_slot = resp.data.jetons_slot;
                updateSoldeDisplay();
                if (convertInput) convertInput.value = '';
                if (convertPreview) convertPreview.textContent = '0';
                window.REN.toast(resp.data.jetons_recus + ' jetons recus !', 'success');
            } catch (err) {
                window.REN.toast(err.message || 'Erreur conversion', 'error');
            }
        });
    }

    function updateMiseDisplay() {
        var el = document.getElementById('mise-value');
        if (el) el.textContent = MISES[miseIndex];
    }

    function updateSoldeDisplay() {
        var el = document.getElementById('slot-solde');
        if (el && window.REN.currentProfile) el.textContent = window.REN.currentProfile.jetons_slot || 0;
        var globalEl = document.getElementById('slot-jetons-global');
        if (globalEl && window.REN.currentProfile) globalEl.textContent = window.REN.currentProfile.jetons || 0;
    }

    /* ============================================ */
    /* HISTORY                                      */
    /* ============================================ */
    async function loadHistory() {
        var container = document.getElementById('slot-history-list');
        if (!container) return;
        try {
            var resp = await window.REN.supabase.from('slot_historique').select('*')
                .eq('joueur_id', window.REN.currentProfile.id)
                .order('created_at', { ascending: false }).limit(20);
            if (resp.error) throw resp.error;
            if (!resp.data || !resp.data.length) return;
            container.innerHTML = '';
            resp.data.forEach(function (item) { container.innerHTML += buildHistoryHtml(item); });
        } catch (err) {
            console.error('[REN-SLOT] Erreur historique:', err);
        }
    }

    function addHistoryItem(result, mise) {
        var container = document.getElementById('slot-history-list');
        if (!container) return;
        var placeholder = container.querySelector('.text-muted');
        if (placeholder) container.innerHTML = '';
        var item = { resultat: result.symboles, gain_jetons: result.gain, mise: mise, created_at: new Date().toISOString() };
        container.insertAdjacentHTML('afterbegin', buildHistoryHtml(item));
        var items = container.querySelectorAll('.slot-history-item');
        if (items.length > 20) items[items.length - 1].remove();
    }

    function buildHistoryHtml(item) {
        var t = new Date(item.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        var syms = item.resultat || [];
        var gain = item.gain_jetons || 0;
        var h = '<div class="slot-history-item"><div class="slot-history-item__left">';
        h += '<span class="slot-history-item__time">' + t + '</span>';
        h += '<span class="slot-history-item__symbols">';
        syms.forEach(function (s) { h += '<img src="' + getSymImage(s) + '" alt="' + s + '">'; });
        h += '</span></div>';
        h += gain > 0
            ? '<span class="slot-history-item__gain slot-history-item__gain--win">+' + gain + '</span>'
            : '<span class="slot-history-item__gain slot-history-item__gain--lose">-' + (item.mise || 0) + '</span>';
        h += '</div>';
        return h;
    }

    /* ============================================ */
    /* UTILS                                        */
    /* ============================================ */
    function sleep(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }
})();
