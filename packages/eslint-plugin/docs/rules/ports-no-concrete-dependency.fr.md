[English](ports-no-concrete-dependency.md) · **Français**
<!-- translation-of: ports-no-concrete-dependency.md sha256:4743d3de0c74fb07 -->

# ddd-ts-kit/ports-no-concrete-dependency

Identifiant d'architecture : `ports/no-concrete-dependency`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : chaque fichier passé au lint.

## Pourquoi

Une dépendance se nomme par son port, jamais par ce qui l'implémente. Un gestionnaire (handler) à qui l'on donne `KnexInvoiceRepository` est câblé à une technologie, ne peut pas recevoir de *fake*, et fait dépendre la couche application de l'infrastructure par sa propre déclaration. Dans le style déclaré, une classe énonce dans son constructeur ce dont elle dépend : les types de ses paramètres sont donc tenus comme les entrées d'une liste.

## Signalé

- une classe nommée dans une liste de dépendances et importée depuis `infrastructure/` d'un contexte
- une classe nommée dans une liste de dépendances et importée depuis `test/fakes/` d'un contexte
- dans un projet au style déclaré, dans un fichier de rôle : une classe de l'un ou l'autre endroit qui type un paramètre du constructeur d'une classe portant un décorateur de déclaration sans liste (`constructor(private readonly invoices: KnexInvoiceRepository) {}`)

Incorrect :

```ts
import { KnexInvoiceRepository } from '@/contexts/billing/infrastructure/persistence/knex-invoice.repository';

@CommandHandler(IssueInvoiceCommand)
export class IssueInvoiceHandler {
  constructor(
    private readonly knexInvoiceRepository: KnexInvoiceRepository,
    private readonly clock: Clock,
  ) {}
}
```

Correct :

```ts
import { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository';

@CommandHandler(IssueInvoiceCommand)
export class IssueInvoiceHandler {
  constructor(
    private readonly invoiceRepository: InvoiceRepository,
    private readonly clock: Clock,
  ) {}
}
```

## Détails

Une liste de dépendances est le tableau qui nomme ce que reçoit un constructeur : le dernier argument d'un décorateur de déclaration de `@ddd-ts-kit/kernel/declarations` (`@CommandHandler(M, [..])`, `@QueryHandler`, `@IntegrationEventHandler`, `@DomainEventHandler`, `@Scheduled`, `@Repository`, `@Gateway`, `@Adapter`, `@Policy`) et le second argument de `.toClass(C, [..])` et de `.handledBy(H, [..])` de `@ddd-ts-kit/di`.

Le premier argument de `toClass` et de `handledBy` est l'implémentation et ne fait pas partie de la liste : `builder.bind(InvoiceRepository).toClass(KnexInvoiceRepository, [Database])` est la façon dont un module dit quelle classe se tient derrière un port. L'origine d'un nom se lit dans son import, à travers les chemins relatifs et l'`importAlias` configuré.

## Options

Aucune.

`rules."ports/no-concrete-dependency"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line ports/no-concrete-dependency -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Une classe concrète déclarée dans le même fichier, ou atteinte par un *barrel* hors de `infrastructure/`, n'est pas vue : le compilateur refuse une classe concrète là où son port est attendu.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir du texte des fichiers. Cette règle fait autorité pour le code.
