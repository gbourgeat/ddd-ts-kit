**English** · [Français](domain-events-dispatched-on-save.fr.md)

# ddd-ts-kit/domain-events-dispatched-on-save

Architecture id: `domain-events/dispatched-on-save`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: `application/` and `infrastructure/` of a context, tests excluded.

## Why

Domain events leave with the save. After a repository method that was handed an aggregate resolves, the events the aggregate recorded are dispatched in order, inside the unit of work of the command, so their handlers and the outbox commit or roll back with the state change. A handler that pulls the events and dispatches them itself announces them a second time, or announces them outside the transaction; a repository adapter that dispatches mixes persistence with wiring. Events leave with the save: `await repository.save(aggregate)` and nothing else; a removal that announces an event takes the aggregate.

## Reported

- a call to `.pullEvents()` in any production file under `application/` or `infrastructure/` of a context
- in `application/commands/`, `application/queries/` and a repository adapter (`infrastructure/persistence/**/*.repository.ts`): `DomainEventDispatcher` imported (from any module, type-only imports included), named in a dependency list, or typing a constructor parameter

Incorrect:

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

Correct:

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

## Details

`pullEvents` is read as a method call on anything (`invoice.pullEvents()`, `this.invoice?.pullEvents()`, `invoice['pullEvents']()`): a declaration of that name and a bare identifier are not calls. A dependency list is the last argument of a declaration decorator of `@ddd-ts-kit/kernel/declarations` (`@CommandHandler(M, [..])`, `@QueryHandler`, `@Repository`) and the second argument of `.toClass(C, [..])` and `.handledBy(H, [..])`.

Not judged: `domain/` (the aggregate records and hands over its own events), the specs and everything under `test/` of a context, `<context>.module.ts` (the explicit module may still register event handlers on the dispatcher), the platform, `main.ts`, `apps/` and every file outside a context. `application/event-handlers/` and `application/integration/` are held to the `pullEvents()` part only.

## Options

None.

`rules."domain-events/dispatched-on-save"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line domain-events/dispatched-on-save -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- A dispatcher reached under another name (a re-export renamed by a barrel, a home-made port that wraps it) is not recognised.
- Events pulled by a helper that lives in the platform or in the shared kernel and is called from a handler are not followed.

## With the CLI checker

`ddd-ts-kit check` reports the same id from the text of the files: one finding per line that calls `.pullEvents(`, per import that binds `DomainEventDispatcher`, per dependency list and per constructor that names it. This rule is the authority.
