# Architecture reference

The single normative document. The CLI (`ddd-ts-kit check`), the templates, the skills and the
hook all implement what is written here. When they disagree, this file is right and the tool is
to be fixed.

## 1. Strategic design

A system is a set of **bounded contexts**. Each one owns a model, a vocabulary and its data.

- Every context has a `CONTEXT.md`: purpose, classification, ubiquitous language (glossary),
  aggregates, published events, relationships.
  It ends with a generated `## Reference`: use cases with their permission, routes, consumed
  and published events, ports with their adapters, policies, gateways and a dependencies
  line. `ddd-ts-kit docs` writes it, `docs --check` detects its drift, and
  `ddd-ts-kit describe <context> --json` gives the same facts as data.
- Every context is classified: `core` (differentiating, gets the best design effort),
  `supporting` (needed, not differentiating) or `generic` (buy or keep trivial).
- Relationships are declared in `ddd-ts-kit.config.json`, never implied by an import. A
  downstream context names its upstream and the pattern: `published-language` (default),
  `customer-supplier`, `conformist`, `anti-corruption-layer`, `open-host-service`,
  `shared-kernel`.
- The only code another context may import is the upstream's `published-language/` folder:
  event types, payload types, read contracts. Everything else goes through integration events.
- A downstream that does not want the upstream's model translates it in
  `infrastructure/anti-corruption/`.
- No shared database tables. A context reads another context's data through a published
  contract or its own projection fed by integration events.
- The shared kernel holds only what at least two contexts use. A file read by one context
  belongs to that context.

## 2. Canonical tree

```
src/
  main.ts                        composition root: tracing first, then wiring
  shared-kernel/                 optional: value objects used by two contexts or more
  platform/                      technical capabilities: config, database, events, auth, tracing, http server
  apps/<context>/main.ts         optional: one context run alone as a service
  apps/worker/main.ts            optional: the scheduled jobs in a process of their own
  contexts/<context>/
    CONTEXT.md
    <context>.declarations.ts    generated barrel of the context's declared classes
    <context>.module.ts          explicit style only: binds ports to adapters by hand
    published-language/          contracts designed for other contexts
    domain/
      aggregates/                *.aggregate.ts
      entities/                  *.entity.ts
      value-objects/             *.vo.ts
      events/                    *.event.ts
      errors/                    *.error.ts
      repositories/              *.repository.ts   (ports: abstract classes)
      services/                  *.service.ts      (stateless domain logic over several aggregates)
    application/
      commands/<use-case>/       *.command.ts, *.handler.ts
      queries/<use-case>/        *.query.ts, *.result.ts, *.handler.ts
      ports/                     *.port.ts         (ports to the outside world: abstract classes)
      authorization/             <context>.permissions.ts, *.policy.ts (who may do what, here)
      event-handlers/            *.event-handler.ts (reactions to this context's domain events)
      scheduling/                *.job.ts          (jobs run by time: schedule to command)
      integration/
        publishers/              *.publisher.ts    (domain event to integration event)
        handlers/                *.integration-handler.ts (integration event to command)
    infrastructure/
      persistence/               *.repository.ts adapters, *.mapper.ts, *.reader.ts, *.schema.ts
      external/                  adapters of outside systems
      anti-corruption/           translators of another context's or system's model
    presentation/
      http/                      *.route.ts or *.controller.ts, *.dto.ts, <context>.routes.ts
      cli/
    test/
      unit/  integration/
      fakes/                     in-memory implementations of ports and repositories
      builders/                  *.builder.ts      (test data builders, one per aggregate)
```

The tree is **closed**: a directory not listed here is a design decision, added to
`extraDirectories` in the config with a reason, not created ad hoc. The levels named
`<use-case>` are open, and so is everything below `test/unit/`, `test/integration/`,
`test/fakes/` and `test/builders/`. End-to-end specs (`test/e2e/`) and the architecture test
(`test/architecture/`) live at the project root, outside the contexts.

## 3. Dependency rules

```
presentation ──▶ application ──▶ domain ◀── infrastructure
                      ▲                          │
                      └──────────────────────────┘
```

| Id | Rule |
|---|---|
| `layer/domain-purity` | `domain/` imports only its own `domain/`, the shared kernel and `@ddd-ts-kit/kernel`. No framework, no ORM, no validation library, no Node built-in doing I/O. |
| `layer/application-inward` | `application/` imports `domain/`, `application/`, published languages, the kernel and `@ddd-ts-kit/auth` (permissions and policies). Never `infrastructure/` or `presentation/`, never a framework or a driver. |
| `layer/presentation-no-infrastructure` | `presentation/` imports `application/` (and domain types for mapping), never `infrastructure/`. |
| `layer/infrastructure-no-presentation` | `infrastructure/` implements ports of `application/` and `domain/`, never imports `presentation/`. |
| `context/published-language-only` | A file imports from another context only through that context's `published-language/`. |
| `context/declared-relationship` | Such an import requires the relationship to be declared in the config. |
| `context/published-language-is-a-contract` | `published-language/` imports only the kernel, `@ddd-ts-kit/events`, `@ddd-ts-kit/validation`, the schema library of the project and other published languages (`publishedLanguageAllowedPackages`). |
| `context/no-cycle` | The declared relationships form no cycle. |
| `tree/closed` | A context holds only the canonical directories, plus its declared `extraDirectories`, and no source file outside a role directory. |
| `tree/context-doc` | Every context has a `CONTEXT.md` with the required sections (`Purpose`, `Classification`, `Ubiquitous language`, `Aggregates`, `Published events`, `Relationships`) and the classification declared in the config. |
| `naming/suffix` | A file in a role directory carries the role's suffix, in kebab-case. |
| `naming/one-concept-per-file` | One exported aggregate, entity, value object, event, handler or job per file, and one declared class per role file. |
| `test/spec-required` | Every aggregate, value object, domain service, command handler, query handler, domain event handler, integration event handler and job has a `*.spec.ts` in the context's `test/`. |
| `events/name-format` | Domain and integration event names follow `<context>.<aggregate>.<fact-in-past-tense>`. |
| `events/defined-in-published-language` | An integration event is declared once with `defineIntegrationEvent` in the producer's `published-language/`, with a payload schema. Catalog and AsyncAPI document are generated from these declarations. |
| `test/no-mocks` | No `vi.mock`, `jest.mock`, `vi.fn`, `jest.fn`, `vi.spyOn`, `jest.spyOn` or mocking library in a context's `test/`. Use the fake of the port. Default severity `warn`. |
| `test/builder-required` | An aggregate has a builder in `test/builders/`. Default severity `warn`. |
| `language/glossary-term` | Every aggregate, entity, value object, domain service, domain event, command and query is named with terms of the `## Ubiquitous language` table of its context's `CONTEXT.md`. The glossary is written before the code. |
| `language/no-technical-name` | No `Manager`, `Helper`, `Util`, `Utils`, `Data`, `Info`, `Processor`, `Wrapper`, `Impl`, `Base`, `Abstract`, `Dto`, `Entity`, `Model` in a name under `domain/` or in a use case name. |
| `purity/no-system-clock` | No `new Date()` without argument, `Date.now()` or `performance.now()` in `domain/` or `application/`: time comes from the `Clock` port. |
| `purity/no-ambient-randomness` | No `Math.random`, `crypto.randomUUID` or id library in `domain/` or `application/`: identifiers come from the `IdGenerator` port. |
| `purity/no-environment` | No `process.env`, `console`, file system or network access in `domain/` or `application/`. |
| `clean/stepdown` | A file reads top to bottom: static factories, public members, then protected and private ones, and a function above the functions it calls. |
| `clean/function-size` | A function has at most 3 parameters and 30 lines (configurable, never above 100); a longer one is doing more than one thing. Default severity `warn`. No function is longer than 100 lines of code, `describe` callbacks included: that ceiling is an `error`. |
| `clean/no-commented-out-code` | No code in comments. Version control remembers. |
| `clean/no-noise-comment` | No comment that restates the code, no banner, no journal, no closing-brace comment, no `@param` without description. Default severity `warn`. |
| `clean/no-escape-hatch` | No `any`, no non-null assertion, no type assertion outside mappers and infrastructure, no `@ts-ignore`, no `@ts-expect-error` without a reason, no `eslint-disable` without a reason. |
| `clean/no-flag-argument` | No boolean parameter on a public method of the domain or a use case: two intentions are two methods. Default severity `warn`. |
| `domain/aggregate-encapsulation` | An aggregate or entity has a private or protected constructor, no public mutable property and no setter. |
| `domain/value-object-immutability` | A value object has only readonly properties and never assigns to itself outside its constructor. |
| `domain/no-generic-error` | `domain/` and `application/` never `throw new Error(...)`: a business failure is a `DomainError` subclass. |
| `application/handler-shape` | A `*.handler.ts` file exports one class with a single public method, `execute`. |
| `application/command-query-separation` | A query handler never saves, deletes or publishes. Default severity `warn`. |
| `events/outbox-required` | With a database, integration events are published through the transactional outbox, never straight to a broker or a bus from a handler. `stack.events` is `outbox` whenever `stack.orm` is set. |
| `events/consumer-idempotent` | Every integration event handler is declared (`@IntegrationEventHandler(definition, { consumer })`) or registered with a stable consumer name, unique in the project, and deduplicates through a processed-event store (bound once for the application, or given to the subscription). Never a bare `subscribe`. |
| `context/extractable` | A context can run alone: its module and its declared classes wire nothing of another context, it reads no table or schema of another context, imports no repository nor port of one, and exports no mutable state. It calls another context only through a port of its own whose adapter could be remote. |
| `authz/declared` | Every command, query and route declares the permission it requires, or declares itself public. Nothing is reachable by default. |
| `authz/in-application` | The permission is decided in the application layer through the `Authorizer` port. No role or ownership test in `presentation/`, no authorization in `infrastructure/`, no knowledge of the acting user's rights in `domain/` (a context whose model is access itself may hold roles as its own state). |
| `authz/actor-explicit` | Use cases receive the actor in the command or query. `domain/` and `application/` never read the ambient `ExecutionScope` or `ActorContext`; only infrastructure and the platform may, for audit columns, tenant scoping and correlation. |
| `governance/recorded-deviation` | A suppression, a lowered severity, an extra directory or an extra allowed package carries a reason and points to a decision record in `docs/adr/`. |
| `aspects/outside-in` | Aspects are applied from outside. The decorators of `@ddd-ts-kit/aspects/decorators` are imported only by an adapter in `infrastructure/` or by the platform; everywhere else an aspect is a wrapper given to a binding or to a declaration (`.with(...)`, `aspects` of `@Adapter`), put around every binding of a kind by the platform (`builder.around(...)`), or a bus middleware. |
| `standard/no-parallel-interface` | No home-made copy of a standard interface of the kernel: no declared `ILogger`, `AppLogger`, `UserContext`, `CurrentUser`, `UserSession`, `PaginatedResult`, `AuditLog` and the like. Use the kernel interface and extend it by declaration merging; the list is `standardInterfaces` in the config. Default severity `warn`. |
| `declarations/role-declared` | In the declared style, a role file exports a class carrying the decorator of its role, and a declared class lives in a role file. Consumer, policy and domain event names are non-empty string literals, and no class under `domain/` carries a declaration. |
| `declarations/barrel-current` | In the declared style with a barrel, `<context>.declarations.ts` holds exactly one `export *` per role file of its context: a role file cannot be silently left unregistered. |
| `ports/abstract-class` | A port (`domain/repositories/*.repository.ts`, `application/ports/*.port.ts`) is an abstract class with abstract members only: no constructor, no private or protected member, no body, no initializer, `static readonly tokenKey` excepted. Never an interface. |
| `ports/implements-never-extends` | An adapter implements its port and never extends it: the class declared with `@Repository`, `@Gateway` or `@Adapter`, the class given to `bind(Port).toClass(..)`, and any class of `infrastructure/`. |
| `ports/no-token-constant` | A dependency is named by the class of its port: no `token(..)`, no symbol or string given to `bind`, `rebind`, `resolve`, `fake` or `override`, no UPPER_SNAKE constant in a dependency list, no `*.ports.ts` or `tokens.ts` file. |
| `ports/no-concrete-dependency` | A dependency list names ports: nothing imported from `infrastructure/` or from `test/fakes/`. |
| `ports/value-import` | A port named in a dependency list or given to `bind` is imported as a value, never with `import type`. |
| `clean/no-hash-private` | A class member is `private`, never `#name`. |
| `clean/blank-lines` | A blank line before every `return` that is not alone in its block and between the logical blocks of a function (after a group of declarations, around `if`, `for`, `try`, around a multiline statement, around a method); no blank line at the edges of a block, never two in a row. Consecutive declarations and fields may stay together. |
| `clean/braces` | Every `if`, `else`, `for`, `while` and `do` has braces, and its body is on its own lines; `else` follows the closing brace on the same line. A ternary, an arrow function returning an expression and a one-line object literal are not judged. |
| `clean/formatted` | Every TypeScript, JavaScript and JSON file is laid out by the formatter of the project, Biome, at a line width of 120: `npm run format:check` reports nothing to change. Markdown and YAML are not formatted. |
| `clean/one-export-per-file` | A source file exports one class, interface or function and is named after it in kebab-case. Its companions are the types of its own signature, a derived form it calls, or a closed family (a type with its constructors or combinators, the accessors of one private state); anything else is listed in `onePerFile.allow` with its reason. Entry files (`index.ts`, `<context>.declarations.ts`, subpath entries) only re-export. |
| `clean/file-size` | A file is at most 350 lines, tests included, and the limit is not configurable; files under a directory named `generated` and `.d.ts` files are exempt. |
| `scheduling/job-triggers-use-case` | A job lives in `application/scheduling/*.job.ts`, implements `ScheduledJob` and only sends commands: no repository among its dependencies, no import of aggregates, entities, domain services or `infrastructure/`. |
| `scheduling/job-name` | A job is named `<context>.<job-name>` by a string literal in lower-case kebab-case, the context being its own; its `systemActor` carries the same name; the name is unique in the project. |
| `domain-events/dispatched-on-save` | Domain events leave with the save: no `pullEvents()` call in `application/` or `infrastructure/` of a context, and no `DomainEventDispatcher` imported, named in a dependency list or received by a constructor in `application/commands/`, `application/queries/` or a repository adapter. A handler writes `await repository.save(aggregate)` and nothing else; a removal that announces an event takes the aggregate. |
| `domain-events/transactional-before-commit` | A domain event handler that runs before the commit has only transactional effects: the commit can still fail after the handlers ran (a deferred constraint, a serialization failure, a lost connection), so a before-commit handler may only have effects the rollback undoes. Judged: every production domain event handler of a context, that is a class of `application/event-handlers/*.event-handler.ts` or `application/integration/publishers/*.publisher.ts`, and any class carrying `@DomainEventHandler`. Its phase is `after-commit` when the options of its `@DomainEventHandler` write `phase: 'after-commit'`, or, for a class without the decorator, when every `.on(` registration of `<context>.module.ts` whose callback mentions it (the class name, or the variable assigned from `new <Class>(`) has a third argument holding `phase: 'after-commit'`; otherwise it is `before-commit`. Its dependencies are the names of the dependency list of its decorator, the types of its constructor parameters and the list of `.toClass(Handler, [..])`, each resolved through the imports of the file that writes it. A before-commit handler may depend on a repository port and anything else of the `domain/` layer of its context; on the ports of `@ddd-ts-kit/kernel` except `Cache`, `Lock`, `RateLimiter`, `JobScheduler` and `EventBus`; on `@ddd-ts-kit/auth`; on the files of its context outside `infrastructure/` and `application/ports/`; and on a port of `application/ports/` of its context only when it is a persistence port: at least one production class of the context implements it under `infrastructure/persistence/` and none anywhere else under `infrastructure/`. Refused before the commit: those five kernel ports, any other port of `application/ports/`, anything imported from `infrastructure/`, from another context, from the platform or from a package other than `@ddd-ts-kit/kernel` and `@ddd-ts-kit/auth`. An after-commit handler is refused `IntegrationEventPublisher` alone (after the commit nothing makes the outbox row atomic with a state change: it sends a command through `CommandBus`). |
| `tracing/platform-only` | `@ddd-ts-kit/tracing` (every entry) and `@opentelemetry/*` are imported only by the platform directory, `main.ts` and `apps/`. |
| `composition/only-in-module` | Adapters are instantiated or bound, and declared classes assembled (`contextModule`, `discoverContext`, `include`), only in `<context>.module.ts`, `main.ts`, `apps/` and the platform directory. In the declared style an adapter is bound by its own declaration and nothing instantiates it. |
| `config/valid` | `ddd-ts-kit.config.json` is consistent: known contexts, classifications, relationships, rule ids and guard mode, the same contexts as on disk, a function limit within the ceiling, complete `onePerFile.allow` entries and positive commit limits. |
| `config/suppression-needs-reason` | An inline suppression names its rule and gives a reason after `--`. |

Only the composition root (`main.ts`, `apps/`, the platform directory) and what assembles a
context (its generated `<context>.declarations.ts`, or its `<context>.module.ts` in the
explicit style) are allowed to know every layer.

### Who checks what

Three analyzers and a formatter hold the rules, each where it is exact:

| Analyzer | Holds | When |
|---|---|---|
| `ddd-ts-kit check` (zero dependency, text level) | alone, structure and project-wide facts: `tree/*`, `naming/*`, `language/*`, `config/*`, `context/no-cycle`, `test/spec-required`, `test/builder-required`, `events/defined-in-published-language`, `composition/only-in-module`, `declarations/barrel-current`, the config side of `events/outbox-required` and of `governance/recorded-deviation` (decision records exist), and what must be unique in the project (consumer names, job names). It also holds a fast approximation of every code rule below except `domain/*` and `application/*`; of `clean/blank-lines` it holds the `return` and the padded block only, and it holds nothing of `clean/formatted` | at every file write (editor hook), in CI |
| `@ddd-ts-kit/eslint-plugin` (syntax tree) | code: `layer/*`, the imports of `context/*` and `context/extractable`, `purity/*`, `clean/*` but `clean/formatted` (`clean/blank-lines` through two rules of `@stylistic/eslint-plugin` and `clean/braces` through `curly`, which its presets enable), `domain/*`, `application/*`, `authz/*`, `events/name-format`, `events/outbox-required`, `events/consumer-idempotent`, `aspects/*`, `tracing/*`, `domain-events/*`, `standard/*`, `ports/*`, `scheduling/*`, `declarations/role-declared`, `test/no-mocks`, and the comment side of `governance/recorded-deviation`. `domain/*` and `application/*` are held by it alone. Of `domain-events/transactional-before-commit` it holds what one declared class shows; where the adapters of an `application/ports/` port live and the phase an explicit-style module file registers a handler in are held by `ddd-ts-kit check` alone. Authoritative when the two disagree | on staged files, in CI |
| Biome (formatter only: its linter and its import organiser are off) | `clean/formatted`: where every token goes, at a line width of 120, with the `biome.json` that `init` writes; it also removes the padding of a block and never leaves a body on the line of its braces, which completes `clean/blank-lines` and `clean/braces`. ESLint enables no rule that decides the same thing | on staged files, in CI |
| dependency-cruiser (resolved import graph) | the same boundaries through barrels and re-exports, cycles between files, orphans, undeclared dependencies; its configuration is generated from the config by `ddd-ts-kit depcruise-config` | in CI |

knip (dead code and unused dependencies) and the TypeScript compiler in `strict` mode complete the gate.

## 4. Tactical rules

**Aggregates.** Private constructor, a `create` factory for birth and a `rehydrate` factory for
loading. State changes through methods named after the business intention, never setters. One
aggregate per transaction; another aggregate is referenced by id. Invariants are checked inside,
and a violated one raises a `DomainError` with a stable `code`.

**Value objects.** Immutable, validated in `create`, compared with `equals`. Primitive obsession
is a defect: an email, an amount, a period are types.

**Domain events.** Past tense, immutable, recorded by the aggregate. A handler writes
`await this.orders.save(order)` and nothing else: no `pullEvents()`, no dispatcher. A
repository adapter only persists.

**An effect of a domain event exists only if the state change that recorded it is committed.**
A `before-commit` handler commits with it, an `after-commit` handler runs only after it, an
integration event is published only after it.

- **Timing.** Inside a unit of work a save only queues the events its aggregates recorded, in
  recording order across all the saves. Once the work (the command handler) has returned, still
  inside the transaction, the queue is dispatched: every handler sees every save. A handler may
  save an aggregate, whose events join the queue behind those waiting (same order, no
  recursion), and may append to the outbox. Then the transaction commits.
- **`before-commit`, the default phase.** The handler runs in that dispatch. What it writes
  commits or rolls back with the state change, and its failure fails the command.
- **`after-commit`.** Declared with `phase: 'after-commit'` (`@DomainEventHandler` options, or
  `dispatcher.on(name, callback, { phase: 'after-commit' })`). The handler runs once the
  transaction has committed, never when it rolled back, in the order the events were dispatched,
  and is awaited before the command answers. Its failure cannot fail the command: it is logged
  and handed to the `ErrorReporter`, and the other handlers still run. The phase is at most
  once: a crash between the commit and the run loses it. What must not be lost is an
  integration event, through the outbox.
- **Failure.** When the work throws, a save rejects, a `before-commit` handler fails or the
  commit itself fails, everything rolls back and the events still queued are dropped: no
  `after-commit` handler runs, nothing is stored, no outbox row remains. A save that rejects
  pulls nothing: its events stay on the aggregate. Events pulled by a save of a unit of work
  that rolled back are never put back on the aggregate: a retry runs the command again on
  reloaded aggregates, and an aggregate instance of a failed command is not reused.
- **Why `before-commit` is restricted.** The commit can fail after the `before-commit`
  handlers ran (a deferred constraint, a serialization failure, a lost connection). The
  guarantee holds only because such a handler has transactional effects alone, which
  `domain-events/transactional-before-commit` enforces: repository ports and the domain of its
  context, kernel ports other than `Cache`, `Lock`, `RateLimiter`, `JobScheduler` and
  `EventBus`, and ports of `application/ports/` whose adapters are all under
  `infrastructure/persistence/`. A gateway, an external port or an adapter of
  `infrastructure/external/` requires `phase: 'after-commit'` (the effect may be lost) or an
  integration event (it must not be). An `after-commit` handler does not depend on
  `IntegrationEventPublisher`.
- **After the commit, no save.** An `after-commit` handler that hands an aggregate to a
  repository (`save`, `saveAll`, `remove(aggregate)`) is refused before the write with
  `SaveAfterCommitError`: the unit of work is over, nothing would dispatch its events nor roll
  it back. It sends a command through the `CommandBus`, which opens a unit of work of its own.
- **One scope per unit of work.** Every `UnitOfWork.run` is built on `withinUnitOfWork` of the
  kernel, so a `run` called directly (a consumer, a script) has the timing of a command. A
  nested `run`, or a command sent from inside a unit of work, joins the one in progress: one
  dispatch, at the end of the outermost. Two concurrent commands never share a scope. A
  project's own `UnitOfWork` builds `run` on `withinUnitOfWork` and passes `unitOfWorkContract`.
- **Outside any unit of work** (a domain test, a repository used alone, a script) the save
  dispatches before it resolves, `before-commit` handlers then `after-commit` ones, and nothing
  is atomic.

**Use cases.** One command or query per folder, one handler per command. A command returns at
most an identifier. A query never changes state and may bypass aggregates to read a projection
through a port. Handlers orchestrate; business decisions live in the domain.

**Buses.** Presentation and integration event handlers talk to the application through `CommandBus` and
`QueryBus`, never to a handler class. Both are ports of `@ddd-ts-kit/kernel` with in-process
implementations; another transport is an adapter chosen in the composition root. Cross-cutting
behaviour (unit of work, authorization, logging, metrics, audit) is a bus middleware, not
code repeated in handlers. A command is a class extending `Command<Result>`, a query a class extending
`Query<Result>`. In the declared style, the default, a handler is registered by its own
declaration (`@CommandHandler`, `@QueryHandler`) and the context has no module file; in the
explicit style it is registered in `<context>.module.ts`.

**Ports.** A port is an abstract class with abstract members only: no constructor, no
field, no body. The class is the contract and the injection token at once, so there is no
constant and no token file. An adapter implements its port and never extends it; a fake or a
plain object fits as well, the type being structural. A repository port extends the kernel
`Repository<Aggregate>`. A value that is not a port (settings, a database handle) is carried
the same way, by an abstract class with readonly members bound to a plain object.

**Declarations.** A class says what it is where it is written, and that is its
registration: a command or a query carries `@Requires(permission)` or `@Public()`, its
handler `@CommandHandler(Message, [ports])` or `@QueryHandler`, a reaction to an event
`@DomainEventHandler` or `@IntegrationEventHandler(definition, { consumer })`, a job
`@Scheduled`, an adapter `@Repository`, `@Gateway` or `@Adapter` with the port it implements,
a policy `@Policy`. The list names the ports the constructor receives, in order, and the
compiler checks it: `@CommandHandler(PlaceOrder, [OrderRepository, Clock])`. Declarations are
metadata of the kernel: they instantiate nothing and import no container. The composition
root turns a context's declarations into its module, from the generated barrel or by
discovery, so a context has no hand-maintained registration file. The domain declares
nothing: aggregates, entities, value objects and domain events carry no decorator. Decorators
work in both decorator modes of TypeScript, so a project bound to the legacy mode by
class-validator or NestJS uses the same ones. The explicit style (`<context>.module.ts`
listing the bindings) remains available and can be mixed in.

**Error reporting.** Unexpected failures go to the `ErrorReporter` port, from outside the
use cases: a response answered 5xx, a command failing on something that is not a business
refusal, an integration event buried after its retries, a failed job, a crash of the process.
A `DomainError` is an answer, not an incident, and is not reported. One failure is one
report, by the first boundary that sees it, carrying the correlation id and the trace id and
nothing personal beyond the actor's identifier.

**Scheduled jobs.** A job run by time is declared with
`@Scheduled('<context>.<job>', { every } or { cron, timeZone }, [ports])` in
`application/scheduling/` and does one thing: it sends a command. It runs in its own
execution scope (origin `schedule`, a system actor named after the job, a fresh correlation
id), so it is logged, measured and audited like any other unit of work. Across several
instances a lock keeps an occurrence to one run, best effort: an occurrence may run twice or
not at all, so the job or its command is idempotent, and `execution.scheduledAt`, never the
clock, says which period the work is for. Jobs can run in the API process or in a dedicated
worker, and a context extracted as a service takes its jobs with it.

**Ports and adapters.** A port is named for what the application needs
(`PaymentGateway`), not for the technology (`StripeClient`). Each port has a fake in `test/fakes/`.

**Errors.** Expected business failures are `DomainError`s with codes; presentation maps codes to
transport statuses in one place. Infrastructure faults are plain errors and become a 5xx.
Messages of caught errors never go into logs or spans (they quote data).

**Integration events.** The only way two contexts communicate. Each event is declared once in
the producer's `published-language/` with `defineIntegrationEvent({ type, version, payload })`:
the declaration gives the payload type, validates what is published and consumed, and feeds
the generated event catalog and AsyncAPI document. Versioned envelope (`IntegrationEvent`),
additive changes only inside a version, at-least-once delivery, idempotent consumers. The
provider is technology-agnostic: any `EventBus` (`IntegrationEventPublisher` and
`IntegrationEventSubscriber`), in-memory by default, a broker or queue service through an
adapter that passes the provider contract suite, chosen in the composition root. With a
database, events leave through a transactional outbox: stored in the transaction of the
command, relayed afterwards.

**Outbox, by transport.** Publishing an integration event and committing the state change it
describes must succeed or fail together. The rule is one: the handler writes the event to the
outbox in the transaction of the command, a relay publishes it afterwards, the consumer
deduplicates. What varies with the tools is the relay and the consumer side:

| Transport | Relay | Consumer side |
|---|---|---|
| same process, no broker | polling relay to the in-memory bus (or woken by the database: PostgreSQL `LISTEN/NOTIFY`) | processed-event store in the consumer's transaction |
| RabbitMQ and other queue brokers | polling relay publishing with publisher confirms, mark published on confirm | durable queue per consumer, manual ack after commit, dead-letter exchange after bounded retries |
| Kafka and other logs | polling relay, or change data capture reading the outbox table (Debezium outbox router); key = aggregate id for per-aggregate order | consumer group per consumer, offset committed after the handler's transaction, bounded retries in place then a dead-letter topic, processed-event store for redelivery |
| NATS JetStream, Redis Streams | polling relay publishing with an acknowledgement (on JetStream the event id is the message id, so the stream drops a relay retry) | one durable consumer (JetStream) or consumer group (Redis) per consumer and event type, explicit acknowledgement after commit, bounded delayed redeliveries then a dead-letter stream |
| cloud queues and topics (SQS/SNS, Pub/Sub) | polling relay, batch publish | visibility timeout above the handler's worst case, redrive policy to a dead-letter queue |

Without a database there is nothing to be atomic with, and the in-memory bus alone is enough.
Change data capture is a relay strategy, not a way around the outbox table.

**Extractable contexts.** A bounded context is a deployable unit in waiting. Moving one to its
own service must be a change of composition root and adapters, never of domain or application
code. Hence: one database schema per context and no cross-context foreign key, join or
transaction; collaboration through integration events, and for a synchronous need a port in
the caller (`kind: gateway`) whose adapter is in-process today and an HTTP or RPC client
tomorrow; configuration read through the platform, namespaced by context; no shared mutable
state. `src/apps/<context>/main.ts` composes one context with the kernel and the platform, and
a generated architecture test boots every context alone to prove it stays true.

**Authentication and authorization.** Three separate responsibilities, three places:

- *Authentication* (who is calling) is a platform concern at the boundary: an adapter of the
  `Authenticator` port verifies the credential and produces a `Session` holding the `Actor`
  (subject, tenant, roles or attributes, never the raw token) and how it authenticated.
  Routes and integration event handlers put the actor in the command or query. Every route declares its
  `security`; the type refuses a route that does not.
- *Authorization* (may this actor do this, on this) is an application concern: each context
  declares its permissions in `application/authorization/<context>.permissions.ts`, each
  command and query names the permission it requires, and a bus middleware asks the
  `Authorizer` port before the handler runs. Deny by default. Rules that need the state of the
  aggregate (only the author may edit, not after closing) are policies in
  `application/authorization/*.policy.ts`; the handler asks them, once the aggregate is
  loaded, through the `Access` port of `@ddd-ts-kit/auth`
  (`access.authorize(command.actor, permission, element)`).
- *Invariants* stay in the domain: "an invoice cannot be paid twice" is not a permission.

The authorization model is the project's choice, behind the one port: roles (RBAC), policies
over attributes (ABAC), or relationships in the manner of Google Zanzibar (ReBAC: tuples
`object#relation@subject`, permissions derived by rewriting, check and list operations), in
process or delegated to a dedicated service. Changing model changes an adapter and the
permission definitions, not the handlers.

*The current actor.* Use cases get it explicitly, as data of the command or query. Lists are
filtered by passing the access scope of the actor (`access.scope(actor, permission, type)`)
to the read port, never by filtering in memory after loading. Every unit of work (a request, a consumed event, a
scheduled job) runs inside an `ExecutionScope` opened at the boundary, holding the
`ExecutionContext`: correlation and causation ids, actor, session, tenant, origin.
Infrastructure that needs any of it without being handed it (audit columns, tenant scoping of
every query, log fields, the correlation id stamped on published events) reads the scope;
`ActorContext` is a view of it. Domain and application code never read it.

**Standard interfaces.** The kernel defines the shapes every project shares, so adapters and
tooling interoperate: `Actor`, `Session`, `ExecutionContext`, `Logger`, `Metrics`, `Cache`,
`Lock`, `RateLimiter`, `JobScheduler`, `ErrorReporter`, `Page` and `PageRequest`, `AuditStamp`, `TenantScoped`, the audit
ports `AuditTrail` and `AuditReader` with their `AuditEntry`, next to `Clock`, `IdGenerator`
and `UnitOfWork`. A project extends them without forking, by augmenting the extension interfaces
the kernel leaves open (`SessionExtensions`, `ExecutionContextExtensions`, ...). A project
that needs a concept of this kind uses the standard one; a parallel home-made `UserContext`
or `ILogger` is a defect.

**Cross-cutting behaviour.** Logging, metrics, tracing, retry, timeout, circuit breaking and
caching are never written inside domain or application code. They are applied from outside,
in this order of preference: wrappers given from outside, for every binding of a kind by the
platform (`builder.around(['external', 'gateway'], ...)`), or for one adapter on its
declaration or its binding (`aspects` of `@Adapter`, `.with(retry(...), timeout(...))`);
bus middlewares for what concerns every use case; and, for an adapter whose policy is part of
its definition, a standard decorator on the adapter class in `infrastructure/` or `platform/`.
None of the three is allowed in `domain/` or `application/`. Tracing is one more layer of
the same kind, wired once by the platform: `kernelModule({ instrumentation: traceApplication() })`
puts the spans around the buses, the bindings, the domain events, the publications, the
consumers and the jobs, `tracedRoutes()` around the routes and `tracedPublisher(bus)` around
what the outbox relay delivers with. What an aspect records follows
the tracing rule: class, method, context, duration, error code; never arguments, results or
error messages.

**Deviations.** The architecture is not negotiable case by case, but it can be changed
deliberately. Choosing among supported options (ORM, broker, authorization model, framework)
is the project owner's call. Bypassing a rule is different: it is either refused, or recorded
as a decision (`docs/adr/`), with the reason, the scope and the condition for removing it,
and referenced from the suppression or the config entry. A shortcut that is not written down
is a defect, whoever asked for it.

**Standard persistence shapes.** Audit columns are named `created_at`, `created_by`,
`updated_at`, `updated_by` and the tenant column `tenant_id` in every project, written from
the execution scope by the repository adapter through the kernel helpers. Lists use the
kernel `Page` and `PageRequest`; a cursor always ends on a unique tie-breaker so paging is
stable.

**Persistence.** Repositories are ports of the domain. Drizzle on PostgreSQL is the
default adapter family, one database schema per context; Knex, Prisma and TypeORM have
adapter packages too, and any other mature ORM or database is an adapter of the same interfaces and passes the same repository contract suite. Rows never
leave `infrastructure/persistence/`: a mapper translates to and from the aggregate.

**Validation.** Two different things. Input shape is validated at the boundary (presentation)
with the schema library of the project, behind the `Schema` port. Business rules are enforced
in the domain and never depend on a validation library.

**Contract.** The OpenAPI document is generated from route definitions and committed. CI
regenerates it and fails on a diff. It is never edited by hand.

**Tracing.** Non-invasive: no tracing import in `domain/` or `application/`; the platform
wires it once. One action is one trace: the request, the use case, each call to a repository,
a gateway or an outside system, the domain events dispatched at the end of the unit of work
and their handlers (before the commit, then after it), the outbox append, then, later and in
the same trace, the publication by the relay and each consuming
context with the commands it sends. A scheduled job is a trace of its own. Span names are
stable and low in cardinality (`command BookAppointment`, `repository
AppointmentRepository.save`, `process notification.appointment-booked`: `<kind> <Name>` for a
use case, `<kind> <Port>.<method>` for a binding, `process <consumer>` for a consumed event); health, readiness
and documentation routes and plumbing produce none. A span carries class, method, context,
outcome and an error code, the root also the correlation id and the origin, never arguments,
results, error messages or anything about the actor. The same correlation id is on log
lines, audit entries and error reports.

## 5. Tests

| Kind | Target | Doubles |
|---|---|---|
| unit | aggregates, value objects, domain services | none |
| unit | handlers | fakes of ports and repositories (no mocking library needed) |
| integration | adapters against the real dependency | none |
| contract | each fake and each adapter pass the same port contract suite | |
| architecture | `ddd-ts-kit check` | |

Tests name behaviour in business language, with Vitest by default.

**Fakes, not mocks.** A fake is a working in-memory implementation of a port, kept in
`test/fakes/` and held to the same contract suite as the real adapter. Mocks, spies and module
mocking are avoided: they assert calls instead of outcomes and break on refactoring. Assert
the state of the fake, the events on the in-memory bus, the returned value.

**Builders.** Test data comes from builders in `test/builders/`: `anOrder().paid().withLine(aLine().of('sku-1')).build()`.
A builder has valid defaults, intention-revealing methods in the ubiquitous language, and
builds through the aggregate's public API so a test can never start from an invalid state.
A test states only what matters to the rule it checks.

**Scenarios.** Aggregate specs read given / when / then: past events or a built state, one
intention, then the recorded events or the raised error.

## 6. Clean code

After Robert C. Martin's *Clean Code*, applied to TypeScript.

**Names.** From the ubiquitous language, pronounceable, searchable, one word per concept
across a context. A class is a noun of the domain, a method a verb of the domain, a boolean a
predicate (`isOverdue`). No encoding, no technical suffix in the domain.

**Functions.** Small, one thing, one level of abstraction. At most three parameters; beyond
that the parameters are a concept that deserves a type. No flag argument, no output argument.
Command or query, never both: a function changes state or answers, not both.

**Files.** One exported class, interface or function per file, named after it; the only
companions are the types of its own signature. A file never exceeds 350 lines: past that it
holds more than one responsibility. Index files only re-export.

**Layout.** A blank line before every `return` unless it is alone in its block, and between
the logical blocks of a function: after a group of declarations, around `if`, `for`, `try`.
Every `if`, `else`, `for`, `while` and `do` has braces and its body on its own lines: a branch
is visible at a glance, and a statement added to it later cannot silently fall outside it.
Where everything else goes is not a matter of taste: the formatter lays out every file, at a
line width of 120. Class members are `private`, not `#`.

**Size.** A function does one thing and stays short: 30 lines by default, never more than 100.

**Order (the stepdown rule).** A file reads like a newspaper: the high-level intention at the
top, details below. In a class: static factories, then public methods, then private methods,
each private method placed after its first caller. In a module: the exported function first,
its helpers after it in the order they are called.

**Comments.** The code says what; a comment is kept only for what the code cannot say: why a
non-obvious decision was taken, a warning about a consequence, the reference of an external
rule (law, RFC, vendor quirk), a public API contract. No comment that paraphrases a name, no
commented-out code, no banner, no history, no author. A comment that explains what a block
does is a function name waiting to be extracted.

**Errors.** Exceptions or `Result`, never error codes mixed with return values, never `null`
for "failed". Specific error classes with context.

**Types.** `strict` TypeScript. No `any`, no non-null assertion, no type assertion outside
mappers, no suppressed diagnostics without a written reason.

**Testability by construction.** Domain and application are pure with respect to the outside
world: time through `Clock`, identifiers through `IdGenerator`, every I/O through a port,
dependencies received by constructor. A class that needs a mock of a module to be tested is
breaking one of these rules.

## 7. Test levels

| Level | What runs | Data | Speed |
|---|---|---|---|
| domain | aggregates, value objects, services, no double at all | builders | milliseconds |
| application | real handlers through the in-memory buses, fakes for every port, `FixedClock` | builders | milliseconds |
| adapter | one real adapter against its real dependency, plus the contract suite | builders | seconds |
| end to end | the whole application with real adapters, driven through HTTP and the event bus | builders with generated data (seeded faker), created through the public API | seconds |

The same builders serve every level. End-to-end tests use generated, realistic data with a
fixed seed that is printed on failure, so a failing run can be replayed exactly. They assert
what a client observes (responses, published events), never the database directly.
