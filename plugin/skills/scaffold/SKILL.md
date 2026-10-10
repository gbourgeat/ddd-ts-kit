---
name: scaffold
description: >-
  Creates ONE file of a ddd-ts-kit role from a template with `ddd-ts-kit generate`, with its
  spec, fake and registration, then lists the places where business logic is expected. Use
  whenever a single aggregate, entity, value object, domain event, error or service, port,
  repository, adapter, gateway, policy, job, event handler, builder, end-to-end spec or
  context is needed, instead of writing it by hand, or when the guard refuses a hand-written
  file. For a whole feature use use-case; for events between contexts use integration-event.
argument-hint: "<kind> <context> <Name> [options]"
allowed-tools:
  - Read
  - Edit
  - Bash(npx ddd-ts-kit generate *)
  - Bash(npx ddd-ts-kit check *)
  - Bash(npx ddd-ts-kit list *)
---

# Scaffold one file

Requested: `$ARGUMENTS`

Boilerplate is generated, never typed: the generator and the checker share one definition of
the tree, so a generated file conforms by construction and costs no tokens.

## Procedure

1. **Name from the glossary** of the context's `CONTEXT.md`. A missing term is added in the
   same command with `--term "<Term>=<meaning>"`. Technical words (`Manager`, `Helper`,
   `Data`, `Info`, `Impl`, `Model`) are refused: find the business word.
2. **Run with `--json`** (`--dry-run` first when unsure):
   ```bash
   npx ddd-ts-kit generate <kind> ... --json
   ```
   Exact arguments of every kind: [kinds.md](kinds.md), or `npx ddd-ts-kit --help`.
3. **Open only the `next` places**, each a `file:line` holding a `TODO(domain)` that states
   the decision expected. Decide, write, delete the marker. A marker you cannot resolve is a
   question for the user, not a guess. `notes` says what the generator could not do.
4. **Replace each `it.todo`** of the generated spec by a real test (skill
   `ddd-ts-kit:testing`).
5. `npx ddd-ts-kit check --changed-since HEAD` and the tests of the context.

## What the generator settles for you

- **Registration.** In the declared style (the default with tsyringe) the class carries its
  decorator and the barrel `<context>.declarations.ts` is rewritten; never edit the barrel.
  In the explicit style the binding is added between the markers of `<context>.module.ts`.
- **Access.** `command` and `query` are refused without `--permission <aggregate>.<action>`
  or `--public`; the permission joins `<context>.permissions.ts`.
- **Ports.** A port is an abstract class, used as its own injection token: no constant, no
  token file. `port` and `repository` write the fake and the contract suite with it.
- **Dependencies between kinds.** A missing repository or domain event is created; a
  missing aggregate, use case or route stops the command with the one to run first.
- **Documents.** The generated lists of `CONTEXT.md` and the generated documentation are
  refreshed.

Never change the structure the generator produced (constructor visibility, factories,
suffixes, folders, decorators). If it does not fit, the model is probably wrong: go back to
`ddd-ts-kit:glossary` or `ddd-ts-kit:bounded-contexts`.
