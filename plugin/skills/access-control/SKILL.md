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
- Nothing else for a plain permission: no check in the route, none in the handler. The
  generated handler spec already proves that an actor without it is refused.
- `npx ddd-ts-kit describe <ctx>` shows what each use case and route requires; the
  permissions of a context are listed in its `CONTEXT.md`.

## A rule on one element

"Only the author may edit" depends on loaded state:

```bash
npx ddd-ts-kit generate policy <ctx> <Name> --permission <aggregate>.<action> --json
```

A policy is a named, pure, unit-tested class in `application/authorization/*.policy.ts`
(`@Policy(permission, { name: '<context>.<name>' })`); the handler loads the aggregate and
asks `Access.authorize(command.actor, permission, element)`. A rule that holds whoever asks ("not after publication") is an invariant: it goes in
the aggregate.

## Searches

Never load then filter in memory. `generate query ... --search` writes a handler that asks the
access scope of the actor (`all`, `none`, a set of ids, or a filter) and hands it to the read
port; the adapter turns it into the query.

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
later replaces an adapter and the permission mapping, not the handlers.

| Model | Fits when | Costs |
|---|---|---|
| roles (`rbac`) | rights follow job functions | role explosion once rights depend on the element |
| attributes (`abac`) | rights depend on attributes of actor, resource, moment | rules spread out; needs tests |
| relationships (`rebac`) | rights follow relations: owner, member of, shared with | tuples to keep in sync; lists need care |

## Refuse these shortcuts

| Shortcut | Instead |
|---|---|
| `if (user.role === 'admin')` in a route or a handler | a permission required by the use case |
| reading the user from a global or the request in a handler | `command.actor` |
| passing the request or the token inward | an `Actor`, mapped at the boundary |
| an `isAdmin` flag on an entity deciding access | roles or relations in the authorizer |
| authorization in a repository | tenant scoping only there; rights in the application |

Finish with
`npx ddd-ts-kit check --rule authz/declared --rule authz/in-application --rule authz/actor-explicit`.
Every decision, denials included, is recorded by the audit trail (skill
`ddd-ts-kit:cross-cutting`).
