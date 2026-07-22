/* ============================================ */
/* Damoclès     - Jeu de Cartes                */
/* Tirage avec jetons, lots configurables      */
/* Flow : bouton -> melange -> choix -> reveal */
/*        -> quitte ou double (si gain)        */
/* ============================================ */
(function () {
    'use strict';

    console.log('[REN-JEU] Module charge');

    var prixTirage = 12;
    var lots = [];
    var isDrawing = false;
    var awaitingChoice = false;
    var selectedLot = null;

    document.addEventListener('ren:ready', init);

    async function init() {
        console.log('[REN-JEU] init() appele', {
            supabase: !!window.REN.supabase,
            profile: !!window.REN.currentProfile
        });
        if (!window.REN.supabase || !window.REN.currentProfile) {
            console.warn('[REN-JEU] init() annule : supabase ou profile manquant');
            return;
        }
        await Promise.all([loadConfig(), loadLots(), loadJetonsRanking()]);
        updateJetonsDisplay();
        setupDraw();
        setupCardClicks();
        setupResultModal();
        console.log('[REN-JEU] init() termine, lots:', lots.length, 'jetons:', window.REN.currentProfile.jetons);
    }

    /* === LOAD CONFIG === */
    async function loadConfig() {
        try {
            var { data } = await window.REN.supabase.from('jeu_config').select('*').single();
            if (data) prixTirage = data.prix_tirage;
            var priceEl = document.getElementById('prix-tirage');
            if (priceEl) priceEl.textContent = prixTirage;
        } catch (err) {
            console.error('[REN] Erreur config jeu:', err);
        }
    }

    /* === LOAD LOTS (pas d'affichage cote joueur) === */
    async function loadLots() {
        try {
            var { data } = await window.REN.supabase.from('jeu_lots').select('*').order('pourcentage', { ascending: false });
            lots = data || [];
        } catch (err) {
            console.error('[REN] Erreur lots:', err);
        }
    }

    /* === LOAD JETONS RANKING === */
    async function loadJetonsRanking() {
        var container = document.getElementById('jetons-ranking');
        if (!container) return;

        try {
            var { data, error } = await window.REN.supabase.from('classement_jetons').select('id, username, jetons, tirages, pepites');

            if (error) {
                console.error('[REN] Erreur classement jetons:', error);
            }

            data = data || [];

            if (!data.length) {
                container.innerHTML = '<p class="text-muted text-center">Aucun joueur.</p>';
                return;
            }

            var html = '<div class="ranking-list">';
            data.forEach(function (player, i) {
                var rank = i + 1;
                var medalClass = '';
                var medal = '';
                if (rank === 1) { medalClass = ' ranking-item--gold'; medal = '<span class="ranking-item__medal">&#x1F947;</span>'; }
                else if (rank === 2) { medalClass = ' ranking-item--silver'; medal = '<span class="ranking-item__medal">&#x1F948;</span>'; }
                else if (rank === 3) { medalClass = ' ranking-item--bronze'; medal = '<span class="ranking-item__medal">&#x1F949;</span>'; }

                var tirages = player.tirages || 0;
                var pepites = player.pepites || 0;

                html += '<div class="ranking-item' + medalClass + '">';
                html += '<div class="ranking-item__left">';
                html += '<span class="ranking-item__rank">' + (medal || rank + '.') + '</span>';
                html += '<span class="ranking-item__name">' + player.username + '</span>';
                html += '</div>';
                html += '<div class="ranking-item__right">';
                html += '<span class="ranking-item__value" style="color:var(--color-warning);">' + (player.jetons || 0) + ' jetons <img class="icon-inline" src="assets/images/jeton.png" alt=""></span>';
                if (tirages > 0) {
                    html += '<span class="ranking-item__sub">' + tirages + ' tirage' + (tirages > 1 ? 's' : '') + ' · +' + pepites + ' <img class="icon-inline" src="assets/images/pepite.png" alt=""></span>';
                }
                html += '</div>';
                html += '</div>';
            });
            html += '</div>';
            container.innerHTML = html;
        } catch (err) {
            console.error('[REN] Erreur classement jetons:', err);
            container.innerHTML = '<p class="text-muted text-center">Erreur de chargement.</p>';
        }
    }

    /* === JETONS DISPLAY === */
    function updateJetonsDisplay() {
        var el = document.getElementById('jetons-count');
        if (el && window.REN.currentProfile) {
            el.textContent = window.REN.currentProfile.jetons || 0;
        }
    }

    function setInstruction(text) {
        var el = document.getElementById('game-instruction');
        if (el) el.textContent = text;
    }

    /* === DRAW : Bouton "Tenter sa chance" === */
    function setupDraw() {
        var btn = document.getElementById('btn-tirer');
        if (!btn) return;

        btn.addEventListener('click', async function () {
            console.log('[REN-JEU] Bouton clique', {
                isDrawing: isDrawing,
                awaitingChoice: awaitingChoice,
                jetons: window.REN.currentProfile ? window.REN.currentProfile.jetons : 'N/A',
                prixTirage: prixTirage,
                lotsCount: lots.length
            });
            if (isDrawing || awaitingChoice) return;

            var jetonsActuels = window.REN.currentProfile.jetons || 0;
            if (jetonsActuels < prixTirage) {
                window.REN.toast('Pas assez de jetons ! (' + jetonsActuels + '/' + prixTirage + ')', 'error');
                return;
            }

            if (!lots.length) {
                window.REN.toast('Aucun lot configure.', 'error');
                return;
            }

            isDrawing = true;
            btn.disabled = true;

            /* Deduire les jetons IMMEDIATEMENT (anti-exploit refresh) */
            try {
                var newJetonsAfterPay = jetonsActuels - prixTirage;
                await window.REN.supabase.from('profiles').update({ jetons: newJetonsAfterPay }).eq('id', window.REN.currentProfile.id);
                window.REN.currentProfile.jetons = newJetonsAfterPay;
                updateJetonsDisplay();
            } catch (err) {
                console.error('[REN-JEU] Erreur deduction jetons:', err);
                window.REN.toast('Erreur, réessayez.', 'error');
                isDrawing = false;
                btn.disabled = false;
                return;
            }

            /* Determiner le lot AVANT le melange (le joueur ne le sait pas) */
            selectedLot = drawRandomLot();

            var cards = document.querySelectorAll('.game-card');
            var cardsContainer = document.getElementById('game-cards');

            /* Reset des cartes */
            cards.forEach(function (card) {
                card.classList.remove('flipped', 'selected', 'glow-win', 'glow-lose', 'clickable');
                var lotName = card.querySelector('.lot-name');
                if (lotName) lotName.textContent = '?';
            });

            setInstruction('Mélange en cours...');

            /* === ANIMATION DE MELANGE REALISTE === */
            if (cardsContainer) cardsContainer.classList.add('shuffling-active');

            await doShuffleAnimation(cards);

            if (cardsContainer) cardsContainer.classList.remove('shuffling-active');

            /* === ATTENTE DU CHOIX DU JOUEUR === */
            setInstruction('Choisissez une carte !');
            awaitingChoice = true;
            cards.forEach(function (card) { card.classList.add('clickable'); });
        });
    }

    /* === ANIMATION MELANGE : cartes qui se croisent === */
    async function doShuffleAnimation(cards) {
        var positions = [0, 1, 2]; /* index des cartes */
        var cardArray = Array.from(cards);

        /* 6 mouvements de melange */
        for (var round = 0; round < 6; round++) {
            /* Choisir 2 cartes a echanger */
            var a = Math.floor(Math.random() * 3);
            var b = (a + 1 + Math.floor(Math.random() * 2)) % 3;

            /* Calculer le decalage : carte a va a position b et inversement */
            var offsetA = (positions[b] - positions[a]) * 90; /* mouvement reduit */
            var offsetB = (positions[a] - positions[b]) * 90;

            /* Mouvement vers le haut/bas pour croiser */
            var liftA = -30;
            var liftB = 30;

            /* Appliquer les transforms */
            cardArray[a].style.transform = 'translateX(' + offsetA + 'px) translateY(' + liftA + 'px)';
            cardArray[a].style.zIndex = '2';
            cardArray[b].style.transform = 'translateX(' + offsetB + 'px) translateY(' + liftB + 'px)';
            cardArray[b].style.zIndex = '1';

            await sleep(350);

            /* Echanger les positions dans le tracking */
            var temp = positions[a];
            positions[a] = positions[b];
            positions[b] = temp;
        }

        /* Remettre a plat (les cartes ont "change de place" visuellement) */
        cardArray.forEach(function (card) {
            card.style.transition = 'transform 0.3s ease';
            card.style.transform = '';
            card.style.zIndex = '';
        });

        await sleep(300);

        /* Nettoyer les styles inline */
        cardArray.forEach(function (card) {
            card.style.transition = '';
        });
    }

    /* === CHOIX DU JOUEUR : clic sur une carte === */
    function setupCardClicks() {
        var cards = document.querySelectorAll('.game-card');

        cards.forEach(function (card) {
            card.addEventListener('click', async function () {
                console.log('[REN-JEU] Carte cliquee', { awaitingChoice: awaitingChoice, selectedLot: selectedLot });
                if (!awaitingChoice) return;

                awaitingChoice = false;

                /* Retirer le mode clickable de toutes les cartes */
                cards.forEach(function (c) { c.classList.remove('clickable'); });

                setInstruction('');

                /* === REVEAL de la carte choisie === */
                var backText = card.querySelector('.lot-name');
                if (backText) backText.textContent = selectedLot.nom;

                card.classList.add('selected');
                await sleep(300);

                card.classList.remove('selected');
                card.classList.add('flipped');
                await sleep(600);

                /* Glow effect */
                var isRien = selectedLot.nom.toLowerCase().indexOf('rien') !== -1 && selectedLot.gain_jetons <= 0 && (selectedLot.gain_pepites || 0) <= 0;
                console.log('[REN-JEU] Lot tire:', selectedLot.nom, '| gain_jetons:', selectedLot.gain_jetons, '| isRien:', isRien);

                card.classList.add(isRien ? 'glow-lose' : 'glow-win');

                /* === TRAITEMENT DU RESULTAT === */
                var jetonsActuels = window.REN.currentProfile.jetons || 0;
                var gainJetons = selectedLot.gain_jetons || 0;

                if (isRien) {
                    /* "Rien" → pas de quitte ou double, finaliser direct */
                    await finalizeResult(jetonsActuels, 0, 'normal', false);
                } else {
                    /* Lot gagnant → proposer quitte ou double */
                    var choix = await showQuitteOuDouble(selectedLot, gainJetons);

                    if (choix === 'garder') {
                        await finalizeResult(jetonsActuels, gainJetons, 'normal', false);
                    } else {
                        /* Quitte ou double : 50/50 */
                        await doDoubleAnimation();
                        var doubleWin = Math.random() < 0.5;

                        if (doubleWin) {
                            /* Double ! */
                            await showDoubleResult(true, selectedLot, gainJetons * 2);
                            await finalizeResult(jetonsActuels, gainJetons * 2, 'double', true);
                        } else {
                            /* Perdu ! Perd le lot + les jetons du lot */
                            await showDoubleResult(false, selectedLot, 0);
                            await finalizeResult(jetonsActuels, 0, 'perdu', false);
                        }
                    }
                }

                /* Re-activer le bouton */
                setTimeout(function () {
                    isDrawing = false;
                    var btn = document.getElementById('btn-tirer');
                    if (btn) btn.disabled = false;
                    setInstruction('Cliquez sur "Tenter sa chance" pour mélanger les cartes');
                }, 1500);
            });
        });
    }

    /* === FINALISER : save DB + update affichage === */
    async function finalizeResult(jetonsActuels, gainFinal, resultat, showConfetti) {
        console.log('[REN-JEU] finalizeResult()', { jetonsActuels: jetonsActuels, gainFinal: gainFinal, resultat: resultat, showConfetti: showConfetti });
        try {
            /* Jetons deja deduits au clic du bouton ; ici on ajoute seulement les gains */
            if (gainFinal > 0) {
                var newJetons = window.REN.currentProfile.jetons + gainFinal;
                await window.REN.supabase.from('profiles').update({ jetons: newJetons }).eq('id', window.REN.currentProfile.id);
                window.REN.currentProfile.jetons = newJetons;
                updateJetonsDisplay();
            }

            await window.REN.supabase.from('jeu_historique').insert({
                user_id: window.REN.currentProfile.id,
                lot_id: selectedLot.id,
                resultat: resultat
            });

            if (showConfetti) launchConfetti();

            /* Refresh classement */
            loadJetonsRanking();

        } catch (err) {
            console.error('[REN] Erreur tirage:', err);
            window.REN.toast('Erreur lors du tirage.', 'error');
        }
    }

    /* === MODAL QUITTE OU DOUBLE === */
    function showQuitteOuDouble(lot, gainJetons) {
        return new Promise(function (resolve) {
            var overlay = document.getElementById('modal-result');
            var title = document.getElementById('result-title');
            var body = document.getElementById('result-body');
            if (!overlay || !body) { resolve('garder'); return; }

            if (title) title.textContent = 'Vous avez gagné !';

            var html = '';
            html += '<div class="result-icon">&#127881;</div>';
            html += '<div class="result-lot-name">' + lot.nom + '</div>';
            if (gainJetons > 0) {
                html += '<div class="result-gain">+' + gainJetons + ' jetons</div>';
            }
            if ((lot.gain_pepites || 0) > 0) {
                html += '<div class="result-gain" style="color:var(--color-warning);">+' + lot.gain_pepites + ' p\u00e9pites <img class="icon-inline" src="assets/images/pepite.png" alt=""></div>';
            }
            html += '<div class="result-double-question">Tenter le quitte ou double ?</div>';
            html += '<div class="result-actions">';
            html += '<button class="btn btn--garder" id="btn-garder">Garder</button>';
            html += '<button class="btn btn--double" id="btn-double">Quitte ou Double</button>';
            html += '</div>';

            body.innerHTML = html;
            overlay.classList.add('active');

            /* Empecher fermeture par clic overlay ou X */
            var closeBtn = document.getElementById('result-close');
            if (closeBtn) closeBtn.style.display = 'none';

            function cleanup() {
                if (closeBtn) closeBtn.style.display = '';
                overlay.classList.remove('active');
            }

            document.getElementById('btn-garder').addEventListener('click', function () {
                cleanup();
                resolve('garder');
            });

            document.getElementById('btn-double').addEventListener('click', function () {
                cleanup();
                resolve('double');
            });
        });
    }

    /* === ANIMATION SUSPENSE QUITTE OU DOUBLE === */
    async function doDoubleAnimation() {
        var overlay = document.getElementById('modal-result');
        var title = document.getElementById('result-title');
        var body = document.getElementById('result-body');
        if (!overlay || !body) return;

        if (title) title.textContent = 'Quitte ou Double';

        var html = '<div class="result-double-suspense">';
        html += '<div class="double-coin" id="double-coin">&#x1FA99;</div>';
        html += '<div class="double-text">La pièce tourne...</div>';
        html += '</div>';

        body.innerHTML = html;
        overlay.classList.add('active');

        /* Animation de suspense : la piece tourne pendant 2s */
        await sleep(2000);

        overlay.classList.remove('active');
    }

    /* === AFFICHAGE RESULTAT DU DOUBLE === */
    async function showDoubleResult(isWin, lot, finalGain) {
        var overlay = document.getElementById('modal-result');
        var modal = overlay ? overlay.querySelector('.modal--result') : null;
        var title = document.getElementById('result-title');
        var body = document.getElementById('result-body');
        if (!overlay || !body) return;

        /* Reset classes */
        if (modal) {
            modal.classList.remove('result--win', 'result--lose');
            modal.classList.add(isWin ? 'result--win' : 'result--lose');
        }

        var html = '';

        if (isWin) {
            var winTitles = ['DOUBLE !', 'JACKPOT !', 'ÉNORME !', 'GG WP !'];
            var winEmojis = ['&#x1F929;', '&#x1F525;', '&#x1F4B0;', '&#x1F3C6;'];
            var idx = Math.floor(Math.random() * winTitles.length);
            if (title) title.textContent = winTitles[idx];
            html += '<div class="result-icon">' + winEmojis[idx] + '</div>';
            html += '<div class="result-lot-name">' + lot.nom + ' x2</div>';
            if (finalGain > 0) {
                html += '<div class="result-gain">+' + finalGain + ' jetons !</div>';
            }
            if ((lot.gain_pepites || 0) > 0) {
                html += '<div class="result-gain" style="color:var(--color-warning);">+' + (lot.gain_pepites * 2) + ' p\u00e9pites <img class="icon-inline" src="assets/images/pepite.png" alt=""> !</div>';
            }
            if (finalGain <= 0 && (lot.gain_pepites || 0) <= 0) {
                html += '<div class="result-gain">Lot double !</div>';
            }
        } else {
            var lossMessages = [
                'Putain la clim... Sakai ici ..',
                'Cleamed',
                'Retente ta chance gros plouc',
                'Ah ouais ça veut dépouiller le dieu ecaflip, dommage ...',
                'Bah alors ? On est nul ?',
                'Malheureux au jeu chanceux en ... c\'est quoi déjà qu\'on dit ?',
                'Aïe, coup dur pour le joueur français',
                'Pas de chance, la vie c\'est pas facile ...'
            ];
            var lossTitles = ['Perdu...', 'Ouch...', 'RIP...', 'Aïe...', 'Dommage...'];
            var lossEmojis = ['&#x1F480;', '&#x1F4A8;', '&#x1F921;', '&#x1FAA6;', '&#x2620;&#xFE0F;'];
            var lIdx = Math.floor(Math.random() * lossTitles.length);
            var randomMsg = lossMessages[Math.floor(Math.random() * lossMessages.length)];
            if (title) title.textContent = lossTitles[lIdx];

            /* Emoji spécial pour clim/cleamed → tornade */
            var emoji = lossEmojis[lIdx];
            if (randomMsg.indexOf('clim') !== -1 || randomMsg.indexOf('Cleamed') !== -1) {
                emoji = '&#x1F32A;&#xFE0F;';
            }
            html += '<div class="result-icon">' + emoji + '</div>';
            html += '<div class="result-message">' + randomMsg + '</div>';
            html += '<div class="result-loss">Lot perdu</div>';
        }

        body.innerHTML = html;
        overlay.classList.add('active');

        var closeBtn = document.getElementById('result-close');
        if (closeBtn) closeBtn.style.display = '';

        await sleep(6500);
        overlay.classList.remove('active');
        if (modal) modal.classList.remove('result--win', 'result--lose');
    }

    function drawRandomLot() {
        var total = lots.reduce(function (sum, l) { return sum + parseFloat(l.pourcentage); }, 0);
        var rand = Math.random() * total;
        var cumul = 0;
        for (var i = 0; i < lots.length; i++) {
            cumul += parseFloat(lots[i].pourcentage);
            if (rand <= cumul) return lots[i];
        }
        return lots[lots.length - 1];
    }

    /* === RESULT MODAL === */
    function setupResultModal() {
        var overlay = document.getElementById('modal-result');
        var closeBtn = document.getElementById('result-close');
        if (!overlay) return;

        function closeModal() { overlay.classList.remove('active'); }

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeModal();
        });
    }

    /* === CONFETTI + PEPITES === */
    function launchConfetti() {
        var container = document.getElementById('confetti-container');
        if (!container) return;

        /* Confettis classiques */
        var colors = ['#db2929', '#e84444', '#ffd700', '#ffffff', '#2ecc71', '#f39c12'];
        var count = 40;

        for (var i = 0; i < count; i++) {
            var confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDelay = (Math.random() * 0.8) + 's';
            confetti.style.animationDuration = (2 + Math.random() * 1.5) + 's';
            confetti.style.width = (6 + Math.random() * 6) + 'px';
            confetti.style.height = (6 + Math.random() * 6) + 'px';
            container.appendChild(confetti);
        }

        /* Pluie de pépites (en même temps que les confettis) */
        var pepiteCount = 30;
        for (var j = 0; j < pepiteCount; j++) {
            var pepite = document.createElement('img');
            pepite.className = 'pepite-rain';
            pepite.src = 'assets/images/pepite.png';
            pepite.style.left = Math.random() * 100 + '%';
            pepite.style.animationDelay = (Math.random() * 0.8) + 's';
            pepite.style.animationDuration = (2 + Math.random() * 1.5) + 's';
            var size = 20 + Math.random() * 20;
            pepite.style.width = size + 'px';
            pepite.style.height = size + 'px';
            container.appendChild(pepite);
        }

        setTimeout(function () {
            container.innerHTML = '';
        }, 5000);
    }

    /* === UTILS === */
    function sleep(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }
})();
