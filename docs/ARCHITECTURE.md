# Architecture reference

The single normative document. The CLI (`ddd-ts-kit check`), the templates, the skills and the
hook all implement what is written here. When they disagree, this file is right and the tool is
to be fixed.

## 1. Strategic design

A system is a set of **bounded contexts**. Each one owns a model, a vocabulary and its data.

- Every context has a `CONTEXT.md`: purpose, classification, ubiquitous language (glossary),
  aggregates, published events, relationships.
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
  platform/                      technical capabilities: config, database, tracing, http server
  contexts/<context>/
    CONTEXT.md
    <context>.module.ts          the context's composition: binds ports to adapters
    published-language/          contracts designed for other contexts
    domain/
      aggregates/                *.aggregate.ts
      entities/                  *.entity.ts
      value-objects/             *.vo.ts
      events/                    *.event.ts
      errors/                    *.error.ts
      repositories/              *.repository.ts   (interfaces only)
      services/                  *.service.ts      (stateless domain logic over several aggregates)
    application/
      commands/<use-case>/       *.command.ts, *.handler.ts
      queries/<use-case>/        *.query.ts, *.handler.ts
      ports/                     *.port.ts         (interfaces to the outside world)
      event-handlers/            *.event-handler.ts (reactions to this context's domain events)
      integration/
        publishers/              *.publisher.ts    (domain event to integration event)
        consumers/               *.consumer.ts     (integration event to command)
    infrastructure/
      persistence/               *.repository.ts adapters, mappers
      external/                  adapters of outside systems
      anti-corruption/           translators of another context's or system's model
    presentation/
      http/                      *.route.ts or *.controller.ts, *.dto.ts
      cli/
    test/
      unit/  integration/
      fakes/                     in-memory implementations of ports and repositories
      builders/                  *.builder.ts      (test data builders, one per aggregate)
```

The tree is **closed**: a directory not listed here is a design decision, added to
`extraDirectories` in the config with a reason, not created ad hoc. The levels named
`<use-case>` are open.

## 3. Dependency rules

```
presentation ──▶ application ──▶ domain ◀── infrastructure
                      ▲                          │
                      └──────────────────────────┘
```

| Id | Rule |
|---|---|
| `layer/domain-purity` | `domain/` imports only its own `domain/`, the shared kernel and `@ddd-ts-kit/kernel`. No framework, no ORM, no validation library, no Node built-in doing I/O. |
| `layer/application-inward` | `application/` imports `domain/`, `application/`, published languages and the kernel. Never `infrastructure/` or `presentation/`, never a framework or a driver. |
| `layer/presentation-no-infrastructure` | `presentation/` imports `application/` (and domain types for mapping), never `infrastructure/`. |
| `layer/infrastructure-no-presentation` | `infrastructure/` implements ports of `application/` and `domain/`, never imports `presentation/`. |
| `context/published-language-only` | A file imports from another context only through that context's `published-language/`. |
| `context/declared-relationship` | Such an import requires the relationship to be declared in the config. |
| `context/published-language-is-a-contract` | `published-language/` imports only the kernel, `@ddd-ts-kit/events`, the schema library and other published languages (`publishedLanguageAllowedPackages`). |
| `context/no-cycle` | The declared relationships form no cycle. |
| `tree/closed` | A context holds only the canonical directories. |
| `tree/context-doc` | Every context has a `CONTEXT.md` with the required sections. |
| `naming/suffix` | A file in a role directory carries the role's suffix, in kebab-case. |
| `naming/one-concept-per-file` | One exported aggregate, entity, value object, event, handler per file. |
| `test/spec-required` | Every aggregate, value object, domain service, command handler, query handler, event handler and consumer has a `*.spec.ts` in the context's `test/`. |
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
| `clean/function-size` | A function has at most 3 parameters and 30 lines (configurable); a longer one is doing more than one thing. Default severity `warn`. |
| `clean/no-commented-out-code` | No code in comments. Version control remembers. |
| `clean/no-noise-comment` | No comment that restates the code, no banner, no journal, no closing-brace comment, no `@param` without description. Default severity `warn`. |
| `clean/no-escape-hatch` | No `any`, no non-null assertion, no type assertion outside mappers and infrastructure, no `@ts-ignore`, no `@ts-expect-error` without a reason, no `eslint-disable` without a reason. |
| `clean/no-flag-argument` | No boolean parameter on a public method of the domain or a use case: two intentions are two methods. Default severity `warn`. |
| `domain/aggregate-encapsulation` | An aggregate or entity has a private or protected constructor, no public mutable property and no setter. |
| `domain/value-object-immutability` | A value object has only readonly properties and never assigns to itself outside its constructor. |
| `domain/no-generic-error` | `domain/` and `application/` never `throw new Error(...)`: a business failure is a `DomainError` subclass. |
| `application/handler-shape` | A `*.handler.ts` file exports one class with a single public method, `execute`. |
| `application/command-query-separation` | A query handler never saves, deletes or publishes. Default severity `warn`. |
| `composition/only-in-module` | Adapters are instantiated or registered only in `<context>.module.ts` and `main.ts`. |

Only the module file and `main.ts` are allowed to know every layer.

### Who checks what

Three analyzers hold the rules, each where it is exact:

| Analyzer | Holds | When |
|---|---|---|
| `ddd-ts-kit check` (zero dependency, text level) | structure: `tree/*`, `naming/*`, `language/*`, `config/*`, `context/no-cycle`, `test/spec-required`, `test/builder-required`, and a fast approximation of the code rules | at every file write (editor hook), in CI |
| `@ddd-ts-kit/eslint-plugin` (syntax tree, type-aware) | code: `layer/*`, `context/*` imports, `purity/*`, `clean/*`, `domain/*`, `application/*`, `test/no-mocks`, `events/name-format`. Authoritative when the two disagree | on staged files, in CI |
| dependency-cruiser (resolved import graph) | the same boundaries through barrels and re-exports, cycles between files, orphans, undeclared dependencies | in CI |

knip (dead code and unused dependencies) and the TypeScript compiler in `strict` mode complete the gate.

## 4. Tactical rules

**Aggregates.** Private constructor, a `create` factory for birth and a `rehydrate` factory for
loading. State changes through methods named after the business intention, never setters. One
aggregate per transaction; another aggregate is referenced by id. Invariants are checked inside,
and a violated one raises a `DomainError` with a stable `code`.

**Value objects.** Immutable, validated in `create`, compared with `equals`. Primitive obsession
is a defect: an email, an amount, a period are types.

**Domain events.** Past tense, immutable, recorded by the aggregate, pulled and dispatched by
the application layer after the unit of work commits.

**Use cases.** One command or query per folder, one handler per command. A command returns at
most an identifier. A query never changes state and may bypass aggregates to read a projection
through a port. Handlers orchestrate; business decisions live in the domain.

**Buses.** Presentation and consumers talk to the application through `CommandBus` and
`QueryBus`, never to a handler class. Both are ports of `@ddd-ts-kit/kernel` with in-process
implementations; another transport is an adapter chosen in the composition root. Cross-cutting
behaviour (unit of work, authorization, logging) is a bus middleware, not code repeated in
handlers. A command is a class extending `Command<Result>`, a query a class extending
`Query<Result>`; handlers are registered in `<context>.module.ts`.

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

**Persistence.** Repositories are interfaces of the domain. Drizzle on PostgreSQL is the
default adapter family, one database schema per context; Knex, Prisma and TypeORM have
adapter packages too, and any other mature ORM or database is an adapter of the same interfaces and passes the same repository contract suite. Rows never
leave `infrastructure/persistence/`: a mapper translates to and from the aggregate.

**Validation.** Two different things. Input shape is validated at the boundary (presentation)
with the schema library of the project, behind the `Schema` port. Business rules are enforced
in the domain and never depend on a validation library.

**Contract.** The OpenAPI document is generated from route definitions and committed. CI
regenerates it and fails on a diff. It is never edited by hand.

**Tracing.** Non-invasive: no tracing import in `domain/` or `application/`. Adapters are
wrapped at registration in the composition root; a span carries class, method, context and an
error code, never arguments, results or error messages.

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
