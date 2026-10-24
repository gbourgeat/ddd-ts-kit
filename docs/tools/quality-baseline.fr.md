[English](quality-baseline.md) · **Français**
<!-- translation-of: quality-baseline.md sha256:061efffb14198696 -->

# Base de qualité

**Résumé.** Chaque projet que génère la CLI, l'application d'exemple et le kit lui-même portent le
même petit ensemble d'outils, chacun répondant à une question, chacun derrière un script npm.
Aucun n'est facultatif et aucun n'empiète sur un autre : le vérificateur de types ne fait pas de
lint, le linter ne formate pas, le formateur ne fait pas de lint. Cette page les liste avec leurs
commandes ; la comparaison des analyseurs d'architecture est dans
[L'analyse statique et le pipeline](static-analysis-and-pipeline.fr.md).

## Ce à quoi répond chaque outil

| Outil | La question à laquelle il répond | Script | Ce qui le règle |
|---|---|---|---|
| TypeScript, `strict` | est-ce sain : chaque valeur a-t-elle le type que dit le code | `npm run typecheck` | l'erreur du compilateur |
| ESLint avec `@ddd-ts-kit/eslint-plugin` | est-ce idiomatique et dans les règles : couches, pureté, code propre, accolades, lignes vides | `npm run lint` | `npm run lint:fix` pour ce qui se corrige seul |
| Biome, comme formateur seulement | est-ce mis en page d'une seule façon : largeur de ligne 120, guillemets, virgules, retours à la ligne | `npm run format:check` | `npm run format` |
| knip | quelque chose est-il mort : un fichier, un export, une dépendance que personne n'utilise | `npm run deadcode` | le retirer |
| dependency-cruiser | le graphe des imports respecte-t-il les frontières, à travers les *barrels* et les réexports | `npm run depcruise` | déplacer l'import |
| `ddd-ts-kit check` | l'architecture est-elle intacte : l'arborescence, les noms, le glossaire, les règles de la référence | `npm run check:arch` | la phrase `fix` de chaque constat |
| le lanceur de tests | est-ce que ça marche | `npm test`, `npm run test:e2e` | le code |
| la couverture du lanceur de tests | y a-t-il du code qu'aucune *spec* n'a jamais exécuté, couche par couche | `npm run test:coverage` | la *spec* manquante |

`npm run verify` les enchaîne tous, dans cet ordre : types, lint, format, chaque *spec* avec les
seuils de couverture, *specs* de bout en bout, architecture, graphe, code mort, documents générés.
Le *pipeline* lance les mêmes scripts sous leurs noms `ci:*`, sur GitHub Actions et sur GitLab CI.
La liste est écrite une seule fois, dans la CLI (`BASELINE`,
`packages/cli/src/init/manifest/baseline.ts`) : `verify` est construit à partir d'elle et un test
de la CLI tient les deux *pipelines*, pour plusieurs *stacks* et pour l'application d'exemple, à
chacune de ses portes, si bien qu'une porte ne peut pas quitter un endroit en silence.

![Deux sources écrites une seule fois : la liste BASELINE de la CLI, à partir de laquelle le script verify est construit et à laquelle un test tient les pipelines GitHub et GitLab ; et biome.json à la racine du kit, que le template de la CLI copie sous un test, octet pour octet sauf une exclusion du kit, et que l'exemple étend](../assets/diagrams/quality-baseline-one-source.fr.svg)

Dans un projet généré et dans l'application d'exemple, `verify` est cette liste, dans cet ordre :

```json
{
  "scripts": {
    "verify": "npm run typecheck && npm run lint && npm run format:check && npm run test:coverage && npm run test:e2e && npm run check:arch && npm run depcruise && npm run deadcode && npm run docs:check"
  }
}
```

### Un fichier, une question par outil

Chaque outil voit quelque chose que les autres ne voient pas. Ce fichier d'un domaine casse une
chose pour chacun d'eux :

```ts
// src/contexts/billing/domain/services/invoice-total.ts
import type { InvoiceRow } from '@/contexts/billing/infrastructure/persistence/billing.schema';

export function totalOf(rows: readonly InvoiceRow[]): number {
  const amounts = rows.map((row) => row.amount_in_cents)
  if (amounts.length === 0) return 0;
  return amounts.reduce((sum, amount) => sum + amount, "0");
}

export function formatTotal(totalInCents: number): string {
  return `${totalInCents / 100} EUR`;
}
```

| Outil | Ce qu'il signale dans ce fichier |
|---|---|
| TypeScript | `reduce` initialisé avec une chaîne renvoie une `string`, là où la fonction promet un `number` |
| ESLint | `layer/domain-purity` : le domaine importe une ligne de l'infrastructure ; `clean/braces` : le `if` n'a pas d'accolades ; `clean/blank-lines` : pas de ligne vide après la déclaration, autour du `if`, avant le `return` |
| Biome | le point-virgule manquant et les guillemets doubles (`npm run format` les réécrit) |
| knip | `formatTotal` est exportée et personne ne l'importe |
| dependency-cruiser | l'import de `domain/` vers `infrastructure/`, y compris quand il passe par un *barrel* ou un réexport |
| `ddd-ts-kit check` | la même règle de couche, lue dans l'arborescence et le texte du fichier, et le reste de la référence (noms, glossaire) |
| les *specs* et leur couverture | si `totalOf` a été exécutée ne serait-ce qu'une fois, et si le domaine de `billing` reste au-dessus de son seuil |

Le même fichier une fois que chaque porte passe :

<!-- checked sample -->
```ts
// src/contexts/billing/domain/services/invoice-total.ts
export interface InvoiceLine {
  readonly amountInCents: number;
}

export function totalOf(lines: readonly InvoiceLine[]): number {
  const amounts = lines.map((line) => line.amountInCents);

  if (amounts.length === 0) {
    return 0;
  }

  return amounts.reduce((sum, amount) => sum + amount, 0);
}
```

Le domaine nomme maintenant sa propre ligne au lieu d'une ligne de table, et la correspondance
depuis la ligne de table reste dans `infrastructure/`.

## Où tourne chaque porte

Lu dans les fichiers le 2026-10-13. « kit » est ce dépôt, « exemple » est `examples/scheduling`,
« projet » est ce que génère `init`, sur chaque *stack*. Les portes les moins coûteuses tournent
d'abord et sur ce qui a changé ; les plus larges tournent plus tard, sur tous les fichiers :

![Cinq moments de gauche à droite : à chaque écriture, le hook d'éditeur lance ddd-ts-kit check sur le fichier ; à un commit, lefthook lance ESLint, le formateur et ddd-ts-kit check sur les fichiers indexés, la taille du commit et commitlint ; à un push, la vérification des types et les specs unitaires ; npm run verify enchaîne les neuf portes ; le pipeline les lance sous leurs noms ci, avec le build de production](../assets/diagrams/quality-baseline-when-gates-run.fr.svg)

| Porte | `verify` | *Pipeline* GitHub et GitLab | *Hooks* |
|---|---|---|---|
| vérification des types, sources | kit `ci:typecheck` (le build, puis les exemples vérifiés de la documentation) ; exemple et projet `typecheck` | kit, exemple, projet : `ci:typecheck` | avant un *push* |
| vérification des types, tests | kit `typecheck:tests` (chaque *package*, par `ci:typecheck`) ; exemple et projet : `tsconfig.json` inclut `test/` et les *specs* | même script | avant un *push* |
| lint | kit `ci:lint` ; exemple et projet `lint`, chacun avec le cache d'ESLint indexé par contenu, abandonné quand les règles telles qu'installées ou la config ont changé | `ci:lint`, le cache écrit par la branche par défaut et restauré par une *pull request* | fichiers indexés, avant un *commit* |
| format | kit `ci:format` ; exemple et projet `format:check` | `ci:format`, dans le *job* de lint | fichiers indexés, avant un *commit* |
| code mort | kit `ci:deadcode` ; exemple et projet `deadcode` | `ci:deadcode` | non |
| graphe des dépendances | kit `depcruise` (dans `ci:arch`) ; exemple et projet `depcruise` | kit `ci:arch` ; exemple et projet `ci:arch:graph` | non |
| architecture | kit `check:self`, les *fixtures* de chaque règle, et les tests de la garde (dans `ci:arch`) ; exemple et projet `check:arch` | kit `ci:arch` ; exemple et projet `ci:arch:check` | projet et exemple : fichiers indexés, avant un *commit* ; à chaque écriture par le *hook* d'éditeur |
| chaque règle prouvée sur l'exemple | kit : `example:verify` lance `example:conformance` après la porte propre à l'exemple | kit : le *job* `example` | non |
| dérive des documents | kit `ci:docs` (ni tiret cadratin ni demi-cadratin, chaque page française au niveau de sa page anglaise) ; exemple et projet `docs:check` | `ci:docs` | kit : le contrôle des tirets (`check:dashes`), avant un *commit* |
| *specs* unitaires | kit `ci:test:unit` ; exemple et projet `test:coverage` | `ci:test:unit` | avant un *push*, sur ce que la branche atteint : pour le kit les *packages* et les *packages* construits dessus (`affected-packages.mjs --base origin/main --run test`, sans couverture), pour l'exemple et un projet les contextes (`ddd-ts-kit affected --run`) |
| *specs* d'intégration | kit : le *pipeline* seulement (elles ont besoin de serveurs) ; exemple et projet `test:coverage` (PostgreSQL dans le processus) | `ci:test:integration` | non |
| *specs* de bout en bout | kit : le *pipeline* seulement (`ci:test:e2e`, chaque *stack* générée et exécutée) ; exemple et projet `test:e2e` | `ci:test:e2e` | non |
| seuils de couverture | kit : un plancher par *package* dans `vitest.config.ts`, dans `ci:test:unit` ; exemple et projet : par contexte et par couche, depuis `ddd-ts-kit.config.json`, dans `test:coverage` | `ci:test:unit` et, pour l'exemple et un projet, `ci:test:integration` | exemple et projet : avant un *push* (l'exécution unitaire) ; kit : le *pipeline* seulement |
| *packages* tels que publiés | kit `ci:build` (publint, Are the Types Wrong) | kit `ci:build` ; exemple et projet `ci:build` (le build de production) | non |
| secrets | non : pas une porte de `verify` | le job `secrets` (gitleaks sur tout l'historique) | kit, exemple et projet : les changements indexés, avant un *commit*, quand le binaire `gitleaks` est sur le chemin ; une ligne et aucun refus sinon |

Sans frontière HTTP, un projet n'a pas de script de bout en bout et son *job* de *pipeline* le
dit ; sous jest, les *specs* des adaptateurs tournent avec les *specs* unitaires. Les *hooks* ne
lancent jamais la couverture avant un *commit*.

## Un avertissement fait échouer le lint

Dans un projet généré et dans l'application d'exemple, `lint` et `ci:lint` lancent
`ddd-ts-kit lint`, l'ESLint du projet (ses motifs, `--format` et `--fix` comme ESLint les prend) :
un seul avertissement fait échouer `npm run lint`, `verify` et le *job* de lint du *pipeline*,
comme une erreur. Le *preset* garde ses avertissements comme
avertissements (par exemple `complexity`, `max-depth`, `clean/function-size`,
`clean/no-flag-argument`, `clean/no-noise-comment`, `any` et l'assertion non nulle dans une
*spec*) : l'éditeur et le rapport distinguent toujours une affaire de jugement d'une règle
enfreinte, et ni l'une ni l'autre n'est laissée de côté. Un nouveau projet n'en a aucun, et
`init` n'écrit aucun fichier de désactivations : le premier avertissement se voit le jour où il
est écrit.

**Une règle du kit en transition** est la seule exception. Une règle qu'ajoute une version
ultérieure, ou ce qu'une règle juge de plus, arrive en avertissement pendant une version mineure
et devient une erreur à la suivante ([CONTRIBUTING.md](../../CONTRIBUTING.fr.md)) ; sa
documentation nomme cette version, et le CHANGELOG de la version qui l'apporte nomme la règle.
`ddd-ts-kit lint` affiche ses avertissements dans le rapport, puis une ligne par règle
(`ddd-ts-kit/<rule>: 2 warning(s), not counted while the rule is new; it becomes an error in
0.28.0: fix them before upgrading to it.`), et n'échoue pas sur eux : une mise à jour du kit ne
fait jamais passer au rouge un lint vert, et les constats sont corrigés ou consignés avant la
version qui fait de la règle une erreur. Un simple `eslint . --max-warnings 0` les compterait,
c'est pourquoi les scripts lancent la commande du kit. Le *hook* d'avant *commit* lance ESLint sur les fichiers indexés sans la
limite : il affiche un avertissement sans arrêter le *commit* ; `verify` et le *pipeline*
l'arrêtent.

Un projet fait par une version antérieure garde ses propres scripts : `init` ajoute un script
qui manque au projet et laisse celui qu'il a, avec une note qui dit ce que le kit attend, et
`npx ddd-ts-kit doctor` liste `lint` et `ci:lint` comme écrits autrement, ce sur quoi
`doctor --strict` n'échoue pas. Son lint reste tel qu'il était jusqu'à ce qu'il prenne les
nouveaux scripts : `npx ddd-ts-kit init --force` (qui écrit chaque fichier et chaque script du
kit par-dessus ceux du projet), ou les deux scripts réglés à la main sur `ddd-ts-kit lint`. Avant
cela, il règle chaque règle qui avertit, de l'une de deux façons :

1. **Corriger les avertissements.** `npx eslint .` les liste.
2. **Les consigner.** Une désactivation en masse d'ESLint (*bulk suppressions*) ne consigne que
   des erreurs (`--suppress-all` n'écrit rien pour un avertissement) : la règle passe d'abord à
   `error`, puis ce qui existe est consigné :
   - une règle du kit par son identifiant dans la clé `rules` de `ddd-ts-kit.config.json`
     ([CONFIG.md](../CONFIG.fr.md)), `"clean/function-size": "error"`, lue par
     `ddd-ts-kit check` et par le *preset* ; relever une sévérité ne demande aucun
     enregistrement de décision ;
   - une règle standard du *preset* dans `eslint.config.mjs`, après le *preset* : une sévérité
     seule garde les options du *preset*. `complexity` est désactivée dans les *specs* : son
     bloc les nomme dans `ignores` (`'**/*.spec.ts'`, `'**/*.test.ts'`, `'**/test/**'`).

```js
import { dddTsKit } from '@ddd-ts-kit/eslint-plugin';

export default [
  ...dddTsKit({ tsconfigRootDir: import.meta.dirname }),
  { files: ['**/*.ts'], rules: { 'max-depth': 'error' } },
];
```

```bash
npx eslint . --suppress-rule max-depth      # une règle ; --suppress-all consigne chaque règle à error
npx eslint . --prune-suppressions           # après la correction d'un constat consigné
```

`--suppress-rule` écrit `eslint-suppressions.json` à la racine du projet, *commité* avec le
changement de sévérité : pour chaque fichier, chaque règle et le nombre de ses constats. Dès lors
`npm run lint` échoue sur un constat au-delà du nombre consigné, de n'importe quelle règle, et sur
une entrée qui ne se produit plus, jusqu'à ce que `--prune-suppressions` la retire : le fichier
ne fait que rétrécir. Une exécution qui laisse des contextes de côté (`--ignore-pattern`, sur une
*pull request*) ne juge pas les entrées des fichiers qu'elle saute. Ajouter une entrée pour
revenir au vert est une désactivation comme une désactivation en ligne : le propriétaire du
projet la décide ([Dérogations](../CONFIG.fr.md#dérogations)).

## Couverture

Les seuils sont un réglage du projet, pas du lanceur de tests : la clé `coverage` de
`ddd-ts-kit.config.json`, par couche, avec la référence comme valeur par défaut, appliquée à
chaque contexte ([CONFIG.md](../CONFIG.fr.md#seuils-de-couverture)). La configuration du lanceur
la lit ; baisser un taux est une dérogation enregistrée ; `test/coverage-governed` refuse une
exclusion écrite à côté. Ce qu'un taux prouve et ce qu'il ne prouve pas :
[Stratégie de test](../concepts/testing-strategy.fr.md#seuils-de-couverture). Le kit se tient
lui-même à un plancher par *package*, le niveau mesuré quand le plancher a été écrit.

## Le formateur

Biome sert à une seule chose : `biome.json`, écrit par `ddd-ts-kit init`, active son formateur et
désactive son linter et son organisateur d'imports. ESLint reste le seul linter, et aucun import
n'est jamais réordonné par un outil. Les réglages sont les mêmes dans le kit, dans l'exemple et
dans chaque projet généré : largeur de ligne 120, deux espaces, LF, guillemets simples, virgules
finales, points-virgules, parenthèses autour du paramètre d'une fonction fléchée.

- Formatés : `.ts`, `.mts`, `.cts`, `.js`, `.mjs`, `.cjs`, `.json`, `.jsonc`.
- Non formatés : le Markdown (un formateur remettrait en forme les tableaux et la prose) et le
  YAML.
- Exclus dans `biome.json` : les sorties de build (`dist`, `coverage`, `reports`), le fichier de
  verrouillage, un répertoire `generated`, les instantanés des migrations (`migrations/meta`),
  l'état que la garde et les *workers* gardent dans `.ddd-ts-kit/` (ignoré par git, et écrit sur
  une ligne), et les artefacts que leur propre contrôle compare octet pour octet
  (`openapi/*.json` et `asyncapi.json` sous `openapi.format: json`, les formulaires de
  `openapi/forms/`, `.dependency-cruiser.cjs`) ; les contrats YAML ne sont de toute façon pas
  formatés. Une ligne de plus n'apparaît que là où elle sert : les sources d'un client généré
  (`clients/*/src`), que `ddd-ts-kit sdk` ajoute à un projet qui demande des clients. Dans le
  kit, `.ddd-ts-kit` contient aussi les exemples compilés de sa documentation.

Ce qu'écrit la CLI est déjà formaté : `npm run format:check` passe juste après `init` et après
chaque `generate`, et la suite de bout en bout de la CLI le tient pour chaque *stack* qu'elle
construit. Le générateur n'a pas de formateur à lui : les *templates* sont écrits comme le
formateur les imprime, avec des mises en page qui ne dépendent pas de la longueur d'un nom là où
c'est possible, si bien qu'un nom très long peut encore laisser une ligne à replier par
`npm run format`.

ESLint et le formateur ne se battent jamais, parce qu'ils décident de choses différentes. Les
préréglages du *plugin* n'activent aucune règle sur l'emplacement d'un jeton ; ils gardent les
deux choses qu'un formateur ne décide pas : les lignes vides entre les instructions
(`clean/blank-lines`) et les accolades d'une branche (`clean/braces`). Lancés dans un ordre ou
dans l'autre, le second outil ne trouve rien à changer.

```ts
// au lieu de : le formateur garde les deux lignes telles quelles, puisque aucune ne casse sa mise en page
if (wrapped.has(repository)) return repository;
const next = steps.shift();

// écrivez : lint --fix ajoute les accolades et la ligne vide, puis le formateur découpe le bloc
if (wrapped.has(repository)) {
  return repository;
}

const next = steps.shift();
```

## Une configuration, trois endroits

`biome.json` à la racine du kit est la source. Le *template* que la CLI copie dans un projet est
comparé avec lui octet pour octet par un test de la CLI, sauf la ligne dont un nouveau projet
n'a pas besoin : celle qui exclut le client généré de l'exemple (`ddd-ts-kit sdk` l'ajoute à un
projet qui demande des clients). L'application d'exemple l'étend au lieu de le copier, si bien que les trois
ne peuvent pas dériver (la moitié droite du dessin en haut de cette page) :

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.15/schema.json",
  "root": false,
  "extends": "//"
}
```
