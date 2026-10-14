**English** · [Français](declarations-role-declared.fr.md)

# ddd-ts-kit/declarations-role-declared

Architecture id: `declarations/role-declared`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: every file of a context in a declared-style project (`stack.style: "declared"` in `ddd-ts-kit.config.json`), tests excluded. Nothing is reported in an explicit-style project, which is also what a config that does not say is.

## Why

In the declared style a context has no module file: a class says what it is with a decorator of `@ddd-ts-kit/kernel/declarations`, and the composition root is assembled from what the classes say. A role file whose class says nothing is in no assembly: the handler is never registered and the first command fails at run time. A name that is derived instead of written changes when a class is renamed, and with it the idempotency scope of a consumer. A decorator in the domain ties the model to the wiring.

## Reported

In a role file (the table below), other than `*.command.ts` and `*.query.ts`, which `authz-declared` holds:

- no exported class carries the decorator of the role
- a class of the file carries another declaration decorator than the one of the role

On any class of `application/`, `infrastructure/`, `presentation/` or the context root:

- `@IntegrationEventHandler(definition, { consumer })` or `@Policy(permission, { name })` whose name is not a non-empty string literal: missing, empty, a variable, a template with a substitution, options held in a variable or only spread. `@DomainEventHandler(Event)` writes no name: it is attached under the one its event class declares once, `static readonly eventName`, which the compiler requires

Under `domain/`:

- a class carrying any declaration decorator: `Requires`, `Public`, `CommandHandler`, `QueryHandler`, `IntegrationEventHandler`, `DomainEventHandler`, `Scheduled`, `Projection`, `Repository`, `Gateway`, `Adapter`, `Policy`

| File, relative to the context | Exported class carries |
|---|---|
| `application/commands/**/*.handler.ts` | `@CommandHandler` |
| `application/queries/**/*.handler.ts` | `@QueryHandler` |
| `application/integration/handlers/**/*.integration-handler.ts` | `@IntegrationEventHandler` |
| `application/event-handlers/**/*.event-handler.ts` | `@DomainEventHandler` |
| `application/integration/publishers/**/*.publisher.ts` | `@DomainEventHandler` |
| `application/authorization/**/*.policy.ts` | `@Policy` |
| `application/scheduling/**/*.job.ts` | `@Scheduled` |
| `application/projections/**/*.projection.ts` | `@Projection` |
| `infrastructure/persistence/**/*.repository.ts` | `@Repository` |
| `infrastructure/**/*.gateway.ts` | `@Gateway` |
| `infrastructure/**/*.adapter.ts` | `@Adapter` |

Incorrect:

```ts
// application/commands/issue-invoice/issue-invoice.handler.ts
export class IssueInvoiceHandler {}

// application/queries/search-invoices/search-invoices.handler.ts
@CommandHandler(SearchInvoicesQuery)
export class SearchInvoicesHandler {}

// application/authorization/only-issuer-voids.policy.ts
@Policy(billingPermissions['invoice.void'], { name: policyName })
export class OnlyIssuerVoidsPolicy {}

// domain/aggregates/invoice.aggregate.ts
@Repository(InvoiceRepository)
export class Invoice {}
```

Correct:

```ts
// application/commands/issue-invoice/issue-invoice.handler.ts
import type { Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import type { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository';

@CommandHandler(IssueInvoiceCommand)
export class IssueInvoiceHandler implements CommandHandler<IssueInvoiceCommand> {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly clock: Clock,
  ) {}
}

// application/authorization/only-issuer-voids.policy.ts
@Policy(billingPermissions['invoice.void'], { name: 'billing.only-issuer-voids' })
export class OnlyIssuerVoidsPolicy {}

// application/event-handlers/invoice-issued.event-handler.ts
@DomainEventHandler(InvoiceIssued)
export class InvoiceIssuedEventHandler {}
```

## Details

A decorator counts when its name is one of the twelve declaration decorators and that name is imported from `@ddd-ts-kit/kernel/declarations` in the file: `{ Repository }`, an alias `{ Repository as Repo }`, or a namespace `declarations.Repository`. A home-made decorator of the same name, or one of another package (`@Retry` of `@ddd-ts-kit/aspects/decorators`), is ignored.

The role of a file is read from its suffix and its folder, as the generator writes them. A class is exported inline, by `export { A }` or by `export default A`. When a class carries another declaration decorator, only that is reported: fixing it also answers the missing one.

## Options

None.

`rules."declarations/role-declared"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line declarations/role-declared -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- A decorator applied through a variable (`const declare = Repository(InvoiceRepository); @declare class ...`) is not recognised.
- What a class is given is `declarations/constructor-injection`; that a list matches the constructor and that a handler handles its message is checked by the compiler, not here; that an adapter implements its port is `ports/implements-never-extends`, and where a job lives and what it is named are `scheduling/job-triggers-use-case` and `scheduling/job-name`.
- That each role file holds a single declared class is `naming/one-concept-per-file` of `ddd-ts-kit check`.
- That the generated barrel `<context>.declarations.ts` lists every role file is `declarations/barrel-current` of `ddd-ts-kit check`: it is a fact of the project, not of one file.
- A role file written outside the folders of the table is not known to be one: `naming/suffix` and `tree/closed` of `ddd-ts-kit check` hold the tree.
- The unwritten `consumer` of `@IntegrationEventHandler` is also reported by `events-consumer-idempotent`, for what it costs at run time.

## With the CLI checker

`ddd-ts-kit check` reports the same id from the text of the files and stays the fast edit-time guard. This rule is the authority.
