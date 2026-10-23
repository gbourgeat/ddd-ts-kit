[English](imports-extension.md) · **Français**
<!-- translation-of: imports-extension.md sha256:55e7cd0722a12793 -->

# ddd-ts-kit/imports-extension

Identifiant d'architecture : `imports/extension`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`. Corrigeable (`eslint --fix`).

S'applique à : chaque fichier TypeScript sous la racine des sources, sous `test/` et sous `scripts/`.

## Pourquoi

Un import d'un fichier du projet a une seule graphie. `importExtension` dans `ddd-ts-kit.config.json` dit laquelle :

| `importExtension` | Un import s'écrit | Le compilateur le résout | Qui tient l'autre graphie |
|---|---|---|---|
| `none`, la valeur par défaut d'un nouveau projet | `@/contexts/billing/domain/aggregates/invoice.aggregate` | comme le fait un bundler (`"moduleResolution": "Bundler"`, avec la condition `node`), qui accepte les deux graphies | cette règle : le compilateur laisserait passer `.js` |
| `js`, aussi ce que signifie une configuration sans la clé | `@/contexts/billing/domain/aggregates/invoice.aggregate.js` | comme le fait Node (`"moduleResolution": "NodeNext"`), qui exige l'extension | le compilateur (`TS2835`), et cette règle, qui la corrige |

Node a besoin de l'extension à l'exécution, quoi qu'écrivent les sources : `ddd-ts-kit build-aliases`, la deuxième étape de `npm run build`, réécrit chaque alias de la sortie compilée en un chemin relatif qui se termine par `.js`. La construction nomme un fichier par spécificateur et ne devine rien, si bien qu'un spécificateur écrit dans l'autre graphie l'arrête : cette règle signale l'erreur dans l'éditeur à la place. Voir [Alias d'import](../../../../docs/tools/import-aliases.fr.md).

## Signalé

- sous `none` : un spécificateur d'alias qui se termine par `.js`, `.mjs`, `.cjs`, `.ts`, `.mts` ou `.cts` : corrigé en retirant l'extension
- sous `js` : un spécificateur d'alias qui ne se termine pas par `.js` (`.mjs` et `.cjs` sont acceptés, ils nomment ce qu'émet un fichier `.mts` ou `.cts`) : corrigé en écrivant `.js` à la place de sa terminaison

Incorrect sous `none` :

```ts
import { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate.js';
import { startApplication } from '$test/e2e/support/start-application.ts';
```

Correct sous `none` :

```ts
import { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate';
import { startApplication } from '$test/e2e/support/start-application';
```

Incorrect sous `js` :

```ts
import { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate';
```

Correct sous `js` :

```ts
import { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate.js';
```

## Détails

Les imports statiques, les imports de type seul, `export ... from`, `export *`, les `import()` dynamiques, les types `import()` et `require()` sont tous lus. Un import dynamique dont le spécificateur est calculé n'est pas jugé.

Seul un spécificateur qui commence par un alias du projet est jugé (`importAlias`, `$test/`, `$scripts/`, et `$generated/` avec `stack.orm` `prisma`). Un *package* n'est jamais un fichier du projet, quelle que soit la fin de son sous-chemin : `zod/v4/core.js` et `@scope/package/file.js` sont laissés tranquilles, de même qu'un module natif de Node. Un import relatif est signalé par [`imports/alias-only`](imports-alias-only.fr.md), dont la correction écrit l'alias avec la bonne terminaison.

Un point dans un nom de fichier n'est pas une extension : `invoice.aggregate`, `issue-invoice.command` et `load-config` se lisent tous comme écrits sans extension.

La correction garde les guillemets du spécificateur. Sous `none`, un import corrigé est plus court de trois caractères et peut désormais tenir sur une ligne : lancez le formateur après la correction (`npm run format`). Corriger deux fois ne change rien.

Ne sont pas jugés : un fichier hors des trois répertoires (un fichier de configuration à la racine du projet, une migration JavaScript, que Node exécute telle qu'elle est écrite et qui garde donc ses extensions) et le client sous `generated/`, qu'un outil écrit.

## Faire passer un projet à l'autre graphie

Un projet généré avant que la clé existe est lu comme `js` et continue de fonctionner sans retouche. Pour abandonner les extensions :

1. posez `"importExtension": "none"` dans `ddd-ts-kit.config.json` ;
2. lancez `ddd-ts-kit check` : `imports/alias-declared` donne les `module`, `moduleResolution` et `customConditions` à écrire dans `tsconfig.json`, et la correspondance jest quand le projet utilise jest ;
3. lancez `eslint --fix`, puis `npm run format` ;
4. régénérez ce que le kit génère (`ddd-ts-kit generate` ou `ddd-ts-kit docs` réécrit les *barrels* de déclarations), puis `npm run verify`.

## Options

Aucune. C'est `importExtension` de `ddd-ts-kit.config.json` qui décide.

`rules."imports/extension"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line imports/extension -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Un spécificateur qui nomme un répertoire (`@/contexts/billing/published-language`, résolu par un bundler vers son `index.ts`) est accepté sous `none` : `ddd-ts-kit build-aliases` le complète avec `/index.js`.
- La règle ne vérifie pas que `tsconfig.json` résout comme le dit la configuration : c'est le rôle de `imports/alias-declared` de `ddd-ts-kit check`.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir des spécificateurs d'import qu'il lit dans le texte des fichiers, sous la racine des sources, `test/` et `scripts/`, donne dans sa phrase de correction le spécificateur à écrire. Cette règle est celle qui réécrit l'import.
