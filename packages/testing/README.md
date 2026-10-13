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
    if (props.paid) {
      order.pay();
    }
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
    .thenError('ORDER_ALREADY_PAID')
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
| `thenError(code)`, `thenError(code, facts)` | the action refused with that code, whatever the class of the error, carrying these facts when given (it may carry others) |
| `thenError(ErrorClass, code?)` | the action threw an instance of that class: for an error that is one class, as 0.2 wrote them |
| `thenState((aggregate) => ...)` | your own assertions on the aggregate pass |

Failures are `AssertionError`s of `node:assert` with the expected and recorded events side by
side, so they read well under any runner. An error raised by `when` is never swallowed: every
assertion but `thenError` fails on it. When `when` (or the arrangement) is asynchronous, the
chain is a promise: `await given(order).when(async (o) => ...).thenEventNames([...])`.

### An event-sourced aggregate

`givenEvents(rehydrate, events)` rebuilds the aggregate by replaying its history, without a
database, and the scenario goes on as above: one command, then the events it recorded or the
refusal.

```ts
givenEvents((id, history) => AttendanceRecord.rehydrate(id, history), [opened, noShowNoted, noShowNoted])
  .when((record) => record.noteNoShow('appointment-9', now))
  .thenEvents([NoShowNoted, AttendanceRecordBarred]);
```

`expectSnapshotEquivalence({ events, rehydrate, policy, state })` proves the snapshots of an
aggregate: for every version of the history, the aggregate rebuilt from the snapshot its policy
would store and the events after it has the state and the version of the full replay.

## Refusals

A business refusal is known by its code, and carries its facts as data: a test asserts both,
never a message and never the class of one refusal.

```ts
import { expectRefusal } from '@ddd-ts-kit/testing';

expectRefusal(() => calendar.slotFor('consultation', startsAt, now), 'BOOKING_TOO_LATE', { notice: 120 });
expectRefusal(Email.create('ada@'), 'INVALID_EMAIL');
await expectRefusal(() => commands.execute(command), 'SLOT_TAKEN', { calendarId: 'calendar-1' });
```

`expectRefusal(subject, code, facts?)` reads an action, which it runs, a `Result`, or an error
already caught. An action that returns a promise gives a promise to await. It answers the
error, and fails with an `AssertionError` that names what was refused instead, or the facts
that differ, one line each. The facts given must be carried with those values; the refusal may
carry others.

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

The handler only saves: `await this.orders.save(order); return order.id;`. `dispatching(fake)`
gives the fake what the application gives every repository: once `save` (or any method handed
the aggregate) resolved, the events the aggregate recorded are handed over to `domainEvents`.

A handler spec has the production timing. `commandBus` runs every command in `unitOfWork`
(an `InMemoryUnitOfWork`), as the bus of the application does: the events of every save wait
until the command handler has returned, then are dispatched in recording order, and
`execute` resolves once the handlers of both phases ran. A handler that fails in the
`before-commit` phase rejects `execute`; nothing is undone, since there is no transaction in
memory. Called outside a command, `orders.save(order)` dispatches before it resolves.

```ts
domainEvents.on('ordering.order.placed', (event) => board.refresh(event.aggregateId), { phase: 'after-commit' });

await commandBus.execute(new PlaceOrder('sku-1'));       // resolves even when the handler above failed

expect(domainEvents.afterCommitFailures).toEqual([]);    // { error, event } of each failure, the last hundred
```

With `createTestApplication` of `@ddd-ts-kit/di` there is nothing to call: the fake given for a
repository port announces to `app.domainEvents` with the same timing, and the declared domain
event handlers react, each in its phase.

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
| `anExecutionContext()` | the work of a user of its own, origin `test`, correlation of its own | `as(actor)`, `inSession(session)`, `ofTenant`, `elevatedOver(tenants, reason?)`, `correlatedBy`, `causedBy`, `from(origin)`, `dueBy`, `inLocale`, `withExtensions` |

Both are classes on `Builder`, immutable like every builder, and accept a builder wherever an
actor or a session is expected (`aSession().of(anActor().withRole('accountant'))` with the
actor builder of `@ddd-ts-kit/auth/testing`). `scoped(scope, context, work)` runs a block in a
context given as a value or as a builder, with any `ExecutionScope`; `asTenant(scope, 'acme',
work)` runs it as a member of a tenant, and `elevatedOver('all')` builds the context of platform
staff under an elevation, without the audit entry `acrossTenants` writes.

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
| `expectProblem(response, { status, code, facts })` | asserts an RFC 9457 `application/problem+json` answer and returns the document; `code` and `facts` are optional, and `facts` names the facts the document must expose, as JSON writes them (a date is its ISO text) |
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
      if (rows.length > 0) {
        await db.query(`truncate ${rows.map((row) => row.name).join(', ')} restart identity cascade`);
      }
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
    .thenError('ORDER_ALREADY_PAID');
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
| `tenantIsolationContract` | one repository under a strategy of tenant isolation: what a tenant saved is hidden from another; another tenant saving under the same id leaves it untouched, by an update or (given `recreate(aggregate)`, a new aggregate under the same id) by an insert; platform staff elevated over every tenant write nothing, and read the other tenant's aggregate when `elevatedReads` is true (shared tables, row-level security); a write of work that names no tenant is refused (`NoCurrentTenantError`) and a read is refused or finds nothing. `createRepository(scope)` reads the tenant from the scope it is given, on storage where the tenants `acme` and `globex` exist. To prove row-level security itself, run it against a repository that writes no tenant condition |
| `eventBusContract` | any `EventBus` provider: routing by type, several subscribers, unsubscribe, exact envelope round trip (`traceparent`, `correlationId`, `tenantId`), handler failure surfaces. Redeliveries are accepted; return `settle()` from `createBus` for providers that deliver asynchronously |
| `unitOfWorkContract` | any `UnitOfWork`, called through `run` without a command bus: domain events wait for the end and are dispatched before the commit, so handlers see every save and what they write, the outbox included, commits with it; a failure in a save, in the work, in a handler or in the commit (a deferred constraint) leaves nothing behind; `after-commit` handlers run once the rows are committed, never otherwise. An adapter not built on `withinUnitOfWork` fails here |
| `outboxStoreContract` | any outbox store: order, limit, lease, concurrent claims, published, failed, dead, `retryDead`, purge; with `carriesTenant: true`, the tenant of each event kept |
| `processedEventStoreContract` | any `ProcessedEventStore`: once per consumer and event, also under concurrent deliveries |
| `eventStoreContract` | any `EventStore`: a stream created at version 0 and read back in order, numbered from 1, with its type, shape version, data, metadata and instant; an append at a version the stream no longer has (behind or ahead) refused with `CONCURRENCY_CONFLICT` and nothing kept of it; one of two appends at the same version through; streams numbered apart; the whole store read in the order of the appends, positions rising from 1, after a position and within a limit; `head()` |
| `eventStoreUnitOfWorkContract` | a transactional `EventStore` with the outbox of its database under one `UnitOfWork`: the stream and the outbox records published for its events commit together; nothing left in the outbox for an append rolled back, nor for one refused by a concurrency conflict. `createSubject()` answers `{ unitOfWork, store, outbox }` |
| `cacheContract` | any `Cache`: round trip of every shape of value, isolation of entries, deletion, time to live |
| `lockContract` | any `Lock`: one holder at a time also under concurrent requests, release, expiry, a late release ignored, growing fencing token, `waitMs` |
| `jobSchedulerContract` | any `JobScheduler`: registration and description, a duplicate name and an unreadable schedule refused, `runNow` (also for a disabled job, an unknown name rejected), nothing by time before `start` or after `stop`, no overlap by default, a failing job answered `failed` with its code while the others go on, the execution context of a run |
| `loggerContract` | any `Logger`: every level with its message and fields of every shape, level and message that no field forges, children that add their fields and nest, fields read at each entry, an entry below the level dropped without reading a field, `isLevelEnabled` answering what is written (for a child too), no throw on a circular field or a getter that throws, at the top of the fields included; an `Error` passed as a field written as its description (`type`, `code` of a `DomainError`, `message`, own `stack`, `cause`, eight errors deep at most), its message replaced when the logger scrubs unless it is a `DomainError`; every entry in the sink once `flush()` resolves, then no throw from a log call or a second flush. `createLogger({ level, fields, scrubMessages })` answers the logger and `lines()`, what its sink received as `{ level, message, fields }`. No capability flag: `InMemoryLogger` takes the same three options and passes the whole suite |
| `criteriaContract` | any translator of criteria, the in-memory evaluator included: a table of criteria and the ids each answers, in order, over eight fixed rows. Every operator on every type it applies to, decimals as numbers, instants to the millisecond and across zones, case and the characters a `LIKE` would trip on, nulls under each operator, `and`, `or`, `not` and what a negation does to a null, sorts with ties and nulls in both directions, offset pages with their total, every sort walked by cursor one and two rows at a time, the four kinds of access scope, and hostile values. `createReadModel(rows)` answers `{ search(scopedCriteria) }` over exactly those rows, read with `criteriaContractDefinition` |
| `readModelStoreContract` | any `ReadModelTable` under `TableReadModelStore`: rows of every type round trip, the current row handed to a later event, an event applied once, never one older than the row, order by event id at the same instant and by version when given, concurrent writes ending on the latest, deletions that last, listing by criteria and scope, and `ProjectionRebuild`: rebuilt from the source alone, no event lost while it exports (on a row already copied and on one not yet), stale and new events after the swap, deletions during and before it, a failed export leaving the table as it was, the table still itself after two rebuilds. `createTable()` answers `{ table, unitOfWork }`; `SourceOfTruth` is the fake of the source |
| `fileStorageContract` | any `FileStorage`: content round trip with size, media type and checksum, several mebibytes streamed, a write beyond `maxBytes` refused leaving the previous content, keys that could leave their place refused, deletion, copy, move, listing by prefix, signed download and upload links that expire, refuse a changed signature or another media type, and are never signed for more than an hour, a download served as an attachment even without a name. `follow` sends a request to a link: `fetch` by default, `followServed(storage)` for a storage the application serves |
| `rateLimiterContract` | any `RateLimiter`: limit, `remaining` and `retryAfterMs`, refused calls not counted, sliding window, isolation of keys, concurrent calls |

The cache, lock and rate limiter suites also take `elapse(ms)`, which makes time pass for the
subject: advance the clock it reads, or really wait when the time is a server's. The job
scheduler suite takes it from `createScheduler`, with the scheduler and the scope it runs its
jobs in: `{ scheduler, scope, elapse }`. It asks for a few seconds at most, with jobs of every
second.

The unit of work suite takes `createUnitOfWork`, called before each test, which answers a
`UnitOfWorkUnderContract` over an empty table and an empty outbox:
`{ unitOfWork, outbox, insert(id), insertRefusedAtCommit(id), ids(), committedIds?(), close?() }`.
The table holds an identifier under a primary key and a reference to a row of the same table
that the database checks at commit only (a deferred constraint): `insertRefusedAtCommit` writes
a row the commit refuses. Give `committedIds`, what another connection sees, where the
database serves several connections: the suite then also proves that the rows of a
`before-commit` handler are invisible from outside the transaction and visible to the
`after-commit` handlers.

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

## Coverage thresholds read from the config

`@ddd-ts-kit/testing/coverage` gives the test runner what it measures and the floor it is held
to, read from the `coverage` key of `ddd-ts-kit.config.json` (the reference when the key is
absent), so that no threshold is written in a runner config:

```ts
// vitest.config.ts
import { governedCoverage } from '@ddd-ts-kit/testing/coverage';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  test: { coverage: { provider: 'v8', reporter: ['text', 'lcov'], ...governedCoverage(mode) } },
}));
```

- `include`: the layers of every context the run executes, the files no spec loads included.
  `--mode unit` measures `domain`, `application` and `presentation`, `--mode integration`
  measures `infrastructure`, any other mode the four.
- `thresholds`: one entry per context and layer that holds a source file, so a context cannot
  hide behind another and an empty layer is held to nothing until its first file.
- `governedJestCoverage()` gives the same as `collectCoverageFrom` and `coverageThreshold`.
- `REFERENCE_COVERAGE` is the reference: domain 90/85/90/90, application 85/80/85/85,
  presentation 80/70/80/80, infrastructure 70/60/70/70 (statements, branches, functions, lines).

Under the legacy decorator mode with `emitDecoratorMetadata`, add `decoratorCoverage()` of
`@ddd-ts-kit/testing/vitest` to `plugins`: the statements the transform writes to apply
decorators hold, for every type a decorated class names, a branch no test can take; the plugin
marks them with the hint the `v8` provider reads, as the provider does by itself for SWC.
