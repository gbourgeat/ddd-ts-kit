[English](clean-one-export-per-file.md) · **Français**
<!-- translation-of: clean-one-export-per-file.md sha256:b032f0f9386af400 -->

# ddd-ts-kit/clean-one-export-per-file

Identifiant d'architecture : `clean/one-export-per-file`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : les sources sous la racine des sources (dans un *workspace*, sous le répertoire `src` d'un *package*). Les tests (`*.spec.ts`, `*.test.ts`, un répertoire `test/`) et les fichiers de déclaration ne sont pas jugés.

## Pourquoi

Un fichier qui exporte une seule chose se trouve par son nom, se lit d'une traite et se déplace sans rien démêler. Les compagnons qu'il peut garder sont les types de sa propre signature : ils n'ont pas de vie sans elle. Les fichiers d'entrée sont l'inverse : ils ne déclarent rien, pour que la carte d'un *package* reste une carte.

## Signalé

- un fichier qui exporte au moins deux classes, interfaces ou fonctions qui ne forment pas une seule chose (les tolérances sont plus bas)
- un fichier qui ne porte pas le nom de son export en kebab-case
- dans un fichier d'entrée (`index.ts` à toute profondeur, `<context>.declarations.ts`, les fichiers de l'option `entries`) : toute instruction qui n'est pas une réexportation

Incorrect :

```ts
// src/platform/collaborators.ts
export function loggerOr(given?: Logger): Logger {}
export function clockOr(given?: Clock): Clock {}

// src/platform/event-bus.ts
export class RabbitMqEventBus {}

// src/platform/index.ts
export const VERSION = '1.0.0';
```

Correct :

```ts
// src/platform/retry.ts : une fonction et le type de sa signature
export interface RetryOptions {
  readonly attempts: number;
}

export function retry(options: RetryOptions): Aspect {}

// src/platform/rabbit-mq-event-bus.ts
export class RabbitMqEventBus {}

// src/platform/index.ts
export { retry, type RetryOptions } from '@/platform/retry';
```

## Détails

**Ce qui est compté.** Les noms distincts des classes (abstraites ou non), des interfaces et des fonctions exportées. Une `const`, un `type` ou un `enum` exporté n'est jamais compté, les surcharges d'une fonction comptent une fois, et une fonction qui partage son nom avec une interface ou un type (`CommandHandler` le décorateur et `CommandHandler<M>` la forme qu'il décore) compte une fois. Un fichier sans export compté n'est pas jugé du tout, ni pour son compte ni pour son nom.

**Ce qui peut cohabiter.** Deux exports comptés ou plus sont acceptés quand l'une de ces conditions est vraie :

| Tolérance | Règle |
|---|---|
| les types de la signature | chaque autre export compté est une interface atteinte depuis la signature d'un export du fichier : les paramètres et le type de retour d'une fonction (chaque surcharge), le constructeur, les membres publics et la liste `implements` d'une classe, les membres d'une interface ou d'un alias de type, et de là à travers les interfaces et les alias de type du fichier. `type Result = Ok \| Err` avec ses deux interfaces est ce cas |
| une forme dérivée | une fonction nommée d'après la fonction principale avec un suffixe et appelée par elle (`retryAdvice` à côté de `retry`) cohabite avec elle, avec les types de sa propre signature |
| un type et ses constructeurs ou combinateurs | chaque fonction exportée renvoie un même type, déclaré par le fichier ou importé par lui (`allOf`, `anyOf`, `not` qui renvoient `Condition`) ; quand ce type est une union du fichier, une fonction peut renvoyer l'un de ses membres |
| les accesseurs d'un même état privé | chaque fonction exportée lit ou écrit une variable de niveau module qui n'est pas exportée (un `let`, ou une `const` qui contient un `new ..`), et ces variables lient les fonctions en un seul groupe (`sequence` et `resetSequences` autour de `const counters = new Map()`) |

Tout le reste se déclare, avec la phrase qui dit pourquoi les exports sont une seule chose, dans `onePerFile.allow` de `ddd-ts-kit.config.json` ou dans l'option `allow`.

**Le nom du fichier.** Le nom de base sans son extension, où chaque `.` se lit `-`, est le kebab-case de l'export : `rabbit-mq-event-bus.ts` pour `RabbitMqEventBus`, `standard-schema-v1.ts` pour `StandardSchemaV1`, `http-server.ts` pour `HTTPServer`, `issue-invoice.handler.ts` pour `IssueInvoiceHandler`. Dans un fichier de rôle `<name>.<role>.ts` dont l'export ne se termine pas par le mot du rôle, la partie avant le premier point est le nom : `invoice.aggregate.ts` pour `Invoice`, `payment-gateway.port.ts` pour `PaymentGateway`. Un produit s'écrit dans le nom du fichier comme la classe l'écrit.

L'export qui donne son nom au fichier est celui qui est compté ; avec les types d'une signature, tout export qui contient les autres dans sa signature (`job-run-observer.ts` pour un `type JobRunObserver` qui prend l'`interface JobRunDetail` exportée) ; avec un type et ses constructeurs, le type quand le fichier le déclare. Une famille qu'aucun export ne nomme (les accesseurs d'un état, les combinateurs d'un type importé) se nomme librement. Un fichier admis par `allow` porte le nom de l'un de ses exports.

**Les fichiers d'entrée** peuvent contenir `export .. from`, `export * from`, `export type .. from`, un import pour son effet de bord (`import 'reflect-metadata';`) et le `export {};` vide d'un *package* qui n'exporte encore rien, rien d'autre. Ils sont exemptés du compte et du nom.

## Options

| Option | Défaut | Sens |
|---|---|---|
| `allow` | `[]` | `[{ "file": "<path or glob>", "reason": "<why these exports are one thing>" }]`, ajouté à `onePerFile.allow` de la configuration ; un fichier admis est exempté du compte, jamais de son nom |
| `entries` | `[]` | les globs des fichiers d'entrée en plus de chaque `index.ts` et de `<contextsDir>/*/*.declarations.ts` : les entrées de sous-chemin d'un *package* (`packages/*/src/testing.ts`) |

Les chemins et les globs sont au format posix, relatifs à la racine du projet (le répertoire de `ddd-ts-kit.config.json`, sinon le répertoire de travail) : `**` traverse les répertoires, `*` reste dans un seul, `?` est un caractère. Une entrée de `allow` sans `file` ou sans `reason` n'admet rien.

`rules."clean/one-export-per-file"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line clean/one-export-per-file -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- La signature est lue dans la syntaxe, sans les types : un type atteint seulement par un type de retour inféré ou par un type d'un autre fichier n'est pas vu comme un compagnon. Écrivez le type de retour.
- Seules les interfaces sont des compagnons : une deuxième classe ou une deuxième fonction n'est jamais excusée par une signature.
- Une réexportation (`export { a } from`) dans un fichier qui déclare aussi quelque chose n'est ni comptée ni signalée.

## Avec le checker de la CLI

`ddd-ts-kit check` tient le même compte, la même liste `allow`, la règle des fichiers d'entrée et le nom du fichier, avec une approximation textuelle des tolérances. Cette règle fait autorité.
