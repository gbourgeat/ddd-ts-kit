**English** · [Français](modules.fr.md)

# Proposal: modules inside a bounded context

This page answers two problems met while building with the kit, says what Domain-Driven Design
offers for them according to its reference publications, judges what modules gain and cost, and
records what the kit built. It ends with the spike that measured the cost on the example
application, kept as history.

## Status (2026-10-22)

**Built.** The reference is now the concept page [Modules of the model](../concepts/modules.md),
with the two guides [A handler with many dependencies](../guides/many-dependencies.md) and
[A cycle between two contexts](../guides/cycle-between-contexts.md). This page keeps the
reasoning, the judgement and the spike.

| Part | Verdict |
|---|---|
| Modules inside a context (Evans) | **built** |
| Guide: a handler with many dependencies | **written**, no rule |
| Guide: a cycle between two contexts | **written**, no rule |
| A check of the `architecture-reviewer` agent | **added** |
| Sub-contexts, child contexts, nested bounded contexts | **no**: not a concept of the references |
| Responsibility layers between contexts | **no** |
| A limit on the number of constructor dependencies | **no** |
| An `application/services/` role | **no** |
| A tree of subdomains separate from the contexts | **no**: a module carries its subdomain |

## The two problems

1. **A handler whose constructor takes too many dependencies.** It reads several ports, writes
   several repositories, calls several gateways.
2. **Two contexts that need each other.** `context/no-cycle` refuses the cycle, so the two are
   merged, and the merged context grows past what one person or one agent can hold in mind.

Both raise the same question: may a context have sub-contexts, or children?

## What the references say

Every quotation below was read in the text of Eric Evans, *Domain-Driven Design Reference*
(2015), the summary of the patterns of the 2003 book with the ones added since.

| Pattern | What the text says | What it gives here |
|---|---|---|
| Bounded Context | "Explicitly set boundaries in terms of team organization, usage within specific parts of the application, and physical manifestations such as code bases and database schemas." | A context is one model with explicit boundaries. The text never nests them; the reference has no entry and no mention of a sub-context. |
| Modules | "Choose modules that tell the story of the system and contain a cohesive set of concepts. Give the modules names that become part of the ubiquitous language. Modules are part of the model." | The division *inside* one model. |
| Modules | "This often yields low coupling between modules, but if it doesn't look for a way to change the model to disentangle the concepts, or an overlooked concept that might be the basis of a module." | Coupling between modules is a signal about the model, not a metric to obey. |
| Generic Subdomains | "Factor out generic models of these subdomains and place them in separate modules." | A subdomain can live in a module of a context, not only in a context of its own. |
| Abstract Core | "Place this abstract overall model in its own module, while the specialized, detailed implementation classes are left in their own modules defined by subdomain." | Modules defined by subdomain, and a module for what they share. |
| Segregated Core | "Factor all generic or supporting elements into other objects and place them into other packages." | The core of a large model is made visible by modules. |
| Services | "Give the service a name, which also becomes part of the ubiquitous language." | A grouping of behaviour is a named concept, not a bag. |
| Domain Events | "We keep the aggregates internally consistent at all times, while making other changes asynchronously." | Effects after a decision leave as events. |
| Partnership | "Institute a process for coordinated planning of development and joint management of integration." | Evans accepts two contexts that depend on each other, between teams. Refusing the cycle in code is a choice of this kit (every context stays extractable), not a rule of Domain-Driven Design. |
| Responsibility Layers | "Refactor the model so that the responsibilities of each domain object, aggregate, and module fit neatly within the responsibility of one layer." | Layers organise one model. Stretching them over contexts would be an extrapolation. |
| Evolving Order | "It is best not to shoot for comprehensiveness, but rather to find a minimal set that solves the problems that have emerged. Less is more." | The reason to build little. |

On the handler with many dependencies, Mark Seemann calls it constructor over-injection and
treats it as a smell, not a rule: "This is only guidance", and "There could be cases where it's
genuinely valid to have dozens of dependencies". The usual remedy, refactoring to Facade
Services, applies when the arguments "fall in two or more natural clusters"; cross-cutting
concerns are "better addressed with Decorators or the Chain of Responsibility pattern"; the
root cause is usually a violation of the single responsibility principle.

So the answer to the question is: **a subdomain, yes; a sub-context, no; what is wanted is a
module.** A part of a model with its own language is a context. A part of one model, with the
same language, the same schema and the same consistency, that is too large to read as one
piece, is a module.

## Judgement

**What modules gain.**

- **Read by concept first.** A module folder holds one part of the model, the "modules that
  tell the story of the system" (Evans, Modules), instead of spreading it over the role folders
  of the whole context.
- **A step between one big context and two contexts with an unwanted cycle.** Same language,
  same schema, same transaction: no integration event, no outbox, no eventual consistency.
- **A smaller unit to load**, for a person or a coding agent.
- **Coupling made visible.** `module/no-cycle` warns where the model is tangled, the signal
  Evans names.

**What they do not do, said plainly.**

- A module does not reduce the dependencies of a handler: that is the guide of part 2.
- A module guarantees nothing about readability by itself. A cut by technique (`shared`,
  `core`) makes a context worse, which is why `module/declared` asks for terms of the language
  and refuses technical words. Whether the cut follows the model stays a judgement of people.
- One more folder level and longer imports.
- `infrastructure/` and `presentation/` stay organised by technique, so the files of one module
  are in two places.
- The word "module" also names `<context>.module.ts` and `ContextModule`; the pages say "module
  of the model" where the two could be confused.

**When.** When one context holds two or more clusters of concepts of the same language that a
reader opens separately. Never to hide a second language: then it is a context (question 1 of
the guide of part 3).

**The experience of the developer.** Every step has a command and every refusal names the next
one: `generate module` declares a module and documents it, `move-to-module` moves what exists
with its imports, `generate --module` writes into it, `module/complete` warns (never blocks)
until a context is moved, and a context without modules sees no change at all.

## What is built

### 1. Modules inside a context

A module is optional. A context that declares none sees no change.

**Config.** A context lists its modules; each may carry the classification of the subdomain it
holds.

```json
{
  "contexts": {
    "scheduling": {
      "classification": "core",
      "upstreams": [],
      "modules": { "calendars": { "classification": "supporting" }, "waitlist": {} }
    }
  }
}
```

**Tree.** A module is one folder level directly under `domain/` and `application/`; below it,
the role folders of section 2 of ARCHITECTURE.md, unchanged.

```
contexts/scheduling/
  domain/
    errors/codes.ts                       the code list stays one per context
    calendars/
      aggregates/calendar.aggregate.ts
      value-objects/opening-hours.vo.ts
      errors/unknown-calendar.error.ts
    waitlist/
      aggregates/waitlist.aggregate.ts
  application/
    authorization/scheduling.permissions.ts   the permission set stays one per context
    calendars/
      commands/set-opening-hours/set-opening-hours.handler.ts
      commands/commands.declarations.ts     generated, per role folder of the module
    waitlist/
      commands/join-waitlist/join-waitlist.handler.ts
  infrastructure/ presentation/ test/       unchanged: organised by technique, not by model
```

The concept comes first and the kind of file second, because a module is part of the model.
`infrastructure/` and `presentation/` keep their layout: they are organised by technique and
already group a route or an adapter by use case.

**Recognition.** The checker and the ESLint plugin read a folder directly under `domain/` or
`application/` as a module when the config declares it; an undeclared one stays reported by
`tree/closed`, whose fix names `generate module`, so a mistyped role folder
(`domain/aggregate/`) is reported, not taken as a module. `discoverContext` of
`@ddd-ts-kit/di`, which runs without the config, recognises a module by structure: any folder
directly under `application/` that is not a role folder.

**What stays at the level of the context.** `domain/errors/codes.ts` (the closed list of the
codes of the context), `application/authorization/<context>.permissions.ts` (its permission
set), the generated `<context>.declarations.ts`, `CONTEXT.md`, `published-language/`.

**What a module never has.** A glossary of its own, a database schema of its own, a
`published-language/` of its own, integration events exchanged with another module of the same
context, a module file of its own. A part that needs one of them is a context.

**Rules.**

| Rule | Holds | Severity |
|---|---|---|
| `tree/closed` (changed) | accepts the level of a declared module; still refuses an undeclared one | as today |
| `module/declared` | every module of `contexts.<name>.modules` is named with terms of the ubiquitous language of its context (every word of its name; technical words such as `shared`, `common`, `utils`, `core` are refused), and has a row in the `## Modules` section of `CONTEXT.md` that gives its purpose | `error` |
| `module/complete` | once a context declares modules, a file of `domain/` or `application/` outside every module, the context-level files aside, is reported. A warning, so that a context can move into modules one commit at a time | `warn` |
| `module/no-cycle` | the imports between the modules of a context form no cycle. A warning, because Evans makes coupling between modules a signal to change the model ("look for a way to change the model to disentangle the concepts"), not a refusal | `warn` |

**Generator.** `generate module <context> <module> [--purpose] [--classification] [--term]...`
declares a module: the config, its row of `## Modules`, the terms of the glossary; it is
re-runnable and adds what is missing. `generate <kind> <context> ... --module <module>` writes
the files of `domain/` and `application/` into the module, finds the files it reads in whatever
module holds them, and writes imports that name where they are. In a context that declares
modules, a kind that would write a file of `domain/` or `application/` without `--module` is
refused with the list of the modules and the same command with `--module`.

**Moving what exists.** `move-to-module <context> <module> <path>... [--dry-run]` moves files
and folders of `domain/` and `application/` into a declared module and rewrites every import of
them under the source root, `test/` and `scripts/`, and rewrites the generated declarations in
the same run; the checks come next.

**Documentation generated.** `ddd-ts-kit docs` and `describe` read the role folders of every
module, and a spec fails when a role file of a module is missing from `describe`.

### 2. Guide: a handler with many dependencies

No rule: Seemann gives no number, and a rule would invite facades made to silence it. The
guide is an order of diagnosis in which every remedy already has its place in the tree.

| What the dependencies do | Remedy | Where |
|---|---|---|
| Logging, caching, rights, retries | a decorator or a chain of responsibility (Seemann) | the middlewares of the buses |
| Effects that follow the decision | a domain event and its handler (Evans, Domain Events) | `application/event-handlers/` |
| Reads of another context | a local projection fed by its events (Evans, Domain Events) | `application/projections/` |
| Steps spread over time | a process manager (Hohpe and Woolf, *Enterprise Integration Patterns*, 2003) | `application/processes/` |
| Reads that together form one concept | one port named in the ubiquitous language, whose adapter composes the sources (Seemann, Facade Service) | `application/ports/` |
| A decision over several aggregates | a domain service, stateless and without I/O (Evans, Services) | `domain/services/` |
| Still too many | the handler does two things: split the use case (single responsibility) | two use cases |

No `application/services/` role: the six places above cover every case, and a shared
application service tends to become the place where everything else goes.

### 3. Guide: a cycle between two contexts

Three questions, in this order.

1. **One language, one model?** Then they are one context, divided into modules (Generic
   Subdomains, Abstract Core).
2. **Otherwise, can one direction become an event?** The upstream publishes, the downstream
   reacts (Domain Events).
3. **Otherwise, is a concept missing?** The overlooked concept of the Modules pattern, often a
   third context that owns what the two were fighting over.

The concept page of the context map states that refusing the cycle is a choice of the kit, and
that Partnership is a relationship between teams.

### 4. A check of the architecture-reviewer agent

For a constructor with many dependencies, the reviewer walks the table of the guide and names
the remedy that applies. It never counts.

## What is not built, and why

| Not built | Why |
|---|---|
| Sub-contexts, child contexts | Not a concept of the references. A part with its own language is a context; a part of one model is a module. |
| Responsibility layers between contexts | Evans applies them inside one model; Evolving Order asks for the minimal structure that solves the problem met. `context/no-cycle` already keeps the contexts acyclic. |
| A limit on constructor dependencies | Seemann: "only guidance". A number would be met by fake facades. |
| `application/services/` | Every case has a place already; a shared service attracts everything else. |
| A separate tree of subdomains | Evans places a subdomain in a module; the module carries the classification. |
| A `partnership` relationship in the config | The config is directional and the kit refuses cycles on purpose. |
| Modules in `infrastructure/` and `presentation/` | Organised by technique; a module is part of the model. |

## Spike: what it cost (history)

The spike ran before the build, on a branch. Every gap it found is now covered: `docs` and
`describe` read the modules and a spec guards it, `serialize-config` keeps `modules`,
`discoverContext` recognises a module by structure, and the generator writes into modules.

**What was done.** In the example application, the `scheduling` context was divided into two
modules taken from its glossary: `calendars` (calendar, opening hours, exceptions, time off,
appointment types) and `waitlist` (waitlist, waiter, offer). 66 files moved (53 and 13), 135
files had their imports rewritten, the appointments stayed where they were. The tools were
taught the module level in 14 files, 107 lines added and 8 removed: `locate` of the checker and
of the ESLint plugin leave the module out of the path they classify, `tree/closed` accepts a
declared module, and the generated declarations get one file per role folder of a module.

**Results on the example.**

| Run | Before | With modules |
|---|---|---|
| `tsc --noEmit` | pass | pass |
| `ddd-ts-kit check` | 0 errors | 0 errors, after `ddd-ts-kit docs` rewrote the declarations (9 errors before: `tree/closed` 4, `declarations/barrel-current` 5) |
| `ddd-ts-kit docs --check` | pass | pass, **but see the loss below** |
| ESLint on the context | pass | pass |
| unit and architecture specs of the context | pass | 153 files, 707 tests pass, `every-class-resolves` included: the container resolves the classes of the modules |
| dependency-cruiser, knip | pass | pass |
| specs of the kit (`packages/cli`, `packages/eslint-plugin`, `packages/di`), with the prototype | | 4935 pass, none fails (818 skipped, 27 files): a project without modules sees no change |

**Do the rules still see the files of a module?** The same faults were written twice, once in
a module and once outside: an aggregate with a public mutable property, a name outside the
glossary and no spec; a domain service importing an adapter, reading the system clock and
throwing a generic error. Every rule reported both copies the same way:
`language/glossary-term`, `layer/domain-purity`, `purity/no-system-clock`, `test/spec-required`
and `test/builder-required` of the checker; `domain-aggregate-encapsulation`,
`domain-no-generic-error`, `layer-domain-purity`, `naming-business-name` and
`purity-no-system-clock` of the ESLint plugin.

**What the spike found.**

- **A silent loss in the generated documentation.** `docs` and `describe` list each role
  folder flat (`ws.list('domain/errors')`), in about fifteen readers. They lost, without any
  error, the `Calendar` and `Waitlist` aggregates, two repositories, a background job, the
  publisher of `scheduling.calendar.created` and thirteen refusals of the reference of
  `CONTEXT.md`, and `docs --check` passed because it compares with the same blind reading. This
  is the main cost and the main risk: the readers need one shared lister of the role folders of
  a context, and a spec that fails when a role file is missing from `describe`.
- `serialize-config` would drop `modules` when the generator rewrites the config.
- `discoverContext` of `@ddd-ts-kit/di` (the discovery assembly) refuses a role file outside its
  canonical folder; it needs the same structural recognition. The example assembles by barrel
  and did not exercise it.
- The generator was not touched: about forty places of `generate/kinds/` compute a target path.

**Estimate at the time, in three pull requests**, each with its documentation:

1. **Recognition** (no change for a context without modules): the module level in `locate`,
   `tree/closed`, the declarations, the readers of `docs` and `describe`, `discoverContext`,
   the config (parse, serialize, `config/valid`), and the tree of ARCHITECTURE.md section 2 and
   CONFIG.md. Medium: the spike covers half of it; the readers are the rest.
2. **Rules and generator**: `module/declared`, `module/complete`, `module/no-cycle` with their
   `explain` entries and fixtures, `--module` on `generate`. Medium.
3. **Teaching**: the concept page `docs/concepts/modules.md`, the two guides, the pages on the
   bounded context, subdomains and the context map, the skills `bounded-contexts`,
   `context-map`, `scaffold`, `use-case` and `wiring`, the check of `architecture-reviewer`.
   Whether the example adopts the two modules of the spike is decided there.

## Still to verify

- Seemann and van Deursen, *Dependency Injection Principles, Practices, and Patterns* (Manning,
  2019), chapter 6: whether it lists domain events as a remedy for over-injection. The blog post
  does not; the guide cites Evans for domain events meanwhile.
- Vaughn Vernon, *Implementing Domain-Driven Design* (2013), chapter 9: its rules on
  dependencies between peer modules. Until read, `module/no-cycle` rests on Evans alone.
- The word "module" already names `<context>.module.ts` (explicit wiring) and `ContextModule` of
  `@ddd-ts-kit/di`. The kit keeps Evans's word; every page that uses it says "module of the
  model" where the two could be confused.

## Sources

- Eric Evans, *Domain-Driven Design Reference: Definitions and Pattern Summaries*, Domain
  Language, 2015, domainlanguage.com/ddd/reference: Bounded Context, Modules, Services, Domain
  Events, Partnership, Generic Subdomains, Cohesive Mechanisms, Segregated Core, Abstract Core,
  Evolving Order, Responsibility Layers.
- Eric Evans, *Domain-Driven Design: Tackling Complexity in the Heart of Software*,
  Addison-Wesley, 2003, chapters 5 (Modules), 14 (Maintaining Model Integrity), 15
  (Distillation) and 16 (Large-Scale Structure).
- Mark Seemann, "On Constructor Over-injection", 2018, blog.ploeh.dk; "Refactoring to Aggregate
  Services", 2010, blog.ploeh.dk.
- Gregor Hohpe and Bobby Woolf, *Enterprise Integration Patterns*, Addison-Wesley, 2003
  (Process Manager).
- Vaughn Vernon, *Implementing Domain-Driven Design*, Addison-Wesley, 2013, chapters 2 and 9.
- Vlad Khononov, *Learning Domain-Driven Design*, O'Reilly, 2021, chapter 1 (distilling
  subdomains) and chapter 3 (bounded contexts versus subdomains).

## See also

- [Modules of the model](../concepts/modules.md)
- [A handler with many dependencies](../guides/many-dependencies.md)
- [A cycle between two contexts](../guides/cycle-between-contexts.md)
- [Bounded context](../concepts/bounded-context.md)
- [Domain and subdomains](../concepts/domain-and-subdomains.md)
- [Context map](../concepts/context-map.md)
- [Sagas and process managers](../concepts/sagas-and-process-managers.md)
- [Ports and composition](../concepts/ports-and-composition.md)
- [Architecture reference](../ARCHITECTURE.md)
