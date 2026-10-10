# ddd-ts-kit

Domain-Driven Design, Clean Architecture and Clean Code for TypeScript backends, held by tools
rather than by good intentions.

It is three things that share one definition of the architecture
([docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)):

- a **Claude Code plugin**: skills, agents and hooks that make a coding agent work inside the
  architecture, generate instead of typing boilerplate, and stop when a rule is broken;
- a **CLI**: bootstrap a project in minutes, scaffold every building block from templates,
  verify the structure, generate the documentation;
- **runtime packages and analyzers**: framework-agnostic building blocks, an ESLint plugin
  and a CI pipeline for GitHub and GitLab.

TypeScript only. No framework imposed: Express, Fastify or NestJS; zod, class-validator or any
Standard Schema library; tsyringe, NestJS or manual wiring; Drizzle, Knex, Prisma or TypeORM;
RabbitMQ, Kafka, NATS JetStream or Redis Streams; JWT or Keycloak; roles, attributes or
relationships. `ddd-ts-kit init` without a flag takes Express, zod, tsyringe, Drizzle on
PostgreSQL and Vitest.

## Quick start

```bash
mkdir orders-api && cd orders-api
npx ddd-ts-kit init --http express --validation zod --di tsyringe --orm drizzle \
  --context ordering:core --context billing:supporting
npm install
npm run infra:up      # PostgreSQL (and a tracing backend with the observability profile)
npm run dev           # auto reload; API documentation on /docs
npm run verify        # types, lint, format, tests, e2e, architecture, import graph, dead code, documentation drift
```

Then, the ubiquitous language first, code second:

```bash
npx ddd-ts-kit generate aggregate ordering Order --term "Order=A customer's request to buy products"
npx ddd-ts-kit generate repository ordering Order
npx ddd-ts-kit generate command ordering PlaceOrder --permission order.place --aggregate Order \
  --term "Place=To submit an order for fulfilment"
npx ddd-ts-kit generate route ordering PlaceOrder --method POST --path /orders
npx ddd-ts-kit status     # what is left: TODO(domain), TODO(platform) and it.todo per context
```

Each command writes the file, its spec, its fake or builder and its registration, and lists
the `TODO(domain)` places where a business decision is expected. A name that is not in the
context's glossary is refused, and so is a command or a query that declares neither a
permission nor `--public`. `npx ddd-ts-kit generate --help` lists the 25 kinds.

## The Claude Code plugin

```
/plugin marketplace add gbourgeat/ddd-ts-kit
/plugin install ddd-ts-kit@ddd-ts-kit
```

Twenty-two skills, in the order a project meets them:

| Skill | Use |
|---|---|
| `start` | conduct a project from a statement of needs to working contexts (run by the user) |
| `discover-domain` | a light event storming in writing |
| `bounded-contexts` | find the contexts and classify them core, supporting or generic |
| `glossary` | the ubiquitous language of a context and its `CONTEXT.md`, before any code |
| `context-map` | upstream, downstream and relationship pattern for each pair of contexts |
| `bootstrap` | choose the stack and create the project (run by the user) |
| `plan-slices` | the work as vertical slices per context, ordered, with their generator commands |
| `parallel-work` | split the slices between several agents or people without collision |
| `scaffold` | one file of any role, from a template |
| `use-case` | one feature end to end, test first |
| `integration-event` | make two contexts collaborate through a versioned event |
| `wiring` | ports as abstract classes, declarations, the composition root, fakes in tests |
| `persistence` | repositories, unit of work, outbox, read models, migrations, whatever the ORM |
| `access-control` | authentication, permissions per use case, the explicit actor, policies |
| `cross-cutting` | logging, metrics, tracing, error reporting, audit trail, resilience and caching from outside |
| `testing` | fakes instead of mocks, builders, given / when / then, end to end |
| `clean-code` | naming, function order, comments, testability |
| `document` | OpenAPI contract, event catalog, AsyncAPI, generated lists, decision records |
| `extract-service` | keep each context ready to run as its own service, and extract it |
| `deviation` | what to do when asked to go around a rule |
| `quality-gate` | run the checks at the right scope and fix at the root cause |
| `commit-discipline` | one slice per commit, generated files with what generated them |

Four agents: `domain-explorer` (read-only answers about what exists and where),
`context-builder` (builds the slices of one context in its own worktree),
`domain-test-writer` (turns `it.todo` entries into specs) and `architecture-reviewer`
(read-only review of a diff, a branch or a context).

The hook is the part that makes the rest binding. In a project that has a
`ddd-ts-kit.config.json` it reminds the workflow and the context map at session start, refuses
a hand-written file where a generator exists and any edit of a generated contract, asks the
project owner before a suppression, a skipped test or a change of the rules is written, checks
every written file and returns the violations with their fix, and refuses to finish while
architecture errors remain. It reminds, without blocking, when the uncommitted changes exceed
the advised size of a commit, and in a worker's worktree (`.ddd-ts-kit/worker.json`) it
refuses a write outside the worker's context. It fails open: a broken guard never blocks work. Set
`"guard": "advise"` in the config to be asked instead of refused, `"off"` to silence it.

## What is enforced

Rules have ids, a reason and a fix (`npx ddd-ts-kit explain <rule-id>`):

- **Layers** (`layer/*`): presentation, application, domain, infrastructure; the domain imports
  nothing but itself and the kernel.
- **Bounded contexts** (`context/*`, `tree/*`): a closed canonical tree, a `CONTEXT.md` per
  context, relationships declared in a context map, another context reached only through its
  published language, no cycle.
- **Ubiquitous language** (`language/*`): every domain class and use case is named with terms
  of the context's glossary; technical names are refused in the domain.
- **Purity** (`purity/*`): time through `Clock`, identifiers through `IdGenerator`, no
  environment access in domain or application.
- **Tactical DDD** (`domain/*`, `application/*`, `events/*`, `domain-events/*`): encapsulated
  aggregates, immutable value objects, specific domain errors, one handler per use case,
  domain events dispatched at the end of the unit of work (before the commit, or after it for a
  declared handler), integration events declared once with a schema.
- **Ports and wiring** (`ports/*`, `declarations/*`, `composition/*`): a port is an abstract
  class and its own injection token, an adapter implements it, a class declares its role with
  a decorator and is assembled in one place.
- **Clean code** (`clean/*`): stepdown order, small functions and files, one export per
  file, no flag argument, no commented-out code, no noise comment, no escape hatch.
- **Cross-cutting concerns** (`aspects/*`, `tracing/*`, `standard/*`, `scheduling/*`):
  resilience and tracing applied from outside, the standard interfaces of the kernel, jobs
  that only trigger use cases.
- **Access control** (`authz/*`): every use case and route declares its permission or says it
  is public; rights are decided in the application layer, never in a controller, a repository
  or the domain; the actor is explicit.
- **Extractable contexts** (`context/extractable`, `events/outbox-required`): own data, no
  shared transaction, events through the transactional outbox, idempotent consumers, each
  context bootable alone.
- **Deviations** (`governance/recorded-deviation`): a suppression or a relaxed rule carries a
  reason and a decision record. The guard puts each one to the project owner.
- **Tests** (`test/*`): a spec for every unit of behaviour, a builder per aggregate, no mocks.

Three analyzers hold them, each where it is exact: the zero-dependency CLI checker for
structure and for instant feedback at every file write, the ESLint plugin on the syntax tree
for code rules, dependency-cruiser on the resolved import graph. knip and the TypeScript
compiler in strict mode complete the gate.

## Packages

| Package | What it gives |
|---|---|
| [`ddd-ts-kit`](packages/cli) | the CLI: `init`, `generate`, `check`, `docs`, `list`, `describe`, `status`, `todo`, `worker-scope`, `depcruise-config`, `rules`, `explain` |
| [`@ddd-ts-kit/kernel`](packages/kernel) | entities, aggregates, value objects, domain errors, `Result`; ports as abstract classes; the declarations (`@CommandHandler`, `@Repository`, ...); command, query and event buses with in-memory implementations; the standard extensible interfaces: `Actor`, `Session`, `ExecutionContext`, `Logger`, `Metrics`, `Cache`, `Page`, `Clock`, `IdGenerator`, `UnitOfWork`, `ErrorReporter`; the read side: criteria, hydration and read models |
| [`@ddd-ts-kit/events`](packages/events) | typed integration event declarations, registry, transactional outbox and relay, AsyncAPI and event catalog generation |
| [`@ddd-ts-kit/rabbitmq`](packages/rabbitmq), [`kafka`](packages/kafka), [`nats`](packages/nats), [`redis/event-bus`](packages/redis) | broker providers behind one contract: acknowledged publishing for the outbox relay, one durable subscription per consumer, bounded retries, dead letters |
| [`@ddd-ts-kit/scheduling`](packages/scheduling) | jobs run by time that only trigger use cases: intervals and cron with time zones, one run across instances, each run in its own execution scope |
| [`@ddd-ts-kit/auth`](packages/auth) | actors, permissions declared per use case, deny by default; role, attribute and relationship (Zanzibar-style) authorizers behind one port; JWT authentication |
| [`@ddd-ts-kit/aspects`](packages/aspects) | logging, metrics, retry, timeout, circuit breaker, cache and bulkhead applied from outside: wrappers, bus middlewares, standard decorators |
| [`@ddd-ts-kit/audit`](packages/audit) | hash-chained, append-only audit trail fed by authorization decisions, commands and integration events |
| [`@ddd-ts-kit/redis`](packages/redis) | cache, lock, rate limiter and relay signal on Redis, Dragonfly or Valkey |
| [`@ddd-ts-kit/http`](packages/http) | routes declared once, mounted on Express, Fastify or NestJS; RFC 9457 errors; OpenAPI 3.1 generation; Swagger UI, Scalar or Redoc |
| [`@ddd-ts-kit/validation`](packages/validation) | one `Schema` port over zod, class-validator and Standard Schema |
| [`@ddd-ts-kit/di`](packages/di) | context modules on tsyringe from the declarations of a context or from an explicit module, port classes as tokens, a test application with fakes |
| [`@ddd-ts-kit/pino`](packages/pino), [`winston`](packages/winston) | the kernel `Logger` port on pino or winston, with the correlation fields on every line |
| [`@ddd-ts-kit/sentry`](packages/sentry) | the kernel `ErrorReporter` port on Sentry or GlitchTip: unexpected failures only, scrubbed |
| [`@ddd-ts-kit/tracing`](packages/tracing) | OpenTelemetry wired once by the platform: the domain never imports it, spans never carry data |
| [`@ddd-ts-kit/testing`](packages/testing) | builders, given/when/then scenarios, in-memory repository, contract suites, seeded generated data, end-to-end harness |
| [`@ddd-ts-kit/drizzle`](packages/drizzle), [`knex`](packages/knex), [`prisma`](packages/prisma), [`typeorm`](packages/typeorm) | unit of work with an ambient transaction, outbox store, processed-event store, read model stores (the SQL projections of the read side) |
| [`@ddd-ts-kit/eslint-plugin`](packages/eslint-plugin) | the code rules on the syntax tree, with presets |

Everything talks through ports of the kernel, so each piece is replaceable: another event
provider, ORM or HTTP framework is an adapter that passes the same contract suite.

## Pipeline

`init --ci github|gitlab|both` installs the same gates on either platform, from the same npm
scripts: type check, lint, architecture, dead code, unit tests with coverage thresholds,
integration tests on PostgreSQL, end-to-end tests, documentation and contract drift, security
(audit, secret scan, and each platform's own scanners), image build, and a single final gate
to mark as required. Details and the GitHub and GitLab equivalence table:
[pipeline/README.md](pipeline/README.md).

## Documentation

Start with the [documentation index](docs/README.md): it lists every page and suggests a
reading order for a newcomer to DDD, a tech lead adopting the kit and a contributor.

- **Reference (normative).** [Architecture reference](docs/ARCHITECTURE.md): the canonical
  tree, the rule ids, the tactical and clean code conventions, the test levels.
  [Configuration](docs/CONFIG.md): `ddd-ts-kit.config.json`. Each package has its own README,
  with its limits and what was verified.
- **[Concepts](docs/concepts/README.md).** One page per idea, as a reading path: strategic
  design, tactical design, architecture, messaging, cross-cutting concerns, clean code and
  testing.
- **Tools.** One page per decision, with a comparison, the kit's verified support and its
  limits: [HTTP frameworks](docs/tools/http-frameworks.md),
  [validation](docs/tools/validation.md),
  [dependency injection](docs/tools/dependency-injection.md),
  [persistence](docs/tools/persistence.md), [message brokers](docs/tools/message-brokers.md),
  [cache and coordination](docs/tools/cache-and-coordination.md),
  [identity](docs/tools/identity.md),
  [authorization engines](docs/tools/authorization-engines.md),
  [observability](docs/tools/observability.md),
  [static analysis and pipeline](docs/tools/static-analysis-and-pipeline.md),
  [test runners](docs/tools/test-runners.md).
- **Guides.** [Methodology](docs/guides/methodology.md),
  [team workflow](docs/guides/team-workflow.md), [parallel work](docs/guides/parallel-work.md),
  [commit discipline](docs/guides/commit-discipline.md),
  [when to extract microservices](docs/guides/when-to-extract-microservices.md),
  [token economy](docs/guides/token-economy.md).
- **Proposals.** [The read side](docs/proposals/read-side.md), with its build status.

## Requirements

Node 22.12 or later. The generated projects type-check with the native TypeScript 7 compiler
and keep TypeScript 6 for the tools that still need its API.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). MIT licensed.
