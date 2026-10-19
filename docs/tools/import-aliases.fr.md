[English](import-aliases.md) · **Français**
<!-- translation-of: import-aliases.md sha256:1037cd49eb55bd83 -->

# Alias d'import : les `paths` de tsconfig, réécrits à la construction

**Résumé.** Un projet construit avec le kit importe ses propres fichiers par un alias, jamais
par un chemin relatif, et sans extension : `@/contexts/billing/domain/aggregates/invoice.aggregate`
au lieu de `../../../domain/aggregates/invoice.aggregate.js`. L'alias de la racine des sources
est `@/`. Il est déclaré une fois, sous `paths` dans `tsconfig.json`, que lisent le compilateur,
l'exécuteur de développement, l'exécuteur de tests, knip et dependency-cruiser. Node ne lit aucun
`tsconfig.json` et ne complète aucune extension : la construction (build) a donc une deuxième
étape. `ddd-ts-kit build-aliases` réécrit chaque alias de la sortie compilée en un chemin
relatif qui se termine par `.js`, et la production tourne avec un simple
`node dist/src/main.js`, sans chargeur (loader), sans option et sans dépendance à l'exécution.
Trois règles le tiennent : `imports/alias-only` (chaque import utilise l'alias, ESLint le
corrige), `imports/extension` (chaque import se termine comme le dit la configuration, ESLint le
corrige) et `imports/alias-declared` (les déclarations, tout ce qui doit les suivre et l'étape de
construction concordent).

## Ce qui est décidé

Un alias est déclaré quelque part, puis résolu par de nombreux outils : le vérificateur de types,
la construction, `node` en production, l'exécuteur de développement, l'exécuteur de tests,
ESLint, `ddd-ts-kit check`, dependency-cruiser, knip. Si deux d'entre eux le résolvent
différemment, rien n'échoue là où l'erreur est commise : la vérification des types passe sur un
fichier pendant que la production en charge un autre, ou une règle de frontière cesse de voir un
import. La décision porte donc moins sur « quel préfixe » que sur « quel mécanisme permet à chaque
outil de suivre une seule déclaration ».

![Une seule déclaration suivie par chaque outil : ddd-ts-kit.config.json nomme l'alias, init en écrit les paths de tsconfig.json, le compilateur, tsx, vitest, knip, dependency-cruiser et drizzle-kit lisent ces paths, jest en reçoit une copie, le plugin ESLint, le checker et build-aliases lisent la configuration, et node ne lit rien parce que la construction a réécrit chaque alias](../assets/diagrams/import-aliases-one-declaration.fr.svg)

Dans un gestionnaire (handler) d'un projet généré, chaque import d'un fichier du projet commence
par l'alias et ne porte aucune extension :

```ts
// src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations'; // un package : jamais réécrit
import { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate';
import type { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository';
import { IssueInvoiceCommand } from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.command';
```

Le chemin après `@/` est le chemin du fichier sous `src/` : déplacer un fichier change ses
imports dans les fichiers qui l'importent, jamais dans le fichier lui-même, et l'import dit quel
contexte et quelle couche il atteint, ce que jugent justement les règles de frontière.

## Pourquoi `@/` ne peut pas être un import de sous-chemin de Node

Node résout de lui-même une seule sorte d'alias : l'import de sous-chemin (subpath import),
déclaré sous le champ `imports` de `package.json`. Son spécificateur doit commencer par `#` :
c'est ainsi que Node le distingue d'un *package*. `@/x.js` commence par `@`, si bien que Node le
lit comme un *package* d'un *scope* vide et échoue (`ERR_MODULE_NOT_FOUND`, « Cannot find
package »). Un projet qui veut `@/` le déclare donc pour le compilateur et le retire avant que
Node ne le voie.

| | `paths` de tsconfig (`@/`) et une réécriture à la construction | imports de sous-chemin de Node (`#name/`) | `paths` de tsconfig et un résolveur à l'exécution |
|---|---|---|---|
| Graphie | libre : `@/` | `#`, puis un nom (Node 22 refuse un `#` seul suivi d'une barre oblique) | libre |
| Déclaré dans | `tsconfig.json` | `package.json` | `tsconfig.json` |
| Un simple `node dist/src/main.js` | oui, une fois que la construction a réécrit les spécificateurs émis | oui, nativement | non : un chargeur ou un *hook* `require` en production |
| Vérification des types, tsx, vitest, knip, drizzle-kit | lisent `paths` | lisent `package.json` ; chaque outil qui lit les sources a besoin d'une condition de résolution, sinon il charge `dist/` | lisent `paths` |
| dependency-cruiser | lit `paths` par son option `tsConfig` | lit `package.json` sous une condition | lit `paths` |
| jest | `moduleNameMapper`, une seconde déclaration | lit `package.json` sous une condition | `moduleNameMapper` |
| Ce qui peut dériver | une correspondance répétée (jest), un outil à qui l'on ne dit plus de lire tsconfig, une construction sans la réécriture | la condition de chaque outil qui lit les sources | chaque correspondance répétée, et une commande de démarrage sans le chargeur |
| Un `dist/` périmé chargé par un outil de développement | impossible : `paths` ne nomme que des sources | possible quand une condition est oubliée | impossible |

Le kit prend la première colonne. La réécriture est une commande du kit, pas un *package* tiers.

## L'extension : écrite nulle part, ou `.js`

`importExtension` dans `ddd-ts-kit.config.json` dit comment se termine l'import d'un fichier du
projet. `init` écrit `none` ; `--import-extension js` demande l'autre graphie, qui est aussi ce
que signifie une configuration sans la clé, si bien qu'un projet généré avant l'existence de la
clé continue de fonctionner sans retouche.

| | `none` (par défaut pour un nouveau projet) | `js` |
|---|---|---|
| Un import | `'@/contexts/billing/domain/aggregates/invoice.aggregate'` | `'@/contexts/billing/domain/aggregates/invoice.aggregate.js'` |
| `tsconfig.json` | `"module": "ESNext"`, `"moduleResolution": "Bundler"`, `"customConditions": ["node"]` | `"module": "NodeNext"`, `"moduleResolution": "NodeNext"` |
| Ce qu'accepte le compilateur | les deux graphies, et un répertoire qui contient un `index.ts` | `.js` seulement (`TS2835` sinon) |
| Qui refuse l'autre graphie | `imports/extension` (*checker* et ESLint), puis `build-aliases` | le compilateur, `imports/extension`, puis `build-aliases` |
| Un fichier qui n'existe pas | `TS2307`, par les deux compilateurs | `TS2307`, par les deux compilateurs |
| Ce qu'émet le compilateur | des modules ECMAScript, le spécificateur tel qu'il est écrit | des modules ECMAScript, le spécificateur tel qu'il est écrit |
| Ce qu'écrit `build-aliases` | `'../../../domain/aggregates/invoice.aggregate.js'` | la même chose |

**Pourquoi Node a besoin de l'extension.** Le chargeur des modules ECMAScript résout un
spécificateur relatif comme une URL : `./invoice.aggregate` est le fichier de ce nom exact, et
rien n'essaie `.js` ni un `index.js` derrière lui (`ERR_MODULE_NOT_FOUND`,
`ERR_UNSUPPORTED_DIR_IMPORT`). Seules les sources peuvent omettre l'extension, parce que chaque
outil qui les lit résout par `paths`, qui la complète. Le compilateur ne réécrit jamais un
spécificateur : l'étape qui transforme déjà un alias en chemin relatif est donc celle qui écrit
l'extension. Comme chaque import du projet est un alias (`imports/alias-only` refuse un import
relatif), cette étape les voit tous.

**Un import nomme un fichier, jamais un répertoire.** Sous `none`, le compilateur résoudrait
`@/contexts/billing/published-language` vers son `index.ts`. Le kit ne le permet pas : l'import
s'écrit `@/contexts/billing/published-language/index`, dans les deux graphies. Un spécificateur
nomme alors un seul fichier, un fichier `x.ts` à côté d'un répertoire `x/` n'est jamais ambigu,
et la construction n'a rien à deviner. `ddd-ts-kit check` signale un import de répertoire
(`imports/extension` : c'est le seul cas qui a besoin du disque, ESLint ne le voit donc pas) et
`build-aliases` le refuse.

```ts
// Au lieu de : un répertoire, que le compilateur résout vers son index.ts et que Node ne résout pas.
import { InvoiceIssued } from '@/contexts/billing/published-language';

// Écrivez : le fichier.
import { InvoiceIssued } from '@/contexts/billing/published-language/index';
```

**Un point n'est pas une extension.** `invoice.aggregate`, `issue-invoice.command` et `main`
s'écrivent tels quels. Seuls `.js`, `.mjs`, `.cjs`, `.ts`, `.mts` et `.cts` sont lus comme une
extension, et seulement sur un spécificateur qui commence par un alias du projet : un
sous-chemin de *package* qui se termine comme un nom de fichier (`zod/v4/core.js`,
`@scope/package/file.js`) n'est jamais jugé ni réécrit.

## La déclaration

Une personne modifie une seule chose : `importAlias` dans `ddd-ts-kit.config.json` (`@/` par
défaut). `init` en écrit la déclaration :

```json
"paths": {
  "@/*": ["./src/*"],
  "$test/*": ["./test/*"],
  "$scripts/*": ["./scripts/*"]
}
```

| Alias | Répertoire | Remarques |
|---|---|---|
| `importAlias`, `@/` par défaut | `sourceRoot` | le seul que la configuration renomme |
| `$test/` | `test/` | ne fait pas partie de la construction : le compilateur n'en émet un fichier que lorsqu'une source livrée l'importe |
| `$scripts/` | `scripts/` | construit avec les sources (`dist/scripts`) |
| `$generated/` | `generated/` | avec `stack.orm` `prisma` seulement : le client que génère Prisma |

`tsconfig.build.json` étend `tsconfig.json` et ne déclare aucun `paths` qui lui soit propre.

### Pourquoi `$test/` et pas `@test/`

`@test/x` est aussi le nom que peut porter un *package* sur le registre (*scope* `test`). Le
risque a été mesuré : avec un *package* placé dans `node_modules/@test/decoy` et un fichier du
projet dans `test/decoy/where.ts`, le compilateur, tsx et vitest ont répondu le fichier du
projet, et dependency-cruiser a répondu le *package*. Il essaie d'abord le spécificateur tel
qu'il est écrit (`where.js`, qui n'existe que dans le *package*) et ne se rabat sur la source
TypeScript que lorsqu'il n'a rien trouvé. Une garde sur `package.json` ne peut pas réparer un
outil qui lit un autre fichier : le kit prend donc des graphies qui ne peuvent pas du tout être
un nom de *package* :

- `@/` : un *scope* a un nom, un *scope* vide ne nomme aucun *package* ;
- `$<name>/` : `$` n'est pas permis dans un nom de *package*. Le registre n'accepte que les noms
  égaux à leur encodage d'URL ; `validate-npm-package-name` répond « name can only contain
  URL-friendly characters » pour `$test`, pour les nouveaux *packages* comme pour les anciens.

SvelteKit écrit ses propres alias de la même façon (`$lib`, `$app`). `importAlias` accepte les
deux formes : `@/`, ou `$`, un nom en minuscules qui commence par une lettre (puis des lettres,
des chiffres, des traits d'union) et `/`. `init` et `check` refusent le reste et disent
pourquoi : `#name/` (un import de sous-chemin de Node, un autre mécanisme), `@name/` (le nom
d'un *scope*), `name/` ou `~/` (des noms de *package* possibles), et `$test/`, `$scripts/`,
`$generated/` (déjà pris).

## Ce que lit chaque outil

| Outil | Ce qu'il lit | Ce que le kit écrit pour lui |
|---|---|---|
| TypeScript 6 et 7 (vérification des types, construction, l'éditeur) | `paths`, `module` et `moduleResolution` de `tsconfig.json` | les entrées ci-dessus, et la résolution que demande `importExtension` |
| `ddd-ts-kit build-aliases` (deuxième étape de `npm run build`) | `importAlias`, `importExtension` et `sourceRoot` de la configuration, `rootDir` et `outDir` de `tsconfig.build.json` | le script `build` l'enchaîne après le compilateur |
| `node` (production, `npm start`, l'image Docker) | rien : la sortie ne contient que des chemins relatifs | rien |
| tsx (`npm run dev`) | `paths`, de lui-même, aussi pour un fichier chargé avec `--import` | rien : le script n'a besoin d'aucune option pour cela |
| vitest | `paths`, une fois qu'on le lui dit | `resolve: { tsconfigPaths: true }` dans ses configurations (natif dans vite 8, sans *plugin*) |
| jest | rien de tsconfig | `moduleNameMapper`, les mêmes entrées, chaque motif se terminant comme les imports : `'^@/(.*)$': '<rootDir>/src/$1.ts'` sous `none`, `'^@/(.*)\\.js$': '<rootDir>/src/$1.ts'` sous `js`. La cible est toujours la source TypeScript |
| dependency-cruiser | `paths`, une fois qu'on le lui dit | `tsConfig: { fileName: 'tsconfig.json' }` dans le `.dependency-cruiser.cjs` généré |
| knip | `paths`, de lui-même | rien |
| drizzle-kit (`npm run db:generate <what-it-does>`) | `paths`, de lui-même, quand il charge le schéma TypeScript | rien : le script est `ddd-ts-kit drizzle-generate --name`, qui lance `drizzle-kit generate --name` à la racine du projet |
| CLI de knex et de TypeORM | la sortie compilée (`npm run build` d'abord) | une migration knex est un fichier JavaScript à la racine du projet : elle nomme le schéma compilé par son chemin relatif sous `dist/` |
| CLI de Prisma | `prisma.config.ts`, qui n'importe aucun fichier du projet | rien |
| ESLint avec `@ddd-ts-kit/eslint-plugin`, `ddd-ts-kit check` | `importAlias`, `importExtension` et `sourceRoot` de la configuration | ils classent un import par son chemin et ne chargent jamais de fichier : avec ou sans son extension, un spécificateur nomme la même source, et les règles de frontière le jugent de la même façon |
| Biome | rien | il formate ; un import corrigé qui dépasse la largeur de ligne est replié par `npm run format` |

Ce que le kit écrit dans les trois outils à qui il faut le dire, tel que `init` le génère sous
`importExtension: "none"` :

```ts
// vitest.config.ts : les specs résolvent un alias à partir des paths de tsconfig.json.
export default defineConfig({
  resolve: { tsconfigPaths: true },
});
```

```js
// jest.config.js : jest ne lit aucun tsconfig, la correspondance est donc répétée, chaque cible est une source.
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/src/$1.ts',
  '^\\$test/(.*)$': '<rootDir>/test/$1.ts',
  '^\\$scripts/(.*)$': '<rootDir>/scripts/$1.ts',
},
```

```js
// .dependency-cruiser.cjs, options : sans elle, aucune règle de frontière ne verrait un import par alias.
tsConfig: { fileName: 'tsconfig.json' },
```

Sous `js`, chaque motif jest se termine par `\\.js$` au lieu de `$`. `imports/alias-declared`
tient les trois (plus bas).

## L'étape de construction

```
npm run build   =   tsc -p tsconfig.build.json && ddd-ts-kit build-aliases
```

(Le script généré appelle le compilateur natif,
`node node_modules/@typescript/native/bin/tsc -p tsconfig.build.json`.)

![Les deux étapes de npm run build : le compilateur transforme la source TypeScript en JavaScript et garde le spécificateur d'alias tel qu'il est écrit, que node seul ne peut pas charger ; ddd-ts-kit build-aliases le réécrit ensuite en un chemin relatif qui se termine par .js, que node dist/src/main.js charge sans chargeur ni option](../assets/diagrams/import-aliases-build-step.fr.svg)

`ddd-ts-kit build-aliases [--project <tsconfig>]` (par défaut `tsconfig.build.json`) lit le
répertoire de sortie de ce tsconfig et, dans chaque `.js`, `.mjs`, `.cjs`, `.d.ts`, `.d.mts` et
`.d.cts` qu'il contient, transforme chaque spécificateur d'alias en chemin relatif du fichier
émis qu'il nomme, toujours avec son extension `.js`, quelle que soit la graphie des sources :

```js
// dist/src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.js
import { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate'; // émis par le compilateur
import { Invoice } from '../../../domain/aggregates/invoice.aggregate.js'; // après la réécriture
```

Le fichier que nomme un spécificateur est calculé, pas cherché : sous `none`, `@/x` est le `x.js`
de la sortie ; sous `js`, c'est `@/x.js` qui l'est. Rien d'autre n'est essayé : pas de
`index.js` derrière un répertoire, pas d'extension ajoutée à un spécificateur écrit dans l'autre
graphie, ni retirée.

Ce qu'elle réécrit : le spécificateur de `import ... from`, de `export ... from`, d'un
`import '...'` seul, de `import('...')` avec une chaîne littérale (attributs compris), de
`require('...')`, de `import.meta.resolve('...')` et, dans les déclarations, de `import type`,
de `typeof import("...")` et de `declare module '...'`.

Comment elle reste exacte. Elle ne cherche pas le préfixe dans le texte. Elle fait tourner
l'analyseur lexical que le *checker* utilise déjà (`packages/cli/src/check/scan`), qui parcourt le
fichier une fois et distingue le code des commentaires, des chaînes, des gabarits littéraux et
des expressions régulières ; une chaîne littérale n'est réécrite que lorsque le code qui la
précède est une position d'import, d'export ou de `import(`. Une chaîne qui ressemble seulement à
un import (à l'intérieur d'une autre chaîne, d'un commentaire, d'un gabarit, d'une expression
régulière, d'une méthode nommée `import`) n'est jamais touchée. La cible est calculée à partir de
`rootDir` et `outDir`, puis recherchée sur le disque.

Elle échoue, sort avec le code 2 et n'écrit rien quand :

- un alias ne nomme aucun fichier émis (`"@/x" names no file the build emitted`) : une faute de
  frappe que le compilateur a déjà signalée, ou un module qui n'a qu'une déclaration ;
- un alias nomme un répertoire (`"@/x" names a directory: an alias names one file, write
  "@/x/index"`) ;
- un alias est écrit dans la graphie que la configuration ne demande pas (`"@/x.js" has an
  extension although "importExtension" is "none": write "@/x"`, et l'inverse sous `js`) ;
- `import()` ou `require()` reçoit un alias complété à l'exécution
  (`` import(`@/handlers/${name}`) ``, `import('@/handlers/' + name)`) : aucun outil ne peut
  connaître le fichier, et Node ne connaît aucun alias. Construisez plutôt le chemin à partir de
  `import.meta.url`, comme le fait le `scripts/events.ts` généré (ce chemin nomme un fichier
  compilé et garde son `.js`) ;
- le tsconfig ne nomme aucun répertoire de sortie qui existe.

```ts
// Au lieu de : un alias complété à l'exécution ; build-aliases le refuse.
const exported = await import(`@/contexts/${context}/published-language/index`);

// Écrivez : une URL calculée depuis l'emplacement de ce fichier, qui nomme le fichier compilé avec son .js.
// Depuis scripts/events.ts, compilé en dist/scripts/events.js, ../src/ est dist/src/.
const index = new URL(`../src/contexts/${context}/published-language/index.js`, import.meta.url);
const exported: unknown = await import(index.href);
```

Elle est idempotente : une seconde exécution ne trouve rien à réécrire. Une réécriture n'ajoute
ni ne retire jamais de saut de ligne, et les *source maps* ne sont pas modifiées : chaque
correspondance garde sa ligne et `sources` n'est pas touché. Sur la ligne d'un spécificateur
réécrit, ce qui le suit (le `;` final d'un import statique) se décale de la différence de
longueur, que la *source map* n'enregistre pas.

## Ce qui a été mesuré

Sur Node 24.21.0, TypeScript 6.0.3 et le TypeScript natif 7.0.2, tsx 4.23.15, vitest 5.0.3
(vite 8.3.4), knip 6.41.0, dependency-cruiser 18.5.0 ; à la main, hors du *workspace*, jest
30.5.2, drizzle-kit 0.31.11 et TypeORM 1.1.2. La suite de bout en bout le rejoue sur chaque
*stack* dans la graphie par défaut, sans extension, et sur trois *stacks* écrites avec `.js` ;
les preuves qui concernent un seul outil sont rejouées dans les deux graphies. La CI fait tourner
la partie exécution sur Node 22 également (`npm run ci:test:alias`).

- **Compilée et non réécrite, la sortie ne s'exécute pas** : un simple `node` s'arrête au premier
  alias. **Réécrite, elle s'exécute** : chaque module compilé d'un projet généré et de l'exemple
  se lie, l'application, le *worker* et un contexte lancé seul démarrent, et aucun alias ne reste
  dans un `.js` ni dans un `.d.ts`. Node lui-même ne complète aucune extension :
  `import('./dist/src/main')` échoue là où `./dist/src/main.js` se charge.
- **Les deux compilateurs** font correspondre `@/x` à `src/x.ts` sous `Bundler`, et `@/x.js` à
  `src/x.ts` sous `NodeNext` (`--explainFiles`), jamais à `dist/` ; tous deux signalent `TS2307`
  pour un spécificateur qui ne nomme aucun fichier, dans les deux graphies ; tous deux vérifient
  les types de chaque *stack* et des deux modes de décorateurs.
- **tsx** résout `@/x` (et `@/x.js`) vers `src/x.ts` sans option, aussi quand une copie compilée
  existe et aussi pour un module chargé par `--import ./src/platform/observability/tracing.ts`.
- **vitest** avec `resolve.tsconfigPaths` exécute une *spec* sur la source bien qu'une copie
  compilée existe ; sans lui, la *spec* échoue à son premier import. Le *plugin* de décorateurs de
  `@ddd-ts-kit/testing/vitest` compile un fichier dont les imports ne portent aucune extension
  comme il le faisait avant.
- **jest** avec le `moduleNameMapper` généré charge la source bien qu'une copie compilée existe,
  dans les deux graphies ; sans lui, « Cannot find module '@/alias-probe' ».
- **dependency-cruiser** suit l'alias jusqu'à la source et ne retient aucun module sous `dist/` ;
  les règles de frontière signalent un import par alias exactement comme un import relatif, avec
  ou sans son extension.
- **knip** signale un fichier inutilisé et un export inutilisé derrière l'alias, et rien pour un
  fichier qui n'est importé que par son alias.
- **drizzle-kit** génère une migration à partir d'un schéma qui réexporte des tables par leur
  alias, écrit sans extension, et échoue une fois `paths` retiré.
- **TypeORM, knex et Prisma** ne lisent aucun TypeScript du projet par un alias : la CLI de
  TypeORM charge la source de données compilée (réécrite, donc un simple `node` la charge), une
  migration knex est un fichier JavaScript qui nomme le schéma compilé par un chemin relatif avec
  son `.js`, et `prisma.config.ts` n'importe aucun fichier du projet.
- Un `dist/` périmé ne peut pas être chargé par un outil de développement : `paths` ne nomme que
  des sources, et un outil qui ignore `paths` échoue au lieu de se rabattre sur la sortie.

## Les trois règles

`imports/alias-only` : sous la racine des sources, `test/` et `scripts/`, un `import`, un
`export ... from` ou un `import()` d'un fichier du projet utilise l'alias. Un spécificateur
relatif est refusé, même dans le même répertoire, et de même un chemin d'alias qui contient un
segment `.` ou `..`. `eslint --fix` réécrit un import relatif : il calcule l'alias à partir de
l'emplacement du fichier et de la configuration. Un chemin d'alias qui contient un segment `.` ou
`..` est signalé sans correction automatique : vous réécrivez à la main le chemin depuis le
répertoire de l'alias. Non jugés : un fichier JavaScript à la racine du
projet (une configuration d'outil, une migration knex, que Node exécute telle qu'elle est écrite
et qui utilise donc des chemins relatifs), et le client sous `generated/`. Un répertoire donné à
`discoverContext` sous forme d'URL n'est pas un import.

```ts
// src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts
// Au lieu de : des chemins relatifs, qui changent quand le fichier se déplace.
import { Invoice } from '../../../domain/aggregates/invoice.aggregate';
import { IssueInvoiceCommand } from './issue-invoice.command';
import { Money } from '@/shared-kernel/../shared-kernel/money'; // un segment `..` dans un alias

// Écrivez : l'alias, calculé à partir de l'emplacement du fichier (`eslint --fix` réécrit ces deux-là).
import { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate';
import { IssueInvoiceCommand } from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.command';
// Le segment `..` n'a pas de correction automatique : réécrivez-le à la main, depuis le répertoire de l'alias.
import { Money } from '@/shared-kernel/money';
```

`imports/extension` : dans les trois mêmes arborescences, un spécificateur d'alias se termine
comme le dit `importExtension`. Sous `none`, il ne porte aucune de `.js`, `.mjs`, `.cjs`, `.ts`,
`.mts`, `.cts`, et ne nomme aucun répertoire (seul le *checker* voit ce cas) ; sous `js`, il se
termine par `.js`. `eslint --fix` retire ou écrit l'extension. Sous `js`, le compilateur tient la
même chose (`TS2835`) ; sous `none`, rien d'autre ne la tient avant la construction, puisque la
résolution de type *bundler* accepte les deux.

```ts
// Au lieu de, sous "importExtension": "none" :
import { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate.js';

// Écrivez :
import { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate';

// Et sous "importExtension": "js", dans l'autre sens :
import { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate.js';
```

`imports/alias-declared`, tenue par `ddd-ts-kit check`, compare les déclarations et chaque
endroit qui doit les suivre. Par exemple, dans `tsconfig.json` :

```jsonc
// Au lieu de : un baseUrl, et une cible qui nomme la sortie compilée.
"baseUrl": ".",
"paths": { "@/*": ["./dist/src/*"] }

// Écrivez : exactement ce que donne importAlias, et rien d'autre sous un alias du projet.
"paths": {
  "@/*": ["./src/*"],
  "$test/*": ["./test/*"],
  "$scripts/*": ["./scripts/*"]
}
```

Ce qu'elle signale :

| Elle signale | Parce que |
|---|---|
| un `importAlias` qui n'est ni `@/` ni `$<name>/`, ou qui est `$test/`, `$scripts/`, `$generated/` | il pourrait être un nom de *package*, c'est un autre mécanisme (`#`), ou il nomme un autre répertoire ; `init` le refuse aussi |
| une entrée `paths` de `tsconfig.json` absente, ou qui n'est pas exactement ce que donne `importAlias` (par exemple une entrée qui nomme `dist/`) | c'est la déclaration que lisent le compilateur et les outils |
| une autre entrée `paths` sous un alias du projet | la construction réécrit à partir de `importAlias` seul : la sortie chargerait un autre fichier que celui qui a été vérifié |
| un `baseUrl` | chaque cible de `paths` serait résolue à partir de lui |
| un `tsconfig.build.json` dont les `paths` ou le `baseUrl` diffèrent de `tsconfig.json` | la construction ne compilerait pas ce qui a été vérifié |
| `module` et `moduleResolution` de `tsconfig.json`, ou d'un `tsconfig.build.json` qui fixe les siens, qui ne sont pas ce que donne `importExtension` (`ESNext`, `Bundler` et `customConditions` contenant `node` sous `none` ; sous `js`, une valeur écrite qui n'est pas `Node16`, `Node18`, `Node20` ni `NodeNext`) | sous l'autre résolution, le compilateur refuse chaque import du projet, ou accepte une graphie que la construction ne réécrit pas ; un autre format de module ne serait pas les modules ECMAScript que complète la construction |
| un script qui compile (`tsc` sans `--noEmit`) et ne lance pas `build-aliases` ensuite | la sortie s'arrêterait sous `node` à son premier import : aucun alias, et sous `none` aucune extension non plus |
| un script qui lance `tsx` avec `--tsconfig` sur un autre fichier | l'exécuteur de développement lirait une déclaration que rien ne compare |
| une configuration `vitest` à la racine du projet sans `tsconfigPaths: true` (une configuration qui en étend une autre du projet est lue comme la portant) | les *specs* ne résoudraient pas un alias |
| une configuration `jest` à laquelle manque l'une des entrées `moduleNameMapper` dérivées, qui la fait correspondre ailleurs, ou dont le motif ne se termine pas comme les imports | jest ne lit aucun tsconfig : c'est la seule correspondance répétée |
| un `.dependency-cruiser.cjs` sans `tsConfig: { fileName: 'tsconfig.json' }` | les règles de frontière ne verraient rien ; `ddd-ts-kit depcruise-config --check` signale le même fichier |
| une entrée `paths` de `knip.json` sous un alias | une seconde déclaration |

Les règles de frontière elles-mêmes (`layer/*`, `context/*`) résolvent un alias exactement comme
un chemin relatif, dans le *checker* et dans le *plugin* ESLint : une même table d'imports
interdits est rejouée contre les deux, dans les deux graphies.

Un alias qui ne nomme aucun fichier est signalé par le compilateur (`TS2307`), par
dependency-cruiser (le module ne se résout vers rien), par knip (import non résolu) et par
`build-aliases`.

## Passer un projet existant aux imports sans extension

Un projet généré avant l'existence d'`importExtension` n'a pas cette clé : elle est lue comme
`js`, et rien n'a à changer. Pour le faire passer : fixez `"importExtension": "none"`, écrivez
les `module`, `moduleResolution` et `customConditions` que `ddd-ts-kit check` demande alors (et
la correspondance jest, sous jest), lancez `eslint --fix` et `npm run format`, puis
`ddd-ts-kit docs` pour les *barrels* de déclarations, et `npm run verify`. Sur l'application
d'exemple de ce dépôt, la correction a réécrit 2101 imports dans 561 fichiers, et le formateur a
ensuite remis sur une seule ligne les quelques instructions qui y tenaient de nouveau.

## Limites

- Sous `none`, le compilateur résout comme le fait un *bundler*, pas comme le fait Node. Il
  vérifie toujours que chaque import nomme un fichier et que chaque nom existe, mais il ne modélise
  plus la façon dont Node charge un *package* CommonJS depuis un module ECMAScript : un import par
  défaut d'un *package* que Node livrerait sous la forme `{ default: ... }` passe la vérification
  des types et échoue à l'exécution, là où `NodeNext` le signale. Ce qui le tient, c'est
  l'exécution : les *specs* s'exécutent sur Node, et la suite de bout en bout lie chaque module
  compilé de chaque *stack* sous un simple `node`. Une équipe qui veut que le compilateur modélise
  Node exactement garde `"importExtension": "js"`.
- La résolution de type *bundler* lit les `exports` d'un *package* sans la condition `node` : un
  *package* qui publie une entrée pour Node et une autre pour le reste serait vérifié contre la
  mauvaise (mesuré sur les deux compilateurs). Le `tsconfig.json` généré fixe donc
  `"customConditions": ["node"]`, et `imports/alias-declared` signale son retrait.
- Seul un module que la construction émet peut être nommé par un alias dans le code livré. Un
  fichier JSON ou une autre ressource se lit à l'exécution, il ne s'importe pas.
- Un fichier JavaScript que Node exécute tel qu'il est écrit (une configuration, une migration
  knex) ne peut pas utiliser l'alias : rien ne le réécrit.
- `tsc --watch` seul laisse les alias dans `dist/` : une sortie compilée est produite par
  `npm run build`. Le développement exécute les sources (`npm run dev`), pas `dist/`.
- Après une réécriture, une *source map* nomme toujours la bonne ligne ; la colonne de ce qui suit
  un spécificateur réécrit sur la même ligne est décalée de la différence de longueur.
- Renommer l'alias d'un projet existant demande trois modifications, pas une commande :
  `importAlias` dans la configuration, l'entrée `paths` (la correction d'`imports/alias-declared`
  la donne), et un rechercher-remplacer du préfixe dans les sources.
- Un outil que le kit ne connaît pas et qui charge lui-même les sources TypeScript doit lire les
  `paths` de `tsconfig.json` ou recevoir la correspondance ; `check` connaît tsx, vitest, jest,
  dependency-cruiser et knip.

## Recommandation

Gardez `@/`, et gardez la graphie par défaut, sans extension. Passez
`--import-alias '$<name>/'` à `init` seulement quand `@/` est déjà pris par autre chose dans le
projet, et `--import-extension js` seulement quand le compilateur doit résoudre exactement comme
le fait Node. Lancez `eslint --fix` puis `npm run format` pour faire passer le code existant, et
laissez `ddd-ts-kit check` dire ce qui reste.
