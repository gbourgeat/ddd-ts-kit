---
name: use-case
description: >-
  Implements one feature end to end inside one bounded context, test first: domain
  behaviour, command or query handler, port and adapter, HTTP route, contract. Use when the
  user asks for a feature, an endpoint, a business rule or "add the ability to ...". It
  calls scaffold for each file.
argument-hint: "<context> <use case in plain words>"
allowed-tools:
  - Bash(npx ddd-ts-kit generate *)
  - Bash(npx ddd-ts-kit check *)
  - Bash(npx ddd-ts-kit list *)
  - Bash(npm test *)
  - Bash(npm run openapi:generate)
---

# Implement a use case

Context: `$0`. Use case: `$ARGUMENTS`

One use case, one vertical slice, inside one bounded context.

## 1. Understand, in the domain's words

State back in one paragraph: who triggers it, what must be true before, what changes, what is
published, what can go wrong (each failure gets a business name). Check every noun and verb
against the context's `CONTEXT.md` glossary. If the slice writes in two contexts, stop: one
context decides, the other reacts to an integration event (`ddd-ts-kit:integration-event`).

Who may do it? Name the permission (skill `ddd-ts-kit:access-control`); a use case is
protected or explicitly public, never undecided.

Command or query? It changes state: command. A query that answers a list is generated with
`--list`: paginated, and narrowed in the query itself by the caller's access scope. It only reads: query, which may read a
projection through a port without loading aggregates.

## 2. Scaffold the slice

Skill `ddd-ts-kit:scaffold`. Typical command slice:

```bash
npx ddd-ts-kit generate command <ctx> <UseCase> --aggregate <Aggregate> --json
npx ddd-ts-kit generate domain-error <ctx> <WhatWentWrong> --json     # one per failure
npx ddd-ts-kit generate domain-event <ctx> <Aggregate> <Fact> --json  # if something happened
npx ddd-ts-kit generate route <ctx> <UseCase> --method POST --path /<resource> --json
```

## 3. Inside out, test first

1. **Domain.** Write the aggregate or value object spec for the rule (given state, when
   intention, then event or error). Make it pass in the aggregate method. No mock exists at
   this level: if you need one, logic is in the wrong layer.
2. **Application.** Handler spec with the fakes of `test/fakes/`: happy path, each failure,
   events published after commit. The handler loads, calls one intention method, saves,
   publishes. An `if` on business state in a handler belongs in the domain.
3. **Infrastructure.** Only if a new port or query needs an adapter. The adapter and the fake
   pass the same contract suite.
4. **Presentation.** Fill the route: input schema (shape only, no business rule), mapping to
   the command, response mapping, declared error codes.
5. **Wiring.** Bindings go in `<context>.module.ts` only.

## 4. Prove

```bash
npm test
npx ddd-ts-kit check
npm run openapi:generate   # commit the regenerated contract with the code
```

Report: files touched, the rules encoded and where, test results, contract diff summary.
Leftover `TODO(domain)` or `it.todo` means not done: list them as open questions.
