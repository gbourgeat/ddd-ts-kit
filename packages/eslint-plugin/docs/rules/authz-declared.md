# ddd-ts-kit/authz-declared

Architecture id: `authz/declared`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: the module file of a context for registrations, every production file for routes and messages; tests excluded.

## Why

Nothing is reachable by default. A use case or a route that says nothing about who may call it is open by accident, and the accident is found in production. Saying "public" is a decision; saying nothing is not.

## Reported

- in `<context>.module.ts`: a chain `<builder>.command(X)` or `<builder>.query(X)` that reaches `.handledBy(...)` or `.handledByFactory(...)` with neither `.requires(...)` nor `.public()`
- a `defineRoute({...})` whose spec has no `security` property, or `security: undefined`
- a `defineRoute({...})` whose spec has `security: []`
- a class extending `AuthorizedCommand` or `AuthorizedQuery` whose constructor does not pass one of its own parameters as first argument of `super(...)`

Incorrect:

```ts
builder.command(VoidInvoice).handledBy(VoidInvoiceHandler, [INVOICES]);

defineRoute({ method: 'POST', path: '/invoices/:id/void', operationId: 'voidInvoice', responses }, handler);

export class VoidInvoice extends AuthorizedCommand {
  constructor(readonly invoiceId: string) {
    super(systemActor('billing'));
  }
}
```

Correct:

```ts
builder.command(VoidInvoice).requires(billingPermissions['invoice.void']).handledBy(VoidInvoiceHandler, [INVOICES]);
builder.query(GetCatalog).public().handledBy(GetCatalogHandler, [CATALOG]);

defineRoute({ method: 'POST', path: '/invoices/:id/void', operationId: 'voidInvoice', responses, security: ['bearer'] }, handler);
defineRoute({ method: 'GET', path: '/catalog', operationId: 'getCatalog', responses, security: false }, handler);

export class VoidInvoice extends AuthorizedCommand {
  constructor(actor: Actor, readonly invoiceId: string) {
    super(actor);
  }
}
```

## Details

The route type of `@ddd-ts-kit/http` enforces `security` already: `defineRoute` does not compile without it and refuses an empty list. This rule stays as the lint-level net for a route definition built loosely: a spec typed `any` or cast, a JavaScript file, a wrapper that widens the type.

The registration is recognised by its shape, whatever the builder is called. `super(input.actor)` is accepted when `input` is a constructor parameter. A class without a constructor inherits the one of `AuthorizedCommand`, which takes the actor.

## Options

None.

`rules."authz/declared"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line authz/declared -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- A registration split over statements (`const target = builder.command(X); target.handledBy(H);`) is not followed.
- A wiring written by hand with `AuthorizationMap.of(requires(...), publicUseCase(...))` is not read: `authorizationMiddleware` refuses an undeclared use case at run time, and `createApplication({ authorization: 'required' })` at start.
- A message extending plain `Command` or `Query` while its registration calls `.requires(...)` spans two files and is not seen here; the compiler refuses it, since `requires` only exists for a message that carries an actor.
- A route spec that is not an object literal, or that spreads another object, is not judged.
- That the scheme named in `security` exists, and that the permission is the right one, is not checked.

## With the CLI checker

`ddd-ts-kit check` reports the same id from the text of the files and stays the fast edit-time guard. This rule is the authority.
