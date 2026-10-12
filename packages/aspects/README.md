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
// contexts/billing/application/ports/payment-gateway.port.ts
export abstract class PaymentGateway {
  abstract charge(payment: Payment, signal?: AbortSignal): Promise<Receipt>;
}

// contexts/billing/application/ports/payment-settings.port.ts
export abstract class PaymentSettings {
  abstract readonly baseUrl: string;

  abstract readonly apiKey: string;
}

// contexts/billing/infrastructure/external/stripe.gateway.ts
export class StripeGateway implements PaymentGateway {
  constructor(private readonly settings: PaymentSettings) {}

  async charge(payment: Payment, signal?: AbortSignal): Promise<Receipt> {
    return post(`${this.settings.baseUrl}/charges`, payment, { apiKey: this.settings.apiKey, signal });
  }
}

// contexts/billing/billing.module.ts
import { retry, timeout } from '@ddd-ts-kit/aspects';

builder.bind(PaymentSettings).toValue({ baseUrl: config.stripe.url, apiKey: config.stripe.key });
builder
  .bind(PaymentGateway)
  .toClass(StripeGateway, [PaymentSettings])
  .as('external')
  .with(retry({ attempts: 3 }), timeout(2000, { signal: true }));
```

The port is an abstract class and the class is what is bound. `StripeGateway` has no import
from this package and no knowledge of the policy. In the declared style, the default of a
generated project, there is no module file and the same policy is stated in the declaration
of the adapter: `@Adapter(PaymentGateway, { kind: 'external', aspects: [retry({ attempts: 3 }), timeout(2000)] })`. Without a container an aspect is a function:
`retry({ attempts: 3 })(new StripeGateway(settings), { kind: 'external' })`.

### 2. At the composition root, on every binding

```ts
// main.ts
import { Cache, Clock, Logger, Metrics } from '@ddd-ts-kit/kernel';
import { createApplication, kernelModule } from '@ddd-ts-kit/di';
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
  logger: app.resolve(Logger),
  metrics: app.resolve(Metrics),
  cache: app.resolve(Cache),
  clock: app.resolve(Clock),
});
```

`tracing` is the hook of the tracing package written as an aspect:

```ts
const tracing: Aspect = (instance, info) =>
  info?.kind === undefined ? instance : traceDependency(instance, { kind: info.kind, ...(info.context === undefined ? {} : { context: info.context }) });
```

An application on `kernelModule({ instrumentation: traceApplication() })`, which is what the
CLI generates, does not write this `tracing` aspect: the kernel module traces the bindings
itself. Its span is inside whatever the `decorate` hook adds and outside the aspects of a
binding (see "Order"). A generated project does not use the `decorate` hook either: its
platform module puts the default policy around the adapters that leave the process with
`builder.around(['external', 'gateway'], () => when(forKinds('external', 'gateway'), retry(...), timeout(...)))`.

### 3. As a decorator, on an adapter

```ts
// contexts/billing/infrastructure/external/stripe.gateway.ts
import { Retry, Timeout } from '@ddd-ts-kit/aspects/decorators';

export class StripeGateway implements PaymentGateway {
  constructor(private readonly settings: PaymentSettings) {}

  @Retry({ attempts: 3 })
  @Timeout(2000, { signal: true })
  async charge(payment: Payment, signal?: AbortSignal): Promise<Receipt> {
    return post(`${this.settings.baseUrl}/charges`, payment, { apiKey: this.settings.apiKey, signal });
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
**the first is outermost**. Around one instance the application nests, outermost first: the
`decorate` hook, the aspects modules put around a kind with `builder.around(kinds, ...)` in
the order of the modules (the span of `kernelModule({ instrumentation })` comes first, then
for a repository the hand-over of its domain events, then the ones of the platform module),
and last the aspects of the binding itself (`.with(...)`, or `aspects` of a declaration).
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

With the instrumentation of the kernel module, the tracing span is where the kernel module
puts it: `logged` and `timed` given to the `decorate` hook are outside the span, the ones
given to `builder.around` or to a binding are inside it.

A repository has one more wrapper, put by `kernelModule()` between the `decorate` hook and the
aspects of its binding: the hand-over of the domain events of what it saves, which the unit of
work dispatches at its end, before the commit. So the aspects of a binding
(`.with(retry(...))`) are inside it, where a retried save announces its events once. Inside a
unit of work a handler of those events no longer runs during the save, so no retry of a save
ever covers it. Outside of any, the save dispatches before it resolves: a `retry` given to the
`decorate` hook would then run the save again after a handler failed, with no event left to
dispatch. Put the retry of a repository on its binding.

## The aspect runtime

`logged`, `timed` and `cached` need a logger, metrics and a cache. They take them from their
options, or from the runtime that the composition root installs once with
`installAspectRuntime({ logger, metrics, cache, clock, scheduler })`. The runtime is read when
a call is made, never when a class is decorated or an instance wrapped, so the order of the
statements in `main.ts` does not matter. A missing collaborator raises `AspectRuntimeError`,
which names it. The clock and the scheduler default to the system ones. `Scheduler` is the port
of this package for "run this later" (`schedule(work, delayMs)`), an abstract class like the
ports of the kernel: `systemScheduler` is its default, `ManualScheduler` of `./testing` the one
of a spec.

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
context. This package depends on neither. When the same field comes from several places, the
later wins: `base`, then the fields of `child(...)`, then `fields()`, then the fields of the
log call. None can overwrite `time`, `level` or `message`.

It implements the whole port, held by `loggerContract` like the pino and winston adapters:

- **Errors.** An `Error` passed as a field (`logger.error('payment failed', { error })`) is
  written as `describeError` of the kernel describes it: `type`, `code` for a `DomainError`,
  `message`, `stack`, then `cause` the same way. `scrubMessages: true` writes
  `[message removed]` for the message of every error that is not a `DomainError`: turn it on
  when the logs leave your hands. `logged` and `loggingMiddleware` are not concerned: they
  never pass an error, only `errorType` and `errorCode`.
- **`isLevelEnabled(level)`** answers the threshold (`level`, default `info`). `logged` and
  `loggingMiddleware` ask it first: below the threshold no field is built and the `fields`
  function of `logged` is not called.
- **`flush()`** resolves once the standard output took every line written so far, and never
  rejects; the logger stays usable afterwards. `app.stop()` of the di package calls it last.
- **A log call never throws.** Fields that cannot be read or serialized (a getter that throws,
  a circular object), on an entry or on a child, give the entry without them, marked
  `logError: "unserializable fields"`.

It redacts no credential: `@ddd-ts-kit/pino` and `@ddd-ts-kit/winston` do.

## What wrapping guarantees

- The instance is wrapped in place: same object, `instanceof`, `this` and `private` members
  intact. A frozen instance is fronted by a proxy of the same type, and its methods run with
  that proxy as `this`.
- **An aspect applied to an instance advises the calls that reach it from outside.** `private`
  is erased by the compiler, and a name does not say whether a method is public (an underscore
  is a habit, not a rule), so the public API cannot be picked out reliably: every asynchronous
  method reachable by name, a `private async` method and a field holding an asynchronous
  function included, is wrapped. What tells the calls apart is where they come from. While an
  advised call is running on an instance, a call that instance makes on itself, to a public or
  a `private` method, is the inside of that call and is not advised again by the same aspect:
  `retry({ attempts: 3 })` around a public method that goes through a private step makes three
  attempts, not nine, and `logged()` and `timed()` record one call. The guard is kept per
  instance and per aspect, and follows the asynchronous flow of the call
  (`AsyncLocalStorage`): two calls made from outside at the same time are both advised, and so
  is whatever an advised call left behind (a timer, a listener) once that call is over.
- What follows from it: a call that comes back to the instance from a collaborator while the
  advised call is running is the inside of that call too; `cached` serves the callers from
  outside, not a method reading another through `this`; `bulkhead` and `circuitBreaker` count
  one call. A method decorator is not concerned: it advises the one method it is put on, at
  every call, the ones made through `this` included.
- Tracing differs on purpose: `traceDependency` of `@ddd-ts-kit/tracing` opens a child span for
  a call an instance makes on itself. A span describes a step, where an advice acts on it.
- A frozen instance stays frozen: its fields, `private` ones included, cannot be assigned. State
  it must change lives in an object it holds (a `Map`, an array).
- Applying the same aspect twice to an instance is a no-op.
- Getters, symbols, generators, synchronous methods and lifecycle hooks (`LIFECYCLE_HOOKS`) are
  left alone.
- A method declared `async` is advised from its first call. A method that merely returns a
  promise is advised from its second call: declare adapter methods `async`. A decorated method
  is always advised.

## Testing

Wrappers take their collaborators as options, so a spec passes fakes of the kernel. For
decorated classes and for aspects that read the runtime, `@ddd-ts-kit/aspects/testing` gives:

```ts
import { createAspectFakes, withAspectRuntime } from '@ddd-ts-kit/aspects/testing';

const fakes = createAspectFakes();           // logger, metrics, cache, clock, scheduler
const gateway = new StripeGateway({ baseUrl: 'http://stripe.test', apiKey: 'test' });

const pending = withAspectRuntime(fakes, () => gateway.charge(payment));
fakes.scheduler.advance(2000);               // time moves when the test says so

await expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' });
expect(fakes.logger.entries).toEqual([...]);
```

`withAspectRuntime` holds for the work and everything it awaits, and concurrent tests do not
see each other's runtime. With `createTestApplication` of the di package the application is the
runtime: `withAspectRuntime(app, () => ...)`, then assert `app.logger.entries` and `app.metrics`.

## Decorator modes

The decorators of `./decorators` work under both decorator modes of TypeScript, with the same
source line.

| Stack | `tsconfig.json` |
|---|---|
| class-validator, NestJS, TypeORM entities, any library with legacy decorators | `"experimentalDecorators": true` |
| anything else | leave `experimentalDecorators` unset: standard (TC39) decorators need no flag |

- **How the mode is detected.** By the call: the standard one is `(method, context)` with a
  context object, the legacy one `(prototype, name, descriptor)`. `decoratorOf` reads which it
  received, so one function serves both and an aspect has one implementation.
- **What differs.** In the standard mode the method of each instance is wrapped when the
  instance is constructed. The legacy mode has no initializer, so the method is replaced on
  the prototype and the advice of each instance is built at its first call. State (a circuit,
  a compartment, a single flight) is per instance and per method in both, several decorators
  nest as they read in both, and neither needs `emitDecoratorMetadata`.
- **Compilers.** TypeScript 5, 6 and the native TypeScript 7 compile both modes. Node does not
  run decorator syntax, so the code is compiled either way.
- **Vitest.** It lowers legacy decorators by itself: a project with `experimentalDecorators`
  needs nothing. It does not lower standard ones (a spec importing a `.ts` file that uses
  `@Retry` fails with a syntax error): add `decorators()` of `@ddd-ts-kit/testing/vitest` to
  the Vitest config. Files wrapped at the composition root need nothing in either mode.
- **With a declaration.** `@Adapter(...)` on the class and `@Retry(...)` on its methods
  compose, with the `aspects` of the declaration around the decorators of the methods:
  `@Adapter(PaymentGateway, { kind: 'external' })`. A static method, a
  method named by a symbol and a hard-private (`#`) method are refused.

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
