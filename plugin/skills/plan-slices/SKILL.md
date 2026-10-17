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
  - Bash(npx ddd-ts-kit plan-waves)
  - Bash(npx ddd-ts-kit plan-waves *)
  - Bash(npx ddd-ts-kit cited *)
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

A slice that changes what is already built (a route answers otherwise, a state gains a step,
an event carries more) adapts, in the same row, the tests that hold the former behaviour: the
specs, the end-to-end specs and the acceptance tests of the stories already delivered. Never in
a row at the end of the milestone: until then, the merge of the row turns them red.

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

`Depends on` names row ids. A slice depends on the skeleton of its aggregate and on the
contracts it consumes, never on a slice of another context: if it does, a contract is
missing. Rows with no path between them can be built in parallel.

## 3. Write the artefact

```markdown
# Slices

| # | Context | Kind | Slice | Start with | Depends on | Owner | Status |
|---|---|---|---|---|---|---|---|
| US1.01 | ordering | skeleton | Order | `generate aggregate ordering Order` then `generate repository ordering Order` | | conductor | todo |
| US1.02 | ordering | contract | Order placed | `generate integration-event ordering Order Placed` | US1.01 | conductor | todo |
| US1.03 | ordering | slice | Place order | `generate command ordering PlaceOrder --aggregate Order --permission order.place --grant customer`; `generate route ordering PlaceOrder --method POST --path /orders` | US1.01, US1.02 | ordering | todo |
| US1.04 | billing | slice | Invoice a placed order | `generate integration-handler billing ordering ordering.order.placed` | US1.02 | billing | todo |
```

- `Start with` holds the exact generator commands (without `npx ddd-ts-kit` and `--json`), so
  the worker runs them instead of working them out. Every command or query names its
  permission or `--public`; every name is made of glossary terms, or the row adds the term
  (`--term "<Term>=<meaning>"`).
- `Owner` is `conductor`, the name of a context (one worker per context) or a person.
- `Status` is `todo`, `in progress`, `done`. Only the conductor edits this file: a worker
  reports, the conductor marks the row at the merge. A story or a milestone is closed when its
  rows are `done` and `npx ddd-ts-kit todo` lists no `TODO(review)` (skill
  `ddd-ts-kit:quality-gate`).
- Keep the eight column names as they are: `npx ddd-ts-kit status` reads every table with this
  header, in the order of the file (slices by status and by owner), and `worker-scope` puts the
  `todo` rows of an owner in its briefing. One table per story or milestone is fine.
- `#` is the code of the story or milestone, then a number within it: `US5.03`, `M2.07`. Never
  one sequence across stories: when a story is cut or a row inserted, the numbers after it
  slide, and the ids that briefings, commits, reports and `Depends on` carry stop meaning the
  same row. An id is written once and never renumbered; a row added later takes the next free
  number of its story, a row removed leaves its number unused. `status` names an id used twice
  and an id that is a bare number.
- Keep rule details out of the table: under it, one line per slice that needs it,
  `- #<id>: <invariants and failures by name>` (`- #US1.03: refuses an order without lines`), and
  for a row that changes a delivered behaviour, the tests it adapts
  (`adapts test/e2e/place-order.e2e.spec.ts`). `worker-scope` puts that line in the briefing
  of the row.
- A design worked out before a row is built (a design review) lives in
  `docs/architecture/reviews/<topic>.md`, one heading `## #<id> <slice>` per row, every code
  name in backticks: the section belongs to that row, and `worker-scope` names it under the row.
  Before committing a review, run `npx ddd-ts-kit cited --rows <ids> --base origin/main`: it
  lists the names the review cites that the trunk removed, refuses or replaced, with what took
  their place. Write the name the trunk has.

Then run `npx ddd-ts-kit plan-waves`: it refuses a cycle in `Depends on`, an id no row carries
and a row without owner, and otherwise shows the rows in waves (wave 1 can start now), cut into
batches of one or two rows that `parallel-work` hands out. A batch it says names no aggregate
gets one in `Start with` (`--aggregate <Name>`) when the slice works on one.

Aim for slices of half a day at most. A slice with more than two failures to handle, two
aggregates or two routes is two slices.

## Done when

Put this to the owner: **can each slice be built, verified and merged on its own, in this
order, and does every row have one owner?** On a yes, build with `ddd-ts-kit:use-case`, row
by row, or hand out with `ddd-ts-kit:parallel-work`.
