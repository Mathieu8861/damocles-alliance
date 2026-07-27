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

- 27/07/2026 : **grosse session d'itérations avec les premiers membres actifs** (16 inscrits, combats réels vs La Boucle [BCL] et OUTSIDERS). Invités hors site dans les combats (030). Winrate = combats équilibrés uniquement (031, dashboard + membres + profil, tiret neutre si aucun combat équilibré). formatKamas exact (1,6 M). Cartes membres redessinées (lisibilité, tuiles stats, chips mules, halo déco). Changelog Damoclès importé + popup version 2026-07-27 (anciennes entrées REN retirées). Balises Open Graph partout + image og-damocles.png générée (aperçu Discord, attention cache Discord par URL). Liens CSS/JS versionnés `?v=` (anti-cache navigateur, bump à chaque déploiement de style/script). Bannière accueil : artwork violet fourni par Mathieu (1376x397, `goultar_damocles.jpg`), affiché net à taille native centré, côtés en dégradé violet lumineux + aura (l'écho flouté de l'image rendait noir, abandonné). Essai blason animé dans l'espace gauche + image à droite : **reverté** (commit 4bbc51d puis revert d712240), à retravailler plus tard. Reset des combats/screens de test effectué à distance

## Prochaines étapes
- [ ] Ajouter **BCL** (et les autres alliances adverses) dans Admin > Alliances
- [ ] Poster l'annonce Discord + MP de démarchage des PvPistes (textes prêts, session du 22/07)
- [ ] Dupliquer le serveur Discord Renegats via modèle de serveur
- [ ] Valider les membres au fil des inscriptions (Admin > Validation)
- [ ] Logo définitif Damoclès (placeholder épée SVG violette en attendant)
- [ ] Rafraîchir les prix des runes si le marché a bougé depuis le 11/06 (Admin > Runes & prix, screens HDV)
- [ ] Retravailler la bannière d'accueil (espace violet de gauche : blason ? titre + devise ?)
- [ ] Re-capturer la vignette slot (capture_ecran_enutrosors.jpg) avec le bouton SPIN violet
- [ ] Autoriser le connecteur Artlist (claude.ai > connecteurs) pour sonoriser la vidéo du logo

## Notes
- Projet communautaire, même modèle que REN (gratuit)
- REN continue de tourner en parallèle, rien ne change pour lui
- Le catalogue runes part avec les prix relevés le 11/06 sur REN : à réajuster dans l'admin Damoclès si le marché a bougé
