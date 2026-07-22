/* ============================================ */
/* Damoclès     - Auth (Login / Register)       */
/* Login par pseudo (pas d'email demande)       */
/* Email genere auto: pseudo.ren@example.com     */
/* ============================================ */
(function () {
    'use strict';

    /* === CONSTANTES === */
    function pseudoToEmail(pseudo) {
        var clean = pseudo.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
        return clean + '.ren@example.com';
    }

    /* === SELECTEURS === */
    var loginForm = document.getElementById('login-form');
    var registerForm = document.getElementById('register-form');
    var loginMessage = document.getElementById('login-message');
    var registerMessage = document.getElementById('register-message');
    var toggleToRegister = document.getElementById('toggle-to-register');
    var toggleToLogin = document.getElementById('toggle-to-login');

    /* === AVATAR PREVIEW === */
    var avatarUpload = document.getElementById('avatar-upload');
    var avatarPreview = document.getElementById('avatar-preview');
    var avatarInput = document.getElementById('register-avatar');
    var selectedAvatarFile = null;

    if (avatarUpload && avatarInput) {
        /* Click on the preview zone opens file picker */
        avatarUpload.addEventListener('click', function () {
            avatarInput.click();
        });

        avatarInput.addEventListener('change', function () {
            var file = avatarInput.files[0];
            if (!file) return;

            /* Validate file */
            if (!file.type.startsWith('image/')) {
                alert('Veuillez choisir une image (PNG, JPG, WEBP...)');
                return;
            }
            if (file.size > 2 * 1024 * 1024) {
                alert('L\'image ne doit pas depasser 2 Mo.');
                return;
            }

            selectedAvatarFile = file;

            /* Show preview */
            var reader = new FileReader();
            reader.onload = function (e) {
                avatarPreview.innerHTML = '<img src="' + e.target.result + '" alt="Avatar">';
                avatarUpload.classList.add('avatar-upload--has-image');
            };
            reader.readAsDataURL(file);
        });
    }

    /* === TOGGLE FORMS === */
    if (toggleToRegister) {
        toggleToRegister.addEventListener('click', function (e) {
            e.preventDefault();
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
            toggleToRegister.classList.add('hidden');
            toggleToLogin.classList.remove('hidden');
            clearMessages();
        });
    }

    if (toggleToLogin) {
        toggleToLogin.addEventListener('click', function (e) {
            e.preventDefault();
            registerForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
            toggleToLogin.classList.add('hidden');
            toggleToRegister.classList.remove('hidden');
            clearMessages();
        });
    }

    function clearMessages() {
        if (loginMessage) { loginMessage.className = 'auth-message'; loginMessage.textContent = ''; }
        if (registerMessage) { registerMessage.className = 'auth-message'; registerMessage.textContent = ''; }
    }

    function showMessage(el, text, type) {
        if (!el) return;
        el.textContent = text;
        el.className = 'auth-message auth-message--' + type;
    }

    /* === LOGIN === */
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            if (!window.REN.supabase) {
                showMessage(loginMessage, 'Supabase non configure. Verifiez la configuration.', 'error');
                return;
            }

            var username = document.getElementById('login-username').value.trim();
            var password = document.getElementById('login-password').value;

            if (!username || !password) {
                showMessage(loginMessage, 'Veuillez remplir tous les champs.', 'error');
                return;
            }

            var email = pseudoToEmail(username);

            var submitBtn = loginForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Connexion...';

            try {
                var result = await window.REN.supabase.auth.signInWithPassword({
                    email: email,
                    password: password
                });

                if (result.error) {
                    showMessage(loginMessage, 'Pseudo ou mot de passe incorrect.', 'error');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Connexion';
                    return;
                }

                window.location.href = 'index.html';
            } catch (err) {
                showMessage(loginMessage, 'Erreur inattendue. Reessayez.', 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Connexion';
            }
        });
    }

    /* === REGISTER === */
    if (registerForm) {
        registerForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            if (!window.REN.supabase) {
                showMessage(registerMessage, 'Supabase non configure. Verifiez la configuration.', 'error');
                return;
            }

            var username = document.getElementById('register-username').value.trim();
            var password = document.getElementById('register-password').value;
            var classe = document.getElementById('register-classe').value;
            var element = document.getElementById('register-element').value;
            var dofusbookInput = document.getElementById('register-dofusbook');
            var dofusbookUrl = dofusbookInput ? dofusbookInput.value.trim() : '';

            if (!username) {
                showMessage(registerMessage, 'Veuillez entrer votre pseudo.', 'error');
                return;
            }

            if (username.length < 2 || username.length > 30) {
                showMessage(registerMessage, 'Le pseudo doit faire entre 2 et 30 caractères.', 'error');
                return;
            }

            if (/[<>"'&;(){}]/.test(username)) {
                showMessage(registerMessage, 'Le pseudo contient des caractères non autorisés.', 'error');
                return;
            }

            if (!password || password.length < 8) {
                showMessage(registerMessage, 'Le mot de passe doit faire au moins 8 caractères.', 'error');
                return;
            }

            if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
                showMessage(registerMessage, 'Le mot de passe doit contenir au moins une majuscule et un chiffre.', 'error');
                return;
            }

            var email = pseudoToEmail(username);

            var submitBtn = registerForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Inscription...';

            try {
                var result = await window.REN.supabase.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        data: {
                            username: username,
                            classe: classe || null,
                            element: element || null,
                            dofusbook_url: dofusbookUrl || null
                        }
                    }
                });

                if (result.error) {
                    console.error('[REN] Erreur inscription Supabase:', result.error);
                    var msg = 'Erreur lors de l\'inscription.';
                    if (result.error.message && result.error.message.includes('already registered')) {
                        msg = 'Ce pseudo est deja utilise.';
                    } else if (result.error.message) {
                        msg = result.error.message;
                    }
                    showMessage(registerMessage, msg, 'error');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'S\'inscrire';
                    return;
                }

                /* Verifier si l'utilisateur a bien ete cree */
                if (!result.data || !result.data.user) {
                    console.error('[REN] Inscription: pas de user retourne', result);
                    showMessage(registerMessage, 'Erreur: aucun utilisateur cree. Verifiez la configuration Supabase.', 'error');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'S\'inscrire';
                    return;
                }

                console.log('[REN] Inscription reussie:', result.data.user.id, 'Session:', !!result.data.session);

                /* Upload avatar si un fichier a ete selectionne et qu'on a une session */
                if (selectedAvatarFile && result.data.session) {
                    await uploadAvatar(result.data.user.id, selectedAvatarFile);
                }

                showMessage(registerMessage, 'Compte cree ! Un administrateur doit valider votre acces avant que vous puissiez utiliser le site.', 'success');
                submitBtn.disabled = false;
                submitBtn.textContent = 'S\'inscrire';

            } catch (err) {
                console.error('[REN] Exception inscription:', err);
                showMessage(registerMessage, 'Erreur inattendue: ' + err.message, 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = 'S\'inscrire';
            }
        });
    }

    /* === AVATAR UPLOAD === */
    async function uploadAvatar(userId, file) {
        try {
            var ext = file.name.split('.').pop().toLowerCase();
            var allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
            if (allowedExts.indexOf(ext) === -1) {
                console.error('[REN] Extension avatar non autorisée:', ext);
                return;
            }
            var filePath = userId + '.' + ext;

            /* Upload vers le bucket "avatars" */
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

            /* Recuperer l'URL publique */
            var { data: urlData } = window.REN.supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            if (urlData && urlData.publicUrl) {
                /* Mettre a jour le profil avec l'URL de l'avatar */
                await window.REN.supabase
                    .from('profiles')
                    .update({ avatar_url: urlData.publicUrl })
                    .eq('id', userId);

                console.log('[REN] Avatar uploade avec succes:', urlData.publicUrl);
            }
        } catch (err) {
            console.error('[REN] Exception upload avatar:', err);
        }
    }
})();
