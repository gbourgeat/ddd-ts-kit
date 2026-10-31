**English** · [Français](modules.fr.md)

# Modules of the model

**Summary.** A module divides one model into parts that a reader opens separately. It is not a
sub-context: a part with a language of its own is a [bounded context](bounded-context.md); a part
of one model, with the same language, the same database schema and the same transactions, is a
module (Evans, *Domain-Driven Design Reference*, "Modules"). In this kit a module is optional:
one folder of a context holding its own layers (`<module>/domain/`, `<module>/application/`,
`<module>/infrastructure/`, `<module>/presentation/`), declared in the config, named with terms of
the glossary, with the role folders unchanged below each layer, and its specs in
`test/unit/<module>/`. Three rules keep it
honest (`module/declared`, `module/complete`, `module/no-cycle`), `generate --module` writes into
it, and `move-to-module` moves an existing context into modules one commit at a time.

## A module, not a sub-context

A context grows. Either its glossary splits into two vocabularies, and it is two contexts, or the
language stays one and the model is simply large. The second case has a name in the references,
and it is not "sub-context": no reference publication nests bounded contexts.

| Pattern (Evans, *DDD Reference*, 2015) | What the text says | What it gives here |
|---|---|---|
| Modules | "Choose modules that tell the story of the system and contain a cohesive set of concepts. Give the modules names that become part of the ubiquitous language. Modules are part of the model." | the division inside one model, named in its language |
| Modules | "This often yields low coupling between modules, but if it doesn't look for a way to change the model to disentangle the concepts, or an overlooked concept that might be the basis of a module." | coupling between modules is a signal about the model, not a metric to obey |
| Generic Subdomains | "Factor out generic models of these subdomains and place them in separate modules." | a [subdomain](domain-and-subdomains.md) can live in a module of a context |
| Abstract Core | "Place this abstract overall model in its own module, while the specialized, detailed implementation classes are left in their own modules defined by subdomain." | modules defined by subdomain |
| Evolving Order | "It is best not to shoot for comprehensiveness, but rather to find a minimal set that solves the problems that have emerged. Less is more." | the reason modules are optional and stop at one level |

So a module answers "this context is too big to read", never "these two parts speak different
languages". Two parts that need each other but speak one language are one context divided into
modules; two parts with two languages are two contexts, and the
[cycle between contexts](../guides/cycle-between-contexts.md) guide says how to break their
cycle.

## What it gains, and what it does not

**The gains.**

- **Read by concept first.** A folder holds one part of the model: everything about the
  waitlist, its model, its use cases, its adapters and its routes, is under `waitlist/`, and its
  specs under `test/unit/waitlist/`, not spread over ten role folders shared with everything else. These are the "modules that tell the story of the system".
- **A step between one big context and two contexts.** Before modules, a context too big to
  hold in mind had two ways out: stay big, or split into two contexts and pay integration
  events, an outbox, eventual consistency and, when they need each other, a refused cycle. A
  module keeps the language, the schema and the transaction, and costs one folder.
- **A smaller unit to load.** A person or a coding agent working on the waitlist reads one
  module and the context-level files, not the whole context.
- **Coupling made visible.** `module/no-cycle` warns when two modules import each other: the
  signal Evans names to look for a better model or a missing concept.

**The limits, said plainly.**

- **A module does not reduce the dependencies of a handler.** A handler whose constructor takes
  too many ports has them whatever folder it sits in: see
  [A handler with many dependencies](../guides/many-dependencies.md).
- **A module guarantees nothing about readability by itself.** A cut by technique (`shared`,
  `core`, `common`) makes a context harder to read, not easier. That is why `module/declared`
  asks for terms of the glossary and refuses technical words; whether the cut follows the model
  stays a judgement of people, reviewed by the `architecture-reviewer` agent.
- **One more folder level**, and longer imports.
- **What every module shares stays at the level of the context**, and is read there: the code
  list and the permission set at its root, the schema, tables and migrations of its database
  (one database per context), its route groups, guards and shared shapes (a route group gives a
  prefix to the routes of a resource, whatever module answers them), and the fakes, builders and
  worlds of its specs.
- **"Module" already names other things of the kit**: `<context>.module.ts` (explicit wiring),
  the module file of a module of the model that it composes (`<module>/<module>.module.ts`), and
  `ContextModule` of `@ddd-ts-kit/di`. The pages say "module of the model" wherever they could
  be confused.

## When to divide a context, and when not

Divide a context into modules when it holds two or more clusters of concepts of the **same**
language that a reader opens separately: the glossary is one table, but its terms gather in
groups that rarely meet in one use case.

Do not divide it:

- **to hide a second language.** If a word changes meaning between the two parts, they are two
  contexts ([Bounded context](bounded-context.md), the language test).
- **to make a cycle between contexts disappear without asking why.** Merging two contexts into
  one with two modules is right only when they share one language; otherwise one direction
  becomes an event, or a concept is missing.
- **while the context is small.** Evolving Order: build the structure that solves a problem met,
  not one that might be needed.

## In this kit

### The tree

A module is one folder of the context holding its own layers; below each layer, the role folders
of [the canonical tree](../ARCHITECTURE.md#2-canonical-tree), unchanged.

```
src/contexts/appointments/
  CONTEXT.md                                   one glossary, with a ## Modules section
  appointments.codes.ts                        the closed list of the codes of the context
  appointments.permissions.ts                  the permission set of the context
  appointments.declarations.ts                 generated, at the root as before
  published-language/                          one per context
  appointments.module.ts                       explicit style: composes the module files of the modules
  booking/
    booking.module.ts                          explicit style: what booking registers
    domain/
      aggregates/appointment.aggregate.ts
      errors/slot-taken.error.ts
    application/
      application.declarations.ts              generated, per layer of the module
      commands/book-appointment/...
    infrastructure/persistence/knex-appointment.repository.ts
    presentation/http/appointments/book-appointment/...
  waitlist/
    domain/
      aggregates/waitlist.aggregate.ts
      value-objects/offer.vo.ts
    application/
      commands/join-waitlist/...
      event-handlers/offer-freed-slot.event-handler.ts
    infrastructure/persistence/knex-waitlist.repository.ts
    presentation/http/appointments/join-waitlist/...
  infrastructure/persistence/                  the schema, tables and migrations of the context
  presentation/http/                           the route groups, guards/ and shared/
  test/
    unit/booking/  unit/waitlist/              the specs of each module
    integration/booking/  integration/waitlist/
    fakes/  builders/  worlds/                 shared by the specs of every module
```

What never moves into a module: `<context>.codes.ts`, `<context>.permissions.ts`,
`<context>.module.ts`, the generated `<context>.declarations.ts` and `<context>.dependencies.ts`,
`CONTEXT.md`, `published-language/`, the `*.schema.ts` of `infrastructure/persistence/` that are
no row schema, the route groups (`presentation/http/*.routes.ts`), `presentation/http/guards/` and
`presentation/http/shared/`, and `test/fakes/`, `test/builders/` and `test/worlds/`. A module never has a glossary, a database schema or a
published language of its own, and two modules of one context never exchange integration
events: a part that needs one of them is a context.

In the explicit style, what wires the classes splits the same way. Each module has its module
file, `<module>/<module>.module.ts`, the only file at the root of its folder: it registers the
handlers, consumers, reactions, jobs, permissions and routes of the module, and
`<context>.module.ts` composes the module files and keeps what the context holds at its own
level. A context with four modules then has five module files of a readable size, not one that
passes the 350 lines of `clean/file-size`. On tsyringe a module file exports
`{ register(builder), onStart({ resolve }) }`, called from `register` and `onStart` of the
context; wired by hand it exports `registerHandlers`, `registerReactions`, `registerJobs`,
`useCases()` and `routes(platform)`, called from the functions of the same names. In the
declared style a module has no module file: its classes declare themselves, and each layer of
the module has its generated declarations.

### The config and CONTEXT.md

```json
"appointments": {
  "classification": "core",
  "upstreams": [{ "context": "calendars", "relationship": "published-language" }],
  "modules": { "booking": {}, "waitlist": { "classification": "supporting" } }
}
```

A module may carry the classification of the subdomain it holds (Generic Subdomains, Abstract
Core); without one, it has the classification of its context ([CONFIG.md](../CONFIG.md#contexts)).
`CONTEXT.md` gains a `## Modules` section, after `## Ubiquitous language`, with one row per
module:

```md
## Modules

| Module | Purpose |
|---|---|
| `booking` | Booking, rescheduling and cancelling an appointment, and the rules that keep a slot held once. |
| `waitlist` | Clients waiting for a taken slot, and the offer made to the first of them when it frees up. |
```

### The rules

| Rule | Holds | Severity |
|---|---|---|
| `tree/closed` | accepts the folder of a declared module at the root of the context, and its module file `<module>/<module>.module.ts` at the root of the module, nothing else there; still reports a folder the config does not declare, with `generate module` as its fix | `error` |
| `module/declared` | every module of `contexts.<name>.modules` is named with terms of the glossary of its context (every word of its name; technical words `shared`, `common`, `core`, `misc`, `utils` and the other technical words of `language/no-technical-name`) and has a row in `## Modules` of `CONTEXT.md` | `error` |
| `module/complete` | once a context declares modules, a file of a layer outside every module, the files the context keeps aside, is reported, and so is a spec left in `test/unit/` while the file it is named after sits in a module, and a module still where 0.86 and 0.87 put it (`domain/<module>/`) | `warn`, so that a context moves into modules one commit at a time |
| `module/no-cycle` | the imports between the modules of one context form no cycle | `warn`, because Evans makes coupling between modules a signal to change the model, not a refusal |

Every other rule reads a file of a module as it reads the same file outside one: the role of a
file is its path with the module folder left out. `npx ddd-ts-kit explain module/no-cycle` gives
the reason and an example of each rule.

### The generator and the move command

```bash
# Declare the module: config, row of ## Modules, terms of the glossary. Re-runnable.
npx ddd-ts-kit generate module appointments waitlist \
  --purpose "Clients waiting for a taken slot, and the offer made to the first of them when it frees up." \
  --term "Waitlist=The clients waiting for a slot that is taken, in the order they asked"

# Write into it: every file of a layer goes into the module, its spec into test/unit/<module>/.
npx ddd-ts-kit generate aggregate appointments Waitlist --module waitlist
npx ddd-ts-kit generate command appointments JoinWaitlist --aggregate Waitlist --permission waitlist.join --module waitlist

# Move what exists, with every import of it in the project and the specs named after it.
npx ddd-ts-kit move-to-module appointments booking domain/aggregates/appointment.aggregate.ts application/commands/book-appointment \
  infrastructure/persistence/knex-appointment.repository.ts presentation/http/appointments/book-appointment
```

- In the explicit style, `generate module` also writes the module file of the module,
  `<module>/<module>.module.ts`, and composes it from `<context>.module.ts`. Run again for a
  module declared before, it adds them and nothing else. A kind run with `--module` then writes
  its registration in that module file, and in `<context>.module.ts` while the module has none.
  Wired by hand, a use case whose repository another module file already creates is registered
  in that file, so that a repository is created once per context. Registrations written before
  the module file existed stay in `<context>.module.ts` until they are moved by hand, with their
  imports.
- With `--module`, the files a kind reads (an existing aggregate, an event, a port) are found in
  whatever module holds them, and the imports it writes name where they are. A file of a use case
  already in a module is written with it, `--module` or not; a `--module` naming another module
  is refused, since it would split the use case. A spec goes into the module of the file it is
  named after. What the context keeps aside (the code list, the permission set, the schema of its
  database, its route groups) stays at the level of the context.
- In a context that declares modules, a kind that would write a file of a layer without
  `--module` is refused, with the list of the modules and the same command with `--module`: the
  generator guides, it never leaves the choice unsaid. A context still in the layout of 0.86 and 0.87 is
  refused too, with `context-layout` as the way out.
- The kinds that take `--module` show `[--module <module>]` in their usage
  (`npx ddd-ts-kit generate --help --json`, `writesInModules`): the model, the use cases, their
  routes, ports, adapters, gateways, policies and events. A kind that writes only what the context
  keeps aside or what lies outside the contexts (`builder`, `test-world`, `route-group`, `guard`,
  `schema`, `e2e`, `service`, `module`, `context`, `acceptance`, `worker`, `adr`) refuses
  `--module`, which would have no effect on it.
- `move-to-module` takes paths relative to the context, files or folders of a role of any layer,
  or specs, moves them into a declared module (a spec into `test/<unit|integration>/<module>/`),
  takes the specs named after a moved file with it, and rewrites every import of them under the
  source root, `test/` and `scripts/`; the generated declarations follow in the same run. A path
  already in a module moves to the other one, and every file of a folder moves, not only its
  sources. Nothing is moved when a file of the same name is in the module already, when two
  files would land on one path, when another module of the context holds a file of the same role
  and name (the declarations of the context would export it twice), or when a file is not text. `--dry-run` shows the plan; the checks and the
  tests come next.

### What reads the modules

- `ddd-ts-kit check` and the ESLint plugin read a folder of a context as a module when the config
  declares it, and so do the generated `.dependency-cruiser.cjs` and the coverage of
  `@ddd-ts-kit/testing`, which holds each layer of each module to its threshold.
- `ddd-ts-kit docs`, `describe`, `error-factories` and the generators read the role folders of
  every module the config declares, as `check` does: the reference of `CONTEXT.md` lists the
  aggregates, use cases, ports, refusals and jobs of the modules as those of the context. A
  folder the config does not declare is read by none of them, and `tree/closed` reports it.
  `error-factories` writes the class of a concept next to the errors it replaces, in their
  module; errors of one concept read from two folders are refused until `move-to-module` gathers
  them.
- In the declared style assembled by barrel, each layer of a module has its generated
  `<layer>.declarations.ts`, re-exported by `<context>.declarations.ts`.
- In the explicit style, `check` reads the module file of a module as a module file of its
  context (`composition/only-in-module`, `declarations/port-adapter-wired`, `authz/declared`,
  `domain-events/transactional-before-commit`), and `describe`, `docs` and the generators read
  the registrations of every module file of a context together.
- `discoverContext` of `@ddd-ts-kit/di` runs without the config: it reads the modules in the
  generated `<context>.dependencies.ts`, which `ddd-ts-kit docs` writes with them
  (`export const modules = [...]`), and loads the role files of `<module>/application/`,
  `<module>/infrastructure/` and `<module>/presentation/`. A folder that file does not name is no
  module at boot either: a role file in it is refused, as `check` reports it.

### From the layout of 0.86 and 0.87

0.86 and 0.87 put a module under `domain/<module>/` and `application/<module>/`, and left its adapters,
routes and specs organised by technique. This version reads that layout only to move it:
`module/complete` reports it as an error, whatever its severity; the generators refuse to write in such a context until it is
moved. `npx ddd-ts-kit context-layout [<context>...] [--dry-run]` moves it: each module to its
folder, and each adapter, route and spec left at the level of the context to the module of what
it imports (a spec to the module of the file it is named after; a file that imports nothing of a
module to the module of the files that import it), every import of them following. A file whose
imports name two modules, or none, is listed and stays where it is: move it with
`move-to-module`, or leave it at the level of the context when every module uses it.

## Adopting modules, step by step

1. **Read the glossary.** Group its terms by the use cases that use them together. Two groups
   that rarely meet are two modules; a word with two meanings is two contexts.
2. **Declare the modules**: `generate module <context> <module> --purpose "..."`, once per
   module. `module/complete` now warns about every file outside a module: that list is the plan.
3. **Move one cluster per commit**: `move-to-module <context> <module> <paths>...`, its model,
   its use cases, its adapters and its routes, then `npm run verify`. The specs named after the
   moved files follow them into `test/unit/<module>/`.
4. **Read the warnings of `module/no-cycle`.** A cycle between two modules asks whether a
   concept is in the wrong module, or whether a concept is missing.
5. **From then on, generate with `--module`.**

## Limits and when not to use it

- **The tools check the folders, not the cut.** `module/declared` proves that a module is named
  in the language of its context; it cannot prove that the concepts inside belong together.
- **No command renames or removes a module.** Move its files into another module with
  `move-to-module`, then remove its entry from `contexts.<name>.modules` and its row from
  `## Modules` by hand.
- **One level only.** A module holds no module. A module that grows too large to read is a
  question about the context: two contexts, or a concept missing.
- **The rules of `module/*` are read by `ddd-ts-kit check`.** The imports between modules are
  read at the level of the text, like the rest of the checker.
- **A small context does not need modules.** Most contexts never will.

## In the example

`examples/scheduling` divides its context into two modules: `calendars` (the calendars and the
appointments they hold) and `waitlist`. Dividing it showed what `module/no-cycle` is for: the
calendar built the waiter of the waitlist, and a handler of the calendars both noted an
attendance and offered a freed slot. The calendar now answers the appointment type it offers and
the waitlist builds its waiter; the reaction that offers a freed slot belongs to the waitlist,
the one that notes the attendance to the calendars.

## Sources

- Eric Evans, *Domain-Driven Design Reference: Definitions and Pattern Summaries*, Domain
  Language, 2015, domainlanguage.com/ddd/reference: Modules, Generic Subdomains, Abstract Core,
  Segregated Core, Evolving Order.
- Eric Evans, *Domain-Driven Design: Tackling Complexity in the Heart of Software*,
  Addison-Wesley, 2003, chapter 5 (Modules) and chapter 15 (Distillation).
- Vlad Khononov, *Learning Domain-Driven Design*, O'Reilly, 2021, chapter 3 (bounded contexts
  versus subdomains).

## See also

- [Bounded context](bounded-context.md)
- [Domain and subdomains](domain-and-subdomains.md)
- [Ubiquitous language](ubiquitous-language.md)
- [A handler with many dependencies](../guides/many-dependencies.md)
- [A cycle between two contexts](../guides/cycle-between-contexts.md)
- [Proposal: modules inside a bounded context](../proposals/modules.md), with the spike that
  measured the cost
- [Architecture reference](../ARCHITECTURE.md)
- [Concepts index](README.md)
