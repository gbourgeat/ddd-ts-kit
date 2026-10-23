**English** · [Français](modules.fr.md)

# Modules of the model

**Summary.** A module divides one model into parts that a reader opens separately. It is not a
sub-context: a part with a language of its own is a [bounded context](bounded-context.md); a part
of one model, with the same language, the same database schema and the same transactions, is a
module (Evans, *Domain-Driven Design Reference*, "Modules"). In this kit a module is optional:
one folder directly under `domain/` and `application/` of a context, declared in the config,
named with terms of the glossary, with the role folders unchanged below it. Three rules keep it
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
  waitlist is under `domain/waitlist/` and `application/waitlist/`, not spread over ten role
  folders shared with everything else. These are the "modules that tell the story of the system".
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
- **`infrastructure/` and `presentation/` stay organised by technique.** A module is part of the
  model; an adapter or a route already groups by use case. The files of one module are
  therefore in two places: its folders of `domain/` and `application/`, and the adapters and
  routes of its use cases.
- **"Module" already names two things of the kit**: `<context>.module.ts` (explicit wiring) and
  `ContextModule` of `@ddd-ts-kit/di`. The pages say "module of the model" wherever the two
  could be confused.

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

A module is one folder level directly under `domain/` and `application/`; below it, the role
folders of [the canonical tree](../ARCHITECTURE.md#2-canonical-tree), unchanged.

```
src/contexts/appointments/
  CONTEXT.md                                   one glossary, with a ## Modules section
  appointments.declarations.ts                 generated, at the root as before
  published-language/                          one per context
  domain/
    errors/codes.ts                            the closed list of the codes of the context
    booking/
      aggregates/appointment.aggregate.ts
      errors/slot-taken.error.ts
    waitlist/
      aggregates/waitlist.aggregate.ts
      value-objects/offer.vo.ts
  application/
    authorization/appointments.permissions.ts  the permission set of the context
    booking/
      commands/book-appointment/...
      commands/commands.declarations.ts        generated, per role folder of the module
    waitlist/
      commands/join-waitlist/...
      event-handlers/offer-freed-slot.event-handler.ts
  infrastructure/  presentation/  test/        unchanged: organised by technique
```

What never moves into a module: `domain/errors/codes.ts`, `application/authorization/<context>.permissions.ts`,
`<context>.module.ts`, the generated `<context>.declarations.ts` and `<context>.dependencies.ts`,
`CONTEXT.md` and `published-language/`. A module never has a glossary, a database schema, a
published language or a module file of its own, and two modules of one context never exchange
integration events: a part that needs one of them is a context.

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
| `tree/closed` | accepts the folder of a declared module, and still reports one the config does not declare; its fix names `generate module` | `error` |
| `module/declared` | every module of `contexts.<name>.modules` is named with terms of the glossary of its context (every word of its name; technical words `shared`, `common`, `core`, `misc`, `utils` and the other technical words of `language/no-technical-name`) and has a row in `## Modules` of `CONTEXT.md` | `error` |
| `module/complete` | once a context declares modules, a file of `domain/` or `application/` outside every module, the context-level files aside, is reported | `warn`, so that a context moves into modules one commit at a time |
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

# Write into it: every file of domain/ and application/ goes into the module.
npx ddd-ts-kit generate aggregate appointments Waitlist --module waitlist
npx ddd-ts-kit generate command appointments JoinWaitlist --aggregate Waitlist --permission waitlist.join --module waitlist

# Move what exists, with every import of it in the project.
npx ddd-ts-kit move-to-module appointments booking domain/aggregates/appointment.aggregate.ts application/commands/book-appointment
```

- With `--module`, the files a kind reads (an existing aggregate, an event, a port) are found in
  whatever module holds them, and the imports it writes name where they are. A file of a use case
  already in a module is written with it, `--module` or not; a `--module` naming another module
  is refused, since it would split the use case. Context-level files (the code list, the
  permission set) stay at the context level.
- In a context that declares modules, a kind that would write a file of `domain/` or
  `application/` without `--module` is refused, with the list of the modules and the same
  command with `--module`: the generator guides, it never leaves the choice unsaid.
- `move-to-module` takes paths relative to the context, files or folders under `domain/` or
  `application/`, moves them into a declared module and rewrites every import of them under the
  source root, `test/` and `scripts/`; the generated declarations follow in the same run. A path
  already in a module moves to the other one, and every file of a folder moves, not only its
  sources. Nothing is moved when a file of the same name is in the module already, when two
  files would land on one path, when another module of the context holds a file of the same role
  and name (the declarations of the context would export it twice), or when a file is not text. `--dry-run` shows the plan; the checks and the
  tests come next.

### What reads the modules

- `ddd-ts-kit check` and the ESLint plugin read a folder under `domain/` or `application/` as a
  module when the config declares it.
- `ddd-ts-kit docs`, `describe`, `error-factories` and the generators read the role folders of
  every module the config declares, as `check` does: the reference of `CONTEXT.md` lists the
  aggregates, use cases, ports, refusals and jobs of the modules as those of the context. A
  folder the config does not declare is read by none of them, and `tree/closed` reports it.
  `error-factories` writes the class of a concept next to the errors it replaces, in their
  module; errors of one concept read from two folders are refused until `move-to-module` gathers
  them.
- In the declared style assembled by barrel, each role folder of a module has its generated
  `<folder>.declarations.ts`, re-exported by `<context>.declarations.ts`.
- `discoverContext` of `@ddd-ts-kit/di` runs without the config: it reads the modules in the
  generated `<context>.dependencies.ts`, which `ddd-ts-kit docs` writes with them
  (`export const modules = [...]`). A folder that file does not name is no module at boot either:
  a role file in it is refused, as `check` reports it.

## Adopting modules, step by step

1. **Read the glossary.** Group its terms by the use cases that use them together. Two groups
   that rarely meet are two modules; a word with two meanings is two contexts.
2. **Declare the modules**: `generate module <context> <module> --purpose "..."`, once per
   module. `module/complete` now warns about every file outside a module: that list is the plan.
3. **Move one cluster per commit**: `move-to-module <context> <module> <paths>...`, then
   `npm run verify`. The tests do not move: `test/` stays organised
   as before.
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
