# @ddd-ts-kit/testing

Readable tests without mocks: test data builders, given / when / then scenarios for
aggregates, an in-memory harness for handlers, an end-to-end harness over HTTP and the event
bus, and contract suites that hold fakes and real adapters to the same behaviour. Business
logic is tested with no infrastructure at all, and the same builders carry to the tests that
run the whole application.

```
npm i -D @ddd-ts-kit/testing
```

| Entry | Holds | Imports |
|---|---|---|
| `@ddd-ts-kit/testing` | builders, scenarios, `createTestBuses`, `InMemoryRepository` | no runner, no library |
| `@ddd-ts-kit/testing/faker` | generated data for builders | `@faker-js/faker` (optional peer) |
| `@ddd-ts-kit/testing/e2e` | HTTP client, `eventually`, `collectEvents` | Node only: no HTTP framework, no container |
| `@ddd-ts-kit/testing/contracts` | contract suites of the kernel ports, `ContractSuite` to write another | the runner you pass |
| `@ddd-ts-kit/testing/vitest` | `decorators()`, the Vite plugin that lets Vitest run standard decorators | Node only; runs the `tsc` of the project |

## Builders

A builder declares valid defaults once; a test states only what matters to the rule it checks.
Every step returns a new, immutable builder, so a base builder can be shared between tests.

For an aggregate, write a class: its methods are named in the ubiquitous language, and
`construct` goes through the public API, so a test can never start from an invalid state.

```ts
// contexts/ordering/test/builders/order.builder.ts
import { Builder, sequence, type Buildable, type Defaults } from '@ddd-ts-kit/testing';

interface OrderProps {
  id: string;
  customer: Customer;
  lines: readonly Line[];
  paid: boolean;
}

class OrderBuilder extends Builder<OrderProps, Order> {
  protected defaults(): Defaults<OrderProps> {
    return { id: sequence('order'), customer: aCustomer(), lines: [aLine()], paid: false };
  }

  protected construct(props: OrderProps): Order {
    const order = Order.place(props.id, props.customer, props.lines);
    if (props.paid) order.pay();
    return order;
  }

  placedBy(customer: Buildable<Customer>): this {
    return this.with('customer', customer);
  }

  withLine(line: Buildable<Line>): this {
    return this.adding('lines', line);
  }

  paid(): this {
    return this.with('paid', true);
  }
}

export const anOrder = (): OrderBuilder => new OrderBuilder();
```

```ts
const order = anOrder().paid().withLine(aLine().with('sku', 'sku-1')).build();
const orders = anOrder().placedBy(aCustomer().named('Ada')).buildMany(3);
```

For plain data (payloads, DTOs, simple value objects) the functional form is enough. It gives
the generic `with(key, value)` and `withMany(partial)`, both checked against the properties:

```ts
import { defineBuilder, lazy, sequence } from '@ddd-ts-kit/testing';

export const aLine = defineBuilder<Line>({
  defaults: { sku: sequence('sku'), quantity: 1 },
});

export const anEmail = defineBuilder<{ value: string }, Email>({
  defaults: { value: sequence('email', (n) => `user${n}@example.com`) },
  build: ({ value }) => Email.create(value),
});

aLine().with('quantity', 3).build(); // { sku: 'sku-1', quantity: 3 }
```

- A builder is accepted wherever a value is: `.with('customer', aCustomer().named('Ada'))`,
  and inside arrays: `.with('lines', [aLine(), { sku: 'pen', quantity: 2 }])`.
- `sequence('order')` yields `order-1`, `order-2`... at each build; `lazy(() => new Date())`
  computes a default at each build. A value given with `with` consumes nothing.
- Call `resetSequences()` in `beforeEach`, so a test does not depend on the ones before it.
- The class form keeps `with`, `withMany` and `adding` protected on purpose: the public
  surface of an aggregate builder is the language of the domain, not its property names.

## Generated data

```
npm i -D @faker-js/faker
```

```ts
import { generated } from '@ddd-ts-kit/testing/faker';

export const aCustomer = defineBuilder<CustomerProps, Customer>({
  defaults: {
    id: sequence('customer'),
    name: generated((faker) => faker.person.fullName()),
    email: generated((faker) => faker.internet.email().toLowerCase()),
    birthDate: generated((faker) => faker.date.birthdate({ mode: 'age', min: 18, max: 90 })),
  },
  build: (props) => Customer.register(props),
});

aCustomer().build();                              // a different, valid customer at each build
aCustomer().with('email', 'ada@example.com');     // stated: the rule under test depends on it
```

The defaults are generated yet valid: each generator is constrained to what the domain accepts
(an adult, a lower-case address), and `build` still goes through `Customer.register`.

**The rule: generated data for the fields a test does not care about, explicit values for
what the rule under test depends on.** A test never asserts a generated value it did not
state, and never relies on a generated value falling on the right side of a rule.

Every `generated` value is drawn from one generator per test file, `dataGenerator()`. Its seed
comes from `TEST_SEED`, else it is random, and it is always known (`dataGenerator().seed`):

```ts
// vitest setup file
import { beforeEach, onTestFailed } from 'vitest';
import { reportSeedOnFailure } from '@ddd-ts-kit/testing/faker';

reportSeedOnFailure({ beforeEach, onTestFailed });
// under a failed test: Generated data seed: 1837264. Replay this file with TEST_SEED=1837264.
```

| Call | Does |
|---|---|
| `generated((faker) => value)` | a default or a `with` value drawn at each build |
| `dataGenerator()` | the current generator: `seed`, `faker`, `restart()` |
| `createDataGenerator({ seed?, locales?, referenceDate? })` | a generator of its own; relative dates are computed from a fixed `referenceDate`, so a seed replays them too |
| `useDataGenerator(generator)` | makes `generated` draw from it, for instance a fixed seed in one suite |
| `reportSeedOnFailure(runner, log?)` | prints the seed under each failed test |

## Scenarios

```ts
import { given, scenario } from '@ddd-ts-kit/testing';

it('records the payment of a placed order', () => {
  given(anOrder().withLine(aLine().with('quantity', 2)))
    .when((order) => order.pay())
    .thenEvents([{ name: 'ordering.order.paid', amount: 30 }]);
});

it('refuses to pay an order twice', () => {
  given(anOrder().paid())
    .when((order) => order.pay())
    .thenError(OrderAlreadyPaid, 'ORDER_ALREADY_PAID')
    .thenState((order) => expect(order.status).toBe('paid'));
});
```

`given` takes an aggregate or its builder and discards the events of the arrangement
(`pullEvents()`), so only the events of `when` are asserted. `scenario(() => aggregate)` is
the same with the arrangement as a function, replayed from a fresh aggregate at each `when`.

| Assertion | Passes when |
|---|---|
| `thenEvents([...])` | exactly these events, in order; each described by its name, its class, or the properties that matter |
| `thenEventNames([...])` | exactly these names, in order |
| `thenNoEvent()` | nothing was recorded |
| `thenError(ErrorClass, code?)`, `thenError(code)` | the action threw that error |
| `thenState((aggregate) => ...)` | your own assertions on the aggregate pass |

Failures are `AssertionError`s of `node:assert` with the expected and recorded events side by
side, so they read well under any runner. An error raised by `when` is never swallowed: every
assertion but `thenError` fails on it. When `when` (or the arrangement) is asynchronous, the
chain is a promise: `await given(order).when(async (o) => ...).thenEventNames([...])`.

## Handlers

```ts
import { createTestBuses, InMemoryRepository, snapshots } from '@ddd-ts-kit/testing';

// domain/repositories/order.repository.ts: the port is an abstract class
export abstract class OrderRepository extends Repository<Order> {}

// test/fakes/in-memory-order.repository.ts: the fake implements the port, it never extends it
class InMemoryOrderRepository extends InMemoryRepository<Order> implements OrderRepository {
  constructor() {
    super(snapshots({ toSnapshot: (order) => order.toSnapshot(), fromSnapshot: Order.rehydrate }));
  }
}

it('places an order and announces it', async () => {
  const { commandBus, domainEvents, dispatching, eventBus, clock, ids, publishedEvents } = createTestBuses();
  const orders = dispatching(new InMemoryOrderRepository());
  const publisher = new OrderPlacedPublisher(eventBus, ids);

  domainEvents.on('ordering.order.placed', (event) => publisher.handle(event));
  commandBus.register(PlaceOrder, new PlaceOrderHandler(orders, ids, clock));

  const id = await commandBus.execute(new PlaceOrder('sku-1'));

  expect(orders.count()).toBe(1);
  expect(publishedEvents('ordering.order.placed')).toMatchObject([{ payload: { orderId: id } }]);
});
```

The handler only saves: `await this.orders.save(order); return order.id;`. Domain events leave
with the save. `dispatching(fake)` gives the fake what the application gives every repository:
once `save` (or any method handed the aggregate) resolved, the events the aggregate recorded
are dispatched to `domainEvents`, in recording order. With `createTestApplication` of
`@ddd-ts-kit/di` there is nothing to call: the fake given for a repository port dispatches to
`app.domainEvents`, and the declared domain event handlers react.

`InMemoryRepository` is a fake, not a mock: a working repository over a Map that keeps its own
copy of what is saved (through `snapshots({ toSnapshot, fromSnapshot })` or `{ clone }`) and
enforces optimistic concurrency on `version`, raising `ConcurrencyError` (code
`CONCURRENCY_CONFLICT`). Assert its state with `all()` and `count()`.

### Who is acting

`createTestBuses()` also gives `executionScope` and `actorContext`, the two doubles of the
kernel kept together, for the fakes and adapters that stamp audit columns or scope by tenant.
The default is the user `test-user`, correlation `test-correlation`, origin `test`.

```ts
import { aSession, anExecutionContext, createTestBuses, scoped } from '@ddd-ts-kit/testing';

const { executionScope } = createTestBuses({ executionContext: anExecutionContext().as(ada).build() });
const orders = new DrizzleOrderRepository(database, executionScope, clock);

await orders.save(order); // stamped by ada, in her tenant
await scoped(executionScope, anExecutionContext().as(bob).ofTenant('globex'), () => orders.findById(order.id));
```

| Builder | Default | Says |
|---|---|---|
| `aSession()` | a user of its own, opened with a password at the test epoch, never expiring | `of(actor)`, `identifiedBy`, `issuedAt`, `expiringAt`, `authenticatedBy`, `withSecondFactor`, `impersonatedBy`, `inLocale`, `inTimeZone`, `withExtensions` |
| `anExecutionContext()` | the work of a user of its own, origin `test`, correlation of its own | `as(actor)`, `inSession(session)`, `ofTenant`, `correlatedBy`, `causedBy`, `from(origin)`, `dueBy`, `inLocale`, `withExtensions` |

Both are classes on `Builder`, immutable like every builder, and accept a builder wherever an
actor or a session is expected (`aSession().of(anActor().withRole('accountant'))` with the
actor builder of `@ddd-ts-kit/auth/testing`). `scoped(scope, context, work)` runs a block in a
context given as a value or as a builder, with any `ExecutionScope`.

## End to end

The whole application, real adapters included, driven from the outside: requests in, responses
and integration events out. Nothing here knows the HTTP framework or how the application is
composed; `start` says it.

```ts
import { createServer } from 'node:http';
import { collectEvents, expectProblem, expectStatus, listenOnRandomPort, startTestServer } from '@ddd-ts-kit/testing/e2e';

const app = composeApplication();                   // the composition root of main.ts
const server = await startTestServer({
  start: () => listenOnRandomPort(createServer(expressApp(app))),
  // Fastify: async () => ({ url: await fastify.listen({ port: 0 }), close: () => fastify.close() })
  headers: { authorization: `Bearer ${testToken}` },
});
afterAll(() => server.close());
```

| Call | Does |
|---|---|
| `createHttpClient(baseUrl)` | the client alone, for a server the project starts itself: what the `test/e2e/support/start-application.ts` of a generated project uses, on its own `composeApplication(persistence, options)` |
| `client.get / post / put / patch / delete` | JSON in, `{ status, headers, body }` out; `body` is parsed when the content type is JSON, text otherwise; a 4xx or 5xx is a response, not an exception |
| `client.post(path, body, { headers })`, `client.withHeaders(headers)` | headers for one call, or a client for another caller |
| `expectStatus(response, 201)` | hands the response back, or fails showing the body, where the API says why |
| `expectProblem(response, { status, code })` | asserts an RFC 9457 `application/problem+json` answer and returns the document |
| `eventually(assertion, { timeoutMs = 2000, intervalMs = 20 })` | retries until the assertion passes; when the time is up, fails quoting the last error |
| `collectEvents(subscriber, types)` | records published integration events: `received(type?)`, `waitFor(type, predicate?, options?)`, `stop()` |

The assertions are those of `node:assert`: they read the same under any runner.

**Arrange through the API.** An end-to-end test creates its state the way a client would,
never by writing rows. The builder that gives the aggregate to unit tests gives the request
payload here, from the same properties and the same vocabulary:

```ts
class OrderBuilder extends Builder<OrderProps, Order> {
  // defaults(), construct() and the methods of the ubiquitous language, as above

  buildRequest(): PlaceOrderRequest {
    const { customer, lines } = this.props();   // the defaults and what the test stated, resolved
    return { customerId: customer.id, lines };
  }
}

const { body: order } = expectStatus(await client.post<OrderView>('/orders', anOrder().withLine(aLine()).buildRequest()), 201);
```

**Reset between tests.** The harness names the contract and leaves the implementation to the
project and its driver:

```ts
import type { DatabaseReset } from '@ddd-ts-kit/testing/e2e';

// PostgreSQL, with any client exposing `query`: every table of the application schemas.
export function truncateAllTables(db: { query(sql: string): Promise<{ rows: { name: string }[] }> }, schemas: string[]): DatabaseReset {
  return {
    async reset() {
      const { rows } = await db.query(
        `select quote_ident(schemaname) || '.' || quote_ident(tablename) as name
           from pg_tables where schemaname in (${schemas.map((schema) => `'${schema}'`).join(', ')})`,
      );
      if (rows.length > 0) await db.query(`truncate ${rows.map((row) => row.name).join(', ')} restart identity cascade`);
    },
  };
}

beforeEach(() => database.reset());
```

## Three levels with the same vocabulary

One rule, "an order that is already paid cannot be paid again", at three of the four test
levels of `docs/ARCHITECTURE.md` (the adapter level is the contract suites, below). The builder is the same; only what runs underneath changes.

```ts
// 1. Domain: the aggregate alone. Milliseconds, no double.
it('refuses to pay an order twice', () => {
  given(anOrder().paid())
    .when((order) => order.pay(at))
    .thenError(OrderAlreadyPaid, 'ORDER_ALREADY_PAID');
});

// 2. Application: the real handler through the bus, fakes for the ports.
it('refuses to pay an order twice', async () => {
  const orders = new InMemoryOrderRepository();
  const app = createTestApplication({ modules: [orderingModule], fakes: [fake(OrderRepository, orders)] });
  const order = anOrder().paid().build();
  await orders.save(order);

  await expect(app.commandBus.execute(new PayOrder(order.id))).rejects.toMatchObject({ code: 'ORDER_ALREADY_PAID' });
  expect(app.eventBus.published).toEqual([]);
});

// 3. End to end: HTTP, the real database and broker, generated data, state made through the API.
it('refuses to pay an order twice', async () => {
  const events = collectEvents(broker, [OrderPaid]);
  const { body: order } = expectStatus(await client.post<OrderView>('/orders', anOrder().buildRequest()), 201);
  expectStatus(await client.post(`/orders/${order.id}/payment`), 204);

  expectProblem(await client.post(`/orders/${order.id}/payment`), { status: 409, code: 'ORDER_ALREADY_PAID' });

  await events.waitFor(OrderPaid, (event) => event.payload.orderId === order.id);
  await eventually(async () => expect((await client.get<OrderView>(`/orders/${order.id}`)).body.status).toBe('paid'));
  expect(events.received(OrderPaid)).toHaveLength(1);
});
```

Level 2 uses `createTestApplication` and `fake` of `@ddd-ts-kit/di`: the port, an abstract
class, is what the fake is bound under. With another container,
`createTestBuses()` above gives the same buses to register the handler on. At level 3 the
customer of `anOrder()` is generated, the order line is whatever the default says, and the
only values the test states are the ones the rule depends on: the order is paid, then paid
again.

## Contract suites

A fake is only worth trusting if it behaves like the adapter it stands for. Each suite takes
the runner's functions and a factory, and is run against both.

```ts
// contexts/ordering/test/integration/order-repository.contract.spec.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { repositoryContract } from '@ddd-ts-kit/testing/contracts';

const runner = { describe, it, expect, beforeEach, afterEach };
const options = {
  createAggregate: () => anOrder().build(),
  mutate: (order: Order) => order.addLine(aLine().build()),
  idOf: (order: Order) => order.id,
  stateOf: (order: Order) => order.toSnapshot(),
};

repositoryContract(runner, { ...options, name: 'InMemoryOrderRepository', createRepository: () => new InMemoryOrderRepository() });
repositoryContract(runner, { ...options, name: 'DrizzleOrderRepository', createRepository: () => freshDrizzleRepository() });
```

| Suite | Holds |
|---|---|
| `repositoryContract` | save then find, unknown id, update, isolation of the stored copy, optimistic concurrency (any error with code `CONCURRENCY_CONFLICT`) |
| `eventBusContract` | any `EventBus` provider: routing by type, several subscribers, unsubscribe, exact envelope round trip (`traceparent`, `correlationId`), handler failure surfaces. Redeliveries are accepted; return `settle()` from `createBus` for providers that deliver asynchronously |
| `outboxStoreContract` | any outbox store: order, limit, lease, concurrent claims, published, failed, dead, `retryDead`, purge |
| `processedEventStoreContract` | any `ProcessedEventStore`: once per consumer and event, also under concurrent deliveries |
| `cacheContract` | any `Cache`: round trip of every shape of value, isolation of entries, deletion, time to live |
| `lockContract` | any `Lock`: one holder at a time also under concurrent requests, release, expiry, a late release ignored, growing fencing token, `waitMs` |
| `jobSchedulerContract` | any `JobScheduler`: registration and description, a duplicate name and an unreadable schedule refused, `runNow` (also for a disabled job, an unknown name rejected), nothing by time before `start` or after `stop`, no overlap by default, a failing job answered `failed` with its code while the others go on, the execution context of a run |
| `loggerContract` | any `Logger`: every level with its message and fields of every shape, level and message that no field forges, children that add their fields and nest, fields read at each entry, an entry below the level dropped without reading a field, `isLevelEnabled` answering what is written (for a child too), no throw on a circular field or a getter that throws, at the top of the fields included; an `Error` passed as a field written as its description (`type`, `code` of a `DomainError`, `message`, own `stack`, `cause`, eight errors deep at most), its message replaced when the logger scrubs unless it is a `DomainError`; every entry in the sink once `flush()` resolves, then no throw from a log call or a second flush. `createLogger({ level, fields, scrubMessages })` answers the logger and `lines()`, what its sink received as `{ level, message, fields }`. No capability flag: `InMemoryLogger` takes the same three options and passes the whole suite |
| `criteriaContract` | any translator of criteria, the in-memory evaluator included: a table of criteria and the ids each answers, in order, over eight fixed rows. Every operator on every type it applies to, decimals as numbers, instants to the millisecond and across zones, case and the characters a `LIKE` would trip on, nulls under each operator, `and`, `or`, `not` and what a negation does to a null, sorts with ties and nulls in both directions, offset pages with their total, every sort walked by cursor one and two rows at a time, the four kinds of access scope, and hostile values. `createReadModel(rows)` answers `{ list(scopedCriteria) }` over exactly those rows, read with `criteriaContractDefinition` |
| `readModelStoreContract` | any `ReadModelTable` under `TableReadModelStore`: rows of every type round trip, the current row handed to a later event, an event applied once, never one older than the row, order by event id at the same instant and by version when given, concurrent writes ending on the latest, deletions that last, listing by criteria and scope, and `ProjectionRebuild`: rebuilt from the source alone, no event lost while it exports (on a row already copied and on one not yet), stale and new events after the swap, deletions during and before it, a failed export leaving the table as it was, the table still itself after two rebuilds. `createTable()` answers `{ table, unitOfWork }`; `SourceOfTruth` is the fake of the source |
| `rateLimiterContract` | any `RateLimiter`: limit, `remaining` and `retryAfterMs`, refused calls not counted, sliding window, isolation of keys, concurrent calls |

The cache, lock and rate limiter suites also take `elapse(ms)`, which makes time pass for the
subject: advance the clock it reads, or really wait when the time is a server's. The job
scheduler suite takes it from `createScheduler`, with the scheduler and the scope it runs its
jobs in: `{ scheduler, scope, elapse }`. It asks for a few seconds at most, with jobs of every
second.

The suites use only `describe`, `it`, `beforeEach`, `expect(...).toBe` and `toEqual`
(`afterEach` is optional), which the globals of vitest and jest both provide: that part of a
runner is the `ContractRunner` type.

A package that holds a port of its own publishes its contract on the same base, `ContractSuite`:
a subject created anew before each test, and `it`, `expect`, `afterEach` bound to the runner.

```ts
import { ContractSuite, type Awaitable, type ContractRunner } from '@ddd-ts-kit/testing/contracts';

export function geocoderContract(runner: ContractRunner, options: { name: string; create(): Awaitable<Geocoder> }): void {
  new GeocoderSuite(runner, () => options.create()).describe(`${options.name} (geocoder contract)`);
}

class GeocoderSuite extends ContractSuite<Geocoder> {
  protected tests(): void {
    this.it('answers undefined for an address it does not know', async () => {
      this.expect(await this.subject.locate('nowhere')).toBe(undefined);
    });
  }
}
```

## Secrets an adapter must not show

An adapter is logged, spread into a diagnostic and serialised by code that knows nothing of
what it holds. `expectNoSecret(adapter, [password, url])` asserts that none of the given values
shows through `JSON.stringify`, an object spread, the values `Object.keys` leads to, or
`util.inspect` at any depth, hidden properties included. The failure names the view and the
rank of the secret, never its value.

```ts
import { expectNoSecret } from '@ddd-ts-kit/testing';

it('shows no credential', () => {
  const bus = new KafkaEventBus({ brokers, client: { 'sasl.password': password } });

  expectNoSecret(bus, [password]);
});
```

## Standard decorators under Vitest

Vitest 5 (Vite 8, Oxc) lowers legacy decorators and does not lower standard (TC39) ones: a
spec that imports a `.ts` file holding `@CommandHandler(...)` or `@Retry(...)` stops on a
syntax error. `decorators()` closes that gap, and only that one.

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { decorators } from '@ddd-ts-kit/testing/vitest';

export default defineConfig({ plugins: [decorators()] });
```

- **What it does.** A `.ts`, `.mts` or `.cts` file with a line that starts with a decorator is
  compiled by the TypeScript compiler of the project before the runner reads it; every other
  file is left to the runner. Imports are kept as written, for the runner to resolve.
- **Which options it follows.** `target`, `useDefineForClassFields`, `verbatimModuleSyntax`
  and `experimentalDecorators`, read from the `tsconfig.json` nearest to each file (the one
  the runner follows too), or from the `tsconfig` option. A target of `ESNext` would leave
  the decorators in place, so `ES2024` stands in for it.
- **It steps aside in the legacy mode.** Under `experimentalDecorators: true` it answers
  nothing and the runner lowers the decorators itself. A project on class-validator or NestJS
  may keep the plugin in its config or drop it: the result is the same.
- **Source maps.** The map names the real file and holds its text: stack traces, breakpoints
  and coverage point at the source.
- **Cache.** One entry per file content, compiler and options, under the cache directory of
  Vite (`cacheDir` option to move it). A file is compiled once, then read back: about 60 ms
  with the native TypeScript 7 and 220 ms with TypeScript 6 the first time, nothing after.
- **Which compiler.** The `tsc` of the `typescript` package the project installs, from 5.6,
  the native TypeScript 7 included: it runs the compiler binary, not its JavaScript API,
  which the native compiler does not have. `compiler` names another package or a path.

| Option | Default |
|---|---|
| `tsconfig` | the nearest `tsconfig.json` above each file |
| `compiler` | `typescript` |
| `cacheDir` | `ddd-ts-kit-decorators` in the cache directory of Vite |

It does not type-check (the build does), and it does not touch `.tsx`.
