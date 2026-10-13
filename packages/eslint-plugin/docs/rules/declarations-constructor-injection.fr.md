[English](declarations-constructor-injection.md) · **Français**
<!-- translation-of: declarations-constructor-injection.md sha256:d67001ce6ec9842c -->

# ddd-ts-kit/declarations-constructor-injection

Identifiant d'architecture : `declarations/constructor-injection`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : chaque fichier de rôle d'un contexte dans un projet de style déclaré (`stack.style: "declared"` dans `ddd-ts-kit.config.json`), tests exclus. Rien n'est signalé dans un projet de style explicite, où le fichier de module liste ce que reçoit chaque classe.

## Pourquoi

La signature du constructeur est la seule déclaration de ce dont dépend une classe déclarée. `ddd-ts-kit docs` la lit et écrit, dans le fichier généré du contexte, la liste que la racine de composition injecte : rien n'est répété dans le décorateur, et rien ne peut contredire le constructeur. Cela ne fonctionne que si chaque paramètre nomme exactement un jeton d'injection, et un jeton est une classe : une interface, un alias de type ou un type primitif est effacé par le compilateur ; une union nomme deux choses ; un paramètre optionnel ou doté d'une valeur par défaut dit que le conteneur pourrait ne rien donner, alors qu'il donne toujours une valeur.

On ne demande pas les types au compilateur à l'exécution. `emitDecoratorMetadata` n'existe qu'avec les décorateurs historiques compilés par `tsc` ou par swc avec son option : les décorateurs standard n'en ont pas, `tsx` et esbuild n'en émettent pas, et un port importé avec `import type` est enregistré comme `Object`.

## Signalé

Sur la classe d'un fichier de rôle qui porte un décorateur de déclaration autre que `@Requires` et `@Public`, quand le décorateur ne liste aucune dépendance :

- un paramètre de constructeur optionnel, doté d'une valeur par défaut, variadique (rest) ou déstructuré
- un paramètre de constructeur sans type, ou typé par autre chose qu'un seul nom de classe, arguments de type mis à part (`Cache<Session>` nomme `Cache`) : une union, une intersection, un tableau, une fonction, un littéral, un type objet, un nom qualifié
- un paramètre de constructeur typé par un type du langage (`string`, `number`, `Date`, `Map`...) ou par une interface, un alias de type ou un enum que déclare le fichier

Sous `"stack.dependencies": "signature"`, quand le décorateur porte une liste et que la classe écrit son constructeur (ou n'étend rien) :

- une liste qui nomme, dans l'ordre, ce par quoi le constructeur est typé : elle est redondante, et la correction la retire
- une liste qui diffère du constructeur : c'est elle qui l'emporte à l'exécution, la signature ment donc ; pas de correction

Incorrect :

```ts
@CommandHandler(IssueInvoiceCommand)
export class IssueInvoiceHandler implements CommandHandler<IssueInvoiceCommand> {
  constructor(
    private readonly invoices: InvoiceRepository | undefined,
    private readonly retries = 3,
    private readonly currency: string,
  ) {}
}

// "stack.dependencies": "signature"
@CommandHandler(IssueInvoiceCommand, [InvoiceRepository, Clock])
export class IssueInvoiceHandler implements CommandHandler<IssueInvoiceCommand> {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly clock: Clock,
  ) {}
}
```

Correct :

```ts
import type { Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import type { InvoiceSettings } from '@/contexts/billing/application/ports/invoice-settings.port';
import type { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository';

@CommandHandler(IssueInvoiceCommand)
export class IssueInvoiceHandler implements CommandHandler<IssueInvoiceCommand> {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly settings: InvoiceSettings, // une classe abstraite aux membres readonly, liée à une valeur dans la plateforme
    private readonly clock: Clock,
  ) {}
}
```

## Détails

Un décorateur de paramètre d'une autre bibliothèque et les modificateurs `public`, `private`, `protected`, `readonly` et `override` sont traversés. Une classe qui n'écrit pas de constructeur et n'étend rien ne reçoit rien.

La correction d'une liste redondante retire la liste et la virgule qui la précède : `@CommandHandler(IssueInvoiceCommand, [InvoiceRepository, Clock])` devient `@CommandHandler(IssueInvoiceCommand)`. C'est le codemod qui fait passer un projet à `"stack.dependencies": "signature"` : posez la clé, lancez `eslint --fix`, puis `ddd-ts-kit docs`, qui enregistre dans le fichier généré de chaque contexte ce que prennent les constructeurs. Un port qui ne fait plus que typer un paramètre peut être importé avec `import type`, ce que `@typescript-eslint/consistent-type-imports` corrige dans un projet compilé sans `emitDecoratorMetadata`.

Un projet dont la configuration ne dit rien, ou dit `"stack.dependencies": "listed"`, liste ses dépendances dans ses décorateurs comme le faisait la 0.1 : ses listes ne sont jamais signalées, et une de ses classes qui ne liste rien est tenue aux mêmes règles sur ses paramètres.

## Options

Aucune.

`rules."declarations/constructor-injection"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line declarations/constructor-injection -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Une interface, un alias de type ou un enum importé d'un autre fichier n'est pas reconnu comme tel ici : `ddd-ts-kit check` lit le fichier importé du projet et le signale. Un nom importé d'un *package* est pris tel quel, et le compilateur juge le fichier généré, qui l'importe comme une valeur.
- Une classe qui hérite de son constructeur n'est pas jugée ici : `ddd-ts-kit check` suit la classe de base à travers le projet et signale celle qu'il ne peut pas lire (une classe d'un *package*).
- Que le fichier généré enregistre la liste du constructeur actuel relève de `declarations/barrel-current` de `ddd-ts-kit check` : c'est un fait du projet, pas d'un fichier.
- Qu'un paramètre soit typé par un port et non par un adaptateur ou un *fake* relève de `layer/application-inward` et de `ports/no-concrete-dependency`.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir du texte des fichiers, d'un fichier à l'autre, et reste le garde-fou rapide pendant l'écriture. Cette règle fait autorité sur ce que montre un fichier, et elle est la seule à corriger.
