# ddd-ts-kit/authz-in-application

Architecture id: `authz/in-application`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: `presentation/`, `infrastructure/` and `domain/` of a context, tests excluded.

## Why

A permission decided in three places is decided in none. A role test in a route is skipped by the consumer that sends the same command; a refusal in a repository cannot be audited; an aggregate that knows roles cannot change authorization model. One place decides: the application layer, through the `Authorizer` port.

## Reported

In `presentation/`:

- a read of `.roles`, `.permissions` or `.isAdmin` on anything
- a comparison of a member named `role` with a string (`===`, `!==`, `==`, `!=`), and a `switch` on it
- an import from `@ddd-ts-kit/auth` (any entry) of anything but the request glue (`actorOf`, `bearerCredential`, `inActorContext`, `principalResolver`, `HeaderValues`), the codes `FORBIDDEN` and `UNAUTHORIZED` and the error classes

In `infrastructure/`:

- a call to `.authorize(...)`, `.decide(...)` or `.check(...)` on something named `access` or `...authorizer...`, or declared with the type `Access` or `...Authorizer`
- `new ForbiddenError(...)`

In `domain/`:

- any import from `@ddd-ts-kit/auth`
- an import of `Actor`, `Actored` or `ActorContext` from `@ddd-ts-kit/kernel`
- a read of `.roles` or `.permissions` on anything but `this`

Incorrect:

```ts
// presentation/http/void-invoice.route.ts
if (!context.principal.roles.includes('controller')) return { status: 403 };

// infrastructure/persistence/drizzle-invoice.repository.ts
await this.access.authorize(actor, billingPermissions['invoice.read'], row);

// domain/aggregates/invoice.aggregate.ts
void(by: Actor): void {
  if (!by.roles.includes('controller')) throw new NotAllowedError();
}
```

Correct:

```ts
// presentation/http/void-invoice.route.ts
await commandBus.execute(new VoidInvoice(actorOf(context.principal), params.invoiceId));

// application/commands/void-invoice/void-invoice.handler.ts
await this.access.authorize(command.actor, billingPermissions['invoice.void'], invoice);
invoice.void(command.actor.id, this.clock.now());
```

## Details

The type of a receiver is read from its declaration in the same file (a parameter, a variable, a property, a parameter property): no type information is needed. A class of `infrastructure/` that `implements` an `...Authorizer` is an adapter of the port (a cache, a remote service) and may delegate to another authorizer.

In `domain/`, `this.roles` and `this.state.roles` are not reported: a context whose subject is access itself (identity, membership) models roles as state.

## Options

None.

`rules."authz/in-application"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line authz/in-application -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- The names are the signal. A route of an administration API whose body legitimately carries `roles` or `permissions` (grant a role to a member) is reported when it reads them: destructure the body (`const { roles } = body`) or record the deviation.
- A role test written without a member named `role` or `roles` (`isAdmin(user)`, `['admin'].includes(kind)`) is not seen.
- `.check(...)` on an authorizer held under another name and typed in another file is not seen.
- An ownership test (`row.ownerId !== actor.id`) is not recognised as such in any layer; in `infrastructure/` only the refusal that follows (`new ForbiddenError`) is.
- `Authenticator` is not on the allow-list of `presentation/`: the principal is resolved once by the server (`principalResolver`), not by each route.

## With the CLI checker

`ddd-ts-kit check` reports the same id from the text of the files and stays the fast edit-time guard. This rule is the authority.
