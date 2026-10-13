**English** · [Français](authz-in-application.fr.md)

# ddd-ts-kit/authz-in-application

Architecture id: `authz/in-application`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: `presentation/`, `infrastructure/` and `domain/` of a context, tests excluded.

## Why

A permission decided in three places is decided in none. A role test in a route is skipped by the integration event handler that sends the same command; a refusal in a repository cannot be audited; an aggregate that knows roles cannot change authorization model. One place decides: the application layer, through the `Authorizer` port.

## Reported

In `presentation/`:

- a read of `.roles`, `.permissions` or `.isAdmin` on anything
- a comparison of a member named `role` with a string (`===`, `!==`, `==`, `!=`), and a `switch` on it
- an import from `@ddd-ts-kit/auth` (any entry) of anything but the request glue (`actorOf`, `sessionOf`, `resolveSession`, `SessionAuthenticator`, `bearerCredential`, `inActorContext`, `principalResolver`, `HeaderValues`), the codes `FORBIDDEN` and `UNAUTHORIZED` and the error classes (the `Access` port included)
- in a declared-style project (`stack.style: "declared"`): an import of `Requires`, `Public` or `Policy` from `@ddd-ts-kit/kernel/declarations`

In `infrastructure/`:

- a call to `.authorize(...)`, `.decide(...)` or `.check(...)` on something named `access` or `...authorizer...`, or declared with the type `Access` or `...Authorizer`
- `new ForbiddenError(...)`
- in a declared-style project: an import of `Requires`, `Public` or `Policy` from `@ddd-ts-kit/kernel/declarations`, or of the ports `Access` or `PolicyAccess` from `@ddd-ts-kit/auth` (any entry), as a type or as a value

In `domain/`:

- any import from `@ddd-ts-kit/auth`
- an import of `Actor`, `Actored`, `ActorContext`, `Session` or `ExecutionContext` from `@ddd-ts-kit/kernel`
- a read of `.roles` or `.permissions` on anything but `this`

Incorrect:

```ts
// presentation/http/void-invoice.route.ts
if (!context.principal.roles.includes('controller')) {
  return { status: 403 };
}

// infrastructure/persistence/drizzle-invoice.repository.ts
await this.access.authorize(actor, billingPermissions['invoice.read'], row);

// domain/aggregates/invoice.aggregate.ts
void(by: Actor): void {
  if (!by.roles.includes('controller')) {
    throw new NotAllowedError();
  }
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

`application/` is where access is declared and decided: `Requires`, `Public` and `Policy` of `@ddd-ts-kit/kernel/declarations` and the `Access` port of `@ddd-ts-kit/auth` are imported there freely, in both styles. In `domain/` of a declared-style project the whole declarations entry is refused by `layer-domain-purity`, so this rule does not report it a second time. The other names of the declarations entry (`Repository`, `CLOCK`, ...) are not the concern of this rule. An explicit-style project is judged as before: these imports are not reported outside `application/`.

In `domain/`, `this.roles` and `this.state.roles` are not reported: a context whose subject is access itself (identity, membership) models roles as state.

## Options

None.

`rules."authz/in-application"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line authz/in-application -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- `Requires`, `Public` or `Policy` reached through a namespace import of the declarations entry (`import * as declarations`) is not reported in `presentation/` and `infrastructure/`.
- The names are the signal. A route of an administration API whose body legitimately carries `roles` or `permissions` (grant a role to a member) is reported when it reads them: destructure the body (`const { roles } = body`) or record the deviation.
- A role test written without a member named `role` or `roles` (`isAdmin(user)`, `['admin'].includes(kind)`) is not seen.
- `.check(...)` on an authorizer held under another name and typed in another file is not seen.
- An ownership test (`row.ownerId !== actor.id`) is not recognised as such in any layer; in `infrastructure/` only the refusal that follows (`new ForbiddenError`) is.
- `Authenticator` is not on the allow-list of `presentation/`: the principal is resolved once by the server (`principalResolver`), not by each route. `SessionAuthenticator` is, for the boundary that resolves a whole session with `resolveSession`.
- A `Session` or an `ExecutionContext` declared by the project itself, or imported from another module than the kernel, is not reported in `domain/`.

## With the CLI checker

`ddd-ts-kit check` reports the same id from the text of the files and stays the fast edit-time guard. This rule is the authority.
