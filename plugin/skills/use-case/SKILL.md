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
  - Bash(npx ddd-ts-kit describe *)
  - Bash(npx ddd-ts-kit todo *)
  - Bash(npx ddd-ts-kit explain *)
  - Bash(npm test *)
  - Bash(npm run docs:generate)
---

# Build one use case

Context: `$0`. Use case: `$ARGUMENTS`

One use case, one context, one commit. Read `src/contexts/$0/CONTEXT.md` and the row of
`docs/architecture/slices.md` when there is one; do not browse the tree
(`npx ddd-ts-kit describe $0 --json` says what exists: use cases, routes, events, ports).

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
npx ddd-ts-kit generate error <ctx> <Concept> <refusal> --json        # one per refusal: a factory on the error class of the concept
npx ddd-ts-kit generate domain-event <ctx> <Aggregate> <Fact> --json  # the fact recorded
npx ddd-ts-kit generate route <ctx> <UseCase> --method POST --path /<resource> --json   # [--group <Name>] [--mapper] [--serializer]
```

A refusal is named in the words of the business, twice: `generate error scheduling Appointment
slotTaken` adds `AppointmentError.slotTaken()` with the code `SLOT_TAKEN` to
`domain/errors/appointment.error.ts`, and its case to the spec. Give the factory the facts of
the refusal as typed parameters, and throw it where the rule is kept:
`throw AppointmentError.slotTaken(calendar.id, slot.startsAt)`. Never `new` an error of
`domain/errors/` (`errors/through-factory`). Facts are private: add `.exposing('<fact>')` in the
factory only for what a client may read, never for what identifies a person. Declare the code
in `errors` of the route (`errors/known-code`).

A read is `generate query ... (--permission ... | --public)`; a search adds `--search` (paged,
narrowed in the query by the caller's access scope). A reaction inside the context is
`generate event-handler` (phase below); work started by time is
`generate job ... --command <UseCase>`, which only sends the command; work a command hands to a
worker, later and outside the request, is `generate background-job ... --command <UseCase>`,
enqueued through `JobQueue` in the unit of work of the command; a process that waits for
events and deadlines is `generate process`, its steps run by event handlers through
`ProcessRunner`.

**Phase of a domain event handler.** Pick by what the effect is:

| The effect | Write |
|---|---|
| in the transaction: a repository, the outbox, a command of the context | the default, `before-commit`. Transactional dependencies only (`domain-events/transactional-before-commit`); a failure fails the command |
| outside the database, and may be lost (a cache, a best-effort call) | `generate event-handler ... --phase after-commit`. Runs once committed, at most once; never saves an aggregate, it sends a command through `CommandBus` |
| outside the database, and must not be lost | an integration event through the outbox (skill `ddd-ts-kit:integration-event`) |

Each output lists `next`: the `file:line` of every `TODO(domain)`. Those are the only places
to open.

## 3. Fill, inside out, test first

1. **Domain.** In the aggregate spec, replace an `it.todo` by given / when / then for the
   rule, see it fail, then write the intention method: guard the invariant, change the
   state, record the event. No double exists at this level; needing one means logic is in
   the wrong layer.
2. **Application.** In the handler spec: the happy path, each failure by its error code,
   nothing saved or published on failure. The handler loads, calls one intention method,
   saves; an `if` on business state belongs in the aggregate. The save hands over the events
   the aggregate recorded, and they are dispatched once the handler has returned, before the
   commit: no `pullEvents()`, no dispatcher in a handler
   (`domain-events/dispatched-on-save`). Time and identifiers come from `Clock` and
   `IdGenerator`.
3. **Presentation.** The route, one controller class with one method
   (`presentation/http/<resource>/<use-case>/<use-case>.controller.ts`): its decorator declares
   the method, the path after the prefix of its route group, the schemas (shape only), the
   response and the `errors` it can answer; `handle` builds the command with `request.actor`
   and returns the body. Add `--mapper` or `--serializer` when the translation is more than a
   line; the controller is given nothing but its bus and those two. Its group
   (`<resource>.routes.ts`) holds the guards: a guard is a control at the edge, the permission
   stays on the command. In a project of function routes (`"stack.routes": "functions"`, or no
   key) the route is a `defineRoute` function with `actorOf(...)` and its `security`.
4. **Infrastructure**, only when the slice added a port: the adapter and the fake pass the
   same contract suite (skills `ddd-ts-kit:persistence`, `ddd-ts-kit:cross-cutting`).

Nothing to register: in the declared style the decorators written by the generator are the
registration and the barrel is regenerated (skill `ddd-ts-kit:wiring` otherwise). A handler
that needs another port receives it in its constructor, typed by that port, and nothing is
added to the decorator: `npx ddd-ts-kit docs` (or the next reload of `npm run dev`) reads the
signature into the generated file of the context. Delete each
marker as you resolve it.

## 4. Prove and close

```bash
npm test -- <ctx>
npx ddd-ts-kit check --changed-since HEAD
npx ddd-ts-kit todo <ctx>    # every TODO(domain) and it.todo left, as file:line
npx ddd-ts-kit check --commit-size
npm run docs:generate        # only when a route or an integration event changed
```

Then one commit for the slice (skill `ddd-ts-kit:commit-discipline`), and its row marked in
`slices.md` when you are the conductor. Report in a few lines: the rules encoded and where,
test results, contract changes. A marker `todo` still lists in the slice means not done:
report it as an open question. No file contents in the report.
