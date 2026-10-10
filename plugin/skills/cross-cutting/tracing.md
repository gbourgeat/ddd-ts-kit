# Tracing

Rule: no file under `domain/` or `application/` imports a tracing library
(`layer/domain-purity`, `layer/application-inward`). Spans are added where objects are
wired. API: README of `@ddd-ts-kit/tracing`.

## What the bootstrap wires

- `src/platform/tracing.ts` starts the SDK and is the **first import** of `src/main.ts`: in
  an ES module every static import is evaluated before the body, so starting it later
  misses `http` and the database drivers.
- The `decorate` hook of the composition root (`src/platform/decorate-bindings.ts`) wraps
  what is bound, by kind: `repository`, `gateway`, `external`, `use-case`, `publisher`,
  `consumer`. One span per I/O call, none for in-memory methods.
- The event provider is wrapped with `tracedPublisher` and `tracedSubscriber`: the
  `traceparent` travels in the envelope and the consumer continues the producer's trace.
- Log lines carry the trace fields (`traceLogFields(scope)`), so a trace, its logs, its audit
  entries and its error report share one identifier. Show that identifier to users as a
  support reference.
- `npm run infra:up` with the `observability` profile starts a local tracing backend.

## What a span may carry

Class, method, context, kind, and on failure the error class and the domain error `code`;
the root span also the correlation id and the origin. Never arguments, return values, error
messages, anything about the actor, or full URLs with query strings. The processors
installed at start scrub URL secrets and exception messages: keep them.

## Review checklist

- No `tracer.startSpan`, `@Span()` or `span.setAttribute` in a handler or an aggregate. A
  business measure wanted on a trace is a domain event or a metric emitted by an adapter.
- A new adapter is bound with its kind, so it is traced without a line of its own.
- Sampling and the exporter endpoint come from configuration, not code.
