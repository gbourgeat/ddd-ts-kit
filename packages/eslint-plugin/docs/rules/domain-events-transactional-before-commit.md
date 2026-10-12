# ddd-ts-kit/domain-events-transactional-before-commit

Architecture id: `domain-events/transactional-before-commit`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: production files of a context, on every class carrying `@DomainEventHandler`.

## Why

An effect of a domain event exists only if the state change that recorded the event is committed. A handler that runs before the commit (the default phase) runs inside the transaction of the command, and the commit itself can still fail after the handler ran: a deferred constraint, a serialization failure, a lost connection. That is safe only when the rollback undoes everything the handler did, so a before-commit handler may only have transactional effects. A cache entry, a lock, a job, a message on the bus or a call to a remote system would survive the rollback and tell the world about a fact that never happened.

Declare the handler `phase: 'after-commit'` when its effect may be lost on a crash (it then runs at most once), or publish an integration event from a publisher (outbox, at least once) and do the work in the handler of that event when it must not be lost.

## Reported

The phase of a handler is `after-commit` when the options object of its `@DomainEventHandler` writes `phase: 'after-commit'`; otherwise it is `before-commit`. Its dependencies are the names of the dependency list of the decorator and the types of its constructor parameters, each resolved through the imports of the file.

For a before-commit handler, a dependency that is:

- `Cache`, `Lock`, `RateLimiter`, `JobScheduler` or `EventBus` of `@ddd-ts-kit/kernel`
- imported from `infrastructure/` of its context
- imported from another context
- imported from the platform directory
- imported from a package other than `@ddd-ts-kit/kernel` and `@ddd-ts-kit/auth`, a Node.js builtin included

For an after-commit handler, a dependency on `IntegrationEventPublisher` of `@ddd-ts-kit/kernel`, and nothing else: after the commit nothing makes the outbox row atomic with a state change, so the handler sends a command through `CommandBus` instead.

Incorrect:

```ts
// src/contexts/billing/application/event-handlers/invoice-issued.event-handler.ts
import { Cache } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository';

@DomainEventHandler(InvoiceIssued, { name: 'billing.invoice.issued' }, [InvoiceRepository, Cache])
export class InvoiceIssuedEventHandler {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly cache: Cache,
  ) {}
}
```

```ts
@DomainEventHandler(InvoiceIssued, { name: 'billing.invoice.issued', phase: 'after-commit' }, [IntegrationEventPublisher])
export class InvoiceIssuedEventHandler {}
```

Correct:

```ts
// the state the handler changes commits or rolls back with the command
@DomainEventHandler(InvoiceIssued, { name: 'billing.invoice.issued' }, [InvoiceRepository, CommandBus])
export class InvoiceIssuedEventHandler {}
```

```ts
// an effect no transaction covers runs once the transaction has committed, at most once
@DomainEventHandler(InvoiceIssued, { name: 'billing.invoice.issued', phase: 'after-commit' }, [Cache])
export class InvoiceIssuedEventHandler {}
```

```ts
// an effect that must not be lost goes through the outbox: the handler of the integration event does the work
@DomainEventHandler(InvoiceIssued, { name: 'billing.invoice.issued' }, [IntegrationEventPublisher, IdGenerator])
export class InvoiceIssuedPublisher {}
```

## Details

A before-commit handler may depend on anything of the `domain/` layer of its context (a repository port, a domain service), on every other port of `@ddd-ts-kit/kernel` (`IntegrationEventPublisher`, `CommandBus`, `QueryBus`, `Clock`, `IdGenerator`, `Logger`, `Metrics`, `ActorContext`, `ExecutionScope`..), on `@ddd-ts-kit/auth`, and on the files of its context outside `infrastructure/` and `application/ports/`. A kernel port imported under another name (`import { Cache as Entries }`) is recognised by the name the kernel exports.

Only names that are dependencies are judged: a type-only import that types a method parameter, or an import the class never receives, is not a dependency. A name the file does not import is left alone.

## Options

None.

`rules."domain-events/transactional-before-commit"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line domain-events/transactional-before-commit -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

ESLint judges one file, so two parts of the rule are held by `ddd-ts-kit check` alone:

- A port of `application/ports/` of the context is accepted before the commit only when it is a persistence port: at least one production class implements it under `infrastructure/persistence/` and none anywhere else under `infrastructure/`. Where the adapters of a port live is not in the file of the handler: this rule reports no port of `application/ports/`.
- In the explicit styles the class carries no decorator and its phase is the third argument of its `.on(name, callback, { phase: 'after-commit' })` registration in `<context>.module.ts`: a handler without `@DomainEventHandler` is not judged here.

Also not seen: a dependency list held in a constant, a port reached through a namespace import (`kernel.Cache`) or a barrel that renames it, and an effect reached without a dependency (a module-level client, a static call).

## With the CLI checker

`ddd-ts-kit check` reports the same id from the text of the files, and adds what needs the project: the adapters of a port of `application/ports/`, and the phase and the `.toClass(Handler, [..])` list written in the module file of an explicit-style context. This rule is the authority for what one declared class shows.
