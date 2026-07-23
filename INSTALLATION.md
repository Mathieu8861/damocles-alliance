# Installation du site Damoclès [SWRD]

Guide de mise en ligne complet, à dérouler dans l'ordre. Durée estimée : 30 minutes.

## 1. Projet Supabase
1. https://supabase.com/dashboard > **New project**
2. ⚠️ Limite de **2 projets gratuits par organisation**. Si l'organisation actuelle est pleine, créer d'abord une nouvelle organisation gratuite (menu en haut à gauche > New organization)
3. Nom : `alliance-damocles` · Région : **West EU (Ireland)** (comme REN) · Mot de passe BDD : générer et conserver
4. Attendre la fin du provisioning (~2 min)

## 2. Buckets Storage (2 buckets)
1. Storage > **New bucket** > nom exact : `preuves-recyclages` · **Cocher "Public bucket"** > Create
2. Storage > **New bucket** > nom exact : `builds` (images des builds) · **Cocher "Public bucket"** > Create
3. Rien d'autre : les policies d'accès des deux buckets sont créées par le SQL de l'étape 3

## 3. Base de données
1. SQL Editor > New query
2. Coller TOUT le contenu de `sql/000-INSTALL-DAMOCLES.sql` > **Run**
3. Ce script unique installe les 26 migrations REN dans le bon ordre + les réglages Damoclès (modules **Jeux** et **Boutique** désactivés, réactivables plus tard dans Admin > Modules)
4. ⚠️ Ne jamais runner les fichiers `001` à `024` individuellement : ils sont déjà inclus, ils restent là comme historique miroir de REN

## 4. Edge function extract-runes (vision IA du tracker Forgemagie)
1. Edge Functions > **Deploy a new function** > Via Editor
2. Nom exact : `extract-runes`
3. Coller le contenu de `supabase/functions/extract-runes/index.ts` > Deploy
4. Edge Functions > Secrets : ajouter `ANTHROPIC_API_KEY` (la même clé que sur REN fonctionne)

## 5. Connecter le site
1. Dashboard > Settings > API : copier **Project URL** et **anon public key**
2. Dans `site/script.js` (bloc CONFIG SUPABASE en haut) : remplacer `VOTRE_SUPABASE_URL` et `VOTRE_SUPABASE_ANON_KEY`
3. Note : la clé anon est conçue pour être publique (tout est protégé par RLS), c'est normal qu'elle soit dans le code

## 6. GitHub + Vercel
1. Créer le repo GitHub (ex. `damocles-alliance`) et pousser le dossier
2. https://vercel.com > Add New > Project > importer le repo
3. Framework preset : **Other**, rien d'autre à toucher (`vercel.json` pointe déjà sur `site/`)
4. Deploy

## 7. Premier compte admin
1. Sur le site en ligne : s'inscrire normalement (compte Rorschach)
2. SQL Editor :
```sql
UPDATE public.profiles SET is_admin = TRUE, is_validated = TRUE WHERE username = 'Rorschach';
```
3. Se déconnecter puis se reconnecter

## 8. Vérifications finales
- [ ] Connexion OK, accès au panneau admin OK
- [ ] Admin > Gestion > Modules : Jeux et Boutique décochés, le reste actif
- [ ] Sidebar : pas d'entrée Jeux / Boutique / Slot
- [ ] Admin > Alliances : ajouter BCL et les autres alliances adverses
- [ ] Saisir un recyclage test (parse du chat + autocomplete zones)
- [ ] Lancer une session FM avec un screenshot (valide l'edge function + la clé Anthropic)
- [ ] Valider les membres au fil des inscriptions (Admin > Validation)

## Rappels
- **Aucune donnée REN n'est reprise** : base 100% vierge. Seuls les référentiels jeu sont seedés (298 zones Dofus, catalogue 105 runes, barèmes par défaut)
- Les prix des runes datent du relevé HDV du 11/06 : à rafraîchir dans l'onglet Runes & prix
- Le site REN n'est pas impacté, les deux vivent en parallèle
- Logo actuel = épée SVG placeholder (`site/assets/images/logo-damocles.svg`), à remplacer quand le vrai logo existe
