[English](imports-alias-only.md) · **Français**
<!-- translation-of: imports-alias-only.md sha256:6ba4c7970c915372 -->

# ddd-ts-kit/imports-alias-only

Identifiant d'architecture : `imports/alias-only`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`. Corrigeable (`eslint --fix`).

S'applique à : chaque fichier TypeScript sous la racine des sources, sous `test/` et sous `scripts/`.

## Pourquoi

Un alias nomme un fichier depuis la racine du projet. L'import se lit de la même façon depuis chaque fichier, dit quel contexte et quelle couche il atteint sans compter les `../`, et ne change pas quand le fichier qui importe se déplace. Une seule graphie signifie aussi une seule chose à relire : les règles de couche et de contexte de ce *plugin*, `ddd-ts-kit check` et dependency-cruiser résolvent un alias exactement comme un chemin relatif, si bien qu'une frontière n'est jamais franchie en choisissant l'autre graphie.

L'alias est déclaré une fois, sous `paths` dans `tsconfig.json`, que lisent le compilateur et les outils. Node ne lit aucun alias : `ddd-ts-kit build-aliases`, la deuxième étape de `npm run build`, réécrit chaque alias de la sortie compilée en un chemin relatif, si bien que la sortie s'exécute avec un simple `node` : pas de chargeur, pas de dépendance à l'exécution. Voir [Alias d'import](../../../../docs/tools/import-aliases.fr.md).

## Signalé

- un spécificateur relatif, `./x` ou `../x`, avec ou sans extension, même répertoire compris : corrigé vers l'alias du fichier
- un spécificateur relatif qui nomme un fichier hors de tout répertoire doté d'un alias (un manifeste, un produit de la construction) : signalé, non corrigé
- un spécificateur d'alias avec un segment `.` ou `..`, qui pourrait nommer un fichier hors du répertoire de l'alias : signalé, non corrigé

Incorrect :

```ts
// src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts
import { Invoice } from '../../../domain/aggregates/invoice.aggregate';
import { IssueInvoiceCommand } from './issue-invoice.command';

// test/e2e/issue-invoice.e2e.spec.ts
import { startApplication } from './support/start-application';
```

Correct :

```ts
// src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts
import { IssueInvoiceCommand } from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.command';
import { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate';

// test/e2e/issue-invoice.e2e.spec.ts
import { startApplication } from '$test/e2e/support/start-application';
```

## Détails

Les imports statiques, les imports de type seul, `export ... from`, `export *`, les `import()` dynamiques, les types `import()` et `require()` sont tous lus. Un import dynamique dont le spécificateur est calculé n'est pas jugé.

Les alias d'un projet :

| Alias | Répertoire | Déclaré par |
|---|---|---|
| `importAlias` de `ddd-ts-kit.config.json`, `@/` par défaut | `sourceRoot` | la configuration |
| `$test/` | `test/` | fixe |
| `$scripts/` | `scripts/` | fixe |
| `$generated/` | `generated/`, avec `stack.orm` `prisma` seulement | fixe |

La correction calcule l'alias à partir de l'emplacement du fichier et de la configuration : le spécificateur relatif est résolu depuis le répertoire du fichier, et le résultat est écrit depuis le répertoire que nomme son alias, avec la terminaison que dit `importExtension` de la configuration : rien sous `none`, `.js` sous `js` (une configuration sans la clé). Elle garde les guillemets du spécificateur. Un import corrigé est souvent plus long que la ligne : lancez le formateur après la correction (`npm run format`). Corriger deux fois ne change rien.

Ne sont pas jugés : un fichier hors des trois répertoires (un fichier de configuration à la racine du projet, une migration JavaScript), le client sous `generated/`, qu'un outil écrit, et un spécificateur qui n'est ni relatif ni l'un des alias (un *package*, un module natif de Node).

Un alias qui ne nomme aucun fichier n'est pas l'affaire de cette règle : le compilateur le signale (`TS2307`), et la construction le refuse (`ddd-ts-kit build-aliases`).

## Options

Aucune. `sourceRoot` et `importAlias` de `ddd-ts-kit.config.json` disent quel est l'alias des sources, `importExtension` par quoi se termine le spécificateur corrigé.

`rules."imports/alias-only"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line imports/alias-only -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Seul un module qu'émet la construction peut être nommé par l'alias : un fichier JSON ou une autre ressource se lit à l'exécution au lieu d'être importé.
- La terminaison d'un spécificateur d'alias est l'affaire de [`imports/extension`](imports-extension.fr.md).
- La règle ne vérifie pas que `tsconfig.json` déclare l'alias, ni que la construction le réécrit : c'est le rôle de `imports/alias-declared` de `ddd-ts-kit check`, avec tout ce qui doit suivre cette déclaration unique.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir des spécificateurs d'import qu'il lit dans le texte des fichiers, sous la racine des sources, `test/` et `scripts/`, et donne dans sa phrase de correction l'alias à écrire. Cette règle est celle qui réécrit l'import.
