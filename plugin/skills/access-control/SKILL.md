---
name: access-control
description: >-
  Designs or reviews authentication and authorization in a ddd-ts-kit project. Where each
  responsibility lives, how a use case declares the permission it requires, how the current
  actor reaches use cases, repositories and services, how to restrict actions and individual
  elements, and how to choose between roles (RBAC), attribute policies (ABAC) and
  relationships in the manner of Zanzibar (ReBAC). Use when adding a protected use case or
  route, a role, a permission or an ownership rule, when code needs the connected user or the
  tenant, when filtering a list by rights, or when an authz/* rule is reported.
allowed-tools:
  - Bash(npx ddd-ts-kit generate *)
  - Bash(npx ddd-ts-kit check *)
  - Bash(npx ddd-ts-kit list *)
---

# Access control

Three questions, three places. Mixing them is how authorization rots.

| Question | Where | How |
|---|---|---|
| Who is calling? (authentication) | `src/platform/auth/`, at the boundary | an adapter of the `Authenticator` port turns the credential into an `Actor`; routes and consumers put it in the command or query |
| May this actor do this, on this? (authorization) | `application/authorization/` of the context | permissions declared as data, required by each use case, decided by the `Authorizer` port before the handler runs |
| Is this a valid thing to do at all? (invariant) | `domain/` | "an invoice cannot be paid twice" is not a permission and knows no actor |

API and examples: README of `@ddd-ts-kit/auth`.

## Protect a use case

1. Declare the permission in `application/authorization/<context>.permissions.ts`, named in
   the ubiquitous language: `invoice.issue`, not `admin.write`.
2. Scaffold the use case with it: `generate command|query ... --permission <aggregate>.<action>`
   (or `--public`; one of the two is mandatory). That requires it where the handler is
   registered, in `<context>.module.ts`:
   `builder.command(IssueInvoice).requires(permissions['invoice.issue']).handledBy(...)`,
   or `.public()` when the use case is open, said explicitly.
3. Nothing else. No check in the route, none in the handler for a plain permission. An
   undeclared use case does not start: deny by default is enforced at wiring time.

## Rules on one element

"Only the author may edit, and not after publication" depends on loaded state:

```bash
npx ddd-ts-kit generate policy <ctx> <Name> --permission <aggregate>.<action> --json
```

A policy is a named, pure, unit-tested function in `application/authorization/*.policy.ts`;
the handler loads the aggregate and asks the authorizer with it. If the rule would hold
whoever asks (not after publication), it is an invariant: put it in the aggregate instead.

## Lists

Never load everything and filter in memory. The handler asks the authorizer for the access
scope of the actor (`all`, `none`, a set of ids, or a filter) and hands it to the read port;
the adapter turns it into the query.

## The current actor

- **Use cases**: explicit, a field of the command or query. A handler that needs to know who
  acts reads `command.actor`. This keeps handlers testable and consumers and cron jobs honest
  (they must say on whose behalf they act: a system actor).
- **Infrastructure** that needs it without being handed it (audit columns, tenant scoping of
  every query): the `ActorContext` port, set once per request or message at the boundary.
- **Domain**: never. If an aggregate method needs "who", pass the identifier as an argument
  named for its role: `approve(approverId)`.

## Choosing the model

The choice is the project owner's; lay out the options, recommend, let them decide.

| Model | Fits when | Costs |
|---|---|---|
| Roles (RBAC) | rights follow job functions, few exceptions per element | role explosion once rights depend on the element |
| Attribute policies (ABAC) | rights depend on attributes of actor, resource, context (department, amount, time) | rules spread out; needs discipline and tests |
| Relationships (ReBAC, after Zanzibar) | rights follow relations between people and things: owner, member of, shared with, parent folder | tuples to keep in sync; list queries need care; a dedicated service at scale |

They combine: roles for coarse rights, relationships for sharing. All three sit behind the
same `Authorizer` port, so changing model later replaces an adapter and the permission
mapping, not the handlers. Record the choice in an ADR.

## Shortcuts to refuse

| Shortcut | Why it is refused | Instead |
|---|---|---|
| `if (user.role === 'admin')` in a route or handler | scatters the rules; invisible to audits | a permission required in the module |
| reading the user from a global or the request inside a handler | hidden input, untestable | `command.actor` |
| passing the HTTP request or the token down | couples the application to the transport | map to an `Actor` at the boundary |
| an `isAdmin` flag on a domain entity deciding access | access leaking into the model | roles or relations in the authorizer |
| filtering a list after loading it | leaks counts, breaks paging, slow | access scope into the query |
| authorization inside a repository | hides the rule in infrastructure | tenant scoping only there; rights in application |

Finish with `npx ddd-ts-kit check --rule authz/declared --rule authz/in-application --rule authz/actor-explicit`.
