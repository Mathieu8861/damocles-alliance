/* ============================================ */
/* Edge Function : extract-runes                */
/* Recoit un screenshot d'inventaire Dofus,     */
/* appelle Claude vision, retourne les runes    */
/* detectees avec leurs quantites.              */
/*                                              */
/* Deploiement :                                */
/*   Dashboard Supabase > Edge Functions >      */
/*   New function "extract-runes" > coller ce   */
/*   code > Deploy.                             */
/* Secret requis :                              */
/*   Dashboard > Edge Functions > extract-runes */
/*   > Secrets > ANTHROPIC_API_KEY              */
/* ============================================ */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
/* Injectées automatiquement par Supabase dans toutes les edge functions */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `Tu es un extracteur de données pour le jeu Dofus.
On te donne un screenshot d'inventaire filtré sur les runes de forgemagie.
Chaque cellule de la grille affiche une icône de rune avec sa quantité en haut à gauche.

Tu dois identifier chaque rune visible et sa quantité.

Les noms officiels des runes Dofus sont :
Rune Fo, Rune Pa Fo, Rune Ra Fo (Force)
Rune Ine, Rune Pa Ine, Rune Ra Ine (Intelligence)
Rune Cha, Rune Pa Cha, Rune Ra Cha (Chance)
Rune Age, Rune Pa Age, Rune Ra Age (Agilité)
Rune Vi, Rune Pa Vi, Rune Ra Vi (Vitalité)
Rune Sa, Rune Pa Sa, Rune Ra Sa (Sagesse)
Rune Pui, Rune Pa Pui, Rune Ra Pui (Puissance)
Rune Ini, Rune Pa Ini, Rune Ra Ini (Initiative)
Rune Pod, Rune Pa Pod, Rune Ra Pod (Pods)
Rune Prospe, Rune Pa Prospe (Prospection)
Rune Do (Dommages globaux)
Rune Do Feu, Rune Pa Do Feu, Rune Do Eau, Rune Pa Do Eau, Rune Do Air, Rune Pa Do Air, Rune Do Terre, Rune Pa Do Terre, Rune Do Neutre, Rune Pa Do Neutre (Dommages élémentaires)
Rune Do Pou, Rune Pa Do Pou, Rune Ra Do Pou (Dommages poussée)
Rune Do Cri, Rune Pa Do Cri (Dommages critiques)
Rune Do Ren, Rune Pa Do Ren (Renvoi)
Rune Do Pi, Rune Pa Do Pi (Dommages pièges)
Rune Per Pi, Rune Pa Per Pi, Rune Ra Per Pi (Puissance pièges)
Rune Do Per Ar (% dommages d'armes), Rune Do Per Di (% distance), Rune Do Per Mé (% mêlée), Rune Do Per So (% sorts)
Rune So, Rune Pa So (Soins), Rune Cri (Critique)
Rune Ret Pa, Rune Pa Ret Pa, Rune Ret Pme, Rune Pa Ret Pme (Retraits PA/PM)
Rune Ré Pa, Rune Pa Ré Pa, Rune Ré Pme, Rune Pa Ré Pme (Esquives PA/PM)
Rune Tac, Rune Pa Tac (Tacle), Rune Fui, Rune Pa Fui (Fuite)
Rune Ré Feu, Rune Pa Ré Feu, Rune Ra Ré Feu (et idem Eau / Air / Terre / Neutre / Pou / Cri — résistances fixes)
Rune Ré Per Feu, Rune Ré Per Eau, Rune Ré Per Air, Rune Ré Per Terre, Rune Ré Per Neutre (% résistances élémentaires)
Rune Ré Per Mé (% résistance mêlée), Rune Ré Per Di (% résistance distance)
Rune Ga Pa (PA), Rune Ga Pme (PM), Rune Po (Portée), Rune Invo (Invocation)
Rune de chasse, Rune de Signature

DEUX FORMATS DE SCREENSHOT POSSIBLES — détecte lequel tu reçois :

═══ FORMAT A : fenêtre « Costumager » (atelier de forgemagie) ═══
Un tableau listant les caractéristiques d'un item (ex: "345 Vitalité", "62 Agilité", "1 PA"...).
Sur CHAQUE LIGNE de stat, à droite, se trouvent jusqu'à 3 petites cellules contenant des quantités de runes possédées :
- 1ère cellule (sans en-tête, la plus à gauche des trois) = rune BASIQUE
- cellule sous l'en-tête « Pa » = rune Pa
- cellule sous l'en-tête « Ra » = rune Ra
ALIGNEMENT CRITIQUE : repère la position horizontale de chaque cellule par rapport aux en-têtes de colonnes « Pa » et « Ra » en haut du tableau. Une ligne peut n'avoir que 1 ou 2 cellules — ne décale JAMAIS les attributions. En cas de doute sur la colonne d'une cellule, mets la famille dans "non_identifiees" plutôt que de deviner.

Table de correspondance stat → famille de rune :
- Vitalité → Vi · Force → Fo · Intelligence → Ine · Chance → Cha · Agilité → Age
- Sagesse → Sa · Puissance → Pui · Initiative → Ini · Prospection → Prospe · Pods → Pod
- PA → Ga Pa · PM → Ga Pme · Portée → Po · Invocation(s) → Invo
- Dommages → Do · Dommages Air/Eau/Feu/Terre/Neutre → Do Air / Do Eau / Do Feu / Do Terre / Do Neutre
- Dommages Poussée → Do Pou · Dommages Critiques → Do Cri · Renvoie X dommages → Do Ren
- Soins → So · % Critique → Cri
- X% Dommages aux sorts → Do Per So · X% Dommages distance → Do Per Di · X% Dommages mêlée → Do Per Mé · X% Dommages d'armes → Do Per Ar
- Résistance Eau/Air/Feu/Terre/Neutre (fixe, sans %) → Ré Eau / Ré Air... · X% Résistance Eau/Air/... → Ré Per Eau / Ré Per Air...
- Résistances Critiques → Ré Cri · Résistance Poussée → Ré Pou
- Retrait PA → Ret Pa · Retrait PM → Ret Pme · Esquive PA → Ré Pa · Esquive PM → Ré Pme
- Tacle → Tac · Fuite → Fui
Le nom final = "Rune [famille]" pour la basique, "Rune Pa [famille]" pour Pa, "Rune Ra [famille]" pour Ra.

═══ FORMAT B : fenêtre « Inventaire » filtrée sur les runes ═══
Grille d'items organisée en 3 COLONNES par tier :
- Colonne GAUCHE = runes basiques · colonne MILIEU = runes Pa · colonne DROITE = runes Ra
Chaque LIGNE = une même famille (même icône de base). Cellule vide = pas de rune de ce tier.
Certaines familles n'existent qu'en basique (Do, Cri, Ga Pa, Ga Pme, Po, Invo...) : colonne de gauche uniquement.

MÉTHODE OBLIGATOIRE (les deux formats) :
1. Balaye ligne par ligne, de haut en bas.
2. Pour chaque ligne : identifie la FAMILLE, puis lis la quantité de chaque cellule occupée en respectant sa colonne.
3. Produis une entrée par cellule occupée avec le bon préfixe de tier.
4. Ne fusionne JAMAIS deux cellules. Ne décale JAMAIS les colonnes. Le nombre d'entrées du JSON = le nombre de cellules occupées.

STATS DE L'ITEM (FORMAT A uniquement) :
Le tableau du Costumager affiche aussi, pour chaque ligne de stat, les colonnes « Min » et « Max » (jet d'origine) à gauche, et la VALEUR ACTUELLE dans le libellé central (ex: "351 | 400 | ❤ 384 Vitalité" → min 351, max 400, actuel 384).
Extrais CHAQUE ligne de stat de l'item dans "item_stats" :
- "stat" : le libellé exact tel qu'affiché (ex: "Vitalité", "Agilité", "PA", "Portée", "Dommages Air", "Initiative", "8% Résistance Eau" → écris "% Résistance Eau", "Retrait PM", "Résistances Critiques", "Fuite", "1% Dommages aux sorts" → écris "% Dommages aux sorts")
- "actuel" : la valeur actuelle (le nombre dans le libellé central, peut être négatif)
- "min" et "max" : les colonnes Min/Max (peuvent être négatives ou absentes → null)
Pour le FORMAT B (inventaire), "item_stats" est un tableau vide.

Réponds UNIQUEMENT avec un JSON valide de cette forme, sans markdown :
{"runes": [{"nom": "Rune Fo", "qty": 184}, ...], "item_stats": [{"stat": "Vitalité", "actuel": 384, "min": 351, "max": 400}, ...], "non_identifiees": 2}

- "qty" est le nombre affiché en haut à gauche de la cellule.
- Si tu vois une cellule de rune mais ne peux pas l'identifier avec certitude, incrémente "non_identifiees" au lieu de deviner.
- N'inclus PAS les items qui ne sont pas des runes de forgemagie (potions, ressources, équipements).`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY non configurée" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    /* ====== SÉCURITÉ : réservé aux membres validés ====== */
    /* L'anon key seule ne suffit pas : il faut le JWT d'un  */
    /* utilisateur connecté ET validé par un admin.          */
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Authentification requise" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_validated")
      .eq("id", user.id)
      .single();
    if (!profile || !profile.is_validated) {
      return new Response(
        JSON.stringify({ error: "Compte non validé" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    /* ===================================================== */

    const { image, media_type } = await req.json();
    if (!image) {
      return new Response(
        JSON.stringify({ error: "Champ 'image' (base64) requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: media_type || "image/png",
                  data: image,
                },
              },
              {
                type: "text",
                text: "Extrais les runes et quantités de cet inventaire.",
              },
            ],
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("[extract-runes] Anthropic error:", errText);
      return new Response(
        JSON.stringify({ error: "Erreur API vision", detail: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await anthropicRes.json();
    const text = data?.content?.[0]?.text ?? "";

    /* Parse le JSON renvoyé par le modèle.                              */
    /* Robuste : extrait le bloc {...} même si le modèle ajoute du texte */
    /* explicatif avant/après ou un wrapping markdown.                   */
    let parsed;
    try {
      const cleaned = text.replace(/```json|```/g, "").trim();
      const match = cleaned.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match ? match[0] : cleaned);
    } catch (_e) {
      console.error("[extract-runes] JSON parse fail:", text);
      return new Response(
        JSON.stringify({ error: "Réponse vision illisible", raw: text }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[extract-runes] Fatal:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
