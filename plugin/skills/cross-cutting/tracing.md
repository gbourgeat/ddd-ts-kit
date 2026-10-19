# Tracing

Rule: `@ddd-ts-kit/tracing` and `@opentelemetry/*` are imported only by `src/platform/`,
`main.ts` and `apps/` (`tracing/platform-only`); `domain/` and `application/` never see a
span. The application is observed from outside, where it is composed. API: README of
`@ddd-ts-kit/tracing`.

## What the bootstrap wires

- `src/platform/observability/tracing.ts` starts the SDK (`initTracing`) and is the **first import** of
  `src/main.ts`: in an ES module every static import is evaluated before the body, so
  starting it later misses `http` and the database drivers.
- `src/platform/composition/lay-foundations.ts` builds `traceApplication()` once, and
  `compose-application.ts` hands it to `kernelModule({ instrumentation })`: one span per use
  case, per call to a repository, a gateway or an outside adapter, per domain event handler,
  outbox append, publication, consumed event and job. Nothing is wrapped by hand, and no
  class knows it is traced.
- The HTTP boundary (`src/platform/auth/authentication/http-boundary.ts`) takes `around: tracedRoutes()`;
  the publisher the outbox relay delivers with is `tracedPublisher(bus)`, so the publication
  and each consumer continue the trace of the command that recorded the event
  (`TRACE_CONSUMERS=link` starts one trace per delivery instead).
- Log lines carry the trace fields (`traceLogFields(scope)`), so a trace, its logs, its audit
  entries and its error report share one identifier. Show that identifier to users as a
  support reference.
- `docker compose --profile observability up -d jaeger` starts a local tracing backend;
  spans leave the process only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set.

## Span names

Stable and low in cardinality: `command <Name>` and `query <Name>`,
`<kind> <Port>.<method>` (`repository InvoiceRepository.save`, `gateway ...`,
`external ...`), `unit-of-work before-commit` and `unit-of-work after-commit` (siblings
that follow the save spans under the command), under them `domain-event <name>` and
`handler <ClassName>` for its handlers, `outbox append <type>`,
`publish <type>`, `process <consumer>`, `job <context>.<job>`. A scheduled job is a trace
of its own.

## What a span may carry

Class, method, context, kind, outcome, and on failure the error class and the domain error
`code`; the root span also the correlation id and the origin. Never arguments, return
values, error messages, anything about the actor, or full URLs with query strings. The
processors installed at start scrub URL secrets and exception messages: keep them.

## Review checklist

- No `tracer.startSpan`, `@Span()` or `span.setAttribute` in a handler or an aggregate. A
  business measure wanted on a trace is a domain event or a metric emitted by an adapter.
- A new adapter is declared or bound with its kind (`repository`, `gateway`, `external`),
  so it is traced without a line of its own; a port rebound by a later module than the
  kernel module is not wrapped.
- Sampling and the exporter endpoint come from configuration, not code.
