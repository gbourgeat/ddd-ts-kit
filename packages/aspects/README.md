# @ddd-ts-kit/aspects

Logging, metrics, retries, timeouts, circuit breakers and caching are not business logic, so
they are never written inside it. Each one is an aspect: one implementation, put around an
adapter from outside, the way `@ddd-ts-kit/tracing` puts spans around it. The wrapped class
imports nothing, and `domain/` and `application/` never see this package.

```
npm i @ddd-ts-kit/aspects
```

## Three forms, one implementation

The same policy, written three ways. All three run the same code.

### 1. At the composition root, on one binding (preferred)

```ts
// contexts/billing/billing.module.ts
import { retry, timeout } from '@ddd-ts-kit/aspects';

builder
  .bind(PAYMENT_GATEWAY)
  .toClass(HttpPaymentGateway, [HTTP_CLIENT])
  .as('external')
  .with(retry({ attempts: 3 }), timeout(2000, { signal: true }));
```

`HttpPaymentGateway` has no import from this package and no knowledge of the policy. Without
a container an aspect is a function: `retry({ attempts: 3 })(new HttpPaymentGateway(http), { kind: 'external' })`.

### 2. At the composition root, on every binding

```ts
// main.ts
import { StdoutLogger, aspects, forKinds, installAspectRuntime, logged, retry, timed, timeout, when } from '@ddd-ts-kit/aspects';

const app = createApplication({
  modules: [kernelModule({ logger: new StdoutLogger() }), platformModule, billingModule],
  decorate: aspects(
    tracing,
    when(forKinds('repository', 'gateway', 'external'), logged(), timed()),
    when(forKinds('external'), retry({ attempts: 3 }), timeout(2000)),
  ),
});

installAspectRuntime({
  logger: app.resolve(LOGGER),
  metrics: app.resolve(METRICS),
  cache: app.resolve(CACHE),
  clock: app.resolve(CLOCK),
});
```

`tracing` is the hook of the tracing package written as an aspect:

```ts
const tracing: Aspect = (instance, info) =>
  info?.kind === undefined ? instance : traceDependency(instance, { kind: info.kind, ...(info.context === undefined ? {} : { context: info.context }) });
```

### 3. As a standard decorator, on an adapter

```ts
// contexts/billing/infrastructure/external/http-payment.gateway.ts
import { Retry, Timeout } from '@ddd-ts-kit/aspects/decorators';

export class HttpPaymentGateway implements PaymentGateway {
  constructor(private readonly http: HttpClient) {}

  @Retry({ attempts: 3 })
  @Timeout(2000, { signal: true })
  async charge(payment: Payment, signal?: AbortSignal): Promise<Receipt> {
    return this.http.post('/charges', payment, { signal });
  }
}
```

`@Retry`, `@Timeout`, `@Cached`, `@Logged`, `@Timed`, `@CircuitBreaker`, `@Bulkhead`, and
`decoratorOf(adviceFactory)` for an aspect of the project. Several on one method nest as they
read: the first written is outermost. The class takes no logger, metrics or cache in its
constructor: the decorators read them from the aspect runtime when a call is made.

### Which form

- **Prefer the composition root** (forms 1 and 2). The adapter stays free of any import, the
  policy of a whole application is read in one place, and it changes without touching a class.
- **A decorator is acceptable** on an adapter in `infrastructure/` or `platform/` whose policy
  is part of what the adapter is: a client of a provider that documents its own retry and
  timeout rules. Do not apply the same aspect in both forms: it would run twice.
- **Never in `domain/` or `application/`**, in any form: `layer/domain-purity` and
  `layer/application-inward` forbid the import. A use case gets its cross-cutting behaviour
  from a bus middleware, below.

## Aspects

| Aspect | What it does | Default policy | Never records |
|---|---|---|---|
| `logged({ level?, fields?, logger?, clock? })` | entries `<Class>.<method> started` (debug), then `succeeded` (`level`, default info) or `failed` | a `DomainError` fails at `warn`, a fault at `error`; fields `class`, `method`, `kind`, `context`, `durationMs`, `errorType`, `errorCode` | arguments, results, error messages |
| `timed({ name?, metrics?, clock? })` | histogram `<name>_duration_ms`, counter `<name>_total` | `name` is `dependency_call`; labels `class`, `method`, `kind`, `context`, `outcome`, `error_code` | arguments, results, error messages, identifiers |
| `retry({ attempts, backoff?, retryOn?, sleep? })` | calls again after a failure | never after a `DomainError`, an open circuit or a full bulkhead (`isTransient`); 100 ms doubling up to 30 s with full jitter | nothing: it records nothing |
| `timeout(ms, { signal?, scheduler? })` | rejects with `TimeoutError` (`TIMEOUT`) | the underlying call keeps running unless `signal: true` | the message names the class and method only |
| `circuitBreaker({ failureThreshold, resetAfterMs, halfOpenMax?, scope?, isFailure?, onStateChange?, clock? })` | refuses calls with `CircuitOpenError` (`CIRCUIT_OPEN`) after consecutive failures, then lets trial calls through | one circuit per instance and method; a `DomainError` is not a failure; one trial call | `onStateChange` gets class, method, context and the two states |
| `cached({ key, ttlMs, cache?, allowKinds? })` | answers a repeated read from the `Cache` port | refuses kinds `repository` and `use-case`; a call whose key is `undefined` is not cached; failures are not cached; concurrent identical calls share one call; a failing cache is a miss | the key is built by the project from the arguments and goes to the cache only |
| `bulkhead({ maxConcurrent, maxQueued?, scope? })` | bounds the calls running at once, refuses beyond with `BulkheadFullError` (`BULKHEAD_FULL`) | no queue; one compartment per instance and method | nothing |

**Privacy.** The rule is the one of tracing: an entry, a label or an error raised by this
package carries names from the code (class, method, context, kind), a duration, the class of
an error and its short `code`. Never an argument, a result or the message of a caught error:
they quote data. Errors are rethrown untouched.

**`timeout` and cancellation.** With `signal: true` the method is handed an `AbortSignal` as its
last declared parameter, aborted when the time is up. Declare `signal?: AbortSignal` last,
without a default value, and pass it to the underlying call. A signal the caller passed there is
kept: either one aborts. A method without parameter receives none.

**`retry` and jitter.** `backoff: { baseMs, factor, maxMs, jitter }`. `jitter` is a function
`(delayMs, attempt) => delayMs`: `fullJitter()` by default, `fullJitter(seededRandom)` or
`noJitter` for a deterministic schedule. `sleep` replaces the wait altogether.

**`circuitBreaker` and metrics.** `onStateChange: circuitStateGauge()` publishes the state as
the gauge `circuit_breaker_state`: 0 closed, 1 half-open, 2 open.

**`cached` is for reads of gateways and external adapters.** An aggregate served from a cache
behind a repository hides that it is stale, and the next command would decide on old state.
Wrapping a repository or a use case therefore takes an explicit `allowKinds: ['repository']`,
which is a decision to record.

A project writes its own aspect with `defineAspect((joinPoint) => async ({ args, proceed }) => ...)`.

## Selecting what is wrapped

`when(selector, ...aspects)` applies aspects to the methods a selector picks:

| Selector | Picks |
|---|---|
| `forKinds('repository', 'external')` | instances bound with `.as(kind)` |
| `forContext('billing')` | instances of a module |
| `forClasses('Http*')` | instances by class name |
| `forMethods('find*', 'get*')` | methods by name |
| `allOf(...)`, `anyOf(...)`, `not(...)` | combinations |

```ts
when(allOf(forKinds('gateway', 'external'), forMethods('find*')), cached({ key, ttlMs: 60_000 }));
```

## Order

`compose(a, b)`, `.with(a, b)`, `aspects(a, b)` and stacked decorators all read the same way:
**the first is outermost**. The aspects of a binding are inside those of the `decorate` hook.
Order changes meaning:

- `retry` then `timeout`: each attempt has its own time limit. The other way round, one limit
  covers all the attempts and the waits between them.
- `timed` and `logged` outside `retry`: one measurement per call as the caller lived it,
  retries included. Inside, one per attempt.
- `cached` outside `retry` and `circuitBreaker`: a hit costs nothing and is not refused by an
  open circuit.
- `circuitBreaker` inside `retry`: each failed attempt counts, and an open circuit ends the
  retries at once, since `retry` does not retry a `CircuitOpenError`.

The order that fits most adapters, outermost first:

```
tracing, logged, timed, cached, retry, circuitBreaker, bulkhead, timeout, the adapter
```

## The aspect runtime

`logged`, `timed` and `cached` need a logger, metrics and a cache. They take them from their
options, or from the runtime that the composition root installs once with
`installAspectRuntime({ logger, metrics, cache, clock, scheduler })`. The runtime is read when
a call is made, never when a class is decorated or an instance wrapped, so the order of the
statements in `main.ts` does not matter. A missing collaborator raises `AspectRuntimeError`,
which names it. The clock and the scheduler default to the system ones.

## Use cases: bus middlewares

Handlers are not wrapped one by one; the buses are:

```ts
new InMemoryCommandBus()
  .use(loggingMiddleware(logger))
  .use(metricsMiddleware(metrics));
```

Same entries and series as `logged` and `timed` (prefix `use_case`), named after the message
class, never its content. There is no middleware opening an `ExecutionScope`: a command does not
carry a correlation id, and the scope must already be open when the route or the consumer runs,
before any bus. Open it at the boundary.

## StdoutLogger

A small adapter of the kernel `Logger` port writing JSON lines:

```ts
const logger = new StdoutLogger({
  level: 'info',
  base: { service: 'shop-api' },
  fields: () => {
    const context = scope.current();
    return { ...traceLogFields(), ...(context === undefined ? {} : logFieldsOf(context)) };
  },
});
// {"time":"2026-03-01T10:00:00.000Z","level":"info","message":"...","service":"shop-api","trace_id":"..."}
```

`fields` is read at each entry: here the trace ids of the tracing package and, through
`logFieldsOf` of the kernel, the correlation id, actor and tenant of the current execution
context. This package depends on neither. Fields cannot overwrite `time`, `level` or `message`.

## What wrapping guarantees

- The instance is wrapped in place: same object, `instanceof`, `this` and `#private` members
  intact. A frozen instance is fronted by a proxy of the same type.
- Applying the same aspect twice to an instance is a no-op.
- Getters, symbols, `#private` members, generators, synchronous methods and lifecycle hooks
  (`LIFECYCLE_HOOKS`) are left alone.
- A method declared `async` is advised from its first call. A method that merely returns a
  promise is advised from its second call: declare adapter methods `async`. A decorated method
  is always advised.

## Testing

Wrappers take their collaborators as options, so a spec passes fakes of the kernel. For
decorated classes and for aspects that read the runtime, `@ddd-ts-kit/aspects/testing` gives:

```ts
import { createAspectFakes, withAspectRuntime } from '@ddd-ts-kit/aspects/testing';

const fakes = createAspectFakes();           // logger, metrics, cache, clock, scheduler
const gateway = new HttpPaymentGateway(fakeHttp);

const pending = withAspectRuntime(fakes, () => gateway.charge(payment));
fakes.scheduler.advance(2000);               // time moves when the test says so

await expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' });
expect(fakes.logger.entries).toEqual([...]);
```

`withAspectRuntime` holds for the work and everything it awaits, and concurrent tests do not
see each other's runtime. With `createTestApplication` of the di package the application is the
runtime: `withAspectRuntime(app, () => ...)`, then assert `app.logger.entries` and `app.metrics`.

## Toolchain for the decorator form

The decorators are standard (TC39 stage 3) decorators, not `experimentalDecorators`.

- TypeScript 5.0 and later, TypeScript 6 and the native TypeScript 7 compiler compile them with
  no flag: `experimentalDecorators` must stay unset.
- Node does not run decorator syntax, so the code must be compiled. The TypeScript compiler
  lowers it for any `target` below `ESNext`.
- Vitest 5 (Vite 8, Oxc) does not transform standard decorators: a spec importing a `.ts` file
  that uses `@Retry` fails with a syntax error. Test decorated adapters against the compiler
  output, or add a transform that supports the `2023-11` decorators to the Vitest config. Files
  wrapped at the composition root need nothing.

The `./decorators` entry is separate: nothing else in the package imports it.

## Limits

- State (circuits, compartments, single-flight) lives in the process, per wrapped instance. A
  transient binding gets a new state with each instance.
- `retry` repeats the call as it is: only for operations that are safe to repeat.
- `timeout` without `signal` does not stop the underlying call.
- A wrapped call always answers a promise: do not wrap an object whose methods return a
  chainable query builder.
- `when` selects methods of aspects made by `defineAspect`, `compose` or `when`; a plain
  function used as an aspect filters by itself.
