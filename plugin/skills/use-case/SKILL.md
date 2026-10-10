---
name: use-case
description: >-
  Builds one vertical slice inside one bounded context, test first: the behaviour of the
  aggregate, the command or query with its permission, the handler, the route and their
  specs, generated then filled. Use when the user asks for a feature, an endpoint, a
  business rule or "add the ability to ...", or to build the next row of
  docs/architecture/slices.md. For a single file use scaffold; for a reaction to another
  context use integration-event.
argument-hint: "<context> <use case in plain words, or the slice number>"
allowed-tools:
  - Read
  - Edit
  - Bash(npx ddd-ts-kit generate *)
  - Bash(npx ddd-ts-kit check *)
  - Bash(npx ddd-ts-kit list *)
  - Bash(npx ddd-ts-kit explain *)
  - Bash(npm test *)
  - Bash(npm run docs:generate)
---

# Build one use case

Context: `$0`. Use case: `$ARGUMENTS`

One use case, one context, one commit. Read `src/contexts/$0/CONTEXT.md` and the row of
`docs/architecture/slices.md` when there is one; do not browse the tree
(`npx ddd-ts-kit list --json` says what exists).

## 1. State it in the domain's words

In five lines, before any command: who asks (the actor and the **permission**
`<aggregate>.<action>`, or public, said explicitly), what must be true before, what changes,
which fact is recorded, each way it can fail, by business name. Every noun and verb is in the
glossary, or is added with `--term`. Stop if the slice writes in two contexts: one decides,
the other reacts (skill `ddd-ts-kit:integration-event`). A word or a rule you would have to
guess is a question for the user.

## 2. Generate the slice

Run the `Start with` commands of the slice row, or for a typical command:

```bash
npx ddd-ts-kit generate command <ctx> <UseCase> --aggregate <Aggregate> --permission <aggregate>.<action> --json
npx ddd-ts-kit generate domain-error <ctx> <WhatWentWrong> --json     # one per failure
npx ddd-ts-kit generate domain-event <ctx> <Aggregate> <Fact> --json  # the fact recorded
npx ddd-ts-kit generate route <ctx> <UseCase> --method POST --path /<resource> --json
```

A read is `generate query ... (--permission ... | --public)`; a list adds `--list` (paged,
narrowed in the query by the caller's access scope). A reaction inside the context is
`generate event-handler`; work started by time is `generate job ... --command <UseCase>`,
which only sends the command.

Each output lists `next`: the `file:line` of every `TODO(domain)`. Those are the only places
to open.

## 3. Fill, inside out, test first

1. **Domain.** In the aggregate spec, replace an `it.todo` by given / when / then for the
   rule, see it fail, then write the intention method: guard the invariant, change the
   state, record the event. No double exists at this level; needing one means logic is in
   the wrong layer.
2. **Application.** In the handler spec: the happy path, each failure by its error code,
   nothing saved or published on failure. The handler loads, calls one intention method,
   saves; an `if` on business state belongs in the aggregate. Keep the generated event
   dispatching as it is. Time and identifiers come from `Clock` and `IdGenerator`.
3. **Presentation.** The route: input schema (shape only), mapping to the command with
   `actorOf(...)`, response mapping, the `errors` it can answer.
4. **Infrastructure**, only when the slice added a port: the adapter and the fake pass the
   same contract suite (skills `ddd-ts-kit:persistence`, `ddd-ts-kit:cross-cutting`).

Nothing to register: in the declared style the decorators written by the generator are the
registration and the barrel is regenerated (skill `ddd-ts-kit:wiring` otherwise). Delete each
marker as you resolve it.

## 4. Prove and close

```bash
npm test -- <ctx>
npx ddd-ts-kit check --changed-since HEAD
npm run docs:generate        # only when a route or an integration event changed
```

Then one commit for the slice (skill `ddd-ts-kit:commit-discipline`), and its row marked in
`slices.md` when you are the conductor. Report in a few lines: the rules encoded and where,
test results, contract changes. A `TODO(domain)` or an `it.todo` left means not done: list
it as an open question. No file contents in the report.
