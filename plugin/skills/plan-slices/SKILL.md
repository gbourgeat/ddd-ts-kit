---
name: plan-slices
description: >-
  Plans the work of a bootstrapped project as vertical slices per bounded context, each one
  use case end to end, with the generator commands that start it, an explicit dependency
  order and an owner. Produces docs/architecture/slices.md, the backlog every worker reads.
  Use after the bootstrap, when the user asks what to build first, to order or size the
  work, or before splitting it between several agents or people. To build one slice use
  use-case; to hand slices to several workers use parallel-work.
argument-hint: "[context, or nothing for all]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash(npx ddd-ts-kit list *)
  - Bash(npx ddd-ts-kit status)
---

# Plan the slices

Scope: `$ARGUMENTS`

Inputs: `docs/architecture/discovery.md` (the timeline) and `npx ddd-ts-kit list --json`
(what exists). Output: `docs/architecture/slices.md`. The order is the owner's decision.

## 1. Cut

A **slice** is one use case of one context, end to end: the behaviour of the aggregate, the
command or query handler, the route, their tests. It fits one commit of reasonable size
(skill `ddd-ts-kit:commit-discipline`) and leaves the project green. Each row of the
discovery timeline is a candidate; a reaction to an event of another context (a policy) is a
slice of the context that reacts.

Three kinds of rows, because they do not have the same owner:

| Kind | What | Owner |
|---|---|---|
| `contract` | an integration event or a read contract that another context will consume | conductor, before the consumers start |
| `skeleton` | an aggregate with its repository, a scheduled job, a policy, a gateway: the generators that write shared files (`npx ddd-ts-kit generate --help --json`, `writesShared`) | conductor |
| `slice` | a use case, a reaction (`integration-handler`, `event-handler`), a query | the worker of the context |

## 2. Order

1. **Walking skeleton**: the thinnest path through the core context that a user can call
   (one command, one route). It proves the stack.
2. **Contracts**, upstream first, following the context map: what a downstream waits for.
3. **By value** inside each context; core before supporting before generic.

`Depends on` names row numbers. A slice depends on the skeleton of its aggregate and on the
contracts it consumes, never on a slice of another context: if it does, a contract is
missing. Rows with no path between them can be built in parallel.

## 3. Write the artefact

```markdown
# Slices

| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |
|---|---|---|---|---|---|---|---|
| 1 | ordering | skeleton | Order | `generate aggregate ordering Order` then `generate repository ordering Order` | | conductor | todo |
| 2 | ordering | contract | Order placed | `generate integration-event ordering Order Placed` | 1 | conductor | todo |
| 3 | ordering | slice | Place order | `generate command ordering PlaceOrder --aggregate Order --permission order.place --grant customer`; `generate route ordering PlaceOrder --method POST --path /orders` | 1, 2 | ordering | todo |
| 4 | billing | slice | Invoice a placed order | `generate integration-handler billing ordering ordering.order.placed` | 2 | billing | todo |
```

- `Start with` holds the exact generator commands (without `npx ddd-ts-kit` and `--json`), so
  the worker runs them instead of working them out. Every command or query names its
  permission or `--public`; every name is made of glossary terms, or the row adds the term
  (`--term "<Term>=<meaning>"`).
- `Owner` is `conductor`, the name of a context (one worker per context) or a person.
- `Status` is `todo`, `in progress`, `done`. Only the conductor edits this file: a worker
  reports, the conductor marks the row at the merge.
- Keep the eight column names as they are: `npx ddd-ts-kit status` reads every table with this
  header, in the order of the file (slices by status and by owner), and `worker-scope` puts the
  `todo` rows of an owner in its briefing. One table per milestone is fine; number the rows
  across the file, never twice (`status` names a number used twice).
- Keep rule details out: one line under the table per slice that needs it, with the
  invariants and the failures by name ("refuses an order without lines").

Aim for slices of half a day at most. A slice with more than two failures to handle, two
aggregates or two routes is two slices.

## Done when

Put this to the owner: **can each slice be built, verified and merged on its own, in this
order, and does every row have one owner?** On a yes, build with `ddd-ts-kit:use-case`, row
by row, or hand out with `ddd-ts-kit:parallel-work`.
