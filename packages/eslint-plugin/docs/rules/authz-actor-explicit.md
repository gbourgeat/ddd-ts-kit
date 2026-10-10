# ddd-ts-kit/authz-actor-explicit

Architecture id: `authz/actor-explicit`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: `domain/` and `application/` of a context, tests excluded.

## Why

A use case that reads "the current actor" from the air works behind an HTTP request and nowhere else: an integration event handler, a scheduled job and a test have to set a global first, and forget. The actor is data of the command or the query, like every other input. The `ExecutionScope` opened at the boundary (and `ActorContext`, a view of it) exists for code that is not handed the context: infrastructure and the platform read it for audit columns, tenant scoping and correlation.

## Reported

- an import of `ActorContext`, `ACTOR_CONTEXT`, `AsyncLocalStorageActorContext`, `ExecutionScope`, `EXECUTION_SCOPE`, `AsyncLocalStorageExecutionScope`, `ScopedActorContext` or `AsyncLocalStorage`, from any module
- the same names reached through a namespace (`kernel.ExecutionScope`, `hooks.AsyncLocalStorage`)
- a constructor parameter typed `ActorContext` or `ExecutionScope`
- a call of `.current()` or `.require()` without argument on a receiver declared with one of these types, or, when the file does not show its declaration, named `actors`, `scope`, `scopes`, `...actorContext` or `...executionScope`
- an import of the infrastructure helpers `stampCreation`, `stampUpdate` or `tenantScopeOf`, and their use through an imported namespace (`kernel.stampCreation`)

Incorrect:

```ts
import { stampCreation, type ExecutionScope } from '@ddd-ts-kit/kernel';

export class VoidInvoiceHandler {
  constructor(private readonly invoices: InvoiceRepository, private readonly scope: ExecutionScope) {}

  async execute(command: VoidInvoice): Promise<void> {
    const { actor } = this.scope.require();
    const stamp = stampCreation(this.scope, this.clock);
  }
}
```

Correct:

```ts
export class VoidInvoiceHandler {
  constructor(private readonly invoices: InvoiceRepository, private readonly access: Access) {}

  async execute(command: VoidInvoice): Promise<void> {
    await this.access.authorize(command.actor, billingPermissions['invoice.void'], invoice);
  }
}

// infrastructure/persistence/drizzle-invoice.repository.ts
const row = { ...toRow(invoice), ...stampCreation(this.scope, this.clock), ...tenantScopeOf(this.scope) };
```

## Details

`infrastructure/` and the platform may read the `ExecutionScope` and the `ActorContext` for audit columns, tenant scoping, log fields and the correlation id, and the module binds `ACTOR_CONTEXT` and `EXECUTION_SCOPE`: none of them is judged. Tests are not judged either, so `FixedExecutionScope` and `FixedActorContext` stay available to them. An import, the constructor parameter it types and the read are three reports, one per line to change.

The type of a receiver is read from its declaration in the same file (a parameter, a variable, a property, a parameter property): no type information is needed. A receiver named `scope` and declared with another type (`AccessScope`, a concept of the domain) is not reported.

## Options

None.

`rules."authz/actor-explicit"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line authz/actor-explicit -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- An ambient context reached under another name (a port of the project wrapping `ExecutionScope`, a module-level variable) is not seen.
- A re-export through a file of the context that renames the port is not followed.
- A receiver named `scope` whose declaration is not in the file (a destructured dependency, a property of a base class) is judged by its name: a concept of the domain called `scope` with a `current()` or `require()` method of its own is reported. Annotate the declaration, or record the suppression.
- A method of the project named `stampCreation`, `stampUpdate` or `tenantScopeOf` is not reported; a helper imported under these names from another module than the kernel is.

## With the CLI checker

`ddd-ts-kit check` reports the same id from the text of the files and stays the fast edit-time guard: it knows no declared type, so it reports `.current()` and `.require()` on anything named `scope`, `scopes` or `...executionScope`, and a helper only when the file imports it under its own name. This rule is the authority.
