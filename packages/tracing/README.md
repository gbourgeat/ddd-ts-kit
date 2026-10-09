# @ddd-ts-kit/tracing

OpenTelemetry tracing that the domain never sees. Nothing in `domain/` or `application/` imports
this package: adapters and handlers are wrapped where they are registered, in the composition
root.

```
npm i @ddd-ts-kit/tracing @opentelemetry/api
# for the Node bootstrap (@ddd-ts-kit/tracing/node)
npm i @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-http
```

## Composition root

```ts
// platform/tracing.ts: imported before everything else
import { initTracing } from '@ddd-ts-kit/tracing/node';

export const tracing = initTracing({
  serviceName: 'shop-api',
  serviceVersion: process.env.APP_VERSION,
  environment: process.env.APP_ENV,
  exporterUrl: 'http://collector:4318/v1/traces', // or OTEL_EXPORTER_OTLP_ENDPOINT
  sampleRatio: 0.2,
});
```

```ts
// main.ts
import { tracing } from './platform/tracing.js'; // first import, see "Load order"
import { createApplication } from '@ddd-ts-kit/di';
import { InMemoryEventBus } from '@ddd-ts-kit/kernel';
import { traceDependency, tracedPublisher, tracedSubscriber } from '@ddd-ts-kit/tracing';

const bus = new InMemoryEventBus();

const app = createApplication({
  modules: [
    platformModule({ publisher: tracedPublisher(bus), subscriber: tracedSubscriber(bus) }),
    orderingModule,
    billingModule,
  ],
  // Every binding declared with .as(kind) is traced; the classes know nothing about it.
  decorate: (instance, { context, kind }) =>
    kind !== undefined && typeof instance === 'object' && instance !== null
      ? traceDependency(instance, { kind, context })
      : instance,
});

await app.start();
process.on('SIGTERM', () => void app.stop().then(() => tracing.shutdown()));
```

Without a container: `traceDependency(new PgOrderRepository(db), { kind: 'repository', context: 'ordering' })`
and `traceUseCase(new PlaceOrderHandler(repository), { context: 'ordering' })`.

### Load order

Auto-instrumentation patches `http` and the database drivers when they are loaded, so
`initTracing` must have run before. In an ES module the static imports are evaluated before the
first statement of the file: keep the call in its own module and import that module first (as
above), or preload it with `node --import ./dist/platform/tracing.js`. Packages published as ES
modules also need the `@opentelemetry/instrumentation` loader hook.

## What a span contains

`traceDependency` opens one span per call of an async method, named
`<kind>.<ClassName>.<method>`, with `code.namespace`, `code.function`, `app.context` and
`app.dependency.kind`.

- Never arguments, return values or error messages. A failure sets status ERROR, `error.type`
  (the class name) and `app.error.code` (the `code` of a `DomainError`), nothing else, and the
  error is rethrown untouched.
- Synchronous methods are not traced. A method declared `async` is traced from its first call; a
  method that merely returns a promise is traced from its second call. A traced call returns a
  promise, so do not wrap an object whose methods return a chainable query builder.
- Getters, symbols, `#private` members, generators and lifecycle hooks (`onModuleInit`,
  `onModuleDestroy`, `onApplicationBootstrap`, `onApplicationShutdown`, `dispose`) are left alone.
- The instance is wrapped in place: same object, `instanceof` and `this` intact, wrapping twice
  is a no-op. A frozen instance is fronted by a proxy instead.
- Under one local root (an HTTP request, a consumed message), at most 25 spans share a name and
  200 exist in total. Beyond that the call runs untraced and `app.dependency_spans.dropped`
  counts on the root span. Requires `LocalRootTracker` on the provider (`initTracing` installs it).

```ts
configureTracing({ maxSpansPerName: 10, maxSpansPerRoot: 100, lifecycleHooks: ['close'] });
```

## Integration events

`tracedPublisher(publisher)` opens a PRODUCER span `publish <type>` per event and stamps
`traceparent` on events that have none. `tracedSubscriber(subscriber)` runs each handler in a
CONSUMER span `process <type>` that continues it. Attributes: `messaging.operation`,
`messaging.destination.name`, `messaging.message.id`; never the payload.

For a custom transport: `captureTraceparent()` when storing a message,
`runWithTraceparent(traceparent, fn)` when handling it. `spanContextFromTraceparent` accepts
version `00` only and rejects all-zero ids.

## Span processors

For a provider you build yourself, add them before the exporting processor:

| Processor | Effect |
|---|---|
| `LocalRootTracker` | enables the per-root cap, and names the correlation on the local root (see below) |
| `UrlSecretSpanProcessor` | `url.full`, `http.url`, `url.query`: query values and userinfo become `REDACTED`, parameter names stay |
| `ErrorMessageScrubber` | drops `exception.message`, `exception.stacktrace` and the status message recorded by instrumentations; keeps `exception.type` |

## Logs and support reference

```ts
const logger = pino({ mixin: () => traceLogFields() });   // { trace_id, span_id } or {}
response.setHeader('x-correlation-id', correlationIdFromActiveSpan() ?? '');
```

With an `ExecutionScope` of the kernel, a trace and the execution context name each other:

```ts
configureTracing({ executionScope }); // the scope the boundaries run in: app.resolve(EXECUTION_SCOPE)

const logger = pino({ mixin: () => traceLogFields() });
// inside a request: { correlationId, origin, actorId, tenantId?, causationId?, trace_id, span_id }
```

- The local root span of each unit of work (the HTTP server span, the `process <type>` span of
  a consumed event) gets two attributes, `app.correlation_id` and `app.origin`, as soon as a
  span starts inside the scope: the root itself usually starts before the boundary opened the
  scope. A unit of work that starts no span at all under its root is not named.
- **Nothing personal becomes a span attribute**: no actor, no tenant, no session. Those stay in
  the log fields, where `logFieldsOf` of the kernel puts them and where retention is yours.
- `traceLogFields(scope)` takes the scope as an argument instead, for a logger built before
  tracing is configured. `correlationIdFromActiveSpan()` is unchanged: the trace id remains the
  support reference when the project has no execution scope.
- `DependencyKind`, the role given to `traceDependency`, is now the type of the kernel,
  re-exported here under the same name.

`withSpan(name, fn, attributes?)` exists for platform code (a migration, a scheduled job). Domain
and application code never call it.
