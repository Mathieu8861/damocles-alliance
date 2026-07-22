# Alliance Damoclès [SWRD] - Mémoire

## Infos
- **Client :** Alliance Damoclès (projet communautaire Dofus, pas de facturation)
- **Contact principal :** Mathieu (pseudo IG : Rorschach)
- **Leads alliance :** Rorschach, Lord, Pannah, Henrich, Big
- **Univers :** Dofus (MMORPG)
- **Objectif :** réunir ~30 joueurs PvP éparpillés dans différentes alliances sous une seule bannière pour renverser l'alliance BCL. Attaques et défenses coordonnées.
- **Nom / Tag :** Damoclès, tag **[SWRD]** (l'épée de Damoclès : la menace qui plane au-dessus du roi)
- **Type :** Site d'alliance (clone du site REN), gestion membres, PvP, percos, recyclages, forgemagie
- **Dossier site :** `Création site Web/DAMOCLES/`
- **URL prod :** à créer (Vercel)
- **Git :** à créer (repo GitHub Mathieu8861) — **Branche :** master
- **Statut projet :** 🟢 actif — duplication en cours

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

## Installation (résumé, détail dans INSTALLATION.md)
1. Créer projet Supabase `alliance-damocles` (West EU) — ⚠️ limite 2 projets gratuits par organisation, créer une 2e org gratuite si besoin
2. Runner `sql/000-INSTALL-DAMOCLES.sql` dans SQL Editor
3. Créer bucket Storage public `preuves-recyclages`
4. Déployer edge function `extract-runes` + secret `ANTHROPIC_API_KEY`
5. Reporter URL + clé anon dans `site/script.js`
6. Repo GitHub + Vercel (root directory `site/`)
7. S'inscrire sur le site puis se passer admin en SQL

## Historique & Décisions
- 22/07/2026 : choix du nom **Damoclès [SWRD]** (menace qui plane sur BCL). Leads : Rorschach, Lord, Pannah, Henrich, Big. Messages d'annonce Discord + MP de démarchage rédigés. Discord : duplication du serveur Renegats via modèle de serveur natif (Paramètres > Modèle de serveur, désactiver le mode Communauté le temps de créer le modèle)
- 22/07/2026 : duplication du code REN → DAMOCLES (site + sql + edge function), rebrand Damoclès, SQL consolidé, checklist INSTALLATION.md
- 23/07/2026 : bascule de la DA rouge → **violet #7d5ff7** (demande Mathieu). Variables accent + littéraux (sidebar, badges, glows, cadres, confettis, logo SVG). Rouges sémantiques conservés
- 23/07/2026 : **sélecteur de langue FR / EN / DE** (membres internationaux) : bouton drapeau dans la sidebar (ou flottant en bas à droite sur connexion/admin) qui ouvre un menu de langues. Traduction Google de tout le site (contenu dynamique inclus, bannière Google masquée, préférence en localStorage `damocles_lang`, cookie `googtrans`). Pseudos sidebar, marque et noms de runes protégés par `class="notranslate"`. Ajouter une langue = 1 entrée dans le const `LANGS` de script.js + code dans `includedLanguages`. Testé FR→EN, FR→DE et retours en local

## Prochaines étapes
- [ ] Créer le projet Supabase + runner le SQL d'install
- [ ] Bucket storage + edge function + secret
- [ ] Renseigner URL/clé Supabase dans `site/script.js`
- [ ] Créer le repo GitHub + brancher Vercel
- [ ] Premier compte admin (Rorschach)
- [ ] Logo définitif Damoclès (placeholder épée SVG en attendant)
- [ ] Valider les membres au fil des inscriptions

## Notes
- Projet communautaire, même modèle que REN (gratuit)
- REN continue de tourner en parallèle, rien ne change pour lui
- Le catalogue runes part avec les prix relevés le 11/06 sur REN : à réajuster dans l'admin Damoclès si le marché a bougé
