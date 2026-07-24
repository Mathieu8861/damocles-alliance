/* ============================================ */
/* Damoclès     - Preuves combat (2 screens)    */
/* Module partagé attaque.html / defense.html   */
/* 2 screenshots OBLIGATOIRES par combat.       */
/* Colle (Ctrl+V) : remplit le 1er slot vide.   */
/* Compression canvas avant upload (JPEG 0.82,  */
/* max 1600px) vers preuves-recyclages/combats/ */
/* ============================================ */
(function () {
    'use strict';

    var BUCKET = 'preuves-recyclages';
    var MAX_BYTES = 12 * 1024 * 1024; /* avant compression */
    var state = {
        1: { url: '', uploading: false },
        2: { url: '', uploading: false }
    };

    function el(id) { return document.getElementById(id); }
    function hasZones() { return !!el('combat-preuve-drop-1'); }

    /* --- Compression : max 1600px de large, JPEG qualité 0.82 --- */
    function compressImage(file) {
        return new Promise(function (resolve) {
            var img = new Image();
            var objUrl = URL.createObjectURL(file);
            img.onload = function () {
                try {
                    var MAX = 1600;
                    var w = img.width, h = img.height;
                    if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
                    var canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    URL.revokeObjectURL(objUrl);
                    canvas.toBlob(function (blob) {
                        resolve(blob || file);
                    }, 'image/jpeg', 0.82);
                } catch (e) {
                    URL.revokeObjectURL(objUrl);
                    resolve(file);
                }
            };
            img.onerror = function () {
                URL.revokeObjectURL(objUrl);
                resolve(file);
            };
            img.src = objUrl;
        });
    }

    function setStatus(n, text, cls) {
        var status = el('combat-preuve-status-' + n);
        if (!status) return;
        status.textContent = text;
        status.className = 'recyc-preuve__status' + (cls ? ' recyc-preuve__status--' + cls : '');
    }

    async function handleFile(n, file) {
        if (!file) return;
        if (state[n].uploading) return;
        if (file.type.indexOf('image/') !== 0) {
            window.REN.toast('Le fichier doit être une image', 'error');
            return;
        }
        if (file.size > MAX_BYTES) {
            window.REN.toast('Image trop lourde (>12 Mo)', 'error');
            return;
        }

        /* Aperçu local immédiat */
        var reader = new FileReader();
        reader.onload = function (e) {
            var img = el('combat-preuve-preview-' + n);
            var wrap = el('combat-preuve-preview-wrap-' + n);
            var drop = el('combat-preuve-drop-' + n);
            if (img) img.src = e.target.result;
            if (wrap) wrap.style.display = 'block';
            if (drop) drop.style.display = 'none';
            setStatus(n, 'Upload en cours…', 'loading');
        };
        reader.readAsDataURL(file);

        state[n].uploading = true;
        try {
            var blob = await compressImage(file);
            var userId = window.REN.currentProfile ? window.REN.currentProfile.id : 'anonyme';
            var path = 'combats/' + userId + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '-s' + n + '.jpg';

            var upRes = await window.REN.supabase.storage
                .from(BUCKET)
                .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
            if (upRes.error) throw upRes.error;

            var urlRes = window.REN.supabase.storage.from(BUCKET).getPublicUrl(path);
            state[n].url = urlRes.data.publicUrl;
            setStatus(n, 'Prêt ✓', 'ok');
        } catch (err) {
            console.error('[REN-COMBAT] Erreur upload screen ' + n + ':', err);
            window.REN.toast('Erreur upload du screen ' + n + ' : ' + (err.message || ''), 'error');
            resetSlot(n);
        }
        state[n].uploading = false;
    }

    function resetSlot(n) {
        state[n].url = '';
        state[n].uploading = false;
        var wrap = el('combat-preuve-preview-wrap-' + n);
        var drop = el('combat-preuve-drop-' + n);
        var img = el('combat-preuve-preview-' + n);
        var fileInput = el('combat-preuve-file-' + n);
        if (wrap) wrap.style.display = 'none';
        if (drop) drop.style.display = '';
        if (img) img.src = '';
        if (fileInput) fileInput.value = '';
    }

    function bindZone(n) {
        var drop = el('combat-preuve-drop-' + n);
        var fileInput = el('combat-preuve-file-' + n);
        var removeBtn = el('combat-preuve-remove-' + n);
        if (!drop || !fileInput) return;

        drop.addEventListener('click', function () { fileInput.click(); });
        fileInput.addEventListener('change', function () {
            if (fileInput.files && fileInput.files[0]) handleFile(n, fileInput.files[0]);
        });
        if (removeBtn) removeBtn.addEventListener('click', function () { resetSlot(n); });
    }

    function bindPaste() {
        document.addEventListener('paste', function (e) {
            var items = (e.clipboardData || window.clipboardData).items;
            if (!items) return;
            for (var i = 0; i < items.length; i++) {
                if (items[i].type && items[i].type.indexOf('image') === 0) {
                    var file = items[i].getAsFile();
                    if (file) {
                        /* Route vers le premier slot vide */
                        var target = (!state[1].url && !state[1].uploading) ? 1
                            : (!state[2].url && !state[2].uploading) ? 2
                            : null;
                        if (target === null) {
                            window.REN.toast('Les 2 screens sont déjà remplis (retire-en un pour remplacer)', 'info');
                        } else {
                            handleFile(target, file);
                        }
                    }
                    e.preventDefault();
                    break;
                }
            }
        });
    }

    function init() {
        if (!hasZones()) return;
        bindZone(1);
        bindZone(2);
        bindPaste();
    }

    if (window.REN && window.REN.currentProfile) {
        init();
    } else {
        document.addEventListener('ren:ready', init);
    }

    /* API pour attaque.js / defense.js */
    window.REN = window.REN || {};
    window.REN.combatPreuves = {
        isComplete: function () { return !!(state[1].url && state[2].url); },
        isUploading: function () { return state[1].uploading || state[2].uploading; },
        getUrls: function () { return [state[1].url || null, state[2].url || null]; }
    };
})();
