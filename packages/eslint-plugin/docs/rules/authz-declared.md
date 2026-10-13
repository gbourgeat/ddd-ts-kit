**English** · [Français](authz-declared.fr.md)

# ddd-ts-kit/authz-declared

Architecture id: `authz/declared`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: the module file of a context for registrations, every production file for routes and messages, and in a declared-style project (`stack.style: "declared"`) the `*.command.ts` and `*.query.ts` files under `application/commands` and `application/queries`; tests excluded.

## Why

Nothing is reachable by default. A use case or a route that says nothing about who may call it is open by accident, and the accident is found in production. Saying "public" is a decision; saying nothing is not.

## Reported

- in `<context>.module.ts`: a chain `<builder>.command(X)` or `<builder>.query(X)` that reaches `.handledBy(...)` or `.handledByFactory(...)` with neither `.requires(...)` nor `.public()`, unless the class `X` is seen to carry `@Requires(...)` or `@Public()`
- in a declared-style project: an exported class of a `*.command.ts` or `*.query.ts` file under `application/commands` or `application/queries` that carries neither `@Requires(...)` nor `@Public()` of `@ddd-ts-kit/kernel/declarations`
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

// declared style: application/commands/issue-invoice/issue-invoice.command.ts
export class IssueInvoiceCommand extends AuthorizedCommand<string> {}
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

// declared style: application/commands/issue-invoice/issue-invoice.command.ts
import { Requires } from '@ddd-ts-kit/kernel/declarations';

@Requires(billingPermissions['invoice.issue'])
export class IssueInvoiceCommand extends AuthorizedCommand<string> {}
```

## Details

The route type of `@ddd-ts-kit/http` enforces `security` already: `defineRoute` does not compile without it and refuses an empty list. This rule stays as the lint-level net for a route definition built loosely: a spec typed `any` or cast, a JavaScript file, a wrapper that widens the type.

`@Requires(...)` or `@Public()` on the message class is the declaration, in any project: a module that registers a decorated message without `.requires(...)` or `.public()` is not reported. The class is in view when it is declared in the module file or imported by name from a source of the project that exists on disk, which is then parsed (syntax only). A decorator counts when its name is imported from `@ddd-ts-kit/kernel/declarations` in the file of the class, under an alias (`{ Requires as Needs }`) or a namespace (`declarations.Requires`) too; a home-made `Requires` does not.

An explicit-style project is judged on its registrations only: a message file without a decorator is not reported there.

The registration is recognised by its shape, whatever the builder is called. `super(input.actor)` is accepted when `input` is a constructor parameter. A class without a constructor inherits the one of `AuthorizedCommand`, which takes the actor.

## Options

None.

`rules."authz/declared"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line authz/declared -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- A registered message reached through a barrel, a renaming export, a default import or a namespace is not followed to its class: its decorator is not seen and the registration is reported.
- In a declared-style project that keeps a `<context>.module.ts`, a message registered there with `.requires(...)` and written without a decorator is still reported in its own file: put the decorator on the class.
- A `*.command.ts` or `*.query.ts` file that exports no class is not reported here.
- A registration split over statements (`const registration = builder.command(X); registration.handledBy(H);`) is not followed.
- A wiring written by hand with `AuthorizationMap.of(requires(...), publicUseCase(...))` is not read: `authorizationMiddleware` refuses an undeclared use case at run time, and `createApplication({ authorization: 'required' })` at start.
- A message extending plain `Command` or `Query` while its registration calls `.requires(...)` spans two files and is not seen here; the compiler refuses it, since `requires` only exists for a message that carries an actor.
- A route spec that is not an object literal, or that spreads another object, is not judged.
- That the scheme named in `security` exists, and that the permission is the right one, is not checked.

## With the CLI checker

`ddd-ts-kit check` reports the same id from the text of the files and stays the fast edit-time guard. This rule is the authority.
