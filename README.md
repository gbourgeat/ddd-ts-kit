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
Standard Schema library; tsyringe, NestJS or manual wiring; Drizzle, Knex, Prisma or TypeORM.

## Quick start

```bash
mkdir orders-api && cd orders-api
npx ddd-ts-kit init --http express --validation zod --di tsyringe --orm drizzle \
  --context ordering:core --context billing:supporting
npm install
npm run infra:up      # PostgreSQL (and a tracing backend with the observability profile)
npm run dev           # auto reload; API documentation on /docs
npm run verify        # types, lint, tests, e2e, architecture, dead code, documentation drift
```

Then, the ubiquitous language first, code second:

```bash
npx ddd-ts-kit generate aggregate ordering Order --term "Order=A customer's request to buy products"
npx ddd-ts-kit generate command ordering PlaceOrder --aggregate Order --term "Place=..."
npx ddd-ts-kit generate route ordering PlaceOrder --method POST --path /orders
```

Each command writes the file, its spec, its builder and its wiring, and lists the
`TODO(domain)` places where a business decision is expected. Nothing else is left to write by
hand, and a name that is not in the context's glossary is refused.

## The Claude Code plugin

```
/plugin marketplace add gbourgeat/ddd-ts-kit
/plugin install ddd-ts-kit@ddd-ts-kit
```

| Skill | Use |
|---|---|
| `bootstrap` | set up a project (run by the user) |
| `model-context` | strategic design: boundary, glossary, classification, relationships |
| `scaffold` | one file of any role, from a template |
| `use-case` | one feature end to end, test first |
| `integration-event` | make two contexts collaborate through a versioned event |
| `wiring` | declare services and handlers, for production and for tests |
| `persistence` | repositories, unit of work, outbox, migrations, whatever the ORM |
| `testing` | fakes instead of mocks, builders, given/when/then, end to end |
| `clean-code` | naming, function order, comments, testability |
| `tracing` | non-invasive OpenTelemetry |
| `openapi-contract` | the generated OpenAPI contract |
| `document` | context map, CONTEXT.md, integration documentation, decisions |
| `access-control` | authentication, permissions per use case, the current actor, roles, policies or relationships |
| `extract-service` | keep each context ready to run as its own service, and extract it |
| `deviation` | what to do when asked to go around a rule |
| `quality-gate` | run every check and fix at the root cause |
| `audit-context` | read-only design review of a whole context |

Agents: `architecture-reviewer` (read-only review of a diff) and `domain-test-writer`.

The hook is the part that makes the rest binding. In a project that has a
`ddd-ts-kit.config.json` it reminds the workflow and the context map at session start, refuses
a hand-written file where a generator exists and any edit of a generated contract, asks the
project owner before a suppression, a skipped test or a change of the rules is written, checks
every written file and returns the violations with their fix, and refuses to finish while
architecture errors remain. It fails open: a broken guard never blocks work. Set
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
- **Tactical DDD** (`domain/*`, `application/*`, `events/*`): encapsulated aggregates,
  immutable value objects, specific domain errors, one handler per use case, integration
  events declared once with a schema.
- **Clean code** (`clean/*`): stepdown order, small functions, no flag argument, no
  commented-out code, no noise comment, no escape hatch.
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
| [`ddd-ts-kit`](packages/cli) | the CLI: `init`, `generate`, `check`, `docs`, `list`, `explain` |
| [`@ddd-ts-kit/kernel`](packages/kernel) | entities, aggregates, value objects, domain errors, `Result`; command, query and event buses with in-memory implementations; `Clock`, `IdGenerator`, `UnitOfWork` |
| [`@ddd-ts-kit/events`](packages/events) | typed integration event declarations, registry, transactional outbox and relay, AsyncAPI and event catalog generation |
| [`@ddd-ts-kit/rabbitmq`](packages/rabbitmq) | the reference broker provider: confirmed publishing, durable queue per consumer, bounded retries, dead letters |
| [`@ddd-ts-kit/auth`](packages/auth) | actors, permissions declared per use case, deny by default; role, attribute and relationship (Zanzibar-style) authorizers behind one port; JWT authentication |
| [`@ddd-ts-kit/http`](packages/http) | routes declared once, mounted on Express, Fastify or NestJS; RFC 9457 errors; OpenAPI 3.1 generation; Swagger UI, Scalar or Redoc |
| [`@ddd-ts-kit/validation`](packages/validation) | one `Schema` port over zod, class-validator and Standard Schema |
| [`@ddd-ts-kit/di`](packages/di) | typed tokens and context modules on tsyringe, no decorator in your classes, a test application with fakes |
| [`@ddd-ts-kit/tracing`](packages/tracing) | OpenTelemetry added at the composition root: the domain never imports it, spans never carry data |
| [`@ddd-ts-kit/testing`](packages/testing) | builders, given/when/then scenarios, in-memory repository, contract suites, seeded generated data, end-to-end harness |
| [`@ddd-ts-kit/drizzle`](packages/drizzle), [`knex`](packages/knex), [`prisma`](packages/prisma), [`typeorm`](packages/typeorm) | unit of work with an ambient transaction, outbox store, processed-event store |
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

- [Architecture reference](docs/ARCHITECTURE.md): the tree, the rules, the tactical and
  clean code conventions, the test levels.
- [Configuration](docs/CONFIG.md): `ddd-ts-kit.config.json`.
- Each package has its own README.

## Requirements

Node 22.12 or later. The generated projects type-check with the native TypeScript 7 compiler
and keep TypeScript 6 for the tools that still need its API.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). MIT licensed.
