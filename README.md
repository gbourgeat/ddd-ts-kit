**English** · [Français](README.fr.md)

# ddd-ts-kit

Domain-Driven Design (DDD), Clean Architecture (hexagonal, ports and adapters) and Clean Code for
TypeScript and Node.js backends, held by tools rather than by good intentions, for developers and
for the AI coding agents they work with: Claude Code, Codex and GitHub Copilot.

**The documentation is also a website**, with search, in English and in French:
<https://gbourgeat.github.io/ddd-ts-kit/>.

It is three things that share one definition of the architecture
([docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)):

- a **plugin for Claude Code, Codex and GitHub Copilot**: skills, agents and hooks that make a
  coding agent work inside the architecture, generate instead of typing boilerplate, and stop
  when a rule is broken;
- a **CLI**: bootstrap a project in minutes, scaffold every building block from templates,
  verify the structure, generate the documentation;
- **runtime packages and analyzers**: framework-agnostic building blocks, an ESLint plugin
  and a CI pipeline for GitHub and GitLab.

TypeScript only. No framework imposed: Express, Fastify, Hono or NestJS; zod, class-validator,
TypeBox or any Standard Schema library; tsyringe, NestJS or manual wiring; Drizzle, Knex,
Prisma or TypeORM; RabbitMQ, Kafka, NATS JetStream or Redis Streams; JWT or Keycloak; roles,
attributes or relationships. `ddd-ts-kit init` without a flag takes Express, zod, tsyringe,
Drizzle on PostgreSQL and Vitest.

The documentation is also written in French: every page has its translation next to it, reached
by the link on its first line, starting from [README.fr.md](README.fr.md) and the
[French index of the documentation](docs/README.fr.md).

## Start a project

Follow these steps in order: it is the supported path, and the tools are built to hold it. Each
step is a skill of the plugin (`/ddd-ts-kit:<skill>`), or a command, and leaves a file the next
one reads. `/ddd-ts-kit:start` conducts steps 1 to 7 one at a time, records them in
`docs/architecture/plan.md`, and `npx ddd-ts-kit status` says at any time which step is next.

| # | Step | Skill or command | Produces |
|---|---|---|---|
| 1 | Discover the domain | `discover-domain` | `docs/architecture/discovery.md`: actors, commands, events, policies |
| 2 | Find the bounded contexts | `bounded-contexts` | `docs/architecture/contexts.md`: each boundary and its reason |
| 3 | Write the glossaries | `glossary` | the ubiquitous language of each context |
| 4 | Draw the context map | `context-map` | who is upstream of whom, and by which pattern |
| 5 | Choose the stack and bootstrap | `bootstrap`, `ddd-ts-kit init`, `generate context` | the project, green on `verify`, one `CONTEXT.md` per context |
| 6 | Plan the slices | `plan-slices` | `docs/architecture/slices.md`: one use case per slice, in order |
| 7 | Build slice by slice | `use-case` (`parallel-work` for several workers) | the code and its tests, one commit per slice |
| 8 | Pass the quality gate | `quality-gate`, `npm run verify` | a green gate before each merge |
| 9 | Document | `document`, `npm run docs:generate` | current contracts, context map and decision records |

![The nine steps: four written in the words of the business under docs/architecture/ (discover the domain, find the contexts, write the glossaries, draw the context map), then five with the generators (bootstrap, plan the slices, build a slice, pass the gate, document); steps 7 and 8 repeat for each slice](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/ddd-ts-kit-workflow.svg)

Skipping a step costs later, and the cost is known: without steps 1 to 4 the boundaries are
drawn from the database tables, and every rename crosses contexts; a glossary written after
the code describes the code instead of the business, and the generators refuse its names
until it exists; without the context map the first integration is a direct import that the
checker then refuses; without the slices plan the work comes as layers, and nothing is
demonstrable before the end. The [methodology](docs/guides/methodology.md) is the reference
for each step; [which command, when](docs/guides/commands.md) gives the command for each
moment of a project, with a first feature from zero.

## Quick start

```bash
mkdir orders-api && cd orders-api
npx ddd-ts-kit init
pnpm install
pnpm run verify           # types, lint, format, tests, e2e, architecture, import graph, dead code, documentation drift
```

`init` without a flag takes the default stack and pnpm, which corepack provides at the release
`package.json` pins (`corepack enable`, once per machine). The project is green from that first
`verify`, before a line of business code, and stays so at every step. Then, the ubiquitous
language first, code second:

```bash
pnpm exec ddd-ts-kit generate context ordering --classification core \
  --term "Order=A customer's request to buy products" --term "Place=To submit an order for fulfilment"
pnpm exec ddd-ts-kit generate context billing --classification supporting --upstream ordering:customer-supplier
pnpm exec ddd-ts-kit generate aggregate ordering Order
pnpm exec ddd-ts-kit generate repository ordering Order
pnpm exec ddd-ts-kit generate command ordering PlaceOrder --permission order.place --grant customer --aggregate Order
pnpm exec ddd-ts-kit generate route ordering PlaceOrder --method POST --path /orders
pnpm run docs:generate    # the OpenAPI contract follows the new route
pnpm run verify
pnpm exec ddd-ts-kit status   # what is left: TODO(domain), TODO(platform) and it.todo per context
```

These two blocks are run as they are written, line by line, by the end-to-end suite of this
repository, on pnpm and on npm. With `npx ddd-ts-kit init --package-manager npm` the same lines
read `npm install`, `npm run <script>` and `npx ddd-ts-kit <command>`; the note `init` prints
and the README it writes say them in the words of the manager chosen. To see the application
run: `cp .env.example .env`, `pnpm run infra:up` (PostgreSQL, in Docker), `pnpm run db:generate initial`,
`pnpm run db:migrate`, then `pnpm run dev` (auto reload; API documentation on `/docs`).

Each `generate` writes the file, its spec, its fake or builder and its registration, and lists
the `TODO(domain)` places where a business decision is expected. A name that is not in the
context's glossary is refused, and so is a command or a query that declares neither a
permission nor `--public`. `--grant customer` gives the permission to the role `customer` in the
roles of the platform: without it, only the super-admin reaches the use case and `check` warns
(`authz/granted`). `pnpm exec ddd-ts-kit generate --help` lists the 36 kinds. What changes
from one version to the next: [CHANGELOG.md](CHANGELOG.md).

### One slice, end to end

The `generate` lines above build a vertical slice of the `ordering` context: the request
`POST /orders` crosses the four layers. The controller, the handler, the `Order` aggregate and
its repository are classes the generators wrote; the command bus comes from the platform that
`init` wrote.

![The request POST /orders followed through the controller, the command bus, the handler, the Order aggregate and the Drizzle repository, inside one unit of work, until the answer 201](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/ddd-ts-kit-slice-flow.svg)

1. The controller (`presentation/http/orders/place-order/place-order.controller.ts`) validates
   the body with its schema, builds `PlaceOrderCommand` with the actor of the request and sends
   it on the command bus (1, 2).
2. The command bus of the platform logs and measures the use case, lets it through only when the
   actor holds `order.place`, and opens the unit of work (3).
3. The handler (`application/commands/place-order/place-order.handler.ts`) asks the aggregate:
   `Order.place(...)` checks its invariants and records `OrderPlaced`, or throws a refusal
   (4 to 6).
4. The handler saves through the `OrderRepository` port of the domain. The Drizzle adapter
   (`infrastructure/persistence/drizzle-order.repository.ts`), bound to that port when the
   application starts, writes the row inside the transaction (7, 8).
5. The unit of work hands `OrderPlaced` to its handlers, still inside the transaction, then
   commits (9). The controller answers `201` with the identifier (10, 11). A refusal answers a
   problem document (RFC 9457) that carries its stable code instead.

What is left to you is the business: the `TODO(domain)` places. Filled in, the domain and
application part of this slice reads as follows, in one block here where the generators write
one file per class (the refusal comes from `generate error ordering Order empty`, the event from
`generate domain-event ordering Order Placed`):

<!-- checked sample -->
```ts
import { definePermissions } from '@ddd-ts-kit/auth';
import {
  type Actor,
  AggregateRoot,
  AuthorizedCommand,
  type Clock,
  ConceptError,
  type DomainEvent,
  type IdGenerator,
  Repository,
} from '@ddd-ts-kit/kernel';
import { CommandHandler, Requires } from '@ddd-ts-kit/kernel/declarations';

// application/authorization/ordering.permissions.ts: `generate command` declared the permission
export const orderingPermissions = definePermissions('ordering', {
  'order.place': { description: 'Place order' },
});

// domain/errors/order.error.ts: each refusal is a static factory with a stable code
export class OrderError extends ConceptError {
  static empty() {
    return OrderError.refusal('ORDER_EMPTY', 'An order holds at least one product.');
  }
}

// domain/events/order-placed.event.ts: a fact, named in the past tense
export class OrderPlaced implements DomainEvent {
  static readonly eventName = 'ordering.order.placed';

  readonly name = OrderPlaced.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly customerId: string,
  ) {}
}

// domain/aggregates/order.aggregate.ts: the invariants live here, and nowhere else
export interface OrderState {
  readonly customerId: string;
  readonly productIds: readonly string[];
  readonly placedAt: Date;
}

export class Order extends AggregateRoot<string> {
  private constructor(
    id: string,
    private state: OrderState,
  ) {
    super(id);
  }

  // the customer and the products travel together: one parameter object, three parameters at most
  static place(id: string, request: Pick<OrderState, 'customerId' | 'productIds'>, now: Date): Order {
    if (request.productIds.length === 0) {
      throw OrderError.empty();
    }

    const order = new Order(id, { ...request, placedAt: now });

    order.record(new OrderPlaced(id, now, request.customerId));

    return order;
  }

  static rehydrate(id: string, state: OrderState): Order {
    return new Order(id, state);
  }

  toState(): OrderState {
    return { ...this.state };
  }
}

// domain/repositories/order.repository.ts: a port, an abstract class that is its own injection token
export abstract class OrderRepository extends Repository<Order> {}

// application/commands/place-order/place-order.command.ts: the actor comes first, then plain data
@Requires(orderingPermissions['order.place'])
export class PlaceOrderCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly customerId: string,
    readonly productIds: readonly string[],
  ) {
    super(actor);
  }
}

// application/commands/place-order/place-order.handler.ts: time and identifiers come from ports
@CommandHandler(PlaceOrderCommand)
export class PlaceOrderHandler implements CommandHandler<PlaceOrderCommand> {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute({ customerId, productIds }: PlaceOrderCommand): Promise<string> {
    const order = Order.place(this.ids.next(), { customerId, productIds }, this.clock.now());

    await this.orderRepository.save(order);

    return order.id;
  }
}
```

The handler never opens a transaction, never checks the permission and never publishes the
event: the command bus and the repository do, around it. Its spec runs it through the test
application with the fakes of its ports; [Which command, when](docs/guides/commands.md#a-first-feature-from-zero) follows
this first feature to the end, and the [example application](examples/scheduling/README.md)
shows a whole product built this way.

## The plugin: Claude Code, Codex, GitHub Copilot

This repository is the marketplace of the plugin for the three agents:

| Agent | Install | A skill is called |
|---|---|---|
| Claude Code | `/plugin marketplace add gbourgeat/ddd-ts-kit`, then `/plugin install ddd-ts-kit@ddd-ts-kit` | `/ddd-ts-kit:start` |
| Codex | `codex plugin marketplace add gbourgeat/ddd-ts-kit`, then install `ddd-ts-kit` from `/plugins` and trust its hooks in `/hooks` | `$start` |
| Copilot CLI | `copilot plugin marketplace add gbourgeat/ddd-ts-kit`, then `copilot plugin install ddd-ts-kit@ddd-ts-kit` | by its name, `start` |
| Copilot cloud agent, VS Code | declared by the `.github/copilot/settings.json` that `init` writes: the cloud agent installs it, VS Code recommends it | by its name, `start` |

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
| `document` | OpenAPI contract and its typed clients, event catalog, AsyncAPI, generated lists, decision records |
| `extract-service` | keep each context ready to run as its own service, and extract it |
| `deviation` | what to do when asked to go around a rule |
| `quality-gate` | run the checks at the right scope and fix at the root cause |
| `commit-discipline` | one slice per commit, generated files with what generated them |

Four agents: `domain-explorer` (read-only answers about what exists and where),
`context-builder` (builds the slices of one context in its own worktree),
`domain-test-writer` (turns `it.todo` entries into specs) and `architecture-reviewer`
(read-only review of a diff, a branch or a context).

The hook is the part that makes the rest binding. In a project that has a
`ddd-ts-kit.config.json` it reminds the workflow and the context map at session start, says
when the installed packages are not the version the skills describe, refuses
a hand-written file where a generator exists and any edit of a generated contract, asks the
project owner before a suppression, a skipped test or a change of the rules is written, checks
every written file and returns the violations with their fix, and refuses to finish while
architecture errors remain. It reminds, without blocking, when the uncommitted changes exceed
the advised size of a commit, and in a worker's worktree (`.ddd-ts-kit/worker.json`) it
refuses a write outside the worker's context. It fails open: a broken guard never blocks work. Set
`"guard": "advise"` in the config to be asked instead of refused, `"off"` to silence it.

Each agent gets what its host runs. The skills work in all three. The four agents are sub-agents
of Claude Code; Codex loads no agent from a plugin, and one session per worktree takes the place
of `context-builder`. The hook runs wherever the host runs the hooks of a plugin: it reads the
patches of Codex and the tool calls of Copilot as well as those of Claude Code. Codex cannot put
a question to the user, so what Claude Code asks the project owner is said to the user there,
and left to the checks of the pipeline.

Without any plugin, a project still guides every agent: `init` writes `AGENTS.md`, the guide
Codex, Copilot and most agents read (`CLAUDE.md` imports it), the rules by layer for Claude Code
in `.claude/rules/` and the same rules for Copilot in `.github/instructions/`, scoped by
`applyTo`, and, with the GitHub pipeline, `copilot-setup-steps.yml`, which installs the project
before the Copilot cloud agent starts. `npm run verify` and the pipeline hold every agent to
the same rules.

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
  a decorator, states what it depends on once, in its constructor signature (read from the
  source, never from compiler metadata, so it holds in both decorator modes and under `tsx`),
  and is assembled in one place.
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
- **And the rest**: `errors/*`, `naming/*`, `presentation/*`, `persistence/*`, `tenancy/*`,
  `event-sourcing/*`, `imports/*` and a few more. `npx ddd-ts-kit rules` lists every id with
  its severity.

### Instead of, write

A handler written the quick way breaks four rules at once, and each finding names its rule:

```ts
// application/commands/place-order/place-order.handler.ts, written the quick way
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { PlaceOrderCommand } from '@/contexts/ordering/application/commands/place-order/place-order.command';
import { db, orders } from '@/contexts/ordering/infrastructure/database'; // layer/application-inward

@CommandHandler(PlaceOrderCommand)
export class PlaceOrderHandler implements CommandHandler<PlaceOrderCommand> {
  async execute({ customerId, productIds }: PlaceOrderCommand): Promise<string> {
    if (productIds.length === 0) {
      throw new Error('Empty order'); // domain/no-generic-error
    }

    const id = crypto.randomUUID(); // purity/no-ambient-randomness

    await db.insert(orders).values({ id, customerId, productIds, placedAt: new Date() }); // purity/no-system-clock

    return id;
  }
}
```

The handler of the [quick start](#one-slice-end-to-end) is the same use case, written inside
the rules:

| Instead of | Write | Rule |
|---|---|---|
| `new Date()` | `this.clock.now()`, the `Clock` port received in the constructor | `purity/no-system-clock` |
| `crypto.randomUUID()` | `this.ids.next()`, the `IdGenerator` port | `purity/no-ambient-randomness` |
| `throw new Error('Empty order')` | `throw OrderError.empty()`, a refusal with a stable code | `domain/no-generic-error` |
| an import of `infrastructure/` in a handler | the `OrderRepository` port, bound to its adapter by the platform | `layer/application-inward` |
| an import of another context's `domain/` | that context's `published-language/`, or an integration event | `context/published-language-only` |

Each finding comes with its fix, and `npx ddd-ts-kit explain <rule-id>` gives the reason.

### Where they are checked

![The same rules checked at three moments: at every file write by the hook of the Claude Code plugin, before each merge by npm run verify, and on every push by the CI pipeline, all three applying the rules defined in docs/ARCHITECTURE.md](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/ddd-ts-kit-checks.svg)

Three analyzers hold them, each where it is exact: the zero-dependency CLI checker for
structure and for instant feedback at every file write, the ESLint plugin on the syntax tree
for code rules, dependency-cruiser on the resolved import graph. knip and the TypeScript
compiler in strict mode complete the gate.

## Packages

| Package | What it gives |
|---|---|
| [`ddd-ts-kit`](packages/cli) | the CLI: `init`, `generate`, `check`, `docs`, `sdk` (a typed client of the OpenAPI contract, its refusals typed by their error codes), `list`, `describe`, `status`, `todo`, `worker-scope`, `affected` (what a pull request has to run), `depcruise-config`, `build-aliases`, `rules`, `explain`, and the migrations from one style to another (`error-factories`, `controllers`, `value-objects`) |
| [`@ddd-ts-kit/kernel`](packages/kernel) | entities, aggregates, value objects, domain errors, `Result`; ports as abstract classes; the declarations (`@CommandHandler`, `@Repository`, ...); command, query and event buses with in-memory implementations; the standard extensible interfaces: `Actor`, `Session`, `ExecutionContext`, `Logger`, `Metrics`, `Cache`, `Page`, `Clock`, `IdGenerator`, `UnitOfWork`, `ErrorReporter`, `FileStorage`; the read side: criteria, hydration and read models |
| [`@ddd-ts-kit/events`](packages/events) | typed integration event declarations, registry, transactional outbox and relay, AsyncAPI and event catalog generation |
| [`@ddd-ts-kit/rabbitmq`](packages/rabbitmq), [`kafka`](packages/kafka), [`nats`](packages/nats), [`redis/event-bus`](packages/redis) | broker providers behind one contract: acknowledged publishing for the outbox relay, one durable subscription per consumer, bounded retries, dead letters |
| [`@ddd-ts-kit/scheduling`](packages/scheduling) | jobs run by time that only trigger use cases: intervals and cron with time zones, one run across instances, each run in its own execution scope |
| [`@ddd-ts-kit/auth`](packages/auth) | actors, permissions declared per use case, deny by default; role, attribute and relationship (Zanzibar-style) authorizers behind one port; JWT authentication |
| [`@ddd-ts-kit/openfga`](packages/openfga) | the relationships of `auth` on an OpenFGA server: tuple store and authorizer, the model generated from the schema, drift checked |
| [`@ddd-ts-kit/aspects`](packages/aspects) | logging, metrics, retry, timeout, circuit breaker, cache and bulkhead applied from outside: wrappers, bus middlewares, standard decorators |
| [`@ddd-ts-kit/audit`](packages/audit) | hash-chained, append-only audit trail fed by authorization decisions, commands and integration events |
| [`@ddd-ts-kit/redis`](packages/redis) | cache, lock, rate limiter and relay signal on Redis, Dragonfly or Valkey |
| [`@ddd-ts-kit/s3`](packages/s3) | the kernel `FileStorage` port on AWS S3, MinIO, OVHcloud, Scaleway or Cloudflare R2: streamed uploads, short signed links; file content never in the database |
| [`@ddd-ts-kit/http`](packages/http) | routes declared once, mounted on Express, Fastify, Hono or NestJS; RFC 9457 errors; OpenAPI 3.1 generation; Swagger UI, Scalar or Redoc; cache policies, `ETag`, `If-Match` and cache tags, with purgers for Varnish, Fastly and Cloudflare (`/purgers`) |
| [`@ddd-ts-kit/validation`](packages/validation) | one `Schema` port over zod, class-validator, TypeBox and Standard Schema; schemas shared by several routes, documented once |
| [`@ddd-ts-kit/di`](packages/di) | context modules on tsyringe from the declarations of a context or from an explicit module, port classes as tokens, a test application with fakes |
| [`@ddd-ts-kit/pino`](packages/pino), [`winston`](packages/winston) | the kernel `Logger` port on pino or winston, with the correlation fields on every line |
| [`@ddd-ts-kit/sentry`](packages/sentry) | the kernel `ErrorReporter` port on Sentry or GlitchTip: unexpected failures only, scrubbed |
| [`@ddd-ts-kit/tracing`](packages/tracing) | OpenTelemetry wired once by the platform: the domain never imports it, spans never carry data |
| [`@ddd-ts-kit/testing`](packages/testing) | builders, given/when/then scenarios, in-memory repository, contract suites, seeded generated data, end-to-end harness |
| [`@ddd-ts-kit/drizzle`](packages/drizzle), [`knex`](packages/knex), [`prisma`](packages/prisma), [`typeorm`](packages/typeorm) | unit of work with an ambient transaction, outbox store, processed-event store, read model stores (the SQL projections of the read side); tenant isolation on Knex (shared tables, row-level security, schema or database per tenant) and Drizzle (the first two); the PostgreSQL event store of event-sourced aggregates |
| [`@ddd-ts-kit/eslint-plugin`](packages/eslint-plugin) | the code rules on the syntax tree, with presets |

Everything talks through ports of the kernel, so each piece is replaceable: another event
provider, ORM or HTTP framework is an adapter that passes the same contract suite.

![Where each package is imported: inside a bounded context the domain imports only the kernel, the application adds auth, the presentation imports http and validation, the infrastructure one ORM package, the published language events and validation; the platform composes the contexts with di and the packages of its technical capabilities](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/ddd-ts-kit-packages.svg)

The domain of a context depends on the kernel alone, which has no dependency at all: the
business code compiles and runs its tests without an HTTP framework, a database or a broker. The
packages that talk to the outside world are imported by the infrastructure and by the platform,
which binds each adapter to its port when the application starts.

## Pipeline

`init --ci github|gitlab|both` installs the same gates on either platform, from the same npm
scripts: type check, lint, architecture, dead code, unit tests with coverage thresholds,
integration tests on PostgreSQL, end-to-end tests, documentation and contract drift, security
(npm audit and gitleaks), image build, and a single final gate to mark as required. Every tool
is free on any repository; CodeQL, dependency review and GitLab's scanners, which need a paid
plan on a private repository, are opt-in (`--ci-extras`). Details and the GitHub and GitLab
equivalence table: [pipeline/README.md](pipeline/README.md).

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
  [contract pairs](docs/tools/contract-pairs.md),
  [dependency injection](docs/tools/dependency-injection.md),
  [persistence](docs/tools/persistence.md), [message brokers](docs/tools/message-brokers.md),
  [cache and coordination](docs/tools/cache-and-coordination.md),
  [HTTP caches](docs/tools/http-caches.md),
  [file storage](docs/tools/file-storage.md),
  [identity](docs/tools/identity.md),
  [authorization engines](docs/tools/authorization-engines.md),
  [observability](docs/tools/observability.md),
  [static analysis and pipeline](docs/tools/static-analysis-and-pipeline.md),
  [quality baseline](docs/tools/quality-baseline.md),
  [test runners](docs/tools/test-runners.md),
  [client SDK](docs/tools/client-sdk.md),
  [import aliases](docs/tools/import-aliases.md).
- **Guides.** [Methodology](docs/guides/methodology.md), [which command, when](docs/guides/commands.md),
  [team workflow](docs/guides/team-workflow.md), [parallel work](docs/guides/parallel-work.md),
  [commit discipline](docs/guides/commit-discipline.md),
  [choosing access control](docs/guides/choosing-access-control.md),
  [when to extract microservices](docs/guides/when-to-extract-microservices.md),
  [token economy](docs/guides/token-economy.md).
- **Proposals.** [The read side](docs/proposals/read-side.md), with its build status.

## Example application

[examples/scheduling](examples/scheduling/README.md) is an appointment scheduling platform for
practices, built with the kit the way a user would build it: from a statement of needs, through
the nine steps, by several workers in parallel. Four bounded contexts (`scheduling`, the core,
then `identity`, `notification` and `analytics`) run in one application and a worker process,
on Express, class-validator, tsyringe, Knex on PostgreSQL, the transactional outbox, Keycloak and
relationship-based authorization. It is the place to read real aggregates, refusals, policies,
integration events and their tests; its tooling report says how the kit behaved during the
build.

## Requirements

Node 22.12 or later. The generated projects type-check with the native TypeScript 7 compiler
and keep TypeScript 6 for the tools that still need its API.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). MIT licensed.
