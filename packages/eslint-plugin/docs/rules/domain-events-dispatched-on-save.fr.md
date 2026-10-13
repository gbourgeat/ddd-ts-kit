[English](domain-events-dispatched-on-save.md) · **Français**
<!-- translation-of: domain-events-dispatched-on-save.md sha256:d2a6b9135e82644d -->

# ddd-ts-kit/domain-events-dispatched-on-save

Identifiant d'architecture : `domain-events/dispatched-on-save`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : `application/` et `infrastructure/` d'un contexte, tests exclus.

## Pourquoi

Les événements du domaine partent avec l'enregistrement. Une fois résolue une méthode de *repository* à qui l'on a passé un agrégat, les événements que l'agrégat a enregistrés sont distribués dans l'ordre, à l'intérieur de l'unité de travail de la commande, si bien que leurs gestionnaires et l'outbox sont validés ou annulés avec le changement d'état. Un gestionnaire qui récupère les événements et les distribue lui-même les annonce une seconde fois, ou les annonce hors de la transaction ; un adaptateur de *repository* qui distribue mélange la persistance et le câblage. Les événements partent avec l'enregistrement : `await repository.save(aggregate)` et rien d'autre ; une suppression qui annonce un événement prend l'agrégat.

## Signalé

- un appel à `.pullEvents()` dans tout fichier de production sous `application/` ou `infrastructure/` d'un contexte
- dans `application/commands/`, `application/queries/` et un adaptateur de *repository* (`infrastructure/persistence/**/*.repository.ts`) : `DomainEventDispatcher` importé (de n'importe quel module, imports de type seul compris), nommé dans une liste de dépendances, ou typant un paramètre de constructeur

Incorrect :

```ts
// src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts
import { Clock, DomainEventDispatcher } from '@ddd-ts-kit/kernel';

@CommandHandler(IssueInvoice, [InvoiceRepository, Clock, DomainEventDispatcher])
export class IssueInvoiceHandler {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly clock: Clock,
    private readonly dispatcher: DomainEventDispatcher,
  ) {}

  async execute(command: IssueInvoice): Promise<string> {
    const invoice = Invoice.issue(command.customerId, this.clock.now());

    await this.invoices.save(invoice);
    await this.dispatcher.dispatch(invoice.pullEvents());

    return invoice.id;
  }
}
```

Correct :

```ts
// src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts
import { Clock } from '@ddd-ts-kit/kernel';

@CommandHandler(IssueInvoice, [InvoiceRepository, Clock])
export class IssueInvoiceHandler {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: IssueInvoice): Promise<string> {
    const invoice = Invoice.issue(command.customerId, this.clock.now());

    await this.invoices.save(invoice);

    return invoice.id;
  }
}
```

## Détails

`pullEvents` se lit comme un appel de méthode sur n'importe quoi (`invoice.pullEvents()`, `this.invoice?.pullEvents()`, `invoice['pullEvents']()`) : une déclaration de ce nom et un identifiant seul ne sont pas des appels. Une liste de dépendances est le dernier argument d'un décorateur de déclaration de `@ddd-ts-kit/kernel/declarations` (`@CommandHandler(M, [..])`, `@QueryHandler`, `@Repository`) et le second argument de `.toClass(C, [..])` et de `.handledBy(H, [..])`.

Ne sont pas jugés : `domain/` (l'agrégat enregistre et remet ses propres événements), les *specs* et tout ce qui est sous `test/` d'un contexte, `<context>.module.ts` (le module explicite peut encore enregistrer des gestionnaires d'événements sur le distributeur), la plateforme, `main.ts`, `apps/` et tout fichier hors d'un contexte. `application/event-handlers/` et `application/integration/` ne sont tenus qu'à la partie `pullEvents()`.

## Options

Aucune.

`rules."domain-events/dispatched-on-save"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line domain-events/dispatched-on-save -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Un distributeur atteint sous un autre nom (une réexportation renommée par un *barrel*, un port maison qui l'enveloppe) n'est pas reconnu.
- Les événements récupérés par un utilitaire qui vit dans la plateforme ou dans le noyau partagé et qui est appelé depuis un gestionnaire ne sont pas suivis.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir du texte des fichiers : un constat par ligne qui appelle `.pullEvents(`, par import qui lie `DomainEventDispatcher`, par liste de dépendances et par constructeur qui le nomme. Cette règle fait autorité.
