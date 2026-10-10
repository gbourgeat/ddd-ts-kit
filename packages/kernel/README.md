# @ddd-ts-kit/kernel

The building blocks every context depends on, and nothing else: no framework, no ORM, no
logger, no dependency at all. `domain/` and `application/` may import it; it is the only package
of the kit they may import.

```
npm i @ddd-ts-kit/kernel
```

## What is inside

| Area | Exports |
|---|---|
| Domain | `Entity`, `AggregateRoot` (version, recorded events), `ValueObject`, `DomainEvent`, `DomainError` with a stable `code` (`InvariantViolation`, `NotFoundError`, `ConflictError`, `ConcurrencyError`), `Result` with `ok`, `err`, `unwrap` |
| Ports | `Clock`, `IdGenerator`, `UnitOfWork`, `Repository` (abstract classes: each one is its own injection token), `UseCase`, `DependencyKind` (the roles a binding declares, read by di, tracing and aspects: `repository`, `gateway`, `external`, `use-case`, `publisher`, `consumer`, `job`) |
| Buses | `Command`, `Query`, `CommandBus`, `QueryBus`, `BusMiddleware`, the in-process `InMemoryCommandBus` and `InMemoryQueryBus`, `unitOfWorkMiddleware` |
| Events | `IntegrationEvent`, `IntegrationEventPublisher`, `IntegrationEventSubscriber`, `EventBus` (both at once), `EventSubscribers` (the subscriber of each bounded context), `ProcessedEventStore`, `idempotent`, `InMemoryEventBus`, `DomainEventDispatcher`, `IntegrationEventCallback` and `DomainEventCallback` (the functions a subscriber and a dispatcher are given), `executionContextOfEvent`, `inEventScope`, `scopedPublisher` |
| Actor | `Actor`, `AuthorizedCommand`, `AuthorizedQuery`, `ActorContext` |
| Standard interfaces | `Session`, `ExecutionContext` and `ExecutionScope`, `Logger`, `Metrics`, `Cache`, `Lock`, `RateLimiter`, `Page` and `PageRequest`, `AuditStamp`, `TenantScoped`, `AuditTrail`, `AuditReader` and `AuditEntry` |
| Scheduled jobs | `JobScheduler`, `ScheduledJob`, `JobExecution`, `JobSchedule`, `JobOptions`, `JobDefinition`, `JobRun`, `JobDescription`, `parseJobSchedule`, `describeJobSchedule`, `jobPolicy`, `executionContextOfJob` |
| Persistence helpers | `optimisticUpdate`, `schemaNameOf`, `stampCreation`, `stampUpdate`, `tenantScopeOf`, `encodeCursor`, `decodeCursor` |
| Doubles | `FixedClock`, `SequentialIdGenerator`, `InMemoryUnitOfWork`, `FixedActorContext`, `FixedExecutionScope`, `InMemoryLogger`, `InMemoryMetrics`, `InMemoryCache`, `InMemoryLock`, `InMemoryRateLimiter` |
| Declarations (`@ddd-ts-kit/kernel/declarations`) | `Requires`, `Public`, `CommandHandler`, `QueryHandler`, `IntegrationEventHandler`, `DomainEventHandler`, `Scheduled`, `Repository`, `Gateway`, `Adapter`, `Policy`, `declarationOf`, `listDeclarations`, `Token`, `describeToken`, `tokenIdentity`, `portDefect` |

The rules these blocks serve are in `docs/ARCHITECTURE.md`.

## Declarations

A class says what it is, and the composition root is assembled from what the classes say.
`@ddd-ts-kit/kernel/declarations` holds the decorators that record it. They are pure metadata:
a declaration instantiates nothing, resolves nothing, reads no configuration and knows no
container. That is why they live here, where the application layer may import them. Turning
declarations into bindings is the job of `@ddd-ts-kit/di` (`contextModule`,
`discoverContext`), and of nothing else.

```ts
// contexts/ordering/domain/repositories/order.repository.ts
import { Repository } from '@ddd-ts-kit/kernel';
import type { Order } from '../aggregates/order.aggregate.js';

export abstract class OrderRepository extends Repository<Order> {
  abstract findOpenOf(customerId: string): Promise<readonly Order[]>;
}
```

```ts
// contexts/ordering/application/commands/place-order/place-order.handler.ts
import { Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { OrderRepository } from '../../../domain/repositories/order.repository.js';
import { PlaceOrder } from './place-order.command.js';

@CommandHandler(PlaceOrder, [OrderRepository, Clock])
export class PlaceOrderHandler implements CommandHandler<PlaceOrder> {
  constructor(
    private readonly orders: OrderRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: PlaceOrder): Promise<string> { /* ... */ }
}
```

```ts
// contexts/ordering/infrastructure/persistence/knex-order.repository.ts
import { Clock, ExecutionScope } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { Database } from '../../application/ports/database.port.js';
import { OrderRepository } from '../../domain/repositories/order.repository.js';

@Repository(OrderRepository, [Database, ExecutionScope, Clock])
export class KnexOrderRepository implements OrderRepository {
  constructor(
    private readonly database: Database,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  /* findById, save, findOpenOf */
}
```

`Repository` is two things under one name, each in its entry: the abstract class a repository
port extends (main entry, imported by the port) and the decorator of its adapter (this entry,
imported by the adapter). No file needs both.

### Ports and tokens

**A port is an abstract class, and the class is the injection token.** The class names the
dependency and carries its type: a dependency list is checked against a constructor, and
`app.resolve(Clock)` answers a `Clock`. `Token<T>` is that type: `abstract new (...args: never) => T`.
There is no token constant and no token file. A port has one place, one abstract class per file:

| Port | File |
|---|---|
| a repository of the domain | `domain/repositories/*.repository.ts` |
| any other port, and a value class | `application/ports/*.port.ts` |

```ts
// contexts/ordering/application/ports/payment-gateway.port.ts
export abstract class PaymentGateway {
  abstract charge(orderId: string, amount: Money): Promise<PaymentReceipt>;
}
```

**The port rule.** A port has abstract members only: no body, no constructor parameter, no
private or protected member. A port may extend another port. An adapter `implements` its port
and never `extends` it. The type stays structural, so a fake, an in-memory class or a plain
object literal stands for a port without ceremony.

**`Repository<A, Id>`** is the contract every repository shares (`findById`, `save`), as an
abstract class. The repository port of an aggregate extends it and adds its own finders, as
`OrderRepository` above; the adapter implements that port.

**A value that is no port** (a configuration object, a database handle, a list, a primitive)
is typed by an abstract class too, with `abstract readonly` properties, and a plain object is
bound to it with `toValue` of `@ddd-ts-kit/di`:

```ts
// contexts/ordering/application/ports/database.port.ts
export abstract class Database {
  abstract readonly client: Knex;
}

// contexts/ordering/application/ports/payment-settings.port.ts
export abstract class PaymentSettings {
  abstract readonly apiKey: string;
}

// composition root
builder.bind(Database).toValue({ client: knex });
builder.bind(PaymentSettings).toValue({ apiKey: configuration.paymentApiKey });
```

That is the one way: no string token, no symbol token, no helper.

**Identity across copies.** A class is its own identity, and two copies of a package loaded in
one process (a duplicated install, a bundle next to `node_modules`) hold two classes. A port
that declares `static readonly tokenKey = '<package>.<Port>'` is known by that key instead,
the same in every copy: `tokenIdentity(port)` answers what a container keys by, and
`describeToken(port)` its name. Every injectable port of the kernel carries one (`kernel.Clock`,
`kernel.CommandBus`, ...); `Repository<A, Id>` is a base to extend, never a token, and carries
none.

```ts
export abstract class PaymentGateway {
  static readonly tokenKey = 'ordering.PaymentGateway';

  abstract charge(orderId: string, amount: Money): Promise<PaymentReceipt>;
}
```

The limit, plainly: **a port of your own that declares no `tokenKey` and is loaded twice is
two tokens.** What is bound under one copy is not found under the other. An application
compiled as one program never meets it; a port published in a package that may be installed
twice, or bundled next to `node_modules`, declares a `tokenKey`. The key is the identity: two
ports that declare the same key are the same token, so prefix it with the package or the
context. It is declared, never inherited: a port that extends a keyed port declares its own.

**What the compiler refuses**, in both decorator modes:

- a dependency list that does not name one port per constructor parameter, each of the type of
  its parameter, in order: a missing list, a missing or extra entry, a wrong type, a wrong order;
- a class that does not implement the port it is declared the adapter of, and an abstract class;
- a concrete class named where its port is expected: `[InMemoryOrderRepository, Clock]` for a
  parameter typed `OrderRepository`. A list names ports, never what implements them.

**What is refused when the file loads**, with a `DeclarationError` from `@Repository`,
`@Gateway` and `@Adapter`, because the compiler cannot see it:

- a port with a body: `TalkativePharmacy implements greet: a port is an abstract class with
  abstract members only`. A member inherited from a parent port counts;
- an adapter that extends its port: `CornerPharmacy extends Pharmacy: an adapter implements
  its port, it never extends it`.

`portDefect(port, implementation)` is that check, answering the reason or `undefined`; a
container applies it to a binding made by hand. A class bound to itself is no port and is
left alone.

### The decorators

| Decorator | On | Example |
|---|---|---|
| `Requires(permission, options?)` | a command or query that carries its actor | `@Requires(permissions['visit.schedule'], { resource: (c: ScheduleVisit) => ({ type: 'patient', id: c.patientId }), audited: ['startsAt'] })` |
| `Public(options?)` | a command or query anybody may send | `@Public()` |
| `CommandHandler(Message, [ports])` | the one handler of a command | `@CommandHandler(PlaceOrder, [OrderRepository, Clock])` |
| `QueryHandler(Message, [ports])` | the one handler of a query | `@QueryHandler(GetOrder, [OrderReadModel])` |
| `IntegrationEventHandler(definition, { consumer, actorOf? }, [ports])` | the handler of an integration event of another context | `@IntegrationEventHandler(OrderPlaced, { consumer: 'billing.invoice-on-order-placed' }, [CommandBus])` |
| `DomainEventHandler(Event, { name }, [ports])` | a handler of a domain event of its own context | `@DomainEventHandler(OrderPaid, { name: 'ordering.order.paid' }, [CommandBus])` |
| `Scheduled(name, schedule and options, [ports])` | a job run by time, which triggers use cases | `@Scheduled('billing.send-reminders', { cron: '0 7 * * 1-5', timeZone: 'Europe/Paris' }, [CommandBus])` |
| `Repository(Port, options?, [ports])` | the adapter of a repository of the domain | `@Repository(OrderRepository, [Database, ExecutionScope, Clock])` |
| `Gateway(Port, options?, [ports])` | the adapter of a port that calls another context | `@Gateway(StockGateway, [HttpClient])` |
| `Adapter(Port, options?, [ports])` | the adapter of any other port | `@Adapter(PaymentGateway, { kind: 'external' }, [PaymentSettings])` |
| `Policy(permission, { name }, [ports])` | a rule that needs the loaded element | `@Policy(permissions['invoice.void'], { name: 'billing.only-issuer-voids' })` |

- **Access is said on the message.** A command extends `Command` or `AuthorizedCommand`, a
  query `Query` or `AuthorizedQuery`: the base class already says which of the two it is, so
  the decorator only says who may send it. `@Requires` is refused by the compiler on a message
  without an actor. `audited` lists the fields an audit trail may record (a name, or
  `{ field, masked: true }`), as plain data; the compiler checks that the message has them.
- **Dependencies are a list of ports**, checked against the constructor as said above. The
  list is left out for a constructor without parameters. There is no parameter decorator and
  no reflection.
- **The role is checked too**: a handler of another message or of another result, an event
  handler of another payload, a job without `run` are refused by the compiler.
- **Options of a repository, a gateway and an adapter**: `transient: true` (one instance per
  resolution instead of one per application), `replaces: true` (takes the place of a binding
  made earlier, such as a default of the kernel module), `aspects: [...]` (wrappers, the first
  outermost); an adapter also takes `kind: 'external' | 'publisher'`.
- **One name for the decorator and for the shape of its class**: `CommandHandler`,
  `QueryHandler`, `IntegrationEventHandler` and `DomainEventHandler` are each a decorator and a
  type, so one import serves `@IntegrationEventHandler(OrderPlaced, ...)` and
  `implements IntegrationEventHandler<OrderPlacedPayload>`. A job implements `ScheduledJob`.
- **Names are written, not derived**: the consumer name, the policy name, the job name and the
  name of the domain event survive the renaming of a class, and the empty string is refused.
- **A declared class is its own token**: `@ddd-ts-kit/di` binds a handler, a job or a policy
  under its class.

`declarationOf(Class)` answers what a class declared, as frozen plain data, or `undefined`;
`listDeclarations()` lists the declared classes the process still holds, for diagnostics. A
class plays one role: a second declaration on the same class throws `DeclarationError` when
the file loads, and so does `@Requires` or `@Public` on what is neither a `Command` nor a
`Query`, and `@Scheduled` with a name or a schedule that cannot be read. A declaration is not
inherited by a subclass.

The names of the main entry differ on purpose: there, `IntegrationEventCallback` and
`DomainEventCallback` are the plain functions given to `subscribe` and to `on`, and
`CommandHandler` and `QueryHandler` are the interfaces alone.

**Where it is stored.** In one registry per process, reached through `Symbol.for`, with the
classes held weakly. A context compiled against one copy of the kernel is therefore read by a
container holding another (a duplicated install, a bundle next to `node_modules`), and a module
reloaded by a watcher leaves no trace of its former classes. `Symbol.metadata` is not used:
Node 24 does not define it, and the legacy decorator mode has no context to carry it.

**Not in the domain.** `domain/` carries no decorator: aggregates, entities, value objects,
domain events, domain services and repository ports declare nothing. A domain event is
named by the handler that reacts to it, not by itself. `@UseCase` does not exist: the
canonical tree has one handler per command and no application service to bind.

### Integration events and their subscribers

`IntegrationEventPublisher` is what use cases publish through, `IntegrationEventSubscriber`
what handlers are subscribed on, and `EventBus` both at once. `EventSubscribers` gives each
bounded context its subscriber: `forContext(name)` answers an `IntegrationEventSubscriber`.
One bus serves every context by default; a broker gives each consuming context its own, so
that a context extracted into its own process keeps its queues. `@ddd-ts-kit/di` subscribes
the integration event handlers of a context on `EventSubscribers.forContext(<context name>)`.

### Scheduled

```ts
// contexts/billing/application/scheduling/send-reminders.job.ts
@Scheduled('billing.send-reminders', { cron: '0 7 * * 1-5', timeZone: 'Europe/Paris' }, [CommandBus])
export class SendRemindersJob implements ScheduledJob {
  constructor(private readonly commands: CommandBus) {}

  async run(execution: JobExecution): Promise<void> {
    await this.commands.execute(new SendReminders(systemActor('billing.send-reminders'), execution.scheduledAt));
  }
}
```

A job lives in `application/scheduling/`, in a `*.job.ts` file, and only triggers use cases:
it receives buses and ports by its dependency list and typically sends one command. The second
argument is the schedule and, next to it, the options:

| Key | Default | |
|---|---|---|
| `every` | | an interval, as milliseconds or `'30s'`, `'15m'`, `'2h'`, `'1d'`, aligned on the Unix epoch |
| `cron`, `timeZone` | `timeZone: 'UTC'` | the five standard fields, on the clocks of an IANA zone |
| `overlap` | `'skip'` | an occurrence that comes while the previous run is in progress is skipped, or `'queue'`d behind it |
| `missed` | `'skip'` | occurrences that passed without being reached are dropped, or the latest is `'run-once'` |
| `timeoutMs` | none | the signal of a longer run is aborted |
| `jitterMs` | `0` | a random delay before each run |
| `enabled` | `true` | meant to be overridden by configuration where the job is wired |
| `singleInstance` | `true` | the scheduler takes the `Lock` of each occurrence |

Exactly one of `every` and `cron` is written, and the compiler refuses the rest. The name is
`<context>.<job-name>` in lower case, unique in the application. `JobExecution` is what `run`
receives: `scheduledAt`, `startedAt`, `attempt` and an abort `signal`. What the schedules mean
across a change of clocks, what one instance among several guarantees and how a job is tested
are in the README of `@ddd-ts-kit/scheduling`.

### Decorator modes

Every decorator of this entry works under both decorator modes of TypeScript, and the same
source line type-checks under both, checks of the role and of the dependency list included.

| Stack | `tsconfig.json` |
|---|---|
| class-validator, NestJS, TypeORM entities, any library with legacy decorators | `"experimentalDecorators": true` |
| anything else | leave `experimentalDecorators` unset: standard (TC39) decorators need no flag |

One program has one mode, which is why the kit follows the project instead of choosing. A
class decorator receives the class first in both modes; the standard call adds a context,
which these decorators do not read. Nothing else differs: no `emitDecoratorMetadata`, no
`reflect-metadata`, no parameter decorator in either mode. Both are compiled by TypeScript 5,
6 and the native TypeScript 7. Under Vitest, legacy decorators need nothing; standard ones
need `decorators()` of `@ddd-ts-kit/testing/vitest`.

## Standard interfaces

Standard means that every project built with the kit has the same shape under the same name, so
an adapter, a middleware or a dashboard written once fits them all. Extensible means that a
project adds its own fields without forking the type (see "How to extend").

### Session

The authenticated session of an actor, as plain data.

| Field | |
|---|---|
| `id`, `actor`, `issuedAt`, `expiresAt?` | who, since when, until when |
| `authenticationMethod` | `none`, `password`, `sso`, `token`, `api-key`, `service`, or a string of the project |
| `authenticationStrength?` | `{ mfa?, assuranceLevel? }` |
| `impersonatedBy?` | id of the support actor acting as `actor`; `logFieldsOf` carries it to every log line |
| `locale?`, `timeZone?`, `client?` | BCP 47 tag, IANA zone, `{ ip?, userAgent? }` as opaque strings |
| `extensions` | the fields of the project |

`isExpired(session, clock.now())`, `isImpersonated(session)`, `anonymousSession()`,
`systemSession(name, issuedAt?)`, and `isSession(value)`, the structural guard a boundary uses on
what it received as a principal.

### ExecutionContext and ExecutionScope

What every unit of work carries, whatever started it: `correlationId`, `causationId?`, `actor`,
`session?`, `tenantId?`, `locale?`, `deadline?`, `scheduledAt?` (for a scheduled job, the instant it
was due), `origin` (`http`, `event`, `schedule`, `cli`, or a string of the project) and `extensions`. `executionContext(init)` builds one and takes the tenant
of the actor; `withActor(context, actor)` is the same work seen as another actor.

`ExecutionScope` (`current()`, `require()`, `run(context, work)`) gives the context of the work
in progress to code that is not handed it. The boundary sets it once:

```ts
// presentation or platform: one run per request, consumed event, job
scope.run(executionContext({ correlationId, actor, session, origin: 'http' }), () => handle(request));
```

```ts
// infrastructure: a repository adapter
const row = { ...toRow(order), ...stampCreation(scope, clock), ...tenantScopeOf(scope) };
```

Use cases and the domain never read the scope: they receive the actor, and anything else they
need, in the command or query (`authz/actor-explicit`). The scope is for loggers, audit columns,
tenant scoping and outgoing headers.

A consumed event opens its own context: `executionContextOfEvent(event, { consumer })` has
origin `event`, the correlation of the event (its id when it names none), the event as
`causationId` and `systemActor(consumer)` as actor; `inEventScope(scope, { consumer }, handler)`
wraps a handler with it. The standard envelope carries no actor, so that no personal data
travels by default: a project whose envelopes name one passes `actorOf`. On the way out,
`scopedPublisher(publisher, scope)` stamps the correlation of the work in progress on every
event published without one, so everything one stimulus causes is found again across processes.

`ActorContext` stays, unchanged. `ScopedActorContext` implements it on top of a scope: the
current actor is the actor of the current execution context, so the two cannot disagree.
`AsyncLocalStorageExecutionScope` follows the asynchronous call chain; `FixedExecutionScope` is
the test double, and follows a `FixedActorContext` when given one.

### Logger

`debug`, `info`, `warn`, `error(message, fields?)` and `child(fields)`. `LogFields` spells the
well-known keys once: `correlationId`, `causationId`, `context`, `actorId`, `tenantId`,
`errorType`, `errorCode`, `durationMs`; any other key is accepted. The kernel never writes to the
console: `NoopLogger` is the default, `InMemoryLogger` records `entries` for a test, and a JSON
lines adapter is in `@ddd-ts-kit/aspects`. The domain and use cases do not log.

### Metrics

`counter(name).increment(labels?, by?)`, `histogram(name).record(value, labels?)`,
`gauge(name).set(value, labels?)`. Label values come from a small closed set, never an
identifier. `NoopMetrics` is the default; `InMemoryMetrics` records `samples` and answers
`counterValue`, `histogramValues` and `gaugeValue` for a subset of labels.

### Cache

```ts
const quoteKey = (pair: string) => cacheKey<Quote>('quote', pair);

await cache.set(quoteKey('EUR-USD'), quote, { ttlMs: 60_000 });
const hit: Quote | undefined = await cache.get(quoteKey('EUR-USD'));
```

The key carries the type of its value. `InMemoryCache(clock, { maxEntries? })` expires by the
`Clock` and is bounded.

### Lock

```ts
const handle = await lock.acquire('nightly-export', { ttlMs: 60_000, waitMs: 0 });
if (handle === undefined) return;            // somebody else holds the key
try {
  await exportEverything();
} finally {
  await handle.release();
}
```

A mutex between processes, to avoid doing the same work twice. `acquire` answers `undefined`
when the key is held, at once or after `waitMs`; the lock frees itself after `ttlMs`; the
`fencingToken` of a `LockHandle` grows with each acquisition of a key, so a resource that
remembers the highest one refuses a holder whose lock expired. It is an efficiency tool, never
the guard of an invariant: what must not happen twice is refused by a database constraint.

`InMemoryLock(clock, { retryDelayMs?, sleep? })` excludes inside one process and expires by the
`Clock`: the fake, and enough for a single instance. The adapter between processes is in
`@ddd-ts-kit/redis`. `acquiring(attempt, waitMs, waiting)` is the retry loop an adapter shares.

### JobScheduler

```ts
abstract class JobScheduler {
  abstract register(job: JobDefinition): void;      // { name, schedule, run, ...options }
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;                   // waits for the runs in progress, then aborts their signal
  abstract runNow(name: string): Promise<JobRun>;   // for an operation or a test
  abstract describe(): readonly JobDescription[];   // name, schedule, enabled, running, nextRunAt, lastRun
}
```

What runs the declared jobs when they are due. It is not the `Scheduler` of
`@ddd-ts-kit/aspects`, which is a timer for retry and timeout: this one knows jobs, schedules
and instances. A `JobRun` is one occurrence and its outcome (`succeeded`, `failed` with the
code of the error and never its message, `skipped-overlap`, `skipped-locked`, `missed`). A job
that fails stops neither the scheduler nor the other jobs, and `runNow` answers `failed`
instead of rejecting: only an unknown name rejects (`UnknownJobError`), and a name registered
twice throws (`DuplicateJobError`).

A run happens inside `ExecutionScope`, in the context `executionContextOfJob(name, { correlationId,
scheduledAt, deadline? })` builds: origin `schedule`, `systemActor(name)`, a correlation of its
own, and `scheduledAt`, the instant the run was due, which `ExecutionContext` carries for this
origin.

`parseJobSchedule(schedule)` validates a schedule and answers the form occurrences are
computed from (`InvalidJobScheduleError`, code `INVALID_JOB_SCHEDULE`, otherwise);
`describeJobSchedule(schedule)` is its text; `jobPolicy(options)` validates the options and
fills in the defaults. The kernel holds no scheduler: the in-process one, the computation of
occurrences and the manual one for tests are `@ddd-ts-kit/scheduling`, and the contract of the
port is `jobSchedulerContract` of `@ddd-ts-kit/testing/contracts`.

### RateLimiter

```ts
const decision = await limiter.consume(`password-reset:${accountId}`, { limit: 3, windowMs: 3_600_000 });
if (!decision.allowed) throw new TooManyAttempts(decision.retryAfterMs);
```

A sliding window: at any instant, at most `limit` allowed calls in the `windowMs` before it. A
`RateLimitDecision` is `{ allowed, remaining, retryAfterMs }`; a refused call is not counted.
The key is whatever is limited: a client, a tenant, a route and an address together.

`InMemoryRateLimiter(clock)` counts inside one process; the adapter shared by several instances
is in `@ddd-ts-kit/redis`. `rateLimitDecisionOf(counted, limit)` turns what an adapter counted
into the decision.

### Page and PageRequest

One shape for every list, in two variants:

```ts
offsetPage({ offset: 40, limit: 20, sort: [{ field: 'placedAt', direction: 'desc' }] });
cursorPage({ cursor, limit: 50 });
// both answer a Page<T>: { items, total?, nextCursor? }
```

A cursor is opaque to the client and plain to the reader: `encodeCursor(position)` writes the
sort values of the last item of a page, `decodeCursor(cursor)` reads them back and refuses what
it did not write. It is not signed: the read port checks the types of what it decodes before
they reach a statement. **A cursor needs a total order**: append a unique key (the primary key)
to the sort, in the same direction, put it in the position, and compare the whole tuple. Rows
that are equal on the sort field otherwise have no defined order, and a page could repeat or
skip one of them. The adapter packages show the query for each ORM.

`offsetPage` and `cursorPage` validate and raise `InvalidPageRequestError`
(`INVALID_PAGE_REQUEST`) beyond `PageLimits` (default size 20, maximum 100). `pageOf(items, more)`
and `mapPage(page, map)` build and translate the answer. The sortable fields are a type
parameter, `PageRequest<'placedAt' | 'total'>`: they differ for each read port, which a global
augmentation could not express.

### AuditStamp and TenantScoped

`AuditStamp` (`createdAt`, `createdBy`, `updatedAt`, `updatedBy`) and `TenantScoped` (`tenantId`)
are columns of a stored record, not properties of an aggregate. `stampCreation(scope, clock)`,
`stampUpdate(scope, clock)` and `tenantScopeOf(scope)` fill them in a repository adapter:

```ts
// insert: who creates is also who last updated
const row = { ...toRow(order), ...tenantScopeOf(scope), ...stampCreation(scope, clock) };
// update: the two columns to set, the creation is left alone; the tenant is part of every condition
await update({ ...toRow(order), ...stampUpdate(scope, clock) }, { id: order.id, ...tenantScopeOf(scope) });
```

`stampUpdate(stamp, scope, clock)` is the form for an adapter that holds the stored stamp (a
document store rewriting the whole record): it answers it whole, creation untouched.
`tenantScopeOf` raises `NoCurrentTenantError` for work that names no tenant, so a statement can
never run unscoped by omission. Every adapter package names the columns the same way:
`created_at`, `created_by`, `updated_at`, `updated_by`, `tenant_id`.

### AuditTrail, AuditReader and AuditEntry

```ts
abstract class AuditTrail {
  abstract record(record: AuditRecord): Promise<void>;
}

abstract class AuditReader {
  abstract list(filter: AuditFilter, page: PageRequest<AuditSortField>): Promise<Page<AuditEntry>>;
}
```

The two ports of an audit trail and the shape of one entry (`AuditEntry`, `AuditRecord` for
what a source hands over, `AuditFilter`, and the types they name), so that code which records
or lists depends on the kernel alone. `AuditTrail` is append only and is fed by infrastructure
and cross-cutting code (a bus middleware, the authorization hook, an event subscription), never
by a use case or an aggregate. `AuditReader` is what a query handler depends on to list
entries. A project adds fields to every entry through `AuditEntryExtensions`.

The kernel holds no implementation: the hash chain, the sources, redaction, verification and
the stores, the in-memory one included, are `@ddd-ts-kit/audit`.

### Not in the kernel

Feature flags have no port here. Their evaluation model (boolean or variant, targeting,
percentage, who the subject is) differs with each provider, and OpenFeature already is the
vendor-neutral contract: a project that needs flags declares a port in the context that reads
them, named after the decision it takes.

## How to extend

`Session`, `ExecutionContext`, `Actor` and `AuditEntry` each have an empty interface that a project fills by
declaration merging, once, in a declaration file of its platform:

```ts
// src/platform/kernel-extensions.d.ts
import '@ddd-ts-kit/kernel';

declare module '@ddd-ts-kit/kernel' {
  interface SessionExtensions {
    readonly plan: 'free' | 'team';
  }
  interface ExecutionContextExtensions {
    readonly region: string;
  }
  interface ActorExtensions {
    readonly department: string;
  }
  interface AuditEntryExtensions {
    readonly region: 'eu' | 'us';
  }
  interface LogFields {
    orderId?: string;
  }
  interface MetricLabels {
    region?: 'eu' | 'us' | undefined;
  }
}
```

```ts
session.extensions.plan;          // 'free' | 'team' | undefined
context.extensions.region;        // string | undefined
actor.attributes.department;      // string | undefined
entry.extensions.region;          // 'eu' | 'us' | undefined
logger.info('shipped', { orderId: 42 });   // compile error: orderId is a string
```

- **`extensions`, not top-level fields.** A project field lives under `extensions`, so a
  standard field added to `Session` or `ExecutionContext` in a later version can never collide
  with it.
- **Optional when read.** `anonymousSession()`, `systemSession()` and `executionContext()` carry
  no extension, and they must stay truthful in every project: an extension reads as
  `T | undefined`.
- **`Actor` keeps its bag.** Authorizers already read `actor.attributes` by name, and actors
  travel in messages: `ActorExtensions` gives known attributes a name and a type inside that
  bag instead of adding a second one. An extension that is not an `ActorAttribute` (a string, a
  number, a boolean or a list of strings) reads as `never`.
- **`AuditEntryExtensions` holds JSON.** An entry is hashed and stored as it is: an extension
  that is not plain JSON (a `Date`, a class) reads as `never`.
- **`LogFields` and `MetricLabels`** take new well-known keys the same way; unknown keys stay
  allowed.
- **Nothing to register.** The augmentation is types only. Adapters of the kit keep compiling:
  they never read a project extension.
