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
  - Bash(npx ddd-ts-kit verify-slice *)
  - Bash(npx ddd-ts-kit cited *)
  - Bash(npx ddd-ts-kit acceptance *)
  - Bash(npm run test:e2e *)
  - Bash(npx ddd-ts-kit describe *)
  - Bash(npx ddd-ts-kit worktree *)
  - Bash(npx ddd-ts-kit todo *)
  - Bash(npx ddd-ts-kit explain *)
  - Bash(npm test *)
  - Bash(npm run regenerate)
  - Bash(npm run docs:generate)
---

# Build one use case

Context: `$0`. Use case: `$ARGUMENTS`

One use case, one context, one commit. Read `src/contexts/$0/CONTEXT.md` and the row of
`docs/architecture/slices.md` when there is one; do not browse the tree
(`npx ddd-ts-kit describe $0 --json` says what exists: use cases, routes, events, ports).

Write it in a worktree, not in the main checkout of the trunk (the guard refuses it there in a
project whose config says `"worktrees": "required"`): `npx ddd-ts-kit worktree <use-case>` opens
`.worktrees/<use-case>` on its own branch, installed; then every command is `cd <worktree> && ...`
and every file is written by its absolute path under it. A worktree of a story or of a worker
already is one.

## 1. State it in the domain's words

In five lines, before any command: who asks (the actor and the **permission**
`<aggregate>.<action>`, or public, said explicitly), what must be true before, what changes,
which fact is recorded, each way it can fail, by business name. Every noun and verb is in the
glossary, or is added with `--term`. Stop if the slice writes in two contexts: one decides,
the other reacts (skill `ddd-ts-kit:integration-event`). A word or a rule you would have to
guess is a question for the user.

## 2. Generate the slice

A row of a story whose acceptance exists starts once it is written and locked:
`npx ddd-ts-kit acceptance <story> --gate written` passes. It names what is missing; writing the
scenarios is skill `ddd-ts-kit:testing`, never a step of the slice.

Before generating a row of the slices file, check its design against the trunk:
`npx ddd-ts-kit cited --rows <id> --base origin/main`. Each line it prints is a name the design
cites that the trunk removed, refuses or replaced: build on the name the trunk has, and report the
line so that the document is corrected. A name still to build is never listed.

Run the `Start with` commands of the slice row, or for a typical command:

```bash
npx ddd-ts-kit generate command <ctx> <UseCase> --aggregate <Aggregate> [--creates] --permission <aggregate>.<action> --grant <role> --json
npx ddd-ts-kit generate error <ctx> <Refusal> <factory> --json        # one per refusal: its class, its code in <context>.codes.ts, a factory
npx ddd-ts-kit generate domain-event <ctx> <Aggregate> <Fact> --json  # the fact recorded
npx ddd-ts-kit generate route <ctx> <UseCase> --method POST --path /<resource> --json   # [--group <Name>] [--mapper] [--serializer]
```

`--aggregate` alone generates a command that changes an aggregate that exists: its handler receives
the repository and writes nothing until its `TODO(domain)` is answered (load, call one intention
method, save). Add `--creates` only when the use case is the birth of the aggregate: its handler
calls `<Aggregate>.create`, saves and answers the identifier. A command that a job sends is almost
never a birth: leave `--creates` out.

In a context divided into modules of the model (a `## Modules` section in its `CONTEXT.md`),
add `--module <module>` to every `generate` of the slice: the module whose terms the use case
speaks. The generator refuses without it and names the modules; it finds the aggregate, events
and ports in whatever module holds them, and writes the route and the specs of the slice in the
module too (`<module>/presentation/http/`, `test/unit/<module>/`). The code list, the permission
set and the route groups stay at the level of the context. A use case that needs two modules
belongs to the one that decides.

A handler whose constructor grows long is a smell, not a limit: walk the table of
`docs/guides/many-dependencies.md` (a middleware, an event handler, a projection, a process
manager, one port named in the language, a domain service, or two use cases) before adding a
dependency.

Decide who holds the permission before you generate: in a project whose rights are roles
(`stack.authz` `rbac`), `--grant <role>` writes the grant in `platform/auth/roles/roles.ts` and adds
the role to `role.ts` when it is new. Without it, only the super-admin `*` reaches the use case,
every other person is refused at run time, and `check` warns (`authz/granted`). Who holds it is
a business decision: ask the user when the slice does not say. Under attributes or
relationships, `--grant` is refused: give the right in that model instead.

A refusal is named in the words of the business, twice: the class after what is refused, the
factory after what the refusal is about. The class is made of terms of the glossary, plus the
qualifiers `invalid`, `unknown`, `already`, `too`, `no`, `missing`, `required` (`BookingTooLate`);
a missing term is added with `--term` (`language/glossary-term`). `generate error scheduling SlotTaken forCalendar` writes
`domain/errors/slot-taken.error.ts` (`SlotTaken`, extending `DomainRefusal`, never `...Error`),
adds `SlotTaken: 'SLOT_TAKEN'` to `SchedulingCodes` in `<context>.codes.ts`, the factory
`SlotTaken.forCalendar()`, and its case to the spec. Give the factory the facts of the refusal as
typed parameters, and throw it where the rule is kept:
`throw SlotTaken.forCalendar(calendar.id, slot.startsAt)`. Seen from another place, the same
refusal gets a second factory (`generate error scheduling SlotTaken atStart`); a second code is a
second class. Never `new` an error of `domain/errors/` (`errors/through-factory`). Facts are
private: add `.exposing('<fact>')` in the factory only for what a client may read, never for what
identifies a person. Declare the code in `errors` of the route (`errors/known-code`). In a project
whose config says `"stack.refusals": "factories"`, a refusal is a factory of the error class of
its concept instead: `generate error scheduling Appointment slotTaken` adds
`AppointmentError.slotTaken()`; `npx ddd-ts-kit error-factories` moves such a project to named
refusals when the user decides to.

A use case that receives a file is
`generate file-upload <ctx> <UseCase> --path /<resource>/:id/<file> (--permission ... --grant <role> | --public)`:
a controller that declares the file (size and media types, in the contract), a command that
carries it as a `FileUpload` (the bus stages it under a key of `FileKeys` before the transaction
opens), a handler that reads `upload.file` and promotes it with the commit
(`promoteOnCommit`). Record the `StoredFile` on the aggregate in that handler; the content never
goes in a table. A download is a query answering a short signed link (`signedDownloadUrl`).

A read is `generate query ... (--permission ... --grant <role> | --public)`; a search adds `--search` (paged,
narrowed in the query by the caller's access scope). A reaction inside the context is
`generate event-handler` (phase below; `--name <Name>` when the design names the reaction); work started by time is
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

Each output lists `todos`: the `file:line` of every `TODO(domain)`, the sentence is in the file. Those are the only places
to open.

## 3. Fill, inside out, test first

Each `it.todo` turned into a test is named after the rule of the slice row it serves and cites
the row: `- #US1.03: refuses an order without lines` in `slices.md` gives
`it('#US1.03 refuses an order without lines', ...)`, `#<id> AC<n> ...` when a criterion of the
story states it.

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
   `IdGenerator`. When the handler specs of the context arrange the same application, take it
   from a world (`npx ddd-ts-kit generate test-world <ctx>`, in `test/worlds/`).
3. **Presentation.** The route, one controller class with one method
   (`presentation/http/<resource>/<use-case>/<use-case>.controller.ts`): its decorator declares
   the method, the path after the prefix of its route group, the schemas (shape only), the
   response and the `errors` it can answer; `handle` builds the command with `request.actor`
   and returns the body (`{ body, headers }` when the response declares `headers`, a `Location` on a 201). Add `--mapper` or `--serializer` when the translation is more than a
   line; the controller is given nothing but its bus and those two. Its group
   (`<resource>.routes.ts`) holds the guards: a guard is a control at the edge, the permission
   stays on the command. In a project of function routes (`"stack.routes": "functions"`, or no
   key) the route is a `defineRoute` function with `actorOf(...)` and its `security`.
4. **Infrastructure**, only when the slice added a port: the adapter and the fake pass the
   same contract suite (skills `ddd-ts-kit:persistence`, `ddd-ts-kit:cross-cutting`).

Nothing to register: in the declared style the decorators written by the generator are the
registration and the declarations of each layer are regenerated (skill `ddd-ts-kit:wiring` otherwise). A handler
that needs another port receives it in its constructor, typed by that port, and nothing is
added to the decorator: `npx ddd-ts-kit docs` (or the next reload of `npm run dev`) reads the
signature into the generated file of the context. Delete each
marker as you resolve it.

## 4. Prove and close

```bash
npx ddd-ts-kit verify-slice <ctx> --since <trunk>   # regenerate, rules on the changed files, specs of <ctx>, paths to stage
npx ddd-ts-kit todo <ctx>    # every TODO(domain) and it.todo left, as file:line, the Prisma file of <ctx> included
npx ddd-ts-kit check --commit-size
```

When the story has an acceptance spec, run `npm run test:e2e -- test/acceptance/<story>`: a
scenario naming this row that now passes fails the run, asking to remove its `pending(...)`;
remove it, and nothing else of the scenario. One that still fails on what this row should do
means the slice is not done. A scenario that seems wrong is never changed to pass: skill
`ddd-ts-kit:testing`, "Acceptance of a story".

The slice runs only when the started application can do it, which `verify-slice` and the specs on
fakes do not start: before it is `done`, run
`npx ddd-ts-kit check --rule authz/granted --rule authz/system-actor-granted --rule scheduling/job-registered`.
A permission nobody holds, a job no module file registers and a handler acting as a system actor
without its relationship each pass every spec and are refused or never run once the application
starts. A warning of `authz/granted` left on purpose (the grant comes with a later slice) is said
in the report and the row stays `in progress`.

Then one commit for the slice (skill `ddd-ts-kit:commit-discipline`), and its row marked in
`slices.md` when you are the conductor. Before the pull request, read `docs/behaviour/<ctx>.md`
as the reviewer will: under the heading of the use case, each rule line of the row has its title,
apart from what the kit generated, and `Rows of the plan` counts them. Report in a few lines: the rules encoded and where,
test results, contract changes. A marker `todo` still lists in the slice means not done:
report it as an open question. No file contents in the report.
