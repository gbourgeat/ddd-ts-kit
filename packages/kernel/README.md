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
| Ports | `Clock`, `IdGenerator`, `UnitOfWork`, `Repository`, `UseCase` |
| Buses | `Command`, `Query`, `CommandBus`, `QueryBus`, `BusMiddleware`, the in-process `InMemoryCommandBus` and `InMemoryQueryBus`, `unitOfWorkMiddleware` |
| Events | `IntegrationEvent`, `EventBus` (publisher and subscriber), `ProcessedEventStore`, `idempotent`, `InMemoryEventBus`, `DomainEventDispatcher` |
| Actor | `Actor`, `AuthorizedCommand`, `AuthorizedQuery`, `ActorContext` |
| Standard interfaces | `Session`, `ExecutionContext` and `ExecutionScope`, `Logger`, `Metrics`, `Cache`, `Page` and `PageRequest`, `AuditStamp`, `TenantScoped` |
| Persistence helpers | `optimisticUpdate`, `schemaNameOf`, `stampCreation`, `stampUpdate`, `tenantScopeOf` |
| Doubles | `FixedClock`, `SequentialIdGenerator`, `InMemoryUnitOfWork`, `FixedActorContext`, `FixedExecutionScope`, `InMemoryLogger`, `InMemoryMetrics`, `InMemoryCache` |

The rules these blocks serve are in `docs/ARCHITECTURE.md`.

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
`systemSession(name, issuedAt?)`.

### ExecutionContext and ExecutionScope

What every unit of work carries, whatever started it: `correlationId`, `causationId?`, `actor`,
`session?`, `tenantId?`, `locale?`, `deadline?`, `origin` (`http`, `event`, `schedule`, `cli`, or a
string of the project) and `extensions`. `executionContext(init)` builds one and takes the tenant
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

### Page and PageRequest

One shape for every list, in two variants:

```ts
offsetPage({ offset: 40, limit: 20, sort: [{ field: 'placedAt', direction: 'desc' }] });
cursorPage({ cursor, limit: 50 });
// both answer a Page<T>: { items, total?, nextCursor? }
```

`offsetPage` and `cursorPage` validate and raise `InvalidPageRequestError`
(`INVALID_PAGE_REQUEST`) beyond `PageLimits` (default size 20, maximum 100). `pageOf(items, more)`
and `mapPage(page, map)` build and translate the answer. The sortable fields are a type
parameter, `PageRequest<'placedAt' | 'total'>`: they differ for each read port, which a global
augmentation could not express.

### AuditStamp and TenantScoped

`AuditStamp` (`createdAt`, `createdBy`, `updatedAt`, `updatedBy`) and `TenantScoped` (`tenantId`)
are columns of a stored record, not properties of an aggregate. `stampCreation(scope, clock)`,
`stampUpdate(stamp, scope, clock)` and `tenantScopeOf(scope)` fill them in a repository adapter.

### Not in the kernel

Feature flags have no port here. Their evaluation model (boolean or variant, targeting,
percentage, who the subject is) differs with each provider, and OpenFeature already is the
vendor-neutral contract: a project that needs flags declares a port in the context that reads
them, named after the decision it takes.

## How to extend

`Session`, `ExecutionContext` and `Actor` each have an empty interface that a project fills by
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
- **`LogFields` and `MetricLabels`** take new well-known keys the same way; unknown keys stay
  allowed.
- **Nothing to register.** The augmentation is types only. Adapters of the kit keep compiling:
  they never read a project extension.
