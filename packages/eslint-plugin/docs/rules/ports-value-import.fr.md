[English](ports-value-import.md) · **Français**
<!-- translation-of: ports-value-import.md sha256:84a37501770a4462 -->

# ddd-ts-kit/ports-value-import

Identifiant d'architecture : `ports/value-import`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`. Corrigeable avec `--fix`.

S'applique à : chaque fichier passé au lint.

## Pourquoi

La classe abstraite d'un port est une valeur : c'est ce qu'un conteneur lie et résout. `import type` l'efface à la compilation du fichier, si bien qu'une liste de dépendances qui nomme un import de type seul n'a rien à nommer à l'exécution.

## Signalé

- un nom d'une liste de dépendances importé avec `import type { X }` ou `import { type X }`
- le premier argument de `bind` ou de `rebind` importé de cette façon

Incorrect :

```ts
import type { Clock } from '@ddd-ts-kit/kernel';

@CommandHandler(IssueInvoiceCommand, [Clock])
export class IssueInvoiceHandler {}
```

Correct :

```ts
import { Clock } from '@ddd-ts-kit/kernel';

@CommandHandler(IssueInvoiceCommand, [Clock])
export class IssueInvoiceHandler {}
```

## Détails

Une liste de dépendances est le tableau qui nomme ce que reçoit un constructeur : le dernier argument d'un décorateur de déclaration de `@ddd-ts-kit/kernel/declarations` (`@CommandHandler(M, [..])`, `@QueryHandler`, `@IntegrationEventHandler`, `@DomainEventHandler`, `@Scheduled`, `@Repository`, `@Gateway`, `@Adapter`, `@Policy`) et le second argument de `.toClass(C, [..])` et de `.handledBy(H, [..])` de `@ddd-ts-kit/di`.

Un appel de liaison est `bind`, `rebind`, `resolve`, `fake` ou `override`, seul ou comme membre (`builder.bind(X)`, `app.resolve(X)`), et n'est lu que dans un fichier qui importe quelque chose de `@ddd-ts-kit/di` ; `Promise.resolve`, `path.resolve`, `require.resolve` et `import.meta.resolve` ne sont jamais des appels de liaison. Cette règle ne lit que `bind` et `rebind`.

**La correction.** `import { type X }` perd son mot-clé ; `import type { X, Y }` devient `import { X, type Y }`, que `@typescript-eslint/consistent-type-imports` sépare ensuite si le projet demande des imports de type à part.

## Options

Aucune.

`rules."ports/value-import"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line ports/value-import -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Le compilateur signale la même erreur (un type employé comme valeur) quand le fichier est vérifié par le typage ; cette règle la signale pendant l'écriture et la corrige.
- Un import par défaut ou un import d'espace de noms n'est pas réécrit par la correction quand la déclaration est `import type`.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir du texte du fichier. Cette règle fait autorité, et elle seule corrige.
