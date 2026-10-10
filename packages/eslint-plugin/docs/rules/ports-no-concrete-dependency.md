# ddd-ts-kit/ports-no-concrete-dependency

Architecture id: `ports/no-concrete-dependency`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: every linted file.

## Why

A dependency list names ports, never what implements them. A handler that lists `KnexInvoiceRepository` is wired to one technology, cannot be given a fake, and makes the application layer depend on infrastructure through its own registration.

## Reported

- a class named in a dependency list and imported from `infrastructure/` of a context
- a class named in a dependency list and imported from `test/fakes/` of a context

Incorrect:

```ts
import { KnexInvoiceRepository } from '../../../infrastructure/persistence/knex-invoice.repository.js';

@CommandHandler(IssueInvoiceCommand, [KnexInvoiceRepository, Clock])
export class IssueInvoiceHandler {}
```

Correct:

```ts
import { InvoiceRepository } from '../../../domain/repositories/invoice.repository.js';

@CommandHandler(IssueInvoiceCommand, [InvoiceRepository, Clock])
export class IssueInvoiceHandler {}
```

## Details

A dependency list is the array that names what a constructor receives: the last argument of a declaration decorator of `@ddd-ts-kit/kernel/declarations` (`@CommandHandler(M, [..])`, `@QueryHandler`, `@IntegrationEventHandler`, `@DomainEventHandler`, `@Scheduled`, `@Repository`, `@Gateway`, `@Adapter`, `@Policy`) and the second argument of `.toClass(C, [..])` and `.handledBy(H, [..])` of `@ddd-ts-kit/di`.

The first argument of `toClass` and `handledBy` is the implementation and is not part of the list: `builder.bind(InvoiceRepository).toClass(KnexInvoiceRepository, [Database])` is how a module says which class stands behind a port. The origin of a name is read from its import, through relative paths and the configured `importAlias`.

## Options

None.

`rules."ports/no-concrete-dependency"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line ports/no-concrete-dependency -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- A concrete class declared in the same file, or reached through a barrel outside `infrastructure/`, is not seen: the compiler refuses a concrete class where its port is expected.

## With the CLI checker

`ddd-ts-kit check` reports the same id from the text of the files. This rule is the authority for the code.
