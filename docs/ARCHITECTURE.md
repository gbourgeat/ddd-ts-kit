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
  platform/                      technical capabilities: config, database, events, auth, tracing, http server
  apps/<context>/main.ts         optional: one context run alone as a service
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
      repositories/              *.repository.ts   (interfaces only)
      services/                  *.service.ts      (stateless domain logic over several aggregates)
    application/
      commands/<use-case>/       *.command.ts, *.handler.ts
      queries/<use-case>/        *.query.ts, *.handler.ts
      ports/                     *.port.ts         (interfaces to the outside world), <context>.ports.ts (their tokens)
      authorization/             <context>.permissions.ts, *.policy.ts (who may do what, here)
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
| `layer/application-inward` | `application/` imports `domain/`, `application/`, published languages, the kernel and `@ddd-ts-kit/auth` (permissions and policies). Never `infrastructure/` or `presentation/`, never a framework or a driver. |
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
| `events/outbox-required` | With a database, integration events are published through the transactional outbox, never straight to a broker or a bus from a handler. `stack.events` is `outbox` whenever `stack.orm` is set. |
| `events/consumer-idempotent` | Every consumer is registered with a stable, unique consumer name and deduplicates through a processed-event store (bound once for the application, or given to the subscription). |
| `context/extractable` | A context can run alone: its module wires with the kernel and the platform only, it reads no table of another context, shares no transaction with one, and calls another context only through a port whose adapter could be remote. |
| `authz/declared` | Every command, query and route declares the permission it requires, or declares itself public. Nothing is reachable by default. |
| `authz/in-application` | The permission is decided in the application layer through the `Authorizer` port. No role or ownership test in `presentation/`, no authorization in `infrastructure/`, no knowledge of the acting user's rights in `domain/` (a context whose model is access itself may hold roles as its own state). |
| `authz/actor-explicit` | Use cases receive the actor in the command or query. `domain/` and `application/` never read the ambient `ExecutionScope` or `ActorContext`; only infrastructure and the platform may, for audit columns, tenant scoping and correlation. |
| `governance/recorded-deviation` | A suppression, a lowered severity, an extra directory or an extra allowed package carries a reason and points to a decision record in `docs/adr/`. |
| `aspects/outside-in` | Aspects are applied from outside. The decorators of `@ddd-ts-kit/aspects/decorators` are imported only by an adapter in `infrastructure/` or by the platform; everywhere else an aspect is a wrapper bound at the composition root (`.with(...)`, the `decorate` hook) or a bus middleware. |
| `standard/no-parallel-interface` | No home-made copy of a standard interface of the kernel: no declared `ILogger`, `AppLogger`, `UserContext`, `CurrentUser`, `UserSession`, `PaginatedResult`, `AuditLog` and the like. Use the kernel interface and extend it by declaration merging; the list is `standardInterfaces` in the config. Default severity `warn`. |
| `composition/only-in-module` | Adapters are instantiated or registered only in `<context>.module.ts` and `main.ts`. |

Only the module file and `main.ts` are allowed to know every layer.

### Who checks what

Three analyzers hold the rules, each where it is exact:

| Analyzer | Holds | When |
|---|---|---|
| `ddd-ts-kit check` (zero dependency, text level) | structure and project-wide facts: `tree/*`, `naming/*`, `language/*`, `config/*`, `context/no-cycle`, `test/spec-required`, `test/builder-required`, the config side of `events/outbox-required` and `governance/recorded-deviation` (decision records exist), unique consumer names, and a fast approximation of the code rules | at every file write (editor hook), in CI |
| `@ddd-ts-kit/eslint-plugin` (syntax tree) | code: `layer/*`, `context/*` imports and `context/extractable`, `purity/*`, `clean/*`, `domain/*`, `application/*`, `authz/*`, `events/*`, `aspects/*`, `standard/*`, `test/no-mocks`, and the comment side of `governance/recorded-deviation`. Authoritative when the two disagree | on staged files, in CI |
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

**Declarations.** A class says what it is where it is written, and that is its
registration: a command or a query carries `@Requires(permission)` or `@Public()`, its
handler `@CommandHandler(Message, [tokens])` or `@QueryHandler`, a consumer
`@EventListener(definition, { consumer })`, an adapter `@Repository`, `@Gateway` or
`@Adapter` with the port token it implements, a policy `@Policy`. The token list names the
constructor dependencies in order and the compiler checks it. Declarations are metadata of
the kernel: they instantiate nothing and import no container. The composition root turns a
context's declarations into its module, from the generated barrel or by discovery, so a
context has no hand-maintained registration file. The domain declares nothing: aggregates,
entities, value objects and domain events carry no decorator. Decorators work in both
decorator modes of TypeScript, so a project bound to the legacy mode by class-validator or
NestJS uses the same ones. The explicit style (`<context>.module.ts` listing the bindings)
remains available and can be mixed in.

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
| Kafka and other logs | polling relay, or change data capture reading the outbox table (Debezium outbox router); key = aggregate id for per-aggregate order | consumer group per consumer, offset committed after the handler's transaction, processed-event store for redelivery |
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
  Routes and consumers put the actor in the command or query. Every route declares its
  `security`; the type refuses a route that does not.
- *Authorization* (may this actor do this, on this) is an application concern: each context
  declares its permissions in `application/authorization/<context>.permissions.ts`, each
  command and query names the permission it requires, and a bus middleware asks the
  `Authorizer` port before the handler runs. Deny by default. Rules that need the state of the
  aggregate (only the author may edit, not after closing) are policies in
  `application/authorization/*.policy.ts`, evaluated by the handler through the same port.
- *Invariants* stay in the domain: "an invoice cannot be paid twice" is not a permission.

The authorization model is the project's choice, behind the one port: roles (RBAC), policies
over attributes (ABAC), or relationships in the manner of Google Zanzibar (ReBAC: tuples
`object#relation@subject`, permissions derived by rewriting, check and list operations), in
process or delegated to a dedicated service. Changing model changes an adapter and the
permission definitions, not the handlers.

*The current actor.* Use cases get it explicitly, as data of the command or query. Lists are
filtered by passing an access scope computed by the authorizer to the read port, never by
filtering in memory after loading. Every unit of work (a request, a consumed event, a
scheduled job) runs inside an `ExecutionScope` opened at the boundary, holding the
`ExecutionContext`: correlation and causation ids, actor, session, tenant, origin.
Infrastructure that needs any of it without being handed it (audit columns, tenant scoping of
every query, log fields, the correlation id stamped on published events) reads the scope;
`ActorContext` is a view of it. Domain and application code never read it.

**Standard interfaces.** The kernel defines the shapes every project shares, so adapters and
tooling interoperate: `Actor`, `Session`, `ExecutionContext`, `Logger`, `Metrics`, `Cache`,
`Lock`, `RateLimiter`, `Page` and `PageRequest`, `AuditStamp`, `TenantScoped`, the audit
ports `AuditTrail` and `AuditReader` with their `AuditEntry`, next to `Clock`, `IdGenerator`
and `UnitOfWork`. A project extends them without forking, by augmenting the extension interfaces
the kernel leaves open (`SessionExtensions`, `ExecutionContextExtensions`, ...). A project
that needs a concept of this kind uses the standard one; a parallel home-made `UserContext`
or `ILogger` is a defect.

**Cross-cutting behaviour.** Logging, metrics, tracing, retry, timeout, circuit breaking and
caching are never written inside domain or application code. They are applied from outside,
in this order of preference: wrappers bound at the composition root
(`.with(retry(...), timeout(...))`, or globally through the `decorate` hook, as tracing is);
bus middlewares for what concerns every use case; and, for an adapter whose policy is part of
its definition, a standard decorator on the adapter class in `infrastructure/` or `platform/`.
None of the three is allowed in `domain/` or `application/`. What an aspect records follows
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
error code, the root span also the correlation id and the origin, never arguments, results,
error messages or anything about the actor.

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
