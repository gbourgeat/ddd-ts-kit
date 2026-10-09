# ddd-ts-kit/authz-actor-explicit

Architecture id: `authz/actor-explicit`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: `domain/` and `application/` of a context, tests excluded.

## Why

A use case that reads "the current actor" from the air works behind an HTTP request and nowhere else: a consumer, a scheduled job and a test have to set a global first, and forget. The actor is data of the command or the query, like every other input.

## Reported

- an import of `ActorContext`, `ACTOR_CONTEXT`, `AsyncLocalStorageActorContext` or `AsyncLocalStorage`, from any module
- the same names reached through a namespace (`kernel.ActorContext`, `hooks.AsyncLocalStorage`)
- a constructor parameter typed `ActorContext`

Incorrect:

```ts
import type { ActorContext } from '@ddd-ts-kit/kernel';

export class VoidInvoiceHandler {
  constructor(private readonly invoices: InvoiceRepository, private readonly actors: ActorContext) {}

  async execute(command: VoidInvoice): Promise<void> {
    const actor = this.actors.require();
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
```

## Details

`infrastructure/` may read the `ActorContext` port for audit columns and tenant scoping, and the module binds `ACTOR_CONTEXT`: neither is judged. An import and the constructor parameter it types are two reports, one per line to change.

## Options

None.

`rules."authz/actor-explicit"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line authz/actor-explicit -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- An ambient actor reached under another name (a port of the project wrapping `ActorContext`, a module-level variable) is not seen.
- A re-export through a file of the context that renames the port is not followed.

## With the CLI checker

`ddd-ts-kit check` reports the same id from the text of the files and stays the fast edit-time guard. This rule is the authority.
