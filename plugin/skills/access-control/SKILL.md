---
name: access-control
description: >-
  Designs or reviews authentication and authorization in a ddd-ts-kit project. Every use
  case declares the permission it requires or says it is public, rights are decided in the
  application layer, the actor is explicit, searches are narrowed by an access scope. Covers
  policies on one element and the choice between roles, attributes and relationships. Use
  when adding a permission, a role or an ownership rule, when code needs the connected user
  or the tenant, when filtering a list by rights, or when an authz/* rule is reported.
allowed-tools:
  - Read
  - Bash(npx ddd-ts-kit generate *)
  - Bash(npx ddd-ts-kit check *)
  - Bash(npx ddd-ts-kit list *)
  - Bash(npx ddd-ts-kit describe *)
---

# Access control

Three questions, three places. API and examples: README of `@ddd-ts-kit/auth`.

| Question | Where | How |
|---|---|---|
| Who is calling? (authentication) | `src/platform/auth/`, at the boundary | an adapter of the `Authenticator` port turns the credential into a `Session` holding the `Actor`; a route hands `actorOf(...)` to the use case and declares its `security` |
| May this actor do this, on this? (authorization) | `application/authorization/` of the context | permissions as data, required by each use case, decided by the `Authorizer` port in a bus middleware before the handler runs |
| Is this valid at all? (invariant) | `domain/` | "an invoice cannot be paid twice" is not a permission and knows no actor |

## A permission is mandatory

Nothing is reachable by default (`authz/declared`): the generator refuses a command or a
query without one of the two.

```bash
npx ddd-ts-kit generate command <ctx> <UseCase> --permission <aggregate>.<action> --json
npx ddd-ts-kit generate query <ctx> <UseCase> --public --json
```

- The permission is named in the ubiquitous language (`invoice.issue`, not `admin.write`),
  joins `application/authorization/<context>.permissions.ts`, and its words are checked
  against the glossary.
- Declared style: `@Requires(permissions['invoice.issue'])` or `@Public()` on the message
  class. Explicit style: `.requires(...)` or `.public()` where the handler is registered.
- Nothing else for a plain permission: no check in the controller, none in the handler. The
  generated handler spec already proves that an actor without it is refused.
- A guard is another thing: a control at the edge over a set of routes, named in `guards` of
  a `@RouteGroup` or of a controller (`Authenticated`, `HasRole(Role.Auditor)`, `HasScope('invoices:read')`, `TenantMember`, `Public`, or a
  guard of the project in `presentation/http/guards/*.guard.ts`). It reads the caller and the
  request, answers 401 or 403 before the controller runs, and never loads an element
  (`presentation/guard-at-the-edge`). It never replaces the permission: a job or an event
  handler sends the same command without passing any guard. Use a guard for what is true of
  the whole set of routes (signed in, a role, the tenant of the path), a permission or a policy
  for everything that depends on the element.
- A role is never a string in code: it is a key of the vocabulary `Role` of the platform
  (`<platformDir>/auth/role.ts`), and `generate route-group <ctx> <Name> --role <role>` adds
  the role there. A grant names the permission through its set,
  `billingPermissions['invoice.issue']`, never by its id `'billing:invoice.issue'`.
- `npx ddd-ts-kit describe <ctx>` shows what each use case and route requires; the
  permissions of a context are listed in its `CONTEXT.md`.

## A rule on one element

"Only the author may edit" depends on loaded state:

```bash
npx ddd-ts-kit generate policy <ctx> <Name> --permission <aggregate>.<action> --json
```

A policy is a named, pure, unit-tested class in `application/authorization/*.policy.ts`
(`@Policy(permission, { name: '<context>.<name>' })`); the handler loads the aggregate and
asks `Access.authorize(command.actor, permission, appointment)`, the loaded aggregate named after its concept. Every
handler of a use case requiring that permission must ask it: `authz/policy-asked` reports one that
does not, and at run time its result is refused with `PolicyNotAskedError` and rolled back. A rule that holds whoever asks ("not after publication") is an invariant: it goes in
the aggregate.

## Searches

Never load then filter in memory. `generate query ... --search` writes a handler that asks the
access scope of the actor (`all`, `none`, a set of ids, or a filter) and hands it to the read
port; the adapter turns it into the query.

## A field only some callers see

"The patient does not see the internal note" is a right on a field, not a role test in a
serializer or a query (`authz/fields-by-schema`, `authz/in-application`). Mark it on the schema of
the answer, and of the body when the caller sets it:
`withFieldAccess(schema, { internalNote: { read: { permission }, write: { permission }, subject } })`
of `@ddd-ts-kit/http`, decided through `Access` (`fieldDeciderOf`, which `presentation-of.ts`
of the platform wires). It is left out of JSON, XML and CSV alike for a caller who may not read
it, refused with 403 in a body from one who may not set it, absent or read-only in the form of
the route. The handler still authorizes the write itself, for the callers that are not HTTP. A
field shown or hidden is decided without being recorded; a field set is recorded.

The form of a route (`defineForm`) names the permission of its use case, asked as its
`@Requires` asks it: `requires: { permission, subject: (values) => ..., context: (values, actor)
=> ... }`. A caller who may not run the use case gets 403 instead of the form.

## The current actor

- **Use cases**: explicit, the first field of the command or query (`command.actor`).
  Integration event handlers and jobs act as `systemActor('<context>.<name>')`.
- **Infrastructure** that needs it without being handed it (audit columns, tenant scoping,
  log fields): the `ExecutionScope`, opened at the boundary for every request, consumed event
  and job; `ActorContext` is a view of it. Neither is named nor read in `domain/` or
  `application/` (`authz/actor-explicit`).
- **Domain**: never. Pass an identifier named for its role: `approve(approverId)`.

## Choosing the model

The owner's choice (`stack.authz`); all sit behind the one `Authorizer` port, so changing
later replaces an adapter and the permission mapping, not the handlers. Ask, in order, and
stop at the first answer that changes the model (the guide
`docs/guides/choosing-access-control.md` of the kit has a worked preset for each):

1. Does a right depend on **which element**? No: roles.
2. Do users **share** elements, **delegate**, or inherit along a **hierarchy**, and must a list
   show what each one reaches? Yes: relationships (Zanzibar), in the PostgreSQL tuple store of
   the project, or OpenFGA once it outgrows it.
3. Do rights follow **properties** or need **explicit refusals**? Yes: attribute policies over
   roles. No: roles plus a policy per element rule.
4. Do **third parties** act with a limited credential? Add scopes: `HasScope` on the routes,
   the vocabulary in `SessionScopes`.
5. Do **several customers** share the deployment? Add a tenancy strategy (skill
   `ddd-ts-kit:persistence`), roles per tenant, `TenantMember` on the routes of tenant data.

| Model | Fits when | Costs |
|---|---|---|
| roles (`rbac`) | rights follow job functions | role explosion once rights depend on the element |
| attributes (`abac`) | rights depend on attributes of actor, resource, moment | rules spread out; needs tests |
| relationships (`rebac`) | rights follow relations: owner, member of, shared with | tuples to keep in sync; lists need care |

## Refuse these shortcuts

| Shortcut | Instead |
|---|---|
| `if (user.role === 'admin')` in a controller or a handler | a permission required by the use case; `HasRole(Role.Admin)` on the route group when the whole set of routes is for admins |
| a guard that loads the appointment to see who owns it | a policy on the permission of the use case |
| a policy declared and a handler that never asks it | `Access.authorize` in every handler of that permission |
| reading the user from a global or the request in a handler | `command.actor` |
| passing the request or the token inward | an `Actor`, mapped at the boundary |
| an `isAdmin` flag on an entity deciding access | roles or relations in the authorizer |
| `if (actor.roles.includes('staff'))` removing a field from an answer | `withFieldAccess` on the response schema |
| authorization in a repository | tenant scoping only there; rights in the application |

Finish with
`npx ddd-ts-kit check --rule authz/declared --rule authz/in-application --rule authz/actor-explicit --rule authz/fields-by-schema --rule authz/policy-asked`.
Every decision, denials included, is recorded by the audit trail (skill
`ddd-ts-kit:cross-cutting`), the refusals of the guards at the edge too (`onGuardRefusal` of the
HTTP boundary, wired to `auditGuardRefusals`).
