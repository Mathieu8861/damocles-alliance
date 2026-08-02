# Alliance Damoclès [DMO] - Mémoire

## Infos
- **Client :** Alliance Damoclès (projet communautaire Dofus, pas de facturation)
- **Contact principal :** Mathieu (pseudo IG : Rorschach)
- **Leads alliance :** Rorschach, Lord, Pannah, Henrich, Big
- **Univers :** Dofus (MMORPG)
- **Objectif :** réunir ~30 joueurs PvP éparpillés dans différentes alliances sous une seule bannière pour renverser l'alliance BCL. Attaques et défenses coordonnées.
- **Nom / Tag :** Damoclès, tag **[DMO]** (ex-[SWRD] du 22/07, corrigé le 25/07 ; l'épée de Damoclès : la menace qui plane au-dessus du roi)
- **Type :** Site d'alliance (clone du site REN), gestion membres, PvP, percos, recyclages, forgemagie
- **Dossier site :** `Création site Web/DAMOCLES/`
- **URL prod :** 🚀 **https://damocles-alliance.vercel.app** (en ligne depuis le 23/07/2026)
- **Supabase :** projet `alliance-damocles`, ID `yebfbdgxikbnqdkbycam`, org gratuite "Damocles" (⚠️ pause possible après 7j sans requête, improbable avec 30 joueurs actifs). Clés : publishable dans script.js, secret + mdp BDD + clé Anthropic dans `.env.local`
- **Git :** https://github.com/Mathieu8861/damocles-alliance (public) — **Branche :** master
- **Statut projet :** 🚀 EN LIGNE, premier admin Rorschach actif

## Stack technique
- HTML/CSS/JS vanilla (identique REN : IIFE par page, event `ren:ready`, helpers `window.REN.*`)
- Supabase (Postgres + Auth + RLS + Storage + Edge Functions) — **projet à créer** (voir INSTALLATION.md)
- Déploiement : Vercel (projet à créer)
- Fonts : Inter + Rajdhani
- **DA violette** (23/07) : accent `#7d5ff7`, clair `#9678ff`, foncé `#6244d9` (variables CSS `--color-accent*`). Les rouges sémantiques (danger `#e84444`, défaites, suppressions, tag fix, cadre rubis) restent rouges volontairement

## Origine : duplication du site REN (22/07/2026)
- Code cloné depuis `Création site Web/REN/` (commit `9cc4d5d`)
- **Aucune donnée REN embarquée** : nouveau Supabase vierge. Seuls les seeds de référence jeu suivent (zones Dofus, catalogue 105 runes avec prix du 11/06, barèmes par défaut)
- **Modules désactivés au seed** : `jeux` (+ slot) et `boutique` — réactivables depuis Admin > Gestion > Modules
- SQL consolidé : `sql/000-INSTALL-DAMOCLES.sql` (migrations 001→024 dans l'ordre chronologique : 001-004, 005-bareme-split, 006, 007, 005-securite, 008-securisation, 008-slot, 009-024)
- Le repo REN reste la référence pour les évolutions : reporter les nouvelles migrations/features à la main si on veut les partager

## Structure
### Site (`site/`)
- Identique à REN : index, connexion, admin, membres, profil, attaque, defense, historique, classement, board, builds, cartes, boutique, jeux, slot, recyclages, fm, liens, demo-cadres
- `script.js` : config Supabase (URL + clé anon) **à remplacer** par celles du nouveau projet
- `js/` : modules par page (admin, fm, recyclages, etc.)

### SQL (`sql/`)
- `000-INSTALL-DAMOCLES.sql` — **script unique d'installation** (à runner sur le nouveau projet Supabase)
- `001` → `024` — miroir des migrations REN (historique, ne pas runner individuellement)

### Edge Functions (`supabase/functions/`)
- `extract-runes` — vision IA screenshots FM. À déployer via Dashboard + secret `ANTHROPIC_API_KEY`

## Secrets
- Mot de passe BDD Postgres du projet Supabase : dans `.env.local` à la racine du dossier (gitignoré, jamais commit — le repo est public)

## Installation (résumé, détail dans INSTALLATION.md)
1. Créer projet Supabase `alliance-damocles` (West EU) — ⚠️ limite 2 projets gratuits par organisation, créer une 2e org gratuite si besoin
2. Runner `sql/000-INSTALL-DAMOCLES.sql` dans SQL Editor
3. Créer bucket Storage public `preuves-recyclages`
4. Déployer edge function `extract-runes` + secret `ANTHROPIC_API_KEY`
5. Reporter URL + clé anon dans `site/script.js`
6. Repo GitHub + Vercel (root directory `site/`)
7. S'inscrire sur le site puis se passer admin en SQL

## Historique & Décisions
- 22/07/2026 : choix du nom **Damoclès [DMO]** (menace qui plane sur BCL). Leads : Rorschach, Lord, Pannah, Henrich, Big. Messages d'annonce Discord + MP de démarchage rédigés. Discord : duplication du serveur Renegats via modèle de serveur natif (Paramètres > Modèle de serveur, désactiver le mode Communauté le temps de créer le modèle)
- 22/07/2026 : duplication du code REN → DAMOCLES (site + sql + edge function), rebrand Damoclès, SQL consolidé, checklist INSTALLATION.md
- 23/07/2026 : bascule de la DA rouge → **violet #7d5ff7** (demande Mathieu). Variables accent + littéraux (sidebar, badges, glows, cadres, confettis, logo SVG). Rouges sémantiques conservés
- 23/07/2026 : **sélecteur de langue FR / EN / DE** (membres internationaux) : bouton drapeau dans la sidebar (ou flottant en bas à droite sur connexion/admin) qui ouvre un menu de langues. Traduction Google de tout le site (contenu dynamique inclus, bannière Google masquée, préférence en localStorage `damocles_lang`, cookie `googtrans`). Pseudos sidebar, marque et noms de runes protégés par `class="notranslate"`. Ajouter une langue = 1 entrée dans le const `LANGS` de script.js + code dans `includedLanguages`. Testé FR→EN, FR→DE et retours en local

## Historique mise en ligne (23/07/2026, avec Claude en guidage pas à pas)
- Org Supabase gratuite "Damocles" créée (l'org Pro facturait 10$/m par projet Micro, Nano indisponible à la création)
- SQL 000 passé après 2 corrections : commentaires de séparateurs non fermés, puis policies en double dans l'historique (006 vs 005-securite) → script rendu idempotent (DROP avant chaque CREATE POLICY) + fix type de retour `acheter_boutique` (007 INTEGER → 009 JSONB)
- **Dérive de schéma REN détectée par sondage REST** et réintégrée : `profiles.mules/zone_reservee/preference_recompense`, `builds.image_url/type_build/classe/valeur_kamas`, bucket storage `builds`
- Buckets `preuves-recyclages` + `builds` (publics), edge function `extract-runes` déployée (piège UI : le fichier doit s'appeler `index.ts`, le champ "Function name" porte le nom de la fonction), secret `ANTHROPIC_API_KEY` = **nouvelle clé** créée le 23/07 (l'ancienne clé REN est irrécupérable, secrets write-only partout)
- Vercel importé (framework Other), URL `damocles-alliance.vercel.app`
- **Fix inscriptions** : les nouveaux projets Supabase rejettent le domaine `example.com` des emails internes générés depuis le pseudo → domaine changé en `@damocles-alliance.vercel.app` (auth.js). Provider Email activé, "Confirm email" désactivé
- **Premier admin** : le trigger `protect_admin_fields` bloque toute promotion (même via clé service, auth.uid() NULL) → DISABLE TRIGGER / UPDATE / ENABLE TRIGGER dans le SQL Editor (documenté dans INSTALLATION.md)
- Vérifié à distance : Rorschach admin+validé, 105 runes, 305 zones, 50 barèmes, 6 symboles slot, modules jeux+boutique off

## Historique post-lancement
- 23/07/2026 (soir) : **2 screenshots obligatoires par combat** (attaque + défense, demande Mathieu : "obligatoire pour la nouvelle alliance"). Module partagé `js/combat-preuves.js` (2 slots, Ctrl+V routé vers le 1er slot vide, compression canvas JPEG 0.82 max 1600px, upload `preuves-recyclages/combats/{userId}/`). Soumission bloquée côté client + contrainte CHECK côté serveur. Miniatures cliquables dans l'historique. Migration `sql/025` (inclut le rattrapage de la dérive `combats.perco_owner_id`, colonne REN jamais migrée qu'utilise le formulaire défense). Vérifié en local via compte test jetable (supprimé ensuite)

- 24/07/2026 : footer supprimé (infos regroupées en bas de sidebar), fix espace vide (--footer-height à 0 sur pages publiques). **Onglet Admin > Économie > Runes & prix** : maj des prix du catalogue en masse + lecture IA des screenshots HDV (edge function mode `hdv_prices`, prompt dédié). ⚠️ nécessite le redéploiement de l'edge function

- 25-26/07/2026 : **vrai logo** (bouclier épée-couronne, PNG transparent fourni par Mathieu, version 256px optimisée) partout + **vidéo du blason animée** sur la carte de connexion (autoplay muet boucle). Tag corrigé **[DMO]** (les emails internes gardent .swrd, invisible, pour ne pas casser les comptes). **DA violette sur la partie jeu** : fond Ecaflip repeint par hue-rotate, cartes violettes bordées or, bouton SPIN violet, vignette hub remplacée (capture Mathieu; celle du slot reste à refaire). Dernière dérive REN : `recompenses_config.jetons_reward` (027, balayage exhaustif des 80 colonnes = plus aucune manquante). **Interrupteur jetons** (028) : site_config + fonction `ajouter_jetons` recréée (manquait sur Damoclès !) avec verrou serveur, case dans Admin > Modules > Économie, l'existant jamais supprimé. **Builds communautaires** (029) : tout membre validé propose un build depuis la page (form + screenshot compressé), auteur affiché, suppression auteur/admin, XSS des cartes corrigé

- 27/07/2026 : **grosse session d'itérations avec les premiers membres actifs** (16 inscrits, combats réels vs La Boucle [BCL] et OUTSIDERS). Invités hors site dans les combats (030). Winrate = combats équilibrés uniquement (031, dashboard + membres + profil, tiret neutre si aucun combat équilibré). formatKamas exact (1,6 M). Cartes membres redessinées (lisibilité, tuiles stats, chips mules, halo déco). Changelog Damoclès importé + popup version 2026-07-27 (anciennes entrées REN retirées). Balises Open Graph partout + image og-damocles.png générée (aperçu Discord, attention cache Discord par URL). Liens CSS/JS versionnés `?v=` (anti-cache navigateur, bump à chaque déploiement de style/script). Bannière accueil : artwork violet fourni par Mathieu (1376x397, `goultar_damocles.jpg`), affiché net à taille native centré, côtés en dégradé violet lumineux + aura (l'écho flouté de l'image rendait noir, abandonné). Essai blason animé dans l'espace gauche + image à droite : **reverté** (commit 4bbc51d puis revert d712240). Reset des combats/screens de test effectué à distance

- 27/07/2026 (suite) : **blason classique dans la bannière** (demande Mathieu, screenshot de l'espace violet à gauche) : logo statique 512px (généré depuis la source transparente 1024) centré dans l'espace violet au-dessus du titre (overlay en flex column pleine hauteur + margin auto), lueur violette subtile, masqué sur mobile (bannière trop basse à 108px). Piège CSS corrigé : la règle générique `.dashboard-banner img` (spécificité classe+élément) écrasait `.dashboard-banner__logo`, artwork scopé en `.dashboard-banner > img`. Vérifié par géométrie calculée à 2200 / 1440 / 375px (le panneau preview ne compositait pas les screenshots). CSS v=20260727d, commit 43db9fa. Retour Mathieu « pas centré dans le rectangle » : le blason se centrait sur le bloc titre, pas sur la bande violette ; l'overlay prend désormais la largeur exacte de la bande (`width: calc((100% - min(100%, 1376px)) / 2)` + `min-width: fit-content` en fallback quand l'artwork couvre tout), décalage vérifié à 0px. CSS v=20260727e, commit d7729bf. Intervention data à distance : combat n°11 (attaque perdue 5v5 vs BCL, 27/07 21:21) passé de 0 à 1 point après correction du barème par Mathieu (les points joueurs étant des SUM dynamiques via combat_participants, les 5 participants sont crédités partout d'un coup, aucun jeton distribué)

- 27-28/07/2026 (nuit) : **page connexion refaite + bannière vidéo + verre glacé** (itérations en local sur schéma annoté de Mathieu, push uniquement après validation). Vidéo Goultard fournie par Mathieu (`video_goultard_2.mp4`, 1924×1076) : segment 0→1s en **boucle aller-retour** bakée ffmpeg (avant + arrière moins 1 frame, 958 Ko : `fond-connexion.mp4` + poster jpg). ffmpeg installé via winget (Gyan.FFmpeg 8.1.2 ; binaires sous `%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg...\bin`, le PATH des shells de session n'est pas rafraîchi, pointer en chemin absolu). Connexion (commit 0f50422) : vidéo plein écran, blason 512 seul en haut à gauche (assombri brightness 0.82, triple drop-shadow), bloc en barre bas-centre 620px (pseudo/mdp empilés sans labels, gros bouton dégradé violet sur 2 rangées via grid + `:has()`, ligne inscription à droite), verre glacé (dégradé violet→noir, blur 16, reflet ::before, champs teintés). Bannière dashboard (commit 702f016) : la même vidéo en cover **pleine largeur** (fini le jpg 1376 flou), cadrage `object-position: center 20%` (visage + air au-dessus des cheveux), hauteur clamp 36vh (200px mobile), voile gauche/bas, blason retiré. **Verre glacé généralisé** : stat-cards, Mon Rang, Activité récente, entrées changelog ; sélecteurs à classes doublées obligatoires (les raccourcis `background:`/`border:` avec var() des règles de base gagnaient sinon), accent doré conservé sur la tuile Kamas. Vidéos sources gitignorées (`video_goultard*.mp4`, 59 et 8 Mo, repo public). Pièges : cache navigateur tenace sur style.css même versionné (diagnostic disque vs curl vs CSSOM ; toujours Ctrl+F5 en local). Assets devenus inutilisés mais laissés en place : `image_page_de_connexion.webp`, `goultar_damocles.jpg`, `Animation_logo_damocles_fond_gris.mp4`. autofill Chrome neutralisé sur les champs connexion (fond blanc forcé par le navigateur). cartes membres puis TOUS les panneaux du site passés au cadre verre (combat-form, history-card, admin-panel, boutique, builds, recyclages, FM, jeux, liens, profil, board ; accents sémantiques réaffirmés : liseré attaque/défense, session FM en cours, tuile Kamas or ; modales exclues volontairement). CSS v=20260727j

- 31/07/2026 : **mules en combat, le joueur compte une seule fois** (demande Mathieu : multi-compte autorisé, la mule ne doit jamais apparaître au classement, points crédités une seule fois au perso principal quel que soit le nombre de mules ; le nb_allies reste la taille d'équipe pour le barème). Bug racine : l'id d'une mule dans le sélecteur = celui de son propriétaire → joueur + sa mule = id en double → l'insert ENTIER de combat_participants échouait sur UNIQUE(combat_id, user_id), silencieusement (aucun check d'erreur), personne n'avait ses points. Fix attaque.js + defense.js : dédoublonnage avant insert, jetons dédupliqués, erreur d'insert désormais signalée par toast, et ses propres mules redeviennent sélectionnables (avant, exclues avec le perso principal). **Réparation prod** : combat n°37 (Diors, 5v5 victoire vs perco, 30/07) avait 0 participant → équipe reconstituée depuis les screenshots de preuve (client allemand) : Diors (via Not-Diors), Thero-pro-D (présent avec sa mule Acolyte-prohysterik, compté une fois), Buubuuze → 3 points chacun réinsérés. Reste à identifier « Tcinq-Sanseni » (aucune correspondance profil/mule). Même fix porté sur REN (attaque + defense). Rappel utile : les joueurs doivent renseigner leurs mules dans leur profil pour qu'elles apparaissent dans le sélecteur (Diors n'en avait aucune)

- 31/07/2026 : **modification d'un combat par les admins** depuis l'Historique (demande Mathieu, exemple : défense déclarée à la place d'une attaque). Bouton crayon à côté de la croix de suppression (déjà existante), modale d'édition (type, résultat, effectifs, butin, zone/commentaire), **points recalculés via calculer_points** avec la nouvelle configuration, butin remis à 0 si défaite. Migration `sql/032-combats-admin-update.sql` (policy UPDATE admin sur combats, intégrée au 000) **à runner dans le SQL Editor**. Combat n°48 (Madazezette 31/07 13:56, déclaré défense victoire 5v5 +4 pts par erreur) corrigé à distance en attaque victoire 5v5 +3 pts. CSS et historique.js versionnés 20260731

- 31/07/2026 : **winrate retiré des vues membres** (demande Mathieu : le winrate public dissuadait de déclarer les défaites, "trop d'ego"). Retiré des cartes membres (grille passée à 3 tuiles ATK/DEF/Points) et du profil perso (lignes Winrate global/attaque/défense supprimées, les compteurs V/D restent). **Nouvel onglet Admin > Winrate** (groupe PVP & Points) : tableau interne par membre (ATK V/D, WR ATK, DEF V/D, WR DEF, total, WR global), combats équilibrés uniquement, trié par volume. Le winrate d'alliance du dashboard (collectif, pas individuel) est conservé volontairement. JS membres/profil/admin versionnés 20260731, CSS 20260731b

- 03/08/2026 (lundi 00h20) : **classement PvP et droits perco en QUINZAINE** (demande Mathieu : le reset hebdo du lundi venait de vider le classement). Fonction SQL `debut_periode_pvp()` : périodes de 14 jours ancrées au **lundi 27/07/2026** (Paris), prochains resets 10/08, 24/08... Vues `classement_pvp_semaine` / `_passee` recalées dessus (noms conservés, le client en dépend). Migration `sql/033`, **appliquée directement en prod via connexion Postgres directe** (node + pg, host `db.<ref>.supabase.co:5432`, mdp BDD de `.env.local` : plus besoin du SQL Editor pour les DDL !). L'éligibilité zone percos (≥75 pts sur période courante OU passée, board.js) suit automatiquement. Côté client : dates du board recalculées en quinzaine (miroir JS de l'ancre), libellés "Quinzaine", bascule auto du board sur la période en cours quand la passée est vide (cas du lancement). Découvertes : `kamatrix_semaine` n'existe pas en prod (board.js l'interroge dans le vide, dérive REN, silencieux) ; policy 032 bien passée par Mathieu. Pépites (module jeux off) et recyclages hebdo restent sur un cycle hebdomadaire

- 03/08/2026 : **visionneuse sur site pour les screenshots** (demande Mathieu : plus d'ouverture en nouvel onglet). Helper partagé `window.REN.openLightbox` dans script.js (réutilise les styles `.build-lightbox` des builds) + délégation globale sur les liens `a.js-lightbox`. Branché sur : preuves de combat (historique + fil d'accueil), screen d'item FM, preuves recyclages (page membre + onglet admin). Fermeture croix / clic hors image / Échap, clic molette = onglet conservé, Dofusbook reste externe. JS concernés versionnés 20260803

- 03/08/2026 : **édition d'un combat par son auteur pendant 3h** (le crayon de l'historique, réservé admin jusqu'ici). Policy `combats_auteur_update_3h` + trigger `combat_update_guard` (SQL 034, appliqué en prod via Postgres direct) : pour un non-admin, auteur_id/created_at figés et points TOUJOURS recalculés par le barème côté serveur (anti-triche même en requête API forgée ; les admins passent sans contrainte). Crayon affiché à l'auteur < 3h (aligné à droite quand pas de croix de suppression). **Alliance pré-sélectionnée** dans les formulaires attaque/défense : liste triée par fréquence de combat (comptage client des combats par alliance), la plus affrontée en tête et pré-sélectionnée (BCL actuellement, auto-adaptatif). attaque/defense.js v=20260803, historique.js v=20260803b. Changelog du site : 3 entrées « 3 Août 2026 » (nouveautés / améliorations / correctifs) + popup réactivée (REN_UPDATE_VERSION 2026-08-03)

## Prochaines étapes
- [ ] Ajouter **BCL** (et les autres alliances adverses) dans Admin > Alliances
- [ ] Poster l'annonce Discord + MP de démarchage des PvPistes (textes prêts, session du 22/07)
- [ ] Dupliquer le serveur Discord Renegats via modèle de serveur
- [ ] Valider les membres au fil des inscriptions (Admin > Validation)
- [ ] Rafraîchir les prix des runes si le marché a bougé depuis le 11/06 (Admin > Runes & prix, screens HDV)
- [ ] Re-capturer la vignette slot (capture_ecran_enutrosors.jpg) avec le bouton SPIN violet
- [ ] Autoriser le connecteur Artlist (claude.ai > connecteurs) pour sonoriser la vidéo du logo

## Notes
- Projet communautaire, même modèle que REN (gratuit)
- REN continue de tourner en parallèle, rien ne change pour lui
- Le catalogue runes part avec les prix relevés le 11/06 sur REN : à réajuster dans l'admin Damoclès si le marché a bougé
